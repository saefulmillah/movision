import type { ReactNode } from "react";
import type { SelectOption } from "@/components/ui";
import type { MasterRow } from "@/types/masterData";

export type FieldType = "text" | "number" | "textarea" | "select" | "switch" | "password";

export interface FormField {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  /** Render BranchSelect (opsi dari useBranch); nilai = branch_id. */
  branch?: boolean;
  /** Teks bantuan kecil di bawah field. */
  help?: string;
  /** Nilai awal saat create (mis. switch "1"). */
  defaultValue?: string;
  /** Kolom penuh di grid form (default: setengah / mengisi fieldRow). */
  full?: boolean;
}

export interface ColumnDef {
  key: string;
  label: string;
  render?: (row: MasterRow) => ReactNode;
  /** Baris kedua kecil di bawah sel judul (mis. kode/branch). */
  sub?: (row: MasterRow) => ReactNode;
  mono?: boolean;
  align?: "start" | "end";
}

export interface EntityConfig {
  /** Kunci unik (untuk key React & judul). */
  key: string;
  title: string;
  subtitle?: string;
  icon?: string;
  endpoint: string;
  moduleCode: string;
  /** "array" (default) = fetch semua + paginasi klien; "camera" = paginasi server kamera. */
  shape?: "array" | "camera";
  idKey?: string;
  /** grid-template-columns untuk thead/trow. */
  gridCols: string;
  columns: ColumnDef[];
  formFields: FormField[];
  /** Tampilkan filter Ruas (branch_id). */
  branchFilter?: boolean;
  /** Aktifkan kotak cari (filter klien untuk "array", param `q` untuk kamera). */
  searchable?: boolean;
  /** Tulis/hapus hanya super_admin (mis. `ruas`). */
  superAdminWrite?: boolean;
  /** Field yang dijadikan judul baris & header panel detail. */
  titleKey: string;
  /** Catatan kecil di atas tabel (mis. peringatan password). */
  note?: string;
}
