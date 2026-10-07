"use client";

import { useEffect, useRef, useState } from "react";
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

// Floating assistant — opens a small chat panel. Answers are grounded in this
// company's own fleet data on the backend (see fleetAssistant.js), not
// general knowledge.
export default function AgentChatWidget() {
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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

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
    } catch (err: any) {
      setError(err.message || "Failed to get an answer");
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

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[28rem] w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-center justify-between bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-600 px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <RiRobot3Fill size={18} />
              <p className="text-sm font-semibold">Fleet AI Assistant</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/80 hover:text-white">
              <FiX size={18} />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    m.role === "user" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {m.text}
                  {m.routeDraft && (
                    <button
                      onClick={() => openRouteDraft(m.routeDraft!)}
                      className="mt-2 block w-full rounded-md bg-orange-500 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-orange-600"
                    >
                      Click to view the route
                    </button>
                  )}
                  {m.geofenceDraft && (
                    <button
                      onClick={() => openGeofenceDraft(m.geofenceDraft!)}
                      className="mt-2 block w-full rounded-md bg-orange-500 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-orange-600"
                    >
                      Click to view the geofence
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-500">Frolicking…</div>
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
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-xs outline-none focus:border-teal-400 disabled:opacity-60"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="rounded-md bg-teal-600 p-2 text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
            >
              <FiSend size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {!open && (
          <div
            key={pageSegment}
            className="animate-hint-in flex max-w-[210px] items-start gap-1.5 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 px-3 py-2 text-xs text-violet-800 shadow-lg ring-1 ring-violet-200"
          >
            <BsStars className="mt-0.5 shrink-0 text-violet-500" size={13} aria-hidden="true" />
            <span>{hint}</span>
          </div>
        )}

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close fleet assistant" : "Ask the fleet assistant"}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-lg transition-transform hover:scale-105"
        >
          <RiRobot3Fill size={24} />
        </button>
      </div>
    </>
  );
}
