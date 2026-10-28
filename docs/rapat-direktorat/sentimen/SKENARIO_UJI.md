# Skenario Uji — Modul Sentimen (Rapat Direktorat)

Agregasi **on-the-fly** per lingkup dari _raw mention_ (tag-based). Status wilayah dari %negatif:
**Aman <15 · Perlu Atensi 15–30 · Kritis >30**.

- Backend `/api/sentiment` (module access `sentimen`). FE route `/rapat-direktorat/sentimen` + slide presentasi.
- File uji: `Sentiment Analisys - September 2026.xlsx` (2.235 mention, periode `2026-09`).
- Prasyarat: DB online, backend & FE jalan, user tiap lingkup tersedia (lihat §Peran).

---

## Peran & Hak Akses (prasyarat)

| User | Lingkup (`canDrill`) | Upload raw | Lihat agregat | Isi tindak lanjut |
|---|---|---|---|---|
| Admin Divisi (`canViewAllBranches`) | divisi + semua regional/cabang | ✅ | semua scope | semua scope |
| Admin Regional (mis. SUMBAGSEL) | regional-nya + cabangnya | ❌ | scope-nya | scope-nya |
| Admin Cabang | cabangnya | ❌ | cabangnya | cabangnya |
| User tanpa modul `sentimen` | — | ❌ | ❌ (403) | ❌ |

---

## A. Upload Data Mentah

| # | Skenario | Langkah | Hasil diharapkan |
|---|---|---|---|
| A1 | Upload happy-path (divisi) | Login admin divisi → menu **Analisis Sentimen** → **Upload Data Mentah** → pilih file Sep 2026 | Toast sukses `September 2026: 2.235 mention`. Periode otomatis jadi `2026-09`. `unmapped` kosong. |
| A2 | Periode dari file | Upload tanpa memilih periode | Periode terbaca otomatis dari kolom Date (bulan dominan) = `September 2026`. |
| A3 | Paksa periode | Pilih periode lain di dropdown sebelum upload | Data tersimpan di periode yang dipilih (query `?period=YYYY-MM`). |
| A4 | Idempotent / re-upload | Upload file yang sama 2×, lalu cek jumlah di `GET /periods` | `mention_count` tetap 2.235 (replace per periode, bukan ganda). |
| A5 | Non-admin coba upload | Login admin regional | Tombol **Upload** tidak muncul. Hit `POST /upload` langsung → **403** "Hanya admin divisi…". |
| A6 | File salah format | Upload .xlsx tanpa kolom `Campaigns`/`Sentiment` | **422** "Header tidak terbaca…". Tidak ada data tersimpan. |
| A7 | File > 25 MB | Upload file besar | **400** "Ukuran file melebihi batas 25 MB". |
| A8 | Kode ruas tak terpetakan | Upload file dgn kode ruas asing | Upload tetap sukses; `unmapped[]` berisi kode itu; mention tetap tercatat (tanpa tag ruas). |

---

## B. Agregasi per Lingkup (angka acuan, file Sep 2026)

Verifikasi lewat FE (kartu ringkasan) atau `GET /api/sentiment/2026-09?scope=<key>`.

| # | Lingkup | Total | %Negatif | Status | Catatan |
|---|---|---|---|---|---|
| B1 | Divisi (`divisi`) | **2.235** | **41,8%** | **Kritis** | Reach ±4,37 M · Nilai PR ±Rp 13,02 M |
| B2 | SUMBAGSEL | **1.336** | **59,6%** | **Kritis** | ruas TERPEKA, PALINDRA, INPRABU, BENGTABA, PALTUNG |
| B3 | SUMBAGTENG | **567** | **11,5%** | **Aman** | PERMAI, PEKBANGPAR, PACIN, LINGKAR PKU |
| B4 | SUMBAGUT | **323** | **8,7%** | **Aman** | SIBANCEH, BINBRAN, BINTAN, INKIS |
| B5 | Cabang (mis. PALINDRA) | — | — | — | Total ≤ induk; agregat hanya mention yg men-tag ruas itu |
| B6 | Σ cabang ≠ induk | — | — | — | Σ cabang SUMBAGSEL = **1.492** vs induk **1.336** (tag-based, **wajar**) |

> Toleransi angka reach/PR: pembulatan; total & %negatif harus **persis**.

---

## C. Peta Wilayah (slide & `GET /:period/tree`)

| # | Skenario | Hasil diharapkan |
|---|---|---|
| C1 | Dari divisi | `children` = 4 regional, **urut terburuk dulu** (SUMBAGSEL di atas). |
| C2 | Dari regional | `children` = cabang-cabang regional itu saja. |
| C3 | Dari cabang | `children` kosong → slide empty "Tidak ada rincian wilayah". |
| C4 | Warna status | Kartu Kritis merah, Atensi kuning, Aman hijau; bar komposisi pos/netral/neg sesuai. |
| C5 | Footnote prioritas | Menyebut wilayah terburuk + catatan tag-based. |

---

## D. Isu & Tindak Lanjut (CRUD)

| # | Skenario | Langkah | Hasil diharapkan |
|---|---|---|---|
| D1 | Daftar isu negatif | Buka halaman admin, scope SUMBAGSEL, periode Sep 2026 | Maks 6 isu negatif teratas **urut jangkauan (reach)**. |
| D2 | Tambah tindak lanjut | Isi _action_ + _PIC_ + status `Sedang diproses` → **Simpan** | Toast "Tindak lanjut tersimpan"; data kembali setelah reload. |
| D3 | Edit | Ubah teks/status pada isu yg sama → **Simpan** | Ter-upsert (bukan duplikat), kunci = `issue_key` per periode×scope. |
| D4 | Hapus / kosongkan | Klik ikon hapus | Rekomendasi terhapus; field kosong; status balik `Belum`. |
| D5 | Isolasi scope | Isi tindak lanjut di SUMBAGSEL, lalu buka SUMBAGTENG | Tindak lanjut SUMBAGSEL **tidak** muncul di SUMBAGTENG. |
| D6 | Isolasi periode | Isi di Sep, lalu lihat Agu | Tidak terbawa antarperiode. |
| D7 | Read-only | User level READ | Field & tombol simpan nonaktif. |

---

## E. Slide Presentasi

Buka **Presentasi** → builder → aktifkan slide Sentimen → **Mulai**.

| # | Skenario | Hasil diharapkan |
|---|---|---|
| E1 | Urutan default | Sampul "Analisis Sentimen" → Ringkasan → Peta Wilayah → Isu & Tindak Lanjut, setelah Pendapatan sebelum Penutup. |
| E2 | Nomor bagian | Sampul sentimen dapat nomor "Bagian N" dinamis mengikuti sampul aktif. |
| E3 | Ringkasan | Donat komposisi, status pill, KPI (Percakapan/Jangkauan/Engagement/**Nilai PR**), tren harian, chip kanal. |
| E4 | Isu & Tindak Lanjut | Narasi + tabel isu negatif + kolom tindak lanjut (action/PIC/status) terisi dari CRUD + apresiasi positif. |
| E5 | Ganti scope | Ubah scope di builder → slide ikut scope (angka & tag "Cakupan"). |
| E6 | Ganti periode | Dropdown periode di overlay → snapshot dimuat ulang (termasuk sentimen). |
| E7 | Empty state | Pilih periode tanpa data sentimen | Tiap slide tampil "Belum ada data sentimen", presentasi tidak error. |
| E8 | Snapshot cache | Bolak-balik periode/scope | Tidak fetch ulang berulang (cache `periode::scope`); setelah upload baru → data segar. |

---

## F. Periode & Dropdown

| # | Skenario | Hasil diharapkan |
|---|---|---|
| F1 | Opsi periode admin | Jan..bulan berjalan (tahun berjalan) + periode terunggah. |
| F2 | Periode presentasi | Daftar periode presentasi menyertakan periode sentimen (gabung LR/Risiko/Pendapatan/Sentimen). |
| F3 | Label | `2026-09` → "September 2026". |

---

## G. Regresi (jangan sampai rusak)

- [ ] Slide LR, Manajemen Risiko, Pendapatan tetap tampil normal.
- [ ] Modul & menu lain tidak berubah; menu `sentimen` muncul di grup Rapat Direktorat (order 35).
- [ ] `tsc -b` FE lolos; backend start tanpa error; tabel sentimen ter-seed otomatis.

---

## Status verifikasi saat penyusunan

- ✅ Parser + agregasi tervalidasi lawan file nyata (B1–B4, B6) — tanpa DB.
- ✅ `tsc -b` FE lolos; backend module load OK.
- ⏳ Jalur ber-DB (upload/CRUD/seed menu) **belum** dijalankan live — DB kantor (`192.168.66.81`) sedang tak terjangkau; ulangi §A–§F begitu DB online.
