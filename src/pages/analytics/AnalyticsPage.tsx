import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Icon, Tabs } from "@/components/ui";
import { usePolling } from "@/lib/usePolling";
import {
  getAudience,
  getMonthly,
  getPeakHours,
  getRealtime,
  getRetention,
  getScreens,
  getStability,
  getUsers,
  getVersions
} from "@/lib/analytics";
import type { AnalyticsDays, MonthlyData, UsersData } from "@/types/analytics";
import { Kpi, Panel, StateBox } from "@/pages/operasional/insightsShared";
import shared from "@/pages/operasional/insights.module.css";
import styles from "./AnalyticsPage.module.css";

/* ============================================================
   Analitik aplikasi Mozy — data asli Google Analytics 4 (Firebase).
   Diporting dari mozy-dashboard (tab Perilaku + Stabilitas).
   ============================================================ */

const DAY_OPTIONS: { value: AnalyticsDays; label: string }[] = [
  { value: "7", label: "7 hari" },
  { value: "28", label: "28 hari" },
  { value: "90", label: "90 hari" },
  { value: "365", label: "1 tahun" },
  { value: "0", label: "Semua" }
];

// Warna seri mengikuti token tema (gelap/terang).
const SERIES = { android: "var(--st-blue)", ios: "var(--sem-cyan)" };
const AXIS = { fontSize: 10, fill: "var(--text-faint)" };
const tooltipStyle: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--line-strong)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text)"
};
const cursorFill = { fill: "var(--line-soft)" };

/* ---------- Format ---------- */

const num = (n: number) => n.toLocaleString("id-ID");
const pct = (n: number, digits = 1) =>
  `${n.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const monthLabel = (ym: string, year = false) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", year ? { month: "long", year: "numeric" } : { month: "short" });
};
const duration = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)} mnt ${Math.round(sec % 60)} dtk` : `${Math.round(sec)} dtk`);
/** "HomecomingInfoDetail" → "Homecoming Info Detail" */
const screenLabel = (name: string) => name.replace(/([a-z])([A-Z])/g, "$1 $2");
const currentMonth = () => new Date().toISOString().slice(0, 7);
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
/** Intensitas aksen: 0..1 → warna aksen transparan. */
const heat = (t: number) => `color-mix(in srgb, var(--st-blue) ${Math.round(t * 100)}%, transparent)`;

/* ---------- Komponen kecil ---------- */

function Source({ children }: { children: ReactNode }) {
  return (
    <div className={styles.source}>
      <span className={styles.liveBadge}>
        <Icon name="circle-check" size={12} /> Data asli
      </span>
      <span>{children}</span>
    </div>
  );
}

function Body({ loading, error, empty, children }: { loading: boolean; error: string | null; empty: boolean; children: ReactNode }) {
  if (loading && empty) return <StateBox loading />;
  if (error) return <StateBox error={error} />;
  if (empty) return <StateBox empty />;
  return <>{children}</>;
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <span className={shared.legend}>
      {items.map((i) => (
        <span key={i.label}>
          <span className={shared.sw} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </span>
  );
}

function HBar({ label, value, max, display, tone }: { label: ReactNode; value: number; max: number; display: string; tone?: string }) {
  return (
    <li className={styles.hbar}>
      <div className={styles.hbarRow}>
        <span className={styles.hbarLabel}>{label}</span>
        <span className={styles.hbarValue}>{display}</span>
      </div>
      <div className={shared.bar}>
        <span style={{ width: `${(value / Math.max(1, max)) * 100}%`, background: tone ?? "var(--st-blue)" }} />
      </div>
    </li>
  );
}

/* ---------- Halaman ---------- */

export function AnalyticsPage() {
  const [days, setDays] = useState<AnalyticsDays>("28");
  const users = usePolling(() => getUsers(days), 0, [days]);
  const u = users.data;

  return (
    <div className={shared.page}>
      <div className={shared.header}>
        <div className={shared.titleBox}>
          <h1 className={shared.title}>Analitik Aplikasi</h1>
          <div className={shared.sub}>Pengguna, perilaku, dan stabilitas aplikasi dari Google Analytics (Firebase).</div>
        </div>
      </div>

      <div className={shared.filterBar}>
        <Tabs value={days} onValueChange={(v) => setDays(v as AnalyticsDays)} items={DAY_OPTIONS} />
        {u && (
          <span className={shared.asOf}>
            {days === "0" ? longDate(u.range.from) : dayLabel(u.range.from)} – {longDate(u.range.to)}
          </span>
        )}
        <div className={shared.spacer} />
        <RealtimeChip />
      </div>

      {users.error && !u ? (
        <StateBox error={users.error} />
      ) : (
        <div className={shared.kpiRow}>
          <Kpi
            label="Pengguna aktif"
            value={u ? num(u.totals.users) : "–"}
            sub={u ? `Android ${num(u.totals.android)} · iOS ${num(u.totals.ios)}` : "Memuat…"}
            tone="accent"
          />
          <Kpi
            label="Pengguna baru"
            value={u ? num(u.totals.newUsers) : "–"}
            sub={u ? `${pct((u.totals.newUsers / Math.max(1, u.totals.users)) * 100, 0)} dari pengguna aktif` : "Memuat…"}
            tone="good"
          />
          <Kpi
            label="Uninstall"
            value={u ? num(u.totals.uninstalls) : "–"}
            sub={
              u ? (
                <span className={u.totals.newUsers - u.totals.uninstalls >= 0 ? shared.chgGood : shared.chgBad}>
                  Pertumbuhan bersih {u.totals.newUsers - u.totals.uninstalls >= 0 ? "+" : ""}
                  {num(u.totals.newUsers - u.totals.uninstalls)}
                </span>
              ) : (
                "Memuat…"
              )
            }
            tone="critical"
          />
          <Kpi
            label="Waktu aktif / pengguna"
            value={u ? duration(u.sessions.engagementSecondsPerUser) : "–"}
            sub={
              u
                ? `${pct(u.sessions.engagedRate * 100, 0)} sesi aktif · ${u.sessions.perUser.toLocaleString("id-ID", { maximumFractionDigits: 1 })} sesi/pengguna`
                : "Memuat…"
            }
          />
        </div>
      )}

      <div className={styles.grid3}>
        <DailyUsersCard users={users} />
        <VersionsCard />
      </div>

      <MonthlyUsersCard />
      <ScreensCard days={days} />
      <PeakHoursCard days={days} />

      <div className={shared.grid2}>
        <RetentionCard />
        <AudienceCard days={days} />
      </div>

      <StabilityCard />
    </div>
  );
}

/* ---------- Realtime ---------- */

/** Pengguna aktif 30 menit terakhir; diminta ulang tiap 5 menit selama tab terlihat. */
function RealtimeChip() {
  const { data, refresh } = usePolling(getRealtime, 0);
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 5 * 60_000);
    return () => window.clearInterval(t);
  }, [refresh]);
  const at = data ? new Date(data.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <span
      className={styles.realtime}
      title={`Pengguna aktif dalam 30 menit terakhir · diperbarui tiap 5 menit${at ? ` · terakhir ${at}` : ""}`}
    >
      <span className={styles.dot} data-stale={data?.stale ? "true" : undefined} />
      <b>{data ? num(data.activeUsers) : "–"}</b>
      <span className={styles.muted}>
        sedang aktif{data ? ` · Android ${num(data.android)} · iOS ${num(data.ios)} · ${at}` : ""}
        {data?.stale && " (data terakhir)"}
      </span>
    </span>
  );
}

/* ---------- Pengguna harian ---------- */

function DailyUsersCard({ users }: { users: { data: UsersData | null; loading: boolean; error: string | null } }) {
  const daily = users.data?.daily ?? [];
  const data = daily.map((d) => ({ ...d, label: daily.length > 366 ? longDate(d.date) : dayLabel(d.date) }));
  return (
    <Panel
      className={styles.span2}
      title="Pengguna Aktif Harian"
      right={<Legend items={[{ label: "Android", color: SERIES.android }, { label: "iOS", color: SERIES.ios }]} />}
    >
      <Body loading={users.loading} error={users.error} empty={!daily.length}>
        <div className={shared.chartBox}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }} maxBarSize={44} barCategoryGap={daily.length > 60 ? 0 : "18%"}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} allowDecimals={false} tickFormatter={num} />
              <Tooltip contentStyle={tooltipStyle} cursor={cursorFill} formatter={(v: number, n: string) => [num(v), n]} />
              <Bar dataKey="android" name="Android" stackId="p" fill={SERIES.android} isAnimationActive={false} />
              <Bar dataKey="ios" name="iOS" stackId="p" fill={SERIES.ios} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Body>
      <Source>Google Analytics · pengguna aktif per hari, per platform</Source>
    </Panel>
  );
}

/* ---------- Versi aplikasi ---------- */

function VersionsCard() {
  const { data, loading, error } = usePolling(() => getVersions("7"), 0);
  return (
    <Panel title="Versi Aplikasi" right={<span className={styles.muted}>7 hari terakhir</span>}>
      <Body loading={loading} error={error} empty={!data}>
        <div className={styles.stack}>
          {data?.platforms.map((p) => {
            const total = p.versions.reduce((s, v) => s + v.users, 0);
            const [main, ...others] = p.versions;
            return (
              <div key={p.platform}>
                <div className={styles.hbarRow}>
                  <b>{p.platform === "ios" ? "iOS" : "Android"}</b>
                  <span className={styles.muted}>{num(total)} pengguna</span>
                </div>
                {main && (
                  <>
                    <div className={shared.bar} style={{ marginTop: 6 }}>
                      <span style={{ width: `${(main.users / Math.max(1, total)) * 100}%`, background: SERIES[p.platform] }} />
                    </div>
                    <p className={styles.note}>
                      <b>{pct((main.users / Math.max(1, total)) * 100, 0)}</b> di versi {main.version}
                      {p.latest && p.latest !== main.version && <span className={styles.muted}> · terbaru {p.latest}</span>}
                    </p>
                    {others.length > 0 && (
                      <p className={`${styles.note} ${styles.muted}`}>
                        Versi lain: {others.slice(0, 5).map((v) => `${v.version} (${num(v.users)})`).join(", ")}
                        {others.length > 5 && ` +${others.length - 5} versi`}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Body>
      <Source>Google Analytics · versi aplikasi</Source>
    </Panel>
  );
}

/* ---------- Pengguna bulanan ---------- */

function MonthlyTooltip({ active, payload }: { active?: boolean; payload?: { payload: MonthlyData["months"][number] }[] }) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;
  return (
    <div style={{ ...tooltipStyle, padding: "8px 10px" }}>
      <b>{monthLabel(m.month, true)}</b>
      <div className={styles.muted}>
        <b style={{ color: "var(--text)" }}>{num(m.activeUsers)}</b> pengguna aktif · {num(m.newUsers)} baru
      </div>
      {m.month === currentMonth() && <div className={styles.muted}>Bulan berjalan — belum lengkap</div>}
    </div>
  );
}

function MonthlyUsersCard() {
  const { data, loading, error } = usePolling(getMonthly, 0);
  const [range, setRange] = useState<"24" | "all">("24");
  const all = (data?.months ?? []).filter((m) => m.activeUsers > 1);
  const months = range === "24" ? all.slice(-24) : all;
  const now = currentMonth();
  const peak = all.reduce<MonthlyData["months"][number] | null>((a, b) => (!a || b.activeUsers > a.activeUsers ? b : a), null);

  return (
    <Panel
      title={`Pengguna Aktif per Bulan${all.length ? ` · sejak ${monthLabel(all[0].month, true)}` : ""}`}
      right={
        <Tabs
          value={range}
          onValueChange={(v) => setRange(v as "24" | "all")}
          items={[
            { value: "24", label: "24 bulan" },
            { value: "all", label: "Semua" }
          ]}
        />
      }
    >
      <Body loading={loading} error={error} empty={!all.length}>
        <div className={shared.chartBox}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ left: 0, right: 8, top: 8 }} barCategoryGap={months.length > 40 ? 1 : "18%"}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={AXIS}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
                interval="preserveStartEnd"
                minTickGap={24}
                tickFormatter={(m: string) => monthLabel(m) + (range === "all" ? ` ${m.slice(2, 4)}` : "")}
              />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} allowDecimals={false} tickFormatter={num} />
              <Tooltip content={<MonthlyTooltip />} cursor={cursorFill} />
              <Bar dataKey="activeUsers" name="Pengguna aktif" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {months.map((m) => (
                  <Cell key={m.month} fill="var(--st-blue)" fillOpacity={m.month === now ? 0.4 : 0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {peak && (
          <p className={`${styles.note} ${styles.muted}`}>
            Tertinggi {monthLabel(peak.month, true)}: {num(peak.activeUsers)} pengguna aktif · batang pudar = bulan berjalan
          </p>
        )}
      </Body>
      <Source>Google Analytics · pengguna aktif & baru per bulan</Source>
    </Panel>
  );
}

/* ---------- Layar ---------- */

function ScreensCard({ days }: { days: AnalyticsDays }) {
  const { data, loading, error } = usePolling(() => getScreens(days), 0, [days]);
  const [showAll, setShowAll] = useState(false);
  const list = data?.screens ?? [];
  const shown = showAll ? list : list.slice(0, 12);
  const maxViews = Math.max(1, ...list.map((r) => r.views));
  const unnamed = list.find((r) => r.kind === "unnamed");
  const barColor = { named: "var(--st-blue)", unnamed: "var(--sem-amber)", system: "var(--text-faint)" } as const;

  return (
    <Panel
      title="Layar Paling Sering Dikunjungi"
      right={
        unnamed && data ? (
          <span className={styles.warnBadge}>
            <Icon name="triangle-alert" size={12} /> {pct((unnamed.views / Math.max(1, data.totalViews)) * 100, 0)} kunjungan belum diberi nama di aplikasi
          </span>
        ) : undefined
      }
    >
      <Body loading={loading} error={error} empty={!list.length}>
        <div className={styles.scrollX}>
          <table className={shared.table} style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th className={shared.rank}>#</th>
                <th>Layar</th>
                <th style={{ width: "38%" }}>Kunjungan</th>
                <th className={shared.num}>Pengguna</th>
                <th className={shared.num}>Waktu / pengguna</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.name}>
                  <td className={shared.rank}>{i + 1}</td>
                  <td>
                    {r.kind === "named" ? (
                      <b>{screenLabel(r.name)}</b>
                    ) : r.kind === "unnamed" ? (
                      <>
                        <b style={{ color: "var(--sem-amber)" }}>Tanpa nama</b>{" "}
                        <span className={styles.muted}>MainActivity / FlutterViewController</span>
                      </>
                    ) : (
                      <>
                        <b className={styles.muted}>Layar sistem</b> <span className={styles.muted}>login Google, browser, kamera</span>
                      </>
                    )}
                  </td>
                  <td>
                    <div className={styles.inlineBar}>
                      <div className={shared.bar} style={{ flex: 1 }}>
                        <span style={{ width: `${(r.views / maxViews) * 100}%`, background: barColor[r.kind] }} />
                      </div>
                      <b className={shared.num} style={{ width: 64 }}>{num(r.views)}</b>
                    </div>
                  </td>
                  <td className={shared.num} title={r.usersApprox ? "Gabungan beberapa kelas layar; jumlah pengguna unik minimal sebanyak ini" : undefined}>
                    {r.usersApprox && "≥ "}
                    {num(r.users)}
                  </td>
                  <td className={`${shared.num} ${styles.muted}`}>{duration(r.avgSecondsPerUser)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length > 12 && (
          <button type="button" className={styles.linkBtn} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Tampilkan 12 teratas" : `Tampilkan semua (${list.length} layar)`}
          </button>
        )}
      </Body>
      <Source>Google Analytics · layar & kelas layar. Layar “tanpa nama” perlu diberi nama di router Flutter</Source>
    </Panel>
  );
}

/* ---------- Jam sibuk ---------- */

function PeakHoursCard({ days }: { days: AnalyticsDays }) {
  const { data, loading, error } = usePolling(() => getPeakHours(days), 0, [days]);
  const [cell, setCell] = useState<{ day: number; hour: number } | null>(null);
  const grid = data?.grid ?? [];
  const max = Math.max(1, ...grid.flat());
  const peak = grid
    .flatMap((row, day) => row.map((v, hour) => ({ day, hour, v })))
    .reduce<{ day: number; hour: number; v: number } | null>((a, b) => (!a || b.v > a.v ? b : a), null);
  const hourLabel = (h: number) => `${String(h).padStart(2, "0")}.00`;

  return (
    <Panel
      title="Jam Sibuk Penggunaan (WIB)"
      right={
        <span className={styles.muted} aria-live="polite">
          {cell ? (
            <>
              <b style={{ color: "var(--text)" }}>{DAYS[cell.day]} {hourLabel(cell.hour)}</b> · {num(grid[cell.day][cell.hour])} sesi
            </>
          ) : peak ? (
            <>
              Puncak: <b style={{ color: "var(--text)" }}>{DAYS[peak.day]} {hourLabel(peak.hour)}</b> · {num(peak.v)} sesi
            </>
          ) : null}
        </span>
      }
    >
      <Body loading={loading} error={error} empty={!grid.length}>
        <div className={styles.scrollX}>
          <div className={styles.heatmap} onMouseLeave={() => setCell(null)}>
            {grid.map((row, day) => (
              <div key={day} className={styles.heatRow}>
                <span className={styles.heatDay}>{DAYS[day]}</span>
                {row.map((v, hour) => (
                  <div
                    key={hour}
                    onMouseEnter={() => setCell({ day, hour })}
                    className={styles.heatCell}
                    data-active={cell?.day === day && cell.hour === hour ? "true" : undefined}
                    // Satu hue (aksen); lantai 4% supaya sel sepi tetap terlihat.
                    style={{ background: heat(0.04 + (v / max) * 0.92) }}
                  />
                ))}
              </div>
            ))}
            <div className={styles.heatRow}>
              <span className={styles.heatDay} />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className={styles.heatHour}>
                  {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.heatLegend}>
          Sepi <span style={{ background: `linear-gradient(90deg, ${heat(0.04)}, ${heat(0.96)})` }} /> Ramai
        </div>
      </Body>
      <Source>Google Analytics · sesi per hari × jam</Source>
    </Panel>
  );
}

/* ---------- Retensi ---------- */

function RetentionCard() {
  const { data, loading, error } = usePolling(getRetention, 0);
  const cohorts = data?.cohorts ?? [];
  // Rata-rata tertimbang semua cohort yang sudah mencapai minggu ke-N.
  const curve = Array.from({ length: 6 }, (_, n) => {
    const reached = cohorts.filter((c) => c.weeks[n] !== null && c.weeks[n] !== undefined && c.users > 0);
    const base = reached.reduce((s, c) => s + c.users, 0);
    return { week: n, pct: base ? (reached.reduce((s, c) => s + (c.weeks[n] ?? 0), 0) / base) * 100 : 0 };
  });

  return (
    <Panel title="Retensi Pengguna">
      <p className={`${styles.note} ${styles.muted}`} style={{ marginTop: 0 }}>
        % pengguna baru yang masih membuka aplikasi di minggu ke-N
      </p>
      <Body loading={loading} error={error} empty={!cohorts.length}>
        <div className={styles.chartSm}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ left: 0, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--line)" }} tickFormatter={(w: number) => `Minggu ${w}`} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(w) => `Minggu ke-${w}`}
                formatter={(v: number) => [pct(v), "Masih aktif"]}
              />
              <Line type="monotone" dataKey="pct" stroke="var(--st-blue)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "var(--st-blue)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.scrollX}>
          <table className={styles.cohort}>
            <thead>
              <tr>
                <th>Minggu pertama</th>
                <th className={shared.num}>Pengguna</th>
                {[1, 2, 3, 4, 5].map((w) => (
                  <th key={w} style={{ textAlign: "center" }}>M{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.start}>
                  <td className={styles.muted}>{dayLabel(c.start)} – {dayLabel(c.end)}</td>
                  <td className={shared.num}>{num(c.users)}</td>
                  {c.weeks.slice(1, 6).map((v, i) => {
                    const p = v === null || !c.users ? null : (v / c.users) * 100;
                    return (
                      <td key={i}>
                        {p === null ? null : (
                          <div className={styles.cohortCell} style={{ background: heat(Math.min(0.75, 0.08 + (p / 40) * 0.6)) }}>
                            {Math.round(p)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Body>
      <Source>Google Analytics · cohort mingguan (Minggu–Sabtu)</Source>
    </Panel>
  );
}

/* ---------- Audiens ---------- */

function AudienceCard({ days }: { days: AnalyticsDays }) {
  const { data, loading, error } = usePolling(() => getAudience(days), 0, [days]);
  const label = (l: string) => (l === "(not set)" ? "Tidak diketahui" : l);
  const groups = data
    ? [
        { title: "Kota (perkiraan dari IP)", items: data.cities },
        { title: "Merek HP", items: data.brands },
        { title: "Versi OS", items: data.os },
        { title: "Sumber instalasi (pengguna baru)", items: data.sources }
      ]
    : [];

  return (
    <Panel title="Pengguna & Perangkat">
      <Body loading={loading} error={error} empty={!data}>
        <div className={styles.audience}>
          {groups.map((g) => {
            const max = Math.max(1, ...g.items.map((i) => i.value));
            return (
              <div key={g.title} style={{ minWidth: 0 }}>
                <p className={styles.groupTitle}>{g.title}</p>
                <ul className={styles.list}>
                  {g.items.slice(0, 5).map((i) => (
                    <HBar key={i.label} label={label(i.label)} value={i.value} max={max} display={num(i.value)} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Body>
      <Source>Google Analytics · kota, perangkat, OS, sumber pengguna pertama</Source>
    </Panel>
  );
}

/* ---------- Stabilitas ---------- */

function StabilityCard() {
  const { data, loading, error } = usePolling(() => getStability("28"), 0);
  const allZero = Boolean(data && data.platforms.length > 0 && data.platforms.every((p) => p.crashAffectedUsers === 0));
  return (
    <Panel title="Stabilitas Aplikasi" right={<span className={styles.muted}>Pengguna tanpa crash · 28 hari terakhir</span>}>
      <Body loading={loading} error={error} empty={!data?.platforms.length}>
        <div className={shared.grid2}>
          {data?.platforms.map((p) => (
            <div key={p.platform} className={styles.statBox}>
              <p className={styles.statLabel}>
                <Icon
                  name={p.crashFreeRate >= 0.99 ? "circle-check" : "triangle-alert"}
                  size={14}
                  style={{ color: p.crashFreeRate >= 0.99 ? "var(--sem-green)" : "var(--sem-amber)" }}
                />
                {p.platform === "ios" ? "iOS" : "Android"} · bebas crash
              </p>
              <p className={styles.statValue}>{pct(p.crashFreeRate * 100, 2)}</p>
              <p className={styles.muted}>
                {num(p.crashAffectedUsers)} dari {num(p.users)} pengguna mengalami crash
              </p>
            </div>
          ))}
        </div>
        {allZero && (
          <p className={styles.warnNote}>
            <Icon name="triangle-alert" size={14} />
            Tidak ada satu pun crash tercatat. Untuk aplikasi seukuran ini, kemungkinan besar Crashlytics belum terpasang atau
            belum aktif di aplikasi, jadi angka 100% belum bisa dipercaya.
          </p>
        )}
      </Body>
      <Source>Google Analytics · crashFreeUsersRate (Crashlytics)</Source>
    </Panel>
  );
}
