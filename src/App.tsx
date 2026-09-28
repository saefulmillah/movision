import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth, RequireModule, RequireRole } from "@/components/RouteGuards";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PetaPage } from "@/pages/peta/PetaPage";
import { CctvPage } from "@/pages/cctv/CctvPage";
import { SosPage } from "@/pages/sos/SosPage";
import { NewsPage } from "@/pages/news/NewsPage";
import { IncidentPage } from "@/pages/incident/IncidentPage";
import { FeedbackPage } from "@/pages/feedback/FeedbackPage";
import { LabaRugiPage } from "@/pages/laba-rugi/LabaRugiPage";
import { ManajemenRisikoPage } from "@/pages/rapat-direktorat/manajemen-risiko/ManajemenRisikoPage";
import { UsersPage } from "@/pages/users/UsersPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";
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
          path="/rapat-direktorat/manajemen-risiko"
          element={
            <RequireModule module="manajemen_risiko">
              <ManajemenRisikoPage />
            </RequireModule>
          }
        />
        <Route
          path="/wim"
          element={
            <PlaceholderPage
              icon="scale"
              title="Monitoring WIM"
              description="Pemantauan Weigh-in-Motion per site. Layar ini di luar lingkup fase ini; layer WIM tetap tampil di Peta dan kartu ringkasan di Dashboard."
            />
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireRole role="super_admin">
              <UsersPage />
            </RequireRole>
          }
        />
        <Route path="/pengaturan" element={<SettingsPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
