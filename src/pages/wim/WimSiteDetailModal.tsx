import { Button, Icon, Modal, StatusPill } from "@/components/ui";
import type { PillTone } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { WimDeviceStatus, WimSiteDetail, WimSiteStatus } from "@/types/wim";
import styles from "./WimSiteDetailModal.module.css";

const STATUS_LABEL: Record<WimDeviceStatus, string> = {
  online: "Online",
  warning: "Warning",
  offline: "Offline",
  unknown: "Tidak diketahui"
};

const CHECK_TYPE_LABEL: Record<string, string> = {
  device_status: "Cek Device",
  daily_data: "Cek Data Harian",
  manual_refresh: "Refresh Manual"
};

function statusTone(status: string): PillTone {
  switch (String(status || "").toLowerCase()) {
    case "online": return "green";
    case "warning": return "amber";
    case "offline": return "red";
    default: return "gray";
  }
}

function tagClass(status: string): string {
  switch (String(status || "").toLowerCase()) {
    case "online": return styles.chipOk;
    case "warning": return styles.chipWarn;
    case "offline": return styles.chipOff;
    default: return styles.chipMuted;
  }
}

function fmt(value: string | null | undefined): string {
  return formatDateTime(value ?? null) || "—";
}

interface WimSiteDetailModalProps {
  open: boolean;
  onClose: () => void;
  site: WimSiteStatus | null;
  detail: WimSiteDetail | null;
  loading: boolean;
  error: string;
}

export function WimSiteDetailModal({ open, onClose, site, detail, loading, error }: WimSiteDetailModalProps) {
  // Data baris tampil instan; diperkaya begitu detail (devices/logs) selesai dimuat.
  const data: (WimSiteStatus & Partial<WimSiteDetail>) | null = detail ?? site;
  const devices = detail?.devices ?? [];
  const logs = detail?.logs ?? [];

  const total = Number(data?.device_total) || 0;
  const online = Number(data?.device_online) || 0;
  const warning = Number(data?.device_warning) || 0;
  const offline = Number(data?.device_offline) || 0;
  const base = total || 1;

  const checks: { icon: string; label: string; value: string }[] = data
    ? [
        { icon: "circle-check", label: "Sukses terakhir", value: fmt(data.last_success_at) },
        { icon: "monitor-check", label: "Cek device", value: fmt(data.last_device_check_at) },
        { icon: "database", label: "Cek data", value: fmt(data.last_data_check_at) }
      ]
    : [];

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="Detail Site WIM"
      width={620}
      footer={<Button variant="secondary" onClick={onClose}>Tutup</Button>}
    >
      {!data ? (
        <div className={styles.loading}><Icon name="loader" size={16} /> Memuat…</div>
      ) : (
        <div className={styles.wrap}>
          {/* Identitas + ringkasan kesehatan */}
          <div className={styles.summary}>
            <div className={styles.summaryTop}>
              <div className={styles.identity}>
                <span className={styles.siteName}>{data.site_name || data.site_code}</span>
                <span className={styles.siteMeta}>
                  <span className={styles.code}>{data.site_code}</span>
                  <span className={styles.metaSep}>·</span>
                  {data.branch_name || "Tanpa ruas"}
                </span>
              </div>
              <StatusPill label={STATUS_LABEL[data.device_status] ?? data.device_status} tone={statusTone(data.device_status)} dot />
            </div>

            <div className={styles.healthRow}>
              <div className={styles.healthBar} aria-hidden="true">
                <i className={styles.hbOn} style={{ width: `${(online / base) * 100}%` }} />
                <i className={styles.hbWarn} style={{ width: `${(warning / base) * 100}%` }} />
                <i className={styles.hbOff} style={{ width: `${(offline / base) * 100}%` }} />
              </div>
              <span className={styles.healthText}><b>{online}</b>/{total} online</span>
            </div>

            <div className={styles.chips}>
              {warning > 0 ? <span className={`${styles.chip} ${styles.chipWarn}`}>{warning} warning</span> : null}
              {offline > 0 ? <span className={`${styles.chip} ${styles.chipOff}`}>{offline} offline</span> : null}
              {warning === 0 && offline === 0 && total > 0 ? (
                <span className={`${styles.chip} ${styles.chipOk}`}>Semua perangkat sehat</span>
              ) : null}
              <span className={`${styles.chip} ${data.has_daily_data ? styles.chipOk : styles.chipMuted}`}>
                {data.has_daily_data ? `${Number(data.daily_data_count) || 0} record data harian` : "Tanpa data harian"}
              </span>
            </div>
          </div>

          {/* Waktu pengecekan */}
          <div className={styles.checks}>
            {checks.map((c) => (
              <div key={c.label} className={styles.check}>
                <span className={styles.checkIcon}><Icon name={c.icon} size={14} /></span>
                <span className={styles.checkBody}>
                  <span className={styles.checkLabel}>{c.label}</span>
                  <span className={styles.checkValue}>{c.value}</span>
                </span>
              </div>
            ))}
          </div>

          {data.last_error_message ? (
            <div className={styles.errBox}>
              <Icon name="triangle-alert" size={14} />
              <div>
                <div className={styles.errTitle}>Error terakhir</div>
                <div className={styles.errText}>{data.last_error_message}</div>
              </div>
            </div>
          ) : null}

          {error ? <div className={styles.inlineErr}>{error}</div> : null}

          {/* Perangkat */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>Perangkat</span>
              {devices.length > 0 ? <span className={styles.countBadge}>{devices.length}</span> : null}
            </div>
            {loading && devices.length === 0 ? (
              <div className={styles.muted}><Icon name="loader" size={14} /> Memuat perangkat…</div>
            ) : devices.length === 0 ? (
              <div className={styles.muted}>Tidak ada rincian perangkat.</div>
            ) : (
              <div className={styles.devTags}>
                {devices.map((d) => (
                  <span
                    key={d.id}
                    className={`${styles.devTag} ${tagClass(d.status)}`}
                    title={[d.type, STATUS_LABEL[d.status as WimDeviceStatus] ?? d.status].filter(Boolean).join(" · ")}
                  >
                    <span className={styles.devTagDot} />
                    {d.name}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Riwayat pengecekan */}
          {logs.length > 0 ? (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>Riwayat Pengecekan</span>
                <span className={styles.countBadge}>{logs.length}</span>
              </div>
              <ul className={styles.logList}>
                {logs.slice(0, 8).map((log, i) => (
                  <li key={`${log.check_type}-${i}`} className={styles.logItem}>
                    <span className={log.is_success ? styles.logIconOk : styles.logIconFail}>
                      <Icon name={log.is_success ? "circle-check" : "circle-x"} size={14} />
                    </span>
                    <span className={styles.logType}>{CHECK_TYPE_LABEL[log.check_type] ?? log.check_type}</span>
                    {log.http_status !== null && log.http_status !== undefined ? (
                      <span className={styles.logHttp}>HTTP {log.http_status}</span>
                    ) : null}
                    <span className={styles.logTime}>{fmt(log.finished_at || log.created_at)}</span>
                    {log.error_message ? <span className={styles.logErr}>{log.error_message}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
