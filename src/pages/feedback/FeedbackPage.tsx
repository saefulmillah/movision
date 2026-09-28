import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Input, Modal, Pagination, Select, StatusPill, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { formatDateTime } from "@/lib/format";
import {
  deleteFeedback,
  deleteReply,
  fetchFeedback,
  fetchFeedbackDetail,
  replyFeedback
} from "@/lib/feedback";
import type { FeedbackItem, UserRef } from "@/types/modules";
import styles from "../modules.module.css";

const COLS = "1.6fr 2fr 1fr 1fr";
const PER_PAGE = 12;

function userName(u: UserRef | null): string {
  if (!u) return "Anonim";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || `User #${u.id_user}`;
}

export function FeedbackPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const { branches } = useBranch();
  const canManage = hasPermission("feedback.manage");
  const canReply = hasPermission("feedback.reply");

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [branchFilter, setBranchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<FeedbackItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FeedbackItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFeedback({
        page,
        per_page: PER_PAGE,
        branch_id: branchFilter === "all" ? undefined : branchFilter,
        search: query || undefined
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e) {
      toast.error("Gagal memuat feedback", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, branchFilter, query, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [branchFilter, query]);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const d = await fetchFeedbackDetail(id);
      setDetail(d);
    } catch (e) {
      toast.error("Gagal memuat detail", e instanceof Error ? e.message : undefined);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedId) {
      setReplyText("");
      loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);
  const gridStyle = { gridTemplateColumns: COLS } as CSSProperties;
  const branchOptions: SelectOption[] = [
    { value: "all", label: "Semua ruas" },
    ...branches.map((b) => ({ value: String(b.id), label: b.branch_name || b.branch_code }))
  ];

  async function sendReply() {
    if (!detail || !replyText.trim()) return;
    setBusy(true);
    try {
      const updated = await replyFeedback(detail.id, replyText.trim());
      setDetail(updated);
      setReplyText("");
      toast.success("Balasan terkirim");
      load();
    } catch (e) {
      toast.error("Gagal membalas", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function removeReply(replyId: number) {
    if (!detail) return;
    setBusy(true);
    try {
      await deleteReply(detail.id, replyId);
      toast.success("Balasan dihapus");
      await loadDetail(detail.id);
      load();
    } catch (e) {
      toast.error("Gagal menghapus balasan", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteFeedback(deleteTarget.id);
      toast.success("Feedback dihapus");
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error("Gagal menghapus", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  const statusTone = (s: number) => (s === 1 ? "green" : "amber");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 600, margin: 0 }}>Feedback</h1>
        <span className={styles.headSpacer} />
        <Select className={styles.filter} value={branchFilter} onValueChange={setBranchFilter} options={branchOptions} icon="filter" ariaLabel="Ruas" />
        <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
          <Input wrapClassName={styles.search} icon="search" placeholder="Cari isi feedback…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>

      <div className={styles.body}>
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <div className={styles.table}>
              <div className={styles.thead} style={gridStyle}>
                <span>Pengirim / Kategori</span>
                <span>Feedback</span>
                <span>Status</span>
                <span>Waktu</span>
              </div>
              {loading && items.length === 0 ? (
                <EmptyState icon="message-square" title="Memuat feedback…" />
              ) : items.length === 0 ? (
                <EmptyState icon="message-square" title="Tidak ada feedback" description="Belum ada feedback yang cocok." />
              ) : (
                items.map((f) => (
                  <div key={f.id} className={styles.trow} style={gridStyle} data-selected={selectedId === f.id || undefined} onClick={() => setSelectedId(f.id)}>
                    <span style={{ minWidth: 0 }}>
                      <span className={styles.cellTitle}>{userName(f.user)}</span>
                      <span className={styles.cellSub}>{f.category?.name || "—"} · {f.branch?.branch_code || "—"}</span>
                    </span>
                    <span className={styles.cellText}>{f.message || "—"}</span>
                    <span><StatusPill label={f.status_label} tone={statusTone(f.status)} /></span>
                    <span className={styles.muted}>{formatDateTime(f.created_at) || "—"}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <Pagination page={page} pageCount={totalPages} from={from} to={to} total={total} onPage={setPage} unit="feedback" />
        </div>

        {detail && (
          <aside className={styles.detailPanel} key={detail.id}>
            <div className={styles.detailHead}>
              <span style={{ minWidth: 0 }}>
                <span className={styles.detailTitle}>{userName(detail.user)}</span>
                <span className={styles.cellSub}>{detail.user?.phone || detail.user?.email || ""}</span>
              </span>
            </div>
            <div className={styles.detailBody}>
              <div className={styles.chips}>
                <StatusPill label={detail.status_label} tone={statusTone(detail.status)} />
                {detail.category?.name && <span className={`${styles.chip} ${styles.chipMono}`}>{detail.category.name}</span>}
                {detail.branch?.branch_code && <span className={`${styles.chip} ${styles.chipMono}`}>{detail.branch.branch_code}</span>}
              </div>

              <div className={styles.section}>
                <span className={styles.sectionLabel}>Isi Feedback</span>
                <p className={styles.bodyText}>{detail.message || "—"}</p>
                {detail.image_url && <img className={styles.detailImage} src={detail.image_url} alt="" />}
                <span className={styles.mono}>{formatDateTime(detail.created_at)}</span>
              </div>

              <div className={styles.section}>
                <span className={styles.sectionLabel}>Balasan ({detail.replies?.length ?? 0})</span>
                <div className={styles.thread}>
                  {detail.replies && detail.replies.length > 0 ? (
                    detail.replies.map((r) => (
                      <div key={r.id} className={`${styles.bubble} ${r.role === "admin" ? styles.bubbleAdmin : styles.bubbleUser}`}>
                        <span>{r.message}</span>
                        <span className={styles.bubbleMeta}>
                          {r.role === "admin" ? "Admin" : userName(r.user)} · {formatDateTime(r.created_at)}
                        </span>
                        {canManage && r.role === "admin" && (
                          <span className={styles.bubbleActions}>
                            <button onClick={() => removeReply(r.id)} disabled={busy}>Hapus</button>
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className={styles.muted}>Belum ada balasan.</span>
                  )}
                </div>
              </div>

            </div>

            {canReply && (
              <div className={styles.replyBox}>
                <textarea className={styles.textarea} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Tulis balasan ke pengguna…" />
                <div className={styles.replyRow}>
                  <span />
                  <Button variant="primary" icon="send" onClick={sendReply} disabled={busy || !replyText.trim()}>Kirim</Button>
                  {canManage && <Button variant="danger" icon="trash-2" onClick={() => setDeleteTarget(detail)}>Hapus</Button>}
                </div>
              </div>
            )}
            {!canReply && canManage && (
              <div className={styles.detailFooter}>
                <Button variant="danger" icon="trash-2" onClick={() => setDeleteTarget(detail)}>Hapus Feedback</Button>
              </div>
            )}
          </aside>
        )}
      </div>

      <Modal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Hapus Feedback"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={busy}>{busy ? "Menghapus…" : "Hapus"}</Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          Hapus feedback dari <b>{userName(deleteTarget?.user ?? null)}</b>?<br />
          <span className={styles.warn}>Seluruh balasan ikut terhapus (soft delete).</span>
        </p>
      </Modal>
    </div>
  );
}
