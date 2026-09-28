import { Icon } from "@/components/ui/Icon";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GateAlertsCard } from "@/components/dashboard/GateAlertsCard";
import { SosActiveCard } from "@/components/dashboard/SosActiveCard";
import { ActivityFeedCard } from "@/components/dashboard/ActivityFeedCard";
import { MiniMapCard } from "@/components/dashboard/MiniMapCard";
import { useTickets } from "@/context/TicketsContext";
import { usePolling } from "@/lib/usePolling";
import { fetchMonitoringSummary } from "@/lib/monitoring";
import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  const { data, loading, error } = usePolling(fetchMonitoringSummary, 30000);
  const { openCount } = useTickets();
  const s = data;

  return (
    <div className={styles.page}>
      {error && !data && (
        <div className={styles.errorBanner}>
          <Icon name="info" size={15} />
          Gagal memuat ringkasan: {error}
        </div>
      )}

      <div className={styles.kpiRow}>
        <KpiCard
          label="Ruas Aktif"
          icon="git-fork"
          tone="blue"
          value={s?.branches.active}
          hint="ruas beroperasi"
          loading={loading && !s}
        />
        <KpiCard
          label="CCTV Online"
          icon="cctv"
          tone="green"
          value={s?.cctv.online}
          total={s?.cctv.total}
          hint="kamera daring"
          loading={loading && !s}
        />
        <KpiCard
          label="VMS Offline"
          icon="monitor"
          tone="amber"
          value={s?.vms.offline}
          total={s?.vms.total}
          hint="papan tidak aktif"
          loading={loading && !s}
        />
        <KpiCard
          label="SOS Aktif"
          icon="siren"
          tone="red"
          value={openCount}
          hint="insiden butuh penanganan"
          loading={false}
        />
        <KpiCard
          label="Kendaraan Live"
          icon="truck"
          tone="cyan"
          value={s?.vehicles.live}
          total={s?.vehicles.total}
          hint="unit patroli & rescue"
          loading={loading && !s}
        />
        <KpiCard
          label="Site WIM Online"
          icon="scale"
          tone="purple"
          disabled
          hint="di luar lingkup fase ini"
        />
      </div>

      <div className={styles.columns}>
        <div className={styles.col}>
          <MiniMapCard />
          <GateAlertsCard />
        </div>
        <div className={styles.col}>
          <div className={styles.rightCard}>
            <SosActiveCard />
          </div>
          <div className={styles.rightCard}>
            <ActivityFeedCard />
          </div>
        </div>
      </div>
    </div>
  );
}
