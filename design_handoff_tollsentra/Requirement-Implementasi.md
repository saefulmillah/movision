# Requirement Implementasi Frontend
**Aplikasi Desktop Monitoring CCTV & Aset Tol — TollSentra Control Center**

Versi 1.0 · 13 Agustus 2026 · Untuk: Tim Frontend · Referensi: mockup `TollSentra.dc.html`

---

## Daftar Isi
1. Ringkasan & Tujuan
2. Ruang Lingkup
3. Persona & Hak Akses (RBAC)
4. Arsitektur Navigasi & Alur Pengguna
5. Design System & Aturan Tema
6. Spesifikasi Layar: Login
7. Spesifikasi Layar: Dashboard
8. Spesifikasi Layar: Peta Aset
9. Spesifikasi Layar: CCTV
10. Spesifikasi Layar: SOS Smart Response
11. Spesifikasi Layar: Pengguna & Akses
12. Spesifikasi Layar: Pengaturan
13. Integrasi API Backend
14. Kriteria Penerimaan
15. Glosarium

---

## 1. Ringkasan & Tujuan

Dokumen ini mendefinisikan requirement implementasi frontend untuk aplikasi desktop pemantauan operasi jalan tol. Aplikasi menyatukan pemantauan CCTV per ruas, sebaran aset pada peta, penanganan kejadian SOS, dan pengelolaan pengguna beserta hak aksesnya dalam satu antarmuka ruang kendali.

Seluruh spesifikasi di bawah mengacu pada mockup yang telah disetujui. Mockup adalah sumber kebenaran untuk tata letak, hierarki visual, dan perilaku interaksi. Dokumen ini menjelaskan perilaku yang tidak selalu terlihat dari tangkapan layar statis: state, kondisi batas, sumber data, dan kriteria penerimaan.

### Tujuan produk
- Operator dapat menilai kondisi seluruh ruas dalam satu pandangan tanpa berpindah aplikasi.
- Waktu dari kejadian SOS masuk hingga operator melihat konteksnya ditekan seminimal mungkin.
- Perangkat bermasalah (CCTV, VMS, FO, gerbang) terlihat tanpa operator harus mencarinya.
- Hak akses dikelola dari antarmuka, bukan dari basis data.

### Target teknis

| Aspek | Ketentuan |
|---|---|
| Form factor | Aplikasi desktop, mode ruang kendali layar penuh |
| Resolusi target | Workstation operator 1920×1080 (minimum didukung 1440×900) |
| Orientasi | Landscape, tanpa layout mobile |
| Tema | Gelap (default operasional) dan terang, dapat diganti runtime |
| Bahasa antarmuka | Bahasa Indonesia |

---

## 2. Ruang Lingkup

### Termasuk dalam lingkup
- Halaman login dengan kredensial lokal dan jalur SSO (OIDC).
- Dashboard ringkasan operasi sebagai layar utama setelah login.
- Peta sebaran aset dengan layer CCTV, VMS, Jaringan FO, GPS Kendaraan, Gerbang Tol, WIM, Cuaca, dan SOS.
- Daftar aset per layer di dalam panel peta, beserta panel detail.
- Dinding CCTV dengan grid 2×2, 3×3, dan 4×4, termasuk mode layar penuh.
- Worklist SOS beserta panel Smart Response dan timeline penanganan.
- Manajemen pengguna, katalog role, dan pengelolaan hak akses menu.
- Halaman pengaturan aplikasi.
- Dukungan tema terang dan gelap untuk seluruh layar di atas.

### Di luar lingkup fase ini
- **Monitoring WIM.** Layar WIM tidak dibangun pada fase ini. Layer WIM pada peta tetap ada sebagai penanda lokasi, namun tanpa halaman monitoring tersendiri.
- Master data CRUD (kamera, ruas, gerbang, tipe kendaraan) — dikelola melalui modul admin terpisah.
- Laporan dan ekspor data historis.
- Aplikasi mobile atau tampilan responsif untuk layar sempit.
- Pembuatan dan penghapusan role master. Role bersifat system role dari backend.

---

## 3. Persona & Hak Akses (RBAC)

Otorisasi frontend bersumber dari `GET /api/auth/me` yang mengembalikan role efektif, permission efektif, dan branch scope pengguna login. Frontend tidak boleh menyimpan asumsi hak akses secara hardcode selain katalog label role.

### 3.1 Katalog role

| Kode role | Label | Cakupan |
|---|---|---|
| `super_admin` | Super Admin | Akses penuh seluruh modul, pengguna, dan menu. Selalu melihat semua menu. |
| `operator_cctv` | Operator CCTV | Memantau dan mengelola kamera pada ruas yang ditugaskan. |
| `operator_asset` | Operator Asset | Mengelola aset VMS, FO, gerbang, dan WIM. |
| `operator_sos` | Operator SOS | Menangani tiket SOS dan pelacakan kendaraan. |
| `viewer_branch` | Viewer Branch | Hanya melihat data pada ruas yang ditugaskan. |

### 3.2 Aturan visibilitas menu

Navigasi dibangun dari `GET /api/menus` yang sudah difilter backend sesuai hak akses. Frontend merender apa adanya.

- Struktur menu dibatasi dua level: kategori (level 1) dan submenu (level 2).
- Gate per item: `module_code` dengan `required_access_level`, atau `permission_code`, atau tanpa batasan.
- Kategori hanya muncul bila memiliki minimal satu submenu yang terlihat.
- **Frontend dilarang menyaring ulang menu berdasarkan role.** Data dari backend sudah final.
- Menu di-fetch setelah login dan di-cache pada state aplikasi. Re-fetch dilakukan bila hak akses pengguna berubah.

> **Penting:** hak akses menu tidak di-assign terpisah. Untuk memberi seseorang akses ke sebuah menu, berikan permission atau module access terkait melalui halaman Pengguna & Akses. Tidak ada matriks menu-per-role.

### 3.3 Branch scope

Setiap pengguna memiliki daftar ruas yang dapat diakses. Pemilih ruas pada header hanya menampilkan ruas dalam scope pengguna. Seluruh daftar aset, marker peta, dan tiket SOS difilter mengikuti ruas aktif yang dipilih.

---

## 4. Arsitektur Navigasi & Alur Pengguna

### 4.1 Kerangka aplikasi

Aplikasi memakai tiga area tetap: sidebar navigasi di kiri, top bar di atas, dan area konten. Pada mode layar penuh (peta dan CCTV), sidebar dan top bar disembunyikan.

| Area | Isi | Perilaku |
|---|---|---|
| Sidebar | Logo, tombol lipat, daftar menu, identitas pengguna, keluar | Dapat dilipat menjadi rel ikon selebar 66px. Saat terlipat, badge SOS berubah menjadi titik merah. |
| Top bar | Judul layar, pemilih ruas, status SSE, jam, tombol tema, notifikasi | Jam diperbarui tiap detik. Badge notifikasi menampilkan jumlah SOS terbuka. |
| Strip SOS | Jumlah insiden aktif, insiden terbaru, tombol menuju worklist | Muncul di bawah top bar hanya bila ada SOS terbuka. Selalu tampil di seluruh layar. |

### 4.2 Alur utama

**Alur masuk**
1. Pengguna membuka aplikasi dan diarahkan ke halaman login.
2. Pengguna memasukkan kredensial atau memilih SSO (OIDC).
3. Sistem memanggil `GET /api/auth/me` untuk capability, lalu `GET /api/menus` untuk navigasi.
4. Pengguna diarahkan ke Dashboard dengan ruas default dari branch scope-nya.

**Alur penanganan SOS**
1. Kejadian SOS masuk melalui SSE. Strip SOS muncul dan badge sidebar bertambah.
2. Operator menekan **Buka Worklist SOS** atau menu SOS.
3. Operator memilih tiket dari worklist; panel kanan menampilkan detail, pelapor, lokasi, kandidat kendaraan, dan timeline.
4. Operator menekan **Konfirmasi Kedatangan** saat unit tiba, lalu **Selesaikan Tiket** setelah penanganan selesai.
5. Tiket keluar dari daftar aktif; badge dan strip SOS diperbarui.

**Alur penelusuran aset di peta**
1. Operator membuka Peta Aset. Panel kiri menampilkan daftar layer beserta jumlah titik dan badge gangguan.
2. Operator mengklik baris layer; panel kanan menampilkan daftar aset layer tersebut untuk ruas aktif.
3. Operator mengklik item pada daftar atau marker pada peta; panel kanan berpindah ke tampilan detail.
4. Operator menekan tombol kembali untuk kembali ke daftar, atau tombol tutup untuk mengosongkan panel.

---

## 5. Design System & Aturan Tema

### 5.1 Tipografi

| Peran | Font | Ukuran |
|---|---|---|
| Antarmuka umum | IBM Plex Sans | 12–14px, judul layar 16px |
| Angka, kode, waktu, koordinat | IBM Plex Mono | 10–15px |
| Angka KPI | IBM Plex Mono 600 | 27px |
| Label tabel | IBM Plex Sans 600, uppercase | 11px, letter-spacing 0.5px |

### 5.2 Token warna

Seluruh warna wajib memakai CSS custom property, bukan nilai heksadesimal langsung. Tema diaktifkan lewat atribut `data-theme` pada elemen pembungkus aplikasi. Elemen pembungkus wajib menetapkan `color` agar pewarisan teks ikut berganti saat tema diubah.

**Permukaan dan teks**

| Token | Gelap | Terang | Penggunaan |
|---|---|---|---|
| `--app-bg` | #133A73 | #EDF0F5 | Latar dasar aplikasi |
| `--surface-1` | #1E4C87 | #F8FAFC | Sidebar, panel samping |
| `--surface-2` | rgba(39,84,143,.78) | #FCFDFE | Kartu, input, tombol sekunder |
| `--surface-3` | rgba(30,72,130,.62) | #F1F4F9 | Latar chip, blok informasi |
| `--text` | #EAF1FB | #2E3D4F | Teks utama |
| `--text-dim` | #C8D6EE | #586878 | Teks sekunder |
| `--text-muted` | #93A8C9 | #76859A | Label, keterangan |
| `--text-faint` | #6F88AE | #9AA8B9 | Metadata, placeholder |
| `--line` | rgba(150,185,230,.16) | #E4E9EF | Garis pemisah, border kartu |

**Warna semantik status**

| Token | Gelap | Terang | Makna |
|---|---|---|---|
| `--sem-green` | #34D399 | #2E9C77 | Online, normal, bergerak, selesai |
| `--sem-amber` | #FBBF24 | #B8891C | Warning, berhenti, sedang ditangani |
| `--sem-red` | #F43F5E | #C4525F | Error, SOS, gangguan kritis |
| `--st-blue` | #7EA6FF | #3C63B4 | Identitas, tautan, gate module |
| `--st-gray` | #A4B5D2 | #6B7A8D | Nonaktif, tanpa data, tanpa gate |

**Token khusus konteks**

| Token | Ketentuan |
|---|---|
| `--tile-1` / `--tile-2` | Latar tile video CCTV. **Gelap pada kedua tema**, karena tile merepresentasikan layar video. |
| `--on-scrim` / `--on-scrim-dim` | Teks di atas scrim gelap (label kamera pada tile). Terang pada kedua tema. |
| `--overlay-bg` | Latar panel mengambang pada mode layar penuh. |
| `--nav-active-bg` / `--nav-active-text` | State aktif menu, tab, dan baris terpilih. |
| `--marker-ring` / `--marker-glow` | Cincin dan pendar marker peta. Pendar dinonaktifkan pada tema terang. |

### 5.3 Aturan wajib penerapan tema
- Dilarang menulis nilai warna literal pada komponen. Semua warna melalui token.
- Teks yang berada di atas scrim gelap wajib memakai `--on-scrim`, bukan `--text`.
- Setiap warna status wajib memiliki pasangan latar chip dengan transparansi sekitar 16%.
- Rasio kontras teks terhadap latar minimum 4.5:1 pada kedua tema.
- Pilihan tema disimpan pada preferensi pengguna dan dipulihkan saat aplikasi dibuka kembali.

### 5.4 Komponen berulang

| Komponen | Spesifikasi |
|---|---|
| Kartu | Latar `--surface-2`, border 1px `--line`, radius 12px, bayangan `--card-shadow` |
| Status pill | Radius 5px, padding 3×10px, teks 11px bold, warna dan latar dari token semantik |
| Tombol utama | Latar warna aksen, teks putih, radius 9px, padding 10–14px |
| Tombol sekunder | Latar `--surface-3`, border `--line-strong`, teks `--text-dim` |
| Baris tabel | Grid dengan kolom proporsional, border bawah `--line-soft`, hover `--nav-active-bg` |
| Tab | Kontainer `--surface-2` dengan padding 3px; tab aktif berlatar aksen, teks putih |
| Panel mengambang | Latar `--overlay-bg`, backdrop blur 6px, border `--line-strong`, radius 11px |

---

## 6. Spesifikasi Layar: Login

### 6.1 Struktur

Layar terbagi dua kolom. Kolom kiri (rasio 1.15) menampilkan identitas produk dan ringkasan cakupan sistem. Kolom kanan (rasio 0.85) memuat formulir masuk.

**Kolom kiri**
- Logo dan nama produk beserta subjudul "Pusat Kendali Operasi Tol".
- Indikator status sistem berbentuk pil dengan titik hijau berkedip dan jumlah ruas terpantau.
- Judul utama dan paragraf deskripsi singkat.
- Tiga angka ringkasan: jumlah kamera CCTV, gerbang tol, dan site WIM.
- Nomor versi aplikasi di bagian bawah.

**Kolom kanan**
- Judul "Masuk ke Pusat Kendali" dan keterangan singkat.
- Input nama pengguna dengan ikon di dalam kolom.
- Input kata sandi bertipe password dengan ikon gembok.
- Checkbox "Ingat saya" dan tautan "Lupa kata sandi?".
- Tombol **Masuk** selebar penuh.
- Pemisah "atau", lalu tombol **Masuk dengan SSO (OIDC)**.
- Catatan bahwa aktivitas login dicatat sistem.

### 6.2 Perilaku & state

| State | Perilaku |
|---|---|
| Idle | Tombol Masuk aktif. Fokus awal pada input nama pengguna. |
| Validasi | Kolom kosong ditandai border merah dengan pesan di bawah kolom. Submit diblokir. |
| Memproses | Tombol dinonaktifkan dan menampilkan indikator proses. Input dikunci. |
| Gagal | Pesan galat dari server ditampilkan di atas formulir. Kolom kata sandi dikosongkan. |
| Berhasil | Ambil capability dan menu, lalu arahkan ke Dashboard. |

**Ketentuan tambahan**
- Kata sandi tidak boleh terlihat dalam bentuk teks biasa dan tidak boleh tercatat di log.
- Tombol SSO mengarahkan ke penyedia OIDC dan menangani callback.
- Tekan Enter pada salah satu input memicu submit.
- Bila sesi masih valid saat aplikasi dibuka, lewati layar login.

---

## 7. Spesifikasi Layar: Dashboard

Layar utama setelah login. Menyajikan kondisi operasi dalam satu pandangan tanpa perlu menggulir untuk informasi kritis.

### 7.1 Baris KPI

Enam kartu dalam satu baris grid. Tiap kartu memuat label, ikon berlatar warna semantik, angka besar, dan keterangan.

| KPI | Keterangan | Warna |
|---|---|---|
| Ruas Aktif | Jumlah ruas beroperasi | Biru |
| CCTV Online | Jumlah kamera online dari total | Hijau |
| VMS Offline | Jumlah VMS tidak aktif dari total | Amber |
| SOS Aktif | Jumlah insiden butuh penanganan | Merah |
| Kendaraan Live | Unit patroli dan rescue aktif | Cyan |
| Site WIM Online | Jumlah site online dari total | Ungu |

### 7.2 Kolom kiri (rasio 1.75)

**Kartu Sebaran Aset — Ringkas**
- Peta mini setinggi 280px dengan marker berwarna sesuai jenis aset.
- Legenda mengambang di kiri bawah: CCTV, VMS, Gerbang, GPS, SOS.
- Tautan "Buka peta penuh →" menuju layar Peta Aset.

**Kartu Peringatan Gerbang Tol**
- Daftar gerbang bermasalah dengan titik status, nama gerbang, ruas, kode log, status pill, dan waktu.
- Status yang didukung: ERROR (merah), OFFLINE (abu), WARNING (amber).
- Judul kartu menampilkan jumlah gerbang bermasalah.

### 7.3 Kolom kanan (rasio 1)

**Kartu SOS Aktif**
- Daftar tiket terbuka: nomor tiket, status pill, jenis kejadian, ruas dan lokasi.
- Mengklik tiket membuka layar SOS dengan tiket tersebut terpilih.
- Tautan "Semua →" menuju worklist SOS.

**Kartu Monitoring WIM**
- Empat bar ringkasan: Online, Warning, Offline, Ada data harian.
- Tiap bar menampilkan label, rasio, dan bar progres berwarna semantik.
- **Catatan:** kartu ini hanya ringkasan. Tautan detail dinonaktifkan karena layar WIM di luar lingkup fase ini.

**Kartu Aktivitas Terkini**
- Daftar kejadian dengan titik berwarna sesuai jenis, teks kejadian, dan waktu.
- Diperbarui melalui SSE. Entri terbaru muncul di posisi teratas.

---

## 8. Spesifikasi Layar: Peta Aset

Layar tiga kolom: panel layer di kiri, kanvas peta di tengah, panel daftar/detail di kanan.

### 8.1 Panel layer (kiri, 250px)

Menampilkan ruas aktif di bagian atas, lalu daftar layer peta.

| Layer | Warna marker | Punya daftar |
|---|---|---|
| CCTV | Hijau | Ya |
| VMS | Amber | Ya |
| Jaringan FO | Cyan | Ya — daftar koneksi |
| GPS Kendaraan | Biru | Ya |
| Gerbang Tol | Merah | Ya |
| WIM | Ungu | Ya |
| Cuaca | Sky | Tidak — hanya toggle |
| SOS | Rose | Ya |

**Struktur baris layer**
- Ikon layer berwarna sesuai jenis aset.
- Nama layer dan jumlah titik.
- **Badge gangguan** berbentuk pil merah berisi jumlah item berstatus offline atau error pada ruas aktif. Badge disembunyikan bila nilainya nol. Untuk layer SOS, badge menghitung tiket yang belum selesai.
- Toggle switch di ujung kanan.

> **Pembagian interaksi baris layer:** mengklik area teks atau ikon membuka daftar aset pada panel kanan. Mengklik toggle switch hanya menyalakan atau mematikan marker layer di peta, tanpa mengubah panel kanan. Kedua aksi tidak boleh saling memicu.

### 8.2 Kanvas peta (tengah)
- Peta dasar Google Maps dengan gaya mengikuti tema aplikasi.
- Marker aset digambar sesuai layer yang aktif. Marker berstatus kritis diberi animasi pulse.
- Koneksi Jaringan FO digambar sebagai arc deck.gl antar titik.
- Kontrol perbesar dan perkecil di kanan atas.
- Label ruas aktif di kiri atas.
- Tombol layar penuh peta.

### 8.3 Panel kanan (288px) — tiga state

| State | Isi | Pemicu |
|---|---|---|
| Kosong | Ikon dan ajakan "Klik salah satu layer di panel kiri untuk melihat daftarnya, atau klik marker di peta untuk detail." | State awal, atau setelah panel ditutup |
| Daftar | Judul layer, jumlah item, ruas aktif, kotak pencarian, dan daftar aset | Klik baris layer di panel kiri |
| Detail | Tombol kembali, chip jenis dan status, judul aset, atribut, serta pratinjau video untuk CCTV | Klik item pada daftar, atau klik marker di peta |

**Isi item daftar**

Tiap item memuat nama aset, satu baris keterangan, dan status pill. **Nama ruas tidak ditampilkan pada item** karena daftar sudah difilter mengikuti ruas aktif.

| Layer | Judul item | Keterangan |
|---|---|---|
| CCTV | Nama kamera | Posisi KM |
| VMS | Lokasi perangkat | Alamat IP |
| Jaringan FO | Asal → tujuan | Tipe dan bandwidth |
| GPS Kendaraan | Kode unit | Tipe dan kecepatan |
| Gerbang Tol | Nama gerbang | Catatan kondisi |
| WIM | Nama site | Ketersediaan data |
| SOS | Nomor tiket dan jenis | Lokasi kejadian |

**Perilaku daftar**
- Daftar difilter otomatis mengikuti ruas aktif pada header.
- Kotak pencarian menyaring berdasarkan nama item secara langsung tanpa submit.
- Mengklik item memusatkan peta ke marker terkait dan menyorotnya.
- Tombol kembali pada state detail mengembalikan panel ke daftar sebelumnya.

### 8.4 Mode layar penuh peta
- Sidebar, top bar, dan strip SOS disembunyikan. Peta mengisi seluruh layar.
- Panel layer kiri disembunyikan secara default, dibuka melalui tab vertikal bertuliskan **LAYER** yang menempel di tepi kiri layar pada posisi tengah.
- Saat panel layer terbuka, tab bergeser ke kanan menempel pada tepi panel dengan transisi 0.18 detik.
- Panel detail kanan disembunyikan secara default dan hanya muncul saat marker atau item diklik.
- Satu panel mengambang di kanan atas memuat status SSE, jam, dan tombol keluar layar penuh.
- Panel mengambang dan tab LAYER meredup otomatis setelah 2.6 detik tanpa gerakan kursor, dan muncul kembali saat kursor digerakkan.

---

## 9. Spesifikasi Layar: CCTV

### 9.1 Mode normal

**Panel daftar kamera (kiri, 250px)**
- Kotak pencarian kamera di bagian atas.
- Daftar kamera dengan titik status, nama kamera, dan posisi KM.
- Daftar difilter mengikuti ruas aktif.

**Toolbar**
- Nama ruas aktif.
- Ringkasan jumlah kamera online dan offline.
- Pemilih tata letak grid: 2×2, 3×3, 4×4.
- Tombol layar penuh.

**Grid kamera**
- Tile dengan rasio 16:9, radius 10px, jarak antar tile 14px.
- Latar tile memakai `--tile-1` dan `--tile-2` (gelap pada kedua tema).
- Overlay atas: titik status dan nama kamera, di atas gradien gelap.
- Overlay bawah: posisi KM dan label status, di atas gradien gelap.
- Teks overlay memakai `--on-scrim` dan `--on-scrim-dim`.
- Area dapat digulir bila jumlah kamera melebihi tinggi tampilan.

### 9.2 Mode layar penuh
- Sidebar, top bar, strip SOS, dan toolbar normal disembunyikan.
- **Grid mengisi seluruh layar tanpa gulir.** Tinggi tile menyesuaikan tinggi layar; rasio 16:9 tidak dipertahankan.
- Jumlah tile dipotong sesuai kapasitas grid: 2×2 menampilkan 4 kamera, 3×3 menampilkan 9, 4×4 menampilkan 16.
- Padding tepi layar dan jarak antar tile sama besar, yaitu 14px.
- Panel daftar kamera disembunyikan, dibuka melalui tab vertikal bertuliskan **KAMERA** di tepi kiri, dengan perilaku geser sama seperti tab LAYER pada peta.
- Satu panel mengambang di kanan atas memuat status SSE, jam, pemilih grid, dan tombol keluar layar penuh.
- Panel mengambang meredup otomatis setelah 2.6 detik tanpa gerakan kursor.

### 9.3 Pemutaran video
- Stream memakai protokol HLS dengan berkas `.m3u8`.
- Setiap tile menampilkan indikator LIVE saat stream berjalan.
- Kamera offline menampilkan ikon kamera tercoret dan label OFFLINE, tanpa upaya pemutaran.
- Sambung ulang otomatis dilakukan bila stream terputus, mengikuti pengaturan aplikasi.
- Jumlah stream serentak maksimum mengikuti kapasitas grid aktif.

---

## 10. Spesifikasi Layar: SOS Smart Response

### 10.1 Worklist (kiri, 300px)
- Judul panel dan jumlah tiket terbuka dalam pil merah.
- Kartu tiket memuat nomor tiket, status pill, jenis kejadian, ruas dan lokasi, serta ringkasan progres penanganan.
- Tiket terpilih ditandai latar sorot dan garis aksen di sisi kiri.

### 10.2 Panel detail

**Kepala**
- Nomor tiket, status tiket, dan status penanganan SOS.
- Jenis kejadian sebagai judul, diikuti ruas, lokasi, dan waktu pelaporan.
- Tombol **Konfirmasi Kedatangan** dan **Selesaikan Tiket**.

**Kartu Pelapor**
- Inisial pelapor, nama, dan nomor telepon.
- Koordinat lokasi kejadian.

**Kartu Lokasi Insiden**
- Peta mini setinggi 120px dengan marker merah beranimasi pulse pada titik kejadian.

**Kartu Smart Response — Kandidat Kendaraan**

| Elemen | Ketentuan |
|---|---|
| Ikon kendaraan | Sesuai tipe unit: patroli, ambulans, rescue, polisi, towing |
| Label unit | Kode dan nama unit. Kandidat utama diberi penanda UTAMA |
| Status pelacakan | Teks berwarna: hijau bila kedatangan terkonfirmasi, amber bila kemungkinan menuju SOS, abu untuk lainnya |
| Jarak dan kecepatan | Jarak ke titik kejadian dan kecepatan saat ini |
| Confidence | Nilai 0–1. Hijau bila ≥0.8, amber bila ≥0.5, merah bila di bawahnya |

Bila belum ada kandidat, tampilkan pesan "Belum ada kandidat kendaraan yang valid. Tracking sedang berjalan."

**Kartu Timeline Response**
- Rangkaian peristiwa vertikal dengan titik berwarna sesuai tahapan.
- Tiap entri memuat nama peristiwa, sumber data bila ada, dan waktu.
- Tahapan yang didukung: tracking dimulai, kandidat terdekat ditemukan, kemungkinan menuju SOS, tiba menunggu konfirmasi, kedatangan terkonfirmasi.

### 10.3 Perilaku realtime
- Tiket baru dari SSE masuk ke worklist tanpa memuat ulang halaman.
- Perubahan status kandidat dan timeline diperbarui langsung pada panel yang sedang terbuka.
- Badge sidebar, badge notifikasi, dan strip SOS selalu konsisten dengan jumlah tiket terbuka.
- Bila tiket yang sedang dibuka diselesaikan pengguna lain, tampilkan pemberitahuan dan perbarui statusnya.

---

## 11. Spesifikasi Layar: Pengguna & Akses

Halaman ini hanya dapat diakses oleh `super_admin`. Pengguna lain yang memaksa membuka rute ini harus diarahkan keluar atau menerima tampilan 403.

### 11.1 Tab Pengguna

**Toolbar**
- Tiga tab: Pengguna, Role & Permission, Hak Akses Menu.
- Kotak pencarian berdasarkan nama, username, dan email.
- Tombol **Tambah Pengguna**.

**Tabel pengguna**

| Kolom | Isi |
|---|---|
| Pengguna | Avatar inisial, nama lengkap, username |
| Role Efektif | Satu atau lebih chip role |
| Ruas | Ringkasan branch scope |
| Sumber | RBAC atau Legacy |
| Status | Pill Aktif (hijau) atau Nonaktif (abu) |

**Panel detail pengguna (kanan, 320px)**
- Kepala: avatar inisial, nama lengkap, username.
- Chip status aktif dan sumber capability.
- Identitas: username, nama lengkap, email, legacy role, subject ID, waktu pembaruan.
- Role efektif dalam bentuk chip.
- Permission efektif dalam bentuk chip monospace. Untuk super admin cukup tampilkan "Seluruh permission (*)".
- Branch scope dalam bentuk chip hijau.
- Tombol **Ubah** dan **Hapus**.

**Formulir tambah dan ubah pengguna**

| Field | Wajib | Keterangan |
|---|---|---|
| `username` | Ya (tambah) | Tidak dapat diubah setelah dibuat |
| `password` | Ya (tambah) | Bertopeng. Pada ubah, kosongkan bila tidak diganti |
| `full_name` | Ya | Nama lengkap pengguna |
| `display_name` | Tidak | Bila kosong, backend melakukan fallback |
| `email` | Tidak | Divalidasi format bila diisi |
| `external_subject_id` | Tidak | Untuk pemetaan akun OIDC |
| `role_codes` | Tidak | Multi-select dari katalog role |
| `branch_ids` | Tidak | Multi-select ruas |
| `is_active` | Tidak | Default aktif |

**Aturan**
- Nilai yang sudah ada wajib ter-prefill saat mengubah, termasuk role dan branch scope terpilih.
- Galat validasi dari server ditampilkan pada kolom terkait.
- Menonaktifkan pengguna memunculkan dialog konfirmasi.
- Menghapus pengguna memunculkan dialog konfirmasi yang menyebutkan username, nama lengkap, dan peringatan bahwa role serta branch assignment ikut terhapus.
- Setelah berhasil, tampilkan notifikasi sukses dan segarkan daftar.

### 11.2 Tab Role & Permission
- Kartu untuk tiap system role, minimal 340px per kolom, mengisi lebar secara otomatis.
- Isi kartu: ikon role, label, kode role, jumlah pengguna, deskripsi, jumlah permission, dan daftar permission.
- Blok informasi di bawah grid menegaskan role tidak dapat dibuat atau dihapus dari antarmuka.
- **Tombol tambah disembunyikan pada tab ini.**

### 11.3 Tab Hak Akses Menu

| Kolom | Isi |
|---|---|
| Menu | Ikon folder atau berkas, nama menu, kode menu. Submenu diberi indentasi 26px |
| Route | Path tujuan, atau tanda hubung untuk kategori |
| Tipe | Kategori atau Submenu |
| Hak Akses | Chip gate: biru untuk module, amber untuk permission, abu untuk tanpa batasan |
| Urutan | Nilai display order |
| Status | Pill Aktif atau Nonaktif |

**Formulir menu**
- Pilihan tipe: Kategori atau Submenu. Memilih Submenu menampilkan dropdown menu induk.
- Pilihan gate: Module (pilih module dan required access level), Permission (pilih permission), atau Tanpa batasan.
- `menu_code` wajib, unik, dan mengikuti pola huruf kecil, angka, serta garis bawah.
- Submenu tidak boleh memiliki submenu. Struktur dibatasi dua level.
- Kategori yang masih memiliki submenu tidak dapat dihapus.

---

## 12. Spesifikasi Layar: Pengaturan

Layar dua kolom: daftar kategori pengaturan di kiri (230px), isi pengaturan di kanan dengan lebar maksimum 660px.

| Kategori | Isi |
|---|---|
| Umum | Bahasa antarmuka, zona waktu, interval refresh data, mode layar penuh |
| Tampilan | Tema, warna aksen, kepadatan, animasi marker |
| CCTV | Sumber stream, tata letak default, sambung ulang otomatis, overlay nama kamera |
| Peta & Cuaca | Peta dasar, layer cuaca, refresh cuaca, arc jaringan FO |
| Notifikasi SOS | Suara alarm, popup otomatis, notifikasi gerbang bermasalah, notifikasi WIM offline |
| Koneksi | URL backend, mode autentikasi, sambung ulang SSE, timeout permintaan |
| Akun | Nama operator, peran, ruas cakupan, ubah kata sandi |

**Ketentuan**
- Tiap baris memuat label, keterangan singkat, dan kontrol berupa dropdown atau toggle.
- Tombol **Simpan Perubahan** dan **Reset** berada di bawah daftar.
- Perubahan tema diterapkan langsung tanpa menunggu simpan.
- Pengaturan disimpan pada preferensi pengguna dan dipulihkan saat aplikasi dibuka kembali.
- Baris pengaturan yang tidak relevan dengan hak akses pengguna disembunyikan.

---

## 13. Integrasi API Backend

Kontrak lengkap tiap endpoint mengacu pada dokumentasi backend. Tabel berikut memetakan endpoint yang dipakai per layar.

| Layar | Endpoint | Kegunaan |
|---|---|---|
| Login | `POST /api/auth/login` | Autentikasi kredensial lokal |
| Login | `GET /api/auth/me` | Capability: role, permission, branch scope |
| Login | `GET /api/menus` | Tree menu terfilter untuk navigasi |
| Dashboard | `GET /api/monitoring/summary` | Angka KPI dan ringkasan status |
| Dashboard | `GET /api/events/stream` | SSE untuk aktivitas dan peringatan |
| Peta Aset | `GET /api/assets/map` | Snapshot seluruh aset untuk marker |
| Peta Aset | `GET /api/cameras/branches` | Daftar ruas untuk pemilih dan filter |
| Peta Aset | `GET /api/network/links` | Koneksi jaringan FO untuk arc deck.gl |
| Peta Aset | `GET /api/events/stream` | Pembaruan posisi GPS dan status aset |
| CCTV | `GET /api/cameras` | Daftar kamera per ruas beserta status |
| CCTV | `GET /api/cameras/:id/stream` | URL stream HLS untuk pemutaran |
| SOS | `GET /api/sos/tickets` | Worklist tiket SOS |
| SOS | `GET /api/sos/tickets/:id` | Detail tiket, kandidat, dan timeline |
| SOS | `PUT /api/sos/tickets/:id` | Konfirmasi kedatangan dan penyelesaian tiket |
| SOS | `GET /api/events/stream` | Tiket baru dan perubahan status realtime |
| Pengguna & Akses | `GET /api/users` | Daftar pengguna internal |
| Pengguna & Akses | `GET /api/users/:id` | Detail pengguna untuk panel dan prefill |
| Pengguna & Akses | `POST /api/users` | Membuat pengguna baru |
| Pengguna & Akses | `PUT /api/users/:id` | Mengubah pengguna, role, dan branch scope |
| Pengguna & Akses | `DELETE /api/users/:id` | Menghapus pengguna |
| Pengguna & Akses | `GET/POST/PUT/DELETE /api/admin/menus` | CRUD menu dan hak aksesnya |

**Ketentuan umum integrasi**
- Seluruh permintaan menyertakan Bearer token pada header Authorization.
- Kode `401` memicu pembersihan sesi dan pengalihan ke layar login.
- Kode `403` menampilkan state tidak berwenang, bukan halaman kosong.
- Kode `400` menampilkan galat validasi pada kolom terkait formulir.
- Setiap daftar wajib memiliki state memuat, state kosong, dan state gagal dengan aksi coba lagi.
- Koneksi SSE disambungkan ulang otomatis dengan jeda bertingkat. Indikator status pada top bar mencerminkan kondisi koneksi sebenarnya.
- Data snapshot di-cache pada state aplikasi dan disegarkan sesuai interval pada pengaturan.

---

## 14. Kriteria Penerimaan

### 14.1 Autentikasi dan navigasi

**Given** pengguna berada di layar login dengan kredensial valid
**When** pengguna menekan tombol Masuk
**Then** sistem mengambil capability dan menu, lalu menampilkan Dashboard dengan ruas default sesuai branch scope pengguna

**Given** pengguna tidak memiliki permission untuk sebuah menu
**When** navigasi dirender
**Then** menu tersebut tidak muncul di sidebar, dan kategori tanpa submenu terlihat juga ikut disembunyikan

**Given** token pengguna kedaluwarsa
**When** permintaan API mengembalikan 401
**Then** sesi dibersihkan dan pengguna diarahkan ke layar login tanpa menampilkan layar kosong

### 14.2 Peta aset

**Given** panel kanan berada pada state kosong
**When** pengguna mengklik area teks pada baris layer CCTV
**Then** panel kanan menampilkan daftar kamera pada ruas aktif, dan marker layer di peta tidak berubah

**Given** layer CCTV sedang aktif di peta
**When** pengguna mengklik toggle switch pada baris layer CCTV
**Then** marker CCTV disembunyikan dari peta, dan isi panel kanan tidak berubah

**Given** sebuah layer memiliki tiga aset berstatus offline pada ruas aktif
**When** panel layer dirender
**Then** baris layer menampilkan badge merah berisi angka 3

**Given** panel kanan menampilkan daftar aset
**When** pengguna mengklik salah satu item
**Then** panel berpindah ke tampilan detail, dan peta memusatkan serta menyorot marker aset tersebut

**Given** peta berada pada mode layar penuh
**When** layar pertama kali masuk mode tersebut
**Then** panel layer kiri dan panel detail kanan keduanya tersembunyi, hanya tab LAYER dan panel mengambang yang terlihat

**Given** mode layar penuh peta aktif dan panel layer terbuka
**When** pengguna tidak menggerakkan kursor selama 2.6 detik
**Then** tab LAYER dan panel mengambang meredup, lalu muncul kembali saat kursor digerakkan

### 14.3 CCTV

**Given** CCTV berada pada mode layar penuh dengan grid 3×3
**When** grid dirender
**Then** tepat 9 tile mengisi seluruh layar tanpa gulir, dengan padding tepi dan jarak antar tile sama besar 14px

**Given** mode layar penuh CCTV aktif
**When** pengguna mengubah grid dari 4×4 ke 2×2 melalui panel mengambang
**Then** grid menampilkan 4 tile yang mengisi penuh layar tanpa menyisakan ruang kosong di tepi

**Given** aplikasi memakai tema terang
**When** grid CCTV dirender
**Then** tile tetap berlatar gelap dan label nama kamera serta KM terbaca jelas di atas scrim

**Given** sebuah kamera berstatus offline
**When** tile kamera tersebut dirender
**Then** tile menampilkan ikon kamera tercoret dan label OFFLINE, tanpa upaya memutar stream

### 14.4 SOS

**Given** terdapat dua tiket SOS terbuka
**When** pengguna berada di layar mana pun
**Then** strip SOS tampil di bawah top bar, badge sidebar menampilkan angka 2, dan badge notifikasi menampilkan angka yang sama

**Given** tiket SOS baru masuk melalui SSE
**When** pengguna sedang membuka worklist
**Then** tiket muncul di daftar tanpa memuat ulang halaman, dan seluruh penghitung diperbarui

**Given** sebuah tiket memiliki kandidat dengan confidence 0.92
**When** kartu Smart Response dirender
**Then** nilai confidence ditampilkan dengan warna hijau, dan kandidat utama diberi penanda UTAMA

**Given** sebuah tiket belum memiliki kandidat kendaraan
**When** panel detail dibuka
**Then** kartu Smart Response menampilkan pesan bahwa tracking sedang berjalan, bukan daftar kosong

### 14.5 Pengguna dan hak akses

**Given** pengguna login bukan super admin
**When** pengguna memaksa membuka rute Pengguna & Akses
**Then** sistem menampilkan state 403 atau mengarahkan keluar, bukan menampilkan data pengguna

**Given** super admin berada di tab Role & Permission
**When** toolbar dirender
**Then** tombol tambah tidak ditampilkan, karena role tidak dapat dibuat dari antarmuka

**Given** super admin menekan Hapus pada seorang pengguna
**When** dialog konfirmasi muncul
**Then** dialog menampilkan username, nama lengkap, dan peringatan bahwa role serta branch assignment ikut terhapus

**Given** sebuah menu memakai gate module
**When** tabel Hak Akses Menu dirender
**Then** chip gate berwarna biru, gate permission berwarna amber, dan tanpa batasan berwarna abu sehingga ketiganya dapat dibedakan

### 14.6 Tema dan tampilan

**Given** aplikasi memakai tema gelap
**When** pengguna menekan tombol ganti tema pada top bar
**Then** seluruh layar berpindah ke tema terang, termasuk teks yang diwarisi, tanpa memuat ulang halaman

**Given** aplikasi memakai tema terang
**When** layar mana pun dirender
**Then** tidak ada teks yang memakai warna terang di atas latar terang, dan seluruh teks memenuhi rasio kontras minimum 4.5:1

**Given** pengguna telah memilih tema terang lalu menutup aplikasi
**When** pengguna membuka aplikasi kembali
**Then** aplikasi tampil dengan tema terang sesuai preferensi terakhir

**Given** sidebar dalam keadaan terlipat
**When** terdapat tiket SOS terbuka
**Then** menu SOS menampilkan titik merah sebagai pengganti badge angka

---

## 15. Glosarium

| Istilah | Penjelasan |
|---|---|
| Ruas | Segmen jalan tol yang dikelola sebagai satu unit operasi. Pada API disebut branch. |
| Branch scope | Daftar ruas yang boleh diakses seorang pengguna. |
| Gerbang tol | Titik transaksi masuk atau keluar jalan tol, memuat sejumlah gardu dan perangkat. |
| VMS | Variable Message Sign, papan pesan elektronik di sepanjang ruas. |
| FO | Fiber optic, jaringan serat optik yang menghubungkan perangkat lapangan ke pusat kendali. |
| WIM | Weigh In Motion, sistem penimbangan kendaraan saat bergerak. |
| SOS | Laporan darurat dari pengguna jalan yang membutuhkan penanganan petugas. |
| Smart Response | Mekanisme pencocokan otomatis antara kejadian SOS dan unit penanganan terdekat berdasarkan posisi GPS. |
| Confidence | Nilai 0–1 yang menyatakan tingkat keyakinan sistem bahwa suatu unit sedang menuju atau telah tiba di lokasi SOS. |
| RBAC | Role Based Access Control, pengaturan hak akses berbasis peran. |
| Permission | Izin granular atas satu tindakan, contohnya `camera.view`. |
| Module access | Izin atas satu modul dengan tingkat akses none, read, write, atau delete. |
| Gate | Syarat hak akses yang menentukan apakah sebuah menu terlihat. |
| Capability source | Asal hak akses pengguna: RBAC untuk role modern, Legacy untuk kolom role lama. |
| SSE | Server Sent Events, kanal satu arah dari server untuk pembaruan realtime. |
| HLS | HTTP Live Streaming, protokol pemutaran video berbasis berkas `.m3u8`. |
| Scrim | Lapisan gelap transparan di atas gambar atau video agar teks tetap terbaca. |
| Token warna | Variabel warna bernama yang nilainya berubah mengikuti tema aktif. |
