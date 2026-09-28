import { api } from "@/lib/api";
import { buildQuery, paged } from "@/lib/news";
import type { PagedResult } from "@/lib/news";
import type { IncidentFormValues, IncidentItem, IncidentType } from "@/types/modules";

function first<T>(data: T[] | T): T {
  return Array.isArray(data) ? data[0] : data;
}

export interface IncidentListParams {
  page?: number;
  per_page?: number;
  status?: string;
  branch_id?: string;
  incident_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

/* ---------- Incident types (master) ---------- */
export function fetchIncidentTypes(): Promise<IncidentType[]> {
  return api.get<IncidentType[]>("/admin/incident-types");
}

export async function createIncidentType(body: { incident_name: string; incident_code?: string }): Promise<IncidentType> {
  return first(await api.post<IncidentType[] | IncidentType>("/admin/incident-types", body));
}

export async function updateIncidentType(id: number, body: { incident_name?: string; incident_code?: string }): Promise<IncidentType> {
  return first(await api.put<IncidentType[] | IncidentType>(`/admin/incident-types/${id}`, body));
}

export function deleteIncidentType(id: number): Promise<unknown> {
  return api.delete(`/admin/incident-types/${id}`);
}

/* ---------- Incidents (records) ---------- */
export async function fetchIncidents(params: IncidentListParams = {}): Promise<PagedResult<IncidentItem>> {
  const { data, meta } = await api.getWithMeta<IncidentItem[]>(`/admin/incidents${buildQuery(params)}`);
  return paged(data, meta, params.page, params.per_page);
}

export async function fetchIncidentDetail(id: number): Promise<IncidentItem> {
  return first(await api.get<IncidentItem[] | IncidentItem>(`/admin/incidents/${id}`));
}

function toPayload(v: IncidentFormValues): Record<string, unknown> {
  return {
    incident_type_id: v.incident_type_id === "" ? undefined : Number(v.incident_type_id),
    incident_detail: v.incident_detail,
    incident_name: v.incident_name || undefined,
    incident_command: v.incident_command || undefined,
    branch_id: v.branch_id === "" ? undefined : Number(v.branch_id),
    status: v.status === "" ? undefined : Number(v.status),
    handling: v.handling || undefined,
    km: v.km || undefined,
    lane: v.lane || undefined,
    jalur: v.jalur || undefined,
    latitude: v.latitude || undefined,
    longitude: v.longitude || undefined
  };
}

export async function createIncident(v: IncidentFormValues): Promise<IncidentItem> {
  return first(await api.post<IncidentItem[] | IncidentItem>("/admin/incidents", toPayload(v)));
}

export async function updateIncident(id: number, v: IncidentFormValues): Promise<IncidentItem> {
  return first(await api.put<IncidentItem[] | IncidentItem>(`/admin/incidents/${id}`, toPayload(v)));
}

export async function setIncidentStatus(id: number, status: number): Promise<IncidentItem> {
  return first(await api.patch<IncidentItem[] | IncidentItem>(`/admin/incidents/${id}/status`, { status }));
}

export function deleteIncident(id: number): Promise<unknown> {
  return api.delete(`/admin/incidents/${id}`);
}
