import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { Button, Icon, Select, Switch, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { GOLONGAN_LABEL, commitTariffImport, downloadTariffTemplate, getImportSession, listTariffBranches, previewTariffImport } from "@/lib/tariff";
import type { TariffBranch, TariffImportAction, TariffPreviewItem, TariffPreviewResult } from "@/types/tariff";
import mstyles from "@/pages/modules.module.css";
import styles from "./tarif.module.css";

const PREVIEW_COLS = "0.6fr 1.4fr 1.4fr 0.6fr 1fr 1fr 0.8fr";

function rupiah(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toLocaleString("id-ID");
}
function actClass(a: TariffImportAction): string {
  return a === "INSERT" ? styles.actINSERT : a === "UPDATE" ? styles.actUPDATE : a === "SKIP" ? styles.actSKIP : styles.actERROR;
}

/** Wizard upload tarif — dipakai di dalam Modal dari halaman Matriks Tarif. */
export function UploadTarifWizard({ onCommitted }: { onCommitted?: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);

  const [isOpen, setIsOpen] = useState("1");
  const [tariffMode, setTariffMode] = useState("");
  const [genReverse, setGenReverse] = useState(true);
  const [allowSameOD, setAllowSameOD] = useState(true);

  const [branches, setBranches] = useState<TariffBranch[]>([]);
  const [tplBranch, setTplBranch] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    listTariffBranches().then((b) => {
      setBranches(b);
      if (b.length > 0) setTplBranch(String(b[0].id));
    }).catch(() => setBranches([]));
  }, []);

  async function downloadTemplate() {
    if (!tplBranch) return;
    setDownloading(true);
    try {
      await downloadTariffTemplate(Number(tplBranch), Number(isOpen));
      toast.success("Template diunduh", "Template berisi data tarif existing ruas tersebut.");
    } catch (e) {
      toast.error("Gagal mengunduh template", e instanceof Error ? e.message : undefined);
    } finally {
      setDownloading(false);
    }
  }

  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<TariffPreviewResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [commitStatus, setCommitStatus] = useState<string>("");

  function pickFile(f: File | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Format tidak didukung", "Hanya file .xlsx yang diterima.");
      return;
    }
    setFile(f);
    setResult(null);
    setCommitted(false);
    setCommitStatus("");
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function doPreview() {
    if (!file) return;
    setPreviewing(true);
    setResult(null);
    try {
      const res = await previewTariffImport(file, {
        is_open: Number(isOpen),
        tariff_mode: tariffMode ? (tariffMode as "open_branch" | "closed_branch") : undefined,
        generate_reverse_od: genReverse,
        allow_same_origin_destination: allowSameOD,
        preview_limit: 200
      });
      setResult(res);
      if (res.success) toast.success("File tervalidasi", "Tidak ada error. Siap disimpan.");
      else toast.error("Ada error pada file", `${res.summary.error_count} baris bermasalah.`);
    } catch (e) {
      toast.error("Gagal memvalidasi", e instanceof Error ? e.message : undefined);
    } finally {
      setPreviewing(false);
    }
  }

  async function pollStatus(sessionId: string, tries = 0) {
    try {
      const s = await getImportSession(sessionId);
      const status = String((s as { status?: string }).status || "").toUpperCase();
      setCommitStatus(status || "MEMPROSES");
      if (status === "COMMITTED") {
        setCommitted(true);
        setCommitting(false);
        toast.success("Tarif tersimpan", "Import berhasil di-commit.");
        onCommitted?.();
        return;
      }
      if (status === "FAILED") {
        setCommitting(false);
        toast.error("Import gagal", "Commit tarif gagal diproses.");
        return;
      }
    } catch {
      /* abaikan error polling sementara */
    }
    if (tries < 20) {
      setTimeout(() => void pollStatus(sessionId, tries + 1), 1500);
    } else {
      setCommitting(false);
    }
  }

  async function doCommit() {
    if (!result) return;
    setCommitting(true);
    setCommitStatus("MEMPROSES");
    try {
      await commitTariffImport(result.import_session_id);
      void pollStatus(result.import_session_id);
    } catch (e) {
      setCommitting(false);
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setCommitted(false);
    setCommitStatus("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const s = result?.summary;
  const gridStyle = { gridTemplateColumns: PREVIEW_COLS } as CSSProperties;

  const branchTplOptions: SelectOption[] = branches.map((b) => ({ value: String(b.id), label: b.branch_name || b.branch_code || `#${b.id}` }));

  return (
    <div className={styles.wizard}>
      {/* Template per ruas */}
      <div className={styles.panel}>
        <div className={styles.panelTitle}>Template per ruas</div>
        <div className={styles.panelSub}>Unduh template .xlsx yang sudah terisi tarif existing ruas terpilih — untuk diperbarui lalu diunggah kembali.</div>
        <div className={styles.optRow} style={{ marginTop: 0, alignItems: "flex-end" }}>
          <div className={styles.opt} style={{ minWidth: 220 }}>
            <span className={styles.optLabel}>Ruas</span>
            <Select value={tplBranch} onValueChange={setTplBranch} options={branchTplOptions} placeholder="Pilih ruas" ariaLabel="Ruas template" />
          </div>
          <div className={styles.opt} style={{ minWidth: 150 }}>
            <span className={styles.optLabel}>Tipe sistem</span>
            <Select value={isOpen} onValueChange={setIsOpen} options={[{ value: "1", label: "Terbuka" }, { value: "0", label: "Tertutup" }]} ariaLabel="Tipe template" />
          </div>
          <Button variant="secondary" icon="download" onClick={downloadTemplate} disabled={!tplBranch || downloading}>{downloading ? "Mengunduh…" : "Unduh Template"}</Button>
        </div>
      </div>

      {/* Step 1: file + opsi */}
      <div className={styles.panel}>
        <div className={styles.panelTitle}>1. Pilih file & opsi</div>
        <div className={styles.panelSub}>Format .xlsx, maksimal 10 MB. Sheet "Tarif" atau "Sheet1".</div>

        <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        <div
          className={styles.dropzone}
          data-drag={drag || undefined}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <div className={styles.dropIcon}><Icon name="upload-cloud" size={30} /></div>
          <div className={styles.dropText}>Klik untuk memilih, atau seret file ke sini</div>
          <div className={styles.dropHint}>.xlsx · maks 10 MB</div>
          {file && <div className={styles.fileChip}><Icon name="file-spreadsheet" size={15} /> {file.name} <button type="button" onClick={(e) => { e.stopPropagation(); reset(); }} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex" }}><Icon name="x" size={14} /></button></div>}
        </div>

        <div className={styles.optRow}>
          <div className={styles.opt}>
            <span className={styles.optLabel}>Tipe sistem</span>
            <Select value={isOpen} onValueChange={setIsOpen} options={[{ value: "1", label: "Terbuka" }, { value: "0", label: "Tertutup" }]} ariaLabel="Tipe sistem" />
          </div>
          <div className={styles.opt}>
            <span className={styles.optLabel}>Mode deteksi</span>
            <Select value={tariffMode || "auto"} onValueChange={(v) => setTariffMode(v === "auto" ? "" : v)} options={[{ value: "auto", label: "Otomatis" }, { value: "open_branch", label: "Open branch" }, { value: "closed_branch", label: "Closed branch" }]} ariaLabel="Mode" />
          </div>
          <div className={styles.opt}>
            <span className={styles.optLabel}>Opsi</span>
            <label className={styles.check}><Switch checked={genReverse} onCheckedChange={setGenReverse} ariaLabel="Generate reverse OD" /> Buat OD balik otomatis</label>
            <label className={styles.check}><Switch checked={allowSameOD} onCheckedChange={setAllowSameOD} ariaLabel="Allow same origin destination" /> Izinkan asal = tujuan</label>
          </div>
        </div>

        <div className={styles.wizardFoot} style={{ marginTop: 16 }}>
          <Button variant="primary" icon="scan-line" onClick={doPreview} disabled={!file || previewing}>{previewing ? "Memvalidasi…" : "Validasi File"}</Button>
        </div>
      </div>

      {/* Step 2: hasil validasi */}
      {result && s && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>2. Hasil validasi</div>
          <div className={styles.panelSub}>Mode terdeteksi: <b>{s.tariff_mode}</b> · {result.import_session_id}</div>

          <div className={`${styles.banner} ${result.success ? styles.bannerOk : styles.bannerErr}`}>
            <Icon name={result.success ? "circle-check" : "circle-alert"} size={16} />
            {result.message}
          </div>

          <div className={styles.summary}>
            {[
              { label: "Total Baris", value: s.total_rows, color: "var(--text)" },
              { label: "Valid", value: s.valid_count, color: "var(--sem-green, #22c55e)" },
              { label: "Insert", value: s.insert_count, color: "var(--sem-green, #22c55e)" },
              { label: "Update", value: s.update_count, color: "var(--sem-amber, #f59e0b)" },
              { label: "Skip", value: s.skip_count, color: "var(--text-muted)" },
              { label: "Error", value: s.error_count, color: "var(--sem-red, #ef4444)" }
            ].map((c) => (
              <div key={c.label} className={styles.sumCard}>
                <div className={styles.sumLabel}>{c.label}</div>
                <div className={styles.sumValue} style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          <PreviewTable items={result.errors.length > 0 ? result.errors : result.preview} gridStyle={gridStyle} />

          <div className={styles.wizardFoot} style={{ marginTop: 16 }}>
            <Button variant="ghost" onClick={reset}>Mulai Ulang</Button>
            <Button variant="primary" icon="save" onClick={doCommit} disabled={!result.success || committing || committed}>
              {committed ? "Tersimpan" : committing ? `Menyimpan… ${commitStatus}` : "Simpan ke Database"}
            </Button>
          </div>
          {committed && <div className={`${styles.banner} ${styles.bannerOk}`} style={{ marginTop: 12, marginBottom: 0 }}><Icon name="circle-check" size={16} /> Import tarif berhasil disimpan.</div>}
        </div>
      )}
    </div>
  );
}

function PreviewTable({ items, gridStyle }: { items: TariffPreviewItem[]; gridStyle: CSSProperties }) {
  return (
    <div className={mstyles.tableCard} style={{ maxHeight: 360 }}>
      <div className={mstyles.tableScroll}>
        <div className={mstyles.table} style={{ minWidth: 760 }}>
          <div className={mstyles.thead} style={gridStyle}>
            <span>Baris</span>
            <span>Asal</span>
            <span>Tujuan</span>
            <span>Gol</span>
            <span style={{ textAlign: "right" }}>Lama</span>
            <span style={{ textAlign: "right" }}>Baru</span>
            <span>Aksi</span>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Tidak ada baris untuk ditampilkan.</div>
          ) : (
            items.slice(0, 200).map((it, i) => (
              <div key={`${it.key ?? i}-${i}`} className={mstyles.trow} style={gridStyle}>
                <span className={mstyles.muted}>{it.row ?? "—"}</span>
                <span style={{ minWidth: 0 }} className={mstyles.cellText}>{it.origin_gate_name || "—"}</span>
                <span style={{ minWidth: 0 }} className={mstyles.cellText}>{it.destination_gate_name || "—"}</span>
                <span className={mstyles.muted}>{it.gol_id ? (GOLONGAN_LABEL[it.gol_id]?.replace("Golongan ", "") ?? it.gol_id) : "—"}</span>
                <span style={{ textAlign: "right" }} className={mstyles.muted}>{rupiah(it.old_tariff_amount)}</span>
                <span style={{ textAlign: "right", fontWeight: 600 }}>{rupiah(it.new_tariff_amount)}</span>
                <span>
                  <span className={`${styles.act} ${actClass(it.action)}`}>{it.action}</span>
                  {it.message && <span className={mstyles.cellSub} style={{ display: "block", color: "var(--sem-red, #ef4444)" }}>{it.message}</span>}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
