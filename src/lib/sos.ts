import { api } from "@/lib/api";
import type { SosTicketDetail, TimelineEntry } from "@/types/sos";

function first<T>(data: T[] | T): T {
  return Array.isArray(data) ? data[0] : data;
}

/** Detail + kandidat smart response (endpoint response menyertakan vehicle_candidates). */
export async function fetchTicketResponse(ticketNo: string): Promise<SosTicketDetail> {
  return first(await api.get<SosTicketDetail[] | SosTicketDetail>(`/sos-tickets/${encodeURIComponent(ticketNo)}/response`));
}

export function fetchTicketTimeline(ticketNo: string): Promise<TimelineEntry[]> {
  return api.get<TimelineEntry[]>(`/sos-tickets/${encodeURIComponent(ticketNo)}/timeline`);
}

export function confirmArrival(ticketNo: string): Promise<unknown> {
  return api.post(`/sos-tickets/${encodeURIComponent(ticketNo)}/confirm-arrival`);
}

export function completeTicket(ticketNo: string, note?: string): Promise<unknown> {
  return api.patch(`/sos-tickets/${encodeURIComponent(ticketNo)}/complete`, note ? { completion_note: note } : {});
}
