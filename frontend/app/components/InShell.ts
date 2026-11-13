import { createContext, useContext } from "react";

// True inside the portal shell's content pane (AppShell). Loading states use
// it to stay inside the pane, so the menu and header never disappear while a
// page loads.
export const InShellContext = createContext(false);

export function useInShell() {
  return useContext(InShellContext);
}
