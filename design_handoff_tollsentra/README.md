# Handoff: TollSentra Control Center

Aplikasi desktop pemantauan operasi jalan tol — CCTV per ruas, sebaran aset
pada peta, penanganan kejadian SOS, dan manajemen pengguna beserta hak
aksesnya (RBAC).

Versi 1.0 · 13 Agustus 2026

---

## Overview

TollSentra adalah antarmuka ruang kendali untuk operator jalan tol. Satu
layar menyatukan hal-hal yang sebelumnya tersebar di beberapa aplikasi:

- Dinding CCTV per ruas dengan grid 2×2, 3×3, dan 4×4.
- Peta sebaran aset: CCTV, VMS, Jaringan FO, GPS kendaraan, gerbang tol,
  WIM, cuaca, dan titik SOS.
- Worklist SOS dengan Smart Response — pencocokan otomatis unit
  penanganan terdekat berdasarkan posisi GPS.
- Manajemen pengguna, katalog role, dan pengelolaan hak akses menu.

Tujuan operasionalnya: operator menilai kondisi seluruh ruas dalam satu
pandangan, dan perangkat bermasalah terlihat tanpa perlu dicari.

---

## About the Design Files

**Berkas dalam paket ini adalah referensi desain yang dibuat dengan HTML.**
Berkas tersebut adalah prototipe yang menunjukkan tampilan dan perilaku yang
diinginkan — **bukan kode produksi untuk disalin langsung**.

Tugas implementasi adalah **membangun ulang desain ini di dalam codebase
tujuan**, memakai pola, pustaka, dan konvensi yang sudah berlaku di sana.
Bila belum ada codebase, pilih framework yang paling sesuai untuk proyek ini
lalu implementasikan desainnya di sana.

Stack belum ditentukan, sehingga seluruh dokumen dalam paket ini ditulis
netral framework. Nilai desain diberikan sebagai token CSS yang dapat
dipetakan ke pendekatan styling apa pun.

### Rekomendasi styling

Gunakan **CSS custom properties + CSS biasa** (CSS Modules atau plain
stylesheet). Alasannya:

1. Pergantian tema di aplikasi ini bekerja dengan menukar nilai variabel
   pada satu atribut `data-theme`. Pendekatan ini tidak memerlukan
   penulisan ulang kelas dan tidak menggandakan aturan.
2. Beberapa token bersifat kontekstual dan tidak mengikuti tema secara
   naif — `--tile-1`, `--tile-2`, `--on-scrim` tetap gelap/terang pada
   kedua tema. Variabel menangani ini secara alami.
3. Berkas `design-tokens.css` dalam paket ini siap dipakai apa adanya.

Bila tim memilih Tailwind, petakan token pada `theme.extend.colors` yang
merujuk `var(--...)`, bukan menyalin nilai heksadesimal.

---

## Fidelity

**High-fidelity (hifi).**

Mockup memuat warna final, tipografi, spasi, radius, bayangan, animasi, dan
perilaku interaksi yang sudah melalui beberapa putaran revisi bersama
pemangku kepentingan. Implementasi harus mengikuti tampilan ini secara
presisi, memakai pustaka dan pola yang ada di codebase tujuan.

Hal-hal yang **sudah final** dan tidak boleh diubah tanpa diskusi:

- Palet tema gelap berbasis biru (`#133A73` / `#1E4C87`) — ditentukan
  klien.
- Perilaku dua zona klik pada baris layer peta.
- Tile CCTV tetap gelap pada tema terang.
- Pola panel mengambang dengan auto-hide pada mode layar penuh.

---

## Screens / Views

Spesifikasi lengkap tiap layar — struktur, state, kondisi batas, dan
kriteria penerimaan — ada pada `Requirement-Implementasi.md` bab 6–12.
Ringkasannya:

| Layar | Rute | Tujuan |
|---|---|---|
| Login | `/login` | Autentikasi kredensial lokal atau SSO (OIDC) |
| Dashboard | `/` | Kondisi operasi dalam satu pandangan: KPI, peta ringkas, peringatan gerbang, SOS aktif, aktivitas |
| Peta Aset | `/peta` | Sebaran aset per layer, daftar aset, detail aset, mode layar penuh |
| CCTV | `/cctv` | Dinding kamera per ruas, pemilih grid, mode layar penuh |
| SOS | `/sos` | Worklist tiket, Smart Response, timeline penanganan |
| Pengguna & Akses | `/admin/users` | Manajemen pengguna, katalog role, hak akses menu |
| Pengaturan | `/pengaturan` | Preferensi aplikasi per kategori |

**Di luar lingkup fase ini:** layar Monitoring WIM. Layer WIM pada peta
tetap ada sebagai penanda lokasi, dan kartu ringkasan WIM pada Dashboard
tetap tampil dengan tautan detail dinonaktifkan.

### Struktur kerangka

```
AppShell [data-theme]
├── Sidebar (236px, dapat dilipat menjadi 66px)
│   ├── Logo + tombol lipat
│   ├── NavItem × 7
│   └── Profil pengguna + keluar
└── MainColumn
    ├── TopBar (60px) — judul, pemilih ruas, SSE, jam, tema, notifikasi
    ├── SosStrip — hanya bila ada tiket terbuka
    └── Content — layar aktif
```

Pada mode layar penuh (peta dan CCTV), Sidebar, TopBar, dan SosStrip
disembunyikan. Status SSE dan jam berpindah ke panel mengambang.

---

## Interactions & Behavior

### Peta — tiga state panel kanan

```
empty ──klik zona teks LayerRow──> list ──klik item / marker──> detail
  ^                                  ^                            │
  └────────── tombol tutup ──────────┴──── tombol kembali ────────┘
```

**Baris layer memiliki dua zona klik yang wajib tidak saling memicu:**

| Zona | Aksi |
|---|---|
| Ikon + nama + badge | Membuka daftar aset pada panel kanan |
| Toggle switch | Menyala/mematikan marker layer di peta |

Badge merah pada baris layer menghitung item berstatus offline atau error
pada ruas aktif. Untuk layer SOS, badge menghitung tiket yang belum selesai.
Badge disembunyikan bila nilainya nol.

### Mode layar penuh (peta dan CCTV)

- Sidebar, TopBar, dan SosStrip disembunyikan.
- Panel samping kiri disembunyikan; dibuka lewat tab vertikal di tepi kiri
  (`LAYER` untuk peta, `KAMERA` untuk CCTV).
- Tab bergeser dari `left: 0` ke `left: 250px` saat panel terbuka,
  transisi 0.18s.
- Panel detail kanan (peta) disembunyikan sampai marker atau item diklik.
- Satu panel mengambang di kanan atas: SSE, jam, pemilih grid (CCTV saja),
  dan tombol keluar.
- **Auto-hide**: panel mengambang dan tab meredup setelah 2.6 detik tanpa
  `mousemove`, muncul kembali saat kursor digerakkan.

### CCTV — grid layar penuh

| Aspek | Mode normal | Mode layar penuh |
|---|---|---|
| Rasio tile | 16:9 dikunci | tidak dikunci, mengisi tinggi baris |
| Gulir | ya | tidak ada |
| Jumlah tile | semua kamera | dipotong menjadi n² (4, 9, atau 16) |
| Padding | `14px 18px` | `14px` seragam semua sisi |
| Gap | 14px | 14px |

### Animasi

| Nama | Durasi | Dipakai pada |
|---|---|---|
| `blink` | 1.6s infinite | titik SSE, indikator LIVE |
| `pulse` | 1.8s infinite | cincin marker kritis dan SOS |
| `glow` | 1.8s infinite | badge SOS pada sidebar |
| transisi panel | 0.18s ease | lebar sidebar, posisi tab |
| transisi fade | 0.25s ease | auto-hide panel mengambang |
| transisi hover | 0.15s ease | background baris, toggle |

### State memuat, kosong, dan galat

Mockup hanya menampilkan state ideal. Implementasi wajib menambahkan:

| State | Ketentuan |
|---|---|
| Memuat | Skeleton pada kartu dan baris tabel, bukan spinner layar penuh |
| Kosong | Ikon + kalimat ajakan yang menjelaskan langkah berikutnya, bukan area kosong |
| Galat | Pesan ringkas + tombol coba lagi pada area komponen terkait |
| Offline SSE | Indikator pada TopBar berubah menampilkan kondisi terputus; sambung ulang otomatis dengan jeda bertingkat |

Contoh state kosong yang sudah ada di mockup: panel kanan peta menampilkan
ikon dan kalimat "Klik salah satu layer di panel kiri untuk melihat
daftarnya, atau klik marker di peta untuk detail."

---

## State Management

### State global

| State | Tipe | Keterangan |
|---|---|---|
| `auth` | objek | user, roles, permissions, branchScopes dari `/api/auth/me` |
| `menus` | array | tree menu dari `/api/menus`, di-cache setelah login |
| `activeBranch` | string | ruas aktif; mengubahnya memicu refetch aset, kamera, tiket |
| `theme` | `'dark' \| 'light'` | disimpan pada preferensi, dipulihkan saat aplikasi dibuka |
| `tickets` | array | tiket SOS; **satu sumber** untuk semua penghitung |
| `sseStatus` | enum | kondisi koneksi realtime |

**Konsistensi wajib**: jumlah tiket SOS terbuka harus identik di badge
sidebar, badge notifikasi TopBar, SosStrip, kartu Dashboard, dan badge layer
SOS pada peta. Semua membaca dari `tickets`.

### State per layar

| Layar | State |
|---|---|
| Peta | `layers{}`, `mapFull`, `mapLayersOpen`, `panelMode`, `panelListKey`, `panelSearch`, `panelSelection`, `uiVisible` |
| CCTV | `cctvLayout` (4\|9\|16), `cctvFull`, `cctvListOpen`, `cameraQuery`, `uiVisible` |
| SOS | `selectedTicketId`, `ticketDetail` |
| Pengguna | `usersTab`, `selectedUserId`, `userQuery`, `formMode` |
| Pengaturan | `settingsTab`, nilai preferensi |
| Shell | `sidebarOpen` |

### Pengambilan data

- Snapshot (`/api/assets/map`, `/api/cameras`, `/api/monitoring/summary`)
  di-cache pada state dan disegarkan sesuai interval pada Pengaturan.
- Realtime lewat satu koneksi SSE bersama untuk seluruh aplikasi.
- `401` membersihkan sesi dan mengarahkan ke login; `403` menampilkan
  state tidak berwenang; `400` menampilkan galat validasi pada kolom.

---

## Design Tokens

Nilai lengkap ada pada **`design-tokens.css`** — siap diimpor apa adanya.

Ringkasan warna dasar:

| Token | Gelap | Terang |
|---|---|---|
| `--app-bg` | `#133A73` | `#EDF0F5` |
| `--surface-1` | `#1E4C87` | `#F8FAFC` |
| `--surface-2` | `rgba(39,84,143,.78)` | `#FCFDFE` |
| `--text` | `#EAF1FB` | `#2E3D4F` |
| `--text-muted` | `#93A8C9` | `#76859A` |
| `--line` | `rgba(150,185,230,.16)` | `#E4E9EF` |
| `--sem-green` | `#34D399` | `#2E9C77` |
| `--sem-amber` | `#FBBF24` | `#B8891C` |
| `--sem-red` | `#F43F5E` | `#C4525F` |

### Aturan wajib penerapan tema

1. Elemen pembungkus aplikasi **wajib** menetapkan `background` dan
   `color`. Tanpa `color`, teks yang mewarisi warna tidak ikut berganti
   saat tema diubah.
2. Dilarang menulis nilai warna literal pada komponen.
3. Teks di atas scrim gelap memakai `--on-scrim`, bukan `--text`.
4. Tiap warna status berpasangan dengan latar chip pada alpha ~16%.
5. Rasio kontras teks minimum 4.5:1 pada kedua tema.

### Tipografi

**IBM Plex Sans** untuk antarmuka, **IBM Plex Mono** untuk angka, kode,
waktu, dan koordinat.

| Peran | Ukuran |
|---|---|
| Metadata, kode kecil | 10.5px |
| Label tabel, pill | 11px |
| Keterangan | 12px |
| Teks tabel | 12.5px |
| Teks utama | 13px |
| Label menu | 13.5px |
| Judul kartu | 14px |
| Judul layar | 16px |
| Judul detail | 20px |
| Angka KPI | 27px mono |

### Radius, spasi, lebar tetap

Radius: 5px (pill) · 8px (tombol ikon) · 9px (tombol, input) · 10px (tile,
tab) · 12px (kartu).

Spasi: 4 · 8 · 12 · 14 · 16 · 18 · 22px. Nilai 14px dipakai untuk gap grid
CCTV dan padding mode layar penuh.

Lebar tetap: sidebar 236px (terlipat 66px) · panel kiri 250px · panel kanan
288px · worklist SOS 300px · panel pengguna 320px · panel pengaturan 230px ·
TopBar 60px.

---

## Assets

| Aset | Sumber | Catatan |
|---|---|---|
| Ikon | [Lucide](https://lucide.dev) via CDN `unpkg.com/lucide-static` | Dipertahankan sesuai keputusan. Dirender sebagai CSS mask agar mewarisi warna |
| Font | Google Fonts — IBM Plex Sans, IBM Plex Mono | Bobot 400, 500, 600, 700 |
| Peta dasar | Google Maps | Gaya mengikuti tema aplikasi |
| Overlay peta | deck.gl ArcLayer | Untuk koneksi Jaringan FO |
| Video | HLS `.m3u8` | Mockup memakai placeholder bergaris |

Tidak ada aset gambar atau logo kustom dalam paket ini. Marker, ikon, dan
placeholder video seluruhnya dibangun dari CSS.

**Teknik ikon** — mask agar warna mengikuti token:

```css
.icon {
  width: 17px; height: 17px;
  background: var(--text-muted);
  -webkit-mask: url(<url>) center/contain no-repeat;
          mask: url(<url>) center/contain no-repeat;
}
```

Daftar lengkap nama ikon ada pada `COMPONENTS.md` bab 7.

---

## Files

| Berkas | Isi |
|---|---|
| `TollSentra.dc.html` | Mockup interaktif lengkap — **referensi utama**. Seluruh layar, kedua tema, semua mode layar penuh |
| `TollSentra-standalone.html` | Versi mandiri offline tanpa dependensi. Buka langsung di browser |
| `design-tokens.css` | Token CSS siap pakai untuk kedua tema |
| `COMPONENTS.md` | Katalog komponen: ukuran, warna, state, varian |
| `SCREEN-MAP.md` | Peta layar → komponen → endpoint, beserta state per layar |
| `Requirement-Implementasi.md` | Requirement lengkap: lingkup, RBAC, spesifikasi tiap layar, kriteria penerimaan Given/When/Then, glosarium |

### Cara membaca mockup

`TollSentra.dc.html` adalah prototipe interaktif. Untuk menelusurinya:

1. Buka `TollSentra-standalone.html` di browser.
2. Tekan **Masuk** pada layar login.
3. Telusuri tiap menu di sidebar.
4. Tekan tombol matahari/bulan pada TopBar untuk mengganti tema.
5. Pada Peta dan CCTV, tekan tombol layar penuh untuk melihat mode ruang
   kendali beserta tab tepi dan panel mengambang.

### Urutan implementasi yang disarankan

1. **Kerangka** — AppShell, token, Sidebar, TopBar, pergantian tema.
2. **Autentikasi** — Login, capability, navigasi dari `/api/menus`.
3. **Dashboard** — komponen kartu dan tabel dasar yang dipakai ulang.
4. **CCTV** — grid, pemutar HLS, mode layar penuh (pola EdgeTab +
   FloatingToolbar pertama).
5. **Peta** — layer, marker, tiga state panel; memakai ulang pola layar
   penuh dari CCTV.
6. **SOS** — worklist, Smart Response, timeline, integrasi SSE.
7. **Pengguna & Akses** — tiga tab, formulir, dialog konfirmasi.
8. **Pengaturan** — kategori dan preferensi.

---

## Catatan penting

- **Aplikasi desktop, landscape saja.** Target 1920×1080, minimum didukung
  1440×900. Tidak ada layout mobile.
- **Pembungkus desktop belum ditentukan.** Bila kelak memakai Electron atau
  Tauri, mode layar penuh sebaiknya juga memicu fullscreen jendela asli,
  bukan hanya menyembunyikan elemen.
- **Jangan menyaring ulang menu di frontend.** Data dari `/api/menus` sudah
  final sesuai hak akses.
- **Katalog role di-hardcode** di frontend — backend belum menyediakan
  endpoint role master.
- Rute `/admin/users` hanya untuk `super_admin`; pengguna lain diarahkan
  keluar atau menerima state 403.
