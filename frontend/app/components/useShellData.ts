"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { CompanyRecord, AlertRecord, GeofenceRecord } from "../types/auth";
import { isOutsideGeofences } from "../lib/geofence";
import { ToastAlert } from "./AlertToast";

// Everything a portal shell shows around the page — company name, alert
// badge + toasts, unread messages, in/out-of-zone counts — polled here once
// so DashboardShell and AppShell share it.
export function useShellData({ alerts, messages, zones }: { alerts: boolean; messages: boolean; zones: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isCompanySide = user?.role === "COMPANY_OWNER" || user?.role === "ADMIN";

  // Company name shown on every page — fetched once here so company owners
  // and admins don't have to re-fetch it per page.
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyIndustry, setCompanyIndustry] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isCompanySide) return;
    let cancelled = false;
    apiRequest<CompanyRecord>("/api/companies/me")
      .then((company) => {
        if (!cancelled) {
          setCompanyName(company.name);
          setCompanyIndustry(company.industry ?? null);
          setCompanyLogoUrl(company.logoUrl ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanyName(null);
          setCompanyIndustry(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isCompanySide]);

  // Unresolved alert count — shown as a badge, on every page. New alerts
  // also pop up as a toast for a few seconds.
  const [alertCount, setAlertCount] = useState(0);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const seenAlertIds = useRef<Set<string> | null>(null);

  function dismissToast(id: string) {
    setToasts((current) => current.filter((t) => t.id !== id));
  }

  useEffect(() => {
    if (!alerts) return;
    let cancelled = false;

    async function loadAlerts() {
      try {
        const list = await apiRequest<AlertRecord[]>("/api/alerts");
        if (cancelled) return;
        setAlertCount(list.filter((a) => !a.resolved).length);

        const seen = seenAlertIds.current;
        if (seen === null) {
          // First load after mount — establish a baseline so we don't
          // toast every alert that already existed before this session.
          seenAlertIds.current = new Set(list.map((a) => a._id));
          return;
        }

        const newAlerts = list.filter((a) => !seen.has(a._id));
        if (newAlerts.length > 0) {
          newAlerts.forEach((a) => seen.add(a._id));
          setToasts((current) => [...current, ...newAlerts.map((a) => ({ id: a._id, alert: a }))]);
        }
      } catch {
        if (!cancelled) setAlertCount(0);
      }
    }

    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [alerts]);

  // Unread driver messages. Polled slower than the conversation pane
  // itself, which refreshes every 10 s while open.
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!messages) return;
    let cancelled = false;
    async function loadUnread() {
      try {
        const threads = await apiRequest<{ unread: number }[]>("/api/messages/threads");
        if (!cancelled) setUnreadMessages(threads.reduce((sum, t) => sum + (t.unread || 0), 0));
      } catch {
        // Badge is best-effort — leave the last known count.
      }
    }
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [messages, pathname]);

  // Fleet in-zone / out-of-zone counts, company-side only. A vehicle only
  // counts once it has a live location; with no geofences set up yet
  // there's nothing to be "in" or "out" of, so this stays null.
  const [zoneCounts, setZoneCounts] = useState<{ inZone: number; outOfZone: number } | null>(null);

  useEffect(() => {
    if (!zones || !isCompanySide) return;
    let cancelled = false;

    async function loadZoneCounts() {
      try {
        const [vehicles, geofences] = await Promise.all([
          apiRequest<{ lastLocation: { latitude: number; longitude: number } | null }[]>("/api/tracking/live"),
          apiRequest<GeofenceRecord[]>("/api/geofences"),
        ]);
        if (cancelled) return;

        if (geofences.length === 0) {
          setZoneCounts(null);
          return;
        }

        const withLocation = vehicles.filter((v) => v.lastLocation);
        const outOfZone = withLocation.filter((v) =>
          isOutsideGeofences(v.lastLocation!.latitude, v.lastLocation!.longitude, geofences)
        ).length;
        setZoneCounts({ inZone: withLocation.length - outOfZone, outOfZone });
      } catch {
        if (!cancelled) setZoneCounts(null);
      }
    }

    loadZoneCounts();
    const interval = setInterval(loadZoneCounts, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [zones, isCompanySide]);

  return { companyName, companyIndustry, companyLogoUrl, alertCount, toasts, dismissToast, unreadMessages, zoneCounts };
}
