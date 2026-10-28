"use client";

import { useEffect, useState } from "react";

const TEAL = { r: 45, g: 212, b: 191 }; // #50a86a
const RED = { r: 239, g: 68, b: 68 }; // #ef4444

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function toHex(n: number) {
  return n.toString(16).padStart(2, "0");
}

/**
 * A hex color that breathes between teal and red and back, on a loop —
 * used to make geofence zone circles on the map pulse like an active zone.
 * Google Maps' Circle isn't a DOM element, so a CSS animation can't touch
 * its fill/stroke — this drives the color via state instead, which
 * @react-google-maps/api picks up through Circle's `options` prop.
 */
export function usePulseColor(periodMs = 2400) {
  const [color, setColor] = useState(`#${toHex(TEAL.r)}${toHex(TEAL.g)}${toHex(TEAL.b)}`);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const start = Date.now();

    // Ticks at ~10fps — plenty smooth for a slow color breathe, without
    // forcing Google Maps to re-render the circle's options 60x/sec.
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      // 0 -> teal, 0.5 -> red, 1 -> teal, eased via cosine
      const t = (1 - Math.cos((2 * Math.PI * elapsed) / periodMs)) / 2;
      const r = lerp(TEAL.r, RED.r, t);
      const g = lerp(TEAL.g, RED.g, t);
      const b = lerp(TEAL.b, RED.b, t);
      setColor(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
    }, 100);

    return () => clearInterval(interval);
  }, [periodMs]);

  return color;
}
