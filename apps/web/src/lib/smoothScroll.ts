import { useEffect } from 'react';

/**
 * Dependency-free inertial wheel smoothing for a scroll container.
 *
 * Intercepts mouse/trackpad wheel events on the element matched by `selector`
 * and eases its scrollTop toward a target with a per-frame lerp — giving the
 * whole app a soft, weighty momentum instead of the OS's stepped scroll.
 *
 * It deliberately gets out of the way when it shouldn't smooth:
 *  - touch / coarse-pointer devices keep their native momentum,
 *  - wheel events over a nested scrollable area (feeds, modals, code blocks)
 *    scroll natively, so inner regions still work,
 *  - ctrl+wheel (pinch zoom) is left alone.
 */
export function useSmoothScroll(selector: string, ease = 0.14): void {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;
    // Pointer-coarse devices (touch) already have great native momentum.
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let target = el.scrollTop;
    let current = el.scrollTop;
    let raf = 0;
    let running = false;

    const maxScroll = () => Math.max(0, el.scrollHeight - el.clientHeight);
    const clamp = (v: number) => Math.max(0, Math.min(v, maxScroll()));

    const frame = () => {
      current += (target - current) * ease;
      if (Math.abs(target - current) < 0.4) {
        current = target;
        el.scrollTop = current;
        running = false;
        return;
      }
      el.scrollTop = current;
      raf = requestAnimationFrame(frame);
    };

    // True if the wheel started over an inner element that can scroll itself.
    const overNestedScroller = (start: EventTarget | null) => {
      let node = start as HTMLElement | null;
      while (node && node !== el) {
        if (node.nodeType === 1) {
          const oy = getComputedStyle(node).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
            return true;
          }
        }
        node = node.parentElement;
      }
      return false;
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      if (overNestedScroller(e.target)) return; // let inner regions scroll natively
      e.preventDefault();

      // Re-sync if the user grabbed the scrollbar or jumped via keyboard since last tick.
      if (!running) {
        current = el.scrollTop;
        target = el.scrollTop;
      }
      // Normalise line-mode deltas (some mice) to pixels.
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      target = clamp(target + dy);

      if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(raf);
    };
  }, [selector, ease]);
}
