#!/usr/bin/env python3
"""Türkçe derbi spiker ses dosyalarını (sesler/*.mp3) Edge TTS + FFmpeg ile üretir."""

from __future__ import annotations

import argparse
import concurrent.futures
import pathlib
import subprocess
import sys
import tempfile

BASE_DIR = pathlib.Path(__file__).resolve().parent
SESLER_DIR = BASE_DIR / "sesler"

SESLER = [
    ("basla.mp3", "Büyük derbi başladı! Başarılar Gün!"),
    ("basla_2.mp3", "Rams Park tıklım tıklım! Haydi Gün, sahne senin!"),
    ("basla_3.mp3", "Dev derbide ilk düdük çaldı! Haydi Galatasaray!"),
    ("gun_top.mp3", "Top Gün'de!"),
    ("gun_top_2.mp3", "Gün topla buluştu, tribünler ayakta!"),
    ("gun_top_3.mp3", "Gün hızla ilerliyor!"),
    ("gun_top_4.mp3", "Süper çalım Gün'den, kaleye doğru!"),
    ("pas_gun.mp3", "Harika pas Gün'e!"),
    ("pas_gun_2.mp3", "Tek pasla Gün topla buluşuyor!"),
    ("pas_gun_3.mp3", "Müthiş ara pası Gün'e doğru!"),
    ("pas_guzel_1.mp3", "Şık bir paslaşma Galatasaray'dan!"),
    ("pas_guzel_2.mp3", "Harika pas! Osimen koşuyor!"),
    ("pas_guzel_3.mp3", "İşte güzel paslaşma, atak olgunlaşıyor!"),
    ("aslan_sutu.mp3", "Gün geliyor! Aslan Şutuuu!"),
    ("aslan_sutu_2.mp3", "İnanılmaz enerji! İşte Aslan Şutuuu!"),
    ("aslan_sutu_3.mp3", "Durdurulamaz bir Aslan Şutu geliyor!"),
    ("sut_sert_1.mp3", "Müthiş bir şut! Kaleciye doğru!"),
    ("sut_sert_2.mp3", "Sert vuruş! Top füze gibi gidiyor!"),
    ("kapma_1.mp3", "Harika müdahale! Topu kaptı!"),
    ("kapma_2.mp3", "Müthiş bir top kapma!"),
    ("kapma_3.mp3", "Kayarak temiz bir müdahale! Top Galatasaray'da!"),
    ("degaj_1.mp3", "Kaleci Uğurcan uzun oynuyor!"),
    ("degaj_2.mp3", "Harika bir degajla atağı başlattı!"),
    ("gol_gun_1.mp3", "Gooool! Gün attı! Harikasın Gün!"),
    ("gol_gun_2.mp3", "İnanılmaz bir gol! Gün ağları sarstı!"),
    ("gol_gun_3.mp3", "Ne gol ama! Gün fileleri havalandırdı!"),
    ("gol_gun_4.mp3", "Stadyum yıkılıyor! Süper gol Gün!"),
    ("gol_gs.mp3", "Gooool! Galatasaray öne geçiyor!"),
    ("gol_gs_2.mp3", "Gooool! Sarı kırmızılılar coşuyor!"),
    ("gol_gs_3.mp3", "Harika gol! Aslanlar tribünleri ayağa kaldırdı!"),
    ("gol_fb.mp3", "Fenerbahçe golü buldu, haydi Galatasaray!"),
    ("gol_fb_2.mp3", "Rakip golü attı ama pes etmek yok, bastır Gün!"),
    ("kurtaris.mp3", "Müthiş kurtarış!"),
    ("kurtaris_2.mp3", "Kaleci kalesinde devleşti!"),
    ("kurtaris_3.mp3", "İnanılmaz bir refleks kurtarışı!"),
    ("direk.mp3", "Direkten döndü!"),
    ("direk_2.mp3", "Üst direkten patladı! Çok yaklaştı!"),
    ("devre.mp3", "İlk yarı bitti!"),
    ("devre_2.mp3", "İlk yarı sona erdi! İkinci yarıya hazır mısın Gün?"),
    ("ikinci_yari.mp3", "İkinci yarı başladı! Haydi bastır!"),
    ("ikinci_yari_2.mp3", "İkinci yarıda düdük çaldı! Şimdi daha hızlıyız!"),
    ("altin_gol.mp3", "Beraberlik! Şimdi altın gol zamanı!"),
    ("zafer.mp3", "Şampiyon Galatasaray! Tebrikler Gün!"),
    ("zafer_2.mp3", "Kupa Galatasaray'ın! Büyük zafer Gün!"),
    ("mac_sonu.mp3", "Maç bitti! Harika bir derbiydi!"),
    ("mac_sonu_2.mp3", "Son düdük çaldı! Unutulmaz bir derbi mücadelesiydi!"),
    ("korner_gs.mp3", "Korner Galatasaray'ın! Ceza sahası kalabalık!"),
    ("korner_fb.mp3", "Fenerbahçe köşe vuruşu kullanacak! Dikkat savunma!"),
    ("tac_gs.mp3", "Taç atışı Galatasaray'ın!"),
    ("aut_atisi.mp3", "Top dışarıda, kale vuruşu kullanılacak!"),
    # Tüm oyuncuların topla buluşma ve aksiyon seslendirmeleri (22 oyuncu)
    ("p_ugurcan_top.mp3", "Top kaleci Uğurcan'da!"),
    ("p_ugurcan_aksiyon.mp3", "Harika kurtarış Uğurcan Çakır'dan!"),
    ("p_jakobs_top.mp3", "Yakobs topla buluştu!"),
    ("p_jakobs_aksiyon.mp3", "İsmail Yakobs'tan şık bir pas!"),
    ("p_davinson_top.mp3", "Davinson Sançez topu aldı!"),
    ("p_davinson_aksiyon.mp3", "Davinson Sançez'den harika müdahale!"),
    ("p_abdulkerim_top.mp3", "Abdülkerim topa sahip!"),
    ("p_abdulkerim_aksiyon.mp3", "Abdülkerim'den temiz bir pas!"),
    ("p_singo_top.mp3", "Singo sağ kanatta topu aldı!"),
    ("p_singo_aksiyon.mp3", "Singo hızla bindirdi, nefis hareket!"),
    ("p_sane_top.mp3", "Leroy Sane topla buluştu!"),
    ("p_sane_aksiyon.mp3", "Sane'den harika bir çalım!"),
    ("p_torreira_top.mp3", "Lukas Toreyra topu kontrol etti!"),
    ("p_torreira_aksiyon.mp3", "Toreyra ortada harika bir pas çıkardı!"),
    ("p_sara_top.mp3", "Gabriel Sara topu aldı!"),
    ("p_sara_aksiyon.mp3", "Gabriel Sara'dan enfes ara pası!"),
    ("p_baris_top.mp3", "Barış Alper sağdan hızlanıyor!"),
    ("p_baris_aksiyon.mp3", "Barış Alper'den müthiş sürüş!"),
    ("p_osimhen_top.mp3", "Top Viktor Osimen'de!"),
    ("p_osimhen_aksiyon.mp3", "Osimen'den harika bir pas!"),
    ("p_gun_aksiyon.mp3", "Gün harika sıyrıldı!"),
    ("p_ederson_top.mp3", "Top kaleci Ederson'da!"),
    ("p_ederson_aksiyon.mp3", "Ederson'dan kritik kurtarış!"),
    ("p_oosterwolde_top.mp3", "Oostervolde topla buluştu."),
    ("p_oosterwolde_aksiyon.mp3", "Oostervolde'den hızlı müdahale!"),
    ("p_ake_top.mp3", "Neytın Ake topu aldı."),
    ("p_ake_aksiyon.mp3", "Ake savunmada topu çıkardı!"),
    ("p_skriniar_top.mp3", "Şkrinyar savunmada topa sahip."),
    ("p_skriniar_aksiyon.mp3", "Şkrinyar'dan yerinde müdahale!"),
    ("p_semedo_top.mp3", "Nelson Semedo kanatta topu aldı."),
    ("p_semedo_aksiyon.mp3", "Semedo ileriye pasını verdi!"),
    ("p_kerem_top.mp3", "Kerem topla hareketleniyor."),
    ("p_kerem_aksiyon.mp3", "Kerem'den tehlikeli bir pas!"),
    ("p_kante_top.mp3", "Kante orta sahada topu kaptı!"),
    ("p_kante_aksiyon.mp3", "Kante'den hızlı top dağıtımı!"),
    ("p_ismail_top.mp3", "İsmail Yüksek topla buluştu."),
    ("p_ismail_aksiyon.mp3", "İsmail'den temiz pas!"),
    ("p_asensio_top.mp3", "Marko Asensiyo topu kontrol etti."),
    ("p_asensio_aksiyon.mp3", "Asensiyo tehlikeli geliyor!"),
    ("p_greenwood_top.mp3", "Grinvud hücumda topla buluştu."),
    ("p_greenwood_aksiyon.mp3", "Grinvud'dan hızlı bir hamle!"),
    ("p_lukaku_top.mp3", "Top Romelu Lukaku'da!"),
    ("p_lukaku_aksiyon.mp3", "Lukaku güçlü bir pas aktardı!"),
    # Beşiktaş & Trabzonspor takım ve oyuncu seslendirmeleri
    ("gol_bjk.mp3", "Beşiktaş golü buldu, haydi Galatasaray!"),
    ("gol_ts.mp3", "Trabzonspor golü buldu, haydi Galatasaray!"),
    ("korner_bjk.mp3", "Beşiktaş köşe vuruşu kullanacak! Dikkat savunma!"),
    ("korner_ts.mp3", "Trabzonspor köşe vuruşu kullanacak! Dikkat savunma!"),
    ("p_mertgunok_top.mp3", "Top kaleci Mert Günok'ta!"),
    ("p_mertgunok_aksiyon.mp3", "Mert Günok'tan kritik kurtarış!"),
    ("p_masuaku_top.mp3", "Masuaku kanatta topu aldı."),
    ("p_masuaku_aksiyon.mp3", "Masuaku'dan hızlı bindirme!"),
    ("p_uduokhai_top.mp3", "Uduokhai savunmada topa sahip."),
    ("p_uduokhai_aksiyon.mp3", "Uduokhai topu tehlike bölgesinden çıkardı!"),
    ("p_paulista_top.mp3", "Gabriel Paulista topu kontrol etti."),
    ("p_paulista_aksiyon.mp3", "Paulista'dan yerinde müdahale!"),
    ("p_svensson_top.mp3", "Svensson sağ kanatta topla buluştu."),
    ("p_svensson_aksiyon.mp3", "Svensson ileriye pasını verdi!"),
    ("p_rashica_top.mp3", "Raşitsa hızla ilerliyor!"),
    ("p_rashica_aksiyon.mp3", "Raşitsa'dan tehlikeli atak!"),
    ("p_gedson_top.mp3", "Gedson Fernandes orta sahada topu aldı!"),
    ("p_gedson_aksiyon.mp3", "Gedson'dan müthiş sürüş!"),
    ("p_orkun_top.mp3", "Orkun Kökçü topla buluştu!"),
    ("p_orkun_aksiyon.mp3", "Orkun Kökçü'den enfes ara pası!"),
    ("p_muci_top.mp3", "Ernest Muçi topa sahip."),
    ("p_muci_aksiyon.mp3", "Ernest Muçi'den şık bir çalım!"),
    ("p_rafa_top.mp3", "Rafa Silva tehlikeli geliyor!"),
    ("p_rafa_aksiyon.mp3", "Rafa Silva'dan çok hızlı bir pas!"),
    ("p_immobile_top.mp3", "Top Çiro İmmobile'de!"),
    ("p_immobile_aksiyon.mp3", "İmmobile ceza sahasına doğru yöneldi!"),
    ("p_onana_top.mp3", "Top kaleci Andre Onana'da!"),
    ("p_onana_aksiyon.mp3", "Andre Onana'dan harika kurtarış!"),
    ("p_eren_top.mp3", "Eren Elmalı topla buluştu."),
    ("p_eren_aksiyon.mp3", "Eren Elmalı kanattan bindirdi!"),
    ("p_batagov_top.mp3", "Batagov savunmada topu aldı."),
    ("p_batagov_aksiyon.mp3", "Batagov'dan temiz bir pas!"),
    ("p_savic_top.mp3", "Stefan Saviç topu kontrol etti."),
    ("p_savic_aksiyon.mp3", "Stefan Saviç'ten kritik müdahale!"),
    ("p_malheiro_top.mp3", "Pedro Maleyro sağ kanatta."),
    ("p_malheiro_aksiyon.mp3", "Pedro Maleyro ileri aktardı!"),
    ("p_nwakaeme_top.mp3", "Nvakaeme sol kanatta topla buluştu!"),
    ("p_nwakaeme_aksiyon.mp3", "Nvakaeme'den teknik bir çalım!"),
    ("p_mendy_top.mp3", "Batista Mendi topu kaptı."),
    ("p_mendy_aksiyon.mp3", "Batista Mendi'den güçlü bir pas!"),
    ("p_okay_top.mp3", "Okay Yokuşlu orta sahada."),
    ("p_okay_aksiyon.mp3", "Okay Yokuşlu'dan yerinde pas!"),
    ("p_visca_top.mp3", "Edin Vişça sağ kanatta hızlanıyor!"),
    ("p_visca_aksiyon.mp3", "Edin Vişça tehlikeli orta açabilir!"),
    ("p_zubkov_top.mp3", "Zubkov hücumda topla buluştu."),
    ("p_zubkov_aksiyon.mp3", "Zubkov'dan sert bir hamle!"),
    ("p_onuachu_top.mp3", "Top Pol Onuaçu'da!"),
    ("p_onuachu_aksiyon.mp3", "Pol Onuaçu kule gibi yükseldi!"),
]

SES_ADAYLARI = ("tr-TR-AhmetNeural", "tr-TR-EmelNeural")
TEMPO = "+8%"
SILENCE_FILTER = (
    "silenceremove=start_periods=1:start_duration=0:start_threshold=-42dB:"
    "stop_periods=-1:stop_duration=0.05:stop_threshold=-42dB"
)


def sentezle(metin_dosyasi: pathlib.Path, ham_mp3: pathlib.Path) -> str:
    """Metni edge_tts ile sentezler; ilk olarak AhmetNeural, hata olursa EmelNeural dener."""
    son_hata = ""
    for ses in SES_ADAYLARI:
        cmd = [
            sys.executable,
            "-m",
            "edge_tts",
            "-v",
            ses,
            f"--rate={TEMPO}",
            "-f",
            str(metin_dosyasi),
            "--write-media",
            str(ham_mp3),
        ]
        sonuc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if sonuc.returncode == 0 and ham_mp3.exists() and ham_mp3.stat().st_size > 0:
            return ses
        son_hata = (sonuc.stderr or sonuc.stdout or f"exit {sonuc.returncode}").strip()
        if ham_mp3.exists():
            ham_mp3.unlink()
    raise RuntimeError(f"edge_tts başarısız oldu: {son_hata}")


def sessizligi_kirp(ham_mp3: pathlib.Path, hedef_mp3: pathlib.Path) -> None:
    """FFmpeg silenceremove filtresi ile baştaki ve sondaki sessizliği kırpar."""
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(ham_mp3),
        "-af",
        SILENCE_FILTER,
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "4",
        str(hedef_mp3),
    ]
    sonuc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if sonuc.returncode != 0 or not hedef_mp3.exists() or hedef_mp3.stat().st_size == 0:
        hata = (sonuc.stderr or sonuc.stdout or f"exit {sonuc.returncode}").strip()
        raise RuntimeError(f"ffmpeg başarısız oldu ({hedef_mp3.name}): {hata}")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Türkçe derbi spiker seslerini üretir.")
    parser.add_argument("--force", action="store_true", help="Mevcut dosyaları da yeniden üret")
    args = parser.parse_args()

    SESLER_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="gun_derbi_tts_") as tmp_dir:
        tmp_path = pathlib.Path(tmp_dir)
        yapilacaklar = []
        for idx, (dosya_adi, metin) in enumerate(SESLER, start=1):
            hedef_mp3 = SESLER_DIR / dosya_adi
            if not args.force and hedef_mp3.exists() and hedef_mp3.stat().st_size > 4000:
                print(f"[{idx:02d}/{len(SESLER)}] {dosya_adi} (atlandı - hazır {hedef_mp3.stat().st_size} bayt)")
                continue
            yapilacaklar.append((idx, dosya_adi, metin, hedef_mp3))

        def is_yap(madde):
            idx, dosya_adi, metin, hedef_mp3 = madde
            metin_dosyasi = tmp_path / f"{idx:02d}.txt"
            ham_mp3 = tmp_path / f"{idx:02d}_raw.mp3"
            metin_dosyasi.write_text(metin, encoding="utf-8")
            kullanilan_ses = sentezle(metin_dosyasi, ham_mp3)
            sessizligi_kirp(ham_mp3, hedef_mp3)
            return idx, dosya_adi, kullanilan_ses, hedef_mp3.stat().st_size

        if yapilacaklar:
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as havuz:
                for idx, dosya_adi, kullanilan_ses, boyut in havuz.map(is_yap, yapilacaklar):
                    print(f"[{idx:02d}/{len(SESLER)}] {dosya_adi} ({kullanilan_ses}, {boyut} bayt)")

    print(f"Tamamlandı: {len(SESLER)} spiker ses dosyası -> {SESLER_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
