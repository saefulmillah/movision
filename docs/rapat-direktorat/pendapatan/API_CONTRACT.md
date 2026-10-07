# Kontrak API — Modul Pendapatan

Base `/api/pendapatan`. Bearer + module access `pendapatan`. Respons `{status,message,data}`.
Bentuk data = `../backend/sample-output/pendapatan-2026-08.json`.

## GET /api/pendapatan/periods
```json
{ "status":200,"message":"OK","data":[ {"key":"2026-08","label_month":"Agustus 2026","label_sd":"SD Agustus 2026"} ] }
```

## GET /api/pendapatan/:periodKey
```jsonc
{ "status":200,"message":"OK","data":{
  "meta":{ "period_key":"2026-08","period_label_month":"Agustus 2026","period_label_sd":"SD Agustus 2026",
           "unit_source":"Rp juta","unit_kpi_display":"Rp miliar" },
  "kpi_month":{ "tol":{"rkap":330796.8,"real":331685.6,"ach":100},
                "usaha_lainnya":{"rkap":33495.3,"real":29855.x,"ach":89},
                "total":{"rkap":364292.1,"real":361543.7,"ach":99} },
  "kpi_sd":{ "tol":{...107}, "usaha_lainnya":{...98}, "total":{"rkap":2712258.1,"real":2870344.0,"ach":106} },
  "lhr":[ {"ruas":"JORR S","regional":"JKT","rkap":144558,"real":150469,"ach":104}, ... ],   // 12 ruas
  "pendapatan_ruas":[ {"ruas":"JORR S","regional":"JKT","rkap":571839,"real":585347,"ach":102}, ... ]
}}
```

## POST /api/pendapatan/import  (WRITE — super_admin)
`multipart/form-data`: `prog_ii` (file .xlsx), `evaluasi` (file .xlsx), `month` (mis. "AGUSTUS"), `year` (2026).
```json
{ "status":200,"message":"Berhasil diimpor","data":{ "period_key":"2026-08" } }
```

## Perhitungan di frontend
- KPI ditampilkan **Rp miliar** = nilai (juta) ÷ 1000, 2 desimal (format id-ID: `Rp 2.712,26 M`).
- Warna % ACH: ≥100 hijau, 90–99 kuning, <90 merah.
- Grafik: bar RKAP (biru muda) vs Realisasi (merah), % di atas, dikelompokkan per regional (JKT/SUMBAGSEL/SUMBAGTENG/SUMBAGUT) dengan pemisah.
