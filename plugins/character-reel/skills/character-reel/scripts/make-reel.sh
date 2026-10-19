#!/bin/bash
# make-reel.sh <work_dir> <episode_id> [--voice] [--final NAME]
# One ElevenLabs two-hander -> timed voice -> three.js render in Chrome -> music mix -> gated MP4.
#   --voice      call ElevenLabs first (needs ELEVENLABS_API_KEY); without it, dialogue.mp3 + dialogue.timing.json
#                must already be in the episode folder
#   --final NAME copy a reel that passes every gate to <work_dir>/renders/final/NAME.mp4
# Layout: <work_dir>/episodes/<id>/{script.json,dialogue.json,voices.json}; the kit's engine is linked in as
# <work_dir>/engine. Gates: caption sync (every line within 0.25 s of what Whisper hears), -14 +-0.5 LUFS,
# true peak <= -1 dBTP, 20-62 s.
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
WORK="$(cd "$1" && pwd)"; EP="$2"; shift 2
VOICE=0; FINAL=""
while [ $# -gt 0 ]; do case "$1" in --voice) VOICE=1; shift;; --final) FINAL="$2"; shift 2;; *) echo "unknown option $1"; exit 1;; esac; done
for id in "$EP" ${FINAL:+"$FINAL"}; do [[ "$id" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]] || { echo "invalid id: $id"; exit 1; }; done
E="$WORK/episodes/$EP"; [ -f "$E/script.json" ] || { echo "no $E/script.json"; exit 1; }
PY="${PYTHON:-python3}"; export PYTHON="$PY"
[ -e "$WORK/engine" ] || ln -s "$KIT/engine" "$WORK/engine"
[ -d "$KIT/engine/node_modules/three" ] || { echo "run: (cd $KIT/engine && npm install)"; exit 1; }
field() { "$PY" -c "import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2], sys.argv[3]))" "$E/script.json" "$1" "$2"; }
PAGE="$(field page desk.html)"; DUCK_HP="$(field duck_hp 180)"
[[ "$PAGE" =~ ^[A-Za-z0-9_-]+\.html$ ]] || { echo "invalid page: $PAGE"; exit 1; }
[[ "$DUCK_HP" =~ ^[0-9]+$ ]] && [ "$DUCK_HP" -ge 20 ] && [ "$DUCK_HP" -le 400 ] || { echo "invalid duck_hp: $DUCK_HP"; exit 1; }
export DUCK_HP REEL_ROOT="$WORK"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

[ "$VOICE" = 1 ] && "$PY" "$KIT/voice/eleven_generate.py" "$E"
"$PY" "$KIT/voice/eleven_episode.py" "$E" "$E/dialogue.mp3" "$E/dialogue.timing.json" 0.2
"$PY" "$KIT/voice/check_sync.py" "$E" 0.25 || { echo "FAILED the caption sync gate"; exit 1; }
( cd "$KIT/engine" && node render.mjs "$PAGE?ep=$EP" "$TMP/silent.mp4" > "$TMP/render.log" 2>&1 ) || { grep -v "^frame " "$TMP/render.log"; exit 1; }
tail -1 "$TMP/render.log"
mkdir -p "$WORK/renders"; OUT="$WORK/renders/$EP.mp4"
"$KIT/engine/mix.sh" "$E" "$TMP/silent.mp4" "$OUT"
STATS=$(ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -E '^ +(I|Peak):' | tail -2 | awk '{print $2}' | tr '\n' ' ')
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"); read -r I TP <<< "$STATS"
echo "final: I=$I LUFS  TP=$TP dBTP  duration=${DUR}s"
awk -v i="$I" -v tp="$TP" -v d="$DUR" 'BEGIN{exit !(i >= -14.5 && i <= -13.5 && tp <= -1.0 && d >= 20 && d <= 62)}' \
  || { echo "FAILED the loudness/peak/duration gate: $OUT kept for inspection"; exit 1; }
if [ -n "$FINAL" ]; then mkdir -p "$WORK/renders/final"; cp "$OUT" "$WORK/renders/final/$FINAL.mp4.tmp" && mv "$WORK/renders/final/$FINAL.mp4.tmp" "$WORK/renders/final/$FINAL.mp4"; echo "promoted -> renders/final/$FINAL.mp4"; fi
