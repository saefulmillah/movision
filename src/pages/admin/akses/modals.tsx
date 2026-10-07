import { useEffect, useState } from "react";
import { Button, Icon, Modal, useToast } from "@/components/ui";
import {
  createModule,
  createPermission,
  createRole,
  updateModule,
  updatePermission
} from "@/lib/access";
import type { AccessModule, Permission, Role } from "@/types/access";
import { CODE_PATTERN } from "./constants";
import styles from "./Akses.module.css";

/* ---------------- Buat Role ---------------- */
export function CreateRoleModal({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (role: Role) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setDesc("");
    }
  }, [open]);

  const codeEmpty = !code;
  const codeOk = CODE_PATTERN.test(code);
  const canSubmit = !!name.trim() && codeOk;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const role = await createRole({ role_code: code, role_name: name.trim(), description: desc.trim() || undefined });
      toast.success("Role dibuat", `${role.role_name} siap diatur aksesnya.`);
      onOpenChange(false);
      onCreated(role);
    } catch (err) {
      toast.error("Gagal membuat role", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Buat Role Baru"
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" disabled={!canSubmit || saving} onClick={() => void submit()}>
            {saving ? "Menyimpan…" : "Buat & Atur Akses"}
          </Button>
        </>
      }
    >
      <div className={styles.formCol}>
        <div>
          <label className={styles.fieldLabel}>Nama Role *</label>
          <input className={styles.input} value={name} placeholder="mis. Operator Gerbang" onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={styles.fieldLabel}>Kode *</label>
          <input
            className={styles.input}
            style={{
              fontFamily: "var(--font-mono)",
              borderColor: codeEmpty ? undefined : codeOk ? "var(--st-green)" : "var(--sem-red)"
            }}
            value={code}
            placeholder="operator_gerbang"
            onChange={(e) => setCode(e.target.value)}
          />
          <div className={`${styles.hint} ${codeEmpty ? styles.hintNeutral : codeOk ? styles.hintOk : styles.hintErr}`}>
            {codeEmpty
              ? "Pola: huruf kecil, angka, titik, garis bawah. Contoh: operator_gerbang"
              : codeOk
                ? "Kode valid."
                : "Hanya a–z, 0–9, titik, dan garis bawah."}
          </div>
        </div>
        <div>
          <label className={styles.fieldLabel}>Deskripsi</label>
          <textarea className={styles.textarea} value={desc} placeholder="Jelaskan singkat tujuan role ini" onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className={styles.infoNote}>
          <Icon name="info" size={14} />
          Kode bersifat permanen. Setelah dibuat, Anda hanya bisa mengubah nama dan deskripsi.
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Permission form ---------------- */
export function PermissionFormModal({
  open,
  onOpenChange,
  editing,
  onSaved
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Permission | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!editing;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCode(editing?.permission_code ?? "");
      setName(editing?.permission_name ?? "");
      setGroup(editing?.permission_group ?? "");
      setDesc(editing?.description ?? "");
    }
  }, [open, editing]);

  const codeOk = isEdit || CODE_PATTERN.test(code);
  const canSubmit = !!name.trim() && codeOk;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updatePermission(editing!.id, {
          permission_name: name.trim(),
          description: desc.trim() || undefined,
          permission_group: group.trim() || undefined
        });
      } else {
        await createPermission({
          permission_code: code,
          permission_name: name.trim(),
          description: desc.trim() || undefined,
          permission_group: group.trim() || undefined
        });
      }
      toast.success(isEdit ? "Permission diperbarui" : "Permission dibuat", name.trim());
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error("Gagal menyimpan", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Ubah Permission" : "Tambah Permission"}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" disabled={!canSubmit || saving} onClick={() => void submit()}>
            {saving ? "Menyimpan…" : isEdit ? "Simpan" : "Tambah"}
          </Button>
        </>
      }
    >
      <div className={styles.formCol}>
        <div>
          <label className={styles.fieldLabel}>
            Kode * {isEdit && <Icon name="lock" size={12} />}
          </label>
          <input
            className={`${styles.input} ${isEdit ? styles.inputLocked : ""}`}
            style={{ fontFamily: "var(--font-mono)" }}
            value={code}
            disabled={isEdit}
            placeholder="camera.export"
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className={styles.fieldLabel}>Nama *</label>
          <input className={styles.input} value={name} placeholder="Ekspor rekaman kamera" onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={styles.fieldLabel}>Grup</label>
          <input className={styles.input} value={group} placeholder="camera" onChange={(e) => setGroup(e.target.value)} />
        </div>
        <div>
          <label className={styles.fieldLabel}>Deskripsi</label>
          <textarea className={styles.textarea} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Module form ---------------- */
export function ModuleFormModal({
  open,
  onOpenChange,
  editing,
  onSaved
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: AccessModule | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!editing;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [order, setOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCode(editing?.module_code ?? "");
      setName(editing?.module_name ?? "");
      setGroup(editing?.module_group ?? "");
      setOrder(String(editing?.display_order ?? 0));
      setActive(editing?.is_active ?? true);
    }
  }, [open, editing]);

  const codeOk = isEdit || CODE_PATTERN.test(code);
  const canSubmit = !!name.trim() && codeOk;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const displayOrder = Number(order) || 0;
      if (isEdit) {
        await updateModule(editing!.id, {
          module_name: name.trim(),
          module_group: group.trim() || undefined,
          display_order: displayOrder,
          is_active: active ? 1 : 0
        });
      } else {
        await createModule({
          module_code: code,
          module_name: name.trim(),
          module_group: group.trim() || undefined,
          display_order: displayOrder,
          is_active: active ? 1 : 0
        });
      }
      toast.success(isEdit ? "Modul diperbarui" : "Modul dibuat", name.trim());
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error("Gagal menyimpan", err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Ubah Modul" : "Tambah Modul"}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" disabled={!canSubmit || saving} onClick={() => void submit()}>
            {saving ? "Menyimpan…" : isEdit ? "Simpan" : "Tambah"}
          </Button>
        </>
      }
    >
      <div className={styles.formCol}>
        <div>
          <label className={styles.fieldLabel}>
            Kode * {isEdit && <Icon name="lock" size={12} />}
          </label>
          <input
            className={`${styles.input} ${isEdit ? styles.inputLocked : ""}`}
            style={{ fontFamily: "var(--font-mono)" }}
            value={code}
            disabled={isEdit}
            placeholder="laporan_khusus"
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className={styles.fieldLabel}>Nama *</label>
          <input className={styles.input} value={name} placeholder="Laporan Khusus" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={styles.infoGrid}>
          <div>
            <label className={styles.fieldLabel}>Grup</label>
            <input className={styles.input} value={group} placeholder="Master Data" onChange={(e) => setGroup(e.target.value)} />
          </div>
          <div>
            <label className={styles.fieldLabel}>Urutan</label>
            <input
              className={styles.input}
              style={{ fontFamily: "var(--font-mono)" }}
              value={order}
              inputMode="numeric"
              onChange={(e) => setOrder(e.target.value.replace(/[^\d-]/g, ""))}
            />
          </div>
        </div>
        <div className={styles.toggleRow}>
          <button type="button" className={`${styles.toggle} ${active ? styles.toggleOn : ""}`} onClick={() => setActive((v) => !v)}>
            <span className={`${styles.toggleThumb} ${active ? styles.toggleThumbOn : ""}`} />
          </button>
          Modul aktif
        </div>
        <div className={styles.infoNote}>
          <Icon name="info" size={14} />
          Modul baru hanya terdaftar. Hubungkan ke menu &amp; beri level akses pada role agar aktif.
        </div>
      </div>
    </Modal>
  );
}
