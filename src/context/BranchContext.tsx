import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchBranches } from "@/lib/monitoring";
import type { Branch } from "@/types/monitoring";

interface BranchContextValue {
  branches: Branch[];
  /** null = Semua Ruas */
  activeBranchId: number | null;
  activeBranch: Branch | null;
  setActiveBranch: (id: number | null) => void;
  loading: boolean;
}

const BranchContext = createContext<BranchContextValue | null>(null);

const STORAGE_KEY = "tollsentra.activeBranch";

/** Ruas aktif global (handoff §State global). Mengubahnya memicu refetch pada
 *  layar yang bergantung (Peta, CCTV, SOS) lewat pembacaan activeBranchId. */
export function BranchProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && raw !== "null" ? Number(raw) : null;
  });

  useEffect(() => {
    let alive = true;
    if (status !== "authenticated") {
      setBranches([]);
      setLoading(false);
      return;
    }
    fetchBranches()
      .then((rows) => {
        if (alive) setBranches(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        /* biarkan kosong */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [status]);

  const setActiveBranch = (id: number | null) => {
    setActiveBranchId(id);
    localStorage.setItem(STORAGE_KEY, id === null ? "null" : String(id));
  };

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) ?? null,
    [branches, activeBranchId]
  );

  const value = useMemo<BranchContextValue>(
    () => ({ branches, activeBranchId, activeBranch, setActiveBranch, loading }),
    [branches, activeBranchId, activeBranch, loading]
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch harus dipakai di dalam BranchProvider");
  return ctx;
}
