import { motion } from 'framer-motion';

/**
 * Full-screen, 3D "black hole" route transition.
 *
 *  - direction="out": the screen falls away into depth and is swallowed — a
 *    tilted accretion disk spins up and a spherical core expands to consume
 *    everything. Fire navigate() in onComplete.
 *  - direction="in": the singularity collapses — the core shrinks into the
 *    distance and the new screen is born from a flash. Unmount in onComplete.
 *
 * Monochrome (white light / black void) to match the manifesto theme. Pair it
 * with a perspective dive on the page content for the "UI breaking apart" feel.
 */
export function BlackHoleTransition({
  direction,
  onComplete,
}: {
  direction: 'in' | 'out';
  onComplete?: () => void;
}) {
  const out = direction === 'out';
  const D = 1.7; // seconds — slow, cinematic

  return (
    <motion.div
      className="fixed inset-0 z-[120] overflow-hidden"
      style={{ pointerEvents: 'auto', perspective: 1300 }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
    >
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        {/* warp streaks — light tunnelling past the camera toward the core */}
        {STREAKS.map((s, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-px origin-left bg-gradient-to-r from-white/0 via-white/70 to-white/0"
            style={{ rotate: `${s.angle}deg`, width: '70vmax' }}
            initial={{ scaleX: out ? 0 : 1, z: out ? 200 : -200, opacity: 0 }}
            animate={{
              scaleX: out ? [0, 1, 0.15] : [1, 0.4, 0],
              z: out ? [200, -300, -600] : [-600, -200, 200],
              opacity: out ? [0, 0.85, 0] : [0.5, 0.3, 0],
            }}
            transition={{ duration: D, ease: 'easeInOut', delay: s.delay }}
          />
        ))}

        {/* accretion disk — tilted in 3D and spinning around its axis */}
        <motion.div
          className="absolute left-1/2 top-1/2 aspect-square w-[80vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            rotateX: 72,
            transformStyle: 'preserve-3d',
            background:
              'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.95) 10%, transparent 28%, rgba(255,255,255,0.5) 52%, transparent 70%, rgba(255,255,255,0.8) 88%, transparent 100%)',
            filter: 'blur(16px)',
          }}
          initial={{ scale: out ? 0.06 : 2.6, rotateZ: 0, opacity: out ? 0 : 1 }}
          animate={{
            scale: out ? 2.6 : 0.06,
            rotateZ: out ? 540 : -540,
            opacity: out ? [0, 1, 0.85, 0] : [0.85, 1, 0],
          }}
          transition={{ duration: D, ease: 'easeInOut' }}
        />

        {/* second, counter-rotating disk for parallax depth */}
        <motion.div
          className="absolute left-1/2 top-1/2 aspect-square w-[58vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            rotateX: 72,
            transformStyle: 'preserve-3d',
            background:
              'conic-gradient(from 90deg, transparent 0%, rgba(255,255,255,0.6) 16%, transparent 40%, rgba(255,255,255,0.35) 64%, transparent 92%)',
            filter: 'blur(22px)',
          }}
          initial={{ scale: out ? 0.06 : 2.2, rotateZ: 0, opacity: out ? 0 : 0.8 }}
          animate={{
            scale: out ? 2.2 : 0.06,
            rotateZ: out ? -360 : 360,
            opacity: out ? [0, 0.8, 0.6, 0] : [0.6, 0.8, 0],
          }}
          transition={{ duration: D, ease: 'easeInOut' }}
        />

        {/* singularity flash */}
        <motion.div
          className="absolute left-1/2 top-1/2 aspect-square w-[26vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white blur-2xl"
          initial={{ opacity: 0, scale: 0.2 }}
          animate={
            out
              ? { opacity: [0, 0, 0.95, 0], scale: [0.2, 0.4, 1.2, 1.6] }
              : { opacity: [0.95, 0.3, 0], scale: [1.4, 0.6, 0.2] }
          }
          transition={{ duration: D, ease: 'easeOut' }}
        />

        {/* spherical black hole core — rim-lit for volume */}
        <motion.div
          className="absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle at 38% 32%, #1c1c1c 0%, #050505 52%, #000 100%)',
            boxShadow:
              '0 0 130px 34px rgba(255,255,255,0.28), inset 0 0 70px rgba(255,255,255,0.08), inset 18px 12px 60px rgba(255,255,255,0.05)',
          }}
          initial={{ width: out ? 0 : '340vmax', z: out ? -200 : 0 }}
          animate={{ width: out ? '340vmax' : 0, z: out ? 0 : -200 }}
          transition={{ duration: D, ease: out ? [0.62, 0, 0.84, 0.2] : [0.16, 1, 0.3, 1] }}
          onAnimationComplete={onComplete}
        />
      </div>
    </motion.div>
  );
}

/** Radial warp streaks at fixed angles so they don't reshuffle each render. */
const STREAKS = Array.from({ length: 16 }, (_, i) => ({
  angle: (360 / 16) * i,
  delay: (i % 6) * 0.04,
}));
