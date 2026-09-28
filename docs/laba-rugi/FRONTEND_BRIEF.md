# Brief Implementasi Frontend — Halaman Laba Rugi (movision / TollSentra)

> Untuk dikerjakan di Claude Code, di dalam repo `movision`. Ikuti design system & pola yang SUDAH ADA. Branch `feature/dashboard-laba-rugi`.

## 0. Konteks & keputusan (terkunci)
- Halaman baru **Laba Rugi** dengan 3 tampilan: **Konsolidasi**, **Per Regional**, **Per Ruas** — mereplikasi slide 3–5 rapat direktorat.
- Data dari backend (lihat `API_CONTRACT.md`). RBAC: module `laba_rugi`; lihat `super_admin` & `manajemen`.
- Referensi visual + logika lengkap: **`dashboard-reference.html`** (HTML mandiri, sudah cocok 100% dgn slide) — porting ke React + komponen repo, JANGAN embed HTML mentah.

## 1. Referensi konvensi (BACA dulu di repo)
- `src/App.tsx` — pendaftaran route di dalam `RequireAuth` + `AppShell`; guard `RequireRole`. Lihat juga `components/RouteGuards`.
- `src/pages/**` — pola halaman `pages/<domain>/<Nama>Page.tsx` (+ `.module.css`). Contoh: `pages/incident/IncidentPage.tsx`, `pages/news/NewsPage.tsx`.
- `src/constants/rbac.ts` — katalog RBAC frontend (sinkron dgn backend `permissions.js`).
- `src/lib/**` — API client (Bearer token, base `/api`). Tiru untuk `laba-rugi`.
- `src/components/shell/AppShell` — navigasi/menu. Cek apakah menu dari backend (`menu.routes.js`) atau statis; tambah item "Laba Rugi" di jalur yang benar.
- Komponen tersedia: **Radix Tabs** (`@radix-ui/react-tabs`) untuk 3 tampilan, Radix Select untuk periode, Lucide icons, `styles/` tokens.

## 2. Tugas

### 2.1 RBAC — `src/constants/rbac.ts`
- Tambah `"laba_rugi"` ke `MODULE_CODES`.
- Tambah `"feature.laba_rugi.view"` ke `PERMISSION_CODES`.
- Tambah peran `manajemen` ke `ROLE_CATALOG` (label "Manajemen", ikon mis. "bar-chart-3", permission `feature.laba_rugi.view`); tambahkan permission itu juga ke `super_admin`.

### 2.2 API client — `src/lib/labaRugi.ts` (atau sesuai pola lib repo)
- `getPeriods()`, `getPeriod(periodKey)`, `importPeriod(file)` sesuai `API_CONTRACT.md`.

### 2.3 Tipe — `src/types/labaRugi.ts`
- `Period`, `PeriodData` (meta, accounts, regionals, ruas, entities, konsol), `Cell = [number|null, number|null]`.

### 2.4 Halaman — `src/pages/laba-rugi/LabaRugiPage.tsx` (+ `.module.css`)
Porting dari `dashboard-reference.html`:
- **Tabs** (Radix): Konsolidasi / Per Regional / Per Ruas.
- **Filter Periode** (Select, dari `getPeriods`, default terbaru yang lolos validasi).
- **Per Regional**: 6 kolom regional (RKAP/REAL), warna header per regional, baris berjenjang, HPP% (>100% merah), opsi kolom Total.
- **Per Ruas**: DIVISI + ruas (dikelompokkan warna per regional) + JTTS + PBBL; toggle "Sembunyikan ruas tanpa realisasi" (sisi REAL 0).
- **Konsolidasi**: kolom multi-periode dari `konsol` (Agustus, SD Agustus, September, SD September).
- Angka: format ribuan, negatif `(...)` merah, 0/null → "–", `tabular-nums`. Kolom "Uraian" & header sticky.
- **Ringkasan KPI** (Pend/Laba Operasi/EAT/EBITDA) dari `konsol["SD ..."]`.
- **Upload periode** (khusus WRITE/super_admin): tombol → pilih `.xlsx` → `importPeriod` → tampilkan ringkasan validasi; refresh daftar periode bila lolos.
- Gunakan **design system TollSentra** (tokens `styles/`, komponen repo) — bukan warna/gaya dari file referensi mentah. Dukung tema yang dipakai app.

### 2.5 Route & menu
- `src/App.tsx`: tambah `<Route path="/laba-rugi" element={<RequireRole ... ><LabaRugiPage/></RequireRole>} />` di dalam `AppShell` (samakan pola guard; gunakan module/permission `laba_rugi`).
- Tambah item menu "Laba Rugi" (ikon Lucide) di navigasi — di sumber yang benar (backend `menu.routes.js` bila menu server-driven, atau konfigurasi menu frontend).

## 3. Kriteria terima
1. Login sebagai super_admin → menu "Laba Rugi" muncul; halaman tampil 3 tab.
2. Pilih SD Agustus 2026 → angka cocok dgn slide (lihat `../backend/EXPECTED_VALUES.md`) dan `dashboard-reference.html`.
3. Ganti periode → semua tampilan ikut berubah.
4. Peran tanpa akses → menu tak muncul & route 403.
5. Upload berjalan (super_admin) dgn ringkasan validasi.
6. Responsif & tema mengikuti app; kolom/HPP terbaca (negatif merah, HPP>100% merah).

## 4. Catatan
- `dashboard-reference.html` = sumber kebenaran tampilan & aturan format (warna regional, urutan baris, hide-no-realisasi, definisi total). Porting logikanya, bukan file-nya.
- Jangan sentuh `main`.
