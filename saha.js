/**
 * saha.js — Gün Futbol: Stadyum, Çim Saha, Tribün Coşkusu & 3B Yaylı Kaleler
 *
 * Sensible Soccer'ın tepeden dikey bakan ikonik çim şeritli sahasını,
 * Captain Tsubasa canlı renk paleti, offscreen önbellekli tribün/reklam/pist
 * katmanları ve yay sönümlemeli 3B kalelerle 60 FPS çizer.
 *
 * Dışa aktarılan global API: `window.SAHA`
 */
(function (global) {
  'use strict';

  var W = 1320;
  var H = 2040;
  var SOL = 70;
  var SAG = 1250;
  var UST = 110;
  var ALT = 1930;
  var KALE_W = 230;
  var KALE_DERIN = 58;
  var KALE_YUKSEKLIK = 58;
  var DIREK_R = 7;

  var EN = SAG - SOL;            // 1180
  var BOY = ALT - UST;           // 1820
  var ORTA_X = (SOL + SAG) / 2;  // 660
  var ORTA_Y = (UST + ALT) / 2;  // 1020
  var KALE_SOL = ORTA_X - KALE_W / 2; // 545
  var KALE_SAG = ORTA_X + KALE_W / 2; // 775

  // Ceza & kale sahası ölçüleri (1180x1820 geniş 11v11 saha oranlarına göre)
  var CEZA_W = 540;
  var CEZA_DERIN = 220;
  var CEZA_SOL = ORTA_X - CEZA_W / 2; // 390
  var CEZA_SAG = ORTA_X + CEZA_W / 2; // 930
  var KALE_SAHASI_W = 340;
  var KALE_SAHASI_DERIN = 80;
  var KALE_SAHASI_SOL = ORTA_X - KALE_SAHASI_W / 2; // 490
  var KALE_SAHASI_SAG = ORTA_X + KALE_SAHASI_W / 2; // 830
  var PENALTI_UZAKLIK = 152;
  var ORTA_DAIRE_R = 122;

  var PAD_X = 600;
  var PAD_Y = 220;

  // Kulüp ve Tsubasa-tarzı canlı stadyum renk paleti
  var RENK = {
    gsBordo: '#D9082E',
    gsSari: '#FFC400',
    fbLacivert: '#0047AB',
    fbSari: '#FFF01F',
    cimAcik: '#30B546',
    cimKoyu: '#259A3A',
    cizgi: '#F7FFF8',
    cizgiGolge: 'rgba(8, 40, 16, 0.34)',
    pist: '#192233',
    pistCizgi: 'rgba(255, 255, 255, 0.16)',
    tribunTaban: '#101520',
    basamak1: '#1E2738',
    basamak2: '#273247',
    basamak3: '#313F58',
    murekkep: '#0D131A'
  };

  // Ağ yay düğüm sayısı (0 ve AG_DUGUM-1 direklere sabitlidir)
  var AG_DUGUM = 15;

  // Her kare sıfır bellek ayırması için sabit tablolar ve tamponlar
  var RAKIP_TEMALAR = {
    FB: {
      kod: 'FB',
      ana: '#0047AB',
      ikinci: '#FFF01F',
      tribunUst: 'SARI KANARYA TRİBÜNÜ',
      tribunSolUst: 'KADIKÖY DEPLASMAN',
      tribunSagUst: 'FENERBAHÇE 1907',
      panolar: [
        { yazi: 'FENERBAHÇE 1907', bg: '#0047AB', fg: '#FFF01F' },
        { yazi: 'SARI KANARYA', bg: '#FFF01F', fg: '#0047AB' },
        { yazi: 'KADIKÖY DERBİ', bg: '#0047AB', fg: '#FFFFFF' },
        { yazi: 'ŞAMPİYONLUK', bg: '#FFF01F', fg: '#0047AB' }
      ]
    },
    BJK: {
      kod: 'BJK',
      ana: '#161618',
      ikinci: '#F4F4F5',
      tribunUst: 'KARA KARTAL TRİBÜNÜ',
      tribunSolUst: 'DOLMABAHÇE DEPLASMAN',
      tribunSagUst: 'BEŞİKTAŞ 1903',
      panolar: [
        { yazi: 'BEŞİKTAŞ 1903', bg: '#141414', fg: '#FFFFFF' },
        { yazi: 'KARA KARTAL', bg: '#FFFFFF', fg: '#141414' },
        { yazi: 'ÇARŞI TRİBÜNÜ', bg: '#141414', fg: '#E2E8F0' },
        { yazi: 'ŞAMPİYONLUK', bg: '#FFFFFF', fg: '#141414' }
      ]
    },
    TS: {
      kod: 'TS',
      ana: '#7C1332',
      ikinci: '#00A8E8',
      tribunUst: 'KARADENİZ FIRTINASI TRİBÜNÜ',
      tribunSolUst: 'TRABZON DEPLASMAN',
      tribunSagUst: 'TRABZONSPOR 1967',
      panolar: [
        { yazi: 'TRABZONSPOR 1967', bg: '#7C1332', fg: '#00A8E8' },
        { yazi: 'BORDO MAVİ', bg: '#00A8E8', fg: '#7C1332' },
        { yazi: 'FIRTINA DERBİ', bg: '#7C1332', fg: '#FFFFFF' },
        { yazi: 'ŞAMPİYONLUK', bg: '#00A8E8', fg: '#4B0A1F' }
      ]
    }
  };
  var aktifRakip = 'FB';

  var GRUP_RENKLER = [
    RENK.fbLacivert,
    RENK.fbSari,
    RENK.gsBordo,
    RENK.gsSari,
    '#F1F5F9',
    '#1E293B'
  ];

  var KOSE_BAYRAKLARI = [
    { x: SOL, y: UST, r1: RENK.fbLacivert, r2: RENK.fbSari, faz: 0.0, away: true, inv: false },
    { x: SAG, y: UST, r1: RENK.fbSari, r2: RENK.fbLacivert, faz: 1.4, away: true, inv: true },
    { x: SOL, y: ALT, r1: RENK.gsBordo, r2: RENK.gsSari, faz: 2.3 },
    { x: SAG, y: ALT, r1: RENK.gsSari, r2: RENK.gsBordo, faz: 3.7 }
  ];

  var TRIBUN_BAYRAKLARI = [
    { x: -110, y: 270, r1: RENK.fbLacivert, r2: RENK.fbSari, dir: 1, faz: 0.2, away: true, inv: false },
    { x: -145, y: 620, r1: RENK.fbSari, r2: RENK.fbLacivert, dir: 1, faz: 1.3, away: true, inv: true },
    { x: -120, y: 980, r1: RENK.gsBordo, r2: RENK.gsSari, dir: 1, faz: 2.1 },
    { x: -155, y: 1360, r1: RENK.gsSari, r2: RENK.gsBordo, dir: 1, faz: 3.4 },
    { x: -115, y: 1740, r1: RENK.gsBordo, r2: RENK.gsSari, dir: 1, faz: 4.5 },
    { x: W + 110, y: 270, r1: RENK.fbLacivert, r2: RENK.fbSari, dir: -1, faz: 0.8, away: true, inv: false },
    { x: W + 145, y: 620, r1: RENK.fbSari, r2: RENK.fbLacivert, dir: -1, faz: 1.9, away: true, inv: true },
    { x: W + 115, y: 980, r1: RENK.fbLacivert, r2: RENK.fbSari, dir: -1, faz: 2.7, away: true, inv: false },
    { x: W + 150, y: 1360, r1: RENK.gsBordo, r2: RENK.gsSari, dir: -1, faz: 3.9 },
    { x: W + 110, y: 1740, r1: RENK.gsSari, r2: RENK.gsBordo, dir: -1, faz: 5.1 },
    { x: ORTA_X - 310, y: -58, r1: RENK.fbLacivert, r2: RENK.fbSari, dir: 1, faz: 0.5, away: true, inv: false },
    { x: ORTA_X + 310, y: -58, r1: RENK.fbSari, r2: RENK.fbLacivert, dir: -1, faz: 2.4, away: true, inv: true },
    { x: ORTA_X - 310, y: H + 58, r1: RENK.gsBordo, r2: RENK.gsSari, dir: 1, faz: 1.6 },
    { x: ORTA_X + 310, y: H + 58, r1: RENK.gsSari, r2: RENK.gsBordo, dir: -1, faz: 4.2 }
  ];

  var FLAS_NOKTALAR = [];

  var bufOnX = new Float32Array(AG_DUGUM);
  var bufArkaUstX = new Float32Array(AG_DUGUM);
  var bufArkaUstY = new Float32Array(AG_DUGUM);
  var bufArkaAltX = new Float32Array(AG_DUGUM);
  var bufArkaAltY = new Float32Array(AG_DUGUM);
  var bufArkaOrtaY = new Float32Array(AG_DUGUM);

  // İç durum
  var onbellekCanvas = null;
  var zaman = 0;
  var seyirciGruplari = null; // 6 forma rengi grubu -> hızlı toplu çizim
  var seyirciTum = [];
  var coskuSuresi = 0;
  var coskuTakim = 'ikisi';
  var ustAg = null;
  var altAg = null;

  // Belirlenimci PRNG (çim greni ve tribün dağılımı her açılışta tutarlı olsun)
  function prngOlustur(tohum) {
    var s = tohum >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function agOlustur(ustMu) {
    var dugumler = [];
    for (var i = 0; i < AG_DUGUM; i++) {
      dugumler.push({ pos: 0, vel: 0 });
    }
    return { ustMu: ustMu, dugumler: dugumler };
  }

  function agSifirla(ag) {
    if (!ag) return;
    for (var i = 0; i < ag.dugumler.length; i++) {
      ag.dugumler[i].pos = 0;
      ag.dugumler[i].vel = 0;
    }
  }

  /**
   * Kale ağlarını yay + komşu düğüm bağlantılı sönümlü fizikle günceller.
   */
  function agGuncelle(ag, dt) {
    var d = ag.dugumler;
    var n = d.length;
    var kYay = 170;
    var kKomsu = 96;
    var sonum = 5.4;

    // 1/120 sn alt adımlarla yüksek hızda kare atlamasına karşı kararlı kalır
    var kalan = dt;
    while (kalan > 0) {
      var adim = kalan > 0.0083 ? 0.0083 : kalan;
      kalan -= adim;

      for (var i = 1; i < n - 1; i++) {
        var komsuFark = d[i - 1].pos - 2 * d[i].pos + d[i + 1].pos;
        var ivme = -kYay * d[i].pos + kKomsu * komsuFark - sonum * d[i].vel;
        d[i].vel += ivme * adim;
      }
      for (var j = 1; j < n - 1; j++) {
        d[j].pos += d[j].vel * adim;
        if (d[j].pos > 34) d[j].pos = 34;
        if (d[j].pos < -6) d[j].pos = -6;
      }
    }
  }

  // =========================================================================
  // OFFSCREEN STADYUM & ZEMİN ÖNBELLEĞİ
  // =========================================================================

  function cimDeseniOlustur(ctx) {
    var pCanvas = document.createElement('canvas');
    pCanvas.width = 160;
    pCanvas.height = 160;
    var pctx = pCanvas.getContext('2d');
    var rnd = prngOlustur(611905);

    for (var i = 0; i < 900; i++) {
      var x = Math.floor(rnd() * 160);
      var y = Math.floor(rnd() * 160);
      var acik = rnd() > 0.52;
      pctx.fillStyle = acik ? 'rgba(255, 255, 210, 0.045)' : 'rgba(6, 36, 12, 0.065)';
      pctx.fillRect(x, y, 2, rnd() > 0.6 ? 2 : 1);
    }
    return ctx.createPattern(pCanvas, 'repeat');
  }

  function cizCimZemin(ctx) {
    var cimSol = 56;
    var cimSag = W - 56;
    var cimUst = 53;
    var cimAlt = H - 53;
    var cimW = cimSag - cimSol;

    // 26 yatay Sensible Soccer biçme şeridi (her biri tam 70 px -> ORTA_Y çizgisine tam oturur)
    var seritH = BOY / 26; // 70

    // Üst kale arkası çim kuşağı
    ctx.fillStyle = RENK.cimKoyu;
    ctx.fillRect(cimSol, cimUst, cimW, UST - cimUst);

    for (var i = 0; i < 26; i++) {
      var sy = UST + i * seritH;
      ctx.fillStyle = i % 2 === 0 ? RENK.cimAcik : RENK.cimKoyu;
      ctx.fillRect(cimSol, sy, cimW, seritH + 0.5);
    }

    // Alt kale arkası çim kuşağı (şerit 20)
    ctx.fillStyle = RENK.cimAcik;
    ctx.fillRect(cimSol, ALT, cimW, cimAlt - ALT);

    // Kale önü ve orta nokta hafif yıpranmış çim tonu
    var golAsinmaY = [UST + 16, ALT - 16];
    for (var g = 0; g < golAsinmaY.length; g++) {
      var grad = ctx.createRadialGradient(ORTA_X, golAsinmaY[g], 10, ORTA_X, golAsinmaY[g], 125);
      grad.addColorStop(0, 'rgba(130, 145, 52, 0.16)');
      grad.addColorStop(1, 'rgba(130, 145, 52, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(ORTA_X - 130, golAsinmaY[g] - 75, 260, 150);
    }

    // Hafif çim doku greni
    var gren = cimDeseniOlustur(ctx);
    if (gren) {
      ctx.fillStyle = gren;
      ctx.fillRect(cimSol, cimUst, cimW, cimAlt - cimUst);
    }

    // Stadyum ışığı altında hafif merkez parlaklık vinyeti
    var sahaIsik = ctx.createRadialGradient(ORTA_X, ORTA_Y, 120, ORTA_X, ORTA_Y, BOY * 0.65);
    sahaIsik.addColorStop(0, 'rgba(255, 255, 232, 0.065)');
    sahaIsik.addColorStop(0.62, 'rgba(255, 255, 232, 0)');
    sahaIsik.addColorStop(1, 'rgba(5, 18, 12, 0.13)');
    ctx.fillStyle = sahaIsik;
    ctx.fillRect(cimSol, cimUst, cimW, cimAlt - cimUst);

    // Çim apron çerçeve çizgisi
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cimSol, cimUst, cimW, cimAlt - cimUst);

    // Orta daire çimine zarif, topu gizlemeyen "61" kabartma amblemi
    ctx.save();
    ctx.globalAlpha = 0.075;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 84px "Arial Black", "Segoe UI", sans-serif';
    ctx.fillStyle = '#FFF7C2';
    ctx.fillText('61', ORTA_X, ORTA_Y + 2);
    ctx.restore();
  }

  function cizYariSahaCizgileri(ctx, ustMu) {
    var cizgiY = ustMu ? UST : ALT;
    var yon = ustMu ? 1 : -1;

    // Ceza sahası
    var cezaY = ustMu ? cizgiY : cizgiY - CEZA_DERIN;
    ctx.strokeRect(CEZA_SOL, cezaY, CEZA_W, CEZA_DERIN);

    // Kale sahası (6 pas)
    var kaleSahasiY = ustMu ? cizgiY : cizgiY - KALE_SAHASI_DERIN;
    ctx.strokeRect(KALE_SAHASI_SOL, kaleSahasiY, KALE_SAHASI_W, KALE_SAHASI_DERIN);

    // Penaltı noktası
    var penY = cizgiY + yon * PENALTI_UZAKLIK;
    ctx.beginPath();
    ctx.arc(ORTA_X, penY, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Ceza yayı (penaltı noktasından r=110, ceza sahası dışına taşan kısım)
    var aci = Math.asin((CEZA_DERIN - PENALTI_UZAKLIK) / ORTA_DAIRE_R);
    ctx.beginPath();
    if (ustMu) {
      ctx.arc(ORTA_X, penY, ORTA_DAIRE_R, aci, Math.PI - aci);
    } else {
      ctx.arc(ORTA_X, penY, ORTA_DAIRE_R, Math.PI + aci, Math.PI * 2 - aci);
    }
    ctx.stroke();
  }

  function cizSahaCizgileri(ctx) {
    var gecisler = [
      { renk: RENK.cizgiGolge, kalinlik: 7 },
      { renk: RENK.cizgi, kalinlik: 4 }
    ];

    for (var p = 0; p < gecisler.length; p++) {
      ctx.strokeStyle = gecisler[p].renk;
      ctx.fillStyle = gecisler[p].renk;
      ctx.lineWidth = gecisler[p].kalinlik;
      ctx.lineJoin = 'miter';

      // Taç & kale çizgileri
      ctx.strokeRect(SOL, UST, EN, BOY);

      // Orta saha çizgisi
      ctx.beginPath();
      ctx.moveTo(SOL, ORTA_Y);
      ctx.lineTo(SAG, ORTA_Y);
      ctx.stroke();

      // Orta saha yuvarlağı & başlama noktası
      ctx.beginPath();
      ctx.arc(ORTA_X, ORTA_Y, ORTA_DAIRE_R, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ORTA_X, ORTA_Y, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Üst ve alt ceza sahaları
      cizYariSahaCizgileri(ctx, true);
      cizYariSahaCizgileri(ctx, false);

      // 4 köşe yayı
      var koseler = [
        { x: SOL, y: UST, a1: 0, a2: Math.PI * 0.5 },
        { x: SAG, y: UST, a1: Math.PI * 0.5, a2: Math.PI },
        { x: SAG, y: ALT, a1: Math.PI, a2: Math.PI * 1.5 },
        { x: SOL, y: ALT, a1: Math.PI * 1.5, a2: Math.PI * 2 }
      ];
      for (var k = 0; k < koseler.length; k++) {
        ctx.beginPath();
        ctx.arc(koseler[k].x, koseler[k].y, 26, koseler[k].a1, koseler[k].a2);
        ctx.stroke();
      }
    }

    // Köşe korner atışı mesafe çizgileri (çizgi dışı ince beyaz işaretler)
    ctx.fillStyle = 'rgba(247, 255, 248, 0.85)';
    ctx.fillRect(SOL - 8, UST + 90, 6, 3);
    ctx.fillRect(SAG + 2, UST + 90, 6, 3);
    ctx.fillRect(SOL - 8, ALT - 93, 6, 3);
    ctx.fillRect(SAG + 2, ALT - 93, 6, 3);
  }

  function cizDisPist(ctx) {
    // Reklam panolarının içi ile çim arası tartan pist & saha çevresi
    ctx.fillStyle = RENK.pist;
    ctx.fillRect(38, 38, W - 76, H - 76);

    // Çift kulvarlı atletizm / tartan pist çizgisi
    ctx.strokeStyle = RENK.pistCizgi;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(44, 43, W - 88, H - 86);
    ctx.strokeRect(50, 48, W - 100, H - 96);

    // Sol taç kenarında detaylı iki takım yedek kulübesi
    var kulubeler = [
      { y: ORTA_Y - 190, renk1: RENK.fbLacivert, renk2: RENK.fbSari, ad: 'FB' },
      { y: ORTA_Y + 110, renk1: RENK.gsBordo, renk2: RENK.gsSari, ad: 'GS' }
    ];
    for (var i = 0; i < kulubeler.length; i++) {
      var kl = kulubeler[i];
      // Teknik alan tebeşir çizgisi
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(58, kl.y - 6, 10, 92);

      // Çatı gölgesi + ana gövde
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(39, kl.y + 3, 17, 82);
      ctx.fillStyle = RENK.murekkep;
      ctx.fillRect(37, kl.y, 17, 80);
      ctx.fillStyle = kl.renk1;
      ctx.fillRect(39, kl.y + 2, 13, 76);
      ctx.fillStyle = kl.renk2;
      ctx.fillRect(39, kl.y + 2, 4, 76);

      // Koltuk bölmeleri ve minik yedek oyuncu siluetleri
      for (var s = 8; s < 72; s += 13) {
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(39, kl.y + s, 13, 1.5);
        ctx.fillStyle = kl.renk2;
        ctx.fillRect(45, kl.y + s + 3, 5, 6);
      }
    }

    // Sağ taç kenarı dördüncü hakem & saha kenarı yayın kamerası
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(W - 51, ORTA_Y - 25, 11, 50);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(W - 51, ORTA_Y - 25, 11, 50);

    // Kale arkası fotoğrafçı / yayın tripodları
    var kameralar = [ORTA_X - 310, ORTA_X - 190, ORTA_X + 190, ORTA_X + 310];
    for (var k = 0; k < kameralar.length; k++) {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(kameralar[k] - 3, 44, 6, 5);
      ctx.fillRect(kameralar[k] - 3, H - 49, 6, 5);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(kameralar[k] - 1, 45, 2, 2);
      ctx.fillRect(kameralar[k] - 1, H - 48, 2, 2);
    }
  }

  function cizTribunPankarti(ctx, x, y, w, h, dikeySagSol, yazi, zemin, yaziRenk) {
    ctx.save();
    // Dış gölge + metalik çerçeve
    ctx.fillStyle = 'rgba(4, 7, 14, 0.85)';
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);

    var bgGrad = dikeySagSol !== 0
      ? ctx.createLinearGradient(x, y, x, y + h)
      : ctx.createLinearGradient(x, y, x + w, y);
    bgGrad.addColorStop(0, zemin);
    bgGrad.addColorStop(0.5, zemin);
    bgGrad.addColorStop(1, '#0c111d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    // Kumaş / LED parlama şeridi
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    if (dikeySagSol !== 0) {
      ctx.fillRect(x + 2, y + 4, 3, h - 8);
    } else {
      ctx.fillRect(x + 4, y + 2, w - 8, 3);
    }

    ctx.strokeStyle = yaziRenk;
    ctx.lineWidth = 2.2;
    ctx.strokeRect(x, y, w, h);

    ctx.translate(x + w * 0.5, y + h * 0.5);
    if (dikeySagSol !== 0) {
      ctx.rotate(dikeySagSol * Math.PI * 0.5);
    }
    ctx.font = '900 11px "Arial Black", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = 'rgba(6, 10, 18, 0.85)';
    ctx.strokeText(yazi, 0, 0.5);
    ctx.fillStyle = yaziRenk;
    ctx.fillText(yazi, 0, 0.5);
    ctx.restore();
  }

  function cizUstTribunSeyircisi(ctx, cx, cy, formaRenk, atkiRenk, atkiVar, sacRenk, capVar) {
    // Gölge
    ctx.fillStyle = 'rgba(5, 8, 15, 0.42)';
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy + 2.5, 6.2, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Omuz / forma (yuvarlak silüet)
    ctx.fillStyle = formaRenk;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.8, 5.8, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Atkı detayı
    if (atkiVar) {
      ctx.fillStyle = atkiRenk;
      ctx.fillRect(cx - 4.4, cy - 1.5, 8.8, 2.1);
    }

    // Kafa + saç / şapka
    ctx.fillStyle = '#E8BA92';
    ctx.beginPath();
    ctx.arc(cx, cy - 2.3, 2.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = capVar ? formaRenk : sacRenk;
    ctx.beginPath();
    ctx.arc(cx, cy - 2.9, 2.7, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  function cizGenisTribunler(ctx) {
    var totalW = W + PAD_X * 2;
    var totalH = H + PAD_Y * 2;

    // 1. Gece maçı stadyum kabuğu & derinlik gradyanı
    ctx.fillStyle = '#090D16';
    ctx.fillRect(-PAD_X, -PAD_Y, totalW, totalH);

    // 2. Üst tribün basamakları + çatı gölgesi + yuvarlatılmış taraftarlar
    var rnd = prngOlustur(19052026);
    var rowIdx, bx, by;
    var ustSacRenkler = ['#161210', '#2d1e13', '#493320', '#70502f'];

    for (rowIdx = 0; rowIdx < 16; rowIdx++) {
      var distOut = 218 + rowIdx * 24;
      var xL = -distOut;
      var xR = W + distOut - 24;
      var parlaklik = Math.max(0.55, 1 - rowIdx * 0.03);
      var stepColor = rowIdx % 2 === 0
        ? 'rgba(30, 42, 64, ' + parlaklik.toFixed(2) + ')'
        : 'rgba(38, 52, 78, ' + parlaklik.toFixed(2) + ')';

      ctx.fillStyle = '#101622';
      ctx.fillRect(xL, -PAD_Y, 24, totalH);
      ctx.fillRect(xR, -PAD_Y, 24, totalH);
      ctx.fillStyle = stepColor;
      ctx.fillRect(xL, -PAD_Y, 24, totalH);
      ctx.fillRect(xR, -PAD_Y, 24, totalH);

      ctx.fillStyle = 'rgba(0,0,0,0.52)';
      ctx.fillRect(xL + 22, -PAD_Y, 2, totalH);
      ctx.fillRect(xR, -PAD_Y, 2, totalH);

      // Önceden pişmiş üst tribün taraftar silüetleri
      if (rowIdx < 12) {
        for (by = -PAD_Y + 14; by < H + PAD_Y - 14; by += 18) {
          var gsBolgeL = by >= ORTA_Y - 260;
          var gsBolgeR = by >= ORTA_Y - 40;
          var rL = rnd();
          var colL = rL < 0.14 ? '#E2E8F0' : (gsBolgeL ? (rL < 0.58 ? RENK.gsBordo : RENK.gsSari) : (rL < 0.58 ? RENK.fbLacivert : RENK.fbSari));
          var atkiL = gsBolgeL ? RENK.gsSari : RENK.fbSari;
          cizUstTribunSeyircisi(ctx, xL + 11, by + 3, colL, atkiL, rL > 0.55, ustSacRenkler[Math.floor(rnd() * 4)], rL > 0.84);

          var rR = rnd();
          var colR = rR < 0.14 ? '#E2E8F0' : (gsBolgeR ? (rR < 0.58 ? RENK.gsBordo : RENK.gsSari) : (rR < 0.58 ? RENK.fbLacivert : RENK.fbSari));
          var atkiR = gsBolgeR ? RENK.gsSari : RENK.fbSari;
          cizUstTribunSeyircisi(ctx, xR + 13, by + 3, colR, atkiR, rR > 0.55, ustSacRenkler[Math.floor(rnd() * 4)], rR > 0.84);
        }
      }
    }

    // Üst & Alt kale arkası üst tribün geniş katmanı
    for (rowIdx = 0; rowIdx < 5; rowIdx++) {
      var yT = -134 - rowIdx * 20;
      var yB = H + 114 + rowIdx * 20;
      ctx.fillStyle = rowIdx % 2 === 0 ? '#182132' : '#202B41';
      ctx.fillRect(-PAD_X, yT, totalW, 20);
      ctx.fillRect(-PAD_X, yB, totalW, 20);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-PAD_X, yT + 18, totalW, 2);
      ctx.fillRect(-PAD_X, yB, totalW, 2);
      for (bx = -220; bx < W + 220; bx += 22) {
        var rT = rnd();
        var colT = rT < 0.14 ? '#E2E8F0' : (rT < 0.56 ? RENK.fbLacivert : RENK.fbSari);
        cizUstTribunSeyircisi(ctx, bx + 5, yT + 10, colT, RENK.fbSari, rT > 0.5, ustSacRenkler[Math.floor(rnd() * 4)], rT > 0.85);

        var rB = rnd();
        var colB = rB < 0.14 ? '#E2E8F0' : (rB < 0.56 ? RENK.gsBordo : RENK.gsSari);
        cizUstTribunSeyircisi(ctx, bx + 5, yB + 10, colB, RENK.gsSari, rB > 0.5, ustSacRenkler[Math.floor(rnd() * 4)], rB > 0.85);
      }
    }

    // Dış çatı gölge vinyeti (stadyum derinliği verir)
    var roofGradL = ctx.createLinearGradient(-PAD_X, 0, -240, 0);
    roofGradL.addColorStop(0, 'rgba(4, 6, 12, 0.72)');
    roofGradL.addColorStop(1, 'rgba(4, 6, 12, 0)');
    ctx.fillStyle = roofGradL;
    ctx.fillRect(-PAD_X, -PAD_Y, PAD_X - 230, totalH);

    var roofGradR = ctx.createLinearGradient(W + 240, 0, W + PAD_X, 0);
    roofGradR.addColorStop(0, 'rgba(4, 6, 12, 0)');
    roofGradR.addColorStop(1, 'rgba(4, 6, 12, 0.72)');
    ctx.fillStyle = roofGradR;
    ctx.fillRect(W + 230, -PAD_Y, PAD_X - 230, totalH);

    // 3. Stadyum VIP Loca / Asma Balkon Katı (metalik raylar + sıcak amber cam localar)
    ctx.fillStyle = '#0A0F18';
    ctx.fillRect(-218, -116, W + 436, 18);
    ctx.fillRect(-218, H + 98, W + 436, 18);
    ctx.fillRect(-218, -116, 18, H + 232);
    ctx.fillRect(W + 200, -116, 18, H + 232);

    // Sıcak aydınlatmalı VIP loca pencereleri + cam çerçeveler
    for (by = -50; by < H + 50; by += 46) {
      var locaGradL = ctx.createLinearGradient(-215, by, -203, by);
      locaGradL.addColorStop(0, 'rgba(255, 224, 120, 0.65)');
      locaGradL.addColorStop(1, 'rgba(255, 168, 45, 0.25)');
      ctx.fillStyle = locaGradL;
      ctx.fillRect(-215, by, 11, 34);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-215, by, 11, 34);

      var locaGradR = ctx.createLinearGradient(W + 204, by, W + 215, by);
      locaGradR.addColorStop(0, 'rgba(255, 168, 45, 0.25)');
      locaGradR.addColorStop(1, 'rgba(255, 224, 120, 0.65)');
      ctx.fillStyle = locaGradR;
      ctx.fillRect(W + 204, by, 11, 34);
      ctx.strokeRect(W + 204, by, 11, 34);
    }
    for (bx = 40; bx < W - 40; bx += 64) {
      ctx.fillStyle = 'rgba(255, 214, 110, 0.45)';
      ctx.fillRect(bx, -112, 46, 10);
      ctx.fillRect(bx, H + 102, 46, 10);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx, -112, 46, 10);
      ctx.strokeRect(bx, H + 102, 46, 10);
    }

    // 4. Geniş Alt Tribün (6 kademeli beton + koltuk blokları + giriş tünelleri)
    var altBasRenk = ['#1A2334', '#212D42', '#28364F', '#2F405C', '#374B6B', '#40567B'];
    for (var s = 0; s < 6; s++) {
      var dIn = s * 29;
      ctx.fillStyle = altBasRenk[5 - s];
      ctx.fillRect(-29 + -dIn, 32, 30, H - 64);
      ctx.fillRect(W + dIn, 32, 30, H - 64);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
      ctx.fillRect(-29 + -dIn, 32, 2.5, H - 64);
      ctx.fillRect(W + dIn + 27.5, 32, 2.5, H - 64);
    }

    for (var sb = 0; sb < 4; sb++) {
      var dY = sb * 22;
      ctx.fillStyle = altBasRenk[3 - sb];
      ctx.fillRect(32, 10 - dY, W - 64, 22);
      ctx.fillRect(32, H - 32 + dY, W - 64, 22);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
      ctx.fillRect(32, 10 - dY, W - 64, 2);
      ctx.fillRect(32, H - 12 + dY, W - 64, 2);
    }

    // Sol & Sağ Alt Tribün Koltuk Blokları + Merdivenler & Stadyum Giriş Tünelleri
    for (var my = 56; my < H - 70; my += 152) {
      var solGs = my >= ORTA_Y - 260;
      var sagGs = my >= ORTA_Y - 40;
      for (var kIdx = 0; kIdx < 6; kIdx++) {
        var bxSol = -20 - kIdx * 29;
        var bxSag = W + 11 + kIdx * 29;
        var sColL = (kIdx % 2 === 0) ? (solGs ? RENK.gsBordo : RENK.fbLacivert) : (solGs ? RENK.gsSari : RENK.fbSari);
        var sColR = (kIdx % 2 === 0) ? (sagGs ? RENK.gsBordo : RENK.fbLacivert) : (sagGs ? RENK.gsSari : RENK.fbSari);
        ctx.fillStyle = sColL;
        ctx.fillRect(bxSol, my, 6.5, 118);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(bxSol + 5, my, 1.5, 118);
        ctx.fillStyle = sColR;
        ctx.fillRect(bxSag, my, 6.5, 118);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(bxSag, my, 1.5, 118);
      }

      // Yatay sarı güvenlik basamaklı merdiven + metal trabzan + karanlık tünel kapısı
      var merY = my + 123;
      if (merY < H - 60) {
        ctx.fillStyle = '#121824';
        ctx.fillRect(-195, merY, 192, 20);
        ctx.fillRect(W + 3, merY, 192, 20);

        // Giriş tüneli (arkada koyu kapı + hafif iç ışık)
        ctx.fillStyle = '#06080D';
        ctx.fillRect(-195, merY + 2, 34, 16);
        ctx.fillRect(W + 161, merY + 2, 34, 16);
        ctx.fillStyle = 'rgba(255, 220, 130, 0.22)';
        ctx.fillRect(-193, merY + 5, 5, 10);
        ctx.fillRect(W + 188, merY + 5, 5, 10);

        // Sarı basamak şeritleri ve orta metal korkuluk
        ctx.fillStyle = 'rgba(255, 224, 96, 0.44)';
        for (var stX = 12; stX < 156; stX += 20) {
          ctx.fillRect(-stX, merY + 3, 4, 14);
          ctx.fillRect(W + stX - 4, merY + 3, 4, 14);
        }
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(-156, merY + 9, 148, 2);
        ctx.fillRect(W + 8, merY + 9, 148, 2);
      }
    }

    // Üst & Alt Kale Arkası Koltuk Blokları + Merdiven & Giriş Tünelleri
    for (var mx = 56; mx < W - 70; mx += 148) {
      for (var rIdx = 0; rIdx < 4; rIdx++) {
        ctx.fillStyle = (rIdx % 2 === 0) ? RENK.fbLacivert : RENK.fbSari;
        ctx.fillRect(mx, 13 - rIdx * 22, 114, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(mx, 17 - rIdx * 22, 114, 1.5);

        ctx.fillStyle = (rIdx % 2 === 0) ? RENK.gsBordo : RENK.gsSari;
        ctx.fillRect(mx, H - 19 + rIdx * 22, 114, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(mx, H - 19 + rIdx * 22, 114, 1.5);
      }
      var merX = mx + 120;
      if (merX < W - 56) {
        ctx.fillStyle = '#121824';
        ctx.fillRect(merX, -62, 20, 92);
        ctx.fillRect(merX, H - 30, 20, 92);

        // Giriş tüneli
        ctx.fillStyle = '#06080D';
        ctx.fillRect(merX + 2, -62, 16, 22);
        ctx.fillRect(merX + 2, H + 40, 16, 22);

        ctx.fillStyle = 'rgba(255, 224, 96, 0.44)';
        for (var stY = 6; stY < 66; stY += 15) {
          ctx.fillRect(merX + 3, 28 - stY, 14, 2.5);
          ctx.fillRect(merX + 3, H - 28 + stY, 14, 2.5);
        }
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(merX + 9, -38, 2, 66);
        ctx.fillRect(merX + 9, H - 28, 2, 66);
      }
    }

    // 5. Dev Balkon Tifo & Pankart Şeritleri
    var tema = RAKIP_TEMALAR[aktifRakip] || RAKIP_TEMALAR.FB;
    cizTribunPankarti(ctx, -206, 240, 22, 260, -1, tema.tribunSolUst, RENK.fbLacivert, RENK.fbSari);
    cizTribunPankarti(ctx, -206, ORTA_Y - 130, 22, 260, -1, 'GÜN · ASLAN YUVASI', RENK.gsBordo, RENK.gsSari);
    cizTribunPankarti(ctx, -206, H - 540, 22, 260, -1, 'GALATASARAY 1905', RENK.gsSari, RENK.gsBordo);

    cizTribunPankarti(ctx, W + 184, 250, 22, 260, 1, tema.tribunSagUst, RENK.fbSari, RENK.fbLacivert);
    cizTribunPankarti(ctx, W + 184, ORTA_Y - 130, 22, 260, 1, 'SÜPER DERBİ 2026', RENK.fbLacivert, '#FFFFFF');
    cizTribunPankarti(ctx, W + 184, H - 530, 22, 260, 1, 'CİMBOM · GÜN', RENK.gsBordo, RENK.gsSari);

    cizTribunPankarti(ctx, ORTA_X - 180, -104, 360, 20, 0, tema.tribunUst, RENK.fbLacivert, RENK.fbSari);
    cizTribunPankarti(ctx, ORTA_X - 180, H + 84, 360, 20, 0, 'ASLANLAR KALE ARKASI · GÜN', RENK.gsBordo, RENK.gsSari);

    // 6. Dış Çatı Çelik Konsol Kirişleri & Metalik Çerçeve
    for (by = -PAD_Y + 60; by < totalH - PAD_Y; by += 180) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-PAD_X, by + 4);
      ctx.lineTo(-222, by + 4);
      ctx.moveTo(W + 222, by + 4);
      ctx.lineTo(W + PAD_X, by + 4);
      ctx.stroke();

      ctx.strokeStyle = '#334461';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-PAD_X, by);
      ctx.lineTo(-222, by);
      ctx.moveTo(W + 222, by);
      ctx.lineTo(W + PAD_X, by);
      ctx.stroke();
    }
  }

  function cizKoseKuleleri(ctx) {
    var kuleler = [
      { x: -16, y: -16, dx: 1, dy: 1 },
      { x: W - 28, y: -16, dx: -1, dy: 1 },
      { x: -16, y: H - 28, dx: 1, dy: -1 },
      { x: W - 28, y: H - 28, dx: -1, dy: -1 }
    ];

    for (var i = 0; i < kuleler.length; i++) {
      var k = kuleler[i];
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(k.x + 2, k.y + 3, 44, 44);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(k.x, k.y, 44, 44);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(k.x + 2, k.y + 2, 40, 40);

      // 6'lı LED projektör lamba kümesi
      var lx = k.x + 22;
      var ly = k.y + 22;
      ctx.fillStyle = '#FEF9C3';
      for (var px = -9; px <= 9; px += 9) {
        for (var py = -6; py <= 6; py += 12) {
          ctx.beginPath();
          ctx.arc(lx + px, ly + py, 3.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Köşelerden sahaya sıcak projektör hüzmesi
      var gx = lx + k.dx * 195;
      var gy = ly + k.dy * 195;
      var grad = ctx.createRadialGradient(lx, ly, 10, gx, gy, 390);
      grad.addColorStop(0, 'rgba(255, 250, 215, 0.19)');
      grad.addColorStop(0.45, 'rgba(255, 250, 215, 0.07)');
      grad.addColorStop(1, 'rgba(255, 250, 215, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, 390, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function cizPanoDilimi(ctx, x, y, w, h, yatay, yazi, zeminRenk, yaziRenk, aci) {
    // Hafif LED zemin yansıması
    ctx.fillStyle = zeminRenk;
    ctx.fillRect(x, y, w, h);

    // Parlak üst LED ışık kenarı & ince çerçeve ayracı
    ctx.strokeStyle = RENK.murekkep;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    if (yatay) {
      ctx.fillRect(x + 1, y + 1, w - 2, 2.0);
    } else {
      ctx.fillRect(x + 1, y + 1, 2.0, h - 2);
    }

    // Pano metni
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (aci) ctx.rotate(aci);
    ctx.fillStyle = yaziRenk;
    ctx.font = '900 8.5px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(yazi, 0, 0.5);
    ctx.restore();
  }

  function cizReklamPanolar(ctx) {
    var tema = RAKIP_TEMALAR[aktifRakip] || RAKIP_TEMALAR.FB;
    var rakipPanolar = tema.panolar;
    var gsPanolar = [
      { yazi: 'GALATASARAY 1905', bg: RENK.gsBordo, fg: RENK.gsSari },
      { yazi: 'GÜN FUTBOL', bg: RENK.gsSari, fg: RENK.gsBordo },
      { yazi: 'ASLAN YUVASI', bg: RENK.gsBordo, fg: '#FFFFFF' },
      { yazi: 'CİMBOM · GÜN', bg: RENK.gsSari, fg: RENK.gsBordo }
    ];

    // Üst & Alt ışıklı LED reklam panoları
    var yatayAdet = 8;
    var yBasX = 32;
    var yPanoW = (W - 64) / yatayAdet;
    for (var i = 0; i < yatayAdet; i++) {
      var rk = rakipPanolar[i % rakipPanolar.length];
      cizPanoDilimi(ctx, yBasX + i * yPanoW, 26, yPanoW, 12, true, rk.yazi, rk.bg, rk.fg, 0);

      var gs = gsPanolar[i % gsPanolar.length];
      cizPanoDilimi(ctx, yBasX + i * yPanoW, H - 38, yPanoW, 12, true, gs.yazi, gs.bg, gs.fg, 0);
    }

    // Sol ve Sağ dikey ışıklı LED reklam panoları
    var dikeyAdet = 12;
    var dBasY = 38;
    var dPanoH = (H - 76) / dikeyAdet;
    for (var j = 0; j < dikeyAdet; j++) {
      var solPano = (j >= 4) ? gsPanolar[j % gsPanolar.length] : rakipPanolar[j % rakipPanolar.length];
      var sagPano = (j < 7) ? rakipPanolar[j % rakipPanolar.length] : gsPanolar[j % gsPanolar.length];

      cizPanoDilimi(ctx, 26, dBasY + j * dPanoH, 12, dPanoH, false, solPano.yazi, solPano.bg, solPano.fg, -Math.PI / 2);
      cizPanoDilimi(ctx, W - 38, dBasY + j * dPanoH, 12, dPanoH, false, sagPano.yazi, sagPano.bg, sagPano.fg, Math.PI / 2);
    }
  }

  var SEYIRCI_SAC = ['#171310', '#2b1d14', '#4d3522'];

  function seyirciUret() {
    var rnd = prngOlustur(19051907);
    // 6 forma rengi grubu: 0=FB Lacivert, 1=FB Sarı, 2=GS Bordo, 3=GS Sarı, 4=Beyaz, 5=Koyu
    var gruplar = [[], [], [], [], [], []];
    var tum = [];
    var flaslar = [];

    function renkSec(gsAgirlik) {
      var r = rnd();
      if (r < 0.14) return 4;
      if (r < 0.22) return 5;
      var gsMi = rnd() < gsAgirlik;
      if (gsMi) return rnd() < 0.56 ? 2 : 3;
      return rnd() < 0.56 ? 0 : 1;
    }

    function ekle(x, y, yatay, gsAgirlik) {
      var g = renkSec(gsAgirlik);
      var s = {
        x: x + (rnd() - 0.5) * 3.2,
        y: y + (rnd() - 0.5) * 3.2,
        yatay: yatay,
        grup: g,
        takim: (g === 2 || g === 3) ? 'GS' : ((g === 0 || g === 1) ? 'FB' : 'N'),
        sacTip: Math.floor(rnd() * 3),
        sapka: rnd() < 0.18,
        faz: rnd() * Math.PI * 2,
        atkili: rnd() < 0.38,
        atkiRenk: (g === 2 || g === 3)
          ? (rnd() > 0.45 ? RENK.gsSari : RENK.gsBordo)
          : (rnd() > 0.45 ? RENK.fbSari : RENK.fbLacivert),
        dz: 0
      };
      gruplar[g].push(s);
      tum.push(s);
      if (rnd() < 0.065 && flaslar.length < 36) {
        flaslar.push({ x: s.x, y: s.y, faz: rnd() * 20, hiz: 1.6 + rnd() * 2.4 });
      }
    }

    // Üst (FB ağırlık) & Alt (GS ağırlık) alt tribün 4 kademe seyirci
    for (var mx = 56; mx < W - 70; mx += 148) {
      for (var dx = 8; dx <= 106; dx += 20) {
        for (var ry = 0; ry < 4; ry++) {
          ekle(mx + dx, 14 - ry * 22, true, 0.10);
          ekle(mx + dx, H - 18 + ry * 22, true, 0.90);
        }
      }
    }

    // Sol & Sağ alt tribün 5 kademe hareketli seyirci (hiç boşluksuz dolu derbi tribünü!)
    for (var my = 56; my < H - 70; my += 152) {
      var solGsOran = my >= ORTA_Y - 260 ? 0.85 : 0.35;
      var sagGsOran = my >= ORTA_Y - 40 ? 0.72 : 0.20;
      for (var dy = 8; dy <= 112; dy += 20) {
        for (var kx = 0; kx < 5; kx++) {
          ekle(-16 - kx * 29, my + dy, false, solGsOran);
          ekle(W + 14 + kx * 29, my + dy, false, sagGsOran);
        }
      }
    }

    seyirciGruplari = gruplar;
    seyirciTum = tum;
    FLAS_NOKTALAR = flaslar;
  }

  // =========================================================================
  // CANLI HAREKETLİ ÖĞELER: SEYİRCİ COŞKUSU, BAYRAKLAR, FLAŞLAR, 3B YAYLI AĞLAR
  // =========================================================================

  function seyirciZiplamaHesapla(s) {
    var coskuCarpan = 1;
    var hiz = 4.6;
    if (coskuSuresi > 0) {
      var ayniTakim = coskuTakim === 'ikisi' || s.takim === coskuTakim;
      coskuCarpan = ayniTakim ? 3.8 : 1.7;
      hiz = ayniTakim ? 15.0 : 8.5;
    } else {
      var dalga = Math.sin(zaman * 1.9 + s.x * 0.008 + s.y * 0.006);
      if (dalga > 0.65) coskuCarpan = 1.65;
    }
    return -Math.abs(Math.sin(zaman * hiz + s.faz)) * (1.35 * coskuCarpan);
  }

  function gorunurMu(x, y, vx, vy, vxSag, vyAlt) {
    return x >= vx - 40 && x <= vxSag + 40 && y >= vy - 40 && y <= vyAlt + 40;
  }

  function cizTribunSeyircileri(ctx, vx, vy, vxSag, vyAlt) {
    if (!seyirciGruplari) return;
    var i, k, s, dy, w, h;
    var n = seyirciTum.length;
    for (i = 0; i < n; i++) {
      s = seyirciTum[i];
      s.gorunur = gorunurMu(s.x, s.y, vx, vy, vxSag, vyAlt);
      if (s.gorunur) {
        s.dz = seyirciZiplamaHesapla(s);
      }
    }

    // Coşku anında gol atan takım tribününde parlak derbi ışık parıltısı
    var coskuAcik = coskuSuresi > 0;
    if (coskuAcik) {
      var parlakRenk = coskuTakim === 'FB' ? 'rgba(255, 237, 0, 0.16)' : 'rgba(253, 185, 18, 0.16)';
      ctx.fillStyle = parlakRenk;
      for (i = 0; i < TRIBUN_BAYRAKLARI.length; i++) {
        var tb = TRIBUN_BAYRAKLARI[i];
        if (gorunurMu(tb.x, tb.y, vx - 80, vy - 80, vxSag + 80, vyAlt + 80)) {
          ctx.beginPath();
          ctx.arc(tb.x, tb.y - 16, 42 + Math.sin(zaman * 14 + tb.faz) * 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 1. Geçiş: Sabit zemin gölgeleri (tek toplu fill!)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      s = seyirciTum[i];
      if (!s.gorunur) continue;
      if (s.yatay) {
        ctx.rect(s.x - 5.8, s.y - 0.5, 11.6, 6.2);
      } else {
        ctx.rect(s.x - 4.0, s.y - 3.8, 8.2, 9.2);
      }
    }
    ctx.fill();

    // 2. Geçiş: 6 forma rengi grubuyla yuvarlak omuz gövdeleri + alkış/coşku kolları
    for (k = 0; k < 6; k++) {
      var grup = seyirciGruplari[k];
      ctx.fillStyle = GRUP_RENKLER[k];
      ctx.beginPath();
      for (i = 0; i < grup.length; i++) {
        s = grup[i];
        if (!s.gorunur) continue;
        dy = s.dz;
        w = s.yatay ? 5.6 : 4.2;
        h = s.yatay ? 3.5 : 4.6;
        ctx.moveTo(s.x + w, s.y + dy);
        ctx.ellipse(s.x, s.y + dy, w, h, 0, 0, Math.PI * 2);
        // Tezahürat veya meksika dalgasında havaya kalkan kollar
        if (coskuAcik || dy < -1.5) {
          var elY = s.y - 6.2 + dy;
          ctx.rect(s.x - w - 1.2, elY, 2.2, 5.2);
          ctx.rect(s.x + w - 1.0, elY, 2.2, 5.2);
        }
      }
      ctx.fill();
    }

    // 3. Geçiş: Yuvarlak ten yüzler (tek toplu fill!)
    ctx.fillStyle = '#F2C59B';
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      s = seyirciTum[i];
      if (!s.gorunur) continue;
      ctx.moveTo(s.x + 2.4, s.y - 3.2 + s.dz);
      ctx.arc(s.x, s.y - 3.2 + s.dz, 2.4, 0, Math.PI * 2);
    }
    ctx.fill();

    // 4. Geçiş: 3 doğal saç rengi (toplu fill!)
    for (k = 0; k < 3; k++) {
      ctx.fillStyle = SEYIRCI_SAC[k];
      ctx.beginPath();
      for (i = 0; i < n; i++) {
        s = seyirciTum[i];
        if (!s.gorunur || s.sacTip !== k) continue;
        ctx.moveTo(s.x + 2.5, s.y - 4.0 + s.dz);
        ctx.arc(s.x, s.y - 4.0 + s.dz, 2.5, Math.PI, Math.PI * 2);
      }
      ctx.fill();
    }

    // 5. Geçiş: Coşku veya tezahürat anında sallanan atkılar
    for (i = 0; i < n; i++) {
      s = seyirciTum[i];
      if (!s.gorunur || !s.atkili) continue;
      dy = s.dz;
      if (!coskuAcik && dy > -1.5) continue;

      var salla = Math.sin(zaman * 16 + s.faz) * 2.8;
      ctx.fillStyle = s.atkiRenk;
      if (s.yatay) {
        ctx.fillRect(s.x - 5.5 + salla * 0.4, s.y - 8.5 + dy, 11, 2.7);
      } else {
        ctx.fillRect(s.x - 5.0 + salla * 0.4, s.y - 8.0 + dy, 10, 2.7);
      }
    }
  }

  function cizTribunBayraklari(ctx, vx, vy, vxSag, vyAlt) {
    var coskuHiz = coskuSuresi > 0 ? 11.5 : 5.4;
    for (var i = 0; i < TRIBUN_BAYRAKLARI.length; i++) {
      var b = TRIBUN_BAYRAKLARI[i];
      if (!gorunurMu(b.x, b.y, vx, vy, vxSag, vyAlt)) continue;

      var dalga1 = Math.sin(zaman * coskuHiz + b.faz) * 5.2;
      var dalga2 = Math.cos(zaman * (coskuHiz * 1.35) + b.faz) * 3.4;

      // Direk
      ctx.strokeStyle = RENK.murekkep;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x, b.y - 34);
      ctx.stroke();

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Dalgalanan dev derbi bayrağı
      var uX = b.x + b.dir * (28 + dalga2 * 0.5);
      var uY = b.y - 25 + dalga1;

      ctx.beginPath();
      ctx.moveTo(b.x + b.dir * 1.5, b.y - 34);
      ctx.quadraticCurveTo(b.x + b.dir * 15, b.y - 35 + dalga1 * 0.6, uX, uY);
      ctx.quadraticCurveTo(b.x + b.dir * 15, b.y - 16 + dalga1 * 0.6, b.x + b.dir * 1.5, b.y - 15);
      ctx.closePath();
      ctx.fillStyle = b.r1;
      ctx.fill();
      ctx.strokeStyle = RENK.murekkep;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // İkinci renk şerit
      ctx.beginPath();
      ctx.moveTo(b.x + b.dir * 1.5, b.y - 24.5);
      ctx.lineTo(uX - b.dir * 1.5, uY);
      ctx.quadraticCurveTo(b.x + b.dir * 15, b.y - 16 + dalga1 * 0.6, b.x + b.dir * 1.5, b.y - 15);
      ctx.closePath();
      ctx.fillStyle = b.r2;
      ctx.fill();
    }
  }

  function cizKameraFlaslari(ctx, vx, vy, vxSag, vyAlt) {
    var frekans = coskuSuresi > 0 ? 4.2 : 1.0;
    for (var i = 0; i < FLAS_NOKTALAR.length; i++) {
      var f = FLAS_NOKTALAR[i];
      if (!gorunurMu(f.x, f.y, vx, vy, vxSag, vyAlt)) continue;
      var s = Math.sin(zaman * f.hiz * frekans + f.faz);
      if (s < 0.965) continue;
      var guc = (s - 0.965) / 0.035;
      ctx.fillStyle = 'rgba(255, 255, 240, ' + (guc * 0.85).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(f.x, f.y - 3, 5 + guc * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function cizKoseBayraklari(ctx) {
    for (var i = 0; i < KOSE_BAYRAKLARI.length; i++) {
      var b = KOSE_BAYRAKLARI[i];
      var dalga1 = Math.sin(zaman * 6.4 + b.faz) * 3.2;
      var dalga2 = Math.cos(zaman * 8.6 + b.faz) * 2.2;

      // Çim üstü bayrak gölgesi
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + 12, b.y + 5);
      ctx.stroke();

      // Direk (Tsubasa siyah konturlu beyaz direk)
      ctx.lineCap = 'round';
      ctx.strokeStyle = RENK.murekkep;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x, b.y - 22);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x, b.y - 22);
      ctx.stroke();

      // Rüzgârda dalgalanan iki renkli flama
      var ucX = b.x + 15 + dalga2 * 0.4;
      var ucY = b.y - 17 + dalga1;

      ctx.beginPath();
      ctx.moveTo(b.x + 1, b.y - 22);
      ctx.quadraticCurveTo(b.x + 8, b.y - 22 + dalga1 * 0.55, ucX, ucY);
      ctx.quadraticCurveTo(b.x + 8, b.y - 13 + dalga1 * 0.65, b.x + 1, b.y - 11);
      ctx.closePath();

      ctx.fillStyle = b.r1;
      ctx.fill();
      ctx.strokeStyle = RENK.murekkep;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Alt üçgen kulüp şeridi
      ctx.beginPath();
      ctx.moveTo(b.x + 1, b.y - 16.5);
      ctx.lineTo(ucX - 1, ucY);
      ctx.quadraticCurveTo(b.x + 8, b.y - 13 + dalga1 * 0.65, b.x + 1, b.y - 11);
      ctx.closePath();
      ctx.fillStyle = b.r2;
      ctx.fill();

      // Altın direk başlığı
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(b.x, b.y - 22.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function cizTekKaleUst(ctx, ag) {
    var ustMu = ag.ustMu;
    var d = ag.dugumler;
    var n = d.length;
    var dir = ustMu ? -1 : 1; // Kale ağzından arkaya doğru (+ veya - Y)

    var onY = ustMu ? UST : ALT;
    var arkaY = onY + dir * KALE_DERIN;

    // Yukarı bakan hafif 3B perspektif kaydırması (z=58 -> -13 px; arka üst bar z=38 -> -8.5 px)
    var ustDirekY = onY - 13;
    var arkaUstBaseY = arkaY - 8.5;
    var arkaIcDaralma = 4;

    var renkAna = ustMu ? RENK.fbLacivert : RENK.gsBordo;
    var renkVurgu = ustMu ? RENK.fbSari : RENK.gsSari;

    // Ağ sütun koordinatlarını sıfır-çöp tamponlara hesapla
    var onX = bufOnX;
    var arkaUstX = bufArkaUstX;
    var arkaUstY = bufArkaUstY;
    var arkaAltX = bufArkaAltX;
    var arkaAltY = bufArkaAltY;
    var arkaOrtaY = bufArkaOrtaY;

    for (var i = 0; i < n; i++) {
      var u = i / (n - 1);
      var yayPos = d[i].pos;
      if (yayPos < -3.5) yayPos = -3.5;

      onX[i] = KALE_SOL + u * KALE_W;
      arkaAltX[i] = KALE_SOL + u * KALE_W;
      arkaUstX[i] = (KALE_SOL + arkaIcDaralma) + u * (KALE_W - arkaIcDaralma * 2);

      var esneme = dir * yayPos;
      arkaAltY[i] = arkaY + esneme * 1.1;
      arkaUstY[i] = arkaUstBaseY + esneme * 0.72;
      arkaOrtaY[i] = (arkaAltY[i] + arkaUstY[i]) * 0.5 + esneme * 0.25;
    }

    // 1. Zemin kale gölgesi
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.beginPath();
    ctx.moveTo(KALE_SOL + 3, onY + 3);
    ctx.lineTo(KALE_SAG + 5, onY + 3);
    ctx.lineTo(KALE_SAG + 5, arkaY + 4);
    ctx.lineTo(KALE_SOL + 3, arkaY + 4);
    ctx.closePath();
    ctx.fill();

    // 2. Yan destek direkleri (kulüp renkli dış destek çubukları)
    ctx.lineCap = 'round';
    var yanlar = [
      { bx: KALE_SOL, btx: arkaUstX[0], ty: arkaUstY[0], ay: arkaAltY[0] },
      { bx: KALE_SAG, btx: arkaUstX[n - 1], ty: arkaUstY[n - 1], ay: arkaAltY[n - 1] }
    ];
    for (var yIdx = 0; yIdx < yanlar.length; yIdx++) {
      var yn = yanlar[yIdx];
      ctx.strokeStyle = RENK.murekkep;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(yn.bx, onY);
      ctx.lineTo(yn.bx, yn.ay);
      ctx.lineTo(yn.btx, yn.ty);
      ctx.stroke();

      ctx.strokeStyle = renkAna;
      ctx.lineWidth = 3.2;
      ctx.stroke();

      // Köşe destek vurgusu
      ctx.strokeStyle = renkVurgu;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(yn.bx, onY + dir * 10);
      ctx.lineTo(yn.btx, yn.ty);
      ctx.stroke();
    }

    // 3. Yarı saydam ağ hacmi (oyuncular/top içeriden net seçilir)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(onX[0], ustDirekY);
    ctx.lineTo(onX[n - 1], ustDirekY);
    for (i = n - 1; i >= 0; i--) {
      ctx.lineTo(arkaUstX[i], arkaUstY[i]);
    }
    ctx.closePath();
    ctx.fill();

    // 4. Ağ file örgü çizgileri
    ctx.strokeStyle = 'rgba(244, 251, 255, 0.64)';
    ctx.lineWidth = 1.2;

    // Arka file dikey & yatay telleri (yay esnemesi orta noktada bombeli görünür)
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      ctx.moveTo(arkaUstX[i], arkaUstY[i]);
      ctx.quadraticCurveTo((arkaUstX[i] + arkaAltX[i]) * 0.5, arkaOrtaY[i], arkaAltX[i], arkaAltY[i]);
    }
    for (var kat = 0; kat <= 3; kat++) {
      var oran = kat / 3;
      for (i = 0; i < n; i++) {
        var px = arkaUstX[i] + (arkaAltX[i] - arkaUstX[i]) * oran;
        var py = arkaUstY[i] + (arkaAltY[i] - arkaUstY[i]) * oran;
        if (kat === 1 || kat === 2) {
          py = (py + arkaOrtaY[i]) * 0.5;
        }
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // Yan ağ telleri (sol ve sağ)
    ctx.beginPath();
    for (yIdx = 0; yIdx < 2; yIdx++) {
      var cIdx = yIdx === 0 ? 0 : n - 1;
      var xOn = onX[cIdx];
      var xArkaUst = arkaUstX[cIdx];
      var xArkaAlt = arkaAltX[cIdx];
      var yArkaUst = arkaUstY[cIdx];
      var yArkaAlt = arkaAltY[cIdx];

      for (var yd = 1; yd <= 4; yd++) {
        var t = yd / 5;
        ctx.moveTo(xOn + (xArkaUst - xOn) * t, ustDirekY + (yArkaUst - ustDirekY) * t);
        ctx.lineTo(xOn + (xArkaAlt - xOn) * t, onY + (yArkaAlt - onY) * t);
      }
      for (var yh = 1; yh <= 2; yh++) {
        var ht = yh / 3;
        ctx.moveTo(xOn, ustDirekY + (onY - ustDirekY) * ht);
        ctx.lineTo(xArkaUst + (xArkaAlt - xArkaUst) * ht, yArkaUst + (yArkaAlt - yArkaUst) * ht);
      }
    }
    ctx.stroke();

    // Tavan file örgüsü (üst direk -> arka üst bar)
    ctx.beginPath();
    for (i = 0; i < n; i++) {
      ctx.moveTo(onX[i], ustDirekY);
      ctx.lineTo(arkaUstX[i], arkaUstY[i]);
    }
    for (var rKat = 1; rKat <= 4; rKat++) {
      var rOran = rKat / 5;
      for (i = 0; i < n; i++) {
        var rx = onX[i] + (arkaUstX[i] - onX[i]) * rOran;
        var ry = ustDirekY + (arkaUstY[i] - ustDirekY) * rOran;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
    }
    ctx.stroke();

    // 5. Kalın siyah mürekkep dış çizgili 3B parlak beyaz kale direkleri ve üst direk
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(KALE_SOL, onY);
    ctx.lineTo(KALE_SOL, ustDirekY);
    ctx.lineTo(KALE_SAG, ustDirekY);
    ctx.lineTo(KALE_SAG, onY);

    ctx.strokeStyle = RENK.murekkep;
    ctx.lineWidth = 11.5;
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Parlak üst direk ışık yansıması
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(KALE_SOL, ustDirekY - 1.2);
    ctx.lineTo(KALE_SAG, ustDirekY - 1.2);
    ctx.stroke();

    // Direk taban ankraj kapakları
    var tabanlar = [KALE_SOL, KALE_SAG];
    for (var tb = 0; tb < tabanlar.length; tb++) {
      ctx.fillStyle = RENK.murekkep;
      ctx.beginPath();
      ctx.arc(tabanlar[tb], onY, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.arc(tabanlar[tb], onY, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // =========================================================================
  // DIŞA AÇIK API
  // =========================================================================

  var SAHA = {
    W: W,
    H: H,
    sol: SOL,
    sag: SAG,
    ust: UST,
    alt: ALT,
    en: EN,
    boy: BOY,
    ortaX: ORTA_X,
    ortaY: ORTA_Y,
    kaleW: KALE_W,
    kaleDerin: KALE_DERIN,
    kaleSol: KALE_SOL,
    kaleSag: KALE_SAG,
    kaleYukseklik: KALE_YUKSEKLIK,
    direkYaricap: DIREK_R,
    ortaDaireR: ORTA_DAIRE_R,

    cezaSahasi: {
      sol: CEZA_SOL,
      sag: CEZA_SAG,
      genislik: CEZA_W,
      derinlik: CEZA_DERIN,
      ustY: UST + CEZA_DERIN,
      altY: ALT - CEZA_DERIN
    },
    kaleSahasi: {
      sol: KALE_SAHASI_SOL,
      sag: KALE_SAHASI_SAG,
      genislik: KALE_SAHASI_W,
      derinlik: KALE_SAHASI_DERIN,
      ustY: UST + KALE_SAHASI_DERIN,
      altY: ALT - KALE_SAHASI_DERIN
    },
    penaltiUst: { x: ORTA_X, y: UST + PENALTI_UZAKLIK },
    penaltiAlt: { x: ORTA_X, y: ALT - PENALTI_UZAKLIK },

    // Direk çarpışma ve sekme hesapları için hazır koordinatlar
    direkler: [
      { x: KALE_SOL, y: UST, r: DIREK_R, h: KALE_YUKSEKLIK, ustMu: true, taraf: 'sol', takim: 'FB' },
      { x: KALE_SAG, y: UST, r: DIREK_R, h: KALE_YUKSEKLIK, ustMu: true, taraf: 'sag', takim: 'FB' },
      { x: KALE_SOL, y: ALT, r: DIREK_R, h: KALE_YUKSEKLIK, ustMu: false, taraf: 'sol', takim: 'GS' },
      { x: KALE_SAG, y: ALT, r: DIREK_R, h: KALE_YUKSEKLIK, ustMu: false, taraf: 'sag', takim: 'GS' }
    ],

    ustKale: {
      takim: 'FB',
      ustMu: true,
      sol: KALE_SOL,
      sag: KALE_SAG,
      onY: UST,
      arkaY: UST - KALE_DERIN,
      yukseklik: KALE_YUKSEKLIK,
      direkR: DIREK_R,
      solDirek: { x: KALE_SOL, y: UST, r: DIREK_R, h: KALE_YUKSEKLIK },
      sagDirek: { x: KALE_SAG, y: UST, r: DIREK_R, h: KALE_YUKSEKLIK },
      ustDirek: { x1: KALE_SOL, x2: KALE_SAG, y: UST, z: KALE_YUKSEKLIK, r: DIREK_R }
    },

    altKale: {
      takim: 'GS',
      ustMu: false,
      sol: KALE_SOL,
      sag: KALE_SAG,
      onY: ALT,
      arkaY: ALT + KALE_DERIN,
      yukseklik: KALE_YUKSEKLIK,
      direkR: DIREK_R,
      solDirek: { x: KALE_SOL, y: ALT, r: DIREK_R, h: KALE_YUKSEKLIK },
      sagDirek: { x: KALE_SAG, y: ALT, r: DIREK_R, h: KALE_YUKSEKLIK },
      ustDirek: { x1: KALE_SOL, x2: KALE_SAG, y: ALT, z: KALE_YUKSEKLIK, r: DIREK_R }
    },

    /**
     * Statik stadyum katmanlarını tek seferlik offscreen canvas'a işler,
     * seyirci ve yaylı ağ yapılarını hazırlar.
     */
    kur: function () {
      ustAg = agOlustur(true);
      altAg = agOlustur(false);
      seyirciUret();
      coskuSuresi = 0;

      if (typeof document === 'undefined') return;

      onbellekCanvas = document.createElement('canvas');
      onbellekCanvas.width = W + PAD_X * 2;
      onbellekCanvas.height = H + PAD_Y * 2;
      var octx = onbellekCanvas.getContext('2d');

      octx.save();
      octx.translate(PAD_X, PAD_Y);

      cizGenisTribunler(octx);
      cizDisPist(octx);
      cizCimZemin(octx);
      cizSahaCizgileri(octx);
      cizKoseKuleleri(octx);
      cizReklamPanolar(octx);

      octx.restore();
    },

    /**
     * Bayrak dalgalanmasını, seyirci coşkusunu ve kale ağ yaylarını günceller.
     */
    guncelle: function (dt) {
      var guvenliDt = typeof dt === 'number' && dt > 0 ? Math.min(dt, 0.05) : 0;
      zaman += guvenliDt;

      if (coskuSuresi > 0) {
        coskuSuresi = Math.max(0, coskuSuresi - guvenliDt);
      }
      if (!ustAg) ustAg = agOlustur(true);
      if (!altAg) altAg = agOlustur(false);

      if (guvenliDt > 0) {
        agGuncelle(ustAg, guvenliDt);
        agGuncelle(altAg, guvenliDt);
      }
    },

    /**
     * Önbellekli panoramik sahayı tek drawImage ile basar, ardından görünür tribün
     * seyircilerini, dev bayrakları, flaşları ve 4 köşe bayrağını çizer.
     */
    cizZemin: function (ctx, vx, vy, vw, vh) {
      if (!onbellekCanvas && typeof document !== 'undefined') {
        SAHA.kur();
      }
      var xMin = typeof vx === 'number' && isFinite(vx) ? vx : -PAD_X;
      var yMin = typeof vy === 'number' && isFinite(vy) ? vy : -PAD_Y;
      var xMax = xMin + (typeof vw === 'number' && isFinite(vw) ? vw : (W + PAD_X * 2));
      var yMax = yMin + (typeof vh === 'number' && isFinite(vh) ? vh : (H + PAD_Y * 2));

      ctx.save();
      if (onbellekCanvas) {
        ctx.drawImage(onbellekCanvas, -PAD_X, -PAD_Y);
      }
      cizTribunSeyircileri(ctx, xMin, yMin, xMax, yMax);
      cizTribunBayraklari(ctx, xMin, yMin, xMax, yMax);
      cizKameraFlaslari(ctx, xMin, yMin, xMax, yMax);
      cizKoseBayraklari(ctx);
      ctx.restore();
    },

    /**
     * Oyuncuların ve topun üstünde çizilmesi gereken 3B kaleleri ve
     * yaylı ağları çizer.
     */
    cizKalelerUst: function (ctx) {
      if (!ustAg) ustAg = agOlustur(true);
      if (!altAg) altAg = agOlustur(false);

      ctx.save();
      cizTekKaleUst(ctx, ustAg);
      cizTekKaleUst(ctx, altAg);
      ctx.restore();
    },

    /**
     * Top ağa çarptığında ilgili kale ağının x bölgesine yerel yay darbesi uygular.
     * @param {boolean} ustMu - Üst Fenerbahçe kalesi için true, alt Galatasaray kalesi için false
     * @param {number} x - Çarpma x koordinatı
     * @param {number} [guc=1] - Darbe gücü (tipik 0.4 .. 2.5)
     */
    agSalla: function (ustMu, x, guc) {
      var ustHedef = ustMu === true || ustMu === 'ust' || ustMu === 'FB';
      var ag = ustHedef ? (ustAg || (ustAg = agOlustur(true))) : (altAg || (altAg = agOlustur(false)));

      var hamX = typeof x === 'number' ? x : ORTA_X;
      var klipsX = Math.max(KALE_SOL + 8, Math.min(KALE_SAG - 8, hamX));
      var normGuc = typeof guc === 'number' && guc > 0 ? Math.min(3.0, guc) : 1.0;

      // Düğüm yayılımı (Gauss çanı)
      var d = ag.dugumler;
      var sigma2 = 2 * 28 * 28;
      var temelHiz = normGuc * 260;

      for (var i = 1; i < d.length - 1; i++) {
        var nx = KALE_SOL + (i / (d.length - 1)) * KALE_W;
        var fark = nx - klipsX;
        var agirlik = Math.exp(-(fark * fark) / sigma2);
        d[i].vel += temelHiz * agirlik;
      }
    },

    /**
     * Gol coşkusunu (hızlı zıplayan tribünler & atkı dalgası) tetikler.
     */
    coskuTetikle: function (takim, sure) {
      coskuTakim = takim === 'GS' ? 'GS' : ((takim === 'FB' || takim === 'BJK' || takim === 'TS') ? 'FB' : 'ikisi');
      coskuSuresi = typeof sure === 'number' && sure > 0 ? sure : 2.8;
    },

    /**
     * Derbi rakibine göre stadyum renklerini, bayrakları, afişleri ve reklam panolarını günceller.
     */
    rakipAyar: function (kod) {
      var yeni = (kod === 'BJK' || kod === 'TS') ? kod : 'FB';
      var degisti = yeni !== aktifRakip;
      aktifRakip = yeni;
      var tema = RAKIP_TEMALAR[aktifRakip] || RAKIP_TEMALAR.FB;
      RENK.fbLacivert = tema.ana;
      RENK.fbSari = tema.ikinci;
      GRUP_RENKLER[0] = tema.ana;
      GRUP_RENKLER[1] = tema.ikinci;
      for (var i = 0; i < KOSE_BAYRAKLARI.length; i++) {
        if (KOSE_BAYRAKLARI[i].away) {
          KOSE_BAYRAKLARI[i].r1 = KOSE_BAYRAKLARI[i].inv ? tema.ikinci : tema.ana;
          KOSE_BAYRAKLARI[i].r2 = KOSE_BAYRAKLARI[i].inv ? tema.ana : tema.ikinci;
        }
      }
      for (var j = 0; j < TRIBUN_BAYRAKLARI.length; j++) {
        if (TRIBUN_BAYRAKLARI[j].away) {
          TRIBUN_BAYRAKLARI[j].r1 = TRIBUN_BAYRAKLARI[j].inv ? tema.ikinci : tema.ana;
          TRIBUN_BAYRAKLARI[j].r2 = TRIBUN_BAYRAKLARI[j].inv ? tema.ana : tema.ikinci;
        }
      }
      if (typeof document !== 'undefined' && (degisti || onbellekCanvas)) {
        SAHA.kur();
      }
      return aktifRakip;
    },

    /**
     * Ağ titreşimlerini ve tribün coşku durumunu sıfırlar.
     */
    sifirla: function () {
      agSifirla(ustAg);
      agSifirla(altAg);
      coskuSuresi = 0;
    },

    /**
     * Top kale çizgisini geçip geçmediğini kontrol eder.
     * Üst kale FB kalesidir -> geçilirse 'GS' golü; alt kale GS kalesidir -> geçilirse 'FB' golü.
     * @returns {'GS'|'FB'|null}
     */
    golMu: function (x, y, z) {
      var topZ = typeof z === 'number' ? z : 0;
      if (topZ >= KALE_YUKSEKLIK) return null;
      if (x <= KALE_SOL + 7 || x >= KALE_SAG - 7) return null;

      if (y <= UST - 11 && y >= UST - KALE_DERIN - 26) return 'GS';
      if (y >= ALT + 11 && y <= ALT + KALE_DERIN + 26) return 'FB';
      return null;
    }
  };

  global.SAHA = SAHA;
})(typeof window !== 'undefined' ? window : globalThis);
