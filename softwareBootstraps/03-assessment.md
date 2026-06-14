# Module 03 — Assessment

> Phase 1 · Depends on `01-auth`, `02-user-profile` · Blocks `04-dashboard`, `05-roadmap`
> The MVP's killer slice: "student joins, takes the test, gets a skill matrix"

---

## 1. Purpose

Measure what a student knows and produce a **skill matrix** the rest of the platform reads from.

- Question bank (MCQ + aptitude, more types later)
- Reusable assessment templates (initial, periodic, topic-specific)
- Attempt lifecycle (start → answer → complete → score)
- Pluggable scoring strategy (default naive; user will plug in custom algo)
- Per-skill score persistence + history
- Result view with a skill radar

This is **MCQ + aptitude only** for MVP. Coding execution is deferred (whole platform-wide rule). Free-text questions allowed but stored for later mentor review — not scored automatically.

---

## 2. In Scope / Out of Scope

### In scope
- `Skill` reference table (canonical list, replaces the JSON catalogue used so far)
- `Question`, `AssessmentTemplate`, `AssessmentAttempt`, `AssessmentAnswer`, `SkillScore`, `SkillScoreHistory`
- Initial onboarding assessment template seeded for MVP
- Server-side timer + auto-submit on expiry
- Per-question auto-save while attempt is in progress
- Skill-matrix computation hook (pluggable strategy)
- Result page: per-skill score, overall, time taken, weakest topics
- Resume an in-progress attempt after refresh / disconnect

### Out of scope
- Coding judge / runnable code questions — deferred platform-wide
- Free-text grading — answers stored but not scored in MVP
- Adaptive question selection (CAT) — static selection in MVP, hook reserved
- Anti-cheat beyond basic server-side timer + single-attempt lock — `19-discussion-forum`/`18-admin-panel` later
- Admin CRUD UI for questions/templates — Phase 5 `18-admin-panel`; for MVP, content is seeded
- AI-driven skill prediction — deferred; user supplies own algos via strategy interface

---

## 3. User Flows

### 3.1 Take the initial assessment
1. After onboarding (`02-user-profile`), FE routes student to `/assessment`.
2. FE calls `GET /assessments/templates/initial` → template metadata.
3. FE calls `POST /assessments/start` with `{ templateId }`.
4. BE:
   - Rejects if an `in_progress` attempt for this template already exists (returns that attempt instead).
   - Selects N questions per template rules (count, difficulty range, skill mix).
   - Creates `AssessmentAttempt` (status `in_progress`, `startedAt`, `expiresAt = startedAt + timeLimit`).
   - Returns `{ attemptId, questions[], expiresAt }`. Correct answers are **never** sent.
5. FE renders one question at a time. On each answer:
   - `POST /attempts/:id/answers` with `{ questionId, selected, timeSpentMs }`.
   - BE persists answer (idempotent on `attemptId + questionId` — updating overwrites). Does **not** reveal correctness.
6. On final answer or timer expiry → `POST /attempts/:id/complete`:
   - BE marks complete, runs scoring strategy, writes `SkillScore` rows (one per skill touched), snapshots into `SkillScoreHistory`.
   - Emits `assessment.completed` event.
7. FE polls `GET /attempts/:id/result` → renders skill matrix radar + summary.

### 3.2 Resume in-progress attempt
1. Student refreshes / reconnects.
2. FE calls `GET /assessments/me/active`.
3. If an attempt exists with `expiresAt` in the future → returns full state (questions + saved answers + remaining time). FE re-enters the test where they left off.
4. If `expiresAt` is past → BE auto-completes the attempt (background sweep job hits it within 30s; FE retry surfaces the result).

### 3.3 Periodic re-assessment (future-friendly, MVP placeholder)
Same flow with a different `templateId` (e.g. `weekly-checkpoint`). For MVP, only the `initial` template is seeded; the data model supports more without code changes.

---

## 4. Data Model

```prisma
model Skill {
  id          String   @id           // slug, e.g. "javascript", "react", "dsa-arrays"
  label       String
  category    SkillCategory
  parentId    String?               // for taxonomy: dsa > dsa-arrays
  parent      Skill?   @relation("SkillTree", fields: [parentId], references: [id])
  children    Skill[]  @relation("SkillTree")
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  questions   QuestionSkill[]
  scores      SkillScore[]
  @@index([category])
}

model Question {
  id           String   @id @default(cuid())
  type         QuestionType        // single_choice | multi_choice | numeric | short_text
  body         String   @db.Text
  options      Json?               // [{ id, label }] for choice questions
  correct      Json                // { optionIds: [...] } | { value: 42, tolerance: 0 }
  explanation  String?  @db.Text   // shown after attempt complete
  difficulty   Int                 // 1..5
  active       Boolean  @default(true)
  authoredBy   String?             // userId of admin/mentor
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  skills       QuestionSkill[]
  answers      AssessmentAnswer[]

  @@index([type, active, difficulty])
}

model QuestionSkill {
  questionId String
  skillId    String
  weight     Int      @default(1)   // some questions test 2 skills
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  skill      Skill    @relation(fields: [skillId], references: [id])
  @@id([questionId, skillId])
  @@index([skillId])
}

model AssessmentTemplate {
  id            String   @id          // "initial", "weekly-checkpoint", "react-deep-dive"
  name          String
  description   String?
  type          TemplateType          // initial | periodic | topic
  questionCount Int
  timeLimitSec  Int
  selectionRules Json                 // { perSkill: {...}, difficultyRange: [1,5], categories: [...] }
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())

  attempts      AssessmentAttempt[]
}

model AssessmentAttempt {
  id           String   @id @default(cuid())
  userId       String
  templateId   String
  status       AttemptStatus     // in_progress | completed | abandoned | auto_completed
  startedAt    DateTime @default(now())
  expiresAt    DateTime
  completedAt  DateTime?
  totalScore   Float?            // 0..100, populated on completion
  durationSec  Int?
  template     AssessmentTemplate @relation(fields: [templateId], references: [id])
  answers      AssessmentAnswer[]
  questionsSnapshot Json         // [{ questionId, order }] frozen at start
  @@unique([userId, templateId, status], name: "one_in_progress_per_template")
  @@index([userId, status])
  @@index([expiresAt, status])    // for the sweep job
}

model AssessmentAnswer {
  id            String   @id @default(cuid())
  attemptId     String
  questionId    String
  selected      Json                // { optionIds: [...] } | { value: 42 } | { text: "..." }
  isCorrect     Boolean?            // null for short_text (manual grading later)
  timeSpentMs   Int
  answeredAt    DateTime @default(now())
  attempt       AssessmentAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question      Question @relation(fields: [questionId], references: [id])
  @@unique([attemptId, questionId])   // one answer per question per attempt
  @@index([questionId])
}

model SkillScore {
  id            String   @id @default(cuid())
  userId        String
  skillId       String
  score         Float                  // 0..100
  confidence    Float                  // 0..1, how many questions this is based on
  lastAttemptId String?
  updatedAt     DateTime @updatedAt
  skill         Skill    @relation(fields: [skillId], references: [id])
  @@unique([userId, skillId])
  @@index([userId])
}

model SkillScoreHistory {
  id            String   @id @default(cuid())
  userId        String
  skillId       String
  score         Float
  confidence    Float
  source        String                 // "assessment:<attemptId>" | "manual:<adminId>" | "decay:<jobId>"
  recordedAt    DateTime @default(now())
  @@index([userId, skillId, recordedAt])
}

enum SkillCategory  { language framework tool concept dsa system_design soft_skill domain }
enum QuestionType   { single_choice multi_choice numeric short_text }
enum TemplateType   { initial periodic topic }
enum AttemptStatus  { in_progress completed abandoned auto_completed }
```

### Skill catalogue table — note for `02-user-profile`
This module **introduces the `skills` table**. The JSON catalogue from `02-user-profile` is dropped; the API endpoint `/skills/catalogue` migrates to read from this table. Profile's `techStack: String[]` continues to store skill IDs as before — values are validated against `skills.id`.

---

## 5. API Endpoints

All under `/api/v1/assessments`. All require `requireAuth` + `requireOnboardingComplete` (from profile module).

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/templates` | — | List of active templates (no question content) |
| GET | `/templates/:id` | — | Template metadata |
| POST | `/start` | `{ templateId }` | `{ attemptId, questions, expiresAt }` (questions stripped of `correct`) |
| GET | `/me/active` | — | Active attempt or `null` |
| GET | `/attempts/:id` | — | Attempt state + saved answers (no correctness) |
| POST | `/attempts/:id/answers` | `{ questionId, selected, timeSpentMs }` | `{ saved: true }` |
| POST | `/attempts/:id/complete` | — | `{ status, totalScore, redirectTo }` |
| GET | `/attempts/:id/result` | — | Full result: skill matrix, per-question breakdown, explanations |
| GET | `/me/skill-matrix` | — | Latest `SkillScore[]` joined with skill metadata |
| GET | `/me/skill-history?skillId=...` | — | Time series from `SkillScoreHistory` |

### Skill catalogue (moved from profile)
| GET | `/skills/catalogue` | `?q=react&category=framework` | `[{ id, label, category, parentId }]` |

### Validation
- Reject `POST /start` if active attempt exists; reply with existing `attemptId`.
- `selected` payload shape validated against `question.type`.
- All writes reject after `expiresAt` (race-safe: BE re-reads attempt under transaction).

---

## 6. Module Layout

```
apps/api/src/modules/assessment/
├── assessment.routes.ts
├── assessment.controller.ts
├── assessment.service.ts          # orchestration: start / answer / complete
├── attempt.repository.ts
├── question.repository.ts
├── skill.repository.ts
├── assessment.schema.ts           # Zod
├── selection/
│   ├── selector.interface.ts      # pickQuestions(template, userId) -> Question[]
│   └── default.selector.ts        # MVP: weighted random by skill mix & difficulty
├── scoring/
│   ├── scoring.interface.ts       # score(attempt, answers) -> { skillScores, totalScore }
│   ├── default.scoring.ts         # MVP: weighted % correct per skill
│   └── README.md                  # how to plug in a custom strategy
├── sweep/
│   └── expired-attempts.worker.ts # BullMQ scheduled job, auto-completes expired
├── events.ts
├── seed/
│   ├── skills.seed.ts             # canonical skill catalogue
│   ├── questions.seed.ts          # initial question bank
│   └── templates.seed.ts          # "initial" template
├── tests/
└── README.md
```

### Pluggable strategies
- `selector.interface.ts` and `scoring.interface.ts` are typed contracts.
- A scoring strategy receives the full attempt + answer set + skill taxonomy and returns `{ perSkillScores, totalScore, confidence }`.
- Strategy chosen via env var `ASSESSMENT_SCORING_STRATEGY=default | weighted | bayesian | custom`. Registry pattern — dropping in a new file + registering = one line of code change.
- This is the seam where the user's custom algorithms plug in.

### Events
- **Emits:** `assessment.started`, `assessment.answer-submitted`, `assessment.completed`.
- **Listens:** `student-profile.updated` — does nothing today, reserved for future "techStack changed → suggest re-assessment" UX.

### Cross-module exports
- `getSkillMatrix(userId)` — read-only helper used by dashboard and roadmap.
- `getLatestAttempt(userId, templateType)` — used by progress tracking.

---

## 7. Security & Anti-Cheat (MVP-grade)

- Correct answers **never** leave the server during an in-progress attempt. Returned only via `/result` after `status = completed`.
- One `in_progress` attempt per `(userId, templateId)` — enforced by unique index in §4.
- Server-side `expiresAt` is the source of truth. FE timer is decorative; any write past expiry is rejected.
- Answer writes are idempotent on `(attemptId, questionId)`.
- Rate limit: 60 answer-writes/min/attempt (lets students re-think; blocks scrapers).
- Question payloads served in randomized option order per attempt (option IDs stable; order JSON shuffled at fetch time).
- Tab-blur / paste events captured by FE telemetry and stored on the attempt as soft signals (`metadata.behaviorFlags`) — not blocking in MVP.

---

## 8. Feature Flags

| Flag | Default | Purpose |
|---|---|---|
| `assessment.enabled` | on | Master kill switch |
| `assessment.initial.required` | on | When off, dashboard does not gate on completed initial assessment |
| `assessment.adaptive` | off | Reserved for future CAT-style selection |
| `assessment.scoring.strategy` | `default` | Picks active strategy at boot |

---

## 9. Telemetry

### Logs
- `assessment.started`, `assessment.answer_saved`, `assessment.completed{status}`, `assessment.auto_completed_expired`

### Metrics
- `assessment_attempts_started_total{template}`
- `assessment_attempts_completed_total{template, status}`
- `assessment_attempt_duration_seconds{template}` (histogram)
- `assessment_drop_off_total{template, lastQuestionIndex}` — for funnel analysis
- `assessment_score_distribution{template}` (histogram, scraped post-completion)

### Alerts
- Auto-completion rate > 25% over 24h → warn (students running out of time → questions too hard or too many).
- `assessment.completed` event consumer lag > 5 min → page.

---

## 10. Testing

- **Unit**:
  - `default.selector` honors template rules (count, difficulty, skill mix)
  - `default.scoring` produces correct per-skill scores for crafted answer sets
  - Idempotency of `POST /answers` on the same questionId
- **Integration** (ephemeral Postgres + Redis):
  - Full happy-path: start → answer all → complete → result reflects answers
  - Resume mid-test: stop and refetch `/me/active` returns saved state
  - Expiry: clock-advance test triggers auto-completion via sweep
  - Race: simultaneous `complete` calls produce exactly one completion
  - Reject answer after expiry
  - Seeded skill catalogue, questions, and `initial` template load cleanly in CI
- **Contract**: Zod schemas for question shape match FE consumption.

Coverage target: 85%+ on `assessment.service.ts` and both default strategies.

---

## 11. Migrations

Atomic, one DDL per file (architecture §7).

### Initial set (in order)

| # | Migration | DDL |
|---|---|---|
| 01 | `create_skill_category_enum` | |
| 02 | `create_question_type_enum` | |
| 03 | `create_template_type_enum` | |
| 04 | `create_attempt_status_enum` | |
| 05 | `create_skills_table` | |
| 06 | `add_index_skills_category` | |
| 07 | `create_questions_table` | |
| 08 | `add_index_questions_type_active_difficulty` | |
| 09 | `create_question_skills_table` | join table + composite PK |
| 10 | `add_index_question_skills_skillId` | |
| 11 | `create_assessment_templates_table` | |
| 12 | `create_assessment_attempts_table` | |
| 13 | `add_unique_assessment_attempts_one_in_progress` | partial unique index on `(userId, templateId)` WHERE `status = 'in_progress'` |
| 14 | `add_index_assessment_attempts_userId_status` | |
| 15 | `add_index_assessment_attempts_expiresAt_status` | for sweep job |
| 16 | `create_assessment_answers_table` | |
| 17 | `add_unique_assessment_answers_attempt_question` | |
| 18 | `add_index_assessment_answers_questionId` | |
| 19 | `create_skill_scores_table` | |
| 20 | `add_unique_skill_scores_user_skill` | |
| 21 | `add_index_skill_scores_userId` | |
| 22 | `create_skill_score_history_table` | |
| 23 | `add_index_skill_score_history_user_skill_recordedAt` | |

### Seed (separate from migrations, idempotent)
- `prisma/seed.ts` calls each module's seeder.
- This module seeds:
  - ~150 skills (covers FE, BE, DSA basics, system design intro, soft skills)
  - ~200 starter MCQ/aptitude questions tagged to skills
  - 1 template: `initial` — 30 questions, 30-min limit, mixed difficulty

---

## 12. Environment Variables

```
ASSESSMENT_SCORING_STRATEGY=default
ASSESSMENT_SWEEP_INTERVAL_SECONDS=30
ASSESSMENT_INITIAL_TEMPLATE_ID=initial
ASSESSMENT_QUESTION_OPTION_SHUFFLE=true
```

---

## 13. Frontend Surface (React)

Routes under `apps/web/src/routes/assessment/`:

- `/assessment` — landing + start button + "you have an in-progress attempt" resume CTA
- `/assessment/take/:attemptId` — one-question-at-a-time runner
- `/assessment/result/:attemptId` — radar + per-skill breakdown + explanations
- `/assessment/history` — past attempts list

UX details:
- Sticky timer (server-driven, client just renders countdown)
- Auto-save indicator after each answer
- Keyboard nav: arrow keys / number keys for option select, Enter to advance
- Framer Motion: slide between questions, subtle pulse on auto-save, radar reveal animation on result
- Beforeunload warning when an attempt is in progress and answers are unsaved
- Browser back navigation captured to confirm before leaving the runner

Components in `packages/ui`:
- `QuestionCard` — handles all question types
- `SkillRadar` — recharts or visx-based radar with motion entry
- `Timer` — server-clock-synced countdown
- `OptionList` — accessible, keyboard-friendly

State:
- Active attempt cached via TanStack Query, key `["attempt", attemptId]`
- Answer mutations optimistic with rollback on 4xx
- Skill matrix on result page from `["attempt-result", attemptId]`

---

## 14. Runbook

- **"Student stuck — can't start test"** → likely a stale `in_progress` row. `/me/active` returns the orphan; admin can force-complete via the admin panel. Sweep job also clears anything past `expiresAt`.
- **"Result page blank"** → scoring strategy crashed. Look for `assessment.scoring.error` logs; default strategy is safe fallback. Setting `ASSESSMENT_SCORING_STRATEGY=default` recovers, attempt can be re-scored via `POST /admin/attempts/:id/rescore` (admin-only).
- **"Questions out of order on result page"** → confirm `questionsSnapshot` order on the attempt matches FE render order; the snapshot is authoritative.
- **Rollback**: scoring strategy is hot-swappable via env var. Migrations are append-only; field drops follow expand-then-contract.

---

## 15. CI/CD Gate

This module is "done" when:
- [ ] All endpoints in §5 implemented + Zod-validated
- [ ] Seed produces skills + initial template + ≥200 questions
- [ ] Default selector and scoring pass unit tests
- [ ] Sweep job runs in CI integration test and auto-completes expired attempts
- [ ] One-in-progress invariant enforced by DB constraint (verified by failing race test)
- [ ] FE: full take→result loop tested end-to-end in CI (Playwright)
- [ ] Telemetry: logs + metrics + alerts wired up
- [ ] Coverage ≥ 85% on service + strategies
- [ ] Smoke test: signup → onboarding → start initial assessment → answer 30 → see skill matrix

---

## 16. Open Questions

1. **Question authoring** — for MVP we hand-seed 200 questions. Who writes them? Hire a content person, scrape + curate from public banks (with licensing care), or write them yourself?
2. **Initial template size** — 30 questions / 30 min is the working assumption. Too long → drop-offs; too short → low confidence in skill matrix. Start at 25?
3. **Score decay** — should skill scores fade over time (e.g. half-life of 90 days) so periodic re-assessment is incentivized? MVP says no; hook is reserved (`SkillScoreHistory.source = decay:*`).
4. **Confidence threshold for skill matrix display** — hide skills below `confidence < 0.3` on the radar to avoid noisy results from 1-question signals?
5. **Free-text questions** — keep them in the schema (already there) but defer auto-grading until a mentor-review workflow exists, or strip them from MVP templates entirely?
