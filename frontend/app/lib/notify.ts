// Lets plain modules (lib/api.ts) and components raise a popup message in
// the mounted ErrorPopups stack without a shared context, the same way
// sessionEvents.ts reaches SessionExpiredModal.
const NOTIFY_EVENT = "fleet:notify";

export type NotifyKind = "error" | "success" | "info";

export interface NotifyDetail {
  kind: NotifyKind;
  title?: string;
  message: string;
}

export function notify(detail: NotifyDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<NotifyDetail>(NOTIFY_EVENT, { detail }));
  }
}

export function notifyError(message: string, title?: string) {
  notify({ kind: "error", title, message });
}

export function notifySuccess(message: string, title?: string) {
  notify({ kind: "success", title, message });
}

export function onNotify(handler: (detail: NotifyDetail) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<NotifyDetail>).detail);
  window.addEventListener(NOTIFY_EVENT, listener);
  return () => window.removeEventListener(NOTIFY_EVENT, listener);
}

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// The wording a person sees for a failed response: the server's own message
// when it sent one, otherwise a plain explanation of the status code.
export function friendlyStatusMessage(status: number, serverMessage?: string): string {
  if (serverMessage) return serverMessage;
  if (status === 400) return "Some of the details sent weren't accepted. Check the form and try again.";
  if (status === 401) return "Your email or password is incorrect.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 409) return "That already exists.";
  if (status === 413) return "That file is too large.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}

export const OFFLINE_MESSAGE = "Oops, you are not connected to the internet. Check your connection and try again.";
export const UNREACHABLE_MESSAGE = "We couldn't reach the server. Please try again in a moment.";

// For `catch (err)` blocks: shows the error in a popup unless apiRequest
// already did.
export function showError(err: unknown, fallback: string) {
  const e = err as { message?: string; notified?: boolean } | null;
  if (e?.notified) return;
  notifyError(e?.message || fallback);
}
