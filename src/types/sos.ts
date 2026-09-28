export interface SosReporter {
  id_user?: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  sex?: string;
  address?: string;
}

export interface SosInfo {
  sos_id: number;
  user_id?: number;
  user?: SosReporter;
  branch_id?: number;
  branch_code?: string;
  branch_name?: string;
  status?: number;
  latitude?: number;
  longitude?: number;
  location?: string;
}

export interface ResponseSummary {
  response_status?: string;
  primary_vehicle_id?: number;
  primary_vehicle_label?: string;
  confidence_score?: number; // 0..100
  distance_meters?: number;
  first_candidate_detected_at?: string | null;
  arrival_confirmed_at?: string | null;
  handling_started_at?: string | null;
}

export interface VehicleCandidate {
  vehicle_id: number;
  vehicle_label: string;
  branch_id?: number;
  detection_status: string;
  confidence_score: number; // 0..100
  distance_meters: number;
  speed_kmh?: number;
  bearing_to_sos?: number;
  detected_at?: string;
  arrival_confirmed_at?: string | null;
  is_primary?: boolean;
}

export interface TimelineEntry {
  id: number;
  ticket_no: string;
  event_type: string;
  event_at: string;
  actor_user_id: number | null;
  vehicle_id: number | null;
  metadata?: Record<string, unknown>;
}

export interface SosTicketDetail {
  id: number;
  ticket_no: string;
  sos_id: number;
  incident_type: string;
  vehicle_type?: string;
  initial_chronology?: string;
  ticket_status: number; // 1=dispatched, 3=in-handling, 2=completed
  dispatched_at?: string | null;
  completed_at?: string | null;
  completion_note?: string | null;
  created_at?: string;
  updated_at?: string;
  sos?: SosInfo;
  response_summary?: ResponseSummary | null;
  vehicle_candidates?: VehicleCandidate[];
}

export const TICKET_STATUS: Record<number, { label: string; tone: "amber" | "blue" | "green" }> = {
  1: { label: "Dispatched", tone: "blue" },
  3: { label: "Ditangani", tone: "amber" },
  2: { label: "Selesai", tone: "green" }
};
