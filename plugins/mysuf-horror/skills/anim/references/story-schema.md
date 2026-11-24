# Story schema

File story adalah JavaScript yang meng-assign satu objek data:

```js
window.STORY = {
  tag: 'Kisah Horor',        // label kiri-atas (opsional)
  watermark: '@akunmu',      // teks kanan-atas (opsional)
  accent: '#c4161c',         // warna aksen: kata *penting*, aksesoris karakter, garis judul
  tone: 'blue',              // tone default semua scene
  grain: 0.07,               // intensitas film grain (0–0.15)
  scenes: [ /* scene... */ ],
};
```

Hanya data (tanpa fungsi). Koordinat memakai kanvas logis **1080 × 1920**. `x` boleh pecahan 0–1 (lebar layar) atau piksel. Garis tanah karakter: `y = 1350`.

## Scene

| Field | Tipe | Keterangan |
|---|---|---|
| `dur` | detik | **wajib**. Panjang scene. |
| `bg` | string | Latar (lihat tabel). Default `black`. |
| `tone` | string | `blue` (malam), `green` (mistis/kuburan), `red` (bahaya), `purple` (gaib), `amber` (lampu jalan/senja). |
| `moon` | bool | `false` untuk menyembunyikan bulan di latar luar ruangan. |
| `seed` | angka | Ganti untuk variasi susunan pohon/nisan pada latar yang sama. |
| `caption` | string | Teks narasi, muncul per kata. `*kata*` atau `*beberapa kata*` = warna aksen. |
| `captionPos` | `bottom` \| `center` \| `top` | Default `bottom`. Pakai `center` di latar `black`. |
| `captionAt` | detik | Kapan kata pertama muncul. Default 0.25. |
| `captionSpeed` | kata/detik | Default 3.2. |
| `captionSize` | px | Default 66. |
| `title` / `subtitle` | string | Kartu judul besar di tengah (biasanya scene pertama, `bg: 'black'`). |
| `chars` | array | Karakter (lihat bawah). Digambar sesuai urutan — yang terakhir paling depan. |
| `fx` | array | Efek (lihat bawah). |
| `camera` | `{zoom:[a,b], pan:[a,b], focus:[x,y]}` | Zoom dari a ke b selama scene (default `[1,1.06]`). `pan` dalam pecahan lebar, positif = kamera geser ke kanan. `focus` (px logis) = titik yang digiring ke tengah layar sambil zoom, mis. spion `[585, 384]` di `busfront`, pojok belakang angkot `[380, 1100]`. |
| `lightning` | array detik | Waktu kilat (otomatis + suara guntur). |
| `scare` | `{at, type, dur}` | Jumpscare layar penuh. `type`: `face` (wajah pucat) atau `ghost` (kuntilanak menerjang). `dur` default 0.7. Otomatis + suara hantaman. |
| `sfx` | array `{type, at, dur?}` | Efek suara tambahan (lihat bawah). |
| `cut` | bool | Masuk tanpa fade (potongan keras). Bagus tepat sesudah jumpscare. |
| `fadeIn` / `fadeOut` | detik | Default 0.35. |

### Field khusus latar
- `house`: `litWindow` (0–3 jendela yang menyala, `-1` = semua gelap; default 0), `windowColor: 'red'`, `windowFigure: true` (siluet orang di jendela menyala). 0 = kiri-atas, 1 = kanan-atas, 2 = kiri-bawah, 3 = loteng.
- `corridor`: `flickerLamp` (0 = jauh, 1 = tengah, 2 = dekat; default 1).
- `road`: `roadMove: true` = marka jalan bergerak (kesan berkendara).

## Latar (`bg`)

| Nama | Isi | Cocok untuk |
|---|---|---|
| `black` | hitam polos | judul, penutup, mata menyala, ketegangan |
| `forest` | hutan pohon mati, bulan, kabut tipis | tersesat, suara dari hutan |
| `house` | rumah tua 2 lantai, pagar, pohon kering | rumah kosong, jendela menyala |
| `graveyard` | pohon beringin + akar gantung, nisan | pocong, kuburan, ziarah malam |
| `corridor` | lorong perspektif, lampu neon kedip, pintu di ujung | sekolah/rumah sakit/kos |
| `room` | kamar: jendela berbulan, pintu terbuka sedikit, ranjang | ketukan, sosok di pintu |
| `road` | jalan malam, tiang lampu | pulang malam, jalan sepi |
| `bus` | interior bus malam dari depan: lorong, kursi bersarung jok, penumpang tidur, gorden, bagasi di rak, pegangan tangan bergoyang, lampu LED lantai, cahaya lampu jalan lewat jendela, getaran mesin | bus/angkot/kereta malam |
| `busfront` | kabin sopir dari belakang (setir kanan): sopir memegang setir, kaca depan ke jalan malam, tiang lampu lewat, papan trayek LED, spion tengah dengan tasbih bergoyang, pintu & tiang pegangan di kiri | adegan sopir bus **atau angkot** (`routeSign: ''`), berhenti/mengerem |
| `angkot` | interior angkot dari belakang sopir: dua bangku vinyl merah berhadapan, penumpang duduk menghadap tengah, jendela kecil, satu lampu neon, pintu belakang terbuka ke jalan yang menjauh | angkot/mikrolet/elf malam |

Field khusus `angkot`: `passengers` (0–5 penumpang duduk, default 2), `passEvery` (sapuan lampu jalan; bayangan penumpang di lantai ikut bergerak — hantu tidak punya bayangan), `roadMove: false`, `brake: true`. Hantu "duduk di pojok belakang": `{type:'ghost', x: 0.3, y: 1235, size: 0.36}` (bangku kiri, bukan di ambang pintu).

Field khusus `bus`: `passEvery` (detik antar sapuan lampu jalan, default 2.6; `0` = mati), `castShadows: true` (karakter `person` punya bayangan di lantai yang bergerak ikut lampu; hantu tidak — pas untuk adegan "bayangannya tidak ada"), `passengers` (jumlah kepala penumpang tidur di kursi, default 6; `0` = bus kosong), `brake: true` (pegangan tangan tersentak). Kursi panjang belakang ada di `y ≈ 1035`; karakter di lorong pakai `x: 0.5`, `y` 1100–1500, `size` 0.3 (belakang) sampai 0.85 (depan).

Field khusus `busfront`: `routeSign` (teks papan trayek, default `BANYUWANGI - SURABAYA`), `mirrorFigure: true` (wajah pucat muncul di spion), `brake: true` (bus melambat sampai berhenti + tasbih tersentak; pasangkan dengan `fx: ['shake']`), `roadMove: false` (bus diam), `driver: false` (kursi sopir kosong), `routeSign: ''` (tanpa papan trayek — untuk angkot), `ghostHand: true` + `ghostHandAt` (detik) = tangan pucat terulur dari belakang menyodorkan uang lama ke sopir (nilai negatif = sudah terulur sejak awal scene). Kondektur berdiri di pintu: `{type:'person', role:'conductor', x: 0.14, y: 1700, size: 0.95}`.

## Karakter (`chars[]`)

Field umum:

| Field | Keterangan |
|---|---|
| `type` | `person`, `ghost` (kuntilanak), `pocong`, `shadow` (sosok tinggi kurus), `eyes` (sepasang mata menyala), `bus` (bus tampak samping), `angkot` (angkot tampak samping), `money` (uang kertas lama) |
| `x` | posisi horizontal (0–1). |
| `to` | posisi akhir; karakter bergerak dari `x` ke `to` selama jendela tampilnya. |
| `y` | garis kaki (default 1350; `eyes` default 900). Lebih kecil = lebih jauh/tinggi. |
| `size` | skala (default 1 ≈ 520 px tinggi orang). 0.5–0.8 untuk “di kejauhan”. |
| `face` | `1` hadap kanan, `-1` hadap kiri. Default mengikuti arah gerak. |
| `in` / `out` | detik dalam scene kapan muncul/hilang. |
| `appear` | `cut` (default), `fade`, `flicker` (berkedip-kedip saat muncul — paling seram untuk hantu). |
| `alpha` | transparansi 0–1. |
| `action` | lihat per tipe. `approach` berlaku untuk semua: mendekat ke kamera, membesar sampai `grow` (default 1.8). |

Per tipe:
- **person** — `action`: `idle`, `walk`, `run` (pakai `to`), `tremble` (gemetar), `look` (kepala menoleh). `accessory`: `scarf`, `bag`, `cap`, `lantern` (cahaya hangat), `flashlight` (sorot senter ke arah hadap; `flicker: true` = senter kedip). `hair: 'long'`. `color` = warna aksesoris (default aksen). `role: 'conductor'` = kondektur bus (seragam biru, topi pet, handuk di bahu, tas uang selempang, kipas uang kertas di tangan) — jangan dipadukan dengan `accessory`.
- **ghost** — kuntilanak melayang tanpa kaki: gaun putih compang-camping tembus pandang, rambut basah menjuntai menutupi wajah pucat, kepala miring, tangan panjang berkuku. `eyes: false` menyembunyikan mata merah, `reach: true` = kedua tangan terulur ke depan (cocok saat klimaks/`approach`).
- **pocong** — `action: 'hop'` melompat di tempat; dengan `to` melompat berpindah.
- **shadow** — sosok bayangan tinggi; `eyes: false`, `color` warna mata.
- **bus** — bus malam tampak samping, menghadap kanan, roda di `y` (pakai ±1420 di latar `road`). Dengan `to` = melaju (roda berputar). `passenger` (0–7) = siluet penumpang di jendela ke-n. `dark: true` = lampu kabin & lampu depan mati.
- **angkot** — angkot tampak samping menghadap kanan (biru, strip kuning, pintu geser terbuka), roda di `y` (±1420 di `road`). `to` = melaju, `color` = warna cat, `label` = kode trayek (default `T19`), `passenger` = siluet penumpang di jendela, `dark: true` = lampu mati.
- **money** — uang kertas lama bernoda, digambar di tengah `(x, y)` (pakai `y` ±900). `value` (default `100`), `label` (`RUPIAH`), `year` (`TAHUN 1968`).
- **eyes** — `color` (default kuning; merah `#ff3b30` lebih mengancam), berkedip tiap 3.2 dtk, `blinkOffset` untuk beberapa pasang mata.

## Efek (`fx`)

| Efek | Hasil |
|---|---|
| `fog` | kabut bergerak di depan & belakang karakter (`fogAmount` 0–1.5) |
| `rain` | hujan |
| `dust` | debu melayang |
| `flicker` | layar tiba-tiba menggelap sesaat; jendela/lampu ikut kedip |
| `shake` | kamera bergetar |
| `glitch` | potongan gambar bergeser sesekali |
| `red` | tint merah |
| `heartbeat` | vignette berdenyut merah + suara detak jantung |

## Suara

Otomatis untuk setiap video: drone ambience rendah + noise. Otomatis per scene: `scare` → hantaman, `lightning` → guntur, `fx: heartbeat` → detak jantung.

`sfx` manual: `sting` (gesekan nada tinggi, cocok untuk judul/reveal), `knock` (3 ketukan), `whisper` (desis bisikan), `creak` (derit pintu), `hit`, `thunder`, `heartbeat` (pakai `dur`).
