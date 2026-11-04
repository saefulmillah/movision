import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, EmptyState, Select, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import {
  getScope as getSentimentScope,
  getPeriods as getSentimentPeriods,
  uploadSentiment,
  flushPeriod,
  upsertRecommendation,
  deleteRecommendation,
  markIrrelevant,
  unmarkIrrelevant
} from "@/lib/sentiment";
import { getPresentationScopes, flattenScopes, type PresentationScope, type PresentationScopesResponse } from "@/lib/presentationScope";
import type { RecoStatus, SentimentIssue, SentimentScopeData } from "@/types/sentiment";
import styles from "./SentimenPage.module.css";

// ============================================================================
// Halaman admin Sentimen (Rapat Direktorat). Admin lingkup-penuh (divisi)
// mengunggah raw mention (.xlsx vendor) sekali per periode; tiap lingkup
// memantau agregat per scope-nya dan mengisi TINDAK LANJUT per isu negatif
// (action + PIC + status). Data agregat on-the-fly dari raw (tag-based).
// ============================================================================

const MONTH_TITLE_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Opsi periode = awal tahun s.d bulan berjalan (tahun berjalan), gabung periode terunggah.
function buildPeriodOptions(extra: string[]): SelectOption[] {
  const now = new Date();
  const year = now.getFullYear();
  const cur = now.getMonth() + 1;
  const keys = new Set<string>();
  for (let m = 1; m <= cur; m++) keys.add(`${year}-${String(m).padStart(2, "0")}`);
  for (const k of extra) keys.add(k);
  return [...keys]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((k) => {
      const mm = Number(k.slice(5, 7));
      return { value: k, label: `${MONTH_TITLE_ID[mm - 1] || k} ${k.slice(0, 4)}` };
    });
}

const STATUS_LABEL: Record<string, string> = { aman: "Aman", atensi: "Perlu Atensi", kritis: "Kritis" };
const RECO_OPTIONS: SelectOption[] = [
  { value: "open", label: "Belum ditangani" },
  { value: "in_progress", label: "Sedang diproses" },
  { value: "done", label: "Selesai" }
];

function fmt(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString("id-ID");
}
function compact(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(".", ",")} M`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(".", ",")} jt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(".", ",")} rb`;
  return fmt(v);
}

interface RecoDraft {
  action: string;
  pic: string;
  status: RecoStatus;
  id: number | null;
}

export function SentimenPage() {
  const toast = useToast();
  const { moduleLevel, hasRole } = useAuth();
  const level = moduleLevel("sentimen");
  const canWrite = hasRole("super_admin") || level === "write" || level === "delete";

  const [scopeInfo, setScopeInfo] = useState<PresentationScopesResponse | null>(null);
  const [scope, setScope] = useState<PresentationScope | null>(null);
  const [extraPeriods, setExtraPeriods] = useState<string[]>([]);
  const periodOptions = useMemo(() => buildPeriodOptions(extraPeriods), [extraPeriods]);
  const [period, setPeriod] = useState<string>("");
  const [data, setData] = useState<SentimentScopeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, RecoDraft>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [hidingKey, setHidingKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hanya admin lingkup-penuh (divisi) yang mengunggah raw lintas-scope.
  const canUpload = canWrite && (scopeInfo?.canDrill ?? false);

  // Scope + daftar periode terunggah.
  useEffect(() => {
    void getPresentationScopes()
      .then((info) => {
        setScopeInfo(info);
        const all = flattenScopes(info);
        setScope(info.default || all[0] || null);
      })
      .catch(() => setScopeInfo(null));
    void getSentimentPeriods()
      .then((ps) => setExtraPeriods(ps.map((p) => p.key)))
      .catch(() => setExtraPeriods([]));
  }, []);

  // Pilih periode awal = terbaru begitu opsi tersedia.
  useEffect(() => {
    setPeriod((prev) => (prev && periodOptions.some((o) => o.value === prev) ? prev : periodOptions[0]?.value ?? ""));
  }, [periodOptions]);

  const scopeOptions: SelectOption[] = useMemo(() => {
    return flattenScopes(scopeInfo).map((s) => ({
      value: s.key,
      label: s.level === "cabang" ? `  • ${s.label}` : s.label
    }));
  }, [scopeInfo]);

  // Isi draft tindak lanjut dari rekomendasi tersimpan saat data berubah.
  const hydrateDrafts = useCallback((d: SentimentScopeData | null) => {
    if (!d) {
      setDrafts({});
      return;
    }
    const byKey = new Map(d.recommendations.map((r) => [r.issue_key, r]));
    const next: Record<string, RecoDraft> = {};
    for (const it of d.issues) {
      const r = byKey.get(it.key);
      next[it.key] = { action: r?.action ?? "", pic: r?.pic ?? "", status: r?.status ?? "open", id: r?.id ?? null };
    }
    setDrafts(next);
  }, []);

  const refresh = useCallback(() => {
    if (!scope || !period) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    getSentimentScope(period, scope.key)
      .then((d) => {
        if (!alive) return;
        setData(d);
        hydrateDrafts(d);
      })
      .catch(() => {
        if (alive) {
          setData(null);
          setDrafts({});
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [scope, period, hydrateDrafts]);

  useEffect(() => {
    const cleanup = refresh();
    return cleanup;
  }, [refresh]);

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadSentiment(file, period || null);
      toast.success("Data sentimen tersimpan", `${res.period_label}: ${fmt(res.mention_count)} mention${res.unmapped.length ? ` · ${res.unmapped.length} kode ruas tak terpetakan` : ""}.`);
      setExtraPeriods((prev) => (prev.includes(res.period_key) ? prev : [...prev, res.period_key]));
      setPeriod(res.period_key);
      // refresh akan terpicu oleh perubahan period; paksa bila sama.
      if (period === res.period_key) refresh();
    } catch (err) {
      toast.error("Upload gagal", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onFlush() {
    if (!period) return;
    const label = periodOptions.find((o) => o.value === period)?.label ?? period;
    if (!window.confirm(`Hapus seluruh data mentah sentimen untuk ${label}? Agregat & grafik semua lingkup pada periode ini akan kosong. Tindak lanjut yang sudah diisi tetap tersimpan.`)) return;
    setFlushing(true);
    try {
      const res = await flushPeriod(period);
      toast.success("Data sentimen dihapus", res.deleted ? `${label} dikosongkan. Unggah ulang untuk mengisi kembali.` : `Tidak ada data mentah pada ${label}.`);
      setExtraPeriods((prev) => prev.filter((k) => k !== period));
      refresh();
    } catch (err) {
      toast.error("Gagal menghapus", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setFlushing(false);
    }
  }

  function setDraft(key: string, patch: Partial<RecoDraft>) {
    setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  }

  async function saveReco(issue: SentimentIssue) {
    if (!scope || !period) return;
    const draft = drafts[issue.key];
    if (!draft) return;
    setSavingKey(issue.key);
    try {
      const saved = await upsertRecommendation(period, scope.key, {
        issue_key: issue.key,
        issue_title: issue.title,
        action: draft.action,
        pic: draft.pic,
        status: draft.status
      });
      setDraft(issue.key, { id: saved.id });
      toast.success("Tindak lanjut tersimpan");
    } catch (err) {
      toast.error("Gagal menyimpan", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSavingKey(null);
    }
  }

  async function clearReco(issue: SentimentIssue) {
    const draft = drafts[issue.key];
    if (!draft?.id) {
      setDraft(issue.key, { action: "", pic: "", status: "open" });
      return;
    }
    try {
      await deleteRecommendation(draft.id);
      setDraft(issue.key, { action: "", pic: "", status: "open", id: null });
      toast.success("Tindak lanjut dihapus");
    } catch (err) {
      toast.error("Gagal menghapus", err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  async function hideIssue(issue: SentimentIssue) {
    if (!scope || !period) return;
    if (
      !window.confirm(
        `Tandai isu "${issue.title}" sebagai TIDAK RELEVAN untuk lingkup ${scope.label}?\n\n` +
          "Isu ini akan disembunyikan dari agregat, grafik, dan slide presentasi lingkup ini saja. " +
          "Lingkup lain (mis. ruas yang benar) dan divisi tetap menampilkannya. Bisa dipulihkan."
      )
    )
      return;
    setHidingKey(issue.key);
    try {
      await markIrrelevant(period, scope.key, issue.key, issue.title);
      toast.success("Isu disembunyikan", "Tidak lagi dihitung pada lingkup ini.");
      refresh();
    } catch (err) {
      toast.error("Gagal menandai", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setHidingKey(null);
    }
  }

  async function restoreIssue(issueKey: string) {
    if (!scope || !period) return;
    try {
      await unmarkIrrelevant(period, scope.key, issueKey);
      toast.success("Isu dipulihkan", "Kembali dihitung pada lingkup ini.");
      refresh();
    } catch (err) {
      toast.error("Gagal memulihkan", err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  const empty = !data || data.total === 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>Analisis Sentimen</h1>
          <div className={styles.sub}>
            Lingkup <b>{scope?.label || "—"}</b> · Persepsi publik media sosial &amp; daring · Tindak lanjut per isu negatif.
          </div>
        </div>
        <div className={styles.headSpacer} />
        {canUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => void onFilePicked(e.target.files?.[0])}
            />
            <Button variant="primary" icon={uploading ? "loader" : "upload"} disabled={uploading || flushing} onClick={() => fileRef.current?.click()}>
              {uploading ? "Mengunggah…" : "Upload Data Mentah"}
            </Button>
            <Button variant="ghost" icon={flushing ? "loader" : "trash-2"} disabled={flushing || uploading || empty} onClick={() => void onFlush()} title="Hapus data mentah periode ini">
              {flushing ? "Menghapus…" : "Hapus Data"}
            </Button>
          </>
        )}
      </div>

      <div className={styles.toolbar}>
        <Select value={scope?.key ?? ""} onValueChange={(k) => setScope(flattenScopes(scopeInfo).find((s) => s.key === k) ?? null)} options={scopeOptions} placeholder="Pilih lingkup" icon="layers" ariaLabel="Lingkup" />
        <Select value={period} onValueChange={setPeriod} options={periodOptions} placeholder="Pilih periode" icon="calendar" ariaLabel="Periode" />
      </div>

      {loading ? (
        <div className={styles.stateBox}>
          <EmptyState icon="loader" title="Memuat data…" />
        </div>
      ) : empty ? (
        <div className={styles.stateBox}>
          <EmptyState
            icon="inbox"
            title="Belum ada data sentimen"
            description={
              canUpload
                ? "Unggah file data mentah (.xlsx) dari vendor untuk periode ini agar agregat tampil."
                : "Data mentah diunggah oleh admin divisi. Agregat lingkup Anda akan muncul setelah data tersedia."
            }
          />
        </div>
      ) : (
        <>
          <div className={styles.summary}>
            <div className={`${styles.statCard} ${styles[data!.status]}`}>
              <div className={styles.statLabel}>Status Wilayah</div>
              <div className={styles.statBig}>{STATUS_LABEL[data!.status]}</div>
              <div className={styles.statSub}>{data!.composition.negPct.toFixed(1).replace(".", ",")}% negatif</div>
            </div>
            <Stat label="Percakapan" value={fmt(data!.total)} />
            <Stat label="Positif / Netral / Negatif" value={`${fmt(data!.composition.positive)} / ${fmt(data!.composition.neutral)} / ${fmt(data!.composition.negative)}`} />
            <Stat label="Jangkauan" value={compact(data!.reach)} />
            <Stat label="Nilai PR" value={`Rp ${compact(data!.pr_value)}`} />
          </div>

          <div className={styles.narrative}>{data!.narrative}</div>

          <div className={styles.sectionTitle}>
            Tindak Lanjut Isu Negatif Teratas
            <span>Isi rencana aksi, penanggung jawab (PIC), dan status untuk tiap isu. Tampil di slide presentasi lingkup ini.</span>
          </div>

          {data!.issues.length === 0 ? (
            <div className={styles.stateBox}>
              <EmptyState icon="check" title="Tidak ada isu negatif menonjol" description="Tidak ada isu bernada negatif pada lingkup & periode ini." />
            </div>
          ) : (
            <div className={styles.recoList}>
              {data!.issues.map((it, i) => {
                const draft = drafts[it.key];
                return (
                  <div key={it.key} className={styles.recoCard}>
                    <div className={styles.recoHead}>
                      <span className={styles.recoRank}>#{i + 1}</span>
                      <div className={styles.recoIssue}>
                        <div className={styles.recoTitle}>{it.title}</div>
                        <div className={styles.recoStat}>
                          Jangkauan {compact(it.reach)} · {fmt(it.negative)} negatif
                          {it.link && (
                            <>
                              {" · "}
                              <a href={it.link} target="_blank" rel="noopener noreferrer" className={styles.recoLink}>sumber</a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.recoForm}>
                      <textarea
                        className={styles.recoAction}
                        placeholder="Rencana tindak lanjut / klarifikasi…"
                        rows={2}
                        value={draft?.action ?? ""}
                        onChange={(e) => setDraft(it.key, { action: e.target.value })}
                        disabled={!canWrite}
                      />
                      <input
                        className={styles.recoPic}
                        placeholder="PIC (unit/nama)"
                        value={draft?.pic ?? ""}
                        onChange={(e) => setDraft(it.key, { pic: e.target.value })}
                        disabled={!canWrite}
                      />
                      <div className={styles.recoStatusSel}>
                        <Select
                          value={draft?.status ?? "open"}
                          onValueChange={(v) => setDraft(it.key, { status: v as RecoStatus })}
                          options={RECO_OPTIONS}
                          ariaLabel="Status tindak lanjut"
                        />
                      </div>
                      {canWrite && (
                        <div className={styles.recoActions}>
                          <Button size="sm" variant="primary" icon={savingKey === it.key ? "loader" : "save"} disabled={savingKey === it.key} onClick={() => void saveReco(it)}>
                            Simpan
                          </Button>
                          <Button size="sm" variant="ghost" iconOnly icon="trash-2" title="Kosongkan tindak lanjut" onClick={() => void clearReco(it)} />
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            icon={hidingKey === it.key ? "loader" : "eye-off"}
                            title="Tandai tidak relevan — sembunyikan dari lingkup ini (mis. salah tag ruas)"
                            disabled={hidingKey === it.key}
                            onClick={() => void hideIssue(it)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {data!.irrelevant.length > 0 && (
            <div className={styles.hiddenBox}>
              <div className={styles.hiddenHead}>
                <span className={styles.hiddenTitle}>Isu Disembunyikan (Tidak Relevan)</span>
                <span className={styles.hiddenSub}>
                  Tidak dihitung pada lingkup {scope?.label} — mis. salah tag ruas. Lingkup lain & divisi tetap memakainya.
                </span>
              </div>
              <div className={styles.hiddenList}>
                {data!.irrelevant.map((h) => (
                  <div key={h.issue_key} className={styles.hiddenChip}>
                    <span className={styles.hiddenChipText} title={h.issue_title ?? h.issue_key}>
                      {h.issue_title ?? h.issue_key}
                    </span>
                    {canWrite && (
                      <button
                        type="button"
                        className={styles.hiddenRestore}
                        title="Pulihkan isu ini"
                        onClick={() => void restoreIssue(h.issue_key)}
                      >
                        Pulihkan
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className={styles.foot}>
        Agregat dihitung langsung dari data mentah (tag-based): satu percakapan dapat menyebut lebih dari satu ruas, sehingga
        jumlah per wilayah dapat berbeda dari jumlah divisi. Data mentah cukup diunggah sekali per periode oleh admin divisi.
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statVal}>{value}</div>
    </div>
  );
}
