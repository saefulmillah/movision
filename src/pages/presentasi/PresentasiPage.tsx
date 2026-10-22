import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Select, Switch, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { usePresentation } from "@/context/PresentationContext";
import { SLIDES } from "@/components/presentation/slideRegistry";
import { parsePdfSlide, pdfSlideLabel } from "@/components/presentation/pdfSlides";
import { isCustomCover } from "@/components/presentation/customCover";
import { flattenScopes } from "@/lib/presentationScope";
import { countPagesOfFile, deletePdf, uploadPdf, type PdfDoc } from "@/lib/presentationPdf";
import styles from "./PresentasiPage.module.css";

/** Kelompok warna/ikon kartu slide berdasarkan fitur. */
function featKey(feature: string): string {
  if (feature.startsWith("Laba")) return "lr";
  if (feature.startsWith("Manajemen")) return "risk";
  if (feature.startsWith("Pendapatan")) return "pend";
  if (feature === "Pembuka") return "open";
  if (feature === "Penutup") return "close";
  if (feature === "Sampul Kustom") return "cover";
  return "pdf";
}
function featIcon(key: string): string {
  switch (key) {
    case "lr":
      return "chart-column";
    case "risk":
      return "shield-alert";
    case "pend":
      return "trending-up";
    case "open":
      return "presentation";
    case "close":
      return "flag";
    case "cover":
      return "bookmark";
    default:
      return "file-text";
  }
}

export function PresentasiPage() {
  const p = usePresentation();
  const auth = useAuth();
  const toast = useToast();
  const ACCESS_RANK = { none: 0, read: 1, write: 2, delete: 3 } as const;
  const presLevel = auth.hasRole("super_admin")
    ? 3
    : ACCESS_RANK[(auth.moduleLevel("presentasi") || "none") as keyof typeof ACCESS_RANK] ?? 0;
  const canUpload = presLevel >= 2; // write
  const canDelete = presLevel >= 3; // delete
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Drag-and-drop urutan slide.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // Segarkan periode, scope, lalu agenda+PDF (atomik per scope) tiap builder dibuka.
  const { refreshPeriods, refreshAgenda, refreshScopes } = p;
  useEffect(() => {
    void refreshPeriods();
    void refreshScopes();
    void refreshAgenda();
  }, [refreshPeriods, refreshScopes, refreshAgenda]);

  // Opsi pemilih scope: untuk divisi (canDrill) = divisi + regional + cabang;
  // selain itu = scope milik user sendiri.
  const scopeOptions: SelectOption[] = useMemo(() => {
    const all = flattenScopes(p.scopeInfo);
    return all.map((s) => ({
      value: s.key,
      label: s.level === "cabang" ? `  • ${s.label}` : s.level === "regional" ? `${s.label}` : s.label
    }));
  }, [p.scopeInfo]);

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
      const doc = await uploadPdf(file, title, pages, p.scope?.key ?? null);
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

  function onDrop(targetIdx: number) {
    if (dragIdx !== null && dragIdx !== targetIdx) p.reorder(dragIdx, targetIdx);
    setDragIdx(null);
    setOverIdx(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {/* Header + CTA */}
        <div className={styles.header}>
          <div className={styles.headText}>
            <h1 className={styles.title}>Susun Agenda Presentasi</h1>
            <div className={styles.sub}>
              Seret kartu untuk mengurutkan, klik judul untuk mengubah. Slide memakai data <b>snapshot</b> periode terpilih.
            </div>
          </div>
          <Button
            variant="primary"
            icon="play"
            disabled={!p.activeSlides.length}
            onClick={p.start}
            className={styles.startBtn}
          >
            Mulai Presentasi
          </Button>
        </div>

        <div className={styles.layout}>
          {/* Kolom kiri — pengaturan rapat */}
          <aside className={styles.settings}>
            <div className={styles.settingsHead}>
              <Icon name="sliders-horizontal" size={15} />
              <span className={styles.settingsTitle}>Pengaturan Rapat</span>
            </div>

            <div className={styles.settingsBody}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Presentasi untuk</span>
                {scopeOptions.length > 1 ? (
                  <Select
                    value={p.scope?.key ?? ""}
                    onValueChange={(key) => {
                      const s = flattenScopes(p.scopeInfo).find((x) => x.key === key);
                      if (s) p.setScope(s);
                    }}
                    options={scopeOptions}
                    placeholder="Pilih scope"
                    icon="layers"
                    ariaLabel="Scope presentasi"
                  />
                ) : (
                  <div className={styles.scopeStatic}>{p.scope?.label ?? "Semua (Divisi)"}</div>
                )}
                {p.scope && (
                  <div className={styles.scopeNote}>
                    <span className={styles.scopeHint}>
                      Deck &amp; dokumen PDF terpisah per scope — perubahan di sini tidak memengaruhi scope lain.
                    </span>
                    {p.agendaIsOverride && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="rotate-ccw"
                        onClick={() => {
                          if (window.confirm("Kosongkan deck scope ini dan kembali ke susunan default?")) {
                            void p.resetAgenda();
                          }
                        }}
                      >
                        Reset deck
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Judul Rapat</span>
                <Input
                  value={p.meetingTitle}
                  onChange={(e) => p.setMeetingTitle(e.target.value)}
                  placeholder="Rapat Direktorat"
                  wrapClassName={styles.fill}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Tanggal Rapat</span>
                <Input
                  type="date"
                  value={p.meetingDate}
                  onChange={(e) => p.setMeetingDate(e.target.value)}
                  icon="calendar"
                  wrapClassName={styles.fill}
                />
              </div>
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
              {p.scope && p.scope.level !== "divisi" && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Data Kinerja L/R</span>
                  <span className={styles.scopeHint}>
                    Data kinerja L/R (ringkasan + breakdown) dikelola di menu <b>Laba Rugi Regional</b>. Slide di sini
                    mengikuti data yang sudah diunggah untuk lingkup terpilih.
                  </span>
                </div>
              )}

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Subjudul</span>
                <Input
                  value={p.meetingSubtitle}
                  onChange={(e) => p.setMeetingSubtitle(e.target.value)}
                  placeholder="Deskripsi singkat rapat"
                  wrapClassName={styles.fill}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Putar Otomatis</span>
                <div className={styles.autoBox}>
                  <label className={styles.autoLabel}>
                    <Switch checked={p.auto} onCheckedChange={p.toggleAuto} ariaLabel="Putar otomatis" />
                    Aktif
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

              {/* Dokumen PDF */}
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Dokumen PDF</span>
                {canUpload && (
                  <>
                    <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={handleFile} />
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="upload"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className={styles.fill}
                    >
                      {uploading ? "Mengunggah…" : "Unggah PDF"}
                    </Button>
                  </>
                )}
                {p.pdfs.length === 0 ? (
                  <span className={styles.pdfEmpty}>Belum ada dokumen.</span>
                ) : (
                  <div className={styles.pdfList}>
                    {p.pdfs.map((doc) => {
                      const inAgenda = pdfInAgenda(doc.id);
                      return (
                        <div key={doc.id} className={styles.pdfRow}>
                          <Icon name="file-text" size={15} />
                          <span className={styles.pdfTitle}>{doc.title}</span>
                          <span className={styles.spacer} />
                          {inAgenda ? (
                            <Button size="sm" variant="ghost" iconOnly icon="minus" title="Keluarkan dari agenda" onClick={() => p.removePdfFromAgenda(doc.id)} />
                          ) : (
                            <Button size="sm" variant="secondary" iconOnly icon="plus" title="Tambah ke agenda" onClick={() => p.addPdf(doc)} />
                          )}
                          {canDelete && (
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
            </div>
          </aside>

          {/* Kolom kanan — pengaturan agenda (porsi lebih besar) */}
          <section className={styles.agendaCol}>
            <div className={styles.gridHead}>
              <span className={styles.gridHeadTitle}>Agenda</span>
              <span className={styles.spacer} />
              <span className={styles.gridHeadCount}>
                {p.activeSlides.length} dari {p.order.length} slide aktif
              </span>
            </div>

            {/* Grid kartu slide — drag untuk urut, klik judul untuk ubah */}
            <div className={styles.grid}>
              {p.order.map((id, idx) => {
            const staticDef = SLIDES[id];
            const isCustom = isCustomCover(id);
            const pdfLabel = staticDef || isCustom ? null : pdfSlideLabel(id, p.pdfs);
            const def = staticDef
              ? { title: staticDef.title, feature: staticDef.feature, badge: staticDef.badge }
              : isCustom
                ? { title: "Sampul", feature: "Sampul Kustom", badge: "Sampul" }
                : pdfLabel
                  ? { title: pdfLabel.title, feature: pdfLabel.feature, badge: "PDF" }
                  : null;
            if (!def) return null;
            const on = !!p.enabled[id];
            const fk = featKey(def.feature);
            const effTitle = p.titles[id] ?? def.title;
            const isPdf = !staticDef && !isCustom;
            const isCover = def.badge === "Sampul";
            return (
              <div
                key={id}
                className={`${styles.card} ${isCover ? styles.cardCover : ""} ${on ? "" : styles.cardOff} ${
                  overIdx === idx ? styles.cardOver : ""
                } ${dragIdx === idx ? styles.cardDrag : ""}`}
                draggable
                onDragStart={(e) => {
                  setDragIdx(idx);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(idx));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overIdx !== idx) setOverIdx(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(idx);
                }}
                onDragEnd={() => {
                  setDragIdx(null);
                  setOverIdx(null);
                }}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardNum}>{idx + 1}</span>
                  <span className={styles.cardBadge}>{def.badge}</span>
                  <span className={styles.spacer} />
                  <button
                    type="button"
                    className={styles.cardAdd}
                    title="Sisipkan slide sampul setelah ini"
                    aria-label="Sisipkan slide sampul setelah ini"
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => p.addCoverSlide(id)}
                  >
                    <Icon name="circle-plus" size={17} />
                  </button>
                </div>

                <div className={styles.cardThumb}>
                  <Icon name={featIcon(fk)} size={26} />
                </div>

                <textarea
                  className={styles.cardTitle}
                  defaultValue={effTitle}
                  key={`${id}:${p.titles[id] ?? ""}`}
                  rows={1}
                  draggable={false}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onBlur={(e) => p.setSlideTitle(id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLTextAreaElement).blur();
                    }
                  }}
                  aria-label={`Judul slide ${idx + 1}`}
                  title="Klik untuk mengubah judul"
                />
                {isCustom ? (
                  <textarea
                    className={styles.cardSub}
                    defaultValue={p.subtitles[id] ?? ""}
                    key={`sub:${id}:${p.subtitles[id] ?? ""}`}
                    rows={1}
                    placeholder="Subjudul (opsional)"
                    draggable={false}
                    ref={(el) => {
                      if (el) {
                        el.style.height = "auto";
                        el.style.height = `${el.scrollHeight}px`;
                      }
                    }}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onBlur={(e) => p.setSlideSubtitle(id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLTextAreaElement).blur();
                      }
                    }}
                    aria-label={`Subjudul slide ${idx + 1}`}
                  />
                ) : (
                  <span className={styles.cardFeat}>{def.feature}</span>
                )}

                <div className={styles.cardFoot}>
                  <label className={styles.cardToggle}>
                    <Switch checked={on} onCheckedChange={() => p.toggleEnabled(id)} ariaLabel={`Aktifkan ${effTitle}`} />
                    <span>{on ? "Aktif" : "Nonaktif"}</span>
                  </label>
                  {(isPdf || isCustom) && (
                    <button
                      type="button"
                      className={styles.cardRemove}
                      title={isCustom ? "Hapus sampul" : "Keluarkan dari agenda"}
                      onClick={() => {
                        if (isCustom) {
                          p.removeCoverSlide(id);
                        } else {
                          const meta = parsePdfSlide(id);
                          if (meta) p.removePdfFromAgenda(meta.pdfId);
                        }
                      }}
                    >
                      <Icon name="x" size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
              })}
            </div>

            <span className={styles.hint}>Layar penuh · panah ◄ ► untuk navigasi · Esc keluar</span>
          </section>
        </div>
      </div>
    </div>
  );
}
