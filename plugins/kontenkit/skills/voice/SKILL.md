---
name: voice
description: Mengubah naskah voice-over (VO) horor berbahasa Indonesia jadi file audio narasi (.wav/.mp3) — user cukup menempel Script Voice Over bertag ekspresi (<calm>, <whispering>, <gasp>, <short pause>, dst.) atau memberi file .md hasil skill script. Mode satu take (default, gratis tanpa API key): user menempel seluruh naskah ke Google AI Studio Generate Speech, lalu satu file audionya dirapikan (volume seragam, hening dipotong) dan diberi subtitle .srt yang sinkron lewat whisper; mode potongan memecah naskah jadi bagian siap tempel lalu menggabungkannya; mode otomatis me-render langsung lewat Gemini API. Hasilnya siap dipasang ke video lewat `anim --voice`. Bisa memakai 30 suara bawaan Gemini atau suara user sendiri (voice replication, Gemini API paid tier). Gunakan setiap kali user minta voice over, VO, narasi suara, TTS, "suarain naskah ini", "bikin audionya", "jadiin mp3", atau ingin memakai suaranya sendiri untuk narasi konten horor.
---

# voice (kontenkit)

Naskah VO masuk, file audio narasi keluar. Skrip `scripts/tts.mjs` membaca tag ekspresi, memecah naskah per emosi, menyisipkan jeda dengan durasi pasti, dan menggabungkan semuanya jadi satu file plus subtitle `.srt`. Ada tiga mode:

| Mode | Kapan | Butuh |
|---|---|---|
| **Satu take** (default) | User menempel seluruh Script Voice Over + Style instructions dari naskah ke Google AI Studio sekaligus, lalu memberi satu file audio. Paling sedikit langkah untuk user. | Node 18+, ffmpeg; model whisper untuk subtitle presisi |
| **Potongan** | User mau mengulang bagian tertentu saja, atau satu take terlalu panjang untuk AI Studio. | Node 18+, ffmpeg |
| **Otomatis (API)** | User minta langsung jadi tanpa copy-paste, atau sudah punya `GEMINI_API_KEY` dan memintanya. | Node 18+, `GEMINI_API_KEY`, ffmpeg untuk mp3 |

Pakai mode satu take kecuali user meminta potongan atau API. Baca `references/suara-gemini.md` kalau user bertanya soal pilihan suara, kuota/biaya, atau ingin memakai suaranya sendiri.

## Mode satu take (Google AI Studio, gratis)

1. **User generate** di https://aistudio.google.com → **Generate Speech**: tempel isi bagian `## Style instructions` ke kolom Style instructions dan seluruh `## Script Voice Over` ke kolom teks, pilih suara (default `Enceladus`), Run, lalu download. Kalau user bertanya caranya, jelaskan ini; tidak perlu menyalin naskahnya ke chat karena sudah ada di file `.md`.
2. **Rapikan + subtitle** dengan satu perintah:
   ```bash
   node "<skill>/scripts/tts.mjs" align naskah.md take.wav [--out <slug>.vo.wav]
   ```
   Hasil default: `<slug>.vo.wav` + `<slug>.vo.srt` di folder take (nama dari naskah). Take asli tidak ditimpa. Hening di awal/akhir dipotong dan volume diseragamkan seperti `stitch`. Untuk subtitle, whisper (filter ffmpeg) mendengarkan audio, tiap baris naskah dicocokkan dengan kata yang tertangkap, lalu batas baris ditempel ke jeda hening terdekat. Teks subtitle selalu dari naskah, bukan dari whisper.
3. **Laporkan** path audio dan SRT, durasi, dan baris `Timing:` dari output (berapa awal baris yang terkunci whisper). Sebutkan bahwa SRT bisa diedit tangan kalau ada baris yang terasa meleset.

**Model whisper.** Default `~/whisper-models/ggml-base.bin` (atau `--whisper-model`, atau env `WHISPER_MODEL`); butuh ffmpeg yang punya filter `whisper` (`ffmpeg -filters | findstr whisper`). Kalau model belum ada, `align` tetap jalan dengan perkiraan dari panjang teks dan jeda, dan mencetak peringatan. Untuk subtitle presisi, **minta izin user dulu** sebelum mengunduh `ggml-base.bin` (±148 MB) dari `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin` ke `~/whisper-models/`.

Batas: whisper base sering salah dengar suara berbisik, jadi kata yang sangat pendek ("Dua.", "Sepi.") kadang tidak terkunci dan memakai perkiraan, yang bisa meleset ±1–2 detik. Kalau user butuh setiap baris pasti, pakai mode potongan.

## Mode potongan (Google AI Studio, gratis)

1. **Ambil naskah** sama seperti mode otomatis (langkah 1 di bawah).
2. **Siapkan potongan:**
   ```bash
   node "<skill>/scripts/tts.mjs" prep naskah.md --voice Enceladus
   ```
   Hasilnya folder `<naskah>-vo/` berisi `potongan.md` (petunjuk + potongan siap tempel) dan `rencana.json` (urutan, jeda, teks untuk subtitle). Naskah dipecah di jeda sedang/panjang dan maksimal ±45 kata per potongan, jadi naskah 60 detik biasanya 3–5 potongan. Tag emosi pindah ke Style instructions tiap potongan (termasuk di kalimat mana emosinya berganti), dan teks hanya menyisakan tag yang dipahami AI Studio.
3. **Tampilkan potongan ke user di chat** — isi `potongan.md` apa adanya (Style instructions dan Teks dalam blok kode supaya gampang disalin), plus nama file yang harus dipakai saat menyimpan (`01.wav`, `02.wav`, ...) dan path foldernya. User mungkin membuka sesi dari HP, jadi jangan hanya menyebut path file.
4. **Tunggu user** generate dan download semua potongan ke folder itu. Nama boleh `01.wav`, `01 take2.mp3`, dst. — yang penting diawali nomor potongan. Kalau user menyimpan di tempat lain (mis. Downloads dengan nama acak), berikan path-nya berurutan ke perintah stitch.
5. **Gabungkan:**
   ```bash
   node "<skill>/scripts/tts.mjs" stitch "<naskah>-vo" [--out narasi.mp3]
   # atau dengan file eksplisit, berurutan:
   node "<skill>/scripts/tts.mjs" stitch "<naskah>-vo" "C:/Users/.../Downloads/a.wav" "C:/Users/.../Downloads/b.wav" ...
   ```
   Tiap take: hening di awal/akhir dipotong, volume diseragamkan (loudnorm per take), lalu disambung dengan jeda dari naskah (`--gap 0.4` untuk sambungan tanpa tag jeda). Format apa pun yang dibaca ffmpeg diterima (wav, mp3, m4a, ogg). Hasil default `<folder>/narasi.mp3` + `narasi.srt`.
6. **Laporkan** path audio dan SRT serta durasinya. Kalau satu potongan kurang pas, user cukup generate ulang potongan itu, timpa filenya, lalu jalankan stitch lagi.

## Mode otomatis (Gemini API)

### Syarat (cek sekali)

- **Node.js 18+**. Tidak ada `npm install`; skrip hanya memakai modul bawaan Node.
- **ffmpeg** di PATH, hanya untuk output `.mp3` dan untuk perintah `clone`. Output `.wav` jalan tanpa ffmpeg.
- **`GEMINI_API_KEY`** di environment. Kalau belum ada, skrip berhenti dengan pesan jelas. Jangan pernah meminta user menempel API key ke chat dan jangan menulis key ke file mana pun. Arahkan user:
  1. Buat key gratis di https://aistudio.google.com/apikey (login akun Google).
  2. Set sendiri di terminal, lalu buka ulang Claude Code:
     ```powershell
     setx GEMINI_API_KEY "key-kamu"
     ```
  Langganan aplikasi Gemini (Gemini Pro / Google AI Pro) **terpisah** dari Gemini API — langganan itu tidak memberi API key, tapi key gratis dari AI Studio sudah cukup untuk suara bawaan.

### Alur kerja

1. **Ambil naskah** (berlaku juga untuk mode satu take dan potongan).
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
   Selain audio, skrip selalu menulis **subtitle `.srt`** bernama sama di sebelahnya (`narasi.mp3` → `narasi.srt`): tag dan suara napas dibuang, tiap baris naskah dipecah jadi potongan ≤7 kata. Awal-akhir tiap segmen diukur dari audio aslinya; pembagian waktu antar-baris di dalam satu segmen (baris berurutan dengan emosi sama) diperkirakan dari panjang teks. SRT ini bisa diedit tangan, dan juga bisa diunggah langsung sebagai subtitle ke YouTube/TikTok.
5. **Laporkan** path audio dan SRT, durasi, suara yang dipakai, dan jumlah segmen. Tawarkan langkah lanjut: pasang ke video dengan skill `anim` (`--voice narasi.mp3` — SRT di sebelahnya otomatis jadi subtitle), atau ganti suara/style kalau hasilnya kurang pas.

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
