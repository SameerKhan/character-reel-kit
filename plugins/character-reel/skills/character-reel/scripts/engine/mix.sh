#!/bin/bash
# mix.sh <episode_dir> <silent.mp4> <out.mp4>
# voice + a soft generated bed, bed ducked under the voice, mastered to -14 LUFS in two passes, muxed onto the video.
# Ducking listens to DUCK_HP (default 180 Hz) to 4.5 kHz only; deep male voices pass DUCK_HP=90, so a voice's low end cannot pump the bed (tri-review 2026-10-14).
set -e
EP="$1"; VID="$2"; OUT="$3"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VID")
# lo-fi bed synthesised in code (voice/music.py): Fmaj7-Em7-Dm7-Cmaj7 at 84 BPM, no samples or licences
"${PYTHON:-python3}" "$(dirname "$0")/../voice/music.py" "$DUR" "$EP/pad.wav" > /dev/null
GRAPH="[0]aresample=48000,apad=whole_dur=$DUR,asplit=2[v][sc0];[sc0]highpass=f=${DUCK_HP:-180},lowpass=f=4500[sc];[1]aresample=48000,loudnorm=I=-28:TP=-6[p];[p][sc]sidechaincompress=threshold=0.025:ratio=4:attack=12:release=280[pd];[v][pd]amix=inputs=2:duration=first:normalize=0"
ffmpeg -loglevel error -y -i "$EP/voice.wav" -i "$EP/pad.wav" -filter_complex "$GRAPH[a]" -map "[a]" -ar 48000 "$EP/premaster.wav"
# loudness: apply gain, limit peaks at -2 dB (AAC adds ~0.7 dB of overs), re-measure, correct; repeat until within 0.3 LU of -14
# (loudnorm's linear mode silently falls short when voice peaks block the gain, and a limiter eats some of it)
lufs() { ffmpeg -hide_banner -i "$1" -af ebur128 -f null - 2>&1 | grep -E '^ +I:' | tail -1 | awk '{print $2}'; }
GAIN=$(awk -v i="$(lufs "$EP/premaster.wav")" 'BEGIN{printf "%.2f", -14 - i}')
for pass in 1 2 3; do
  ffmpeg -loglevel error -y -i "$EP/premaster.wav" -af "volume=${GAIN}dB,alimiter=limit=0.79:level=false:attack=3:release=60:asc=1" -ar 48000 "$EP/mix.wav"
  ERR=$(awk -v i="$(lufs "$EP/mix.wav")" 'BEGIN{printf "%.2f", -14 - i}')
  awk -v e="$ERR" 'BEGIN{exit !(e < 0.3 && e > -0.3)}' && break
  GAIN=$(awk -v g="$GAIN" -v e="$ERR" 'BEGIN{printf "%.2f", g + e}')
done
ffmpeg -loglevel error -y -i "$VID" -i "$EP/mix.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
echo "mixed -> $OUT ($(ffmpeg -hide_banner -i "$EP/mix.wav" -af ebur128 -f null - 2>&1 | grep -E '^ +I:' | tail -1 | xargs))"
