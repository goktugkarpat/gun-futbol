#!/usr/bin/env python3
"""GÜN FUTBOL – tribün sesleri (sesler/tribun_*.mp3 ve sesler/tezahurat_*.mp3).

Gerçek kayıt yok; her şey burada üretilir:
  * kalabalık "insan sesi": yüzlerce ayrı gırtlak (perde + ünlü biçimlendiricileri, her biri kendi zamanlamasıyla)
  * alkış: binlerce tek tek el çırpması (her kişinin kendi hızı ve tınısı)
  * tezahürat: Türkçe TTS okumaları → 100+ kişilik, hafif dağınık, bağıran koro + davul + ritmik alkış
  * stadyum: uzak tribün gecikmeleri + açık hava yankısı

Kullanım:
    python gen_taraftar.py                 # hepsini üret
    python gen_taraftar.py --yalniz gol,alkis --cikti <klasör>
    python gen_taraftar.py --tts-yok       # tezahüratları atla (internet yoksa)
"""
from __future__ import annotations

import argparse
import asyncio
import pathlib
import subprocess
import sys
import tempfile

import numpy as np

BASE = pathlib.Path(__file__).resolve().parent
SESLER = BASE / "sesler"
SR = 44100
SRV = 22050  # insan sesi katmanı bu hızda üretilir (4 kHz üstü gerekmez), sonra 2 katına çıkarılır

UNLU = {  # biçimlendirici frekansları (F1, F2, F3) – bağıran ses
    "a": (800, 1250, 2700), "o": (520, 920, 2600), "e": (560, 1850, 2650),
    "u": (380, 850, 2500), "i": (340, 2150, 2950), "ö": (480, 1500, 2500),
}


# ------------------------------------------------------------------ temel araçlar
def bant(x: np.ndarray, f1: float, f2: float, sr: int = SR, egim: float = 0.25) -> np.ndarray:
    """Yumuşak kenarlı bant geçiren süzgeç (FFT)."""
    n = x.shape[0]
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(n, 1.0 / sr)
    lo = 1.0 / (1.0 + (np.maximum(f1, 1.0) / np.maximum(f, 1e-3)) ** (2.0 / egim * 0.5))
    hi = 1.0 / (1.0 + (f / max(f2, 1.0)) ** (2.0 / egim * 0.5))
    g = lo * hi
    if X.ndim == 2:
        g = g[:, None]
    return np.fft.irfft(X * g, n=n, axis=0)


def pembe(n: int, rng, sr: int = SR) -> np.ndarray:
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1.0 / sr)
    f[0] = 1.0
    y = np.fft.irfft(X / np.sqrt(np.maximum(f, 20.0)), n=n)
    return y / (np.std(y) + 1e-9)


def yukselt2(x: np.ndarray) -> np.ndarray:
    """22.05 kHz → 44.1 kHz (FFT ile, temiz)."""
    n = x.shape[0]
    X = np.fft.rfft(x)
    Y = np.zeros(n + 1, dtype=complex)
    Y[: X.shape[0]] = X
    return np.fft.irfft(Y, n=2 * n) * 2.0


def pan2(mono: np.ndarray, pan: float) -> np.ndarray:
    a = (np.clip(pan, -1, 1) + 1.0) * 0.25 * np.pi
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


def yumusak(n: int, yuksel: float, in_: float, sr: int = SR) -> np.ndarray:
    """0→1 yükselip sonda 1→0 inen zarf (sn)."""
    e = np.ones(n)
    a = min(n, int(yuksel * sr))
    b = min(n, int(in_ * sr))
    if a > 1:
        e[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if b > 1:
        e[-b:] *= np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    return e


def sinirla(st: np.ndarray, tepe: float = 0.92) -> np.ndarray:
    """Yumuşak doyma + tepe sınırı."""
    st = np.tanh(st * 1.15) / np.tanh(1.15)
    p = float(np.max(np.abs(st))) + 1e-9
    return st * (tepe / p)


# ------------------------------------------------------------------ insan sesi: yüzlerce gırtlak
def girtlak_korosu(sure: float, kisi: int, rng, *, unluler, perde=(150, 420), yogunluk=None,
                   hece=None, perde_egim=0.0, nefes=0.35, dagilim=0.35, uzak=0.5) -> np.ndarray:
    """`kisi` ayrı insanın bağırışını üretir (stereo, SR).

    unluler: [(t0..1, 'a'), ...] zaman içinde ünlü geçişi (ör. o→a: "ooo…aaa")
    yogunluk: fn(t sn) → 0..1 kalabalığın o anki coşkusu (kişi başına başlama/bitme buna göre seçilir)
    hece: (enaz, ençok) sn verilirse herkes heceler halinde konuşur (uğultu/mırıltı); yoksa uzun bağırış
    perde_egim: yarım ton/sn (negatif = düşen "ooo…f")
    """
    n = int(sure * SRV)
    t = np.arange(n) / SRV
    L = np.zeros(n)
    R = np.zeros(n)
    fz = np.array([u for _, u in unluler])
    tz = np.array([p for p, _ in unluler], dtype=float)
    harm = np.arange(1, 17)[:, None]
    for _ in range(kisi):
        kadin_cocuk = rng.random() < 0.38
        f0b = rng.uniform(perde[0], perde[1] * 0.62) if not kadin_cocuk else rng.uniform(perde[1] * 0.6, perde[1])
        # kişinin sesi ne zaman var?
        if hece is None:
            # uzun bağırış: kalabalığın yoğunluğuna göre bir başlangıç ve süre
            for _dene in range(12):
                bas = rng.uniform(-0.3, sure * 0.85)
                if yogunluk is None or rng.random() < yogunluk(max(0.0, bas)) + 0.04:
                    break
            uz = rng.uniform(0.7, 2.6)
            zarf = np.zeros(n)
            i0 = max(0, int(bas * SRV))
            i1 = min(n, int((bas + uz) * SRV))
            if i1 - i0 < 400:
                continue
            m = i1 - i0
            z = np.ones(m)
            a = int(min(m * 0.3, rng.uniform(0.03, 0.14) * SRV))
            b = int(min(m * 0.6, rng.uniform(0.25, 0.9) * SRV))
            z[:a] = np.linspace(0, 1, a) ** 0.7
            z[-b:] = np.linspace(1, 0, b) ** 1.6
            zarf[i0:i1] = z
        else:
            # heceler: rastgele uzunlukta ses + aralar (mırıltı / konuşma)
            zarf = np.zeros(n)
            p = rng.uniform(-0.5, 0.2)
            while p < sure:
                hs = rng.uniform(hece[0], hece[1])
                i0 = max(0, int(p * SRV))
                i1 = min(n, int((p + hs) * SRV))
                if i1 - i0 > 60:
                    m = i1 - i0
                    yg = 1.0 if yogunluk is None else yogunluk(p)
                    if rng.random() < 0.35 + 0.65 * yg:
                        zarf[i0:i1] = np.hanning(m) ** 0.6 * rng.uniform(0.4, 1.0)
                p += hs * rng.uniform(1.05, 1.6) + (rng.uniform(0.3, 1.6) if rng.random() < 0.12 else 0.0)
        if not zarf.any():
            continue
        # perde: yavaş salınım + titreme + genel eğim; bağırış başında hafif yükseliş
        kay = np.cumsum(rng.standard_normal(n)) / SRV
        kay = kay - np.linspace(kay[0], kay[-1], n)
        st = (perde_egim * t * rng.uniform(0.6, 1.3) + 1.6 * kay * rng.uniform(0.5, 1.5)
              + rng.uniform(0.15, 0.5) * np.sin(2 * np.pi * rng.uniform(4.5, 6.5) * t + rng.uniform(0, 6.28)))
        f0 = f0b * 2.0 ** (st / 12.0)
        faz = 2 * np.pi * np.cumsum(f0) / SRV
        # ünlü: kişiye göre biraz kaymış biçimlendiriciler, zamanla geçiş
        boy = rng.uniform(0.9, 1.16) * (1.12 if kadin_cocuk else 1.0)
        kayma = rng.uniform(-0.08, 0.08)
        tn = np.clip(t / sure + kayma, 0, 1)
        F = np.zeros((3, n))
        for k in range(3):
            nokta = np.array([UNLU[u][k] for u in fz], dtype=float) * boy
            F[k] = np.interp(tn, tz, nokta)
        # harmonik toplamı (kaynak-süzgeç): her harmoniğin gücü biçimlendirici eğrisinden
        ses = np.zeros(n)
        adim = 256  # biçimlendirici zarfını seyrek hesapla
        idx = np.arange(0, n, adim)
        hf = harm * f0[idx][None, :]                                # (16, m)
        g = np.zeros_like(hf)
        for k, (bw, guc) in enumerate(((110, 1.0), (140, 0.7), (190, 0.4))):
            g += guc / (1.0 + ((hf - F[k][idx][None, :]) / bw) ** 2)
        g *= 1.0 / harm ** 0.55                                     # bağıran ses: az eğimli kaynak
        g[hf > SRV * 0.46] = 0.0
        for h in range(16):
            gh = np.interp(np.arange(n), idx, g[h])
            ses += gh * np.sin((h + 1) * faz + rng.uniform(0, 6.28))
        # nefes/hırıltı: biçimlendirici bölgelerinde gürültü
        if nefes > 0:
            gur = rng.standard_normal(n)
            gur = bant(gur, float(np.mean(F[0])) * 0.8, float(np.mean(F[1])) * 1.5, SRV, egim=0.6)
            ses += nefes * gur / (np.std(gur) + 1e-9) * 0.6
        ses *= zarf * rng.uniform(0.5, 1.0)
        p_ = rng.uniform(-1, 1) * dagilim * 2.2
        a = (np.clip(p_, -1, 1) + 1) * 0.25 * np.pi
        # uzak tribün: gecikme + sönük
        if rng.random() < uzak:
            gec = int(rng.uniform(0.03, 0.22) * SRV)
            ses = np.concatenate([np.zeros(gec), ses[:-gec]]) * rng.uniform(0.35, 0.7)
        L += ses * np.cos(a)
        R += ses * np.sin(a)
    st = np.stack([yukselt2(L), yukselt2(R)], axis=1)
    st = np.concatenate([st, np.zeros((16, 2))])            # yuvarlama farkı: çağıran [:n] ile keser
    return st / (np.std(st) + 1e-9)


# ------------------------------------------------------------------ alkış: tek tek eller
def alkis(sure: float, kisi: int, rng, yogunluk=None, ritim=None) -> np.ndarray:
    """`kisi` kişinin el çırpması. yogunluk(t)→0..1; ritim=(vuruş_sn, ilk_sn, dağılım_sn) verilirse tempo tutulur."""
    n = int(sure * SR)
    out = np.zeros((n + 4000, 2))
    # el tınıları: avuç boşluğuna göre farklı tınlayan kısa patlamalar
    ornek = []
    for _ in range(60):
        m = int(rng.uniform(0.012, 0.028) * SR)
        g = rng.standard_normal(m)
        f1 = rng.uniform(900, 1700)
        f2 = rng.uniform(2200, 3400)
        X = np.fft.rfft(g)
        f = np.fft.rfftfreq(m, 1.0 / SR)
        sek = (1.0 / (1 + ((f - f1) / 420) ** 2) + 0.6 / (1 + ((f - f2) / 700) ** 2) + 0.08) * (f > 350)
        g = np.fft.irfft(X * sek, n=m)
        tt = np.arange(m) / SR
        g *= np.exp(-tt * rng.uniform(150, 330)) * np.minimum(1, tt / 0.0006)
        ornek.append(g / (np.max(np.abs(g)) + 1e-9))
    for _ in range(kisi):
        hiz = rng.uniform(3.2, 5.6)            # el çırpma/sn
        o1 = ornek[rng.integers(len(ornek))]
        o2 = ornek[rng.integers(len(ornek))]
        guc = rng.uniform(0.25, 1.0) ** 1.5
        pan = rng.uniform(-1, 1)
        a = (pan + 1) * 0.25 * np.pi
        uz = rng.random() < 0.45
        gec = rng.uniform(0.02, 0.2) if uz else 0.0
        if uz:
            guc *= rng.uniform(0.3, 0.6)
        if ritim is None:
            p = rng.uniform(0, 1.0 / hiz) + rng.uniform(0, 0.6)
            bit = sure * rng.uniform(0.7, 1.0)
            while p < bit:
                yg = 1.0 if yogunluk is None else yogunluk(p)
                if rng.random() < yg:
                    i = int((p + gec) * SR)
                    o = o1 if rng.random() < 0.7 else o2
                    s = o * guc * rng.uniform(0.7, 1.1)
                    out[i:i + s.size, 0] += s * np.cos(a)
                    out[i:i + s.size, 1] += s * np.sin(a)
                p += (1.0 / hiz) * rng.uniform(0.9, 1.12)
        else:
            vur, ilk, dag = ritim
            p = ilk
            while p < sure - 0.1:
                if rng.random() < (0.85 if yogunluk is None else yogunluk(p)):
                    i = int((p + gec + rng.normal(0, dag)) * SR)
                    if 0 <= i < n:
                        s = o1 * guc * rng.uniform(0.8, 1.1)
                        out[i:i + s.size, 0] += s * np.cos(a)
                        out[i:i + s.size, 1] += s * np.sin(a)
                p += vur
    out = out[:n]
    return out / (np.std(out) + 1e-9)


# ------------------------------------------------------------------ ıslık, davul
def islik(sure: float, adet: int, rng, yogunluk=None) -> np.ndarray:
    n = int(sure * SR)
    out = np.zeros((n, 2))
    for _ in range(adet):
        for _d in range(10):
            bas = rng.uniform(0, sure * 0.9)
            if yogunluk is None or rng.random() < yogunluk(bas):
                break
        uz = rng.uniform(0.25, 0.9)
        m = min(n - int(bas * SR), int(uz * SR))
        if m < 2000:
            continue
        tt = np.arange(m) / SR
        f = rng.uniform(1900, 3100) * (1 + rng.uniform(-0.12, 0.2) * tt / uz) * (1 + 0.012 * np.sin(2 * np.pi * rng.uniform(5, 9) * tt))
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * yumusak(m, 0.04, 0.15) * rng.uniform(0.3, 1.0)
        s += 0.15 * rng.standard_normal(m) * yumusak(m, 0.04, 0.15)
        s = bant(s, 1500, 4200)
        i = int(bas * SR)
        out[i:i + m] += pan2(s, rng.uniform(-0.9, 0.9))
    return out / (np.std(out) + 1e-9) if out.any() else out


def davul(guc: float = 1.0) -> np.ndarray:
    m = int(0.42 * SR)
    t = np.arange(m) / SR
    f = 52 + 60 * np.exp(-t * 28)
    faz = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(faz) * np.exp(-t * 7.5) + 0.3 * np.sin(2 * faz) * np.exp(-t * 16)
    s += 0.25 * np.exp(-t * 60) * np.sin(2 * np.pi * 180 * t)
    s *= np.minimum(1, t / 0.003) * guc
    return np.stack([s, s], axis=1)


# ------------------------------------------------------------------ stadyum
def stadyum(st: np.ndarray, rng, islak: float = 0.26, kuyruk: float = 1.6) -> np.ndarray:
    """Açık stadyum: karşı tribünden dönen yansımalar + havada dağılan kuyruk."""
    n = st.shape[0]
    m = int(kuyruk * SR)
    t = np.arange(m) / SR
    out = np.zeros((n + m, 2))
    N = 1 << int(np.ceil(np.log2(n + m)))
    for ch in range(2):
        ir = rng.standard_normal(m) * np.exp(-t * (5.2 / kuyruk)) * np.minimum(1, t / 0.03)
        ir = bant(ir, 160, 3200)
        ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
        for ms, amp in ((70, 0.30), (118, 0.22), (171, 0.17), (236, 0.11), (310, 0.07)):
            i = int((ms + rng.uniform(-8, 8)) / 1000 * SR)
            ir[i] += amp * (1 if rng.random() < 0.7 else -1)
        y = np.fft.irfft(np.fft.rfft(st[:, ch], N) * np.fft.rfft(ir, N), N)[: n + m]
        out[:n, ch] += st[:, ch]
        out[:, ch] += y * islak
    return out


def dongu_yap(st: np.ndarray, gecis: float = 1.5) -> np.ndarray:
    """Sonu başına eritilmiş kesintisiz döngü."""
    g = int(gecis * SR)
    govde = st[: st.shape[0] - g].copy()
    kuy = st[st.shape[0] - g:]
    w = np.linspace(0, 1, g)[:, None]
    govde[:g] = govde[:g] * np.sqrt(w) + kuy * np.sqrt(1 - w)
    return govde


def yaz_mp3(st: np.ndarray, hedef: pathlib.Path, tmp: pathlib.Path, lufs: float = -15.0, kbps: int = 128, dongu: bool = False) -> None:
    st = sinirla(st.astype(np.float64))
    raw = tmp / (hedef.stem + ".f32")
    st.astype(np.float32).tofile(raw)
    af = "highpass=f=60,lowpass=f=9500"
    if not dongu:
        af += f",loudnorm=I={lufs}:TP=-1.5:LRA=11"
    else:
        rms_db = 20.0 * float(np.log10(np.sqrt(float(np.mean(st ** 2))) + 1e-9))
        af += f",volume={lufs - rms_db:.2f}dB"  # döngüde loudnorm baş/son düzeyini bozmasın
    hedef.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2",
                    "-i", str(raw), "-af", af, "-codec:a", "libmp3lame", "-b:a", f"{kbps}k", str(hedef)], check=True)
    print(f"  ✓ {hedef.name}  {st.shape[0] / SR:.1f} sn  {hedef.stat().st_size // 1024} KB", flush=True)


# ------------------------------------------------------------------ SESLER
def ses_ugultu(rng) -> np.ndarray:
    """Maç boyunca dönen tribün uğultusu: binlerce kişinin mırıltısı + arada yükselen bağırışlar, tek tük alkış ve ıslık."""
    S = 22.0
    mir = girtlak_korosu(S, 170, rng, unluler=[(0, "a"), (0.3, "e"), (0.6, "o"), (1, "a")], perde=(110, 330),
                         hece=(0.09, 0.28), nefes=0.5, dagilim=0.45, uzak=0.7)
    mir = bant(mir, 180, 2600)
    dalga = lambda t: 0.25 + 0.2 * np.sin(2 * np.pi * t / 7.3) ** 2 + 0.25 * np.exp(-((t - 9.5) / 1.6) ** 2) + 0.2 * np.exp(-((t - 17.5) / 1.2) ** 2)
    bag = girtlak_korosu(S, 110, rng, unluler=[(0, "o"), (0.5, "a"), (1, "e")], perde=(150, 380), yogunluk=dalga,
                         nefes=0.45, dagilim=0.45, uzak=0.75)
    bag = bant(bag, 250, 3000)
    n = int(S * SR)
    hava = np.stack([bant(pembe(n, rng), 220, 1800), bant(pembe(n, rng), 220, 1800)], axis=1)
    hava /= np.std(hava)
    alk = alkis(S, 90, rng, yogunluk=lambda t: 0.10 + 0.5 * np.exp(-((t - 10.2) / 1.5) ** 2))
    isl = islik(S, 7, rng)
    zt = np.arange(n) / SR
    nefesle = (0.82 + 0.18 * np.sin(2 * np.pi * zt / 5.7 + 1.0))[:, None]
    st = (0.95 * mir[:n] + 0.55 * bag[:n] + 0.42 * hava + 0.16 * alk[:n] + 0.035 * isl[:n]) * nefesle
    st = stadyum(st, rng, islak=0.3, kuyruk=1.8)[:n]
    return dongu_yap(st, 2.0)


def ses_alkis(rng, sure=4.6, kisi=520) -> np.ndarray:
    """Güzel hareket alkışı: hızla dolan, yavaşça seyrelen kalabalık alkış + kısa onay bağırışları."""
    yg = lambda t: np.clip(t / 0.25, 0, 1) * (1.0 if t < sure * 0.45 else max(0.0, 1 - (t - sure * 0.45) / (sure * 0.55)) ** 1.3)
    a = alkis(sure, kisi, rng, yogunluk=yg)
    b = girtlak_korosu(sure, 70, rng, unluler=[(0, "e"), (0.4, "o"), (1, "a")], perde=(170, 400), yogunluk=lambda t: 0.9 * np.exp(-t / 1.1), nefes=0.4)
    n = int(sure * SR)
    st = 1.0 * a[:n] + 0.42 * bant(b[:n], 250, 3000) * yumusak(n, 0.05, 1.5)[:, None]
    st *= yumusak(n, 0.02, 0.9)[:, None]
    return stadyum(st, rng, islak=0.24, kuyruk=1.5)


def ses_gol(rng) -> np.ndarray:
    """GOL: tribün patlar – "gooool/eeey" kükremesi, ayağa kalkan alkış, ıslıklar, davul."""
    S = 8.0
    n = int(S * SR)
    patla = lambda t: (np.clip((t - 0.02) / 0.22, 0, 1) ** 0.6) * (1.0 if t < 3.2 else max(0.12, np.exp(-(t - 3.2) / 2.2)))
    k1 = girtlak_korosu(S, 320, rng, unluler=[(0, "o"), (0.22, "o"), (0.5, "a"), (0.8, "e"), (1, "e")], perde=(170, 470),
                        yogunluk=patla, perde_egim=0.5, nefes=0.5, dagilim=0.5, uzak=0.55)
    k1 = bant(k1, 220, 3600)
    gur = np.stack([bant(pembe(n, rng), 350, 2800), bant(pembe(n, rng), 350, 2800)], axis=1)
    gur /= np.std(gur)
    zt = np.arange(n) / SR
    zg = (np.clip((zt - 0.03) / 0.3, 0, 1) ** 0.7 * np.where(zt < 3.0, 1.0, np.exp(-(zt - 3.0) / 2.0)))[:, None]
    a = alkis(S, 700, rng, yogunluk=lambda t: float(np.clip((t - 0.5) / 1.2, 0, 1)) * (1.0 if t < 5.0 else max(0.0, 1 - (t - 5.0) / 3.0)))
    isl = islik(S, 22, rng, yogunluk=lambda t: 0.2 + 0.8 * float(t > 0.4 and t < 5))
    st = 1.0 * k1[:n] + 0.55 * gur * zg + 0.5 * a[:n] + 0.07 * isl[:n]
    for tv in (1.2, 1.55, 1.9, 2.6, 2.95, 3.3, 4.0, 4.35, 4.7):
        d = davul(0.9)
        i = int(tv * SR)
        st[i:i + d.shape[0]] += d[: max(0, n - i)] * 1.6
    st *= yumusak(n, 0.01, 2.2)[:, None]
    return stadyum(st, rng, islak=0.3, kuyruk=2.0)


def ses_ooo(rng) -> np.ndarray:
    """Az farkla kaçtı / direk: yükselip düşen "ooooo…" + dağınık alkış."""
    S = 3.6
    n = int(S * SR)
    yg = lambda t: np.clip(t / 0.15, 0, 1) * np.exp(-max(0.0, t - 0.9) / 0.9)
    k = girtlak_korosu(S, 240, rng, unluler=[(0, "o"), (0.45, "o"), (1, "u")], perde=(150, 400), yogunluk=yg,
                       perde_egim=-2.2, nefes=0.4, dagilim=0.5)
    k = bant(k, 200, 2600)
    a = alkis(S, 160, rng, yogunluk=lambda t: 0.75 * float(np.clip((t - 1.0) / 0.6, 0, 1)) * max(0.0, 1 - max(0.0, t - 1.8) / 1.8))
    st = 1.0 * k[:n] + 0.3 * a[:n]
    st *= yumusak(n, 0.02, 1.2)[:, None]
    return stadyum(st, rng, islak=0.28, kuyruk=1.6)


def ses_ah(rng) -> np.ndarray:
    """Rakip gol attı: tribünden hayal kırıklığı – düşen "aaah…", sonra sessizlik ve tek tük ıslık."""
    S = 3.4
    n = int(S * SR)
    yg = lambda t: np.clip(t / 0.2, 0, 1) * np.exp(-max(0.0, t - 0.6) / 0.8)
    k = girtlak_korosu(S, 200, rng, unluler=[(0, "a"), (0.5, "a"), (1, "u")], perde=(130, 330), yogunluk=yg,
                       perde_egim=-3.0, nefes=0.45, dagilim=0.5)
    k = bant(k, 180, 2200)
    isl = islik(S, 6, rng, yogunluk=lambda t: float(t > 1.0))
    st = 1.0 * k[:n] + 0.05 * isl[:n]
    st *= yumusak(n, 0.03, 1.4)[:, None]
    return stadyum(st, rng, islak=0.3, kuyruk=1.6)


def ses_heyecan(rng) -> np.ndarray:
    """Atak gelişiyor / şut: kalabalığın yükselen uğultusu ("oooOOO") – kısa."""
    S = 2.6
    n = int(S * SR)
    yg = lambda t: np.clip(t / 1.5, 0, 1) ** 1.6 * (1.0 if t < 1.9 else max(0.0, 1 - (t - 1.9) / 0.7))
    k = girtlak_korosu(S, 220, rng, unluler=[(0, "u"), (0.5, "o"), (1, "a")], perde=(150, 420), yogunluk=yg,
                       perde_egim=1.8, nefes=0.45, dagilim=0.5)
    k = bant(k, 200, 3000)
    zt = np.arange(n) / SR
    st = k[:n] * (np.clip(zt / 1.7, 0.05, 1) ** 1.2)[:, None]
    st *= yumusak(n, 0.05, 0.7)[:, None]
    return stadyum(st, rng, islak=0.26, kuyruk=1.4)


# ------------------------------------------------------------------ tezahürat (TTS koro)
TTS_SESLER = [
    ("tr-TR-AhmetNeural", "+0Hz"), ("tr-TR-AhmetNeural", "-18Hz"), ("tr-TR-AhmetNeural", "+22Hz"),
    ("tr-TR-EmelNeural", "+0Hz"), ("tr-TR-EmelNeural", "-16Hz"), ("tr-TR-EmelNeural", "+20Hz"),
    ("en-US-AndrewMultilingualNeural", "+0Hz"), ("en-US-BrianMultilingualNeural", "+0Hz"),
    ("de-DE-FlorianMultilingualNeural", "+0Hz"), ("fr-FR-RemyMultilingualNeural", "+0Hz"),
    ("en-US-AvaMultilingualNeural", "+0Hz"), ("fr-FR-VivienneMultilingualNeural", "+0Hz"),
]


def coz(yol: pathlib.Path) -> np.ndarray:
    r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(yol), "-ac", "1", "-ar", str(SR),
                        "-f", "f32le", "pipe:1"], capture_output=True, check=True)
    x = np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
    if x.size < 400:
        return np.zeros(0)
    tepe = np.max(np.abs(x)) + 1e-9
    nz = np.where(np.abs(x) > tepe * 0.03)[0]
    if nz.size == 0:
        return np.zeros(0)
    x = x[max(0, nz[0] - int(0.01 * SR)): nz[-1] + int(0.03 * SR)]
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-9)


def ornekle(x: np.ndarray, oran: float) -> np.ndarray:
    """Perde+tını kaydır (yeniden örnekleme): oran>1 → daha ince ve kısa."""
    m = max(32, int(x.size / oran))
    return np.interp(np.linspace(0, x.size - 1, m), np.arange(x.size), x)


def esnet(x: np.ndarray, hedef: int) -> np.ndarray:
    """Perdeyi değiştirmeden süreyi `hedef` örneğe getir (taneli bindirme)."""
    if abs(x.size - hedef) < 64:
        return np.resize(x, hedef) if x.size >= hedef else np.concatenate([x, np.zeros(hedef - x.size)])
    tane = int(0.045 * SR)
    atla = tane // 2
    w = np.hanning(tane)
    out = np.zeros(hedef + tane)
    nrm = np.zeros(hedef + tane)
    oran = (x.size - tane) / max(1, hedef - tane)
    p = 0
    while p + tane <= hedef + atla:
        s = int(p * oran)
        if s + tane > x.size:
            break
        out[p:p + tane] += x[s:s + tane] * w
        nrm[p:p + tane] += w
        p += atla
    return (out / np.maximum(nrm, 1e-3))[:hedef]


async def tts_al(metin: str, klasor: pathlib.Path, ad: str) -> list[np.ndarray]:
    import edge_tts

    async def bir(i, ses, perde):
        yol = klasor / f"{ad}_{i}.mp3"
        for dene in range(3):
            try:
                await edge_tts.Communicate(text=metin, voice=ses, rate="+8%", pitch=perde).save(str(yol))
                return yol
            except Exception:
                await asyncio.sleep(0.6 + dene)
        return None

    yollar = await asyncio.gather(*(bir(i, s, p) for i, (s, p) in enumerate(TTS_SESLER)))
    out = [coz(y) for y in yollar if y and y.exists()]
    return [x for x in out if x.size > 2000]


def koro(okumalar: list[np.ndarray], rng, kisi: int = 110, pan: float = 0.0) -> np.ndarray:
    """Okumalardan `kisi` kişilik bağıran, hafif dağınık koro (stereo)."""
    hedef = int(np.median([o.size for o in okumalar]))
    out = np.zeros((hedef + int(0.5 * SR), 2))
    for i in range(kisi):
        x = okumalar[i % len(okumalar)]
        oran = float(np.clip(rng.normal(1.0, 0.055), 0.86, 1.16))      # farklı insanlar: perde + tını
        y = esnet(ornekle(x, oran), int(hedef * rng.uniform(0.97, 1.04)))
        # bağırma: orta-üst bandı öne al, hafif kır
        y = y + 0.9 * bant(y, 1100, 3600)
        y = np.tanh(y * 0.9)
        on = i < kisi * 0.35                                           # öndekiler net, arkadakiler geç ve boğuk
        gec = rng.uniform(0.0, 0.035) if on else rng.uniform(0.05, 0.26)
        guc = rng.uniform(0.7, 1.0) if on else rng.uniform(0.25, 0.55)
        if not on:
            y = bant(y, 200, 2400)
        j = int(gec * SR)
        f = min(600, y.size // 4)
        y[:f] *= np.linspace(0, 1, f)
        y[-f:] *= np.linspace(1, 0, f)
        p = float(np.clip(pan + rng.uniform(-0.9, 0.9), -1, 1))
        out[j:j + y.size] += pan2(y * guc, p)
    return out / (np.std(out) + 1e-9)


def tezahurat_kur(sure, parcalar, davullar, alkislar, korolar, rng, yatak: np.ndarray) -> np.ndarray:
    n = int(sure * SR)
    st = np.zeros((n + SR, 2))
    for ad, t0, guc in parcalar:
        k = korolar[ad]
        i = int(t0 * SR)
        m = min(k.shape[0], st.shape[0] - i)
        st[i:i + m] += k[:m] * guc
    for t0 in davullar:
        d = davul(1.0)
        i = int(t0 * SR)
        st[i:i + d.shape[0]] += d * 3.2
    if alkislar:
        for t0 in alkislar:
            a = alkis(0.35, 130, rng, ritim=(9.0, 0.03, 0.018))
            i = int(t0 * SR)
            st[i:i + a.shape[0]] += a * 1.5
    st = st[:n]
    st += yatak[:n] * 0.5
    st *= yumusak(n, 0.25, 0.7)[:, None]
    return stadyum(st, rng, islak=0.3, kuyruk=1.7)


TEZAHURATLAR = {
    # ad: (süre, [(parça, sn, güç)], davul vuruşları, ritmik alkışlar)
    "tezahurat_cimbombom": (7.0, [("rere", 0.3, 1.0), ("rara", 1.5, 1.0), ("gs", 2.75, 1.05), ("cimbom", 4.05, 1.1), ("cimbom", 5.3, 1.1)],
                            [0.25, 0.85, 1.45, 2.05, 2.7, 3.35, 4.0, 4.6, 5.25, 5.85], [2.3, 3.6, 4.9, 6.15]),
    "tezahurat_cimbom_alkis": (6.4, [("cimbom", 0.9, 1.1), ("cimbom", 2.6, 1.1), ("enbuyuk", 4.3, 1.15)],
                               [0.9, 2.6, 4.3, 4.9], [0.15, 0.4, 0.65, 1.85, 2.1, 2.35, 3.55, 3.8, 4.05, 5.6, 5.85]),
    "tezahurat_sampiyon": (6.2, [("sampiyon", 0.3, 1.05), ("gs", 1.45, 1.05), ("sampiyon", 2.85, 1.05), ("gs", 4.0, 1.1)],
                           [0.25, 0.85, 1.4, 2.0, 2.8, 3.4, 3.95, 4.55, 5.1], [5.0, 5.3, 5.6]),
    "tezahurat_sari_kirmizi": (6.6, [("sari", 0.3, 1.0), ("kirmizi", 1.2, 1.0), ("sari", 2.3, 1.0), ("kirmizi", 3.2, 1.0), ("enbuyuk", 4.4, 1.15)],
                               [0.25, 1.15, 2.25, 3.15, 4.35, 4.95, 5.55], [0.8, 1.9, 2.85, 3.9, 5.9, 6.15]),
    "tezahurat_haydi_aslanlar": (6.2, [("haydi", 0.3, 1.05), ("haydi", 2.0, 1.05), ("saldir", 3.75, 1.1)],
                                 [0.25, 0.9, 1.95, 2.6, 3.7, 4.3, 4.9], [1.5, 1.75, 3.25, 3.5, 5.5, 5.75]),
}
PARCALAR = {
    "rere": ("Re, re, re!", 0.0), "rara": ("Ra, ra, ra!", 0.0), "gs": ("Galatasaray!", 0.0), "cimbom": ("Cim Bom Bom!", 0.0),
    "enbuyuk": ("En büyük Cimbom!", 0.0), "sampiyon": ("Şampiyon!", 0.0), "sari": ("Sarı!", -0.45), "kirmizi": ("Kırmızı!", 0.45),
    "haydi": ("Haydi Aslanlar!", 0.0), "saldir": ("Haydi Galatasaray!", 0.0), "oley": ("Oley, oley, oley!", 0.0),
}


async def tezahuratlari_uret(cikti: pathlib.Path, tmp: pathlib.Path, rng, yalniz) -> None:
    istenen = [k for k in TEZAHURATLAR if not yalniz or k in yalniz or "tezahurat" in yalniz]
    gol_cosku = (not yalniz) or ("tezahurat" in yalniz) or ("tezahurat_gol_cosku" in yalniz)
    if not istenen and not gol_cosku:
        return
    gerek = {p for k in istenen for p, _, _ in TEZAHURATLAR[k][1]} | ({"oley", "gs"} if gol_cosku else set())
    korolar = {}
    for ad in sorted(gerek):
        metin, pan = PARCALAR[ad]
        ok = await tts_al(metin, tmp, ad)
        if len(ok) < 3:
            print(f"  ! TTS alınamadı: {ad} ({len(ok)} okuma)", flush=True)
            return
        korolar[ad] = koro(ok, rng, pan=pan)
        print(f"  koro: {ad} ({len(ok)} ses → 110 kişi)", flush=True)
    yatak = girtlak_korosu(8.0, 120, rng, unluler=[(0, "a"), (0.5, "o"), (1, "e")], perde=(130, 360), hece=(0.1, 0.3), nefes=0.5, uzak=0.7)
    yatak = bant(yatak, 200, 2600)
    for ad in istenen:
        sure, parcalar, dv, al = TEZAHURATLAR[ad]
        yaz_mp3(tezahurat_kur(sure, parcalar, dv, al, korolar, rng, yatak), cikti / f"{ad}.mp3", tmp, lufs=-14.5)
    if gol_cosku:
        # gol sonrası: kükreme dinerken "Oley oley oley! Galatasaray!" + davul + alkış
        g = ses_gol(rng)
        n = g.shape[0]
        t = tezahurat_kur(6.0, [("oley", 0.2, 1.1), ("gs", 1.9, 1.1), ("oley", 3.2, 1.1), ("gs", 4.6, 1.1)],
                          [0.2, 0.8, 1.4, 1.9, 2.6, 3.2, 3.8, 4.6, 5.2], [1.5, 2.9, 4.2, 5.6], korolar, rng, yatak)
        out = np.zeros((int(2.6 * SR) + t.shape[0], 2))
        out[:n] += g[: out.shape[0]] * 1.0
        out[int(2.6 * SR):int(2.6 * SR) + t.shape[0]] += t * 0.85
        yaz_mp3(out, cikti / "tezahurat_gol_cosku.mp3", tmp, lufs=-13.5)


URETIM = {
    "ugultu": ("tribun_ugultu.mp3", ses_ugultu, dict(lufs=-25.5, dongu=True, kbps=128)),
    "alkis": ("tribun_alkis.mp3", ses_alkis, dict(lufs=-16.0)),
    "gol": ("tribun_gol.mp3", ses_gol, dict(lufs=-13.0)),
    "ooo": ("tribun_ooo.mp3", ses_ooo, dict(lufs=-15.0)),
    "ah": ("tribun_ah.mp3", ses_ah, dict(lufs=-16.5)),
    "heyecan": ("tribun_heyecan.mp3", ses_heyecan, dict(lufs=-16.0)),
}


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--yalniz", default="")
    ap.add_argument("--cikti", default=str(SESLER))
    ap.add_argument("--tts-yok", action="store_true")
    ap.add_argument("--tohum", type=int, default=190561)
    a = ap.parse_args()
    yalniz = {s.strip() for s in a.yalniz.split(",") if s.strip()}
    cikti = pathlib.Path(a.cikti)
    with tempfile.TemporaryDirectory(prefix="gun_taraftar_") as td:
        tmp = pathlib.Path(td)
        for i, (ad, (dosya, fn, sec)) in enumerate(URETIM.items()):
            if yalniz and ad not in yalniz:
                continue
            print(f"{ad} …", flush=True)
            yaz_mp3(fn(np.random.default_rng(a.tohum + 7 * i)), cikti / dosya, tmp, **sec)
        if not a.tts_yok:
            asyncio.run(tezahuratlari_uret(cikti, tmp, np.random.default_rng(a.tohum + 99), yalniz))
    return 0


if __name__ == "__main__":
    sys.exit(main())
