---
name: voice
description: Mengubah naskah voice-over (VO) horor berbahasa Indonesia jadi file audio narasi (.wav/.mp3) memakai Gemini TTS — user cukup menempel Script Voice Over bertag ekspresi (<calm>, <whispering>, <gasp>, <short pause>, dst.) atau memberi file .md hasil skill script, lalu skill ini me-render suaranya per baris dengan emosi, jeda, dan suara napas, siap dipasang ke video lewat `anim --voice`. Bisa memakai 30 suara bawaan Gemini atau suara user sendiri (voice replication, Gemini API paid tier). Gunakan setiap kali user minta voice over, VO, narasi suara, TTS, "suarain naskah ini", "bikin audionya", "jadiin mp3", atau ingin memakai suaranya sendiri untuk narasi konten horor.
---

# voice (mysuf-horror)

Naskah VO masuk, file audio narasi keluar. User tidak perlu membuka Google AI Studio atau menyalin per baris: skrip `scripts/tts.mjs` membaca tag ekspresi, memecah naskah per emosi, memanggil Gemini TTS, menyisipkan jeda dengan durasi pasti, lalu menggabungkan semuanya jadi satu file.

Baca `references/suara-gemini.md` kalau user bertanya soal pilihan suara, kuota/biaya, atau ingin memakai suaranya sendiri.

## Syarat (cek sekali)

- **Node.js 18+**. Tidak ada `npm install`; skrip hanya memakai modul bawaan Node.
- **ffmpeg** di PATH, hanya untuk output `.mp3` dan untuk perintah `clone`. Output `.wav` jalan tanpa ffmpeg.
- **`GEMINI_API_KEY`** di environment. Kalau belum ada, skrip berhenti dengan pesan jelas. Jangan pernah meminta user menempel API key ke chat dan jangan menulis key ke file mana pun. Arahkan user:
  1. Buat key gratis di https://aistudio.google.com/apikey (login akun Google).
  2. Set sendiri di terminal, lalu buka ulang Claude Code:
     ```powershell
     setx GEMINI_API_KEY "key-kamu"
     ```
  Langganan aplikasi Gemini (Gemini Pro / Google AI Pro) **terpisah** dari Gemini API — langganan itu tidak memberi API key, tapi key gratis dari AI Studio sudah cukup untuk suara bawaan.

## Alur kerja

1. **Ambil naskah.**
   - User memberi path `.md` hasil skill `script` → pakai langsung. Skrip otomatis mengambil bagian `## Script Voice Over` dan `## Style instructions`.
   - User menempel teks VO di chat → simpan apa adanya ke `<slug>.vo.md` di folder kerja (slug dari kalimat pertama, huruf kecil bertanda hubung). Kalau user juga memberi style instructions, simpan dalam format:
     ```markdown
     ## Script Voice Over
     <calm> ...

     ## Style instructions
     Speak like ...
     ```
   - Jangan menulis ulang kata-kata naskah user. Yang boleh kamu lakukan hanya memperbaiki tag yang salah ketik dan memindahkan jeda ke baris sendiri.
2. **Pilih suara.** Default `Enceladus` (berdesah/breathy, cocok untuk cerita horor yang dibisikkan). Kalau user menyebut gender/karakter narator, pilih dari tabel di `references/suara-gemini.md` dan sebutkan pilihanmu. Kalau user sudah punya ID suara sendiri (`voice_...`), pakai itu.
3. **Dry run dulu** untuk melihat pembagian segmen dan peringatan tag tanpa memakai kuota:
   ```bash
   node "<skill>/scripts/tts.mjs" naskah.md --dry-run
   ```
   Kalau ada peringatan tag tak dikenal yang membuang kata penting, perbaiki tag di file lalu ulangi.
4. **Render:**
   ```bash
   node "<skill>/scripts/tts.mjs" naskah.md --out narasi.mp3 --voice Enceladus
   ```
   Opsi: `--out x.wav|x.mp3` (default `<nama>.vo.wav`), `--voice`, `--style "..."` (menimpa style dari file), `--model` (default `gemini-3.8-flash-tts`; `gemini-3.8-flash-lite-tts` lebih hemat), `--gap 0.2` (jeda antar-segmen tanpa tag jeda, detik), `--no-cache`.
   Jalankan di background kalau naskah panjang: tiap segmen satu request, dan skrip otomatis menunggu lalu mencoba lagi saat kena batas kuota (HTTP 429).
5. **Laporkan** path file, durasi, suara yang dipakai, dan jumlah segmen. Tawarkan langkah lanjut: pasang ke video dengan skill `anim` (`--voice narasi.mp3`), atau ganti suara/style kalau hasilnya kurang pas.

Kalau render gagal di tengah, segmen yang sudah jadi tersimpan di `.vo-cache/` di samping file output — jalankan ulang perintah yang sama dan hanya segmen yang belum jadi yang diminta ulang. Mengubah satu baris naskah juga hanya me-render ulang baris itu.

## Cara skrip membaca tag

Format tag mengikuti skill `script`, jadi naskah dari sana bisa langsung dipakai.

| Di naskah | Diperlakukan sebagai |
|---|---|
| `<short pause>` / `<medium pause>` / `<long pause>` di baris sendiri | Hening 0,5 / 1 / 1,75 dtk, disisipkan skrip (durasi pasti, bukan tebakan model) |
| Tag emosi/cara bicara di awal baris (`<calm>`, `<nervous>`, `<scared>`, `<trembling>`, `<whispering>`, `<slowly>`, ...) | Arahan `style` untuk baris itu, digabung dengan Style instructions. Tidak ikut terbaca. |
| Suara napas/vokal (`<gasp>`, `<sigh>`, `<inhale>`, `<exhale>`, `<sob>`, `<scream>`, `<whimper>`, ...) di mana saja | Tetap di teks; model mengeluarkan suaranya. `<inhale>`→`<breath>`, `<exhale>`→`<exhales>`, `<crying>`→`<cry>` diterjemahkan otomatis. |
| Tag lain di tengah kalimat | Dibuang dengan peringatan, supaya tidak terbaca sebagai kata. |

Baris berurutan dengan emosi yang sama digabung jadi satu request supaya intonasinya menyambung dan kuota hemat. Tiap pergantian emosi = request baru, sesuai saran dokumentasi Gemini ("split the script into separate turns with distinct style values").

## Suara sendiri (voice replication)

Bisa, dengan syarat project Gemini API **Paid Tier (Tier 1+)** — billing aktif di Google Cloud. Akun free tier ditolak. Detail dan cara rekam ada di `references/suara-gemini.md` bagian 3. Ringkasnya:

1. User merekam sendiri dua file dengan mic dan ruangan yang sama:
   - `sampel.wav`: 10–30 detik bicara natural dan jelas (mis. membacakan cerita dengan nada yang diinginkan).
   - `persetujuan.wav`: membacakan kalimat persetujuan bahasa Indonesia: "Saya pemilik suara ini dan saya menyetujui Google menggunakan suara ini untuk membuat model suara sintetis."
2. Jalankan:
   ```bash
   node "<skill>/scripts/tts.mjs" clone --source sampel.wav --consent persetujuan.wav --name "Suara Saya"
   ```
   File mp3/m4a juga diterima; skrip mengonversinya ke WAV 24 kHz mono dengan ffmpeg.
3. Simpan ID `voice_...` yang dicetak, lalu render dengan `--voice voice_...`.

Hanya bantu mengkloning suara milik user sendiri. Kalau user ingin mengkloning suara orang lain (artis, YouTuber, teman), tolak dan tawarkan suara bawaan yang mirip karakternya — Google juga mewajibkan rekaman persetujuan dari pemilik suara.

## Batas

- Output diberi watermark SynthID oleh Google (tidak terdengar).
- Di free tier, Google boleh memakai input untuk meningkatkan produknya; jangan kirim naskah berisi data pribadi.
- Kalau model melafalkan kata daerah/slang dengan aneh, tulis ejaannya sesuai bunyi di naskah (mis. "nggak", bukan "gak") lalu render ulang baris itu saja.
