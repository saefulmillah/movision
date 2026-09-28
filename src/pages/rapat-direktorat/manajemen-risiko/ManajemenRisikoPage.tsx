import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Modal, Select, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import {
  createPeriod,
  deleteItem,
  getMatrix,
  getPeriod,
  getPeriods,
  publishPeriod,
  upsertItem
} from "@/lib/risk";
import type { Level, PeriodData, PeriodMeta, RiskItem, RiskMatrix, Stage, StageValue, UpsertItemInput } from "@/types/risk";
import { RiskHeatmap } from "./RiskHeatmap";
import { RiskFormModal } from "./RiskFormModal";
import styles from "./ManajemenRisikoPage.module.css";

const STAGES: { key: Stage; label: string }[] = [
  { key: "inherent", label: "Inherent" },
  { key: "expected", label: "Expected" },
  { key: "residual", label: "Residual" }
];

// Warna teks chip: kuning/hijau muda pakai tinta gelap, sisanya putih (ikut referensi).
function chipInk(level: Level): string {
  return level === "LM" || level === "M" ? "#2a2118" : "#fff";
}

function fmtNilai(v: number | null | undefined): string {
  if (v == null) return "–";
  return Math.round(v).toLocaleString("en-US");
}

export function ManajemenRisikoPage() {
  const toast = useToast();
  const { moduleLevel, hasRole } = useAuth();
  const level = moduleLevel("manajemen_risiko");
  const canWrite = hasRole("super_admin") || level === "write" || level === "delete";

  const [matrix, setMatrix] = useState<RiskMatrix | null>(null);
  const [periods, setPeriods] = useState<PeriodMeta[]>([]);
  const [periodKey, setPeriodKey] = useState("");
  const [data, setData] = useState<PeriodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RiskItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [periodOpen, setPeriodOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDivisi, setNewDivisi] = useState("");
  const [creatingPeriod, setCreatingPeriod] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<RiskItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Muat matriks + daftar periode sekali.
  const loadBase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mx, list] = await Promise.all([getMatrix(), getPeriods()]);
      setMatrix(mx);
      setPeriods(list);
      setPeriodKey((prev) => (prev && list.some((p) => p.key === prev) ? prev : list[0]?.key ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data awal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  const loadPeriodData = useCallback(async (key: string) => {
    if (!key) {
      setData(null);
      return;
    }
    setLoadingData(true);
    try {
      const d = await getPeriod(key);
      setData(d);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Gagal memuat data periode");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadPeriodData(periodKey);
  }, [periodKey, loadPeriodData]);

  const periodOptions: SelectOption[] = useMemo(
    () => periods.map((p) => ({ value: p.key, label: `${p.label}${p.status === "draft" ? " (draft)" : ""}` })),
    [periods]
  );

  const currentPeriod = data?.period ?? periods.find((p) => p.key === periodKey) ?? null;
  const risks = useMemo(() => [...(data?.risks ?? [])].sort((a, b) => a.rank - b.rank), [data]);

  /* ---------- aksi tulis ---------- */
  async function refreshAfterWrite() {
    await loadPeriodData(periodKey);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(item: RiskItem) {
    setEditing(item);
    setFormOpen(true);
  }

  async function handleSubmitItem(payload: UpsertItemInput) {
    setSaving(true);
    try {
      await upsertItem(periodKey, payload);
      toast.success("Tersimpan", `Risiko peringkat ${payload.rank} tersimpan.`);
      setFormOpen(false);
      await refreshAfterWrite();
    } catch (err) {
      toast.error("Gagal menyimpan", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete?.id) return;
    setDeleting(true);
    try {
      await deleteItem(confirmDelete.id);
      toast.success("Terhapus", `Risiko peringkat ${confirmDelete.rank} dihapus.`);
      setConfirmDelete(null);
      await refreshAfterWrite();
    } catch (err) {
      toast.error("Gagal menghapus", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreatePeriod() {
    if (!/^\d{4}-\d{2}$/.test(newKey.trim())) {
      toast.error("Periode tidak valid", "Format kunci periode harus YYYY-MM (mis. 2026-08).");
      return;
    }
    if (!newLabel.trim()) {
      toast.error("Label wajib", "Isi label periode (mis. Agustus 2026).");
      return;
    }
    setCreatingPeriod(true);
    try {
      const created = await createPeriod({
        period_key: newKey.trim(),
        period_label: newLabel.trim(),
        divisi: newDivisi.trim() || undefined
      });
      toast.success("Periode dibuat", `${created.label} siap diisi.`);
      setPeriodOpen(false);
      setNewKey("");
      setNewLabel("");
      setNewDivisi("");
      await loadBase();
      setPeriodKey(created.key);
    } catch (err) {
      toast.error("Gagal membuat periode", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setCreatingPeriod(false);
    }
  }

  async function handlePublish() {
    if (!periodKey) return;
    try {
      await publishPeriod(periodKey);
      toast.success("Dipublikasikan", `Periode ${currentPeriod?.label ?? periodKey} kini published.`);
      await loadBase();
      await loadPeriodData(periodKey);
    } catch (err) {
      toast.error("Gagal publikasi", err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  /* ---------- render ---------- */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.stateBox}>
          <EmptyState icon="loader" title="Memuat data…" />
        </div>
      </div>
    );
  }

  if (error && !matrix) {
    return (
      <div className={styles.page}>
        <div className={styles.stateBox}>
          <EmptyState icon="triangle-alert" title="Gagal memuat" description={error}>
            <Button icon="refresh-cw" onClick={() => void loadBase()}>
              Coba lagi
            </Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>Manajemen Risiko — Top Risk Divisi</h1>
          <div className={styles.sub}>
            Periode <b>{currentPeriod?.label || "—"}</b>
            {currentPeriod?.divisi ? <> · {currentPeriod.divisi}</> : null} · Nilai dalam <b>{currentPeriod?.unit || "Rp juta"}</b>
          </div>
        </div>
        <div className={styles.spacer} />
        <Select
          value={periodKey}
          onValueChange={setPeriodKey}
          options={periodOptions}
          placeholder="Pilih periode"
          icon="calendar"
          ariaLabel="Pilih periode"
        />
        {canWrite && (
          <>
            <Button icon="calendar-plus" onClick={() => setPeriodOpen(true)}>
              Periode
            </Button>
            <Button variant="primary" icon="plus" disabled={!periodKey} onClick={openCreate}>
              Tambah Risiko
            </Button>
            {currentPeriod?.status === "draft" && (
              <Button variant="secondary" icon="send" disabled={!periodKey} onClick={() => void handlePublish()}>
                Publikasikan
              </Button>
            )}
          </>
        )}
      </div>

      {!periodKey ? (
        <div className={styles.stateBox}>
          <EmptyState
            icon="inbox"
            title="Belum ada periode"
            description={canWrite ? "Buat periode baru untuk mulai mengisi Top Risk." : "Belum ada periode untuk ditampilkan."}
          >
            {canWrite && (
              <Button icon="calendar-plus" onClick={() => setPeriodOpen(true)}>
                Buat Periode
              </Button>
            )}
          </EmptyState>
        </div>
      ) : (
        <div className={styles.grid2}>
          {/* Heat map */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Peta Risiko (5 × 5)</h2>
            {matrix && data ? (
              <RiskHeatmap matrix={matrix} risks={risks} onSelectRank={canWrite ? (rank) => {
                const item = risks.find((r) => r.rank === rank);
                if (item) openEdit(item);
              } : undefined} />
            ) : (
              <div className={styles.stateBox}>
                <EmptyState icon="loader" title="Memuat peta…" />
              </div>
            )}
            <div className={styles.legend}>
              <span className={styles.legItem}><span className={`${styles.dot} ${styles.dotInh}`} />Inherent Risk</span>
              <span className={styles.legItem}><span className={`${styles.dot} ${styles.dotExp}`} />Expected Risk</span>
              <span className={styles.legItem}><span className={`${styles.dot} ${styles.dotRes}`} />Residual Risk</span>
            </div>
            {matrix && (
              <div className={styles.legend}>
                {(Object.keys(matrix.levels) as Level[]).map((lv) => (
                  <span key={lv} className={styles.legItem}>
                    <span className={styles.zsw} style={{ background: matrix.levels[lv].color }} />
                    {matrix.levels[lv].label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tabel Top Risk */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Daftar Top Risk</h2>
            {loadingData ? (
              <div className={styles.stateBox}>
                <EmptyState icon="loader" title="Memuat data…" />
              </div>
            ) : !risks.length ? (
              <div className={styles.stateBox}>
                <EmptyState
                  icon="inbox"
                  title="Belum ada risiko"
                  description={canWrite ? "Tambahkan risiko pertama untuk periode ini." : "Belum ada data risiko."}
                >
                  {canWrite && (
                    <Button icon="plus" onClick={openCreate}>
                      Tambah Risiko
                    </Button>
                  )}
                </EmptyState>
              </div>
            ) : (
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th rowSpan={2} className={styles.thRank}>#</th>
                      <th rowSpan={2}>Peristiwa &amp; Dampak</th>
                      <th colSpan={2}>Inherent</th>
                      <th colSpan={2}>Expected</th>
                      <th colSpan={2}>Residual</th>
                      {canWrite && <th rowSpan={2} className={styles.thAct} />}
                    </tr>
                    <tr className={styles.subHead}>
                      <th>Exposure</th><th>Nilai</th>
                      <th>Exposure</th><th>Nilai</th>
                      <th>Exposure</th><th>Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risks.map((r) => (
                      <tr key={r.id ?? r.rank}>
                        <td className={styles.tdRank}>{r.rank}</td>
                        <td>
                          <div className={styles.evt}>{r.event}</div>
                          {r.impact_desc && <div className={styles.dmp}>{r.impact_desc}</div>}
                        </td>
                        {STAGES.map(({ key }) => {
                          const s = r[key] as StageValue | null | undefined;
                          return (
                            <ExposureCells key={key} stage={s} matrix={matrix} />
                          );
                        })}
                        {canWrite && (
                          <td className={styles.tdAct}>
                            <div className={styles.actions}>
                              <Button size="sm" iconOnly icon="pencil" title="Ubah" onClick={() => openEdit(r)} />
                              <Button
                                size="sm"
                                iconOnly
                                variant="danger"
                                icon="trash-2"
                                title="Hapus"
                                onClick={() => setConfirmDelete(r)}
                              />
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className={styles.note}>
              Exposure = nomor sel matriks + level. Peta &amp; level dihitung dari Kemungkinan × Dampak (Rp juta).
            </div>
          </div>
        </div>
      )}

      {/* Form tambah/ubah risiko */}
      {matrix && (
        <RiskFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          matrix={matrix}
          initial={editing}
          saving={saving}
          onSubmit={handleSubmitItem}
        />
      )}

      {/* Modal buat periode */}
      <Modal
        open={periodOpen}
        onOpenChange={setPeriodOpen}
        title="Buat Periode Baru"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPeriodOpen(false)} disabled={creatingPeriod}>
              Batal
            </Button>
            <Button variant="primary" icon={creatingPeriod ? "loader" : "check"} disabled={creatingPeriod} onClick={() => void handleCreatePeriod()}>
              {creatingPeriod ? "Menyimpan…" : "Buat"}
            </Button>
          </>
        }
      >
        <div className={styles.periodForm}>
          <label className={styles.pfField}>
            <span className={styles.pfLabel}>Kunci Periode (YYYY-MM)</span>
            <input className={styles.pfInput} value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="2026-08" />
          </label>
          <label className={styles.pfField}>
            <span className={styles.pfLabel}>Label</span>
            <input className={styles.pfInput} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Agustus 2026" />
          </label>
          <label className={styles.pfField}>
            <span className={styles.pfLabel}>Divisi (opsional)</span>
            <input className={styles.pfInput} value={newDivisi} onChange={(e) => setNewDivisi(e.target.value)} placeholder="Operasi & Pemeliharaan Jalan Tol" />
          </label>
        </div>
      </Modal>

      {/* Konfirmasi hapus */}
      <Modal
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Hapus Risiko"
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Batal
            </Button>
            <Button variant="danger" icon={deleting ? "loader" : "trash-2"} disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? "Menghapus…" : "Hapus"}
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Hapus risiko peringkat <b>{confirmDelete?.rank}</b> — “{confirmDelete?.event}”? Tindakan ini menghapus seluruh assessment
          (inherent/expected/residual) dan tidak dapat dibatalkan.
        </p>
      </Modal>
    </div>
  );
}

/** Dua sel tabel (chip exposure + nilai) untuk satu stage. */
function ExposureCells({ stage, matrix }: { stage: StageValue | null | undefined; matrix: RiskMatrix | null }) {
  if (!stage) {
    return (
      <>
        <td className={styles.tdChip}><span className={styles.emptyChip}>–</span></td>
        <td className={styles.num}>–</td>
      </>
    );
  }
  const meta = matrix?.levels[stage.level];
  return (
    <>
      <td className={styles.tdChip}>
        <span className={styles.chip} style={{ background: meta?.color, color: chipInk(stage.level) }}>
          {stage.cell} · {stage.level}
        </span>
      </td>
      <td className={styles.num}>{fmtNilai(stage.nilai)}</td>
    </>
  );
}
