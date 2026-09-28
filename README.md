# TollSentra Control Center — Frontend

Antarmuka ruang kendali operasi jalan tol. Dibangun ulang dari
`design_handoff_tollsentra/` memakai **React + Vite + TypeScript** dengan
**CSS custom properties + CSS Modules** (sesuai rekomendasi handoff).

Backend: [cctv-backend](../cctv-backend) (Express + MySQL).

## Menjalankan

```bash
npm install
npm run dev
```

Aplikasi jalan di `http://localhost:5173`. Panggilan `/api/*` diteruskan
(proxy) ke backend sesuai `VITE_API_PROXY_TARGET` (default
`http://localhost:3000`). Salin `.env.example` → `.env` bila perlu mengubah
target.

## Skrip

| Skrip | Kegunaan |
|---|---|
| `npm run dev` | Dev server Vite + proxy `/api` |
| `npm run build` | Typecheck (`tsc -b`) + build produksi |
| `npm run preview` | Pratinjau hasil build |
| `npm run typecheck` | Cek tipe saja |

## Struktur

```
src/
├── main.tsx              entry: Theme + Router + Auth provider
├── App.tsx               definisi rute + guard
├── styles/               design-tokens.css (dari handoff), base, icon
├── lib/                  api client, auth service, useClock
├── context/              ThemeContext, AuthContext
├── types/                kontrak API backend
├── components/
│   ├── shell/            AppShell, Sidebar, TopBar, SosStrip
│   ├── ui/               Icon (Lucide via mask), EmptyState
│   └── RouteGuards.tsx   RequireAuth, RequireRole
└── pages/                LoginPage + placeholder tiap layar
```

## Status implementasi

Fase **Kerangka** (selesai):

- [x] Design tokens + tema gelap/terang (`data-theme`, disimpan di preferensi)
- [x] AppShell: Sidebar (236 ↔ 66px), TopBar (60px), SosStrip
- [x] Ikon Lucide via CSS mask
- [x] Autentikasi: Login lokal, `/api/auth/me`, klien API + bearer + handling 401/403/400
- [x] Navigasi digenerate dari `/api/menus` (tidak difilter ulang di FE)
- [x] Route guard: RequireAuth, RequireRole (`super_admin` untuk `/admin/users`)

Fase berikutnya (placeholder): Dashboard → CCTV → Peta → SOS → Pengguna & Akses → Pengaturan.

## Catatan

- Endpoint di handoff dinamai netral; frontend menyesuaikan ke endpoint
  backend yang sebenarnya (mis. `/api/sos-tickets/open`, `/api/map-assets`,
  `/api/map-events/stream`). Endpoint yang belum ada di backend (mis.
  ringkasan KPI Dashboard) akan ditambahkan di `cctv-backend` saat fasenya.
- Google Maps API key diisi di `VITE_GOOGLE_MAPS_API_KEY` saat fase Peta.
- Aplikasi desktop, landscape (target 1920×1080, min 1440×900).
