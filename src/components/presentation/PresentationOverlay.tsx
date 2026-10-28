import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui";
import { usePresentation } from "@/context/PresentationContext";
import { SLIDES } from "./slideRegistry";
import { CoverSlide } from "./slides/CoverSlide";
import type { Fact } from "./slides/CoverSlide";
import { LrTableSlide } from "./slides/LrTableSlide";
import { RiskMapSlide } from "./slides/RiskMapSlide";
import { PendapatanOverviewSlide } from "./slides/PendapatanOverviewSlide";
import { KinerjaRegionalSlide } from "./slides/KinerjaRegionalSlide";
import { LhrPhrBpSlide } from "./slides/LhrPhrBpSlide";
import { SentimentDashboardSlide } from "./slides/SentimentDashboardSlide";
import { OdolSlide } from "./slides/OdolSlide";
import { PdfPageSlide } from "./slides/PdfPageSlide";
import { parsePdfSlide, pdfSlideLabel } from "./pdfSlides";
import { isCustomCover } from "./customCover";
import type { LrView } from "@/lib/labaRugiView";
import brandLogos from "@/assets/presentation/brand-logos.png";
import movisionMark from "@/assets/presentation/movision-mark.webp";
import "@/styles/presentation-anim.css";
import styles from "./PresentationOverlay.module.css";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/** ISO "2026-09-29" → "29 September 2026"; kosong/invalid → "". */
function formatDateId(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return "";
  return `${d} ${MONTHS_ID[mo - 1]} ${y}`;
}

export function PresentationOverlay() {
  const p = usePresentation();
  const rootRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);
  const [periodOpen, setPeriodOpen] = useState(false);

  const total = p.activeSlides.length;
  const cur = Math.min(p.cur, Math.max(0, total - 1));
  const key = p.activeSlides[cur] || "title";
  const isCover = SLIDES[key]?.badge === "Sampul" || isCustomCover(key);

  // Aksi stabil (useCallback di context) — dipakai di efek tanpa memicu re-run tiap render.
  const { mode, auto, autoSec, next, prev, exit: ctxExit } = p;

  // Navigasi keyboard.
  useEffect(() => {
    if (mode !== "present") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next(false);
      } else if (e.key === "ArrowLeft") {
        prev();
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) void document.exitFullscreen?.();
        ctxExit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, next, prev, ctxExit]);

  // Auto-advance — restart tiap ganti slide / ubah setelan.
  useEffect(() => {
    if (mode !== "present" || !auto || total === 0) return;
    const t = setInterval(() => next(true), autoSec * 1000);
    return () => clearInterval(t);
  }, [mode, auto, autoSec, cur, total, next]);

  // Tutup dropdown periode saat klik di luar (berbasis ref, mousedown — agar opsi tetap terpilih).
  useEffect(() => {
    if (!periodOpen) return;
    const onDown = (e: MouseEvent) => {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) setPeriodOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [periodOpen]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void el.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    ctxExit();
  }, [ctxExit]);

  const meetingDateLabel = formatDateId(p.meetingDate);
  const facts = useMemo<Record<string, Fact[]>>(() => {
    const pendRuas = p.snapshot.data?.pend?.lhr.length ?? 0;
    const pendMonth = p.snapshot.data?.pend?.meta.period_label_month;
    const titleFacts: Fact[] = [{ k: "Periode", v: p.periodLabel }];
    if (meetingDateLabel) titleFacts.push({ k: "Tanggal Rapat", v: meetingDateLabel });
    return {
      title: titleFacts,
      "lr-cover": [{ k: "Periode", v: p.periodLabel }],
      "risk-cover": [],
      "pend-cover": [
        { k: "Periode", v: pendMonth ? `${pendMonth} & ${p.periodLabel}` : p.periodLabel },
        { k: "Ruas", v: pendRuas ? `${pendRuas} ruas` : "—" },
        { k: "Unit", v: "Rp miliar" }
      ],
      "sent-cover": [{ k: "Periode", v: p.periodLabel }],
      "odol-cover": [{ k: "Periode", v: `Tahun ${new Date().getFullYear()}` }]
    };
  }, [p.periodLabel, p.snapshot.data, meetingDateLabel]);

  if (p.mode !== "present") return null;

  // Nomor "Bagian" dinamis — mengikuti urutan sampul bagian yang aktif.
  const SECTION_COVERS = ["lr-cover", "risk-cover", "pend-cover", "sent-cover", "odol-cover"];
  const sectionNo = (coverKey: string) => {
    const active = p.activeSlides.filter((id) => SECTION_COVERS.includes(id));
    const idx = active.indexOf(coverKey);
    return idx >= 0 ? idx + 1 : 1;
  };

  // Label scope aktif (regional/cabang); divisi → null. LR & Pendapatan sudah
  // difilter per scope di backend; Risiko masih level-divisi (Fase 4).
  const scopeLabel = p.scope && p.scope.level !== "divisi" ? p.scope.label : null;
  const withScope = (arr: Fact[]): Fact[] => (scopeLabel ? [{ k: "Cakupan", v: scopeLabel }, ...arr] : arr);

  const renderSlide = () => {
    if (key === "title") {
      return (
        <CoverSlide
          kicker="Movision"
          title={p.meetingTitle || "Rapat Direktorat"}
          sub={p.meetingSubtitle}
          facts={facts.title}
        />
      );
    }
    if (key === "closing") {
      return (
        <CoverSlide
          kicker="Penutup"
          title="Terima Kasih"
          sub={`${p.meetingTitle || "Rapat Direktorat"}${meetingDateLabel ? ` · ${meetingDateLabel}` : ""}`}
          facts={[]}
        />
      );
    }
    if (key === "lr-cover") {
      return (
        <CoverSlide
          kicker={`Bagian ${sectionNo("lr-cover")}`}
          title="Laba Rugi"
          sub="Realisasi terhadap RKAP — konsolidasi, per regional, dan per ruas."
          facts={withScope(facts["lr-cover"])}
        />
      );
    }
    if (key === "risk-cover") {
      return (
        <CoverSlide
          kicker={`Bagian ${sectionNo("risk-cover")}`}
          title="Manajemen Risiko"
          sub="Top Risk Divisi pada peta risiko 5×5 beserta nilai eksposur tiap tahapan."
          facts={facts["risk-cover"]}
        />
      );
    }
    if (key === "lr-konsol" || key === "lr-regional" || key === "lr-ruas") {
      if (p.snapshot.loading) return <StageLoader />;
      const view = key.split("-")[1] as LrView;
      return <LrTableSlide view={view} data={p.snapshot.data?.lr ?? null} periodLabel={p.periodLabel} scopeLabel={scopeLabel} />;
    }
    if (key === "kinerja-regional") {
      if (p.snapshot.loading) return <StageLoader />;
      return <KinerjaRegionalSlide data={p.snapshot.data?.kinerja ?? null} periodLabel={p.periodLabel} scopeLabel={scopeLabel} />;
    }
    if (key === "lhr-phr-bp") {
      if (p.snapshot.loading) return <StageLoader />;
      return <LhrPhrBpSlide data={p.snapshot.data?.lhrPhrEval ?? null} periodLabel={p.periodLabel} scopeLabel={scopeLabel} />;
    }
    if (key === "risk-map") {
      if (p.snapshot.loading) return <StageLoader />;
      return <RiskMapSlide matrix={p.matrix} risk={p.snapshot.data?.risk ?? null} periodLabel={p.periodLabel} />;
    }
    if (key === "pend-cover") {
      return (
        <CoverSlide
          kicker={`Bagian ${sectionNo("pend-cover")}`}
          title="Pendapatan"
          sub="Pencapaian pendapatan tol dan lainnya terhadap RKAP."
          facts={withScope(facts["pend-cover"])}
        />
      );
    }
    if (key === "pend-overview") {
      if (p.snapshot.loading) return <StageLoader />;
      return <PendapatanOverviewSlide data={p.snapshot.data?.pend ?? null} periodLabel={p.periodLabel} scopeLabel={scopeLabel} />;
    }
    if (key === "sent-cover") {
      return (
        <CoverSlide
          kicker={`Bagian ${sectionNo("sent-cover")}`}
          title="Analisis Sentimen Media"
          sub="Persepsi publik di media sosial & daring — komposisi, peta wilayah, isu utama, dan tindak lanjut."
          facts={withScope(facts["sent-cover"])}
        />
      );
    }
    if (key === "sent-dashboard") {
      if (p.snapshot.loading) return <StageLoader />;
      return <SentimentDashboardSlide data={p.snapshot.data?.sentiment ?? null} periodLabel={p.periodLabel} scopeLabel={scopeLabel} />;
    }
    if (key === "odol-cover") {
      return (
        <CoverSlide
          kicker={`Bagian ${sectionNo("odol-cover")}`}
          title="ODOL"
          sub="Over Dimension Over Loading — perbandingan kendaraan normal vs ODOL, komposisi & sebaran pelanggaran."
          facts={withScope(facts["odol-cover"])}
        />
      );
    }
    if (key === "odol-dashboard") {
      if (p.snapshot.loading) return <StageLoader />;
      return <OdolSlide data={p.snapshot.data?.odol ?? null} scopeLabel={scopeLabel} />;
    }
    if (isCustomCover(key)) {
      return <CoverSlide kicker="Sampul" title={p.titles[key] || "Sampul"} sub={p.subtitles[key] || ""} facts={[]} />;
    }
    const pdfMeta = parsePdfSlide(key);
    if (pdfMeta) {
      return <PdfPageSlide pdfId={pdfMeta.pdfId} page={pdfMeta.page} />;
    }
    return null;
  };

  // Label slide untuk dots (override judul builder → judul statis → label PDF).
  const dotLabel = (id: string): string =>
    p.titles[id] || SLIDES[id]?.title || pdfSlideLabel(id, p.pdfs)?.title || id;

  return (
    <div className={styles.overlay} ref={rootRef}>
      <header className={styles.header}>
        <span className={styles.mark}>
          <img src={movisionMark} alt="Movision" />
        </span>
        <span className={styles.brand}>Rapat Direktorat</span>
        <span className={styles.sep} />
        <div className={styles.periodWrap} ref={periodRef}>
          <button
            className={styles.periodBtn}
            onClick={() => setPeriodOpen((v) => !v)}
            title="Ganti periode"
          >
            <Icon name="calendar" size={14} />
            {p.periodLabel}
            <Icon name="chevron-down" size={13} />
          </button>
          {periodOpen && (
            <div className={styles.periodMenu}>
              {p.periods.map((opt) => (
                <button
                  key={opt.key}
                  className={`${styles.periodOpt} ${opt.key === p.period ? styles.periodOptActive : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    p.setPeriod(opt.key);
                    setPeriodOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={styles.spacer} />
        <span className={styles.pageLabel}>
          {cur + 1} / {total}
        </span>
        <button className={styles.iconBtn} onClick={toggleFullscreen} title="Layar penuh" aria-label="Layar penuh">
          <Icon name="maximize" size={16} />
        </button>
        <button className={styles.exitBtn} onClick={exit} title="Keluar (Esc)">
          <Icon name="x" size={15} />
          Keluar
        </button>
      </header>

      <div className={styles.progressTrack}>
        <div className={styles.progressBar} style={{ width: `${total ? ((cur + 1) / total) * 100 : 0}%` }} />
      </div>

      {isCover ? (
        <div className={`${styles.stageWrap} ${styles.stageWrapCover}`}>
          <div key={key} className={`${styles.stage} ${styles.stageCover}`}>{renderSlide()}</div>
        </div>
      ) : (
        <div key={key} className={`${styles.stageWrap} ${styles.stageData}`}>{renderSlide()}</div>
      )}

      <footer className={styles.footer}>
        <button className={styles.navBtn} onClick={p.prev} title="Sebelumnya (◄)" aria-label="Sebelumnya">
          <Icon name="chevron-left" size={18} />
        </button>
        <div className={styles.dots}>
          {p.activeSlides.map((id, i) => (
            <button
              key={id}
              className={`${styles.dot} ${i === cur ? styles.dotActive : ""}`}
              onClick={() => p.goto(i)}
              title={dotLabel(id)}
              aria-label={dotLabel(id)}
            />
          ))}
        </div>
        <button className={styles.navBtn} onClick={() => p.next(false)} title="Berikutnya (►)" aria-label="Berikutnya">
          <Icon name="chevron-right" size={18} />
        </button>
        <span className={styles.footSep} />
        <button
          className={`${styles.autoBtn} ${p.auto ? styles.autoBtnOn : ""}`}
          onClick={p.toggleAuto}
          title="Putar otomatis"
        >
          <Icon name={p.auto ? "pause" : "play"} size={15} />
          {p.auto ? `Auto · ${p.autoSec}s` : "Putar otomatis"}
        </button>
        <div className={styles.brandLogo} aria-hidden="true">
          <img src={brandLogos} alt="Danantara Indonesia · Hutama Karya" />
        </div>
      </footer>
    </div>
  );
}

function StageLoader() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "50vh" }}>
      <EmptyState icon="loader" title="Memuat snapshot…" />
    </div>
  );
}
