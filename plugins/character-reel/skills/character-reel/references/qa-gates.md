# QA: gates, then eyes, then the owner

## Scripted (make-reel.sh)

| Gate | Pass |
|---|---|
| Caption sync (`check_sync.py`) | every line's median offset <= 0.25 s; no overlapping or zero-length caption words |
| Loudness | -14 LUFS +- 0.5 (integrated) |
| True peak | <= -1.0 dBTP |
| Duration | 20 to 62 s including the 2.4 s end card |
| Clip containment | every line's clip contains all its words (build stops otherwise) |

## Before showing anyone

- Transcribe the raw take: every script word heard, no tag word spoken aloud.
- Pull a frame from every two-shot: the characters face each other.
- Pull frames at three or four lines in the last 15 seconds: captions match the words being spoken (drift shows there
  first).
- Listen to the last line through to the end card: nothing cut, a beat of silence before the card.

## Showing the owner

Give a table of timestamps and what to check at each (the gasp at 0:00, the sigh at 0:11, the whisper, the time
digits, the laugh at the end), then ask three questions: keep this voice, keep that voice, is the length fine.
Feedback that came back this way and changed the kit: "That's a wrap got ended abruptly", "the subtitles were slower
to change", "on 0:12 they are not looking at each other".

## Review traps seen with model reviewers

- Two models agreeing under one prompt is weak evidence; one model's audio claim ("the tail is a hallucinated
  repeat") was wrong until checked against word timestamps of the raw audio.
- Whisper timing is fuzzy at reactions: it stretches the next word back over a gasp. Judge per-line medians, not
  single words.
