# Panduan Ekspresi & Style — Google AI Studio (Generate Speech)

Mesin TTS di Google AI Studio bersifat *prompt-based*, jadi tidak ada daftar tertutup yang kaku. Namun, daftar tag `<...>` dan kombinasi *style* di bawah ini adalah yang paling stabil, natural, dan efektif dipahami oleh model.

---

## 1. Daftar Tag Ekspresi (`<...>`)

### Emosi & Perasaan
* `<happy>` / `<cheerful>` — senang, ceria
* `<excited>` — antusias, bersemangat
* `<sad>` — sedih
* `<angry>` / `<furious>` — marah
* `<scared>` / `<terrified>` — takut
* `<nervous>` / `<anxious>` — gugup, cemas
* `<shocked>` / `<surprised>` — kaget, terkejut
* `<calm>` — tenang
* `<serious>` — serius
* `<confused>` — bingung
* `<disgusted>` — jijik
* `<sarcastic>` — sarkas, menyindir
* `<tired>` / `<exhausted>` — lelah, capek
* `<bored>` — bosan
* `<trembling>` — gemetar (suara bergetar)
* `<crying>` / `<sobbing>` — menangis, terisak

### Volume, Tempo & Cara Bicara
* `<whispering>` — berbisik
* `<shouting>` / `<yelling>` — berteriak
* `<softly>` — pelan, lembut
* `<loudly>` — keras, lantang
* `<slowly>` — lambat
* `<fast>` / `<rushed>` — cepat, terburu-buru
* `<monotone>` — datar, tanpa emosi
* `<singing>` — bernyanyi

### Suara Non-Verbal & Napas
* `<sigh>` — menghela napas
* `<inhale>` — menarik napas
* `<exhale>` — mengembuskan napas
* `<gasp>` — terkesiap / kaget tarik napas
* `<laugh>` — tertawa
* `<chuckle>` — tertawa pelan / terkekeh
* `<giggle>` — cekikikan
* `<yawn>` — menguap
* `<cough>` — batuk
* `<clearing throat>` — berdehem
* `<sniffle>` — sesenggukan / menghirup ingus
* `<groan>` — mengerang

### Jeda (Pause)
* `<short pause>` — jeda singkat (~0.5 detik)
* `<medium pause>` — jeda sedang (~1 detik)
* `<long pause>` — jeda panjang (~1.5–2 detik)

---

## 2. Daftar Style (Kolom *Style Instructions*)

Gabungkan 4 elemen berikut di kolom **Style instructions** untuk hasil yang lebih spesifik: **Format/Persona**, **Tone/Mood**, **Pacing**, dan **Nuansa Audio**.

| Kategori | Contoh Style yang Efektif Dipakai |
| :--- | :--- |
| **Format / Persona** | `Podcast host`, `Horror storyteller`, `Audiobook narrator`, `News anchor`, `Documentary narrator`, `Movie trailer voice`, `Commercial / ad voiceover`, `ASMR`, `Casual friend chatting`, `Stand-up comedian`, `Customer support` |
| **Tone / Mood** | `Warm and friendly`, `Dark and ominous`, `Cold and emotionless`, `Suspenseful and eerie`, `Energetic and upbeat`, `Melancholic and somber`, `Authoritative and confident`, `Playful and witty`, `Frantic and panicked`, `Intimate and comforting` |
| **Pacing / Delivery** | `Slow and deliberate`, `Fast-paced and urgent`, `Conversational and unhurried`, `Crisp and articulate`, `Breathy and hushed`, `Dramatic with heavy pauses` |
| **Nuansa / Aksen** | `Close-mic whisper`, `Natural Indonesian accent`, `Slightly raspy voice`, `Deep and resonant`, `Soft and airy` |

---

## 3. Contoh Template *Style Instructions*

### Horor / Storytelling Malam
```text
Speak like a real Indonesian man recounting a personal, traumatic horror experience to a friend late at night. Keep the delivery conversational, grounded, and unhurried. Let the fear build naturally through slight hesitation, heavier breathing, and a trembling voice during the climax.
```

### Podcast Santai
```text
Warm and friendly podcast host speaking in a casual, conversational tone. Natural Indonesian accent, medium pacing, with light chuckles and relaxed pauses.
```

### Narator Dokumenter / Berita
```text
Authoritative, calm, and articulate documentary narrator. Deep and resonant voice, slow and deliberate pacing, maintaining a serious and informative mood.
```

---

## 4. Tips Penggunaan
* **Gunakan bahasa Inggris** untuk tag `<...>` dan kolom *Style instructions* meskipun skrip utamanya berbahasa Indonesia, karena model jauh lebih patuh pada instruksi bahasa Inggris.
* **Batasi 1–2 tag per kalimat** agar intonasi tetap natural dan tag tidak ikut terbaca sebagai teks.
* **Atur Temperature** di kisaran `1.0 – 1.2` untuk dinamika suara dan bisikan yang lebih ekspresif, atau turunkan ke `0.8 – 1.0` jika pelafalan mulai melenceng.