import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Icon, Input, Pagination, Select, StatusPill, useToast } from "@/components/ui";
import { Modal } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { backendAsset } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { deleteNews, fetchNews, newsCategoryLabel, setNewsPublish } from "@/lib/news";
import type { NewsItem } from "@/types/modules";
import { NewsFormModal } from "./NewsFormModal";
import styles from "../modules.module.css";

const COLS = "2.6fr 0.8fr 0.9fr 1fr";
const PER_PAGE = 12;

const STATUS_OPTIONS = [
  { value: "all", label: "Semua status" },
  { value: "1", label: "Terbit" },
  { value: "0", label: "Draft" }
];

export function NewsPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("news.manage");
  const canPublish = hasPermission("news.publish");

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchNews({
        page,
        per_page: PER_PAGE,
        status: status === "all" ? undefined : status,
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

  // Reset ke halaman 1 saat filter/pencarian berubah.
  useEffect(() => {
    setPage(1);
  }, [status, query]);

  const selected = useMemo(() => items.find((n) => n.id === selectedId) ?? null, [items, selectedId]);
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);
  const gridStyle = { gridTemplateColumns: COLS } as CSSProperties;

  async function togglePublish(item: NewsItem) {
    setBusy(true);
    try {
      await setNewsPublish(item.id, item.status === 1 ? 0 : 1);
      toast.success(item.status === 1 ? "Berita disembunyikan" : "Berita diterbitkan");
      await load();
    } catch (e) {
      toast.error("Gagal mengubah status", e instanceof Error ? e.message : undefined);
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
          <Input
            wrapClassName={styles.search}
            icon="search"
            placeholder="Cari judul / isi…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                <span>Terbit</span>
              </div>
              {loading && items.length === 0 ? (
                <EmptyState icon="newspaper" title="Memuat berita…" />
              ) : items.length === 0 ? (
                <EmptyState icon="newspaper" title="Tidak ada berita" description="Belum ada berita yang cocok." />
              ) : (
                items.map((n) => {
                  const img = backendAsset(n.image_url);
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
                        <StatusPill label={n.status === 1 ? "Terbit" : "Draft"} tone={n.status === 1 ? "green" : "gray"} />
                      </span>
                      <span className={styles.muted}>{formatDate(n.published_at) || "—"}</span>
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
                <StatusPill label={selected.status === 1 ? "Terbit" : "Draft"} tone={selected.status === 1 ? "green" : "gray"} />
                {selected.category !== null && <span className={`${styles.chip} ${styles.chipMono}`}>{newsCategoryLabel(selected.category)}</span>}
              </div>
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Isi</span>
                <p className={styles.bodyText}>{selected.content || "—"}</p>
              </div>
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Metadata</span>
                <div className={styles.kv}><span className={styles.kvKey}>Sumber</span><span className={styles.kvVal}>{selected.source || "—"}</span></div>
                <div className={styles.kv}><span className={styles.kvKey}>Penulis</span><span className={styles.kvVal}>{selected.author || "—"}</span></div>
                <div className={styles.kv}><span className={styles.kvKey}>Diposting oleh</span><span className={styles.kvVal}>{selected.posted_by || "—"}</span></div>
                <div className={styles.kv}><span className={styles.kvKey}>Tgl terbit</span><span className={styles.kvVal}>{formatDate(selected.published_at) || "—"}</span></div>
              </div>
            </div>
            {(canManage || canPublish) && (
              <div className={styles.detailFooter}>
                {canPublish && (
                  <Button variant="secondary" icon={selected.status === 1 ? "eye-off" : "eye"} onClick={() => togglePublish(selected)} disabled={busy}>
                    {selected.status === 1 ? "Sembunyikan" : "Terbitkan"}
                  </Button>
                )}
                {canManage && (
                  <Button variant="secondary" icon="pencil" onClick={() => setFormMode("edit")}>Ubah</Button>
                )}
                {canManage && (
                  <Button variant="danger" icon="trash-2" onClick={() => setDeleteTarget(selected)}>Hapus</Button>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      <NewsFormModal
        open={formMode !== null}
        mode={formMode ?? "create"}
        news={formMode === "edit" ? selected : null}
        onClose={() => setFormMode(null)}
        onSaved={load}
      />

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
