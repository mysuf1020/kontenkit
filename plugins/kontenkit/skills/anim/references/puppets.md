# Puppet: karakter dari aset gambar

Selain karakter yang digambar kode, engine bisa memakai karakter dari gambar buatan user (misalnya hasil generate Gemini di atas green screen). Alurnya: **sheet gambar → spec → `puppet-cut.mjs` → folder puppet → story**.

## 1. Sheet gambar

Semua sheet berlatar **hijau polos `#00FF00`** (tanpa lantai, bayangan, teks), karakter menghadap kanan dengan sudut 3/4, dan tidak ada bagian karakter yang hijau. Satu figur tidak boleh menempel figur lain; potongan dicari sebagai gumpalan piksel terpisah.

| File | Isi | Dipakai sebagai |
|---|---|---|
| `00-karakter.png` | badan utuh di kiri + 6 kepala (grid 3×2) di kanan | ekspresi wajah; badan dasar untuk hantu |
| `01-jalan.png` / `01-gerak.png` | 6 frame satu baris | siklus jalan / gerak hantu (melayang, loncat) |
| `02-lari.png` | 6 frame satu baris | siklus lari |
| `03-pose.png` | 4–6 pose satu baris | pose diam bernama (`point`, `cover`, …) |
| `05-mulut.png` | 6 kepala bentuk mulut | lip-sync saat `talk` |
| `06-diam.png` | 3 pose berdiri santai | badan dasar manusia + `idle1`–`idle3` |
| sheet tambahan | mis. `07-toga.png`, `08-kesurupan.png` | pose atau ekspresi khusus |

Badan dasar manusia sebaiknya `06-diam` pose pertama (lengan turun), karena wajahnya yang diganti-ganti saat ngomong dan ganti ekspresi; badan A-pose di `00` membuat bahu terlihat patah.

## 2. Spec (`rig-spec.json`, satu per karakter)

```json
{
  "name": "amel", "ghost": false, "tall": 0.88,
  "image": "06-diam.png", "body": [0, 0, 968, 1536], "foot": [598, 1476], "torsoZ": 3,
  "parts": { "head": { "poly": [[470,80],[740,80],[740,340],[640,350],[620,368],[545,368],[520,350],[470,340]],
                       "pivot": [580,360], "z": 5, "joint": 48, "keep": 40 } },
  "faces": [
    { "image": "00-karakter.png", "rect": [1012, 0, 1718, 1536], "order": ["neutral","blink","talk","scared","shout","laugh"] },
    { "image": "05-mulut.png", "order": ["m1","m2","m3","m4","m5","m6"], "ref": "m1" }
  ],
  "anims": {
    "walk": { "image": "01-jalan.png", "count": 6, "fps": 9 },
    "run": { "image": "02-lari.png", "count": 6, "fps": 12 },
    "pose": { "image": "03-pose.png", "count": 6, "names": ["point","cover","lookback","phone","backaway","crouch"] },
    "idles": { "image": "06-diam.png", "count": 3, "names": ["idle1","idle2","idle3"] }
  }
}
```

Semua koordinat dalam piksel gambar sumber; path relatif ke file spec.
- `body` — area badan dasar di sheet (supaya figur lain di sheet yang sama tidak ikut).
- `foot` — titik tanah di antara telapak kaki (tengah lebar kaki, dasar sol).
- `parts.head.poly` — area kepala + leher sampai kerah. Baca koordinatnya dari grid: `node puppet-cut.mjs <gambar> --grid --step 50`. `pivot` = pangkal leher. `joint` = radius badan yang tetap utuh di sekitar leher. `keep` = tinggi pita bawah poligon yang tetap tinggal di badan, supaya tidak muncul celah kalau wajah pengganti lebih sempit (hijab, kerah). Untuk hantu tanpa leher jelas (genderuwo), `keep` setinggi poligon = kepala asli tetap ada di bawah wajah pengganti.
- `faces` — kepala-kepala diurutkan kiri→kanan, atas→bawah sesuai `order`, lalu diskalakan supaya lebar bagian atas kepala sama dengan kepala badan dasar. `ref` = kepala acuan skala (default `neutral`).
- `anims` — sheet tanpa `names` = siklus gerak (nama siklus = nama action: `walk`, `run`, `float`, `hop`…); sheet dengan `names` = pose diam bernama. `scale` dihitung otomatis dari ukuran kepala supaya karakter tidak membesar/mengecil saat ganti sheet. Isi manual hanya kalau hitungan otomatis meleset (mis. sheet yang posenya rebahan/miring: `"scale": 1`).
- `tall` — tinggi relatif terhadap pria dewasa (1.0). Atur supaya pasangan karakter terlihat wajar berdampingan (mis. puncak kepala Amel setinggi hidung–mulut Yusuf ⇒ 0.88).
- `ghost: true` — dihitung hantu: scene jadi horor otomatis, tanpa bayangan kaki, default melayang.

## 3. Potong dan cek

```bash
node <skill-dir>/scripts/puppet-cut.mjs <folder-aset>/<nama>/rig-spec.json --out <folder-puppets>
```

Hasilnya `<folder-puppets>/<nama>/` berisi `rig.json`, PNG potongan, `face-*.png`, `anim-*.png`, dan `_debug.png` (badan di atas abu-abu + garis poligon). Baris `anim scale:` di output menunjukkan skala tiap sheet; nilai jauh dari 0.8–1.1 biasanya tanda pose rebahan/terpotong yang perlu `scale` manual.

Cek sebelum dipakai:
1. Semua ekspresi ditempel di badan dasar: tidak ada celah abu-abu di leher, rambut/hijab tidak terpotong.
2. Frame siklus berurutan dan ukurannya konsisten.
3. Render story tes pendek dengan latar sungguhan (`--stills` lalu `--no-audio`) dan lihat kaki: harus napak di lantai.

## 4. Di story

```js
puppets: ['../puppets'], backgrounds: ['../aset/set-tempat'],
scenes: [
  { dur: 3, bg: 'ruang-belajar', camera: { zoom: [1.45, 1.5], focus: [540, 820] },
    chars: [{ type: 'puppet', name: 'yusuf', x: 0.3, size: 1.35, talk: true, light: 'warm' },
            { type: 'puppet', name: 'amel', x: 0.7, size: 1.35, face: -1, light: 'warm' }] },
]
```

| Field | Keterangan |
|---|---|
| `name` | nama folder puppet. |
| `action` | `walk`/`run` dengan `to`; nama siklus lain (`float`, `hop`); atau nama pose (`point`, `idle2`, `crouch`, `toga-dadah`…). Tanpa `action` = badan dasar bernapas pelan (hantu: melayang). |
| `talk` | `true` = mulut bergerak (bentuk `m1`–`m6` acak) selama wajah netral. |
| `mood` | `scared`, `shout`, `laugh`, `sleep`, atau nama ekspresi yang ada di puppet (`sad`, `smile`…). |
| `expr` | nama ekspresi langsung, mis. `pos1` untuk wajah kesurupan. |
| `face` | `-1` = hadap kiri (gambar dibalik). Dua karakter ngobrol: kiri `face: 1`, kanan `face: -1`. Default mengikuti arah gerak. |
| `size` | ±1.35 untuk adegan biasa; close-up lewat `camera.zoom` + `focus`, bukan `size` raksasa. |
| `light` | `night` (default), `warm`, `none` (siang / latar terang). |

Ekspresi, mulut, dan napas hanya berlaku di badan dasar; pose dan siklus adalah gambar utuh, jadi wajahnya mengikuti gambar pose itu.

**Kecepatan jalan.** Langkah kaki disinkronkan dengan jarak tempuh (satu siklus = 0.8 tinggi badan untuk jalan, 1.4 untuk lari), jadi kaki tidak meluncur. Konsekuensinya, gerak yang terlalu lambat terlihat seperti jalan slow-motion. Jalan normal pada `size` 1.35 menyeberangi layar (`x` 0.05 → 0.95) dalam ±2 dtk, lari (−0.15 → 1.15) ±1.4 dtk. Untuk berjalan lalu berhenti, pecah jadi dua scene (jalan, lalu diam di posisi akhir).
