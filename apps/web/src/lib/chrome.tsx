import { createContext, useContext, type RefObject } from 'react';

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
 * No-op. Auto-hide-on-scroll has been removed — the app chrome (top bar + bottom nav)
 * now stays pinned while scrolling. Kept as a no-op for call-site compatibility; pages
 * that still call it (with or without a scroll-container ref) simply keep their chrome.
 * The `useChrome().setHidden` escape hatch (e.g. the immersive watch page) is unaffected.
 */
export function useHideChromeOnScroll(_ref?: RefObject<HTMLElement | null>): void {
  // Intentionally empty — chrome is always visible while scrolling.
}
