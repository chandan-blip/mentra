# Roadmap generators

A generator turns a student's profile + skill matrix into a `RoadmapPlan` (weeks +
items). It is the pluggable seam of the roadmap module: the MVP ships a rule-based
`default-v1`, and you can drop in your own algorithm without touching the service,
repository, or API layers.

## The interface

```ts
// generator.interface.ts
interface RoadmapGenerator {
  readonly id: string;
  generate(input: GeneratorInput): RoadmapPlan;
}
```

- **`id`** — recorded on the roadmap as `generatedBy` (e.g. `"default-v1"`), so you
  can tell which strategy produced a given plan and roll back via env var.
- **`generate(input)`** — pure and synchronous in the MVP; keep it fast (the service
  treats generation as a bounded operation).

### Input — `GeneratorInput`

```ts
{
  userId: string;
  skillMatrix: { skillId, label, score, confidence }[]; // empty if not yet assessed
  goal: string | null;
  targetRoles: string[];
  techStack: string[];
  studyHoursPerDay: number | null;
  basisAttemptId: string | null;
}
```

### Output — `RoadmapPlan`

```ts
{
  totalWeeks: number;
  weeks: {
    weekNumber: number;          // 1-based, sequential
    title: string;
    theme?: string;
    items: {
      key: string;               // unique *within the plan* — see below
      type: RoadmapItemType;     // topic | project | assessment | session | reading | practice
      title: string;
      description?: string;
      skillIds: string[];
      estimatedMin?: number;
      dependsOn: string[];       // other items' local `key`s
    }[];
  }[];
  notes?: string;
}
```

## Plan contract

The persistence layer (`createRoadmapFromPlan`) and the unlock logic rely on a few
invariants. A generator **must** uphold them — they are enforced by the unit tests in
`../tests/default-generator.test.ts`:

1. **Unique keys.** Every item `key` is unique across the whole plan. Keys are local
   identifiers that get mapped to DB ids on persist; `dependsOn` is resolved against
   that map.
2. **No dangling deps.** Every `dependsOn` entry must reference a `key` that exists in
   the plan. Unknown keys are dropped on persist and will silently break unlocking.
3. **Week 1 starts open.** Items in week 1 must have `dependsOn: []` — they are
   persisted as `available`. Every other item is persisted as `locked` and becomes
   `available` only once all its dependencies reach a terminal state
   (`completed` or `skipped`).
4. **Acyclic deps.** Don't create dependency cycles — a cycle leaves items permanently
   locked. (See the runbook: a bad cycle is fixed by regenerating.)
5. **Sequential weeks.** `weekNumber` runs `1..totalWeeks`, and `totalWeeks ===
   weeks.length`.

## Registering a custom generator

1. Implement the interface in this folder, e.g. `weighted.generator.ts`:

   ```ts
   export const weightedGenerator: RoadmapGenerator = {
     id: 'weighted-v1',
     generate(input) {
       /* ... */
     },
   };
   ```

2. Add it to the registry in `index.ts`:

   ```ts
   const registry: Record<string, RoadmapGenerator> = {
     default: defaultGenerator,
     weighted: weightedGenerator, // ← one line
   };
   ```

3. Select it via env var. `getGenerator()` reads `ROADMAP_GENERATOR_STRATEGY` and falls
   back to `defaultGenerator` for any unknown value:

   ```
   ROADMAP_GENERATOR_STRATEGY=weighted
   ```

   `ROADMAP_GENERATOR_STRATEGY` is also validated in `apps/api/src/env.ts`; add your key
   to that enum so the app boots with it.

## Operational notes

- **Fallback.** If a custom strategy regresses (errors, slow plans), flip
  `ROADMAP_GENERATOR_STRATEGY=default` to return to the rule-based generator. The
  unknown-key fallback in `getGenerator()` also protects against typos.
- **Tuning the default.** The MVP generator reads `ROADMAP_MIN_ITEMS_PER_WEEK`,
  `ROADMAP_MAX_ITEMS_PER_WEEK`, and `ROADMAP_MAX_WEEKS` to pace items against the
  student's `studyHoursPerDay`.
