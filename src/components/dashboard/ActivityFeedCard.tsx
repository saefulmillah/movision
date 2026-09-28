import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSseEvent } from "@/context/SseContext";
import { formatTime } from "@/lib/format";
import styles from "./dashboard.module.css";

interface ActivityEntry {
  id: string;
  text: string;
  tone: "red" | "amber" | "green" | "blue";
  at: string;
}

const MAX = 40;

const EVENT_META: Record<string, { tone: ActivityEntry["tone"]; verb: string }> = {
  alert_created: { tone: "red", verb: "Peringatan baru" },
  alert_updated: { tone: "amber", verb: "Peringatan diperbarui" },
  alert_resolved: { tone: "green", verb: "Peringatan selesai" },
  sos_created: { tone: "red", verb: "SOS baru" },
  sos_updated: { tone: "amber", verb: "SOS diperbarui" },
  sos_resolved: { tone: "green", verb: "SOS selesai" }
};

function describe(event: string, data: unknown): string {
  const meta = EVENT_META[event];
  const verb = meta?.verb ?? event;
  const d = (data ?? {}) as Record<string, unknown>;
  const name =
    (d.gate_name as string) ||
    (d.asset_name as string) ||
    (d.ticket_no as string) ||
    (d.gate_code as string) ||
    "";
  return name ? `${verb} — ${name}` : verb;
}

export function ActivityFeedCard() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useSseEvent(Object.keys(EVENT_META), (data, event) => {
    const meta = EVENT_META[event];
    setEntries((prev) =>
      [
        {
          id: `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: describe(event, data),
          tone: meta?.tone ?? "blue",
          at: new Date().toISOString()
        },
        ...prev
      ].slice(0, MAX)
    );
  });

  return (
    <Card title="Aktivitas Terkini" flush>
      {entries.length === 0 ? (
        <EmptyState
          icon="activity"
          title="Belum ada aktivitas"
          description="Peristiwa realtime (peringatan, SOS) akan muncul di sini saat terjadi."
        />
      ) : (
        <div className={styles.feed}>
          {entries.map((e) => (
            <div key={e.id} className={styles.feedItem}>
              <span
                className={styles.feedDot}
                style={{
                  background:
                    e.tone === "red"
                      ? "var(--sem-red)"
                      : e.tone === "amber"
                        ? "var(--sem-amber)"
                        : e.tone === "green"
                          ? "var(--sem-green)"
                          : "var(--st-blue)"
                }}
              />
              <span className={styles.feedText}>{e.text}</span>
              <span className={styles.feedTime}>{formatTime(e.at)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
