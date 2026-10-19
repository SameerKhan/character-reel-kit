# Voice: ElevenLabs v3 dialogue

## Why ElevenLabs, and what failed first

| Round | Engine | Owner's verdict |
|---|---|---|
| 1 | Kokoro (open source) | "The audio doesn't have expressions, like the tone doesn't change." |
| 2 | Chatterbox with neutral reference clips | approved for breath and whispers, later "something is missing" |
| 3 | Chatterbox + pitch shift / time stretch per line | "voice is all robotic" |
| 4 | Chatterbox with per-emotion reference clips | more range for the human, still "something missing" |
| 5 | Chatterbox-Turbo with [gasp] [sigh] [whispering] tags | "the ones you did sound fake" |
| 6 | ElevenLabs v3 text-to-dialogue | "Emotions are great." Approved. |

Measured lessons along the way: the open-source models copied the delivery of their reference clip (a flat clip gave
a flat take); Turbo's style tags such as `[whispering]` did nothing measurable on the female voice; post-processing
pitch and tempo always sounded robotic.

## Generate the whole scene in one call

`eleven_generate.py` sends every line to `/v1/text-to-dialogue/with-timestamps` with `model_id: eleven_v3`. One call
means the second voice hears the first: timing, overlap of energy and reactions sound like one room. The response
carries `alignment` (per character start/end) and `voice_segments` (one per input line).

## Tags that worked in the example

`[gasps]`, `[sighs]`, `[long sigh]`, `[exhales]`, `[groans]`, `[whispers]`, `[chuckles]`, `[laughs softly]`, plus
delivery cues: `[calmly]`, `[panicking]`, `[annoyed]`, `[flatly]`, `[deadpan]`, `[frustrated]`, `[warning]`,
`[mischievously]`, `[impressed]`, `[reading slowly]`, `[softly]`, `[hurried]`, `[pause]`.

- One tag at the start of most lines; a second one mid-line only where the delivery turns ("It went out at twelve
  thirty. [softly] Your best time to post.").
- Write numbers as words in `dialogue.json` ("twelve thirty"); captions show digits through `caption_map` in
  `script.json`: `"caption_map": [["twelve thirty", "12:30"]]`.
- Check the take with Whisper: no tag word may be spoken aloud ("sigh", "whispers"), and every script word must be
  heard.

## Casting

Audition voices on the same 6-line excerpt, in dialogue with the other character, not as solo demos. In the example
the owner rejected two male voices as "robotic" before picking one; the female voice was chosen first and kept.

The example's voices are ElevenLabs default voices: Liam for the human, Jessica for the mascot. Voice Library voices
(community voices) cannot be used over the API on the free plan; Voice Design (a custom voice from a text prompt)
needs a paid plan too.

## Plan limits and licence (checked 2026-10-19)

- Free: 10,000 characters a month; non-commercial; attribution required; no Voice Library or Voice Design over the
  API (HTTP 402 / 403).
- Starter ($6/month) adds the commercial licence. Creator ($22/month) or $5 of credits unlocks library voices.
- The key lives in the `ELEVENLABS_API_KEY` environment variable. Never print it, never write it into the repo.
