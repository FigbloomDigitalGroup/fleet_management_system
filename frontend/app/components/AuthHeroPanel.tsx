"use client";

import { ReactNode } from "react";
import { useRememberedLook } from "../context/FleetThemeContext";

// The left-hand panel on the sign-in pages (login, register, forgot/reset
// password): one fixed photo, darkened so the white text on it stays readable.
// Every sign-in page has one, so it also gives them the company's theme.
export default function AuthHeroPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  useRememberedLook();

  return (
    <div
      className={`relative overflow-hidden bg-cover bg-center ${className}`}
      style={{ backgroundImage: "url('/pexels-car-1281640_1920.jpg')" }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-black/50" />
      {children}
    </div>
  );
}
