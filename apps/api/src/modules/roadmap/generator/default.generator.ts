import { env } from '../../../env.js';
import type { RoadmapGenerator } from './generator.interface.js';
import type { GeneratorInput, GeneratorSkill, RoadmapPlan, RoadmapPlanItem, RoadmapPlanWeek } from './types.js';

const AVG_ITEM_MIN = 120;
const FALLBACK_SKILLS: GeneratorSkill[] = [
  { skillId: 'javascript', label: 'JavaScript', score: 45, confidence: 0.3 },
  { skillId: 'dsa', label: 'Data Structures & Algorithms', score: 40, confidence: 0.3 },
  { skillId: 'sql', label: 'SQL', score: 50, confidence: 0.3 },
  { skillId: 'system-design', label: 'System Design', score: 45, confidence: 0.3 },
];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function topicTitle(s: GeneratorSkill): string {
  if (s.score < 40) return `Strengthen ${s.label} fundamentals`;
  if (s.score < 70) return `Level up ${s.label}`;
  return `Polish ${s.label}`;
}

function weekTheme(weekNumber: number, totalWeeks: number): string {
  if (weekNumber <= 2) return 'Foundations';
  if (weekNumber >= totalWeeks - 1) return 'Projects & review';
  return 'Core skills';
}

/**
 * MVP generator: prioritizes weakest skills, paces items by the student's weekly
 * hours, drops in projects mid/late, and ends with a re-assessment. Each week's
 * items depend on the previous week, so a week unlocks once the prior is done.
 */
export const defaultGenerator: RoadmapGenerator = {
  id: 'default-v1',
  // eslint-disable-next-line @typescript-eslint/require-await
  async generate(input: GeneratorInput): Promise<RoadmapPlan> {
    const skills = (input.skillMatrix.length > 0 ? input.skillMatrix : fromTechStack(input.techStack))
      .slice()
      .sort((a, b) => a.score - b.score);
    const pool = skills.length > 0 ? skills : FALLBACK_SKILLS;

    const weeklyMinutes = (input.studyHoursPerDay ?? 2) * 7 * 60;
    const itemsPerWeek = clamp(
      Math.round(weeklyMinutes / AVG_ITEM_MIN),
      env.ROADMAP_MIN_ITEMS_PER_WEEK,
      env.ROADMAP_MAX_ITEMS_PER_WEEK,
    );
    const maxWeeks = Math.min(12, env.ROADMAP_MAX_WEEKS);

    // One topic per skill (weakest first), capped to what fits in the plan.
    const capacity = itemsPerWeek * maxWeeks;
    const topics = pool.slice(0, capacity).map((s, i): Omit<RoadmapPlanItem, 'dependsOn'> => ({
      key: `t${i}`,
      type: 'topic',
      title: topicTitle(s),
      description: `Focus on ${s.label}. Current score: ${Math.round(s.score)}%.`,
      skillIds: [s.skillId],
      estimatedMin: s.score < 40 ? 150 : s.score < 70 ? 120 : 90,
    }));

    const totalWeeks = clamp(Math.ceil(topics.length / itemsPerWeek), 4, maxWeeks);

    // Chunk topics into weeks.
    const weeks: RoadmapPlanWeek[] = [];
    for (let w = 1; w <= totalWeeks; w++) {
      const slice = topics.slice((w - 1) * itemsPerWeek, w * itemsPerWeek);
      weeks.push({
        weekNumber: w,
        title: `Week ${w}`,
        theme: weekTheme(w, totalWeeks),
        items: slice.map((t, idx) => ({ ...t, key: `w${w}i${idx}`, dependsOn: [] })),
      });
    }

    // Drop in projects mid/late + a final self-review.
    addExtra(weeks, 4, { type: 'project', title: 'Build a portfolio project', skill: 'projects', min: 240 });
    addExtra(weeks, 8, { type: 'project', title: 'Build an end-to-end app', skill: 'projects', min: 300 });
    const last = weeks[weeks.length - 1];
    if (last) {
      last.items.push({
        key: `w${last.weekNumber}review`,
        type: 'practice',
        title: 'Review and self-test your progress',
        description: 'Revisit your weak areas and confirm what you have learned.',
        skillIds: [],
        estimatedMin: 45,
        dependsOn: [],
      });
    }

    // Week N items depend on all of week N-1 (week-gated unlock).
    for (let w = 1; w < weeks.length; w++) {
      const prevKeys = weeks[w - 1]!.items.map((it) => it.key);
      for (const it of weeks[w]!.items) it.dependsOn = prevKeys;
    }

    return {
      totalWeeks: weeks.length,
      weeks,
      notes: `Generated from ${input.skillMatrix.length} assessed skills.`,
    };
  },
};

function fromTechStack(techStack: string[]): GeneratorSkill[] {
  return techStack.slice(0, 12).map((id) => ({ skillId: id, label: id, score: 50, confidence: 0.3 }));
}

function addExtra(
  weeks: RoadmapPlanWeek[],
  weekNumber: number,
  spec: { type: RoadmapPlanItem['type']; title: string; skill: string; min: number },
): void {
  const week = weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) return;
  week.items.push({
    key: `w${weekNumber}x`,
    type: spec.type,
    title: spec.title,
    description: 'Apply what you have learned so far.',
    skillIds: [spec.skill],
    estimatedMin: spec.min,
    dependsOn: [],
  });
}
