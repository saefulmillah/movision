# Restrukturisasi Menu — Grup "Rapat Direktorat"

Berlaku untuk **kedua repo**. Modul-modul menjadi **sub-menu** di bawah satu menu induk.

```
Rapat Direktorat            (grup menu induk — bukan halaman)
├── Laba Rugi               → /rapat-direktorat/laba-rugi          module: laba_rugi
├── Manajemen Risiko        → /rapat-direktorat/manajemen-risiko   module: manajemen_risiko
└── Pendapatan              → /rapat-direktorat/pendapatan         module: pendapatan
```

## Aturan
- **Modul tetap terpisah** (kode, tabel, RBAC module masing-masing). Grup hanya pengelompokan navigasi.
- **RBAC**: tiga module code — `laba_rugi`, `manajemen_risiko`, `pendapatan`. Peran `manajemen` mendapat READ pada ketiganya; `super_admin` RW. Menu induk tampil bila user punya akses ke **minimal satu** anak.

## Frontend
- Grup "Rapat Direktorat" di navigasi `AppShell` (atau sumber menu backend `menu.routes.js` bila server-driven), dengan tiga anak. Ikon saran: grup "presentation"; Laba Rugi "bar-chart-3"; Manajemen Risiko "shield-alert"; Pendapatan "trending-up".

## Backend
- Bila menu server-driven (`menu.routes.js`), daftarkan node grup + tiga anak dengan module code masing-masing agar filter RBAC menu bekerja.
- Endpoint & module code tiap modul tidak berubah: `/api/laba-rugi`, `/api/risk`, `/api/pendapatan`.
