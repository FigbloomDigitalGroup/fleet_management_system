"use client";

import { ReactNode, createContext, useContext, useEffect } from "react";

export interface PageHeaderValue {
  title: string;
  subtitle?: string;
  stats?: ReactNode;
  position?: "top" | "bottom";
}

interface PageHeaderContextType {
  header: PageHeaderValue | null;
  setHeader: (header: PageHeaderValue | null) => void;
}

export const PageHeaderContext = createContext<PageHeaderContextType | null>(null);

// Lets any page inside a shell (DashboardShell or AppShell) put its
// title/subtitle/stats in the shell's header instead of building its own.
// `stats` is optional page content (e.g. a couple of StatCards) the shell
// renders with the title — the page controls its own grid/flex layout for
// it. `position: "bottom"` moves it below the page's content instead.
export function usePageHeader(
  title: string,
  subtitle?: string,
  stats?: ReactNode,
  position: "top" | "bottom" = "top"
) {
  const ctx = useContext(PageHeaderContext);
  const setHeader = ctx?.setHeader;

  useEffect(() => {
    setHeader?.({ title, subtitle, stats, position });
    return () => setHeader?.(null);
  }, [setHeader, title, subtitle, stats, position]);
}
