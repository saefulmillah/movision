import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, EmptyState, Icon, Select, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { getPeriod, getPeriods, importPeriod } from "@/lib/pendapatan";
import type { Period, PeriodData } from "@/types/pendapatan";
import { PendapatanKpiCards } from "./PendapatanKpiCards";
import { AchievementBarChart } from "./AchievementBarChart";
import styles from "./PendapatanPage.module.css";

const MONTH_OPTIONS: SelectOption[] = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
].map((m) => ({ value: m, label: m.charAt(0) + m.slice(1).toLowerCase() }));

function periodOptionLabel(p: Period): string {
  return p.label_sd || p.label_month || p.key;
}

export function PendapatanPage() {
  const toast = useToast();
  const { moduleLevel, hasRole } = useAuth();
  const level = moduleLevel("pendapatan");
  const canWrite = hasRole("super_admin") || level === "write" || level === "delete";

  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodKey, setPeriodKey] = useState("");
  const [data, setData] = useState<PeriodData | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Panel impor (khusus WRITE)
  const [importOpen, setImportOpen] = useState(false);
  const [progFile, setProgFile] = useState<File | null>(null);
  const [evalFile, setEvalFile] = useState<File | null>(null);
  const [month, setMonth] = useState("AGUSTUS");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [uploading, setUploading] = useState(false);
  const progRef = useRef<HTMLInputElement>(null);
  const evalRef = useRef<HTMLInputElement>(null);

  const loadPeriods = useCallback(async () => {
    setLoadingPeriods(true);
    try {
      const list = await getPeriods();
      setPeriods(list);
      setPeriodKey((prev) => (prev && list.some((p) => p.key === prev) ? prev : list[0]?.key ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar periode");
    } finally {
      setLoadingPeriods(false);
    }
  }, []);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    if (!periodKey) {
      setData(null);
      return;
    }
    let alive = true;
    setLoadingData(true);
    setError(null);
    getPeriod(periodKey)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((err) => {
        if (alive) {
          setData(null);
          setError(err instanceof Error ? err.message : "Gagal memuat data periode");
        }
      })
      .finally(() => {
        if (alive) setLoadingData(false);
      });
    return () => {
      alive = false;
    };
  }, [periodKey]);

  const periodOptions: SelectOption[] = useMemo(
    () => periods.map((p) => ({ value: p.key, label: periodOptionLabel(p) })),
    [periods]
  );

  const subPeriodLabel =
    data?.meta.period_label_sd || periods.find((p) => p.key === periodKey)?.label_sd || "—";

  async function handleImport() {
    if (!progFile || !evalFile) {
      toast.error("File belum lengkap", "Pilih file PROG II dan Evaluasi (.xlsx).");
      return;
    }
    if (!/^\d{4}$/.test(year.trim())) {
      toast.error("Tahun tidak valid", "Isi tahun 4 digit (mis. 2026).");
      return;
    }
    setUploading(true);
    try {
      const res = await importPeriod(progFile, evalFile, month, year.trim());
      toast.success("Impor berhasil", `Periode ${res.period_key} tersimpan.`);
      setImportOpen(false);
      setProgFile(null);
      setEvalFile(null);
      if (progRef.current) progRef.current.value = "";
      if (evalRef.current) evalRef.current.value = "";
      await loadPeriods();
      setPeriodKey(res.period_key);
    } catch (err) {
      toast.error("Impor gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setUploading(false);
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
            variant="primary"
            icon={importOpen ? "x" : "upload"}
            onClick={() => setImportOpen((v) => !v)}
          >
            {importOpen ? "Tutup" : "Impor Periode"}
          </Button>
        )}
      </div>

      {/* Panel impor */}
      {canWrite && importOpen && (
        <div className={styles.importCard}>
          <div className={styles.importGrid}>
            <FilePick
              label="PROG II"
              hint="Workbook GAB PER JENIS"
              file={progFile}
              inputRef={progRef}
              onPick={setProgFile}
            />
            <FilePick
              label="Evaluasi"
              hint="Workbook LHR & Pendapatan"
              file={evalFile}
              inputRef={evalRef}
              onPick={setEvalFile}
            />
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Bulan</span>
              <Select value={month} onValueChange={setMonth} options={MONTH_OPTIONS} ariaLabel="Bulan" />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Tahun</span>
              <input
                className={styles.yearInput}
                value={year}
                inputMode="numeric"
                maxLength={4}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                placeholder="2026"
              />
            </label>
            <Button
              variant="primary"
              icon={uploading ? "loader" : "upload"}
              disabled={uploading}
              onClick={() => void handleImport()}
            >
              {uploading ? "Mengunggah…" : "Impor & Segarkan"}
            </Button>
          </div>
        </div>
      )}

      {/* Konten */}
      {loadingPeriods || loadingData ? (
        <div className={styles.stateBox}>
          <EmptyState icon="loader" title="Memuat data…" />
        </div>
      ) : error ? (
        <div className={styles.stateBox}>
          <EmptyState icon="triangle-alert" title="Gagal memuat" description={error}>
            <Button icon="refresh-cw" onClick={() => void loadPeriods()}>
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
                ? "Impor periode (PROG II + Evaluasi) untuk mulai menampilkan data."
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
            note="LHR = Lalu lintas Harian Rata-rata. % = Realisasi ÷ RKAP. Sumber: Evaluasi LHR & Pendapatan."
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

function FilePick({
  label,
  hint,
  file,
  inputRef,
  onPick
}: {
  label: string;
  hint: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onPick: (f: File | null) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <button type="button" className={styles.dropzone} onClick={() => inputRef.current?.click()}>
        <Icon name={file ? "file-spreadsheet" : "upload"} size={16} />
        <span className={styles.dropText}>{file ? file.name : hint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
