import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Input, Modal, StatusPill, useToast } from "@/components/ui";
import { createIncidentType, deleteIncidentType, fetchIncidentTypes, updateIncidentType } from "@/lib/incident";
import type { IncidentType } from "@/types/modules";
import styles from "../modules.module.css";

const COLS = "2fr 0.8fr 0.8fr";

interface Props {
  canManage: boolean;
  openCreate: boolean;
  onCreateHandled: () => void;
}

export function IncidentTypesTab({ canManage, openCreate, onCreateHandled }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<IncidentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{ mode: "create" | "edit"; row: IncidentType | null } | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IncidentType | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await fetchIncidentTypes());
    } catch (e) {
      toast.error("Gagal memuat jenis", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (openCreate) {
      setForm({ mode: "create", row: null });
      setName("");
      setCode("");
      onCreateHandled();
    }
  }, [openCreate, onCreateHandled]);

  function openEdit(row: IncidentType) {
    setForm({ mode: "edit", row });
    setName(row.incident_name ?? "");
    setCode(row.incident_code ?? "");
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Nama jenis wajib diisi");
      return;
    }
    setBusy(true);
    try {
      if (form?.mode === "edit" && form.row) {
        await updateIncidentType(form.row.id, { incident_name: name.trim(), incident_code: code.trim() });
        toast.success("Jenis diperbarui");
      } else {
        await createIncidentType({ incident_name: name.trim(), incident_code: code.trim() || undefined });
        toast.success("Jenis dibuat");
      }
      setForm(null);
      await load();
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteIncidentType(deleteTarget.id);
      toast.success("Jenis dihapus");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error("Gagal menghapus", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  const gridStyle = { gridTemplateColumns: COLS } as CSSProperties;

  return (
    <div className={styles.body}>
      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <div className={styles.table}>
            <div className={styles.thead} style={gridStyle}>
              <span>Nama Jenis</span>
              <span>Kode</span>
              <span>Aksi</span>
            </div>
            {loading && rows.length === 0 ? (
              <EmptyState icon="triangle-alert" title="Memuat…" />
            ) : rows.length === 0 ? (
              <EmptyState icon="triangle-alert" title="Belum ada jenis incident" />
            ) : (
              rows.map((t) => (
                <div key={t.id} className={styles.trow} style={gridStyle}>
                  <span className={styles.cellTitle}>{t.incident_name}</span>
                  <span><StatusPill label={t.incident_code || "—"} tone="blue" /></span>
                  <span className={styles.chips}>
                    {canManage ? (
                      <>
                        <Button size="sm" variant="ghost" icon="pencil" onClick={() => openEdit(t)}>Ubah</Button>
                        <Button size="sm" variant="ghost" icon="trash-2" onClick={() => setDeleteTarget(t)}>Hapus</Button>
                      </>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal
        open={form !== null}
        onOpenChange={(o) => !o && setForm(null)}
        title={form?.mode === "edit" ? "Ubah Jenis Incident" : "Tambah Jenis Incident"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>Batal</Button>
            <Button variant="primary" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button>
          </>
        }
      >
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Nama Jenis</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Arus Lalu Lintas" />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Kode (maks 3 huruf)</label>
          <Input value={code} maxLength={3} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="mis. ALL" />
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Hapus Jenis Incident"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={busy}>{busy ? "Menghapus…" : "Hapus"}</Button>
          </>
        }
      >
        <p className={styles.confirmText}>Hapus jenis <b>{deleteTarget?.incident_name}</b>?</p>
      </Modal>
    </div>
  );
}
