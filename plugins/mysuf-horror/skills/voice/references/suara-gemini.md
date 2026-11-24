# Gemini TTS — suara, kuota, dan suara sendiri

Sumber: dokumentasi Gemini API (aistudio.google.com/docs/speech-generation, /docs/pricing, /docs/voice-replication), dicek November 2026. Harga dan model bisa berubah; cek ulang halaman itu kalau ada yang terasa beda.

## 1. Suara bawaan (30)

Semua suara bisa berbahasa Indonesia. Untuk horor, coba yang ditandai ★ dulu.

| Suara | Karakter | Catatan untuk horor |
|---|---|---|
| ★ Enceladus | Breathy | Default skill ini. Napas terdengar, enak untuk bisikan. |
| ★ Algenib | Gravelly | Serak, cocok narator laki-laki dewasa / bapak-bapak ronda. |
| ★ Charon | Informative | Tenang dan dalam, cocok gaya dokumenter misteri. |
| ★ Achernar | Soft | Lembut, cocok narator perempuan berbisik. |
| ★ Gacrux | Mature | Suara dewasa, cocok nenek/ibu bercerita mitos. |
| ★ Vindemiatrix | Gentle | Lembut dan pelan. |
| Zephyr | Bright | |
| Puck | Upbeat | |
| Kore | Firm | |
| Fenrir | Excitable | Untuk narator yang panik. |
| Leda | Youthful | Narator remaja/anak kos. |
| Orus | Firm | |
| Aoede | Breezy | |
| Callirrhoe | Easy-going | |
| Autonoe | Bright | |
| Iapetus | Clear | |
| Umbriel | Easy-going | |
| Algieba | Smooth | |
| Despina | Smooth | |
| Erinome | Clear | |
| Rasalgethi | Informative | |
| Laomedeia | Upbeat | |
| Alnilam | Firm | |
| Schedar | Even | |
| Pulcherrima | Forward | |
| Achird | Friendly | |
| Zubenelgenubi | Casual | Gaya ngobrol santai. |
| Sadachbia | Lively | |
| Sadaltager | Knowledgeable | |
| Sulafat | Warm | |

Cara cepat membandingkan: buat naskah 2–3 baris, lalu render dengan beberapa `--voice` berbeda ke file berbeda.

## 2. Model, kuota, biaya

| Model | Free tier | Harga paid (per 1 juta token, s.d. 31 Des 2026) |
|---|---|---|
| `gemini-3.8-flash-tts` (default) | Ya | input $0,50 · output audio $9,00 |
| `gemini-3.8-flash-lite-tts` | Ya | input $0,50 · output audio $6,00 |
| `gemini-2.5-pro-preview-tts` | Tidak | input $1,00 · output audio $20,00 |

- Audio dihitung 25 token per detik, jadi VO 60 detik ≈ 1.500 token output ≈ $0,014 di paid tier.
- Batas request per menit/hari free tier tidak dicantumkan di dokumentasi untuk model TTS; lihat angka untuk akunmu di https://aistudio.google.com/rate-limit. Kuota harian reset tengah malam waktu Pasifik (±14.00–15.00 WIB).
- Mulai 1 Jan 2027 harga paid model 3.8 naik dua kali lipat.
- Langganan aplikasi Gemini (Google AI Pro / Gemini Advanced) tidak sama dengan Gemini API dan tidak menambah kuota API.

## 3. Memakai suara sendiri (voice replication)

**Syarat:** project Gemini API Paid Tier (Tier 1 ke atas = billing Google Cloud aktif). Tidak perlu daftar allowlist; tersedia di semua wilayah yang didukung Gemini API. Model yang mendukung: `gemini-3.8-flash-tts` dan `gemini-3.8-flash-lite-tts`. Tidak ada biaya tambahan untuk membuat suara; render dibayar dengan tarif TTS biasa.

**Rekaman yang dibutuhkan** (orang yang sama, dewasa, mic dan ruangan yang sama):

1. **Sampel suara** — 10–30 detik ucapan natural yang bersih (tanpa musik, tanpa gema, tanpa noise kipas). Bicara dengan gaya yang ingin dipakai di narasi.
2. **Rekaman persetujuan** — membacakan persis kalimat ini (versi id-ID dari dokumentasi):

   > Saya pemilik suara ini dan saya menyetujui Google menggunakan suara ini untuk membuat model suara sintetis.

Audio hasil TTS lain atau yang sudah ber-watermark SynthID/C2PA ditolak.

**Tips rekam:** pakai mic headset atau HP didekatkan ±15 cm, di kamar dengan kasur/lemari baju (meredam gema), simpan sebagai WAV atau m4a kualitas tertinggi.

**Hasil:** ID `voice_...` disimpan Google untuk project itu, berlaku 1 tahun sejak terakhir dipakai, maksimal 200 suara per project. Hapus kapan saja lewat `DELETE https://generativelanguage.googleapis.com/v1beta/voices/<id>`.

## 4. Alternatif kalau tidak mau paid tier

- **Rekam sendiri langsung** — paling natural. Rekam per baris naskah, lalu pasang file rekaman ke `anim --voice`.
- **Suara bawaan yang mirip** — pilih dari tabel di atas yang karakternya paling dekat dengan suaramu.
