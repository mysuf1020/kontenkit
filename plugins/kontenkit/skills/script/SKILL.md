---
name: script
description: Menulis naskah horor pendek berbahasa Indonesia untuk TikTok, Reels, dan YouTube Shorts (30–90 detik) — voice-over per beat dengan timestamp, teks layar, arahan visual/B-roll, cue SFX, 3 alternatif hook, Script Voice Over bertag ekspresi siap tempel ke Google AI Studio TTS (Generate Speech) beserta Style instructions-nya, plus caption dan hashtag — bertema horor lokal (kuntilanak, pocong, genderuwo, santet, kos-kosan, KKN, desa, jalan sepi, mitos daerah). Hasilnya file .md siap rekam. Gunakan skill ini setiap kali user minta naskah, script, cerita, atau ide konten horor/seram/misteri/urban legend/kisah mistis untuk video pendek atau konten sosmed, walaupun tidak menyebut "naskah" secara eksplisit (mis. "bikinin cerita pocong buat tiktok", "ide konten seram 1 menit"). Kalau user minta videonya langsung di-render jadi animasi MP4, pakai skill anim dari plugin kontenkit (naskah dari skill ini bisa jadi bahannya).
---

# script (kontenkit)

Menulis naskah horor pendek yang siap direkam: orang bisa langsung membacanya sebagai voice-over, editor tahu visual dan suara apa yang dipasang di tiap detik, dan penonton tidak scroll di 2 detik pertama.

Video pendek hidup-mati di **retensi**. Setiap keputusan di bawah — hook di kalimat pertama, kalimat pendek, satu kejanggalan kecil sebelum ancaman besar, penutup yang menempel — ada karena itu yang membuat orang menonton sampai habis dan berkomentar.

Baca sebelum menulis:
- `references/teknik-horor.md` — pola hook, cara membangun ketegangan, bahan cerita lokal per daerah, klise yang perlu dihindari.
- `references/tts-ai-studio.md` — daftar tag ekspresi `<...>` dan pilihan style untuk Google AI Studio TTS. Pakai hanya tag dari daftar ini; tag di luar daftar berisiko ikut terbaca sebagai teks.

## Alur kerja

1. **Tangkap permintaan.** Tema/makhluk/tempat, durasi (default **60 detik**), platform, sudut pandang (default orang pertama: "Aku..." terasa seperti pengakuan, lebih seram), dan handle/nama channel kalau ada. Kalau user hanya memberi tema ("pocong di kos"), langsung karang ceritanya — jangan menginterogasi. Tanyakan hanya kalau ada yang benar-benar membuat naskah salah arah.
2. **Pilih satu premis tajam.** Satu tempat, satu aturan/pantangan atau satu kejanggalan, satu sosok. Cerita 60 detik tidak muat dua hantu atau dua twist. Tulis premis dalam satu kalimat dulu untukmu sendiri.
3. **Hitung anggaran kata.** Voice-over bahasa Indonesia yang dibacakan pelan dan dramatis ≈ **2,3 kata/detik**. Sisakan ±10–15% untuk jeda dan SFX.
   - Batas atas kata VO: 30 dtk → **50 kata** · 60 dtk → **100 kata** · 90 dtk → **150 kata**. Batas ini sudah menyisakan ±12 dtk per menit untuk tag jeda. Anggap batas keras, dan hitung dengan skrip, bukan perkiraan.
   - Estimasi durasi = kata ÷ 2,3 + total tag (pakai angka tengah di bawah). Hasilnya harus ≤ durasi target.
   - Lebih dari anggaran = naskah dibaca terburu-buru dan horornya hilang. Potong, jangan percepat.
   - Nilai tag untuk estimasi: `<short pause>` 0,5 dtk, `<medium pause>` 1 dtk, `<long pause>` 1,75 dtk, tag non-verbal (`<sigh>`, `<gasp>`, `<inhale>`, `<exhale>`) 0,75 dtk. Tag emosi tidak menambah waktu.
   - Timestamp di struktur beat adalah panduan proporsi; tulis timestamp di tabel sesuai hasil estimasi naskahmu sendiri.
4. **Tulis naskah** dengan struktur beat di bawah, lalu bacakan dalam kepala dengan tempo pelan. Kalimat yang tersandung dibaca, tulis ulang.
5. **Swa-periksa** dengan daftar di bagian akhir, perbaiki, lalu **simpan file** `<slug>.md` di folder kerja (slug huruf kecil dengan tanda hubung, mis. `ketukan-jam-tiga.md`). Kalau user minta beberapa naskah, satu file per naskah.
6. **Laporkan** di chat: path file, judul, hook terpilih, total kata dan estimasi durasi. Jangan tempel ulang seluruh naskah kecuali diminta — sudah ada di file.

## Struktur beat (60 detik)

Skala proporsional untuk durasi lain (30 dtk: gabungkan setup+kejanggalan; 90 dtk: eskalasi boleh 2 langkah). Hook tetap 0–4 dtk dan ≤9 kata di durasi berapa pun — itu batas perhatian penonton, bukan proporsi. Penutup ±7 dtk berarti ≤15 kata; cek per beat, bukan cuma total.

| Beat | Waktu | Tugas |
|---|---|---|
| Hook | 0–4 dtk | Satu kalimat yang memaksa bertanya "terus?" — aturan aneh, angka/jam spesifik, atau pernyataan mengganggu. Tanpa salam, tanpa "halo guys", tanpa judul dibacakan. |
| Setup | 4–12 dtk | Siapa, di mana, apa yang normal. Satu detail konkret yang membuat tempatnya terasa nyata (bau, suara, benda). |
| Kejanggalan | 12–25 dtk | Satu hal kecil yang salah. Kecil lebih seram: sandal pindah posisi, ada yang menjawab salam padahal rumah kosong. |
| Eskalasi | 25–45 dtk | Tokoh melanggar pantangan / menyelidiki / mengabaikan peringatan. Ancaman makin dekat tapi **masih samar**. |
| Klimaks | 45–53 dtk | Puncak: sosok terlihat, suara tepat di telinga, atau kebenaran terungkap. Kalimat paling pendek di seluruh naskah. |
| Penutup | 53–60 dtk | Akibat + kalimat yang menyeret penonton masuk ("Kalau malam ini kamu dengar ketukan tiga kali..."). Bisa juga twist singkat. Akhiri dengan pancingan komentar yang terasa alami, bukan "jangan lupa like dan subscribe". |

## Format file (wajib ikuti)

Format tetap ini dipakai karena editor dan pengisi suara membaca kolom yang sama setiap kali, dan skill `anim` (kontenkit) bisa memakai kolom **Teks layar** langsung sebagai teks scene.

```markdown
# [Judul — maks 6 kata, bikin penasaran]

**Durasi:** ±60 dtk · **Kata VO:** [jumlah] · **Platform:** [yang diminta user; kalau tidak disebut, "TikTok/Reels/Shorts"]
**Channel:** [@handle — hanya kalau user memberi; juga taruh di akhir caption]
**Premis:** [satu kalimat]
**Nada suara:** [mis. berbisik, pelan, seperti cerita ke teman di pos ronda]

## Alternatif hook
1. [hook terpilih — dipakai di naskah]
2. [alternatif, pola berbeda]
3. [alternatif, pola berbeda]

## Naskah

| Waktu | Voice-over | Teks layar | Visual | Suara |
|---|---|---|---|---|
| 0–4 | [kalimat hook] | [≤8 kata, *kata kunci* bertanda bintang] | [shot/B-roll] | [SFX/musik] |
| ... | ... | ... | ... | ... |

## Script Voice Over
<!-- Tempel ke kolom teks Google AI Studio → Generate Speech -->

<calm> [kalimat pertama]...

<short pause>

<serious> [kalimat berikutnya]...

[...dan seterusnya, satu kalimat/frasa per baris, baris kosong di antaranya]

## Style instructions
<!-- Tempel ke kolom Style instructions. Temperature 1.0–1.2 -->
```text
[3 kalimat bahasa Inggris: persona + mood, pacing, dan bagaimana emosi berkembang sampai klimaks]
```

## Caption
[1–2 kalimat + pertanyaan pemancing komentar]

[5–8 hashtag: campuran besar (#horor #ceritahoror) dan spesifik tema (#pocong #kkn)]
```

Catatan kolom:
- **Voice-over** tanpa tanda `*bintang*` dan tanpa tag — itu teks yang diucapkan. Tag hanya ada di Script Voice Over.
- **Teks layar** bukan salinan VO — ringkasan pendek (≤8 kata) untuk penonton yang menonton tanpa suara. Tandai 1–2 kata paling seram dengan `*bintang*`.
- **Visual** harus bisa dibuat kreator biasa: footage gelap, POV senter, lorong, close-up benda, layar hitam, stok footage. Hindari arahan yang butuh produksi film ("drone shot desa saat badai").
- **Suara**: spesifik (`ketukan 3x di kayu`, `kipas angin berhenti`, `hening total 1 dtk`). Keheningan adalah SFX paling kuat sebelum klimaks — pakai.
- Jumpscare (kalau ada) maksimal satu, di klimaks. Jumpscare di awal membuang modal ketegangan.

## Aturan Script Voice Over (TTS)

Script ini dibaca mesin, jadi tag adalah satu-satunya cara mengarahkan emosi. Tujuannya terdengar seperti orang sungguhan bercerita, bukan aktor sinetron — tag yang berlebihan justru membuat suara jadi teatrikal dan aneh.

- **Tag dalam bahasa Inggris, teks dalam bahasa Indonesia.** Model lebih patuh pada tag Inggris.
- **Maksimal 2 tag per baris teks** (baris jeda yang berdiri sendiri tidak dihitung), diletakkan di awal baris. Tag emosi (`<nervous>`, `<scared>`) berlaku untuk nada baris itu; tag non-verbal (`<gasp>`, `<inhale>`) boleh di tengah kalimat tepat di titik napas terjadi.
- **Jeda di baris sendiri** (`<short pause>`, `<medium pause>`, `<long pause>`), dipisah baris kosong. Ini juga memudahkan editor memotong audio.
- **Kurva emosi mengikuti beat**: hook dan setup `<calm>`/`<serious>`, kejanggalan `<nervous>`/`<slowly>`, eskalasi `<whispering>`/`<scared>`, klimaks `<gasp>` + `<shocked>` atau `<whispering>` paling pelan, penutup `<trembling>`/`<whispering>` dengan jeda panjang sebelum kata terakhir. Jangan mulai dari level takut tertinggi — tidak ada ruang naik lagi.
- **Elipsis "..."** (tiga titik biasa, bukan karakter "...", supaya tabel dan script cocok persis) adalah jeda napas alami di dalam kalimat; tag jeda adalah jeda antarkalimat. Pakai keduanya, tapi jangan semua kalimat diberi "...".
- **Pecah kalimat terakhir** jadi beberapa baris berbisik dengan jeda di antaranya untuk efek menggantung ("Menunggu..." → `<medium pause>` → "angkot berikutnya.").
- **Dialog sosok** ditulis dalam tanda kutip dengan tag yang kontras dengan narator (mis. `<calm>` atau `<monotone>` untuk suara hantu yang datar saat narator `<nervous>`).
- Teks di Script Voice Over harus sama isinya dengan kolom Voice-over di tabel — hanya ditambah tag dan jeda. Kalau satu diubah, ubah juga yang lain.

**Style instructions** selalu bahasa Inggris, 2–3 kalimat, gabungkan persona + mood + pacing + bagaimana ketakutan naik (lihat `references/tts-ai-studio.md` bagian 2–3). Sesuaikan persona dengan narator cerita (mahasiswa KKN, sopir angkot, ibu-ibu, anak kos) dan tambahkan "not theatrical" supaya tidak berlebihan. Contoh:

```text
Speak like a real Indonesian man recounting a personal, traumatic horror experience to a friend late at night. Keep the delivery conversational, grounded, and unhurried—not theatrical. Let the fear build naturally through slight hesitation, heavier breathing, and a trembling voice during the climax.
```

## Gaya bahasa

- Bahasa Indonesia lisan santai ("nggak", "udah", "kok") — ini dibacakan, bukan dibaca. Hindari kata kaku: "adapun", "tersebut", "merupakan", "sangatlah".
- Kalimat pendek. Satu napas per kalimat. Rata-rata ≤12 kata.
- Detail indrawi spesifik mengalahkan kata sifat: "bau melati, padahal nggak ada yang nanam melati" > "suasana sangat mencekam".
- Jangan sebut perasaan seram secara langsung ("aku sangat takut", "merinding"). Tunjukkan lewat tindakan dan detail; biar penonton yang merinding.
- Biarkan sosoknya samar. Satu detail yang salah ("kakinya nggak napak") lebih seram dari deskripsi lengkap. Kalau user meminta makhluk tertentu (pocong, kuyang), namanya boleh disebut sekali di VO — idealnya di setup sebagai mitos ("kata warga, ada pocong...") atau di penutup — supaya penonton tahu ini konten yang mereka cari, tapi wujudnya tetap samar.

## Batas konten

Seram lewat suasana, bukan sadis: tanpa gore/darah eksplisit, tanpa bunuh diri atau tata caranya, tanpa menyebut orang nyata sebagai korban atau pelaku, tanpa instruksi praktik santet/ritual yang bisa diikuti. Jangan klaim fiksi sebagai berita nyata atau menyebut lokasi spesifik (nama sekolah/RS sungguhan) sebagai tempat kejadian; "katanya kisah nyata?" dengan tanda tanya boleh sebagai pancingan. Hormati agama dan budaya — doa/ayat boleh muncul sebagai bagian cerita, bukan untuk diolok.

## Swa-periksa sebelum menyimpan

- [ ] Kalimat pertama bisa berdiri sendiri dan bikin penasaran tanpa konteks?
- [ ] Total kata VO ≤ anggaran durasi?
- [ ] Ada tepat satu sosok/ancaman utama dan satu kejanggalan kecil sebelum ancaman membesar?
- [ ] Klimaks adalah baris VO terpendek (tidak menghitung bunyi seperti "Duk." — taruh bunyi di kolom Suara)?
- [ ] Penutup menyeret penonton (peringatan/pertanyaan/twist), bukan sekadar "dan sejak itu aku nggak pernah ke sana lagi"?
- [ ] Ketiga hook memakai pola berbeda?
- [ ] Tidak ada klise di daftar hindari (lihat `references/teknik-horor.md`)?
- [ ] Teks Script Voice Over sama dengan kolom Voice-over di tabel (selain tag)?
- [ ] Semua tag ada di `references/tts-ai-studio.md`, maksimal 2 per baris, dan emosinya naik bertahap?
- [ ] Durasi dengan jeda sudah masuk anggaran?
- [ ] Style instructions bahasa Inggris, personanya cocok dengan narator?

## Lanjut ke video

Kalau user ingin naskah ini jadi animasi, tawarkan skill `anim` (kontenkit): kolom Teks layar → teks scene (maks ±14 kata, sudah bertanda `*bintang*`), kolom Visual → pilihan latar/karakter, dan audio hasil Script Voice Over bisa dipasang dengan `--voice narasi.mp3` (atau .wav). Audio itu bisa dibuat otomatis dari file naskah ini dengan skill `voice` (kontenkit), tanpa menyalin manual ke Google AI Studio.
