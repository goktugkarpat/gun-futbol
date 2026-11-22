(function (global) {
  'use strict';

  /**
   * URL parametresinde ?sessiz veya ?sessiz=1 (veya ?sessiz=true) olup olmadığını kontrol eder.
   * Aktifse AudioContext ve ses oynatma kesinlikle açılmaz.
   */
  function sessizParametreMi() {
    try {
      if (typeof global === 'undefined' || !global.location) {
        return false;
      }
      var params = new URLSearchParams(global.location.search || '');
      if (!params.has('sessiz')) {
        return false;
      }
      var val = params.get('sessiz');
      return val === '' || val === '1' || val === 'true';
    } catch (e) {
      return false;
    }
  }

  var zorunluSessiz = sessizParametreMi();

  var ctx = null;
  var masterGain = null;
  var compressor = null;
  var noiseBuffer = null;
  var unlockDinleyiciEklendi = false;

  var sonSfxZamani = {};
  var SFX_SOGUMA = {
    duduk: 300,
    dudukUzun: 500,
    vurus: 40,
    pas: 40,
    superSut: 180,
    direk: 140,
    ag: 140,
    kapma: 50,
    yakala: 60,
    tezahurat: 350,
    zafer: 600
  };

  var SPIKER_GRUPLAR = {
    basla: ['basla', 'basla_2', 'basla_3'],
    gun_top: ['gun_top', 'gun_top_2', 'gun_top_3', 'gun_top_4'],
    pas_gun: ['pas_gun', 'pas_gun_2', 'pas_gun_3'],
    pas_guzel: ['pas_guzel_1', 'pas_guzel_2', 'pas_guzel_3'],
    aslan_sutu: ['aslan_sutu', 'aslan_sutu_2', 'aslan_sutu_3'],
    sut_sert: ['sut_sert_1', 'sut_sert_2'],
    kapma: ['kapma_1', 'kapma_2', 'kapma_3'],
    degaj: ['degaj_1', 'degaj_2'],
    gol_gun: ['gol_gun_1', 'gol_gun_2', 'gol_gun_3', 'gol_gun_4'],
    gol_gs: ['gol_gs', 'gol_gs_2', 'gol_gs_3'],
    gol_fb: ['gol_fb', 'gol_fb_2'],
    gol_bjk: ['gol_bjk'],
    gol_ts: ['gol_ts'],
    kurtaris: ['kurtaris', 'kurtaris_2', 'kurtaris_3'],
    direk: ['direk', 'direk_2'],
    devre: ['devre', 'devre_2'],
    ikinci_yari: ['ikinci_yari', 'ikinci_yari_2'],
    altin_gol: ['altin_gol'],
    zafer: ['zafer', 'zafer_2'],
    mac_sonu: ['mac_sonu', 'mac_sonu_2'],
    korner_gs: ['korner_gs'],
    korner_fb: ['korner_fb'],
    korner_bjk: ['korner_bjk'],
    korner_ts: ['korner_ts'],
    tac_gs: ['tac_gs'],
    aut_atisi: ['aut_atisi']
  };

  var SPIKER_ONCELIK = {
    gun_top: 1,
    pas_gun: 1,
    pas_guzel: 1,
    kapma: 1,
    degaj: 1,
    tac_gs: 1,
    aut_atisi: 1,
    aslan_sutu: 2,
    sut_sert: 2,
    kurtaris: 2,
    direk: 2,
    korner_gs: 2,
    korner_fb: 2,
    korner_bjk: 2,
    korner_ts: 2,
    basla: 3,
    ikinci_yari: 3,
    gol_gun: 3,
    gol_gun_1: 3,
    gol_gun_2: 3,
    gol_gs: 3,
    gol_fb: 3,
    gol_bjk: 3,
    gol_ts: 3,
    devre: 4,
    altin_gol: 4,
    zafer: 4,
    mac_sonu: 4
  };

  var SPIKER_SOGUMA = {
    gun_top: 5500,
    pas_gun: 4200,
    pas_guzel: 6500,
    kapma: 5500,
    degaj: 5500,
    tac_gs: 5000,
    aut_atisi: 4500,
    aslan_sutu: 2800,
    sut_sert: 4200,
    kurtaris: 2500,
    direk: 2500,
    korner_gs: 3200,
    korner_fb: 3200,
    korner_bjk: 3200,
    korner_ts: 3200,
    basla: 1200,
    ikinci_yari: 1200,
    gol_gun: 1000,
    gol_gun_1: 1000,
    gol_gun_2: 1000,
    gol_gs: 1000,
    gol_fb: 1000,
    gol_bjk: 1000,
    gol_ts: 1000,
    devre: 1200,
    altin_gol: 1200,
    zafer: 1500,
    mac_sonu: 1500
  };

  var klipHavuzu = {};
  var sonSpikerZamani = {};
  var sonGrupSecim = {};
  var sonSpikerBitisZamani = 0;
  var sonOyuncuAnonsMs = 0;
  var sonAksiyonAnonsMs = 0;
  var aktifSpiker = null; // { ad, el, oncelik }

  var pinkNoiseBuffer = null;
  var tribunAktifMi = false;
  var tribunIsteniyor = false;
  var tribunHedefSeviye = 0.42;
  var ambiyansMaster = null;
  var ambiyansDuck = null;
  var ambiyansBedSrc = null;
  var ambiyansLfo1 = null;
  var ambiyansLfo2 = null;
  var tezahuratTimer = null;
  var tezahuratSira = 0;
  var gizlilikDinleyiciEklendi = false;

  var TEZAHURAT_MAC = [
    'tezahurat_cimbombom',
    'tezahurat_cimbom_alkis',
    'tezahurat_cimbombom',        // ebeveyn: "Cim Bom Bom" aralarda sık girsin ve duyulsun
    'tezahurat_cimbom_alkis',
    'tezahurat_sampiyon',
    'tezahurat_sari_kirmizi',
    'tezahurat_haydi_aslanlar'
  ];
  var TEZAHURAT_GOL = 'tezahurat_gol_cosku';
  var tezahuratHavuz = {};
  var aktifTezahurat = null; // { ad, el }
  var sonTezahuratAd = '';
  var spikerKonusuyorMu = false;

  function simdiMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function gucSinirla(guc, varsayilan) {
    var v = typeof guc === 'number' && isFinite(guc) ? guc : (varsayilan || 1);
    return Math.max(0.15, Math.min(1.8, v));
  }

  function sesAktifMi() {
    return !zorunluSessiz && !SES.sessiz;
  }

  function sesKilidiniAc() {
    if (!sesAktifMi() || !ctx) {
      return;
    }
    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        var p = ctx.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {});
        }
      }
    } catch (e) {
      // Sessiz geç
    }
  }

  function unlockDinleyicisiEkle() {
    if (unlockDinleyiciEklendi || zorunluSessiz || typeof document === 'undefined') {
      return;
    }
    unlockDinleyiciEklendi = true;
    var tekSefer = function () {
      if (sesAktifMi()) {
        ctxAl();
        sesKilidiniAc();
        if (tribunIsteniyor && !tribunAktifMi && typeof SES !== 'undefined' && typeof SES.tribunBaslat === 'function') {
          SES.tribunBaslat();
        }
      }
      if (ctx && ctx.state === 'running') {
        document.removeEventListener('pointerdown', tekSefer, true);
        document.removeEventListener('touchstart', tekSefer, true);
        document.removeEventListener('keydown', tekSefer, true);
      }
    };
    try {
      document.addEventListener('pointerdown', tekSefer, { capture: true, passive: true });
      document.addEventListener('touchstart', tekSefer, { capture: true, passive: true });
      document.addEventListener('keydown', tekSefer, { capture: true, passive: true });
    } catch (e) {
      // Eski ortamlar için güvenli yoksayma
    }
  }

  function noiseBufferAl(audioCtx) {
    if (noiseBuffer) {
      return noiseBuffer;
    }
    var ornekSayisi = Math.floor(audioCtx.sampleRate * 2.0);
    var buf = audioCtx.createBuffer(1, ornekSayisi, audioCtx.sampleRate);
    var veri = buf.getChannelData(0);
    for (var i = 0; i < ornekSayisi; i++) {
      veri[i] = Math.random() * 2 - 1;
    }
    noiseBuffer = buf;
    return buf;
  }

  function pinkNoiseBufferAl(audioCtx) {
    if (pinkNoiseBuffer) {
      return pinkNoiseBuffer;
    }
    var sure = 6.0;
    var ornekSayisi = Math.floor(audioCtx.sampleRate * sure);
    var buf = audioCtx.createBuffer(2, ornekSayisi, audioCtx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var veri = buf.getChannelData(ch);
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < ornekSayisi; i++) {
        var white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        var pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
        veri[i] = Math.max(-1, Math.min(1, pink));
      }
      // Döngü sınırında klik oluşmaması için son 0.35 sn'yi başlangıçla çapraz geçişle yumuşat
      var fadeOrnek = Math.min(Math.floor(audioCtx.sampleRate * 0.35), Math.floor(ornekSayisi * 0.25));
      for (var k = 0; k < fadeOrnek; k++) {
        var t = k / fadeOrnek;
        var kuyrukIdx = ornekSayisi - fadeOrnek + k;
        veri[kuyrukIdx] = veri[kuyrukIdx] * (1 - t) + veri[k] * t;
      }
    }
    pinkNoiseBuffer = buf;
    return buf;
  }

  // ------------------------------------------------------------------
  // TRİBÜN KAYITLARI (gen_taraftar.py): kesintisiz uğultu döngüsü + olaylara tepki klipleri
  // ------------------------------------------------------------------
  var UGULTU_DOSYA = 'tribun_ugultu';
  var UGULTU_BINDIRME = 1.8;          // sn: döngü sonu yeni başlangıçla bu kadar üst üste eritilir (mp3 boşluğu duyulmaz)
  var ugultu = { a: null, b: null, aktif: null, gecisBas: 0, timer: null, seviye: 0, hedef: 0 };
  var tepkiHavuz = {};
  var sonTepkiMs = {};
  var TEPKI = {
    //            dosya              kazanç  soğuma(ms)
    gol:      ['tribun_gol',      1.00, 1500],
    alkis:    ['tribun_alkis',    0.80, 1600],
    ooo:      ['tribun_ooo',      0.90, 1400],
    ah:       ['tribun_ah',       0.85, 2500],
    heyecan:  ['tribun_heyecan',  0.62, 1700]
  };

  function sesElemani(ad) {
    if (typeof global.Audio !== 'function') return null;
    try {
      var el = new global.Audio('sesler/' + ad + '.mp3');
      el.preload = 'auto';
      return el;
    } catch (e) { return null; }
  }

  function ugultuHedefHesapla() {
    if (!tribunAktifMi || !sesAktifMi()) return 0;
    if (typeof document !== 'undefined' && document.hidden) return 0;
    var s = Math.max(0, Math.min(1, 0.16 + tribunHedefSeviye * 0.78));
    return spikerKonusuyorMu ? s * 0.62 : s;
  }

  function ugultuAdim() {
    var u = ugultu;
    u.hedef = ugultuHedefHesapla();
    u.seviye += (u.hedef - u.seviye) * 0.18;               // yumuşak ses geçişi (~0,5 sn)
    if (u.seviye < 0.004 && u.hedef === 0) {
      if (u.a) { try { u.a.pause(); } catch (e) {} }
      if (u.b) { try { u.b.pause(); } catch (e) {} }
      if (u.timer !== null) { clearInterval(u.timer); u.timer = null; }
      u.aktif = null; u.seviye = 0;
      return;
    }
    if (!u.a) { u.a = sesElemani(UGULTU_DOSYA); u.b = sesElemani(UGULTU_DOSYA); }
    if (!u.a || !u.b) return;
    if (!u.aktif) { u.aktif = u.a; try { u.a.currentTime = 0; } catch (e) {} oynat(u.a); }
    var ak = u.aktif, dg = (ak === u.a) ? u.b : u.a;
    var sure = ak.duration, kalan = (sure && isFinite(sure)) ? sure - ak.currentTime : 99;
    var k = 1;
    if (kalan < UGULTU_BINDIRME) {
      if (dg.paused) { try { dg.currentTime = 0; } catch (e) {} oynat(dg); }
      k = Math.max(0, kalan / UGULTU_BINDIRME);
      try { dg.volume = Math.min(1, u.seviye * Math.sqrt(1 - k)); } catch (e) {}
      if (kalan < 0.06 || ak.ended) { u.aktif = dg; try { ak.pause(); } catch (e) {} k = 1; ak = dg; }
    }
    try { ak.volume = Math.min(1, u.seviye * Math.sqrt(k)); } catch (e) {}
    if (ak.paused && !ak.ended && u.hedef > 0) oynat(ak);
  }

  function oynat(el) {
    try { var p = el.play(); if (p && typeof p.catch === 'function') p.catch(function () {}); } catch (e) {}
  }

  function ugultuBaslat() {
    if (zorunluSessiz || typeof global.setInterval !== 'function') return;
    if (ugultu.timer === null) ugultu.timer = setInterval(ugultuAdim, 90);
    ugultuAdim();
  }

  /** Olaya tepki: 'gol' | 'alkis' | 'ooo' | 'ah' | 'heyecan'. guc 0..1.5 ses düzeyini ölçekler. */
  function tepkiCal(tip, guc) {
    var tn = TEPKI[tip];
    if (!tn || !sesAktifMi()) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    var ms = simdiMs();
    if (sonTepkiMs[tip] && ms - sonTepkiMs[tip] < tn[2]) return false;
    var el = tepkiHavuz[tip] || (tepkiHavuz[tip] = sesElemani(tn[0]));
    if (!el) return false;
    sonTepkiMs[tip] = ms;
    try {
      if (el.readyState > 0) { try { el.currentTime = 0; } catch (_) {} }
      var g = (typeof guc === 'number' && isFinite(guc)) ? Math.max(0.3, Math.min(1.3, guc)) : 1;
      el.volume = Math.max(0, Math.min(1, tn[1] * g * (spikerKonusuyorMu ? 0.8 : 1)));
      oynat(el);
      return true;
    } catch (e) { return false; }
  }

  function tezahuratSesDuzeyiHesapla() {
    var baz = Math.max(0.5, Math.min(0.9, 0.44 + tribunHedefSeviye * 0.6));   // tezahürat arka planda ama net duyulur
    return spikerKonusuyorMu ? baz * 0.60 : baz;
  }

  function ambiyansDuckAyar(spikerKonusuyor) {
    spikerKonusuyorMu = Boolean(spikerKonusuyor);
    if (aktifTezahurat && aktifTezahurat.el) {
      try {
        aktifTezahurat.el.volume = tezahuratSesDuzeyiHesapla();
      } catch (e) {}
    }
    if (!ambiyansDuck || !ctx) return;
    try {
      var t = ctx.currentTime;
      ambiyansDuck.gain.cancelScheduledValues(t);
      ambiyansDuck.gain.setValueAtTime(ambiyansDuck.gain.value, t);
      ambiyansDuck.gain.linearRampToValueAtTime(
        spikerKonusuyor ? 0.62 : 1.0,
        t + (spikerKonusuyor ? 0.14 : 0.42)
      );
    } catch (e) {
      // Yoksay
    }
  }

  function tezahuratZamaniTemizle() {
    if (tezahuratTimer !== null) {
      clearTimeout(tezahuratTimer);
      tezahuratTimer = null;
    }
  }

  function tezahuratDurdur() {
    tezahuratZamaniTemizle();
    if (aktifTezahurat && aktifTezahurat.el) {
      try {
        aktifTezahurat.el.pause();
        aktifTezahurat.el.currentTime = 0;
      } catch (e) {}
    }
    aktifTezahurat = null;
  }

  function tezahuratElemaniAl(ad) {
    if (tezahuratHavuz[ad]) {
      return tezahuratHavuz[ad];
    }
    if (typeof global.Audio !== 'function') {
      return null;
    }
    try {
      var el = new global.Audio('sesler/' + ad + '.mp3');
      el.preload = 'auto';
      el.onerror = function () {
        if (aktifTezahurat && aktifTezahurat.el === el) {
          aktifTezahurat = null;
          tezahuratSonrakiPlanla(false);
        }
      };
      el.onended = function () {
        if (aktifTezahurat && aktifTezahurat.el === el) {
          aktifTezahurat = null;
          tezahuratSonrakiPlanla(false);
        }
      };
      tezahuratHavuz[ad] = el;
      return el;
    } catch (e) {
      return null;
    }
  }

  function siradakiTezahuratSec() {
    var havuz = [];
    for (var i = 0; i < TEZAHURAT_MAC.length; i++) {
      if (TEZAHURAT_MAC[i] !== sonTezahuratAd) havuz.push(TEZAHURAT_MAC[i]);
    }
    var sec = havuz[Math.floor(Math.random() * havuz.length)] || TEZAHURAT_MAC[0];
    sonTezahuratAd = sec;
    return sec;
  }

  function tezahuratKlipCal(dosyaAd, zorla) {
    if (!sesAktifMi() || (!tribunAktifMi && !zorla)) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    if (aktifTezahurat && aktifTezahurat.el && !aktifTezahurat.el.paused && !aktifTezahurat.el.ended) {
      if (!zorla) return false;
      tezahuratDurdur();
    }
    var ad = dosyaAd || siradakiTezahuratSec();
    var el = tezahuratElemaniAl(ad);
    if (!el) return false;
    try {
      if (el.readyState > 0 && el.currentTime > 0) {
        try { el.currentTime = 0; } catch (_) {}
      }
      el.volume = tezahuratSesDuzeyiHesapla();
      aktifTezahurat = { ad: ad, el: el };
      var p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          if (aktifTezahurat && aktifTezahurat.el === el) {
            aktifTezahurat = null;
            tezahuratSonrakiPlanla(false);
          }
        });
      }
      return true;
    } catch (e) {
      if (aktifTezahurat && aktifTezahurat.el === el) {
        aktifTezahurat = null;
      }
      return false;
    }
  }

  function tezahuratDalgasiCal(audioCtx) {
    if (!tribunAktifMi || !sesAktifMi()) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (Math.random() < 0.35) tepkiCal('alkis', 0.55);   // kayıt tabanlı tribün: sentetik dalga yerine seyrek hafif alkış
    return;
    // (eski sentetik dalga – kullanılmıyor)
    // eslint-disable-next-line no-unreachable
    if (!audioCtx || !ambiyansDuck) return;
    var t = audioCtx.currentTime + 0.04;
    var tip = tezahuratSira % 3;
    tezahuratSira += 1;

    try {
      if (tip === 0) {
        // 1) Tribün davulu + üçlü alkış: GÜM - GÜM - şak-şak-şak
        var davulZamanlar = [0.05, 0.42];
        for (var di = 0; di < davulZamanlar.length; di++) {
          var dt = t + davulZamanlar[di];
          var osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(84, dt);
          osc.frequency.exponentialRampToValueAtTime(42, dt + 0.24);
          var dlp = audioCtx.createBiquadFilter();
          dlp.type = 'lowpass';
          dlp.frequency.setValueAtTime(260, dt);
          var dGain = audioCtx.createGain();
          dGain.gain.setValueAtTime(0.0001, dt);
          dGain.gain.linearRampToValueAtTime(0.24, dt + 0.015);
          dGain.gain.exponentialRampToValueAtTime(0.0001, dt + 0.26);
          osc.connect(dlp);
          dlp.connect(dGain);
          dGain.connect(ambiyansDuck);
          osc.start(dt);
          osc.stop(dt + 0.28);
        }
        var alkislar = [0.78, 1.08, 1.38];
        for (var ai = 0; ai < alkislar.length; ai++) {
          var at = t + alkislar[ai];
          var aSrc = audioCtx.createBufferSource();
          aSrc.buffer = pinkNoiseBufferAl(audioCtx);
          aSrc.loop = true;
          var abp = audioCtx.createBiquadFilter();
          abp.type = 'bandpass';
          abp.frequency.setValueAtTime(1550, at);
          abp.Q.setValueAtTime(1.0, at);
          var aGain = audioCtx.createGain();
          aGain.gain.setValueAtTime(0.0001, at);
          aGain.gain.linearRampToValueAtTime(0.11, at + 0.014);
          aGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
          aSrc.connect(abp);
          abp.connect(aGain);
          aGain.connect(ambiyansDuck);
          aSrc.start(at, (ai * 0.7) % 3);
          aSrc.stop(at + 0.14);
        }
      } else if (tip === 1) {
        // 2) Uzak koro: "Oooo - ley!" tribün dalgası
        var heceler = [
          { bas: 0.0, sure: 1.2, f0: 520, f1: 780, akor: [196.0, 246.94, 293.66], g: 0.16 },
          { bas: 1.25, sure: 1.3, f0: 780, f1: 480, akor: [261.63, 329.63, 392.0], g: 0.18 }
        ];
        for (var hi = 0; hi < heceler.length; hi++) {
          var h = heceler[hi];
          var ht = t + h.bas;
          var hSrc = audioCtx.createBufferSource();
          hSrc.buffer = pinkNoiseBufferAl(audioCtx);
          hSrc.loop = true;
          var hbp = audioCtx.createBiquadFilter();
          hbp.type = 'bandpass';
          hbp.Q.setValueAtTime(2.0, ht);
          hbp.frequency.setValueAtTime(h.f0, ht);
          hbp.frequency.linearRampToValueAtTime(h.f1, ht + h.sure);
          var hGain = audioCtx.createGain();
          hGain.gain.setValueAtTime(0.0001, ht);
          hGain.gain.linearRampToValueAtTime(h.g, ht + 0.25);
          hGain.gain.exponentialRampToValueAtTime(0.0001, ht + h.sure);
          hSrc.connect(hbp);
          hbp.connect(hGain);
          hGain.connect(ambiyansDuck);
          hSrc.start(ht, (hi * 1.3) % 4);
          hSrc.stop(ht + h.sure + 0.04);

          for (var ni = 0; ni < h.akor.length; ni++) {
            var ko = audioCtx.createOscillator();
            ko.type = 'triangle';
            ko.frequency.setValueAtTime(h.akor[ni] * (1 + (ni - 1) * 0.003), ht);
            var kbp = audioCtx.createBiquadFilter();
            kbp.type = 'bandpass';
            kbp.frequency.setValueAtTime(680, ht);
            kbp.Q.setValueAtTime(1.1, ht);
            var kg = audioCtx.createGain();
            kg.gain.setValueAtTime(0.0001, ht);
            kg.gain.linearRampToValueAtTime(0.032, ht + 0.28);
            kg.gain.exponentialRampToValueAtTime(0.0001, ht + h.sure);
            ko.connect(kbp);
            kbp.connect(kg);
            kg.connect(ambiyansDuck);
            ko.start(ht);
            ko.stop(ht + h.sure + 0.04);
          }
        }
      } else {
        // 3) Tribün coşku dalgası + alkış
        var cSrc = audioCtx.createBufferSource();
        cSrc.buffer = pinkNoiseBufferAl(audioCtx);
        cSrc.loop = true;
        var cbp = audioCtx.createBiquadFilter();
        cbp.type = 'bandpass';
        cbp.Q.setValueAtTime(1.4, t);
        cbp.frequency.setValueAtTime(520, t);
        cbp.frequency.linearRampToValueAtTime(880, t + 0.85);
        cbp.frequency.linearRampToValueAtTime(460, t + 2.0);
        var cGain = audioCtx.createGain();
        cGain.gain.setValueAtTime(0.0001, t);
        cGain.gain.linearRampToValueAtTime(0.20, t + 0.55);
        cGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.05);
        cSrc.connect(cbp);
        cbp.connect(cGain);
        cGain.connect(ambiyansDuck);
        cSrc.start(t, Math.random() * 2.5);
        cSrc.stop(t + 2.1);

        var alk = [0.55, 0.95, 1.3];
        for (var ci = 0; ci < alk.length; ci++) {
          var ct = t + alk[ci];
          var cs = audioCtx.createBufferSource();
          cs.buffer = pinkNoiseBufferAl(audioCtx);
          cs.loop = true;
          var f2 = audioCtx.createBiquadFilter();
          f2.type = 'bandpass';
          f2.frequency.setValueAtTime(1700, ct);
          f2.Q.setValueAtTime(1.1, ct);
          var g2 = audioCtx.createGain();
          g2.gain.setValueAtTime(0.0001, ct);
          g2.gain.linearRampToValueAtTime(0.085, ct + 0.015);
          g2.gain.exponentialRampToValueAtTime(0.0001, ct + 0.14);
          cs.connect(f2);
          f2.connect(g2);
          g2.connect(ambiyansDuck);
          cs.start(ct, ci * 0.9);
          cs.stop(ct + 0.16);
        }
      }
    } catch (e) {
      // Sessiz geç
    }
  }

  function tezahuratSonrakiPlanla(ilkMi) {
    tezahuratZamaniTemizle();
    if (!tribunAktifMi || !sesAktifMi()) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    var aralik = ilkMi ? 2500 : (4500 + Math.floor(Math.random() * 5000));   // tezahüratlar arasında uğultulu nefes
    tezahuratTimer = setTimeout(function () {
      tezahuratTimer = null;
      if (!tribunAktifMi || !sesAktifMi()) return;
      if (!tezahuratKlipCal(null, false)) {
        tezahuratDalgasiCal(ctx);
        tezahuratSonrakiPlanla(false);
      } else if (ctx && Math.random() < 0.45) {
        tezahuratDalgasiCal(ctx);
      }
    }, aralik);
  }

  function gizlilikDinleyicisiEkle() {
    if (gizlilikDinleyiciEklendi || typeof document === 'undefined') return;
    gizlilikDinleyiciEklendi = true;
    try {
      document.addEventListener('visibilitychange', function () {
        if (!ambiyansMaster || !ctx) return;
        var t = ctx.currentTime;
        if (document.hidden) {
          tezahuratDurdur();
          ambiyansMaster.gain.setTargetAtTime(0.0001, t, 0.08);
        } else if (tribunIsteniyor && tribunAktifMi && sesAktifMi()) {
          ambiyansMaster.gain.setTargetAtTime(tribunHedefSeviye, t, 0.25);
          tezahuratSonrakiPlanla(true);
        }
      });
    } catch (e) {}
  }

  function tribunKur(audioCtx) {
    if (!audioCtx || !cikisDugumu()) return false;
    if (!ambiyansMaster) {
      try {
        ambiyansMaster = audioCtx.createGain();
        ambiyansMaster.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        ambiyansMaster.connect(cikisDugumu());

        ambiyansDuck = audioCtx.createGain();
        ambiyansDuck.gain.setValueAtTime(1.0, audioCtx.currentTime);
        ambiyansDuck.connect(ambiyansMaster);

        var bedGain = audioCtx.createGain();
        bedGain.gain.setValueAtTime(0.10, audioCtx.currentTime);   // asıl uğultu: sesler/tribun_ugultu.mp3

        var lp = audioCtx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(2200, audioCtx.currentTime);

        var bp1 = audioCtx.createBiquadFilter();
        bp1.type = 'bandpass';
        bp1.frequency.setValueAtTime(380, audioCtx.currentTime);
        bp1.Q.setValueAtTime(1.2, audioCtx.currentTime);

        var bp2 = audioCtx.createBiquadFilter();
        bp2.type = 'bandpass';
        bp2.frequency.setValueAtTime(960, audioCtx.currentTime);
        bp2.Q.setValueAtTime(1.6, audioCtx.currentTime);

        ambiyansBedSrc = audioCtx.createBufferSource();
        ambiyansBedSrc.buffer = pinkNoiseBufferAl(audioCtx);
        ambiyansBedSrc.loop = true;

        ambiyansBedSrc.connect(bp1);
        ambiyansBedSrc.connect(bp2);
        bp1.connect(lp);
        bp2.connect(lp);
        lp.connect(bedGain);
        bedGain.connect(ambiyansDuck);

        ambiyansLfo1 = audioCtx.createOscillator();
        ambiyansLfo1.type = 'sine';
        ambiyansLfo1.frequency.setValueAtTime(0.14, audioCtx.currentTime);
        var lfo1Gain = audioCtx.createGain();
        lfo1Gain.gain.setValueAtTime(0.11, audioCtx.currentTime);
        ambiyansLfo1.connect(lfo1Gain);
        lfo1Gain.connect(bedGain.gain);

        ambiyansLfo2 = audioCtx.createOscillator();
        ambiyansLfo2.type = 'sine';
        ambiyansLfo2.frequency.setValueAtTime(0.19, audioCtx.currentTime);
        var lfo2Gain = audioCtx.createGain();
        lfo2Gain.gain.setValueAtTime(65, audioCtx.currentTime);
        ambiyansLfo2.connect(lfo2Gain);
        lfo2Gain.connect(bp1.frequency);

        ambiyansBedSrc.start(audioCtx.currentTime);
        ambiyansLfo1.start(audioCtx.currentTime);
        ambiyansLfo2.start(audioCtx.currentTime);
        gizlilikDinleyicisiEkle();
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  function tribunDurdurIc(istemKorunsun) {
    if (!istemKorunsun) {
      tribunIsteniyor = false;
    }
    tribunAktifMi = false;
    tezahuratDurdur();
    if (ambiyansMaster && ctx) {
      try {
        ambiyansMaster.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.18);
      } catch (e) {}
    }
  }

  function ctxAl() {
    if (!sesAktifMi()) {
      return null;
    }
    if (ctx) {
      sesKilidiniAc();
      return ctx;
    }
    try {
      var AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) {
        return null;
      }
      ctx = new AudioCtx();
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      compressor.knee.setValueAtTime(18, ctx.currentTime);
      compressor.ratio.setValueAtTime(6, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.18, ctx.currentTime);

      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(sesAktifMi() ? 0.9 : 0, ctx.currentTime);

      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      noiseBufferAl(ctx);
      unlockDinleyicisiEkle();
      sesKilidiniAc();
      return ctx;
    } catch (e) {
      ctx = null;
      return null;
    }
  }

  function cikisDugumu() {
    return compressor || (ctx ? ctx.destination : null);
  }

  function gurultuCal(audioCtx, t, sure, filtreTip, frekansBas, frekansSon, q, kazanc) {
    var src = audioCtx.createBufferSource();
    src.buffer = noiseBufferAl(audioCtx);
    src.loop = true;

    var filtre = audioCtx.createBiquadFilter();
    filtre.type = filtreTip;
    filtre.Q.setValueAtTime(q, t);
    filtre.frequency.setValueAtTime(frekansBas, t);
    if (frekansSon !== frekansBas) {
      filtre.frequency.exponentialRampToValueAtTime(Math.max(40, frekansSon), t + sure);
    }

    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(kazanc, t + Math.min(0.012, sure * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + sure);

    src.connect(filtre);
    filtre.connect(gain);
    gain.connect(cikisDugumu());

    src.start(t);
    src.stop(t + sure + 0.02);
  }

  function dudukSentezle(audioCtx, t, sure, g) {
    var anaGain = audioCtx.createGain();
    anaGain.gain.setValueAtTime(0.0001, t);
    anaGain.gain.linearRampToValueAtTime(0.24 * g, t + 0.015);
    anaGain.gain.setValueAtTime(0.22 * g, Math.max(t + 0.02, t + sure - 0.06));
    anaGain.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    anaGain.connect(cikisDugumu());

    var osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2760, t);
    osc1.frequency.linearRampToValueAtTime(2680, t + sure);

    var osc2 = audioCtx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2915, t);
    osc2.frequency.linearRampToValueAtTime(2825, t + sure);

    // Hakem düdüğü bilye titreşimi (trill LFO)
    var lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(36, t);
    var lfoFreqGain = audioCtx.createGain();
    lfoFreqGain.gain.setValueAtTime(95, t);
    lfo.connect(lfoFreqGain);
    lfoFreqGain.connect(osc1.frequency);
    lfoFreqGain.connect(osc2.frequency);

    var osc2Gain = audioCtx.createGain();
    osc2Gain.gain.setValueAtTime(0.45, t);

    osc1.connect(anaGain);
    osc2.connect(osc2Gain);
    osc2Gain.connect(anaGain);

    gurultuCal(audioCtx, t, sure, 'bandpass', 2600, 2400, 3.0, 0.08 * g);

    osc1.start(t);
    osc2.start(t);
    lfo.start(t);
    osc1.stop(t + sure + 0.02);
    osc2.stop(t + sure + 0.02);
    lfo.stop(t + sure + 0.02);
  }

  var SFX_URETICILER = {
    duduk: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 1.0);
      dudukSentezle(audioCtx, t, 0.25, g);
    },

    dudukUzun: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 1.0);
      dudukSentezle(audioCtx, t, 0.16, g * 0.92);
      dudukSentezle(audioCtx, t + 0.21, 0.56, g);
    },

    vurus: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 1.0);
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(165 * (0.9 + 0.15 * g), t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.095);

      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.50 * g, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

      osc.connect(gain);
      gain.connect(cikisDugumu());
      osc.start(t);
      osc.stop(t + 0.12);

      gurultuCal(audioCtx, t, 0.055, 'bandpass', 1150, 520, 1.2, 0.28 * g);
    },

    pas: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 0.8);
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(215, t);
      osc.frequency.exponentialRampToValueAtTime(78, t + 0.06);

      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.26 * g, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

      osc.connect(gain);
      gain.connect(cikisDugumu());
      osc.start(t);
      osc.stop(t + 0.08);

      gurultuCal(audioCtx, t, 0.035, 'bandpass', 1550, 900, 1.4, 0.14 * g);
    },

    superSut: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 1.15);
      // Güçlü alt darbe
      var sub = audioCtx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(150, t);
      sub.frequency.exponentialRampToValueAtTime(30, t + 0.16);
      var subGain = audioCtx.createGain();
      subGain.gain.setValueAtTime(0.001, t);
      subGain.gain.linearRampToValueAtTime(0.64 * g, t + 0.006);
      subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      sub.connect(subGain);
      subGain.connect(cikisDugumu());
      sub.start(t);
      sub.stop(t + 0.2);

      // Aslan Şutu güç kükremesi
      var roar = audioCtx.createOscillator();
      roar.type = 'sawtooth';
      roar.frequency.setValueAtTime(230, t);
      roar.frequency.exponentialRampToValueAtTime(58, t + 0.30);

      var lp = audioCtx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1900, t);
      lp.frequency.exponentialRampToValueAtTime(260, t + 0.32);

      var roarGain = audioCtx.createGain();
      roarGain.gain.setValueAtTime(0.001, t);
      roarGain.gain.linearRampToValueAtTime(0.24 * g, t + 0.02);
      roarGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.33);

      roar.connect(lp);
      lp.connect(roarGain);
      roarGain.connect(cikisDugumu());
      roar.start(t);
      roar.stop(t + 0.35);

      // Hava yaran şut vızıltısı
      gurultuCal(audioCtx, t, 0.32, 'bandpass', 420, 2800, 1.6, 0.34 * g);
    },

    direk: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 1.0);
      // Metal direk çınlaması (inharmonic partials)
      var frekanslar = [523, 1088, 1742, 2665];
      var sureler = [0.68, 0.56, 0.42, 0.30];
      var genlikler = [0.24, 0.18, 0.13, 0.08];

      for (var i = 0; i < frekanslar.length; i++) {
        var osc = audioCtx.createOscillator();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(frekanslar[i], t);

        var gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(genlikler[i] * g, t + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + sureler[i]);

        osc.connect(gain);
        gain.connect(cikisDugumu());
        osc.start(t);
        osc.stop(t + sureler[i] + 0.02);
      }

      gurultuCal(audioCtx, t, 0.035, 'highpass', 1800, 1800, 0.8, 0.2 * g);
    },

    ag: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 1.0);
      gurultuCal(audioCtx, t, 0.24, 'bandpass', 960, 380, 1.1, 0.25 * g);
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115, t);
      osc.frequency.exponentialRampToValueAtTime(52, t + 0.12);

      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16 * g, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

      osc.connect(gain);
      gain.connect(cikisDugumu());
      osc.start(t);
      osc.stop(t + 0.15);
    },

    kapma: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 0.9);
      gurultuCal(audioCtx, t, 0.085, 'bandpass', 720, 360, 1.0, 0.22 * g);
      var osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(85, t + 0.07);

      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2 * g, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

      osc.connect(gain);
      gain.connect(cikisDugumu());
      osc.start(t);
      osc.stop(t + 0.09);
    },

    yakala: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 0.95);
      // Eldivenle yumuşak top yakalama darbesi
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135, t);
      osc.frequency.exponentialRampToValueAtTime(58, t + 0.075);

      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.28 * g, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);

      osc.connect(gain);
      gain.connect(cikisDugumu());
      osc.start(t);
      osc.stop(t + 0.095);

      gurultuCal(audioCtx, t, 0.045, 'bandpass', 650, 380, 1.1, 0.18 * g);
    },

    tezahurat: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 1.0);
      // kayıt tabanlı tribün tepkisi: hafif → yükselen heyecan, orta → alkış, güçlü → gol kükremesi
      if (tepkiCal(g >= 1.2 ? 'gol' : (g >= 0.95 ? 'alkis' : 'heyecan'), Math.min(1.2, 0.75 + g * 0.25)) || TEPKI) return;
      var sure = 1.75;

      // Stadyum tribün uğultusu (gövde + tiz coşku filtreleri)
      var src = audioCtx.createBufferSource();
      src.buffer = pinkNoiseBufferAl(audioCtx);
      src.loop = true;

      var bp0 = audioCtx.createBiquadFilter();
      bp0.type = 'bandpass';
      bp0.frequency.setValueAtTime(280, t);
      bp0.Q.setValueAtTime(1.2, t);

      var bp1 = audioCtx.createBiquadFilter();
      bp1.type = 'bandpass';
      bp1.frequency.setValueAtTime(480, t);
      bp1.frequency.linearRampToValueAtTime(680, t + 0.55);
      bp1.frequency.linearRampToValueAtTime(430, t + sure);
      bp1.Q.setValueAtTime(1.4, t);

      var bp2 = audioCtx.createBiquadFilter();
      bp2.type = 'bandpass';
      bp2.frequency.setValueAtTime(1400, t);
      bp2.Q.setValueAtTime(1.0, t);

      var ugultuGain = audioCtx.createGain();
      ugultuGain.gain.setValueAtTime(0.0001, t);
      ugultuGain.gain.linearRampToValueAtTime(0.54 * g, t + 0.16);
      ugultuGain.gain.setValueAtTime(0.48 * g, t + 0.72);
      ugultuGain.gain.exponentialRampToValueAtTime(0.0001, t + sure);

      src.connect(bp0);
      src.connect(bp1);
      src.connect(bp2);
      bp0.connect(ugultuGain);
      bp1.connect(ugultuGain);
      bp2.connect(ugultuGain);
      ugultuGain.connect(cikisDugumu());

      src.start(t);
      src.stop(t + sure + 0.03);

      // Alkış dokusu (ritmik parlak darbeler)
      for (var k = 0; k < 7; k++) {
        var dt = t + 0.08 + k * 0.17;
        gurultuCal(audioCtx, dt, 0.10, 'highpass', 2200, 2200, 0.9, 0.19 * g);
      }
    },

    zafer: function (audioCtx, t, guc) {
      var g = gucSinirla(guc, 1.0);
      // Fanfar akor yürüyüşü: C4-E4-G4 -> G4-B4-D5 -> C5-E5-G5-C6
      var adimlar = [
        { bas: 0.00, sure: 0.20, notalar: [261.63, 329.63, 392.00] },
        { bas: 0.22, sure: 0.20, notalar: [392.00, 493.88, 587.33] },
        { bas: 0.44, sure: 1.05, notalar: [523.25, 659.25, 783.99, 1046.50] }
      ];

      for (var i = 0; i < adimlar.length; i++) {
        var adim = adimlar[i];
        var basT = t + adim.bas;
        var bitT = basT + adim.sure;

        for (var j = 0; j < adim.notalar.length; j++) {
          var frek = adim.notalar[j];
          var osc = audioCtx.createOscillator();
          osc.type = j === 0 ? 'triangle' : 'sawtooth';
          osc.frequency.setValueAtTime(frek, basT);

          var lp = audioCtx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(2800, basT);
          lp.frequency.exponentialRampToValueAtTime(1400, bitT);

          var gain = audioCtx.createGain();
          var tepe = (0.11 / Math.sqrt(adim.notalar.length)) * g;
          gain.gain.setValueAtTime(0.0001, basT);
          gain.gain.linearRampToValueAtTime(tepe, basT + 0.025);
          gain.gain.setValueAtTime(tepe * 0.85, Math.max(basT + 0.03, bitT - 0.18));
          gain.gain.exponentialRampToValueAtTime(0.0001, bitT);

          osc.connect(lp);
          lp.connect(gain);
          gain.connect(cikisDugumu());

          osc.start(basT);
          osc.stop(bitT + 0.02);
        }
      }

      SFX_URETICILER.tezahurat(audioCtx, t + 0.15, g * 0.85);
    }
  };

  function spikerElemaniAl(ad) {
    if (klipHavuzu[ad]) {
      return klipHavuzu[ad];
    }
    if (typeof global.Audio !== 'function') {
      return null;
    }
    try {
      var el = new global.Audio('sesler/' + ad + '.mp3');
      el.preload = 'auto';
      el.onerror = function () {
        if (aktifSpiker && aktifSpiker.el === el) {
          aktifSpiker = null;
          ambiyansDuckAyar(false);
        }
      };
      el.onended = function () {
        if (aktifSpiker && aktifSpiker.el === el) {
          aktifSpiker = null;
          sonSpikerBitisZamani = simdiMs();
          ambiyansDuckAyar(false);
        }
      };
      klipHavuzu[ad] = el;
      return el;
    } catch (e) {
      return null;
    }
  }

  function aktifSpikeriDurdur() {
    ambiyansDuckAyar(false);
    if (!aktifSpiker || !aktifSpiker.el) {
      aktifSpiker = null;
      return;
    }
    try {
      aktifSpiker.el.pause();
      aktifSpiker.el.currentTime = 0;
    } catch (e) {
      // Yoksay
    }
    aktifSpiker = null;
  }

  var SES = {
    sessiz: zorunluSessiz,

    /**
     * Prosedürel WebAudio SFX çalar.
     * @param {string} ad - duduk, dudukUzun, vurus, pas, superSut, direk, ag, kapma, tezahurat, zafer
     * @param {number} [guc=1] - 0.15..1.8 arası şiddet çarpanı
     */
    cal: function (ad, guc) {
      if (!sesAktifMi() || !ad) {
        return;
      }
      var uretici = SFX_URETICILER[ad];
      if (!uretici) {
        return;
      }
      var tMs = simdiMs();
      var soguma = SFX_SOGUMA[ad] || 40;
      if (sonSfxZamani[ad] && tMs - sonSfxZamani[ad] < soguma) {
        return;
      }

      var audioCtx = ctxAl();
      if (!audioCtx) {
        return;
      }
      sonSfxZamani[ad] = tMs;

      try {
        uretici(audioCtx, audioCtx.currentTime, guc);
      } catch (e) {
        // Sessiz geç
      }
    },

    /**
     * Türkçe spiker MP3'ünü (<audio> havuzu üzerinden) üst üste bindirmeden ve soğuma süresiyle çalar.
     * @param {string} ad - sesler/<ad>.mp3 dosya adı (uzantısız)
     */
    spiker: function (ad) {
      if (!sesAktifMi() || !ad || typeof ad !== 'string') {
        return false;
      }

      var temizAd = ad.replace(/\.mp3$/i, '');
      var grup = SPIKER_GRUPLAR[temizAd];
      var secilenDosya = temizAd;
      if (grup && grup.length > 0) {
        if (grup.length === 1) {
          secilenDosya = grup[0];
        } else {
          var onceki = sonGrupSecim[temizAd];
          var havuz = [];
          for (var gi = 0; gi < grup.length; gi++) {
            if (grup[gi] !== onceki) havuz.push(grup[gi]);
          }
          secilenDosya = havuz[Math.floor(Math.random() * havuz.length)] || grup[0];
        }
      }

      var tMs = simdiMs();
      var pTopMi = temizAd.indexOf('p_') === 0 && temizAd.slice(-4) === '_top';
      var pAksMi = temizAd.indexOf('p_') === 0 && temizAd.slice(-8) === '_aksiyon';
      var oncelik = pTopMi ? 1 : (pAksMi ? 2 : (SPIKER_ONCELIK[temizAd] || 2));
      var soguma = pTopMi ? 7500 : (pAksMi ? 5500 : (SPIKER_SOGUMA[temizAd] || 2000));

      if (pTopMi && sonOyuncuAnonsMs && tMs - sonOyuncuAnonsMs < 2600) {
        return false;
      }
      if (pAksMi && sonAksiyonAnonsMs && tMs - sonAksiyonAnonsMs < 3000) {
        return false;
      }

      if (sonSpikerZamani[temizAd] && tMs - sonSpikerZamani[temizAd] < soguma) {
        return false;
      }

      // Aktif konuşan spiker varsa öncelik karşılaştır; üst üste binmeyi önle
      if (aktifSpiker && aktifSpiker.el && !aktifSpiker.el.paused && !aktifSpiker.el.ended) {
        if (oncelik <= aktifSpiker.oncelik) {
          return false;
        }
        aktifSpikeriDurdur();
      } else if (oncelik <= 1 && sonSpikerBitisZamani && tMs - sonSpikerBitisZamani < 1100) {
        // Düşük öncelikli akış cümleleri arasında nefes payı bırak
        return false;
      }

      var el = spikerElemaniAl(secilenDosya);
      if (!el) {
        return false;
      }

      try {
        if (el.readyState > 0 && el.currentTime > 0) {
          try {
            el.currentTime = 0;
          } catch (resetErr) {
            // Henüz metadata yüklenmemişse yoksay
          }
        }
        el.volume = 0.95;
        aktifSpiker = { ad: secilenDosya, el: el, oncelik: oncelik };
        sonSpikerZamani[temizAd] = tMs;
        if (pTopMi) sonOyuncuAnonsMs = tMs;
        if (pAksMi) sonAksiyonAnonsMs = tMs;
        if (grup) {
          sonGrupSecim[temizAd] = secilenDosya;
        }

        var p = el.play();
        ambiyansDuckAyar(true);
        if (p && typeof p.catch === 'function') {
          p.catch(function () {
            if (aktifSpiker && aktifSpiker.el === el) {
              aktifSpiker = null;
              ambiyansDuckAyar(false);
            }
          });
        }
        return true;
      } catch (e) {
        if (aktifSpiker && aktifSpiker.el === el) {
          aktifSpiker = null;
          ambiyansDuckAyar(false);
        }
        return false;
      }
    },

    /**
     * Ses açma/kapama düğmesi için durum ayarlar (?sessiz=1 aktifken daima sessiz kalır).
     * @param {boolean} [acik] - true: ses açık, false: sessiz, boş: mevcut durumu tersine çevirir
     * @returns {boolean} Yeni ses açık durumu (true = açık, false = sessiz)
     */
    sesAyar: function (acik) {
      if (zorunluSessiz) {
        SES.sessiz = true;
        return false;
      }
      var yeniAcik = typeof acik === 'boolean' ? acik : SES.sessiz;
      SES.sessiz = !yeniAcik;

      if (SES.sessiz) {
        aktifSpikeriDurdur();
        tribunDurdurIc(true);
        if (masterGain && ctx) {
          try {
            masterGain.gain.setValueAtTime(0, ctx.currentTime);
          } catch (e) {}
        }
      } else {
        if (masterGain && ctx) {
          try {
            masterGain.gain.setValueAtTime(0.9, ctx.currentTime);
          } catch (e) {}
        }
        sesKilidiniAc();
        if (tribunIsteniyor) {
          SES.tribunBaslat();
        }
      }
      return !SES.sessiz;
    },

    tribunBaslat: function (seviye) {
      if (typeof seviye === 'number' && isFinite(seviye)) {
        tribunHedefSeviye = Math.max(0.05, Math.min(0.85, seviye));
      }
      tribunIsteniyor = true;
      if (!sesAktifMi()) {
        return false;
      }
      var audioCtx = ctxAl();
      if (!audioCtx || !tribunKur(audioCtx)) {
        return false;
      }
      tribunAktifMi = true;
      ugultuBaslat();
      try {
        ambiyansMaster.gain.setTargetAtTime(tribunHedefSeviye, audioCtx.currentTime, 0.25);
      } catch (e) {}
      if (aktifTezahurat && aktifTezahurat.el) {
        try { aktifTezahurat.el.volume = tezahuratSesDuzeyiHesapla(); } catch (e) {}
      }
      tezahuratSonrakiPlanla(true);
      return true;
    },

    tribunDurdur: function () {
      tribunDurdurIc(false);
    },

    tribunSeviye: function (seviye) {
      if (typeof seviye !== 'number' || !isFinite(seviye)) return;
      tribunHedefSeviye = Math.max(0, Math.min(0.85, seviye));
      if (aktifTezahurat && aktifTezahurat.el) {
        try { aktifTezahurat.el.volume = tezahuratSesDuzeyiHesapla(); } catch (e) {}
      }
      if (!ambiyansMaster || !ctx || !tribunAktifMi || !sesAktifMi()) return;
      try {
        ambiyansMaster.gain.setTargetAtTime(Math.max(0.0001, tribunHedefSeviye), ctx.currentTime, 0.25);
      } catch (e) {}
    },

    /** Tribün tepkisi: 'gol' | 'alkis' | 'ooo' | 'ah' | 'heyecan' */
    tribunTepki: function (tip, guc) {
      return tepkiCal(tip, guc);
    },

    tribunTezahurat: function (tip) {
      if (!sesAktifMi()) return false;
      return tezahuratKlipCal(tip === 'gol' ? TEZAHURAT_GOL : null, tip === 'gol');
    },

    tribunAktif: function () {
      return Boolean(tribunAktifMi && sesAktifMi());
    },

    /**
     * Aktif spiker sesini durdurur.
     */
    durdur: function () {
      aktifSpikeriDurdur();
      tribunDurdurIc(false);
    }
  };

  if (!zorunluSessiz) {
    unlockDinleyicisiEkle();
  }

  global.SES = SES;
})(typeof window !== 'undefined' ? window : globalThis);
