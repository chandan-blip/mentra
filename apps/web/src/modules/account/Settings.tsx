import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, Settings as SettingsIcon, ShieldCheck, UserRound } from 'lucide-react';
import { PublicProfileInline } from '../student/StudentProfile.js';
import type { ProfilePatchInput, StudentProfileView } from '@mentra/shared';
import { ApiError } from '../../lib/api.js';
import {
  useNotificationPrefs,
  usePatchNotificationPrefs,
  usePatchProfile,
  useProfile,
} from '../../lib/profile.js';
import { SkillTagInput } from '../../components/SkillTagInput.js';
import { ResumeUploader } from '../../components/ResumeUploader.js';
import { AvatarUploader } from '../../components/AvatarUploader.js';
import { getStoredUser, updateStoredUserName } from '../../lib/auth.js';

type Tab = 'profile' | 'settings' | 'notifications' | 'account';

const TABS: { id: Tab; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'profile', label: 'Profile', icon: <UserRound className="size-4" />, hint: 'Your public profile' },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon className="size-4" />, hint: 'Picture, resume, about, experience, links' },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="size-4" />, hint: 'Email & in-app alerts' },
  { id: 'account', label: 'Account', icon: <ShieldCheck className="size-4" />, hint: 'Password & sessions' },
];

const TAB_IDS: Tab[] = ['profile', 'settings', 'notifications', 'account'];

export function SettingsPage() {
  // The active tab is driven by ?tab= so deep links (e.g. "Edit my profile" →
  // ?tab=settings) land on the right section.
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = TAB_IDS.includes(tabParam as Tab) ? (tabParam as Tab) : 'profile';
  const setTab = (t: Tab) => setParams(t === 'profile' ? {} : { tab: t }, { replace: true });

  const { data, isLoading } = useProfile();

  // Keep the active tab centered in the horizontally-scrolling nav (mobile).
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tab]);

  return (
    <div className="mx-auto w-full max-w-9xl">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left: title + description + nav — sticky together */}
        <div className="min-w-0 lg:sticky lg:top-0 lg:h-fit">
          {/* Title hidden on mobile (the app top bar already names the page), matching other modules. */}
          <div className="hidden sm:block">
            <h1 className="text-display-md tracking-normal">Settings</h1>
            <p className="mt-1 text-sm text-ink-muted">Manage your profile, notifications, and account.</p>
          </div>

          <nav
            ref={navRef}
            className="no-scrollbar mt-0 flex snap-x snap-mandatory scroll-px-4 flex-row gap-1 overflow-x-auto scroll-smooth sm:mt-5 lg:snap-none lg:flex-col"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                data-active={t.id === tab}
                onClick={() => setTab(t.id)}
                className={[
                  'flex shrink-0 snap-center items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium transition',
                  t.id === tab ? 'bg-surface-inverse text-ink-inverse' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                ].join(' ')}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="min-w-0">
          {isLoading || !data ? (
            <div className="text-sm text-ink-muted">Loading…</div>
          ) : tab === 'profile' ? (
            <PublicProfileTab />
          ) : tab === 'settings' ? (
            <ProfileForm profile={data.profile} />
          ) : tab === 'notifications' ? (
            <NotificationsForm />
          ) : (
            <AccountSection />
          )}
        </div>
      </div>
    </div>
  );
}

const blank = (v: string) => (v.trim() === '' ? null : v.trim());

function ProfileForm({ profile }: { profile: StudentProfileView }) {
  const patch = usePatchProfile();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Prefer the profile's name; fall back to the stored auth user (always set) so the
  // field is populated even before the API surfaces `name` on the profile response.
  const [name, setName] = useState(profile.name ?? getStoredUser()?.name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [country, setCountry] = useState(profile.country ?? '');
  const [timezone, setTimezone] = useState(profile.timezone);
  const [currentRole, setCurrentRole] = useState(profile.currentRole ?? '');
  const [currentCompany, setCurrentCompany] = useState(profile.currentCompany ?? '');
  const [studyHours, setStudyHours] = useState(profile.studyHoursPerDay ? String(profile.studyHoursPerDay) : '');
  const [techStack, setTechStack] = useState<string[]>(profile.techStack);
  const [github, setGithub] = useState(profile.githubUrl ?? '');
  const [linkedin, setLinkedin] = useState(profile.linkedinUrl ?? '');
  const [portfolio, setPortfolio] = useState(profile.portfolioUrl ?? '');
  const [twitter, setTwitter] = useState(profile.twitterUrl ?? '');

  const payload = useMemo<ProfilePatchInput>(
    () => ({
      name: name.trim(),
      bio: blank(bio),
      city: blank(city),
      country: blank(country),
      timezone: timezone.trim() || 'Asia/Kolkata',
      currentRole: blank(currentRole),
      currentCompany: blank(currentCompany),
      studyHoursPerDay: studyHours ? Number(studyHours) : null,
      techStack,
      githubUrl: blank(github),
      linkedinUrl: blank(linkedin),
      portfolioUrl: blank(portfolio),
      twitterUrl: blank(twitter),
    }),
    [name, bio, city, country, timezone, currentRole, currentCompany, studyHours, techStack, github, linkedin, portfolio, twitter],
  );

  async function save() {
    setError('');
    setSaved(false);
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    try {
      const updated = await patch.mutateAsync(payload);
      updateStoredUserName(updated.name ?? name.trim()); // keep header/avatar initials in sync
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    }
  }

  return (
    <div className="space-y-5">
      <Section title="Profile picture">
        <AvatarUploader currentUrl={profile.avatarUrl} name={getStoredUser()?.name ?? ''} />
      </Section>

      <Section title="Name">
        <Field label="Full name">
          <input
            className="auth-input-plain"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </Field>
      </Section>

      <Section title="Resume">
        <ResumeUploader hasResume={Boolean(profile.resumeFileKey)} uploadedAt={profile.resumeUploadedAt} />
      </Section>

      <Section title="About">
        <Field label="Bio">
          <textarea className="auth-input-plain h-24 py-2" value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City"><input className="auth-input-plain" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
          <Field label="Country"><input className="auth-input-plain" value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
        </div>
        <Field label="Timezone"><input className="auth-input-plain" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></Field>
      </Section>

      <Section title="Experience">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current role"><input className="auth-input-plain" value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} /></Field>
          <Field label="Current company"><input className="auth-input-plain" value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} /></Field>
        </div>
        <Field label="Study hours per day">
          <input className="auth-input-plain sm:max-w-[200px]" type="number" min={1} max={16} value={studyHours} onChange={(e) => setStudyHours(e.target.value)} />
        </Field>
      </Section>

      <Section title="Tech stack">
        <SkillTagInput value={techStack} onChange={setTechStack} />
      </Section>

      <Section title="Links">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GitHub"><input className="auth-input-plain" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/you" /></Field>
          <Field label="LinkedIn"><input className="auth-input-plain" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/you" /></Field>
          <Field label="Portfolio"><input className="auth-input-plain" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://…" /></Field>
          <Field label="Twitter / X"><input className="auth-input-plain" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/you" /></Field>
        </div>
      </Section>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-1 flex items-center gap-4 border-t border-border-subtle bg-canvas/80 px-1 py-3 backdrop-blur">
        <button
          type="button"
          onClick={save}
          disabled={patch.isPending}
          className="h-11 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
        >
          {patch.isPending ? 'Saving…' : 'Save changes'}
        </button>
        {error ? <span className="text-sm text-accent-red">{error}</span> : null}
        {saved ? <span className="text-sm text-accent-green">Saved.</span> : null}
      </div>
    </div>
  );
}

function NotificationsForm() {
  const { data, isLoading } = useNotificationPrefs();
  const patch = usePatchNotificationPrefs();

  if (isLoading || !data) return <div className="text-sm text-ink-muted">Loading…</div>;

  const rows: Array<[keyof typeof data, string, string]> = [
    ['emailDailyTasks', 'Daily task email', 'A morning summary of the day’s tasks.'],
    ['emailWeeklyReview', 'Weekly review email', 'Your progress recap every week.'],
    ['emailSessionReminders', 'Session reminders', 'Before live sessions you’ve booked.'],
    ['emailAnnouncements', 'Product announcements', 'Occasional news about new features.'],
    ['inAppEnabled', 'In-app notifications', 'Show alerts inside the app.'],
  ];

  return (
    <Section title="Notification preferences">
      <div className="-my-1 divide-y divide-border-subtle">
        {rows.map(([key, label, hint]) => (
          <label key={key} className="flex cursor-pointer items-center justify-between gap-4 py-3">
            <span>
              <span className="block text-sm text-ink">{label}</span>
              <span className="block text-xs text-ink-faint">{hint}</span>
            </span>
            {/* Toggle switch: the checkbox drives the styling via peer-* classes. */}
            <span className="relative inline-flex shrink-0">
              <input
                type="checkbox"
                checked={data[key]}
                onChange={(e) => patch.mutate({ [key]: e.target.checked })}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="h-6 w-11 rounded-full bg-surface-sunken ring-1 ring-border-subtle transition-colors peer-checked:bg-surface-inverse peer-focus-visible:ring-2 peer-focus-visible:ring-ink"
              />
              <span
                aria-hidden
                className="absolute left-0.5 top-0.5 size-5 rounded-full bg-canvas shadow-sm ring-1 ring-border-subtle transition-transform peer-checked:translate-x-5"
              />
            </span>
          </label>
        ))}
      </div>
    </Section>
  );
}

/**
 * Profile tab — renders the student's own public profile directly (the social
 * identity other students see). Editing lives under the Settings tab.
 */
function PublicProfileTab() {
  return <PublicProfileInline userId={getStoredUser()?.id} />;
}

function AccountSection() {
  return (
    <Section title="Account & security">
      <p className="text-sm leading-6 text-ink-muted">
        Password changes and active sessions are managed from the sign-in screen. Use “Forgot
        password?” to rotate your password; signing out ends the session on this device.
      </p>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-surface p-5 ring-1 ring-border-subtle">
      <h3 className="mb-4 text-sm font-semibold text-ink">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
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
