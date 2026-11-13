"use client";

import { FormEvent, ReactNode, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useInShell } from "./InShell";

// Every dialog's frame: a centred card on tablets and computers, a sheet that
// slides up from the bottom on phones (up to the full screen height, with its
// own scroll, so a long form never runs off the screen). Escape and a tap on
// the dimmed backdrop close it, unless `onClose` is left out (busy).
//
// It is drawn at the end of <body> (a portal), so it is never trapped inside
// a menu, a card that clips its content, or the sliding phone menu.
//
// `as="form"` makes the panel the <form> itself, so the submit button can sit
// in SHEET_ACTIONS (stuck to the bottom of the sheet on phones).

const WIDTHS = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
} as const;

// Action row (Cancel / Save) at the end of a dialog: stays in view at the
// bottom of a phone sheet while the fields scroll above it.
export const SHEET_ACTIONS =
  "sticky bottom-0 z-10 -mx-5 -mb-5 mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0";

export default function ModalSheet({
  children,
  onClose,
  size = "md",
  labelledBy,
  className = "",
  zIndex = "z-[100]",
  as = "div",
  onSubmit,
}: {
  children: ReactNode;
  onClose?: () => void;
  size?: keyof typeof WIDTHS;
  labelledBy?: string;
  className?: string;
  zIndex?: string;
  as?: "div" | "form";
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Opened from a page's content: keep the content's look (.app-content in
  // globals.css) although the dialog is drawn outside it.
  const inContent = useInShell();
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  );

  const panelClass = `relative max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[90dvh] sm:rounded-lg sm:p-6 ${WIDTHS[size]} ${className}`;
  const panelProps = {
    role: "dialog",
    "aria-modal": true,
    "aria-labelledby": labelledBy,
    className: panelClass,
    onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  } as const;

  if (!mounted) return null;
  return createPortal(
    <div
      className={`${inContent ? "app-content " : ""}fixed inset-0 ${zIndex} flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4`}
      onClick={() => onClose?.()}
    >
      {as === "form" ? (
        <form {...panelProps} onSubmit={onSubmit}>
          {children}
        </form>
      ) : (
        <div {...panelProps}>{children}</div>
      )}
    </div>,
    document.body
  );
}

const noSubscribe = () => () => {};
