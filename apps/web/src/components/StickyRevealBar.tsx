import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Renders `children` in-flow, and once they scroll above the top of the app's scroll
 * container (#app-scroll-root), reveals a full-width duplicate fixed to the viewport top.
 *
 * The duplicate is portaled to <body> so no transformed / will-change ancestor (framer-motion
 * adds these) traps its fixed positioning or stacking context; framer-motion springs it in/out.
 * `children` are rendered in both places, so keep them prop/route-driven (no local state that
 * must stay unique per instance). Used for sticky tab bars / control clusters.
 */
export function StickyRevealBar({
  children,
  className,
  barClassName,
}: {
  children: ReactNode;
  className?: string;
  /** Extra classes for the floating band (e.g. `lg:hidden` to disable it on desktop). */
  barClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.getElementById('app-scroll-root');
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e) setStuck(!e.isIntersecting && e.boundingClientRect.top < 0);
      },
      { root, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={ref} className={className}>
        {children}
      </div>
      {createPortal(
        <AnimatePresence>
          {stuck ? (
            <motion.div
              key="sticky-reveal-bar"
              initial={{ y: '-100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.6 }}
              className={`fixed left-0 top-0 z-40 w-full bg-canvas px-4 pb-3 pt-1 shadow-sm ${barClassName ?? ''}`}
            >
              <div className="mx-auto w-full max-w-8xl">{children}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
