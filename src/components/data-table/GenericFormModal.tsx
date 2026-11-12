import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Select, Switch, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useBranch } from "@/context/BranchContext";
import { ApiError } from "@/lib/api";
import type { EntityConfig, FormField } from "./types";
import type { MasterRow } from "@/types/masterData";
import styles from "@/pages/modules.module.css";

type Values = Record<string, string>;

function emptyValues(fields: FormField[]): Values {
  const v: Values = {};
  for (const f of fields) v[f.name] = f.defaultValue ?? (f.type === "switch" ? "1" : "");
  return v;
}

function rowToValues(fields: FormField[], row: MasterRow): Values {
  const v: Values = {};
  for (const f of fields) {
    const raw = row[f.name];
    v[f.name] = raw === null || raw === undefined ? (f.type === "switch" ? "0" : "") : String(raw);
  }
  return v;
}

/** Bangun payload: hanya kirim field form; kosong → undefined; number/switch dikonversi. */
function toPayload(fields: FormField[], v: Values): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = v[f.name]?.trim?.() ?? v[f.name] ?? "";
    if (f.type === "switch") {
      out[f.name] = raw === "1" ? 1 : 0;
    } else if (raw === "") {
      out[f.name] = undefined;
    } else if (f.type === "number" || f.branch) {
      out[f.name] = Number(raw);
    } else {
      out[f.name] = raw;
    }
  }
  return out;
}

interface Props {
  config: EntityConfig;
  open: boolean;
  mode: "create" | "edit";
  row: MasterRow | null;
  onClose: () => void;
  onSaved: () => void;
  save: (body: Record<string, unknown>, id: number | string | null) => Promise<unknown>;
}

export function GenericFormModal({ config, open, mode, row, onClose, onSaved, save }: Props) {
  const toast = useToast();
  const { branches } = useBranch();
  const fields = config.formFields;
  const [v, setV] = useState<Values>(() => emptyValues(fields));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setV(mode === "edit" && row ? rowToValues(fields, row) : emptyValues(fields));
    setErr({});
  }, [open, mode, row, fields]);

  const branchOptions: SelectOption[] = useMemo(
    () => branches.map((b) => ({ value: String(b.id), label: b.branch_name || b.branch_code })),
    [branches]
  );

  function set(name: string, val: string) {
    setV((prev) => ({ ...prev, [name]: val }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && f.type !== "switch" && !(v[f.name] ?? "").trim()) {
        e[f.name] = `${f.label} wajib diisi.`;
      }
    }
    setErr(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const id = mode === "edit" && row ? (row[config.idKey ?? "id"] as number) : null;
      await save(toPayload(fields, v), id);
      toast.success(mode === "edit" ? `${config.title} diperbarui` : `${config.title} dibuat`);
      onSaved();
      onClose();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : undefined;
      toast.error("Gagal menyimpan", msg);
    } finally {
      setSaving(false);
    }
  }

  function renderField(f: FormField) {
    const options = f.branch ? branchOptions : f.options ?? [];
    return (
      <div className={styles.field} key={f.name}>
        <label className={styles.fieldLabel}>
          {f.label}
          {f.required && <span className={styles.warn}> *</span>}
        </label>
        {f.type === "textarea" ? (
          <textarea
            className={styles.textarea}
            value={v[f.name] ?? ""}
            onChange={(e) => set(f.name, e.target.value)}
            placeholder={f.placeholder}
          />
        ) : f.type === "switch" ? (
          <div className={styles.checkRow}>
            <Switch checked={v[f.name] === "1"} onCheckedChange={(c) => set(f.name, c ? "1" : "0")} ariaLabel={f.label} />
            <span>{v[f.name] === "1" ? "Aktif" : "Nonaktif"}</span>
          </div>
        ) : f.type === "select" || f.branch ? (
          <Select
            value={v[f.name] ?? ""}
            onValueChange={(val) => set(f.name, val)}
            options={options}
            placeholder={f.placeholder ?? "Pilih…"}
          />
        ) : (
          <Input
            type={f.type === "password" ? "password" : f.type === "number" ? "number" : "text"}
            value={v[f.name] ?? ""}
            onChange={(e) => set(f.name, e.target.value)}
            placeholder={f.placeholder}
            invalid={!!err[f.name]}
            autoComplete={f.type === "password" ? "new-password" : undefined}
          />
        )}
        {f.help && <div className={styles.fieldLabel} style={{ marginTop: 5, fontWeight: 400, textTransform: "none" }}>{f.help}</div>}
        {err[f.name] && <div className={styles.fieldError}>{err[f.name]}</div>}
      </div>
    );
  }

  // Kelompokkan field: `full` berdiri sendiri; sisanya berpasangan dua kolom.
  const groups: FormField[][] = [];
  let pair: FormField[] = [];
  for (const f of fields) {
    if (f.full || f.type === "textarea") {
      if (pair.length) { groups.push(pair); pair = []; }
      groups.push([f]);
    } else {
      pair.push(f);
      if (pair.length === 2) { groups.push(pair); pair = []; }
    }
  }
  if (pair.length) groups.push(pair);

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={mode === "edit" ? `Ubah ${config.title}` : `Tambah ${config.title}`}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
        </>
      }
    >
      {groups.map((g, i) =>
        g.length === 1 ? (
          renderField(g[0])
        ) : (
          <div className={styles.fieldRow} key={i}>{g.map(renderField)}</div>
        )
      )}
    </Modal>
  );
}
