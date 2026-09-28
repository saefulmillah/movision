# Kontrak API — Modul Manajemen Risiko

Base `/api/risk`. Bearer token + module access `manajemen_risiko`. Respons `{status,message,data}`.

## GET /api/risk/matrix
Konfigurasi matriks appetite (untuk render heat map & dropdown).
```json
{ "status":200,"message":"OK","data":{
  "size":5,
  "axes":{ "impact":{"1":"Sangat Rendah","5":"Sangat Tinggi"}, "likelihood":{"1":"Sangat Jarang Terjadi","5":"Hampir Pasti Terjadi"} },
  "levels":{ "L":{"label":"Low","color":"#1e8e3e"}, "LM":{...}, "M":{...}, "MH":{...}, "H":{"label":"High","color":"#e23b34"} },
  "cells":[ {"no":14,"impact":3,"likelihood":4,"level":"M"}, ... ]   // 25 sel
}}
```

## GET /api/risk/periods
```json
{ "status":200,"message":"OK","data":[
  {"key":"2026-08","label":"Agustus 2026","status":"published"} ]}
```

## GET /api/risk/:periodKey
```jsonc
{ "status":200,"message":"OK","data":{
  "period":{ "key":"2026-08","label":"Agustus 2026","divisi":"...","unit":"Rp juta","status":"published" },
  "risks":[
    { "rank":1, "event":"Risiko Keterlambatan Penyesuaian Tarif", "impact_desc":"Penurunan pendapatan tol",
      "inherent":{"cell":14,"level":"M","likelihood":4,"impact":3,"nilai":14603},
      "expected":{"cell":3,"level":"LM","likelihood":3,"impact":1,"nilai":2410},
      "residual":{"cell":24,"level":"H","likelihood":4,"impact":5,"nilai":40118} },
    ...
  ]
}}
```
Bentuk `risks[]` identik dengan `sample-data.json` (ditambah `likelihood`/`impact` per stage).

## Tulis (WRITE — super_admin)
```
POST   /api/risk/periods            body { period_key, period_label, divisi }
PUT    /api/risk/:periodKey/items   body { rank, event, impact_desc,
                                            inherent:{likelihood,impact,nilai},
                                            expected:{...}, residual:{...} }   // backend hitung cell+level
DELETE /api/risk/items/:itemId
POST   /api/risk/:periodKey/publish
```

## Catatan render (frontend)
- Posisi bubble = dari `cell.no` → cari `impact,likelihood` di matriks → koordinat grid.
- Warna sel/level dari `levels[level].color`. Legend Inherent(hitam)/Expected(abu)/Residual(putih-outline).
