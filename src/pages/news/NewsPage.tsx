import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Icon, Input, Modal, Pagination, Select, StatusPill, useToast } from "@/components/ui";
import type { PillTone } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { backendAsset } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { approveNews, deleteNews, fetchNews, newsCategoryLabel, rejectNews, submitNews } from "@/lib/news";
import type { ApprovalStatus, NewsItem } from "@/types/modules";
import { NewsFormModal } from "./NewsFormModal";
import styles from "../modules.module.css";

const COLS = "2.4fr 0.8fr 1fr 1fr";
const PER_PAGE = 12;

const STATUS_OPTIONS = [
  { value: "all", label: "Semua status" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Menunggu persetujuan" },
  { value: "published", label: "Terbit" },
  { value: "rejected", label: "Ditolak" }
];

function approvalMeta(s: ApprovalStatus | string): { label: string; tone: PillTone } {
  switch (s) {
    case "pending":
      return { label: "Menunggu", tone: "amber" };
    case "published":
      return { label: "Terbit", tone: "green" };
    case "rejected":
      return { label: "Ditolak", tone: "red" };
    default:
      return { label: "Draft", tone: "gray" };
  }
}

export function NewsPage() {
  const toast = useToast();
  const { hasPermission, hasRole, capability } = useAuth();
  const { branches } = useBranch();
  const canManage = hasPermission("news.manage");
  const canApprove = hasPermission("news.approve");
  const canViewAll = hasRole("super_admin") || hasPermission("branch.view.all");

  // Cabang yang boleh dipilih maker saat mengajukan (scope).
  const scopeBranches = useMemo<{ id: number; label: string }[]>(() => {
    if (canViewAll) {
      return branches.map((b) => ({ id: b.id, label: b.branch_code || b.branch_name || `Ruas ${b.id}` }));
    }
    return (capability?.branch_scopes ?? []).map((b) => ({
      id: Number(b.branch_id),
      label: String(b.branch_name || `Ruas ${b.branch_id}`)
    }));
  }, [canViewAll, branches, capability]);

  const [items, setItems] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [busy, setBusy] = useState(false);

  // Modal pengajuan (maker) & penolakan (checker).
  const [submitTarget, setSubmitTarget] = useState<NewsItem | null>(null);
  const [submitBranch, setSubmitBranch] = useState<string>("");
  const [submitNote, setSubmitNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<NewsItem | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchNews({
        page,
        per_page: PER_PAGE,
        approval_status: status === "all" ? undefined : status,
        search: query || undefined
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e) {
      toast.error("Gagal memuat berita", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, status, query, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status, query]);

  const selected = useMemo(() => items.find((n) => n.id === selectedId) ?? null, [items, selectedId]);
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);
  const gridStyle = { gridTemplateColumns: COLS } as CSSProperties;

  function openSubmit(item: NewsItem) {
    setSubmitBranch(item.branch_id ? String(item.branch_id) : scopeBranches[0] ? String(scopeBranches[0].id) : "");
    setSubmitNote("");
    setSubmitTarget(item);
  }

  async function confirmSubmit() {
    if (!submitTarget) return;
    if (!submitBranch) {
      toast.error("Pilih ruas (scope) terlebih dahulu");
      return;
    }
    setBusy(true);
    try {
      await submitNews(submitTarget.id, { branch_id: Number(submitBranch), note: submitNote.trim() || undefined });
      toast.success("Berita diajukan untuk persetujuan");
      setSubmitTarget(null);
      await load();
    } catch (e) {
      toast.error("Gagal mengajukan", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function doApprove(item: NewsItem) {
    setBusy(true);
    try {
      await approveNews(item.id);
      toast.success("Berita disetujui & diterbitkan");
      await load();
    } catch (e) {
      toast.error("Gagal menyetujui", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (!rejectNote.trim()) {
      toast.error("Catatan penolakan wajib diisi");
      return;
    }
    setBusy(true);
    try {
      await rejectNews(rejectTarget.id, rejectNote.trim());
      toast.success("Berita ditolak");
      setRejectTarget(null);
      await load();
    } catch (e) {
      toast.error("Gagal menolak", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteNews(deleteTarget.id);
      toast.success("Berita dihapus");
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error("Gagal menghapus", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  const myUserId = capability?.user?.id ?? null;
  // Pengaju tidak boleh menyetujui/menolak beritanya sendiri (selaras aturan backend maker≠checker).
  const isOwnSubmission = selected ? selected.submitted_by != null && Number(selected.submitted_by) === Number(myUserId) : false;
  const isMaker = selected ? canManage && ["draft", "rejected"].includes(selected.approval_status) : false;
  const isChecker = selected ? canApprove && selected.approval_status === "pending" && !isOwnSubmission : false;
  const ownPending = selected ? canApprove && selected.approval_status === "pending" && isOwnSubmission : false;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 600, margin: 0 }}>Berita</h1>
        <span className={styles.headSpacer} />
        <Select className={styles.filter} value={status} onValueChange={setStatus} options={STATUS_OPTIONS} icon="filter" ariaLabel="Filter status" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Input wrapClassName={styles.search} icon="search" placeholder="Cari judul / isi…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        {canManage && (
          <Button variant="primary" icon="plus" onClick={() => setFormMode("create")}>
            Tambah Berita
          </Button>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <div className={styles.table}>
              <div className={styles.thead} style={gridStyle}>
                <span>Berita</span>
                <span>Kategori</span>
                <span>Status</span>
                <span>Diperbarui</span>
              </div>
              {loading && items.length === 0 ? (
                <EmptyState icon="newspaper" title="Memuat berita…" />
              ) : items.length === 0 ? (
                <EmptyState icon="newspaper" title="Tidak ada berita" description="Belum ada berita yang cocok." />
              ) : (
                items.map((n) => {
                  const img = backendAsset(n.image_url);
                  const meta = approvalMeta(n.approval_status);
                  return (
                    <div
                      key={n.id}
                      className={styles.trow}
                      style={gridStyle}
                      data-selected={selectedId === n.id || undefined}
                      onClick={() => setSelectedId(n.id)}
                    >
                      <span className={styles.rowFlex}>
                        {img ? (
                          <img className={styles.thumb} src={img} alt="" loading="lazy" />
                        ) : (
                          <span className={`${styles.thumb} ${styles.thumbPlaceholder}`}>
                            <Icon name="image" size={18} />
                          </span>
                        )}
                        <span style={{ minWidth: 0 }}>
                          <span className={styles.cellTitle}>{n.title || "(tanpa judul)"}</span>
                          <span className={styles.cellSub}>{n.source || n.author || n.posted_by || "—"}</span>
                        </span>
                      </span>
                      <span className={styles.muted}>{newsCategoryLabel(n.category)}</span>
                      <span>
                        <StatusPill label={meta.label} tone={meta.tone} />
                      </span>
                      <span className={styles.muted}>{formatDate(n.submitted_at || n.approved_at || n.posted_at) || "—"}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <Pagination page={page} pageCount={totalPages} from={from} to={to} total={total} onPage={setPage} unit="berita" />
        </div>

        {selected && (
          <aside className={styles.detailPanel} key={selected.id}>
            <div className={styles.detailHead}>
              <span className={styles.detailTitle}>{selected.title || "(tanpa judul)"}</span>
            </div>
            <div className={styles.detailBody}>
              {backendAsset(selected.image_url) && <img className={styles.detailImage} src={backendAsset(selected.image_url)} alt="" />}
              <div className={styles.chips}>
                <StatusPill label={approvalMeta(selected.approval_status).label} tone={approvalMeta(selected.approval_status).tone} />
                {selected.category !== null && <span className={`${styles.chip} ${styles.chipMono}`}>{newsCategoryLabel(selected.category)}</span>}
              </div>

              {selected.approval_status === "rejected" && selected.review_note && (
                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Catatan penolakan</span>
                  <p className={styles.bodyText} style={{ color: "var(--color-danger, #c0392b)" }}>{selected.review_note}</p>
                </div>
              )}

              <div className={styles.section}>
                <span className={styles.sectionLabel}>Isi</span>
                <p className={styles.bodyText}>{selected.content || "—"}</p>
              </div>
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Metadata</span>
                <div className={styles.kv}><span className={styles.kvKey}>Sumber</span><span className={styles.kvVal}>{selected.source || "—"}</span></div>
                <div className={styles.kv}><span className={styles.kvKey}>Penulis</span><span className={styles.kvVal}>{selected.author || "—"}</span></div>
                <div className={styles.kv}><span className={styles.kvKey}>Diajukan</span><span className={styles.kvVal}>{formatDate(selected.submitted_at) || "—"}</span></div>
                <div className={styles.kv}><span className={styles.kvKey}>Disetujui</span><span className={styles.kvVal}>{formatDate(selected.approved_at) || "—"}</span></div>
                <div className={styles.kv}><span className={styles.kvKey}>Tgl terbit</span><span className={styles.kvVal}>{formatDate(selected.published_at) || "—"}</span></div>
              </div>
            </div>

            {(isMaker || isChecker || canManage || ownPending) && (
              <div className={styles.detailFooter}>
                {ownPending && (
                  <span className={styles.muted} style={{ fontSize: "var(--fs-sm)", alignSelf: "center" }}>
                    Anda pengaju berita ini — persetujuan oleh pemeriksa lain.
                  </span>
                )}
                {isMaker && (
                  <Button variant="primary" icon="send" onClick={() => openSubmit(selected)} disabled={busy}>
                    Ajukan
                  </Button>
                )}
                {isChecker && (
                  <Button variant="primary" icon="check" onClick={() => doApprove(selected)} disabled={busy}>
                    Setujui
                  </Button>
                )}
                {isChecker && (
                  <Button
                    variant="danger"
                    icon="x"
                    onClick={() => {
                      setRejectNote("");
                      setRejectTarget(selected);
                    }}
                    disabled={busy}
                  >
                    Tolak
                  </Button>
                )}
                {canManage && ["draft", "rejected"].includes(selected.approval_status) && (
                  <Button variant="secondary" icon="pencil" onClick={() => setFormMode("edit")}>
                    Ubah
                  </Button>
                )}
                {canManage && (
                  <Button variant="ghost" icon="trash-2" onClick={() => setDeleteTarget(selected)}>
                    Hapus
                  </Button>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      <NewsFormModal open={formMode !== null} mode={formMode ?? "create"} news={formMode === "edit" ? selected : null} onClose={() => setFormMode(null)} onSaved={load} />

      {/* Modal pengajuan (maker) */}
      <Modal
        open={!!submitTarget}
        onOpenChange={(o) => !o && setSubmitTarget(null)}
        title="Ajukan Berita"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSubmitTarget(null)}>Batal</Button>
            <Button variant="primary" onClick={confirmSubmit} disabled={busy}>{busy ? "Mengajukan…" : "Ajukan"}</Button>
          </>
        }
      >
        <p className={styles.muted} style={{ marginTop: 0 }}>
          Pilih ruas (scope) berita. Berita akan masuk antrean persetujuan pemeriksa yang membawahi ruas tersebut.
        </p>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Ruas (scope)</label>
          <Select
            value={submitBranch}
            onValueChange={setSubmitBranch}
            options={scopeBranches.map((b) => ({ value: String(b.id), label: b.label }))}
            placeholder="Pilih ruas…"
          />
          {scopeBranches.length === 0 && <div className={styles.fieldError}>Tidak ada ruas dalam cakupan Anda.</div>}
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Catatan (opsional)</label>
          <textarea className={styles.textarea} value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} placeholder="Catatan untuk pemeriksa…" />
        </div>
      </Modal>

      {/* Modal penolakan (checker) */}
      <Modal
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        title="Tolak Berita"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmReject} disabled={busy}>{busy ? "Menolak…" : "Tolak"}</Button>
          </>
        }
      >
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Catatan penolakan *</label>
          <textarea
            className={styles.textarea}
            style={{ minHeight: 110 }}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Jelaskan alasan penolakan agar pembuat dapat merevisi…"
          />
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Hapus Berita"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={busy}>{busy ? "Menghapus…" : "Hapus"}</Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Hapus berita <b>{deleteTarget?.title}</b>?<br />
          <span className={styles.warn}>Berita disembunyikan dari aplikasi (soft delete).</span>
        </p>
      </Modal>
    </div>
  );
}
