import { onBeforeUnmount, onMounted } from "vue";

/**
 * Turns every wheel gesture, swipe or arrow/page key into exactly one step between scroll stops.
 * The page still scrolls natively in between (the tween drives window.scrollTo), so everything
 * that listens to scroll — camera, text scrubbing — follows along.
 *
 * `stops()` returns the scroll positions, ascending; `enabled()` gates input (e.g. during an intro).
 */
export function useStepScroll(opts: { stops: () => number[]; enabled: () => boolean; duration?: number }) {
  let animating = false;
  let raf = 0;
  let target = 0;

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  function scrollTo(y: number, duration = opts.duration ?? 1100) {
    cancelAnimationFrame(raf);
    const from = window.scrollY;
    target = y;
    if (Math.abs(y - from) < 1 || duration <= 0) {
      window.scrollTo(0, y);
      animating = false;
      return;
    }
    animating = true;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      window.scrollTo(0, from + (y - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(frame);
      else animating = false;
    };
    raf = requestAnimationFrame(frame);
  }

  /** Next stop strictly beyond the current position in the given direction. */
  function step(dir: 1 | -1) {
    const stops = opts.stops();
    if (!stops.length) return;
    const y = animating ? target : window.scrollY;
    const next = dir > 0 ? stops.find((s) => s > y + 4) : [...stops].reverse().find((s) => s < y - 4);
    if (next !== undefined) scrollTo(next);
  }

  // --- wheel (mouse + trackpad) ---
  // Trackpads keep emitting decaying "momentum" events after a flick; only a pause or a rising
  // delta counts as a new gesture, so one flick moves exactly one stop.
  let lastWheel = 0;
  let lastDelta = 0;
  let consumed = false;
  function onWheel(e: WheelEvent) {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // pinch-zoom / horizontal
    e.preventDefault();
    if (!opts.enabled()) return;
    const now = performance.now();
    const d = Math.abs(e.deltaY);
    const newGesture = now - lastWheel > 200 || d > lastDelta * 1.5 + 8;
    lastWheel = now;
    lastDelta = d;
    if (newGesture) consumed = false;
    if (consumed || animating || d < 2) return;
    consumed = true;
    step(e.deltaY > 0 ? 1 : -1);
  }

  // --- touch ---
  let startX = 0;
  let startY = 0;
  function onTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }
  function onTouchMove(e: TouchEvent) {
    if (e.touches.length === 1 && e.cancelable) e.preventDefault(); // keep pinch-zoom
  }
  function onTouchEnd(e: TouchEvent) {
    if (!opts.enabled()) return;
    const dx = startX - e.changedTouches[0].clientX;
    const dy = startY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) step(dy > 0 ? 1 : -1);
  }

  // --- keyboard ---
  function onKey(e: KeyboardEvent) {
    if (!opts.enabled() || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement | null;
    if (el?.closest("input, textarea, select, [contenteditable]")) return;
    const stops = opts.stops();
    const map: Record<string, () => void> = {
      ArrowDown: () => step(1),
      PageDown: () => step(1),
      " ": () => step(e.shiftKey ? -1 : 1),
      ArrowUp: () => step(-1),
      PageUp: () => step(-1),
      Home: () => scrollTo(stops[0]),
      End: () => scrollTo(stops[stops.length - 1]),
    };
    const action = map[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  }

  // --- anything else (scrollbar drag, find-in-page, focus): settle on the nearest stop ---
  let settleTimer = 0;
  function onScroll() {
    if (animating) return;
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      const stops = opts.stops();
      if (!opts.enabled() || animating || !stops.length) return;
      const y = window.scrollY;
      const nearest = stops.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
      if (Math.abs(nearest - y) > 2) scrollTo(nearest, 700);
    }, 220);
  }

  onMounted(() => {
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
  });

  onBeforeUnmount(() => {
    cancelAnimationFrame(raf);
    clearTimeout(settleTimer);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("scroll", onScroll);
  });

  return { scrollTo };
}
