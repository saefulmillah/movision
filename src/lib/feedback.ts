import { api } from "@/lib/api";
import { buildQuery, paged } from "@/lib/news";
import type { PagedResult } from "@/lib/news";
import type { FeedbackItem } from "@/types/modules";

function first<T>(data: T[] | T): T {
  return Array.isArray(data) ? data[0] : data;
}

export interface FeedbackListParams {
  page?: number;
  per_page?: number;
  category?: string;
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export async function fetchFeedback(params: FeedbackListParams = {}): Promise<PagedResult<FeedbackItem>> {
  const { data, meta } = await api.getWithMeta<FeedbackItem[]>(`/admin/feedback${buildQuery(params)}`);
  return paged(data, meta, params.page, params.per_page);
}

export async function fetchFeedbackDetail(id: number): Promise<FeedbackItem> {
  return first(await api.get<FeedbackItem[] | FeedbackItem>(`/admin/feedback/${id}`));
}

export async function updateFeedback(id: number, body: { admin_answer?: string; category_id?: number }): Promise<FeedbackItem> {
  return first(await api.put<FeedbackItem[] | FeedbackItem>(`/admin/feedback/${id}`, body));
}

export async function replyFeedback(id: number, message: string, image?: string): Promise<FeedbackItem> {
  return first(await api.post<FeedbackItem[] | FeedbackItem>(`/admin/feedback/${id}/replies`, { message, image }));
}

export async function updateReply(id: number, replyId: number, message: string): Promise<FeedbackItem> {
  return first(await api.put<FeedbackItem[] | FeedbackItem>(`/admin/feedback/${id}/replies/${replyId}`, { message }));
}

export function deleteReply(id: number, replyId: number): Promise<unknown> {
  return api.delete(`/admin/feedback/${id}/replies/${replyId}`);
}

export function deleteFeedback(id: number): Promise<unknown> {
  return api.delete(`/admin/feedback/${id}`);
}
