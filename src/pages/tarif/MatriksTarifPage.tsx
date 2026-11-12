import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Input, Modal, Pagination, Select, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useModuleAccess } from "@/lib/useModuleAccess";
import { GOLONGAN, GOLONGAN_LABEL, getTariffGrid, listTariffBranches, listTariffMatrix } from "@/lib/tariff";
import type { TariffBranch, TariffGrid, TariffMeta, TariffRow } from "@/types/tariff";
import { UploadTarifWizard } from "./UploadTarifWizard";
import mstyles from "@/pages/modules.module.css";
import styles from "./tarif.module.css";

const COLS = "1.5fr 1.5fr 0.9fr 1fr 0.9fr";
const PER_PAGE = 50;

function rupiah(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `Rp ${n.toLocaleString("id-ID")}`;
}

const GOL_OPTIONS_ALL: SelectOption[] = [{ value: "all", label: "Semua golongan" }, ...GOLONGAN.map((g) => ({ value: String(g), label: GOLONGAN_LABEL[g] }))];
const GOL_OPTIONS: SelectOption[] = GOLONGAN.map((g) => ({ value: String(g), label: GOLONGAN_LABEL[g] }));
const OPEN_OPTIONS: SelectOption[] = [
  { value: "all", label: "Semua tipe" },
  { value: "1", label: "Terbuka" },
  { value: "0", label: "Tertutup" }
];

export function MatriksTarifPage() {
  const toast = useToast();
  const access = useModuleAccess("tariff");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mode, setMode] = useState<"table" | "grid">("table");
  const [branches, setBranches] = useState<TariffBranch[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [golId, setGolId] = useState("all");
  const [isOpen, setIsOpen] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [rows, setRows] = useState<TariffRow[]>([]);
  const [meta, setMeta] = useState<TariffMeta>({ page: 1, limit: PER_PAGE, total: 0, total_page: 0 });
  const [page, setPage] = useState(1);
  const [grid, setGrid] = useState<TariffGrid | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listTariffBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  // Golongan efektif untuk grid (grid butuh golongan spesifik).
  const effectiveGol = golId === "all" ? "1" : golId;

  const loadTable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTariffMatrix({
        branch_id: branchId === "all" ? undefined : branchId,
        gol_id: golId === "all" ? undefined : golId,
        is_open: isOpen === "all" ? undefined : isOpen,
        search: query || undefined,
        page,
        limit: PER_PAGE
      });
      setRows(res.items);
      setMeta(res.meta);
    } catch (e) {
      toast.error("Gagal memuat tarif", e instanceof Error ? e.message : undefined);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, golId, isOpen, query, page, toast]);

  const loadGrid = useCallback(async () => {
    if (branchId === "all") { setGrid(null); return; }
    setLoading(true);
    try {
      const res = await getTariffGrid({ branch_id: Number(branchId), gol_id: Number(effectiveGol), is_open: isOpen === "all" ? undefined : isOpen });
      setGrid(res);
    } catch (e) {
      toast.error("Gagal memuat grid tarif", e instanceof Error ? e.message : undefined);
      setGrid(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, effectiveGol, isOpen, toast]);

  useEffect(() => {
    if (mode === "table") void loadTable();
    else void loadGrid();
  }, [mode, loadTable, loadGrid]);

  useEffect(() => { setPage(1); }, [branchId, golId, isOpen, query]);

  const branchOptions: SelectOption[] = [
    { value: "all", label: "Semua ruas" },
    ...branches.map((b) => ({ value: String(b.id), label: b.branch_name || b.branch_code || `#${b.id}` }))
  ];

  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const gridStyle = { gridTemplateColumns: COLS } as CSSProperties;

  const golOptions = mode === "grid" ? GOL_OPTIONS : GOL_OPTIONS_ALL;
  const gridGolLabel = useMemo(() => GOLONGAN_LABEL[Number(effectiveGol)] ?? "", [effectiveGol]);

  return (
    <div className={mstyles.page}>
      <div className={mstyles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <strong style={{ fontSize: "var(--fs-md)" }}>Matriks Tarif</strong>
          <span className={mstyles.muted} style={{ fontSize: "var(--fs-xs)" }}>Tarif antar gerbang per golongan.</span>
        </div>
        <span className={mstyles.headSpacer} />
        <div className={styles.segmented} role="tablist" aria-label="Mode tampilan">
          <button type="button" className={styles.segBtn} data-active={mode === "table"} onClick={() => setMode("table")} role="tab" aria-selected={mode === "table"}>Tabel</button>
          <button type="button" className={styles.segBtn} data-active={mode === "grid"} onClick={() => setMode("grid")} role="tab" aria-selected={mode === "grid"}>Grid</button>
        </div>
        <Select className={mstyles.filter} value={branchId} onValueChange={setBranchId} options={branchOptions} icon="map-pin" ariaLabel="Ruas" />
        <Select className={mstyles.filter} value={mode === "grid" && golId === "all" ? "1" : golId} onValueChange={setGolId} options={golOptions} ariaLabel="Golongan" />
        <Select className={mstyles.filter} value={isOpen} onValueChange={setIsOpen} options={OPEN_OPTIONS} ariaLabel="Tipe" />
        {mode === "table" && (
          <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
            <Input wrapClassName={mstyles.search} icon="search" placeholder="Cari gerbang…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
        )}
        <Button variant="secondary" icon="rotate-cw" onClick={() => (mode === "table" ? void loadTable() : void loadGrid())} disabled={loading}>Muat Ulang</Button>
        {access.canWrite && (
          <Button variant="primary" icon="upload" onClick={() => setUploadOpen(true)}>Upload Tarif</Button>
        )}
      </div>

      {mode === "table" ? (
        <div className={mstyles.body}>
          <div className={mstyles.tableCard}>
            <div className={mstyles.tableScroll}>
              <div className={mstyles.table}>
                <div className={mstyles.thead} style={gridStyle}>
                  <span>Gerbang Asal</span>
                  <span>Gerbang Tujuan</span>
                  <span>Golongan</span>
                  <span style={{ textAlign: "right" }}>Tarif</span>
                  <span>Tipe</span>
                </div>
                {loading && rows.length === 0 ? (
                  <EmptyState icon="table" title="Memuat tarif…" />
                ) : rows.length === 0 ? (
                  <EmptyState icon="table" title="Tidak ada tarif" description="Belum ada tarif yang cocok dengan filter." />
                ) : (
                  rows.map((r) => (
                    <div key={r.id} className={mstyles.trow} style={gridStyle}>
                      <span style={{ minWidth: 0 }}>
                        <span className={mstyles.cellTitle}>{r.origin_gate_name || "—"}</span>
                        <span className={mstyles.cellSub}>{r.origin_gate_code || ""}</span>
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className={mstyles.cellTitle}>{r.destination_gate_name || "—"}</span>
                        <span className={mstyles.cellSub}>{r.destination_gate_code || ""}</span>
                      </span>
                      <span className={mstyles.muted}>{GOLONGAN_LABEL[r.gol_id] ?? r.gol_id}</span>
                      <span className={styles.amount} style={{ textAlign: "right" }}>{rupiah(r.tariff_amount)}</span>
                      <span>
                        <span className={`${styles.badge} ${r.is_open === 1 ? styles.badgeOpen : styles.badgeClosed}`}>{r.is_open === 1 ? "Terbuka" : "Tertutup"}</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <Pagination page={meta.page} pageCount={Math.max(1, meta.total_page)} from={from} to={to} total={meta.total} onPage={setPage} unit="tarif" />
          </div>
        </div>
      ) : branchId === "all" ? (
        <div className={mstyles.body}>
          <EmptyState icon="grid-3x3" title="Pilih ruas" description="Mode grid menampilkan matriks per ruas. Pilih satu ruas untuk melihat pivot gerbang asal × tujuan." />
        </div>
      ) : (
        <div className={mstyles.body}>
          <div className={styles.gridWrap}>
            {loading && !grid ? (
              <div className={styles.gridHint}>Memuat grid…</div>
            ) : !grid || grid.gates.length === 0 ? (
              <div className={styles.gridHint}>Tidak ada gerbang pada ruas ini.</div>
            ) : (
              <table className={styles.pivot}>
                <thead>
                  <tr>
                    <th className="corner">{gridGolLabel} · Asal \\ Tujuan</th>
                    {grid.gates.map((d) => (
                      <th key={d.id} title={d.gate_name || undefined}>{d.gate_code || d.gate_name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.gates.map((o) => (
                    <tr key={o.id}>
                      <td className="rowhead" title={o.gate_name || undefined}>{o.gate_name || o.gate_code}</td>
                      {grid.gates.map((d) => {
                        const v = grid.cells[`${o.id}_${d.id}`];
                        const diag = o.id === d.id;
                        return (
                          <td key={d.id} className={diag ? styles.cellDiag : v === undefined ? styles.cellEmpty : undefined}>
                            {v === undefined || v === null ? "—" : (v / 1000).toLocaleString("id-ID", { minimumFractionDigits: 0 })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {mode === "grid" && grid && grid.gates.length > 0 && (
        <span className={mstyles.muted} style={{ fontSize: "var(--fs-micro)", marginTop: -8 }}>Angka dalam ribuan Rupiah (mis. 15 = Rp 15.000). Sel abu = asal sama dengan tujuan.</span>
      )}

      <Modal open={uploadOpen} onOpenChange={setUploadOpen} title="Upload Tarif" width={900}>
        <UploadTarifWizard
          onCommitted={() => {
            if (mode === "table") void loadTable();
            else void loadGrid();
          }}
        />
      </Modal>
    </div>
  );
}
