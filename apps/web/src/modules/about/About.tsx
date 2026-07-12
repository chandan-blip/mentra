import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { StickyRevealBar } from '../../components/StickyRevealBar.js';
import {
  BadgeCheck,
  FileText,
  Heart,
  Info,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

/**
 * Company / legal pages — About, Terms, Privacy, Refund, Contact. Available to every
 * role (access governed by the `about` module like any other). Settings-style layout:
 * a left nav with a full-width content panel (rich text + image banners) on the right.
 */

type SectionId = 'about' | 'terms' | 'privacy' | 'refund' | 'contact';

const NAV: { id: SectionId; label: string; icon: ReactNode }[] = [
  { id: 'about', label: 'About us', icon: <Info className="size-4" /> },
  { id: 'terms', label: 'Terms of Service', icon: <FileText className="size-4" /> },
  { id: 'privacy', label: 'Privacy Policy', icon: <ShieldCheck className="size-4" /> },
  { id: 'refund', label: 'Refund Policy', icon: <RotateCcw className="size-4" /> },
  { id: 'contact', label: 'Contact us', icon: <Mail className="size-4" /> },
];

export function AboutPage() {
  const [section, setSection] = useState<SectionId>('about');

  return (
    <div className="mx-auto pt-3 w-full max-w-9xl">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left: title + description + nav — sticky together on desktop; on mobile the nav
            reveals a floating copy from the top on scroll (hidden on lg, where it's sticky). */}
        <div className="min-w-0 lg:sticky lg:top-0 lg:h-fit">
          <h1 className="text-display-md tracking-normal">About Mentra</h1>
          <p className="mt-1 text-sm text-ink-muted">Who we are, and the policies that keep things fair.</p>

          <StickyRevealBar className="mt-5" barClassName="lg:hidden">
            <AboutNav section={section} onChange={setSection} />
          </StickyRevealBar>
        </div>

        {/* Full-width content */}
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="min-w-0"
        >
          {section === 'about' ? <AboutUs /> : null}
          {section === 'terms' ? <Terms /> : null}
          {section === 'privacy' ? <Privacy /> : null}
          {section === 'refund' ? <Refund /> : null}
          {section === 'contact' ? <Contact /> : null}
        </motion.div>
      </div>
    </div>
  );
}

/** Section nav — horizontal + scrollable on mobile, vertical list on desktop. Owns its own
 *  refs so it can be safely rendered twice (in-flow + the floating StickyRevealBar copy). */
function AboutNav({ section, onChange }: { section: SectionId; onChange: (s: SectionId) => void }) {
  const refs = useRef<Partial<Record<SectionId, HTMLButtonElement | null>>>({});

  // Center the active item HORIZONTALLY only (mobile) — never scrollIntoView, which would
  // jump the page vertically when the off-screen floating copy mounts.
  useEffect(() => {
    const btn = refs.current[section];
    const container = btn?.parentElement;
    if (!btn || !container) return;
    const cr = container.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const target = container.scrollLeft + (br.left - cr.left) - (container.clientWidth - btn.clientWidth) / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [section]);

  return (
    <nav className="flex snap-x snap-mandatory flex-row gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col lg:snap-none [&::-webkit-scrollbar]:hidden">
      {NAV.map((n) => (
        <button
          key={n.id}
          ref={(el) => {
            refs.current[n.id] = el;
          }}
          type="button"
          onClick={() => onChange(n.id)}
          className={[
            'flex shrink-0 snap-center items-center gap-2 whitespace-nowrap rounded-md px-3 py-2.5 text-left text-sm font-medium transition',
            n.id === section ? 'bg-surface-inverse text-ink-inverse' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
          ].join(' ')}
        >
          {n.icon}
          {n.label}
        </button>
      ))}
    </nav>
  );
}

/* ---------- Reusable image / layout bits ---------- */

const grad = (hue: number) =>
  `radial-gradient(120% 120% at 20% 10%, hsl(${hue} 75% 55%), hsl(${(hue + 50) % 360} 70% 38%) 70%)`;

/** Full-width image banner. Falls back to the gradient if the image is missing. */
function Hero({ hue, icon, kicker, title, image }: { hue: number; icon: ReactNode; kicker: string; title: string; image?: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg" style={{ background: grad(hue) }}>
      {image ? <img src={image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" /> : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
      <div className="relative flex min-h-[200px] flex-col justify-end gap-1 p-6 sm:min-h-[260px] sm:p-8">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/25 [&_svg]:size-3.5">
          {icon} {kicker}
        </span>
        <h2 className="max-w-2xl text-display-md font-semibold leading-tight text-white">{title}</h2>
      </div>
    </div>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <div className="mt-6 space-y-4 text-sm leading-7 text-ink-muted">{children}</div>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-base font-semibold text-ink">{children}</h3>;
}

function ImageCard({ hue, icon, label, image }: { hue: number; icon: ReactNode; label: string; image?: string }) {
  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-border-subtle">
      <div className="relative grid aspect-[4/3] place-items-center text-white [&_svg]:size-8" style={{ background: grad(hue) }}>
        {image ? <img src={image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" /> : icon}
      </div>
      <div className="bg-surface px-4 py-3 text-sm font-medium text-ink">{label}</div>
    </div>
  );
}

/* ---------- Sections ---------- */

function AboutUs() {
  return (
    <div>
      <Hero hue={250} icon={<Sparkles />} kicker="Our story" title="A personal engineering career coach, powered by AI and real mentors." image="/assets/about/about-us.png" />

      <Prose>
        <p>
          Mentra is a Personalized Software Engineering Career Operating System. We help students go from
          “learning to code” to “job-ready engineer” with an AI-built assignment, a tailored roadmap, live
          mentorship, and real projects — all in one place.
        </p>
      </Prose>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ImageCard hue={160} icon={<Target />} label="Assess your level" image="/assets/about/assess-your-level.png" />
        <ImageCard hue={250} icon={<Sparkles />} label="Follow your roadmap" image="/assets/about/follow-your-roadmap.png" />
        <ImageCard hue={20} icon={<Users />} label="Learn with mentors" image="/assets/about/learn-with-mentors.png" />
      </div>

      <Prose>
        <H3>Our mission</H3>
        <p>
          Most platforms hand everyone the same content with no tracking and no accountability. We believe your
          path should be yours — measured, adjusted, and supported. Mentra adapts to where you are and what you
          want next.
        </p>
        <H3>What we value</H3>
      </Prose>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { icon: <Heart className="size-5" />, t: 'Student-first', d: 'Every decision starts with the learner’s outcome.' },
          { icon: <BadgeCheck className="size-5" />, t: 'Real proof', d: 'Skills shown through projects, not just badges.' },
          { icon: <ShieldCheck className="size-5" />, t: 'Trust', d: 'Your data and progress are yours, always.' },
        ].map((v) => (
          <div key={v.t} className="rounded-lg bg-surface p-5 ring-1 ring-border-subtle">
            <span className="mb-3 grid size-10 place-items-center rounded-md bg-surface-inverse text-ink-inverse">{v.icon}</span>
            <div className="text-sm font-semibold text-ink">{v.t}</div>
            <p className="mt-1 text-sm leading-6 text-ink-muted">{v.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Terms() {
  return (
    <div>
      <Hero hue={210} icon={<FileText />} kicker="Legal" title="Terms of Service" image="/assets/about/terms-of-service.png" />
      <Prose>
        <p>Last updated: June 2026. By using Mentra you agree to these terms.</p>
        <H3>1. Using Mentra</H3>
        <p>You must provide accurate information and keep your account secure. You’re responsible for activity under your account.</p>
        <H3>2. Your content</H3>
        <p>Work you submit remains yours. You grant us a limited license to store and process it to provide the service.</p>
        <H3>3. Acceptable use</H3>
        <p>Don’t misuse the platform, attempt to break its security, or use it to harm others. We may suspend accounts that do.</p>
        <H3>4. Subscriptions</H3>
        <p>Paid plans renew until cancelled. Features included in each plan are described on the Subscriptions page.</p>
        <H3>5. Changes</H3>
        <p>We may update these terms; we’ll note the date above and, for material changes, notify you in-app.</p>
      </Prose>
    </div>
  );
}

function Privacy() {
  return (
    <div>
      <Hero hue={150} icon={<ShieldCheck />} kicker="Legal" title="Privacy Policy" image="/assets/about/privacy-policy.png" />
      <Prose>
        <p>We collect only what we need to personalize your learning and run the platform.</p>
        <H3>What we collect</H3>
        <p>Profile details you provide, your assignment and roadmap activity, and basic usage analytics.</p>
        <H3>How we use it</H3>
        <p>To generate your assignment and roadmap, show your progress, and improve the product. We don’t sell your data.</p>
        <H3>Your choices</H3>
        <p>You can edit your profile, export your data, or request deletion at any time from Settings or by contacting us.</p>
        <H3>Security</H3>
        <p>Data is encrypted in transit and access is restricted. No system is perfect, but we take protection seriously.</p>
      </Prose>
    </div>
  );
}

function Refund() {
  return (
    <div>
      <Hero hue={30} icon={<RotateCcw />} kicker="Legal" title="Refund Policy" image="/assets/about/refund-policy.png" />
      <Prose>
        <p>We want you to be confident in your subscription.</p>
        <H3>7-day guarantee</H3>
        <p>If you’re not satisfied within 7 days of a new paid subscription, contact us for a full refund.</p>
        <H3>After 7 days</H3>
        <p>Refunds for the remaining period are considered case-by-case; cancellations stop future renewals immediately.</p>
        <H3>How to request</H3>
        <p>Email refunds@mentra.app from your account email with your plan and reason — most requests are handled within 3 business days.</p>
      </Prose>
    </div>
  );
}

function Contact() {
  return (
    <div>
      <Hero hue={280} icon={<Mail />} kicker="Say hello" title="Contact us" image="/assets/about/contact-us.png" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ContactItem icon={<Mail className="size-5" />} label="Email" value="hello@mentra.app" />
        <ContactItem icon={<Phone className="size-5" />} label="Phone" value="+91 90000 00000" />
        <ContactItem icon={<MapPin className="size-5" />} label="Office" value="Bengaluru, India" />
      </div>
      <Prose>
        <p>We usually reply within one business day. For account help, the Support page is the fastest route.</p>
      </Prose>
    </div>
  );
}

function ContactItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-5 ring-1 ring-border-subtle">
      <span className="mb-3 grid size-10 place-items-center rounded-md bg-surface-sunken text-ink ring-1 ring-border-subtle">{icon}</span>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-ink">{value}</div>
    </div>
  );
}
