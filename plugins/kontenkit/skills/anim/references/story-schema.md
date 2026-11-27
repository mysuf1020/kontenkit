# Story schema

File story adalah JavaScript yang meng-assign satu objek data:

```js
window.STORY = {
  tag: 'Kisah Horor',        // label kiri-atas (opsional)
  watermark: '@akunmu',      // teks kanan-atas (opsional)
  accent: '#c4161c',         // warna aksen: kata *penting*, aksesoris karakter, garis judul
  tone: 'blue',              // tone default semua scene
  grain: 0.07,               // intensitas film grain (0–0.15)
  grade: true,               // color grade horor (pudar, dingin, vignette pekat) — hanya di scene horor; false = matikan.
  puppets: ['../puppets'],   // opsional: folder puppet (relatif ke file story), lihat puppets.md
  backgrounds: ['../aset/bg'],  // opsional: folder latar gambar (dicari sampai ke subfolder)
  scenes: [ /* scene... */ ],
};
```

**Latar gambar.** Kalau `backgrounds` diisi, `bg` sebuah scene boleh berupa nama file gambar di folder itu tanpa ekstensi (mis. `bg: 'koridor-gedung-c'` untuk `koridor-gedung-c.png`). Gambar ditarik penuh (cover) ke 1080×1920, rata bawah. Pakai gambar potret 9:16 yang lantainya mengisi ±35% bawah, karena garis kaki karakter ada di `y = 1350`. Nama yang tidak ditemukan sebagai file tetap dicari di latar bawaan di bawah. Gambar tidak diwarnai ulang per tone, jadi pakai versi gambar yang sesuai waktunya (mis. `warung-siang`). Kalau scene-nya siang/aman, isi `horror: false`.

Hanya data (tanpa fungsi). Koordinat memakai kanvas logis **1080 × 1920**. `x` boleh pecahan 0–1 (lebar layar) atau piksel. Garis tanah karakter: `y = 1350`.

## Scene

| Field | Tipe | Keterangan |
|---|---|---|
| `dur` | detik | **wajib**. Panjang scene. |
| `bg` | string | Latar (lihat tabel). Default `black`. |
| `tone` | string | `blue` (malam), `green` (mistis/kuburan), `red` (bahaya — lebih baik biarkan cahaya hantu yang memerahkan), `purple` (gaib), `amber` (lampu jalan/senja), `dawn` (fajar: langit pink-biru, lega setelah teror). |
| `horror` | bool | Scene horor = color grade horor + vignette pekat. Otomatis `true` kalau scene memuat hantu (`ghost`, `pocong`, `kuyang`, `leak`, `wewe`, `begu`, `welthok`, `hand`, `hair`, `shadow`, `eyes`, dll.), `scare`, `tone: 'red'` atau `heartbeat`. Manusia selalu digambar natural; isi `true` untuk scene tanpa hantu yang tetap harus mencekam (mis. bukti yang tertinggal). |
| `moon` | bool | `{x, y, r}` | `false` menyembunyikan bulan; objek memindah/mengubah ukurannya (default 790, 360, r 64). Variasikan antar scene supaya tidak berulang. |
| `seed` | angka | Ganti untuk variasi susunan pohon/nisan pada latar yang sama. |
| `caption` | string | Teks narasi, muncul per kata. `*kata*` atau `*beberapa kata*` = warna aksen. Disembunyikan saat video memakai subtitle VO (`.srt`), kecuali render diberi `--keep-captions`. |
| `captionPos` | `bottom` \| `center` \| `top` | Default `bottom`. Pakai `center` di latar `black`. |
| `captionAt` | detik | Kapan kata pertama muncul. Default 0.25. |
| `captionSpeed` | kata/detik | Default 3.2. |
| `captionSize` | px | Default 66. |
| `title` / `subtitle` | string | Kartu judul besar di tengah (biasanya scene pertama, `bg: 'black'`). |
| `chars` | array | Karakter (lihat bawah). Digambar sesuai urutan — yang terakhir paling depan. |
| `fx` | array | Efek (lihat bawah). |
| `camera` | `{zoom:[a,b], pan:[a,b], focus:[x,y]}` | Zoom dari a ke b selama scene (default `[1,1.06]`). `pan` dalam pecahan lebar, positif = kamera geser ke kanan. `focus` (px logis) = titik yang digiring ke tengah layar sambil zoom, mis. spion `[585, 384]` di `busfront`, pojok belakang angkot `[380, 1100]`. |
| `lightning` | array detik | Waktu kilat (otomatis + suara guntur). |
| `scare` | `{at, type, dur}` | Jumpscare layar penuh. `type`: `face` (wajah pucat), `ghost` (kuntilanak menerjang), atau `kuyang` (kepala kuyang menerjang layar). `dur` default 0.7. Otomatis + suara hantaman. |
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
| `truck` | kabin truk dari kursi penumpang: plafon kain, jendela samping besar dengan hutan/jalan logging yang lewat, pengharum gantung bergoyang, lampu dashboard. Sopirnya ditaruh sebagai karakter `person` ber-`action: 'drive'` | sopir truk/pikap malam, perjalanan jauh |
| `river` | sungai malam Kalimantan: hutan tropis di seberang, pantulan bulan, 0–3 rumah panggung (bedeng) di kiri yang jendelanya bisa menyala, titian kayu di depan (karakter berdiri di `y` ±1350) | pinggir sungai, kampung bedeng, kejadian di atas air |
| `bedeng` | eksterior dekat satu rumah panggung kayu: dinding papan, atap seng, jendela berdaun terbuka (`litWindow: 0` menyala), pintu, teras di `y` ±1270, pelita di samping pintu, air di bawah | rumah di pinggir sungai, sosok di jendela, teras malam |
| `gang` | gang kampung sempit: tembok lembab dan pagar seng berperspektif, kabel kusut, satu lampu kuning, got terbuka, pintu gelap di ujung (kaki di `y` ±1350–1500) | pulang malam lewat gang, dikejar, sosok di ujung gang |
| `sawah` | sawah malam: gunung jauh, petak sawah berair memantulkan langit, rumpun padi, dangau di atas tiang, orang-orangan sawah, pematang ke tengah | wewe gombel, leak, anak hilang saat surup |
| `bambu` | rumpun bambu rapat berlapis dengan ruas, daun di atas, kabut, jalan setapak | begu ganjang, suara dari kebun bambu |
| `sumur` | halaman belakang: sumur tua bata berlumut dengan atap kayu, tali dan ember, pohon pisang, jemuran, dinding belakang rumah (kaki di `y` ±1350) | sumur angker, kuntilanak pohon pisang, anak tenggelam |
| `bedengroom` | dalam bedeng: dinding papan vertikal, jendela kayu terbuka ke sungai malam (kotak jendela sama dengan `room`: 600,450,300,400), pelita di rak, kain tergantung di tali | kamar bayi, rumah kampung, adegan dalam rumah kayu |

Field khusus `river`: `boat: false` (tanpa klotok tertambat), `houses` (0–3, default 3), `litWindow` (jendela rumah ke-n menyala, pantulannya bergoyang di air; `-1` = semua gelap), `boardwalk: false` (tanpa titian depan). Field `bedeng`: `litWindow` (0 = jendela menyala, `-1` = gelap). `truck`: `roadMove: false` = truk berhenti. Contoh sopir: `{type:'person', look:'trucker', action:'drive', x: 0.5, y: 1570, size: 1.5, light: 'warm'}`.

Field khusus `angkot`: `passengers` (0–5 penumpang duduk, default 2), `passEvery` (sapuan lampu jalan; bayangan penumpang di lantai ikut bergerak — hantu tidak punya bayangan), `roadMove: false`, `brake: true`. Hantu "duduk di pojok belakang": `{type:'ghost', x: 0.3, y: 1235, size: 0.36}` (bangku kiri, bukan di ambang pintu).

Field khusus `bus`: `passEvery` (detik antar sapuan lampu jalan, default 2.6; `0` = mati), `castShadows: true` (karakter `person` punya bayangan di lantai yang bergerak ikut lampu; hantu tidak — pas untuk adegan "bayangannya tidak ada"), `passengers` (jumlah kepala penumpang tidur di kursi, default 6; `0` = bus kosong), `brake: true` (pegangan tangan tersentak). Kursi panjang belakang ada di `y ≈ 1035`; karakter di lorong pakai `x: 0.5`, `y` 1100–1500, `size` 0.3 (belakang) sampai 0.85 (depan).

Field khusus `busfront`: `routeSign` (teks papan trayek, default `BANYUWANGI - SURABAYA`), `mirrorFigure: true` (wajah pucat muncul di spion), `brake: true` (bus melambat sampai berhenti + tasbih tersentak; pasangkan dengan `fx: ['shake']`), `roadMove: false` (bus diam), `driver: false` (kursi sopir kosong), `routeSign: ''` (tanpa papan trayek — untuk angkot), `ghostHand: true` + `ghostHandAt` (detik) = tangan pucat terulur dari belakang menyodorkan uang lama ke sopir (nilai negatif = sudah terulur sejak awal scene). Kondektur berdiri di pintu: `{type:'person', role:'conductor', x: 0.14, y: 1700, size: 0.95}`.

## Karakter (`chars[]`)

Field umum:

| Field | Keterangan |
|---|---|
| `type` | `puppet` (karakter gambar, lihat `puppets.md`), `person`, `kuyang`, `wewe` (wewe gombel), `leak`, `begu` (begu ganjang), `welthok`, `baby` (bayi di ranjang berkelambu), `dog` (anjing kampung), `jeruju` (ikatan daun berduri), `ghost` (kuntilanak), `pocong`, `genderuwo`, `tuyul`, `ngesot` (suster ngesot), `banaspati` (bola api), `hand` (tangan pucat), `hair` (rambut menjuntai dari plafon), `shadow` (sosok tinggi kurus), `eyes` (sepasang mata menyala), `bus` (bus tampak samping), `angkot` (angkot tampak samping), `money` (uang kertas lama) |
| `x` | posisi horizontal (0–1). |
| `to` | posisi akhir; karakter bergerak dari `x` ke `to` selama jendela tampilnya. |
| `y` | garis kaki (default 1350; `eyes` default 900). Lebih kecil = lebih jauh/tinggi. |
| `size` | skala (default 1 ≈ 520 px tinggi orang). 0.5–0.8 untuk “di kejauhan”. |
| `face` | `1` hadap kanan, `-1` hadap kiri. Default mengikuti arah gerak. |
| `in` / `out` | detik dalam scene kapan muncul/hilang. |
| `appear` | `cut` (default), `fade`, `flicker` (berkedip-kedip saat muncul — paling seram untuk hantu). |
| `alpha` | transparansi 0–1. |
| `action` | lihat per tipe. `approach` berlaku untuk semua: mendekat ke kamera, membesar sampai `grow` (default 1.8). |
| `still` | `true` = hantu diam total (tanpa melayang naik-turun/lompat), hanya kain/rambut bergerak tipis. Lebih seram dari hantu yang banyak bergerak. |
| `blur` | px. Mengaburkan karakter — hantu jauh di kabut, di balik kaca buram. |
| `silhouette` | `true` atau warna (mis. `'#04050a'`) = karakter digambar sebagai bayangan rata. Pakai dengan `clip` + `blur` untuk sosok di balik jendela/tirai. |
| `clip` | `[x, y, w, h]` (px logis) = karakter hanya terlihat di dalam kotak itu, mis. kaca jendela `room` `[600, 450, 300, 400]`. |
| `cast` | Bayangan karakter dilempar lampu ke dinding: `{sx, sy, skew, dx, dy, alpha, blur, only, light}`. `sx/sy` skala (default 1.6), `skew` miring (−0.35 = condong ke kanan), `dx/dy` geser, `only: true` = cuma bayangannya yang tampak (hantunya tidak), `light: false` mematikan genangan cahaya lampu di dinding. Pasangkan dengan `person` ber-`accessory: 'lantern'`. |
| `reveal` | `'lightning'` = hanya terlihat saat kilat (pakai `lightning` di scene), `'flicker'` = timbul-tenggelam acak seperti terlihat di lampu kedip. |

**Prinsip penampilan hantu (pakai ini, jangan pamer hantu utuh di tiap scene):** tampilkan sebagian/samar dulu — jauh di kabut (`size` kecil + `blur`), siluet di balik jendela (`silhouette` + `clip`), bayangan di dinding (`cast.only`), tangan dari kolong (`hand`), rambut dari plafon (`hair`), atau hanya saat kilat (`reveal`). Tiap scene berikutnya hantu makin dekat (pindah posisi lewat potongan scene, bukan berjalan). Hantu utuh dan dekat baru di klimaks, lalu jumpscare.

Per tipe:
- **puppet** — karakter dari aset gambar. `name` = nama folder puppet. Ringkas: `action` `walk`/`run` (pakai `to`), nama animasi gerak lain (mis. `float`, `hop`) atau nama pose (`point`, `idle2`, `toga-dadah`…); `talk: true` = mulut bergerak; `mood` (`scared`, `shout`, `laugh`, `sleep`, atau nama ekspresi yang ada di puppet seperti `sad`, `smile`); `expr` = nama ekspresi langsung (mis. `pos1`); `face: -1` = hadap kiri (gambar dibalik) supaya dua karakter saling hadap. Detail dan aturan kecepatan jalan ada di `puppets.md`.
- **person** — digambar berwarna dengan wajah jelas (mata berkedip, alis, hidung, mulut, kerutan untuk orang tua), lalu diwarnai cahaya scene. `look`: `man` (default), `boy` (anak; pakai `size` 0.7–0.8), `ustad` (baju koko + peci putih-hitam, sarung), `trucker` (topi, kumis, kemeja flanel, handuk di leher), `elder` (kakek: peci, uban, kumis putih, batik + sarung), `grandma` (nenek: sanggul uban, kebaya, kain batik), `woman` (rambut panjang, daster). `mood`: `calm`, `scared`, `laugh`, `shout`, `sad`, `sleep` (default `scared` untuk `run`/`tremble`). `light`: `night` (default), `warm` (dekat pelita/lampu), `red`, `under` (disinari dari bawah, paling seram untuk close-up wajah), `none`. Wajah digambar 3/4 dengan sisi jauh gelap, rongga mata dalam, dan bayangan di kaki. `shirt`/`skin`/`hairColor` mengganti warna. `style: 'silhouette'` = figur siluet hitam lama. Wajah paling terbaca di `size` ≥1.2 atau dengan `camera.focus` ke kepala (kepala di `y − 476×size`). `action`: `idle`, `walk`, `run` (pakai `to`), `tremble` (gemetar), `look` (kepala menoleh), `reach` (tangan kanan meraih ke atas, mis. menggantung/mencabut daun di jendela), `point`, `cover` (tangan ke dada, ketakutan), `carry` (menggendong bayi; `babyCry: true` = bayinya menangis), `drive` (duduk memegang setir; pakai di latar `truck`). `accessory`: `scarf`, `bag`, `cap`, `lantern` (cahaya hangat), `flashlight` (sorot senter ke arah hadap; `flicker: true` = senter kedip). `hair: 'long'`. `color` = warna aksesoris (default aksen). `role: 'conductor'` = kondektur bus (seragam biru, topi pet, handuk di bahu, tas uang selempang, kipas uang kertas di tangan) — jangan dipadukan dengan `accessory`.
- **ghost** — kuntilanak melayang tanpa kaki: gaun putih compang-camping tembus pandang, rambut basah menjuntai menutupi wajah pucat, kepala miring, tangan panjang berkuku. `eyes: false` menyembunyikan mata merah, `reach: true` = kedua tangan terulur ke depan (cocok saat klimaks/`approach`). `pose: 'back'` = berdiri membelakangi, rambut menutupi seluruh punggung (seram di ujung lorong). `pose: 'perch'` = duduk di dahan pohon dengan kaki telanjang berayun; `x/y` = titik duduk (mis. `y: 860` di `forest`), `branch: false` kalau tidak mau dahan tambahan.
- **pocong** — kain kafan menguning dan bernoda tanah di bawah, kerutan tidak beraturan, terikat di kepala/leher/kaki. `faceStyle`: `'dark'` (lubang gelap + mata pucat, default), `'rotten'` (wajah membusuk), `'covered'` (tertutup kain). `lean` = kemiringan. `action: 'hop'` melompat di tempat; dengan `to` melompat berpindah.
- **genderuwo** — siluet raksasa berbulu lebat (±900 px pada `size` 1), bungkuk, lengan panjang sampai lutut, mata merah menyala berkedip, napas mengepul. Pakai `size` 0.8–1 dekat, atau `cast.only` untuk bayangan raksasanya saja.
- **tuyul** — anak gundul kurus kelabu, kepala besar, telinga runcing, rongga mata hitam dengan titik merah. `size` 1.3–1.6. Dengan `to` = berlari.
- **ngesot** — suster ngesot merangkak di lantai menghadap kanan (topi perawat, rambut terurai ke lantai, satu mata mengintip). `y` = lantai (±1400 di `corridor`), `size` ±1.1. Dengan `to` = menyeret badan maju.
- **banaspati** — bola api melayang yang menerangi sekitarnya, lidah api + percikan. Digambar di tengah `(x, y)` (default `y` 900). `face: true` memunculkan wajah samar di apinya.
- **hand** — lengan pucat keluar dari gelap. `x/y` = titik keluarnya (mis. kolong ranjang `room`: `x: 700, y: 1352`), `dir` derajat (0 kanan, 90 bawah, 180 kiri, −90 atas), `len` (default 420), memanjang selama `reachTime` (default 1.6 dtk).
- **hair** — rambut hitam menjuntai dari plafon dengan wajah terbalik di ujungnya. `x` = posisi, `y` = titik gantung (default 0 = atas layar), `len` (default 760), `descend: true` = turun pelan selama `descendTime`, `face: false` = rambut saja.
- **shadow** — sosok bayangan tinggi; `eyes: false`, `color` warna mata.
- **bus** — bus malam tampak samping, menghadap kanan, roda di `y` (pakai ±1420 di latar `road`). Dengan `to` = melaju (roda berputar). `passenger` (0–7) = siluet penumpang di jendela ke-n. `dark: true` = lampu kabin & lampu depan mati.
- **angkot** — angkot tampak samping menghadap kanan (biru, strip kuning, pintu geser terbuka), roda di `y` (±1420 di `road`). `to` = melaju, `color` = warna cat, `label` = kode trayek (default `T19`), `passenger` = siluet penumpang di jendela, `dark: true` = lampu mati.
- **money** — uang kertas lama bernoda, digambar di tengah `(x, y)` (pakai `y` ±900). `value` (default `100`), `label` (`RUPIAH`), `year` (`TAHUN 1968`).
- **kuyang** — kepala perempuan terpenggal yang terbang: wajah nyaris manusia (cokelat kehijauan, pipi cekung, seringai tipis), kepala miring, rambut basah berkibar ke belakang arah terbang, dan sulur merah gelap menjuntai di bawah dagu yang memancarkan cahaya merah (stilisasi, tanpa gore). Titik asal = tengah kepala (default `y` 900). Jauh: `size` 0.3–0.5 + `blur`; dekat/klimaks: `size` ≥1. `eyes: false` mematikan mata menyala. Dengan `to` = terbang berpindah. Muncul di jendela: `clip` kotak jendela.
- **wewe** — wewe gombel: nenek raksasa bungkuk berkain lusuh, rambut uban sampai lutut, lengan panjang berkuku, mata cekung, seringai. Titik asal = kaki; ±800 px tinggi di `size` 1. `action: 'reach'` = tangan terulur, `still: true` = diam.
- **leak** — kepala terbang khas Bali: mata melotot merah, taring, lidah merah panjang, rambut putih liar, api hijau pucat. Titik asal = tengah kepala (default `y` 900).
- **begu** — begu ganjang: sosok hitam kurus luar biasa tinggi (±900 px) yang **terus memanjang** selama scene (`grow`, default 0.6 = +60%), dua titik mata pucat. `eyes: false` = tanpa mata. Tempatkan agak jauh (`y` 1350–1450).
- **welthok** — hantu anak kecil penghuni kali: pucat kebiruan, basah, rambut lepek menempel di wajah, mata hitam penuh, air menetes. Titik asal = kaki; `size` 0.8–1 = tinggi anak.
- **kuyang** `variant: 'palasik'` — kepala terbang Minang dengan cahaya hijau dingin, bukan bara merah.
- **baby** — bayi berbedong batik di ranjang kayu berkelambu; titik asal = lantai di bawah ranjang (±`y` 1500 di `bedengroom`). `cry: true` (+`cryUntil` detik dalam scene) = menangis dengan gelombang suara; `stare: true` = mata terbuka diam; `net: false` = tanpa kelambu.
- **dog** — anjing kampung tampak samping menghadap kanan. `pose`: `lie` (default, rebahan kepala tegak) atau `sit`. `ears: 'back'` = telinga rebah (takut), `shine: false` mematikan pantulan mata, `color` warna bulu.
- **jeruju** — ikatan daun jeruju berduri tergantung tali; titik asal = paku gantungan (taruh di atas jendela, mis. `x: 640, y: 745` di `bedeng`, `x: 720, y: 470` di `bedengroom`). `fallAt` (detik) = jatuh dicabut, `snagTo: [dx, dy]` = benang kelambu tersangkut di durinya (relatif ke paku), `hair: true` = rambut panjang basah menyangkut dan menetes, `count` jumlah daun.
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
