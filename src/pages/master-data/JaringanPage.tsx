import { useState } from "react";
import { Tabs } from "@/components/ui";
import type { TabItem } from "@/components/ui";
import { DataTablePage } from "@/components/data-table/DataTablePage";
import { NETWORK_CONFIGS } from "./configs";
import styles from "@/pages/modules.module.css";

const TABS: TabItem[] = [
  { value: "nodes", label: "Node", icon: "circle-dot" },
  { value: "edges", label: "Edge", icon: "spline" }
];

/** FO & Jaringan berbagi modul `fo`; halaman ini menampung Node + Edge dalam tab. */
export function JaringanPage() {
  const [tab, setTab] = useState<"nodes" | "edges">("nodes");
  return (
    <div className={styles.page}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "nodes" | "edges")} items={TABS} />
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        {tab === "nodes" ? (
          <DataTablePage config={NETWORK_CONFIGS.nodes} />
        ) : (
          <DataTablePage config={NETWORK_CONFIGS.edges} />
        )}
      </div>
    </div>
  );
}
