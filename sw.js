/* İnternetsiz çalışma. index.html için önce ağ, diğer dosyalar için önce önbellek.
   Yalnız bu oyunun önbellekleri (gun-futbol-) silinir; aynı sitedeki diğer oyunlara dokunulmaz. */
const ONEK = 'gun-futbol-';
const CACHE = 'gun-futbol-v14';
const SESLER = [
  'basla', 'basla_2', 'basla_3',
  'gun_top', 'gun_top_2', 'gun_top_3', 'gun_top_4',
  'pas_gun', 'pas_gun_2', 'pas_gun_3',
  'pas_guzel_1', 'pas_guzel_2', 'pas_guzel_3',
  'aslan_sutu', 'aslan_sutu_2', 'aslan_sutu_3',
  'sut_sert_1', 'sut_sert_2',
  'kapma_1', 'kapma_2', 'kapma_3',
  'degaj_1', 'degaj_2',
  'gol_gun_1', 'gol_gun_2', 'gol_gun_3', 'gol_gun_4',
  'gol_gs', 'gol_gs_2', 'gol_gs_3',
  'gol_fb', 'gol_fb_2',
  'kurtaris', 'kurtaris_2', 'kurtaris_3',
  'direk', 'direk_2',
  'devre', 'devre_2',
  'ikinci_yari', 'ikinci_yari_2',
  'altin_gol',
  'zafer', 'zafer_2',
  'mac_sonu', 'mac_sonu_2',
  'korner_gs', 'korner_fb', 'tac_gs', 'aut_atisi',
  'p_ugurcan_top', 'p_ugurcan_aksiyon',
  'p_jakobs_top', 'p_jakobs_aksiyon',
  'p_davinson_top', 'p_davinson_aksiyon',
  'p_abdulkerim_top', 'p_abdulkerim_aksiyon',
  'p_singo_top', 'p_singo_aksiyon',
  'p_sane_top', 'p_sane_aksiyon',
  'p_torreira_top', 'p_torreira_aksiyon',
  'p_sara_top', 'p_sara_aksiyon',
  'p_baris_top', 'p_baris_aksiyon',
  'p_osimhen_top', 'p_osimhen_aksiyon',
  'p_gun_aksiyon',
  'p_ederson_top', 'p_ederson_aksiyon',
  'p_oosterwolde_top', 'p_oosterwolde_aksiyon',
  'p_ake_top', 'p_ake_aksiyon',
  'p_skriniar_top', 'p_skriniar_aksiyon',
  'p_semedo_top', 'p_semedo_aksiyon',
  'p_kerem_top', 'p_kerem_aksiyon',
  'p_kante_top', 'p_kante_aksiyon',
  'p_ismail_top', 'p_ismail_aksiyon',
  'p_asensio_top', 'p_asensio_aksiyon',
  'p_greenwood_top', 'p_greenwood_aksiyon',
  'p_lukaku_top', 'p_lukaku_aksiyon',
  'gol_bjk', 'gol_ts', 'korner_bjk', 'korner_ts',
  'p_mertgunok_top', 'p_mertgunok_aksiyon',
  'p_masuaku_top', 'p_masuaku_aksiyon',
  'p_uduokhai_top', 'p_uduokhai_aksiyon',
  'p_paulista_top', 'p_paulista_aksiyon',
  'p_svensson_top', 'p_svensson_aksiyon',
  'p_rashica_top', 'p_rashica_aksiyon',
  'p_gedson_top', 'p_gedson_aksiyon',
  'p_orkun_top', 'p_orkun_aksiyon',
  'p_muci_top', 'p_muci_aksiyon',
  'p_rafa_top', 'p_rafa_aksiyon',
  'p_immobile_top', 'p_immobile_aksiyon',
  'p_onana_top', 'p_onana_aksiyon',
  'p_eren_top', 'p_eren_aksiyon',
  'p_batagov_top', 'p_batagov_aksiyon',
  'p_savic_top', 'p_savic_aksiyon',
  'p_malheiro_top', 'p_malheiro_aksiyon',
  'p_nwakaeme_top', 'p_nwakaeme_aksiyon',
  'p_mendy_top', 'p_mendy_aksiyon',
  'p_okay_top', 'p_okay_aksiyon',
  'p_visca_top', 'p_visca_aksiyon',
  'p_zubkov_top', 'p_zubkov_aksiyon',
  'p_onuachu_top', 'p_onuachu_aksiyon',
  'tezahurat_cimbombom', 'tezahurat_cimbom_alkis',
  'tezahurat_sampiyon', 'tezahurat_sari_kirmizi',
  'tezahurat_haydi_aslanlar', 'tezahurat_gol_cosku', 'tribun_ugultu', 'tribun_alkis', 'tribun_gol', 'tribun_ooo', 'tribun_ah', 'tribun_heyecan'
];
const CORE = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'kapak.jpg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'kadrolar.js',
  'ses.js',
  'efekt.js',
  'saha.js',
  'oyuncular.js',
  'oyun.js'
].concat(SESLER.map(s => 'sesler/' + s + '.mp3'));

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE.map(p => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith(ONEK) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;

  const sayfa = r.mode === 'navigate' || u.pathname.endsWith('/index.html') || u.pathname.endsWith('/');
  if (sayfa) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const y = await fetch(r);
        if (y.ok) {
          try { await c.put('index.html', y.clone()); } catch (_) { /* Depolama dolu olsa da ağdaki oyun açılır. */ }
          return y;
        }
        return (await c.match('index.html')) || (await c.match('./')) || y;
      } catch (_) {
        return (await c.match('index.html')) || (await c.match('./')) || Response.error();
      }
    })());
  } else {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const o = await c.match(r, { ignoreSearch: true });
      if (o) return o;
      const y = await fetch(r);
      if (y.ok) {
        try { await c.put(r, y.clone()); } catch (_) { /* Depolama hatası oyunu kesmez. */ }
      }
      return y;
    })());
  }
});
