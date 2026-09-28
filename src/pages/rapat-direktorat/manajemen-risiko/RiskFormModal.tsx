import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import type { Level, MatrixCell, RiskItem, RiskMatrix, Stage, StageInput, UpsertItemInput } from "@/types/risk";
import styles from "./RiskFormModal.module.css";

const STAGES: { key: Stage; label: string }[] = [
  { key: "inherent", label: "Inherent" },
  { key: "expected", label: "Expected" },
  { key: "residual", label: "Residual" }
];

interface StageForm {
  likelihood: string;
  impact: string;
  nilai: string;
}

const EMPTY_STAGE: StageForm = { likelihood: "", impact: "", nilai: "" };

function stageFromValue(v: RiskItem["inherent"]): StageForm {
  if (!v) return { ...EMPTY_STAGE };
  return {
    likelihood: String(v.likelihood ?? ""),
    impact: String(v.impact ?? ""),
    nilai: v.nilai == null ? "" : String(v.nilai)
  };
}

interface RiskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matrix: RiskMatrix;
  /** null = tambah; objek = ubah. */
  initial: RiskItem | null;
  saving: boolean;
  onSubmit: (payload: UpsertItemInput) => void;
}

export function RiskFormModal({ open, onOpenChange, matrix, initial, saving, onSubmit }: RiskFormModalProps) {
  const [rank, setRank] = useState("");
  const [event, setEvent] = useState("");
  const [impactDesc, setImpactDesc] = useState("");
  const [stages, setStages] = useState<Record<Stage, StageForm>>({
    inherent: { ...EMPTY_STAGE },
    expected: { ...EMPTY_STAGE },
    residual: { ...EMPTY_STAGE }
  });
  const [error, setError] = useState<string | null>(null);

  // Reset saat modal dibuka / target berubah.
  useEffect(() => {
    if (!open) return;
    setRank(initial?.rank ? String(initial.rank) : "");
    setEvent(initial?.event ?? "");
    setImpactDesc(initial?.impact_desc ?? "");
    setStages({
      inherent: stageFromValue(initial?.inherent),
      expected: stageFromValue(initial?.expected),
      residual: stageFromValue(initial?.residual)
    });
    setError(null);
  }, [open, initial]);

  // Peta (impact,likelihood) → sel, untuk preview posisi/level.
  const cellByIL = useMemo(() => {
    const map = new Map<string, MatrixCell>();
    for (const c of matrix.cells) map.set(`${c.impact}-${c.likelihood}`, c);
    return map;
  }, [matrix]);

  const scoreOptions = (axis: Record<string, string>): SelectOption[] =>
    [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} — ${axis[String(n)] ?? ""}` }));

  const likelihoodOpts = useMemo(() => scoreOptions(matrix.axes.likelihood), [matrix]);
  const impactOpts = useMemo(() => scoreOptions(matrix.axes.impact), [matrix]);

  function setStageField(stage: Stage, field: keyof StageForm, value: string) {
    setStages((prev) => ({ ...prev, [stage]: { ...prev[stage], [field]: value } }));
  }

  function previewCell(s: StageForm): MatrixCell | null {
    if (!s.likelihood || !s.impact) return null;
    return cellByIL.get(`${Number(s.impact)}-${Number(s.likelihood)}`) ?? null;
  }

  function levelChip(level: Level | null, cellNo?: number) {
    if (!level) return <span className={styles.previewMuted}>Pilih Kemungkinan &amp; Dampak</span>;
    const meta = matrix.levels[level];
    return (
      <span className={styles.chip} style={{ background: meta?.color, color: level === "M" ? "#2a2118" : "#fff" }}>
        Sel {cellNo} · {meta?.label ?? level}
      </span>
    );
  }

  function handleSubmit() {
    const rankNum = Number(rank);
    if (!Number.isInteger(rankNum) || rankNum < 1) {
      setError("Peringkat wajib diisi (bilangan bulat ≥ 1).");
      return;
    }
    if (!event.trim()) {
      setError("Peristiwa risiko wajib diisi.");
      return;
    }

    const payload: UpsertItemInput = {
      rank: rankNum,
      event: event.trim(),
      impact_desc: impactDesc.trim() || undefined
    };
    if (initial?.id) payload.id = initial.id;

    let filledStages = 0;
    for (const { key } of STAGES) {
      const s = stages[key];
      const hasL = !!s.likelihood;
      const hasI = !!s.impact;
      if (!hasL && !hasI && !s.nilai) continue; // stage kosong → lewati
      if (!hasL || !hasI) {
        setError(`Stage ${key}: Kemungkinan & Dampak harus diisi bersamaan.`);
        return;
      }
      const stageInput: StageInput = { likelihood: Number(s.likelihood), impact: Number(s.impact) };
      if (s.nilai !== "") stageInput.nilai = Number(s.nilai);
      payload[key] = stageInput;
      filledStages += 1;
    }

    if (filledStages === 0) {
      setError("Isi minimal satu stage (Inherent/Expected/Residual).");
      return;
    }

    setError(null);
    onSubmit(payload);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? `Ubah Risiko — Peringkat ${initial.rank}` : "Tambah Risiko"}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" icon={saving ? "loader" : "save"} disabled={saving} onClick={handleSubmit}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <div className={styles.row2}>
          <label className={styles.field}>
            <span className={styles.label}>Peringkat</span>
            <Input
              type="number"
              min={1}
              icon="hash"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              placeholder="1"
            />
          </label>
          <label className={`${styles.field} ${styles.grow}`}>
            <span className={styles.label}>Peristiwa Risiko</span>
            <Input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="mis. Risiko Keterlambatan Penyesuaian Tarif" />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Deskripsi Dampak</span>
          <Input value={impactDesc} onChange={(e) => setImpactDesc(e.target.value)} placeholder="mis. Penurunan pendapatan tol" />
        </label>

        <div className={styles.stages}>
          {STAGES.map(({ key, label }) => {
            const s = stages[key];
            const cell = previewCell(s);
            return (
              <div key={key} className={styles.stage}>
                <div className={styles.stageHead}>
                  <span className={`${styles.dot} ${styles[`dot_${key}`]}`} />
                  <span className={styles.stageTitle}>{label}</span>
                  <span className={styles.preview}>{levelChip(cell?.level ?? null, cell?.no)}</span>
                </div>
                <div className={styles.stageFields}>
                  <label className={styles.field}>
                    <span className={styles.labelSm}>Kemungkinan</span>
                    <Select
                      value={s.likelihood}
                      onValueChange={(v) => setStageField(key, "likelihood", v)}
                      options={likelihoodOpts}
                      placeholder="1–5"
                      ariaLabel={`Kemungkinan ${label}`}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.labelSm}>Dampak</span>
                    <Select
                      value={s.impact}
                      onValueChange={(v) => setStageField(key, "impact", v)}
                      options={impactOpts}
                      placeholder="1–5"
                      ariaLabel={`Dampak ${label}`}
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.labelSm}>Nilai (Rp juta)</span>
                    <Input
                      type="number"
                      value={s.nilai}
                      onChange={(e) => setStageField(key, "nilai", e.target.value)}
                      placeholder="0"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className={styles.error}>{error}</div>}
      </div>
    </Modal>
  );
}
