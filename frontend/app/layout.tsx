import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
//import AuthContext from "./context/AuthContext";
import { AuthProvider } from "./context/AuthContext";
import ErrorPopups from "./components/ErrorPopups";
import "./globals.css";

// The system font — Inter, the closest free match to Fakt Pro (the licensed
// font onfleet.com uses).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "FIGBLOOM FLEET",
  description: "Vehicle Tracking & Fleet Analytics Platform",
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
