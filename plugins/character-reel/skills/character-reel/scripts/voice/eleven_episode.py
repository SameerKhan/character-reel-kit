"""Build an episode's voice.wav + timing.json from an ElevenLabs text-to-dialogue/with-timestamps result.

usage: .venv/bin/python eleven_episode.py <episode_dir> <dialogue.mp3> <dialogue.timing.json> [max_tail_s]

The episode's script.json supplies everything the renderer needs per line (who, face, pose, caption_map, ...) and the
caption text; ElevenLabs supplies the audio and per-character timings. Each line is cut from the dialogue at its
voice-segment boundaries; silence after a line's last word is capped at max_tail_s (default 0.4 s) so the reel stays
tight, while everything before the words (gasps, sighs, breaths) is kept. Bracketed audio tags never reach captions.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from textalign import LEAD_IN, align_chars, apply_caption_map, lufs  # noqa: E402

SR = 24000
VOICE_LUFS = -23.5  # same speech level tts.py hands to mix.sh
MAX_SILENCE = 0.28  # a silent stretch longer than this is shortened to it (gasps, sighs, breaths are not silent)
MIN_WORD = 0.08     # a caption word never shorter than this
END_BEAT = 0.6      # silence after the last line, so the end card never lands on the final syllable
FADE = 0.008        # every splice gets a short fade so no cut can click
PROTECTED = set(filter(None, os.environ.get("PROTECTED_EPISODES", "").split(",")))  # approved episodes this tool must never write into


def fade(a, n=None):
    n = min(int(FADE * SR) if n is None else n, len(a) // 2)
    if n > 0:
        r = np.linspace(0, 1, n, dtype=np.float32)
        a = a.copy(); a[:n] *= r; a[-n:] *= r[::-1]
    return a


def squeeze_silence(a, words, floor_db):
    """Shorten silent runs (20 ms frames below floor_db, never within 0.1 s of a word) to MAX_SILENCE; each splice is
    faded; word times are remapped through the cut."""
    hop = int(0.02 * SR)
    n = len(a) // hop
    if n == 0:
        return a, words
    db = 20 * np.log10(np.sqrt(np.mean(a[: n * hop].reshape(n, hop) ** 2, axis=1)) + 1e-9)
    for w in words:  # a word and its edges are never "silence"
        db[max(0, int((w["s"] - 0.1) / 0.02)): int((w["e"] + 0.1) / 0.02) + 1] = 0.0
    keep = np.ones(len(a), bool)
    k = 0
    while k < n:
        if db[k] < floor_db:
            j = k
            while j < n and db[j] < floor_db:
                j += 1
            run = (j - k) * hop
            if run > MAX_SILENCE * SR:  # drop the middle of the run, keep its edges
                lo = k * hop + int(MAX_SILENCE * SR / 2)
                hi = j * hop - int(MAX_SILENCE * SR / 2)
                keep[lo:hi] = False
            k = j
        else:
            k += 1
    # fade both sides of every splice
    edges = np.flatnonzero(np.diff(keep.astype(np.int8)))
    n_f = int(FADE * SR)
    a = a.copy()
    for e in edges:
        if keep[e] and not keep[e + 1]:  # audio stops here
            lo = max(0, e + 1 - n_f); a[lo: e + 1] *= np.linspace(1, 0, e + 1 - lo, dtype=np.float32)
        else:  # audio resumes here
            hi = min(len(a), e + 1 + n_f); a[e + 1: hi] *= np.linspace(0, 1, hi - e - 1, dtype=np.float32)
    cum = np.cumsum(~keep)  # samples removed before each sample
    def remap(t):
        i = min(len(a) - 1, max(0, int(t * SR)))
        return (i - cum[i]) / SR
    return a[keep], [{**w, "s": remap(w["s"]), "e": remap(w["e"])} for w in words]


def min_durations(words, dur):
    """Lengthen very short words up to MIN_WORD, never past the next word's start or the clip's end."""
    for k, w in enumerate(words):
        limit = min(words[k + 1]["s"] if k + 1 < len(words) else dur, dur)
        if w["e"] - w["s"] < MIN_WORD:
            w["e"] = max(w["e"], min(w["s"] + MIN_WORD, limit))
        w["e"] = min(w["e"], limit) if limit >= w["s"] else w["e"]
    return words


def anchor_offsets(mp3, chars, cs, ce, segs):
    """ElevenLabs' alignment can drift (measured: ~0.96 s early from one line to the end of a take). Re-anchor each
    line to where Whisper hears its words: per line, the median of (heard start - ElevenLabs start) over matched words.
    Offsets under 0.15 s are treated as noise (0). The build fails if a line has no matched words."""
    from difflib import SequenceMatcher
    from faster_whisper import WhisperModel
    from textalign import _letters, spell_numbers
    el = []  # (line index, letters, start)
    for idx, sg in enumerate(segs):
        word, w0, depth = "", None, 0
        for k in range(sg["character_start_index"], sg["character_end_index"]):
            c = chars[k]
            if c == "[":
                depth += 1
            if depth:
                if c == "]":
                    depth -= 1
                continue
            if c.isspace():
                if _letters(word):
                    for p in spell_numbers(word.strip(".,?!\"'")).split():
                        el.append((idx, _letters(p), w0))
                word, w0 = "", None
                continue
            word += c
            if w0 is None and c.isalnum():
                w0 = cs[k]
        if _letters(word):
            for p in spell_numbers(word.strip(".,?!\"'")).split():
                el.append((idx, _letters(p), w0))
    wm = WhisperModel("small.en", device="cpu", compute_type="int8")
    heard = []
    for sgm in wm.transcribe(str(mp3), language="en", word_timestamps=True)[0]:
        for w in sgm.words or []:
            if w.end - w.start < 0.02:  # zero-length words are Whisper hallucinations
                continue
            for p in spell_numbers(w.word.strip().strip(".,?!")).split():
                heard.append((_letters(p), w.start))
    per = {}
    for a0, b0, n in SequenceMatcher(None, [x[1] for x in el], [h[0] for h in heard], autojunk=False).get_matching_blocks():
        for k in range(n):
            per.setdefault(el[a0 + k][0], []).append(heard[b0 + k][1] - el[a0 + k][2])
    out = []
    for idx in range(len(segs)):
        if not per.get(idx):
            sys.exit(f"line {idx + 1}: Whisper matched none of its words; check the take by ear")
        med = float(np.median(per[idx]))
        out.append(med if abs(med) >= 0.15 else 0.0)
    moved = [(i + 1, round(o, 2)) for i, o in enumerate(out) if o]
    if moved:
        print("re-anchored lines (line, seconds):", moved)
    return out


def main(ep_dir: Path, mp3: Path, timing_path: Path, max_tail: float):
    if ep_dir.name in PROTECTED:
        sys.exit(f"refusing to write into the approved episode {ep_dir.name}; copy it to a new episode id first")
    for f in ("voice.wav", "timing.json"):
        if (ep_dir / f).is_symlink():
            sys.exit(f"{ep_dir / f} is a symlink; refusing to write through it")
    if not 0 <= max_tail <= 2:
        sys.exit("max_tail must be between 0 and 2 seconds")
    script = json.loads((ep_dir / "script.json").read_text())
    if not script.get("lines"):
        sys.exit("script has no lines")
    t = json.loads(timing_path.read_text())
    chars = t["alignment"]["characters"]
    cs, ce = t["alignment"]["character_start_times_seconds"], t["alignment"]["character_end_times_seconds"]
    segs = sorted(t["voice_segments"], key=lambda s: s["dialogue_input_index"])
    if len(segs) != len(script["lines"]):
        sys.exit(f"{len(segs)} voice segments but {len(script['lines'])} script lines")
    with tempfile.NamedTemporaryFile(suffix=".wav") as f:
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(mp3), "-ac", "1", "-ar", str(SR), f.name], check=True)
        audio, _ = sf.read(f.name, dtype="float32")

    if len(audio) < SR // 10:
        sys.exit("decoded dialogue audio is empty or too short")
    hop0 = int(0.02 * SR); n0 = len(audio) // hop0
    speech_db = float(np.percentile(20 * np.log10(np.sqrt(np.mean(audio[: n0 * hop0].reshape(n0, hop0) ** 2, axis=1)) + 1e-9), 90))
    shifts = anchor_offsets(mp3, chars, cs, ce, segs)
    total = len(audio) / SR
    line_tokens = []
    for idx, (line, s) in enumerate(zip(script["lines"], segs)):
        off = shifts[idx]
        # spoken words of this segment with their times, tags removed
        tokens, word, w0, w1, depth = [], "", None, None, 0
        for k in range(s["character_start_index"], s["character_end_index"]):
            c = chars[k]
            if c == "[":
                depth += 1
            if depth:
                if c == "]":
                    depth -= 1
                continue
            if c.isspace():
                if word.strip():
                    tokens.append({"w": word, "s": w0, "e": w1})
                word, w0 = "", None
                continue
            word += c
            w0 = cs[k] if (w0 is None and c.isalnum()) else w0
            if c.isalnum():  # punctuation carries the following pause in ElevenLabs' alignment; never extend a word over it
                w1 = ce[k]
        if word.strip():
            tokens.append({"w": word, "s": w0, "e": w1})
        tokens = [x for x in tokens if any(ch.isalnum() for ch in x["w"])]
        tokens = [{**x, "s": x["s"] + off, "e": x["e"] + off} for x in tokens]
        if not tokens:
            sys.exit(f"line {line.get('text')!r}: no aligned words in its ElevenLabs segment")
        line_tokens.append(tokens)

    # one shared boundary per neighbouring pair, so the lines tile the audio with no gap and no overlap: just after the
    # earlier of the two (shifted) segment edges, never before the previous line's last word or after the next line's
    # first word. A leading sigh/gasp therefore stays with its own line.
    first_s = [min(x["s"] for x in t) for t in line_tokens]
    last_e = [max(x["e"] for x in t) for t in line_tokens]
    cuts = [max(0.0, min(segs[0]["start_time_seconds"] + shifts[0], first_s[0] - 0.05))]
    for i in range(1, len(segs)):
        lo, hi = last_e[i - 1] + 0.05, first_s[i] - 0.02
        b = min(segs[i - 1]["end_time_seconds"] + shifts[i - 1], segs[i]["start_time_seconds"] + shifts[i])
        if lo > hi:
            sys.exit(f"lines {i} and {i + 1}: their words overlap after re-anchoring; check the take by ear")
        cuts.append(min(max(b, lo), hi))
    # the last line may run past its ElevenLabs edge (drift), but at most 1.5 s past its last word
    cuts.append(min(total, max(segs[-1]["end_time_seconds"] + shifts[-1], last_e[-1] + 0.1), last_e[-1] + 1.5))
    for i in range(len(segs)):
        if not (cuts[i] <= first_s[i] and cuts[i + 1] >= last_e[i]):
            sys.exit(f"line {i + 1}: its clip {cuts[i]:.2f}-{cuts[i + 1]:.2f} s does not contain its words")

    clips = []
    for idx, (line, tokens) in enumerate(zip(script["lines"], line_tokens)):
        seg0, seg1 = cuts[idx], cuts[idx + 1]
        last = last_e[idx]
        # keep any sound after the last word (a laugh, a breath): cut only once 50 ms of near-silence has passed
        seg_audio = audio[int(seg0 * SR): int(seg1 * SR)]
        hop = int(0.01 * SR)
        k0 = int((last - seg0) * SR)
        end_sound = k0
        quiet = 0
        for k in range(k0, len(seg_audio) - hop, hop):
            lvl = 20 * np.log10(np.sqrt(np.mean(seg_audio[k:k + hop] ** 2)) + 1e-9)
            if lvl > speech_db - 45:
                end_sound, quiet = k + hop, 0
            else:
                quiet += 1
                if quiet >= 5:
                    break
        cut1 = min(seg1, seg0 + end_sound / SR + max_tail)
        a = fade(audio[int(seg0 * SR): int(cut1 * SR)])
        rel = [{"w": x["w"], "s": x["s"] - seg0, "e": x["e"] - seg0} for x in tokens]
        clips.append((line, a, align_chars(line["text"], rel)))

    # silence floor relative to the dialogue's own speech level, then squeeze long silent stretches
    allaudio = np.concatenate([c[1] for c in clips])
    hop = int(0.02 * SR); nn = len(allaudio) // hop
    fdb = 20 * np.log10(np.sqrt(np.mean(allaudio[: nn * hop].reshape(nn, hop) ** 2, axis=1)) + 1e-9)
    floor_db = float(np.percentile(fdb, 90)) - 50  # well below quiet breaths and whispers
    clips = [(l, *squeeze_silence(a, w, floor_db)) for l, a, w in clips]
    clips = [(l, a, min_durations(w, len(a) / SR)) for l, a, w in clips]

    # one gain for the whole dialogue (ElevenLabs already balances the two voices), to the pipeline's speech level
    g = np.float32(10 ** ((VOICE_LUFS - lufs(np.concatenate([c[1] for c in clips]))) / 20))
    track, t_now, out_lines = [np.zeros(int(LEAD_IN * SR), np.float32)], LEAD_IN, []
    for i, (line, a, words) in enumerate(clips):
        a = a * g
        dur = len(a) / SR
        out_lines.append({
            "i": i, "who": line["who"], "text": line["text"],
            **{k: v for k, v in line.items() if k not in ("who", "text", "say", "pause", "speed", "caption_map", "ex", "cfg", "seed", "style", "temp")},
            "start": round(t_now, 3), "end": round(t_now + dur, 3),
            "words": [{"w": w["w"], "s": round(t_now + w["s"], 3), "e": round(t_now + w["e"], 3),
                       **({"parts": [{"w": p["w"], "s": round(t_now + p["s"], 3), "e": round(t_now + p["e"], 3)} for p in w["parts"]]} if "parts" in w else {})}
                      for w in apply_caption_map(words, line.get("caption_map", []))],
        })
        track.append(a)
        t_now += dur
    track.append(np.zeros(int(END_BEAT * SR), np.float32))
    t_now += END_BEAT
    voice = np.concatenate(track)
    peak = float(np.abs(voice).max())
    if peak > 0.89:
        voice *= 0.89 / peak
    meta = {"duration": round(t_now, 3), "screen": script.get("screen"), "screens": script.get("screens"),
            "tagline": script.get("tagline"), "lines": out_lines, "voice_source": "elevenlabs eleven_v3 text-to-dialogue"}
    vfd, vtmp = tempfile.mkstemp(prefix=".voice-", suffix=".tmp.wav", dir=ep_dir); os.close(vfd)
    tfd, ttmp = tempfile.mkstemp(prefix=".timing-", suffix=".tmp.json", dir=ep_dir); os.close(tfd)
    try:  # same-folder temp files, then rename: a failure never leaves a half-written or mismatched pair
        sf.write(vtmp, voice, SR)
        Path(ttmp).write_text(json.dumps(meta, indent=1))
        backup = None
        if (ep_dir / "voice.wav").exists():
            bfd, backup = tempfile.mkstemp(prefix=".voice-prev-", suffix=".tmp.wav", dir=ep_dir); os.close(bfd)
            os.replace(ep_dir / "voice.wav", backup)
        try:
            os.replace(vtmp, ep_dir / "voice.wav")
            os.replace(ttmp, ep_dir / "timing.json")
        except BaseException:  # never leave new audio next to old timing: put the previous voice back
            if backup:
                os.replace(backup, ep_dir / "voice.wav")
                backup = None
            raise
        finally:
            if backup and os.path.exists(backup):
                os.remove(backup)
    finally:
        for p in (vtmp, ttmp):
            if os.path.exists(p):
                os.remove(p)
    print(f"{len(out_lines)} lines, {t_now:.1f}s -> {ep_dir / 'voice.wav'}")


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve(),
         float(sys.argv[4]) if len(sys.argv) > 4 else 0.4)
