// Lets lib/api.ts (a plain module, outside the React tree) notify the
// mounted SessionExpiredModal without needing a shared context.
const SESSION_EXPIRED_EVENT = "session-expired";

export function emitSessionExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

export function onSessionExpired(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}
