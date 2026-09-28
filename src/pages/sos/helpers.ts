import type { VehicleCandidate } from "@/types/sos";

export function vehicleIcon(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("ambulan")) return "ambulance";
  if (l.includes("pjr") || l.includes("polisi") || l.includes("patwal")) return "shield";
  if (l.includes("towing") || l.includes("derek")) return "truck";
  if (l.includes("rescue")) return "life-buoy";
  return "truck";
}

/** Warna teks status pelacakan kandidat (handoff §10.2). */
export function trackTone(status: string): { cls: string; text: string } {
  const s = status.toUpperCase();
  if (s.includes("ARRIVAL_CONFIRMED")) return { cls: "green", text: "Kedatangan terkonfirmasi" };
  if (s.includes("ARRIVED_PENDING")) return { cls: "amber", text: "Tiba, menunggu konfirmasi" };
  if (s.includes("HEADING") || s.includes("MAYBE")) return { cls: "amber", text: "Kemungkinan menuju SOS" };
  if (s.includes("NEARBY")) return { cls: "amber", text: "Kandidat terdekat" };
  return { cls: "gray", text: "Terpantau" };
}

/** Confidence 0..100 → { level, display 0..1 }. */
export function confidenceTone(score: number): { cls: string; display: string } {
  const norm = score / 100;
  const cls = norm >= 0.8 ? "green" : norm >= 0.5 ? "amber" : "red";
  return { cls, display: norm.toFixed(2) };
}

const EVENT_MAP: Record<string, { label: string; color: string }> = {
  TRACKING_STARTED: { label: "Tracking dimulai", color: "var(--st-gray)" },
  NEAREST_CANDIDATE_FOUND: { label: "Kandidat terdekat ditemukan", color: "var(--st-blue)" },
  NEARBY_CANDIDATE: { label: "Kandidat terdekat ditemukan", color: "var(--st-blue)" },
  MAYBE_HEADING: { label: "Kemungkinan menuju SOS", color: "var(--sem-amber)" },
  VEHICLE_ARRIVED_PENDING: { label: "Tiba, menunggu konfirmasi", color: "var(--sem-amber)" },
  ARRIVAL_CONFIRMED: { label: "Kedatangan terkonfirmasi", color: "var(--sem-green)" }
};

export function timelineEvent(eventType: string): { label: string; color: string } {
  return (
    EVENT_MAP[eventType] || {
      label: eventType.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      color: "var(--st-gray)"
    }
  );
}

export function primaryFirst(candidates: VehicleCandidate[]): VehicleCandidate[] {
  return [...candidates].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || b.confidence_score - a.confidence_score);
}
