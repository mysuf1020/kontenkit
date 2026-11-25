---
name: anim
description: Bikin video animasi horor pendek 9:16 berbahasa Indonesia (±90 detik, mengikuti VO) bergaya ilustrasi sinematik — karakter berwarna dengan wajah jelas (sopir truk, kakek, nenek, ibu, bayi, anjing), latar malam (hutan, rumah tua, kuburan, lorong, kamar, jalan, sungai Kalimantan, rumah panggung, kabin truk, gang kampung, sawah, kebun bambu, sumur tua), color grade horor, kabut, petir, hantu (kuntilanak, pocong, kuyang, palasik, leak, wewe gombel, begu ganjang, welthok, sosok bayangan, mata menyala), teks narasi muncul per kata, jumpscare, dan suara horor sintetis — lalu di-render jadi MP4 siap upload Reels/TikTok/Shorts. Use when the user asks for a horror / creepy / misteri / urban legend / cerita seram / kisah hantu animated video, short, reel, or TikTok, or wants to turn a horror story into an animation.
---

# anim (kontenkit)

Mengubah ide cerita horor menjadi video MP4 9:16 lewat tiga tahap: **naskah → file story → render**.
Engine menggambar semuanya dengan kode (canvas di Chrome headless), jadi tidak perlu aset gambar.

Base directory skill ini (tempat SKILL.md berada) berisi:
- `scripts/render.mjs` — renderer (butuh `npm install` sekali di `scripts/`)
- `engine/engine.js` — engine gambar; jangan diubah untuk satu video, cukup tulis file story
- `references/story-schema.md` — **semua** opsi scene, latar, karakter, efek, dan suara. Baca sebelum menulis story.
- `references/horror-writing.md` — struktur cerita, hook, dan aturan teks. Baca sebelum menulis naskah.
- `examples/rumah-kosong.js` — contoh story lengkap yang sudah teruji

## Prasyarat (cek sekali per sesi)

```bash
node -v        # >= 18
ffmpeg -version
```
Chrome, Edge, atau Chromium harus terpasang (atau set `CHROME_PATH`).
Kalau `scripts/node_modules` belum ada: `cd <skill-dir>/scripts && npm install`.

## Alur kerja

1. **Pahami permintaan.** Topik/legenda, durasi (ikut audio VO; standar naskah sekarang minimal 90 detik), handle untuk watermark, warna aksen. Kalau user hanya memberi tema ("bikin video horor tentang pocong"), langsung karang ceritanya — jangan bertanya berlebihan.
2. **Tulis naskah dulu** mengikuti `references/horror-writing.md`: 7–10 scene, satu kalimat pendek per scene. Tampilkan naskahnya ke user secara ringkas (daftar scene + teks) lalu lanjut — tidak perlu menunggu persetujuan kecuali user minta.
3. **Tulis file story** `<folder-kerja>/<slug>.js` (bentuk `window.STORY = {...}`) sesuai `references/story-schema.md`. Pilih latar/karakter/efek yang mendukung tiap kalimat.
4. **Cek visual dengan stills** sebelum render penuh:
   ```bash
   node <skill-dir>/scripts/render.mjs <slug>.js --stills 2,8,15,22,30,40
   ```
   Pilih detik di tengah tiap scene (bukan di awal/akhir — ada fade hitam 0.35 dtk). Buka PNG-nya (Read) dan periksa: teks terbaca dan tidak menabrak karakter, karakter terlihat (tidak tertutup kabut/gelap), komposisi tidak kosong. Perbaiki story lalu ulangi bila perlu. Hapus PNG stills setelah selesai.
5. **Render penuh:**
   ```bash
   node <skill-dir>/scripts/render.mjs <slug>.js            # 1080x1920 30fps + audio
   node <skill-dir>/scripts/render.mjs <slug>.js --draft    # 540x960 24fps, cepat untuk cek alur
   ```
   Render penuh ±1–3 menit untuk 60 detik video. Jalankan di background bila tool mendukung.
   Opsi: `--voice narasi.mp3` (voice-over, ambience otomatis dikecilkan), `--music musik.mp3`, `--no-audio`, `--out nama.mp4`, `--subs narasi.srt`, `--no-subs`, `--keep-captions`.

   **Subtitle VO.** Kalau `--voice` dipakai dan ada file `.srt` bernama sama di sebelah audionya (skill `voice` membuatnya otomatis: `x.vo.wav` → `x.vo.srt`), subtitle yang sinkron dengan suara ikut di-burn ke video. Teks `caption` per scene otomatis disembunyikan supaya tidak dobel (`--keep-captions` untuk tetap menampilkannya, `--no-subs` untuk mematikan subtitle). `--subs file.srt` memakai SRT lain, termasuk yang diedit tangan; `*kata*` di SRT jadi warna aksen.
   Saat membuat video dari VO yang sudah ada, baca `.srt`-nya dulu dan atur `dur` tiap scene mengikuti waktu narasinya, dengan total durasi story ≥ akhir baris SRT terakhir + ±1,5 dtk. Renderer memberi peringatan kalau narasi lebih panjang dari story.
6. **Verifikasi hasil:** cek durasi dengan `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>.mp4`, lalu ambil 1–2 frame (`ffmpeg -ss 20 -i <file>.mp4 -frames:v 1 cek.png`) untuk memastikan render tidak rusak. Kalau pakai subtitle, ambil frame di tengah salah satu baris SRT dan pastikan teksnya muncul.
7. **Laporkan** path MP4, durasi, dan naskah final. Sarankan voice-over (rekam sendiri / TTS) bila user ingin narasi suara — renderer hanya membuat ambience dan efek suara, bukan suara manusia.

## Aturan penting

- Semua teks di layar berbahasa Indonesia santai; maksimal ±14 kata per scene. Tandai 1–3 kata kunci dengan `*bintang*` (jadi warna aksen).
- Durasi scene ≥ (jumlah kata ÷ 3.2) + 1.5 detik supaya teks sempat terbaca.
- Maksimal **satu** jumpscare per video, letakkan di klimaks (±70–85% durasi), bukan di detik awal.
- Variasikan latar dan kamera: jangan lebih dari 2 scene berturut-turut dengan latar + zoom yang sama.
- Jaga konten: seram, bukan sadis. Tanpa darah/gore eksplisit, tanpa bunuh diri, tanpa nama orang nyata sebagai korban, dan jangan klaim kejadian fiktif sebagai berita nyata.
- Kalau engine melempar error (`unknown bg`, `unknown character type`, `unknown sfx`), perbaiki story — jangan ubah engine untuk mengakalinya. Ubah engine hanya kalau user minta elemen visual baru, dan uji dengan stills setelahnya.
