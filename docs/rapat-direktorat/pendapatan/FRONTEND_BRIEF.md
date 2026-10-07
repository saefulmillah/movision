# Brief Implementasi Frontend — Halaman Pendapatan (movision / TollSentra)

> Untuk Claude Code, repo `movision`. Ikuti design system repo. Branch `feature/pendapatan`.
> Sub-menu **ketiga** di grup "Rapat Direktorat". Lihat `../MENU_RESTRUCTURE.md`.

## 0. Konteks & keputusan
- Halaman **Pendapatan**: **2 blok KPI** (Agustus & SD Agustus) + **2 grafik batang** (Pencapaian LHR, Pencapaian Pendapatan) per ruas.
- Data dari `/api/pendapatan` (lihat `API_CONTRACT.md`). RBAC module `pendapatan` (`super_admin` RW, `manajemen` R).
- Referensi visual + logika lengkap: **`pendapatan-reference.html`** (sudah cocok 100% dgn slide). Porting ke React + design system TollSentra.

## 1. Referensi konvensi (BACA di repo)
- `src/App.tsx`, `components/RouteGuards`, `src/pages/**` (pola halaman), `src/constants/rbac.ts`, `src/lib/**`, `components/shell/AppShell` (menu).

## 2. Tugas
### 2.1 RBAC — `src/constants/rbac.ts`
- `MODULE_CODES` += `"pendapatan"`; `PERMISSION_CODES` += `"feature.pendapatan.view"`; peran `manajemen` dapat view.

### 2.2 API client — `src/lib/pendapatan.ts`
- `getPeriods()`, `getPeriod(key)`, `importPeriod(progIiFile, evaluasiFile, month, year)`.

### 2.3 Tipe — `src/types/pendapatan.ts`
- `KpiCell{rkap,real,ach}`, `RuasBar{ruas,regional,rkap,real,ach}`, `PeriodData{meta,kpi_month,kpi_sd,lhr[],pendapatan_ruas[]}`.

### 2.4 Komponen
- **`KpiBlock.tsx`** — blok KPI: judul periode, 3 baris (Tol/Usaha Lainnya/Total) × RKAP/Realisasi/%ACH. Tampil **Rp miliar** (juta÷1000). Warna % (≥100 hijau, 90–99 kuning, <90 merah).
- **`AchievementBarChart.tsx`** — grafik batang per ruas (RKAP vs Realisasi), label % di atas, nilai di atas bar, **pemisah & label regional** (JKT/SUMBAGSEL/SUMBAGTENG/SUMBAGUT). Port SVG dari `pendapatan-reference.html` (fungsi `drawBars`). Dipakai 2× (LHR & Pendapatan).

### 2.5 Halaman — `src/pages/rapat-direktorat/pendapatan/PendapatanPage.tsx` (+ `.module.css`)
- Filter **Periode** (Select). Dua `KpiBlock` berdampingan (Agustus & SD). Dua `AchievementBarChart` (LHR, Pendapatan).
- **Upload periode** (khusus WRITE): dua input file (PROG II + Evaluasi) + pilih bulan/tahun → `importPeriod` → refresh.
- Pakai design system TollSentra; tema mengikuti app.

### 2.6 Route & menu
- `src/App.tsx`: `/rapat-direktorat/pendapatan` (guard module `pendapatan`).
- Menu: item "Pendapatan" sebagai anak ketiga grup "Rapat Direktorat".

## 3. Kriteria terima
1. super_admin → grup "Rapat Direktorat" → "Pendapatan" tampil.
2. Pilih Agustus 2026 → KPI & grafik cocok `pendapatan-reference.html` / slide (Total SD 2.712,26→2.870,34 M / 106%; LHR SIBANCEH 249%).
3. Ganti periode → semua ikut berubah. Peran tanpa akses → 403.
4. Upload 2 file → tampilan ter-update.

## 4. Catatan
- `pendapatan-reference.html` = sumber kebenaran tampilan (format Rp miliar, warna %, pengelompokan regional, skala grafik). Porting logikanya, jangan embed HTML mentah.
- JORR S mendominasi skala grafik (nilai jauh lebih besar) — sama seperti slide; biarkan skala linear.
