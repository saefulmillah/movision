import { Fragment, useState } from "react";
import type { CSSProperties } from "react";
import { Button, EmptyState, Icon } from "@/components/ui";
import type { WimHeatmapDay, WimHeatmapRow, WimHeatmapStatus } from "@/types/wim";
import styles from "./WimHeatmap.module.css";

const RANGES = [14, 21, 30] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const STATUS_META: Record<WimHeatmapStatus, { label: string; cls: string }> = {
  ok: { label: "Sehat", cls: styles.ok },
  warning: { label: "Perlu cek", cls: styles.warning },
  critical: { label: "Tak terjangkau", cls: styles.critical },
  kosong: { label: "Tidak ada data", cls: styles.kosong }
};

function columnHeader(dateStr: string, index: number): { day: string | number; month: string } {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return { day: "", month: "" };
  const day = parsed.getDate();
  return { day, month: index === 0 || day === 1 ? MONTHS[parsed.getMonth()] : "" };
}

function tipDate(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

// Availability: 91–100% hijau, 81–90% kuning, <81% merah.
function availabilityTone(pct: number): string {
  if (pct >= 91) return "var(--sem-green)";
  if (pct >= 81) return "var(--sem-amber)";
  return "var(--sem-red)";
}

interface TipState {
  site: WimHeatmapRow;
  day: WimHeatmapDay;
  label: string;
  x: number;
  y: number;
  below: boolean;
}

function HeatmapTooltip({ tip }: { tip: TipState }) {
  const { site, day, label } = tip;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const clampedX = Math.min(Math.max(tip.x, 140), vw - 140);
  const base = Number(day.device_total) || 1;
  const onPct = ((Number(day.device_online) || 0) / base) * 100;
  const warnPct = ((Number(day.device_warning) || 0) / base) * 100;
  const offPct = ((Number(day.device_offline) || 0) / base) * 100;

  return (
    <div
      className={`${styles.tip}${tip.below ? ` ${styles.tipBelow}` : ""}`}
      style={{ left: clampedX, top: tip.y }}
      role="tooltip"
    >
      <div className={styles.tipTop}>
        <span className={`${styles.tipDot} ${STATUS_META[day.status].cls}`} />
        <span className={styles.tipLabel}>{label}</span>
        <span className={styles.tipDate}>{tipDate(day.date)}</span>
      </div>
      <div className={styles.tipSite}>{site.site_name}</div>

      {day.device_status ? (
        <>
          <div className={styles.tipRow}>
            <span>Device</span>
            <strong>
              {Number(day.device_online) || 0}/{Number(day.device_total) || 0} online
            </strong>
          </div>
          <div className={styles.tipBar}>
            <i className={styles.barOn} style={{ width: `${onPct}%` }} />
            <i className={styles.barWarn} style={{ width: `${warnPct}%` }} />
            <i className={styles.barOff} style={{ width: `${offPct}%` }} />
          </div>
          {Number(day.device_warning) > 0 || Number(day.device_offline) > 0 ? (
            <div className={styles.tipTags}>
              {Number(day.device_warning) > 0 ? <span className={styles.tagWarn}>{day.device_warning} warning</span> : null}
              {Number(day.device_offline) > 0 ? <span className={styles.tagOff}>{day.device_offline} offline</span> : null}
            </div>
          ) : null}
        </>
      ) : null}

      <div className={styles.tipRow}>
        <span>Data harian</span>
        <strong>{day.has_daily_data ? `${Number(day.daily_data_count) || 0} record` : "Tidak ada"}</strong>
      </div>

      {day.last_error_message ? <div className={styles.tipErr}>{day.last_error_message}</div> : null}
    </div>
  );
}

interface WimHeatmapProps {
  rows: WimHeatmapRow[];
  days: number;
  onDaysChange: (days: number) => void;
  loading: boolean;
  error?: string;
  onRetry: () => void;
}

/**
 * Heatmap Kesehatan Site × Hari — satu baris per site, satu kolom per tanggal,
 * plus kolom % availability. Tooltip hover dikelola di sini agar hanya subtree
 * ini yang re-render saat hover.
 */
export function WimHeatmap({ rows, days, onDaysChange, loading, error, onRetry }: WimHeatmapProps) {
  const [tip, setTip] = useState<TipState | null>(null);

  const dates = rows[0]?.days?.map((day) => day.date) ?? [];

  const showTip = (site: WimHeatmapRow, day: WimHeatmapDay, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const below = rect.top < 240;
    setTip({
      site,
      day,
      label: STATUS_META[day.status]?.label ?? day.status,
      x: rect.left + rect.width / 2,
      y: below ? rect.bottom + 8 : rect.top - 8,
      below
    });
  };
  const hideTip = () => setTip(null);

  const gridStyle = {
    gridTemplateColumns: `minmax(84px, 128px) repeat(${dates.length}, minmax(0, 1fr)) 40px`
  } as CSSProperties;

  const segmented = (
    <div className={styles.seg} role="tablist" aria-label="Rentang hari">
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          role="tab"
          aria-selected={days === range}
          className={days === range ? styles.segActive : undefined}
          onClick={() => onDaysChange(range)}
        >
          {range} hari
        </button>
      ))}
    </div>
  );

  let body;
  if (loading && rows.length === 0) {
    body = (
      <div className={styles.loading}>
        <Icon name="loader" size={16} />
        Memuat heatmap…
      </div>
    );
  } else if (error) {
    body = (
      <EmptyState icon="scale" title="Gagal memuat heatmap" description={error}>
        <Button variant="secondary" icon="refresh-cw" onClick={onRetry}>Coba lagi</Button>
      </EmptyState>
    );
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        icon="scale"
        title="Belum ada data heatmap"
        description="Tidak ada riwayat status untuk rentang/ruas yang dipilih."
      />
    );
  } else {
    body = (
      <>
        <div className={styles.scroll} onMouseLeave={hideTip}>
          <div className={styles.grid} style={gridStyle}>
            <div className={styles.corner}>Site</div>
            {dates.map((date, index) => {
              const head = columnHeader(date, index);
              return (
                <div key={date} className={styles.colHead}>
                  {head.month ? <span className={styles.colMonth}>{head.month}</span> : null}
                  {head.day}
                </div>
              );
            })}
            <div className={styles.availHead}>Avail</div>

            {rows.map((site) => (
              <Fragment key={site.site_code || site.site_name}>
                <div className={styles.rowLabel} title={site.site_name}>
                  <span>{site.site_name}</span>
                </div>
                {(site.days ?? []).map((day) => {
                  const meta = STATUS_META[day.status] ?? STATUS_META.kosong;
                  return (
                    <div
                      key={day.date}
                      className={`${styles.cell} ${meta.cls}`}
                      onMouseEnter={(event) => showTip(site, day, event.currentTarget)}
                    />
                  );
                })}
                <div className={styles.avail} style={{ color: availabilityTone(Number(site.availability_pct) || 0) }}>
                  {Number(site.availability_pct) || 0}%
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        <div className={styles.legend}>
          {(Object.keys(STATUS_META) as WimHeatmapStatus[]).map((key) => (
            <span key={key} className={styles.legendItem}>
              <span className={`${styles.legendDot} ${STATUS_META[key].cls}`} />
              {STATUS_META[key].label}
            </span>
          ))}
          <span className={styles.legendNote}>Avail = % hari dengan data (sehat / perlu cek)</span>
        </div>
      </>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <strong>Heatmap Kesehatan Site × Hari</strong>
          <span className={styles.sub}>Status harian tiap site + % availability di kolom kanan.</span>
        </div>
        {segmented}
      </div>
      <div className={styles.bodyPad}>{body}</div>
      {tip ? <HeatmapTooltip tip={tip} /> : null}
    </div>
  );
}
