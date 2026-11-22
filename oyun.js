/**
 * oyun.js — 61 Gün Süper Derbi: Ana Oyun Motoru, Fizik, AI, Kontroller & Maç Akışı
 *
 * 5 yaş Gün için Sensible Soccer + Captain Tsubasa tarzı akıcı 7'ye 7 derbi:
 * - A tipi otomatik oyuncu seçimi + #61 GÜN pas/mıknatıs önceliği
 * - iPad çoklu dokunmatik yüzer joystick + PC klavye + Gamepad desteği
 * - Aslan Gücü (0 -> 100) & Tsubasa Aslan Şutu cutaway + falso + kaleci savurma
 * - 2 × 60 sn yarı + berabereyse Altın Gol + Mola (#perde-mola)
 * - ?sessiz=1&oto=1&hiz=4&sure=15 test kancaları ve sıfır hata koruması
 *
 * Dışa aktarılan global API: `window.OYUN`
 */
(function (global) {
  'use strict';

  var hatalar = [];
  var maxHataSayisi = 60;

  function hataKaydet(kaynak, err) {
    try {
      var mesaj = '[' + kaynak + '] ' + (err && err.message ? err.message : String(err));
      if (hatalar.length < maxHataSayisi) {
        hatalar.push(mesaj);
      }
    } catch (_) {
      // Yoksay
    }
  }

  function guvenliCagir(kaynak, fn) {
    try {
      return fn();
    } catch (err) {
      hataKaydet(kaynak, err);
      return undefined;
    }
  }

  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function hypot2(dx, dy) {
    return Math.sqrt(dx * dx + dy * dy);
  }

  function aciYumusat(mevcut, hedef, oran) {
    var fark = hedef - mevcut;
    while (fark > Math.PI) fark -= Math.PI * 2;
    while (fark < -Math.PI) fark += Math.PI * 2;
    return mevcut + fark * oran;
  }

  function simdiMs() {
    return (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : Date.now();
  }

  // --- URL Test Parametreleri ---

  function paramOku() {
    var sonuc = {
      sessiz: false,
      oto: false,
      hiz: 1,
      sure: 150,   // her devre 2,5 dakika
      rakip: 'FB'
    };
    try {
      if (!global.location || typeof URLSearchParams === 'undefined') {
        return sonuc;
      }
      var params = new URLSearchParams(global.location.search || '');
      if (params.has('sessiz')) {
        var sv = params.get('sessiz');
        sonuc.sessiz = sv === '' || sv === '1' || sv === 'true';
      }
      if (params.has('oto')) {
        var ov = params.get('oto');
        sonuc.oto = ov === '' || ov === '1' || ov === 'true';
      }
      if (params.has('hiz')) {
        var hv = parseFloat(params.get('hiz'));
        if (isFinite(hv) && hv > 0) {
          sonuc.hiz = clamp(hv, 0.25, 16);
        }
      }
      if (params.has('sure')) {
        var tv = parseFloat(params.get('sure'));
        if (isFinite(tv) && tv > 0) {
          sonuc.sure = clamp(tv, 3, 600);
        }
      }
      if (params.has('rakip')) {
        var rv = String(params.get('rakip') || '').toUpperCase();
        if (rv === 'FB' || rv === 'BJK' || rv === 'TS') {
          sonuc.rakip = rv;
        }
      }
    } catch (err) {
      hataKaydet('paramOku', err);
    }
    return sonuc;
  }

  var ayar = paramOku();

  // --- Dış Modül Yardımcıları ---

  function sahaAl() {
    var s = global.SAHA || {};
    var W = typeof s.W === 'number' ? s.W : 1320;
    var H = typeof s.H === 'number' ? s.H : 2040;
    var sol = typeof s.sol === 'number' ? s.sol : 70;
    var sag = typeof s.sag === 'number' ? s.sag : 1250;
    var ust = typeof s.ust === 'number' ? s.ust : 110;
    var alt = typeof s.alt === 'number' ? s.alt : 1930;
    var kaleW = typeof s.kaleW === 'number' ? s.kaleW : 230;
    var kaleDerin = typeof s.kaleDerin === 'number' ? s.kaleDerin : 58;
    var kaleYukseklik = typeof s.kaleYukseklik === 'number' ? s.kaleYukseklik : 58;
    var ortaX = (sol + sag) * 0.5;
    var ortaY = (ust + alt) * 0.5;
    return {
      W: W,
      H: H,
      sol: sol,
      sag: sag,
      ust: ust,
      alt: alt,
      en: sag - sol,
      boy: alt - ust,
      yariBoy: (alt - ust) * 0.5,
      ortaX: ortaX,
      ortaY: ortaY,
      kaleW: kaleW,
      kaleDerin: kaleDerin,
      kaleYukseklik: kaleYukseklik,
      kaleSol: ortaX - kaleW * 0.5,
      kaleSag: ortaX + kaleW * 0.5,
      direkR: typeof s.direkYaricap === 'number' ? s.direkYaricap : 7
    };
  }

  var sonSpikerMs = {};

  function sesAcIlkDokunus() {
    if (ayar.sessiz) return;
    try {
      var s = global.SES;
      if (!s) return;
      if (typeof s.ac === 'function') s.ac();
      if (typeof s.sesAyar === 'function' && s.sessiz) {
        // Kullanıcı elle susturmadıysa ilk dokunuşta kilidi açma denemesi yapma;
        // ses.js kendi pointerdown/keydown kilidini otomatik açar.
      }
    } catch (_) {
      // file:// veya otomatik oynatma kısıtını hata sayma
    }
  }

  function sesCal(ad, guc) {
    if (ayar.sessiz) return;
    try {
      var s = global.SES;
      if (s && typeof s.cal === 'function') {
        s.cal(ad, guc);
      }
    } catch (_) {
      // Sessiz geç
    }
  }

  function spikerCal(ad, minAralikMs) {
    if (ayar.sessiz) return;
    try {
      var s = global.SES;
      if (!s || typeof s.spiker !== 'function') return;
      var t = simdiMs();
      var aralik = typeof minAralikMs === 'number' ? minAralikMs : 1200;
      if (sonSpikerMs[ad] && t - sonSpikerMs[ad] < aralik) return;
      sonSpikerMs[ad] = t;
      s.spiker(ad);
    } catch (_) {
      // Sessiz geç
    }
  }

  var sonTribunGuncelle = 0;

  function tribunAyar(aktif, seviye) {
    if (ayar.sessiz) return;
    try {
      var s = global.SES;
      if (!s) return;
      if (aktif) {
        if (typeof s.tribunBaslat === 'function') {
          s.tribunBaslat(seviye);
        } else if (typeof s.tribunSeviye === 'function' && typeof seviye === 'number') {
          s.tribunSeviye(seviye);
        }
      } else if (typeof s.tribunDurdur === 'function') {
        s.tribunDurdur();
      }
    } catch (_) {
      // Sessiz geç
    }
  }

  function tribunSeviyeGuncelle(seviye) {
    if (ayar.sessiz) return;
    try {
      var s = global.SES;
      if (s && typeof s.tribunSeviye === 'function') {
        s.tribunSeviye(seviye);
      }
    } catch (_) {
      // Sessiz geç
    }
  }

  // Tribün tepkisi (ses.js): 'gol' | 'alkis' | 'ooo' | 'ah' | 'heyecan'
  function tribunTepkiCal(tip, guc) {
    try {
      var s = global.SES;
      if (s && typeof s.tribunTepki === 'function') {
        s.tribunTepki(tip, guc);
      }
    } catch (e) {}
  }

  function tribunTezahuratCal(tip) {
    if (ayar.sessiz) return;
    try {
      var s = global.SES;
      if (s && typeof s.tribunTezahurat === 'function') {
        s.tribunTezahurat(tip);
      }
    } catch (_) {
      // Sessiz geç
    }
  }

  function efektCagir(metot) {
    try {
      var ef = global.EFEKT;
      if (!ef || typeof ef[metot] !== 'function') return undefined;
      var args = [];
      for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
      return ef[metot].apply(ef, args);
    } catch (err) {
      hataKaydet('EFEKT.' + metot, err);
      return undefined;
    }
  }

  // --- DOM Önbelleği ve Yardımcılar ---

  var dom = {};

  function el(id) {
    if (typeof document === 'undefined') return null;
    return document.getElementById(id);
  }

  function domKur() {
    dom.tuval = el('saha-tuval');
    dom.gsSkor = el('gs-skor');
    dom.fbSkor = el('fb-skor');
    dom.macSure = el('mac-sure');
    dom.macYari = el('mac-yari');
    dom.aslanKutu = el('aslan-kutu');
    dom.aslanDolu = el('aslan-dolu');
    dom.aslanYazi = el('aslan-yazi');
    dom.molaBtn = el('mola-btn');
    dom.sesBtn = el('ses-btn');
    dom.dokunmatikKatman = el('dokunmatik-katman');
    dom.solAlan = el('sol-hareket-alani');
    dom.joyTaban = el('joy-taban');
    dom.joyTopuz = el('joy-topuz');
    dom.btnPas = el('btn-pas');
    dom.btnSut = el('btn-sut');
    dom.perdeBaslik = el('perde-baslik');
    dom.btnBasla = el('btn-basla');
    dom.perdeDevre = el('perde-devre');
    dom.devreSkor = el('devre-skor');
    dom.devreYazi = el('devre-yazi');
    dom.btnDevam = el('btn-devam');
    dom.perdeGol = el('perde-gol');
    dom.golBaslik = el('gol-baslik');
    dom.golDetay = el('gol-detay');
    dom.perdeMola = el('perde-mola');
    dom.btnMolaDevam = el('btn-mola-devam');
    dom.btnMolaYeniden = el('btn-mola-yeniden');
    dom.btnMolaAna = el('btn-mola-ana');
    dom.perdeSonuc = el('perde-sonuc');
    dom.sonucBaslik = el('sonuc-baslik');
    dom.sonucSkor = el('sonuc-skor');
    dom.sonucIstat = el('sonuc-istat');
    dom.btnTekrar = el('btn-tekrar');
    dom.btnSonucAna = el('btn-sonuc-ana');
    dom.rakipSkorKutu = el('rakip-skor-kutu');
    dom.rakipAd = el('rakip-ad');
    dom.rakipRozet = el('rakip-rozet');
    dom.rakipArma = el('rakip-arma');
    dom.rakipSerit1 = el('rakip-serit-1');
    dom.rakipSerit2 = el('rakip-serit-2');
    dom.rakipSerit3 = el('rakip-serit-3');
    dom.rakipSerit4 = el('rakip-serit-4');
    dom.rakipArmaKenar = el('rakip-arma-kenar');
    dom.rakipArmaYazi = el('rakip-arma-yazi');
    dom.derbiBilgi = el('derbi-bilgi');
    dom.rakipBtnler = (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function')
      ? document.querySelectorAll('#rakip-secici .rakip-btn')
      : null;
  }

  function perdeGoster(node, fallbackDisplay) {
    if (!node) return;
    node.classList.remove('gizli', 'kapali', 'hidden');
    node.classList.add('acik', 'gorunur');
    node.removeAttribute('hidden');
    node.setAttribute('aria-hidden', 'false');
    node.style.display = '';
    if (typeof global.getComputedStyle === 'function') {
      try {
        if (global.getComputedStyle(node).display === 'none') {
          node.style.display = fallbackDisplay || 'flex';
        }
      } catch (_) {
        // Yoksay
      }
    }
  }

  function perdeGizle(node) {
    if (!node) return;
    node.classList.add('gizli');
    node.classList.remove('acik', 'gorunur', 'aktif');
    node.setAttribute('aria-hidden', 'true');
    node.style.display = 'none';
  }

  function sesButonGuncelle() {
    if (!dom.sesBtn) return;
    var s = global.SES;
    var kapali = ayar.sessiz || (s && (Boolean(s.sessiz) || s.sesAcik === false));
    dom.sesBtn.classList.toggle('sessiz', Boolean(kapali));
    dom.sesBtn.setAttribute('aria-pressed', kapali ? 'true' : 'false');
    dom.sesBtn.setAttribute('aria-label', kapali ? 'Sesi aç' : 'Sesi kapat');
  }

  function odakBirak() {
    try {
      if (typeof document !== 'undefined' && document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } catch (_) {
      // Yoksay
    }
  }

  // --- Oyun Durumu ---

  var durum = 'baslik'; // 'baslik' | 'oyun' | 'devre' | 'gol' | 'mola' | 'sonuc'
  var yari = 1;
  var yariSure = ayar.sure;
  var kalanSure = yariSure;
  var gsSkor = 0;
  var fbSkor = 0;
  var aslanGucu = 0;
  var altinGol = false;
  var gunTopSayisi = 0;
  var goller = [];
  var seciliRakip = ayar.rakip || 'FB';
  var darbeDuraklama = 0;

  var RAKIP_META = {
    FB: {
      kod: 'FB',
      ad: 'Fenerbahçe',
      kisa: 'FB',
      rozet: 'FB',
      ana: '#002D72',
      ikinci: '#FFED00',
      cizgi: '#3E7BFF',
      yaziRenk: '#FFED00',
      acikRenk: '#3E7BFF',
      derbiAlt: '11v11 SÜPER DERBİ · GÜN (#61)'
    },
    BJK: {
      kod: 'BJK',
      ad: 'Beşiktaş',
      kisa: 'BJK',
      rozet: 'BJK',
      ana: '#141414',
      ikinci: '#FFFFFF',
      cizgi: '#E4E4E7',
      yaziRenk: '#FFFFFF',
      acikRenk: '#E4E4E7',
      derbiAlt: '11v11 DOLMABAHÇE DERBİSİ · GÜN (#61)'
    },
    TS: {
      kod: 'TS',
      ad: 'Trabzonspor',
      kisa: 'TS',
      rozet: 'TS',
      ana: '#7C1332',
      ikinci: '#00A8E8',
      cizgi: '#00A8E8',
      yaziRenk: '#00A8E8',
      acikRenk: '#38BDF8',
      derbiAlt: '11v11 BORDO-MAVİ DERBİ · GÜN (#61)'
    }
  };

  function rakipBilgiAl(kod) {
    return RAKIP_META[kod] || RAKIP_META.FB;
  }

  function rakipSec(kod) {
    var yeniKod = (kod === 'BJK' || kod === 'TS') ? kod : 'FB';
    seciliRakip = yeniKod;
    var meta = rakipBilgiAl(yeniKod);

    if (dom.rakipSkorKutu) {
      dom.rakipSkorKutu.classList.toggle('fb', yeniKod === 'FB');
      dom.rakipSkorKutu.classList.toggle('bjk', yeniKod === 'BJK');
      dom.rakipSkorKutu.classList.toggle('ts', yeniKod === 'TS');
    }
    if (dom.rakipAd) {
      dom.rakipAd.textContent = meta.kisa;
    }
    if (dom.rakipRozet) {
      dom.rakipRozet.classList.toggle('fb-rozet', yeniKod === 'FB');
      dom.rakipRozet.classList.toggle('bjk-rozet', yeniKod === 'BJK');
      dom.rakipRozet.classList.toggle('ts-rozet', yeniKod === 'TS');
      dom.rakipRozet.textContent = '';
    }
    if (dom.rakipSerit1) dom.rakipSerit1.setAttribute('fill', meta.ana);
    if (dom.rakipSerit2) dom.rakipSerit2.setAttribute('fill', meta.ikinci);
    if (dom.rakipSerit3) dom.rakipSerit3.setAttribute('fill', meta.ana);
    if (dom.rakipSerit4) dom.rakipSerit4.setAttribute('fill', meta.ikinci);
    if (dom.rakipArmaKenar) dom.rakipArmaKenar.setAttribute('stroke', meta.cizgi);
    if (dom.rakipArmaYazi) {
      dom.rakipArmaYazi.textContent = meta.kisa;
      dom.rakipArmaYazi.setAttribute('fill', meta.yaziRenk);
    }
    if (dom.derbiBilgi) {
      dom.derbiBilgi.textContent = meta.derbiAlt;
    }
    if (dom.rakipBtnler && dom.rakipBtnler.length) {
      for (var i = 0; i < dom.rakipBtnler.length; i++) {
        var btn = dom.rakipBtnler[i];
        var btnKod = String(btn.getAttribute('data-rakip') || '').toUpperCase();
        var aktifMi = btnKod === yeniKod;
        btn.classList.toggle('aktif', aktifMi);
        btn.setAttribute('aria-pressed', aktifMi ? 'true' : 'false');
      }
    }
    if (global.SAHA && typeof global.SAHA.rakipAyar === 'function') {
      guvenliCagir('SAHA.rakipAyar', function () {
        global.SAHA.rakipAyar(yeniKod);
      });
    }
    if (durum === 'baslik' && oyuncular.length > 0) {
      oyunculariKur();
      santraDizilisi('GS');
      hudGuncelle(true);
    }
    return yeniKod;
  }

  var zaman = 0;
  var golBekleSure = 0;
  var golSonrakiBaslayan = 'FB';
  var golKutlamaBekliyor = false;
  var golKutlamaGecikme = 0;
  var golBilgiBekleyen = null;
  var santraBekleSure = 0;
  var santraBaslayan = 'GS';
  var otoBekleSure = 0;
  var otoMod = ayar.oto;

  var cutawayDurumu = false;
  var cutawayGecen = 0;
  var cutawayBekleyen = null;

  var duranTop = null; // { tip: 'tac'|'korner'|'aut', takim, x, y, solMu, ustMu, asama, sure, otoSure, atici }

  var fps = 60;
  var fpsKare = 0;
  var fpsSonMs = simdiMs();

  var oyuncular = [];
  var gsOyuncular = [];
  var fbOyuncular = [];
  var gunOyuncu = null;
  var gsKaleci = null;
  var fbKaleci = null;

  var aktifOyuncu = null;
  var pasHedef = null;
  var sonYonX = 0;
  var sonYonY = 0;
  var sonYonSure = 0;
  var pasHedefYonX = 0;
  var pasHedefYonY = 0;
  var aktifDegisimSoguma = 0;
  var fbPasSoguma = 0;
  var kameraX = 0;
  var kameraY = 260;
  var kameraVelY = 0;
  var sonKameraMs = 0;
  var kameraSifirla = true;

  var top = {
    x: 520,
    y: 800,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    donus: 0,
    yariCap: 11,
    aslanMi: false,
    superMi: false,
    ortaMi: false,
    falso: 0,
    falsoSure: 0,
    sahip: null,
    sonVuran: null,
    sonTakim: null,
    sonPasAtan: null,
    pasHedef: null,
    pasKilitSure: 0,
    pasAlisKilidi: 0,
    almakYasakSure: 0,
    degajKoruma: 0,
    kapmaKoruma: 0,
    direkSoguma: 0,
    kivilcimSayac: 0,
    iz: [],
    izSayac: 0
  };

  var sonGunTopZaman = -10;
  var sonKurtarisMs = -10000;
  var sonHudAnahtar = '';

  // --- Girdi Durumu (Joystick + Klavye + Gamepad) ---

  var tuslar = {};
  var joyPointerId = null;
  var joyOriginX = 0;
  var joyOriginY = 0;
  var joyMaxR = 46;
  var joyX = 0;
  var joyY = 0;

  var padX = 0;
  var padY = 0;
  var oncekiPadButonlar = {};

  var sutSarjAktif = false;
  var sutSarjSure = 0;
  var tamponPasSure = 0;
  var tamponSutSure = 0;

  var sonPasPointerMs = -1000;
  var sonSutPointerMs = -1000;

  function girdiTamponSifirla() {
    sutSarjAktif = false;
    sutSarjSure = 0;
    tamponPasSure = 0;
    tamponSutSure = 0;
  }

  // --- Kadro ve Formasyon Kurulumu ---

  function varsayilanFormasyon7() {
    return [
      [0.50, 0.08],
      [0.30, 0.30],
      [0.70, 0.30],
      [0.25, 0.58],
      [0.75, 0.58],
      [0.36, 0.84],
      [0.64, 0.84]
    ];
  }

  function varsayilanFormasyon11() {
    return [
      [0.50, 0.06],
      [0.16, 0.30],
      [0.39, 0.25],
      [0.61, 0.25],
      [0.84, 0.30],
      [0.18, 0.57],
      [0.42, 0.54],
      [0.58, 0.54],
      [0.82, 0.57],
      [0.38, 0.84],
      [0.62, 0.84]
    ];
  }

  function formasyonKoordinatAl(takim, idx, sablon, saha, kadroBoyu) {
    var kadro = global.KADROLAR || {};
    var onbirMi = (kadroBoyu || 11) >= 11;
    var form = (onbirMi && Array.isArray(kadro.FORMASYON_11))
      ? kadro.FORMASYON_11
      : kadro.FORMASYON_7;
    var rx = 0.5;
    var ry = 0.5;

    if (Array.isArray(form) && form[idx]) {
      var item = form[idx];
      if (Array.isArray(item)) {
        rx = typeof item[0] === 'number' ? item[0] : 0.5;
        ry = typeof item[1] === 'number' ? item[1] : 0.5;
      } else if (typeof item === 'object') {
        rx = typeof item.rx === 'number' ? item.rx : (typeof item.x === 'number' ? item.x : 0.5);
        ry = typeof item.ry === 'number' ? item.ry : (typeof item.y === 'number' ? item.y : 0.5);
      }
    } else {
      var yedek = onbirMi ? varsayilanFormasyon11()[idx % 11] : varsayilanFormasyon7()[idx % 7];
      rx = yedek[0];
      ry = yedek[1];
    }

    // Eğer piksel koordinatı verilmişse normalize et
    if (rx > 1.05 || ry > 1.05) {
      var xPiksel = clamp(rx, saha.sol + 20, saha.sag - 20);
      var yPiksel = clamp(ry, saha.ust + 20, saha.alt - 20);
      return takim === 'GS'
        ? { x: xPiksel, y: yPiksel > saha.ortaY ? yPiksel : saha.alt - (yPiksel - saha.ust) }
        : { x: saha.W - xPiksel, y: yPiksel < saha.ortaY ? yPiksel : saha.ust + (saha.alt - yPiksel) };
    }

    if (takim === 'GS') {
      return {
        x: saha.sol + rx * saha.en,
        y: saha.alt - ry * saha.yariBoy
      };
    }
    return {
      x: saha.sol + (1 - rx) * saha.en,
      y: saha.ust + ry * saha.yariBoy
    };
  }

  function yedekKadro(takim) {
    if (takim === 'GS') {
      return [
        { ad: 'Uğurcan', no: 1, rol: 'GK', hiz: 1.0, sut: 0.55, sesKey: 'ugurcan' },
        { ad: 'Singo', no: 90, rol: 'DEF', hiz: 1.06, sut: 0.72, sesKey: 'singo' },
        { ad: 'Davinson', no: 6, rol: 'DEF', hiz: 1.02, sut: 0.72, sesKey: 'davinson' },
        { ad: 'Abdülkerim', no: 42, rol: 'DEF', hiz: 0.96, sut: 0.80, sesKey: 'abdulkerim' },
        { ad: 'Jacobs', no: 4, rol: 'DEF', hiz: 1.06, sut: 0.74, sesKey: 'jacobs' },
        { ad: 'Yunus', no: 11, rol: 'MID', hiz: 1.08, sut: 0.86, sesKey: 'yunus' },
        { ad: 'Torreira', no: 34, rol: 'MID', hiz: 1.06, sut: 0.78, sesKey: 'torreira' },
        { ad: 'Sara', no: 8, rol: 'MID', hiz: 1.05, sut: 0.86, sesKey: 'sara' },
        { ad: 'Sané', no: 10, rol: 'MID', hiz: 1.12, sut: 0.90, sesKey: 'sane' },
        { ad: 'Osimhen', no: 45, rol: 'FWD', hiz: 1.14, sut: 0.98, sesKey: 'osimhen' },
        { ad: 'GÜN', no: 61, rol: 'FWD', hiz: 1.18, sut: 1.15, sesKey: 'gun', gunMu: true }
      ];
    }
    return [
      { ad: 'Ederson', no: 31, rol: 'GK', hiz: 1.0, sut: 0.55, sesKey: 'ederson' },
      { ad: 'Mert', no: 18, rol: 'DEF', hiz: 1.02, sut: 0.70, sesKey: 'mert' },
      { ad: 'Škriniar', no: 37, rol: 'DEF', hiz: 0.98, sut: 0.70, sesKey: 'skriniar' },
      { ad: 'Oosterwolde', no: 24, rol: 'DEF', hiz: 1.05, sut: 0.74, sesKey: 'oosterwolde' },
      { ad: 'Aké', no: 15, rol: 'DEF', hiz: 1.02, sut: 0.72, sesKey: 'ake' },
      { ad: 'Asensio', no: 21, rol: 'MID', hiz: 1.06, sut: 0.90, sesKey: 'asensio' },
      { ad: 'Kanté', no: 91, rol: 'MID', hiz: 1.08, sut: 0.75, sesKey: 'kante' },
      { ad: 'Guendouzi', no: 8, rol: 'MID', hiz: 1.04, sut: 0.80, sesKey: 'guendouzi' },
      { ad: 'Kerem', no: 7, rol: 'MID', hiz: 1.08, sut: 0.88, sesKey: 'kerem' },
      { ad: 'Greenwood', no: 11, rol: 'FWD', hiz: 1.08, sut: 0.92, sesKey: 'greenwood' },
      { ad: 'Lukaku', no: 9, rol: 'FWD', hiz: 1.04, sut: 0.96, sesKey: 'lukaku' }
    ];
  }

  function oyuncuOlustur(sablon, takim, idx, saha, kadroBoyu) {
    var pos = formasyonKoordinatAl(takim, idx, sablon, saha, kadroBoyu);
    var p = {};
    if (sablon && typeof sablon === 'object') {
      for (var k in sablon) {
        if (Object.prototype.hasOwnProperty.call(sablon, k)) {
          p[k] = sablon[k];
        }
      }
    }
    var rol = String(p.rol || p.mevki || (idx === 0 ? 'GK' : 'MID')).toUpperCase();
    var kaleciMi = rol === 'GK' || rol === 'KL' || rol === 'KALECI' || idx === 0;
    var gunMu = Boolean(p.gunMu || p.no === 61 || p.numara === 61);

    p.id = takim + '_' + idx;
    p.idx = idx;
    p.takim = takim;
    p.rol = kaleciMi ? 'GK' : rol;
    p.kaleciMi = kaleciMi;
    p.gunMu = gunMu;
    p.no = p.no !== undefined ? p.no : (p.numara !== undefined ? p.numara : (idx + 1));
    p.ad = p.ad || p.isim || (takim + ' ' + p.no);
    p.hiz = typeof p.hiz === 'number' ? p.hiz : 1.0;
    p.sut = typeof p.sut === 'number' ? p.sut : 0.8;

    p.basX = pos.x;
    p.basY = pos.y;
    p.x = pos.x;
    p.y = pos.y;
    p.vx = 0;
    p.vy = 0;
    p.yonAci = takim === 'GS' ? -Math.PI * 0.5 : Math.PI * 0.5;
    p.kosuFaz = idx * 0.9;
    p.hamleT = 0;
    p.sutT = 0;
    p.sersemSure = 0;
    p.kaleciTutSure = 0;
    p.kaleciTutuyor = false;
    p.kurtarisSure = 0;
    p.ucusT = 0;
    p.ucusMax = 0.56;
    p.ucusYon = 0;
    p.ucusVx = 0;
    p.calimSoguma = 0;
    p.topTutmaSure = 0;
    p.sonPasVeren = null;
    p.aslanHazir = false;
    p.tacTutuyor = false;
    p.tacAtisT = 0;
    p.kafaT = 0;
    p.kafaMax = 0.46;
    p.ilkDokunusSure = 0;
    p.dribbleTozSayac = 0;
    p.yariCap = p.iri ? 21 : 19;
    return p;
  }

  function oyunculariKur() {
    var saha = sahaAl();
    var kadro = global.KADROLAR || {};
    var gsList = Array.isArray(kadro.GS) && kadro.GS.length > 0 ? kadro.GS : yedekKadro('GS');
    var rakipKod = (seciliRakip === 'BJK' || seciliRakip === 'TS') ? seciliRakip : 'FB';
    var fbRaw = (kadro.TAKIMLAR && Array.isArray(kadro.TAKIMLAR[rakipKod]) && kadro.TAKIMLAR[rakipKod].length > 0)
      ? kadro.TAKIMLAR[rakipKod]
      : (Array.isArray(kadro[rakipKod]) && kadro[rakipKod].length > 0 ? kadro[rakipKod] : kadro.FB);
    var fbList = Array.isArray(fbRaw) && fbRaw.length > 0 ? fbRaw : yedekKadro('FB');

    oyuncular = [];
    gsOyuncular = [];
    fbOyuncular = [];
    gunOyuncu = null;
    gsKaleci = null;
    fbKaleci = null;

    var i;
    for (i = 0; i < gsList.length; i++) {
      var gp = oyuncuOlustur(gsList[i], 'GS', i, saha, gsList.length);
      gp.kulup = 'GS';
      gsOyuncular.push(gp);
      oyuncular.push(gp);
      if (gp.gunMu) gunOyuncu = gp;
      if (gp.kaleciMi && !gsKaleci) gsKaleci = gp;
    }
    if (!gunOyuncu && gsOyuncular.length > 0) {
      gunOyuncu = gsOyuncular[gsOyuncular.length - 1];
      gunOyuncu.gunMu = true;
    }
    if (!gsKaleci && gsOyuncular.length > 0) {
      gsKaleci = gsOyuncular[0];
      gsKaleci.kaleciMi = true;
    }

    for (i = 0; i < fbList.length; i++) {
      var fp = oyuncuOlustur(fbList[i], 'FB', i, saha, fbList.length);
      fp.kulup = rakipKod;
      fbOyuncular.push(fp);
      oyuncular.push(fp);
      if (fp.kaleciMi && !fbKaleci) fbKaleci = fp;
    }
    if (!fbKaleci && fbOyuncular.length > 0) {
      fbKaleci = fbOyuncular[0];
      fbKaleci.kaleciMi = true;
    }

    aktifOyuncu = gunOyuncu || gsOyuncular[1] || gsOyuncular[0] || null;
  }

  function santraDizilisi(kimBaslar) {
    var saha = sahaAl();
    var baslayanTakim = kimBaslar === 'FB' ? 'FB' : 'GS';
    santraBaslayan = baslayanTakim;
    santraBekleSure = 0.85;
    fbPasSoguma = 0;
    darbeDuraklama = 0;
    var i;
    for (i = 0; i < oyuncular.length; i++) {
      var p = oyuncular[i];
      p.x = p.basX;
      p.y = p.basY;
      p.vx = 0;
      p.vy = 0;
      p.hamleT = 0;
      p.sutT = 0;
      p.sersemSure = 0;
      p.kaleciTutSure = 0;
      p.kaleciTutuyor = false;
      p.kurtarisSure = 0;
      p.ucusT = 0;
      p.ucusMax = 0.56;
      p.ucusYon = 0;
      p.ucusVx = 0;
      p.calimSoguma = 0;
      p.topTutmaSure = 0;
      p.sonPasVeren = null;
      p.aslanHazir = false;
      p.tacTutuyor = false;
      p.tacAtisT = 0;
      p.kafaT = 0;
      p.kafaMax = 0.46;
      p.ilkDokunusSure = 0;
      p.dribbleTozSayac = 0;
      p.yonAci = p.takim === 'GS' ? -Math.PI * 0.5 : Math.PI * 0.5;

      // Santra sırasında tüm oyuncular kendi yarı sahasında ve savunanlar orta yuvarlak dışında dursun
      if (p.takim === 'GS') {
        var gsMinY = baslayanTakim === 'FB' ? (saha.ortaY + 125) : (saha.ortaY + 48);
        if (p.y < gsMinY) p.y = gsMinY;
      } else if (p.takim === 'FB') {
        var fbMaxY = baslayanTakim === 'GS' ? (saha.ortaY - 125) : (saha.ortaY - 48);
        if (p.y > fbMaxY) p.y = fbMaxY;
      }
    }

    top.x = saha.ortaX;
    top.y = saha.ortaY;
    top.z = 0;
    top.vx = 0;
    top.vy = 0;
    top.vz = 0;
    top.aslanMi = false;
    top.superMi = false;
    top.ortaMi = false;
    top.falso = 0;
    top.falsoSure = 0;
    top.almakYasakSure = 0;
    top.degajKoruma = 0;
    top.kapmaKoruma = 0;
    top.pasKilitSure = 0;
    top.pasAlisKilidi = 0;
    top.direkSoguma = 0;
    sonYonSure = 0;
    pasHedefYonX = 0;
    pasHedefYonY = 0;
    top.sonVuran = null;
    top.sonTakim = null;
    top.sonPasAtan = null;
    top.pasHedef = null;
    top.sahip = null;
    top.iz.length = 0;
    top.izSayac = 0;
    duranTop = null;
    cutawayDurumu = false;
    cutawayBekleyen = null;
    golKutlamaBekliyor = false;
    golKutlamaGecikme = 0;
    golBilgiBekleyen = null;
    girdiTamponSifirla();

    if (kimBaslar === 'FB') {
      var fbForvet = fbOyuncular[fbOyuncular.length - 1] || fbOyuncular[1];
      if (fbForvet) {
        fbForvet.x = saha.ortaX;
        fbForvet.y = saha.ortaY - 14;
        fbForvet.yonAci = Math.PI * 0.5;
        topSahiplikVer(fbForvet, true);
      }
      if (gunOyuncu) {
        gunOyuncu.x = saha.ortaX;
        gunOyuncu.y = saha.ortaY + 115;
        aktifOyuncu = gunOyuncu;
      }
    } else {
      var baslatan = gunOyuncu || gsOyuncular[gsOyuncular.length - 1];
      if (baslatan) {
        baslatan.x = saha.ortaX;
        baslatan.y = saha.ortaY + 14;
        baslatan.yonAci = -Math.PI * 0.5;
        topSahiplikVer(baslatan, true);
        aktifOyuncu = baslatan;
      }
    }

    pasHedef = enUygunPasHedefi(aktifOyuncu, 0, -1);
    kameraSifirla = true;
  }

  // --- Sahiplik ve Girdi Hesabı ---

  function topSahiplikVer(p, sessizMi) {
    if (!p) return;
    var gelenHiz = hypot2(top.vx, top.vy);
    var oncekiSahip = top.sahip;
    if (oncekiSahip && oncekiSahip !== p) {
      oncekiSahip.kaleciTutuyor = false;
    }
    top.sahip = p;
    if (!p.kaleciMi) {
      p.kaleciTutuyor = false;
    }
    if (oncekiSahip !== p) {
      p.topTutmaSure = 0;
      if (!p.kaleciMi && !sessizMi && gelenHiz > 250) {
        p.ilkDokunusSure = 0.22;
        p.vx *= 0.62;
        p.vy *= 0.62;
        efektCagir('toz', top.x, top.y, 4);
        sesCal('pas', 0.30);
      }
    }
    top.iz.length = 0;
    top.izSayac = 0;
    top.z = p.kaleciMi ? 11 : 0;
    top.vz = 0;
    top.aslanMi = false;
    top.superMi = false;
    top.ortaMi = false;
    top.falso = 0;
    top.falsoSure = 0;
    top.pasHedef = null;
    top.pasKilitSure = 0;
    top.pasAlisKilidi = 0;
    top.degajKoruma = 0;
    var bazKoruma = p.kaleciMi ? 0.65 : (p.ilkDokunusSure > 0 ? 0.32 : 0.22);
    top.kapmaKoruma = Math.max(top.kapmaKoruma, bazKoruma);

    // GS pası tamamlandıysa Aslan Gücü doldur
    if (p.takim === 'GS' && oncekiSahip !== p && top.sonPasAtan && top.sonPasAtan !== p && top.sonPasAtan.takim === 'GS') {
      aslanGucuEkle(5);
    }
    top.sonPasAtan = null;

    if (p.takim === 'GS') {
      if (!p.kaleciMi) {
        aktifOyuncu = p;
      } else if (gunOyuncu) {
        aktifOyuncu = gunOyuncu;
      }
      if (p.gunMu && oncekiSahip !== p) {
        if (zaman - sonGunTopZaman > 0.35) {
          gunTopSayisi += 1;
          sonGunTopZaman = zaman;
        }
        if (!sessizMi && durum === 'oyun') {
          spikerCal('gun_top', 5000);
        }
      }
    }

    // Her iki takımdaki tüm yıldızların isim anonsu (top ayağına gelince)
    if (!sessizMi && durum === 'oyun' && oncekiSahip !== p && !p.gunMu && p.sesKey) {
      spikerCal('p_' + p.sesKey + '_top', 7500);
    }

    if (p.kaleciMi) {
      p.kaleciTutuyor = true;
      p.kaleciTutSure = p.takim === 'GS' ? 1.10 : 1.15;
      girdiTamponSifirla();
      return;
    }

    // Erken basılan tek-pas / tek-şut tamponlarını tetikle
    if (p.takim === 'GS' && durum === 'oyun' && !sessizMi) {
      var saha = sahaAl();
      var giris = kullaniciGirisAl();
      if (tamponSutSure > 0) {
        tamponSutSure = 0;
        tamponPasSure = 0;
        var voleHedef = gsSutHedefiSec(p, giris);
        if (aslanGucu >= 100 && p.y < saha.ust + 580) {
          aslanCutawayBaslat(p, voleHedef);
        } else {
          aslanGucuEkle(5);
          sutAt(p, voleHedef.x, voleHedef.y, false, 0.65);
        }
      } else if (tamponPasSure > 0) {
        tamponPasSure = 0;
        var pasHedefi = enUygunPasHedefi(p, giris.x, giris.y);
        pasAt(p, pasHedefi, giris.x, giris.y);
      }
    }
  }

  function aslanGucuEkle(miktar) {
    if (aslanGucu >= 100) return;
    if (gsSkor - fbSkor >= 2) miktar *= 0.75;
    aslanGucu = Math.min(100, aslanGucu + miktar);
  }

  function rakipDengeAl() {
    var fark = gsSkor - fbSkor;
    if (fark >= 3) {
      return {
        hiz: 1.22,
        baski: 1.24,
        kapmaMes: 29,
        kapmaOran: 1.55,
        kesmeCap: 20,
        pasSoguma: 0.78,
        pasHizCarp: 1.45,
        sutMesafe: 440,
        kafaGuc: 0.76,
        gkUcus: 435,
        gkHiz: 415,
        gkTut: 36,
        gkNormal: 27,
        gkKurt: 33,
        ikinciBaski: true
      };
    }
    if (fark === 2) {
      return {
        hiz: 1.16,
        baski: 1.18,
        kapmaMes: 27,
        kapmaOran: 1.40,
        kesmeCap: 18,
        pasSoguma: 0.90,
        pasHizCarp: 1.30,
        sutMesafe: 415,
        kafaGuc: 0.73,
        gkUcus: 420,
        gkHiz: 395,
        gkTut: 35,
        gkNormal: 26,
        gkKurt: 32,
        ikinciBaski: true
      };
    }
    if (fark === 1) {
      return {
        hiz: 1.04,
        baski: 1.05,
        kapmaMes: 24,
        kapmaOran: 1.08,
        kesmeCap: 14,
        pasSoguma: 1.15,
        pasHizCarp: 1.05,
        sutMesafe: 380,
        kafaGuc: 0.69,
        gkUcus: 395,
        gkHiz: 370,
        gkTut: 33,
        gkNormal: 24,
        gkKurt: 31,
        ikinciBaski: false
      };
    }
    if (fark < 0) {
      return {
        hiz: 0.95,
        baski: 0.95,
        kapmaMes: 23,
        kapmaOran: 0.90,
        kesmeCap: 12,
        pasSoguma: 1.35,
        pasHizCarp: 0.92,
        sutMesafe: 360,
        kafaGuc: 0.66,
        gkUcus: 375,
        gkHiz: 345,
        gkTut: 32,
        gkNormal: 23,
        gkKurt: 29,
        ikinciBaski: false
      };
    }
    return {
      hiz: 1.00,
      baski: 1.00,
      kapmaMes: 24,
      kapmaOran: 1.00,
      kesmeCap: 14,
      pasSoguma: 1.20,
      pasHizCarp: 1.00,
      sutMesafe: 375,
      kafaGuc: 0.68,
      gkUcus: 385,
      gkHiz: 360,
      gkTut: 33,
      gkNormal: 24,
      gkKurt: 31,
      ikinciBaski: false
    };
  }

  function kullaniciGirisAl() {
    var kx = 0;
    var ky = 0;
    if (tuslar['arrowleft'] || tuslar['keya']) kx -= 1;
    if (tuslar['arrowright'] || tuslar['keyd']) kx += 1;
    if (tuslar['arrowup'] || tuslar['keyw']) ky -= 1;
    if (tuslar['arrowdown'] || tuslar['keys']) ky += 1;
    if (kx !== 0 && ky !== 0) {
      var inv = 1 / Math.sqrt(2);
      kx *= inv;
      ky *= inv;
    }

    var jMag = hypot2(joyX, joyY);
    var kMag = hypot2(kx, ky);
    var pMag = hypot2(padX, padY);

    var bx = kx;
    var by = ky;
    var best = kMag;
    if (jMag > best) {
      bx = joyX;
      by = joyY;
      best = jMag;
    }
    if (pMag > best) {
      bx = padX;
      by = padY;
      best = pMag;
    }
    if (best > 1) {
      bx /= best;
      by /= best;
    }
    return { x: bx, y: by, mag: Math.min(1, best) };
  }

  // --- Pas Hedefleme (#61 GÜN Öncelikli) ---

  function noktaSegmentMesafe(px, py, ax, ay, bx, by) {
    var vx = bx - ax;
    var vy = by - ay;
    var len2 = vx * vx + vy * vy;
    if (len2 < 1) return hypot2(px - ax, py - ay);
    var t = clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1);
    return hypot2(px - (ax + vx * t), py - (ay + vy * t));
  }

  function enUygunPasHedefi(pasci, yonX, yonY, mevcutHedef) {
    if (!pasci) return null;
    var saha = sahaAl();
    var gsMi = pasci.takim === 'GS';
    var takim = gsMi ? gsOyuncular : fbOyuncular;
    var rakipler = gsMi ? fbOyuncular : gsOyuncular;
    var gMag = hypot2(yonX, yonY);
    var esik = gsMi ? 0.20 : 0.22;
    var ax = gMag > esik ? yonX / gMag : Math.cos(pasci.yonAci);
    var ay = gMag > esik ? yonY / gMag : Math.sin(pasci.yonAci);
    var maxMes = gsMi ? 620 : 590;

    var enIyi = null;
    var enSkor = -1e9;
    var enYakinYedek = null;
    var enYakinMes = 1e9;

    for (var i = 0; i < takim.length; i++) {
      var aday = takim[i];
      if (aday === pasci || aday.kaleciMi || aday.sersemSure > 0) continue;

      var dx = aday.x - pasci.x;
      var dy = aday.y - pasci.y;
      var mesafe = hypot2(dx, dy);
      if (mesafe < 24) continue;
      if (mesafe < enYakinMes) {
        enYakinMes = mesafe;
        enYakinYedek = aday;
      }
      if (mesafe > maxMes) continue;

      var ux = dx / mesafe;
      var uy = dy / mesafe;
      var hiza = ux * ax + uy * ay;

      var skor;
      if (gsMi) {
        if (gMag > 0.20) {
          // Kullanıcının nişan aldığı yön mutlak esastır (rakip/ileri sapması yok)
          skor = hiza * 440 - mesafe * 0.22;
          if (hiza <= 0.20) skor -= 340;
          if (mevcutHedef && aday === mevcutHedef) skor += 14;
        } else {
          // Yön basılı değilken baktığı yöndeki yakın takım arkadaşına
          skor = hiza * 220 - mesafe * 0.25;
          if (aday.gunMu && hiza > 0.1) skor += 40;
          if (mevcutHedef && aday === mevcutHedef) skor += 24;
        }
        // Hücum kanadındaysa ceza sahası içindeki arkadaşa orta açmayı öne al
        if (
          Math.abs(pasci.x - saha.ortaX) > 210 &&
          pasci.y < saha.ust + 560 &&
          aday.y < saha.ust + 340 &&
          Math.abs(aday.x - saha.ortaX) < 290
        ) {
          if (gMag <= 0.20) skor += 75;
          else if (hiza > 0.10) skor += 45;
        }
      } else {
        if (gMag > 0.22) {
          skor = hiza * 340 - mesafe * 0.14;
          if (hiza < -0.05) skor -= 260;
        } else {
          skor = hiza * 170 - mesafe * 0.16;
        }
        skor += dy * 0.10;
        if (aday === pasci.sonPasVeren) skor -= 280;
        for (var r = 0; r < rakipler.length; r++) {
          var rakip = rakipler[r];
          if (rakip.kaleciMi || rakip.sersemSure > 0) continue;
          if (noktaSegmentMesafe(rakip.x, rakip.y, pasci.x, pasci.y, aday.x, aday.y) < 36) {
            skor -= 130;
            break;
          }
        }
        if (mevcutHedef && aday === mevcutHedef) {
          skor += 42;
        }
      }

      if (skor > enSkor) {
        enSkor = skor;
        enIyi = aday;
      }
    }
    return enIyi || enYakinYedek;
  }

  // --- Pas, Kaleci Degajı, Kayma & Şut Aksiyonları ---

  function kaleciDegajAt(gk, saha, yonX, yonY, elleAt) {
    if (!gk) return false;
    var takim = gk.takim === 'GS' ? gsOyuncular : fbOyuncular;
    var rakipler = gk.takim === 'GS' ? fbOyuncular : gsOyuncular;
    var gMag = hypot2(yonX || 0, yonY || 0);
    var elIle = Boolean(elleAt);

    var enIyi = null;
    var enSkor = -1e9;
    for (var i = 0; i < takim.length; i++) {
      var aday = takim[i];
      if (aday === gk || aday.kaleciMi || aday.sersemSure > 0) continue;

      var dx = aday.x - gk.x;
      var dy = aday.y - gk.y;
      var mesafe = hypot2(dx, dy);
      if (mesafe < 80) continue;

      // Adayın çevresindeki en yakın rakibe olan açıklık
      var enYakinRakip = 999;
      for (var j = 0; j < rakipler.length; j++) {
        if (rakipler[j].kaleciMi) continue;
        var rd = hypot2(rakipler[j].x - aday.x, rakipler[j].y - aday.y);
        if (rd < enYakinRakip) enYakinRakip = rd;
      }

      var ileriFark = gk.takim === 'GS' ? -dy : dy;
      var idealMes = elIle ? 260 : 380;
      var skor = Math.min(240, enYakinRakip * 1.45) - Math.abs(mesafe - idealMes) * (elIle ? 0.24 : 0.18);
      if (ileriFark < 120) skor -= 220;
      if (gk.takim === 'GS' && aday.gunMu) skor += 45;
      if (gMag > 0.25) {
        var ux = dx / mesafe;
        var uy = dy / mesafe;
        skor += (ux * (yonX / gMag) + uy * (yonY / gMag)) * 165;
      }
      if (skor > enSkor) {
        enSkor = skor;
        enIyi = aday;
      }
    }

    var tx, ty;
    if (enIyi) {
      var tahminiSure = clamp(hypot2(enIyi.x - gk.x, enIyi.y - gk.y) / (elIle ? 560 : 700), 0.08, 0.52);
      tx = clamp(enIyi.x + enIyi.vx * tahminiSure * 0.4, saha.sol + 45, saha.sag - 45);
      ty = clamp(enIyi.y + enIyi.vy * tahminiSure * 0.4, saha.ust + 80, saha.alt - 80);
    } else {
      tx = clamp(saha.ortaX + (gMag > 0.2 ? yonX * 180 : 0), saha.sol + 80, saha.sag - 80);
      ty = gk.takim === 'GS' ? (saha.ortaY - 120) : (saha.ortaY + 120);
    }

    var kdx = tx - gk.x;
    var kdy = ty - gk.y;
    var dist = Math.max(1, hypot2(kdx, kdy));
    var uxDir = kdx / dist;
    var uyDir = kdy / dist;
    var hiz = elIle ? clamp(460 + dist * 0.52, 480, 640) : clamp(620 + dist * 0.65, 640, 840);

    top.sahip = null;
    top.sonVuran = gk;
    top.sonTakim = gk.takim;
    top.sonPasAtan = gk;
    top.pasHedef = enIyi;
    top.pasKilitSure = 1.15;
    top.pasAlisKilidi = enIyi ? 0.50 : 0;
    top.x = gk.x + uxDir * 28;
    top.y = gk.y + uyDir * 28;
    top.z = elIle ? 18 : 16;
    top.vx = uxDir * hiz;
    top.vy = uyDir * hiz;
    top.vz = elIle ? 58 : 235;
    top.aslanMi = false;
    top.superMi = false;
    top.falso = 0;
    top.falsoSure = 0;
    top.almakYasakSure = 0.45;
    top.degajKoruma = 0.36;

    gk.yonAci = Math.atan2(uyDir, uxDir);
    gk.kaleciTutuyor = false;
    gk.kaleciTutSure = 0;
    if (elIle) {
      gk.tacAtisT = 0.30;
      gk.sutT = 0;
    } else {
      gk.sutT = 0.28;
    }
    girdiTamponSifirla();

    if (gk.takim === 'GS' && enIyi && !enIyi.kaleciMi) {
      aktifOyuncu = enIyi;
      aktifDegisimSoguma = 0.30;
    }

    efektCagir('toz', gk.x, gk.y, 5);
    if (enIyi) {
      efektCagir('pasIzi', gk.x, gk.y, tx, ty);
    }
    sesCal(elIle ? 'pas' : 'vurus', elIle ? 0.88 : 0.95);
    if (gk.takim === 'GS' && !elIle) {
      spikerCal('degaj', 5500);
    }
    return true;
  }

  function pasAt(pasci, hedef, yonX, yonY) {
    if (!pasci) return false;
    var saha = sahaAl();
    if (pasci.kaleciMi) {
      return kaleciDegajAt(pasci, saha, yonX, yonY);
    }

    var tx, ty;
    if (hedef) {
      var mes = hypot2(hedef.x - pasci.x, hedef.y - pasci.y);
      var leadSure = clamp(mes / 640, 0.04, 0.22);
      tx = clamp(hedef.x + hedef.vx * leadSure * 0.30, saha.sol + 26, saha.sag - 26);
      ty = clamp(hedef.y + hedef.vy * leadSure * 0.30, saha.ust + 26, saha.alt - 26);
    } else {
      var ax = Math.cos(pasci.yonAci);
      var ay = Math.sin(pasci.yonAci);
      if (hypot2(yonX, yonY) > 0.2) {
        ax = yonX;
        ay = yonY;
      }
      tx = clamp(pasci.x + ax * 240, saha.sol + 24, saha.sag - 24);
      ty = clamp(pasci.y + ay * 240, saha.ust + 24, saha.alt - 24);
    }

    var dx = tx - pasci.x;
    var dy = ty - pasci.y;
    var dist = Math.max(1, hypot2(dx, dy));

    var engelVar = false;
    if (pasci.takim === 'GS' && hedef) {
      for (var ei = 0; ei < fbOyuncular.length; ei++) {
        var r = fbOyuncular[ei];
        if (r.kaleciMi || r.sersemSure > 0) continue;
        if (
          noktaSegmentMesafe(r.x, r.y, pasci.x, pasci.y, tx, ty) < 46 &&
          hypot2(r.x - pasci.x, r.y - pasci.y) > 34 &&
          hypot2(r.x - tx, r.y - ty) > 34
        ) {
          engelVar = true;
          break;
        }
      }
    }

    var kanatGS = pasci.takim === 'GS' && Math.abs(pasci.x - saha.ortaX) > 210 && pasci.y < saha.ust + 560 && ty < saha.ust + 350 && Math.abs(tx - saha.ortaX) < 310;
    var kanatFB = pasci.takim === 'FB' && Math.abs(pasci.x - saha.ortaX) > 210 && pasci.y > saha.alt - 560 && ty > saha.alt - 350 && Math.abs(tx - saha.ortaX) < 310;
    var ortaMi = Boolean(kanatGS || kanatFB);

    var hiz, pasVz, basZ;
    if (ortaMi) {
      // Kanattan ceza sahasına kavisli yüksek orta (kafa golü için)
      hiz = clamp(dist / 0.62, 430, 610);
      var ucusSure = dist / Math.max(360, hiz);
      pasVz = clamp(24 / Math.max(0.32, ucusSure) + 420 * ucusSure, 240, 345);
      basZ = 10;
    } else if (engelVar) {
      // Koridorda rakip varsa otomatik aşırtma pas (5 yaş dostu temiz geçiş)
      hiz = clamp(500 + dist * 0.45, 510, 675);
      pasVz = clamp(195 + dist * 0.20, 195, 285);
      basZ = 14;
    } else if (dist <= 340) {
      hiz = clamp(485 + dist * 0.56, 500, 675);
      pasVz = 14;
      basZ = 2;
    } else {
      hiz = clamp(635 + (dist - 340) * 0.16, 635, 675);
      pasVz = clamp(95 + (dist - 340) * 0.38, 95, 200);
      basZ = 4;
    }
    var tahminiVaris = dist / Math.max(360, hiz * 0.80);

    top.sahip = null;
    top.sonVuran = pasci;
    top.sonTakim = pasci.takim;
    top.sonPasAtan = pasci;
    top.pasHedef = hedef || null;
    top.pasKilitSure = clamp(tahminiVaris + 0.55, 0.90, 1.75);
    top.pasAlisKilidi = hedef ? clamp(tahminiVaris * 1.15, 0.28, 0.85) : 0;
    if (hedef) hedef.sonPasVeren = pasci;
    if (pasci.takim === 'FB') fbPasSoguma = rakipDengeAl().pasSoguma;
    top.x = pasci.x + (dx / dist) * 20;
    top.y = pasci.y + (dy / dist) * 20;
    top.z = basZ;
    top.vx = (dx / dist) * hiz;
    top.vy = (dy / dist) * hiz;
    top.vz = pasVz;
    top.aslanMi = false;
    top.superMi = false;
    top.ortaMi = ortaMi;
    top.falso = ortaMi ? (pasci.x < saha.ortaX ? 110 : -110) : 0;
    top.falsoSure = ortaMi ? 0.65 : 0;
    top.degajKoruma = 0;
    top.almakYasakSure = 0.24;

    pasci.yonAci = Math.atan2(dy, dx);
    pasci.sutT = 0.24;

    if (pasci.takim === 'GS' && hedef && !hedef.kaleciMi) {
      aktifOyuncu = hedef;
      aktifDegisimSoguma = 0.28;
    }

    efektCagir('pasIzi', pasci.x, pasci.y, tx, ty);
    sesCal('pas', 0.85);
    if (pasci.takim === 'GS' && hedef) {
      if (hedef.gunMu) {
        spikerCal('pas_gun', 3200);
      } else if (!hedef.kaleciMi) {
        if (dist > 195 && pasci.sesKey) {
          spikerCal('p_' + pasci.sesKey + '_aksiyon', 6000);
        } else if (Math.random() < 0.45) {
          spikerCal('pas_guzel', 6500);
        }
      }
    } else if (dist > 220 && pasci.sesKey) {
      spikerCal('p_' + pasci.sesKey + '_aksiyon', 6500);
    }
    return true;
  }

  function sutAt(atan, hedefX, hedefY, superMi, gucOran) {
    if (!atan) return false;
    var saha = sahaAl();
    var sarj = typeof gucOran === 'number' && isFinite(gucOran) ? clamp(gucOran, 0, 1) : 0.45;
    var derinUzaklastirma = !superMi && atan.takim === 'GS' && atan.y > saha.ust + 680;

    if (derinUzaklastirma) {
      hedefX = clamp(atan.x + (hedefX - saha.ortaX) * 2.2, saha.sol + 60, saha.sag - 60);
      hedefY = saha.ust + 160;
    }

    var dx = hedefX - atan.x;
    var dy = hedefY - atan.y;
    var dist = Math.max(1, hypot2(dx, dy));

    var hiz;
    if (superMi) {
      hiz = 980;
    } else if (derinUzaklastirma) {
      hiz = 780 + sarj * 200;
    } else {
      var sutCarp = typeof atan.sut === 'number' ? atan.sut : 0.9;
      hiz = clamp(720 + sarj * 320 + (sutCarp - 0.9) * 90, 720, 1080);
    }

    top.sahip = null;
    top.sonVuran = atan;
    top.sonTakim = atan.takim;
    top.sonPasAtan = null;
    top.pasHedef = null;
    top.pasKilitSure = 0;
    top.pasAlisKilidi = 0;
    top.degajKoruma = 0;
    top.x = atan.x + (dx / dist) * 20;
    top.y = atan.y + (dy / dist) * 20;
    top.z = superMi ? 10 : 4;
    top.vx = (dx / dist) * hiz;
    top.vy = (dy / dist) * hiz;
    // SAHA.kaleYukseklik = 58 olduğundan topun üst direği aşmaması için vz kontrollü tutulur
    top.vz = superMi ? 135 : (derinUzaklastirma ? 225 : (75 + sarj * 95));
    var sutGiris = (atan.takim === 'GS' && !superMi) ? kullaniciGirisAl() : null;
    var yonFalso = (sutGiris && Math.abs(sutGiris.x) > 0.12)
      ? clamp(sutGiris.x * 185, -185, 185)
      : 0;
    top.aslanMi = Boolean(superMi);
    top.superMi = Boolean(superMi);
    top.ortaMi = false;
    top.falso = superMi ? (saha.ortaX - hedefX) * 1.15 : yonFalso;
    top.falsoSure = superMi ? 0 : 0.42;
    top.almakYasakSure = 0.22;
    top.kivilcimSayac = 0;

    atan.yonAci = Math.atan2(dy, dx);
    atan.sutT = superMi ? 0.36 : 0.28;
    atan.aslanHazir = false;

    if (superMi) {
      darbeDuraklama = Math.max(darbeDuraklama, 0.045);
    } else if (sarj >= 0.55) {
      darbeDuraklama = Math.max(darbeDuraklama, 0.030);
    }

    efektCagir('sutKivilcim', top.x, top.y, top.vx, top.vy, Boolean(superMi));
    efektCagir('toz', atan.x, atan.y, superMi ? 10 : 5);
    sesCal('vurus', superMi ? 1.35 : (0.9 + sarj * 0.28));
    if (!superMi && (atan.takim === 'GS' || sarj >= 0.45)) {
      sesCal('tezahurat', 0.85);
    }
    if (!superMi && atan.takim === 'GS' && !derinUzaklastirma && sarj >= 0.60) {
      spikerCal('sut_sert', 4200);
    }
    return true;
  }

  function kafaVurusuAt(atan, hedefX, hedefY, gucOran) {
    if (!atan) return false;
    var sarj = typeof gucOran === 'number' && isFinite(gucOran) ? clamp(gucOran, 0, 1) : 0.78;
    var dx = hedefX - atan.x;
    var dy = hedefY - atan.y;
    var dist = Math.max(1, hypot2(dx, dy));
    var hiz = clamp(760 + sarj * 220, 760, 990);

    top.sahip = null;
    top.sonVuran = atan;
    top.sonTakim = atan.takim;
    top.sonPasAtan = null;
    top.pasHedef = null;
    top.pasKilitSure = 0;
    top.pasAlisKilidi = 0;
    top.degajKoruma = 0;
    top.ortaMi = false;
    top.aslanMi = false;
    top.superMi = false;
    top.falso = 0;
    top.falsoSure = 0;
    top.x = atan.x + (dx / dist) * 18;
    top.y = atan.y + (dy / dist) * 18;
    top.z = clamp(top.z, 24, 38);
    top.vx = (dx / dist) * hiz;
    top.vy = (dy / dist) * hiz;
    top.vz = 12 + sarj * 36;
    top.almakYasakSure = 0.26;

    atan.yonAci = Math.atan2(dy, dx);
    atan.kafaMax = 0.46;
    atan.kafaT = 0.46;
    atan.sutT = 0;
    atan.vx = (dx / dist) * 145;
    atan.vy = (dy / dist) * 145;

    darbeDuraklama = Math.max(darbeDuraklama, 0.032);
    efektCagir('sutKivilcim', top.x, top.y - top.z, top.vx, top.vy, false);
    efektCagir('kapmaYildiz', top.x, top.y - top.z);
    efektCagir('toz', atan.x, atan.y, 6);
    sesCal('kafa', 1.05);
    tribunTepkiCal('heyecan', 0.95);
    if (atan.takim === 'GS') {
      aslanGucuEkle(8);
    }
    return true;
  }

  function gsSutHedefiSec(atan, giris) {
    var saha = sahaAl();
    var kaleci = fbKaleci;
    var hedefX = saha.ortaX;
    if (giris && Math.abs(giris.x) > 0.22) {
      hedefX = saha.ortaX + clamp(giris.x, -1, 1) * (saha.kaleW * 0.42);
    } else if (kaleci) {
      // Kalecinin ters köşesine akıllı plase
      hedefX = kaleci.x >= saha.ortaX ? (saha.ortaX - 66) : (saha.ortaX + 66);
    }
    return {
      x: clamp(hedefX, saha.kaleSol + 22, saha.kaleSag - 22),
      y: saha.ust - 18
    };
  }

  function aslanCutawayBaslat(atan, hedef) {
    if (!atan) return;
    aslanGucu = 0;
    atan.aslanHazir = false;
    girdiTamponSifirla();
    cutawayDurumu = false;
    cutawayBekleyen = null;
    hudGuncelle(true);

    // Sahneyi dondurmadan ateşli Aslan Şutunu doğrudan sahada ateşle
    sutAt(atan, hedef.x, hedef.y, true);
    efektCagir('aslanCutaway', atan);
    sesCal('superSut', 1.1);
    tribunAyar(true, 0.76);
    tribunTepkiCal('heyecan', 1.25);   // Aslan Şutu: tribün ayağa kalkar (gol kükremesi gol olunca gelir)
    spikerCal('aslan_sutu', 1800);
  }

  function kaymaBaslat(oyuncu) {
    if (!oyuncu || oyuncu.hamleT > 0 || oyuncu.sersemSure > 0) return false;
    var hedefX = top.x;
    var hedefY = top.y;
    var dx = hedefX - oyuncu.x;
    var dy = hedefY - oyuncu.y;
    var dist = hypot2(dx, dy);

    var ax, ay;
    if (dist > 4) {
      ax = dx / dist;
      ay = dy / dist;
    } else {
      ax = Math.cos(oyuncu.yonAci);
      ay = Math.sin(oyuncu.yonAci);
    }
    oyuncu.yonAci = Math.atan2(ay, ax);
    oyuncu.vx = ax * 485;
    oyuncu.vy = ay * 485;
    oyuncu.hamleT = 0.28;
    efektCagir('toz', oyuncu.x, oyuncu.y, 7);
    return true;
  }

  function enYakinGsSahaOyuncusu() {
    var enYakin = null;
    var enDist = 1e9;
    for (var i = 0; i < gsOyuncular.length; i++) {
      var p = gsOyuncular[i];
      if (p.kaleciMi || p.sersemSure > 0) continue;
      var d = hypot2(p.x - top.x, p.y - top.y);
      if (d < enDist) {
        enDist = d;
        enYakin = p;
      }
    }
    return enYakin;
  }

  function pasVeyaKapTetikle() {
    if (durum !== 'oyun' || cutawayDurumu) return;
    tamponSutSure = 0;
    sutSarjAktif = false;
    sutSarjSure = 0;
    if (duranTop) {
      if (duranTop.asama === 'hazir' && duranTop.takim === 'GS') {
        duranTopKosuBaslat(false, 0.32);
      }
      return;
    }
    var saha = sahaAl();
    var giris = kullaniciGirisAl();

    if (top.sahip === gsKaleci) {
      if (gsKaleci.kaleciTutSure < 0.95) {
        kaleciDegajAt(gsKaleci, saha, giris.x, giris.y, true);
      }
      return;
    }

    if (top.sahip && top.sahip.takim === 'GS') {
      var pasci = top.sahip;
      var yonDegisti = giris.mag > 0.22 && hypot2(giris.x - pasHedefYonX, giris.y - pasHedefYonY) > 0.35;
      var gorunenHedef = (
        !yonDegisti &&
        pasHedef &&
        pasHedef !== pasci &&
        pasHedef.takim === 'GS' &&
        !pasHedef.kaleciMi &&
        pasHedef.sersemSure <= 0 &&
        hypot2(pasHedef.x - pasci.x, pasHedef.y - pasci.y) <= 640
      ) ? pasHedef : null;
      var axPas = giris.mag > 0.20 ? giris.x : (sonYonSure > 0 ? sonYonX : 0);
      var ayPas = giris.mag > 0.20 ? giris.y : (sonYonSure > 0 ? sonYonY : 0);
      var hedef = gorunenHedef || enUygunPasHedefi(pasci, axPas, ayPas, null);
      pasHedef = hedef;
      pasAt(pasci, hedef, axPas, ayPas);
      return;
    }

    // Aktif GS pası uçarken çift dokunuşta geri atma / kayma / oyuncu değişimi yapma
    if (!top.sahip && top.pasHedef && top.pasHedef.takim === 'GS' && top.pasKilitSure > 0) {
      if (top.almakYasakSure > 0) {
        return;
      }
      if (hypot2(top.x - top.pasHedef.x, top.y - top.pasHedef.y) < 62) {
        tamponPasSure = 0.18;
      }
      return;
    }

    // Top havada/yerde aktif oyuncuya çok yakınsa tek-pas tamponu
    if (!top.sahip && aktifOyuncu && hypot2(top.x - aktifOyuncu.x, top.y - aktifOyuncu.y) < 110) {
      tamponPasSure = 0.22;
      return;
    }

    // Savunmada aktif oyuncu topa uzaksa hemen en yakın takım arkadaşına geç; yakınsa kay
    if (aktifOyuncu && hypot2(top.x - aktifOyuncu.x, top.y - aktifOyuncu.y) > 105) {
      var yakin = enYakinGsSahaOyuncusu();
      if (yakin) {
        aktifOyuncu = yakin;
        aktifDegisimSoguma = 0.22;
        return;
      }
    }

    if (aktifOyuncu) {
      kaymaBaslat(aktifOyuncu);
    }
  }

  function sutBasla() {
    if (durum !== 'oyun' || cutawayDurumu) return;
    if (duranTop) {
      if (duranTop.asama === 'hazir' && duranTop.takim === 'GS') {
        duranTop.sarjAktif = true;
        duranTop.gucSarj = Math.max(0.14, duranTop.gucSarj || 0);
      }
      return;
    }
    var saha = sahaAl();
    var giris = kullaniciGirisAl();

    if (top.sahip === gsKaleci) {
      if (gsKaleci.kaleciTutSure < 0.95) {
        kaleciDegajAt(gsKaleci, saha, giris.x, giris.y, false);
      }
      return;
    }

    if (top.sahip && top.sahip.takim === 'GS') {
      if (aslanGucu >= 100 && top.sahip.y < saha.ust + 580) {
        var hedef = gsSutHedefiSec(top.sahip, giris);
        aslanCutawayBaslat(top.sahip, hedef);
      } else {
        sutSarjAktif = true;
        sutSarjSure = 0;
      }
      return;
    }

    // Top yakında ve boşsa gelişine anında kafa/vole / orta mesafeyse tampon
    if (!top.sahip && aktifOyuncu) {
      var mes = hypot2(top.x - aktifOyuncu.x, top.y - aktifOyuncu.y);
      var voleHedef = gsSutHedefiSec(aktifOyuncu, giris);
      if (mes < 88 && top.z >= 15 && top.z <= 64) {
        kafaVurusuAt(aktifOyuncu, voleHedef.x, voleHedef.y, 0.86);
        return;
      }
      if (mes < 72 && top.z < 15) {
        if (aslanGucu >= 100 && aktifOyuncu.y < saha.ust + 580) {
          aslanCutawayBaslat(aktifOyuncu, voleHedef);
        } else {
          aslanGucuEkle(5);
          sutAt(aktifOyuncu, voleHedef.x, voleHedef.y, false, 0.58);
        }
        return;
      }
      if (top.ortaMi || top.z >= 14 || mes < 190) {
        tamponSutSure = 0.72;
        return;
      }
      kaymaBaslat(aktifOyuncu);
    }
  }

  function sutBirak() {
    if (duranTop && duranTop.sarjAktif) {
      var duranGuc = clamp(duranTop.gucSarj || 0.25, 0.16, 1);
      duranTop.sarjAktif = false;
      if (durum === 'oyun' && duranTop.asama === 'hazir' && duranTop.takim === 'GS') {
        var uzunMu = duranGuc >= 0.30 || duranTop.tip === 'korner' || duranTop.tip === 'aut';
        duranTopKosuBaslat(uzunMu, duranGuc);
      }
      return;
    }
    if (!sutSarjAktif) return;
    var gucOran = clamp(sutSarjSure / 0.48, 0, 1);
    sutSarjAktif = false;
    sutSarjSure = 0;

    if (durum !== 'oyun' || cutawayDurumu || duranTop) return;
    var saha = sahaAl();
    if (top.sahip && top.sahip.takim === 'GS' && !top.sahip.kaleciMi) {
      var giris = kullaniciGirisAl();
      var atan = top.sahip;
      var hedef = gsSutHedefiSec(atan, giris);
      if (aslanGucu >= 100 && atan.y < saha.ust + 580) {
        aslanCutawayBaslat(atan, hedef);
      } else {
        aslanGucuEkle(5);
        sutAt(atan, hedef.x, hedef.y, false, gucOran);
      }
    }
  }

  function sutTetikle() {
    sutBasla();
    if (duranTop && duranTop.sarjAktif) {
      duranTop.gucSarj = 0.55;
      sutBirak();
      return;
    }
    if (sutSarjAktif) {
      sutSarjSure = 0.20; // anlık dokunuşta orta-hızlı net şut
      sutBirak();
    }
  }

  // --- Maç Durum Geçişleri ---

  function perdeleriSenkronla() {
    perdeGizle(dom.perdeBaslik);
    perdeGizle(dom.perdeDevre);
    perdeGizle(dom.perdeGol);
    perdeGizle(dom.perdeMola);
    perdeGizle(dom.perdeSonuc);

    if (dom.dokunmatikKatman) {
      if (durum === 'oyun') {
        perdeGoster(dom.dokunmatikKatman, 'block');
        dom.dokunmatikKatman.style.pointerEvents = '';
      } else {
        perdeGizle(dom.dokunmatikKatman);
        dom.dokunmatikKatman.style.pointerEvents = 'none';
      }
    }

    if (dom.molaBtn) {
      if (durum === 'oyun') {
        perdeGoster(dom.molaBtn, 'inline-flex');
      } else {
        perdeGizle(dom.molaBtn);
      }
    }

    if (durum === 'baslik') {
      perdeGoster(dom.perdeBaslik, 'flex');
    } else if (durum === 'devre') {
      perdeGoster(dom.perdeDevre, 'flex');
    } else if (durum === 'gol') {
      if (!(global.EFEKT && typeof global.EFEKT.golPatlat === 'function')) {
        perdeGoster(dom.perdeGol, 'flex');
      }
    } else if (durum === 'mola') {
      perdeGoster(dom.perdeMola, 'flex');
    } else if (durum === 'sonuc') {
      perdeGoster(dom.perdeSonuc, 'flex');
    }
  }

  function sureFormatla(sn) {
    if (altinGol) return 'ALTIN';
    var tam = Math.max(0, Math.ceil(sn));
    var dk = Math.floor(tam / 60);
    var kal = tam % 60;
    return (dk < 10 ? '0' : '') + dk + ':' + (kal < 10 ? '0' : '') + kal;
  }

  function hudGuncelle(zorla) {
    var sureMetin = sureFormatla(kalanSure);
    var yariMetin = altinGol ? 'ALTIN GOL' : (yari === 1 ? '1. YARI' : '2. YARI');
    var aslanYuzde = Math.round(clamp(aslanGucu, 0, 100));
    var anahtar = gsSkor + '|' + fbSkor + '|' + sureMetin + '|' + yariMetin + '|' + aslanYuzde + '|' + durum;
    if (!zorla && anahtar === sonHudAnahtar) return;
    sonHudAnahtar = anahtar;

    if (dom.gsSkor) dom.gsSkor.textContent = String(gsSkor);
    if (dom.fbSkor) dom.fbSkor.textContent = String(fbSkor);
    if (dom.macSure) dom.macSure.textContent = sureMetin;
    if (dom.macYari) dom.macYari.textContent = yariMetin;

    var hazirMi = aslanGucu >= 100;
    if (dom.aslanDolu) {
      dom.aslanDolu.style.width = aslanYuzde + '%';
    }
    if (dom.aslanYazi) {
      dom.aslanYazi.textContent = hazirMi
        ? 'ASLAN VURUŞU HAZIR!'
        : (aslanYuzde > 0 ? ('ASLAN VURUŞU %' + aslanYuzde) : 'ASLAN VURUŞU');
    }
    if (dom.aslanKutu) {
      dom.aslanKutu.classList.toggle('hazir', hazirMi);
      dom.aslanKutu.classList.toggle('aslan-hazir', hazirMi);
    }
    if (dom.btnSut) {
      dom.btnSut.classList.toggle('aslan-hazir', hazirMi);
    }
  }

  function maciBaslat() {
    odakBirak();
    sesAcIlkDokunus();
    gsSkor = 0;
    fbSkor = 0;
    yari = 1;
    kalanSure = yariSure;
    aslanGucu = 0;
    altinGol = false;
    gunTopSayisi = 0;
    goller = [];
    otoBekleSure = 0;
    golBekleSure = 0;
    golKutlamaBekliyor = false;
    golKutlamaGecikme = 0;
    golBilgiBekleyen = null;
    cutawayDurumu = false;
    cutawayBekleyen = null;
    duranTop = null;
    fbPasSoguma = 0;
    sonYonSure = 0;
    pasHedefYonX = 0;
    pasHedefYonY = 0;
    sonSpikerMs = {};
    sonGunTopZaman = -10;
    girdiTamponSifirla();

    if (global.SAHA && typeof global.SAHA.sifirla === 'function') {
      guvenliCagir('SAHA.sifirla', function () { global.SAHA.sifirla(); });
    }
    efektCagir('sifirla');

    oyunculariKur();
    santraDizilisi('GS');
    durum = 'oyun';
    perdeleriSenkronla();
    hudGuncelle(true);

    sesCal('duduk', 1.0);
    tribunAyar(true, 0.44);
    spikerCal('basla', 1000);
  }

  function devreArasiAc() {
    durum = 'devre';
    otoBekleSure = 0.85;
    golKutlamaBekliyor = false;
    golKutlamaGecikme = 0;
    golBilgiBekleyen = null;
    girdiTamponSifirla();
    if (dom.devreSkor) dom.devreSkor.textContent = gsSkor + ' - ' + fbSkor;
    if (dom.devreYazi) {
      if (gsSkor > fbSkor) {
        dom.devreYazi.textContent = 'Harika gidiyorsun Gün! Öndeyiz!';
      } else if (gsSkor < fbSkor) {
        dom.devreYazi.textContent = '2. yarıda çevirebiliriz! Bastır Gün!';
      } else {
        dom.devreYazi.textContent = 'Maç başa baş! Aslan Şutu seni bekliyor!';
      }
    }
    perdeleriSenkronla();
    hudGuncelle(true);
    sesCal('dudukUzun', 1.0);
    tribunAyar(true, 0.26);
    spikerCal('devre', 1000);
  }

  function ikinciYariBaslat() {
    odakBirak();
    sesAcIlkDokunus();
    yari = 2;
    kalanSure = yariSure;
    altinGol = false;
    santraDizilisi('FB');
    durum = 'oyun';
    perdeleriSenkronla();
    hudGuncelle(true);
    sesCal('duduk', 1.0);
    tribunAyar(true, 0.44);
    spikerCal('ikinci_yari', 1000);
  }

  function altinGolBaslat() {
    altinGol = true;
    yari = 3;
    kalanSure = 0;
    santraDizilisi('GS');
    durum = 'oyun';
    perdeleriSenkronla();
    hudGuncelle(true);
    sesCal('duduk', 1.1);
    tribunAyar(true, 0.54);
    spikerCal('altin_gol', 1000);
  }

  function molaAc() {
    if (durum !== 'oyun') return;
    tuslar = {};
    joyPointerId = null;
    joyX = 0;
    joyY = 0;
    girdiTamponSifirla();
    durum = 'mola';
    perdeleriSenkronla();
    hudGuncelle(true);
    tribunAyar(false, 0);
  }

  function molaKapat() {
    if (durum !== 'mola') return;
    odakBirak();
    durum = 'oyun';
    perdeleriSenkronla();
    hudGuncelle(true);
    tribunAyar(true, 0.44);
  }

  function anaEkranaDon() {
    odakBirak();
    tuslar = {};
    joySifirla();
    girdiTamponSifirla();
    duranTop = null;
    cutawayDurumu = false;
    cutawayBekleyen = null;
    golKutlamaBekliyor = false;
    golKutlamaGecikme = 0;
    golBilgiBekleyen = null;
    if (global.SES && typeof global.SES.durdur === 'function') {
      guvenliCagir('SES.durdur', function () { global.SES.durdur(); });
    } else {
      tribunAyar(false, 0);
    }
    efektCagir('sifirla');
    durum = 'baslik';
    santraDizilisi('GS');
    perdeleriSenkronla();
    hudGuncelle(true);
  }

  function maciBitir() {
    girdiTamponSifirla();
    golKutlamaBekliyor = false;
    golKutlamaGecikme = 0;
    golBilgiBekleyen = null;
    durum = 'sonuc';
    var kazananGS = gsSkor > fbSkor;
    if (dom.sonucBaslik) {
      dom.sonucBaslik.textContent = kazananGS
        ? 'ŞAMPİYON GALATASARAY!'
        : (gsSkor === fbSkor ? 'DERBİ BERABERE!' : 'HARİKA MÜCADELE!');
    }
    if (dom.sonucSkor) {
      dom.sonucSkor.textContent = gsSkor + ' - ' + fbSkor;
    }
    if (dom.sonucIstat) {
      var aslanGolSayisi = 0;
      var i;
      for (i = 0; i < goller.length; i++) {
        if (goller[i].aslanMi) aslanGolSayisi++;
      }
      dom.sonucIstat.textContent = 'GÜN topla buluşma: ' + gunTopSayisi +
        ' · Toplam gol: ' + goller.length +
        (aslanGolSayisi > 0 ? ' · Aslan Şutu golü: ' + aslanGolSayisi : '');
    }

    perdeleriSenkronla();
    hudGuncelle(true);

    sesCal('dudukUzun', 1.0);
    tribunAyar(true, kazananGS ? 0.58 : 0.30);
    if (kazananGS) {
      var saha = sahaAl();
      efektCagir('golPatlat', saha.ortaX, saha.ortaY * 0.55, 'GS', gunOyuncu);
      sesCal('zafer', 1.1);
      spikerCal('zafer', 1200);
    } else {
      tribunTepkiCal('alkis', 0.7);
      spikerCal('mac_sonu', 1200);
    }
  }

  function golKutlamasiniTetikle() {
    if (!golBilgiBekleyen) return;
    var saha = sahaAl();
    var bilgi = golBilgiBekleyen;
    golBilgiBekleyen = null;
    golKutlamaBekliyor = false;

    var takim = bilgi.takim;
    var atan = bilgi.atan;
    var ustKaleMi = bilgi.ustKaleMi;
    var aslanMi = bilgi.aslanMi;

    if (!bilgi.agVuruldu) {
      if (global.SAHA && typeof global.SAHA.agSalla === 'function') {
        guvenliCagir('SAHA.agSalla', function () {
          global.SAHA.agSalla(ustKaleMi, top.x, Math.min(2.4, Math.max(1.0, hypot2(top.vx, top.vy) / 420)));
        });
      }
      sesCal('ag', 1.25);
      bilgi.agVuruldu = true;
    }

    if (global.SAHA && typeof global.SAHA.coskuTetikle === 'function') {
      guvenliCagir('SAHA.coskuTetikle', function () {
        global.SAHA.coskuTetikle(takim, 2.8);
      });
    }

    var rakipMeta = rakipBilgiAl(seciliRakip);
    var takimKod = takim === 'GS' ? 'GS' : seciliRakip;

    if (takim === 'GS') gsSkor += 1;
    else fbSkor += 1;

    goller.push({
      takim: takimKod,
      atan: atan ? atan.ad : rakipMeta.ad,
      no: atan ? atan.no : null,
      yari: yari,
      sure: Number(Math.max(0, kalanSure).toFixed(1)),
      aslanMi: aslanMi
    });

    if (dom.golBaslik) {
      dom.golBaslik.textContent = takim === 'GS'
        ? (aslanMi ? 'ASLAN ŞUTU GOOOOL!' : 'GOOOOL!')
        : 'GOL!';
    }
    if (dom.golDetay) {
      var adEtiket = atan ? atan.ad : rakipMeta.ad;
      dom.golDetay.textContent = takimKod + ' · ' + adEtiket;
    }
    if (dom.perdeGol) {
      dom.perdeGol.classList.toggle('fb', takim === 'FB' && seciliRakip === 'FB');
      dom.perdeGol.classList.toggle('bjk', takim === 'FB' && seciliRakip === 'BJK');
      dom.perdeGol.classList.toggle('ts', takim === 'FB' && seciliRakip === 'TS');
      dom.perdeGol.classList.toggle('aslan', Boolean(aslanMi && takim === 'GS'));
    }

    efektCagir('golPatlat', top.x, ustKaleMi ? saha.ust : saha.alt, takimKod, atan);
    if (takim !== 'GS') {
      tribunTepkiCal('ah', 1.0);        // rakip golü: tribünden hayal kırıklığı
    }
    tribunAyar(true, takim === 'GS' ? 0.78 : 0.34);
    if (takim === 'GS') {
      tribunTezahuratCal('gol');
    }

    if (takim === 'GS') {
      if (atan && atan.gunMu) {
        spikerCal('gol_gun', 800);
      } else {
        spikerCal('gol_gs', 800);
      }
    } else {
      spikerCal(seciliRakip === 'BJK' ? 'gol_bjk' : (seciliRakip === 'TS' ? 'gol_ts' : 'gol_fb'), 800);
    }

    top.aslanMi = false;
    top.superMi = false;
    top.falso = 0;

    perdeleriSenkronla();
    hudGuncelle(true);
  }

  function golOldu(takim) {
    if (durum !== 'oyun') return;
    var ustKaleMi = takim === 'GS';

    var atan = top.sonVuran;
    if (!atan || atan.takim !== takim) {
      var liste = takim === 'GS' ? gsOyuncular : fbOyuncular;
      var enYakin = null;
      var enMes = 1e9;
      for (var i = 0; i < liste.length; i++) {
        var d = hypot2(liste[i].x - top.x, liste[i].y - top.y);
        if (d < enMes) {
          enMes = d;
          enYakin = liste[i];
        }
      }
      atan = enYakin;
    }

    // 1. Aşama: Önce top filelere doğru gidip ağı sarsın; kutlama ağ sarsılınca başlasın
    top.vx *= 0.78;
    top.vy *= 0.85;
    if (ustKaleMi) {
      if (top.vy > -220) top.vy = -220;
    } else {
      if (top.vy < 220) top.vy = 220;
    }
    top.sahip = null;
    for (var ci = 0; ci < oyuncular.length; ci++) {
      oyuncular[ci].kaleciTutuyor = false;
    }
    top.pasHedef = null;
    top.pasKilitSure = 0;
    top.pasAlisKilidi = 0;
    girdiTamponSifirla();

    durum = 'gol';
    golKutlamaBekliyor = true;
    golKutlamaGecikme = 0;
    golBekleSure = 2.35;
    golSonrakiBaslayan = takim === 'GS' ? 'FB' : 'GS';
    golBilgiBekleyen = {
      takim: takim,
      atan: atan,
      ustKaleMi: ustKaleMi,
      aslanMi: Boolean(top.aslanMi),
      agVuruldu: false
    };
    golKutlamasiniTetikle();
  }

  // --- Otomatik Oyuncu Seçimi ---

  function otomatikOyuncuSec() {
    if (top.sahip && top.sahip.takim === 'GS') {
      if (!top.sahip.kaleciMi) {
        aktifOyuncu = top.sahip;
      }
      return;
    }
    if (top.pasKilitSure > 0 && top.pasHedef && top.pasHedef.takim === 'GS' && !top.pasHedef.kaleciMi && top.pasHedef.sersemSure <= 0) {
      aktifOyuncu = top.pasHedef;
      return;
    }
    if (aktifDegisimSoguma > 0 && aktifOyuncu && !aktifOyuncu.kaleciMi && aktifOyuncu.sersemSure <= 0) {
      return;
    }

    var predX = top.x + top.vx * 0.14;
    var predY = top.y + top.vy * 0.14;
    var enYakin = null;
    var enSkor = 1e9;

    for (var i = 0; i < gsOyuncular.length; i++) {
      var p = gsOyuncular[i];
      if (p.kaleciMi || p.sersemSure > 0) continue;
      var d = hypot2(p.x - predX, p.y - predY);
      if (p.gunMu) d -= 14; // Gün'e hafif seçilme avantajı
      if (p === aktifOyuncu) d -= 42; // Histerezis: titreşimi önle
      if (d < enSkor) {
        enSkor = d;
        enYakin = p;
      }
    }

    if (enYakin && enYakin !== aktifOyuncu) {
      aktifOyuncu = enYakin;
      aktifDegisimSoguma = 0.22;
    }
  }

  // --- Fizik, Kaleciler, Direkler & Saha Sınırları ---

  function kaleciGuncelle(gk, rakipTakimMi, dt, saha) {
    if (!gk) return;
    var ustMu = gk.takim === 'FB';
    var anaY = ustMu ? (saha.ust + 48) : (saha.alt - 48);

    if (gk.sersemSure > 0) {
      gk.sersemSure -= dt;
      gk.x += gk.vx * dt;
      gk.y += gk.vy * dt;
      gk.vx *= Math.exp(-5 * dt);
      gk.vy *= Math.exp(-5 * dt);
      gk.x = clamp(gk.x, saha.kaleSol - 20, saha.kaleSag + 20);
      gk.y = clamp(gk.y, saha.ust + 14, saha.alt - 14);
      return;
    }

    if (gk.kurtarisSure > 0) {
      gk.kurtarisSure -= dt;
    }

    // Uçarak kurtarış animasyonu ve kayması
    if (gk.ucusT > 0) {
      gk.ucusT = Math.max(0, gk.ucusT - dt);
      var ucusMax = Math.max(0.1, gk.ucusMax || 0.56);
      var prog = 1 - gk.ucusT / ucusMax;
      var drag = prog < 0.72 ? Math.exp(-2.0 * dt) : Math.exp(-8.0 * dt);
      gk.ucusVx *= drag;
      gk.vx = gk.ucusVx;
      gk.vy = (anaY - gk.y) * 4;
      gk.x = clamp(gk.x + gk.vx * dt, saha.kaleSol - 26, saha.kaleSag + 26);
      gk.y = clamp(gk.y + gk.vy * dt, saha.ust + 14, saha.alt - 14);
      gk.yonAci = gk.ucusYon > 0 ? 0 : Math.PI;
      if (top.sahip === gk) {
        gk.kaleciTutuyor = true;
        gk.ucusT = Math.min(gk.ucusT, 0.22);
      }
      if (gk.ucusT <= 0) {
        gk.ucusYon = 0;
        gk.ucusVx = 0;
      }
      return;
    }

    // Kaleci topu yakaladıysa 2 adım ceza sahası önüne yürür; ardından elle pas veya uzun degaj çıkarır
    if (top.sahip === gk) {
      gk.kaleciTutuyor = true;
      var hedefY = ustMu ? (saha.ust + 104) : (saha.alt - 104);
      var hedefX = clamp(gk.x, saha.kaleSol + 26, saha.kaleSag - 26);
      var tdx = hedefX - gk.x;
      var tdy = hedefY - gk.y;
      var tMes = hypot2(tdx, tdy);
      if (tMes > 3) {
        var tutHiz = Math.min(95, tMes * 5);
        gk.vx = (tdx / tMes) * tutHiz;
        gk.vy = (tdy / tMes) * tutHiz;
        gk.x += gk.vx * dt;
        gk.y += gk.vy * dt;
        gk.kosuFaz += tutHiz * dt * 0.05;
      } else {
        gk.vx = 0;
        gk.vy = 0;
      }
      gk.yonAci = ustMu ? Math.PI * 0.5 : -Math.PI * 0.5;
      gk.kaleciTutSure -= dt;
      if (gk.kaleciTutSure <= 0) {
        kaleciDegajAt(gk, saha, 0, ustMu ? 1 : -1, Math.random() < 0.45);
      }
      return;
    }
    if (gk.kaleciTutuyor) gk.kaleciTutuyor = false;

    // Kaleye yaklaşan şuta göre hedef X hesapla (uzun orta saha toplarında da karşıla)
    var hedefX = clamp(top.x, saha.kaleSol + 26, saha.kaleSag - 26);
    var sutGeliyor = !top.sahip && (ustMu ? (top.vy < -170 && top.y < saha.ust + 720) : (top.vy > 170 && top.y > saha.alt - 660));

    if (sutGeliyor && Math.abs(top.vy) > 1) {
      var kalanY = Math.abs(anaY - top.y);
      var tVaris = clamp(kalanY / Math.abs(top.vy), 0, 0.7);
      var tahminX = top.x + top.vx * tVaris;
      hedefX = clamp(tahminX, saha.kaleSol + 20, saha.kaleSag - 20);
      if (gk.kurtarisSure <= 0 && Math.abs(hedefX - gk.x) > 16) {
        gk.kurtarisSure = 0.42;
      }
      // Köşeye giden sert şuta uçarak hamle yap
      var denge = rakipDengeAl();
      if (
        !top.ortaMi &&
        Math.abs(top.vy) > 220 &&
        tahminX >= saha.kaleSol - 28 &&
        tahminX <= saha.kaleSag + 28 &&
        tVaris <= 0.48 &&
        Math.abs(hedefX - gk.x) >= 24
      ) {
        gk.ucusYon = hedefX >= gk.x ? 1 : -1;
        gk.ucusMax = 0.56;
        gk.ucusT = 0.56;
        gk.kurtarisSure = 0.56;
        var maxUcusHiz = gk.takim === 'GS' ? 430 : denge.gkUcus;
        gk.ucusVx = gk.ucusYon * clamp((Math.abs(hedefX - gk.x) / Math.max(0.18, tVaris)) * 0.92, 280, maxUcusHiz);
        efektCagir('toz', gk.x, gk.y, 7);
        sesCal('ucus', 0.9);
        return;
      }
    }

    var dengeHiz = rakipDengeAl();
    var dx = hedefX - gk.x;
    var dy = anaY - gk.y;
    var maxHiz = sutGeliyor ? (ustMu ? dengeHiz.gkHiz : 255) : (ustMu ? 250 : 225);
    var dist = hypot2(dx, dy);
    if (dist > 3) {
      var hiz = Math.min(maxHiz, dist * 7.5);
      gk.vx = (dx / dist) * hiz;
      gk.vy = (dy / dist) * hiz;
      gk.x += gk.vx * dt;
      gk.y += gk.vy * dt;
      gk.yonAci = Math.atan2(gk.vy, gk.vx);
      gk.kosuFaz += hiz * dt * 0.05;
    } else {
      gk.vx = 0;
      gk.vy = 0;
      gk.yonAci = ustMu ? Math.PI * 0.5 : -Math.PI * 0.5;
    }
  }

  function kaleciTopTemasiKontrol(gk, saha) {
    if (!gk || top.sahip || gk.sersemSure > 0) return false;
    // Kendi degajında veya takım koruması altındayken asla kendini tekrar yakalayıp kilitlenme
    if (gk === top.sonVuran && top.almakYasakSure > 0) return false;
    if (top.degajKoruma > 0 && top.sonTakim === gk.takim) return false;

    var denge = rakipDengeAl();
    var ucuyorMu = gk.ucusT > 0;
    var tutYariCap = ucuyorMu
      ? (gk.takim === 'GS' ? 36 : denge.gkTut)
      : (gk.takim === 'FB'
        ? (gk.kurtarisSure > 0 ? denge.gkKurt : denge.gkNormal)
        : (gk.kurtarisSure > 0 ? 27 : 20));
    var maxZ = ucuyorMu ? (saha.kaleYukseklik + 10) : (saha.kaleYukseklik + 6);
    if (top.z >= maxZ) return false;
    var d = ucuyorMu
      ? Math.min(hypot2(top.x - gk.x, top.y - gk.y), hypot2(top.x - (gk.x + gk.ucusYon * 14), top.y - gk.y))
      : hypot2(top.x - gk.x, top.y - gk.y);
    if (d > tutYariCap) return false;

    // Aslan Şutu kaleciyi savurabilir!
    if (top.aslanMi && top.sonTakim !== gk.takim) {
      gk.sersemSure = 0.72;
      gk.ucusT = 0;
      gk.ucusYon = 0;
      gk.ucusVx = 0;
      gk.vx = (gk.x < top.x ? -240 : 240);
      gk.vy = gk.takim === 'FB' ? -90 : 90;
      top.vx *= 0.88;
      top.vy *= 0.88;
      efektCagir('kapmaYildiz', gk.x, gk.y);
      efektCagir('toz', gk.x, gk.y, 10);
      sesCal('kapma', 0.9);
      return false;
    }

    var hiz = hypot2(top.vx, top.vy);
    var ustMu = gk.takim === 'FB';
    var ucusCel = ucuyorMu && (hiz >= 640 || d > 19);
    var yakaladiMi = !ucusCel && (hiz < 940 || d < 28);
    if (yakaladiMi) {
      topSahiplikVer(gk, true);
      gk.kaleciTutuyor = true;
      gk.kurtarisSure = 0.32;
      if (ucuyorMu) {
        gk.ucusT = Math.min(gk.ucusT, 0.22);
      }
    } else {
      // Sert şutu yana/dışa güvenli açıyla çel (uçuşta parmak ucuyla kornere/yana)
      if (ucusCel) {
        top.vy = ustMu ? (190 + Math.random() * 90) : -(190 + Math.random() * 90);
        top.vx = (gk.ucusYon || (top.x < saha.ortaX ? -1 : 1)) * (320 + Math.random() * 140);
        top.vz = 115;
        efektCagir('kapmaYildiz', top.x, top.y);
        efektCagir('toz', gk.x, gk.y, 9);
      } else {
        top.vy = ustMu ? Math.abs(top.vy) * 0.44 : -Math.abs(top.vy) * 0.44;
        top.vx = (top.x < saha.ortaX ? -1 : 1) * (310 + Math.random() * 140);
        top.vz = 75;
      }
      top.aslanMi = false;
      top.superMi = false;
      top.ortaMi = false;
      top.falso = 0;
      top.falsoSure = 0;
      top.sonVuran = gk;
      top.sonTakim = gk.takim;
      top.almakYasakSure = 0.28;
    }

    var ms = simdiMs();
    if (ms - sonKurtarisMs > 800) {
      sonKurtarisMs = ms;
      efektCagir('toz', gk.x, gk.y, 6);
      sesCal(yakaladiMi ? 'yakala' : 'kapma', yakaladiMi ? 0.95 : 0.85);
      tribunTepkiCal(gk.takim === 'GS' ? 'alkis' : 'ooo', 1.0);   // bizim kaleci: alkış · rakip kaleci kurtardı: "ooo"
      if (gk.sesKey && Math.random() < 0.6) {
        spikerCal('p_' + gk.sesKey + '_aksiyon', 3600);
      } else {
        spikerCal('kurtaris', 2400);
      }
    }
    return true;
  }

  function direkCarpismaKontrol(saha) {
    if (top.z > saha.kaleYukseklik + 12) return;
    var direkR = saha.direkR + top.yariCap;
    var direkler = [
      { x: saha.kaleSol, y: saha.ust },
      { x: saha.kaleSag, y: saha.ust },
      { x: saha.kaleSol, y: saha.alt },
      { x: saha.kaleSag, y: saha.alt }
    ];

    for (var i = 0; i < direkler.length; i++) {
      var d = direkler[i];
      var dx = top.x - d.x;
      var dy = top.y - d.y;
      var dist = hypot2(dx, dy);
      if (dist < direkR) {
        var nx = dist > 0.001 ? dx / dist : 0;
        var ny = dist > 0.001 ? dy / dist : 1;
        top.x = d.x + nx * (direkR + 2.5);
        top.y = d.y + ny * (direkR + 2.5);

        var vn = top.vx * nx + top.vy * ny;
        if (vn < 0) {
          top.vx = (top.vx - 2 * vn * nx) * 0.78;
          top.vy = (top.vy - 2 * vn * ny) * 0.78;
        }
        if (hypot2(top.vx, top.vy) < 190) {
          top.vx += nx * 190;
          top.vy += ny * 190;
        }
        top.aslanMi = false;
        top.superMi = false;
        top.falso = 0;

        if (top.direkSoguma <= 0) {
          top.direkSoguma = 0.30;
          efektCagir('direk', d.x, d.y);
          sesCal('direk', 1.0);
          tribunTepkiCal('ooo', 1.1);
          spikerCal('direk', 2200);
        }
        break;
      }
    }
  }

  function golKontrol(saha) {
    var sonuc = null;
    if (global.SAHA && typeof global.SAHA.golMu === 'function') {
      sonuc = guvenliCagir('SAHA.golMu', function () {
        return global.SAHA.golMu(top.x, top.y, top.z);
      });
    } else if (top.z < saha.kaleYukseklik && top.x > saha.kaleSol + 7 && top.x < saha.kaleSag - 7) {
      if (top.y <= saha.ust - 11 && top.y >= saha.ust - saha.kaleDerin - 26) sonuc = 'GS';
      else if (top.y >= saha.alt + 11 && top.y <= saha.alt + saha.kaleDerin + 26) sonuc = 'FB';
    }

    if (sonuc) {
      var golTakim = top.y < saha.ortaY ? 'GS' : 'FB';
      golOldu(golTakim);
      return true;
    }
    return false;
  }

  function duranTopAtanSec(tip, takim, noktaX, noktaY) {
    if (tip === 'aut') {
      return takim === 'GS' ? gsKaleci : fbKaleci;
    }
    var liste = takim === 'GS' ? gsOyuncular : fbOyuncular;
    var secilen = null;
    var enSkor = 1e9;
    var i;
    if (tip === 'korner') {
      for (i = 0; i < liste.length; i++) {
        var kp = liste[i];
        if (kp.kaleciMi || kp.sersemSure > 0 || kp.gunMu) continue;
        var kd = hypot2(kp.x - noktaX, kp.y - noktaY);
        if (kp.rol === 'MID') kd -= 260;
        else if (kp.rol === 'DEF') kd -= 40;
        if (kd < enSkor) {
          enSkor = kd;
          secilen = kp;
        }
      }
      if (secilen) return secilen;
    }
    for (i = 0; i < liste.length; i++) {
      var p = liste[i];
      if (p.kaleciMi || p.sersemSure > 0) continue;
      var d = hypot2(p.x - noktaX, p.y - noktaY);
      // GS taç atışlarında #61 GÜN pas alıcı olarak önde kalsın, başka oyuncu atsın
      if (takim === 'GS' && p.gunMu) d += 220;
      if (d < enSkor) {
        enSkor = d;
        secilen = p;
      }
    }
    return secilen || liste[1] || liste[0];
  }

  function duranTopRakipleriUzaklastir(d, saha) {
    var rakipler = d.takim === 'GS' ? fbOyuncular : gsOyuncular;
    var cezaSinirUst = saha.ust + Math.max(242, (saha.cezaDerin || 220) + 22);
    var cezaSinirAlt = saha.alt - Math.max(242, (saha.cezaDerin || 220) + 22);
    var i;
    for (i = 0; i < rakipler.length; i++) {
      var r = rakipler[i];
      if (r.kaleciMi) continue;
      if (d.tip === 'aut') {
        if (d.ustMu && r.y < cezaSinirUst) {
          r.y = cezaSinirUst + (i % 3) * 14;
        } else if (!d.ustMu && r.y > cezaSinirAlt) {
          r.y = cezaSinirAlt - (i % 3) * 14;
        }
      } else {
        var minMes = d.tip === 'korner' ? 156 : 132;
        var dx = r.x - d.noktaX;
        var dy = r.y - d.noktaY;
        var dist = hypot2(dx, dy);
        if (dist < minMes) {
          var ux, uy;
          if (dist > 0.01) {
            ux = dx / dist;
            uy = dy / dist;
          } else {
            ux = d.noktaX < saha.ortaX ? 1 : -1;
            uy = d.noktaY < saha.ortaY ? 0.5 : -0.5;
            var n = hypot2(ux, uy) || 1;
            ux /= n;
            uy /= n;
          }
          r.x = clamp(d.noktaX + ux * minMes, saha.sol + 18, saha.sag - 18);
          r.y = clamp(d.noktaY + uy * minMes, saha.ust + 22, saha.alt - 22);
          // Kenar sıkışmasında hala mesafe kısaysa merkeze doğru ekstra aç
          if (hypot2(r.x - d.noktaX, r.y - d.noktaY) < minMes) {
            var mx = saha.ortaX - d.noktaX;
            var my = saha.ortaY - d.noktaY;
            var mn = hypot2(mx, my) || 1;
            r.x = clamp(d.noktaX + (mx / mn) * minMes, saha.sol + 18, saha.sag - 18);
            r.y = clamp(d.noktaY + (my / mn) * minMes, saha.ust + 22, saha.alt - 22);
          }
        }
      }
      r.vx = 0;
      r.vy = 0;
    }
  }

  function duranTopHedefPozisyonlari(d, saha) {
    var hedefler = {};
    var ekip = d.takim === 'GS' ? gsOyuncular : fbOyuncular;
    var rakipler = d.takim === 'GS' ? fbOyuncular : gsOyuncular;
    var atacagiUstMu = (d.takim === 'GS');
    var golY = atacagiUstMu ? saha.ust : saha.alt;
    var ileriYon = atacagiUstMu ? -1 : 1;
    var altSlot = 0;
    var i;

    for (i = 0; i < ekip.length; i++) {
      var t = ekip[i];
      if (t === d.atan) {
        hedefler[t.id] = { x: d.atanX, y: d.atanY };
        continue;
      }
      if (t.kaleciMi) {
        hedefler[t.id] = { x: saha.ortaX, y: t.takim === 'FB' ? saha.ust + 48 : saha.alt - 48 };
        continue;
      }
      if (d.tip === 'korner') {
        if (t.gunMu) {
          hedefler[t.id] = {
            x: saha.ortaX + (d.solMu ? 32 : -32),
            y: d.ustMu ? (saha.ust + 148) : (saha.alt - 148)
          };
        } else if (t.rol === 'FWD') {
          hedefler[t.id] = {
            x: saha.ortaX + (d.solMu ? -56 : 56),
            y: d.ustMu ? (saha.ust + 118) : (saha.alt - 118)
          };
        } else if (t.rol === 'MID') {
          var ksaX = altSlot === 0
            ? (d.solMu ? saha.sol + 135 : saha.sag - 135)
            : (saha.ortaX + ((altSlot % 2 === 0 ? -1 : 1) * (80 + altSlot * 42)));
          var ksaY = altSlot === 0
            ? (d.ustMu ? saha.ust + 125 : saha.alt - 125)
            : (d.ustMu ? (saha.ust + 235 + (altSlot % 3) * 45) : (saha.alt - 235 - (altSlot % 3) * 45));
          hedefler[t.id] = {
            x: clamp(ksaX, saha.sol + 45, saha.sag - 45),
            y: clamp(ksaY, saha.ust + 60, saha.alt - 60)
          };
          altSlot++;
        } else {
          hedefler[t.id] = {
            x: clamp(t.basX, saha.sol + 55, saha.sag - 55),
            y: clamp(saha.ortaY + (d.ustMu ? 75 : -75), saha.ust + 160, saha.alt - 160)
          };
        }
      } else if (d.tip === 'tac') {
        var acikX = d.solMu ? (saha.sol + 135 + (altSlot % 3) * 85) : (saha.sag - 135 - (altSlot % 3) * 85);
        var yOfset = (altSlot === 0 ? 45 : (altSlot % 2 === 0 ? -160 : 120)) * (d.takim === 'GS' ? 1 : -1);
        if (t.gunMu || t.rol === 'FWD') {
          acikX = d.solMu ? (saha.sol + 215) : (saha.sag - 215);
          yOfset = 155 * ileriYon;
        }
        hedefler[t.id] = {
          x: clamp(acikX, saha.sol + 65, saha.sag - 65),
          y: clamp(d.noktaY + yOfset, saha.ust + 70, saha.alt - 70)
        };
        altSlot++;
      } else {
        // Aut / Kale vuruşunda savunma ve orta saha pas opsiyonları oluştur
        if (t.rol === 'DEF') {
          var kanatX = d.solMu ? (altSlot % 2 === 0 ? saha.sol + 140 : saha.sag - 160) : (altSlot % 2 === 0 ? saha.sag - 140 : saha.sol + 160);
          hedefler[t.id] = {
            x: clamp(kanatX, saha.sol + 70, saha.sag - 70),
            y: d.ustMu ? (saha.ust + 215) : (saha.alt - 215)
          };
          altSlot++;
        } else {
          hedefler[t.id] = {
            x: clamp(t.basX, saha.sol + 60, saha.sag - 60),
            y: clamp(d.ustMu ? Math.max(t.basY, saha.ust + 390) : Math.min(t.basY, saha.alt - 390), saha.ust + 160, saha.alt - 160)
          };
        }
      }
    }

    var rakipSlot = 0;
    var cezaSinirUst = saha.ust + Math.max(242, (saha.cezaDerin || 220) + 22);
    var cezaSinirAlt = saha.alt - Math.max(242, (saha.cezaDerin || 220) + 22);
    for (i = 0; i < rakipler.length; i++) {
      var r = rakipler[i];
      if (r.kaleciMi) {
        hedefler[r.id] = { x: saha.ortaX, y: r.takim === 'FB' ? saha.ust + 48 : saha.alt - 48 };
        continue;
      }
      var rx = r.x;
      var ry = r.y;
      if (d.tip === 'korner') {
        rx = clamp(saha.ortaX + ((rakipSlot % 5) - 2) * 85, saha.sol + 190, saha.sag - 190);
        ry = d.ustMu
          ? clamp(saha.ust + 145 + Math.floor(rakipSlot / 5) * 90, saha.ust + 72, saha.ortaY - 120)
          : clamp(saha.alt - 145 - Math.floor(rakipSlot / 5) * 90, saha.ortaY + 120, saha.alt - 72);
        rakipSlot++;
      } else if (d.tip === 'aut') {
        rx = clamp(r.basX, saha.sol + 55, saha.sag - 55);
        ry = d.ustMu
          ? clamp(Math.max(r.basY, cezaSinirUst + 36), cezaSinirUst + 24, saha.alt - 140)
          : clamp(Math.min(r.basY, cezaSinirAlt - 36), saha.ust + 140, cezaSinirAlt - 24);
      }
      hedefler[r.id] = { x: rx, y: ry };
    }
    return hedefler;
  }

  function tacTutucuTemizle() {
    for (var i = 0; i < oyuncular.length; i++) {
      oyuncular[i].tacTutuyor = false;
      oyuncular[i].tacAtisT = 0;
      oyuncular[i].kafaT = 0;
      oyuncular[i].sutT = 0;
      oyuncular[i].kaleciTutuyor = false;
    }
  }

  function duranTopVarsayilanNisan(tip, solMu, ustMu, takim) {
    if (tip === 'tac') {
      if (takim === 'GS') return solMu ? -0.18 : (-Math.PI + 0.18);
      return solMu ? 0.18 : (Math.PI - 0.18);
    }
    if (tip === 'aut') {
      return ustMu ? Math.PI * 0.5 : -Math.PI * 0.5;
    }
    return ustMu ? Math.PI * 0.5 : -Math.PI * 0.5;
  }

  function duranTopHazirla(tip, takim, hamX, hamY, saha, anindaHazir) {
    saha = saha || sahaAl();
    tacTutucuTemizle();
    var noktaX, noktaY, atanX, atanY, solMu, ustMu, hedefX, hedefY;

    if (tip === 'tac') {
      solMu = hamX < saha.ortaX;
      ustMu = hamY < saha.ortaY;
      noktaX = solMu ? (saha.sol - 4) : (saha.sag + 4);
      noktaY = clamp(hamY, saha.ust + 72, saha.alt - 72);
      atanX = solMu ? (saha.sol - 18) : (saha.sag + 18);
      atanY = noktaY;
      hedefX = saha.ortaX;
      hedefY = noktaY;
    } else if (tip === 'korner') {
      ustMu = takim === 'GS';
      solMu = hamX < saha.ortaX;
      noktaX = solMu ? (saha.sol + 14) : (saha.sag - 14);
      noktaY = ustMu ? (saha.ust + 14) : (saha.alt - 14);
      // Gerçekçi 3 adımlı açılı koşu başlangıcı
      atanX = solMu ? (noktaX - 32) : (noktaX + 32);
      atanY = ustMu ? (noktaY - 22) : (noktaY + 22);
      hedefX = saha.ortaX + (solMu ? 12 : -12);
      hedefY = ustMu ? (saha.ust + 148) : (saha.alt - 148);
    } else {
      tip = 'aut';
      ustMu = takim === 'FB';
      solMu = hamX < saha.ortaX;
      noktaX = saha.ortaX + (solMu ? -78 : 78);
      noktaY = ustMu ? (saha.ust + 76) : (saha.alt - 76);
      // Kaleci vuruşunda topun 3 adım gerisinde gerilme
      atanX = noktaX + (solMu ? -14 : 14);
      atanY = ustMu ? (noktaY - 34) : (noktaY + 34);
      hedefX = saha.ortaX;
      hedefY = saha.ortaY;
    }

    var nisanAci = tip === 'korner'
      ? Math.atan2(hedefY - noktaY, hedefX - noktaX)
      : duranTopVarsayilanNisan(tip, solMu, ustMu, takim);

    var atan = duranTopAtanSec(tip, takim, noktaX, noktaY);
    top.sahip = null;
    top.pasHedef = null;
    top.pasKilitSure = 0;
    top.pasAlisKilidi = 0;
    top.iz.length = 0;
    top.izSayac = 0;
    top.vx = 0;
    top.vy = 0;
    top.vz = 0;
    top.aslanMi = false;
    top.superMi = false;
    top.ortaMi = false;
    top.falso = 0;
    top.falsoSure = 0;
    top.x = tip === 'tac' ? atanX : noktaX;
    top.y = tip === 'tac' ? atanY : noktaY;
    top.z = tip === 'tac' ? 34 : 0;
    if (atan) atan.tacTutuyor = (tip === 'tac');
    sutSarjAktif = false;
    sutSarjSure = 0;
    girdiTamponSifirla();

    var d = {
      tip: tip,
      takim: takim,
      noktaX: noktaX,
      noktaY: noktaY,
      atanX: atanX,
      atanY: atanY,
      solMu: solMu,
      ustMu: ustMu,
      atan: atan,
      asama: 'yerlesme',
      gecen: 0,
      hazirSure: 0,
      kosuSure: 0,
      kosuHedefSure: tip === 'tac' ? 0.11 : (tip === 'korner' ? 0.30 : 0.28),
      uzunIstek: false,
      secilenHedef: null,
      hedefX: hedefX,
      hedefY: hedefY,
      nisanAci: nisanAci,
      gucSarj: 0,
      sarjAktif: false,
      aiBekle: 0.46,
      otoBekle: 6.0,
      hedefler: null
    };
    d.hedefler = duranTopHedefPozisyonlari(d, saha);
    duranTop = d;

    duranTopRakipleriUzaklastir(d, saha);
    if (anindaHazir) {
      duranTopHazirPosizyonSnap(d, saha);
      d.asama = 'hazir';
    }

    if (takim === 'GS' && atan) {
      aktifOyuncu = atan;
    }

    efektCagir('toz', noktaX, noktaY, 5);
    sesCal('duduk', 0.52);
    if (tip === 'korner') {
      var kornerSes = takim === 'GS'
        ? 'korner_gs'
        : (seciliRakip === 'BJK' ? 'korner_bjk' : (seciliRakip === 'TS' ? 'korner_ts' : 'korner_fb'));
      spikerCal(kornerSes, 3000);
    } else if (tip === 'tac') {
      if (takim === 'GS') spikerCal('tac_gs', 2800);
    } else {
      spikerCal('aut_atisi', 2800);
    }
    return d;
  }

  function duranTopHazirPosizyonSnap(d, saha) {
    if (!d) return;
    if (d.hedefler) {
      for (var i = 0; i < oyuncular.length; i++) {
        var p = oyuncular[i];
        var h = d.hedefler[p.id];
        if (!h) continue;
        if (p === d.atan || d.tip === 'korner' || d.tip === 'aut') {
          p.x = h.x;
          p.y = h.y;
          p.vx = 0;
          p.vy = 0;
        }
      }
    }
    if (d.atan) {
      d.atan.x = d.atanX;
      d.atan.y = d.atanY;
      d.atan.vx = 0;
      d.atan.vy = 0;
      d.atan.tacTutuyor = (d.tip === 'tac');
      d.atan.yonAci = d.nisanAci;
    }
    duranTopRakipleriUzaklastir(d, saha);
    top.x = d.tip === 'tac' && d.atan ? d.atan.x : d.noktaX;
    top.y = d.tip === 'tac' && d.atan ? d.atan.y : d.noktaY;
    top.z = d.tip === 'tac' ? 34 : 0;
  }

  function duranTopKosuBaslat(uzunMu, gucOran) {
    var d = duranTop;
    if (!d || d.asama === 'kosu') return false;
    var saha = sahaAl();
    var sarj = typeof gucOran === 'number' && isFinite(gucOran)
      ? clamp(gucOran, 0.16, 1)
      : (uzunMu ? 0.65 : 0.30);

    d.asama = 'kosu';
    d.kosuSure = 0;
    d.kosuHedefSure = d.tip === 'tac' ? 0.11 : (d.tip === 'korner' ? 0.30 : 0.28);
    d.uzunIstek = Boolean(uzunMu);
    d.gucSarj = sarj;
    d.sarjAktif = false;

    var giris = d.takim === 'GS' ? kullaniciGirisAl() : { x: 0, y: 0, mag: 0 };
    d.secilenHedef = duranTopAliciSec(d, Boolean(uzunMu), giris.x, giris.y, saha);
    return true;
  }

  function duranTopFirlat(d, saha) {
    if (!d) return false;
    var atan = d.atan;
    var uzunMu = Boolean(d.uzunIstek);
    var sarj = typeof d.gucSarj === 'number' ? clamp(d.gucSarj, 0.16, 1) : (uzunMu ? 0.65 : 0.30);
    var giris = d.takim === 'GS' ? kullaniciGirisAl() : { x: 0, y: 0, mag: 0 };

    duranTop = null;
    if (atan) atan.tacTutuyor = false;
    duranTopRakipleriUzaklastir(d, saha);

    var hedef = d.secilenHedef || duranTopAliciSec(d, uzunMu, giris.x, giris.y, saha);
    var hx = hedef ? hedef.x : saha.ortaX;
    var hy = hedef ? hedef.y : (d.ustMu ? saha.ust + 150 : saha.alt - 150);
    var basX = d.noktaX;
    var basY = d.noktaY;

    if (d.tip === 'korner') {
      if (uzunMu) {
        hx = d.takim === 'GS' ? d.hedefX : (saha.ortaX + (d.solMu ? 18 : -18));
        hy = d.takim === 'GS' ? d.hedefY : (d.ustMu ? (saha.ust + 148) : (saha.alt - 148));
      }
    } else if (d.tip === 'tac') {
      basX = d.noktaX;
      basY = d.noktaY;
      if (d.takim === 'GS') {
        var varsayilanNisan = duranTopVarsayilanNisan('tac', d.solMu, d.ustMu, 'GS');
        var aciFarki = Math.abs(Math.atan2(Math.sin(d.nisanAci - varsayilanNisan), Math.cos(d.nisanAci - varsayilanNisan)));
        if (aciFarki > 0.22 || !hedef) {
          var mesTac = uzunMu ? (250 + sarj * 165) : (160 + sarj * 80);
          hx = clamp(basX + Math.cos(d.nisanAci) * mesTac, saha.sol + 40, saha.sag - 40);
          hy = clamp(basY + Math.sin(d.nisanAci) * mesTac, saha.ust + 48, saha.alt - 48);
          hedef = null;
        }
      }
    } else if (d.tip === 'aut') {
      if (uzunMu && !hedef) {
        hx = saha.ortaX + (d.solMu ? -80 : 80);
        hy = saha.ortaY + (d.ustMu ? 120 : -120);
      } else if (d.takim === 'GS' && giris.mag > 0.25 && uzunMu) {
        var autMes = 340 + sarj * 260;
        hx = clamp(basX + Math.cos(d.nisanAci) * autMes, saha.sol + 60, saha.sag - 60);
        hy = clamp(basY + Math.sin(d.nisanAci) * autMes, saha.ust + 90, saha.alt - 90);
      }
    }

    var dx = hx - basX;
    var dy = hy - basY;
    var dist = hypot2(dx, dy) || 1;
    var nx = dx / dist;
    var ny = dy / dist;

    var hiz, vz, falso = 0;
    if (d.tip === 'korner') {
      if (uzunMu) {
        hiz = clamp(dist * (0.90 + sarj * 0.18), 470, 640);
        vz = 232 + sarj * 52;
        falso = d.solMu ? 165 : -165;
      } else {
        hiz = clamp(dist * 1.45, 360, 520);
        vz = 24;
      }
    } else if (d.tip === 'aut') {
      if (uzunMu) {
        hiz = clamp(dist * (0.88 + sarj * 0.16), 650, 840);
        vz = 285 + sarj * 55;
      } else {
        hiz = clamp(dist * 1.35, 390, 540);
        vz = 30;
      }
    } else {
      if (uzunMu) {
        hiz = clamp(dist * (1.08 + sarj * 0.18), 470, 640);
        vz = 132 + sarj * 25;
      } else {
        hiz = clamp(dist * 1.48, 370, 515);
        vz = 88;
      }
    }

    top.sahip = null;
    top.x = basX;
    top.y = basY;
    top.z = d.tip === 'tac' ? 26 : 2;
    top.vx = nx * hiz;
    top.vy = ny * hiz;
    top.vz = vz;
    top.falso = falso;
    top.falsoSure = Math.abs(falso) > 0 ? 0.92 : 0;
    top.aslanMi = false;
    top.superMi = false;
    top.ortaMi = Boolean(d.tip === 'korner' && uzunMu);
    top.sonVuran = atan;
    top.sonTakim = d.takim;
    top.sonPasAtan = atan;
    top.pasHedef = hedef || null;
    top.pasKilitSure = hedef ? (uzunMu ? 1.15 : 0.78) : 0;
    // Çift dokunuş yasak: atıcı kısa süre kendi topunu tekrar alamaz
    top.almakYasakSure = 0.56;
    if (d.tip === 'aut' && uzunMu) {
      top.degajKoruma = 0.45;
    }

    if (atan) {
      atan.yonAci = Math.atan2(ny, nx);
      if (d.tip === 'tac') {
        atan.tacAtisT = 0.32;
        atan.sutT = 0;
      } else {
        atan.sutT = 0.30;
      }
    }
    if (d.takim === 'GS') {
      if (d.tip === 'korner' && uzunMu && gunOyuncu) {
        aktifOyuncu = gunOyuncu;
      } else if (hedef && !hedef.kaleciMi) {
        aktifOyuncu = hedef;
      }
      aktifDegisimSoguma = 0.42;
      if (atan && atan.sesKey) spikerCal('p_' + atan.sesKey + '_aksiyon', 3600);
    }

    efektCagir('toz', basX, basY, d.tip === 'tac' ? 4 : 7);
    if (d.tip === 'tac') {
      sesCal('pas', 0.48);
    } else {
      sesCal(uzunMu ? 'vurus' : 'pas', 0.92);
    }
    if (d.tip === 'korner' && uzunMu) {
      var kornerBasSes = d.takim === 'GS'
        ? 'korner_gs'
        : (seciliRakip === 'BJK' ? 'korner_bjk' : (seciliRakip === 'TS' ? 'korner_ts' : 'korner_fb'));
      spikerCal(kornerBasSes, 2400);
    }
    return true;
  }

  function duranTopGuncelle(dt, saha) {
    var d = duranTop;
    if (!d) return;
    d.gecen += dt;

    var i, p, h;
    if (d.asama === 'yerlesme') {
      for (i = 0; i < oyuncular.length; i++) {
        p = oyuncular[i];
        p.sersemSure = 0;
        p.hamleT = 0;
        if (p.tacAtisT > 0) p.tacAtisT = Math.max(0, p.tacAtisT - dt);
        if (p.kafaT > 0) p.kafaT = Math.max(0, p.kafaT - dt);
        if (p.sutT > 0) p.sutT = Math.max(0, p.sutT - dt);
        h = d.hedefler && d.hedefler[p.id];
        if (h) {
          oyuncuHedefHizlaGit(p, h.x, h.y, p === d.atan ? 820 : 760, dt);
        } else {
          p.vx *= 0.72;
          p.vy *= 0.72;
        }
      }
      duranTopRakipleriUzaklastir(d, saha);
      var atanMes = d.atan ? hypot2(d.atan.x - d.atanX, d.atan.y - d.atanY) : 0;
      if ((d.gecen >= 0.36 && atanMes < 14) || d.gecen >= 0.70) {
        duranTopHazirPosizyonSnap(d, saha);
        d.asama = 'hazir';
        d.hazirSure = 0;
      }
      return;
    }

    if (d.asama === 'kosu') {
      d.kosuSure += dt;
      var pK = clamp(d.kosuSure / Math.max(0.08, d.kosuHedefSure), 0, 1);
      for (i = 0; i < oyuncular.length; i++) {
        p = oyuncular[i];
        if (p === d.atan) {
          if (d.tip === 'tac') {
            p.x = d.atanX + (d.noktaX - d.atanX) * 0.35 * pK;
            p.y = d.atanY + Math.sin(d.nisanAci) * pK * 3;
            p.yonAci = aciYumusat(p.yonAci, d.nisanAci, 0.55);
            p.tacTutuyor = false;
            p.tacAtisT = Math.max(p.tacAtisT || 0, 0.32);
            top.x = d.atanX + (d.noktaX - d.atanX) * pK;
            top.y = p.y;
            top.z = 34 - pK * 8;
          } else {
            p.x = d.atanX + (d.noktaX - d.atanX) * pK;
            p.y = d.atanY + (d.noktaY - d.atanY) * pK;
            p.yonAci = aciYumusat(p.yonAci, d.nisanAci, 0.45);
            p.kosuFaz += 16 * dt;
            top.x = d.noktaX;
            top.y = d.noktaY;
            top.z = 0;
          }
          continue;
        }
        h = d.hedefler && d.hedefler[p.id];
        if (h) {
          var kfFaz = zaman * 2.1 + p.id * 1.7;
          oyuncuHedefHizlaGit(p, clamp(h.x + Math.sin(kfFaz) * 14, saha.sol + 24, saha.sag - 24), clamp(h.y + Math.cos(kfFaz * 0.85) * 11, saha.ust + 24, saha.alt - 24), 160, dt);
        }
      }
      duranTopRakipleriUzaklastir(d, saha);
      if (pK >= 1) {
        duranTopFirlat(d, saha);
      }
      return;
    }

    // 'hazir' aşaması: oyuncular nefes alır gibi hafifçe kıpırdanır, atıcı nişan alır
    d.hazirSure += dt;
    for (i = 0; i < oyuncular.length; i++) {
      p = oyuncular[i];
      p.sersemSure = 0;
      p.hamleT = 0;
      if (p.tacAtisT > 0) p.tacAtisT = Math.max(0, p.tacAtisT - dt);
      if (p.kafaT > 0) p.kafaT = Math.max(0, p.kafaT - dt);
      if (p.sutT > 0) p.sutT = Math.max(0, p.sutT - dt);
      if (p === d.atan) {
        p.x = d.atanX;
        p.y = d.atanY;
        p.vx = 0;
        p.vy = 0;
        p.tacTutuyor = (d.tip === 'tac');
        p.yonAci = aciYumusat(p.yonAci, d.nisanAci, 1 - Math.exp(-16 * dt));
        continue;
      }
      h = d.hedefler && d.hedefler[p.id];
      if (h) {
        var fazOyn = zaman * 1.9 + p.id * 1.7;
        var salinimX = Math.sin(fazOyn) * 14;
        var salinimY = Math.cos(fazOyn * 0.85) * 11;
        oyuncuHedefHizlaGit(
          p,
          clamp(h.x + salinimX, saha.sol + 24, saha.sag - 24),
          clamp(h.y + salinimY, saha.ust + 24, saha.alt - 24),
          135,
          dt
        );
      } else {
        p.vx *= 0.82;
        p.vy *= 0.82;
      }
    }
    duranTopRakipleriUzaklastir(d, saha);

    if (d.tip === 'tac' && d.atan) {
      top.x = d.atan.x;
      top.y = d.atan.y;
      top.z = 34;
    } else {
      top.x = d.noktaX;
      top.y = d.noktaY;
      top.z = 0;
    }

    if (d.takim === 'FB') {
      d.aiBekle -= dt;
      if (d.aiBekle <= 0) {
        duranTopKosuBaslat(d.tip !== 'tac' ? Math.random() < 0.65 : Math.random() < 0.35, d.tip === 'korner' ? 0.68 : 0.48);
      }
      return;
    }

    // GS kullanıcısı için canlı yön / hedef nişanı + güç barı
    var gsGiris = kullaniciGirisAl();
    if (d.tip === 'korner') {
      if (gsGiris.mag > 0.12) {
        d.hedefX = clamp(d.hedefX + gsGiris.x * 260 * dt, saha.ortaX - 240, saha.ortaX + 240);
        d.hedefY = clamp(
          d.hedefY + gsGiris.y * 220 * dt,
          d.ustMu ? saha.ust + 48 : saha.alt - 260,
          d.ustMu ? saha.ust + 260 : saha.alt - 48
        );
      }
      d.nisanAci = Math.atan2(d.hedefY - d.noktaY, d.hedefX - d.noktaX);
    } else if (gsGiris.mag > 0.12) {
      var nxV = Math.cos(d.nisanAci) + gsGiris.x * 4.2 * dt;
      var nyV = Math.sin(d.nisanAci) + gsGiris.y * 4.2 * dt;
      if (d.tip === 'tac') {
        nxV = d.solMu ? Math.max(0.24, nxV) : Math.min(-0.24, nxV);
      } else if (d.tip === 'aut') {
        nyV = d.ustMu ? Math.max(0.26, nyV) : Math.min(-0.26, nyV);
      }
      d.nisanAci = Math.atan2(nyV, nxV);
    }

    if (d.sarjAktif) {
      d.gucSarj = clamp(d.gucSarj + dt / 0.52, 0.14, 1);
      if (d.gucSarj >= 1 && d.hazirSure > 0.9) {
        duranTopKosuBaslat(true, 1);
        return;
      }
    }

    if (otoMod && d.hazirSure >= 0.42) {
      duranTopKosuBaslat(d.tip === 'korner' || d.tip === 'aut', 0.65);
      return;
    }
    if (tamponPasSure > 0) {
      tamponPasSure = 0;
      duranTopKosuBaslat(false, 0.32);
      return;
    }
    if (tamponSutSure > 0) {
      tamponSutSure = 0;
      duranTopKosuBaslat(true, 0.65);
      return;
    }
    if (d.hazirSure >= d.otoBekle && !d.sarjAktif) {
      duranTopKosuBaslat(d.tip === 'korner', 0.58);
    }
  }

  function duranTopAliciSec(d, uzunMu, girisX, girisY, saha) {
    var ekip = d.takim === 'GS' ? gsOyuncular : fbOyuncular;
    var girisVar = hypot2(girisX, girisY) > 0.25;
    var gx = girisVar ? girisX : 0;
    var gy = girisVar ? girisY : 0;
    var gn = hypot2(gx, gy) || 1;
    gx /= gn;
    gy /= gn;

    var enIyi = null;
    var enSkor = -1e9;
    var atan = d.atan;

    for (var i = 0; i < ekip.length; i++) {
      var o = ekip[i];
      if (o === atan || o.kaleciMi || o.sersemSure > 0) continue;
      var dx = o.x - d.noktaX;
      var dy = o.y - d.noktaY;
      var dist = hypot2(dx, dy);
      if (dist < 48) continue;

      var skor = 0;
      if (d.tip === 'korner') {
        if (uzunMu) {
          var hedefRefX = d.takim === 'GS' ? (d.hedefX || saha.ortaX) : saha.ortaX;
          var hedefRefY = d.takim === 'GS' ? (d.hedefY || (d.ustMu ? saha.ust + 148 : saha.alt - 148)) : (d.ustMu ? saha.ust + 148 : saha.alt - 148);
          var cezaUzak = hypot2(o.x - hedefRefX, o.y - hedefRefY);
          skor -= cezaUzak * 1.4;
          if (o.gunMu) skor += 140;
          if (o.rol === 'FWD') skor += 75;
        } else {
          skor -= Math.abs(dist - 180) * 1.3;
        }
      } else if (d.tip === 'aut') {
        if (uzunMu) {
          skor += d.ustMu ? (o.y - d.noktaY) * 0.9 : (d.noktaY - o.y) * 0.9;
          if (o.rol === 'FWD') skor += 90;
          if (o.gunMu) skor += 60;
        } else {
          skor -= Math.abs(dist - 240) * 1.1;
          if (o.rol === 'DEF' || o.rol === 'MID') skor += 85;
        }
      } else {
        if (uzunMu) {
          skor += dist * 0.65;
          if (o.takim === 'GS') skor += (d.noktaY - o.y) * 0.55;
          if (o.gunMu) skor += 90;
        } else {
          skor -= Math.abs(dist - 190) * 1.25;
        }
      }

      if (girisVar) {
        var dot = (dx * gx + dy * gy) / (dist || 1);
        skor += dot * 220;
      }

      if (skor > enSkor) {
        enSkor = skor;
        enIyi = o;
      }
    }
    return enIyi;
  }

  function duranTopKullan(uzunMu) {
    return duranTopKosuBaslat(uzunMu, uzunMu ? 0.65 : 0.30);
  }

  function sahaCikisKontrol(saha) {
    if (top.sahip || duranTop || durum !== 'oyun') return;

    var cizgiPayi = 11;
    var kaleIciX = top.x > saha.kaleSol + 7 && top.x < saha.kaleSag - 7;
    var yanDisari = (top.x < saha.sol - cizgiPayi && top.vx < 40) || (top.x > saha.sag + cizgiPayi && top.vx > -40);
    var ustDisari = top.y < saha.ust - cizgiPayi && top.vy < 40 && (!kaleIciX || top.z >= saha.kaleYukseklik);
    var altDisari = top.y > saha.alt + cizgiPayi && top.vy > -40 && (!kaleIciX || top.z >= saha.kaleYukseklik);

    if (!yanDisari && !ustDisari && !altDisari) return;

    var son = top.sonTakim === 'GS' ? 'GS' : 'FB';
    var tip, baslayan;
    if (ustDisari) {
      if (son === 'FB') {
        tip = 'korner';
        baslayan = 'GS';
      } else {
        tip = 'aut';
        baslayan = 'FB';
      }
    } else if (altDisari) {
      if (son === 'GS') {
        tip = 'korner';
        baslayan = 'FB';
      } else {
        tip = 'aut';
        baslayan = 'GS';
      }
    } else {
      tip = 'tac';
      baslayan = son === 'GS' ? 'FB' : 'GS';
    }

    duranTopHazirla(tip, baslayan, top.x, top.y, saha, false);
  }

  function testDuranTop(tip, takim, sagMi) {
    return guvenliCagir('testDuranTop', function () {
      if (durum === 'baslik') maciBaslat();
      else if (durum === 'mola') molaKapat();
      if (durum !== 'oyun') return null;

      var saha = sahaAl();
      var kullanacak = takim === 'FB' ? 'FB' : 'GS';
      var hx = sagMi ? (saha.sag - 30) : (saha.sol + 30);
      var hy = saha.ortaY - 120;
      if (tip === 'korner') {
        hy = kullanacak === 'GS' ? saha.ust : saha.alt;
      } else if (tip === 'aut') {
        hy = kullanacak === 'FB' ? saha.ust : saha.alt;
      } else {
        tip = 'tac';
      }
      duranTopHazirla(tip, kullanacak, hx, hy, saha, false);
      return bilgiAl().duranTop;
    });
  }

  function topFizigiGuncelle(dt, saha) {
    if (top.almakYasakSure > 0) top.almakYasakSure = Math.max(0, top.almakYasakSure - dt);
    if (top.direkSoguma > 0) top.direkSoguma = Math.max(0, top.direkSoguma - dt);

    if (top.sahip) {
      var p = top.sahip;
      if (p.kaleciMi) {
        var gYon = p.takim === 'FB' ? 1 : -1;
        top.x = clamp(p.x, saha.sol + 8, saha.sag - 8);
        top.y = clamp(p.y + gYon * 9, saha.ust + 8, saha.alt - 8);
        top.z = 15;
        // Rakip oyuncuları kaleci topu tutarken ceza alanı çevresinde uzakta tut
        for (var k = 0; k < oyuncular.length; k++) {
          var rk = oyuncular[k];
          if (rk.kaleciMi || rk.takim === p.takim) continue;
          var rdx = rk.x - p.x;
          var rdy = rk.y - p.y;
          var rd = hypot2(rdx, rdy);
          if (rd > 0.01 && rd < 165) {
            rk.x = clamp(p.x + (rdx / rd) * 165, saha.sol + 14, saha.sag - 14);
            rk.y = clamp(p.y + (rdy / rd) * 165, saha.ust + 20, saha.alt - 20);
          }
        }
      } else {
        var adimHiz = hypot2(p.vx, p.vy);
        var adimFaz = Math.sin(p.kosuFaz);
        var sagYanAci = p.yonAci + Math.PI * 0.5;
        var tutus = p.ilkDokunusSure > 0 ? 10.5 : (adimHiz < 110 ? 12.8 : (15.5 + Math.abs(adimFaz) * 5.8));
        var yanSalinim = p.ilkDokunusSure > 0 ? 0 : adimFaz * clamp(adimHiz / 260, 0, 1) * 3.2;
        var hedefTopX = clamp(p.x + Math.cos(p.yonAci) * tutus + Math.cos(sagYanAci) * yanSalinim, saha.sol + 8, saha.sag - 8);
        var hedefTopY = clamp(p.y + Math.sin(p.yonAci) * tutus + Math.sin(sagYanAci) * yanSalinim, saha.ust + 8, saha.alt - 8);
        var surusHiz = p.ilkDokunusSure > 0 ? 30 : 28;
        var surusK = 1 - Math.exp(-surusHiz * dt);
        top.x += (hedefTopX - top.x) * surusK;
        top.y += (hedefTopY - top.y) * surusK;
        top.z = 0;

        if (adimHiz > 250) {
          p.dribbleTozSayac = (p.dribbleTozSayac || 0) + dt;
          if (p.dribbleTozSayac >= 0.14) {
            p.dribbleTozSayac = 0;
            efektCagir('toz', p.x - Math.cos(p.yonAci) * 8, p.y - Math.sin(p.yonAci) * 8, 2);
          }
        }
      }
      top.vx = p.vx;
      top.vy = p.vy;
      top.vz = 0;
      top.donus += hypot2(p.vx, p.vy) * dt * 0.045;
      return;
    }

    // Yüksek hızda tünel geçişini önlemek için alt-adımlama
    var toplamHiz = hypot2(top.vx, top.vy);
    if (toplamHiz > 420 && !top.aslanMi) {
      top.izSayac += dt;
      if (top.izSayac >= 0.018) {
        top.izSayac = 0;
        if (top.iz.length >= 6) top.iz.shift();
        top.iz.push({ x: top.x, y: top.y, z: top.z });
      }
    } else if (top.iz.length > 0 && toplamHiz < 240) {
      top.iz.shift();
    }
    var adimSayisi = Math.max(1, Math.min(12, Math.ceil((toplamHiz * dt) / 7)));
    var sdt = dt / adimSayisi;

    for (var s = 0; s < adimSayisi; s++) {
      if (top.aslanMi || Math.abs(top.falso) > 0.1) {
        top.vx += top.falso * sdt;
      }
      top.x += top.vx * sdt;
      top.y += top.vy * sdt;
      top.z += top.vz * sdt;

      if (top.z > 0 || top.vz !== 0) {
        top.vz -= 980 * sdt;
      }
      if (top.z > 84 && top.vz > 0) {
        top.z = 84;
        top.vz = 0;
      }
      if (top.z <= 0) {
        top.z = 0;
        if (top.vz < -75) {
          top.vz = -top.vz * 0.56;
        } else {
          top.vz = 0;
          top.ortaMi = false;
        }
      }

      var pasKaygan = top.pasKilitSure > 0 && top.sonPasAtan;
      var surtunme = top.z > 2
        ? Math.exp(-0.35 * sdt)
        : (top.aslanMi ? Math.exp(-0.48 * sdt) : (pasKaygan ? Math.exp(-0.68 * sdt) : Math.exp(-1.12 * sdt)));
      top.vx *= surtunme;
      top.vy *= surtunme;
      top.donus += hypot2(top.vx, top.vy) * sdt * 0.045;

      if (kaleciTopTemasiKontrol(fbKaleci, saha)) break;
      if (kaleciTopTemasiKontrol(gsKaleci, saha)) break;
      direkCarpismaKontrol(saha);
      if (golKontrol(saha)) return;
    }

    if (top.aslanMi) {
      top.kivilcimSayac += dt;
      if (top.kivilcimSayac >= 0.025) {
        top.kivilcimSayac = 0;
        efektCagir('sutKivilcim', top.x, top.y - top.z, top.vx, top.vy, true);
      }
      if (hypot2(top.vx, top.vy) < 420) {
        top.aslanMi = false;
        top.superMi = false;
        top.falso = 0;
      }
    }

    // Havadan gelen yüksek ortalarda kafa vuruşu / kafa pası (15 <= top.z <= 64)
    if (!top.sahip && top.z >= 15 && top.z <= 64) {
      var kafaMes = top.ortaMi ? 46 : 38;
      for (var hk = 0; hk < oyuncular.length; hk++) {
        var ko = oyuncular[hk];
        if (ko.kaleciMi || ko.sersemSure > 0) continue;
        if (ko === top.sonVuran && top.almakYasakSure > 0) continue;
        if (top.aslanMi && ko.takim === 'GS') continue;
        if (hypot2(top.x - ko.x, top.y - ko.y) > kafaMes) continue;

        if (ko.takim === 'GS' && (ko === aktifOyuncu || ko === top.pasHedef) && tamponSutSure > 0) {
          tamponSutSure = 0;
          tamponPasSure = 0;
          var kHedef = gsSutHedefiSec(ko, kullaniciGirisAl());
          kafaVurusuAt(ko, kHedef.x, kHedef.y, 0.88);
          return;
        }
        // GS kanat/korner ortasında ceza sahasındaki hücumcu gelişine kafa golü dener
        if (
          top.ortaMi &&
          top.sonTakim === 'GS' &&
          ko.takim === 'GS' &&
          ko.y < saha.ust + 350 &&
          Math.abs(ko.x - saha.ortaX) < 310 &&
          (ko === aktifOyuncu || ko === top.pasHedef || ko.gunMu || ko.rol === 'FWD')
        ) {
          var otoKafaHedef = gsSutHedefiSec(ko, kullaniciGirisAl());
          kafaVurusuAt(ko, otoKafaHedef.x, otoKafaHedef.y, 0.78);
          return;
        }
        // Rakip kanat/korner ortasında kendi hücumcusu kaleye kafa vurur
        if (
          top.ortaMi &&
          top.sonTakim === 'FB' &&
          ko.takim === 'FB' &&
          ko.y > saha.alt - 340 &&
          Math.abs(ko.x - saha.ortaX) < 280
        ) {
          var acikSolK = !gsKaleci || gsKaleci.x >= saha.ortaX;
          var fbHx = acikSolK ? (saha.kaleSol + 22) : (saha.kaleSag - 22);
          kafaVurusuAt(ko, fbHx, saha.alt + 22, rakipDengeAl().kafaGuc);
          return;
        }
        if (ko.takim === 'GS' && (ko === aktifOyuncu || ko === top.pasHedef) && tamponPasSure > 0) {
          tamponPasSure = 0;
          var pGiris = kullaniciGirisAl();
          var pHedef = enUygunPasHedefi(ko, pGiris.x, pGiris.y);
          ko.kafaMax = 0.40;
          ko.kafaT = 0.40;
          pasAt(ko, pHedef, pGiris.x, pGiris.y);
          top.z = clamp(top.z, 22, 32);
          sesCal('kafa', 0.8);
          return;
        }
      }
    }

    // Aktif pas topunu hedef takım arkadaşına tüm uçuş boyunca yumuşak yönlendir
    if (!top.sahip && top.pasHedef && top.pasKilitSure > 0 && top.sonPasAtan) {
      var ph = top.pasHedef;
      var gsPasMi = top.sonTakim === 'GS';
      var maxHomingMes = gsPasMi ? 640 : 165;
      var maxHomingZ = top.ortaMi ? 96 : (gsPasMi ? 64 : 38);
      if (!ph.kaleciMi && ph.sersemSure <= 0 && top.z < maxHomingZ) {
        var pdx = ph.x - top.x;
        var pdy = ph.y - top.y;
        var pDist = hypot2(pdx, pdy);
        var pHiz = hypot2(top.vx, top.vy);
        var yonUygun = pDist < 85
          ? (pdx * top.vx + pdy * top.vy) > -0.2 * pDist * pHiz
          : (pdx * top.vx + pdy * top.vy) > 0;
        if (pDist > 10 && pDist < maxHomingMes && pHiz > 60 && yonUygun) {
          var istenenVx = (pdx / pDist) * pHiz;
          var istenenVy = (pdy / pDist) * pHiz;
          var steerOran = gsPasMi ? (pDist < 180 ? 8.5 : 5.2) : 4.5;
          var steerK = 1 - Math.exp(-steerOran * dt);
          top.vx += (istenenVx - top.vx) * steerK;
          top.vy += (istenenVy - top.vy) * steerK;
          var yeniHiz = hypot2(top.vx, top.vy);
          if (yeniHiz > 1) {
            top.vx = (top.vx / yeniHiz) * pHiz;
            top.vy = (top.vy / yeniHiz) * pHiz;
          }
        }
      }
    }

    // Mıknatıslı top tutma (pas hedefleri ve aktif oyuncu için akıcı yakalama)
    if (!top.sahip && top.z < 46) {
      var enYakin = null;
      var enSkor = 1e9;
      var topHiz = hypot2(top.vx, top.vy);
      var i;
      for (i = 0; i < oyuncular.length; i++) {
        var o = oyuncular[i];
        if (o.kaleciMi || o.sersemSure > 0) continue;
        if (o === top.sonVuran && top.almakYasakSure > 0) continue;
        if (top.degajKoruma > 0 && top.sonTakim !== o.takim && top.sonVuran && hypot2(o.x - top.sonVuran.x, o.y - top.sonVuran.y) < 175) {
          continue;
        }
        if (top.aslanMi && o.takim === 'GS') continue;
        var pasHedefMi = o === top.pasHedef && top.pasKilitSure > 0;
        if (!pasHedefMi && top.z >= 30) continue;
        if (top.pasHedef && top.pasKilitSure > 0 && top.sonTakim === 'GS' && o.takim === 'FB' && top.z >= 24) {
          continue;
        }
        if (top.pasHedef && top.pasKilitSure > 0 && o.takim === top.sonTakim && o !== top.pasHedef && topHiz >= 220) {
          continue;
        }
        if (top.sonTakim === o.takim && !top.sonPasAtan && topHiz > 560) continue;

        var mes = hypot2(top.x - o.x, top.y - o.y);
        var kapmaCap = pasHedefMi
          ? 42
          : ((top.pasHedef && top.pasKilitSure > 0 && top.sonTakim === 'GS' && o.takim === 'FB')
            ? rakipDengeAl().kesmeCap
            : ((o.takim === 'GS' && (o.gunMu || o === aktifOyuncu)) ? 27 : 21));
        if (o.hamleT > 0) kapmaCap += 14;

        // Top passa veya yavaşsa pas hedefi ve aktif GS oyuncusuna yumuşak mıknatıs çekimi
        var cekimLim = pasHedefMi ? 74 : 50;
        if (
          !top.aslanMi &&
          ((pasHedefMi && topHiz < 780) || (o.takim === 'GS' && (o.gunMu || o === aktifOyuncu) && topHiz < 460)) &&
          mes < cekimLim &&
          mes > kapmaCap
        ) {
          var cekim = clamp(1 - mes / cekimLim, 0, 1) * (pasHedefMi ? 420 : 270) * dt;
          var cx = (o.x - top.x) / mes;
          var cy = (o.y - top.y) / mes;
          top.x += cx * cekim;
          top.y += cy * cekim;
          mes = hypot2(top.x - o.x, top.y - o.y);
        }

        if (mes <= kapmaCap && mes < enSkor) {
          // Aslan Şutu FB savunmacısını da savurur
          if (top.aslanMi && o.takim === 'FB') {
            o.sersemSure = 0.55;
            o.vx = (o.x < top.x ? -180 : 180);
            o.vy = -80;
            efektCagir('kapmaYildiz', o.x, o.y);
            continue;
          }
          enSkor = mes;
          enYakin = o;
        }
      }
      if (enYakin) {
        topSahiplikVer(enYakin, false);
        return;
      }
    }

    sahaCikisKontrol(saha);
  }

  // --- Yapay Zeka (GS Arkadaşları, #61 GÜN Desteği & FB Dengesi) ---

  function oyuncuHedefHizlaGit(p, hx, hy, hiz, dt) {
    var dx = hx - p.x;
    var dy = hy - p.y;
    var dist = hypot2(dx, dy);
    if (dist > 6) {
      var gercekHiz = dist < 28 ? hiz * (dist / 28) : hiz;
      var targetVx = (dx / dist) * gercekHiz;
      var targetVy = (dy / dist) * gercekHiz;
      var ivme = 1 - Math.exp(-12 * dt);
      p.vx += (targetVx - p.vx) * ivme;
      p.vy += (targetVy - p.vy) * ivme;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.yonAci = aciYumusat(p.yonAci, Math.atan2(targetVy, targetVx), 1 - Math.exp(-14 * dt));
      p.kosuFaz += hypot2(p.vx, p.vy) * dt * 0.055;
    } else {
      var fren = Math.exp(-10 * dt);
      p.vx *= fren;
      p.vy *= fren;
    }
  }

  function enYakinRakipMesafe(p) {
    var rakipler = p.takim === 'GS' ? fbOyuncular : gsOyuncular;
    var minD = 1e9;
    var kim = null;
    for (var i = 0; i < rakipler.length; i++) {
      var r = rakipler[i];
      if (r.kaleciMi || r.sersemSure > 0) continue;
      var d = hypot2(r.x - p.x, r.y - p.y);
      if (d < minD) {
        minD = d;
        kim = r;
      }
    }
    return { dist: minD, rakip: kim };
  }

  function fbBaskiSec() {
    var enYakin = null;
    var enMes = 1e9;
    for (var i = 0; i < fbOyuncular.length; i++) {
      var f = fbOyuncular[i];
      if (f.kaleciMi || f.sersemSure > 0) continue;
      var d = hypot2(f.x - top.x, f.y - top.y);
      if (d < enMes) {
        enMes = d;
        enYakin = f;
      }
    }
    return enYakin;
  }

  function fbIkinciBaskiSec(birinci) {
    var enYakin = null;
    var enMes = 260;
    for (var i = 0; i < fbOyuncular.length; i++) {
      var f = fbOyuncular[i];
      if (f.kaleciMi || f.sersemSure > 0 || f === birinci) continue;
      var d = hypot2(f.x - top.x, f.y - top.y);
      if (d < enMes) {
        enMes = d;
        enYakin = f;
      }
    }
    return enYakin;
  }

  function otoGsKararVer(p, dt, saha) {
    // 1) Top GS'de ve bu oyuncuda ise
    if (top.sahip === p) {
      // Aslan Gücü %100 dolunca rakip hücum bölgesinde Aslan Şutu çek!
      if (aslanGucu >= 100 && p.y < saha.ust + 560) {
        var aslanHedef = gsSutHedefiSec(p, { x: p.x < saha.ortaX ? 0.65 : -0.65 });
        aslanCutawayBaslat(p, aslanHedef);
        return;
      }

      // Başka bir GS arkadaşıysa kaleye koşturup açık #61 GÜN'e pas vermeyi öncelikler
      if (!p.gunMu && gunOyuncu && gunOyuncu.sersemSure <= 0) {
        var gunAcik = gunOyuncu.y < p.y + 130 || enYakinRakipMesafe(p).dist < 95;
        if (gunAcik && hypot2(gunOyuncu.x - p.x, gunOyuncu.y - p.y) > 55) {
          pasAt(p, gunOyuncu, 0, -1);
          return;
        }
      }

      // Ceza sahası çevresinde şut çek
      if (p.y < saha.ust + 310) {
        var normalHedef = gsSutHedefiSec(p, null);
        aslanGucuEkle(5);
        sutAt(p, normalHedef.x, normalHedef.y, false);
        return;
      }

      // Rakibi çalımlayarak yukarı kaleye sür
      aslanGucuEkle(2.6 * dt);
      var yakin = enYakinRakipMesafe(p);
      var hedefX = saha.ortaX + Math.sin(zaman * 2.2 + p.idx) * 85;
      if (yakin.rakip && yakin.dist < 85) {
        hedefX = p.x + (p.x >= yakin.rakip.x ? 110 : -110);
      }
      hedefX = clamp(hedefX, saha.sol + 90, saha.sag - 90);
      oyuncuHedefHizlaGit(p, hedefX, saha.ust + 190, 295 * p.hiz, dt);
      return;
    }

    // 2) Top rakipteyse veya boştaysa
    if (p === aktifOyuncu) {
      if (top.sahip === fbKaleci) {
        oyuncuHedefHizlaGit(p, p.basX, Math.max(p.basY, saha.ortaY - 80), 210 * p.hiz, dt);
        return;
      }
      var dTop = hypot2(top.x - p.x, top.y - p.y);
      if (top.sahip && top.sahip.takim === 'FB' && !top.sahip.kaleciMi && dTop < 38 && p.hamleT <= 0 && Math.random() < 4.5 * dt) {
        kaymaBaslat(p);
      } else {
        oyuncuHedefHizlaGit(p, top.x, top.y, 315 * p.hiz, dt);
      }
    }
  }

  function oyunculariGuncelle(dt, saha) {
    var giris = kullaniciGirisAl();
    var denge = rakipDengeAl();
    var fbBaskici = fbBaskiSec();
    var fbIkinciBaskici = denge.ikinciBaski ? fbIkinciBaskiSec(fbBaskici) : null;
    var gsTopaSahip = Boolean(top.sahip && top.sahip.takim === 'GS');
    var i;

    for (i = 0; i < oyuncular.length; i++) {
      var p = oyuncular[i];
      if (p.sutT > 0) p.sutT = Math.max(0, p.sutT - dt);
      if (p.tacAtisT > 0) p.tacAtisT = Math.max(0, p.tacAtisT - dt);
      if (p.kafaT > 0) p.kafaT = Math.max(0, p.kafaT - dt);
      if (p.ilkDokunusSure > 0) p.ilkDokunusSure = Math.max(0, p.ilkDokunusSure - dt);
      if (p.calimSoguma > 0) p.calimSoguma = Math.max(0, p.calimSoguma - dt);
      if (top.sahip === p) p.topTutmaSure += dt;
      else p.topTutmaSure = 0;

      if (p.kaleciMi) {
        kaleciGuncelle(p, p.takim === 'FB', dt, saha);
        continue;
      }

      if (p.sersemSure > 0) {
        p.sersemSure = Math.max(0, p.sersemSure - dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-6 * dt);
        p.vy *= Math.exp(-6 * dt);
        p.x = clamp(p.x, saha.sol + 12, saha.sag - 12);
        p.y = clamp(p.y, saha.ust + 12, saha.alt - 12);
        continue;
      }

      // Kayarak müdahale (lunge/slide)
      if (p.hamleT > 0) {
        p.hamleT = Math.max(0, p.hamleT - dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-3.2 * dt);
        p.vy *= Math.exp(-3.2 * dt);

        // Kayma sırasında top kapma kontrolü (kaleci dokunulmazdır!)
        if (hypot2(top.x - p.x, top.y - p.y) < 38 && top.z < 36) {
          if (!top.sahip || (top.sahip.takim !== p.takim && !top.sahip.kaleciMi)) {
            if (top.sahip) {
              top.sahip.sersemSure = 0.58;
              top.sahip.vx = (top.sahip.x - p.x) * 4;
              top.sahip.vy = (top.sahip.y - p.y) * 4;
            }
            topSahiplikVer(p, false);
            top.kapmaKoruma = 0.45;
            efektCagir('kapmaYildiz', top.x, top.y);
            sesCal('kapma', 0.95);
            if (p.takim === 'GS') {
              aslanGucuEkle(7);
              if (p.sesKey) spikerCal('p_' + p.sesKey + '_aksiyon', 5500);
              else spikerCal('kapma', 5500);
            }
          }
        }
        p.x = clamp(p.x, saha.sol + 10, saha.sag - 10);
        p.y = clamp(p.y, saha.ust + 10, saha.alt - 10);
        continue;
      }

      // Doğrudan gövde teması ile saha oyuncusundan top kapma (kaleci hariç)
      if (
        top.sahip &&
        !top.sahip.kaleciMi &&
        top.sahip.takim !== p.takim &&
        top.kapmaKoruma <= 0 &&
        hypot2(top.x - p.x, top.y - p.y) < 21
      ) {
        if (p.takim === 'GS' && p === aktifOyuncu) {
          top.sahip.sersemSure = 0.28;
          topSahiplikVer(p, false);
          top.kapmaKoruma = 0.48;
          efektCagir('kapmaYildiz', top.x, top.y);
          sesCal('kapma', 0.8);
          aslanGucuEkle(6);
          if (p.sesKey) spikerCal('p_' + p.sesKey + '_aksiyon', 5500);
          else spikerCal('kapma', 5500);
        }
      }

      // Pas alıcısı pas gelirken topu aktif biçimde karşılasın
      if (!top.sahip && p === top.pasHedef && top.pasKilitSure > 0 && (p !== aktifOyuncu || giris.mag < 0.12 || top.pasAlisKilidi > 0)) {
        var pasHiz = Math.max(240, hypot2(top.vx, top.vy));
        var pMes = hypot2(p.x - top.x, p.y - top.y);
        var tInt = clamp(pMes / pasHiz, 0.03, 0.22);
        var intX = clamp(top.x + top.vx * tInt + (p === aktifOyuncu ? giris.x * 24 : 0), saha.sol + 20, saha.sag - 20);
        var intY = clamp(top.y + top.vy * tInt + (p === aktifOyuncu ? giris.y * 24 : 0), saha.ust + 20, saha.alt - 20);
        oyuncuHedefHizlaGit(p, intX, intY, 310 * p.hiz, dt);
        continue;
      }

      // --- Kullanıcı Kontrolü veya Oto-Mod ---
      if (p.takim === 'GS') {
        p.aslanHazir = (p === aktifOyuncu && aslanGucu >= 100);

        if (p === aktifOyuncu) {
          if (otoMod && giris.mag < 0.15) {
            otoGsKararVer(p, dt, saha);
          } else if (giris.mag > 0.08) {
            var temelHiz = (p.gunMu ? 318 : 294) * p.hiz;
            if (top.sahip === p) temelHiz *= 0.96;
            var hedefVx = giris.x * temelHiz;
            var hedefVy = giris.y * temelHiz;
            var keskinDonus = (p.vx * hedefVx + p.vy * hedefVy) < -10000;
            var ivme = 1 - Math.exp(-(keskinDonus ? 24 : 22) * dt);
            p.vx += (hedefVx - p.vx) * ivme;
            p.vy += (hedefVy - p.vy) * ivme;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.yonAci = aciYumusat(p.yonAci, Math.atan2(hedefVy, hedefVx), 1 - Math.exp(-(keskinDonus ? 24 : 18) * dt));
            p.kosuFaz += hypot2(p.vx, p.vy) * dt * 0.055;

            if (top.sahip === p) {
              aslanGucuEkle(2.4 * dt);
              var rBilgi = enYakinRakipMesafe(p);
              if (rBilgi.dist < 68 && p.calimSoguma <= 0) {
                p.calimSoguma = 2.5;
                aslanGucuEkle(4);
                if (p.sesKey) spikerCal('p_' + p.sesKey + '_aksiyon', 5500);
              }
            }
          } else {
            var durmaFren = Math.exp(-13 * dt);
            p.vx *= durmaFren;
            p.vy *= durmaFren;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
          }
        } else if (top.sahip === p) {
          // AI GS arkadaşı topa sahipse kaleye koşturup açık GÜN'e pas vermeyi öncelikler
          if (!p.gunMu && gunOyuncu && gunOyuncu.sersemSure <= 0 && hypot2(gunOyuncu.x - p.x, gunOyuncu.y - p.y) > 55) {
            pasAt(p, gunOyuncu, 0, -1);
          } else {
            oyuncuHedefHizlaGit(p, saha.ortaX, saha.ust + 220, 275 * p.hiz, dt);
          }
        } else {
          // Destekçi GS AI pozisyonlanması: atakta kanatlar, orta saha ve bekler kalabalık destek verir
          var topKaymaY = clamp((top.y - saha.ortaY) * 0.45, -310, 310);
          var hedefX = p.basX;
          var hedefY = p.basY + topKaymaY;
          var destekHiz = (gsTopaSahip ? 272 : 245) * p.hiz;

          if (santraBekleSure > 0) {
            hedefX = p.basX;
            hedefY = santraBaslayan === 'FB'
              ? Math.max(p.basY, saha.ortaY + 125)
              : Math.max(p.basY, saha.ortaY + 48);
          } else if (top.sahip === fbKaleci) {
            // Rakip kaleci degaj atarken orta alana çekil (kaleye basma)
            hedefX = p.basX;
            hedefY = clamp(Math.max(p.basY, saha.ortaY - 80), saha.ortaY - 120, saha.alt - 160);
          } else {
            if (gsTopaSahip) {
              var gsAtakOran = clamp((saha.ortaY + 280 - top.y) / 960, 0, 1);
              var kenarMi = p.basX < saha.ortaX - 240 || p.basX > saha.ortaX + 240;
              if (p.gunMu) {
                hedefX = top.x < saha.ortaX ? saha.ortaX + 150 : saha.ortaX - 150;
                hedefY = clamp(Math.min(top.y - 165, saha.ortaY - 120 - gsAtakOran * 560), saha.ust + 145, saha.ortaY + 40);
              } else if (p.rol === 'FWD') {
                hedefX = top.x < saha.ortaX ? saha.ortaX + 140 : saha.ortaX - 140;
                hedefY = clamp(Math.min(top.y - 120, saha.ortaY - 110 - gsAtakOran * 580), saha.ust + 155, saha.ortaY + 60);
              } else if (p.rol === 'MID' && (p.idx === 5 || p.idx === 8 || kenarMi)) {
                var solKanat = p.idx === 5 || p.basX < saha.ortaX;
                var icKayma = (top.x < saha.ortaX) ? (solKanat ? 0 : -50) : (solKanat ? 50 : 0);
                hedefX = (solKanat ? saha.sol + 145 : saha.sag - 145) + icKayma;
                hedefY = clamp(Math.min(p.basY - 380 - gsAtakOran * 480, top.y - 35), saha.ust + 185, saha.alt - 250);
              } else if (p.rol === 'MID') {
                hedefX = clamp(p.basX + (top.x - saha.ortaX) * 0.25, saha.sol + 240, saha.sag - 240);
                if (p.idx === 7 || (typeof p.sut === 'number' && p.sut >= 0.84)) {
                  hedefY = clamp(Math.min(p.basY - 360 - gsAtakOran * 480, top.y + 115), saha.ust + 275, saha.alt - 260);
                } else {
                  hedefY = clamp(Math.min(p.basY - 260 - gsAtakOran * 420, top.y + 235), saha.ust + 460, saha.alt - 260);
                }
              } else if (p.rol === 'DEF' && (p.idx === 1 || p.idx === 4 || kenarMi)) {
                hedefX = p.basX < saha.ortaX ? saha.sol + 115 : saha.sag - 115;
                hedefY = clamp(p.basY - 250 - gsAtakOran * 510, saha.ust + 560, saha.alt - 220);
              } else if (p.rol === 'DEF') {
                hedefY = clamp(p.basY - 140 - gsAtakOran * 380, saha.ortaY + 85, saha.alt - 200);
              }
            } else {
              if (p.rol === 'DEF') {
                hedefY = clamp(Math.max(p.basY, top.y + 130), saha.ortaY + 50, saha.alt - 135);
              } else if (p.rol === 'MID') {
                hedefY = clamp(p.basY + clamp((top.y - saha.ortaY) * 0.55, -240, 320), saha.ust + 340, saha.alt - 240);
              } else if (p.rol === 'FWD') {
                hedefY = clamp(Math.min(p.basY, top.y - 120), saha.ust + 260, saha.ortaY + 180);
              }
            }

            hedefX = clamp(hedefX, saha.sol + 45, saha.sag - 45);
            hedefY = clamp(hedefY, saha.ust + 60, saha.alt - 60);
          }
          oyuncuHedefHizlaGit(p, hedefX, hedefY, destekHiz, dt);
        }
      } else {
        // --- FB AI (Hücum organizasyonlu, skora göre çekişmeli derbi rakibi) ---
        if (top.sahip === p) {
          var yakinGs = enYakinRakipMesafe(p);
          // Ceza sahasına girince kalecinin boş köşesine bitirici şut çek
          if (p.y > saha.alt - denge.sutMesafe) {
            var acikSol = !gsKaleci || gsKaleci.x >= saha.ortaX;
            var sutX = acikSol
              ? (saha.kaleSol + 16 + Math.random() * 28)
              : (saha.kaleSag - 16 - Math.random() * 28);
            var gucTaban = gsSkor - fbSkor >= 2 ? 0.82 : 0.74;
            var guc = clamp(gucTaban + Math.random() * 0.22, 0.72, 0.98);
            sutAt(p, sutX, saha.alt + 22, false, guc);
          } else {
            var fbHedef = enUygunPasHedefi(p, 0, 1);
            var pasHakki = fbPasSoguma <= 0 && p.topTutmaSure >= 0.45;
            var kanatOrta = pasHakki &&
              Math.abs(p.x - saha.ortaX) > 220 &&
              p.y > saha.alt - 480 &&
              fbHedef &&
              fbHedef.y > saha.alt - 340 &&
              Math.abs(fbHedef.x - saha.ortaX) < 280 &&
              Math.random() < 1.35 * denge.pasHizCarp * dt;
            var baskidaPas = pasHakki && yakinGs.dist < 95 && fbHedef && Math.random() < 1.65 * denge.pasHizCarp * dt;
            var ileriPas = pasHakki && p.topTutmaSure >= 0.65 && fbHedef && fbHedef.y > p.y + 75 && Math.random() < 0.72 * denge.pasHizCarp * dt;
            if (kanatOrta || baskidaPas || ileriPas) {
              pasAt(p, fbHedef, 0, 1);
            } else {
              var kacisX = saha.ortaX + Math.sin(zaman * 1.8 + p.idx) * 140;
              if (yakinGs.rakip && yakinGs.dist < 105) {
                kacisX = clamp(p.x + (p.x >= yakinGs.rakip.x ? 115 : -115), saha.sol + 75, saha.sag - 75);
              }
              oyuncuHedefHizlaGit(p, kacisX, saha.alt - 190, 266 * denge.hiz * p.hiz, dt);
            }
          }
        } else if (top.sahip === gsKaleci) {
          // GS kalecisi degaj hazırlarken FB oyuncuları orta sahaya çekilir
          var cekilY = clamp(Math.min(p.basY, saha.ortaY + 80), saha.ust + 140, saha.ortaY + 120);
          oyuncuHedefHizlaGit(p, p.basX, cekilY, 195 * p.hiz, dt);
        } else if (p === fbBaskici && !gsTopaSahip) {
          if (santraBekleSure > 0 && santraBaslayan === 'GS') {
            oyuncuHedefHizlaGit(p, p.basX, Math.min(p.basY, saha.ortaY - 120), 120 * p.hiz, dt);
          } else {
            oyuncuHedefHizlaGit(p, top.x, top.y, 238 * denge.baski * p.hiz, dt);
          }
        } else if (p === fbBaskici && gsTopaSahip && !(top.sahip && top.sahip.kaleciMi)) {
          if (santraBekleSure > 0 && santraBaslayan === 'GS') {
            oyuncuHedefHizlaGit(p, p.basX, Math.min(p.basY, saha.ortaY - 120), 120 * p.hiz, dt);
          } else {
            var topMes = hypot2(top.x - p.x, top.y - p.y);
            oyuncuHedefHizlaGit(p, top.x, top.y, 234 * denge.baski * p.hiz, dt);
            if (topMes < denge.kapmaMes && top.sahip && top.sahip.takim === 'GS' && !top.sahip.kaleciMi && top.kapmaKoruma <= 0 && Math.random() < 1.35 * denge.kapmaOran * dt) {
              top.sahip.sersemSure = 0.25;
              topSahiplikVer(p, true);
              top.kapmaKoruma = 0.45;
              efektCagir('kapmaYildiz', top.x, top.y);
              sesCal('kapma', 0.7);
            } else if (gsSkor - fbSkor >= 2 && topMes > 28 && topMes < 52 && p.hamleT <= 0 && Math.random() < 1.1 * dt) {
              kaymaBaslat(p);
            }
          }
        } else if (p === fbIkinciBaskici && gsTopaSahip && !(top.sahip && top.sahip.kaleciMi)) {
          if (santraBekleSure > 0 && santraBaslayan === 'GS') {
            oyuncuHedefHizlaGit(p, p.basX, Math.min(p.basY, saha.ortaY - 120), 120 * p.hiz, dt);
          } else {
            var karsilamaX = clamp(top.x * 0.78 + saha.ortaX * 0.22, saha.sol + 60, saha.sag - 60);
            var karsilamaY = clamp(top.y - 36, saha.ust + 140, saha.alt - 160);
            oyuncuHedefHizlaGit(p, karsilamaX, karsilamaY, 228 * denge.baski * p.hiz, dt);
          }
        } else {
          var fbKaymaY = clamp((top.y - saha.ortaY) * 0.42, -290, 290);
          var fHx = p.basX;
          var fHy = p.basY + fbKaymaY;
          if (!gsTopaSahip && top.sahip) {
            var fbAtakOran = clamp((top.y - (saha.ortaY - 280)) / 960, 0, 1);
            var fbKenarMi = p.basX < saha.ortaX - 240 || p.basX > saha.ortaX + 240;
            if (p.rol === 'FWD') {
              fHx = top.x < saha.ortaX ? saha.ortaX + 145 : saha.ortaX - 145;
              fHy = clamp(Math.max(top.y + 115, saha.ortaY + 100 + fbAtakOran * 540), saha.ortaY - 60, saha.alt - 175);
            } else if (p.rol === 'MID' && (p.idx === 5 || p.idx === 8 || fbKenarMi)) {
              fHy = clamp(Math.max(p.basY + 340 + fbAtakOran * 440, top.y + 20), saha.ust + 240, saha.alt - 210);
            } else if (p.rol === 'MID') {
              fHy = clamp(p.basY + 260 + fbAtakOran * 360, saha.ust + 260, saha.alt - 340);
            } else if (p.rol === 'DEF' && (p.idx === 1 || p.idx === 4 || fbKenarMi)) {
              fHy = clamp(p.basY + 180 + fbAtakOran * 340, saha.ust + 220, saha.ortaY + 140);
            }
          }
          if (santraBekleSure > 0 && santraBaslayan === 'GS') {
            fHy = Math.min(fHy, saha.ortaY - 120);
          }
          fHx = clamp(fHx, saha.sol + 45, saha.sag - 45);
          fHy = clamp(fHy, saha.ust + 60, saha.alt - 60);
          oyuncuHedefHizlaGit(p, fHx, fHy, 214 * denge.hiz * p.hiz, dt);
        }
      }

      p.x = clamp(p.x, saha.sol + 12, saha.sag - 12);
      p.y = clamp(p.y, saha.ust + 12, saha.alt - 12);
    }

    // Oyuncular arası yığılmayı önleyen yumuşak ayrıştırma
    var minAralik = 36;
    for (i = 0; i < oyuncular.length; i++) {
      var a = oyuncular[i];
      if (a.kaleciMi) continue;
      for (var j = i + 1; j < oyuncular.length; j++) {
        var b = oyuncular[j];
        if (b.kaleciMi) continue;
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var dist = hypot2(dx, dy);
        if (dist > 0.01 && dist < minAralik) {
          var itme = (minAralik - dist) * 0.35;
          var ux = dx / dist;
          var uy = dy / dist;
          a.x = clamp(a.x - ux * itme, saha.sol + 12, saha.sag - 12);
          a.y = clamp(a.y - uy * itme, saha.ust + 12, saha.alt - 12);
          b.x = clamp(b.x + ux * itme, saha.sol + 12, saha.sag - 12);
          b.y = clamp(b.y + uy * itme, saha.ust + 12, saha.alt - 12);
        }
      }
    }
  }

  // --- Simülasyon Adımı ---

  function adimGuncelle(dt) {
    var saha = sahaAl();
    zaman += dt;

    if (global.SAHA && typeof global.SAHA.guncelle === 'function') {
      guvenliCagir('SAHA.guncelle', function () { global.SAHA.guncelle(dt); });
    }
    efektCagir('guncelle', dt);

    if (darbeDuraklama > 0 && durum === 'oyun' && !cutawayDurumu) {
      darbeDuraklama = Math.max(0, darbeDuraklama - dt);
      return;
    }

    if (durum === 'baslik') {
      if (otoMod) {
        otoBekleSure += dt;
        if (otoBekleSure >= 0.45) {
          maciBaslat();
        }
      }
      return;
    }

    if (durum === 'devre') {
      if (otoMod) {
        otoBekleSure -= dt;
        if (otoBekleSure <= 0) {
          ikinciYariBaslat();
        }
      }
      return;
    }

    if (durum === 'mola' || durum === 'sonuc') {
      return;
    }

    if (durum === 'gol') {
      // Top kale ağlarının içinde ilerleyip arkaya çarpar ve ağ dalgalanır
      var gUst = golBilgiBekleyen ? golBilgiBekleyen.ustKaleMi : (top.y < saha.ortaY);
      top.x += top.vx * dt;
      top.y += top.vy * dt;
      top.z = Math.max(0, top.z + top.vz * dt);
      if (top.z > 0 || top.vz !== 0) {
        top.vz -= 980 * dt;
        if (top.z <= 0) {
          top.z = 0;
          top.vz = top.vz < -75 ? (-top.vz * 0.45) : 0;
        }
      }
      var netFric = Math.exp(-2.8 * dt);
      top.vx *= netFric;
      top.vy *= netFric;
      top.donus += hypot2(top.vx, top.vy) * dt * 0.04;

      if (top.x < saha.kaleSol + 12) {
        top.x = saha.kaleSol + 12;
        if (top.vx < 0) top.vx = -top.vx * 0.35;
      } else if (top.x > saha.kaleSag - 12) {
        top.x = saha.kaleSag - 12;
        if (top.vx > 0) top.vx = -top.vx * 0.35;
      }

      if (gUst) {
        var ustArka = saha.ust - saha.kaleDerin + 10;
        if (top.y <= ustArka) {
          top.y = ustArka;
          if (top.vy < 0) top.vy = -top.vy * 0.25;
        } else if (top.y > saha.ust - 12) {
          top.y = saha.ust - 12;
        }
        if (golBilgiBekleyen && !golBilgiBekleyen.agVuruldu && top.y <= saha.ust - 28) {
          golBilgiBekleyen.agVuruldu = true;
          if (global.SAHA && typeof global.SAHA.agSalla === 'function') {
            guvenliCagir('SAHA.agSalla', function () {
              global.SAHA.agSalla(true, top.x, Math.min(2.4, Math.max(1.1, hypot2(top.vx, top.vy) / 360)));
            });
          }
          sesCal('ag', 1.25);
        }
      } else {
        var altArka = saha.alt + saha.kaleDerin - 10;
        if (top.y >= altArka) {
          top.y = altArka;
          if (top.vy > 0) top.vy = -top.vy * 0.25;
        } else if (top.y < saha.alt + 12) {
          top.y = saha.alt + 12;
        }
        if (golBilgiBekleyen && !golBilgiBekleyen.agVuruldu && top.y >= saha.alt + 28) {
          golBilgiBekleyen.agVuruldu = true;
          if (global.SAHA && typeof global.SAHA.agSalla === 'function') {
            guvenliCagir('SAHA.agSalla', function () {
              global.SAHA.agSalla(false, top.x, Math.min(2.4, Math.max(1.1, hypot2(top.vx, top.vy) / 360)));
            });
          }
          sesCal('ag', 1.25);
        }
      }

      var pFric = Math.exp(-3.5 * dt);
      for (var gi = 0; gi < oyuncular.length; gi++) {
        var gp = oyuncular[gi];
        gp.x = clamp(gp.x + gp.vx * dt, saha.sol + 10, saha.sag - 10);
        gp.y = clamp(gp.y + gp.vy * dt, saha.ust + 10, saha.alt - 10);
        gp.vx *= pFric;
        gp.vy *= pFric;
      }

      if (golKutlamaBekliyor) {
        golKutlamaGecikme -= dt;
        if (golKutlamaGecikme <= 0) {
          golKutlamasiniTetikle();
        }
      }

      golBekleSure -= dt;
      if (golBekleSure <= 0) {
        if (golKutlamaBekliyor) {
          golKutlamasiniTetikle();
        }
        if (altinGol) {
          maciBitir();
        } else {
          santraDizilisi(golSonrakiBaslayan);
          durum = 'oyun';
          perdeleriSenkronla();
          hudGuncelle(true);
          tribunSeviyeGuncelle(0.44);
        }
      }
      return;
    }

    // Aslan Şutu anime cutaway duraklaması
    if (cutawayDurumu) {
      cutawayGecen += dt;
      var efAktif = Boolean(efektCagir('cutawayAktif'));
      if ((!efAktif && cutawayGecen >= 0.45) || cutawayGecen >= 0.78) {
        cutawayDurumu = false;
        if (cutawayBekleyen) {
          sutAt(cutawayBekleyen.atan, cutawayBekleyen.hedefX, cutawayBekleyen.hedefY, true);
          cutawayBekleyen = null;
        }
      }
      return;
    }

    if (duranTop) {
      duranTopGuncelle(dt, saha);
      hudGuncelle(false);
      return;
    }

    // Normal 'oyun' akışı
    if (!altinGol) {
      kalanSure -= dt;
      if (kalanSure <= 0) {
        kalanSure = 0;
        if (yari === 1) {
          devreArasiAc();
          return;
        }
        if (gsSkor === fbSkor) {
          altinGolBaslat();
          return;
        }
        maciBitir();
        return;
      }
    }

    if (aktifDegisimSoguma > 0) {
      aktifDegisimSoguma = Math.max(0, aktifDegisimSoguma - dt);
    }
    if (fbPasSoguma > 0) {
      fbPasSoguma = Math.max(0, fbPasSoguma - dt);
    }

    if (tamponPasSure > 0) tamponPasSure = Math.max(0, tamponPasSure - dt);
    if (tamponSutSure > 0) tamponSutSure = Math.max(0, tamponSutSure - dt);
    if (top.degajKoruma > 0) top.degajKoruma = Math.max(0, top.degajKoruma - dt);
    if (top.kapmaKoruma > 0) top.kapmaKoruma = Math.max(0, top.kapmaKoruma - dt);
    if (top.pasKilitSure > 0) {
      top.pasKilitSure = Math.max(0, top.pasKilitSure - dt);
      if (top.pasKilitSure <= 0) top.pasHedef = null;
    }
    if (top.pasAlisKilidi > 0) {
      top.pasAlisKilidi = Math.max(0, top.pasAlisKilidi - dt);
    }
    if (top.falsoSure > 0) top.falsoSure = Math.max(0, top.falsoSure - dt);

    if (sutSarjAktif) {
      if (!(top.sahip && top.sahip.takim === 'GS' && !top.sahip.kaleciMi)) {
        sutSarjAktif = false;
        sutSarjSure = 0;
      } else {
        sutSarjSure += dt;
        if (sutSarjSure >= 0.62) {
          sutBirak();
        }
      }
    }

    // Sensible Soccer falso (aftertouch): havadaki GS şutuna hafif sağ-sol yön verme
    if (!top.sahip && top.falsoSure > 0 && top.sonTakim === 'GS' && !top.aslanMi) {
      var falsoGiris = kullaniciGirisAl();
      if (Math.abs(falsoGiris.x) > 0.2) {
        top.falso = clamp(top.falso + falsoGiris.x * 540 * dt, -340, 340);
      }
    }

    if (santraBekleSure > 0) {
      santraBekleSure = Math.max(0, santraBekleSure - dt);
      var baslatmaGiris = kullaniciGirisAl();
      if (
        baslatmaGiris.mag > 0.1 ||
        !top.sahip ||
        hypot2(top.sahip.x - saha.ortaX, top.sahip.y - saha.ortaY) > 26
      ) {
        santraBekleSure = 0;
      }
    }

    otomatikOyuncuSec();
    oyunculariGuncelle(dt, saha);
    topFizigiGuncelle(dt, saha);

    if (top.sahip && top.sahip.takim === 'GS' && !top.sahip.kaleciMi) {
      var giris = kullaniciGirisAl();
      if (giris.mag > 0.20) {
        sonYonX = giris.x;
        sonYonY = giris.y;
        sonYonSure = 0.22;
      } else if (sonYonSure > 0) {
        sonYonSure = Math.max(0, sonYonSure - dt);
      }
      var axPas = giris.mag > 0.20 ? giris.x : (sonYonSure > 0 ? sonYonX : 0);
      var ayPas = giris.mag > 0.20 ? giris.y : (sonYonSure > 0 ? sonYonY : 0);
      pasHedefYonX = axPas;
      pasHedefYonY = ayPas;
      pasHedef = enUygunPasHedefi(top.sahip, axPas, ayPas, pasHedef);
    } else {
      pasHedef = null;
      sonYonSure = 0;
      pasHedefYonX = 0;
      pasHedefYonY = 0;
    }

    if (zaman - sonTribunGuncelle >= 0.30) {
      sonTribunGuncelle = zaman;
      var tehlike = (top.y < saha.ust + 420 || top.y > saha.alt - 420);
      tribunSeviyeGuncelle(tehlike ? 0.58 : 0.42);
    }

    hudGuncelle(false);
  }

  // --- Çizim Döngüsü ---

  function duranTopDunyaCiz(ctx, saha) {
    if (!duranTop || durum !== 'oyun') return;
    var d = duranTop;
    var gsMi = d.takim === 'GS';
    var rakipMeta = rakipBilgiAl(seciliRakip);
    var anaRenk = gsMi ? '#FDB912' : rakipMeta.acikRenk;

    ctx.save();
    // Resmi kural mesafesi çemberi
    ctx.strokeStyle = gsMi ? 'rgba(253, 185, 18, 0.55)' : 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(d.noktaX, d.noktaY, d.tip === 'korner' ? 150 : (d.tip === 'tac' ? 125 : 42), 0, Math.PI * 2);
    ctx.stroke();

    if (gsMi && (d.asama === 'hazir' || d.asama === 'kosu')) {
      if (d.tip === 'korner') {
        var cx = (d.noktaX + d.hedefX) * 0.5 + (d.solMu ? -55 : 55);
        var cy = (d.noktaY + d.hedefY) * 0.5 + (d.ustMu ? 32 : -32);
        ctx.strokeStyle = 'rgba(253, 185, 18, 0.78)';
        ctx.lineWidth = 2.6;
        ctx.setLineDash([10, 7]);
        ctx.lineDashOffset = -zaman * 55;
        ctx.beginPath();
        ctx.moveTo(d.noktaX, d.noktaY);
        ctx.quadraticCurveTo(cx, cy, d.hedefX, d.hedefY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Canlı iniş hedef nişangâhı
        var nabiz = 1 + Math.sin(zaman * 7) * 0.14;
        ctx.strokeStyle = anaRenk;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(d.hedefX, d.hedefY, 22 * nabiz, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(253, 185, 18, 0.20)';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(d.hedefX - 10, d.hedefY);
        ctx.lineTo(d.hedefX + 10, d.hedefY);
        ctx.moveTo(d.hedefX, d.hedefY - 10);
        ctx.lineTo(d.hedefX, d.hedefY + 10);
        ctx.stroke();
      } else {
        var uz = d.tip === 'tac' ? (165 + (d.gucSarj || 0.25) * 190) : (220 + (d.gucSarj || 0.25) * 320);
        var bx = d.tip === 'tac' && d.atan ? d.atan.x : d.noktaX;
        var by = d.tip === 'tac' && d.atan ? d.atan.y : d.noktaY;
        var hx = clamp(bx + Math.cos(d.nisanAci) * uz, saha.sol + 24, saha.sag - 24);
        var hy = clamp(by + Math.sin(d.nisanAci) * uz, saha.ust + 24, saha.alt - 24);
        var midX = (bx + hx) * 0.5;
        var midY = (by + hy) * 0.5 - 26;
        ctx.strokeStyle = 'rgba(253, 185, 18, 0.72)';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -zaman * 48;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(midX, midY, hx, hy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(hx, hy, 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(253, 185, 18, 0.28)';
        ctx.fill();
        ctx.strokeStyle = anaRenk;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function duranTopKatmaniCiz(ctx, vw, vh) {
    if (!duranTop || durum !== 'oyun') return;
    var d = duranTop;
    var baslik = d.tip === 'korner' ? 'KORNER' : (d.tip === 'tac' ? 'TAÇ ATIŞI' : 'KALE VURUŞU');
    var gsMi = d.takim === 'GS';
    var rakipMeta = rakipBilgiAl(seciliRakip);
    var hazirIpucu = d.tip === 'korner'
      ? 'OKLAR: Orta Hedefi · PAS: Kısa · ŞUT (Basılı Tut): Orta'
      : (d.tip === 'tac'
        ? 'OKLAR: Yön · PAS: Kısa Taç · ŞUT: Uzun Taç'
        : 'OKLAR: Yön · PAS: Kısa Pas · ŞUT: Uzun Degaj');
    var altSatir = gsMi
      ? (d.asama === 'hazir'
        ? hazirIpucu
        : (d.asama === 'kosu'
          ? (d.atan ? d.atan.ad + ' hamle yapıyor...' : 'Atış yapılıyor...')
          : (d.atan ? d.atan.ad + ' #' + d.atan.no + ' topun başında...' : 'Oyuncular yerini alıyor...')))
      : (rakipMeta.ad + ' kullanıyor...');

    var kutuW = vw >= 1340 ? Math.min(vw - 900, 420) : Math.min(vw - 28, 390);
    var kutuH = 48;
    var kx = (vw - kutuW) * 0.5;
    var ky = vw >= 1340 ? 14 : (vw > 1060 ? 84 : 148);

    ctx.save();
    ctx.fillStyle = 'rgba(11, 16, 26, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(kx, ky, kutuW, kutuH, 14);
    } else {
      ctx.rect(kx, ky, kutuW, kutuH);
    }
    ctx.fill();

    ctx.lineWidth = 2.2;
    ctx.strokeStyle = gsMi ? '#FDB912' : rakipMeta.cizgi;
    ctx.stroke();

    // Sol takım renk şeridi
    ctx.fillStyle = gsMi ? '#A90432' : rakipMeta.ana;
    ctx.fillRect(kx + 8, ky + 10, 6, kutuH - 20);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = gsMi ? '#FDB912' : rakipMeta.yaziRenk;
    ctx.font = '900 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(baslik + ' · ' + (gsMi ? 'GS' : rakipMeta.kisa), vw * 0.5 + 3, ky + 18);

    ctx.fillStyle = '#E8EEF8';
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(altSatir, vw * 0.5 + 3, ky + 36);
    ctx.restore();
  }

  function sahneyiCiz() {
    var tuval = dom.tuval;
    if (!tuval) return;
    var ctx = tuval.getContext('2d');
    if (!ctx) return;

    var saha = sahaAl();
    var vw = tuval.clientWidth || global.innerWidth || saha.W;
    var vh = tuval.clientHeight || global.innerHeight || saha.H;
    var dpr = typeof global.devicePixelRatio === 'number' ? Math.min(2, Math.max(1, global.devicePixelRatio)) : 1;
    var hedefW = Math.max(1, Math.round(vw * dpr));
    var hedefH = Math.max(1, Math.round(vh * dpr));

    if (tuval.width !== hedefW || tuval.height !== hedefH) {
      tuval.width = hedefW;
      tuval.height = hedefH;
    }

    var camScale = vw > vh
      ? Math.min(vw / 980, vh / 740)      // 11 inç tablet için biraz daha yakın (eski 1120 / 850)
      : Math.min(vw / 980, vh / 1520);
    if (!(camScale > 0)) camScale = 1;
    var visW = vw / camScale;
    var visH = vh / camScale;
    var tabanCamX = (saha.W - visW) * 0.5;
    var odakX = durum === 'gol'
      ? saha.ortaX
      : (duranTop ? duranTop.noktaX : top.x);
    var hedefCamX;
    if (visW < saha.W) {
      var panLimit = (saha.W - visW) * 0.5 + 15;
      var xOran = clamp((odakX - saha.ortaX) / Math.max(1, saha.en * 0.5), -1, 1);
      hedefCamX = tabanCamX + xOran * panLimit;
    } else {
      hedefCamX = vw > vh
        ? tabanCamX + clamp((odakX - saha.ortaX) * 0.045, -20, 20)
        : tabanCamX;
    }

    var simdi = simdiMs();
    var camDt = sonKameraMs ? clamp((simdi - sonKameraMs) / 1000, 0.004, 0.05) : 0.016;
    sonKameraMs = simdi;

    var hedefVelY = clamp(top.vy, -420, 420);
    kameraVelY += (hedefVelY - kameraVelY) * (1 - Math.exp(-2.8 * camDt));
    var ustBias = 0.50 + clamp((saha.ortaY - top.y) / 900, 0, 1) * 0.06;

    var minCamY = -55;
    var maxCamY = Math.max(0, saha.H - visH + 55);
    var hedefCamY;
    if (visH >= saha.H) {
      hedefCamY = (saha.H - visH) * 0.5;
    } else if (durum === 'gol') {
      var gUst = golBilgiBekleyen ? golBilgiBekleyen.ustKaleMi : (top.y < saha.ortaY);
      hedefCamY = gUst ? minCamY : maxCamY;
    } else if (duranTop) {
      if (duranTop.tip === 'korner') {
        hedefCamY = duranTop.ustMu ? minCamY : maxCamY;
      } else {
        hedefCamY = clamp(duranTop.noktaY - visH * 0.5, minCamY, maxCamY);
      }
    } else {
      hedefCamY = clamp(top.y - visH * ustBias + kameraVelY * 0.08, minCamY, maxCamY);
    }

    if (kameraSifirla) {
      kameraX = hedefCamX;
      kameraY = hedefCamY;
      kameraVelY = 0;
      kameraSifirla = false;
    } else {
      var kY = (durum === 'gol' || duranTop) ? 5.2 : 3.6;
      var dY = (hedefCamY - kameraY) * (1 - Math.exp(-kY * camDt));
      var maxDY = 600 * camDt;
      kameraY += clamp(dY, -maxDY, maxDY);

      var kX = duranTop ? 5.2 : 3.4;
      var dX = (hedefCamX - kameraX) * (1 - Math.exp(-kX * camDt));
      var maxDX = 340 * camDt;
      kameraX += clamp(dX, -maxDX, maxDX);
    }
    var camX = kameraX;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0e131c';
    ctx.fillRect(0, 0, vw, vh);

    var sars = efektCagir('sarsintiAl');
    var sx = sars ? (Array.isArray(sars) ? (sars[0] || 0) : (sars.x || sars.dx || 0)) : 0;
    var sy = sars ? (Array.isArray(sars) ? (sars[1] || 0) : (sars.y || sars.dy || 0)) : 0;

    ctx.save();
    ctx.scale(camScale, camScale);
    ctx.translate(-camX + sx, -kameraY + sy);

    if (global.SAHA && typeof global.SAHA.cizZemin === 'function') {
      guvenliCagir('SAHA.cizZemin', function () {
        global.SAHA.cizZemin(ctx, camX - 40, kameraY - 40, visW + 80, visH + 80);
      });
    }

    duranTopDunyaCiz(ctx, saha);

    if (durum === 'oyun' && top.ortaMi && !top.sahip && top.z > 14) {
      var hedefX = top.pasHedef ? top.pasHedef.x : clamp(top.x + top.vx * 0.25, saha.sol + 40, saha.sag - 40);
      var hedefY = top.pasHedef ? top.pasHedef.y : clamp(top.y + top.vy * 0.25, saha.ust + 40, saha.alt - 40);
      var halkaNabiz = 1 + 0.14 * Math.sin(zaman * 12);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(hedefX, hedefY, 28 * halkaNabiz, 17 * halkaNabiz, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 232, 90, 0.18)';
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = 'rgba(255, 245, 160, 0.92)';
      ctx.stroke();
      ctx.restore();
    }

    var oc = global.OYUNCU_CIZ;
    if (oc && typeof oc.kontrolOkCiz === 'function' && durum === 'oyun' && aktifOyuncu) {
      var okGuc = (duranTop && duranTop.asama === 'hazir' && duranTop.takim === 'GS')
        ? (duranTop.gucSarj || 0)
        : (sutSarjAktif ? clamp(sutSarjSure / 0.48, 0.08, 1) : (aslanGucu >= 100 ? 1 : 0));
      guvenliCagir('OYUNCU_CIZ.kontrolOkCiz', function () {
        oc.kontrolOkCiz(ctx, aktifOyuncu, pasHedef, okGuc, zaman);
      });
    }

    // Y koordinatına göre sıralı oyuncu + top çizimi
    var siralama = oyuncular.slice().sort(function (a, b) { return a.y - b.y; });
    var topCizildi = false;
    var kaleciTopTutuyor = Boolean(top.sahip && top.sahip.kaleciMi);

    for (var i = 0; i < siralama.length; i++) {
      var p = siralama[i];
      if (!topCizildi && !kaleciTopTutuyor && top.z <= 22 && top.y < p.y) {
        if (oc && typeof oc.topCiz === 'function') {
          guvenliCagir('OYUNCU_CIZ.topCiz', function () { oc.topCiz(ctx, top, zaman); });
        }
        topCizildi = true;
      }
      if (oc && typeof oc.oyuncuCiz === 'function') {
        var aktifMi = (durum === 'oyun' && p === aktifOyuncu);
        var pasHedefMi = (durum === 'oyun' && (p === pasHedef || (!top.sahip && p === top.pasHedef && top.pasKilitSure > 0 && p.takim === 'GS')));
        guvenliCagir('OYUNCU_CIZ.oyuncuCiz', function () {
          oc.oyuncuCiz(ctx, p, aktifMi, pasHedefMi, zaman);
        });
      }
      if (!topCizildi && kaleciTopTutuyor && p === top.sahip) {
        if (oc && typeof oc.topCiz === 'function') {
          guvenliCagir('OYUNCU_CIZ.topCiz', function () { oc.topCiz(ctx, top, zaman); });
        }
        topCizildi = true;
      }
    }

    if (!topCizildi && oc && typeof oc.topCiz === 'function') {
      guvenliCagir('OYUNCU_CIZ.topCiz', function () { oc.topCiz(ctx, top, zaman); });
    }

    if (global.SAHA && typeof global.SAHA.cizKalelerUst === 'function') {
      guvenliCagir('SAHA.cizKalelerUst', function () { global.SAHA.cizKalelerUst(ctx); });
    }

    efektCagir('cizDunya', ctx);
    ctx.restore();

    duranTopKatmaniCiz(ctx, vw, vh);
    efektCagir('cizEkran', ctx, vw, vh);
  }

  // --- Gamepad Yoklama ---

  function gamepadYokla() {
    try {
      if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
        return;
      }
      var pads = navigator.getGamepads();
      if (!pads) return;

      var pad = null;
      for (var i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
          pad = pads[i];
          break;
        }
      }

      if (!pad) {
        padX = 0;
        padY = 0;
        return;
      }

      var ax = pad.axes && pad.axes.length > 0 ? pad.axes[0] : 0;
      var ay = pad.axes && pad.axes.length > 1 ? pad.axes[1] : 0;
      var dUp = pad.buttons && pad.buttons[12] && pad.buttons[12].pressed;
      var dDown = pad.buttons && pad.buttons[13] && pad.buttons[13].pressed;
      var dLeft = pad.buttons && pad.buttons[14] && pad.buttons[14].pressed;
      var dRight = pad.buttons && pad.buttons[15] && pad.buttons[15].pressed;

      var dx = 0;
      var dy = 0;
      if (dLeft) dx -= 1;
      if (dRight) dx += 1;
      if (dUp) dy -= 1;
      if (dDown) dy += 1;

      if (dx === 0 && dy === 0) {
        var mag = hypot2(ax, ay);
        if (mag > 0.20) {
          var olcek = clamp((mag - 0.20) / 0.75, 0, 1) / mag;
          dx = ax * olcek;
          dy = ay * olcek;
        }
      }
      padX = dx;
      padY = dy;

      var butonKontrol = function (idx) {
        var basili = Boolean(pad.buttons && pad.buttons[idx] && pad.buttons[idx].pressed);
        var yeni = basili && !oncekiPadButonlar[idx];
        oncekiPadButonlar[idx] = basili;
        return yeni;
      };

      var basPas = butonKontrol(0) || butonKontrol(2); // A / X
      var sutBasili = Boolean(
        pad.buttons && (
          (pad.buttons[1] && pad.buttons[1].pressed) ||
          (pad.buttons[3] && pad.buttons[3].pressed) ||
          (pad.buttons[7] && pad.buttons[7].pressed)
        )
      );
      var basSut = sutBasili && !oncekiPadButonlar.sutBirlesik;
      var birakSut = !sutBasili && Boolean(oncekiPadButonlar.sutBirlesik);
      oncekiPadButonlar.sutBirlesik = sutBasili;
      var basStart = butonKontrol(9); // Start

      if (basStart) {
        if (durum === 'oyun') molaAc();
        else if (durum === 'mola') molaKapat();
        else if (durum === 'baslik') maciBaslat();
        else if (durum === 'devre') ikinciYariBaslat();
        else if (durum === 'sonuc') maciBaslat();
      } else if (basPas) {
        if (durum === 'oyun') pasVeyaKapTetikle();
        else if (durum === 'baslik') maciBaslat();
        else if (durum === 'devre') ikinciYariBaslat();
        else if (durum === 'mola') molaKapat();
        else if (durum === 'sonuc') maciBaslat();
      } else if (basSut && durum === 'oyun') {
        sutBasla();
      } else if (birakSut && durum === 'oyun') {
        sutBirak();
      }
    } catch (_) {
      padX = 0;
      padY = 0;
    }
  }

  // --- Olay Dinleyicileri (Dokunmatik, Klavye & Düğmeler) ---

  function joyTopuzGuncelle(kx, ky) {
    if (!dom.joyTopuz) return;
    dom.joyTopuz.style.transform = 'translate(' + kx.toFixed(1) + 'px, ' + ky.toFixed(1) + 'px)';
  }

  function joySifirla() {
    joyPointerId = null;
    joyX = 0;
    joyY = 0;
    joyTopuzGuncelle(0, 0);
    if (dom.joyTaban) {
      dom.joyTaban.classList.remove('aktif');
      dom.joyTaban.classList.add('gizli');
      dom.joyTaban.style.display = 'none';
    }
  }

  function olaylariBagla() {
    if (typeof document === 'undefined') return;

    // 1. Sol yüzer joystick (pointerId ile bağımsız çoklu dokunma)
    if (dom.solAlan) {
      dom.solAlan.addEventListener('pointerdown', function (e) {
        guvenliCagir('joy.pointerdown', function () {
          if (joyPointerId !== null) return;
          e.preventDefault();
          sesAcIlkDokunus();
          joyPointerId = e.pointerId;
          if (typeof dom.solAlan.setPointerCapture === 'function') {
            try { dom.solAlan.setPointerCapture(e.pointerId); } catch (_) {}
          }
          var rect = dom.solAlan.getBoundingClientRect();
          joyOriginX = e.clientX - rect.left;
          joyOriginY = e.clientY - rect.top;
          joyX = 0;
          joyY = 0;

          if (dom.joyTaban) {
            perdeGoster(dom.joyTaban, 'flex');
            dom.joyTaban.classList.add('aktif');
            dom.joyTaban.style.left = joyOriginX.toFixed(1) + 'px';
            dom.joyTaban.style.top = joyOriginY.toFixed(1) + 'px';
            dom.joyTaban.style.transform = 'translate(-50%, -50%)';
            joyMaxR = Math.max(36, Math.min(62, (dom.joyTaban.offsetWidth || 100) * 0.44));
          }
          joyTopuzGuncelle(0, 0);
        });
      });

      var joyTasi = function (e) {
        guvenliCagir('joy.pointermove', function () {
          if (joyPointerId === null || e.pointerId !== joyPointerId) return;
          var rect = dom.solAlan.getBoundingClientRect();
          var dx = (e.clientX - rect.left) - joyOriginX;
          var dy = (e.clientY - rect.top) - joyOriginY;
          var dist = hypot2(dx, dy);
          var clamped = Math.min(dist, joyMaxR);
          var aci = Math.atan2(dy, dx);
          var kx = dist > 0.01 ? Math.cos(aci) * clamped : 0;
          var ky = dist > 0.01 ? Math.sin(aci) * clamped : 0;

          if (dist < 6) {
            joyX = 0;
            joyY = 0;
          } else {
            var mag = (clamped - 6) / Math.max(1, joyMaxR - 6);
            joyX = Math.cos(aci) * mag;
            joyY = Math.sin(aci) * mag;
          }
          joyTopuzGuncelle(kx, ky);
        });
      };

      var joyBirak = function (e) {
        if (joyPointerId === null || e.pointerId !== joyPointerId) return;
        joySifirla();
      };

      dom.solAlan.addEventListener('pointermove', joyTasi);
      dom.solAlan.addEventListener('pointerup', joyBirak);
      dom.solAlan.addEventListener('pointercancel', joyBirak);
      global.addEventListener('pointermove', joyTasi);
      global.addEventListener('pointerup', joyBirak);
      global.addEventListener('pointercancel', joyBirak);
    }

    // 2. Sağ başparmak düğmeleri (PAS & ŞUT)
    if (dom.btnPas) {
      var pasBasiliId = null;
      dom.btnPas.addEventListener('pointerdown', function (e) {
        guvenliCagir('btnPas.pointerdown', function () {
          e.preventDefault();
          e.stopPropagation();
          sesAcIlkDokunus();
          pasBasiliId = e.pointerId;
          sonPasPointerMs = simdiMs();
          dom.btnPas.classList.add('basili');
          pasVeyaKapTetikle();
        });
      });
      var pasBirak = function (e) {
        if (pasBasiliId !== null && e.pointerId === pasBasiliId) {
          pasBasiliId = null;
          dom.btnPas.classList.remove('basili');
        }
      };
      dom.btnPas.addEventListener('pointerup', pasBirak);
      dom.btnPas.addEventListener('pointercancel', pasBirak);
      dom.btnPas.addEventListener('click', function () {
        guvenliCagir('btnPas.click', function () {
          if (simdiMs() - sonPasPointerMs < 350) return;
          sesAcIlkDokunus();
          pasVeyaKapTetikle();
        });
      });
    }

    if (dom.btnSut) {
      var sutBasiliId = null;
      dom.btnSut.addEventListener('pointerdown', function (e) {
        guvenliCagir('btnSut.pointerdown', function () {
          e.preventDefault();
          e.stopPropagation();
          sesAcIlkDokunus();
          sutBasiliId = e.pointerId;
          sonSutPointerMs = simdiMs();
          dom.btnSut.classList.add('basili');
          sutBasla();
        });
      });
      var sutBirakOlay = function (e) {
        if (sutBasiliId !== null && e.pointerId === sutBasiliId) {
          sutBasiliId = null;
          dom.btnSut.classList.remove('basili');
          sutBirak();
        }
      };
      dom.btnSut.addEventListener('pointerup', sutBirakOlay);
      dom.btnSut.addEventListener('pointercancel', sutBirakOlay);
      dom.btnSut.addEventListener('click', function () {
        guvenliCagir('btnSut.click', function () {
          if (simdiMs() - sonSutPointerMs < 350) return;
          sesAcIlkDokunus();
          sutTetikle();
        });
      });
    }

    // 3. Perde, rakip seçici ve ses düğmeleri
    if (dom.rakipBtnler && dom.rakipBtnler.length) {
      for (var rb = 0; rb < dom.rakipBtnler.length; rb++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            guvenliCagir('rakipBtn.click', function () {
              sesAcIlkDokunus();
              var rk = String(btn.getAttribute('data-rakip') || 'FB').toUpperCase();
              rakipSec(rk);
            });
          });
        })(dom.rakipBtnler[rb]);
      }
    }
    if (dom.btnBasla) {
      dom.btnBasla.addEventListener('click', function () {
        guvenliCagir('btnBasla.click', maciBaslat);
      });
    }
    if (dom.btnDevam) {
      dom.btnDevam.addEventListener('click', function () {
        guvenliCagir('btnDevam.click', ikinciYariBaslat);
      });
    }
    if (dom.btnTekrar) {
      dom.btnTekrar.addEventListener('click', function () {
        guvenliCagir('btnTekrar.click', maciBaslat);
      });
    }
    if (dom.btnMolaDevam) {
      dom.btnMolaDevam.addEventListener('click', function () {
        guvenliCagir('btnMolaDevam.click', molaKapat);
      });
    }
    if (dom.btnMolaYeniden) {
      dom.btnMolaYeniden.addEventListener('click', function () {
        guvenliCagir('btnMolaYeniden.click', maciBaslat);
      });
    }
    if (dom.btnMolaAna) {
      dom.btnMolaAna.addEventListener('click', function () {
        guvenliCagir('btnMolaAna.click', anaEkranaDon);
      });
    }
    if (dom.btnSonucAna) {
      dom.btnSonucAna.addEventListener('click', function () {
        guvenliCagir('btnSonucAna.click', anaEkranaDon);
      });
    }
    if (dom.molaBtn) {
      dom.molaBtn.addEventListener('click', function () {
        guvenliCagir('molaBtn.click', function () {
          odakBirak();
          if (durum === 'oyun') molaAc();
        });
      });
    }
    if (dom.sesBtn) {
      dom.sesBtn.addEventListener('click', function () {
        guvenliCagir('sesBtn.click', function () {
          odakBirak();
          var s = global.SES;
          if (!s) return;
          if (typeof s.sesAyar === 'function') {
            s.sesAyar();
          } else if (s.sessiz) {
            if (typeof s.ac === 'function') s.ac();
            s.sessiz = false;
          } else {
            if (typeof s.sustur === 'function') s.sustur();
            s.sessiz = true;
          }
          sesButonGuncelle();
        });
      });
    }

    // 4. PC Klavye Desteği (WASD/Oklar, Space/C/K, X/Z/J, Enter, P/Escape, R)
    global.addEventListener('keydown', function (e) {
      guvenliCagir('keydown', function () {
        var code = (e.code || '').toLowerCase();
        var key = (e.key || '').toLowerCase();

        // Ok tuşları ve Boşluk sayfayı asla kaydırmasın / odaklı düğmeyi tetiklemesin
        if (code.indexOf('arrow') === 0 || code === 'space' || key === ' ') {
          e.preventDefault();
        }
        if (code === 'enter' || key === 'enter') {
          e.preventDefault();
        }

        if (code) tuslar[code] = true;
        if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
          tuslar['key' + key] = true;
        }

        sesAcIlkDokunus();
        if (e.repeat) return;

        // Mola (P / Escape)
        if (code === 'keyp' || key === 'p' || code === 'escape' || key === 'escape') {
          e.preventDefault();
          if (durum === 'oyun') molaAc();
          else if (durum === 'mola') molaKapat();
          return;
        }

        // Hızlı Yeniden Başla (R)
        if (code === 'keyr' || key === 'r') {
          e.preventDefault();
          if (durum === 'oyun' || durum === 'mola' || durum === 'devre' || durum === 'gol' || durum === 'sonuc') {
            maciBaslat();
          }
          return;
        }

        // Başla / Devam / Tekrar (Enter)
        if (code === 'enter' || key === 'enter') {
          if (durum === 'baslik') maciBaslat();
          else if (durum === 'devre') ikinciYariBaslat();
          else if (durum === 'mola') molaKapat();
          else if (durum === 'sonuc') maciBaslat();
          return;
        }

        // Pas / Kap (X / Z / J)
        if (code === 'keyx' || key === 'x' || code === 'keyz' || key === 'z' || code === 'keyj' || key === 'j') {
          e.preventDefault();
          pasVeyaKapTetikle();
          return;
        }

        // Şut / Aslan Şutu (Space / C / K — basılı tutunca güçlenir, bırakınca şut)
        if (code === 'space' || key === ' ' || code === 'keyc' || key === 'c' || code === 'keyk' || key === 'k') {
          sutBasla();
        }
      });
    });

    global.addEventListener('keyup', function (e) {
      var code = (e.code || '').toLowerCase();
      var key = (e.key || '').toLowerCase();
      if (code) delete tuslar[code];
      if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        delete tuslar['key' + key];
      }
      if (code === 'space' || key === ' ' || code === 'keyc' || key === 'c' || code === 'keyk' || key === 'k') {
        sutBirak();
      }
    });

    global.addEventListener('blur', function () {
      tuslar = {};
      joySifirla();
      girdiTamponSifirla();
    });
  }

  // --- Ana Döngü ---

  var donguCalisiyor = false;
  var sonKareMs = 0;

  function dongu(simdi) {
    if (!donguCalisiyor) return;
    guvenliCagir('dongu', function () {
      if (!sonKareMs) sonKareMs = simdi;
      var hamDt = Math.min(0.05, Math.max(0.001, (simdi - sonKareMs) / 1000));
      sonKareMs = simdi;

      // FPS ölçümü
      fpsKare += 1;
      if (simdi - fpsSonMs >= 500) {
        fps = Math.round((fpsKare * 1000) / (simdi - fpsSonMs));
        fpsKare = 0;
        fpsSonMs = simdi;
      }

      gamepadYokla();

      var toplamDt = hamDt * ayar.hiz;
      var altAdimlar = Math.max(1, Math.min(20, Math.ceil(toplamDt / 0.016)));
      var adimDt = toplamDt / altAdimlar;
      for (var i = 0; i < altAdimlar; i++) {
        adimGuncelle(adimDt);
      }

      sahneyiCiz();
    });

    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(dongu);
    }
  }

  // --- Kurulum ve Genel API ---

  var kuruldu = false;

  function kur() {
    if (kuruldu) return;
    kuruldu = true;

    guvenliCagir('kur', function () {
      domKur();

      if (ayar.sessiz && global.SES && typeof global.SES.sesAyar === 'function') {
        try { global.SES.sesAyar(false); } catch (_) {}
      }
      sesButonGuncelle();

      if (global.SAHA && typeof global.SAHA.kur === 'function') {
        guvenliCagir('SAHA.kur', function () { global.SAHA.kur(); });
      }
      rakipSec(seciliRakip);
      efektCagir('kur');

      oyunculariKur();
      santraDizilisi('GS');
      durum = 'baslik';
      perdeleriSenkronla();
      hudGuncelle(true);
      olaylariBagla();

      if (!donguCalisiyor && typeof global.requestAnimationFrame === 'function') {
        donguCalisiyor = true;
        sonKareMs = 0;
        global.requestAnimationFrame(dongu);
      }
    });
  }

  function duranTopTelemetri(d, saha) {
    if (!d) return null;
    var rakipler = d.takim === 'GS' ? fbOyuncular : gsOyuncular;
    var minMes = 1e9;
    var cezaDisiOk = true;
    var cezaDerin = saha.cezaDerin || 220;
    for (var i = 0; i < rakipler.length; i++) {
      var r = rakipler[i];
      if (r.kaleciMi) continue;
      var dm = hypot2(r.x - d.noktaX, r.y - d.noktaY);
      if (dm < minMes) minMes = dm;
      if (d.tip === 'aut') {
        if (d.ustMu && r.y < saha.ust + cezaDerin + 10) cezaDisiOk = false;
        if (!d.ustMu && r.y > saha.alt - cezaDerin - 10) cezaDisiOk = false;
      }
    }
    return {
      tip: d.tip,
      takim: d.takim,
      asama: d.asama,
      noktaX: Math.round(d.noktaX),
      noktaY: Math.round(d.noktaY),
      solMu: Boolean(d.solMu),
      ustMu: Boolean(d.ustMu),
      nisanAci: Number((d.nisanAci || 0).toFixed(3)),
      hedefX: Math.round(d.hedefX || 0),
      hedefY: Math.round(d.hedefY || 0),
      gucSarj: Number((d.gucSarj || 0).toFixed(2)),
      atanTopMesafe: d.atan ? Math.round(hypot2(d.atan.x - d.noktaX, d.atan.y - d.noktaY)) : 0,
      minRakipMesafe: minMes < 1e8 ? Math.round(minMes) : 999,
      cezaDisiOk: cezaDisiOk,
      atan: d.atan ? {
        id: d.atan.id,
        ad: d.atan.ad,
        no: d.atan.no,
        rol: d.atan.rol,
        gunMu: Boolean(d.atan.gunMu),
        kaleciMi: Boolean(d.atan.kaleciMi),
        tacTutuyor: Boolean(d.atan.tacTutuyor),
        x: Math.round(d.atan.x),
        y: Math.round(d.atan.y)
      } : null
    };
  }

  function bilgiAl() {
    var saha = sahaAl();
    var gsHucumDestekSayisi = 0;
    for (var gi = 0; gi < gsOyuncular.length; gi++) {
      var gp = gsOyuncular[gi];
      if (!gp.kaleciMi && gp.y < saha.ortaY) {
        gsHucumDestekSayisi++;
      }
    }
    return {
      durum: durum,
      seciliRakip: seciliRakip,
      yari: yari,
      kalanSure: Number(Math.max(0, kalanSure).toFixed(1)),
      gsSkor: gsSkor,
      fbSkor: fbSkor,
      aslanGucu: Math.round(aslanGucu),
      altinGol: altinGol,
      fps: fps,
      oto: otoMod,
      hatalar: hatalar.slice(),
      gsOyuncuSayisi: gsOyuncular.length,
      fbOyuncuSayisi: fbOyuncular.length,
      gsHucumDestekSayisi: gsHucumDestekSayisi,
      sahaBoyut: { W: Math.round(saha.W), H: Math.round(saha.H) },
      aktifOyuncu: aktifOyuncu ? {
        id: aktifOyuncu.id,
        ad: aktifOyuncu.ad,
        no: aktifOyuncu.no,
        rol: aktifOyuncu.rol,
        takim: aktifOyuncu.takim,
        gunMu: Boolean(aktifOyuncu.gunMu),
        x: Math.round(aktifOyuncu.x),
        y: Math.round(aktifOyuncu.y)
      } : null,
      topSahip: top.sahip ? {
        id: top.sahip.id,
        ad: top.sahip.ad,
        takim: top.sahip.takim,
        kaleciMi: Boolean(top.sahip.kaleciMi),
        kaleciTutuyor: Boolean(top.sahip.kaleciTutuyor)
      } : null,
      pasHedefId: pasHedef ? pasHedef.id : null,
      pasHedefAd: pasHedef ? pasHedef.ad : null,
      duranTop: duranTopTelemetri(duranTop, saha),
      sonVuranId: top.sonVuran ? top.sonVuran.id : null,
      almakYasakSure: Number(Math.max(0, top.almakYasakSure).toFixed(2)),
      topX: Math.round(top.x),
      topY: Math.round(top.y),
      topZ: Math.round(top.z),
      topHiz: Math.round(hypot2(top.vx, top.vy)),
      topAslanMi: Boolean(top.aslanMi),
      kameraY: Math.round(kameraY),
      fbPasSoguma: Number(fbPasSoguma.toFixed(2)),
      sutSarj: sutSarjAktif ? Number(clamp(sutSarjSure / 0.48, 0, 1).toFixed(2)) : 0,
      golKutlamaAktif: Boolean(durum === 'gol' && !golKutlamaBekliyor),
      gunTopSayisi: gunTopSayisi,
      goller: goller.slice()
    };
  }

  function testKaleciTopVer(takim) {
    return Boolean(guvenliCagir('testKaleciTopVer', function () {
      var gk = takim === 'FB' ? fbKaleci : gsKaleci;
      if (!gk) return false;
      topSahiplikVer(gk, true);
      return true;
    }));
  }

  function testKaleciSutAt() {
    return Boolean(guvenliCagir('testKaleciSutAt', function () {
      if (durum === 'baslik') maciBaslat();
      else if (durum === 'mola') molaKapat();
      if (durum !== 'oyun' || !fbKaleci) return false;

      var saha = sahaAl();
      duranTop = null;
      fbKaleci.x = saha.ortaX;
      fbKaleci.y = saha.ust + 48;
      fbKaleci.vx = 0;
      fbKaleci.vy = 0;
      fbKaleci.sersemSure = 0;
      fbKaleci.kaleciTutuyor = false;
      fbKaleci.kurtarisSure = 0;
      fbKaleci.ucusT = 0;
      fbKaleci.ucusYon = 0;
      fbKaleci.ucusVx = 0;

      for (var i = 0; i < oyuncular.length; i++) {
        var o = oyuncular[i];
        if (!o.kaleciMi && o.y < saha.ust + 260 && Math.abs(o.x - saha.ortaX) < 110) {
          o.x = saha.sol + 140;
        }
      }

      top.sahip = null;
      top.x = saha.ortaX;
      top.y = saha.ust + 220;
      top.z = 6;
      top.vx = 0;
      top.vy = -780;
      top.vz = 25;
      top.aslanMi = false;
      top.superMi = false;
      top.ortaMi = false;
      top.falso = 0;
      top.falsoSure = 0;
      top.sonVuran = gunOyuncu;
      top.sonTakim = 'GS';
      top.pasHedef = null;
      top.pasKilitSure = 0;
      top.pasAlisKilidi = 0;
      top.almakYasakSure = 0;
      top.degajKoruma = 0;
      top.iz.length = 0;
      kameraSifirla = true;
      return true;
    }));
  }

  function tetikleAslanSutu() {
    return Boolean(guvenliCagir('tetikleAslanSutu', function () {
      if (durum === 'baslik') {
        maciBaslat();
      } else if (durum === 'mola') {
        molaKapat();
      }
      if (durum !== 'oyun') return false;

      var saha = sahaAl();
      var sutcu = (top.sahip && top.sahip.takim === 'GS') ? top.sahip : (gunOyuncu || aktifOyuncu);
      if (!sutcu) return false;

      if (top.sahip !== sutcu) {
        sutcu.x = clamp(sutcu.x, saha.sol + 80, saha.sag - 80);
        sutcu.y = clamp(Math.min(sutcu.y, saha.ortaY - 60), saha.ust + 150, saha.ortaY - 60);
        sutcu.yonAci = -Math.PI * 0.5;
        topSahiplikVer(sutcu, true);
      }

      aslanGucu = 100;
      aktifOyuncu = sutcu;
      sutcu.aslanHazir = true;
      hudGuncelle(true);

      var hedef = gsSutHedefiSec(sutcu, null);
      aslanCutawayBaslat(sutcu, hedef);
      return true;
    }));
  }

  var OYUN = {
    kur: kur,
    rakipSec: function (kod) { return guvenliCagir('rakipSec', function () { return rakipSec(kod); }); },
    baslat: maciBaslat,
    devamEt: ikinciYariBaslat,
    molaAc: molaAc,
    molaKapat: molaKapat,
    anaEkran: anaEkranaDon,
    tekrarOyna: maciBaslat,
    otoAyar: function (acik) { otoMod = Boolean(acik); },
    tetikleAslanSutu: tetikleAslanSutu,
    testKaleciTopVer: testKaleciTopVer,
    testKaleciSutAt: testKaleciSutAt,
    testDuranTop: testDuranTop,
    bilgi: bilgiAl,
    hatalar: hatalar
  };

  global.OYUN = OYUN;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', kur);
    } else {
      kur();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
