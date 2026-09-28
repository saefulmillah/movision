# Peta Layar → Komponen → Endpoint

Versi 1.0 · 13 Agustus 2026

Tabel ini menghubungkan tiap layar dengan komponen yang menyusunnya dan
endpoint backend yang dipanggil. Kontrak lengkap endpoint ada pada
dokumentasi backend; spesifikasi perilaku ada pada
`Requirement-Implementasi.md`.

---

## Ringkasan rute

| Rute | Layar | Akses |
|---|---|---|
| `/login` | Login | Publik |
| `/` | Dashboard | Semua pengguna terautentikasi |
| `/peta` | Peta Aset | Gate module `asset` · read |
| `/cctv` | CCTV | Gate module `kamera` · read |
| `/sos` | SOS Smart Response | Gate permission `sos.view` |
| `/admin/users` | Pengguna & Akses | `super_admin` saja |
| `/pengaturan` | Pengaturan | Semua pengguna terautentikasi |

> Layar WIM di luar lingkup fase ini. Layer WIM pada peta tetap ada.

---

## 1. Login — `/login`

**Komponen**: LoginSplitLayout, BrandPanel, StatChip, TextInput, PasswordInput, Checkbox, Button (primary), Button (secondary/SSO), Divider.

| Endpoint | Kegunaan | Dipanggil saat |
|---|---|---|
| `POST /api/auth/login` | Autentikasi kredensial lokal | Submit formulir |
| `GET /api/auth/me` | Capability: role, permission, branch scope | Setelah login berhasil |
| `GET /api/menus` | Tree menu terfilter | Setelah capability diterima |

**State**: `idle → validating → submitting → (error | success)`.

---

## 2. Dashboard — `/`

**Komponen**: AppShell, Sidebar, TopBar, SosStrip, KpiCard ×6, Card, MiniMap, MapLegend, DataTable (peringatan gerbang), TicketList, ProgressBar ×4, ActivityFeed.

| Endpoint | Kegunaan | Pola |
|---|---|---|
| `GET /api/monitoring/summary` | Angka KPI dan ringkasan | Sekali saat masuk + polling sesuai interval pengaturan |
| `GET /api/events/stream` | Aktivitas terkini, peringatan gerbang, SOS | SSE persisten |

**Catatan**: kartu Monitoring WIM hanya menampilkan ringkasan; tautan detail dinonaktifkan.

---

## 3. Peta Aset — `/peta`

**Komponen**: AppShell, LayerPanel, LayerRow ×8, AlertBadge, MapCanvas, Marker, ArcLayer, MapZoomControl, AssetListPanel, SearchInput, AssetListItem, AssetDetailPanel, EdgeTab (LAYER), FloatingToolbar.

| Endpoint | Kegunaan | Pola |
|---|---|---|
| `GET /api/assets/map` | Snapshot aset untuk marker dan daftar | Sekali + polling interval |
| `GET /api/cameras/branches` | Daftar ruas untuk pemilih dan filter | Sekali saat masuk |
| `GET /api/network/links` | Koneksi FO untuk arc deck.gl | Sekali + polling interval |
| `GET /api/events/stream` | Posisi GPS dan perubahan status aset | SSE persisten |

**State panel kanan**: `empty → list → detail`.

| Transisi | Pemicu |
|---|---|
| `empty → list` | Klik zona teks LayerRow |
| `list → detail` | Klik AssetListItem, atau klik Marker |
| `empty → detail` | Klik Marker saat panel kosong |
| `detail → list` | Tombol kembali |
| `* → empty` | Tombol tutup |

**State lain**: `layers{}` (visibilitas per layer), `mapFull`, `mapLayersOpen`, `petaSearch`, `petaSel`, `uiVisible`.

Sumber data daftar per layer: CCTV dan VMS dari `/api/assets/map`; FO dari `/api/network/links`; GPS dari SSE; Gerbang dari `/api/assets/map`; SOS dari `/api/sos/tickets`.

---

## 4. CCTV — `/cctv`

**Komponen**: AppShell, CameraListPanel, SearchInput, CameraListItem, CctvToolbar, GridSelector, CameraGrid, CameraTile, EdgeTab (KAMERA), FloatingToolbar, HlsPlayer.

| Endpoint | Kegunaan | Pola |
|---|---|---|
| `GET /api/cameras` | Daftar kamera per ruas + status | Sekali per perubahan ruas + polling |
| `GET /api/cameras/:id/stream` | URL stream HLS | Saat tile akan diputar |
| `GET /api/events/stream` | Perubahan status kamera | SSE persisten |

**State**: `cctvLayout` (4 | 9 | 16), `cctvFull`, `cctvListOpen`, `uiVisible`, `cameraQuery`.

**Aturan jumlah stream**: mode layar penuh hanya memutar n² stream sesuai grid. Mode normal memutar tile yang terlihat di viewport.

---

## 5. SOS Smart Response — `/sos`

**Komponen**: AppShell, WorklistPanel, TicketCard, TicketDetailHeader, Button (Konfirmasi Kedatangan / Selesaikan Tiket), ReporterCard, IncidentMiniMap, SmartResponseCard, CandidateRow, ConfidenceValue, Timeline, TimelineEntry.

| Endpoint | Kegunaan | Pola |
|---|---|---|
| `GET /api/sos/tickets` | Worklist tiket | Sekali + refresh via SSE |
| `GET /api/sos/tickets/:id` | Detail, kandidat, timeline | Saat tiket dipilih |
| `PUT /api/sos/tickets/:id` | Konfirmasi kedatangan, penyelesaian | Aksi tombol |
| `GET /api/events/stream` | Tiket baru dan perubahan status | SSE persisten |

**State**: `selectedTicketId`, `tickets[]`, `ticketDetail`.

**Konsistensi wajib**: jumlah tiket terbuka harus sama di badge sidebar, badge notifikasi TopBar, SosStrip, kartu SOS Aktif pada Dashboard, dan badge layer SOS pada peta. Semua bersumber dari satu state.

---

## 6. Pengguna & Akses — `/admin/users`

**Komponen**: AppShell, Tabs ×3, SearchInput, Button (Tambah), UserTable, UserRow, Avatar, RoleChip, UserDetailPanel, PermissionChip, BranchChip, UserFormModal, ConfirmDialog, RoleCard, MenuTable, MenuRow, GateChip, MenuFormModal.

| Endpoint | Kegunaan | Dipanggil saat |
|---|---|---|
| `GET /api/users` | Daftar pengguna | Masuk tab Pengguna |
| `GET /api/users/:id` | Detail pengguna | Pilih baris, buka form ubah |
| `POST /api/users` | Buat pengguna | Submit form tambah |
| `PUT /api/users/:id` | Ubah pengguna, role, branch scope | Submit form ubah |
| `DELETE /api/users/:id` | Hapus pengguna | Konfirmasi dialog hapus |
| `GET /api/cameras/branches` | Opsi `branch_ids` | Buka form tambah/ubah |
| `GET /api/admin/menus` | Daftar menu flat | Masuk tab Hak Akses Menu |
| `GET /api/admin/menus/{id}` | Detail menu | Buka form ubah menu |
| `POST /api/admin/menus` | Buat menu/submenu | Submit form tambah menu |
| `PUT /api/admin/menus/{id}` | Ubah menu | Submit form ubah menu |
| `DELETE /api/admin/menus/{id}` | Hapus menu | Konfirmasi dialog hapus menu |

**State**: `usersTab` (pengguna | role | menu), `selectedUserId`, `userQuery`, `formMode`.

**Katalog role**: hardcode di frontend (`super_admin`, `operator_cctv`, `operator_asset`, `operator_sos`, `viewer_branch`). Tidak ada endpoint role master.

**Penjaga akses**: seluruh rute ini hanya untuk `super_admin`. Non-super-admin diarahkan keluar atau menerima state 403.

---

## 7. Pengaturan — `/pengaturan`

**Komponen**: AppShell, SettingsTabList, SettingsRow, Select, Toggle, Button (Simpan / Reset).

| Endpoint | Kegunaan |
|---|---|
| `GET /api/auth/me` | Data akun untuk kategori Akun |
| `GET /api/cameras/branches` | Ruas cakupan |

Sebagian besar pengaturan bersifat preferensi klien dan disimpan lokal.
Perubahan tema diterapkan langsung tanpa menunggu tombol simpan.

---

## Lintas layar

| Kebutuhan | Ketentuan |
|---|---|
| Bearer token | Disertakan pada seluruh permintaan |
| `401` | Bersihkan sesi, arahkan ke `/login` |
| `403` | Tampilkan state tidak berwenang |
| `400` | Tampilkan galat validasi pada kolom terkait |
| SSE | Satu koneksi bersama untuk seluruh aplikasi, disambung ulang dengan jeda bertingkat |
| Ruas aktif | State global; mengubahnya memicu refetch daftar aset, kamera, dan tiket |
| Tema | State global; disimpan pada preferensi dan dipulihkan saat aplikasi dibuka |
| State memuat | Skeleton pada kartu dan tabel |
| State kosong | Ikon + kalimat ajakan, bukan area kosong |
| State galat | Pesan + tombol coba lagi |
