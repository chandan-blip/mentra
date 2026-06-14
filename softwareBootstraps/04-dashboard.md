# Module 04 — Dashboard

> Phase 1 · Depends on `01-auth`, `02-user-profile`, `03-assessment` · Closes the Phase-1 vertical slice

---

## 1. Purpose

The student's **home base** after login. Aggregates what other modules already produce — does not own much new data.

- Welcome / identity strip
- Skill matrix (read from `03-assessment`)
- Assessment status (taken / not taken / retake CTA)
- "Next steps" recommendations (pluggable strategy, naive default)
- Stats strip (questions answered, time invested, streak placeholder)
- A widget grid that **grows with future phases** — each later module drops in its own panel.

Designed as a **composition of widgets**, each independently fed and independently feature-flagged. Phase 1 ships with only a handful of widgets enabled; later modules plug in roadmap, daily tasks, live sessions, leaderboards, etc.

---

## 2. In Scope / Out of Scope

### In scope (Phase 1)
- `GET /dashboard/overview` — single composite read for first paint
- Naive recommendation engine (rule-based) with pluggable interface
- Widget registry on FE: each widget = component + endpoint + flag
- Empty-state UX for users who haven't taken the assessment yet
- Mentor + admin variants — same route, different widget set

### Out of scope (later modules slot widgets in here)
- Roadmap progress widget — `06-roadmap`
- Daily tasks widget — `07-daily-tasks`
- Streaks + XP — `17-gamification`
- Upcoming sessions — `10-live-sessions`
- Mentor doubts queue widget (mentor view) — `12-mentor-system`
- Content recommendations — `07-content-delivery`
- Notification center — `09-notifications`
- AI insights — deferred

The dashboard module **never** holds business logic for these features. It only exposes a slot.

---

## 3. User Flows

### 3.1 First login after onboarding (no assessment yet)
1. FE calls `GET /dashboard/overview`.
2. Response indicates `assessmentStatus = "not_started"`.
3. FE renders the dashboard with a prominent **"Take the initial assessment"** hero, skill radar in empty state, locked widgets visibly listed ("Roadmap unlocks after assessment").
4. CTA → `/assessment`.

### 3.2 Returning student post-assessment
1. `GET /dashboard/overview` returns skill matrix + recommendations + stats.
2. Skill radar renders with the user's scores.
3. "Next steps" widget lists 3 prioritized actions (e.g. "Review JavaScript fundamentals — your weakest area", "Retake assessment in 30 days").
4. As later phases ship, more widgets appear here (roadmap, today's tasks, etc.).

### 3.3 Mentor / admin
- Same route, role-aware widget set:
  - Mentor: students assigned to me (placeholder Phase 1), upcoming sessions (Phase 3).
  - Admin: platform health, active users, recent signups (Phase 5).
- Phase 1 mentor/admin dashboards are intentionally sparse — placeholder cards point to "coming in Phase N".

---

## 4. Data Model

The dashboard module owns minimal state. The only new table is for telemetry of what was recommended and whether the user acted on it.

```prisma
model RecommendationLog {
  id          String   @id @default(cuid())
  userId      String
  shownAt     DateTime @default(now())
  source      String                       // e.g. "default-v1", "weak-skill", "retake-prompt"
  recId       String                       // stable id for the specific recommendation
  payload     Json                          // { title, cta, context }
  shownIn     String                        // "dashboard.next-steps" | future surfaces
  actedOn     Boolean  @default(false)
  actedAt     DateTime?
  dismissedAt DateTime?

  @@index([userId, shownAt])
  @@index([recId])
}
```

Everything else is **read-through** from other modules' repositories.

---

## 5. API Endpoints

All under `/api/v1/dashboard`, all require `requireAuth`.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/overview` | — | Composite payload — see shape below |
| GET | `/next-steps` | `?limit=5` | `[{ recId, title, body, cta: { label, href }, priority }]` |
| POST | `/next-steps/:recId/ack` | `{ action: "clicked" \| "dismissed" }` | `204` |
| GET | `/stats` | — | `{ questionsAnswered, timeInvestedSec, attemptsCompleted, joinedAt }` |

### `/overview` response shape

```jsonc
{
  "profile": {
    "name": "...",
    "avatarUrl": "...",
    "onboardingComplete": true,
    "memberSince": "2026-05-23T..."
  },
  "assessment": {
    "status": "completed" | "not_started" | "in_progress",
    "lastAttemptId": "...",
    "totalScore": 62.4,
    "completedAt": "..."
  },
  "skillMatrix": [
    { "skillId": "javascript", "label": "JavaScript", "category": "language",
      "score": 55, "confidence": 0.8 }
  ],
  "nextSteps": [
    { "recId": "weak-skill:react", "title": "Brush up on React fundamentals",
      "body": "Your React score is 40%. Start with the core hooks module.",
      "cta": { "label": "Open module", "href": "/learn/react-hooks" },
      "priority": 1 }
  ],
  "stats": {
    "questionsAnswered": 30,
    "timeInvestedSec": 1764,
    "attemptsCompleted": 1,
    "joinedAt": "..."
  },
  "widgets": {
    // future modules append flags here
    "roadmap": { "enabled": false, "lockReason": "ships_phase_2" },
    "dailyTasks": { "enabled": false, "lockReason": "ships_phase_2" },
    "liveSessions": { "enabled": false, "lockReason": "ships_phase_3" }
  }
}
```

The `widgets` block is read from feature flags + role. Locked widgets are shown to the user as greyed-out cards with a label — sets expectations and incentivizes return visits.

---

## 6. Module Layout

```
apps/api/src/modules/dashboard/
├── dashboard.routes.ts
├── dashboard.controller.ts
├── dashboard.service.ts            # composes overview from cross-module reads
├── recommendation/
│   ├── recommender.interface.ts    # generate(userId, context) -> Recommendation[]
│   ├── default.recommender.ts      # rule-based: hero CTA + weakest skill + retake prompt
│   └── README.md                   # how to plug in custom recommender
├── stats.service.ts
├── widgets.service.ts              # builds the widgets block from flags + role
├── dashboard.schema.ts             # Zod
├── tests/
└── README.md
```

### Cross-module reads (read-only, never write)
- `01-auth` → role
- `02-user-profile` → profile basics
- `03-assessment` → `getSkillMatrix(userId)`, `getLatestAttempt(userId, "initial")`

### Recommendation engine
- `recommender.interface.ts` is the seam for the user's custom algorithm.
- Default rules (MVP):
  - If `onboardingComplete = false` → "Finish your profile".
  - If `assessment.status != completed` → "Take the initial assessment" (priority 1).
  - For each of the bottom 3 skills with `confidence ≥ 0.3` → "Brush up on {skill}".
  - If `assessment.completedAt` older than 30 days → "Retake assessment".
- Each generated rec gets a stable `recId` so we can dedupe and track action rates.

### Cross-module exports
- No exports. Dashboard is a leaf module — nothing depends on it.

---

## 7. Security

- All endpoints scoped to `me`. No `?userId=` parameter.
- Admin/mentor reading other students lands in `18-admin-panel` / `11-mentor-system`, not here.
- Rate limit: `/overview` 60/min/user; `/next-steps/:recId/ack` 30/min/user.
- Recommendation payloads sanitized — no user-supplied content; everything is server-generated.

---

## 8. Feature Flags

| Flag | Default | Purpose |
|---|---|---|
| `dashboard.enabled` | on | Master kill switch |
| `dashboard.recommender.strategy` | `default` | Chooses active recommender |
| `dashboard.widget.roadmap` | off | Flipped on when `06-roadmap` ships |
| `dashboard.widget.dailyTasks` | off | Flipped on when `07-daily-tasks` ships |
| `dashboard.widget.liveSessions` | off | Flipped on when `10-live-sessions` ships |

New widget = new flag. Cross-module modules flip their own flag during their rollout.

---

## 9. Telemetry

### Logs
- `dashboard.overview.served{userId, role, widgetsEnabled[]}`
- `dashboard.recommendation.shown{recId, source}`
- `dashboard.recommendation.acted{recId, action}`

### Metrics
- `dashboard_overview_latency_seconds` (histogram)
- `dashboard_recommendation_ctr` (counter pairs: shown vs clicked) → derived CTR
- `dashboard_widget_locked_views_total{widget}` — pre-launch demand signal

### Alerts
- `/overview` p95 > 800ms over 10m → warn. The composite read shouldn't be slow; if it is, a downstream repository regressed.

---

## 10. Testing

- **Unit**: default recommender rule branches, stats aggregation correctness.
- **Integration**:
  - New user (no assessment) → overview shows "not_started" + empty matrix + onboarding/assessment recs
  - Post-assessment → overview includes skill matrix + weak-skill recs
  - Acking a rec writes `RecommendationLog` and surfaces in subsequent stats
  - Role-aware widgets block reflects flags + role
  - `dashboard.widget.roadmap` flag flip changes the locked → unlocked card
- **Performance**: synthetic 100-user fan-out shows p95 < 300ms on a warm DB.

Coverage target: 80%+ on service + recommender.

---

## 11. Migrations

Atomic, one DDL per file.

| # | Migration | DDL |
|---|---|---|
| 01 | `create_recommendation_logs_table` | |
| 02 | `add_index_recommendation_logs_user_shownAt` | |
| 03 | `add_index_recommendation_logs_recId` | |

No enums needed.

### Future field additions (write when needed)
- `add_session_id_to_recommendation_logs` — when we want to group recs shown in the same dashboard session.
- `add_variant_to_recommendation_logs` — when A/B testing recommenders.

---

## 12. Environment Variables

```
DASHBOARD_RECOMMENDER_STRATEGY=default
DASHBOARD_OVERVIEW_CACHE_TTL_SECONDS=30      # in-memory Redis cache per user
DASHBOARD_NEXT_STEPS_LIMIT=5
```

---

## 13. Frontend Surface (React)

Routes under `apps/web/src/routes/`:

- `/` (authenticated) — dashboard root, redirects unauthenticated users to `/login`
- `/dashboard` — alias of `/`
- Role-aware rendering: same route, widget set chosen from `widgets` block

### Widget registry
A simple FE registry maps widget keys to React components:

```ts
// apps/web/src/features/dashboard/registry.ts
export const widgetRegistry = {
  welcome:        { component: WelcomeCard,      span: "col-span-12" },
  skillMatrix:    { component: SkillMatrixCard,  span: "col-span-8" },
  nextSteps:      { component: NextStepsCard,    span: "col-span-4" },
  stats:          { component: StatsStrip,       span: "col-span-12" },
  // Future modules add entries here:
  roadmap:        { component: RoadmapCard,      span: "col-span-6" },
  dailyTasks:     { component: DailyTasksCard,   span: "col-span-6" },
  liveSessions:   { component: LiveSessionsCard, span: "col-span-6" },
} as const;
```

The grid renders entries in order, filtering by the `widgets` block from `/overview`. Adding a future widget = drop a component + add a registry entry + flip a flag.

### UX
- Skeleton loader on initial paint, no spinners.
- Locked widgets show a greyed-out card with "Unlocks in Phase N" label — Framer Motion subtle pulse to draw the eye.
- Skill radar animates in once on mount (data-driven), thereafter static unless data changes.
- "Next steps" cards stagger-fade in, each with a primary CTA button.
- Pull-to-refresh (mobile-friendly) → re-fetches overview.

Components in `packages/ui`:
- `WidgetCard` — base card with title, slot, action menu
- `SkillMatrixCard` — wraps `SkillRadar` (from assessment) + summary
- `NextStepsCard` — list + acknowledgment hooks (auto-fires `/next-steps/:recId/ack` on click)
- `LockedWidget` — placeholder for not-yet-shipped modules

State:
- Overview cached via TanStack Query, key `["dashboard","overview"]`, 30s `staleTime`
- Mutations on rec acknowledgment are optimistic
- Real-time updates from Socket.io (later) invalidate `["dashboard","overview"]`

---

## 14. Runbook

- **"Overview slow"** → check downstream repositories: assessment skill-matrix read, profile read. The dashboard's own queries are cheap; latency is upstream. Inspect Pino spans in CloudWatch / Loki.
- **"Recommendations look wrong"** → strategy fault. Verify `DASHBOARD_RECOMMENDER_STRATEGY` env. Default strategy is safe fallback; falling back is one env-var change away.
- **"Widget should be unlocked but isn't"** → check feature flag in Postgres `feature_flags` and Redis cache (30s TTL). Stale cache resolves in <1 min.
- **Rollback**: dashboard has no writes that affect other modules. Reverting the deploy is non-destructive.

---

## 15. CI/CD Gate

This module is "done" when:
- [ ] `GET /overview` returns full payload + role-aware widgets block
- [ ] Default recommender produces the rules in §6 with unit tests for each branch
- [ ] FE widget registry pattern in place; locked widgets render correctly
- [ ] Smoke test: signup → onboarding → assessment → land on dashboard with skill matrix + recs visible
- [ ] Performance: `/overview` p95 < 300ms in CI synthetic test
- [ ] Telemetry: shown/clicked counters wired to PostHog
- [ ] Coverage ≥ 80% on service + recommender
- [ ] Locked-widget cards render with correct "ships in phase N" copy

---

## 16. Open Questions

1. **Composite endpoint vs widget-per-call** — `/overview` is one round-trip. As widgets grow, do we keep it monolithic or split into per-widget endpoints called in parallel by the FE? Recommendation: keep `/overview` for first paint; widgets that need real-time or heavy data can have their own endpoints alongside.
2. **Recommender persistence** — should `RecommendationLog` write happen synchronously on show, or fire-and-forget through BullMQ? Sync makes the response slower; async risks losing some logs. Recommendation: sync-on-show is fine at 2k DAU.
3. **Caching strategy** — Redis-cache `/overview` per user with 30s TTL (proposed), or always serve fresh? Cache wins on cost; freshness matters when daily-tasks ships. Add cache-invalidation events from downstream modules then.
4. **Mentor / admin dashboards** — share the same `/dashboard/overview` endpoint with role-keyed widgets (proposed) or split into `/mentor/dashboard` and `/admin/dashboard` later? One endpoint is simpler now.
5. **Empty state copy** — "Take the initial assessment" hero vs. a multi-step "Welcome → Set up profile → Take test" onboarding strip? Profile is technically already done at this point, so single hero is fine.
