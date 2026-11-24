# mysuf-horror

Plugin Claude Code untuk bikin konten horor pendek berbahasa Indonesia (TikTok, Reels, Shorts).

| Skill | Panggil | Fungsi |
|---|---|---|
| script | `/mysuf-horror:script` | Naskah horor 30–90 detik: hook, tabel per detik (VO, teks layar, visual, SFX), Script Voice Over bertag untuk Google AI Studio TTS + Style instructions, caption, hashtag. Hasil berupa file `.md`. |
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

## Syarat untuk skill `anim`

Skill `script` tidak butuh apa-apa. Skill `anim` me-render video di komputermu, jadi perlu:

- Node.js 18+
- ffmpeg (ada di PATH)
- Chrome, Edge, atau Chromium (atau set `CHROME_PATH`)

Sekali saja setelah install, jalankan `npm install` di folder `skills/anim/scripts` plugin ini. Claude akan melakukannya sendiri kalau belum.
