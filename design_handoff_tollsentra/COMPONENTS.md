# Katalog Komponen — TollSentra Control Center

Versi 1.0 · 13 Agustus 2026
Sumber nilai: `design-tokens.css` dan mockup `TollSentra.dc.html`

Seluruh nilai warna dirujuk sebagai token. Jangan menyalin heksadesimal
langsung ke komponen.

---

## 1. Kerangka Aplikasi

### 1.1 AppShell
Pembungkus terluar. Memegang atribut tema.

| Properti | Nilai |
|---|---|
| Atribut | `data-theme="dark" \| "light"` |
| Background | `var(--app-bg)` |
| Color | `var(--text)` — **wajib**, agar pewarisan teks ikut berganti tema |
| Ukuran | `width: 100%; height: 100vh; overflow: hidden` |
| Font dasar | `var(--font-sans)`, 14px |

Struktur: `AppShell > [Sidebar, MainColumn]`, `MainColumn > [TopBar, SosStrip?, Content]`.

### 1.2 Sidebar

| Properti | Terbuka | Terlipat |
|---|---|---|
| Lebar | `var(--w-sidebar)` 236px | `var(--w-sidebar-collapsed)` 66px |
| Transisi | `width var(--t-panel)` | sama |
| Isi | logo + teks, label menu, profil lengkap | logo saja, ikon saja, avatar saja |
| Badge SOS | pil angka merah | titik merah 8px di sudut ikon |

Background `var(--surface-1)`, border kanan 1px `var(--line)`.

**NavItem**

| State | Background | Warna teks/ikon | Penanda |
|---|---|---|---|
| Normal | transparan | `var(--text-muted)` | — |
| Hover | `rgba(47,107,255,.10)` | `var(--text-muted)` | — |
| Aktif | `var(--nav-active-bg)` | `var(--nav-active-text)` | garis 3×19px radius 2px warna aksen di tepi kiri |

Padding `11px 14px 11px 20px`, margin `2px 10px`, radius `var(--r-lg)`, gap 12px, ikon 19px, teks `var(--fs-md)` weight 500.

### 1.3 TopBar

Tinggi `var(--h-topbar)` 60px, background `var(--surface-1)`, border bawah 1px `var(--line)`, padding horizontal 22px, gap 18px.

Isi berurutan: judul layar (`var(--fs-xl)` w600) → BranchPicker → spacer → indikator SSE → pemisah → jam → tombol tema → tombol notifikasi.

- **Indikator SSE**: titik 8px `var(--sem-green)` dengan animasi `blink` 1.6s, teks 12px mono.
- **Jam**: `var(--font-mono)` 15px w500, letter-spacing .5px, diperbarui tiap detik.
- **Tombol ikon**: 34×34px, radius `var(--r-md)`, background `var(--surface-2)`, border 1px `var(--line-strong)`.
- **Badge notifikasi**: min-width 16px, tinggi 16px, radius 9px, background `var(--sem-red)`, teks putih 10px mono, posisi absolut `top:-4px; right:-4px`.

### 1.4 SosStrip

Muncul hanya bila ada tiket terbuka. Background `var(--sos-bg)`, border bawah 1px `var(--sos-border)`, padding `11px 22px`, gap 14px.

Isi: ikon sirene 24px dengan cincin pulse → teks utama `var(--sos-text)` 13.5px w600 → teks sekunder `var(--sos-sub)` 12.5px mono → spacer → tombol merah "Buka Worklist SOS".

---

## 2. Komponen Data

### 2.1 Card

| Properti | Nilai |
|---|---|
| Background | `var(--surface-2)` |
| Border | 1px solid `var(--line)` |
| Radius | `var(--r-2xl)` 12px |
| Shadow | `var(--card-shadow)` |
| Header | padding `14px 16px`, border bawah 1px `var(--line)` |
| Judul header | `var(--fs-lg)` w600 |
| Isi | padding 16px |

### 2.2 StatusPill

| Properti | Nilai |
|---|---|
| Padding | `3px 10px` |
| Radius | `var(--r-sm)` 5px |
| Font | `var(--fs-xs)` 11px w600 |
| Warna teks | token status |
| Background | warna status pada alpha ~16% |

| Status | Token teks | Background |
|---|---|---|
| Online / Normal / Bergerak / Selesai | `var(--sem-green)` | `rgba(52,211,153,.16)` |
| Warning / Berhenti / Sedang ditangani | `var(--sem-amber)` | `rgba(217,160,20,.16)` |
| Error / SOS | `var(--sem-red)` | `rgba(244,63,94,.16)` |
| Dispatched | `var(--st-blue)` | `rgba(91,141,255,.16)` |
| Offline / Nonaktif / Unknown | `var(--st-gray)` | `rgba(120,140,170,.18)` |

### 2.3 KpiCard

Padding `16px 16px 15px`, radius `var(--r-2xl)`.
Baris atas: label `var(--fs-xs)` `var(--text-muted)` w500 + kotak ikon 30×30px radius `var(--r-md)` berlatar warna semantik alpha 14%, ikon 16px.
Angka: `var(--font-mono)` `var(--fs-kpi)` 27px w600 `var(--text)`, line-height 1.
Keterangan: `var(--fs-xs)` `var(--text-faint)`, margin-top 6px.

### 2.4 DataTable

Bukan `<table>`, melainkan grid CSS agar kolom proporsional.

| Bagian | Spesifikasi |
|---|---|
| Header | padding `11px 16px`, font 11px w600 uppercase letter-spacing .5px `var(--text-faint)`, border bawah 1px `var(--line)` |
| Baris | padding `12px 16px`, border bawah 1px `var(--line-soft)`, `align-items: center` |
| Hover | background `var(--nav-active-bg)` |
| Terpilih | background `var(--nav-active-bg)` |
| Gap kolom | 12px |

### 2.5 Tabs

Kontainer: background `var(--surface-2)`, border 1px `var(--line-strong)`, radius `var(--r-xl)`, padding 3px, gap 3px.
Tab: padding `8px 14px`, radius 7px, font 12.5px w600, gap 7px, ikon 15px.
Aktif: background warna aksen, teks `#fff`. Nonaktif: transparan, teks `var(--text-muted)`.

### 2.6 SearchInput

Wadah: padding `9px 12px`, background `var(--surface-2)`, border 1px `var(--line-strong)`, radius `var(--r-lg)`, gap 8px.
Ikon 15px `var(--text-faint)`. Input transparan tanpa border/outline, `var(--fs-base)`, warna `var(--text)`.

### 2.7 Toggle

Lintasan 36×21px (panel layer) atau 42×24px (pengaturan), radius 20px.
Mati: `var(--track)`. Hidup: warna aksen. Transisi `background var(--t-fast)`.
Knob: lingkaran putih, `top: 2px`, berpindah `left: 2px → (lebar - knob - 2px)`, transisi `left var(--t-fast)`.

### 2.8 Button

| Varian | Background | Border | Teks |
|---|---|---|---|
| Primary | warna aksen | none | `#fff` |
| Secondary | `var(--surface-3)` | 1px `var(--line-strong)` | `var(--text-dim)` |
| Danger | `var(--sem-red)` | none | `#fff` |

Padding `10px 16px`, radius `var(--r-lg)`, font 12.5–13px w600, gap ikon 7px.

---

## 3. Komponen Peta

### 3.1 LayerRow

**Dua zona klik terpisah dalam satu baris. Wajib tidak saling memicu.**

| Zona | Aksi |
|---|---|
| Ikon + teks + badge (`flex: 1`) | Membuka daftar aset layer pada panel kanan |
| Toggle switch | Menyala/mematikan marker layer di peta |

Baris: padding `9px 12px 9px 16px`, margin `1px 8px`, radius `var(--r-lg)`, gap 10px.
Aktif (daftar terbuka): background `var(--nav-active-bg)`.
Ikon 17px berwarna sesuai layer. Nama `var(--fs-body)` w500. Sub `var(--fs-micro)` mono `var(--text-faint)`.

**AlertBadge**: pil, font 10px mono w600, padding `3px 6px`, radius 20px, background `rgba(244,63,94,.16)`, teks `#F87B8B`, border 1px `rgba(244,63,94,.30)`. Disembunyikan bila nilai 0.

### 3.2 Marker

Titik 14px radius 50%, warna sesuai layer.
Cincin: `box-shadow: 0 0 0 3px var(--marker-ring), 0 0 var(--marker-glow) <warna>`.
Pada tema terang `--marker-glow: 0px` sehingga pendar hilang.
Marker kritis mendapat cincin animasi `pulse` 1.8s.

Warna per layer: CCTV `var(--sem-green)` · VMS `var(--sem-amber)` · FO `var(--sem-cyan)` · GPS `var(--st-blue)` · Gerbang `var(--sem-red)` · WIM `var(--sem-purple)` · Cuaca `var(--sem-sky)` · SOS `var(--sem-rose)`.

### 3.3 EdgeTab (tab LAYER / KAMERA)

Tab vertikal menempel di tepi kiri layar, hanya pada mode layar penuh.

| Properti | Nilai |
|---|---|
| Posisi | `position: absolute; top: 50%; transform: translateY(-50%)` |
| Left | `0` saat panel tertutup, `250px` saat panel terbuka |
| Transisi | `left var(--t-panel), opacity var(--t-fade)` |
| Background | `var(--overlay-bg)` + `backdrop-filter: blur(6px)` |
| Border | 1px `var(--line-strong)`, `border-left: none` |
| Radius | `0 11px 11px 0` |
| Padding | `14px 9px` |
| Teks | `writing-mode: vertical-rl`, 11px w600, letter-spacing 1px |

### 3.4 FloatingToolbar

Satu panel di kanan atas pada mode layar penuh.

| Properti | Nilai |
|---|---|
| Posisi | `position: absolute; right: 14px; top: 14px` |
| Background | `var(--overlay-bg)` + `backdrop-filter: blur(6px)` |
| Border | 1px `var(--line-strong)`, radius 11px |
| Padding | `7px 11px`, gap 12px |
| Auto-hide | `opacity: 0` dan `pointer-events: none` setelah `var(--t-idle)` 2.6s tanpa `mousemove`; kembali `opacity: 1` saat kursor bergerak |

Isi peta: SSE · jam · tombol keluar.
Isi CCTV: SSE · jam · pemilih grid · tombol keluar. Pemisah antar bagian: garis 1×18px `var(--line-strong)`.

---

## 4. Komponen CCTV

### 4.1 CameraTile

| Properti | Mode normal | Mode layar penuh |
|---|---|---|
| Rasio | `aspect-ratio: 16/9` | tidak dikunci; `min-height: 0` mengisi baris grid |
| Radius | `var(--r-xl)` 10px | sama |
| Background | `repeating-linear-gradient(45deg, var(--tile-1) 0 11px, var(--tile-2) 11px 22px)` | sama |
| Border | 1px `var(--line)`; hover `rgba(47,107,255,.5)` | sama |

**Overlay atas**: padding `8px 9px`, background `linear-gradient(180deg, rgba(7,11,20,.85), transparent)`. Isi: titik status 7px + nama kamera 11px w500 `var(--on-scrim)`.

**Overlay bawah**: padding `7px 9px`, background `linear-gradient(0deg, rgba(7,11,20,.85), transparent)`. Isi: KM 10px mono `var(--on-scrim-dim)` + label status 9.5px w600 berwarna status.

> Tile gelap pada kedua tema. Teks overlay **wajib** memakai `--on-scrim`, bukan `--text`.

### 4.2 CameraGrid

| Mode | Perilaku |
|---|---|
| Normal | `grid-template-columns: repeat(n, 1fr)`, gap `var(--sp-4)`, padding `14px 18px`, dapat digulir, menampilkan seluruh kamera |
| Layar penuh | ditambah `grid-template-rows: repeat(n, 1fr)` dan `height: 100%`, padding `var(--sp-4)` di semua sisi, `overflow: hidden`, jumlah tile dipotong menjadi n² |

n = 2 untuk 2×2, 3 untuk 3×3, 4 untuk 4×4.

---

## 5. Komponen SOS

### 5.1 TicketCard
Padding `13px 16px`, border bawah 1px `var(--line-soft)`, border kiri 3px (aksen bila terpilih, transparan bila tidak), background `var(--nav-active-bg)` bila terpilih.
Isi: nomor tiket 12px mono `var(--st-blue)` + StatusPill · jenis kejadian `var(--fs-md)` w500 · ruas & lokasi `var(--fs-xs)` `var(--text-faint)` · progres 11px mono dengan ikon 12px.

### 5.2 CandidateRow
Padding 13px, radius `var(--r-xl)`, margin bawah 9px.
Kandidat utama: background `rgba(47,107,255,.06)`, border `rgba(47,107,255,.30)`, badge UTAMA. Lainnya: transparan, border `var(--line)`.
Isi: kotak ikon 40×40px radius `var(--r-xl)` · label + status pelacakan · jarak & kecepatan rata kanan · confidence lebar 56px rata tengah.

Warna confidence: ≥0.8 `var(--sem-green)`, ≥0.5 `var(--sem-amber)`, sisanya `var(--sem-red)`.

### 5.3 Timeline
Tiap entri: kolom kiri berisi titik 12px dengan `box-shadow: 0 0 0 3px <warna kartu>` dan garis vertikal 2px `rgba(148,163,184,.12)`; kolom kanan berisi nama peristiwa `var(--fs-body)` w500 dan sumber 11px mono `var(--text-muted)`; waktu 11px mono rata kanan.
Padding bawah tiap entri 16px.

---

## 6. Animasi

| Nama | Definisi | Dipakai pada |
|---|---|---|
| `blink` | `0%,100% { opacity: 1 } 50% { opacity: .25 }` — 1.6s infinite | titik status SSE, indikator LIVE |
| `pulse` | `0% { transform: scale(.9); opacity: .7 } 70% { transform: scale(2.4); opacity: 0 } 100% { opacity: 0 }` — 1.8s infinite | cincin marker kritis, marker SOS |
| `glow` | `0%,100% { box-shadow: 0 0 0 0 rgba(244,63,94,.45) } 50% { box-shadow: 0 0 0 6px rgba(244,63,94,0) }` — 1.8s infinite | badge SOS pada sidebar |

Transisi: panel dan tab `var(--t-panel)` 0.18s; fade auto-hide `var(--t-fade)` 0.25s; hover dan toggle `var(--t-fast)` 0.15s.

---

## 7. Ikon

Mockup memakai **Lucide** via CDN, dirender sebagai mask agar mewarisi warna:

```css
.icon {
  width: 17px; height: 17px;
  background: var(--text-muted);            /* warna ikon */
  -webkit-mask: url(<url-ikon>) center/contain no-repeat;
          mask: url(<url-ikon>) center/contain no-repeat;
}
```

Sesuai keputusan, Lucide via CDN dipertahankan. Bila kelak dipindah ke paket lokal, teknik mask di atas tetap berlaku dan hanya URL yang berubah.

Daftar ikon yang dipakai: `radio-tower, layout-dashboard, map, cctv, siren, scale, users, settings, panel-left-close, panel-left-open, log-out, git-fork, bell, sun, moon, search, maximize, minimize, layers, chevron-down, arrow-left, x, plus, shield, shield-check, list-tree, folder, file, eye, boxes, monitor, share-2, truck, building-2, cloud, video, video-off, activity, ambulance, refresh-cw, mouse-pointer-click, info, database, videocam, monitor-dot, user, lock, key-round, check, palette, sliders-horizontal, plug, list`.
