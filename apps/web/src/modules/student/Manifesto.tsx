import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import { ArrowLeft, MousePointer2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BlackHoleTransition } from '../../components/BlackHoleTransition.js';

/**
 * Student Manifesto — a full-screen, distraction-free experience (no app shell:
 * no sidebar, no header). The only chrome is a fixed "Back to home" button.
 *
 * Interaction model: a discrete horizontal carousel. Any scroll gesture (wheel,
 * trackpad, touch swipe, arrow keys) advances **exactly one card** — no matter
 * how hard or long the scroll — by locking input for the duration of the gesture.
 * The track springs sideways to center the active card. Background is a living
 * aurora (no solid fill).
 */

type Block = {
  index: string;
  kicker: string;
  title: string;
  body: string;
  image: string;
};

const BLOCKS: Block[] = [
  {
    index: '01',
    kicker: 'Why Mentra',
    title: 'Your degree opens the door. We get you the job.',
    body: 'Between a college degree and a real job lies a gap no syllabus fills. Mentra is the system that closes it — no big connections, no luck, just a clear path from where you are today to your first offer letter.',
    image:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80',
  },
  {
    index: '02',
    kicker: 'Know where you stand',
    title: 'An honest read on your real level.',
    body: 'A short, AI-built assessment figures out what you actually know — not your CGPA. No sugar-coating, no generic gyaan. It becomes the starting point everything else is built on.',
    image:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=80',
  },
  {
    index: '03',
    kicker: 'Your plan',
    title: 'A week-by-week plan, made for you.',
    body: 'Not a 100-hour YouTube playlist. A roadmap tuned to your goal — backend, frontend, data, a product company or a startup. Finish one milestone, the next unlocks. You always know your next step.',
    image:
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80',
  },
  {
    index: '04',
    kicker: 'Build the basics',
    title: 'The concepts interviews actually ask.',
    body: 'DSA, core CS subjects and the practical skills that show up in real interviews — in the right order, at your own pace. Strong fundamentals beat a stack of certificates every single time.',
    image:
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80',
  },
  {
    index: '05',
    kicker: 'Show, don’t tell',
    title: 'A portfolio that beats your marksheet.',
    body: 'Ship real projects a recruiter can open and run. When your GitHub does the talking, you stop depending on a percentage printed on a piece of paper.',
    image:
      'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1400&q=80',
  },
  {
    index: '06',
    kicker: '1:1 guidance',
    title: 'Mentors who have already cracked it.',
    body: 'Book a 1:1 with engineers working at the companies you are aiming for. Get your doubts cleared, your resume reviewed, and honest feedback from someone who has walked this exact road.',
    image:
      'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1400&q=80',
  },
  {
    index: '07',
    kicker: 'Learn live',
    title: 'Live classes. Real-time doubts.',
    body: 'Join live sessions, ask your questions the moment they come up, and learn from mentors teaching the way placement prep should be — interactive, current, and straight to the point.',
    image:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1400&q=80',
  },
  {
    index: '08',
    kicker: 'You are not alone',
    title: 'Thousands of students, the same goal.',
    body: 'Prepare alongside students from every corner of India. Share doubts, swap referrals, keep each other going. In placement season momentum is everything — and here it is built in.',
    image:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80',
  },
  {
    index: '09',
    kicker: 'The opportunities',
    title: 'The right openings find you.',
    body: 'Our AI scans the market and matches internships and fresher jobs to your skills — so your list finally has roles you can actually crack. You apply with proof, not just hope.',
    image:
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80',
  },
  {
    index: '10',
    kicker: 'The first offer',
    title: 'The call home you have been waiting to make.',
    body: 'Your first offer letter. Your first salary. The moment you tell your parents it finally worked. You bring the effort — Mentra brings the system. Let us go land it.',
    image:
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80',
  },
];

export function ManifestoPage() {
  const navigate = useNavigate();
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Infinite forward loop: render several copies of the blocks and keep an
  // UNBOUNDED index. After each move we silently re-center onto the middle band
  // (an identical copy), so 7 → 1 keeps gliding forward and never snaps back.
  const N = BLOCKS.length;
  const COPIES = 5;
  const START = 2 * N; // start in the middle copy
  const looped = useMemo(() => Array.from({ length: COPIES }, () => BLOCKS).flat(), [N]);

  const [active, setActive] = useState(START);
  const [moved, setMoved] = useState(false);
  // Warp: born out of the singularity on entry, collapse back into it on exit.
  const [intro, setIntro] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const x = useMotionValue(0);
  const instant = useRef(true); // first placement jumps (no slide-in)

  const dotActive = ((active % N) + N) % N;

  // Warm the browser cache for every image up-front so cards never pop in blank.
  useEffect(() => {
    BLOCKS.forEach((b) => {
      const img = new Image();
      img.src = b.image;
    });
  }, []);

  const go = useCallback((dir: number) => {
    setMoved(true);
    setActive((a) => a + dir); // unbounded — wrapping handled after each move
  }, []);

  const targetFor = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return null;
    const card = track.querySelector<HTMLElement>(`[data-card="${i}"]`);
    if (!card) return null;
    return window.innerWidth / 2 - (card.offsetLeft + card.offsetWidth / 2);
  }, []);

  // Glide the active card to center; on settle, re-center onto the middle band.
  useEffect(() => {
    const target = targetFor(active);
    if (target == null) return;

    if (instant.current) {
      x.jump(target);
      instant.current = false;
      return;
    }

    const controls = animate(x, target, {
      duration: 1.15,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo — fast take-off, long silky settle
      onComplete: () => {
        // The card at `active ± N` is identical and exactly one copy away, so
        // jumping there is visually seamless — keeps us away from the edges.
        if (active >= 3 * N) {
          instant.current = true;
          setActive(active - N);
        } else if (active < N) {
          instant.current = true;
          setActive(active + N);
        }
      },
    });
    return () => controls.stop();
  }, [active, targetFor, x, N]);

  // Re-center instantly on resize.
  useEffect(() => {
    const onResize = () => {
      const target = targetFor(active);
      if (target != null) x.jump(target);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, targetFor, x]);

  // Auto-advance one card every 5s. Keyed on `active`, so any move (manual or
  // auto) resets the countdown. Paused during the warp transitions.
  useEffect(() => {
    if (intro || leaving) return;
    const id = setTimeout(() => go(1), 5000);
    return () => clearTimeout(id);
  }, [active, intro, leaving, go]);

  // One gesture = one card. Lock input until the gesture (and its inertia) ends.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    let locked = false;
    let timer: ReturnType<typeof setTimeout>;
    const lock = () => {
      locked = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        locked = false;
      }, 820);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (locked) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 4) return;
      lock();
      go(delta > 0 ? 1 : -1);
    };

    let startX = 0;
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (locked) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(d) < 40) return;
      lock();
      go(d < 0 ? 1 : -1); // swipe up / left → next
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        go(-1);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, [go]);

  return (
    <>
    <motion.div
      className="h-screen w-screen bg-black"
      animate={
        leaving ? { scale: 0.04, rotateX: 55, rotateZ: 28, z: -700, filter: 'blur(14px)', opacity: 0 } : {}
      }
      transition={{ duration: 1.6, ease: [0.6, 0, 0.85, 0.25] }}
      style={{ transformOrigin: 'center center', transformPerspective: 1200 }}
    >
    <div
      ref={stageRef}
      className="relative h-screen w-screen touch-none overflow-hidden bg-black text-white"
    >
      {/* ---------- Living monochrome haze background (no solid fill) ---------- */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-40 top-[-10%] h-[55vw] w-[55vw] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_60%)] blur-3xl"
          animate={{ x: [0, 120, 0], y: [0, 80, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[-15%] top-[20%] h-[50vw] w-[50vw] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.1),transparent_60%)] blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, 120, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-20%] left-[30%] h-[45vw] w-[45vw] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_60%)] blur-3xl"
          animate={{ x: [0, 80, 0], y: [0, -90, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        />
        {DOTS.map((d, i) => (
          <motion.span
            key={i}
            className="absolute size-1.5 rounded-full bg-white shadow-[0_0_14px_5px_rgba(255,255,255,0.7)]"
            style={{ top: d.top, left: d.left }}
            animate={{ opacity: [0.12, 0.9, 0.12], scale: [0.8, 1.4, 0.8] }}
            transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,transparent_40%,rgba(0,0,0,0.9)_100%)]" />
      </div>

      {/* ---------- Intro line ---------- */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 px-8 pt-9 sm:px-16">
        <motion.p
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-xs font-semibold uppercase tracking-[0.4em] text-white/70"
        >
          The Mentra Manifesto
        </motion.p>
      </div>

      {/* ---------- Carousel track (looped copies for infinite forward) ---------- */}
      <div className="absolute inset-0 flex items-center">
        <motion.div ref={trackRef} style={{ x }} className="flex items-center gap-8 px-[7vw] sm:gap-14">
          {looped.map((block, i) => (
            <ManifestoCard key={i} block={block} index={i} active={i === active} eager={i === START} />
          ))}
        </motion.div>
      </div>

      {/* ---------- Progress dots (clickable) ---------- */}
      <div className="absolute left-1/2 top-7 z-20 flex -translate-x-1/2 items-center gap-2">
        {BLOCKS.map((b, i) => (
          <button
            key={b.index}
            type="button"
            aria-label={`Go to card ${i + 1}`}
            onClick={() => {
              setMoved(true);
              setActive((a) => a - (((a % N) + N) % N) + i);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === dotActive ? 'w-7 bg-white' : 'w-1.5 bg-white/25 hover:bg-white/40'
            }`}
          />
        ))}
      </div>

      {/* ---------- Scroll hint (only on first card) ---------- */}
      <motion.div
        animate={{ opacity: moved ? 0 : 1 }}
        className="pointer-events-none absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 text-xs text-white/55"
      >
        <MousePointer2 className="size-4" />
        Scroll to advance
      </motion.div>

      {/* ---------- The only chrome: Back to home ---------- */}
      <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center">
        <button
          type="button"
          onClick={() => setLeaving(true)}
          className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-transparent px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/60 hover:text-white"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          Back to home
        </button>
      </div>
    </div>
    </motion.div>

    {intro && <BlackHoleTransition direction="in" onComplete={() => setIntro(false)} />}
    {leaving && (
      <BlackHoleTransition
        direction="out"
        onComplete={() => navigate('/dashboard', { state: { warp: true } })}
      />
    )}
    </>
  );
}

function ManifestoCard({
  block,
  index,
  active,
  eager,
}: {
  block: Block;
  index: number;
  active: boolean;
  eager: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // Cached images can finish before React attaches onLoad — catch that on mount.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <motion.article
      data-card={index}
      animate={{
        scale: active ? 1 : 0.84,
        opacity: active ? 1 : 0.3,
        y: active ? 0 : 26,
        filter: active ? 'blur(0px)' : 'blur(3px)',
      }}
      transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-[72vh] w-[86vw] shrink-0 overflow-hidden rounded-[28px] bg-white/[0.04] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:w-[74vw] lg:w-[56vw]"
    >
      {/* top sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {/* Col 1 — image */}
      <div className="relative hidden w-1/2 overflow-hidden md:block">
        {/* shimmer placeholder shown until the image decodes */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent"
          animate={{ opacity: loaded ? 0 : [0.4, 0.8, 0.4] }}
          transition={loaded ? { duration: 0.5 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.img
          ref={imgRef}
          src={block.image}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          onLoad={() => setLoaded(true)}
          animate={{
            scale: active ? 1.02 : 1.15,
            opacity: loaded ? 1 : 0,
            filter: loaded ? 'blur(0px)' : 'blur(16px)',
          }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="h-full w-full object-cover grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black" />
        <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
      </div>

      {/* Col 2 — text */}
      <div className="relative flex w-full flex-col justify-center gap-5 p-9 md:w-1/2 md:p-14">
        <div className="flex items-center gap-3">
          <span className="bg-gradient-to-br from-white/70 to-white/20 bg-clip-text text-5xl font-black leading-none text-transparent sm:text-6xl">
            {block.index}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
            {block.kicker}
          </span>
        </div>

        <h2 className="text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
          {block.title}
        </h2>

        <p className="max-w-md text-base leading-relaxed text-white/60 sm:text-lg">{block.body}</p>
      </div>

    </motion.article>
  );
}

/** Fixed dot positions/timings so they don't reshuffle on every render. */
const DOTS = [
  { top: '14%', left: '10%', dur: 4, delay: 0 },
  { top: '72%', left: '18%', dur: 3.2, delay: 1.1 },
  { top: '28%', left: '42%', dur: 5, delay: 0.5 },
  { top: '82%', left: '55%', dur: 3.6, delay: 1.9 },
  { top: '20%', left: '70%', dur: 4.4, delay: 0.8 },
  { top: '64%', left: '86%', dur: 3, delay: 1.4 },
  { top: '44%', left: '94%', dur: 4.8, delay: 2.2 },
  { top: '52%', left: '6%', dur: 3.8, delay: 0.3 },
];
