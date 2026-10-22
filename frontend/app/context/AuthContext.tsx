"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../lib/api";
import { User, LoginResponse } from "../types/auth";

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
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("accessToken");
    if (savedUser && savedToken) {
      const parsed: User = JSON.parse(savedUser);
      setUser(parsed);
      // An owner can change an admin's access level at any time, and the
      // stored session only knows the level from login — re-read it so the
      // UI matches what the server will actually allow.
      if (parsed.role === "ADMIN") {
        apiRequest<{ adminAccess?: User["adminAccess"] }>("/api/users/me")
          .then((me) => {
            const adminAccess = me.adminAccess || "full";
            if (adminAccess === parsed.adminAccess) return;
            const next = { ...parsed, adminAccess };
            localStorage.setItem("user", JSON.stringify(next));
            setUser(next);
          })
          .catch(() => {});
      }
    }
    setLoading(false);
  }, []);

  function persistSession(data: LoginResponse) {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }

  async function login(email: string, password: string): Promise<User> {
    const data = await apiRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, platform: "web" }),
    });
    persistSession(data);
    return data.user;
  }

  async function register(payload: RegisterPayload): Promise<User> {
    const data = await apiRequest<LoginResponse>("/api/auth/register-company", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    persistSession(data);
    return data.user;
  }

  function logout() {
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
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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