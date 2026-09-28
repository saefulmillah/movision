/* ============================================================
   Tipe modul admin: News, Incident, Feedback.
   Cocok dengan payload backend cctv-backend (DB SOS).
   ============================================================ */

export interface BranchRef {
  branch_id: number;
  branch_code: string | null;
  branch_name: string | null;
}

export interface UserRef {
  id_user: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  image_url: string | null;
}

/* ---------- News ---------- */
export interface NewsItem {
  id: number;
  title: string | null;
  content: string | null;
  image: string | null;
  image_url: string | null;
  category: number | null;
  source: string | null;
  author: string | null;
  posted_by: string | null;
  status: number | null; // 1 = published (is_open), 0 = draft
  is_published: boolean;
  published_at: string | null;
  posted_at: string | null;
}

export interface NewsFormValues {
  title: string;
  content: string;
  category: string;
  source: string;
  author: string;
  image: string;
  status: number;
  /** Format datetime-local "YYYY-MM-DDTHH:mm" untuk posted_at. */
  published_at: string;
}

/* ---------- Incident ---------- */
export interface IncidentType {
  id: number;
  incident_name: string | null;
  incident_code: string | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface IncidentItem {
  id: number;
  incident_type_id: number | null;
  incident_type: { id: number; incident_name: string | null; incident_code: string | null } | null;
  user_id: number | null;
  branch_id: number | null;
  branch: BranchRef | null;
  incident_name: string | null;
  incident_detail: string | null;
  incident_command: string | null;
  status: number | null;
  handling: string | null;
  latitude: string | null;
  longitude: string | null;
  km: string | null;
  lane: string | null;
  jalur: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface IncidentFormValues {
  incident_type_id: string;
  incident_detail: string;
  incident_name: string;
  incident_command: string;
  branch_id: string;
  status: string;
  handling: string;
  km: string;
  lane: string;
  jalur: string;
  latitude: string;
  longitude: string;
}

/* ---------- Feedback ---------- */
export interface FeedbackReply {
  id: number;
  feedback_id: number;
  role: "user" | "admin" | null;
  message: string | null;
  image: string | null;
  image_url: string | null;
  user: UserRef | null;
  created_at: string | null;
}

export interface FeedbackItem {
  id: number;
  category_id: number | null;
  category: { id: number; name: string | null } | null;
  user: UserRef | null;
  branch: BranchRef | null;
  branch_id: number | null;
  message: string | null;
  image: string | null;
  image_url: string | null;
  admin_answer: string | null;
  status: number; // 0 = baru, 1 = terjawab (derived)
  status_label: string;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  replies?: FeedbackReply[];
}
