import { ReactNode } from "react";

// The left-hand panel on the sign-in pages (login, register, forgot/reset
// password): one fixed photo, darkened so the white text on it stays readable.
export default function AuthHeroPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
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
