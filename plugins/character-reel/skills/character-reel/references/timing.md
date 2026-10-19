# Timing: from ElevenLabs output to caption-accurate voice

`eleven_episode.py` turns `dialogue.mp3` + `dialogue.timing.json` into `voice.wav` + `timing.json`. Every step below
exists because a render went wrong without it.

## 1. ElevenLabs alignment can drift: re-anchor every line

In the example take, ElevenLabs placed every word from line 19 ("[long sigh] Fine. It stays...") to the end about
**0.96 s earlier** than it is spoken. Lines 1 to 18 were within 0.2 s. The model spent longer on the sigh than its
alignment allowed for. Two visible defects followed: captions ran a second early for the last 15 seconds, and the final
line was cut mid-word because its segment "ended" a second before the audio did.

Fix: `anchor_offsets()` runs faster-whisper over the raw mp3, matches its words to ElevenLabs' words, and takes the
median offset per line. Offsets under 0.15 s are ignored; larger ones shift that line's words and segment. A line with
no matched words stops the build. Zero-length Whisper words are discarded: they are hallucinations (Whisper "heard"
a second "That's a wrap" in the room tone).

## 2. Tile the lines: never drop audio between them

Shifting lines independently opened gaps that belonged to no line, and audio there was silently dropped (0.23 s of
speech before one line, the whole 0.97 s sigh before another). Now each neighbouring pair shares one boundary, placed
at the earlier of the two shifted segment edges, clamped between the previous line's last word and the next line's
first word. A leading sigh therefore stays with its own line. The build stops if any clip would not contain all its
words. The last line may run past its ElevenLabs edge, but at most 1.5 s past its last word.

## 3. A word ends at its last letter

ElevenLabs attaches the pause after a sentence to the final punctuation mark ("." lasting 0.3 to 1.1 s). Treating
that as part of the word made captions linger and, on the last line, left no room to keep the tail.

## 4. Keep sound after the last word, squeeze only true silence

Each line's audio runs until 50 ms of near-silence after its last word, plus a 0.2 s tail, so a trailing laugh or
breath is kept. Silent stretches longer than 0.28 s are shortened, never within 0.1 s of a word, with an 8 ms fade at
every splice. A 0.6 s beat follows the last line so the end card does not land on the final syllable.

## 5. Captions

`textalign.align_chars()` matches script letters to heard letters as two character sequences, so a misheard word
("A" for "Hey", ".29." for "twenty nine") cannot shift every later word. Words that share one heard token, and
unmatched words, share time evenly. `apply_caption_map()` collapses a spoken phrase into one caption token ("12:30")
that spans the phrase and keeps each spoken word's timing for the mouth animation.

## 6. Gate

`check_sync.py` transcribes the final `voice.wav` and fails if any line's median caption offset exceeds 0.25 s, or any
caption word overlaps the next or has zero length. The example passes with every line within 0.12 s.
