/* ============================================================
   Tipe kontrak API Evaluasi SOS (/api/sos-tickets/summary & /history).

   Catatan envelope: endpoint ini membalas { status, message, data, meta? }
   — berbeda dari sebagian endpoint lain. `data` dibongkar oleh api.ts;
   `meta` /history dibaca via getWithMeta (lihat lib/sosEvaluasi.ts).
   ============================================================ */

/** Status tiket SOS (string pada payload evaluasi; kode angka dipakai di query). */
export type SosEvalStatus = "dispatched" | "in_handling" | "completed";

/** Kode query status pada /history: 1=dispatched, 3=in_handling, 2=completed. */
export const SOS_STATUS_CODE: Record<SosEvalStatus, number> = {
  dispatched: 1,
  in_handling: 3,
  completed: 2
};

/** Meta tampilan badge status (selaras TICKET_STATUS pada types/sos.ts). */
export const SOS_STATUS_META: Record<SosEvalStatus, { label: string; tone: "blue" | "amber" | "green" }> = {
  dispatched: { label: "Dispatched", tone: "blue" },
  in_handling: { label: "Ditangani", tone: "amber" },
  completed: { label: "Selesai", tone: "green" }
};

/* ---------------- Ringkasan (/summary) ---------------- */

export interface SosSummaryRingkasan {
  total: number;
  dispatched: number;
  in_handling: number;
  completed: number;
  /** Rata-rata response time (detik); null bila belum ada metrik. */
  avg_response_seconds: number | null;
  /** Rata-rata resolution (detik); null bila belum ada metrik. */
  avg_resolution_seconds: number | null;
  /** Jumlah tiket yang memenuhi SLA response. */
  sla_terpenuhi: number;
  /** Jumlah tiket bersampel response time (penyebut SLA). */
  sla_dari: number;
  /** Persentase kepatuhan SLA (0..100); null bila tak ada sampel. */
  sla_persen: number | null;
}

export interface SosPerJenis {
  incident_type: string;
  jumlah: number;
  avg_response_seconds: number | null;
}

export interface SosPerRuas {
  id_ruas: number;
  kode_ruas: string;
  nama_ruas: string;
  jumlah: number;
  avg_response_seconds: number | null;
}

export interface SosTrenHarian {
  tanggal: string;
  jumlah: number;
  avg_response_seconds: number | null;
}

export interface SosSummary {
  start_date: string;
  end_date: string;
  sla_response_minutes: number;
  ringkasan: SosSummaryRingkasan;
  per_jenis: SosPerJenis[];
  per_ruas: SosPerRuas[];
  tren_harian: SosTrenHarian[];
}

/* ---------------- Riwayat tiket (/history) ---------------- */

export interface SosHistoryRow {
  ticket_no: string;
  sos_id: number;
  incident_type: string;
  vehicle_type?: string | null;
  status: SosEvalStatus;
  id_ruas: number | null;
  kode_ruas?: string | null;
  nama_ruas?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  alert_at: string | null;
  dispatched_at: string | null;
  arrival_confirmed_at: string | null;
  completed_at: string | null;
  time_to_dispatch_seconds: number | null;
  response_time_seconds: number | null;
  resolution_seconds: number | null;
  primary_vehicle_label?: string | null;
  distance_meters?: number | null;
  completion_note?: string | null;
}

/** Meta paginasi /history — flat (bukan nested `pagination`). */
export interface SosHistoryMeta {
  page: number;
  limit: number;
  total: number;
  total_page: number;
}

export interface SosHistoryResult {
  rows: SosHistoryRow[];
  meta: SosHistoryMeta | null;
}
