#!/usr/bin/env python3
"""Galatasaray taraftar korosu tezahurat MP3 dosyalarini (sesler/tezahurat_*.mp3) uretir.

Her hece grubu AhmetNeural + EmelNeural uzerinden esit tempo ama farkli perde (-26Hz..+20Hz)
ile sentezlenir, medyan sureye milimetrik kilitlenir ve 24 sesli temiz stadyum korosuna,
tribun davuluna, alkis darbelerine ve acik hava yanksina karistirilarak anlasilir ve gür
tezahuratlar uretilir.
"""

from __future__ import annotations

import argparse
import asyncio
import pathlib
import subprocess
import sys
import tempfile
from typing import Dict, List, Tuple

import edge_tts
import numpy as np

BASE_DIR = pathlib.Path(__file__).resolve().parent
SESLER_DIR = BASE_DIR / "sesler"
SR = 44100

# Ayni tempo (+6%), genis perde dagilimi (-26Hz..+20Hz): kalabalik erkek/kadin/cocuk korosu hece senkronuyla!
VOICES: List[Tuple[str, str, str]] = [
    ("tr-TR-AhmetNeural", "+6%", "-26Hz"),
    ("tr-TR-AhmetNeural", "+6%", "-16Hz"),
    ("tr-TR-AhmetNeural", "+6%", "-6Hz"),
    ("tr-TR-AhmetNeural", "+6%", "+4Hz"),
    ("tr-TR-AhmetNeural", "+6%", "+14Hz"),
    ("tr-TR-EmelNeural", "+6%", "-14Hz"),
    ("tr-TR-EmelNeural", "+6%", "+0Hz"),
    ("tr-TR-EmelNeural", "+6%", "+18Hz"),
]


async def synth_phrase_takes(text: str, out_dir: pathlib.Path, prefix: str) -> List[pathlib.Path]:
    """Render 8 varied Turkish TTS pitch takes concurrently for one short chant unit."""

    async def render_one(idx: int, voice: str, rate: str, pitch: str) -> pathlib.Path:
        mp3_path = out_dir / f"{prefix}_{idx}.mp3"
        comm = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
        await comm.save(str(mp3_path))
        return mp3_path

    return list(
        await asyncio.gather(*(render_one(i, v, r, p) for i, (v, r, p) in enumerate(VOICES)))
    )


def decode_mono_float(path: pathlib.Path) -> np.ndarray:
    """Decode audio to 44.1kHz mono float32, trimming leading/trailing silence."""
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(path),
        "-ac", "1", "-ar", str(SR),
        "-f", "f32le", "pipe:1",
    ]
    res = subprocess.run(cmd, capture_output=True, check=True)
    audio = np.frombuffer(res.stdout, dtype=np.float32).copy()
    if audio.size == 0:
        return np.zeros(int(0.2 * SR), dtype=np.float32)

    peak = float(np.max(np.abs(audio)))
    if peak < 1e-5:
        return audio

    thresh = peak * 0.025
    nz = np.where(np.abs(audio) > thresh)[0]
    if nz.size > 0:
        lo = max(0, int(nz[0]) - int(0.012 * SR))
        hi = min(audio.size, int(nz[-1]) + int(0.022 * SR))
        audio = audio[lo:hi]

    rms = float(np.sqrt(np.mean(audio ** 2))) + 1e-6
    audio = audio / rms * 0.18
    return audio.astype(np.float32)


def resample_to_len(x: np.ndarray, n_out: int) -> np.ndarray:
    """Linearly resample x to exact target length n_out."""
    if n_out <= 16 or x.size <= 16 or x.size == n_out:
        return x
    xp = np.arange(x.size, dtype=np.float64)
    x_new = np.linspace(0.0, x.size - 1, n_out, dtype=np.float64)
    return np.interp(x_new, xp, x).astype(np.float32)


def make_pink_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    """Smooth stadium crowd background murmur noise."""
    white = rng.standard_normal(n).astype(np.float64)
    spec = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n, d=1.0 / SR)
    freqs[0] = 1.0
    shape = np.sqrt(180.0 / np.maximum(freqs, 40.0))
    shape *= np.where(freqs < 100.0, (freqs / 100.0) ** 1.6, 1.0)
    shape *= 1.0 / (1.0 + (freqs / 2100.0) ** 2.2)
    shaped = np.fft.irfft(spec * shape, n=n)
    shaped /= (np.std(shaped) + 1e-8)
    return shaped.astype(np.float32)


def build_crowd_layer(takes: List[np.ndarray], pan_bias: float, rng: np.random.Generator) -> np.ndarray:
    """Time-lock all takes to the median phrase length and build a clear 24-voice crowd block."""
    lengths = [t.size for t in takes if t.size > 100]
    target_len = int(np.median(lengths)) if lengths else int(0.8 * SR)

    variants: List[Tuple[np.ndarray, float, int]] = []
    # Core takes (tight pitch +/-3%) stay crisp up front; flank takes add stadium width
    deltas = (1.00, 0.965, 1.035)
    for i, raw in enumerate(takes):
        # Time-align each TTS take cleanly onto the exact same rhythm length
        locked = resample_to_len(raw, target_len)
        for j, d in enumerate(deltas):
            # Vary length subtly +/-2.5% so chorusing feels human without syllable drift
            v_len = max(64, int(round(target_len * (1.0 + (d - 1.0) * 0.7))))
            v = resample_to_len(locked, v_len)
            gain = (1.15 if j == 0 else 0.72) * float(rng.uniform(0.82, 1.08))
            pan = float(np.clip(pan_bias + (0.0 if j == 0 and abs(pan_bias) > 0.3 else rng.uniform(-0.82, 0.82)), -0.95, 0.95))
            # Core group starts within 0..14ms; outer stands within 12..34ms
            delay_ms = rng.uniform(0.0, 14.0) if j == 0 else rng.uniform(10.0, 34.0)
            delay = int(delay_ms / 1000.0 * SR)
            variants.append((v * gain, pan, delay))

    max_len = max(delay + v.size for v, _, delay in variants) + int(0.06 * SR)
    out = np.zeros((max_len, 2), dtype=np.float32)
    for v, pan, delay in variants:
        angle = (pan + 1.0) * 0.25 * np.pi
        l_g = float(np.cos(angle))
        r_g = float(np.sin(angle))
        fade = min(int(0.006 * SR), v.size // 4)
        if fade > 1:
            v[:fade] *= np.linspace(0.0, 1.0, fade, dtype=np.float32)
            v[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        out[delay:delay + v.size, 0] += v * l_g
        out[delay:delay + v.size, 1] += v * r_g

    out *= 0.28
    return out


def make_davul_hit(power: float = 1.0) -> np.ndarray:
    """Warm, punchy stadium bass drum (tribun davulu)."""
    dur = int(0.36 * SR)
    t = np.arange(dur, dtype=np.float64) / SR
    freq = 46.0 + 44.0 * np.exp(-t * 25.0)
    phase = 2.0 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-t * 8.2)
    over = 0.25 * np.sin(2.0 * phase) * np.exp(-t * 18.0)
    click = 0.22 * np.exp(-t * 68.0) * np.sin(2.0 * np.pi * 165.0 * t)
    mono = ((body + over + click) * np.minimum(1.0, t / 0.004) * 0.44 * power).astype(np.float32)
    return np.stack([mono, mono], axis=1)


def make_crowd_clap(rng: np.random.Generator, spread_ms: float = 42.0, power: float = 1.0) -> np.ndarray:
    """Synchronized tribune hand claps."""
    dur = int((0.16 + spread_ms / 1000.0) * SR)
    out = np.zeros((dur, 2), dtype=np.float32)
    for _ in range(18):
        delay = int(rng.uniform(0.0, spread_ms / 1000.0) * SR)
        clen = int(0.08 * SR)
        t = np.arange(clen, dtype=np.float64) / SR
        n = rng.standard_normal(clen)
        spec = np.fft.rfft(n)
        freqs = np.fft.rfftfreq(clen, d=1.0 / SR)
        bp = np.where((freqs >= 750.0) & (freqs <= 4200.0), 1.0, 0.1)
        clap = np.fft.irfft(spec * bp, n=clen)
        env = np.minimum(1.0, t / 0.002) * np.exp(-t * rng.uniform(34.0, 50.0))
        sig = (clap / (np.std(clap) + 1e-6)) * env * 0.048 * power
        pan = float(rng.uniform(-0.9, 0.9))
        a = (pan + 1.0) * 0.25 * np.pi
        end = min(dur, delay + clen)
        sl = end - delay
        out[delay:end, 0] += (sig[:sl] * np.cos(a)).astype(np.float32)
        out[delay:end, 1] += (sig[:sl] * np.sin(a)).astype(np.float32)
    return out


def apply_stadium_reverb(stereo: np.ndarray, rng: np.random.Generator, wet: float = 0.20) -> np.ndarray:
    """Clean open-air stadium impulse response (tight early tribune slaps + gentle air tail)."""
    ir_len = int(1.05 * SR)
    t = np.arange(ir_len, dtype=np.float64) / SR
    out = np.zeros((stereo.shape[0] + ir_len // 3, 2), dtype=np.float32)

    for ch in range(2):
        ir = rng.standard_normal(ir_len) * np.exp(-t * 3.8)
        spec_ir = np.fft.rfft(ir)
        freqs = np.fft.rfftfreq(ir_len, d=1.0 / SR)
        lp = 1.0 / (1.0 + (freqs / 2400.0) ** 1.5)
        lp *= np.where(freqs < 110.0, freqs / 110.0, 1.0)
        ir = np.fft.irfft(spec_ir * lp, n=ir_len)
        ir /= (np.sqrt(np.sum(ir ** 2)) + 1e-8)

        for ms, amp in [(22, 0.28), (48, 0.20), (82, 0.14), (125, 0.09)]:
            idx = int(ms / 1000.0 * SR) + int(rng.integers(-40, 40))
            if 0 < idx < ir_len:
                ir[idx] += amp * (-1 if (ch == 1 and ms == 48) else 1)

        n_fft = 1 << int(np.ceil(np.log2(stereo.shape[0] + ir_len)))
        dry = stereo[:, ch].astype(np.float64)
        conv = np.fft.irfft(np.fft.rfft(dry, n=n_fft) * np.fft.rfft(ir, n=n_fft), n=n_fft)
        mixed = np.zeros(out.shape[0], dtype=np.float64)
        mixed[:stereo.shape[0]] += dry
        mixed += conv[:out.shape[0]] * wet
        out[:, ch] = mixed.astype(np.float32)

    return out


def mix_at(canvas: np.ndarray, clip: np.ndarray, sec: float, gain: float = 1.0) -> None:
    start = max(0, int(round(sec * SR)))
    if start >= canvas.shape[0]:
        return
    end = min(canvas.shape[0], start + clip.shape[0])
    sl = end - start
    canvas[start:end] += clip[:sl] * gain


def encode_mp3(stereo: np.ndarray, dest: pathlib.Path, tmp_dir: pathlib.Path) -> None:
    """Broadcast clarity EQ + crowd glue compression + loudnorm -13.5 LUFS."""
    peak = float(np.max(np.abs(stereo))) + 1e-6
    if peak > 0.90:
        stereo = stereo * (0.90 / peak)

    raw_pcm = tmp_dir / f"{dest.stem}.f32"
    stereo.astype(np.float32).tofile(raw_pcm)

    af = (
        "highpass=f=70,lowpass=f=5600,"
        "equalizer=f=300:width_type=o:width=1.4:g=1.5,"
        "equalizer=f=2100:width_type=o:width=1.3:g=3.4,"
        "acompressor=threshold=-17dB:ratio=2.8:attack=14:release=140,"
        "loudnorm=I=-13.5:TP=-1.5:LRA=8"
    )
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", str(raw_pcm),
        "-af", af,
        "-codec:a", "libmp3lame", "-b:a", "112k",
        str(dest),
    ]
    subprocess.run(cmd, check=True)


async def build_all_chants(force: bool) -> None:
    rng = np.random.default_rng(190561)
    SESLER_DIR.mkdir(parents=True, exist_ok=True)

    # Kisa, ritmik ve anlasilir stadyum cumlecikleri
    phrases: Dict[str, Tuple[str, float]] = {
        "rere": ("Re, re, re!", 0.0),
        "rara": ("Ra, ra, ra!", 0.0),
        "gs": ("Galatasaray!", 0.0),
        "cimbom": ("Cim Bom Bom!", 0.0),
        "enbuyuk": ("En büyük Cimbom!", 0.0),
        "sampiyon": ("Şampiyon!", 0.0),
        "sari": ("Sarı!", -0.55),
        "kirmizi": ("Kırmızı!", 0.55),
        "haydi": ("Haydi Aslanlar!", -0.12),
        "saldir": ("Saldır Galatasaray!", 0.12),
        "oley": ("Oley, oley, oley!", 0.0),
        "gool": ("Gooool!", 0.0),
    }

    with tempfile.TemporaryDirectory(prefix="gs_tezahurat_v2_") as tmp_str:
        tmp_dir = pathlib.Path(tmp_str)

        async def prep_phrase(key: str, text: str, pan_bias: float) -> Tuple[str, np.ndarray]:
            take_paths = await synth_phrase_takes(text, tmp_dir, key)
            decoded = [decode_mono_float(p) for p in take_paths]
            chorus = build_crowd_layer(decoded, pan_bias=pan_bias, rng=rng)
            return key, chorus

        crowds: Dict[str, np.ndarray] = {}
        keys = list(phrases.keys())
        for idx in range(0, len(keys), 3):
            batch = keys[idx:idx + 3]
            results = await asyncio.gather(*(prep_phrase(k, phrases[k][0], phrases[k][1]) for k in batch))
            for k, c in results:
                crowds[k] = c

        specs = [
            (
                "tezahurat_cimbombom.mp3",
                6.4,
                [("rere", 0.18, 1.24), ("rara", 1.35, 1.24), ("gs", 2.58, 1.32), ("cimbom", 3.76, 1.38), ("oley", 4.90, 1.18)],
                [0.10, 0.72, 1.30, 2.48, 3.64, 4.78, 5.45],
                [1.95, 3.25, 4.45, 5.55],
                0.15,
            ),
            (
                "tezahurat_cimbom_alkis.mp3",
                6.0,
                [("cimbom", 0.88, 1.32), ("cimbom", 2.55, 1.34), ("enbuyuk", 4.18, 1.34)],
                [0.12, 0.42, 1.78, 2.08, 3.45, 3.75, 4.95, 5.35],
                [0.56, 0.69, 0.82, 2.22, 2.35, 2.48, 3.90, 5.55],
                0.15,
            ),
            (
                "tezahurat_sampiyon.mp3",
                5.6,
                [("sampiyon", 0.25, 1.28), ("gs", 1.22, 1.28), ("sampiyon", 2.55, 1.32), ("gs", 3.55, 1.32), ("oley", 4.60, 1.15)],
                [0.12, 0.72, 1.20, 2.45, 3.45, 4.50, 5.10],
                [2.10, 4.25, 5.20],
                0.16,
            ),
            (
                "tezahurat_sari_kirmizi.mp3",
                6.0,
                [
                    ("sari", 0.22, 1.35),
                    ("kirmizi", 1.05, 1.35),
                    ("sari", 2.05, 1.35),
                    ("kirmizi", 2.88, 1.35),
                    ("enbuyuk", 3.95, 1.38),
                    ("gs", 5.10, 1.25),
                ],
                [0.10, 0.92, 1.92, 2.75, 3.82, 4.60, 5.15],
                [0.68, 1.60, 2.50, 3.52, 4.82],
                0.15,
            ),
            (
                "tezahurat_haydi_aslanlar.mp3",
                5.6,
                [("haydi", 0.28, 1.30), ("saldir", 1.85, 1.32), ("oley", 3.65, 1.24)],
                [0.12, 0.68, 1.25, 1.75, 2.40, 3.15, 3.60, 4.55],
                [1.45, 3.35, 4.85],
                0.16,
            ),
            (
                "tezahurat_gol_cosku.mp3",
                5.2,
                [("gool", 0.20, 1.38), ("gs", 1.35, 1.32), ("cimbom", 2.48, 1.35), ("oley", 3.68, 1.24)],
                [0.10, 0.50, 0.92, 1.30, 1.88, 2.40, 3.10, 3.62, 4.35],
                [0.72, 1.15, 2.15, 3.30, 4.55],
                0.22,
            ),
        ]

        for filename, dur_sec, cue_list, drum_times, clap_times, bed_amp in specs:
            dest = SESLER_DIR / filename
            if not force and dest.exists() and dest.stat().st_size > 15000:
                print(f"{filename} (atlandi - hazir {dest.stat().st_size} bayt)")
                continue

            total_n = int(dur_sec * SR)
            canvas = np.zeros((total_n, 2), dtype=np.float32)

            bed_l = make_pink_noise(total_n, rng)
            bed_r = make_pink_noise(total_n, rng)
            t_arr = np.arange(total_n, dtype=np.float32) / SR
            env = (
                np.minimum(1.0, t_arr / 0.35)
                * np.minimum(1.0, np.maximum(0.0, (dur_sec - t_arr) / 0.55))
                * (0.80 + 0.20 * np.sin(2.0 * np.pi * t_arr / 2.2))
            )
            canvas[:, 0] += bed_l * env * bed_amp * 0.45
            canvas[:, 1] += bed_r * env * bed_amp * 0.45

            for key, onset, gain in cue_list:
                mix_at(canvas, crowds[key], onset, gain=gain)

            for dt in drum_times:
                mix_at(canvas, make_davul_hit(power=0.82), dt, gain=0.85)

            for ct in clap_times:
                mix_at(canvas, make_crowd_clap(rng, spread_ms=42.0, power=0.90), ct, gain=0.95)

            stadium = apply_stadium_reverb(canvas, rng, wet=0.20)
            tail_n = min(stadium.shape[0], int((dur_sec + 0.25) * SR))
            stadium = stadium[:tail_n]
            fade_in = min(int(0.06 * SR), stadium.shape[0] // 8)
            fade_out = min(int(0.35 * SR), stadium.shape[0] // 4)
            stadium[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)[:, None]
            stadium[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)[:, None]

            encode_mp3(stadium, dest, tmp_dir)
            print(f"Uretildi: {filename} ({dest.stat().st_size} bayt)")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Galatasaray taraftar tezahuratlarini uretir.")
    parser.add_argument("--force", action="store_true", help="Mevcut tezahurat dosyalarini yeniden uret")
    args = parser.parse_args()
    asyncio.run(build_all_chants(args.force))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
