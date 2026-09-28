# Handoff — Modul Laba Rugi (Frontend)

Paket konteks untuk melanjutkan implementasi di Claude Code (repo `movision` / TollSentra).

## Mulai dari sini
1. **`FRONTEND_BRIEF.md`** — langkah implementasi (RBAC, API client, tipe, halaman 3 tampilan, route, menu) + kriteria terima.
2. **`API_CONTRACT.md`** — kontrak endpoint & bentuk JSON dari backend.
3. **`dashboard-reference.html`** — dashboard 3 tampilan yang sudah cocok 100% dgn slide 3–5. **Sumber kebenaran tampilan & aturan format** (warna regional, urutan baris, hide-no-realisasi, definisi total). Porting logikanya ke React + design system TollSentra — jangan embed HTML mentah.

## Prompt awal yang disarankan untuk Claude Code
> "Baca docs/laba-rugi/FRONTEND_BRIEF.md dan API_CONTRACT.md. Buka dashboard-reference.html di browser untuk melihat 3 tampilan target. Implementasikan halaman Laba Rugi di src/pages/laba-rugi/ mengikuti pola pages/*, App.tsx, constants/rbac.ts, dan design system repo (Radix Tabs untuk 3 tampilan). Kerjakan di branch feature/dashboard-laba-rugi."

## Keputusan terkunci
3 tampilan (Konsolidasi/Regional/Ruas) · data dari `/api/laba-rugi` · RBAC module `laba_rugi` (super_admin, `manajemen`) · pakai design system TollSentra · HPP & Total dihitung/ dibaca sesuai API_CONTRACT.
