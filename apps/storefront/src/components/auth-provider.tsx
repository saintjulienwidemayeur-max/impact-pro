"use client";

import * as React from "react";
import { fetchMe, loginAccount, logoutAccount, registerAccount, type AccountUser, type RegisterInput } from "@/lib/account-api";

type Status = "loading" | "guest" | "authenticated";

interface AuthContextValue {
  user: AccountUser | null;
  status: Status;
  /** Re-reads the session from the server (e.g. after the tab regains focus). */
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<AccountUser>;
  register: (input: RegisterInput) => Promise<AccountUser>;
  logout: () => Promise<void>;
  setUser: (user: AccountUser) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * Session state for the whole site. The session itself lives in an HTTP-only cookie managed by the API; this provider
 * only mirrors « who am I » (GET /auth/me) so the header, checkout and account pages can adapt. Nothing is stored in
 * localStorage.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = React.useState<AccountUser | null>(null);
  const [status, setStatus] = React.useState<Status>("loading");

  const apply = React.useCallback((u: AccountUser | null) => {
    setUserState(u);
    setStatus(u ? "authenticated" : "guest");
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      apply(await fetchMe());
    } catch {
      // API unreachable: keep the current state instead of flashing a logged-out UI.
      setStatus((s) => (s === "loading" ? "guest" : s));
    }
  }, [apply]);

  React.useEffect(() => {
    void refresh();
    // A sign-in / sign-out in another tab: re-check when this tab becomes visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      refresh,
      setUser: (u) => apply(u),
      login: async (email, password) => {
        const u = await loginAccount(email, password);
        apply(u);
        return u;
      },
      register: async (input) => {
        const u = await registerAccount(input);
        apply(u);
        return u;
      },
      logout: async () => {
        try {
          await logoutAccount();
        } finally {
          apply(null);
        }
      },
    }),
    [user, status, refresh, apply],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** « Marie Joseph » → « M », for the avatar in the header. */
export function initialOf(user: Pick<AccountUser, "fullName" | "email">): string {
  const source = (user.fullName ?? user.email).trim();
  return (source[0] ?? "?").toUpperCase();
}
