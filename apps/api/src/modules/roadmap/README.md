# Roadmap (module 05)

Turns a student's skill matrix + goals into a multi-week learning plan. One **active**
roadmap per student; regeneration archives the previous one. This module is the *plan*;
`06-daily-tasks` is the day-by-day execution layer that reads from it.

## Layout

```
roadmap/
├── roadmap.routes.ts        # REST surface (auth + flag + onboarding gated)
├── roadmap.controller.ts    # thin HTTP adapters
├── roadmap.service.ts       # generate / regenerate / views / item actions
├── roadmap.repository.ts    # MySQL access (raw mysql2)
├── roadmap.errors.ts        # RoadmapError
├── events.ts                # listeners (assessment.completed, student-profile.updated)
├── generator/               # pluggable plan generator — see generator/README.md
└── transitions/             # item status machine + dependency unlock resolver
```

## API — `/api/v1/roadmap`

All routes require `requireAuth`, the `roadmap.enabled` flag, and
`requireOnboardingComplete`. Responses use the `{ data }` / `{ error }` envelope.

| Method | Path | Returns |
|---|---|---|
| GET  | `/me` | Active roadmap (weeks + items, completion %) or `null` |
| GET  | `/me/summary` | Compact progress for the dashboard widget |
| GET  | `/me/week/:n` | A single week with items |
| POST | `/me/regenerate` | New active roadmap (rate-limited 5/hour/user) |
| GET  | `/me/history` | Past archived/superseded roadmaps (metadata) |
| GET  | `/me/history/:roadmapId` | Full archived roadmap (read-only) |
| POST | `/items/:id/start` | `{ status: "in_progress" }` |
| POST | `/items/:id/complete` | `{ status: "completed", unlocked: [...] }` |
| POST | `/items/:id/skip` | `{ status: "skipped" }` |
| GET  | `/items/:id/topic` | Topic drilldown: subtopics + best/last marks + open test id |
| GET  | `/items/:id/subtopics` | The topic's full subtopic list (generated on first access) |
| POST | `/items/:id/test` | Start/resume the topic test (questions generated on first start) |
| GET  | `/items/:id/results` | All marks (one row per attempt) for the topic |
| GET  | `/tests/:testId` | Resume an in-flight test (no answers leaked) |
| POST | `/tests/:testId/submit` | Grade, store answers + marks, complete the topic if passed |

## Topics: subtopics + completion test (`topic/`)

A `topic` item carries a **complete** subtopic breakdown so a student never has to
decide what to learn, plus a test that gates completion. Both are AI-generated **on
demand** (never up front, never speculatively) and cached:

- **Subtopics** — generated the first time `/items/:id/topic` or `/items/:id/subtopics`
  is hit. Stored one row per subtopic in `RoadmapSubtopic` (not a JSON blob).
- **Test** — generated the first time `/items/:id/test` is called. The model must
  cover every subtopic. One row per question in `RoadmapTestQuestion`; a generated
  `openKey` enforces one open (non-completed) test per `(user, topic)`.
- **Submit** — `gradeTest` (pure, in `topic/grade.ts`) scores exact-match only (no
  partial credit). Answers persist to `RoadmapTestAnswer`; the marks go to a dedicated
  `RoadmapTestResult` row keyed by `userId` / `testId` / `roadmapId` / `itemId`, one
  per attempt. Passing (`ROADMAP_TEST_PASS_PERCENT`, default 70) marks the topic
  `completed` and unlocks dependents; failing records marks and allows a retake.

Both generators fall back to a deterministic stub if the model is unavailable, so a
topic always has subtopics and a test. Tuning knobs: `ROADMAP_SUBTOPICS_MIN/MAX`,
`ROADMAP_TEST_QUESTIONS_PER_SUBTOPIC`, `ROADMAP_TEST_MAX_QUESTIONS`,
`ROADMAP_TEST_PASS_PERCENT`.

Item writes are scoped to the caller's **active** roadmap; mutating an archived
roadmap returns `409 ROADMAP_NOT_ACTIVE`, and invalid status transitions return
`409 INVALID_TRANSITION`.

## Events

- **Listens:** `assessment.completed` (→ generate), `student-profile.updated` (→
  throttled auto-regenerate when an impactful field — `goal`, `targetRoles`,
  `studyHoursPerDay`, `techStack` — changes).
- **Emits:** `roadmap.generated`, `roadmap.item.completed`.

Auto-regeneration is throttled per user via a Redis `SET NX EX` lock
(`ROADMAP_AUTO_REGEN_THROTTLE_SECONDS`, default 6h). Manual regeneration ignores the
throttle but is rate-limited at the route.

## Generation

A pluggable `RoadmapGenerator` produces the plan; the MVP ships `default-v1`. Selected
via `ROADMAP_GENERATOR_STRATEGY`. See [`generator/README.md`](./generator/README.md) for
the interface, the plan contract, and how to register a custom strategy. Generation
time is measured and logged; a run exceeding `ROADMAP_GENERATOR_TIMEOUT_MS` logs a
`roadmap.generation.slow` warning (soft budget — fall back to `default` if a strategy
regresses).

## Cross-module exports

- `getActiveRoadmap(userId)` — for `06-daily-tasks`.
- `getRoadmapSummary(userId)` — for the `04-dashboard` widget.

## Frontend

Routes under `apps/web/src/pages/student/`: `/roadmap` (current week), `/roadmap/all`
(all weeks), `/roadmap/item/:id` (drilldown), `/roadmap/history` (read-only archive).
Shared pieces live in `apps/web/src/components/roadmap/`. The dashboard widget is in
`StudentDashboard.tsx`, gated by the `dashboard.widget.roadmap` flag.

## Testing

Pure-logic + mocked-boundary tests under `tests/` (vitest, no DB):

- `default-generator.test.ts` — plan invariants, week budget, ordering, fallbacks.
- `item-transition.test.ts` — status machine.
- `resolve-unlocks.test.ts` — dependency unlock resolver.
- `roadmap-service.test.ts` — guards (locked/archived), completion + events, regenerate,
  throttle (repository/redis mocked).
- `roadmap-listeners.test.ts` — event filtering + flag gating.

DB-level guarantees (transactional archive-then-insert, the partial unique index
enforcing one active roadmap per user) live in the SQL/migrations rather than these
unit tests.

## Runbook

- **Empty after assessment** → check the `assessment.completed` listener is subscribed
  and `roadmap.enabled` is on; re-trigger with `POST /me/regenerate`.
- **Generation slow** → a custom strategy regressed; set
  `ROADMAP_GENERATOR_STRATEGY=default`.
- **Stuck on a locked item** → inspect `dependsOnIds` for a bad cycle; regenerate.
- **Wrong active roadmap** → the partial unique index guarantees one active row; if more
  appear, the constraint migration didn't run.
