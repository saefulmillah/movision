# Restrukturisasi Menu — Grup "Rapat Direktorat"

Berlaku untuk **kedua repo**. Modul Laba Rugi (sudah di-handoff) dan Manajemen Risiko menjadi **sub-menu** di bawah satu menu induk.

```
Rapat Direktorat            (grup menu induk — bukan halaman)
├── Laba Rugi               → /rapat-direktorat/laba-rugi        module: laba_rugi
└── Manajemen Risiko        → /rapat-direktorat/manajemen-risiko  module: manajemen_risiko
```

## Aturan
- **Modul tetap terpisah** (kode, tabel, RBAC module masing-masing). Grup hanya pengelompokan navigasi.
- **RBAC**: dua module code berbeda — `laba_rugi` dan `manajemen_risiko`. Peran `manajemen` mendapat READ pada keduanya; `super_admin` RW keduanya. Menu induk "Rapat Direktorat" tampil bila user punya akses ke **minimal satu** anak.

## Penyesuaian pada modul Laba Rugi (jika sudah/akan dibuat)
- Route frontend: `/laba-rugi` → **`/rapat-direktorat/laba-rugi`** (atau tambahkan grup tanpa mengubah path bila menu server-driven; samakan dengan mekanisme menu repo).
- Item menu dipindah ke bawah grup "Rapat Direktorat".
- Endpoint & module code backend **tidak berubah** (`/api/laba-rugi`, `laba_rugi`).

## Frontend
- Tambah grup "Rapat Direktorat" di navigasi `AppShell` (atau sumber menu backend `menu.routes.js` bila server-driven), dengan dua anak di atas. Ikon: grup mis. "presentation"/"briefcase"; Laba Rugi "bar-chart-3"; Manajemen Risiko "shield-alert".

## Backend
- Jika menu digerakkan backend (`menu.routes.js`), daftarkan node grup + dua anak dengan module code masing-masing agar filter RBAC menu bekerja.
