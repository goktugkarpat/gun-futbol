(function (global) {
  'use strict';

  /**
   * Takım renk paletleri ve forma desenleri.
   * GS: Parçalı (#A90432 & #FDB912), FB: Çubuklu (#FFED00 & #002D72)
   */
  var RENK = {
    GS: {
      ad: 'Galatasaray',
      kisa: 'GS',
      birincil: '#E60026',
      ikincil: '#FFC400',
      ana: '#E60026',
      yardimci: '#FFC400',
      sort: '#FFFFFF',
      corap: '#E60026',
      kaleci: '#00E5B0',
      kaleciDetay: '#FFC400',
      yazi: '#FFFFFF',
      desen: 'parcali'
    },
    FB: {
      ad: 'Fenerbahçe',
      kisa: 'FB',
      birincil: '#FFF01F',
      ikincil: '#0047AB',
      ana: '#FFF01F',
      yardimci: '#0047AB',
      sort: '#0047AB',
      corap: '#0047AB',
      kaleci: '#FF6B00',
      kaleciDetay: '#FFF01F',
      yazi: '#FFF01F',
      desen: 'cubuklu'
    },
    BJK: {
      ad: 'Beşiktaş',
      kisa: 'BJK',
      birincil: '#FFFFFF',
      ikincil: '#141414',
      ana: '#FFFFFF',
      yardimci: '#141414',
      sort: '#141414',
      corap: '#FFFFFF',
      kaleci: '#84CC16',
      kaleciDetay: '#141414',
      yazi: '#FFFFFF',
      desen: 'bjk-cubuklu'
    },
    TS: {
      ad: 'Trabzonspor',
      kisa: 'TS',
      birincil: '#7C1332',
      ikincil: '#00A8E8',
      ana: '#7C1332',
      yardimci: '#00A8E8',
      sort: '#620E27',
      corap: '#00A8E8',
      kaleci: '#FACC15',
      kaleciDetay: '#002D72',
      yazi: '#38BDF8',
      desen: 'ts-cubuklu'
    }
  };

  /**
   * Galatasaray 11'li derbi kadrosu (1 GK + 4 DEF + 4 MID + 2 FWD)
   */
  var GS = [
    { ad: 'Uğurcan', tamAd: 'Uğurcan Çakır', no: 1, rol: 'GK', sesKey: 'ugurcan', hiz: 1.0, sut: 0.55, sac: '#2b1d12', ten: '#f2c7a5', yildiz: false },
    { ad: 'Jakobs', tamAd: 'Ismail Jakobs', no: 4, rol: 'DEF', sesKey: 'jakobs', hiz: 1.08, sut: 0.68, sac: '#141212', ten: '#8a5636' },
    { ad: 'Davinson', tamAd: 'Davinson Sánchez', no: 6, rol: 'DEF', sesKey: 'davinson', hiz: 1.04, sut: 0.72, sac: '#141212', ten: '#8d5939', yildiz: false },
    { ad: 'Abdülkerim', tamAd: 'Abdülkerim Bardakcı', no: 42, rol: 'DEF', sesKey: 'abdulkerim', hiz: 0.96, sut: 0.80, sac: '#22170f', ten: '#ecc09d', yildiz: false },
    { ad: 'Singo', tamAd: 'Wilfried Singo', no: 90, rol: 'DEF', sesKey: 'singo', hiz: 1.10, sut: 0.74, sac: '#141212', ten: '#744427', iri: true },
    { ad: 'Sané', tamAd: 'Leroy Sané', no: 10, rol: 'MID', sesKey: 'sane', hiz: 1.12, sut: 0.90, sac: '#151212', ten: '#9e6744', afro: true },
    { ad: 'Torreira', tamAd: 'Lucas Torreira', no: 34, rol: 'MID', sesKey: 'torreira', hiz: 1.06, sut: 0.78, sac: '#1b1410', ten: '#dca57e', yildiz: false },
    { ad: 'Sara', tamAd: 'Gabriel Sara', no: 8, rol: 'MID', sesKey: 'sara', hiz: 1.04, sut: 0.88, sac: '#2b1d12', ten: '#e7b993' },
    { ad: 'Barış', tamAd: 'Barış Alper Yılmaz', no: 53, rol: 'MID', sesKey: 'baris', hiz: 1.14, sut: 0.88, sac: '#3a291a', ten: '#f0c5a0' },
    { ad: 'Osimhen', tamAd: 'Victor Osimhen', no: 45, rol: 'FWD', sesKey: 'osimhen', hiz: 1.14, sut: 0.98, sac: '#f5d24b', ten: '#744427', maske: true },
    { ad: 'GÜN', tamAd: 'Gün', no: 61, rol: 'FWD', sesKey: 'gun', hiz: 1.18, sut: 1.15, sac: '#3a2414', ten: '#f6cca8', gunMu: true, band: true }
  ];

  /**
   * Fenerbahçe 11'li derbi kadrosu (1 GK + 4 DEF + 4 MID + 2 FWD)
   */
  var FB = [
    { ad: 'Ederson', tamAd: 'Ederson', no: 31, rol: 'GK', sesKey: 'ederson', hiz: 1.0, sut: 0.55, sac: '#1c1510', ten: '#e4b38c' },
    { ad: 'Oosterwolde', tamAd: 'Jayden Oosterwolde', no: 24, rol: 'DEF', sesKey: 'oosterwolde', hiz: 1.08, sut: 0.68, sac: '#151210', ten: '#885334' },
    { ad: 'Aké', tamAd: 'Nathan Aké', no: 15, rol: 'DEF', sesKey: 'ake', hiz: 1.02, sut: 0.72, sac: '#151210', ten: '#885334', rasta: true },
    { ad: 'Škriniar', tamAd: 'Milan Škriniar', no: 37, rol: 'DEF', sesKey: 'skriniar', hiz: 0.98, sut: 0.70, sac: '#3b2c20', ten: '#f4cbb0' },
    { ad: 'Semedo', tamAd: 'Nélson Semedo', no: 2, rol: 'DEF', sesKey: 'semedo', hiz: 1.08, sut: 0.70, sac: '#151210', ten: '#8d5939' },
    { ad: 'Kerem', tamAd: 'Kerem Aktürkoğlu', no: 7, rol: 'MID', sesKey: 'kerem', hiz: 1.08, sut: 0.88, sac: '#241810', ten: '#efc4a2' },
    { ad: 'Kanté', tamAd: "N'Golo Kanté", no: 91, rol: 'MID', sesKey: 'kante', hiz: 1.08, sut: 0.75, sac: '#151515', ten: '#744427', kel: true },
    { ad: 'İsmail', tamAd: 'İsmail Yüksek', no: 5, rol: 'MID', sesKey: 'ismail', hiz: 1.04, sut: 0.78, sac: '#261a12', ten: '#efc4a2' },
    { ad: 'Asensio', tamAd: 'Marco Asensio', no: 10, rol: 'MID', sesKey: 'asensio', hiz: 1.06, sut: 0.92, sac: '#241a12', ten: '#f2c8a6' },
    { ad: 'Greenwood', tamAd: 'Mason Greenwood', no: 11, rol: 'FWD', sesKey: 'greenwood', hiz: 1.08, sut: 0.92, sac: '#171310', ten: '#b37a56' },
    { ad: 'Lukaku', tamAd: 'Romelu Lukaku', no: 9, rol: 'FWD', sesKey: 'lukaku', hiz: 1.04, sut: 0.96, sac: '#141212', ten: '#6d3f24', iri: true }
  ];

  /**
   * Beşiktaş 11'li derbi kadrosu (1 GK + 4 DEF + 4 MID + 2 FWD)
   */
  var BJK = [
    { ad: 'Mert', tamAd: 'Mert Günok', no: 34, rol: 'GK', sesKey: 'mertgunok', hiz: 1.0, sut: 0.55, sac: '#261a12', ten: '#f0c4a0' },
    { ad: 'Masuaku', tamAd: 'Arthur Masuaku', no: 26, rol: 'DEF', sesKey: 'masuaku', hiz: 1.07, sut: 0.72, sac: '#141212', ten: '#764628' },
    { ad: 'Uduokhai', tamAd: 'Felix Uduokhai', no: 14, rol: 'DEF', sesKey: 'uduokhai', hiz: 1.01, sut: 0.68, sac: '#141212', ten: '#845032', iri: true },
    { ad: 'Paulista', tamAd: 'Gabriel Paulista', no: 3, rol: 'DEF', sesKey: 'paulista', hiz: 0.99, sut: 0.72, sac: '#2a1d14', ten: '#e3b28c' },
    { ad: 'Svensson', tamAd: 'Jonas Svensson', no: 2, rol: 'DEF', sesKey: 'svensson', hiz: 1.04, sut: 0.68, sac: '#8c693c', ten: '#f4ccb0' },
    { ad: 'Rashica', tamAd: 'Milot Rashica', no: 7, rol: 'MID', sesKey: 'rashica', hiz: 1.10, sut: 0.84, sac: '#2b1e14', ten: '#f1c7a4' },
    { ad: 'Gedson', tamAd: 'Gedson Fernandes', no: 83, rol: 'MID', sesKey: 'gedson', hiz: 1.10, sut: 0.82, sac: '#151212', ten: '#8a5536', afro: true },
    { ad: 'Orkun', tamAd: 'Orkun Kökçü', no: 10, rol: 'MID', sesKey: 'orkun', hiz: 1.05, sut: 0.90, sac: '#221710', ten: '#f0c5a2' },
    { ad: 'Muçi', tamAd: 'Ernest Muçi', no: 23, rol: 'MID', sesKey: 'muci', hiz: 1.07, sut: 0.86, sac: '#241a12', ten: '#f3caa8' },
    { ad: 'Rafa', tamAd: 'Rafa Silva', no: 27, rol: 'FWD', sesKey: 'rafa', hiz: 1.13, sut: 0.92, sac: '#2a1c12', ten: '#ecc09d' },
    { ad: 'Immobile', tamAd: 'Ciro Immobile', no: 17, rol: 'FWD', sesKey: 'immobile', hiz: 1.06, sut: 0.96, sac: '#7c5d36', ten: '#f4ccb0' }
  ];

  /**
   * Trabzonspor 11'li derbi kadrosu (1 GK + 4 DEF + 4 MID + 2 FWD)
   */
  var TS = [
    { ad: 'Onana', tamAd: 'André Onana', no: 24, rol: 'GK', sesKey: 'onana', hiz: 1.02, sut: 0.56, sac: '#141212', ten: '#6e3f24' },
    { ad: 'Eren', tamAd: 'Eren Elmalı', no: 18, rol: 'DEF', sesKey: 'eren', hiz: 1.06, sut: 0.70, sac: '#241810', ten: '#efc4a2' },
    { ad: 'Batagov', tamAd: 'Arseniy Batagov', no: 44, rol: 'DEF', sesKey: 'batagov', hiz: 1.00, sut: 0.70, sac: '#6c5132', ten: '#f5cfb4' },
    { ad: 'Savić', tamAd: 'Stefan Savić', no: 15, rol: 'DEF', sesKey: 'savic', hiz: 0.98, sut: 0.72, sac: '#221810', ten: '#f1c7a5' },
    { ad: 'Malheiro', tamAd: 'Pedro Malheiro', no: 79, rol: 'DEF', sesKey: 'malheiro', hiz: 1.08, sut: 0.72, sac: '#302216', ten: '#ecc09e' },
    { ad: 'Nwakaeme', tamAd: 'Anthony Nwakaeme', no: 9, rol: 'MID', sesKey: 'nwakaeme', hiz: 1.05, sut: 0.88, sac: '#141212', ten: '#6a3c22', iri: true },
    { ad: 'Mendy', tamAd: 'Batista Mendy', no: 5, rol: 'MID', sesKey: 'mendy', hiz: 1.04, sut: 0.78, sac: '#151212', ten: '#764528' },
    { ad: 'Okay', tamAd: 'Okay Yokuşlu', no: 35, rol: 'MID', sesKey: 'okay', hiz: 1.00, sut: 0.80, sac: '#2a1c12', ten: '#efc4a2' },
    { ad: 'Višća', tamAd: 'Edin Višća', no: 7, rol: 'MID', sesKey: 'visca', hiz: 1.09, sut: 0.88, sac: '#483522', ten: '#f3caa8' },
    { ad: 'Zubkov', tamAd: 'Oleksandr Zubkov', no: 22, rol: 'FWD', sesKey: 'zubkov', hiz: 1.08, sut: 0.88, sac: '#785a35', ten: '#f5ceb3' },
    { ad: 'Onuachu', tamAd: 'Paul Onuachu', no: 30, rol: 'FWD', sesKey: 'onuachu', hiz: 1.02, sut: 0.96, sac: '#141212', ten: '#673a20', iri: true }
  ];

  /**
   * 1-4-4-2 dizilişi için normalize [rx, ry] koordinatları (11 oyuncu)
   */
  var FORMASYON_11 = [
    [0.50, 0.06], // 0: GK
    [0.14, 0.28], // 1: LB / RB
    [0.38, 0.25], // 2: LCB
    [0.62, 0.25], // 3: RCB
    [0.86, 0.28], // 4: RB / LB
    [0.14, 0.58], // 5: LM
    [0.39, 0.54], // 6: LCM
    [0.61, 0.54], // 7: RCM
    [0.86, 0.58], // 8: RM
    [0.36, 0.84], // 9: LF
    [0.64, 0.84]  // 10: RF (GS'de Gün #61)
  ];

  /**
   * Yedek 1-2-2-2 dizilişi (7'ye 7 uyumluluk için)
   */
  var FORMASYON_7 = [
    [0.50, 0.08], // 0: GK
    [0.30, 0.30], // 1: DEF (sol stoper)
    [0.70, 0.30], // 2: DEF (sağ stoper)
    [0.25, 0.58], // 3: MID (sol orta saha)
    [0.75, 0.58], // 4: MID (sağ orta saha)
    [0.36, 0.84], // 5: FWD (sol forvet)
    [0.64, 0.84]  // 6: FWD (sağ forvet / GS'de Gün #61)
  ];

  global.KADROLAR = {
    RENK: RENK,
    GS: GS,
    FB: FB,
    BJK: BJK,
    TS: TS,
    TAKIMLAR: {
      GS: GS,
      FB: FB,
      BJK: BJK,
      TS: TS
    },
    FORMASYON_11: FORMASYON_11,
    FORMASYON_7: FORMASYON_7
  };
})(typeof window !== 'undefined' ? window : globalThis);
