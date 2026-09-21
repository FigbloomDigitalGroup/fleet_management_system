"use client";

import { useEffect, useRef, useState } from "react";
import { RiRobot3Fill } from "react-icons/ri";
import { FiX, FiSend } from "react-icons/fi";
import { apiRequest } from "../lib/api";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
}

// Floating assistant — like the LiveMapWidget's floating button, but opens a
// small chat panel instead of navigating. Answers are grounded in this
// company's own fleet data on the backend (see fleetAssistant.js), not
// general knowledge.
export default function AgentChatWidget() {
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
      const { answer } = await apiRequest<{ answer: string }>("/api/agent/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setMessages((m) => [...m, { role: "agent", text: answer }]);
    } catch (err: any) {
      setError(err.message || "Failed to get an answer");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-[232px] right-6 z-50 flex h-[28rem] w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
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

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close fleet assistant" : "Ask the fleet assistant"}
        className="fixed bottom-40 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-lg transition-transform hover:scale-105"
      >
        <RiRobot3Fill size={24} />
      </button>
    </>
  );
}
