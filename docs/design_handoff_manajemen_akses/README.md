# Handoff: Manajemen Akses Dinamis (TollSentra / Movision)

Area admin untuk mengelola RBAC dinamis — role, permission, modul, dan akses
per pengguna — tanpa deploy. Melengkapi halaman **Pengguna & Akses**
(`/admin/users`) yang sudah ada, menggantikan katalog role yang kini
di-hardcode dengan pengelolaan penuh ke backend `/api/admin/*`.

Versi 1.0 · 5 Oktober 2026 · Fidelity: **High-fidelity**

---

## Tentang berkas desain

Berkas dalam paket ini adalah **referensi desain yang dibuat dengan HTML**
(`Manajemen Akses.dc.html`) — prototipe interaktif yang menunjukkan tampilan,
alur, dan perilaku yang diinginkan, **bukan kode produksi untuk disalin**.

Tugas implementasi: **bangun ulang desain ini di dalam codebase `movision`**
(React + Vite + TS, CSS custom properties + CSS Modules) memakai pola dan
komponen yang sudah ada di sana — khususnya primitives di
`src/components/ui/` (Button, Tabs, Input, Modal, Switch, StatusPill, Select,
Pagination, Toast, EmptyState, Icon) dan shell di `src/components/shell/`.
Seluruh nilai desain sudah memakai token dari
`src/styles/design-tokens.css`, jadi tidak ada warna/ukuran literal baru yang
perlu diperkenalkan.

Prototipe memakai nilai final dari design system TollSentra. Implementasi
harus mengikuti tampilan ini secara presisi memakai pustaka codebase.

---

## Fidelity

**High-fidelity.** Warna, tipografi, spasi, radius, state, dan interaksi
sudah final dan diturunkan langsung dari `design-tokens.css`. Mendukung
**tema gelap & terang** (atribut `data-theme` pada pembungkus; prototipe
menyertakan tombol ganti tema pada TopBar untuk pratinjau).

---

## Gerbang akses & arsitektur informasi

- Seluruh area digerbang oleh permission **`access.manage`** (super admin
  otomatis lolos). Sumber otorisasi FE: `GET /api/auth/me`.
- Nav baru **"Manajemen Akses"** di sidebar. Di dalamnya: sebuah **Hub**
  (landing) dengan 4 sub-halaman — **Role**, **Pengguna**, **Permission**,
  **Modul**. Navigasi antar sub-halaman memakai breadcrumb di dalam konten;
  item sidebar "Manajemen Akses" tetap aktif di seluruh sub-halaman.

```
AppShell [data-theme]
├── Sidebar (236px)  — item "Manajemen Akses" aktif
└── MainColumn
    ├── TopBar (60px) — judul "Manajemen Akses" + badge access.manage + tema
    └── Content (padding 22px, max-width 1120px, scroll)
        ├── Hub         (ringkasan + 4 shortcut + "akses efektif saya")
        ├── Role        (list → Role editor)
        ├── Permission  (katalog grup)
        ├── Modul       (katalog grup)
        └── Pengguna    (list + panel akses efektif)
```

---

## Layar

### 1. Hub "Manajemen Akses"
- **Tujuan**: landing & ringkasan; titik masuk ke 4 sub-area.
- **Layout**: judul + subjudul; grid 4 kolom kartu statistik
  (Role / Pengguna / Permission / Modul) — angka 27px mono; grid 2 kolom
  kartu shortcut (ikon 42px, judul 14px, deskripsi 12px muted, meta mono
  11px, chevron kanan; hover: border `--st-blue` + translateY(-2px)); kartu
  "Akses efektif saya" (avatar, badge "Bypass penuh" hijau).
- **Bind**: statistik dari panjang list `GET /api/admin/{roles,permissions,
  modules}` dan `GET /api/users`; kartu akses efektif dari `GET /api/auth/me`.

### 2. Role — list
- **Kolom** (grid `2fr 1.3fr .7fr .9fr .8fr 84px`): Role (ikon + nama +
  gembok bila sistem + kode mono), Status (badge Sistem/Buatan + pill
  Aktif/Nonaktif), Pengguna (`user_count`), Permission (`permission_count`),
  Modul (`module_count`), aksi (Ubah, Hapus).
- **Guardrail**: baris `is_system` menampilkan gembok; tombol Hapus
  `disabled` + tooltip "Role sistem tak bisa dihapus".
- **Header**: pencarian + tombol **Buat Role** + (khusus prototipe) switcher
  pratinjau state **Normal / Memuat / Kosong / Galat**.
- **State**: Memuat = skeleton baris (shimmer, bukan spinner); Kosong =
  ikon + "Belum ada role buatan" + CTA; Galat = ikon merah + "Coba lagi".
- **Bind**: `GET /api/admin/roles`. Klik baris → Role editor.

### 3. Role editor (INTI — Model A: Matriks modul × level)
- **Header**: ikon role, nama (judul 20px), kode mono, badge "Role sistem" +
  gembok bila `is_system`, jumlah pengguna.
- **Banner sistem** (bila `is_system`): "tak bisa dinonaktifkan/dihapus;
  permission tak bisa dikurangi, boleh ditambah".
- **Kartu Informasi**: Nama (input), Kode (input terkunci + ikon gembok +
  label "permanen"), Deskripsi (textarea), toggle "Role aktif" (terkunci
  untuk role sistem).
- **Kartu Akses Modul (matriks)**: header kolom `Modul | Tidak ada | Lihat |
  Ubah | Hapus`; baris dikelompokkan per `module_group` (subheader abu).
  Tiap baris = nama+kode modul + **segmented 4-tombol** (satu per level).
  Sel aktif: latar tone + teks tone + ikon (minus/eye/pencil/trash) + bold.
  **Warna level**: Tidak ada = abu (`--st-gray`), Lihat = biru (`--st-blue`),
  Ubah = amber (`--st-amber`), Hapus = merah (`--st-rose`). Legenda di header
  kartu. Role sistem: semua terkunci di level **Hapus**.
- **Kartu Permission**: daftar dikelompokkan per `permission_group`; tiap
  grup punya "Pilih semua/Hapus semua". Item = kotak centang + nama + kode
  mono. Role sistem: permission existing terkunci-tercentang (gembok), boleh
  menambah yang lain.
- **Replace-set + unsaved**: mengubah apa pun memunculkan **bar bawah
  sticky** "Perubahan belum disimpan" + Batalkan + Simpan. Batalkan saat
  dirty → konfirmasi "Buang perubahan?".
- **Bind**: muat `GET /api/admin/roles/:id`. Simpan mengirim **seluruh set**:
  `PUT /api/admin/roles/:id/permissions` `{ permission_codes: [] }` dan
  `PUT /api/admin/roles/:id/module-access`
  `{ module_access: [{ module_code, access_level }] }`, plus
  `PUT /api/admin/roles/:id` untuk name/description/is_active.

### 4. Permission — katalog
- Daftar dikelompokkan per `permission_group` (feature, branch, camera,
  asset, sos, news, incident, feedback, user, access). Kolom: kode mono,
  nama, badge `role_count`, aksi (Ubah, Hapus). Tombol **Tambah Permission**.
- **Guardrail hapus**: bila `role_count > 0`, Hapus menampilkan modal
  "Tidak dapat dihapus" dengan rincian "dipakai oleh N role / N menu".
- **Bind**: `GET/POST/PUT/DELETE /api/admin/permissions`. `code` immutable.

### 5. Modul — katalog
- Banner info: "Modul baru hanya terdaftar; hubungkan ke menu & role agar
  aktif" (lihat limitasi dinamis). Daftar per `module_group`, urut
  `display_order`. Kolom: nama+kode, badge `role_count`, `#order`, toggle
  `is_active`, aksi.
- **Guardrail hapus**: modal blokir dengan "dipakai N role / N user override /
  N menu".
- **Bind**: `GET/POST/PUT/DELETE /api/admin/modules`. `code` immutable.

### 6. Pengguna + akses efektif
- **List** (kiri): avatar + nama + username, chip role, jumlah ruas, status.
- **Panel detail** (kanan, 340px): Role; **Akses Modul Efektif** — tiap baris
  menampilkan level (badge berwarna) + sumber ("dari role X") dan badge
  **OVERRIDE** amber bila ditimpa per-user; Branch Scope (chip hijau mono);
  Permission Efektif (chip mono).
- **Resolusi** (tampilkan apa adanya):
  `module efektif = MAX(level antar role) lalu DITIMPA override per-user`;
  `permission efektif = UNION antar role`; `super_admin = bypass total`;
  `branch scope = dari assignment per-user`.
- **Bind**: `GET /api/users` + `GET /api/users/:id`; opsi ruas dari
  `GET /api/cameras/branches`.

---

## Interaksi & perilaku

- **Ganti tema**: tombol matahari/bulan TopBar menukar `data-theme`.
- **Navigasi**: shortcut Hub & breadcrumb memakai state `screen` lokal; di
  app nyata petakan ke sub-route di bawah `/admin/akses` (atau serupa).
- **Matriks**: klik sel men-set level; `none` menghapus entri modul dari set.
- **Permission**: klik item toggle; "Pilih semua" per grup.
- **Dirty guard**: keluar dari editor saat ada perubahan → konfirmasi.
- **Toast**: sukses (hijau, `circle-check`) / galat (merah, `triangle-alert`),
  auto-hilang 2.6s.
- **Animasi**: `rise .32s` masuk layar; `slideUp .2s` bar unsaved & toast;
  `slideInRight .3s` panel detail; `blink 1.6s` titik SSE; `shimmer 1.4s`
  skeleton.

## Penanganan error API (wajib)
- `400` validasi: tandai field (mis. kode tak sesuai `^[a-z0-9_.]+$`), tampil
  inline. Form "Buat Role" sudah memvalidasi pola kode secara live.
- `409` guardrail: gunakan modal ramah (reassign untuk role dipakai user;
  blokir untuk permission/modul direferensi) memakai `data[]`
  (`sample_users`, `referenced_by_roles`, `assigned_user_count`).
- `403` tanpa `access.manage`: tampilkan state tidak berwenang.

---

## State management

| State | Keterangan |
|---|---|
| `screen` | hub \| roles \| editor \| perms \| modules \| users |
| `roleId` / `edit` | role terpilih + working copy (name, desc, isActive, `perms:Set`, `modules:{code:level}`) |
| `dirty` | ada perubahan belum disimpan → bar sticky |
| `modal` | create \| reassign \| blocked \| deleteRole \| cancel |
| `listState` | normal \| loading \| empty \| error (demo state) |
| `selectedUserId` | pengguna terpilih di layar Pengguna |
| `toast` | notifikasi sukses/galat |
| `theme` | dark \| light |

Editor memakai **replace-set**: kirim seluruh himpunan permission &
module-access, bukan delta.

---

## Design tokens

Semua dari `src/styles/design-tokens.css`. Yang dipakai:
- **Permukaan**: `--app-bg`, `--surface-1/2/3`, `--track`.
- **Teks**: `--text`, `--text-dim/muted/faint`.
- **Garis**: `--line-soft/line/line-strong`.
- **Status**: `--st-blue` (primer/Lihat), `--st-amber` (Ubah), `--st-rose`
  (Hapus), `--st-green` (aktif), `--st-gray` (nonaktif/Tidak ada). Chip =
  warna teks + latar alpha ~16%.
- **Tipografi**: IBM Plex Sans (UI) + IBM Plex Mono (kode/angka). Skala:
  micro 10.5 · xs 11 · sm 12 · base 12.5 · body 13 · md 13.5 · lg 14 · xl 16
  · 2xl 20 · kpi 27px.
- **Radius**: 5 (pill) · 8 (ikon) · 9 (tombol/input) · 10 (tile) · 12 (kartu).
- **Spasi**: 4 · 8 · 12 · 14 · 16 · 18 · 22.
- **Label level akses**: `Tidak ada · Lihat · Ubah · Hapus` (none/read/write/delete).

---

## Aset

- **Ikon Lucide** (versi 0.469.0) dirender sebagai **CSS mask** agar mewarisi
  `currentColor` — sama seperti `src/components/ui/Icon.tsx`. Di prototipe
  ikon di-inline sebagai data-URI (`icons.js`) agar mandiri; di codebase
  gunakan komponen `Icon` yang sudah ada. Nama ikon dipakai: shield,
  shield-check, cctv, siren, chart-column, eye, boxes, box, key-round, users,
  lock, pencil, trash-2, plus, search, check, minus, info, triangle-alert,
  ban, refresh-cw, chevron-right/down, user, circle-check, layout-dashboard,
  map, settings, radio-tower, bell, log-out, panel-left-close.
- Tidak ada aset gambar/logo kustom.

---

## Berkas

| Berkas | Isi |
|---|---|
| `Manajemen Akses.dc.html` | Prototipe interaktif lengkap — referensi utama. Semua layar, kedua tema, semua modal & state. |
| `icons.js` | Peta ikon Lucide (data-URI) yang dipakai prototipe. Tidak perlu di codebase (pakai `Icon.tsx`). |

### Cara membaca prototipe
Buka `Manajemen Akses.dc.html`. Hub → klik shortcut untuk masuk sub-area.
Di Role: coba switcher state (Normal/Memuat/Kosong/Galat), klik baris untuk
editor, ubah matriks/permission untuk memunculkan bar "Perubahan belum
disimpan". Tombol matahari/bulan di TopBar mengganti tema.

### Catatan penting
- Modul baru via katalog **belum otomatis** muncul di `/api/auth/me`
  (enumerasi masih dari konstanta) & belum terpasang ke menu/route —
  komunikasikan ekspektasi di UI.
- **Branch scope tetap per-user**, bukan atribut role.
- **Proteksi last-super-admin**: minimal satu user aktif harus super admin
  (relevan di layar Pengguna saat mencabut role terakhir).
