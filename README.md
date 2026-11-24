# mysuf-horror

Plugin Claude Code untuk bikin konten horor pendek berbahasa Indonesia (TikTok, Reels, Shorts).

| Skill | Panggil | Fungsi |
|---|---|---|
| script | `/mysuf-horror:script` | Naskah horor 30–90 detik: hook, tabel per detik (VO, teks layar, visual, SFX), Script Voice Over bertag untuk Google AI Studio TTS + Style instructions, caption, hashtag. Hasil berupa file `.md`. |
| voice | `/mysuf-horror:voice` | Ubah Script Voice Over bertag jadi file narasi `.wav`/`.mp3` dengan Gemini TTS — manual lewat Google AI Studio (gratis, tanpa API key) atau otomatis lewat API: emosi per baris, jeda pas, suara napas, plus subtitle `.srt` sinkron yang otomatis di-burn oleh `anim --voice`. Bisa pakai suara sendiri (Gemini API paid tier). |
| anim | `/mysuf-horror:anim` | Render cerita horor jadi video animasi siluet 9:16 (MP4) lengkap dengan efek suara. |

Skill juga terpanggil otomatis kalau kamu minta, misalnya, "bikinin naskah tiktok horor 60 detik tentang pocong".

## Install

Di Claude Code:

```
/plugin marketplace add mysuf1020/mysuf-horror
/plugin install mysuf-horror@mysuf-horror
```

Update ke versi terbaru:

```
/plugin marketplace update mysuf-horror
```

## Syarat untuk skill `voice`

- Node.js 18+ (tanpa `npm install`)
- **Mode manual (default, gratis):** cukup ffmpeg. Skill memecah naskah jadi potongan siap tempel ke Google AI Studio → Generate Speech; kamu generate dan download tiap potongan, lalu skill menggabungkannya jadi satu narasi (jeda pas, volume seragam, plus subtitle).
- **Mode otomatis (API):** `GEMINI_API_KEY` dari https://aistudio.google.com/apikey (free tier cukup untuk 30 suara bawaan). Set sekali di terminal: `setx GEMINI_API_KEY "key-kamu"`, lalu buka ulang Claude Code. ffmpeg hanya untuk output `.mp3` dan kloning suara sendiri.

## Syarat untuk skill `anim`

Skill `script` tidak butuh apa-apa. Skill `anim` me-render video di komputermu, jadi perlu:

- Node.js 18+
- ffmpeg (ada di PATH)
- Chrome, Edge, atau Chromium (atau set `CHROME_PATH`)

Sekali saja setelah install, jalankan `npm install` di folder `skills/anim/scripts` plugin ini. Claude akan melakukannya sendiri kalau belum.
