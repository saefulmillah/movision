import { api } from "@/lib/api";
import type {
  AnalyticsDays,
  AnalyticsStatus,
  AudienceData,
  MonthlyData,
  PeakData,
  RealtimeData,
  RetentionData,
  ScreensData,
  StabilityData,
  UsersData,
  VersionsData
} from "@/types/analytics";

// Konsumen /api/app-analytics/* — laporan Google Analytics 4 (Firebase) aplikasi Mozy.
// Semua GET & hanya baca. Backend menjawab 503 (GA_DISABLED) bila GA belum dikonfigurasi.

export const getAnalyticsStatus = () => api.get<AnalyticsStatus>("/app-analytics/status");
export const getRealtime = () => api.get<RealtimeData>("/app-analytics/realtime");
export const getUsers = (days: AnalyticsDays) => api.get<UsersData>(`/app-analytics/users?days=${days}`);
export const getMonthly = () => api.get<MonthlyData>("/app-analytics/monthly");
export const getScreens = (days: AnalyticsDays) => api.get<ScreensData>(`/app-analytics/screens?days=${days}`);
export const getVersions = (days: AnalyticsDays) => api.get<VersionsData>(`/app-analytics/versions?days=${days}`);
export const getPeakHours = (days: AnalyticsDays) => api.get<PeakData>(`/app-analytics/peak-hours?days=${days}`);
export const getAudience = (days: AnalyticsDays) => api.get<AudienceData>(`/app-analytics/audience?days=${days}`);
export const getRetention = () => api.get<RetentionData>("/app-analytics/retention");
export const getStability = (days: AnalyticsDays) => api.get<StabilityData>(`/app-analytics/stability?days=${days}`);
