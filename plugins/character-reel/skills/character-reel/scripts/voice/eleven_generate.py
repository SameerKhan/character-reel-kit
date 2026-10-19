"""Voice a whole two-hander in one ElevenLabs v3 text-to-dialogue call, so the two voices react to each other.

usage: python eleven_generate.py <episode_dir>
Reads <episode_dir>/dialogue.json ([["leo", "[gasps] Hey..."], ["switch", "..."], ...], one entry per script line, in
order) and <episode_dir>/voices.json ({"leo": "<voice_id>", "switch": "<voice_id>"}). Writes dialogue.mp3 and
dialogue.timing.json (alignment + voice_segments) into the episode folder.

The API key is read from the ELEVENLABS_API_KEY environment variable and never printed or written anywhere.
Free plan limits (2026-10): 10,000 characters a month, no commercial licence, no Voice Library voices over the API.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps"


def main(ep: Path):
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY is not set")
    lines = json.loads((ep / "dialogue.json").read_text())
    voices = json.loads((ep / "voices.json").read_text())
    missing = sorted({who for who, _ in lines} - set(voices))
    if missing:
        sys.exit(f"voices.json has no voice for: {missing}")
    script = json.loads((ep / "script.json").read_text())
    if len(lines) != len(script["lines"]):
        sys.exit(f"dialogue.json has {len(lines)} lines but script.json has {len(script['lines'])}; they must match one to one")
    body = {"inputs": [{"text": t, "voice_id": voices[w]} for w, t in lines], "model_id": "eleven_v3"}
    print(f"voicing {len(lines)} lines, {sum(len(t) for _, t in lines)} characters", flush=True)
    req = urllib.request.Request(API, data=json.dumps(body).encode(), headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=600))
    except urllib.error.HTTPError as e:
        detail = e.read()[:400].decode(errors="replace")
        sys.exit(f"ElevenLabs HTTP {e.code}: {detail}")
    (ep / "dialogue.mp3").write_bytes(base64.b64decode(d["audio_base64"]))
    (ep / "dialogue.timing.json").write_text(json.dumps({k: v for k, v in d.items() if k != "audio_base64"}))
    print(f"wrote {ep / 'dialogue.mp3'} and its timing ({len(d.get('voice_segments', []))} segments)")


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve())
