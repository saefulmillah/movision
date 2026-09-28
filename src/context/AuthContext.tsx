import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AUTH_UNAUTHORIZED_EVENT, getToken, setToken } from "@/lib/api";
import { fetchCapability, fetchMenus, login as loginRequest } from "@/lib/auth";
import type { Capability, MenuNode } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  capability: Capability | null;
  menus: MenuNode[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  moduleLevel: (moduleCode: string) => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [capability, setCapability] = useState<Capability | null>(null);
  const [menus, setMenus] = useState<MenuNode[]>([]);

  const loadSession = useCallback(async () => {
    try {
      const [cap, menuTree] = await Promise.all([fetchCapability(), fetchMenus()]);
      setCapability(cap);
      setMenus(menuTree || []);
      setStatus("authenticated");
    } catch {
      setToken(null);
      setCapability(null);
      setMenus([]);
      setStatus("unauthenticated");
    }
  }, []);

  // Pulihkan sesi saat aplikasi dibuka bila ada token tersimpan.
  useEffect(() => {
    if (getToken()) {
      void loadSession();
    } else {
      setStatus("unauthenticated");
    }
  }, [loadSession]);

  // 401 dari klien API → paksa logout.
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setCapability(null);
      setMenus([]);
      setStatus("unauthenticated");
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await loginRequest(username, password);
      setToken(result.token);
      setStatus("loading");
      await loadSession();
    },
    [loadSession]
  );

  const logout = useCallback(() => {
    setToken(null);
    setCapability(null);
    setMenus([]);
    setStatus("unauthenticated");
  }, []);

  const hasRole = useCallback((role: string) => !!capability?.roles?.includes(role), [capability]);

  const hasPermission = useCallback(
    (permission: string) => !!capability?.permissions?.includes(permission),
    [capability]
  );

  const moduleLevel = useCallback(
    (moduleCode: string) =>
      capability?.module_access?.find((m) => m.module_code === moduleCode)?.access_level ?? null,
    [capability]
  );

  const value = useMemo(
    () => ({ status, capability, menus, login, logout, hasRole, hasPermission, moduleLevel }),
    [status, capability, menus, login, logout, hasRole, hasPermission, moduleLevel]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
