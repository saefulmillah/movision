/* Preferensi klien TollSentra — disimpan lokal, dipulihkan saat aplikasi dibuka. */

export interface AppSettings {
  // Umum
  language: string;
  timezone: string;
  refreshInterval: string;
  fullscreenNative: boolean;
  // Tampilan (tema diurus ThemeContext terpisah)
  accent: string;
  density: string;
  markerAnimation: boolean;
  // CCTV
  streamSource: string;
  defaultGrid: string;
  autoReconnect: boolean;
  overlayName: boolean;
  // Peta & Cuaca
  basemap: string;
  weatherLayer: boolean;
  weatherRefresh: string;
  foArcs: boolean;
  // Notifikasi SOS
  alarmSound: boolean;
  autoPopup: boolean;
  gateNotif: boolean;
  wimNotif: boolean;
  // Koneksi
  authMode: string;
  sseReconnect: boolean;
  requestTimeout: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "id",
  timezone: "Asia/Jakarta",
  refreshInterval: "30",
  fullscreenNative: false,
  accent: "blue",
  density: "comfortable",
  markerAnimation: true,
  streamSource: "auto",
  defaultGrid: "3",
  autoReconnect: true,
  overlayName: true,
  basemap: "theme",
  weatherLayer: true,
  weatherRefresh: "10",
  foArcs: true,
  alarmSound: true,
  autoPopup: true,
  gateNotif: true,
  wimNotif: false,
  authMode: "jwt",
  sseReconnect: true,
  requestTimeout: "15"
};

const STORAGE_KEY = "tollsentra.settings";

export const ACCENTS: Record<string, string> = {
  blue: "#5A8DFF",
  cyan: "#22D3EE",
  green: "#34D399",
  purple: "#A78BFA",
  amber: "#FBBF24"
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    /* fallback default */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/** Terapkan preferensi yang berpengaruh langsung ke tampilan. */
export function applySettings(s: AppSettings): void {
  const accent = ACCENTS[s.accent] ?? ACCENTS.blue;
  document.documentElement.style.setProperty("--st-blue", accent);
}
