import { describe, expect, it } from 'vitest';
import { env } from '../../../env.js';
import { defaultGenerator } from '../generator/default.generator.js';
import type { GeneratorInput, GeneratorSkill, RoadmapPlan } from '../generator/types.js';

const AVG_ITEM_MIN = 120;

function makeInput(overrides: Partial<GeneratorInput> = {}): GeneratorInput {
  return {
    userId: 'u1',
    skillMatrix: [],
    goal: null,
    targetRoles: [],
    techStack: [],
    studyHoursPerDay: 2,
    basisAttemptId: null,
    assignment: null,
    ...overrides,
  };
}

function skills(scores: number[]): GeneratorSkill[] {
  return scores.map((score, i) => ({
    skillId: `skill-${i}`,
    label: `Skill ${i}`,
    score,
    confidence: 0.5,
  }));
}

const allItems = (plan: RoadmapPlan) => plan.weeks.flatMap((w) => w.items);

/** Expected items-per-week the generator derives from study hours, mirroring its formula. */
function expectedItemsPerWeek(hoursPerDay: number): number {
  const weeklyMinutes = hoursPerDay * 7 * 60;
  const raw = Math.round(weeklyMinutes / AVG_ITEM_MIN);
  return Math.max(env.ROADMAP_MIN_ITEMS_PER_WEEK, Math.min(env.ROADMAP_MAX_ITEMS_PER_WEEK, raw));
}

/** Invariants every generated plan must satisfy regardless of input. */
function assertValidPlan(plan: RoadmapPlan): void {
  // totalWeeks is consistent and within the spec's bounds.
  expect(plan.totalWeeks).toBe(plan.weeks.length);
  expect(plan.totalWeeks).toBeGreaterThanOrEqual(4);
  expect(plan.totalWeeks).toBeLessThanOrEqual(12);

  // Week numbers are sequential 1..N.
  expect(plan.weeks.map((w) => w.weekNumber)).toEqual(
    Array.from({ length: plan.totalWeeks }, (_, i) => i + 1),
  );

  const items = allItems(plan);
  const keys = items.map((i) => i.key);

  // Keys must be globally unique — persistence maps each local key to one DB id.
  expect(new Set(keys).size).toBe(keys.length);

  // No dependency may reference a key that isn't in the plan (no dangling/cyclic-into-void deps).
  const keySet = new Set(keys);
  for (const item of items) {
    for (const dep of item.dependsOn) expect(keySet.has(dep)).toBe(true);
  }

  // Week-1 items have no dependencies — they must start `available`.
  for (const item of plan.weeks[0]!.items) expect(item.dependsOn).toEqual([]);
}

describe('defaultGenerator', () => {
  it('has a stable strategy id', () => {
    expect(defaultGenerator.id).toBe('default-v1');
  });

  it('produces a valid plan from an assessed skill matrix', async () => {
    const plan = await defaultGenerator.generate(makeInput({ skillMatrix: skills([30, 55, 80, 20, 65]) }));
    assertValidPlan(plan);
    expect(plan.notes).toContain('5 assessed skills');
  });

  it('orders weakest skills first', async () => {
    const plan = await defaultGenerator.generate(
      makeInput({
        skillMatrix: [
          { skillId: 'strong', label: 'Strong', score: 90, confidence: 0.8 },
          { skillId: 'weak', label: 'Weak', score: 15, confidence: 0.8 },
          { skillId: 'mid', label: 'Mid', score: 55, confidence: 0.8 },
        ],
      }),
    );
    const firstTopic = allItems(plan).find((i) => i.type === 'topic');
    expect(firstTopic?.skillIds).toEqual(['weak']);
  });

  it('sizes effort by skill weakness', async () => {
    const plan = await defaultGenerator.generate(
      makeInput({ skillMatrix: skills([30]), studyHoursPerDay: 1 }),
    );
    const topic = allItems(plan).find((i) => i.type === 'topic');
    expect(topic?.estimatedMin).toBe(150); // score < 40 → highest effort
  });

  it('introduces projects and a closing self-review', async () => {
    const plan = await defaultGenerator.generate(makeInput({ skillMatrix: skills(Array(40).fill(35)) }));
    const items = allItems(plan);
    expect(items.some((i) => i.type === 'project')).toBe(true);
    // Last week ends on a self-review practice item.
    const lastWeek = plan.weeks[plan.weeks.length - 1]!;
    expect(lastWeek.items.some((i) => i.type === 'practice' && /review/i.test(i.title))).toBe(true);
  });

  it('falls back to a tech-stack-derived plan when no skills are assessed', async () => {
    const plan = await defaultGenerator.generate(
      makeInput({ skillMatrix: [], techStack: ['react', 'node', 'postgres'] }),
    );
    assertValidPlan(plan);
    const topicSkillIds = allItems(plan)
      .filter((i) => i.type === 'topic')
      .flatMap((i) => i.skillIds);
    expect(topicSkillIds).toContain('react');
  });

  it('falls back to default skills when neither matrix nor tech stack is provided', async () => {
    const plan = await defaultGenerator.generate(makeInput({ skillMatrix: [], techStack: [] }));
    assertValidPlan(plan);
    expect(allItems(plan).length).toBeGreaterThan(0);
  });

  // Diverse matrices: the plan stays valid and respects the per-week topic budget.
  const cases: { name: string; skillCount: number; hoursPerDay: number }[] = [
    { name: 'few skills, light schedule', skillCount: 3, hoursPerDay: 1 },
    { name: 'few skills, heavy schedule', skillCount: 4, hoursPerDay: 8 },
    { name: 'many skills, light schedule', skillCount: 40, hoursPerDay: 1 },
    { name: 'many skills, heavy schedule', skillCount: 60, hoursPerDay: 6 },
    { name: 'all strong skills', skillCount: 12, hoursPerDay: 3 },
  ];

  it.each(cases)('stays within the week budget: $name', async ({ skillCount, hoursPerDay }) => {
    const plan = await defaultGenerator.generate(
      makeInput({
        skillMatrix: skills(Array.from({ length: skillCount }, (_, i) => (i * 7) % 100)),
        studyHoursPerDay: hoursPerDay,
      }),
    );
    assertValidPlan(plan);

    const budget = expectedItemsPerWeek(hoursPerDay);
    for (const week of plan.weeks) {
      const topicCount = week.items.filter((i) => i.type === 'topic').length;
      expect(topicCount).toBeLessThanOrEqual(budget);
    }
  });

  it('gives a heavier schedule more topics per week than a lighter one', async () => {
    const matrix = skills(Array.from({ length: 30 }, (_, i) => (i * 3) % 100));
    const light = await defaultGenerator.generate(makeInput({ skillMatrix: matrix, studyHoursPerDay: 1 }));
    const heavy = await defaultGenerator.generate(makeInput({ skillMatrix: matrix, studyHoursPerDay: 6 }));
    const maxTopics = (p: RoadmapPlan) =>
      Math.max(...p.weeks.map((w) => w.items.filter((i) => i.type === 'topic').length));
    expect(maxTopics(heavy)).toBeGreaterThan(maxTopics(light));
  });
});
