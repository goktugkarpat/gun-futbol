(function (global) {
  'use strict';

  // --- Sabit Havuz ve Süre Ayarları (M1 iPad 60 FPS Sıfır-GC) ---
  var MAX_PARCACIK = 160;
  var MAX_HALKA = 32;
  var CUTAWAY_SURE = 0.78;
  var GOL_BANNER_SURE = 2.25;

  // Parçacık tipleri
  var P_TOZ = 0;
  var P_ATES = 1;
  var P_KIVILCIM = 2;
  var P_YILDIZ = 3;
  var P_KONFETI = 4;
  var P_MOTE = 5;

  // Halka / çizgi tipleri
  var H_DARBE = 0;
  var H_CIZGI = 1;
  var H_PAS = 2;

  // Önceden ayrılmış renk paletleri (döngü içinde dizi üretilmez)
  var GS_RENKLER = ['#FDB912', '#A90432', '#ffdd00', '#e30a17', '#ff6d00', '#ffffff'];
  var FB_RENKLER = ['#FFED00', '#002D72', '#ffd000', '#0b4ea2', '#4da6ff', '#ffffff'];
  var BJK_RENKLER = ['#FFFFFF', '#18181B', '#E2E8F0', '#94A3B8', '#FACC15', '#111111'];
  var TS_RENKLER = ['#7C1332', '#00A8E8', '#A61C45', '#38BDF8', '#FFFFFF', '#4A0A1D'];
  var ATES_RENKLER = ['#fff7cc', '#ffd000', '#ff8800', '#ff3b00', '#d90429'];
  var TOZ_RENKLER = ['#f2eedc', '#e2dbc2', '#d4ccb0'];
  var YILDIZ_RENKLER = ['#ffffff', '#ffe44d', '#ffb703'];
  var DIREK_RENKLER = ['#ffffff', '#fff0a8', '#ff9e00', '#ffd166'];
  var PAS_RENKLER = ['#ffffff', '#ffe680', '#7ae7ff'];

  // 5 köşeli yıldız birim koordinatları (sıfır çöp için sabit tablo)
  var YILDIZ_UX = [];
  var YILDIZ_UY = [];
  (function () {
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI * 0.5 + (i * Math.PI) / 5;
      var r = (i % 2 === 0) ? 1.0 : 0.42;
      YILDIZ_UX[i] = Math.cos(a) * r;
      YILDIZ_UY[i] = Math.sin(a) * r;
    }
  })();

  // Sabit havuzlar
  var parcaciklar = new Array(MAX_PARCACIK);
  var halkalar = new Array(MAX_HALKA);
  for (var pi = 0; pi < MAX_PARCACIK; pi++) {
    parcaciklar[pi] = {
      aktif: false,
      tip: P_TOZ,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      suruklenme: 0,
      omur: 0,
      maxOmur: 1,
      boy: 4,
      en: 4,
      buyume: 0,
      aci: 0,
      aciHiz: 0,
      salinimFaz: 0,
      salinimHiz: 0,
      renk: '#ffffff',
      renk2: '#ffffff',
      alfa: 1
    };
  }
  for (var hi = 0; hi < MAX_HALKA; hi++) {
    halkalar[hi] = {
      aktif: false,
      tip: H_DARBE,
      x: 0,
      y: 0,
      x2: 0,
      y2: 0,
      vx: 0,
      vy: 0,
      yaricap: 4,
      maxYaricap: 40,
      kalinlik: 2,
      omur: 0,
      maxOmur: 1,
      renk: '#ffffff',
      renk2: '#ffffff',
      alfa: 1
    };
  }

  var parcacikImlec = 0;
  var halkaImlec = 0;
  var aktifParcacikSayisi = 0;
  var aktifHalkaSayisi = 0;

  // Ekran sarsıntısı (sıfır-GC için tek yeniden kullanılan nesne)
  var sarsintiCikti = { x: 0, y: 0 };
  var sarsintiGuc = 0;
  var sarsintiSure = 0;
  var sarsintiMaxSure = 0;
  var sarsintiFaz = 0;

  // Cutaway (ASLAN ŞUTU!) durumu
  var cutawayGecen = 0;
  var cutawaySure = 0;
  var cutawayNoEtiket = '61';
  var cutawayAdEtiket = 'GÜN';
  var cutawayTamEtiket = 'GÜN';
  var cutawayBandVar = true;
  var cutawaySacRenk = '#2c1b10';
  var cutawayTenRenk = '#f6cca8';

  // Gol kutlaması durumu
  var golSure = 0;
  var golMaxSure = GOL_BANNER_SURE;
  var golFbMi = false;
  var golTakimKod = 'GS';
  var golAtanEtiket = '';
  var golTakimEtiket = 'GALATASARAY!';
  var golAltYazi = '★ GALATASARAY! ★';

  // Ekran flaş parıltısı
  var ekranFlas = 0;
  var ekranFlasRenk = '#fff7d6';

  // Yazı tipi önbelleği (her kare string oluşturmamak için)
  var fontAslanBoy = -1;
  var fontAslanStr = '';
  var fontSutuBoy = -1;
  var fontSutuStr = '';
  var fontEtiketBoy = -1;
  var fontEtiketStr = '';
  var fontGolBoy = -1;
  var fontGolStr = '';
  var fontGolAltBoy = -1;
  var fontGolAltStr = '';

  function sinirli(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function kolayDisaBack(t) {
    var s = 1.70158;
    var u = sinirli(t, 0, 1) - 1;
    return u * u * ((s + 1) * u + s) + 1;
  }

  function turkceBuyuk(metin) {
    if (!metin) return '';
    try {
      return String(metin).toLocaleUpperCase('tr-TR');
    } catch (e) {
      return String(metin).toUpperCase();
    }
  }

  function parcacikAl() {
    for (var i = 0; i < MAX_PARCACIK; i++) {
      var idx = (parcacikImlec + i) % MAX_PARCACIK;
      var p = parcaciklar[idx];
      if (!p.aktif) {
        parcacikImlec = (idx + 1) % MAX_PARCACIK;
        return p;
      }
    }
    // Havuz doluysa bitmeye en yakın parçacığı devral
    var enYakin = parcaciklar[parcacikImlec];
    var enAzOran = enYakin.omur / (enYakin.maxOmur || 1);
    for (var j = 0; j < MAX_PARCACIK; j++) {
      var aday = parcaciklar[j];
      var oran = aday.omur / (aday.maxOmur || 1);
      if (oran < enAzOran) {
        enAzOran = oran;
        enYakin = aday;
      }
    }
    parcacikImlec = (parcacikImlec + 1) % MAX_PARCACIK;
    return enYakin;
  }

  function halkaAl() {
    for (var i = 0; i < MAX_HALKA; i++) {
      var idx = (halkaImlec + i) % MAX_HALKA;
      var h = halkalar[idx];
      if (!h.aktif) {
        halkaImlec = (idx + 1) % MAX_HALKA;
        return h;
      }
    }
    var enYakin = halkalar[halkaImlec];
    var enAzOran = enYakin.omur / (enYakin.maxOmur || 1);
    for (var j = 0; j < MAX_HALKA; j++) {
      var aday = halkalar[j];
      var oran = aday.omur / (aday.maxOmur || 1);
      if (oran < enAzOran) {
        enAzOran = oran;
        enYakin = aday;
      }
    }
    halkaImlec = (halkaImlec + 1) % MAX_HALKA;
    return enYakin;
  }

  function halkaEkle(tip, x, y, x2, y2, vx, vy, rBas, rBit, kalinlik, omur, renk, renk2, alfa) {
    var h = halkaAl();
    if (!h.aktif) aktifHalkaSayisi++;
    h.aktif = true;
    h.tip = tip;
    h.x = x;
    h.y = y;
    h.x2 = x2;
    h.y2 = y2;
    h.vx = vx;
    h.vy = vy;
    h.yaricap = rBas;
    h.maxYaricap = rBit;
    h.kalinlik = kalinlik;
    h.omur = omur;
    h.maxOmur = omur;
    h.renk = renk;
    h.renk2 = renk2;
    h.alfa = alfa;
  }

  function parcacikEkle(
    tip, x, y, vx, vy, ax, ay, suruklenme, omur, boy, en, buyume, aci, aciHiz, salinimHiz, renk, renk2, alfa
  ) {
    var p = parcacikAl();
    if (!p.aktif) aktifParcacikSayisi++;
    p.aktif = true;
    p.tip = tip;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.ax = ax;
    p.ay = ay;
    p.suruklenme = suruklenme;
    p.omur = omur;
    p.maxOmur = omur;
    p.boy = boy;
    p.en = en;
    p.buyume = buyume;
    p.aci = aci;
    p.aciHiz = aciHiz;
    p.salinimFaz = Math.random() * Math.PI * 2;
    p.salinimHiz = salinimHiz;
    p.renk = renk;
    p.renk2 = renk2;
    p.alfa = alfa;
  }

  function sarsintiTetikle(guc, sure) {
    if (guc > sarsintiGuc) sarsintiGuc = guc;
    if (sure > sarsintiSure) {
      sarsintiSure = sure;
      sarsintiMaxSure = sure;
    }
  }

  // --- Dışa Açılan Kontrol Fonksiyonları ---

  function sifirla() {
    for (var i = 0; i < MAX_PARCACIK; i++) {
      parcaciklar[i].aktif = false;
    }
    for (var j = 0; j < MAX_HALKA; j++) {
      halkalar[j].aktif = false;
    }
    parcacikImlec = 0;
    halkaImlec = 0;
    aktifParcacikSayisi = 0;
    aktifHalkaSayisi = 0;

    sarsintiCikti.x = 0;
    sarsintiCikti.y = 0;
    sarsintiGuc = 0;
    sarsintiSure = 0;
    sarsintiMaxSure = 0;
    sarsintiFaz = 0;

    cutawayGecen = 0;
    cutawaySure = 0;
    cutawayNoEtiket = '61';
    cutawayAdEtiket = 'GÜN';
    cutawayTamEtiket = 'GÜN';
    cutawayBandVar = true;
    cutawaySacRenk = '#2c1b10';
    cutawayTenRenk = '#f6cca8';

    golSure = 0;
    golMaxSure = GOL_BANNER_SURE;
    golFbMi = false;
    golTakimKod = 'GS';
    golAtanEtiket = '';
    golTakimEtiket = 'GALATASARAY!';
    golAltYazi = '★ GALATASARAY! ★';

    ekranFlas = 0;
  }

  function kur() {
    sifirla();
  }

  function cutawayAktif() {
    return cutawaySure > 0;
  }

  function sarsintiAl() {
    return sarsintiCikti;
  }

  // --- Efekt Tetikleyicileri ---

  function aslanCutaway(oyuncu) {
    cutawaySure = CUTAWAY_SURE;
    cutawayGecen = 0;

    var no = '61';
    var ad = 'GÜN';
    var band = true;
    var sac = '#2c1b10';
    var ten = '#f6cca8';
    if (oyuncu) {
      var hamNo = oyuncu.no !== undefined ? oyuncu.no : (oyuncu.numara !== undefined ? oyuncu.numara : oyuncu.formaNo);
      if (hamNo !== undefined && hamNo !== null && hamNo !== '') {
        no = String(hamNo);
      }
      var hamAd = oyuncu.ad || oyuncu.isim || oyuncu.name;
      if (hamAd) {
        ad = turkceBuyuk(String(hamAd).trim());
      }
      if (oyuncu.band !== undefined) band = !!oyuncu.band;
      if (oyuncu.sac) sac = String(oyuncu.sac);
      if (oyuncu.ten) ten = String(oyuncu.ten);
    }
    cutawayNoEtiket = no;
    cutawayAdEtiket = ad;
    cutawayTamEtiket = ad;
    cutawayBandVar = band;
    cutawaySacRenk = sac;
    cutawayTenRenk = ten;

    ekranFlas = 0.12;
    ekranFlasRenk = '#fff4c2';
    sarsintiTetikle(5, 0.22);

    // Eğer oyuncu dünya konumu verilmişse sahada da enerji patlaması çıkar
    if (oyuncu && typeof oyuncu.x === 'number' && typeof oyuncu.y === 'number') {
      var ox = oyuncu.x;
      var oy = oyuncu.y;
      halkaEkle(H_DARBE, ox, oy, 0, 0, 0, 0, 10, 88, 5, 0.42, '#ffd000', '#ffffff', 0.95);
      halkaEkle(H_DARBE, ox, oy, 0, 0, 0, 0, 6, 56, 3.5, 0.30, '#e30a17', '#fff4b8', 0.9);
      for (var i = 0; i < 16; i++) {
        var a = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        var hiz = 140 + Math.random() * 210;
        var renk = ATES_RENKLER[i % ATES_RENKLER.length];
        parcacikEkle(
          P_KIVILCIM,
          ox, oy,
          Math.cos(a) * hiz, Math.sin(a) * hiz,
          0, 0, 3.2,
          0.32 + Math.random() * 0.22,
          12 + Math.random() * 10, 3.2, 0,
          a, 0, 0,
          renk, '#ffffff', 1
        );
      }
    }
  }

  function golPatlat(x, y, takim, atan) {
    var gx = typeof x === 'number' ? x : 0;
    var gy = typeof y === 'number' ? y : 0;

    var tStr = (takim === undefined || takim === null) ? '' : turkceBuyuk(String(takim));
    var takimKod = 'GS';
    if (tStr === 'BJK' || tStr.indexOf('BEŞİKTAŞ') !== -1 || tStr.indexOf('BESIKTAS') !== -1) {
      takimKod = 'BJK';
    } else if (tStr === 'TS' || tStr.indexOf('TRABZON') !== -1) {
      takimKod = 'TS';
    } else if (
      takim === 1 ||
      tStr === 'FB' ||
      tStr.indexOf('FENER') !== -1 ||
      tStr.indexOf('LACİVERT') !== -1 ||
      tStr.indexOf('LACIVERT') !== -1 ||
      tStr === 'DEPLASMAN'
    ) {
      takimKod = 'FB';
    }
    var fbMi = takimKod !== 'GS';

    // Gol olduğunda sürmekte olan cutaway varsa temizle ki gol başlığı öne çıksın
    cutawaySure = 0;
    cutawayGecen = 0;

    golFbMi = fbMi;
    golTakimKod = takimKod;
    golSure = GOL_BANNER_SURE;
    golMaxSure = GOL_BANNER_SURE;
    golTakimEtiket = takimKod === 'BJK'
      ? 'BEŞİKTAŞ!'
      : (takimKod === 'TS' ? 'TRABZONSPOR!' : (takimKod === 'FB' ? 'FENERBAHÇE!' : 'GALATASARAY!'));

    var atanMetin = '';
    if (atan) {
      if (typeof atan === 'object') {
        var aAd = atan.ad || atan.isim || atan.name || '';
        atanMetin = turkceBuyuk(aAd);
      } else {
        atanMetin = turkceBuyuk(String(atan));
      }
    }
    golAtanEtiket = atanMetin.trim();
    golAltYazi = golAtanEtiket ? ('★ ' + golAtanEtiket + ' ★') : ('★ ' + golTakimEtiket + ' ★');

    ekranFlas = 0.18;
    ekranFlasRenk = takimKod === 'BJK' ? '#f8fafc' : (takimKod === 'TS' ? '#bae6fd' : (fbMi ? '#fff2a6' : '#ffe4b5'));
    sarsintiTetikle(12, 0.45);

    var palet = takimKod === 'BJK'
      ? BJK_RENKLER
      : (takimKod === 'TS' ? TS_RENKLER : (fbMi ? FB_RENKLER : GS_RENKLER));

    // 3 katmanlı şok halkası
    halkaEkle(H_DARBE, gx, gy, 0, 0, 0, 0, 12, 130, 6.5, 0.50, palet[0], '#ffffff', 0.95);
    halkaEkle(H_DARBE, gx, gy, 0, 0, 0, 0, 8, 92, 5.0, 0.38, palet[1], palet[0], 0.95);
    halkaEkle(H_DARBE, gx, gy, 0, 0, 0, 0, 4, 58, 3.5, 0.26, '#ffffff', palet[0], 0.9);

    // 90 adet tribün konfeti patlaması (takım renklerinde dönen & dalgalanan şeritler)
    for (var i = 0; i < 90; i++) {
      var aci = Math.random() * Math.PI * 2;
      var hiz = 110 + Math.random() * 340;
      var vx = Math.cos(aci) * hiz;
      // Tribünden/kaleden havaya doğru coşkulu saçılma
      var vy = Math.sin(aci) * hiz * 0.85 - 95 - Math.random() * 110;
      var renk = palet[i % palet.length];
      parcacikEkle(
        P_KONFETI,
        gx + (Math.random() - 0.5) * 18,
        gy + (Math.random() - 0.5) * 18,
        vx, vy,
        0, 210 + Math.random() * 90,
        2.5 + Math.random() * 0.9,
        1.15 + Math.random() * 0.85,
        7 + Math.random() * 5.5,
        4 + Math.random() * 3.5,
        0,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 14,
        7 + Math.random() * 9,
        renk, '#ffffff', 1
      );
    }

    // 20 adet parlak yıldız ve kıvılcım
    for (var j = 0; j < 20; j++) {
      var sa = (j / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      var shiz = 170 + Math.random() * 230;
      parcacikEkle(
        (j % 2 === 0) ? P_YILDIZ : P_KIVILCIM,
        gx, gy,
        Math.cos(sa) * shiz, Math.sin(sa) * shiz - 30,
        0, 80,
        2.8,
        0.42 + Math.random() * 0.28,
        8 + Math.random() * 6,
        3.2,
        0,
        sa,
        (Math.random() - 0.5) * 10,
        0,
        palet[j % palet.length], '#ffffff', 1
      );
    }
  }

  function pasIzi(x1, y1, x2, y2) {
    if (typeof x1 !== 'number' || typeof y1 !== 'number' || typeof x2 !== 'number' || typeof y2 !== 'number') return;
    var dx = x2 - x1;
    var dy = y2 - y1;
    var mesafe = Math.sqrt(dx * dx + dy * dy);
    if (mesafe < 1) return;

    halkaEkle(H_PAS, x1, y1, x2, y2, 0, 0, 0, 0, 4.2, 0.28, '#ffe680', '#ffffff', 0.9);

    var nx = dx / mesafe;
    var ny = dy / mesafe;
    var adet = 5;
    for (var i = 0; i < adet; i++) {
      var oran = (i + 0.5) / adet;
      var px = x1 + dx * oran + (Math.random() - 0.5) * 6;
      var py = y1 + dy * oran + (Math.random() - 0.5) * 6;
      parcacikEkle(
        P_MOTE,
        px, py,
        nx * (25 + Math.random() * 35) + (Math.random() - 0.5) * 18,
        ny * (25 + Math.random() * 35) + (Math.random() - 0.5) * 18,
        0, 0, 4.5,
        0.22 + Math.random() * 0.14,
        3.0 + Math.random() * 2.2, 0, -2.5,
        0, 0, 0,
        PAS_RENKLER[i % PAS_RENKLER.length], '#ffffff', 0.85
      );
    }
  }

  function sutKivilcim(x, y, vx, vy, superMi) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    var hizX = typeof vx === 'number' ? vx : 0;
    var hizY = typeof vy === 'number' ? vy : 0;
    var hiz = Math.sqrt(hizX * hizX + hizY * hizY);
    var nx = hiz > 0.001 ? hizX / hiz : 1;
    var ny = hiz > 0.001 ? hizY / hiz : 0;
    // Dik vektör (alev saçılma genişliği için)
    var tx = -ny;
    var ty = nx;

    if (superMi) {
      // Aslan Şutu: yoğun turuncu-altın-kırmızı ateş parçacıkları
      for (var i = 0; i < 4; i++) {
        var sapma = (Math.random() - 0.5) * 11;
        var geriHiz = 65 + Math.random() * 145;
        var yanHiz = (Math.random() - 0.5) * 95;
        var renk = ATES_RENKLER[Math.floor(Math.random() * ATES_RENKLER.length)];
        parcacikEkle(
          P_ATES,
          x - nx * (2 + Math.random() * 6) + tx * sapma,
          y - ny * (2 + Math.random() * 6) + ty * sapma,
          -nx * geriHiz + tx * yanHiz,
          -ny * geriHiz + ty * yanHiz - 18,
          0, -25,
          3.4,
          0.22 + Math.random() * 0.18,
          6.5 + Math.random() * 6.5,
          0,
          -9,
          0, 0, 0,
          renk, '#fffbe0', 0.95
        );
      }

      // Beyaz çekirdekli yüksek hız çizgileri
      var cizgiAdet = (Math.random() < 0.65) ? 2 : 1;
      for (var k = 0; k < cizgiAdet; k++) {
        var ofset = (Math.random() - 0.5) * 18;
        var uzunluk = 28 + Math.random() * 34;
        var cHiz = 110 + Math.random() * 130;
        halkaEkle(
          H_CIZGI,
          x + tx * ofset,
          y + ty * ofset,
          nx * uzunluk,
          ny * uzunluk,
          -nx * cHiz,
          -ny * cHiz,
          0, 0,
          2.1 + Math.random() * 1.4,
          0.14 + Math.random() * 0.08,
          (k === 0) ? '#ffb703' : '#ff4800',
          '#ffffff',
          0.95
        );
      }
    } else {
      // Normal sert şut darbe halkası, kıvılcım ve mikro sarsıntı
      var sertMi = hiz > 800;
      if (sertMi) {
        halkaEkle(H_DARBE, x, y, 0, 0, 0, 0, 6, 36, 3.2, 0.22, '#fff4b8', '#ffffff', 0.85);
        sarsintiTetikle(3.0, 0.11);
      }
      var kAdet = sertMi ? 4 : 2;
      for (var n = 0; n < kAdet; n++) {
        var gHiz = 45 + Math.random() * 95;
        var yHiz = (Math.random() - 0.5) * 75;
        parcacikEkle(
          P_KIVILCIM,
          x - nx * 3 + tx * (Math.random() - 0.5) * 7,
          y - ny * 3 + ty * (Math.random() - 0.5) * 7,
          -nx * gHiz + tx * yHiz,
          -ny * gHiz + ty * yHiz,
          0, 0, 4.2,
          0.16 + Math.random() * 0.12,
          8 + Math.random() * 7,
          2.2,
          0, 0, 0, 0,
          (n % 2 === 0) ? '#ffd166' : '#ff8c24',
          '#ffffff',
          0.9
        );
      }
    }
  }

  function toz(x, y, adet) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    var sayi = (typeof adet === 'number' && adet > 0) ? Math.min(16, Math.round(adet)) : 6;
    for (var i = 0; i < sayi; i++) {
      var a = Math.random() * Math.PI * 2;
      var hiz = 18 + Math.random() * 48;
      parcacikEkle(
        P_TOZ,
        x + (Math.random() - 0.5) * 10,
        y + (Math.random() - 0.5) * 6,
        Math.cos(a) * hiz,
        Math.sin(a) * hiz * 0.55 - 10 - Math.random() * 16,
        0, -8,
        3.6,
        0.26 + Math.random() * 0.22,
        4.2 + Math.random() * 4.0,
        0,
        12 + Math.random() * 8,
        0, 0, 0,
        TOZ_RENKLER[i % TOZ_RENKLER.length],
        '#ffffff',
        0.65
      );
    }
  }

  function kapmaYildiz(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    halkaEkle(H_DARBE, x, y, 0, 0, 0, 0, 4, 34, 3.2, 0.24, '#ffe44d', '#ffffff', 0.95);
    sarsintiTetikle(4.5, 0.18);

    var adet = 7;
    for (var i = 0; i < adet; i++) {
      var a = (i / adet) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      var hiz = 75 + Math.random() * 95;
      parcacikEkle(
        P_YILDIZ,
        x, y,
        Math.cos(a) * hiz,
        Math.sin(a) * hiz - 12,
        0, 60,
        3.5,
        0.30 + Math.random() * 0.16,
        5.5 + Math.random() * 4.5,
        0, -4,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 14,
        0,
        YILDIZ_RENKLER[i % YILDIZ_RENKLER.length],
        '#ffffff',
        1
      );
    }
  }

  function direk(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    halkaEkle(H_DARBE, x, y, 0, 0, 0, 0, 5, 58, 4.8, 0.34, '#ffffff', '#ffd166', 1);
    halkaEkle(H_DARBE, x, y, 0, 0, 0, 0, 3, 36, 3.0, 0.22, '#ff9e00', '#ffffff', 0.95);
    sarsintiTetikle(9.5, 0.30);

    for (var i = 0; i < 16; i++) {
      var a = Math.random() * Math.PI * 2;
      var hiz = 120 + Math.random() * 210;
      parcacikEkle(
        (i % 4 === 0) ? P_YILDIZ : P_KIVILCIM,
        x, y,
        Math.cos(a) * hiz,
        Math.sin(a) * hiz,
        0, 140,
        3.8,
        0.24 + Math.random() * 0.20,
        10 + Math.random() * 8,
        2.5,
        0,
        a,
        (Math.random() - 0.5) * 12,
        0,
        DIREK_RENKLER[i % DIREK_RENKLER.length],
        '#ffffff',
        1
      );
    }
  }

  // --- Güncelleme Döngüsü (Sıfır-GC) ---

  function guncelle(dt) {
    if (!(dt > 0)) return;
    if (dt > 0.1) dt = 0.1;

    // Ekran üstü zamanlayıcılar gerçek zamanla akar
    if (cutawaySure > 0) {
      cutawayGecen += dt;
      cutawaySure -= dt;
      if (cutawaySure <= 0) {
        cutawaySure = 0;
        cutawayGecen = CUTAWAY_SURE;
      }
    }

    if (golSure > 0) {
      golSure -= dt;
      if (golSure < 0) golSure = 0;
    }

    if (ekranFlas > 0) {
      ekranFlas -= dt * 3.4;
      if (ekranFlas < 0) ekranFlas = 0;
    }

    // Kamera sarsıntısı güncellemesi
    if (sarsintiSure > 0) {
      sarsintiSure -= dt;
      if (sarsintiSure <= 0) {
        sarsintiSure = 0;
        sarsintiGuc = 0;
        sarsintiCikti.x = 0;
        sarsintiCikti.y = 0;
      } else {
        sarsintiFaz += dt * 78;
        var k = sarsintiMaxSure > 0 ? (sarsintiSure / sarsintiMaxSure) : 0;
        var genlik = sarsintiGuc * k * k;
        sarsintiCikti.x = (Math.sin(sarsintiFaz * 1.37) + (Math.random() - 0.5) * 0.8) * genlik;
        sarsintiCikti.y = (Math.cos(sarsintiFaz * 1.93) + (Math.random() - 0.5) * 0.8) * genlik;
      }
    } else if (sarsintiCikti.x !== 0 || sarsintiCikti.y !== 0) {
      sarsintiCikti.x = 0;
      sarsintiCikti.y = 0;
    }

    // Cutaway sırasında saha efektleri dramatik ağır çekimde akar
    var wDt = (cutawaySure > 0) ? (dt * 0.22) : dt;

    if (aktifHalkaSayisi > 0) {
      var kalanHalka = 0;
      for (var i = 0; i < MAX_HALKA; i++) {
        var h = halkalar[i];
        if (!h.aktif) continue;
        h.omur -= wDt;
        if (h.omur <= 0) {
          h.aktif = false;
          continue;
        }
        kalanHalka++;
        if (h.tip === H_CIZGI) {
          h.x += h.vx * wDt;
          h.y += h.vy * wDt;
        }
      }
      aktifHalkaSayisi = kalanHalka;
    }

    if (aktifParcacikSayisi > 0) {
      var kalanParcacik = 0;
      for (var j = 0; j < MAX_PARCACIK; j++) {
        var p = parcaciklar[j];
        if (!p.aktif) continue;
        p.omur -= wDt;
        if (p.omur <= 0) {
          p.aktif = false;
          continue;
        }
        kalanParcacik++;

        var sonum = 1 - p.suruklenme * wDt;
        if (sonum < 0) sonum = 0;

        p.vx = (p.vx + p.ax * wDt) * sonum;
        p.vy = (p.vy + p.ay * wDt) * sonum;
        p.x += p.vx * wDt;
        p.y += p.vy * wDt;
        p.boy += p.buyume * wDt;
        if (p.boy < 0.5) p.boy = 0.5;
        p.aci += p.aciHiz * wDt;

        if (p.tip === P_KONFETI) {
          p.salinimFaz += p.salinimHiz * wDt;
          // Yatay hafif süzülme salınımı
          p.x += Math.sin(p.salinimFaz) * 28 * wDt;
        }
      }
      aktifParcacikSayisi = kalanParcacik;
    }
  }

  // --- Dünya Uzayı Çizimi (Kamera dönüşümü içindeyken) ---

  function cizDunya(ctx) {
    if (!ctx) return;
    if (aktifParcacikSayisi === 0 && aktifHalkaSayisi === 0) return;

    ctx.save();

    // 1. Şok halkaları, pas izleri ve beyaz çekirdekli hız çizgileri
    if (aktifHalkaSayisi > 0) {
      ctx.lineCap = 'round';
      for (var i = 0; i < MAX_HALKA; i++) {
        var h = halkalar[i];
        if (!h.aktif) continue;
        var oran = h.omur / (h.maxOmur || 1);
        var ilerleme = 1 - oran;

        if (h.tip === H_DARBE) {
          var r = h.yaricap + (h.maxYaricap - h.yaricap) * (1 - (1 - ilerleme) * (1 - ilerleme));
          ctx.globalAlpha = h.alfa * oran;
          ctx.strokeStyle = h.renk;
          ctx.lineWidth = Math.max(0.8, h.kalinlik * (0.3 + 0.7 * oran));
          ctx.beginPath();
          ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
          ctx.stroke();

          if (oran > 0.25) {
            ctx.globalAlpha = h.alfa * (oran - 0.2) * 0.85;
            ctx.strokeStyle = h.renk2;
            ctx.lineWidth = Math.max(0.5, h.kalinlik * 0.42 * oran);
            ctx.beginPath();
            ctx.arc(h.x, h.y, r * 0.92, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (h.tip === H_CIZGI) {
          var kx = h.x - h.x2 * (0.45 + 0.55 * oran);
          var ky = h.y - h.y2 * (0.45 + 0.55 * oran);
          ctx.globalAlpha = h.alfa * oran * 0.65;
          ctx.strokeStyle = h.renk;
          ctx.lineWidth = h.kalinlik * (1.8 + 0.7 * oran);
          ctx.beginPath();
          ctx.moveTo(h.x, h.y);
          ctx.lineTo(kx, ky);
          ctx.stroke();

          ctx.globalAlpha = h.alfa * oran;
          ctx.strokeStyle = h.renk2;
          ctx.lineWidth = Math.max(0.9, h.kalinlik * 0.72 * oran);
          ctx.beginPath();
          ctx.moveTo(h.x, h.y);
          ctx.lineTo(kx, ky);
          ctx.stroke();
        } else if (h.tip === H_PAS) {
          ctx.globalAlpha = h.alfa * oran * 0.48;
          ctx.strokeStyle = h.renk;
          ctx.lineWidth = h.kalinlik * oran;
          ctx.beginPath();
          ctx.moveTo(h.x, h.y);
          ctx.lineTo(h.x2, h.y2);
          ctx.stroke();

          // İlerleyen parlak pas nabzı
          var t0 = Math.max(0, ilerleme * 1.15 - 0.28);
          var t1 = Math.min(1, ilerleme * 1.15);
          if (t1 > t0) {
            var sx0 = h.x + (h.x2 - h.x) * t0;
            var sy0 = h.y + (h.y2 - h.y) * t0;
            var sx1 = h.x + (h.x2 - h.x) * t1;
            var sy1 = h.y + (h.y2 - h.y) * t1;
            ctx.globalAlpha = h.alfa * oran;
            ctx.strokeStyle = h.renk2;
            ctx.lineWidth = Math.max(1.2, h.kalinlik * 0.65);
            ctx.beginPath();
            ctx.moveTo(sx0, sy0);
            ctx.lineTo(sx1, sy1);
            ctx.stroke();
          }
        }
      }
    }

    // 2. Parçacıklar (toz altta, parlak ateş/yıldız/konfeti üstte)
    if (aktifParcacikSayisi > 0) {
      ctx.lineCap = 'round';

      // Önce tozlar
      for (var t = 0; t < MAX_PARCACIK; t++) {
        var pt = parcaciklar[t];
        if (!pt.aktif || pt.tip !== P_TOZ) continue;
        var tOran = pt.omur / (pt.maxOmur || 1);
        ctx.globalAlpha = pt.alfa * tOran * tOran;
        ctx.fillStyle = pt.renk;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.boy, 0, Math.PI * 2);
        ctx.fill();
      }

      // Diğer canlı parçacıklar
      for (var j = 0; j < MAX_PARCACIK; j++) {
        var p = parcaciklar[j];
        if (!p.aktif || p.tip === P_TOZ) continue;
        var pOran = p.omur / (p.maxOmur || 1);

        if (p.tip === P_ATES) {
          var rAtes = p.boy * (0.35 + 0.65 * pOran);
          ctx.globalAlpha = p.alfa * pOran * 0.85;
          ctx.fillStyle = p.renk;
          ctx.beginPath();
          ctx.arc(p.x, p.y, rAtes, 0, Math.PI * 2);
          ctx.fill();

          if (pOran > 0.3) {
            ctx.globalAlpha = p.alfa * pOran * 0.9;
            ctx.fillStyle = p.renk2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rAtes * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (p.tip === P_KIVILCIM) {
          var hiz = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          var uz = p.boy * (0.35 + 0.65 * pOran);
          var ux = hiz > 0.01 ? (p.vx / hiz) : Math.cos(p.aci);
          var uy = hiz > 0.01 ? (p.vy / hiz) : Math.sin(p.aci);

          ctx.globalAlpha = p.alfa * pOran;
          ctx.strokeStyle = p.renk;
          ctx.lineWidth = Math.max(1, p.en * (0.4 + 0.6 * pOran));
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - ux * uz, p.y - uy * uz);
          ctx.stroke();

          ctx.fillStyle = p.renk2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, p.en * 0.55), 0, Math.PI * 2);
          ctx.fill();
        } else if (p.tip === P_YILDIZ) {
          var rYil = p.boy * (0.4 + 0.75 * pOran);
          var cy = Math.cos(p.aci);
          var sy = Math.sin(p.aci);
          ctx.globalAlpha = p.alfa * Math.min(1, pOran * 1.4);
          ctx.fillStyle = p.renk;
          ctx.beginPath();
          for (var v = 0; v < 10; v++) {
            var vx0 = YILDIZ_UX[v];
            var vy0 = YILDIZ_UY[v];
            var px0 = p.x + (vx0 * cy - vy0 * sy) * rYil;
            var py0 = p.y + (vx0 * sy + vy0 * cy) * rYil;
            if (v === 0) ctx.moveTo(px0, py0);
            else ctx.lineTo(px0, py0);
          }
          ctx.closePath();
          ctx.fill();

          if (pOran > 0.35) {
            ctx.fillStyle = p.renk2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rYil * 0.28, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (p.tip === P_KONFETI) {
          var ck = Math.cos(p.aci);
          var sk = Math.sin(p.aci);
          var yw = p.boy * 0.5;
          var yh = p.en * 0.5 * (0.25 + 0.75 * Math.abs(Math.cos(p.salinimFaz)));
          var fade = pOran < 0.25 ? (pOran / 0.25) : 1;

          ctx.globalAlpha = p.alfa * fade;
          ctx.fillStyle = p.renk;
          ctx.beginPath();
          ctx.moveTo(p.x + (-yw * ck - -yh * sk), p.y + (-yw * sk + -yh * ck));
          ctx.lineTo(p.x + (yw * ck - -yh * sk), p.y + (yw * sk + -yh * ck));
          ctx.lineTo(p.x + (yw * ck - yh * sk), p.y + (yw * sk + yh * ck));
          ctx.lineTo(p.x + (-yw * ck - yh * sk), p.y + (-yw * sk + yh * ck));
          ctx.closePath();
          ctx.fill();
        } else if (p.tip === P_MOTE) {
          ctx.globalAlpha = p.alfa * pOran;
          ctx.fillStyle = p.renk;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.boy, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // --- Ekran Uzayı Çizimi: Aslan Cutaway & Gol Başlığı ---

  function fontlariHazirla(aslanBoy, sutuBoy, etiketBoy, golBoy, golAltBoy) {
    if (aslanBoy !== fontAslanBoy) {
      fontAslanBoy = aslanBoy;
      fontAslanStr = '900 italic ' + aslanBoy + 'px "Arial Black", "Impact", "Trebuchet MS", sans-serif';
    }
    if (sutuBoy !== fontSutuBoy) {
      fontSutuBoy = sutuBoy;
      fontSutuStr = '900 italic ' + sutuBoy + 'px "Arial Black", "Impact", "Trebuchet MS", sans-serif';
    }
    if (etiketBoy !== fontEtiketBoy) {
      fontEtiketBoy = etiketBoy;
      fontEtiketStr = '900 ' + etiketBoy + 'px "Arial Black", "Trebuchet MS", system-ui, sans-serif';
    }
    if (golBoy !== fontGolBoy) {
      fontGolBoy = golBoy;
      fontGolStr = '900 italic ' + golBoy + 'px "Arial Black", "Impact", "Trebuchet MS", sans-serif';
    }
    if (golAltBoy !== fontGolAltBoy) {
      fontGolAltBoy = golAltBoy;
      fontGolAltStr = '900 ' + golAltBoy + 'px "Arial Black", "Trebuchet MS", system-ui, sans-serif';
    }
  }

  function cizYildizPatlamasi(ctx, x, y, kollar, rDis, rIc, aci, renk, alfa) {
    ctx.globalAlpha = alfa;
    ctx.fillStyle = renk;
    ctx.beginPath();
    var toplam = kollar * 2;
    for (var i = 0; i < toplam; i++) {
      var a = aci + (i * Math.PI) / kollar;
      var r = (i % 2 === 0) ? rDis : rIc;
      var px = x + Math.cos(a) * r;
      var py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function cizAlevSeridi(ctx, hw, yKonum, yon, faz) {
    // yon = -1 üst kenar (yukarı alevler), +1 alt kenar (aşağı alevler)
    var adim = 44;
    var basX = -hw - adim;
    var sonX = hw + adim;
    var kayma = ((faz * yon * -1) % adim);

    // Katman 1: koyu kızıl-turuncu dış alev dilleri
    ctx.fillStyle = '#ff3b00';
    ctx.beginPath();
    ctx.moveTo(basX, yKonum - yon * 8);
    for (var x1 = basX + kayma; x1 <= sonX; x1 += adim) {
      var h1 = 18 + 11 * Math.abs(Math.sin(x1 * 0.031 + faz * 0.015));
      ctx.lineTo(x1 + adim * 0.35, yKonum + yon * h1);
      ctx.lineTo(x1 + adim * 0.85, yKonum + yon * 3);
    }
    ctx.lineTo(sonX, yKonum - yon * 8);
    ctx.closePath();
    ctx.fill();

    // Katman 2: parlak altın iç alev dilleri
    ctx.fillStyle = '#ffc300';
    ctx.beginPath();
    ctx.moveTo(basX, yKonum - yon * 4);
    for (var x2 = basX + kayma * 1.2; x2 <= sonX; x2 += adim) {
      var h2 = 10 + 7 * Math.abs(Math.cos(x2 * 0.042 - faz * 0.02));
      ctx.lineTo(x2 + adim * 0.3, yKonum + yon * h2);
      ctx.lineTo(x2 + adim * 0.78, yKonum + yon * 1);
    }
    ctx.lineTo(sonX, yKonum - yon * 4);
    ctx.closePath();
    ctx.fill();
  }

  function cizAslanKarakter(ctx, px, py, gecen) {
    // 1. Arkada kükreyen Altın Aslan (Lion) ruhu silueti
    ctx.save();
    ctx.translate(px - 8, py - 4);
    var nefes = 1 + Math.sin(gecen * 14) * 0.03;
    ctx.scale(nefes, nefes);

    // Yele sivri dikenleri
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    for (var i = 0; i < 16; i++) {
      var a = -Math.PI * 0.95 + (i / 15) * Math.PI * 1.9;
      var rDis = (i % 2 === 0) ? 128 : 104;
      var rIc = 76;
      var ax0 = Math.cos(a) * rDis;
      var ay0 = Math.sin(a) * rDis;
      var ax1 = Math.cos(a + 0.14) * rIc;
      var ay1 = Math.sin(a + 0.14) * rIc;
      if (i === 0) ctx.moveTo(ax0, ay0);
      else ctx.lineTo(ax0, ay0);
      ctx.lineTo(ax1, ay1);
    }
    ctx.closePath();
    ctx.fill();

    // Parlayan altın aslan gözleri (portrenin hemen arkasında)
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.moveTo(-62, -48);
    ctx.lineTo(-34, -36);
    ctx.lineTo(-56, -30);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(58, -50);
    ctx.lineTo(30, -37);
    ctx.lineTo(52, -31);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Stilize "61 GÜN" Anime Portresi (Cel-Shaded Çizgi Roman Çizimi)
    ctx.save();
    ctx.translate(px - 24, py + 6);
    ctx.globalAlpha = 1;

    // Omuzlar & Galatasaray Parçalı Forma (Sol Kırmızı, Sağ Altın Sarısı)
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#14050a';

    // Sol omuz kırmızı yarı
    ctx.fillStyle = '#c8102e';
    ctx.beginPath();
    ctx.moveTo(-84, 126);
    ctx.lineTo(-68, 54);
    ctx.lineTo(-22, 42);
    ctx.lineTo(0, 46);
    ctx.lineTo(0, 126);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sağ omuz sarı yarı
    ctx.fillStyle = '#fdb912';
    ctx.beginPath();
    ctx.moveTo(0, 126);
    ctx.lineTo(0, 46);
    ctx.lineTo(24, 42);
    ctx.lineTo(70, 54);
    ctx.lineTo(84, 126);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Forma yakası
    ctx.fillStyle = '#14050a';
    ctx.beginPath();
    ctx.moveTo(-22, 42);
    ctx.lineTo(0, 62);
    ctx.lineTo(24, 42);
    ctx.lineTo(14, 49);
    ctx.lineTo(0, 54);
    ctx.lineTo(-14, 49);
    ctx.closePath();
    ctx.fill();

    // Boyun ve cel-gölge
    ctx.fillStyle = '#f2be96';
    ctx.strokeStyle = '#14050a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-16, 24);
    ctx.lineTo(-14, 48);
    ctx.lineTo(0, 56);
    ctx.lineTo(16, 48);
    ctx.lineTo(16, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#cf8d63';
    ctx.beginPath();
    ctx.moveTo(-14, 28);
    ctx.lineTo(14, 28);
    ctx.lineTo(14, 40);
    ctx.lineTo(-14, 34);
    ctx.closePath();
    ctx.fill();

    // Yüz (keskin anime çene hattı)
    ctx.fillStyle = cutawayTenRenk;
    ctx.beginPath();
    ctx.moveTo(-36, -34);
    ctx.lineTo(-34, 4);
    ctx.lineTo(-16, 26);
    ctx.lineTo(0, 33);
    ctx.lineTo(18, 25);
    ctx.lineTo(35, 3);
    ctx.lineTo(37, -34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sol yanakta dramatik anime gölgesi
    ctx.fillStyle = 'rgba(130, 58, 26, 0.22)';
    ctx.beginPath();
    ctx.moveTo(-34, -26);
    ctx.lineTo(-32, 3);
    ctx.lineTo(-15, 24);
    ctx.lineTo(-3, 30);
    ctx.lineTo(-18, 12);
    ctx.lineTo(-22, -26);
    ctx.closePath();
    ctx.fill();

    // Kararlı kaşlar ve parlayan anime gözler
    // Sol göz
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-28, -10);
    ctx.lineTo(-8, -6);
    ctx.lineTo(-11, 2);
    ctx.lineTo(-27, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d1228';
    ctx.beginPath();
    ctx.arc(-18, -3, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd000';
    ctx.beginPath();
    ctx.arc(-18, -3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-20, -5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Sağ göz
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(28, -10);
    ctx.lineTo(8, -6);
    ctx.lineTo(11, 2);
    ctx.lineTo(27, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d1228';
    ctx.beginPath();
    ctx.arc(18, -3, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd000';
    ctx.beginPath();
    ctx.arc(18, -3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(16, -5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Keskin çatık kaşlar
    ctx.strokeStyle = '#14050a';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(-31, -15);
    ctx.lineTo(-6, -8);
    ctx.moveTo(31, -15);
    ctx.lineTo(6, -8);
    ctx.stroke();

    // Burun ve kararlı şut haykırışı ağzı
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(-3, 7);
    ctx.lineTo(2, 8);
    ctx.stroke();

    ctx.fillStyle = '#8b1224';
    ctx.beginPath();
    ctx.moveTo(-12, 16);
    ctx.lineTo(14, 15);
    ctx.lineTo(10, 22);
    ctx.lineTo(-9, 21);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-9, 15.5, 19, 3);

    // Rüzgarda savrulan sivri Tsubasa tarzı anime saçları
    ctx.fillStyle = cutawaySacRenk;
    ctx.strokeStyle = '#0d0714';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-42, -16);
    ctx.lineTo(-56, -42);
    ctx.lineTo(-34, -46);
    ctx.lineTo(-46, -74);
    ctx.lineTo(-14, -64);
    ctx.lineTo(-4, -90);
    ctx.lineTo(16, -68);
    ctx.lineTo(44, -82);
    ctx.lineTo(36, -50);
    ctx.lineTo(58, -44);
    ctx.lineTo(38, -20);
    ctx.lineTo(34, -34);
    // Kahküller
    ctx.lineTo(22, -12);
    ctx.lineTo(14, -30);
    ctx.lineTo(2, -10);
    ctx.lineTo(-6, -32);
    ctx.lineTo(-20, -12);
    ctx.lineTo(-27, -30);
    ctx.lineTo(-36, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Saç üstünde parlak anime ışığı
    ctx.fillStyle = 'rgba(255, 224, 150, 0.22)';
    ctx.beginPath();
    ctx.moveTo(-24, -54);
    ctx.lineTo(-4, -70);
    ctx.lineTo(12, -56);
    ctx.lineTo(28, -62);
    ctx.lineTo(12, -48);
    ctx.lineTo(-6, -54);
    ctx.closePath();
    ctx.fill();

    // Gün'ün ikonik sarı-kırmızı alın bandı
    if (cutawayBandVar) {
      ctx.fillStyle = '#A90432';
      ctx.strokeStyle = '#14050a';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-38, -28);
      ctx.lineTo(39, -28);
      ctx.lineTo(37, -18);
      ctx.lineTo(-37, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FDB912';
      ctx.fillRect(-35, -24.5, 70, 3.2);
    }
    ctx.restore();

    // 3. Dinamik Şut Pozu + Alevli Top (Portrenin sağ yanında)
    ctx.save();
    ctx.translate(px + 88, py + 18);

    // Şut savurma enerji yayı
    ctx.strokeStyle = '#ffdd00';
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(-8, 12, 46, Math.PI * 0.65, Math.PI * 1.48);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(-8, 12, 46, Math.PI * 0.72, Math.PI * 1.42);
    ctx.stroke();

    // Siluet şutçu figürü (kırmızı-sarı dinamik vole pozu)
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#14050a';
    ctx.lineWidth = 3;

    // Gövde eğimi
    ctx.fillStyle = '#c8102e';
    ctx.beginPath();
    ctx.moveTo(-42, -16);
    ctx.lineTo(-22, -26);
    ctx.lineTo(-8, 4);
    ctx.lineTo(-28, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sarı kol & kafa silueti
    ctx.fillStyle = '#fdb912';
    ctx.beginPath();
    ctx.arc(-34, -32, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Destek bacağı
    ctx.fillStyle = '#1e162e';
    ctx.beginPath();
    ctx.moveTo(-26, 12);
    ctx.lineTo(-16, 10);
    ctx.lineTo(-24, 52);
    ctx.lineTo(-34, 50);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vuran şut bacağı (topa doğru uzanmış)
    ctx.fillStyle = '#ffd000';
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(14, -4);
    ctx.lineTo(18, 6);
    ctx.lineTo(-10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Krampon & vuruş noktası beyaz yıldızı
    ctx.fillStyle = '#ff3b00';
    ctx.beginPath();
    ctx.arc(24, -2, 16, 0, Math.PI * 2);
    ctx.fill();

    // Yanan futbol topu
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(29, -4, 15, 12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Top üstü beşgen deseni
    ctx.fillStyle = '#1e162e';
    ctx.beginPath();
    ctx.arc(28, -4, 4.5, 0, Math.PI * 2);
    ctx.fill();

    cizYildizPatlamasi(ctx, 18, 1, 6, 22, 6, gecen * 8, '#ffffff', 0.92);
    ctx.restore();

    // 4. "61 GÜN" Alt Çizgi Roman İsim Plakası
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(px + 2, py + 94);
    ctx.transform(1, 0, -0.22, 1, 0, 0);
    ctx.fillStyle = '#14050a';
    ctx.fillRect(-84, -17, 174, 34);
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(-88, -20, 172, 32);
    ctx.fillStyle = '#fdb912';
    ctx.fillRect(-88, -20, 48, 32);
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 2.6;
    ctx.strokeRect(-88, -20, 172, 32);

    ctx.font = fontEtiketStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#14050a';
    ctx.fillText(cutawayNoEtiket, -64, -3);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(cutawayAdEtiket, 20, -3);
    ctx.restore();
  }

  function cizCutaway(ctx, W, H) {
    var p = cutawayGecen / CUTAWAY_SURE;
    var acilis = (p < 0.18) ? kolayDisaBack(p / 0.18) : 1;
    var kapanis = (p > 0.82) ? sinirli(1 - (p - 0.82) / 0.18, 0, 1) : 1;

    var bw = Math.min(W - 40, 380);
    var bh = 54;
    var by = H * 0.84;

    fontlariHazirla(52, 68, 22, 74, 24);

    ctx.save();
    ctx.globalAlpha = kapanis;
    ctx.translate(W * 0.5, by);
    ctx.scale(acilis, acilis);
    ctx.transform(1, 0, -0.16, 1, 0, 0);

    // Koyu çizgi roman gölgesi
    ctx.fillStyle = '#120408';
    ctx.fillRect(-bw * 0.5 + 4, -bh * 0.5 + 5, bw, bh);

    // Galatasaray parçalı şerit (bordo-kırmızı sol, parlak altın sağ çerçeve)
    ctx.fillStyle = '#A90432';
    ctx.fillRect(-bw * 0.5, -bh * 0.5, bw, bh);

    ctx.fillStyle = '#FDB912';
    ctx.fillRect(-bw * 0.5, -bh * 0.5, Math.min(118, bw * 0.34), bh);

    ctx.strokeStyle = '#FFF3B0';
    ctx.lineWidth = 3.2;
    ctx.strokeRect(-bw * 0.5, -bh * 0.5, bw, bh);

    // Enerji yıldızı + net aksiyon etiketi
    cizYildizPatlamasi(ctx, -bw * 0.5 + 22, 0, 5, 11, 5, cutawayGecen * 7, '#A90432', 0.95);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fontEtiketStr;
    var tamEtiket = '⚡ ' + cutawayTamEtiket + ' · ASLAN ŞUTU! ⚡';
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = '#14050a';
    ctx.strokeText(tamEtiket, 10, 1);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(tamEtiket, 10, 1);

    ctx.restore();
  }

  function cizGolBanner(ctx, W, H) {
    var gecen = golMaxSure - golSure;
    var fade = (golSure < 0.35) ? sinirli(golSure / 0.35, 0, 1) : 1;
    var s = Math.min(W / 900, H / 640);
    if (s < 0.55) s = 0.55;
    if (s > 1.45) s = 1.45;

    fontlariHazirla(52, 68, 22, 76, 24);

    var palet = golTakimKod === 'BJK'
      ? BJK_RENKLER
      : (golTakimKod === 'TS' ? TS_RENKLER : (golFbMi ? FB_RENKLER : GS_RENKLER));
    var anaRenk = golTakimKod === 'BJK'
      ? '#18181B'
      : (golTakimKod === 'TS' ? '#7C1332' : (golFbMi ? '#002D72' : '#A90432'));
    var vurguRenk = golTakimKod === 'BJK'
      ? '#F8FAFC'
      : (golTakimKod === 'TS' ? '#00A8E8' : (golFbMi ? '#FFED00' : '#FDB912'));

    // 1. Tribün konfeti yağmuru (ekran üstünden süzülen şeritler, sıfır çöp, save/restore yok)
    ctx.globalAlpha = 0.9 * fade;
    for (var i = 0; i < 24; i++) {
      var bas = (i * 0.045) % 0.45;
      var tKon = gecen - bas;
      if (tKon < 0) continue;
      var kx = ((i * 0.137 + 0.07) % 1) * W + Math.sin(tKon * 5.2 + i) * 32;
      var ky = -24 + tKon * (H * (0.55 + (i % 4) * 0.12));
      if (ky > H + 30) continue;
      var kw = 5.5 * s;
      var kh = 3 * s * (0.3 + 0.7 * Math.abs(Math.cos(tKon * 9 + i)));
      var ka = tKon * (3 + (i % 3)) + i;
      var ck = Math.cos(ka);
      var sk = Math.sin(ka);
      ctx.fillStyle = palet[i % palet.length];
      ctx.beginPath();
      ctx.moveTo(kx + (-kw * ck + kh * sk), ky + (-kw * sk - kh * ck));
      ctx.lineTo(kx + (kw * ck + kh * sk), ky + (kw * sk - kh * ck));
      ctx.lineTo(kx + (kw * ck - kh * sk), ky + (kw * sk + kh * ck));
      ctx.lineTo(kx + (-kw * ck - kh * sk), ky + (-kw * sk + kh * ck));
      ctx.closePath();
      ctx.fill();
    }

    // 2. Dev sıçrayan çizgi roman "GOOOOL!" başlığı
    var sicrama;
    if (gecen < 0.09) {
      sicrama = 0.2 + 1.15 * kolayDisaBack(gecen / 0.09);
    } else if (gecen < 0.65) {
      var u = gecen - 0.09;
      sicrama = 1 + Math.exp(-u * 6.5) * Math.cos(u * 20) * 0.34;
    } else {
      sicrama = 1 + Math.sin(gecen * 7) * 0.03;
    }

    var ziplamaY = (gecen < 0.55) ? (-Math.abs(Math.sin(gecen * 11)) * Math.exp(-gecen * 4.5) * 26 * s) : 0;

    ctx.save();
    ctx.translate(W * 0.5, H * 0.52 + ziplamaY);
    ctx.scale(s * sicrama, s * sicrama);
    ctx.rotate(-0.045);

    // Arkada çizgi roman patlama yıldızı
    cizYildizPatlamasi(ctx, 0, -4, 14, 215, 130, gecen * 0.9, anaRenk, 0.52 * fade);
    cizYildizPatlamasi(ctx, 0, -4, 12, 175, 104, -gecen * 1.4, vurguRenk, 0.45 * fade);

    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = fontGolStr;

    // Gölge -> dış takım konturu -> sarı kontur -> parlak beyaz-altın dolgu
    ctx.fillStyle = '#120408';
    ctx.fillText('GOOOOL!', 7, 7);

    ctx.lineWidth = 18;
    ctx.strokeStyle = '#120408';
    ctx.strokeText('GOOOOL!', 0, 0);

    ctx.lineWidth = 11;
    ctx.strokeStyle = anaRenk;
    ctx.strokeText('GOOOOL!', 0, 0);

    ctx.lineWidth = 5;
    ctx.strokeStyle = vurguRenk;
    ctx.strokeText('GOOOOL!', 0, 0);

    ctx.fillStyle = '#ffffff';
    ctx.fillText('GOOOOL!', 0, 0);

    // Alt şerit: Golü atan / Takım etiketi
    ctx.save();
    ctx.translate(0, 62);
    ctx.transform(1, 0, -0.18, 1, 0, 0);

    var pillW = Math.max(240, golAltYazi.length * 16 + 48);
    ctx.fillStyle = '#120408';
    ctx.fillRect(-pillW * 0.5 + 4, -18 + 4, pillW, 38);
    ctx.fillStyle = anaRenk;
    ctx.fillRect(-pillW * 0.5, -18, pillW, 38);
    ctx.strokeStyle = vurguRenk;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(-pillW * 0.5, -18, pillW, 38);

    ctx.font = fontGolAltStr;
    ctx.fillStyle = vurguRenk;
    ctx.fillText(golAltYazi, 0, 1);
    ctx.restore();

    // Süs yıldızları
    cizYildizPatlamasi(ctx, -205, -24, 4, 18, 5, gecen * 5, '#ffffff', 0.95 * fade);
    cizYildizPatlamasi(ctx, 210, -16, 4, 18, 5, -gecen * 5, vurguRenk, 0.95 * fade);

    ctx.restore();
  }

  function cizEkran(ctx, W, H) {
    if (!ctx || !(W > 0) || !(H > 0)) return;
    if (cutawaySure <= 0 && golSure <= 0 && ekranFlas <= 0.01) return;

    ctx.save();

    if (cutawaySure > 0) {
      cizCutaway(ctx, W, H);
    }

    if (golSure > 0) {
      cizGolBanner(ctx, W, H);
    }

    if (ekranFlas > 0.01) {
      ctx.globalAlpha = sinirli(ekranFlas, 0, 0.85);
      ctx.fillStyle = ekranFlasRenk;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  global.EFEKT = {
    kur: kur,
    sifirla: sifirla,
    guncelle: guncelle,
    cizDunya: cizDunya,
    cizEkran: cizEkran,
    aslanCutaway: aslanCutaway,
    golPatlat: golPatlat,
    pasIzi: pasIzi,
    sutKivilcim: sutKivilcim,
    toz: toz,
    kapmaYildiz: kapmaYildiz,
    direk: direk,
    sarsintiAl: sarsintiAl,
    cutawayAktif: cutawayAktif
  };
})(typeof window !== 'undefined' ? window : globalThis);
