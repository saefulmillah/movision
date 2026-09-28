import { useMemo, useState } from "react";
import { Button, Card, Icon, StatusPill, useToast } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePolling } from "@/lib/usePolling";
import { completeTicket, confirmArrival, fetchTicketResponse, fetchTicketTimeline } from "@/lib/sos";
import { formatTime } from "@/lib/format";
import { TICKET_STATUS } from "@/types/sos";
import { confidenceTone, primaryFirst, timelineEvent, trackTone, vehicleIcon } from "./helpers";
import styles from "./sos.module.css";

interface TicketDetailProps {
  ticketNo: string;
  onChanged: () => void;
}

function reporterName(u?: { first_name?: string; last_name?: string }): string {
  return [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "Pelapor";
}

const trackClass: Record<string, string> = { green: styles.trackGreen, amber: styles.trackAmber, gray: styles.trackGray };
const confClass: Record<string, string> = { green: styles.confGreen, amber: styles.confAmber, red: styles.confRed };

export function TicketDetail({ ticketNo, onChanged }: TicketDetailProps) {
  const toast = useToast();
  const detailQ = usePolling(() => fetchTicketResponse(ticketNo), 15000, [ticketNo]);
  const timelineQ = usePolling(() => fetchTicketTimeline(ticketNo), 15000, [ticketNo]);
  const [busy, setBusy] = useState<"" | "confirm" | "complete">("");

  const detail = detailQ.data;
  const candidates = useMemo(() => primaryFirst(detail?.vehicle_candidates ?? []), [detail]);
  const timeline = useMemo(
    () => [...(timelineQ.data ?? [])].sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime()).slice(0, 20),
    [timelineQ.data]
  );

  async function doConfirm() {
    setBusy("confirm");
    try {
      await confirmArrival(ticketNo);
      toast.success("Kedatangan dikonfirmasi");
      detailQ.refresh();
      timelineQ.refresh();
      onChanged();
    } catch (err) {
      toast.error("Gagal konfirmasi", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy("");
    }
  }
  async function doComplete() {
    setBusy("complete");
    try {
      await completeTicket(ticketNo);
      toast.success("Tiket diselesaikan");
      onChanged();
    } catch (err) {
      toast.error("Gagal menyelesaikan", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy("");
    }
  }

  if (detailQ.loading && !detail) {
    return <div className={styles.detail}><EmptyState icon="siren" title="Memuat tiket…" /></div>;
  }
  if (!detail) {
    return <div className={styles.detail}><EmptyState icon="info" title="Tiket tidak ditemukan" description={detailQ.error ?? undefined} /></div>;
  }

  const status = TICKET_STATUS[detail.ticket_status] ?? { label: "SOS", tone: "amber" as const };
  const sos = detail.sos;
  const completed = detail.ticket_status === 2;

  return (
    <div className={styles.detail}>
      {/* Header */}
      <div className={styles.dHead}>
        <div className={styles.dHeadTop}>
          <span className={styles.ticketNo}>{detail.ticket_no}</span>
          <StatusPill label={status.label} tone={status.tone} />
          {detail.response_summary?.response_status && (
            <span className={styles.ticketNo} style={{ textTransform: "lowercase" }}>
              {detail.response_summary.response_status.replace(/_/g, " ").toLowerCase()}
            </span>
          )}
        </div>
        <div className={styles.dTitle}>{detail.incident_type}</div>
        <div className={styles.dSub}>
          {sos?.branch_name && <span><Icon name="git-fork" size={13} /> {sos.branch_name}</span>}
          {sos?.location && <span><Icon name="map" size={13} /> {sos.location}</span>}
          {detail.created_at && <span><Icon name="activity" size={13} /> {formatTime(detail.created_at)}</span>}
        </div>
        <div className={styles.dActions}>
          <Button variant="secondary" icon="check" onClick={doConfirm} disabled={busy !== "" || completed}>
            {busy === "confirm" ? "Memproses…" : "Konfirmasi Kedatangan"}
          </Button>
          <Button variant="primary" icon="shield-check" onClick={doComplete} disabled={busy !== "" || completed}>
            {busy === "complete" ? "Memproses…" : "Selesaikan Tiket"}
          </Button>
        </div>
      </div>

      {/* Pelapor + lokasi */}
      <div className={styles.cardsRow}>
        <Card title="Pelapor">
          <div className={styles.reporter}>
            <span className={styles.reporterAvatar}>
              {reporterName(sos?.user).slice(0, 1).toUpperCase()}
            </span>
            <span style={{ minWidth: 0 }}>
              <div className={styles.reporterName}>{reporterName(sos?.user)}</div>
              <div className={styles.reporterPhone}>{sos?.user?.phone || "—"}</div>
            </span>
          </div>
          <div className={styles.reporterCoord}>
            {sos?.latitude != null && sos?.longitude != null ? `${sos.latitude.toFixed(5)}, ${sos.longitude.toFixed(5)}` : "Koordinat tidak tersedia"}
          </div>
        </Card>

        <Card title="Lokasi Insiden">
          <div className={styles.incidentMap}>
            <svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMid slice">
              <defs>
                <pattern id="sosgrid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M30 0H0V30" fill="none" stroke="var(--grid)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="300" height="120" fill="url(#sosgrid)" />
            </svg>
            <span className={styles.incidentMarker} />
          </div>
        </Card>
      </div>

      {/* Smart Response */}
      <Card title="Smart Response — Kandidat Kendaraan" count={candidates.length}>
        {candidates.length === 0 ? (
          <EmptyState icon="truck" title="Belum ada kandidat" description="Belum ada kandidat kendaraan yang valid. Tracking sedang berjalan." />
        ) : (
          candidates.map((c) => {
            const track = trackTone(c.detection_status);
            const conf = confidenceTone(c.confidence_score);
            return (
              <div key={c.vehicle_id} className={styles.candidate}>
                <span className={styles.candIcon}>
                  <Icon name={vehicleIcon(c.vehicle_label)} size={18} />
                </span>
                <span className={styles.candMain}>
                  <span className={styles.candLabelRow}>
                    <span className={styles.candLabel}>{c.vehicle_label}</span>
                    {c.is_primary && <span className={styles.primaryTag}>UTAMA</span>}
                  </span>
                  <div className={`${styles.candTrack} ${trackClass[track.cls]}`}>{track.text}</div>
                  <div className={styles.candStats}>
                    {Math.round(c.distance_meters)} m · {Math.round(c.speed_kmh ?? 0)} km/j
                  </div>
                </span>
                <span className={styles.confidence}>
                  <div className={`${styles.confValue} ${confClass[conf.cls]}`}>{conf.display}</div>
                  <div className={styles.confLabel}>confidence</div>
                </span>
              </div>
            );
          })
        )}
      </Card>

      {/* Timeline */}
      <Card title="Timeline Response">
        {timeline.length === 0 ? (
          <EmptyState icon="activity" title="Belum ada peristiwa" />
        ) : (
          <div className={styles.timeline}>
            {timeline.map((e) => {
              const ev = timelineEvent(e.event_type);
              const vlabel = (e.metadata?.vehicle_label as string) || "";
              return (
                <div key={e.id} className={styles.tlEntry}>
                  <span className={styles.tlDot} style={{ background: ev.color }} />
                  <span className={styles.tlMain}>
                    <div className={styles.tlEvent}>{ev.label}</div>
                    <div className={styles.tlMeta}>
                      {vlabel && <span>{vlabel}</span>}
                      <span className={styles.tlTime}>{formatTime(e.event_at)}</span>
                    </div>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
