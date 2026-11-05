/* ============================================================
   Kompresi gambar sisi-klien sebelum unggah.
   Dipakai untuk gambar SAMPUL presentasi: turunkan dimensi ke batas wajar
   (tetap tajam untuk latar layar penuh) + re-encode kualitas sedang. SENGAJA
   TIDAK ekstrim — cover perlu tetap enak dilihat saat ditampilkan penuh.
   (Berbeda dengan thumbnail kartu agenda yang boleh sangat kecil.)
   ============================================================ */

export interface CompressOptions {
  /** Sisi terpanjang maksimum (px). */
  maxDim?: number;
  /** Kualitas encoder 0..1 (JPEG/WEBP). */
  quality?: number;
  /** Mime target hasil. */
  mime?: "image/jpeg" | "image/webp";
}

/**
 * Perkecil + re-encode sebuah File gambar. Mengembalikan File baru yang lebih
 * ringan; bila gagal / tak menguntungkan, mengembalikan file asli apa adanya.
 * GIF (animasi) & SVG dilewati agar tak rusak.
 */
export async function compressImageFile(
  file: File,
  { maxDim = 1920, quality = 0.82, mime = "image/jpeg" }: CompressOptions = {}
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error ?? new Error("Gagal membaca berkas"));
      fr.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("Gagal mendekode gambar"));
      im.src = dataUrl;
    });

    const longest = Math.max(img.naturalWidth, img.naturalHeight) || maxDim;
    const scale = Math.min(1, maxDim / longest);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob) return file;
    // Bila tak menyusut DAN dimensi tak berubah → pakai asli (hindari re-encode sia-sia).
    if (blob.size >= file.size && scale === 1) return file;

    const ext = mime === "image/webp" ? ".webp" : ".jpg";
    const base = (file.name || "cover").replace(/\.[^.]+$/, "");
    return new File([blob], `${base}${ext}`, { type: mime, lastModified: Date.now() });
  } catch {
    // Apa pun yang gagal → unggah file asli (lebih baik berhasil daripada gagal).
    return file;
  }
}
