---
name: character-reel
description: Make a short two-character comedy reel (Instagram/TikTok, 9:16, under 60 s) in code: a mascot and a human in a 3D set, voiced by ElevenLabs v3 as one acted conversation (gasps, sighs, whispers, chuckles), with word-synced captions, a beat-cut camera plan, music under the voice, and scripted gates. Use when someone wants a brand mascot skit, a "Claude & Pixel" style AI-and-human reel, an animated two-hander, or to re-voice / re-render one of these reels; also when ElevenLabs dialogue timing looks off or captions drift.
---

# Character reel

A reel is built from four files and four tools. Everything is code, so any line, voice or shot can be changed and the
reel re-rendered in about three minutes.

```
episodes/<id>/script.json     lines: who, text (caption text), face, pose, pause, caption_map; page, screens, tagline
episodes/<id>/dialogue.json   the same lines as ElevenLabs v3 text with audio tags: [gasps] [sighs] [whispers] ...
episodes/<id>/voices.json     {"human": "<ElevenLabs voice id>", "switch": "<voice id>"}
          eleven_generate.py  one text-to-dialogue call -> dialogue.mp3 + dialogue.timing.json
          eleven_episode.py   cut, re-anchor, caption timing -> voice.wav + timing.json
          engine/desk.html    three.js characters + set + shot planner + captions, rendered frame by frame in Chrome
          engine/mix.sh       music bed ducked under the voice, mastered to -14 LUFS
```

Run it: `scripts/make-reel.sh <work_dir> <id> [--voice] [--final NAME]`. Read
[references/walkthrough.md](references/walkthrough.md) the first time.

## The order of work (do not skip ahead)

1. **Story first, in plain text.** One disaster the human causes, one product idea that resolves it, a callback
   closer. Under 30 turns, 1 to 8 words each. Rules and the measured reference numbers:
   [references/story.md](references/story.md). Every product claim must trace to a source document; write that
   source into `script.json` as `claims_checked_against`.
2. **Direct the voices in `dialogue.json`.** Same words as `script.json`, plus ElevenLabs v3 tags where a person
   would really react. Spoken numbers stay as words ("twelve thirty"); captions show digits through `caption_map`.
   Tag vocabulary, casting and what failed before ElevenLabs: [references/voice.md](references/voice.md).
3. **Voice it once, for the whole scene.** `eleven_generate.py` sends every line in ONE text-to-dialogue request, so
   the two voices react to each other. Line-by-line generation sounds like two people in different rooms.
4. **Build the timed voice.** `eleven_episode.py` re-anchors ElevenLabs' timing to where Whisper hears each word
   (its alignment can drift by a second mid-take), tiles the lines with no gaps, and ends each word at its last
   letter. Then `check_sync.py` must pass. Why each step exists: [references/timing.md](references/timing.md).
5. **Render and mix.** Shot plan, captions, facing cheats and the end card live in `engine/desk.html`:
   [references/camera-and-staging.md](references/camera-and-staging.md).
6. **Gates, then eyes, then the owner.** Scripted gates in `make-reel.sh`; the visual and listening checklist in
   [references/qa-gates.md](references/qa-gates.md). Show the owner the reel with timestamps of what to check.

## Hard rules (each one cost a version)

- Never pitch-shift or time-stretch a voice to add emotion. It was rejected as "all robotic". Emotion comes from the
  take: tags, wording, punctuation, a re-roll.
- Open-source TTS was tried for three rounds (Kokoro, Chatterbox, Chatterbox-Turbo with tags). Gasps and sighs
  "sound fake". ElevenLabs v3 dialogue is the first that was approved ("emotions are great").
- Never trust ElevenLabs `voice_segments` / `alignment` blindly. Re-anchor and run `check_sync.py`.
- Never cut a line at a fixed time after its last word: laughs and breaths come after words.
- Never drop audio between lines. Lines share boundaries; a leading sigh belongs to its own line.
- Characters must face each other in every shot that holds both of them (a per-shot facing cheat). Singles may cheat
  toward the lens.
- A new sentence always gets its own caption, even with no pause; no "..." in front of a new sentence.
- Time is shown as digits in captions ("12:30"), spoken as words.
- The approved episode is protected: build new versions under a new episode id (`PROTECTED_EPISODES=id1,id2`
  makes `eleven_episode.py` refuse to write into them).
- Free ElevenLabs plan: 10,000 characters a month, no commercial licence, no Voice Library voices over the API
  (HTTP 402). Publishing needs at least the Starter plan; library voices need Creator or credits.

## Files

- `scripts/make-reel.sh`: the whole pipeline with gates.
- `scripts/voice/`: `eleven_generate.py`, `eleven_episode.py`, `check_sync.py`, `textalign.py`, `music.py`.
- `scripts/engine/`: `desk.html`, `switch.js` (fur mascot), `man.js` (low-poly human), `set-desk.js`, `render.mjs`,
  `mix.sh`, `assets/`.
- `examples/ep01-wrap/`: the approved example, including the ElevenLabs output, so it renders without an API key.
- `references/case-study.md`: thirteen versions of the example and the owner feedback that forced each change.
