# Walkthrough: render the example, then make your own

## 1. Install (once)

```bash
# Node 20+, ffmpeg, Python 3.11+, Google Chrome (recommended: the fur shaders render on the GPU)
cd plugins/character-reel/skills/character-reel/scripts/engine && npm install && npx playwright install chromium
python3 -m venv ~/.venvs/reel && ~/.venvs/reel/bin/pip install -r ../voice/requirements.txt
```

`faster-whisper` downloads its `small.en` model (about 500 MB) the first time `check_sync.py` or
`eleven_episode.py` runs.

## 2. Render the example without an API key

The example folder already holds the ElevenLabs output (`dialogue.mp3`, `dialogue.timing.json`), so nothing is
voiced and no key is needed.

```bash
mkdir -p ~/reels/episodes && cp -R ../../examples/ep01-wrap ~/reels/episodes/
export PYTHON=~/.venvs/reel/bin/python
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"   # macOS; omit to use Chromium
../make-reel.sh ~/reels ep01-wrap --final 01-wrap
```

Expect about three minutes on an Apple M-series laptop and this output:

```
re-anchored lines (line, seconds): [(6, -0.16), (10, -0.23), (19, 0.97), (20, 0.96), (21, 0.97), (22, 0.88), (23, 0.96), (24, 1.01)]
24 lines, 57.2s -> .../episodes/ep01-wrap/voice.wav
lines off by more than 0.25 s: none | overlaps 0 | zero-length 0 | lines with no heard match none
final: I=-14.4 LUFS  TP=-1.0 dBTP  duration=59.57s
promoted -> renders/final/01-wrap.mp4
```

The re-anchor line is the timing-drift fix at work: ElevenLabs' alignment for lines 19 to 24 of this take is about
one second early (see [timing.md](timing.md)).

## 3. Make your own episode

1. `episodes/<id>/script.json`: copy the example and rewrite `lines`. Keep `who` as `human` or `switch` (the two
   characters the desk page knows), `face` for the human (`neutral`, `worried`, `deadpan`, `surprised`, `smile`,
   `glare`), `pose` (`rest`, `phone`, `facepalm`, `point`, `shrug`, `arms`, `slump`), Switch's `eyes` (`happy`,
   `wink`, `angry`, `o`, `flat`, `heart`, `star`, `dots`, `sad`, `sleepy`, `moon`), `punch: true` on a punchline
   (the camera cuts to the listener), and `pause` (seconds of silence after the line; comic holds 1.5 to 2.3 s).
2. `episodes/<id>/dialogue.json`: the same lines, one entry each, in the same order, with v3 tags.
3. `episodes/<id>/voices.json`: two ElevenLabs voice ids.
4. `export ELEVENLABS_API_KEY=...` (never paste it into a chat or a file in the repo), then
   `make-reel.sh ~/reels <id> --voice`.
5. Re-render after any script, camera or caption change without `--voice`; re-voice only when words or tags change.

## 4. Re-voicing a single line

ElevenLabs dialogue is generated as one take, so the simplest fix for one bad line is to change its tag or wording
in `dialogue.json` and re-voice the scene (about 900 characters for a 24-line reel). Keep the previous
`dialogue.mp3` until the new take is approved.
