"""A warm lo-fi bed, synthesised in code (no samples, no licences).

usage: .venv/bin/python music.py <seconds> <out.wav>
84 BPM, Fmaj7 - Em7 - Dm7 - Cmaj7, soft electric-piano chords, round bass,
brushed kick/snare/hat, a little tape warble and vinyl hiss. 48 kHz stereo.
"""
import sys

import numpy as np
import soundfile as sf

SR = 48000
BPM = 84
BEAT = 60 / BPM
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def ep_note(freq, dur, vel=0.5):
    """Electric-piano-ish tone: FM bell attack fading into a soft sine body."""
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-t * 2.2) * (1 - np.exp(-t * 200))
    mod = np.sin(2 * np.pi * freq * 2 * t) * 1.4 * np.exp(-t * 6)
    tone = np.sin(2 * np.pi * freq * t + mod) * 0.7 + np.sin(2 * np.pi * freq * 0.5 * t) * 0.12
    return tone * env * vel


def bass_note(freq, dur, vel=0.5):
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-t * 1.5) * (1 - np.exp(-t * 80))
    return (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)) * env * vel


def kick(vel=0.8):
    t = np.arange(int(0.35 * SR)) / SR
    f = 110 * np.exp(-t * 18) + 42
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * vel


def noise_hit(dur, decay, hp, vel):
    n = rng.standard_normal(int(dur * SR))
    n = n - np.convolve(n, np.ones(hp) / hp, mode="same")  # crude high-pass
    t = np.arange(len(n)) / SR
    return n * np.exp(-t * decay) * vel


def place(track, sig, at):
    i = int(at * SR)
    j = min(len(track), i + len(sig))
    if i < len(track):
        track[i:j] += sig[: j - i]


def main(seconds, out):
    n = int(seconds * SR)
    keys, bass, drums = np.zeros(n), np.zeros(n), np.zeros(n)
    chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]  # Fmaj7 Em7 Dm7 Cmaj7
    roots = [41, 40, 38, 36]
    bar = 4 * BEAT
    b = 0
    while b * bar < seconds:
        c = chords[b % 4]
        t0 = b * bar
        for k, note in enumerate(c):  # lazily rolled chord, then a softer re-hit on beat 3 and-of
            place(keys, ep_note(midi(note), bar * 0.9, 0.16), t0 + k * 0.025)
            place(keys, ep_note(midi(note + 12), BEAT * 1.2, 0.05), t0 + 2.5 * BEAT + k * 0.02)
        place(bass, bass_note(midi(roots[b % 4]), BEAT * 1.6, 0.35), t0)
        place(bass, bass_note(midi(roots[b % 4] + 7), BEAT * 0.8, 0.22), t0 + 2.5 * BEAT)
        for beat in range(4):  # lazy swung groove
            tb = t0 + beat * BEAT
            if beat in (0, 2):
                place(drums, kick(0.55), tb)
            if beat in (1, 3):
                place(drums, noise_hit(0.25, 22, 6, 0.18), tb)
            for eighth in (0, 1):
                place(drums, noise_hit(0.05, 90, 3, 0.05 if eighth else 0.07), tb + eighth * BEAT * 0.58)
        b += 1
    mix = keys * 1.0 + bass * 0.9 + drums * 0.8
    # tape warble: tiny slow pitch wobble via variable delay
    t = np.arange(n) / SR
    d = (0.0018 * (1 + np.sin(2 * np.pi * 0.6 * t))) * SR
    idx = np.clip(np.arange(n) - d, 0, n - 1)
    mix = np.interp(idx, np.arange(n), mix)
    mix += rng.standard_normal(n) * 0.004  # vinyl hiss
    # gentle low-pass for warmth
    k = 9
    mix = np.convolve(mix, np.ones(k) / k, mode="same")
    fade = int(1.2 * SR)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-fade:] *= np.linspace(1, 0, fade)
    mix /= np.max(np.abs(mix)) + 1e-9
    stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1) * 0.8
    sf.write(out, stereo.astype(np.float32), SR)
    print(f"{seconds:.1f}s -> {out}")


if __name__ == "__main__":
    main(float(sys.argv[1]), sys.argv[2])
