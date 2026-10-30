// Scroll-in animation for the landing page (Motion): fade up once as the
// element comes into view. Spread onto any motion.* element; `delay` (in
// seconds) staggers the cards in a grid. Visitors who ask for reduced motion
// get no movement (MotionConfig reducedMotion="user" in the page).
export function reveal(delay = 0) {
  return {
    initial: { opacity: 0, y: 32 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "0px 0px -10% 0px" },
    transition: { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] as const, delay },
  };
}

// The hero's entrance on page load: same motion, played straight away.
export function enter(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: [0.2, 0.7, 0.2, 1] as const, delay },
  };
}
