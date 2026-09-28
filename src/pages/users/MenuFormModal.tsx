import { useEffect, useState } from "react";
import { Button, Input, Modal, Select, Switch, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { createMenu, updateMenu } from "@/lib/users";
import { ACCESS_LEVELS, MODULE_CODES, PERMISSION_CODES } from "@/constants/rbac";
import type { AdminMenu } from "@/types/users";
import styles from "./users.module.css";

type GateType = "none" | "module" | "permission";

interface MenuFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  menu: AdminMenu | null;
  menus: AdminMenu[];
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  menu_code: string;
  menu_name: string;
  icon: string;
  route_path: string;
  isCategory: boolean;
  parent_id: string;
  gate: GateType;
  module_code: string;
  required_access_level: string;
  permission_code: string;
  display_order: string;
  is_active: boolean;
}

function toForm(m: AdminMenu | null): FormState {
  const gate: GateType = m?.module_code ? "module" : m?.permission_code ? "permission" : "none";
  return {
    menu_code: m?.menu_code ?? "",
    menu_name: m?.menu_name ?? "",
    icon: m?.icon ?? "",
    route_path: m?.route_path ?? "",
    isCategory: m ? m.parent_id === null : true,
    parent_id: m?.parent_id != null ? String(m.parent_id) : "",
    gate,
    module_code: m?.module_code ?? MODULE_CODES[0],
    required_access_level: m?.required_access_level && m.required_access_level !== "none" ? m.required_access_level : "read",
    permission_code: m?.permission_code ?? PERMISSION_CODES[0],
    display_order: String(m?.display_order ?? 10),
    is_active: m ? Number(m.is_active) === 1 : true
  };
}

const opt = (v: string): SelectOption => ({ value: v, label: v });

export function MenuFormModal({ open, mode, menu, menus, onClose, onSaved }: MenuFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => toForm(menu));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(menu));
      setErrors({});
    }
  }, [open, menu]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const categoryOptions: SelectOption[] = menus
    .filter((m) => m.parent_id === null && m.id !== menu?.id)
    .map((m) => ({ value: String(m.id), label: m.menu_name }));

  async function handleSubmit() {
    setErrors({});
    const errs: Record<string, string> = {};
    if (!form.menu_code.trim()) errs.menu_code = "Wajib diisi";
    else if (!/^[a-z0-9_]+$/.test(form.menu_code)) errs.menu_code = "Hanya huruf kecil, angka, dan garis bawah";
    if (!form.menu_name.trim()) errs.menu_name = "Wajib diisi";
    if (!form.isCategory && !form.parent_id) errs.parent_id = "Pilih menu induk";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const body: Partial<AdminMenu> = {
      menu_code: form.menu_code,
      menu_name: form.menu_name,
      icon: form.icon || null,
      route_path: form.route_path || null,
      parent_id: form.isCategory ? null : Number(form.parent_id),
      display_order: Number(form.display_order) || 0,
      module_code: form.gate === "module" ? form.module_code : null,
      permission_code: form.gate === "permission" ? form.permission_code : null,
      required_access_level: form.gate === "module" ? form.required_access_level : "none",
      is_active: form.is_active ? 1 : 0
    };

    setSaving(true);
    try {
      if (mode === "create") await createMenu(body);
      else if (menu) await updateMenu(menu.id, body);
      toast.success(mode === "create" ? "Menu dibuat" : "Menu diperbarui");
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) toast.error("Gagal menyimpan menu", err.message);
      else toast.error("Gagal menyimpan menu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={mode === "create" ? "Tambah Menu" : "Ubah Menu"}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Nama Menu *</label>
        <Input value={form.menu_name} onChange={(e) => set("menu_name", e.target.value)} invalid={!!errors.menu_name} />
        {errors.menu_name && <div className={styles.fieldError}>{errors.menu_name}</div>}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Kode Menu *</label>
        <Input value={form.menu_code} onChange={(e) => set("menu_code", e.target.value)} disabled={mode === "edit"} placeholder="mis. master_kamera" invalid={!!errors.menu_code} />
        {errors.menu_code && <div className={styles.fieldError}>{errors.menu_code}</div>}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Tipe</label>
        <Select
          value={form.isCategory ? "category" : "submenu"}
          onValueChange={(v) => set("isCategory", v === "category")}
          options={[{ value: "category", label: "Kategori" }, { value: "submenu", label: "Submenu" }]}
        />
      </div>

      {!form.isCategory && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Menu Induk *</label>
          <Select value={form.parent_id} onValueChange={(v) => set("parent_id", v)} options={categoryOptions} placeholder="Pilih kategori induk" />
          {errors.parent_id && <div className={styles.fieldError}>{errors.parent_id}</div>}
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Route Path</label>
        <Input value={form.route_path} onChange={(e) => set("route_path", e.target.value)} placeholder="/admin/…" />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Ikon (Lucide)</label>
        <Input value={form.icon} onChange={(e) => set("icon", e.target.value)} placeholder="mis. camera" />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Hak Akses (Gate)</label>
        <Select
          value={form.gate}
          onValueChange={(v) => set("gate", v as GateType)}
          options={[
            { value: "none", label: "Tanpa batasan" },
            { value: "module", label: "Module access" },
            { value: "permission", label: "Permission" }
          ]}
        />
      </div>

      {form.gate === "module" && (
        <div style={{ display: "flex", gap: 10 }}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Module</label>
            <Select value={form.module_code} onValueChange={(v) => set("module_code", v)} options={MODULE_CODES.map(opt)} />
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Level</label>
            <Select value={form.required_access_level} onValueChange={(v) => set("required_access_level", v)} options={ACCESS_LEVELS.filter((l) => l !== "none").map(opt)} />
          </div>
        </div>
      )}

      {form.gate === "permission" && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Permission</label>
          <Select value={form.permission_code} onValueChange={(v) => set("permission_code", v)} options={PERMISSION_CODES.map(opt)} />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div className={styles.field} style={{ flex: 1 }}>
          <label className={styles.fieldLabel}>Urutan</label>
          <Input type="number" value={form.display_order} onChange={(e) => set("display_order", e.target.value)} />
        </div>
        <div className={`${styles.field} ${styles.checkRow}`} style={{ flex: 1 }}>
          <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} ariaLabel="Aktif" />
          Aktif
        </div>
      </div>
    </Modal>
  );
}
