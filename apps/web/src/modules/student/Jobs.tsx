import { useState } from 'react';
import { Briefcase, Building2, ExternalLink, MapPin, Sparkles, Wand2 } from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type { JobView } from '@mentra/shared';
import { PageHeader } from '../../components/PageHeader.js';
import {
  EMPLOYMENT_LABEL,
  EXPERIENCE_LABEL,
  LOCATION_TYPE_LABEL,
  useDiscoverJobs,
  useStudentJobs,
} from '../../lib/jobs.js';

/**
 * Student Jobs board — openings ranked against the student's profile (tech stack,
 * target roles, seniority, location). Postings are AI-discovered from the live job
 * market or posted by HR. "Find with AI" triggers a fresh, profile-tailored search.
 */
export function JobsPage() {
  const jobs = useStudentJobs();
  const discover = useDiscoverJobs();
  const [notice, setNotice] = useState<string | null>(null);

  async function handleDiscover() {
    setNotice(null);
    try {
      const res = await discover.mutateAsync({ count: 8 });
      setNotice(
        res.created > 0
          ? `Added ${res.created} new ${res.created === 1 ? 'opening' : 'openings'} matched to your profile.`
          : 'No new openings this time — your board is already up to date.',
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Job discovery failed. Please try again.');
    }
  }

  const list = jobs.data ?? [];

  return (
    <div className="mx-auto w-full max-w-8xl space-y-6 py-2">
      <PageHeader
        icon={<Briefcase />}
        title="Jobs"
        subtitle="Openings matched to your skills, target roles and experience."
        actions={
          <button
            type="button"
            onClick={handleDiscover}
            disabled={discover.isPending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-60 sm:w-auto"
          >
            <Wand2 className="size-4" />
            {discover.isPending ? 'Searching the web…' : 'Find with AI'}
          </button>
        }
      />

      {notice ? (
        <div className="rounded-md bg-surface px-4 py-3 text-sm text-ink-muted ring-1 ring-border-subtle">{notice}</div>
      ) : null}

      {jobs.isLoading ? (
        <div className="grid min-h-[40vh] place-items-center text-ink-muted">Loading jobs…</div>
      ) : list.length === 0 ? (
        <EmptyState onDiscover={handleDiscover} pending={discover.isPending} />
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {list.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onDiscover, pending }: { onDiscover: () => void; pending: boolean }) {
  return (
    <Card className="flex flex-col items-center gap-4 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-sunken text-ink-muted ring-1 ring-border-subtle">
        <Sparkles className="size-5" />
      </span>
      <div>
        <h3 className="text-display-sm tracking-normal">No openings yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink-muted">
          Let the AI search the web for roles that fit your profile, or check back after HR posts new openings.
        </p>
      </div>
      <button
        type="button"
        onClick={onDiscover}
        disabled={pending}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-60"
      >
        <Wand2 className="size-4" />
        {pending ? 'Searching the web…' : 'Find jobs with AI'}
      </button>
    </Card>
  );
}

function JobCard({ job }: { job: JobView }) {
  const score = job.matchScore ?? 0;
  const matched = new Set((job.matchedSkills ?? []).map((s) => s.toLowerCase()));

  return (
    <Card interactive={false} className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-ink">{job.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span className="inline-flex min-w-0 max-w-full items-center gap-1">
              <Building2 className="size-3.5 shrink-0" />
              <span className="truncate">{job.company}</span>
            </span>
            <span className="inline-flex min-w-0 max-w-full items-center gap-1">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{job.location || LOCATION_TYPE_LABEL[job.locationType]}</span>
            </span>
          </div>
        </div>
        <MatchBadge score={score} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge>{EMPLOYMENT_LABEL[job.employmentType]}</Badge>
        <Badge>{LOCATION_TYPE_LABEL[job.locationType]}</Badge>
        <Badge>{EXPERIENCE_LABEL[job.experienceLevel]}</Badge>
        {job.salary ? <Badge>{job.salary}</Badge> : null}
        {job.source === 'hr' ? <Badge variant="info">Posted by HR</Badge> : null}
      </div>

      <p className="line-clamp-3 text-sm leading-6 text-ink-muted">{job.description}</p>

      {job.skills.length ? (
        <div className="flex flex-wrap gap-1.5">
          {job.skills.map((skill) => {
            const has = matched.has(skill.toLowerCase());
            return (
              <span
                key={skill}
                className={
                  has
                    ? 'rounded-full bg-accent-green/15 px-2.5 py-0.5 text-xs font-medium text-accent-green ring-1 ring-accent-green/30'
                    : 'rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs text-ink-muted ring-1 ring-border-subtle'
                }
              >
                {skill}
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
        <span className="text-xs text-ink-faint">
          {job.matchedSkills?.length
            ? `${job.matchedSkills.length} of your skills match`
            : 'New opportunity'}
        </span>
        {job.applyUrl ? (
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-surface-sunken px-4 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
          >
            Apply
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <span className="text-xs text-ink-faint">No link provided</span>
        )}
      </div>
    </Card>
  );
}

function MatchBadge({ score }: { score: number }) {
  const tone =
    score >= 70
      ? 'bg-accent-green/15 text-accent-green ring-accent-green/30'
      : score >= 40
        ? 'bg-accent-amber/15 text-accent-amber ring-accent-amber/30'
        : 'bg-surface-sunken text-ink-muted ring-border-subtle';
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>{score}% match</span>
  );
}
