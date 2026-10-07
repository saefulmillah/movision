import { useEffect, useRef, useState } from "react";
import { Button, Icon, Input, Modal, Select, useToast } from "@/components/ui";
import { backendAsset } from "@/lib/api";
import { createNews, NEWS_CATEGORIES, updateNews, uploadNewsImageWithProgress } from "@/lib/news";
import type { NewsFormValues, NewsItem } from "@/types/modules";
import styles from "../modules.module.css";

const EMPTY: NewsFormValues = {
  title: "",
  content: "",
  category: "",
  source: "",
  author: "",
  image: "",
  status: 0,
  published_at: ""
};

/** ISO -> "YYYY-MM-DDTHH:mm" (waktu lokal) untuk input datetime-local. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  mode: "create" | "edit";
  news: NewsItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function NewsFormModal({ open, mode, news, onClose, onSaved }: Props) {
  const toast = useToast();
  const [v, setV] = useState<NewsFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [err, setErr] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && news) {
      setV({
        title: news.title ?? "",
        content: news.content ?? "",
        category: news.category === null || news.category === undefined ? "" : String(news.category),
        source: news.source ?? "",
        author: news.author ?? "",
        image: news.image ?? "",
        status: news.status ?? 0,
        published_at: isoToLocalInput(news.published_at)
      });
    } else {
      setV(EMPTY);
    }
    setErr({});
  }, [open, mode, news]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Format harus JPEG, PNG, atau WEBP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file melebihi 5 MB");
      return;
    }
    setUploading(true);
    setUploadPct(0);
    try {
      const res = await uploadNewsImageWithProgress(file, (pct) => setUploadPct(pct < 0 ? 0 : pct));
      set("image", res.image);
      toast.success("Gambar terunggah");
    } catch (err) {
      toast.error("Gagal mengunggah", err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  function set<K extends keyof NewsFormValues>(k: K, val: NewsFormValues[K]) {
    setV((prev) => ({ ...prev, [k]: val }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (v.title.trim().length < 3 || v.title.trim().length > 200) e.title = "Judul wajib 3–200 karakter.";
    if (!v.content.trim()) e.content = "Isi berita wajib diisi.";
    if (v.category && !Number.isInteger(Number(v.category))) e.category = "Kategori harus angka.";
    setErr(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (mode === "edit" && news) {
        await updateNews(news.id, v);
        toast.success("Berita diperbarui");
      } else {
        await createNews(v);
        toast.success("Berita dibuat");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={mode === "edit" ? "Ubah Berita" : "Tambah Berita"}
      width={620}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Judul</label>
        <Input value={v.title} invalid={!!err.title} onChange={(e) => set("title", e.target.value)} placeholder="Judul berita" />
        {err.title && <div className={styles.fieldError}>{err.title}</div>}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Isi Berita</label>
        <textarea
          className={styles.textarea}
          style={{ minHeight: 140 }}
          value={v.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder="Tulis isi berita…"
        />
        {err.content && <div className={styles.fieldError}>{err.content}</div>}
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Kategori</label>
          <Select value={v.category} onValueChange={(val) => set("category", val)} options={NEWS_CATEGORIES} placeholder="Pilih kategori…" />
          {err.category && <div className={styles.fieldError}>{err.category}</div>}
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Sumber</label>
          <Input value={v.source} onChange={(e) => set("source", e.target.value)} placeholder="Sumber berita" />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Penulis</label>
        <Input value={v.author} onChange={(e) => set("author", e.target.value)} placeholder="Penulis" />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Gambar</label>
        <div className={styles.uploadRow}>
          <div className={styles.uploadPreviewWrap}>
            {backendAsset(v.image) ? (
              <img className={styles.uploadPreview} src={backendAsset(v.image)} alt="" />
            ) : (
              <span className={`${styles.uploadPreview} ${styles.uploadPlaceholder}`}>
                <Icon name="image" size={22} />
              </span>
            )}
            {uploading && (
              <span className={styles.uploadOverlay}>
                <Icon name="loader-circle" size={20} className={styles.spin} />
                <span className={styles.uploadOverlayPct}>{uploadPct}%</span>
              </span>
            )}
          </div>
          <div className={styles.uploadActions}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
            <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Mengunggah…" : "Unggah Gambar"}
            </Button>
            {v.image && !uploading && (
              <Button variant="ghost" icon="x" onClick={() => set("image", "")}>Hapus</Button>
            )}
            {uploading ? (
              <div className={styles.uploadProgress} role="progressbar" aria-valuenow={uploadPct} aria-valuemin={0} aria-valuemax={100}>
                <div className={styles.uploadBar} style={{ width: `${uploadPct}%` }} />
                <span className={styles.uploadPctText}>{uploadPct}%</span>
              </div>
            ) : (
              <Input value={v.image} onChange={(e) => set("image", e.target.value)} placeholder="atau tempel URL / path gambar" />
            )}
          </div>
        </div>
      </div>

      <p className={styles.muted} style={{ marginTop: 4, fontSize: "var(--fs-sm)" }}>
        Berita baru tersimpan sebagai <b>draft</b>. Agar tampil di aplikasi, ajukan untuk persetujuan lalu disetujui oleh pemeriksa.
      </p>
    </Modal>
  );
}
