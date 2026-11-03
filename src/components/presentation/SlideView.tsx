import { useMemo } from "react";
import { EmptyState } from "@/components/ui";
import { usePresentation } from "@/context/PresentationContext";
import { SLIDES } from "./slideRegistry";
import { CoverSlide } from "./slides/CoverSlide";
import type { Fact } from "./slides/CoverSlide";
import { LrTableSlide } from "./slides/LrTableSlide";
import { RiskMapSlide } from "./slides/RiskMapSlide";
import { PendapatanOverviewSlide } from "./slides/PendapatanOverviewSlide";
import { RencanaPendapatanSlide } from "./slides/RencanaPendapatanSlide";
import { KinerjaRegionalSlide } from "./slides/KinerjaRegionalSlide";
import { LhrPhrBpSlide } from "./slides/LhrPhrBpSlide";
import { SentimentDashboardSlide } from "./slides/SentimentDashboardSlide";
import { OdolSlide } from "./slides/OdolSlide";
import { AccidentSlide } from "./slides/AccidentSlide";
import { PdfPageSlide } from "./slides/PdfPageSlide";
import { EcoArsitekturSlide } from "./slides/EcoArsitekturSlide";
import { ControlCenterSlide } from "./slides/ControlCenterSlide";
import { parsePdfSlide } from "./pdfSlides";
import { isCustomCover } from "./customCover";
import type { LrView } from "@/lib/labaRugiView";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/** ISO "2026-09-29" → "29 September 2026"; kosong/invalid → "". */
export function formatDateId(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return "";
  return `${d} ${MONTHS_ID[mo - 1]} ${y}`;
}

/** Sampul bagian yang nomornya dihitung dinamis (mengikuti urutan sampul aktif). */
const SECTION_COVERS = ["lr-cover", "risk-cover", "pend-cover", "rpend-cover", "sent-cover", "odol-cover", "accident-cover"];

function StageLoader() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "50vh" }}>
      <EmptyState icon="loader" title="Memuat snapshot…" />
    </div>
  );
}

interface SlideViewProps {
  /** Id slide yang dirender (registry, sampul kustom, atau slide PDF). */
  slideId: string;
  /** URL gambar sampul scope aktif (null → foto bawaan). */
  coverBg: string | null;
}

/**
 * Render satu slide presentasi berdasarkan id — sumber kebenaran tunggal yang
 * dipakai baik oleh runtime overlay (layar penuh) maupun preview thumbnail di
 * builder. Semua data diambil dari PresentationContext (snapshot periode×scope).
 */
export function SlideView({ slideId: key, coverBg }: SlideViewProps) {
  const p = usePresentation();
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
        { k: "Ruas", v: pendRuas ? `${pendRuas} ruas` : "—" }
      ],
      "rpend-cover": [{ k: "Periode", v: p.periodLabel }],
      "sent-cover": [{ k: "Periode", v: p.periodLabel }],
      "odol-cover": [{ k: "Periode", v: `Tahun ${new Date().getFullYear()}` }],
      "accident-cover": [{ k: "Periode", v: p.periodLabel }]
    };
  }, [p.periodLabel, p.snapshot.data, meetingDateLabel]);

  const sectionNo = (coverKey: string) => {
    const active = p.activeSlides.filter((id) => SECTION_COVERS.includes(id));
    const idx = active.indexOf(coverKey);
    return idx >= 0 ? idx + 1 : 1;
  };

  // Label scope aktif (regional/cabang); divisi → null.
  const scopeLabel = p.scope && p.scope.level !== "divisi" ? p.scope.label : null;
  const withScope = (arr: Fact[]): Fact[] => (scopeLabel ? [{ k: "Cakupan", v: scopeLabel }, ...arr] : arr);

  if (key === "title") {
    return (
      <CoverSlide
        kicker="Movision"
        title={p.meetingTitle || "Rapat Direktorat"}
        sub={p.meetingSubtitle}
        facts={facts.title}
        bgUrl={coverBg}
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
        bgUrl={coverBg}
      />
    );
  }
  if (key === "eco-arsitektur") {
    return <EcoArsitekturSlide />;
  }
  if (key === "control-center") {
    return <ControlCenterSlide />;
  }
  if (key === "lr-cover") {
    return (
      <CoverSlide
        kicker={`Bagian ${sectionNo("lr-cover")}`}
        title="Laba Rugi"
        sub="Realisasi terhadap RKAP — konsolidasi, per regional, dan per ruas."
        facts={withScope(facts["lr-cover"])}
        bgUrl={coverBg}
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
        bgUrl={coverBg}
      />
    );
  }
  if (key === "lr-konsol" || key === "lr-regional" || key === "lr-ruas") {
    if (p.snapshot.loading) return <StageLoader />;
    const view = key.split("-")[1] as LrView;
    return <LrTableSlide view={view} data={p.snapshot.data?.lr ?? null} periodLabel={p.periodLabel} scopeLabel={scopeLabel} fontScale={p.fontScale} />;
  }
  if (key === "kinerja-regional") {
    if (p.snapshot.loading) return <StageLoader />;
    return <KinerjaRegionalSlide data={p.snapshot.data?.kinerja ?? null} periodLabel={p.periodLabel} scopeLabel={scopeLabel} fontScale={p.fontScale} />;
  }
  if (key === "lhr-phr-bp") {
    if (p.snapshot.loading) return <StageLoader />;
    return <LhrPhrBpSlide data={p.snapshot.data?.lhrPhrEval ?? null} periodLabel={p.periodLabel} scopeLabel={scopeLabel} />;
  }
  if (key === "risk-map") {
    if (p.snapshot.loading) return <StageLoader />;
    return (
      <RiskMapSlide
        matrix={p.matrix}
        risk={p.snapshot.data?.risk ?? null}
        periodLabel={p.periodLabel}
        periodKey={p.period}
        scope={p.scope}
        scopeInfo={p.scopeInfo}
      />
    );
  }
  if (key === "pend-cover") {
    return (
      <CoverSlide
        kicker={`Bagian ${sectionNo("pend-cover")}`}
        title="Pendapatan"
        sub="Pencapaian pendapatan tol dan lainnya terhadap RKAP."
        facts={withScope(facts["pend-cover"])}
        bgUrl={coverBg}
      />
    );
  }
  if (key === "pend-overview") {
    if (p.snapshot.loading) return <StageLoader />;
    return <PendapatanOverviewSlide data={p.snapshot.data?.pend ?? null} periodLabel={p.periodLabel} scopeLabel={scopeLabel} fontScale={p.fontScale} />;
  }
  if (key === "rpend-cover") {
    return (
      <CoverSlide
        kicker={`Bagian ${sectionNo("rpend-cover")}`}
        title="Rencana Pendapatan"
        sub="Rencana pendapatan tol & lainnya (RKAP vs RKK) dan kinerja laba rugi per ruas."
        facts={withScope(facts["rpend-cover"])}
        bgUrl={coverBg}
      />
    );
  }
  if (key === "rpend-tol") {
    if (p.snapshot.loading) return <StageLoader />;
    return (
      <RencanaPendapatanSlide
        kinerja={p.snapshot.data?.kinerja ?? null}
        periodLabel={p.periodLabel}
        scopeLabel={scopeLabel}
        fontScale={p.fontScale}
      />
    );
  }
  if (key === "sent-cover") {
    return (
      <CoverSlide
        kicker={`Bagian ${sectionNo("sent-cover")}`}
        title="Analisis Sentimen Media"
        sub="Persepsi publik di media sosial & daring — komposisi, peta wilayah, isu utama, dan tindak lanjut."
        facts={withScope(facts["sent-cover"])}
        bgUrl={coverBg}
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
        bgUrl={coverBg}
      />
    );
  }
  if (key === "odol-dashboard") {
    if (p.snapshot.loading) return <StageLoader />;
    return <OdolSlide data={p.snapshot.data?.odol ?? null} scopeLabel={scopeLabel} fontScale={p.fontScale} />;
  }
  if (key === "accident-cover") {
    return (
      <CoverSlide
        kicker={`Bagian ${sectionNo("accident-cover")}`}
        title="Kecelakaan"
        sub="Kejadian kecelakaan, korban, penyebab, serta tingkat kecelakaan & fatality per ruas (perbandingan tiga tahun)."
        facts={withScope(facts["accident-cover"])}
        bgUrl={coverBg}
      />
    );
  }
  if (key === "accident-dashboard") {
    if (p.snapshot.loading) return <StageLoader />;
    return <AccidentSlide data={p.snapshot.data?.accident ?? null} periodLabel={p.periodLabel} scopeLabel={scopeLabel} fontScale={p.fontScale} />;
  }
  if (isCustomCover(key)) {
    return <CoverSlide kicker="Sampul" title={p.titles[key] || "Sampul"} sub={p.subtitles[key] || ""} facts={[]} bgUrl={coverBg} />;
  }
  const pdfMeta = parsePdfSlide(key);
  if (pdfMeta) {
    return <PdfPageSlide pdfId={pdfMeta.pdfId} page={pdfMeta.page} />;
  }
  return null;
}

/** Apakah slide `id` bertipe sampul (full-bleed) — untuk memilih kelas stage. */
export function isCoverSlide(id: string): boolean {
  const badge = SLIDES[id]?.badge;
  return badge === "Sampul" || badge === "Imersif" || isCustomCover(id);
}
