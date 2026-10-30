import { useEffect } from "react";

// Fades every [data-reveal] element up as it scrolls into view (see .reveal
// in globals.css). Only what's still below the fold when the page opens is
// hidden — so nothing on screen flashes, and without JavaScript everything
// simply shows. Off when the visitor asks for reduced motion.
export function useScrollReveal() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          el.classList.add("revealed");
          // Once it has arrived, hand transitions back to the element's own
          // classes (hover effects).
          const done = (e: TransitionEvent) => {
            // Ignore transitions bubbling up from nested cards.
            if (e.target !== el || e.propertyName !== "transform") return;
            el.removeEventListener("transitionend", done);
            el.classList.remove("reveal", "revealed");
            el.style.removeProperty("--reveal-delay");
          };
          el.addEventListener("transitionend", done);
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );

    for (const el of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
      if (el.getBoundingClientRect().top < window.innerHeight) continue;
      el.classList.add("reveal");
      // data-reveal={120} staggers it by 120 ms; a bare data-reveal doesn't.
      const delay = Number(el.dataset.reveal);
      if (delay > 0) el.style.setProperty("--reveal-delay", `${delay}ms`);
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);
}
