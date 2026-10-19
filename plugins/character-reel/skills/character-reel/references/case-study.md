# Case study: "That's a wrap" (Social Champ, October 2026)

The example reel went through thirteen versions in five days. Each row is a change the owner's feedback forced.

| Version | What changed | Why |
|---|---|---|
| 1 to 3 | Golden-hour world, then a co-star; Kokoro voices | first format tests; "girl looks weird, mascot moves a lot, captions not breaking on pauses" |
| 4 | Desk world (giant phone on a night desk), a male co-star, script modelled on the reference's top reels | owner asked to match the format; reviewers flagged copying the reference's look, so the world is our own |
| 5 | One product idea instead of four | "too many features, the script gets lost" |
| 7 | Chatterbox voices | Kokoro "doesn't have expressions, the tone doesn't change" |
| 9 to 10 | Face-rim sliver fixed; soft brand sign and mug print | owner spotted background between face and fur; asked for subtle branding |
| 11 | Per-line pitch and tempo processing (rejected) | "voice is all robotic. Old voice was much better" |
| 12 | Per-emotion reference clips | still "something missing" in depth and emotion |
| bake-off | Chatterbox-Turbo with reaction and style tags, blind A/B | "the ones you did sound fake" |
| 13 | ElevenLabs v3 one-call dialogue; voices cast by audition | "Emotions are great"; one male voice rejected as robotic |
| 13 fixes | Re-anchored timing, tiled lines, sentence captions, end beat, time digits | "That's a wrap got ended abruptly", "subtitles slower to change", "show numbers when discussing time" |
| 13 final | Two-shot facing cheat | "on 0:12 they are not looking at each other" |

Approved: "Looks good now."

## What the version history teaches

- Owner feedback names a symptom; measure before changing anything. "Subtitles slower to change" turned out to be
  ElevenLabs' alignment drifting a second at one long sigh, found by comparing the raw take with Whisper per line.
- Model reviewers were most useful on code paths (lost audio between lines, non-atomic writes) and least reliable on
  audio claims they could not hear.
- Keep the approved version byte-identical while experimenting: every experiment ran under a new episode id.
