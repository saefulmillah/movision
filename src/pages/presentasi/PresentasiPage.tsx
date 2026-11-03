import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Select, Switch, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { usePresentation } from "@/context/PresentationContext";
import { SLIDES, isSlideAllowedForScope } from "@/components/presentation/slideRegistry";
import { parsePdfSlide, pdfSlideLabel } from "@/components/presentation/pdfSlides";
import { isCustomCover } from "@/components/presentation/customCover";
import { SlidePreview, type ThumbKind } from "@/components/presentation/SlidePreview";
import { formatDateId } from "@/components/presentation/SlideView";
import { FontSizeControl } from "@/components/presentation/FontSizeControl";
import { flattenScopes } from "@/lib/presentationScope";
import { countPagesOfFile, deletePdf, uploadPdf, type PdfDoc } from "@/lib/presentationPdf";
import {
  deleteCover,
  getCoverMeta,
  invalidateCoverUrl,
  resolveCoverUrl,
  uploadCover,
  type CoverMeta
} from "@/lib/presentationCover";
import styles from "./PresentasiPage.module.css";

type SecKey = "info" | "visual" | "pdf" | "play";

/** Ikon rail sidebar saat collapse — klik membuka seksi terkait. */
const RAIL: { k: SecKey; icon: string; title: string }[] = [
  { k: "info", icon: "building-2", title: "Informasi Rapat" },
  { k: "visual", icon: "palette", title: "Identitas Visual" },
  { k: "pdf", icon: "file-text", title: "Dokumen PDF" },
  { k: "play", icon: "sliders-horizontal", title: "Pengaturan Pemutaran" }
];

interface AccordionSectionProps {
  open: boolean;
  onToggle: () => void;
  icon: string;
  title: string;
  badge?: string;
  dot?: boolean;
  children: React.ReactNode;
}

/** Seksi accordion sidebar (animasi grid-template-rows 1fr↔0fr seperti handoff). */
function AccordionSection({ open, onToggle, icon, title, badge, dot, children }: AccordionSectionProps) {
  return (
    <div className={styles.acc}>
      <button type="button" className={styles.accHead} onClick={onToggle} aria-expanded={open}>
        <Icon name={icon} size={15} className={styles.accIcon} />
        <span className={styles.accTitle}>{title}</span>
        {dot && <span className={styles.accDot} />}
        {badge && <span className={styles.accBadge}>{badge}</span>}
        <Icon name="chevron-down" size={16} className={`${styles.accChev} ${open ? styles.accChevOpen : ""}`} />
      </button>
      <div className={styles.accBody} style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className={styles.accBodyClip}>
          <div className={styles.accBodyInner}>{children}</div>
        </div>
      </div>
    </div>
  );
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

  // Gambar sampul pembuka per scope aktif.
  const scopeKey = p.scope?.key ?? "divisi";
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverMeta, setCoverMeta] = useState<CoverMeta | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);

  // Kartu terpilih → tampilkan preview isi slide NYATA (WYSIWYG). Kartu lain
  // memakai skematik ringan agar builder tetap ringan (hanya 1 slide "hidup").
  const [selected, setSelected] = useState<string | null>(null);

  // Pilih-banyak: seleksi untuk menggeser beberapa slide bersamaan (drag) atau
  // mengaktifkan/menonaktifkan secara massal. Independen dari `selected` (preview).
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearPicked = () => setPicked(new Set());

  // Mode tampilan agenda: thumbnail besar (grid/normal) atau kartu horizontal
  // ringkas (compact) — compact menampung lebih banyak slide per layar.
  const [viewMode, setViewMode] = useState<"grid" | "compact">(() => {
    try {
      return localStorage.getItem("tollsentra.presentation.view") === "compact" ? "compact" : "grid";
    } catch {
      return "grid";
    }
  });
  const setView = (m: "grid" | "compact") => {
    setViewMode(m);
    try {
      localStorage.setItem("tollsentra.presentation.view", m);
    } catch {
      /* localStorage tak tersedia */
    }
  };

  // Sidebar konfigurasi: collapse ke rail ikon + seksi accordion yang terbuka.
  const [sbCollapsed, setSbCollapsed] = useState(false);
  const [openSec, setOpenSec] = useState<Record<SecKey, boolean>>({
    info: true,
    visual: false,
    pdf: false,
    play: false
  });
  const toggleSec = (k: SecKey) => setOpenSec((s) => ({ ...s, [k]: !s[k] }));
  const openSection = (k: SecKey) => {
    setOpenSec((s) => ({ ...s, [k]: true }));
    setSbCollapsed(false);
  };

  // Drag-and-drop urutan slide.
  // `overIns` = slot sisipan 0..N (celah ANTAR kartu, bukan indeks kartu).
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIns, setOverIns] = useState<number | null>(null);
  const [movedId, setMovedId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const flipPrev = useRef<Map<string, DOMRect>>(new Map());
  const movedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll saat drag mendekati tepi atas/bawah (agar kartu bawah bisa
  // diseret ke atas tanpa lepas pada agenda panjang).
  const pageRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef<{ dir: number; raf: number | null }>({ dir: 0, raf: null });
  const stopAutoScroll = () => {
    autoScroll.current.dir = 0;
    if (autoScroll.current.raf != null) {
      cancelAnimationFrame(autoScroll.current.raf);
      autoScroll.current.raf = null;
    }
  };
  const autoScrollTick = () => {
    const el = pageRef.current;
    const st = autoScroll.current;
    if (!el || st.dir === 0) {
      st.raf = null;
      return;
    }
    el.scrollTop += st.dir * 16;
    st.raf = requestAnimationFrame(autoScrollTick);
  };
  const updateAutoScroll = (clientY: number) => {
    const el = pageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const EDGE = 90;
    const dir = clientY < r.top + EDGE ? -1 : clientY > r.bottom - EDGE ? 1 : 0;
    autoScroll.current.dir = dir;
    if (dir !== 0 && autoScroll.current.raf == null) {
      autoScroll.current.raf = requestAnimationFrame(autoScrollTick);
    } else if (dir === 0) {
      stopAutoScroll();
    }
  };

  // FLIP: animasikan perpindahan kartu HANYA saat urutan nyata berubah (commit),
  // bukan tiap placeholder bergerak (animasi mid-drag memicu jitter pada HTML5 DnD).
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-card-id]"));
    for (const el of cards) {
      const id = el.dataset.cardId;
      if (!id) continue;
      const before = flipPrev.current.get(id);
      const now = el.getBoundingClientRect();
      if (before && !el.classList.contains(styles.cardDragging)) {
        const dx = before.left - now.left;
        const dy = before.top - now.top;
        if (dx || dy) {
          el.style.transition = "none";
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.style.zIndex = "1";
          void el.getBoundingClientRect(); // paksa reflow
          requestAnimationFrame(() => {
            el.style.transition = "transform .34s cubic-bezier(.22,1,.36,1)";
            el.style.transform = "";
            window.setTimeout(() => {
              el.style.zIndex = "";
              el.style.transition = "";
            }, 340);
          });
        }
      }
    }
    // Simpan posisi commit terakhir sebagai titik awal FLIP berikutnya.
    const snap = new Map<string, DOMRect>();
    for (const el of cards) {
      if (el.dataset.cardId) snap.set(el.dataset.cardId, el.getBoundingClientRect());
    }
    flipPrev.current = snap;
  }, [p.order]);

  useEffect(() => () => {
    if (movedTimer.current) clearTimeout(movedTimer.current);
    stopAutoScroll();
  }, []);

  // Segarkan periode, scope, lalu agenda+PDF (atomik per scope) tiap builder dibuka.
  const { refreshPeriods, refreshAgenda, refreshScopes, ensureSnapshot } = p;
  useEffect(() => {
    void refreshPeriods();
    void refreshScopes();
    void refreshAgenda();
  }, [refreshPeriods, refreshScopes, refreshAgenda]);

  // Muat snapshot HANYA saat ada kartu dipilih (preview WYSIWYG). Builder yang
  // baru dibuka tidak memicu fetch; cache dibagi dengan mode presentasi.
  useEffect(() => {
    if (selected) ensureSnapshot();
  }, [ensureSnapshot, selected, p.period, p.scope]);

  // Muat metadata + pratinjau gambar sampul scope aktif.
  useEffect(() => {
    let alive = true;
    getCoverMeta(scopeKey)
      .then(async (meta) => {
        if (!alive) return;
        setCoverMeta(meta);
        const url = meta ? await resolveCoverUrl(scopeKey) : null;
        if (alive) setCoverPreview(url);
      })
      .catch(() => {
        if (alive) {
          setCoverMeta(null);
          setCoverPreview(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [scopeKey]);

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

  // Id slide yang TAMPAK pada scope aktif (dasar "pilih semua" & pembersihan).
  const visibleIds = useMemo(
    () => p.order.filter((id) => isSlideAllowedForScope(id, p.scope?.level)),
    [p.order, p.scope]
  );
  const allPicked = picked.size > 0 && picked.size === visibleIds.length;
  const togglePickAll = () => setPicked(allPicked ? new Set() : new Set(visibleIds));
  const bulkEnable = (on: boolean) => p.setManyEnabled([...picked], on);

  // Buang id terpilih yang tak lagi tampak (scope berganti / slide dihapus).
  useEffect(() => {
    setPicked((prev) => {
      if (prev.size === 0) return prev;
      const vis = new Set(visibleIds);
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (vis.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visibleIds]);

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

  async function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverBusy(true);
    try {
      await uploadCover(file, scopeKey);
      invalidateCoverUrl(scopeKey);
      const meta = await getCoverMeta(scopeKey);
      setCoverMeta(meta);
      setCoverPreview(meta ? await resolveCoverUrl(scopeKey) : null);
      toast.success("Gambar sampul disimpan", `Latar semua slide sampul untuk ${p.scope?.label ?? "scope ini"} diperbarui.`);
    } catch (err) {
      toast.error("Upload gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setCoverBusy(false);
    }
  }

  async function handleCoverDelete() {
    if (!coverMeta) return;
    if (!window.confirm("Hapus gambar sampul scope ini? Semua slide sampul kembali ke foto bawaan.")) return;
    setCoverBusy(true);
    try {
      await deleteCover(coverMeta.id);
      invalidateCoverUrl(scopeKey);
      setCoverMeta(null);
      setCoverPreview(null);
      toast.success("Gambar sampul dihapus", "Semua slide sampul kembali ke foto bawaan.");
    } catch (err) {
      toast.error("Hapus gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setCoverBusy(false);
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

  /** Terapkan urutan baru dari slot sisipan aktif, lalu picu "pop" pada kartu yang mendarat. */
  function commitReorder() {
    stopAutoScroll();
    if (dragIdx === null || overIns === null) {
      setDragIdx(null);
      setOverIns(null);
      return;
    }
    const draggedId = p.order[dragIdx];
    // Geser berkelompok: bila kartu yang diseret termasuk dalam pilihan (>1),
    // pindahkan SEMUA slide terpilih bersama ke slot sisipan aktif.
    if (picked.size > 1 && picked.has(draggedId)) {
      const ids = p.order.filter((id) => picked.has(id));
      p.reorderMany(ids, overIns);
      setMovedId(draggedId);
      if (movedTimer.current) clearTimeout(movedTimer.current);
      movedTimer.current = setTimeout(() => setMovedId(null), 700);
      setDragIdx(null);
      setOverIns(null);
      return;
    }
    // Slot sisipan (celah) → indeks target setelah kartu sumber dicabut.
    const target = overIns > dragIdx ? overIns - 1 : overIns;
    if (target !== dragIdx) {
      const landed = p.order[dragIdx];
      p.reorder(dragIdx, target);
      setMovedId(landed);
      if (movedTimer.current) clearTimeout(movedTimer.current);
      movedTimer.current = setTimeout(() => setMovedId(null), 700);
    }
    setDragIdx(null);
    setOverIns(null);
  }

  /** Mouse-down pada anak interaktif (toggle, judul, tombol) tak boleh memulai drag kartu. */
  const stopDrag = (e: React.MouseEvent) => e.stopPropagation();

  const dateLabel = formatDateId(p.meetingDate);

  return (
    <div className={styles.page} ref={pageRef}>
      <div className={styles.wrap}>
        {/* Header: identitas rapat + hitungan slide aktif + CTA */}
        <div className={styles.header}>
          <span className={styles.appMark}>
            <Icon name="presentation" size={19} />
          </span>
          <div className={styles.headText}>
            <h1 className={styles.title}>{p.meetingTitle || "Rapat Direktorat"}</h1>
            <div className={styles.meta}>
              <span className={styles.metaItem}>
                <Icon name="building-2" size={13} />
                {p.scope?.label ?? "Semua (Divisi)"}
              </span>
              <span className={styles.metaDot}>·</span>
              {dateLabel && (
                <>
                  <span className={styles.metaItem}>
                    <Icon name="calendar" size={13} />
                    {dateLabel}
                  </span>
                  <span className={styles.metaDot}>·</span>
                </>
              )}
              <span className={styles.metaItem}>Snapshot {p.periodLabel}</span>
            </div>
          </div>
          <span className={styles.spacer} />
          <div className={styles.countBox}>
            <div className={styles.countVal}>
              {p.activeSlides.length}
              <span className={styles.countTot}>/{p.order.length}</span>
            </div>
            <div className={styles.countLabel}>Slide Aktif</div>
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
          <aside className={`${styles.settings} ${sbCollapsed ? styles.settingsCollapsed : ""}`}>
            <div className={styles.settingsHead}>
              {!sbCollapsed && (
                <>
                  <Icon name="sliders-horizontal" size={15} />
                  <span className={styles.settingsTitle}>Konfigurasi Rapat</span>
                  <span className={styles.spacer} />
                </>
              )}
              <button
                type="button"
                className={styles.collapseBtn}
                title={sbCollapsed ? "Perluas" : "Ringkas"}
                aria-label={sbCollapsed ? "Perluas sidebar" : "Ringkas sidebar"}
                onClick={() => setSbCollapsed((v) => !v)}
              >
                <Icon name={sbCollapsed ? "panel-left-open" : "panel-left-close"} size={17} />
              </button>
            </div>

            {sbCollapsed ? (
              <div className={styles.rail}>
                {RAIL.map((r) => (
                  <button
                    key={r.k}
                    type="button"
                    className={styles.railBtn}
                    title={r.title}
                    aria-label={r.title}
                    onClick={() => openSection(r.k)}
                  >
                    <Icon name={r.icon} size={18} />
                  </button>
                ))}
              </div>
            ) : (
            <div className={styles.settingsBody}>
              <AccordionSection open={openSec.info} onToggle={() => toggleSec("info")} icon="building-2" title="Informasi Rapat">
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
              </AccordionSection>

              <AccordionSection
                open={openSec.visual}
                onToggle={() => toggleSec("visual")}
                icon="palette"
                title="Identitas Visual"
                dot={!coverMeta}
              >
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Subjudul</span>
                <Input
                  value={p.meetingSubtitle}
                  onChange={(e) => p.setMeetingSubtitle(e.target.value)}
                  placeholder="Deskripsi singkat rapat"
                  wrapClassName={styles.fill}
                />
              </div>

              {/* Gambar sampul — per scope (isolasi penuh), dipakai di semua slide sampul. */}
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Gambar Sampul</span>
                {coverPreview && (
                  <div className={styles.coverPreview}>
                    <img src={coverPreview} alt="Pratinjau gambar sampul" />
                  </div>
                )}
                {canUpload ? (
                  <>
                    <input
                      ref={coverRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={handleCoverFile}
                    />
                    <div className={styles.coverActions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="image"
                        disabled={coverBusy}
                        onClick={() => coverRef.current?.click()}
                        className={styles.fill}
                      >
                        {coverBusy ? "Memproses…" : coverMeta ? "Ganti Gambar" : "Unggah Gambar"}
                      </Button>
                      {coverMeta && canDelete && (
                        <Button size="sm" variant="ghost" icon="trash-2" disabled={coverBusy} onClick={handleCoverDelete}>
                          Hapus
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  !coverPreview && <span className={styles.pdfEmpty}>Belum ada gambar.</span>
                )}
              </div>
              </AccordionSection>

              <AccordionSection
                open={openSec.pdf}
                onToggle={() => toggleSec("pdf")}
                icon="file-text"
                title="Dokumen PDF"
                badge={String(p.pdfs.length)}
              >
              <div className={styles.field}>
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
              </AccordionSection>

              <AccordionSection
                open={openSec.play}
                onToggle={() => toggleSec("play")}
                icon="sliders-horizontal"
                title="Pengaturan Pemutaran"
              >
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
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Ukuran Teks</span>
                <FontSizeControl value={p.fontScale} onChange={p.setFontScale} variant="builder" />
              </div>
              </AccordionSection>
            </div>
            )}
          </aside>

          {/* Kolom kanan — pengaturan agenda (porsi lebih besar) */}
          <section className={styles.agendaCol}>
            <div className={styles.gridHead}>
              <span className={styles.gridHeadTitle}>Agenda</span>
              <span className={styles.spacer} />
              <span className={styles.gridHeadCount}>
                {p.activeSlides.length} dari {p.order.length} slide aktif
              </span>
              <div className={styles.viewToggle} role="group" aria-label="Mode tampilan agenda">
                <button
                  type="button"
                  className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnOn : ""}`}
                  title="Mode normal (thumbnail besar)"
                  aria-label="Mode normal"
                  aria-pressed={viewMode === "grid"}
                  onClick={() => setView("grid")}
                >
                  <Icon name="layout-grid" size={15} />
                  <span className={styles.viewBtnText}>Normal</span>
                </button>
                <button
                  type="button"
                  className={`${styles.viewBtn} ${viewMode === "compact" ? styles.viewBtnOn : ""}`}
                  title="Mode compact (kartu ringkas horizontal)"
                  aria-label="Mode compact"
                  aria-pressed={viewMode === "compact"}
                  onClick={() => setView("compact")}
                >
                  <Icon name="rows-3" size={15} />
                  <span className={styles.viewBtnText}>Compact</span>
                </button>
              </div>
            </div>

            {/* Grid kartu slide — drag untuk urut, klik judul untuk ubah */}
            <div
              ref={gridRef}
              className={viewMode === "compact" ? styles.compactGrid : styles.grid}
              onDragOver={(e) => {
                if (dragIdx === null) return;
                e.preventDefault();
                updateAutoScroll(e.clientY); // gulir otomatis dekat tepi atas/bawah
              }}
              onDrop={(e) => {
                e.preventDefault();
                commitReorder();
              }}
              onDragLeave={(e) => {
                // Sembunyikan placeholder & hentikan auto-scroll saat pointer keluar grid.
                if (dragIdx !== null && !e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOverIns(null);
                  stopAutoScroll();
                }
              }}
            >
              {p.order.map((id, idx) => {
            // Slide khusus-scope (mis. Kinerja Regional) disembunyikan di scope lain;
            // return null menjaga `idx` tetap selaras dengan p.order untuk drag/reorder.
            if (!isSlideAllowedForScope(id, p.scope?.level)) return null;
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
            const isPicked = picked.has(id);
            const effTitle = p.titles[id] ?? def.title;
            const isPdf = !staticDef && !isCustom;
            const isCover = def.badge === "Sampul";
            const thumbKind: ThumbKind = isCover
              ? "cover"
              : isPdf
                ? "pdf"
                : def.badge === "Tabel"
                  ? "table"
                  : def.badge === "Peta"
                    ? "matrix"
                    : def.badge === "Dashboard"
                      ? "kpi"
                      : "chart";
            // Placeholder "Letakkan di sini" muncul di slot sisipan, kecuali bila slot
            // sama dengan posisi kartu yang sedang diseret (gerakan tanpa efek).
            const showDrop =
              dragIdx !== null && overIns === idx && overIns !== dragIdx && overIns !== dragIdx + 1;
            // Handler drag bersama (grid & list); axis sisipan ikut mode.
            const onStart = (e: React.DragEvent) => {
              e.dataTransfer.effectAllowed = "move";
              try {
                e.dataTransfer.setData("text/plain", id);
              } catch {
                /* sebagian browser rewel saat setData */
              }
              setDragIdx(idx);
              setOverIns(null);
            };
            const onOver = (e: React.DragEvent) => {
              e.preventDefault();
              if (dragIdx === null) return;
              e.dataTransfer.dropEffect = "move";
              const r = e.currentTarget.getBoundingClientRect();
              // Grid & compact mengalir horizontal → titik tengah lebar kartu
              // menentukan sisip sebelum/sesudah.
              const ins = e.clientX < r.left + r.width / 2 ? idx : idx + 1;
              if (overIns !== ins) setOverIns(ins);
            };
            const onEnd = () => {
              setDragIdx(null);
              setOverIns(null);
              stopAutoScroll();
            };
            const onDropItem = (e: React.DragEvent) => {
              e.preventDefault();
              e.stopPropagation();
              commitReorder();
            };
            const selectItem = () => setSelected(id);
            const removeItem = () => {
              if (isCustom) {
                p.removeCoverSlide(id);
              } else {
                const meta = parsePdfSlide(id);
                if (meta) p.removePdfFromAgenda(meta.pdfId);
              }
            };
            return (
              <Fragment key={id}>
                {showDrop &&
                  (viewMode === "compact" ? (
                    <div className={styles.dropPhCompact} aria-hidden="true">
                      <Icon name="arrow-down-to-line" size={18} />
                      <span>Letakkan di sini</span>
                    </div>
                  ) : (
                    <div className={styles.dropPh} aria-hidden="true">
                      <Icon name="move" size={22} />
                      <span>Letakkan di sini</span>
                    </div>
                  ))}
                {viewMode === "compact" ? (
                  <div
                    className={`${styles.compact} ${isCover ? styles.compactCover : ""} ${
                      selected === id ? styles.compactSelected : ""
                    } ${isPicked ? styles.compactPicked : ""} ${on ? "" : styles.compactOff} ${
                      dragIdx === idx ? styles.compactDragging : ""
                    } ${movedId === id ? styles.compactMoved : ""}`}
                    data-card-id={id}
                    draggable
                    onClick={selectItem}
                    onDragStart={onStart}
                    onDragOver={onOver}
                    onDrop={onDropItem}
                    onDragEnd={onEnd}
                  >
                    {/* Kiri: (pilih di atas · grip) · thumbnail 16:9 nyata */}
                    <div className={styles.compactHandle}>
                      <button
                        type="button"
                        className={`${styles.compactPick} ${isPicked ? styles.compactPickOn : ""}`}
                        title={isPicked ? "Batalkan pilih slide" : "Pilih slide"}
                        aria-label={isPicked ? "Batalkan pilih slide" : "Pilih slide"}
                        aria-pressed={isPicked}
                        draggable={false}
                        onMouseDown={stopDrag}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePick(id);
                        }}
                      >
                        <Icon name="check" size={13} />
                      </button>
                      <span className={styles.compactGrip} aria-hidden="true">
                        <Icon name="grip-vertical" size={15} />
                      </span>
                    </div>
                    <div className={styles.compactThumb}>
                      <SlidePreview
                        slideId={id}
                        coverBg={coverPreview}
                        cover={isCover}
                        kind={thumbKind}
                        live={selected === id}
                        hintCaption={false}
                      />
                    </div>

                    {/* Tengah: nomor · judul · keterangan · label jenis */}
                    <div className={styles.compactMain}>
                      <div className={styles.compactMeta}>
                        <span className={styles.compactNum}>{idx + 1}</span>
                        <span className={styles.compactBadge}>{def.badge}</span>
                      </div>
                      <span className={styles.compactTitle} title={effTitle}>
                        {effTitle}
                      </span>
                      <span className={styles.compactFeat}>
                        {isCustom ? p.subtitles[id] || "Slide sampul" : def.feature}
                      </span>
                    </div>

                    {/* Kanan: status aktif · aksi existing */}
                    <div className={styles.compactRight}>
                      <label
                        className={styles.compactToggle}
                        onMouseDown={stopDrag}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Switch
                          checked={on}
                          onCheckedChange={() => p.toggleEnabled(id)}
                          ariaLabel={`Aktifkan ${effTitle}`}
                        />
                      </label>
                      <div className={styles.compactActs}>
                        <button
                          type="button"
                          className={styles.cardAdd}
                          title="Sisipkan slide sampul setelah ini"
                          aria-label="Sisipkan slide sampul setelah ini"
                          draggable={false}
                          onMouseDown={stopDrag}
                          onClick={(e) => {
                            e.stopPropagation();
                            p.addCoverSlide(id);
                          }}
                        >
                          <Icon name="circle-plus" size={16} />
                        </button>
                        {(isPdf || isCustom) && (
                          <button
                            type="button"
                            className={styles.cardRemove}
                            draggable={false}
                            onMouseDown={stopDrag}
                            title={isCustom ? "Hapus sampul" : "Keluarkan dari agenda"}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem();
                            }}
                          >
                            <Icon name="x" size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
              <div
                className={`${styles.card} ${isCover ? styles.cardCover : ""} ${
                  selected === id ? styles.cardSelected : ""
                } ${isPicked ? styles.cardPicked : ""} ${on ? "" : styles.cardOff} ${
                  dragIdx === idx ? styles.cardDragging : ""
                } ${movedId === id ? styles.cardMoved : ""}`}
                data-card-id={id}
                draggable
                onClick={selectItem}
                onDragStart={onStart}
                onDragOver={onOver}
                onDrop={onDropItem}
                onDragEnd={onEnd}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardNum}>{idx + 1}</span>
                  <span className={styles.cardBadge}>{def.badge}</span>
                  <span className={styles.spacer} />
                  <button
                    type="button"
                    className={`${styles.cardPick} ${isPicked ? styles.cardPickOn : ""}`}
                    title={isPicked ? "Batalkan pilih slide" : "Pilih slide"}
                    aria-label={isPicked ? "Batalkan pilih slide" : "Pilih slide"}
                    aria-pressed={isPicked}
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePick(id);
                    }}
                  >
                    <Icon name="check" size={14} />
                  </button>
                </div>

                <div className={styles.cardThumb}>
                  <SlidePreview
                    slideId={id}
                    coverBg={coverPreview}
                    cover={isCover}
                    kind={thumbKind}
                    live={selected === id}
                  />
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
                  <label className={styles.cardToggle} onMouseDown={stopDrag}>
                    <Switch checked={on} onCheckedChange={() => p.toggleEnabled(id)} ariaLabel={`Aktifkan ${effTitle}`} />
                    <span>{on ? "Aktif" : "Nonaktif"}</span>
                  </label>
                  <span className={styles.spacer} />
                  <button
                    type="button"
                    className={styles.cardAdd}
                    title="Sisipkan slide sampul setelah ini"
                    aria-label="Sisipkan slide sampul setelah ini"
                    draggable={false}
                    onMouseDown={stopDrag}
                    onClick={() => p.addCoverSlide(id)}
                  >
                    <Icon name="circle-plus" size={17} />
                  </button>
                  {(isPdf || isCustom) && (
                    <button
                      type="button"
                      className={styles.cardRemove}
                      draggable={false}
                      onMouseDown={stopDrag}
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
                )}
              </Fragment>
            );
              })}
              {/* Placeholder sisip di ujung agenda */}
              {dragIdx !== null &&
                overIns === p.order.length &&
                overIns !== dragIdx + 1 &&
                (viewMode === "compact" ? (
                  <div className={styles.dropPhCompact} aria-hidden="true">
                    <Icon name="arrow-down-to-line" size={18} />
                    <span>Letakkan di sini</span>
                  </div>
                ) : (
                  <div className={styles.dropPh} aria-hidden="true">
                    <Icon name="move" size={22} />
                    <span>Letakkan di sini</span>
                  </div>
                ))}
            </div>

            <span className={styles.hint}>Layar penuh · panah ◄ ► untuk navigasi · Esc keluar</span>
          </section>
        </div>
      </div>

      {/* Bilah aksi massal — floating, compact, semi-transparan di pojok kanan
          bawah. Meredup & non-interaktif saat drag agar tak menghalangi drop. */}
      {picked.size > 0 && (
        <div className={`${styles.selBar} ${dragIdx !== null ? styles.selBarDrag : ""}`}>
          <span className={styles.selCount}>
            <b>{picked.size}</b> dipilih
          </span>
          <span className={styles.selDiv} />
          <button
            type="button"
            className={styles.selBtn}
            title="Aktifkan slide terpilih"
            aria-label="Aktifkan slide terpilih"
            onClick={() => bulkEnable(true)}
          >
            <Icon name="eye" size={16} />
          </button>
          <button
            type="button"
            className={styles.selBtn}
            title="Nonaktifkan slide terpilih"
            aria-label="Nonaktifkan slide terpilih"
            onClick={() => bulkEnable(false)}
          >
            <Icon name="eye-off" size={16} />
          </button>
          <button
            type="button"
            className={styles.selBtn}
            title={allPicked ? "Batalkan semua" : "Pilih semua"}
            aria-label={allPicked ? "Batalkan semua" : "Pilih semua"}
            onClick={togglePickAll}
          >
            <Icon name={allPicked ? "square" : "square-check"} size={16} />
          </button>
          <span className={styles.selDiv} />
          <button
            type="button"
            className={styles.selBtn}
            title="Tutup pilih slide"
            aria-label="Tutup pilih slide"
            onClick={clearPicked}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
