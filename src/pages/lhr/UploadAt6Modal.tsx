import { useEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { Button, Icon, Modal, Select, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { commitAt6, previewAt6, GOL_SHORT } from "@/lib/lhr";
import type { LhrKoridor, LhrOdAction, LhrOdPreviewItem, LhrOdPreviewResult } from "@/types/lhr";
import mstyles from "@/pages/modules.module.css";
import styles from "@/pages/tarif/tarif.module.css";

const PREVIEW_COLS = "1.3fr 1.3fr 1.3fr 0.8fr 0.6fr 0.8fr";
type Step = "upload" | "review" | "done";

function actClass(a: LhrOdAction): string {
  return a === "INSERT" ? styles.actINSERT : a === "UPDATE" ? styles.actUPDATE : a === "SKIP" ? styles.actSKIP : styles.actERROR;
}
function fmtTanggal(s: string | null): string {
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${Number(m[3])} ${MON[Number(m[2]) - 1]}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  koridorList: LhrKoridor[];
  defaultKode: string;
  onCommitted?: () => void;
}

export function UploadAt6Modal({ open, onClose, koridorList, defaultKode, onCommitted }: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [kode, setKode] = useState(defaultKode);
  const [integrator, setIntegrator] = useState("");

  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<LhrOdPreviewResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<number | null>(null);

  // Reset wizard tiap kali dibuka; prefill koridor dari halaman.
  useEffect(() => {
    if (!open) return;
    setStep("upload"); setFiles([]); setResult(null); setPreviewing(false); setCommitting(false); setCommitted(null);
    setKode(defaultKode);
    if (fileRef.current) fileRef.current.value = "";
  }, [open, defaultKode]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).filter((f) => /\.xls$/i.test(f.name));
    const rejected = Array.from(list).length - picked.length;
    if (rejected > 0) toast.error("Sebagian file dilewati", "Hanya file .xls (AT6) yang diterima.");
    if (picked.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const next = [...prev];
      for (const f of picked) if (!seen.has(`${f.name}:${f.size}`)) next.push(f);
      return next;
    });
    setResult(null);
  }
  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setResult(null);
  }
  function onDrop(e: DragEvent) { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }

  async function doPreview() {
    if (!kode) { toast.error("Pilih koridor dulu"); return; }
    if (files.length === 0) return;
    setPreviewing(true); setResult(null);
    try {
      const res = await previewAt6({ kode_koridor: kode, integrator: integrator || undefined, files });
      setResult(res);
      setStep("review");
      if (res.summary.error > 0) toast.error("Ada baris bermasalah", `${res.summary.error} baris error pada file.`);
    } catch (e) {
      toast.error("Gagal memvalidasi", e instanceof Error ? e.message : undefined);
    } finally { setPreviewing(false); }
  }

  async function doCommit() {
    if (!result) return;
    setCommitting(true);
    try {
      const res = await commitAt6(result.import_session_id);
      setCommitted(res.committed_rows ?? null);
      setStep("done");
      toast.success("AT6 tersimpan", `${res.committed_rows ?? 0} baris di-commit.`);
      onCommitted?.();
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally { setCommitting(false); }
  }

  function startOver() {
    setStep("upload"); setFiles([]); setResult(null); setCommitted(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const koridorOptions: SelectOption[] = koridorList.map((k) => ({ value: k.kode_koridor, label: k.nama || k.kode_koridor }));
  const s = result?.summary;
  const hasError = (s?.error ?? 0) > 0;
  const gridStyle = { gridTemplateColumns: PREVIEW_COLS } as CSSProperties;

  const footer =
    step === "upload" ? (
      <>
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button variant="primary" icon="scan-line" onClick={doPreview} disabled={!kode || files.length === 0 || previewing}>{previewing ? "Memvalidasi…" : "Validasi File"}</Button>
      </>
    ) : step === "review" ? (
      <>
        <Button variant="ghost" icon="arrow-left" onClick={() => setStep("upload")}>Kembali</Button>
        <Button variant="primary" icon="save" onClick={doCommit} disabled={hasError || committing}>{committing ? "Menyimpan…" : "Commit ke Database"}</Button>
      </>
    ) : (
      <>
        <Button variant="ghost" icon="upload" onClick={startOver}>Unggah lagi</Button>
        <Button variant="primary" onClick={onClose}>Tutup</Button>
      </>
    );

  function stepState(target: Step): string {
    const order: Step[] = ["upload", "review", "done"];
    const ai = order.indexOf(step);
    const ti = order.indexOf(target);
    return ti === ai ? "active" : ti < ai ? "done" : "idle";
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Upload AT6 — LHR Tertimbang" width={940} footer={footer}>
      <div className={styles.wizard}>
        <div className={styles.stepper}>
          <span className={styles.step} data-state={stepState("upload")}><span className={styles.stepNum}>1</span>Unggah</span>
          <span className={styles.stepLine} />
          <span className={styles.step} data-state={stepState("review")}><span className={styles.stepNum}>2</span>Validasi</span>
          <span className={styles.stepLine} />
          <span className={styles.step} data-state={stepState("done")}><span className={styles.stepNum}>3</span>Commit</span>
        </div>

        {step === "upload" && (
          <>
            <div className={styles.panel}>
              <div className={styles.panelTitle}>Tujuan import</div>
              <div className={styles.panelSub}>Laporan AT6 digunakan sebagai data manual (cadangan) saat data otomatis eoj belum masuk.</div>
              <div className={styles.optRow} style={{ marginTop: 0 }}>
                <div className={styles.opt} style={{ minWidth: 240 }}>
                  <span className={styles.optLabel}>Koridor</span>
                  <Select value={kode} onValueChange={setKode} options={koridorOptions} placeholder="Pilih koridor" ariaLabel="Koridor tujuan" />
                </div>
                <div className={styles.opt} style={{ minWidth: 180 }}>
                  <span className={styles.optLabel}>Integrator</span>
                  <Select
                    value={integrator || "intracs"}
                    onValueChange={(v) => setIntegrator(v === "intracs" ? "" : v)}
                    options={[{ value: "intracs", label: "Intracs (default)" }, { value: "jmto", label: "JMTO" }, { value: "lainnya", label: "Lainnya" }]}
                    ariaLabel="Integrator"
                  />
                </div>
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelTitle}>Unggah file AT6</div>
              <div className={styles.panelSub}>Format .xls, bisa banyak file sekaligus (satu per gerbang/tanggal).</div>
              <input ref={fileRef} type="file" accept=".xls" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              <div className={styles.dropzone} data-drag={drag || undefined} onClick={() => fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
                <div className={styles.dropIcon}><Icon name="upload-cloud" size={30} /></div>
                <div className={styles.dropText}>Klik untuk memilih, atau seret file ke sini</div>
                <div className={styles.dropHint}>.xls · bisa pilih banyak file</div>
              </div>
              {files.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className={styles.fileChip}>
                      <Icon name="file-spreadsheet" size={15} /> {f.name}
                      <button type="button" onClick={() => removeFile(i)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex" }}><Icon name="x" size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {step === "review" && result && s && (
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Hasil validasi</div>
            <div className={styles.panelSub}>Sesi {result.import_session_id} · status {result.status}</div>
            <div className={`${styles.banner} ${hasError ? styles.bannerErr : styles.bannerOk}`}>
              <Icon name={hasError ? "circle-alert" : "circle-check"} size={16} />
              {hasError ? `${s.error} baris bermasalah — perbaiki file lalu unggah ulang.` : "Semua baris valid — tekan Commit ke Database untuk menyimpan."}
            </div>
            <div className={styles.summary}>
              {[
                { label: "File", value: s.file_count, color: "var(--text)" },
                { label: "Total Baris", value: s.total_baris, color: "var(--text)" },
                { label: "Insert", value: s.insert, color: "var(--sem-green, #22c55e)" },
                { label: "Update", value: s.update, color: "var(--sem-amber, #f59e0b)" },
                { label: "Error", value: s.error, color: "var(--sem-red, #ef4444)" }
              ].map((c) => (
                <div key={c.label} className={styles.sumCard}>
                  <div className={styles.sumLabel}>{c.label}</div>
                  <div className={styles.sumValue} style={{ color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>
            <div className={styles.panelSub} style={{ marginTop: 4 }}>
              Tanggal: {s.tanggal_set.length ? s.tanggal_set.map(fmtTanggal).join(", ") : "—"} · Gerbang tujuan: {s.gerbang_tujuan_set.length ? s.gerbang_tujuan_set.join(", ") : "—"}
            </div>
            <PreviewTable items={result.preview} gridStyle={gridStyle} />
          </div>
        )}

        {step === "done" && (
          <div className={styles.doneWrap}>
            <div className={styles.doneIcon}><Icon name="check" size={28} /></div>
            <div className={styles.doneTitle}>AT6 berhasil disimpan</div>
            <div className={styles.doneSub}>{committed ?? 0} baris di-commit. Hasil LHR & monitoring kelengkapan akan menampilkan data terbaru.</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PreviewTable({ items, gridStyle }: { items: LhrOdPreviewItem[]; gridStyle: CSSProperties }) {
  return (
    <div className={mstyles.tableCard} style={{ maxHeight: 340, marginTop: 10 }}>
      <div className={mstyles.tableScroll}>
        <div className={mstyles.table} style={{ minWidth: 820 }}>
          <div className={mstyles.thead} style={gridStyle}>
            <span>File</span><span>Gerbang Exit</span><span>Asal</span><span>Tanggal</span><span>Gol</span><span>Aksi</span>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Tidak ada baris untuk ditampilkan.</div>
          ) : (
            items.slice(0, 300).map((it, i) => (
              <div key={`${it.file_name}-${i}`} className={mstyles.trow} style={gridStyle}>
                <span style={{ minWidth: 0 }} className={mstyles.cellSub}>{it.file_name}</span>
                <span style={{ minWidth: 0 }} className={mstyles.cellText}>{it.gerbang_exit_nama || it.kode_gerbang_tujuan || "—"}</span>
                <span style={{ minWidth: 0 }} className={mstyles.cellText}>{it.asal_nama || it.kode_gerbang_asal || "—"}</span>
                <span className={mstyles.muted}>{fmtTanggal(it.tanggal)}</span>
                <span className={mstyles.muted}>{it.gol ? (GOL_SHORT[it.gol] ?? it.gol) : "—"}</span>
                <span>
                  <span className={`${styles.act} ${actClass(it.action_type)}`}>{it.action_type}</span>
                  {it.error_message && <span className={mstyles.cellSub} style={{ display: "block", color: "var(--sem-red, #ef4444)" }}>{it.error_message}</span>}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
