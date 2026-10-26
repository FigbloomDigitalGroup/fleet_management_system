"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { FiSend } from "react-icons/fi";
import { apiRequest, errorMessage } from "../lib/api";
import { useAdminAccess } from "../lib/adminAccess";
import { timeAgo } from "../lib/dateKeys";
import { DriverRecord, MessageRecord, MessageThread } from "../types/auth";
import Skeleton from "./Skeleton";
import CallButton from "./CallButton";

const POLL_MS = 10000;

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

// Driver-beside-vehicle glyph, used as each driver's profile picture in the
// conversation list. currentColor so it inherits the avatar chip's text color.
function DriverAvatarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 299.044 299.044" fill="currentColor" width={size} height={size} aria-hidden="true">
      <path d="M291.037,52.054h-19.889V16.965c0-3.706-3.004-6.709-6.709-6.709H136.054c-3.706,0-6.709,3.004-6.709,6.709v35.088h-11.471c10.466,7.699,16.76,19.859,16.825,32.915l0.414,82.514c0.682,0.096,0.59,0.073,4.298,0.073v13.954c0,8.795,7.13,15.925,15.925,15.925c8.795,0,15.925-7.13,15.925-15.925v-13.954h57.968v13.954c0,8.795,7.13,15.925,15.925,15.925s15.925-7.13,15.925-15.925v-13.954h3.359c3.706,0,6.709-3.004,6.709-6.709v-47.03h19.889c3.706,0,6.709-3.004,6.709-6.709V58.763h0C297.746,55.058,294.743,52.054,291.037,52.054z M146.671,47.061c0-2.215,1.796-4.011,4.011-4.011h99.129c2.215,0,4.011,1.796,4.011,4.011v45.523c0,2.215-1.796,4.011-4.011,4.011h-99.129c-2.215,0-4.011-1.796-4.011-4.011V47.061z M157.346,155.366c-8.111,0-14.686-6.575-14.686-14.687c0-8.111,6.575-14.687,14.686-14.687c8.111,0,14.687,6.575,14.687,14.687C172.033,148.79,165.458,155.366,157.346,155.366z M243.146,155.366c-8.111,0-14.686-6.575-14.686-14.687c0-8.111,6.575-14.687,14.686-14.687c8.111,0,14.687,6.575,14.687,14.687C257.833,148.79,251.258,155.366,243.146,155.366z" />
      <path d="M61.818,49.226c13.554,0,24.613-11.003,24.613-24.613C86.431,11.019,75.411,0,61.818,0S37.205,11.019,37.205,24.613C37.205,38.257,48.297,49.226,61.818,49.226z" />
      <path d="M98.088,57.437c-3.156-0.515,1.046-0.365-68.249-0.365c-15.419,0-28.026,12.544-28.104,27.963l-0.438,87.247c-0.033,6.559,5.257,11.903,11.816,11.935c0.02,0,0.041,0,0.061,0c6.531,0,11.842-5.278,11.875-11.816l0.438-87.248c0-0.001,0-0.001,0-0.001c0.006-1.264,1.035-2.284,2.299-2.281c1.264,0.003,2.287,1.03,2.287,2.294c0.001,28.378,0.005,186.637,0.005,199.627c0,7.871,6.38,14.251,14.251,14.251s14.251-6.38,14.251-14.251V170.882h6.154v113.911c0,7.871,6.38,14.251,14.251,14.251s14.251-6.38,14.251-14.251c0-195.493-0.253-74.027-0.259-199.625c0-1.37,1.108-2.481,2.478-2.486c1.37-0.005,2.485,1.101,2.492,2.472l0.438,87.248c0.033,6.539,5.344,11.816,11.875,11.816c0.019,0,0.041,0,0.061,0c6.559-0.033,11.849-5.377,11.816-11.935l-0.438-87.248C121.638,71.352,111.601,59.643,98.088,57.437z" />
    </svg>
  );
}

// Two-way chat with drivers. There's no push channel, so both the thread
// list and the open conversation are polled while this page is open.
export default function MessagesCenter() {
  const { canDispatch } = useAdminAccess();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageId = useRef<string | null>(null);

  const loadThreads = useCallback(async () => {
    try {
      const data = await apiRequest<MessageThread[]>("/api/messages/threads");
      setThreads(data);
      setThreadsError(null);
    } catch (err) {
      setThreadsError(errorMessage(err, "Failed to load conversations"));
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
    apiRequest<DriverRecord[]>("/api/users/drivers").then(setDrivers).catch(() => {});
    const interval = setInterval(loadThreads, POLL_MS);
    return () => clearInterval(interval);
  }, [loadThreads]);

  const loadMessages = useCallback(async (driverId: string) => {
    try {
      const data = await apiRequest<MessageRecord[]>(`/api/messages?driverId=${driverId}`);
      setMessages(data);
      // Opening a thread marks its messages read server-side — clear the
      // badge locally too instead of waiting for the next thread poll.
      setThreads((ts) => ts.map((t) => (t.driverId === driverId ? { ...t, unread: 0 } : t)));
    } catch {
      // Keep the visible conversation on a background-poll hiccup.
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!activeDriverId) return;
    setLoadingMessages(true);
    setMessages([]);
    lastMessageId.current = null;
    loadMessages(activeDriverId);
    const interval = setInterval(() => loadMessages(activeDriverId), POLL_MS);
    return () => clearInterval(interval);
  }, [activeDriverId, loadMessages]);

  // Scroll to the newest message only when one actually arrives, so a
  // poll doesn't yank the view down while someone is reading history.
  useEffect(() => {
    const newest = messages[messages.length - 1]?._id ?? null;
    if (newest && newest !== lastMessageId.current) {
      lastMessageId.current = newest;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || !activeDriverId) return;
    setSending(true);
    setSendError(null);
    try {
      const message = await apiRequest<MessageRecord>("/api/messages", {
        method: "POST",
        body: JSON.stringify({ body, driverId: activeDriverId }),
      });
      setMessages((m) => [...m, message]);
      setDraft("");
      loadThreads();
    } catch (err) {
      setSendError(errorMessage(err, "Failed to send"));
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a new line — like most chat apps.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const activeName =
    threads.find((t) => t.driverId === activeDriverId)?.driverName ??
    drivers.find((d) => d._id === activeDriverId)?.fullName ??
    "Driver";
  const driversWithoutThread = drivers.filter((d) => !threads.some((t) => t.driverId === d._id));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex h-[640px] flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        {canDispatch && (
          <div className="border-b border-gray-100 p-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">Start a conversation</label>
            <select
              value=""
              onChange={(e) => e.target.value && setActiveDriverId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            >
              <option value="">Pick a driver…</option>
              {driversWithoutThread.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loadingThreads && <Skeleton rows={5} rowClassName="h-12" className="p-4" />}
          {threadsError && <p className="p-4 text-sm text-red-600">{threadsError}</p>}
          {!loadingThreads && !threadsError && threads.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400">No conversations yet.</p>
          )}
          {threads.map((t) => (
            <button
              key={t.driverId}
              onClick={() => setActiveDriverId(t.driverId)}
              className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors ${
                activeDriverId === t.driverId ? "bg-teal-50" : "hover:bg-gray-50"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                <DriverAvatarIcon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${t.unread ? "font-bold text-blue-950" : "font-medium text-gray-900"}`}>
                    {t.driverName}
                  </span>
                  {t.lastMessage && <span className="shrink-0 text-[10px] text-gray-400">{timeAgo(t.lastMessage.createdAt)}</span>}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-gray-500">
                    {t.lastMessage ? `${t.lastMessage.fromDriver ? "" : "You: "}${t.lastMessage.body}` : "No messages yet"}
                  </span>
                  {t.unread > 0 && (
                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-medium text-white">
                      {t.unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-[640px] flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 lg:col-span-2">
        {!activeDriverId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-gray-400">
            Pick a conversation on the left{canDispatch ? ", or start a new one with any driver" : ""}.
          </div>
        ) : (
          <>
            <div className="border-b border-gray-100 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-blue-950">{activeName}</h3>
                <CallButton
                  phone={drivers.find((d) => d._id === activeDriverId)?.phone}
                  name={activeName}
                  size="xs"
                />
              </div>
              <p className="text-[11px] text-teal-600">Messages show up in the driver&apos;s app — refreshes every 10 seconds</p>
            </div>
            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-gray-50 px-5 py-4">
              {loadingMessages && <Skeleton rows={4} rowClassName="h-10" />}
              {!loadingMessages && messages.length === 0 && (
                <p className="pt-10 text-center text-sm text-gray-400">No messages yet — say hello.</p>
              )}
              {messages.map((m, i) => {
                const date = new Date(m.createdAt);
                const prev = messages[i - 1];
                const showDay = !prev || new Date(prev.createdAt).toDateString() !== date.toDateString();
                return (
                  <div key={m._id}>
                    {showDay && (
                      <p className="my-3 text-center text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        {dayLabel(date)}
                      </p>
                    )}
                    <div className={`flex ${m.fromDriver ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                          m.fromDriver ? "bg-white text-gray-900 ring-1 ring-black/5" : "bg-teal-600 text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`mt-1 text-right text-[10px] ${m.fromDriver ? "text-gray-400" : "text-teal-100"}`}>
                          {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {!m.fromDriver && (m.readAt ? " · Read" : " · Sent")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {canDispatch ? (
              <form onSubmit={send} className="border-t border-gray-100 p-3">
                {sendError && <p className="mb-2 text-xs text-red-600">{sendError}</p>}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
                    className="flex-1 resize-none rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="inline-flex items-center gap-1.5 rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    <FiSend size={14} />
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="border-t border-gray-100 p-3 text-center text-xs text-gray-400">
                View-only access — you can read conversations but not reply.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
