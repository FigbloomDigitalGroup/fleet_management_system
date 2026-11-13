"use client";

import { CSSProperties, PointerEvent, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { RiRobot3Fill } from "react-icons/ri";
import { FiX, FiSend } from "react-icons/fi";
import { BsStars } from "react-icons/bs";
import { apiRequest } from "../lib/api";

interface RouteDraft {
  name: string;
  waypoints: { lat: number; lng: number }[];
  originAddress: string;
  destinationAddress: string;
}

interface GeofenceDraft {
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

interface ChatMessage {
  role: "user" | "agent";
  text: string;
  routeDraft?: RouteDraft;
  geofenceDraft?: GeofenceDraft;
}

// Keyed by the page segment shared by both /admin/* and /company/* (see
// layout.tsx nav arrays) — one hint per feature, shown beside the floating
// button so it nudges toward what's actually useful to ask on that page.
const PAGE_HINTS: Record<string, string> = {
  dashboard: "Ask about your fleet — vehicles, alerts, or what's happened recently.",
  "live-map": "Ask where your vehicles are, or who's active right now.",
  geofences: "Want help setting up a geofence zone?",
  routes: "Want help drawing a route?",
  vehicles: "Ask about a specific vehicle's status or history.",
  drivers: "Ask about driver assignments or activity.",
  trips: "Ask about recent trips or distance covered.",
  expenses: "Ask about fuel or other expenses logged by drivers.",
  alerts: "Ask about open alerts or recent incidents.",
  agent: "Ask how the AI agent's anomaly scans are going.",
  billing: "Ask about your plan or expenses.",
  admins: "Ask about your admin team.",
  settings: "Need help with your account settings?",
};
const DEFAULT_HINT = "Ask about your fleet.";

// The widget can be dragged anywhere so it never sits on top of what you're
// editing. Its spot is kept as distances from the bottom-right corner (where
// it starts) and remembered in this browser. On phones it always stays above
// the tab bar along the bottom of the screen, so it can't cover navigation.
const BUTTON_PX = 48;
const EDGE_PX = 8;
const GAP_PX = 12;
// Below this width the shell shows its tab bar along the bottom (AppShell,
// lg); the button keeps clear of it (tab bar height plus a little air).
const PHONE_BREAKPOINT = 1024;
const PHONE_MIN_BOTTOM = 68;
const POSITION_KEY = "fleet:assistant-position";
const HINT_SEEN_KEY = "fleet:assistant-hint-seen";
const DEFAULT_POSITION = { right: 24, bottom: 24 };
type Position = typeof DEFAULT_POSITION;

function isPhone() {
  return window.innerWidth < PHONE_BREAKPOINT;
}

function clampToViewport(p: Position): Position {
  const minBottom = isPhone() ? PHONE_MIN_BOTTOM : EDGE_PX;
  const maxRight = window.innerWidth - BUTTON_PX - EDGE_PX;
  const maxBottom = window.innerHeight - BUTTON_PX - EDGE_PX;
  return {
    right: Math.round(Math.min(Math.max(p.right, EDGE_PX), maxRight)),
    bottom: Math.round(Math.min(Math.max(p.bottom, minBottom), maxBottom)),
  };
}

function readPosition(): Position {
  const fallback = isPhone() ? { right: 12, bottom: PHONE_MIN_BOTTOM } : DEFAULT_POSITION;
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

// The "what you can ask" hint is shown once per browser, on screens wide
// enough that it doesn't cover anything, and can be closed.
function hintAlreadySeen() {
  try {
    return localStorage.getItem(HINT_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markHintSeen() {
  try {
    localStorage.setItem(HINT_SEEN_KEY, "1");
  } catch {
    // storage blocked: it just shows again next visit
  }
}

function writePosition(p: Position) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(p));
  } catch {
    // Private window — it just won't be remembered.
  }
}

// Floating assistant — opens a small chat panel. Answers are grounded in this
// company's own fleet data on the backend (see fleetAssistant.js), not
// general knowledge.
export default function AgentChatWidget({ hidden = false, hideOnPhone = false }: { hidden?: boolean; hideOnPhone?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "agent", text: "Hi! Ask me anything about your fleet — vehicles, alerts, or what's happened recently." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const drag = useRef<{ x: number; y: number; from: Position; moved: boolean } | null>(null);
  // A drag ends with a click on the button — that click mustn't toggle the chat.
  const justDragged = useRef(false);
  // The page the tip was shown on: it never follows you to the next page,
  // where it could sit on top of that page's controls.
  const [hintPath, setHintPath] = useState<string | null>(null);
  const showHint = hintPath !== null && hintPath === pathname;
  const setShowHint = (show: boolean) => setHintPath(show ? pathname : null);

  // Once, on wide screens only, a moment after the page settles, and gone
  // again by itself after a few seconds.
  useEffect(() => {
    if (isPhone() || hintAlreadySeen()) return;
    const show = setTimeout(() => {
      setHintPath(window.location.pathname);
      markHintSeen();
    }, 1500);
    const hide = setTimeout(() => setHintPath(null), 9500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // Start where it was left, and stay on screen when the window shrinks.
  useEffect(() => {
    let saved: Position | null = readPosition();
    const fit = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const start = saved;
      saved = null;
      setPosition((p) => clampToViewport(start ?? p));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  function startDrag(e: PointerEvent<HTMLElement>) {
    // The header's close button is a button, not a handle.
    if (e.button !== 0 || (e.target as HTMLElement).closest("button[data-no-drag]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, from: position, moved: false };
  }

  function moveDrag(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    // A few pixels of wobble is still a click.
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    setPosition(clampToViewport({ right: d.from.right - dx, bottom: d.from.bottom - dy }));
  }

  function endDrag() {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    justDragged.current = true;
    setPosition((p) => {
      writePosition(p);
      return p;
    });
  }

  const dragHandlers = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  function toggleOpen() {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    setShowHint(false);
    setOpen((o) => !o);
  }

  // Open the panel and the hint toward the side of the screen with room.
  const onLeft = viewport ? position.right + BUTTON_PX / 2 > viewport.width / 2 : false;
  const onTop = viewport ? position.bottom + BUTTON_PX / 2 > viewport.height / 2 : false;
  const panelStyle: CSSProperties = viewport
    ? {
        ...(onLeft ? { left: viewport.width - position.right - BUTTON_PX } : { right: position.right }),
        ...(onTop
          ? { top: viewport.height - position.bottom + GAP_PX }
          : { bottom: position.bottom + BUTTON_PX + GAP_PX }),
        maxHeight: (onTop ? position.bottom : viewport.height - position.bottom - BUTTON_PX) - GAP_PX - EDGE_PX,
      }
    : { right: position.right, bottom: position.bottom + BUTTON_PX + GAP_PX };

  async function handleSend() {
    const question = input.trim();
    if (!question || sending) return;

    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const { answer, routeDraft, geofenceDraft } = await apiRequest<{
        answer: string;
        routeDraft?: RouteDraft;
        geofenceDraft?: GeofenceDraft;
      }>("/api/agent/ask", { method: "POST", body: JSON.stringify({ question }) });
      setMessages((m) => [...m, { role: "agent", text: answer, routeDraft, geofenceDraft }]);
    } catch (err) {
      setError((err as Error).message || "Failed to get an answer");
    } finally {
      setSending(false);
    }
  }

  function openRouteDraft(draft: RouteDraft) {
    const basePath = pathname?.startsWith("/admin") ? "/admin" : "/company";
    const targetPath = `${basePath}/routes`;

    if (pathname === targetPath) {
      // Already on the Routes page — hand it over live, no navigation (which
      // would be a no-op to the same URL anyway) and no refresh needed.
      window.dispatchEvent(new CustomEvent("fleet:route-draft", { detail: draft }));
    } else {
      sessionStorage.setItem("routeDraft", JSON.stringify(draft));
      router.push(targetPath);
    }
  }

  function openGeofenceDraft(draft: GeofenceDraft) {
    const basePath = pathname?.startsWith("/admin") ? "/admin" : "/company";
    const targetPath = `${basePath}/geofences`;

    if (pathname === targetPath) {
      window.dispatchEvent(new CustomEvent("fleet:geofence-draft", { detail: draft }));
    } else {
      sessionStorage.setItem("geofenceDraft", JSON.stringify(draft));
      router.push(targetPath);
    }
  }

  const pageSegment = pathname?.split("/").filter(Boolean)[1] || "dashboard";
  const hint = PAGE_HINTS[pageSegment] || DEFAULT_HINT;

  if (hidden) return null;

  return (
    <div className={hideOnPhone ? "hidden md:block" : undefined}>
      {open && (
        <div
          style={panelStyle}
          className="fixed z-50 flex h-[28rem] w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/10"
        >
          <div
            {...dragHandlers}
            title="Drag to move"
            className="flex cursor-move touch-none select-none items-center justify-between bg-gradient-to-br from-teal-600 via-teal-500 to-teal-500 px-4 py-3"
          >
            <div className="flex items-center gap-2 text-white">
              <RiRobot3Fill size={18} />
              <p className="text-sm font-semibold">Fleet AI Assistant</p>
            </div>
            <button data-no-drag onClick={() => setOpen(false)} aria-label="Close" className="text-white/80 hover:text-white">
              <FiX size={18} />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-md px-3 py-2 text-xs leading-relaxed ${
                    m.role === "user" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {m.text}
                  {m.routeDraft && (
                    <button
                      onClick={() => openRouteDraft(m.routeDraft!)}
                      className="mt-2 block w-full rounded bg-orange-500 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-orange-600"
                    >
                      Click to view the route
                    </button>
                  )}
                  {m.geofenceDraft && (
                    <button
                      onClick={() => openGeofenceDraft(m.geofenceDraft!)}
                      className="mt-2 block w-full rounded bg-orange-500 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-orange-600"
                    >
                      Click to view the geofence
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-500">Frolicking…</div>
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="flex items-center gap-2 border-t border-gray-100 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about your fleet…"
              disabled={sending}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-xs outline-none focus:border-teal-400 disabled:opacity-60"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="rounded bg-teal-600 p-2 text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
            >
              <FiSend size={14} />
            </button>
          </div>
        </div>
      )}

      <div style={{ right: position.right, bottom: position.bottom }} className="fixed z-50">
        {!open && showHint && (
          // Beside the button, on whichever side faces into the screen.
          <div
            role="status"
            className={`animate-hint-in absolute top-1/2 flex w-max max-w-[220px] -translate-y-1/2 items-start gap-1.5 rounded-md bg-gradient-to-br from-violet-50 to-indigo-50 py-2 pl-3 pr-1.5 text-xs text-violet-800 shadow-lg ring-1 ring-violet-200 ${
              onLeft ? "left-full ml-3" : "right-full mr-3"
            }`}
          >
            <BsStars className="mt-0.5 shrink-0 text-violet-500" size={13} aria-hidden="true" />
            <span>{hint}</span>
            <button
              type="button"
              onClick={() => setShowHint(false)}
              aria-label="Close tip"
              className="-mt-0.5 shrink-0 rounded p-0.5 text-violet-400 hover:bg-violet-100 hover:text-violet-700"
            >
              <FiX size={12} />
            </button>
          </div>
        )}

        <button
          {...dragHandlers}
          onClick={toggleOpen}
          aria-label={open ? "Close fleet assistant" : "Ask the fleet assistant"}
          title="Click to chat · drag to move"
          className="flex h-12 w-12 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-teal-500 text-white shadow-lg transition-transform hover:scale-105 active:cursor-grabbing"
        >
          <RiRobot3Fill size={22} />
        </button>
      </div>
    </div>
  );
}
