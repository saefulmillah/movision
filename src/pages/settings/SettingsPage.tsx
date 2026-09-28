import { useMemo, useState } from "react";
import { Button, Icon, Select, Switch, useToast } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/constants/rbac";
import { ACCENTS, DEFAULT_SETTINGS, applySettings, loadSettings, saveSettings } from "@/lib/settings";
import type { AppSettings } from "@/lib/settings";
import { BASE_URL } from "@/lib/api";
import styles from "./settings.module.css";

type BoolKey = { [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never }[keyof AppSettings];
type StrKey = { [K in keyof AppSettings]: AppSettings[K] extends string ? K : never }[keyof AppSettings];

interface CatMeta {
  key: string;
  label: string;
  icon: string;
  desc: string;
}
const CATEGORIES: CatMeta[] = [
  { key: "umum", label: "Umum", icon: "sliders-horizontal", desc: "Bahasa, zona waktu, dan penyegaran data." },
  { key: "tampilan", label: "Tampilan", icon: "palette", desc: "Tema, warna aksen, dan kepadatan antarmuka." },
  { key: "cctv", label: "CCTV", icon: "cctv", desc: "Sumber stream dan tata letak dinding kamera." },
  { key: "peta", label: "Peta & Cuaca", icon: "map", desc: "Peta dasar, layer cuaca, dan jaringan FO." },
  { key: "sos", label: "Notifikasi SOS", icon: "siren", desc: "Alarm dan notifikasi kejadian." },
  { key: "koneksi", label: "Koneksi", icon: "plug", desc: "Backend, autentikasi, dan realtime." },
  { key: "akun", label: "Akun", icon: "user", desc: "Identitas operator dan keamanan." }
];

const sel = (v: string, l: string): SelectOption => ({ value: v, label: l });

export function SettingsPage() {
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const { capability } = useAuth();

  const [cat, setCat] = useState("umum");
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [dirty, setDirty] = useState(false);

  const setBool = (k: BoolKey, v: boolean) => {
    setSettings((s) => {
      const next = { ...s, [k]: v };
      applySettings(next);
      return next;
    });
    setDirty(true);
  };
  const setStr = (k: StrKey, v: string) => {
    setSettings((s) => {
      const next = { ...s, [k]: v };
      applySettings(next);
      return next;
    });
    setDirty(true);
  };

  function handleSave() {
    saveSettings(settings);
    applySettings(settings);
    setDirty(false);
    toast.success("Pengaturan disimpan");
  }
  function handleReset() {
    setSettings({ ...DEFAULT_SETTINGS });
    applySettings(DEFAULT_SETTINGS);
    setDirty(true);
    toast.info("Dikembalikan ke default", "Tekan Simpan untuk menerapkan permanen");
  }

  const activeCat = useMemo(() => CATEGORIES.find((c) => c.key === cat)!, [cat]);

  return (
    <div className={styles.page}>
      <nav className={styles.catList}>
        {CATEGORIES.map((c) => (
          <button key={c.key} className={styles.catItem} data-active={cat === c.key || undefined} onClick={() => setCat(c.key)} type="button">
            <Icon name={c.icon} size={17} />
            {c.label}
          </button>
        ))}
      </nav>

      <div className={styles.content}>
        <div className={styles.scroll}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>{activeCat.label}</div>
            <div className={styles.panelDesc}>{activeCat.desc}</div>

            {cat === "umum" && (
              <>
                <SelectRow label="Bahasa antarmuka" desc="Bahasa teks pada aplikasi." value={settings.language} onChange={(v) => setStr("language", v)} options={[sel("id", "Bahasa Indonesia"), sel("en", "English")]} />
                <SelectRow label="Zona waktu" desc="Zona waktu tampilan jam & waktu kejadian." value={settings.timezone} onChange={(v) => setStr("timezone", v)} options={[sel("Asia/Jakarta", "WIB (Jakarta)"), sel("Asia/Makassar", "WITA (Makassar)"), sel("Asia/Jayapura", "WIT (Jayapura)")]} />
                <SelectRow label="Interval penyegaran data" desc="Seberapa sering snapshot diperbarui." value={settings.refreshInterval} onChange={(v) => setStr("refreshInterval", v)} options={[sel("10", "10 detik"), sel("30", "30 detik"), sel("60", "60 detik")]} />
                <ToggleRow label="Mode layar penuh native" desc="Picu fullscreen jendela saat masuk mode ruang kendali." value={settings.fullscreenNative} onChange={(v) => setBool("fullscreenNative", v)} />
              </>
            )}

            {cat === "tampilan" && (
              <>
                <SelectRow label="Tema" desc="Diterapkan langsung tanpa menyimpan." value={theme} onChange={(v) => setTheme(v as "dark" | "light")} options={[sel("dark", "Gelap"), sel("light", "Terang")]} />
                <SelectRow label="Warna aksen" desc="Warna sorotan tombol dan elemen aktif." value={settings.accent} onChange={(v) => setStr("accent", v)} options={Object.keys(ACCENTS).map((a) => sel(a, a[0].toUpperCase() + a.slice(1)))} />
                <SelectRow label="Kepadatan" desc="Kerapatan spasi antarmuka." value={settings.density} onChange={(v) => setStr("density", v)} options={[sel("comfortable", "Nyaman"), sel("compact", "Padat")]} />
                <ToggleRow label="Animasi marker" desc="Denyut pada marker kritis dan SOS." value={settings.markerAnimation} onChange={(v) => setBool("markerAnimation", v)} />
              </>
            )}

            {cat === "cctv" && (
              <>
                <SelectRow label="Sumber stream" desc="Endpoint pemutaran HLS." value={settings.streamSource} onChange={(v) => setStr("streamSource", v)} options={[sel("auto", "Otomatis"), sel("public", "Publik"), sel("internal", "Internal")]} />
                <SelectRow label="Tata letak default" desc="Grid awal dinding kamera." value={settings.defaultGrid} onChange={(v) => setStr("defaultGrid", v)} options={[sel("2", "2×2"), sel("3", "3×3"), sel("4", "4×4")]} />
                <ToggleRow label="Sambung ulang otomatis" desc="Coba ulang stream yang terputus." value={settings.autoReconnect} onChange={(v) => setBool("autoReconnect", v)} />
                <ToggleRow label="Overlay nama kamera" desc="Tampilkan nama & status di atas tile." value={settings.overlayName} onChange={(v) => setBool("overlayName", v)} />
              </>
            )}

            {cat === "peta" && (
              <>
                <SelectRow label="Peta dasar" desc="Gaya basemap Google Maps." value={settings.basemap} onChange={(v) => setStr("basemap", v)} options={[sel("theme", "Ikuti tema"), sel("light", "Terang"), sel("satellite", "Satelit")]} />
                <ToggleRow label="Layer cuaca" desc="Tampilkan titik cuaca pada peta." value={settings.weatherLayer} onChange={(v) => setBool("weatherLayer", v)} />
                <SelectRow label="Refresh cuaca" desc="Interval pembaruan data cuaca." value={settings.weatherRefresh} onChange={(v) => setStr("weatherRefresh", v)} options={[sel("5", "5 menit"), sel("10", "10 menit"), sel("30", "30 menit")]} />
                <ToggleRow label="Arc jaringan FO" desc="Gambar koneksi FO antar titik." value={settings.foArcs} onChange={(v) => setBool("foArcs", v)} />
              </>
            )}

            {cat === "sos" && (
              <>
                <ToggleRow label="Suara alarm" desc="Bunyikan alarm saat SOS baru." value={settings.alarmSound} onChange={(v) => setBool("alarmSound", v)} />
                <ToggleRow label="Popup otomatis" desc="Buka worklist saat tiket baru masuk." value={settings.autoPopup} onChange={(v) => setBool("autoPopup", v)} />
                <ToggleRow label="Notifikasi gerbang bermasalah" desc="Beri tahu saat gerbang error/offline." value={settings.gateNotif} onChange={(v) => setBool("gateNotif", v)} />
                <ToggleRow label="Notifikasi WIM offline" desc="Beri tahu saat site WIM terputus." value={settings.wimNotif} onChange={(v) => setBool("wimNotif", v)} />
              </>
            )}

            {cat === "koneksi" && (
              <>
                <ReadonlyRow label="URL backend" desc="Alamat API yang dipakai aplikasi." value={BASE_URL} />
                <SelectRow label="Mode autentikasi" desc="Metode verifikasi token." value={settings.authMode} onChange={(v) => setStr("authMode", v)} options={[sel("jwt", "JWT lokal"), sel("oidc", "Hybrid OIDC")]} />
                <ToggleRow label="Sambung ulang SSE" desc="Reconnect otomatis dengan jeda bertingkat." value={settings.sseReconnect} onChange={(v) => setBool("sseReconnect", v)} />
                <SelectRow label="Timeout permintaan" desc="Batas waktu tiap request." value={settings.requestTimeout} onChange={(v) => setStr("requestTimeout", v)} options={[sel("10", "10 detik"), sel("15", "15 detik"), sel("30", "30 detik")]} />
              </>
            )}

            {cat === "akun" && (
              <>
                <ReadonlyRow label="Nama operator" desc="Nama tampilan akun aktif." value={capability?.user.display_name || capability?.user.username || "—"} />
                <ReadonlyRow label="Peran" desc="Role efektif akun." value={(capability?.roles || []).map(roleLabel).join(", ") || "—"} />
                <ReadonlyRow label="Ruas cakupan" desc="Branch scope akun." value={capability?.branch_scopes?.length ? `${capability.branch_scopes.length} ruas` : "Seluruh ruas"} />
                <div className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowLabel}>Ubah kata sandi</div>
                    <div className={styles.rowDesc}>Perubahan kata sandi dilakukan oleh super admin melalui menu Pengguna & Akses.</div>
                  </div>
                  <div className={styles.rowControl}>
                    <Button variant="secondary" icon="key-round" disabled>Ubah</Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" icon="refresh-cw" onClick={handleReset}>Reset</Button>
          <Button variant="primary" icon="check" onClick={handleSave} disabled={!dirty}>Simpan Perubahan</Button>
        </div>
      </div>
    </div>
  );
}

/* ---- Baris ---- */
function SelectRow({ label, desc, value, onChange, options }: { label: string; desc: string; value: string; onChange: (v: string) => void; options: SelectOption[] }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      <div className={styles.rowControl}>
        <Select value={value} onValueChange={onChange} options={options} ariaLabel={label} />
      </div>
    </div>
  );
}
function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      <div className={styles.rowControl}>
        <Switch checked={value} onCheckedChange={onChange} ariaLabel={label} />
      </div>
    </div>
  );
}
function ReadonlyRow({ label, desc, value }: { label: string; desc: string; value: string }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      <div className={styles.rowControl}>
        <span className={styles.readonly}>{value}</span>
      </div>
    </div>
  );
}
