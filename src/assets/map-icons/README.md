# Monitoring SVG Icon Set

Set ikon SVG untuk aset dan perangkat operasional Movision.

## Status warna

- `normal`: hijau (`#16A34A`)
- `offline`: abu-abu (`#9CA3AF`)
- `sos-created`: merah (`#DC2626`)
- `sos-dispatched`: oranye dengan animasi denyut (`#F97316`)

## Struktur file

Setiap jenis aset memiliki 4 varian status:

```
src/assets/map-icons/<jenis-aset>/<status>.svg
```

Contoh:

```
src/assets/map-icons/cctv/normal.svg
src/assets/map-icons/cctv/offline.svg
src/assets/map-icons/cctv/sos-created.svg
src/assets/map-icons/cctv/sos-dispatched.svg
```
