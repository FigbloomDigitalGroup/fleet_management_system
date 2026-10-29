// The dashboard themes a company owner can pick (Settings → Appearance).
//
// The whole app colours itself with two Tailwind scales: every "teal-*"
// class is the main colour (sidebar, buttons, links) and every "orange-*"
// class the accent (highlights, call-to-action buttons). globals.css
// defines them as CSS variables, so a theme just swaps those variables —
// see FleetThemeContext. Ids must match the backend's THEMES list.

type Scale = [string, string, string, string, string, string, string, string, string, string, string];
export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export interface FleetTheme {
  id: ThemeId;
  name: string;
  description: string;
  /** 50 → 950. 600 is buttons/links, 950 the sidebar. */
  main: Scale;
  /** 50 → 950. 500 is highlight buttons, 600 their hover. */
  accent: Scale;
}

export type ThemeId = "forest" | "violet" | "ocean" | "lagoon" | "graphite";

export const THEMES: FleetTheme[] = [
  {
    id: "forest",
    name: "Fig Forest",
    description: "Green & orange — the Figbloom colours",
    main: ["#eefbf0", "#d6f4dc", "#b4e6bf", "#86ce98", "#50a86a", "#217941", "#0e4f27", "#073e1c", "#042f14", "#02230d", "#011406"],
    accent: ["#fff6ed", "#ffe9d4", "#ffd1a5", "#ffb776", "#ffa049", "#ff8a12", "#e16d00", "#b75400", "#8f4200", "#6f3600", "#3e1c00"],
  },
  {
    id: "violet",
    name: "Royal Violet",
    description: "Violet & pink",
    main: ["#f5f3ff", "#ede9fe", "#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#6d28d9", "#5b21b6", "#4c1d95", "#3b1478", "#2e1065"],
    accent: ["#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d", "#831843", "#500724"],
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    description: "Deep blue & sunny yellow",
    main: ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#1d4ed8", "#1e40af", "#1e3a8a", "#172f6e", "#172554"],
    accent: ["#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f", "#451a03"],
  },
  {
    id: "lagoon",
    name: "Lagoon",
    description: "Teal & coral pink",
    main: ["#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0f766e", "#115e59", "#134e4a", "#0f3d3a", "#042f2e"],
    accent: ["#fff1f2", "#ffe4e6", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c", "#9f1239", "#881337", "#4c0519"],
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Charcoal & sky blue",
    main: ["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#334155", "#1e293b", "#172033", "#0f172a", "#0b1120"],
    accent: ["#f0f9ff", "#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#075985", "#0c4a6e", "#082f49"],
  },
];

export const DEFAULT_THEME: ThemeId = "forest";

export function themeById(id: string | null | undefined): FleetTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export type TextSize = "small" | "normal" | "large";

// The root font size — every rem-based size in the app scales with it.
export const TEXT_SIZES: { id: TextSize; label: string; rootPx: number }[] = [
  { id: "small", label: "Small", rootPx: 14 },
  { id: "normal", label: "Normal", rootPx: 16 },
  { id: "large", label: "Large", rootPx: 18 },
];

export function textSizeById(id: string | null | undefined) {
  return TEXT_SIZES.find((s) => s.id === id) ?? TEXT_SIZES[1];
}

/** The colours charts need, which can't come from CSS classes. */
export function chartColors(theme: FleetTheme) {
  return {
    main: theme.main[6],
    mainSoft: theme.main[4],
    mainPale: theme.main[1],
    accent: theme.accent[5],
    accentDark: theme.accent[6],
    accentPale: theme.accent[2],
  };
}
