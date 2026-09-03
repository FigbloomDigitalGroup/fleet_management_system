"use client";

import ProtectedRoute from "../../components/ProtectedRoute";
import { useAuth } from "../../context/AuthContext";

export default function DriverDashboard() {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["DRIVER"]}>
      <div className="min-h-screen p-10" style={{ background: "var(--ink)" }}>
        <div className="flex justify-between items-center mb-8">
          <h1 className="font-display text-2xl" style={{ color: "var(--paper)" }}>
            Driver Dashboard
          </h1>
          <button onClick={logout} className="text-sm" style={{ color: "var(--fog)" }}>
            Sign out
          </button>
        </div>
        <p style={{ color: "var(--fog)" }}>Signed in as {user?.email}</p>
      </div>
    </ProtectedRoute>
  );
}