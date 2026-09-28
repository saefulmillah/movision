# Brief Implementasi Frontend — Halaman Manajemen Risiko (movision / TollSentra)

> Untuk Claude Code, di repo `movision`. Ikuti design system repo. Branch `feature/manajemen-risiko`.
> Sub-menu di grup **"Rapat Direktorat"** (lihat `../MENU_RESTRUCTURE.md`).

## 0. Keputusan terkunci
- Halaman **Manajemen Risiko**: **heat map 5×5** + **tabel Top Risk** + **form CRUD input langsung** (tanpa Excel).
- Data dari `/api/risk` (lihat `API_CONTRACT.md`). RBAC module `manajemen_risiko` (`super_admin` RW, `manajemen` R).
- Referensi visual + logika heat map lengkap: **`risk-reference.html`** (sudah cocok dgn slide). Porting ke React + design system TollSentra.

## 1. Referensi konvensi (BACA di repo)
- `src/App.tsx`, `components/RouteGuards` — route + guard.
- `src/pages/incident/IncidentPage.tsx` / `news/NewsPage.tsx` — pola halaman CRUD (list + form/modal).
- `src/constants/rbac.ts` — katalog RBAC (sinkron backend).
- `src/lib/**` — API client.
- `components/shell/AppShell` + sumber menu — untuk grup "Rapat Direktorat".
- Radix: Dialog (form), Select (dropdown 1–5), Tabs bila perlu.

## 2. Tugas

### 2.1 RBAC — `src/constants/rbac.ts`
- Tambah `"manajemen_risiko"` ke `MODULE_CODES`, `"feature.manajemen_risiko.view"` ke `PERMISSION_CODES`.
- Pastikan peran `manajemen` punya permission itu (peran dibuat di modul Laba Rugi).

### 2.2 API client — `src/lib/risk.ts`
- `getMatrix()`, `getPeriods()`, `getPeriod(key)`, `createPeriod()`, `upsertItem(key,item)`, `deleteItem(id)`, `publishPeriod(key)`.

### 2.3 Tipe — `src/types/risk.ts`
- `MatrixCell{no,impact,likelihood,level}`, `Level='L'|'LM'|'M'|'MH'|'H'`, `Stage='inherent'|'expected'|'residual'`, `RiskItem`, `PeriodData`.

### 2.4 Komponen Heat Map — `src/pages/rapat-direktorat/manajemen-risiko/RiskHeatmap.tsx`
- **SVG 5×5** (port dari `risk-reference.html`): sumbu Dampak (kolom 1–5) × Kemungkinan (baris, 5 atas → 1 bawah).
- Warna sel dari `levels[level].color`; nomor sel di pojok.
- Bubble per (risk,stage): Inherent hitam, Expected abu, Residual putih-outline, berlabel `rank`. Kelompokkan & sebar bila satu sel berisi banyak bubble (lihat algoritma di `risk-reference.html`).
- Posisi: `cell.no` → `{impact,likelihood}` dari matriks → koordinat.

### 2.5 Halaman — `ManajemenRisikoPage.tsx` (+ `.module.css`)
- Kiri: `RiskHeatmap`. Kanan: tabel Top Risk (Peringkat, Peristiwa+Dampak, 3× [Exposure chip + Nilai]). Chip warna per level.
- Filter **Periode** (Select). Legend Inherent/Expected/Residual + zona level.
- **Form CRUD** (khusus WRITE): Dialog tambah/ubah risiko — field: Peringkat, Peristiwa, Deskripsi Dampak, dan untuk tiap stage: **Kemungkinan (1–5)**, **Dampak (1–5)**, **Nilai**. `cell`/`level` TIDAK diinput (dihitung backend); tampilkan **preview** posisi/level saat memilih. Tombol Hapus per baris, tombol **Publikasikan** periode.
- Pakai design system TollSentra (tokens/komponen repo), bukan gaya file referensi mentah. Tema mengikuti app.

### 2.6 Route & menu
- `src/App.tsx`: `<Route path="/rapat-direktorat/manajemen-risiko" element={<RequireRole ...><ManajemenRisikoPage/></RequireRole>} />`.
- Menu: item "Manajemen Risiko" di bawah grup "Rapat Direktorat" (lihat `../MENU_RESTRUCTURE.md`).

## 3. Kriteria terima
1. Login super_admin → grup "Rapat Direktorat" → "Manajemen Risiko" tampil.
2. Pilih Agustus 2026 → heat map & tabel cocok `risk-reference.html` / slide.
3. Tambah/ubah risiko: pilih Kemungkinan+Dampak → preview level/posisi benar → simpan → heat map update.
4. Peran tanpa akses → menu tak muncul & route 403.

## 4. Catatan
- `risk-reference.html` = sumber kebenaran tampilan & algoritma bubble. Porting logikanya, jangan embed HTML mentah.
- Jangan sentuh `main`.
