import { createContext, useContext, useEffect, type RefObject } from 'react';

/**
 * App-chrome visibility — lets a page hide the shell's top bar and mobile bottom
 * nav (e.g. to maximize a scrolling feed) and reveal them again. Owned by AppLayout,
 * consumed by pages via {@link useHideChromeOnScroll}.
 */
export type ChromeContextValue = { hidden: boolean; setHidden: (v: boolean) => void };

export const ChromeContext = createContext<ChromeContextValue>({
  hidden: false,
  setHidden: () => {},
});

export function useChrome(): ChromeContextValue {
  return useContext(ChromeContext);
}

/**
 * Hide the app chrome while scrolling down inside a container and reveal it on
 * scroll up — the familiar mobile pattern. Mobile-only (a no-op at md+), and it
 * always restores the chrome when the page unmounts.
 *
 * Pass a ref to the page's own scroll element; omit it to watch the app's main
 * scroll root (`#app-scroll-root`).
 */
export function useHideChromeOnScroll(ref?: RefObject<HTMLElement | null>): void {
  const { setHidden } = useChrome();

  useEffect(() => {
    const el = ref?.current ?? document.getElementById('app-scroll-root');
    if (!el) return;

    const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
    // px of sustained same-direction movement required before toggling. Hysteresis:
    // the accumulator resets when the scroll direction flips, so momentum wobble and
    // the reflow from collapsing the top bar can't ping-pong the state (the flicker).
    const THRESHOLD = 28;
    let lastY = el.scrollTop;
    let accum = 0;
    let hiddenNow = false;
    let ticking = false;

    const set = (v: boolean) => {
      if (v === hiddenNow) return; // only cross the boundary once
      hiddenNow = v;
      setHidden(v);
      accum = 0;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!isMobile()) {
          set(false); // desktop keeps the chrome pinned
          return;
        }
        const y = el.scrollTop;
        const dy = y - lastY;
        lastY = y;
        if (y <= 8) return set(false); // always show at the very top
        // Reset the run when direction flips, then require sustained travel.
        if ((dy > 0 && accum < 0) || (dy < 0 && accum > 0)) accum = 0;
        accum += dy;
        if (accum > THRESHOLD && y > 48) set(true);
        else if (accum < -THRESHOLD) set(false);
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      setHidden(false); // reveal when leaving the page
    };
  }, [ref, setHidden]);
}

/**
 * Renderless global watcher — enables hide-on-scroll for every page that scrolls in
 * the app's main scroll root. Mount it inside the ChromeContext provider (so it reads
 * the real state) and re-key it per route so it re-anchors and reveals on navigation.
 * Pages with their own scroll container (e.g. Community's feed) call
 * {@link useHideChromeOnScroll} directly instead.
 */
export function ChromeScrollWatcher(): null {
  useHideChromeOnScroll();
  return null;
}
