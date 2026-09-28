import { useEffect, useState } from "react";
import { Button, Input, Modal, Switch, useToast } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { createUser, updateUser } from "@/lib/users";
import { ROLE_CATALOG } from "@/constants/rbac";
import type { Branch } from "@/types/monitoring";
import type { UserFormValues, UserRecord } from "@/types/users";
import styles from "./users.module.css";

interface UserFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  user: UserRecord | null;
  branches: Branch[];
  onClose: () => void;
  onSaved: () => void;
}

function toForm(u: UserRecord | null): UserFormValues {
  return {
    username: u?.username ?? "",
    password: "",
    full_name: u?.full_name ?? "",
    display_name: u?.display_name ?? "",
    email: u?.email ?? "",
    external_subject_id: u?.external_subject_id ?? "",
    role_codes: u?.roles ?? [],
    branch_ids: u?.branch_scopes?.map((b) => b.id) ?? [],
    is_active: u ? Number(u.is_active) === 1 : true
  };
}

export function UserFormModal({ open, mode, user, branches, onClose, onSaved }: UserFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<UserFormValues>(() => toForm(user));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(user));
      setErrors({});
    }
  }, [open, user]);

  const set = <K extends keyof UserFormValues>(k: K, v: UserFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleIn = (arr: (string | number)[], val: string | number) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  async function handleSubmit() {
    setErrors({});
    const errs: Record<string, string> = {};
    if (mode === "create" && !form.username.trim()) errs.username = "Wajib diisi";
    if (mode === "create" && !form.password) errs.password = "Wajib diisi";
    if (!form.full_name.trim()) errs.full_name = "Wajib diisi";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") await createUser(form);
      else if (user) await updateUser(user.id, form);
      toast.success(mode === "create" ? "Pengguna dibuat" : "Perubahan disimpan");
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // Coba petakan galat validasi server ke kolom.
        const payload = err.payload as Array<Record<string, unknown>> | null;
        const detail = Array.isArray(payload) ? payload[0] : null;
        if (detail && typeof detail === "object") {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(detail)) mapped[k] = String(Array.isArray(v) ? v.join(", ") : v);
          setErrors(mapped);
        }
        toast.error("Periksa kembali isian formulir");
      } else {
        toast.error("Gagal menyimpan", err instanceof Error ? err.message : undefined);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={mode === "create" ? "Tambah Pengguna" : "Ubah Pengguna"}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving} icon={saving ? "refresh-cw" : undefined}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Username {mode === "create" && "*"}</label>
        <Input
          value={form.username}
          onChange={(e) => set("username", e.target.value)}
          disabled={mode === "edit"}
          placeholder="operator"
          invalid={!!errors.username}
        />
        {errors.username && <div className={styles.fieldError}>{errors.username}</div>}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Kata Sandi {mode === "create" ? "*" : "(kosongkan bila tidak diganti)"}</label>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          placeholder="••••••••"
          invalid={!!errors.password}
        />
        {errors.password && <div className={styles.fieldError}>{errors.password}</div>}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Nama Lengkap *</label>
        <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} invalid={!!errors.full_name} />
        {errors.full_name && <div className={styles.fieldError}>{errors.full_name}</div>}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Nama Tampilan</label>
        <Input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Email</label>
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
        {errors.email && <div className={styles.fieldError}>{errors.email}</div>}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Role</label>
        <div className={styles.multi}>
          {ROLE_CATALOG.map((r) => (
            <button
              key={r.code}
              type="button"
              className={styles.multiChip}
              data-on={form.role_codes.includes(r.code) || undefined}
              onClick={() => set("role_codes", toggleIn(form.role_codes, r.code) as string[])}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Ruas (branch scope)</label>
        <div className={styles.multi}>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={styles.multiChip}
              data-on={form.branch_ids.includes(b.id) || undefined}
              onClick={() => set("branch_ids", toggleIn(form.branch_ids, b.id) as number[])}
            >
              {b.branch_code || b.branch_name}
            </button>
          ))}
        </div>
      </div>

      <div className={`${styles.field} ${styles.checkRow}`}>
        <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} ariaLabel="Status aktif" />
        Pengguna aktif
      </div>
    </Modal>
  );
}
