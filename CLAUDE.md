# GÜN FUTBOL (`gun-futbol`)

Genel kurallar: `../CLAUDE.md`. 5 yaşındaki Gün için hazırlanmış, Captain Tsubasa / Sensible Soccer çizgi roman havasında **11'e 11 Galatasaray vs Seçilebilir Rakip (Fenerbahçe / Beşiktaş / Trabzonspor)** futbol oyunu (`2 × 2,5 dk` devreler, iPad PWA + masaüstü uyumlu, `file://` ile doğrudan açılır).

## Dosyalar ve Yükleme Sırası
Klasik `<script>` sırası (ES module yok):
`kadrolar.js` → `ses.js` → `efekt.js` → `saha.js` → `oyuncular.js` → `oyun.js`

- Sayfa & stil: `index.html`, `style.css`, `kapak.jpg` (Galatasaray #61 GÜN giriş ekranı kapak görseli)
- PWA & çevrimdışı: `manifest.webmanifest`, `sw.js` (`CACHE = 'gun-futbol-v9'`, önek `gun-futbol-`; yeni dosya/ses eklenince `CORE`/`SESLER` listesini güncelle ve sürümü artır), `icons/icon-{180,192,512}.png`
- Sesler: `sesler/*.mp3` (tribün kayıtları için aşağıdaki "Tribün sesleri" bölümüne bak; 141 Türkçe spiker kaydı: aksiyonlar + tüm 44 futbolcunun isim/aksiyon anonsları + Web Audio arka plan stadyum taraftar uğultusu & tezahüratları)
- Yayın: `yayinla.command` (`goktugkarpat/gun-futbol` deposuna gönderir; **yalnızca ebeveyn istediğinde** çalıştırılır)

## Kadrolar ve Öne Çıkan Özellikler
`kadrolar.js` (`KADROLAR`: `GS`, `FB`, `BJK`, `TS`, `1-4-3-3` dizilişi `FORMASYON_11`):
- **GS (Sarı-Kırmızı Parçalı):** Kaptan **GÜN (#61, LW/FWD)**, Osimhen (#45), Barış Alper (#53), Sané (#10), Sara (#8), Torreira (#34), Jakobs (#4), Abdülkerim (#42), Davinson (#6), Singo (#90), Uğurcan (#1, GK).
- **Rakipler:** Fenerbahçe (`FB`), Beşiktaş (`BJK`) ve Trabzonspor (`TS`) giriş ekranından seçilebilir.
- **Süre ve Maç Akışı:** `2 × 2,5 dakika` (`oyun.js` `paramOku` `sure: 150`; devre arası `#perde-devre`, maç sonu `#perde-sonuc` kupa töreni, beraberlikte Altın Gol).
- **Aslan Gücü (`#aslan-kutu`):** Dolunca `#btn-sut.aslan-hazir` ile alevli özel **Aslan Şutu** açılır.
- **Kaleci Yakalama & Dağıtım:** Kaleciler şut ve ortaları eldivenle yakalayıp ceza sahası önüne 2 adım yürür, `PAS (X)` ile elle pas veya `ŞUT (Boşluk)` ile uzun degaj çıkarır.
- **Duran Toplar:** Taç, korner ve aut atışlarında oyuncular kurallara uygun konumlanır, canlı nişan oku ve güç çubuğu gösterilir.

## Kontroller
- **iPad / Dokunmatik:** Sol yarı saha yüzen joystick (`#sol-hareket-alani`), sağ alt **PAS / TOP KAP** (`#btn-pas`) ve **ŞUT / ASLAN ŞUTU** (`#btn-sut`).
- **Masaüstü / Klavye:** `WASD` / Oklar: Koş · `X` / `Z`: Pas/Kap · `Boşluk` / `C`: Şut/Aslan Şutu · `P`: Mola · `R`: Yeniden.

## Test Bayrakları (`index.html?...`)
- `?sessiz` — tüm sesleri (spiker, efekt ve taraftar ambiyansını) susturarak aç
- `?oto` — otomatik demo/oyun modu
- `?hiz=N` — simülasyon hız çarpanı
- `?sw0` — service worker kaydını devre dışı bırak

## Tribün sesleri (22 Kasım 2026)
- `gen_taraftar.py` (numpy + ffmpeg + edge-tts) üretir: `sesler/tribun_ugultu.mp3` (kesintisiz uğultu döngüsü), `tribun_gol`, `tribun_alkis`, `tribun_ooo`, `tribun_ah`, `tribun_heyecan` ve `tezahurat_*.mp3` (110 kişilik dağınık koro + davul + ritmik alkış). Eski `gen_tezahurat.py` artık kullanılmıyor. `python gen_taraftar.py --yalniz gol,alkis --cikti <klasör>` ile tek tek denenebilir.
- `ses.js`: uğultu iki `<audio>` ile üst üste eritilerek döner (`ugultuAdim`); `SES.tribunTepki('gol'|'alkis'|'ooo'|'ah'|'heyecan')`. `oyun.js`: GS şutu → heyecan, bizim kaleci kurtardı → alkış, rakip kaleci kurtardı / direk → ooo, rakip golü → ah, GS golü → `tezahurat_gol_cosku`. "Cim Bom Bom" tezahüratı listede iki kez (ebeveyn: aralarda sık girsin, arka planda ama duyulsun).
- Sesler kulakla ebeveyn tarafından dinlenir; ben yalnız ölçebilirim.
- 22 Kasım (2. tur): ebeveyn alkışı "çok tiz, rahatsız edici" buldu → bütün `tribun_*`/`tezahurat_*` kayıtlarında 2,2 kHz üstü kısıldı (ffmpeg highshelf −9 dB + lowpass 4,2 kHz), `TEPKI.alkis` kazancı 0,42, aralardaki rastgele alkış kaldırıldı. Kamera yakınlaştı (`camScale` 1120/850), GÜN rozeti büyüdü (15,5 px).
