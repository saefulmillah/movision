/* ============================================================
   Kontrak /api/analytics/* — laporan Google Analytics 4 (Firebase)
   aplikasi Mozy. Bentuk payload sama dengan backend mozy-dashboard.
   `?days=` = 7 | 28 | 90 | 365 | 0 (semua), berakhir kemarin.
   ============================================================ */

export type AnalyticsDays = "7" | "28" | "90" | "365" | "0";
export type Platform = "android" | "ios";

export interface DateRange {
  from: string;
  to: string;
}

/** GET /analytics/status */
export interface AnalyticsStatus {
  analytics: boolean;
  bigquery: boolean;
}

/** GET /analytics/users?days= */
export interface UsersData {
  range: DateRange;
  daily: { date: string; android: number; ios: number }[];
  totals: { users: number; android: number; ios: number; newUsers: number; installs: number; uninstalls: number };
  sessions: { count: number; engagedRate: number; perUser: number; engagementSecondsPerUser: number };
}

/** GET /analytics/screens?days= */
export interface ScreenRow {
  name: string;
  kind: "named" | "unnamed" | "system";
  views: number;
  users: number;
  usersApprox?: boolean;
  avgSecondsPerUser: number;
}
export interface ScreensData {
  range: DateRange;
  screens: ScreenRow[];
  totalViews: number;
}

/** GET /analytics/versions?days= */
export interface VersionsData {
  range: DateRange;
  platforms: { platform: Platform; latest: string | null; versions: { version: string; users: number }[] }[];
}

/** GET /analytics/monthly */
export interface MonthlyData {
  months: { month: string; activeUsers: number; newUsers: number }[];
}

/** GET /analytics/peak-hours?days= → grid[hari 0=Sen..6=Min][jam 0..23] = sesi */
export interface PeakData {
  range: DateRange;
  grid: number[][];
}

export type Ranked = { label: string; value: number }[];

/** GET /analytics/audience?days= */
export interface AudienceData {
  range: DateRange;
  cities: Ranked;
  brands: Ranked;
  os: Ranked;
  sources: Ranked;
}

/** GET /analytics/retention → cohort mingguan; weeks[n] = pengguna aktif di minggu ke-n (null = belum dicapai) */
export interface RetentionData {
  cohorts: { start: string; end: string; users: number; weeks: (number | null)[] }[];
}

/** GET /analytics/stability?days= */
export interface StabilityData {
  range: DateRange;
  platforms: { platform: Platform; crashFreeRate: number; crashAffectedUsers: number; users: number }[];
}

/** GET /analytics/realtime → pengguna aktif 30 menit terakhir */
export interface RealtimeData {
  activeUsers: number;
  android: number;
  ios: number;
  at: string;
  stale: boolean;
}
