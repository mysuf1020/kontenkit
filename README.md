# kontenkit

Plugin Claude Code untuk bikin konten horor pendek berbahasa Indonesia (TikTok, Reels, Shorts).

| Skill | Panggil | Fungsi |
|---|---|---|
| script | `/kontenkit:script` | Naskah horor 30–90 detik: hook, tabel per detik (VO, teks layar, visual, SFX), Script Voice Over bertag untuk Google AI Studio TTS + Style instructions, caption, hashtag. Hasil berupa file `.md`. |
| voice | `/kontenkit:voice` | Ubah Script Voice Over bertag jadi file narasi `.wav`/`.mp3` dengan Gemini TTS — manual lewat Google AI Studio (gratis, tanpa API key) atau otomatis lewat API: emosi per baris, jeda pas, suara napas, plus subtitle `.srt` sinkron yang otomatis di-burn oleh `anim --voice`. Bisa pakai suara sendiri (Gemini API paid tier). |
| anim | `/kontenkit:anim` | Render cerita horor jadi video animasi siluet 9:16 (MP4) lengkap dengan efek suara. |

Skill juga terpanggil otomatis kalau kamu minta, misalnya, "bikinin naskah tiktok horor 60 detik tentang pocong".

## Install

Di Claude Code:

```
/plugin marketplace add mysuf1020/kontenkit
/plugin install kontenkit@kontenkit
```

Update ke versi terbaru:

```
/plugin marketplace update kontenkit
```

## Cara pakai: dari ide sampai video siap upload

Alurnya **ide → naskah → voice over → video bersubtitle → upload**. Cukup ngobrol biasa dengan Claude, tidak perlu hafal perintah. Ketiga skill bisa dipanggil satu-satu, atau sekaligus:

> "Bikinin video horor lengkap tentang pocong di jalan sepi, sampai jadi MP4 pakai VO dan subtitle"

Claude akan menulis naskah, membuat VO, lalu me-render video. Di mode VO manual, Claude berhenti sebentar menunggu kamu generate suaranya di Google AI Studio (lihat langkah 3).

### 1. Ide (opsional)

Belum punya cerita? Minta beberapa ide dulu, lalu pilih:

> "Kasih 5 ide cerita horor lokal yang menarik buat TikTok"

### 2. Naskah

> "Bikinin naskah horor 60 detik tentang pocong di jalan sepi"

Hasilnya satu file `.md` berisi:
- **3 alternatif hook** (kalimat 3 detik pertama)
- **Tabel per detik**: voice over, teks layar, arahan visual, dan efek suara
- **Script Voice Over** bertag ekspresi (`<calm>`, `<whispering>`, `<short pause>`, ...) beserta **Style instructions** untuk TTS
- **Caption dan hashtag** siap tempel saat upload

Mau diubah? Bilang saja, misalnya "pakai hook nomor 2", "jadiin 45 detik", atau "tambahin handle @akunku di caption".

### 3. Voice over

**Satu take (default, gratis, tanpa API key):**
1. Buka [Google AI Studio](https://aistudio.google.com) → **Generate Speech**. Dari file naskah, tempel isi `## Style instructions` ke kolom Style instructions dan seluruh `## Script Voice Over` ke kolom teks. Pilih suara (yang disarankan `Enceladus`), Run, dengarkan, lalu download.
2. Simpan file audionya ke folder voice, lalu bilang ke Claude: **"VO-nya udah, file-nya `pocong-jalan-sepi.wav`"**.
3. Claude merapikan audionya (hening di awal/akhir dipotong, volume diseragamkan) dan membuat subtitle yang sinkron: whisper mendengarkan audionya, lalu tiap baris naskah ditempel ke jeda yang pas. Hasilnya `pocong-jalan-sepi.vo.wav` + `pocong-jalan-sepi.vo.srt`. File audio aslimu tidak diubah.

Subtitle presisi butuh model whisper `ggml-base.bin` (±148 MB). Claude minta izin dulu sebelum mengunduhnya. Tanpa model itu, subtitle tetap dibuat dari perkiraan jeda. Whisper kadang tidak menangkap kata yang sangat pendek dan dibisikkan, jadi satu-dua baris bisa meleset sedikit. File `.srt` bisa diedit tangan.

**Potongan:** kalau kamu mau mengulang bagian tertentu saja, minta "VO-nya per potongan". Claude memecah naskah jadi 3–5 potongan siap tempel (`01.wav`, `02.wav`, ...). Kamu generate tiap potongan, simpan sesuai nomornya, lalu bilang **"udah, gabungin"**. Subtitle mode ini selalu pas per baris.

**Otomatis (Gemini API):** bilang "VO-nya pakai API aja". Claude me-render langsung tanpa copy-paste dan juga menghasilkan audio + `.srt`. Butuh `GEMINI_API_KEY` (lihat syarat di bawah). Kuota free tier bisa sekecil **10 request per hari** (cek angkamu di https://ai.dev/rate-limit), sedangkan satu naskah 60 detik bisa butuh 13–15 request. Kalau kuota habis, segmen yang sudah jadi tersimpan dan render bisa dilanjutkan besoknya, atau pakai mode satu take.

### 4. Video + subtitle

> "Bikin videonya pakai VO narasi.mp3"

Yang dikerjakan Claude:
1. Menulis **file story** (`.js`): urutan scene beserta latar (jalan malam, kuburan, lorong, kamar, rumah tua, dll.), karakter dan hantu, efek (kabut, hujan, petir, lampu kedip), satu jumpscare di klimaks, dan efek suara. Durasi tiap scene diatur mengikuti waktu narasi di `.srt`.
2. Mengecek beberapa **frame diam** dulu supaya hantu kelihatan, teks tidak menabrak karakter, dan komposisi tidak kosong.
3. Me-render **MP4 1080×1920 (9:16), 30 fps**: animasi, voice over, ambience horor, efek suara, dan **subtitle yang sinkron dengan suara**. Subtitle diambil otomatis dari file `.srt` bernama sama di sebelah audionya. Render 60 detik video butuh sekitar 1–3 menit.

Yang bisa kamu minta:
- **Watermark** handle di pojok kanan atas: "pasang watermark @akunku"
- **Warna aksen** untuk kata penting dan aksesoris karakter: "aksennya hijau"
- **Musik latar** dari file sendiri: "tambahin musik musik.mp3"
- **Draft cepat** (540×960) untuk cek alur sebelum render penuh: "render draft dulu"
- Ganti adegan, misalnya "hantunya muncul di jendela aja" atau "jumpscare-nya pindah ke akhir"

### 5. Upload ke TikTok, Reels, dan Shorts

File MP4-nya sudah siap upload tanpa edit tambahan: 9:16, H.264 + AAC, dengan subtitle yang sudah menempel di video.

1. **Pindahkan ke HP**: lewat kabel USB, Google Drive for desktop, iCloud for Windows, atau aplikasi chat ke diri sendiri. Kalau kirim lewat aplikasi chat, pastikan dikirim sebagai file/dokumen supaya kualitasnya tidak turun.
2. **Upload** seperti biasa:
   - **TikTok**: tombol **+** → pilih video
   - **Instagram Reels**: tombol **+** → **Reel** → pilih video
   - **YouTube Shorts**: tombol **+** → **Upload video** → pilih video
3. **Caption dan hashtag** tinggal salin dari bagian `## Caption` di file naskah.
4. **Jangan nyalakan caption/subtitle otomatis** di aplikasinya. Subtitle sudah ada di video, jadi nanti teksnya dobel.
5. Pilih **cover** di frame yang paling seram (biasanya judul di awal atau sosok hantunya), bukan frame hitam.

### Tips

- Suara Gemini yang dibisikkan cukup lambat (±1,3 kata/detik), jadi naskah 90 kata bisa jadi ±80 detik video.
- Kalau VO belum bisa dibuat, minta Claude bikin videonya dulu dengan subtitle perkiraan. Setelah VO jadi, video tinggal di-render ulang dengan VO-nya.
- Folder hasil bisa diatur sendiri, misalnya `script/`, `voice/`, dan `video/` terpisah. Sebutkan saja ke Claude di awal.
- Konten dijaga seram, bukan sadis: tanpa darah, tanpa bunuh diri, dan tanpa nama orang nyata sebagai korban.

## Syarat untuk skill `voice`

- Node.js 18+ (tanpa `npm install`)
- **Satu take dan potongan (gratis):** ffmpeg. Untuk subtitle presisi di mode satu take, ffmpeg yang punya filter `whisper` plus model `ggml-base.bin` di `~/whisper-models/` (Claude menawarkan mengunduhnya).
- **Mode otomatis (API):** `GEMINI_API_KEY` dari https://aistudio.google.com/apikey (free tier cukup untuk 30 suara bawaan). Set sekali di terminal: `setx GEMINI_API_KEY "key-kamu"`, lalu buka ulang Claude Code. ffmpeg hanya untuk output `.mp3` dan kloning suara sendiri.

## Syarat untuk skill `anim`

Skill `script` tidak butuh apa-apa. Skill `anim` me-render video di komputermu, jadi perlu:

- Node.js 18+
- ffmpeg (ada di PATH)
- Chrome, Edge, atau Chromium (atau set `CHROME_PATH`)

Sekali saja setelah install, jalankan `npm install` di folder `skills/anim/scripts` plugin ini. Claude akan melakukannya sendiri kalau belum.
