"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SPECIAL_OFFER, offerLabel } from "../lib/pricing";

interface Slide {
  badge: string;
  badgeClass: string;
  title: string;
  body: string;
  link?: { href: string; label: string };
}

const SLIDE_MS = 6000;

// Sweeping carousel shown in the overview hero card for company-side roles:
// the special offer (when one is running), then what FIGBLOOM FLEET gives a
// fleet. Pauses while hovered so a slide can be read or its link clicked.
export default function OverviewSlides({ isOwner }: { isOwner: boolean }) {
  const slides: Slide[] = [
    ...(SPECIAL_OFFER.active
      ? [
          {
            badge: "Special offer",
            badgeClass: "bg-orange-500 text-white",
            title: offerLabel(),
            body: "The discount applies to every vehicle on your account.",
            link: isOwner ? { href: "/company/billing", label: "View plans →" } : undefined,
          },
        ]
      : []),
    {
      badge: "Always in view",
      badgeClass: "bg-teal-600 text-white",
      title: "See every vehicle live, wherever it is.",
      body: "Live map, geofence zones and instant alerts when a vehicle leaves its zone or moves without a driver.",
    },
    {
      badge: "Flexible by design",
      badgeClass: "bg-blue-600 text-white",
      title: "Start today — no special hardware needed.",
      body: "Connect a GPS tracker whenever you're ready, pay per vehicle, and change plans as your fleet grows.",
      link: isOwner ? { href: "/company/billing", label: "Compare plans →" } : undefined,
    },
    {
      badge: "Driver mobile app",
      badgeClass: "bg-emerald-700 text-white",
      title: "Your drivers get FIGBLOOM FLEET in their pocket.",
      body: "One-tap SOS to your dashboard, their vehicle's status and zone, trip history and real-time alerts — on Google Play.",
    },
  ];

  // `index` runs 0..slides.length, where slides.length is a copy of the
  // first slide appended to the track. Sweeping onto that copy and then
  // snapping (without animation) back to the real first slide keeps the
  // motion always moving forward instead of rewinding.
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const active = index % slides.length;

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setAnimate(true);
      setIndex((i) => Math.min(i + 1, slides.length));
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  // Re-enable the transition one frame after the silent snap back to 0.
  useEffect(() => {
    if (animate) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(frame);
  }, [animate]);

  // Once the sweep onto the copy has finished (700ms transition), snap back.
  // A timer rather than onTransitionEnd, which never fires when the user has
  // reduced motion on (no transition) and would leave the carousel stuck.
  useEffect(() => {
    if (index !== slides.length) return;
    const timer = setTimeout(() => {
      setAnimate(false);
      setIndex(0);
    }, 750);
    return () => clearTimeout(timer);
  }, [index, slides.length]);

  const track = [...slides, slides[0]];

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={`flex ${animate ? "transition-transform duration-700 ease-in-out motion-reduce:transition-none" : ""}`}
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {track.map((s, i) => (
          <div key={`${s.badge}-${i}`} className="w-full shrink-0 pr-4" aria-hidden={i !== index}>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.badgeClass}`}
            >
              {s.badge}
            </span>
            <p className="mt-2 text-[17px] font-bold text-blue-950">{s.title}</p>
            <p className="mt-1 text-[11px] font-bold text-teal-600">{s.body}</p>
            {s.link && (
              <Link
                href={s.link.href}
                tabIndex={i === index ? 0 : -1}
                className="mt-1 inline-block text-[11px] font-bold text-blue-950 hover:text-teal-700"
              >
                {s.link.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.badge}
            type="button"
            onClick={() => {
              setAnimate(true);
              setIndex(i);
            }}
            aria-label={`Show slide ${i + 1}: ${s.badge}`}
            className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-teal-600" : "w-1.5 bg-teal-600/30"}`}
          />
        ))}
      </div>
    </div>
  );
}
