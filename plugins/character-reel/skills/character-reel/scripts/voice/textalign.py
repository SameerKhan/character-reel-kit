"""Text and timing helpers shared by the voice scripts: number spelling for Whisper text, two caption aligners
(align: legacy character-count consumer kept for gap maths; align_chars: character-sequence matcher used for captions),
caption_map collapsing (spoken "twelve thirty" shown as "12:30") and an ffmpeg loudness probe."""
import json
import os
import re
import subprocess
import tempfile

import numpy as np
import soundfile as sf

SR = 24000


LEAD_IN = 0.15  # the hook starts almost immediately


def _letters(s: str) -> str:
    return "".join(c for c in s.lower() if c.isalnum())


_ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()


_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def _num(n: int) -> str:
    if n < 20: return _ONES[n]
    if n < 100: return _TENS[n // 10] + ("" if n % 10 == 0 else " " + _ONES[n % 10])
    if n < 1000: return _ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + _num(n % 100))
    if n % 100 == 0 and n % 1000 != 0 and n < 10000: return _num(n // 100) + " hundred"  # 1200 -> twelve hundred
    return _num(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + _num(n % 1000))


def spell_numbers(word: str) -> str:
    """Whisper writes numbers as digits ('1,200', '12:30', '5th'); the aligner matches letters against the script's
    spelled-out words, so spell them out first."""
    import re
    w = word.replace(",", "")
    m = re.fullmatch(r"(\d{1,2})[:.](\d{2})(\W*)", w)
    if m: return _num(int(m.group(1))) + " " + _num(int(m.group(2))) + m.group(3)
    m = re.fullmatch(r"(1[0-2])([0-5]\d)(\W*)", w)  # Whisper's "1230" for twelve thirty (1200 stays twelve hundred; 350 stays a number)
    if m and m.group(2) != "00": return _num(int(m.group(1))) + " " + _num(int(m.group(2))) + m.group(3)
    m = re.fullmatch(r"(\d+)(st|nd|rd|th)?(\W*)", w)
    if m:
        out = _num(int(m.group(1)))
        if m.group(2):
            last = out.split()[-1]
            irregular = {"one": "first", "two": "second", "three": "third", "five": "fifth", "eight": "eighth", "nine": "ninth", "twelve": "twelfth"}
            last = irregular.get(last, last[:-1] + "ieth" if last.endswith("y") else last + "th")
            out = " ".join(out.split()[:-1] + [last])
        return out + m.group(3)
    return word


def apply_caption_map(words: list, mapping: list) -> list:
    """Collapse spoken phrases into one caption token, e.g. "twelve thirty." -> "12:30.". The token spans
    the whole phrase and keeps each spoken word's timing in "parts" (mouth motion, caption checks)."""
    out, i = [], 0
    while i < len(words):
        for phrase, shown in mapping:
            want = [_letters(p) for p in phrase.split()]
            got = [_letters(w["w"]) for w in words[i:i + len(want)]]
            if got == want:
                run = words[i:i + len(want)]
                tail = re.search(r"[^\w']*$", run[-1]["w"]).group(0)
                out.append({"w": shown + tail, "s": run[0]["s"], "e": run[-1]["e"], "parts": run})
                i += len(want)
                break
        else:
            out.append(words[i])
            i += 1
    return out


def align_chars(text: str, tokens: list) -> list:
    """Caption timings. The script's letters and Whisper's letters are matched as two character sequences, so a
    token Whisper heard differently ("A" for "Hey", ".29." for "twenty nine") cannot shift every later word the way
    align() does. A script word takes the span of the tokens its matched letters fall in; a word with no match sits
    between its neighbours. Result is in order and never overlaps."""
    from difflib import SequenceMatcher
    words = [w for w in text.split() if _letters(w)]
    if not words or not tokens:
        return align(text, tokens)
    s_chars, s_own, t_chars, t_own = "", [], "", []
    for k, w in enumerate(words):
        s_chars += _letters(w); s_own += [k] * len(_letters(w))
    for k, tok in enumerate(tokens):
        lt = _letters(spell_numbers(tok["w"].strip(".,!?;:\"'")))
        t_chars += lt; t_own += [k] * len(lt)
    hit = [set() for _ in words]
    for a, b, n in SequenceMatcher(None, s_chars, t_chars, autojunk=False).get_matching_blocks():
        for j in range(n):
            hit[s_own[a + j]].add(t_own[b + j])
    out = [{"w": w, "s": tokens[min(h)]["s"], "e": tokens[max(h)]["e"], "t": (min(h), max(h))} if h else {"w": w, "s": None, "e": None, "t": None}
           for w, h in zip(words, hit)]
    # words that landed in the same token span (Whisper merged them), plus any unmatched words between them, share
    # that span evenly
    k = 0
    while k < len(out):
        if out[k]["t"] is None:
            k += 1; continue
        j = k
        for m in range(k + 1, len(out)):
            if out[m]["t"] == out[k]["t"]:
                j = m
            elif out[m]["t"] is not None:
                break
        if j > k:
            s0, e0 = out[k]["s"], out[k]["e"]
            step = (e0 - s0) / (j - k + 1)
            for m in range(k, j + 1):
                out[m]["s"], out[m]["e"], out[m]["t"] = s0 + step * (m - k), s0 + step * (m - k + 1), ("split", k)
        k = j + 1
    k = 0
    while k < len(out):  # a run of unmatched words shares the gap between its matched neighbours evenly
        if out[k]["s"] is not None:
            k += 1
            continue
        j = k
        while j < len(out) and out[j]["s"] is None:
            j += 1
        prev = out[k - 1]["e"] if k else tokens[0]["s"]
        nxt = out[j]["s"] if j < len(out) else tokens[-1]["e"]
        lo = k
        if nxt - prev < 0.05 * (j - k) and k:  # no room (neighbours share one token): split the word before with the run
            lo, prev = k - 1, out[k - 1]["s"]
        nxt = max(prev, nxt)
        step = (nxt - prev) / (j - lo)
        for m in range(lo, j):
            out[m]["s"], out[m]["e"] = prev + step * (m - lo), prev + step * (m - lo + 1)
        k = j
    for k in range(1, len(out)):  # monotonic, no overlap
        out[k]["s"] = max(out[k]["s"], out[k - 1]["e"])
        out[k]["e"] = max(out[k]["e"], out[k]["s"])
    return [{"w": o["w"], "s": o["s"], "e": o["e"]} for o in out]


def align(text: str, tokens: list) -> list:
    """Map the TTS word timings back onto the script's own words so captions keep
    their punctuation ("Switch." not "Switch"). Tokens are consumed until their
    letters cover each script word."""
    out, ti = [], 0
    for word in text.split():
        need = _letters(word)
        if not need:
            continue
        got, first, last = "", None, None
        while ti < len(tokens) and len(got) < len(need):
            tok = tokens[ti]; ti += 1
            got += _letters(tok["w"])
            first = first or tok
            last = tok
        if first is None:  # ran out of timings: hang the word on the end of the line
            first = last = tokens[-1] if tokens else {"s": 0, "e": 0}
        out.append({"w": word, "s": first["s"], "e": last["e"]})
    return out


def lufs(audio: np.ndarray) -> float:
    with tempfile.NamedTemporaryFile(suffix=".wav") as f:
        sf.write(f.name, audio, SR)
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", f.name, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float([l for l in r.splitlines() if l.strip().startswith("I:")][-1].split()[1])

