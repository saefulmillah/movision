import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth, RequireModule, RequirePermission, RequireRole } from "@/components/RouteGuards";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PetaPage } from "@/pages/peta/PetaPage";
import { CctvPage } from "@/pages/cctv/CctvPage";
import { SosPage } from "@/pages/sos/SosPage";
import { NewsPage } from "@/pages/news/NewsPage";
import { IncidentPage } from "@/pages/incident/IncidentPage";
import { FeedbackPage } from "@/pages/feedback/FeedbackPage";
import { LabaRugiPage } from "@/pages/laba-rugi/LabaRugiPage";
import { LabaRugiRegionalPage } from "@/pages/rapat-direktorat/laba-rugi-regional/LabaRugiRegionalPage";
import { ManajemenRisikoPage } from "@/pages/rapat-direktorat/manajemen-risiko/ManajemenRisikoPage";
import { PendapatanPage } from "@/pages/rapat-direktorat/pendapatan/PendapatanPage";
import { SentimenPage } from "@/pages/rapat-direktorat/sentimen/SentimenPage";
import { OdolPage } from "@/pages/operasional/OdolPage";
import { KecelakaanPage } from "@/pages/operasional/KecelakaanPage";
import { KendaraanBantuanPage } from "@/pages/operasional/KendaraanBantuanPage";
import { PeralatanPage } from "@/pages/operasional/PeralatanPage";
import { PresentasiPage } from "@/pages/presentasi/PresentasiPage";
import { AnalyticsPage } from "@/pages/analytics/AnalyticsPage";
import { DataTablePage } from "@/components/data-table/DataTablePage";
import {
  ruasConfig, gerbangConfig, kameraConfig, vmsConfig, cuacaConfig, foConfig, rakomConfig, wimSiteConfig
} from "@/pages/master-data/configs";
import { JaringanPage } from "@/pages/master-data/JaringanPage";
import { WimMonitoringPage } from "@/pages/wim/WimMonitoringPage";
import { MatriksTarifPage } from "@/pages/tarif/MatriksTarifPage";
import { PresentationOverlay } from "@/components/presentation/PresentationOverlay";
import { UsersPage } from "@/pages/users/UsersPage";
import { MenuManagerPage } from "@/pages/menu-manager/MenuManagerPage";
import { AksesPage } from "@/pages/admin/akses/AksesPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { useAuth } from "@/context/AuthContext";

/** Redirect /login → / bila sudah masuk. */
function LoginRoute() {
  const { status } = useAuth();
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/peta" element={<PetaPage />} />
        <Route path="/cctv" element={<CctvPage />} />
        <Route path="/sos" element={<SosPage />} />
        <Route path="/berita" element={<NewsPage />} />
        <Route path="/incident" element={<IncidentPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route
          path="/rapat-direktorat/laba-rugi"
          element={
            <RequireModule module="laba_rugi">
              <LabaRugiPage />
            </RequireModule>
          }
        />
        {/* Alias lama → path baru di bawah grup Rapat Direktorat. */}
        <Route path="/laba-rugi" element={<Navigate to="/rapat-direktorat/laba-rugi" replace />} />
        <Route
          path="/rapat-direktorat/laba-rugi-regional"
          element={
            <RequireModule module="laba_rugi_regional">
              <LabaRugiRegionalPage />
            </RequireModule>
          }
        />
        <Route
          path="/rapat-direktorat/manajemen-risiko"
          element={
            <RequireModule module="manajemen_risiko">
              <ManajemenRisikoPage />
            </RequireModule>
          }
        />
        <Route
          path="/rapat-direktorat/pendapatan"
          element={
            <RequireModule module="pendapatan">
              <PendapatanPage />
            </RequireModule>
          }
        />
        <Route
          path="/rapat-direktorat/sentimen"
          element={
            <RequireModule module="sentimen">
              <SentimenPage />
            </RequireModule>
          }
        />
        <Route
          path="/operasional/odol"
          element={<RequireModule module="insights"><OdolPage /></RequireModule>}
        />
        <Route
          path="/operasional/kecelakaan"
          element={<RequireModule module="insights"><KecelakaanPage /></RequireModule>}
        />
        <Route
          path="/operasional/kendaraan-bantuan"
          element={<RequireModule module="insights"><KendaraanBantuanPage /></RequireModule>}
        />
        <Route
          path="/operasional/peralatan"
          element={<RequireModule module="insights"><PeralatanPage /></RequireModule>}
        />
        <Route path="/tarif/matriks" element={<RequireModule module="tariff"><MatriksTarifPage /></RequireModule>} />
        {/* Alias lama → upload kini tombol+modal di Matriks Tarif. */}
        <Route path="/tarif/upload" element={<Navigate to="/tarif/matriks" replace />} />
        <Route path="/presentasi" element={<PresentasiPage />} />
        <Route
          path="/informasi-publik/analitik-aplikasi"
          element={
            <RequireModule module="app_analytics">
              <AnalyticsPage />
            </RequireModule>
          }
        />
        <Route path="/analytics" element={<Navigate to="/informasi-publik/analitik-aplikasi" replace />} />
        {/* ============ Data Induk (master data) ============ */}
        <Route path="/master-data/ruas" element={<RequireModule module="ruas"><DataTablePage config={ruasConfig} /></RequireModule>} />
        <Route path="/master-data/gerbang" element={<RequireModule module="gerbang"><DataTablePage config={gerbangConfig} /></RequireModule>} />
        <Route path="/master-data/kamera" element={<RequireModule module="kamera"><DataTablePage config={kameraConfig} /></RequireModule>} />
        <Route path="/master-data/vms" element={<RequireModule module="vms"><DataTablePage config={vmsConfig} /></RequireModule>} />
        <Route path="/master-data/cuaca" element={<RequireModule module="cuaca"><DataTablePage config={cuacaConfig} /></RequireModule>} />
        <Route path="/master-data/fo" element={<RequireModule module="fo"><DataTablePage config={foConfig} /></RequireModule>} />
        <Route path="/master-data/jaringan" element={<RequireModule module="fo"><JaringanPage /></RequireModule>} />
        <Route path="/master-data/rakom" element={<RequireModule module="rakom"><DataTablePage config={rakomConfig} /></RequireModule>} />

        {/* ============ WIM ============ */}
        <Route path="/wim/sites" element={<RequireModule module="wim"><DataTablePage config={wimSiteConfig} /></RequireModule>} />
        <Route path="/wim/monitoring" element={<RequirePermission permission="asset.view"><WimMonitoringPage /></RequirePermission>} />
        <Route path="/wim" element={<Navigate to="/wim/monitoring" replace />} />
        <Route
          path="/admin/users"
          element={
            <RequireRole role="super_admin">
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/menu"
          element={
            <RequireRole role="super_admin">
              <MenuManagerPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/akses"
          element={
            <RequirePermission permission="access.manage">
              <AksesPage />
            </RequirePermission>
          }
        />
        <Route path="/pengaturan" element={<SettingsPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    <PresentationOverlay />
    </>
  );
}
