# character-reel-kit

**Make a short two-character comedy reel with Claude Code**: a mascot and a human in a 3D set, voiced as one acted
conversation (gasps, sighs, whispers, laughs), with word-synced captions, a beat-cut camera, music under the voice,
and scripted checks before anyone watches it.

You write the scene. The `/character-reel` skill walks Claude through the story, the voice direction, the ElevenLabs
take, the timing fixes, the render, the mix and the gates.

## The example reel

![Storyboard of the example reel](media/example-storyboard.jpg)

**[Watch the example (60 s, 540x960, MP4, 4 MB)](media/example-ep01-540p.mp4)** ·
[full 1080x1920 version](https://github.com/SameerKhan/character-reel-kit/releases/latest) ·
[poster frame](media/example-poster.jpg)

*That's a wrap*: Leo, a social media manager, posted his lunch on a client's LinkedIn. Switch, the AI, tells him it
is doing numbers (900 likes, against 12 on the launch post), explains why it worked (it went out at the account's
best time to post), and Leo schedules tomorrow's launch for the same minute. He then goes to get lunch. Switch:
"Don't post it." Leo: "Already scheduled. Same wrap."

The reel is Social Champ's: its brand, the Switch mascot, the screen captures and the characters are not covered by
this repo's MIT licence (see [LICENSE](LICENSE)). **Audio: voices generated with [ElevenLabs](https://elevenlabs.io)
(Eleven v3, default voices "Liam" and "Jessica")**, on the free plan, which allows non-commercial use with this
credit; publishing your own reels commercially needs a paid ElevenLabs plan.

## Why this exists

The example took thirteen versions. Open-source voices were rejected three times ("the tone doesn't change", "all
robotic", "the gasps sound fake"); ElevenLabs v3 dialogue was approved ("emotions are great"). Then the first
ElevenLabs render had a clipped last line and captions a second late at the end. The cause was not the renderer:
ElevenLabs' own timing data drifted by a second at one long sigh. The kit now re-anchors every line to where Whisper
hears it, keeps every breath between lines, and fails the build if captions drift. Every rule in the skill names the
failure that produced it. [Read the case study](plugins/character-reel/skills/character-reel/references/case-study.md).

## Quick start

1. Install the plugin in Claude Code:

   ```bash
   /plugin marketplace add SameerKhan/character-reel-kit
   /plugin install character-reel@character-reel-kit
   ```

2. Install the tools (Node 20+, ffmpeg, Python 3.11+, Chrome recommended), then render the example without any API
   key: **[walkthrough](plugins/character-reel/skills/character-reel/references/walkthrough.md)**.

3. Ask Claude for a reel: "/character-reel a reel where Leo double-booked a client launch and Switch finds the
   conflict". To voice new lines, set `ELEVENLABS_API_KEY` in your environment.

## What is inside

| Part | What it does |
|---|---|
| `SKILL.md` | the order of work and the hard rules |
| `references/` | story format (with measured reference numbers), voice direction and casting, timing, camera and captions, QA gates, case study, walkthrough |
| `scripts/make-reel.sh` | the whole pipeline with gates |
| `scripts/voice/` | `eleven_generate.py` (one dialogue call), `eleven_episode.py` (re-anchor, tile, caption timing), `check_sync.py` (caption gate), `textalign.py`, `music.py` |
| `scripts/engine/` | `desk.html` (shot planner, captions, facing cheats), `switch.js` (fur mascot), `man.js` (low-poly human), `set-desk.js`, `render.mjs` (headless Chrome, frame by frame), `mix.sh` (ducked music bed, -14 LUFS) |
| `examples/ep01-wrap/` | the approved example: script, tagged dialogue, voice ids and the ElevenLabs output, so it renders offline |

## Gates

Caption sync (every line within 0.25 s of what Whisper hears), no overlapping or zero-length caption words, every
line's audio contains all its words, -14 LUFS +- 0.5, true peak <= -1 dBTP, 20 to 62 s. The example passes all of
them; the kit reproduces the approved voice track byte for byte.

## Requirements

macOS or Linux, Node 20+, ffmpeg, Python 3.11+ (`numpy`, `soundfile`, `faster-whisper`), Chrome or Playwright's
Chromium. An ElevenLabs API key only for voicing new lines.

## Licence

Code: MIT. Brand, mascot, characters, screen captures and the example reel: Social Champ, all rights reserved.
Example audio: generated with ElevenLabs.
