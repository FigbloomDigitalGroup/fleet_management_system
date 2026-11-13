import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
//import AuthContext from "./context/AuthContext";
import { AuthProvider } from "./context/AuthContext";
import ErrorPopups from "./components/ErrorPopups";
import "./globals.css";

// The system font — Inter, the closest free match to Fakt Pro (the licensed
// font onfleet.com uses). Fonts are self-hosted from app/fonts (latin subset,
// SIL OFL — licences alongside) so `next build` never fetches from Google
// Fonts; that fetch broke the Docker/production build.
const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FIGBLOOM FLEET",
  description: "Vehicle Tracking & Fleet Analytics Platform",
};

// viewportFit "cover" lets the app use the whole phone screen; the shell
// pads its header, tab bar and sheets with env(safe-area-inset-*) so nothing
// sits under a notch or the home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <ErrorPopups />
      </body>
    </html>
  );
}
