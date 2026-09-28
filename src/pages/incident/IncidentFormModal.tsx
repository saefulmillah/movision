import { useEffect, useState } from "react";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useBranch } from "@/context/BranchContext";
import { createIncident, updateIncident } from "@/lib/incident";
import type { IncidentFormValues, IncidentItem, IncidentType } from "@/types/modules";
import styles from "../modules.module.css";

const EMPTY: IncidentFormValues = {
  incident_type_id: "",
  incident_detail: "",
  incident_name: "",
  incident_command: "",
  branch_id: "",
  status: "1",
  handling: "",
  km: "",
  lane: "",
  jalur: "",
  latitude: "",
  longitude: ""
};

export const INCIDENT_STATUS: SelectOption[] = [
  { value: "1", label: "Aktif" },
  { value: "2", label: "Selesai" }
];

export function incidentStatusLabel(status: number | null): string {
  if (status === null) return "—";
  return INCIDENT_STATUS.find((s) => s.value === String(status))?.label ?? `Status ${status}`;
}

interface Props {
  open: boolean;
  mode: "create" | "edit";
  incident: IncidentItem | null;
  types: IncidentType[];
  onClose: () => void;
  onSaved: () => void;
}

export function IncidentFormModal({ open, mode, incident, types, onClose, onSaved }: Props) {
  const toast = useToast();
  const { branches } = useBranch();
  const [v, setV] = useState<IncidentFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && incident) {
      setV({
        incident_type_id: incident.incident_type_id ? String(incident.incident_type_id) : "",
        incident_detail: incident.incident_detail ?? "",
        incident_name: incident.incident_name ?? "",
        incident_command: incident.incident_command ?? "",
        branch_id: incident.branch_id ? String(incident.branch_id) : "",
        status: incident.status !== null ? String(incident.status) : "1",
        handling: incident.handling ?? "",
        km: incident.km ?? "",
        lane: incident.lane ?? "",
        jalur: incident.jalur ?? "",
        latitude: incident.latitude ?? "",
        longitude: incident.longitude ?? ""
      });
    } else {
      setV(EMPTY);
    }
    setErr({});
  }, [open, mode, incident]);

  function set<K extends keyof IncidentFormValues>(k: K, val: IncidentFormValues[K]) {
    setV((prev) => ({ ...prev, [k]: val }));
  }

  // Catatan: Radix Select.Item tidak boleh bernilai "" — opsi "kosong"
  // diwakili oleh placeholder (tampil saat value === "").
  const typeOptions: SelectOption[] = types.map((t) => ({
    value: String(t.id),
    label: `${t.incident_name}${t.incident_code ? ` (${t.incident_code})` : ""}`
  }));
  const branchOptions: SelectOption[] = branches.map((b) => ({ value: String(b.id), label: b.branch_name || b.branch_code }));

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!v.incident_type_id) e.incident_type_id = "Jenis incident wajib dipilih.";
    if (!v.incident_detail.trim()) e.incident_detail = "Detail incident wajib diisi.";
    setErr(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (mode === "edit" && incident) {
        await updateIncident(incident.id, v);
        toast.success("Incident diperbarui");
      } else {
        await createIncident(v);
        toast.success("Incident dibuat");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Gagal menyimpan", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={mode === "edit" ? "Ubah Incident" : "Tambah Incident"}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
        </>
      }
    >
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Jenis Incident</label>
          <Select value={v.incident_type_id} onValueChange={(val) => set("incident_type_id", val)} options={typeOptions} placeholder="Pilih jenis…" />
          {err.incident_type_id && <div className={styles.fieldError}>{err.incident_type_id}</div>}
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Ruas</label>
          <Select value={v.branch_id} onValueChange={(val) => set("branch_id", val)} options={branchOptions} placeholder="Tanpa ruas" />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Detail Incident</label>
        <textarea className={styles.textarea} value={v.incident_detail} onChange={(e) => set("incident_detail", e.target.value)} placeholder="Kronologi / detail…" />
        {err.incident_detail && <div className={styles.fieldError}>{err.incident_detail}</div>}
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Judul / Nama</label>
          <Input value={v.incident_name} onChange={(e) => set("incident_name", e.target.value)} placeholder="mis. #InfoLaluLintasHK" />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Status</label>
          <Select value={v.status} onValueChange={(val) => set("status", val)} options={INCIDENT_STATUS} />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Perintah / Himbauan</label>
        <Input value={v.incident_command} onChange={(e) => set("incident_command", e.target.value)} placeholder="mis. AGAR JAGA JARAK AMAN" />
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>KM</label>
          <Input value={v.km} onChange={(e) => set("km", e.target.value)} placeholder="mis. 12+300" />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Lajur</label>
          <Input value={v.lane} onChange={(e) => set("lane", e.target.value)} placeholder="mis. L1" />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Jalur</label>
          <Input value={v.jalur} onChange={(e) => set("jalur", e.target.value)} placeholder="A/B" maxLength={1} />
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Latitude</label>
          <Input value={v.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="-6.xxxx" />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Longitude</label>
          <Input value={v.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="106.xxxx" />
        </div>
      </div>
    </Modal>
  );
}
