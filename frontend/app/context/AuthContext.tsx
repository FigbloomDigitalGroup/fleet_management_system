"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";
import { isStaffRole } from "../lib/staffRoles";
import { User, LoginResponse, SupportView } from "../types/auth";
import { STAFF_SESSION_KEY, SUPPORT_VIEW_ENDED_EVENT, enterSupportSession, restoreStaffSession } from "../lib/supportView";

interface RegisterPayload {
  companyName: string;
  industry?: string;
  ownerName: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  // Starts a session from tokens already in hand (a pending registration
  // that was switched on while its owner waited on the "received" screen).
  adoptSession: (data: LoginResponse) => void;
  // returnTo: after a session timeout, the page to come back to once the
  // person signs in again.
  logout: (options?: { returnTo?: string }) => void;
  // True once the person (or a timeout) signed out, so protected pages don't
  // also redirect with their own ?next=.
  signedOut: boolean;
  // Figbloom staff: open a customer fleet read-only (support view), and leave it.
  startSupportView: (companyId: string) => Promise<void>;
  exitSupportView: () => Promise<void>;
}

interface RegisterResult {
  user: User;
  pending: boolean;
  // How a pending company gets switched on: the Figbloom console (usually a
  // minute or two), Figbloom staff ("manual"), or straight away ("auto").
  approval: "console" | "manual" | "auto";
  supportEmail?: string;
  // Only for a pending company: the tokens the API issued, kept in memory by
  // the caller (never stored) so it can check whether the company has been
  // switched on and sign the owner in without retyping their password.
  session?: LoginResponse;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Only this site's own pages are allowed as a place to return to after
// signing in (no "//evil.example" or full URLs), and never the sign-in pages.
export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return false;
  return !/^\/(login|register|forgot-password|reset-password)(\/|\?|$)/.test(path);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("accessToken");
    if (savedUser && savedToken) {
      const parsed: User = JSON.parse(savedUser);
      setUser(parsed);
      // The owner (or a full admin) can change a team member's role or an
      // admin's access level at any time, and the stored session only knows
      // them from login — re-read them so the UI matches what the server
      // will actually allow.
      if (parsed.role === "ADMIN" || isStaffRole(parsed.role)) {
        apiRequest<{ role?: User["role"]; adminAccess?: User["adminAccess"] }>("/api/users/me")
          .then((me) => {
            const role = me.role && (me.role === "ADMIN" || isStaffRole(me.role)) ? me.role : parsed.role;
            const adminAccess = role === "ADMIN" ? me.adminAccess || "full" : null;
            if (role === parsed.role && adminAccess === (parsed.adminAccess ?? null)) return;
            const next = { ...parsed, role, adminAccess };
            localStorage.setItem("user", JSON.stringify(next));
            setUser(next);
          })
          .catch(() => {});
      }
    }
    setLoading(false);
  }, []);

  // The API ended the support view (its hour ran out): the staff session is
  // already back (lib/supportView.ts), so take them back to their area.
  useEffect(() => {
    function onEnded(e: Event) {
      const staff = (e as CustomEvent<{ staff: User | null }>).detail?.staff;
      if (!staff) return;
      setUser(staff);
      router.push("/platform/dashboard");
    }
    window.addEventListener(SUPPORT_VIEW_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(SUPPORT_VIEW_ENDED_EVENT, onEnded);
  }, [router]);

  async function startSupportView(companyId: string) {
    if (!user || user.role !== "PLATFORM_ADMIN") throw new Error("Only Figbloom staff can open a customer fleet");
    const data = await apiRequest<{ token: string; session: SupportView & { id: string } }>("/api/support/sessions", {
      method: "POST",
      body: JSON.stringify({ companyId }),
      successMessage: false,
    });
    const supportUser: User = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: "COMPANY_OWNER",
      companyId: data.session.companyId,
      adminAccess: null,
      support: {
        sessionId: data.session.id,
        companyId: data.session.companyId,
        companyName: data.session.companyName,
        expiresAt: data.session.expiresAt,
      },
    };
    enterSupportSession(data.token, supportUser);
    setUser(supportUser);
    router.push("/company/dashboard");
  }

  async function exitSupportView() {
    const support = user?.support;
    const staff = restoreStaffSession();
    if (!staff) {
      // Nothing to go back to (storage cleared): sign in again.
      logout();
      return;
    }
    setUser(staff);
    router.push(support ? `/platform/companies/${support.companyId}` : "/platform/dashboard");
    if (support) {
      // Recorded with the staff member's own sign-in, so it works even
      // after the support token has run out.
      apiRequest(`/api/support/sessions/${support.sessionId}/end`, { method: "POST", successMessage: false }).catch(() => {});
    }
  }

  function persistSession(data: LoginResponse) {
    localStorage.removeItem(STAFF_SESSION_KEY); // a fresh sign-in is never a support view
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    setSignedOut(false);
  }

  async function login(email: string, password: string): Promise<User> {
    const data = await apiRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, platform: "web" }),
      // Wrong password, pending or suspended company: the sign-in page
      // shows these itself (a status screen for the company states).
      notifyErrors: false,
    });
    persistSession(data);
    return data.user;
  }

  // A company that needs platform approval first comes back "pending": no
  // session is kept (every request would be refused until it's approved),
  // and the caller shows the "awaiting approval" message instead.
  async function register(payload: RegisterPayload): Promise<RegisterResult> {
    const data = await apiRequest<
      LoginResponse & { company?: { status?: string }; approval?: RegisterResult["approval"]; supportEmail?: string }
    >("/api/auth/register-company", {
      method: "POST",
      body: JSON.stringify(payload),
      // The form shows what's wrong next to the field instead.
      notifyErrors: false,
      successMessage: false,
    });
    const approval = data.approval ?? (data.company?.status === "pending" ? "console" : "auto");
    if (data.company?.status === "pending") {
      return { user: data.user, pending: true, approval, supportEmail: data.supportEmail, session: data };
    }
    persistSession(data);
    return { user: data.user, pending: false, approval, supportEmail: data.supportEmail };
  }

  function logout(options?: { returnTo?: string }) {
    // Signing out of a support view signs the staff member out too.
    if (localStorage.getItem(STAFF_SESSION_KEY)) {
      const sessionId = user?.support?.sessionId;
      restoreStaffSession();
      if (sessionId) apiRequest(`/api/support/sessions/${sessionId}/end`, { method: "POST", successMessage: false }).catch(() => {});
    }
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      // Best-effort — revoke the refresh token server-side so it can't be
      // replayed later. Sign-out proceeds locally either way.
      apiRequest("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    setSignedOut(true);
    const next = options?.returnTo && isSafeReturnPath(options.returnTo) ? `?next=${encodeURIComponent(options.returnTo)}` : "";
    router.push(`/login${next}`);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, adoptSession: persistSession, logout, signedOut, startSupportView, exitSupportView }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}