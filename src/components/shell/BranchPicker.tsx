import { useMemo } from "react";
import { Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useBranch } from "@/context/BranchContext";

const ALL = "all";

/** Pemilih ruas aktif (global). "Semua Ruas" = tanpa filter. */
export function BranchPicker() {
  const { branches, activeBranchId, setActiveBranch } = useBranch();

  const options = useMemo<SelectOption[]>(
    () => [{ value: ALL, label: "Semua Ruas" }, ...branches.map((b) => ({ value: String(b.id), label: b.branch_name }))],
    [branches]
  );

  return (
    <Select
      icon="git-fork"
      ariaLabel="Pilih ruas aktif"
      value={activeBranchId == null ? ALL : String(activeBranchId)}
      onValueChange={(v) => setActiveBranch(v === ALL ? null : Number(v))}
      options={options}
    />
  );
}
