"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import {
  DEFAULT_CUSTOM,
  DEFAULT_THEME,
  FleetTheme,
  SHADES,
  TextSize,
  ThemeId,
  chartColors,
  makeCustomTheme,
  textSizeById,
  themeById,
} from "../lib/themes";

// The company's dashboard look — theme colours and text size — for the
// company and admin portals.
//
// The provider writes the chosen theme into the CSS variables behind every
// "teal-*" and "orange-*" class (globals.css), so the whole portal recolours
// at once, and sets the root font size. Components that draw colours
// themselves (charts) read them with useFleetTheme().
//
// `saved` is the company's setting; `preview` is a choice being tried on the
// Settings page, shown until it's saved or dropped.

export interface Appearance {
  theme: ThemeId;
  textSize: TextSize;
  /** The "custom" theme's own colours, "#rrggbb". */
  customMain: string;
  customAccent: string;
}

interface FleetThemeValue extends Appearance {
  themeDef: FleetTheme;
  colors: ReturnType<typeof chartColors>;
  saved: Appearance;
  /** Show a theme / text size without saving it. */
  preview: (choice: Partial<Appearance>) => void;
  /** Drop any preview and go back to the saved look. */
  resetPreview: () => void;
  /** After saving: make this the company's look. */
  commit: (appearance: Appearance) => void;
}

const DEFAULT: Appearance = {
  theme: DEFAULT_THEME,
  textSize: "normal",
  customMain: DEFAULT_CUSTOM.main,
  customAccent: DEFAULT_CUSTOM.accent,
};

const themeFor = (a: Appearance) => (a.theme === "custom" ? makeCustomTheme(a.customMain, a.customAccent) : themeById(a.theme));
const CACHE_KEY = "fleet:appearance";

// Outside a provider (landing page, platform portal) everything is the
// default look and the setters do nothing.
const FleetThemeContext = createContext<FleetThemeValue>({
  ...DEFAULT,
  themeDef: themeById(DEFAULT.theme),
  colors: chartColors(themeById(DEFAULT.theme)),
  saved: DEFAULT,
  preview: () => {},
  resetPreview: () => {},
  commit: () => {},
});

function writeCache(appearance: Appearance) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(appearance));
  } catch {
    // Private window — the look still applies, it just isn't remembered.
  }
}

export const useFleetTheme = () => useContext(FleetThemeContext);

// useLayoutEffect paints the theme before the first frame (no flash of the
// default green); it doesn't run on the server, where there's no document.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function readCache(): Appearance | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function applyLook(themeDef: FleetTheme, textSize: TextSize) {
  const root = document.documentElement;
  SHADES.forEach((shade, i) => {
    root.style.setProperty(`--color-teal-${shade}`, themeDef.main[i]);
    root.style.setProperty(`--color-orange-${shade}`, themeDef.accent[i]);
  });
  root.style.fontSize = `${textSizeById(textSize).rootPx}px`;
}

// Back to the default look (globals.css).
function clearLook() {
  const root = document.documentElement;
  SHADES.forEach((shade) => {
    root.style.removeProperty(`--color-teal-${shade}`);
    root.style.removeProperty(`--color-orange-${shade}`);
  });
  root.style.fontSize = "";
}

// For the signed-out pages (login, register, password reset): nobody is
// signed in yet, so show the look this browser last saw — a returning
// company keeps its own colours. A browser that never signed in gets the
// default.
export function useRememberedLook() {
  useIsomorphicLayoutEffect(() => {
    const cached = readCache();
    if (!cached) return;
    applyLook(themeFor(cached), cached.textSize);
    return clearLook;
  }, []);
}

// Sits in the company and admin portal layouts, so it stays mounted while
// moving between pages, and loads the company's saved look itself.
export function FleetThemeProvider({ children }: { children: ReactNode }) {
  // Until the company loads, use the look this browser last saw, so a
  // violet company doesn't flash green on every page load.
  const [saved, setSaved] = useState<Appearance>(DEFAULT);
  const [draft, setDraft] = useState<Partial<Appearance> | null>(null);

  useIsomorphicLayoutEffect(() => {
    const cached = readCache();
    if (cached) setSaved(cached);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ theme?: string; textSize?: string; customMainColor?: string | null; customAccentColor?: string | null }>(
      "/api/companies/me"
    )
      .then((company) => {
        if (cancelled) return;
        const next: Appearance = {
          theme: company.theme === "custom" ? "custom" : themeById(company.theme).id,
          textSize: textSizeById(company.textSize).id,
          customMain: company.customMainColor || DEFAULT_CUSTOM.main,
          customAccent: company.customAccentColor || DEFAULT_CUSTOM.accent,
        };
        setSaved(next);
        writeCache(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const current: Appearance = { ...saved, ...draft };
  // Rebuilt only when the look actually changes, not on every render.
  const themeDef = useMemo(
    () => themeFor(current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current.theme, current.customMain, current.customAccent]
  );

  useIsomorphicLayoutEffect(() => {
    applyLook(themeDef, current.textSize);
  }, [themeDef, current.textSize]);

  // Leaving the portal (sign out → landing page) goes back to the default.
  // A layout effect so it clears before the login page paints its own look,
  // not after (which would wipe it).
  useIsomorphicLayoutEffect(() => clearLook, []);

  const preview = useCallback((choice: Partial<Appearance>) => setDraft((d) => ({ ...d, ...choice })), []);
  const resetPreview = useCallback(() => setDraft(null), []);
  const commit = useCallback((appearance: Appearance) => {
    setSaved(appearance);
    setDraft(null);
    writeCache(appearance);
  }, []);

  const value = useMemo<FleetThemeValue>(
    () => ({ ...current, themeDef, colors: chartColors(themeDef), saved, preview, resetPreview, commit }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current.theme, current.textSize, current.customMain, current.customAccent, themeDef, saved, preview, resetPreview, commit]
  );

  return <FleetThemeContext.Provider value={value}>{children}</FleetThemeContext.Provider>;
}
