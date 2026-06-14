import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api.js';
import { useProfile, useSubmitOnboardingStep } from '../../lib/profile.js';
import { SkillTagInput } from '../../components/SkillTagInput.js';

const EDUCATION = [
  ['high_school', 'High school'],
  ['undergrad', 'Undergraduate'],
  ['postgrad', 'Postgraduate'],
  ['doctoral', 'Doctoral'],
  ['working_professional', 'Working professional'],
  ['self_taught', 'Self-taught'],
] as const;

const EXPERIENCE = [
  ['none', 'No experience'],
  ['intern', 'Internship'],
  ['under_one', '< 1 year'],
  ['one_to_three', '1–3 years'],
  ['three_to_five', '3–5 years'],
  ['five_plus', '5+ years'],
] as const;

const GOALS = [
  ['first_job', 'Land my first job'],
  ['switch_company', 'Switch company'],
  ['fang_prep', 'FAANG / big tech prep'],
  ['startup_join', 'Join a startup'],
  ['freelance', 'Freelance'],
  ['upskill', 'Upskill'],
] as const;

const COMPANY_TYPES = [
  ['startup', 'Startup'],
  ['mnc', 'MNC'],
  ['product', 'Product'],
  ['service', 'Service'],
  ['government', 'Government'],
  ['remote', 'Remote-first'],
] as const;

const TARGET_ROLES = ['frontend', 'backend', 'fullstack', 'mobile', 'devops', 'data', 'ml', 'qa'];

type Draft = {
  timezone: string;
  city: string;
  country: string;
  educationLevel: string;
  collegeName: string;
  graduationYear: string;
  experienceLevel: string;
  currentRole: string;
  currentCompany: string;
  goal: string;
  targetRoles: string[];
  preferredCompanyType: string[];
  studyHoursPerDay: string;
  techStack: string[];
};

const emptyDraft: Draft = {
  timezone: 'Asia/Kolkata',
  city: '',
  country: '',
  educationLevel: '',
  collegeName: '',
  graduationYear: '',
  experienceLevel: '',
  currentRole: '',
  currentCompany: '',
  goal: '',
  targetRoles: [],
  preferredCompanyType: [],
  studyHoursPerDay: '',
  techStack: [],
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useProfile();
  const submit = useSubmitOnboardingStep();
  const [error, setError] = useState('');

  const profile = data?.profile;
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);

  // Resume from where the student left off (server-persisted step).
  if (profile && !hydrated) {
    setHydrated(true);
    if (profile.onboardingComplete) {
      navigate('/dashboard', { replace: true });
    } else {
      setStep((Math.min(profile.onboardingStep + 1, 4) || 1) as 1 | 2 | 3 | 4);
      setDraft({
        ...emptyDraft,
        timezone: profile.timezone ?? 'Asia/Kolkata',
        city: profile.city ?? '',
        country: profile.country ?? '',
        educationLevel: profile.educationLevel ?? '',
        collegeName: profile.collegeName ?? '',
        graduationYear: profile.graduationYear ? String(profile.graduationYear) : '',
        experienceLevel: profile.experienceLevel ?? '',
        currentRole: profile.currentRole ?? '',
        currentCompany: profile.currentCompany ?? '',
        goal: profile.goal ?? '',
        targetRoles: profile.targetRoles ?? [],
        preferredCompanyType: profile.preferredCompanyType ?? [],
        studyHoursPerDay: profile.studyHoursPerDay ? String(profile.studyHoursPerDay) : '',
        techStack: profile.techStack ?? [],
      });
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggle = (key: 'targetRoles' | 'preferredCompanyType', value: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));

  const canContinue = useMemo(() => {
    if (step === 1) return draft.timezone.trim().length > 0;
    if (step === 2) return draft.educationLevel !== '' && draft.experienceLevel !== '';
    if (step === 3) return draft.goal !== '' && draft.targetRoles.length > 0;
    return draft.techStack.length >= 1;
  }, [step, draft]);

  function fieldsForStep(s: number): Record<string, unknown> {
    if (s === 1) {
      return {
        timezone: draft.timezone.trim(),
        ...(draft.city.trim() ? { city: draft.city.trim() } : {}),
        ...(draft.country.trim() ? { country: draft.country.trim() } : {}),
      };
    }
    if (s === 2) {
      return {
        educationLevel: draft.educationLevel,
        experienceLevel: draft.experienceLevel,
        ...(draft.collegeName.trim() ? { collegeName: draft.collegeName.trim() } : {}),
        ...(draft.graduationYear ? { graduationYear: Number(draft.graduationYear) } : {}),
        ...(draft.currentRole.trim() ? { currentRole: draft.currentRole.trim() } : {}),
        ...(draft.currentCompany.trim() ? { currentCompany: draft.currentCompany.trim() } : {}),
      };
    }
    if (s === 3) {
      return {
        goal: draft.goal,
        targetRoles: draft.targetRoles,
        ...(draft.preferredCompanyType.length ? { preferredCompanyType: draft.preferredCompanyType } : {}),
        ...(draft.studyHoursPerDay ? { studyHoursPerDay: Number(draft.studyHoursPerDay) } : {}),
      };
    }
    return { techStack: draft.techStack };
  }

  async function handleNext() {
    if (!canContinue || submit.isPending) return;
    setError('');
    try {
      const result = await submit.mutateAsync({ step, fields: fieldsForStep(step) });
      if (result.onboardingComplete) {
        navigate('/dashboard', { replace: true });
        return;
      }
      setStep((s) => (Math.min(s + 1, 4) as 1 | 2 | 3 | 4));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.');
    }
  }

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-ink-muted">Loading…</div>;
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-inverse text-ink-inverse">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <div className="text-base font-semibold">Set up your profile</div>
            <div className="text-sm text-ink-muted">Step {step} of 4</div>
          </div>
        </div>

        <div className="mb-8 flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={[
                'h-1.5 flex-1 rounded-full transition',
                n <= step ? 'bg-surface-inverse' : 'bg-surface-sunken',
              ].join(' ')}
            />
          ))}
        </div>

        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            >
              {step === 1 ? (
                <StepShell title="Where are you based?" subtitle="We use this to schedule sessions and daily goals in your timezone.">
                  <Field label="Timezone">
                    <input className="auth-input-plain" value={draft.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="Asia/Kolkata" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City (optional)">
                      <input className="auth-input-plain" value={draft.city} onChange={(e) => set('city', e.target.value)} />
                    </Field>
                    <Field label="Country (optional)">
                      <input className="auth-input-plain" value={draft.country} onChange={(e) => set('country', e.target.value)} />
                    </Field>
                  </div>
                </StepShell>
              ) : null}

              {step === 2 ? (
                <StepShell title="Your background" subtitle="Helps us calibrate the assessment difficulty.">
                  <Field label="Education level">
                    <Choices options={EDUCATION} value={draft.educationLevel} onChange={(v) => set('educationLevel', v)} />
                  </Field>
                  <Field label="Experience level">
                    <Choices options={EXPERIENCE} value={draft.experienceLevel} onChange={(v) => set('experienceLevel', v)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="College (optional)">
                      <input className="auth-input-plain" value={draft.collegeName} onChange={(e) => set('collegeName', e.target.value)} />
                    </Field>
                    <Field label="Graduation year (optional)">
                      <input className="auth-input-plain" type="number" value={draft.graduationYear} onChange={(e) => set('graduationYear', e.target.value)} />
                    </Field>
                  </div>
                </StepShell>
              ) : null}

              {step === 3 ? (
                <StepShell title="Your goal" subtitle="What are you working towards?">
                  <Field label="Primary goal">
                    <Choices options={GOALS} value={draft.goal} onChange={(v) => set('goal', v)} />
                  </Field>
                  <Field label="Target roles">
                    <div className="flex flex-wrap gap-2">
                      {TARGET_ROLES.map((role) => (
                        <Chip key={role} active={draft.targetRoles.includes(role)} onClick={() => toggle('targetRoles', role)}>
                          {role}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                  <Field label="Preferred company type (optional)">
                    <div className="flex flex-wrap gap-2">
                      {COMPANY_TYPES.map(([v, label]) => (
                        <Chip key={v} active={draft.preferredCompanyType.includes(v)} onClick={() => toggle('preferredCompanyType', v)}>
                          {label}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                  <Field label="Study hours per day (optional)">
                    <input className="auth-input-plain" type="number" min={1} max={16} value={draft.studyHoursPerDay} onChange={(e) => set('studyHoursPerDay', e.target.value)} />
                  </Field>
                </StepShell>
              ) : null}

              {step === 4 ? (
                <StepShell title="Your tech stack" subtitle="Pick the skills you already know. We build your skill matrix from here.">
                  <SkillTagInput value={draft.techStack} onChange={(v) => set('techStack', v)} />
                </StepShell>
              ) : null}
            </motion.div>
          </AnimatePresence>

          {error ? <div className="mt-4 text-sm text-accent-red">{error}</div> : null}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => (Math.max(s - 1, 1) as 1 | 2 | 3 | 4))}
            disabled={step === 1}
            className="text-sm text-ink-muted hover:text-ink disabled:opacity-0"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canContinue || submit.isPending}
            className="group flex h-11 items-center gap-2 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submit.isPending ? 'Saving…' : step === 4 ? 'Finish' : 'Continue'}
            {step === 4 ? <Check className="size-4" /> : <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />}
          </button>
        </div>
      </div>
    </main>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-display-sm tracking-normal">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{subtitle}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Choices({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map(([v, label]) => (
        <Chip key={v} active={value === v} onClick={() => onChange(v)}>
          {label}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md px-3 py-2 text-sm capitalize ring-1 transition',
        active
          ? 'bg-surface-inverse text-ink-inverse ring-transparent'
          : 'bg-surface-sunken text-ink ring-border-subtle hover:ring-border-strong',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
