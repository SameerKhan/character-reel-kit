"""Caption sync gate: compare every caption word in timing.json with where faster-whisper hears it in voice.wav.

usage: python check_sync.py <episode_dir> [max_offset_s=0.25]
Prints the median (caption start - heard start) per line and exits 1 if any line is off by more than max_offset_s,
or if any caption word overlaps the next or has zero length. Zero-length Whisper words are ignored (hallucinations).
"""
import json
import statistics as st
import sys
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from textalign import _letters, spell_numbers  # noqa: E402


def main(ep: Path, limit: float):
    from faster_whisper import WhisperModel
    t = json.loads((ep / "timing.json").read_text())
    cap = [(l["i"] + 1, p) for l in t["lines"] for w in l["words"] for p in (w.get("parts") or [w])]
    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    heard = [(_letters(p), w.start) for s in m.transcribe(str(ep / "voice.wav"), language="en", word_timestamps=True)[0]
             for w in s.words or [] if w.end - w.start >= 0.02 for p in spell_numbers(w.word.strip().strip(".,?!")).split()]
    per = {}
    for a0, b0, n in SequenceMatcher(None, [_letters(p["w"]) for _, p in cap], [h[0] for h in heard], autojunk=False).get_matching_blocks():
        for k in range(n):
            per.setdefault(cap[a0 + k][0], []).append(cap[a0 + k][1]["s"] - heard[b0 + k][1])
    meds = {k: st.median(v) for k, v in sorted(per.items())}
    print("per-line median caption minus heard (s):", {k: round(float(v), 2) for k, v in meds.items()})
    bad = [k for k, v in meds.items() if abs(v) > limit]
    overlaps = sum(1 for l in t["lines"] for a, b in zip(l["words"], l["words"][1:]) if b["s"] < a["e"] - 1e-6)
    zero = sum(1 for l in t["lines"] for w in l["words"] if w["e"] - w["s"] < 0.02)
    unmatched = [l["i"] + 1 for l in t["lines"] if l["i"] + 1 not in per]
    print(f"lines off by more than {limit} s: {bad or 'none'} | overlaps {overlaps} | zero-length {zero} | lines with no heard match {unmatched or 'none'}")
    sys.exit(1 if bad or overlaps or zero else 0)


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve(), float(sys.argv[2]) if len(sys.argv) > 2 else 0.25)
