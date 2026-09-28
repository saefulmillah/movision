import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/ui/Icon";

function FullScreenLoader() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100%",
        background: "var(--app-bg)",
        color: "var(--text-muted)",
        gap: 10
      }}
    >
      <Icon name="radio-tower" size={30} />
      <span style={{ fontSize: "var(--fs-sm)" }}>Memuat…</span>
    </div>
  );
}

/** Hanya untuk pengguna terautentikasi; selain itu diarahkan ke /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullScreenLoader />;
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Hanya untuk super_admin (mis. /admin/users). Selain itu tampilkan 403. */
export function RequireRole({ role, children }: { role: string; children: ReactNode }) {
  const { hasRole } = useAuth();
  if (!hasRole(role)) {
    return <Navigate to="/403" replace />;
  }
  return <>{children}</>;
}

/** Butuh akses module tertentu (min. `read`), selaras dengan gate API backend. */
export function RequireModule({ module, children }: { module: string; children: ReactNode }) {
  const { moduleLevel } = useAuth();
  const level = moduleLevel(module);
  if (!level || level === "none") {
    return <Navigate to="/403" replace />;
  }
  return <>{children}</>;
}
