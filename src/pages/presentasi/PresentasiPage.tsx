import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Select, Switch, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { usePresentation } from "@/context/PresentationContext";
import { SLIDES } from "@/components/presentation/slideRegistry";
import { parsePdfSlide, pdfSlideLabel } from "@/components/presentation/pdfSlides";
import { countPagesOfFile, deletePdf, uploadPdf, type PdfDoc } from "@/lib/presentationPdf";
import styles from "./PresentasiPage.module.css";

export function PresentasiPage() {
  const p = usePresentation();
  const auth = useAuth();
  const toast = useToast();
  const canManage = auth.hasRole("super_admin");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Segarkan daftar periode & dokumen PDF tiap builder dibuka.
  const { refreshPeriods, refreshPdfs } = p;
  useEffect(() => {
    void refreshPeriods();
    void refreshPdfs();
  }, [refreshPeriods, refreshPdfs]);

  const periodOptions: SelectOption[] = useMemo(
    () => p.periods.map((opt) => ({ value: opt.key, label: opt.label })),
    [p.periods]
  );

  const pdfInAgenda = (pdfId: number): boolean =>
    p.order.some((sid) => parsePdfSlide(sid)?.pdfId === pdfId);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      let pages: number | null = null;
      try {
        pages = await countPagesOfFile(file);
      } catch {
        pages = null;
      }
      const title = file.name.replace(/\.pdf$/i, "");
      const doc = await uploadPdf(file, title, pages);
      await p.refreshPdfs();
      p.addPdf(doc);
      toast.success("PDF ditambahkan", `${doc.title} (${doc.page_count ?? pages ?? "?"} halaman) masuk agenda.`);
    } catch (err) {
      toast.error("Upload gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: PdfDoc) {
    if (!window.confirm(`Hapus dokumen "${doc.title}"? Slide halamannya akan dikeluarkan dari agenda.`)) return;
    try {
      await deletePdf(doc.id);
      p.removePdfFromAgenda(doc.id);
      await p.refreshPdfs();
      toast.success("PDF dihapus", doc.title);
    } catch (err) {
      toast.error("Hapus gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Susun Agenda Presentasi</h1>
          <div className={styles.sub}>
            Pilih, urutkan, dan mulai. Slide memakai data <b>snapshot</b> periode terpilih agar angka beku selama rapat.
          </div>
        </div>

        {/* Slide pembuka (editable) */}
        <div className={styles.config}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Judul Rapat</span>
            <Input
              value={p.meetingTitle}
              onChange={(e) => p.setMeetingTitle(e.target.value)}
              placeholder="Rapat Direktorat"
              wrapClassName={styles.inputMd}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Tanggal Rapat</span>
            <Input
              type="date"
              value={p.meetingDate}
              onChange={(e) => p.setMeetingDate(e.target.value)}
              icon="calendar"
              wrapClassName={styles.inputMd}
            />
          </div>
          <div className={`${styles.field} ${styles.grow}`}>
            <span className={styles.fieldLabel}>Subjudul</span>
            <Input
              value={p.meetingSubtitle}
              onChange={(e) => p.setMeetingSubtitle(e.target.value)}
              placeholder="Deskripsi singkat rapat"
              wrapClassName={styles.fill}
            />
          </div>
        </div>

        {/* Konfigurasi periode & otomatis */}
        <div className={styles.config}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Snapshot Periode</span>
            <Select
              value={p.period}
              onValueChange={p.setPeriod}
              options={periodOptions}
              placeholder="Pilih periode"
              icon="calendar"
              ariaLabel="Snapshot periode"
            />
          </div>
          <span className={styles.spacer} />
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Otomatis</span>
            <div className={styles.autoBox}>
              <label className={styles.autoLabel}>
                <Switch checked={p.auto} onCheckedChange={p.toggleAuto} ariaLabel="Putar otomatis" />
                Putar otomatis
              </label>
              {p.auto && (
                <span className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    onClick={() => p.setAutoSec(p.autoSec - 2)}
                    disabled={p.autoSec <= 4}
                    aria-label="Kurangi interval"
                  >
                    −
                  </button>
                  <b className={styles.stepVal}>{p.autoSec}s</b>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    onClick={() => p.setAutoSec(p.autoSec + 2)}
                    disabled={p.autoSec >= 30}
                    aria-label="Tambah interval"
                  >
                    +
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dokumen PDF */}
        <div className={styles.pdfPanel}>
          <div className={styles.pdfHead}>
            <span className={styles.pdfHeadTitle}>
              <Icon name="file-text" size={15} /> Dokumen PDF
            </span>
            {canManage && (
              <>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={handleFile} />
                <Button
                  size="sm"
                  variant="secondary"
                  icon="upload"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "Mengunggah…" : "Unggah PDF"}
                </Button>
              </>
            )}
          </div>
          {p.pdfs.length === 0 ? (
            <div className={styles.pdfEmpty}>
              Belum ada dokumen PDF.{canManage ? " Unggah PDF — tiap halaman menjadi satu slide." : ""}
            </div>
          ) : (
            <div className={styles.pdfList}>
              {p.pdfs.map((doc) => {
                const inAgenda = pdfInAgenda(doc.id);
                return (
                  <div key={doc.id} className={styles.pdfRow}>
                    <Icon name="file-text" size={16} />
                    <span className={styles.pdfTitle}>{doc.title}</span>
                    <span className={styles.pdfMeta}>{doc.page_count ?? "?"} hal</span>
                    <span className={styles.spacer} />
                    {inAgenda ? (
                      <Button size="sm" variant="ghost" icon="minus" onClick={() => p.removePdfFromAgenda(doc.id)}>
                        Keluarkan
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" icon="plus" onClick={() => p.addPdf(doc)}>
                        Tambah ke agenda
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        icon="trash-2"
                        title="Hapus dokumen"
                        onClick={() => handleDelete(doc)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Agenda */}
        <div className={styles.agenda}>
          <div className={styles.agendaHead}>
            <span>Agenda · {p.activeSlides.length} slide aktif</span>
            <span>Urutan tayang</span>
          </div>
          {p.order.map((id, idx) => {
            const staticDef = SLIDES[id];
            const pdfLabel = staticDef ? null : pdfSlideLabel(id, p.pdfs);
            const def = staticDef
              ? { title: staticDef.title, feature: staticDef.feature, badge: staticDef.badge }
              : pdfLabel
                ? { title: pdfLabel.title, feature: pdfLabel.feature, badge: "PDF" }
                : null;
            if (!def) return null;
            const on = !!p.enabled[id];
            return (
              <div key={id} className={`${styles.row} ${on ? "" : styles.rowOff}`}>
                <span className={styles.grip} aria-hidden="true">
                  <Icon name="grip-vertical" size={16} />
                </span>
                <Switch checked={on} onCheckedChange={() => p.toggleEnabled(id)} ariaLabel={`Aktifkan ${def.title}`} />
                <span className={styles.num}>{idx + 1}</span>
                <span className={styles.rowText}>
                  <span className={`${styles.rowTitle} ${on ? "" : styles.strike}`}>{def.title}</span>
                  <span className={styles.rowFeat}>{def.feature}</span>
                </span>
                <span className={styles.badge}>{def.badge}</span>
                <span className={styles.reorder}>
                  <Button
                    size="sm"
                    iconOnly
                    icon="chevron-up"
                    title="Naik"
                    disabled={idx === 0}
                    onClick={() => p.move(id, -1)}
                  />
                  <Button
                    size="sm"
                    iconOnly
                    icon="chevron-down"
                    title="Turun"
                    disabled={idx === p.order.length - 1}
                    onClick={() => p.move(id, 1)}
                  />
                </span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className={styles.cta}>
          <Button variant="primary" icon="play" disabled={!p.activeSlides.length} onClick={p.start} className={styles.startBtn}>
            Mulai Presentasi
          </Button>
          <span className={styles.hint}>Layar penuh · panah ◄ ► untuk navigasi · Esc keluar</span>
        </div>
      </div>
    </div>
  );
}
