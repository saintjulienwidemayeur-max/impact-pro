"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { api, ApiError, get, SESSION_EXPIRED_EVENT } from "./api";
import { can as canPerm, type Permission } from "./permissions";
import type { AdminMe } from "./types";

type Status = "loading" | "guest" | "staff";

interface AuthValue {
  user: AdminMe | null;
  status: Status;
  can: (p: Permission) => boolean;
  /** Signs in; throws ApiError (401 bad credentials, 403 not staff). */
  login: (email: string, password: string) => Promise<AdminMe>;
  logout: () => Promise<void>;
  refresh: () => Promise<AdminMe | null>;
  setUser: (u: AdminMe) => void;
}

const AuthContext = React.createContext<AuthValue | null>(null);
const IDLE_MS = Number(process.env.NEXT_PUBLIC_IDLE_MINUTES ?? 30) * 60_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AdminMe | null>(null);
  const [status, setStatus] = React.useState<Status>("loading");

  const apply = React.useCallback((u: AdminMe | null) => {
    setUser(u);
    setStatus(u ? "staff" : "guest");
  }, []);

  const refresh = React.useCallback(async (): Promise<AdminMe | null> => {
    try {
      const me = await get<AdminMe>("/admin/me");
      apply(me);
      return me;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) apply(null);
      else setStatus((s) => (s === "loading" ? "guest" : s));
      return null;
    }
  }, [apply]);

  React.useEffect(() => {
    void refresh();
    const expired = () => apply(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, [refresh, apply]);

  const logout = React.useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
    } catch {
      /* the cookie may already be gone */
    } finally {
      apply(null);
    }
  }, [apply]);

  // Idle logout: no pointer / key activity for IDLE_MS.
  React.useEffect(() => {
    if (status !== "staff") return;
    let timer = window.setTimeout(() => void logout(), IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void logout(), IDLE_MS);
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [status, logout]);

  const value = React.useMemo<AuthValue>(
    () => ({
      user,
      status,
      can: (p) => canPerm(user, p),
      refresh,
      setUser: (u) => apply(u),
      logout,
      login: async (email, password) => {
        await api("/auth/login", { method: "POST", body: { email, password } });
        const me = await refresh();
        if (!me) {
          // Valid credentials but not a staff account: do not keep the customer session open here.
          await logout();
          throw new ApiError("Accès réservé à l'équipe Impact Pro.", 403, "NOT_STAFF");
        }
        return me;
      },
    }),
    [user, status, refresh, apply, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Redirects guests to /login and staff with a temporary password to the change-password screen. */
export function useRequireStaff(): AuthValue {
  const auth = useAuth();
  const router = useRouter();
  React.useEffect(() => {
    if (auth.status === "guest") router.replace("/login");
    else if (auth.status === "staff" && auth.user?.mustChangePassword) router.replace("/changer-mot-de-passe");
  }, [auth.status, auth.user?.mustChangePassword, router]);
  return auth;
}
