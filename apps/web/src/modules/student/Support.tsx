import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Mail, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@mentra/ui';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I set up my profile?',
    a: 'Open Settings → Settings and fill in your goals, target roles, education, and tech stack. Mentra uses these to personalize your learning.',
  },
  {
    q: 'How are my learning tracks chosen?',
    a: 'Your test-series tracks are generated from your profile — your goal, target roles, and tech stack. Update them under Settings to refresh what’s suggested.',
  },
  {
    q: 'How do I change my subscription plan?',
    a: 'Open the Subscriptions page to compare plans. Online billing is coming soon — until then, contact us here and we will switch your plan.',
  },
  {
    q: 'Why is a module locked?',
    a: 'Some modules are part of higher plans. A locked module shows a small lock in the sidebar; upgrade your plan to unlock it.',
  },
];

export function SupportPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
        className="space-y-4"
      >
        <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2">
          <ContactCard
            icon={<Mail className="size-5" />}
            title="Email us"
            body="support@mentra.app"
            cta="Send email"
            onClick={() => { window.location.href = 'mailto:support@mentra.app'; }}
          />
          <ContactCard
            icon={<MessageCircle className="size-5" />}
            title="Community help"
            body="Ask peers and mentors in the community."
            cta="Open community"
            onClick={() => navigate('/community')}
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card>
            <h3 className="mb-2 text-sm font-medium text-ink">Frequently asked</h3>
            <div className="divide-y divide-border-subtle">
              {FAQS.map((f) => (
                <Faq key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

function ContactCard({ icon, title, body, cta, onClick }: { icon: React.ReactNode; title: string; body: string; cta: string; onClick: () => void }) {
  return (
    <Card className="flex h-full flex-col">
      <span className="mb-3 grid size-10 place-items-center rounded-md bg-surface-inverse text-ink-inverse">{icon}</span>
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-1 text-sm text-ink-muted">{body}</div>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-surface-sunken px-4 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
      >
        {cta}
      </button>
    </Card>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium text-ink"
      >
        {q}
        <ChevronDown className={`size-4 shrink-0 text-ink-faint transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <p className="pb-3 text-sm leading-6 text-ink-muted">{a}</p> : null}
    </div>
  );
}
