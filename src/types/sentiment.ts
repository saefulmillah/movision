/* ============================================================
   Tipe modul Sentimen (Rapat Direktorat). Agregasi on-the-fly per scope
   dari raw mention (tag-based). Status wilayah dari %negatif:
   Aman <15, Perlu Atensi 15–30, Kritis >30.
   ============================================================ */

export type SentimentStatus = "aman" | "atensi" | "kritis";
export type RecoStatus = "open" | "in_progress" | "done";

export interface SentimentComposition {
  positive: number;
  neutral: number;
  negative: number;
  /** %negatif (1 desimal). */
  negPct: number;
}

export interface SentimentDaily {
  date: string; // YYYY-MM-DD
  total: number;
  negative: number;
}

export interface SentimentChannel {
  name: string;
  count: number;
}

export interface SentimentIssue {
  key: string;
  title: string;
  reach: number;
  total: number;
  negative: number;
  positive: number;
  link: string | null;
  date: string | null;
}

/** Isu yang ditandai "tidak relevan" (disembunyikan) untuk satu lingkup. */
export interface SentimentIrrelevant {
  id: number;
  issue_key: string;
  issue_title: string | null;
  created_at: string;
}

export interface SentimentRecommendation {
  id: number;
  issue_key: string;
  issue_title: string | null;
  action: string | null;
  pic: string | null;
  status: RecoStatus;
  updated_at: string;
}

export interface ScopeRef {
  key: string;
  level: string;
  label: string;
}

/** Data agregat satu scope (Slide Ringkasan & Isu). */
export interface SentimentScopeData {
  period_key: string;
  scope: ScopeRef;
  label: string;
  status: SentimentStatus;
  total: number;
  composition: SentimentComposition;
  reach: number;
  engagement: number;
  pr_value: number;
  daily: SentimentDaily[];
  channels: SentimentChannel[];
  issues: SentimentIssue[];
  positives: SentimentIssue[];
  narrative: string;
  recommendations: SentimentRecommendation[];
  /** Isu yang disembunyikan (tidak relevan) untuk lingkup ini. */
  irrelevant: SentimentIrrelevant[];
}

/** Kartu status satu anak-scope (Slide Peta Wilayah). */
export interface SentimentCard {
  key: string;
  label: string;
  level: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  negPct: number;
  status: SentimentStatus;
}

export interface SentimentTree {
  period_key: string;
  parent: ScopeRef;
  children: SentimentCard[];
}

/** Satu node pada pohon drill dashboard (divisi/regional/cabang). */
export interface SentimentNode {
  id: string;
  level: string;
  label: string;
  parentId: string | null;
  childrenIds: string[];
  mentions: number;
  status: SentimentStatus;
  negpct: number;
  composition: SentimentComposition;
  reach: number;
  engagement: number;
  pr_value: number;
  daily: SentimentDaily[];
  channels: SentimentChannel[];
  issues: SentimentIssue[];
  positives: SentimentIssue[];
  narrative: string;
  story: string[];
  recommendations: SentimentRecommendation[];
}

/** Pohon drill lengkap satu periode (root + keturunan yang diizinkan). */
export interface SentimentDashboard {
  period_key: string;
  root_id: string;
  nodes: Record<string, SentimentNode>;
}

export interface SentimentPeriod {
  key: string;
  label: string;
  source_file: string | null;
  mention_count: number;
  uploaded_at: string | null;
}

export interface SentimentUploadResult {
  period_key: string;
  period_label: string;
  mention_count: number;
  unmapped: string[];
}

export interface UpsertRecoInput {
  issue_key?: string;
  issue_title?: string;
  action?: string;
  pic?: string;
  status?: RecoStatus;
}
