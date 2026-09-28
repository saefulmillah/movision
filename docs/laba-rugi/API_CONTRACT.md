# Kontrak API — Modul Laba Rugi

Base: `/api/laba-rugi` (proxy dev `/api` → backend sudah ada di `vite.config.ts`). Semua butuh Bearer token + module access `laba_rugi`. Respons berformat `{ status, message, data }`.

## GET /api/laba-rugi/periods
Daftar periode untuk dropdown.
```json
{ "status":200, "message":"OK", "data":[
  { "key":"2026-08", "label":"SD Agustus 2026", "validation_passed":true, "uploaded_at":"..." },
  { "key":"2026-07", "label":"SD Juli 2026", "validation_passed":true }
]}
```
Frontend hanya menawarkan periode `validation_passed=true` (atau tandai jelas yang tidak).

## GET /api/laba-rugi/:periodKey
Data satu periode untuk 3 tampilan.
```jsonc
{ "status":200, "message":"OK", "data":{
  "meta": { "period_key":"2026-08", "period_label":"SD Agustus 2026", "unit":"Rp juta" },
  "accounts": [ {"id":"pend_usaha","label":"Pend. Usaha","type":"section"}, ... ],   // urutan & jenis baris
  "regionals": [ {"id":"JKT","members":["JORR S","ATP"]}, ... ],
  "ruas": [ {"id":"JORR S","regional":"JKT"}, ... ],
  "total_definition": ["JKT","JTTS","PBBL","DIVISI"],
  "entities": { "JKT": { "pend_usaha":[881847.1,902466.4], "eat":[12523.2,136184.0], ... }, ... },
  "konsol":   { "AGUSTUS 2026":{...}, "SD AGUSTUS 2026":{...}, "SEPTEMBER 2026":{...}, "SD SEPTEMBER 2026":{...} }
}}
```
Setiap nilai = `[RKAP, REAL]`; `null`/0 → tampil "–". Bentuk ini identik dengan `sample-output/data-2026-08.json` di paket backend dan dengan data inline pada `dashboard-reference.html`.

## POST /api/laba-rugi/import  (module WRITE — super_admin)
`multipart/form-data`, field `file` = `.xlsx`. Satu langkah: parse → validasi → simpan bila lolos.
```json
{ "status":200, "message":"Berhasil diimpor", "data":{
  "period_key":"2026-08", "period_label":"SD Agustus 2026",
  "validation": { "passed":true, "n_checks":30, "n_failed":0, "checks":[...] }
}}
```
Bila `validation.passed=false`: kembalikan ringkasan (status 200/422 sesuai konvensi repo) **tanpa menyimpan**; UI menampilkan daftar `checks` yang gagal.

## Perhitungan di frontend
- **HPP (%)** = `beban_langsung / pend_usaha` per kolom (tidak dikirim backend).
- **Konsolidasi/Total** dibaca dari `konsol["SD <Bulan> <Tahun>"]` (jangan menjumlah kolom regional — JTTS sudah subtotal).
