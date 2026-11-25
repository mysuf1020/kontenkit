# Serial antologi bernomor

Format serial tanpa ujung: tiap episode cerita lepas (bisa ditonton tanpa episode lain), tapi kemasannya sama terus — judul bernomor, narator tetap, satu pantangan dan satu sosok dari satu daerah. Penonton datang karena penasaran nomor lain dan mau lihat daerahnya kebagian kapan; komentar ramai karena orang daerah lain nyeritain versi kampungnya.

Beda dengan serial bersambung (mis. `aturan-kos-00-seri.md`): di sini tidak ada cliffhanger antar-episode dan tidak ada episode terakhir.

## Pakai mode ini kalau

User minta "serial", "episode", "seri bernomor", "#1, #2...", "konten rutin", atau menyebut seri yang sudah ada di folder script (`<seri>-00-seri.md`).

## Identitas seri (tetapkan sekali, lalu jangan diubah)

Kalau seri baru, karang identitasnya dan tulis di file peta seri. Kalau sudah ada, baca file peta seri dan ikuti persis.

- **Nama seri + nomor.** Pola `[Nama Seri] #N: [judul pendek]`. Nama seri 2–3 kata, gampang diingat, bukan tiruan seri channel lain (contoh arah: "Larangan Daerah", "Pantangan Mbah Sastro"). Nomor selalu naik, tidak pernah diulang.
- **Satu narator tetap.** Sosok yang masuk akal tahu banyak pantangan dari banyak tempat: penjaga makam tua, sopir angkot/truk malam, juru kunci, dukun beranak pensiunan, kakek yang dulu perantau. Tulis di peta seri: siapa dia, cara bicaranya, satu kebiasaan khas (mis. selalu buka dengan menyebut jam), dan Style instructions-nya. Jangan pakai sosok "Bapak" atau "Kata Bapak" — terlalu mirip seri orang lain.
- **Pembuka tetap.** Satu kalimat pembuka berpola sama tiap episode, ≤9 kata, langsung berisi pantangannya (mis. "Di Kalimantan, jangan jemur baju waktu Maghrib."). Ini hook-nya; tetap tanpa salam.
- **Penutup tetap.** Satu kalimat pola sama yang memancing komentar daerah (mis. "Di kampungmu, pantangannya apa?"). Boleh variasi kata, polanya sama.

## Isi tiap episode

- **Satu daerah, satu pantangan, satu sosok yang benar-benar ada dalam cerita rakyat daerah itu**, disebut dengan nama aslinya: kuyang (Kalimantan), palasik (Minang), wewe gombel (Semarang), leak (Bali), welthok (Surabaya), parakang (Bugis), begu ganjang (Batak), dan seterusnya. Nama daerah setingkat provinsi/kota/suku, bukan nama desa, sekolah, atau RS sungguhan (lihat Batas konten di SKILL.md).
- **Pantangannya nyata** — yang memang diucapkan orang tua di daerah itu. Kalau ragu soal detail mitosnya, tulis versi yang umum dikenal dan jangan mengarang asal-usul yang terdengar seperti fakta.
- **Struktur beat** tetap seperti SKILL.md, dengan dua penyesuaian: hook = pembuka tetap; setup memperkenalkan daerah + sosok sebagai mitos ("Orang sana nyebutnya..."), lalu cerita pengalaman orang yang melanggar.
- **Durasi ikut standar SKILL.md: audio minimal 90 dtk** (115–135 kata VO, lihat langkah 3).
- **Teks layar besar dan pendek**: ≤5 kata per baris, huruf kapital, 1 kata kunci bertanda `*bintang*`. Tiap episode punya satu baris teks layar "tanda tangan" berisi pantangannya (mis. `JANGAN *JEMUR* BAJU`), supaya tetap kebaca walau suara dimatikan.
- **Judul file**: `<seri-slug>-NN.md` (dua digit, mis. `larangan-daerah-01.md`).

## Untuk skill anim

Engine anim sudah punya `kuyang`, `kuyang` + `variant: 'palasik'`, `leak`, `wewe` (wewe gombel), `begu` (begu ganjang), `welthok`, `pocong`, `genderuwo`, `ghost` (kuntilanak/burong). Sosok lain dipetakan ke tipe yang ada dan dibiarkan samar: bola cahaya terbang → `banaspati`; sosok tinggi/hitam → `shadow` atau `genderuwo`; perempuan → `ghost`; anak kecil → `tuyul`; tangan/rambut → `hand`/`hair`; atau cukup `eyes` dan bayangan (`cast.only`). Catat pemetaan yang dipakai di peta seri supaya sosok yang sama terlihat sama di episode berikutnya.

## File peta seri

Satu file `<seri-slug>-00-seri.md` di folder script. Buat saat episode #1 ditulis; perbarui setiap ada episode baru.

~~~markdown
# [Nama Seri] — peta seri

Serial antologi, audio ≥90 dtk per episode. Narator: [siapa, cara bicara, kebiasaan khas].
Pembuka tetap: "[pola]" · Penutup tetap: "[pola]"

## Style instructions (sama di semua episode)
```text
[...]
```

## Episode

| # | File | Daerah | Pantangan | Sosok | Tipe anim |
|---|---|---|---|---|---|
| 1 | larangan-daerah-01.md | ... | ... | ... | ... |

## Antrean ide
- [daerah — pantangan — sosok] (belum dipakai)
~~~

Aturan antrean: jangan ulang daerah dalam 5 episode berturut-turut, dan jangan pakai sosok yang sama dua kali kecuali dari daerah lain dengan nama lain. Kalau user minta "bikin 10 episode", isi antrean dulu, tulis naskahnya satu file per episode.

## Swa-periksa tambahan

- [ ] Judul, pembuka, penutup, dan narator cocok dengan peta seri?
- [ ] Daerah, pantangan, dan nama sosok disebut jelas di VO?
- [ ] Episode bisa dipahami tanpa nonton episode lain?
- [ ] Peta seri sudah diperbarui (baris episode + antrean)?
