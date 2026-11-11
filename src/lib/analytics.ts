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

// Konsumen /api/analytics/* — laporan Google Analytics 4 (Firebase) aplikasi Mozy.
// Semua GET & hanya baca. Backend menjawab 503 (GA_DISABLED) bila GA belum dikonfigurasi.

export const getAnalyticsStatus = () => api.get<AnalyticsStatus>("/analytics/status");
export const getRealtime = () => api.get<RealtimeData>("/analytics/realtime");
export const getUsers = (days: AnalyticsDays) => api.get<UsersData>(`/analytics/users?days=${days}`);
export const getMonthly = () => api.get<MonthlyData>("/analytics/monthly");
export const getScreens = (days: AnalyticsDays) => api.get<ScreensData>(`/analytics/screens?days=${days}`);
export const getVersions = (days: AnalyticsDays) => api.get<VersionsData>(`/analytics/versions?days=${days}`);
export const getPeakHours = (days: AnalyticsDays) => api.get<PeakData>(`/analytics/peak-hours?days=${days}`);
export const getAudience = (days: AnalyticsDays) => api.get<AudienceData>(`/analytics/audience?days=${days}`);
export const getRetention = () => api.get<RetentionData>("/analytics/retention");
export const getStability = (days: AnalyticsDays) => api.get<StabilityData>(`/analytics/stability?days=${days}`);
