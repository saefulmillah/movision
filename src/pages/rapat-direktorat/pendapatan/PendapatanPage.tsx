import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, EmptyState, Select, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { getPeriod, uploadLhrScoped, downloadLhrTemplate, deleteLhr } from "@/lib/pendapatan";
import { getPresentationScopes, flattenScopes, type PresentationScope, type PresentationScopesResponse } from "@/lib/presentationScope";
import type { Period, PeriodData } from "@/types/pendapatan";
import { PendapatanKpiCards } from "./PendapatanKpiCards";
import { AchievementBarChart } from "./AchievementBarChart";
import styles from "./PendapatanPage.module.css";

const MONTH_TITLE_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Periode = awal tahun s.d bulan berjalan (tahun berjalan).
function buildPeriods(): Period[] {
  const now = new Date();
  const year = now.getFullYear();
  const cur = now.getMonth() + 1; // 1..12
  const list: Period[] = [];
  for (let m = 1; m <= cur; m++) {
    const title = MONTH_TITLE_ID[m - 1];
    list.push({ key: `${year}-${String(m).padStart(2, "0")}`, label_month: `${title} ${year}`, label_sd: `SD ${title} ${year}` });
  }
  return list;
}

function periodOptionLabel(p: Period): string {
  return p.label_sd || p.label_month || p.key;
}

export function PendapatanPage() {
  const toast = useToast();
  const { moduleLevel, hasRole } = useAuth();
  const level = moduleLevel("pendapatan");
  const canWrite = hasRole("super_admin") || level === "write" || level === "delete";

  const periods = useMemo<Period[]>(() => buildPeriods(), []);
  const [periodKey, setPeriodKey] = useState<string>(() => buildPeriods().slice(-1)[0]?.key ?? "");
  const [scopeInfo, setScopeInfo] = useState<PresentationScopesResponse | null>(null);
  const [scope, setScope] = useState<PresentationScope | null>(null);
  const [data, setData] = useState<PeriodData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pendapatan (KPI + Tol per-ruas) dari file kinerja L/R (menu Laba Rugi); menu ini
  // hanya mengunggah LHR.
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const lhrRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scope presentasi: regional/cabang hanya melihat lingkupnya; divisi bisa drill.
    void getPresentationScopes()
      .then((info) => {
        setScopeInfo(info);
        setScope(info.default || null);
      })
      .catch(() => setScopeInfo(null));
  }, []);

  // Muat data satu periode untuk lingkup aktif. Dipanggil ulang setelah upload/hapus
  // LHR agar grafik langsung segar tanpa refresh browser.
  const loadData = useCallback(async (pk: string, scopeKey?: string) => {
    if (!pk) {
      setData(null);
      return;
    }
    setLoadingData(true);
    setError(null);
    try {
      setData(await getPeriod(pk, scopeKey));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Gagal memuat data periode");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadData(periodKey, scope?.key);
  }, [periodKey, scope, loadData]);

  const periodOptions: SelectOption[] = useMemo(
    () => periods.map((p) => ({ value: p.key, label: periodOptionLabel(p) })),
    [periods]
  );

  const scopeOptions: SelectOption[] = useMemo(
    () =>
      flattenScopes(scopeInfo).map((s) => ({
        value: s.key,
        label: s.level === "cabang" ? `  • ${s.label}` : s.label
      })),
    [scopeInfo]
  );

  const subPeriodLabel =
    data?.meta.period_label_sd || periods.find((p) => p.key === periodKey)?.label_sd || "—";

  // Upload langsung setelah file dipilih (tanpa panel). Periode & ruas dari file.
  async function onLhrPicked(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadLhrScoped(scope?.key ?? "divisi", file);
      toast.success("LHR tersimpan", `${res.period_count} bulan, ${res.ruas_count} ruas (${scope?.label ?? "Divisi"}).`);
      // Pindah ke bulan terbaru yang diunggah bila masih dalam rentang dropdown.
      const target = res.latest && periods.some((p) => p.key === res.latest) ? res.latest : periodKey;
      if (target !== periodKey) setPeriodKey(target);
      await loadData(target, scope?.key); // segarkan grafik langsung
    } catch (err) {
      toast.error("Upload LHR gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setUploading(false);
      if (lhrRef.current) lhrRef.current.value = "";
    }
  }

  async function handleFlush() {
    if (!periodKey) return;
    const label = scope?.label ?? "Divisi";
    if (!window.confirm(`Hapus data LHR ${periodKey} untuk lingkup ${label}? Anda bisa upload ulang setelahnya.`)) return;
    try {
      const res = await deleteLhr(scope?.key ?? "divisi", periodKey);
      toast.success("LHR dihapus", `${res.deleted} baris dihapus (${label}).`);
      await loadData(periodKey, scope?.key);
    } catch (err) {
      toast.error("Hapus LHR gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      await downloadLhrTemplate(scope?.key ?? "divisi");
    } catch (err) {
      toast.error("Unduh template gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>Pendapatan Tol dan Lainnya</h1>
          <div className={styles.sub}>
            Periode <b>{subPeriodLabel}</b> · Nilai dalam <b>Rp miliar</b>
          </div>
        </div>
        <div className={styles.headSpacer} />
        {scopeOptions.length > 1 && (
          <Select
            value={scope?.key ?? ""}
            onValueChange={(k) => setScope(flattenScopes(scopeInfo).find((s) => s.key === k) ?? null)}
            options={scopeOptions}
            placeholder="Lingkup"
            icon="layers"
            ariaLabel="Lingkup presentasi"
          />
        )}
        <Select
          value={periodKey}
          onValueChange={setPeriodKey}
          options={periodOptions}
          placeholder="Pilih periode"
          icon="calendar"
          ariaLabel="Pilih periode"
        />
        {canWrite && (
          <Button
            variant="secondary"
            icon={downloading ? "loader" : "download"}
            disabled={downloading}
            title="Unduh template LHR"
            onClick={() => void handleDownloadTemplate()}
          >
            Template
          </Button>
        )}
        {canWrite && (
          <>
            <input
              ref={lhrRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => void onLhrPicked(e.target.files?.[0])}
            />
            <Button
              variant="primary"
              icon={uploading ? "loader" : "upload"}
              disabled={uploading}
              title={`Upload LHR untuk lingkup ${scope?.label ?? "Divisi"} (periode otomatis dari file)`}
              onClick={() => lhrRef.current?.click()}
            >
              {uploading ? "Mengunggah…" : "Upload LHR"}
            </Button>
            <Button
              variant="ghost"
              icon="trash-2"
              disabled={!periodKey}
              title="Hapus (flush) data LHR lingkup & periode ini"
              onClick={() => void handleFlush()}
            >
              Hapus LHR
            </Button>
          </>
        )}
      </div>

      {/* Konten */}
      {loadingData ? (
        <div className={styles.stateBox}>
          <EmptyState icon="loader" title="Memuat data…" />
        </div>
      ) : error ? (
        <div className={styles.stateBox}>
          <EmptyState icon="triangle-alert" title="Gagal memuat" description={error}>
            <Button icon="refresh-cw" onClick={() => void loadData(periodKey, scope?.key)}>
              Coba lagi
            </Button>
          </EmptyState>
        </div>
      ) : !periods.length ? (
        <div className={styles.stateBox}>
          <EmptyState
            icon="inbox"
            title="Belum ada periode"
            description={
              canWrite
                ? "Upload file LHR (menu ini) dan file kinerja di menu Laba Rugi untuk mulai menampilkan data."
                : "Belum ada periode Pendapatan untuk ditampilkan."
            }
          />
        </div>
      ) : data ? (
        <>
          {/* KPI — 6 kartu compact (desain sama dengan slide) */}
          <PendapatanKpiCards
            kpiMonth={data.kpi_month}
            kpiSd={data.kpi_sd}
            monthLabel={data.meta.period_label_month}
            sdLabel={data.meta.period_label_sd || subPeriodLabel}
          />

          {/* Grafik LHR */}
          <ChartCard
            title="Pencapaian LHR terhadap RKAP"
            note="LHR = Lalu lintas Harian Rata-rata. % = Realisasi ÷ RKAP. Sumber: upload LHR."
            data={data.lhr}
            ariaLabel="Grafik pencapaian LHR terhadap RKAP"
          />

          {/* Grafik Pendapatan */}
          <ChartCard
            title="Pencapaian Pendapatan terhadap RKAP"
            note={`Pendapatan tol per ruas, ${subPeriodLabel} (Rp juta). % = Realisasi ÷ RKAP.`}
            data={data.pendapatan_ruas}
            ariaLabel="Grafik pencapaian pendapatan terhadap RKAP"
          />
        </>
      ) : null}
    </div>
  );
}

/* ---------- sub-komponen ---------- */

function ChartCard({
  title,
  note,
  data,
  ariaLabel
}: {
  title: string;
  note: string;
  data: PeriodData["lhr"];
  ariaLabel: string;
}) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHead}>
        <h2 className={styles.chartTitle}>{title}</h2>
        <span className={styles.chartSpacer} />
        <span className={styles.legend}>
          <span className={styles.legItem}>
            <span className={`${styles.sw} ${styles.swRkap}`} />
            RKAP
          </span>
          <span className={styles.legItem}>
            <span className={`${styles.sw} ${styles.swReal}`} />
            Realisasi
          </span>
          <span className={styles.legItem}>
            <span className={styles.dots}>
              <span className={styles.d} style={{ background: "var(--sem-green)" }} />
              <span className={styles.d} style={{ background: "var(--sem-amber)" }} />
              <span className={styles.d} style={{ background: "var(--sem-red)" }} />
            </span>
            % Pencapaian
          </span>
        </span>
      </div>
      <div className={styles.chartArea}>
        <AchievementBarChart data={data} ariaLabel={ariaLabel} variant="fit" />
      </div>
      <div className={styles.note}>{note}</div>
    </div>
  );
}

