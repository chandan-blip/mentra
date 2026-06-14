# Mentra — Platform Architecture

> **Mentra** — Personalized Software Engineering Career OS
> Scale target (MVP): 50k registered users, 2k DAU, peak ~200 RPS

---

## 1. Guiding Principles

1. **Ship vertical slices** — each module is independently buildable, testable, deployable.
2. **Monolith first, modular always** — one NestJS app split into bounded modules. Extract to services only when load demands it.
3. **No premature complexity** — defer code execution, AI/LLM, recruiters, recommendation engines until core flow works.
4. **Custom algorithms over AI APIs** — skill scoring, weakness detection, roadmap generation are deterministic services we own.
5. **Every module is a CI/CD unit** — own folder, own tests, own migrations, own feature flag.

---

## 2. High-Level System Diagram

Mentra is a **web-first product**. Students, mentors, and admins use the React SPA. Telegram is purely an **outbound notification surface** — Mentra pushes updates into channels/groups/bots that the team manages externally.

```
                   ┌──────────────────────────┐
                   │       Cloudflare         │  (CDN + WAF + DDoS, free tier)
                   └────────────┬─────────────┘
                                │  HTTPS
                   ┌────────────▼─────────────┐
                   │  Nginx / Caddy (reverse  │
                   │  proxy + TLS + gzip)     │
                   └──┬────────────┬──────────┘
                      │            │
              ┌───────▼──────┐  ┌──▼────────────────────┐
              │ React SPA    │  │ Express API (Node TS) │
              │ (Vite build, │  │ + BullMQ workers      │
              │  static)     │  │ + Telegram publisher  │
              └──────────────┘  └──┬──────────────────┬─┘
                                   │                  │
   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ self-hosted on VPS
                              ┌────▼───┐         ┌────▼────┐
                              │Postgres│         │  Redis  │
                              │ Docker │         │ Docker  │
                              │        │         │ +AOF    │
                              └────────┘         └─────────┘

   External SaaS / Outbound:
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐
   │  Telegram    │ │  MinIO  OR   │ │ Google Meet  │ │ Razorpay │ │  Resend  │
   │  Bot API     │ │  Backblaze   │ │  + Jitsi     │ │ (payment)│ │  (email) │
   │ (outbound    │ │  B2 (files)  │ │  (video,free)│ │          │ │          │
   │  only)       │ │              │ │              │ │          │ │          │
   └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ └──────────┘
```

**Self-hosted means:** Postgres, Redis, Node app processes, Nginx, monitoring — all Docker containers on your VPS.

---

## 3. Tech Stack (Locked for MVP)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript + Tailwind + Framer Motion** | SPA, built to static assets, served by Nginx |
| Routing | React Router v6 | Code-split per route |
| Data fetching | TanStack Query | Cache + retries + invalidation |
| Client state | Zustand | Small, no boilerplate |
| Forms | React Hook Form + Zod | Shared Zod schemas with backend |
| Animation | Framer Motion | Page transitions, micro-interactions |
| Backend | **Node.js + Express + TypeScript** | Feature-folder structure, no DI framework |
| Validation | Zod (shared with FE) | All request bodies parsed via middleware |
| ORM | Prisma | Migrations + type-safety |
| DB | PostgreSQL 16 (self-hosted, Docker) | Single primary, daily off-site backups |
| Cache | Redis 7 (self-hosted, Docker) | Sessions, rate limit, leaderboards. AOF persistence on. |
| Queue | BullMQ on Redis | Email, Telegram broadcasts, scoring jobs |
| Object Storage | MinIO (self-hosted) OR Backblaze B2 | S3-compatible API. B2 cheaper for video at scale. |
| Reverse Proxy | Nginx | Serves React static + proxies `/api` to Express + TLS |
| Process Manager | Docker Compose | PM2 as fallback for non-Docker |
| Auth | JWT (access + refresh) via Express middleware; Google + GitHub OAuth via Passport.js | No NextAuth (Next-specific) |
| Real-time (web) | Socket.io | In-app notifications, live class chat |
| Telegram (outbound) | `node-telegram-bot-api` or `grammY` in publish-only mode | Posts to channels/groups/users via Bot API — see §6.5 |
| Live video — 1:1 | Google Meet (via Google Calendar API) | Free for 1:1 (24h), auto-generated Meet links per booking |
| Live video — group | Jitsi (`meet.jit.si` public instance) | Free, no time limit, unique room URL per session. Self-host on VPS later if needed. |
| Session recording | Out of scope for MVP | Mentors can record locally (OBS/Loom) and upload if needed |
| Payments | Razorpay | India-first; Stripe later if global |
| Search | Postgres full-text (MVP) | Meilisearch (self-hosted) when catalog grows |
| Email | Resend (managed) | Transactional only — OTPs, receipts, reminders |
| Hosting | **Your VPS** (Hetzner / DigitalOcean / Contabo / OVH) | See §10 for sizing |
| CI/CD | GitHub Actions → SSH deploy | Build image → push to registry → SSH + `docker compose pull && up` |
| Container Registry | GitHub Container Registry (ghcr.io) | Free for public, cheap for private |
| Secrets | `.env` files on VPS (root-owned, 600) + Doppler or sops | |
| Observability | Sentry (managed) + PostHog (managed or self-hosted) + Grafana/Loki/Prometheus (self-hosted) | All on the same VPS |
| Uptime | Uptime Kuma (self-hosted) or BetterStack | Free tier OK at this scale |
| CDN/WAF | Cloudflare | Caches React bundle + DDoS protection |
| Backups | `pg_dump` cron → Backblaze B2 | Daily, encrypted, 30-day retention |

---

## 4. Repository Layout

Single monorepo, two deployables (one Express API, one static React SPA).

```
/mentra
├── apps/
│   ├── web/                # React + Vite SPA (student + mentor + admin UI)
│   └── api/                # Express + TypeScript backend
├── packages/
│   ├── shared/             # Zod schemas, shared types, constants (used by FE + BE)
│   ├── ui/                 # Reusable React components (buttons, modals, motion presets)
│   └── config/             # Shared eslint, tsconfig, tailwind preset
├── Vagrantfile             # Ubuntu VM (no Docker)
├── provision.sh            # native installer/builder; deploy.sh, livekit.yaml, nginx/, systemd/
└── softwareBootstraps/     # Module specs (this folder)
```

### Express feature-folder convention

Each platform module lives under `apps/api/src/modules/<name>/`:

```
modules/auth/
├── auth.routes.ts          # Express router, mounted at /api/v1/auth
├── auth.controller.ts      # Request handlers (thin)
├── auth.service.ts         # Business logic
├── auth.repository.ts      # Prisma queries
├── auth.schema.ts          # Zod request/response schemas
├── auth.middleware.ts      # Module-specific middleware (e.g. requireFreshToken)
├── tests/
│   ├── auth.service.test.ts
│   └── auth.routes.test.ts
└── README.md               # Owner, scope, flags, runbook
```

Routers are auto-mounted by `apps/api/src/app.ts` via a registry. Adding a module = drop the folder + register one line.

---

## 5. Phased Rollout

Each phase is a working product on its own. Nothing in Phase N+1 blocks Phase N from going live.

### Phase 1 — "Student joins on the web and takes an assessment" (Weeks 1–3)

Goal: A student visits `mentra.app`, signs up, takes the initial assessment, and lands on a personalized dashboard with their skill matrix.

Modules:
- `01-auth` — Email + Google + GitHub signup, JWT access/refresh, sessions
- `02-user-profile` — Student profile, skills, preferences
- `03-assessment` — MCQ + aptitude test, scoring algo, skill matrix output
- `04-dashboard` — Landing post-assessment, skill radar, next steps

### Phase 2 — "Personalized learning starts" (Weeks 4–6)

- `05-roadmap` — Generated from skill matrix, weekly plan
- `06-daily-tasks` — Task engine, streaks, completion tracking
- `07-content-delivery` — Video lessons (object storage), reading material, MCQ checks
- `08-progress-tracking` — Events, analytics, weekly growth
- `09-notifications` — Unified notification service: in-app (Socket.io), email (Resend), **Telegram publisher** (this is where the Telegram module lands)

### Phase 3 — "Mentors and live classes" (Weeks 7–9)

- `10-live-sessions` — Scheduling, attendance, reminders. Google Meet link via Calendar API for 1:1; Jitsi room URL for group classes
- `11-mentor-system` — Mentor profiles, 1:1 booking, doubt requests
- `12-community-web` — In-app discussion threads + doubt board (Telegram groups still owned/operated externally)

### Phase 4 — "Projects and placement prep" (Weeks 10–13)

- `13-projects` — Project catalogue, GitHub-linked submissions, mentor review
- `14-mock-interviews` — Scheduling, scorecards, recording links
- `15-placement-prep` — Company-specific tracks, readiness score
- `16-payments` — Razorpay subscriptions, plan gates

### Phase 5 — "Retention + admin" (Weeks 14–16)

- `17-gamification` — XP, badges, streaks, leaderboards (also pushed to Telegram channel via publisher)
- `18-admin-panel` — Web admin dashboard, content + user management, Telegram-target CRUD
- `19-discussion-forum` — Long-form Q&A, searchable archive

### Phase 6 — "Deferred (built later when validated)"

- Coding judge / code execution sandbox
- AI mentor / LLM integrations
- Recruiter and hiring module
- Behavioral analysis / churn prediction
- Real industry simulation (sprints, Jira-like)

---

## 6. Data Model — Top-Level Entities

Detailed schemas live in each module's spec. High-level only here.

```
User ─┬─< StudentProfile
      ├─< MentorProfile
      └─< AdminProfile

StudentProfile ─┬─< AssessmentAttempt ─< AnswerLog
                ├─< SkillScore (per skill, versioned)
                ├─< Roadmap ─< RoadmapWeek ─< RoadmapTask
                ├─< DailyTask
                ├─< Enrollment ─< CourseProgress
                ├─< SessionAttendance
                ├─< ProjectSubmission
                ├─< MockInterview
                └─< Subscription

Course ─< Module ─< Lesson ─< Content (video/text/mcq)

Mentor ─< AvailabilitySlot
Mentor ─< Booking >─ StudentProfile

Event (analytics) — append-only, per user, per action
```

---

## 6.5 Telegram Publisher (Outbound-Only)

Telegram's role in Mentra is narrow: **push updates from the platform into existing channels, groups, and bot users that the team operates externally.** Mentra does NOT host conversations, FSMs, onboarding, or user flows on Telegram. The web app is the only UI.

### What Mentra needs to do

- Send a message to a Telegram **channel** (e.g. announcements, content drops).
- Send a message to a Telegram **group** (e.g. cohort discussions, leaderboard posts).
- Send a DM to a Telegram **user** via a configured bot (e.g. session reminder, payment receipt).
- Attach text, links, images, or simple inline buttons (`url` buttons only — clicks open the web app, not callback handlers).

### What Mentra does NOT do

- No webhook receiver, no incoming-message handling, no conversation state.
- No multi-bot orchestration, no FSMs, no Telegram-based onboarding.
- No Telegram-based auth.

If a user replies in Telegram, that reply lives in Telegram — Mentra ignores it.

### Module shape

```
modules/telegram/
├── telegram.routes.ts        # Admin/internal endpoints to trigger sends
├── telegram.controller.ts
├── publisher.service.ts      # sendToChannel, sendToGroup, sendToUser
├── telegram.queue.ts         # BullMQ producer (broadcast queue)
├── telegram.worker.ts        # BullMQ consumer, calls Bot API
├── telegram.schema.ts        # Zod
├── tests/
└── README.md
```

### Flow

```
Any module (e.g. live-sessions, payments, daily-tasks)
        │
        ▼
publisher.service.enqueue({ target, message })
        │
        ▼
BullMQ "telegram-broadcast" queue (Redis)
        │
        ▼
Telegram worker  ──►  Telegram Bot API
        │
        └─ on 429 → exponential backoff + requeue
```

### Configuration

- One or more **bot tokens** stored in `.env` / Doppler. Pick at send time by `botKey`.
- A `telegram_targets` table maps friendly names (e.g. `cohort_jan26_group`, `announcements_channel`) → `{ bot_key, chat_id }`. Avoids hard-coding chat IDs in code.
- Admins can manage targets via the admin panel (CRUD).

### Rate limiting

- Telegram allows ~30 msgs/sec per bot, ~1 msg/sec per chat. The worker enforces this with token-bucket limiters in Redis. Always queue, never inline.

### Why this is cheap

- No webhook endpoint to expose / secure.
- No conversation state in Redis beyond queue jobs.
- A few hundred LoC; ships in days, not weeks.

---

## 7. Cross-Cutting Concerns

### Auth & Authorization
- JWT access token (15 min) + refresh (30 days, rotated).
- RBAC via NestJS guards: `@Roles('student' | 'mentor' | 'admin')`.
- Resource-level checks via policy classes (CASL-style).

### API Conventions
- REST under `/api/v1/...`.
- Versioned via URL prefix. Breaking changes → `/api/v2`.
- All responses: `{ data, meta, error }` envelope.
- Pagination: cursor-based (`?cursor=...&limit=20`).

### Error Handling
- Global exception filter returns structured errors.
- Sentry captures stack + user context (no PII beyond user id).

### Feature Flags
- Stored in Postgres `feature_flags` table, cached in Redis.
- Toggleable per user, per role, per percentage rollout.
- Every new module ships behind a flag.

### Background Jobs
- BullMQ queues: `email`, `notifications`, `scoring`, `nightly-recompute`.
- Each module declares its own queue file.
- Dead-letter handling + retry policy standardized.

### Database Migrations — Atomic, One-Change-Per-File

**Rule:** every schema change is its own Prisma migration file. Never bundle.

- One migration to **create** a table.
- One migration to **add** a column.
- One migration to **drop** a column.
- One migration to **rename / change type / change constraint** on a column.
- One migration to **add / drop** an index.
- One migration to **add / drop** an enum value.

Naming: `YYYYMMDDHHMMSS_<verb>_<target>` — e.g. `20260523_create_users_table`, `20260524_add_status_to_users`, `20260601_drop_legacy_token_from_sessions`.

Why:
- **Reviewable** — diff per migration is tiny; easy to spot dangerous DDL.
- **Reversible** — a bad change reverts in seconds without losing unrelated work.
- **Replayable** — staging and prod apply the same ordered list with no surprises.
- **CI gate** — `prisma migrate diff` flags any migration that touches more than one DDL statement.

Destructive migrations (drop column, drop table, rename) follow the **expand-then-contract** pattern:
1. **Expand**: ship code that writes to both old + new, reads from new (migration A).
2. **Backfill**: data migration job (separate, idempotent, resumable).
3. **Contract**: drop the old column/table once code has fully cut over (migration B), deployed in a later release.

A `migrations/README.md` in `apps/api/prisma/migrations/` lists the convention and every migration's intent in one line.

### Observability
- Structured JSON logs (Pino) → CloudWatch.
- Sentry for errors with release tagging.
- PostHog for product events (page views, feature usage).
- `/healthz` and `/readyz` endpoints per service.

### Security
- HTTPS only, HSTS. TLS via Cloudflare origin certs or Let's Encrypt (Caddy auto, Nginx via certbot).
- Rate limit per IP + per user (Redis-backed) + Nginx-level limits.
- Input validation via Zod / class-validator on every endpoint.
- Secrets in root-owned `.env` files (mode 600) on the VPS, managed via Doppler or sops.
- SSH: key-only auth, root login disabled, fail2ban, UFW firewall (allow 22/80/443 only).
- Daily `pg_dump` to encrypted off-site storage (Backblaze B2), 30-day retention.
- Postgres + Redis bound to `127.0.0.1` or private network only — never public.

---

## 8. Environments

| Env | URL | Host | DB | Purpose |
|---|---|---|---|---|
| local | localhost | Dev laptop | Docker Postgres | Dev |
| staging | staging.mentra.app | Small VPS (1×2 vCPU / 4 GB) | Docker Postgres on same box | QA + UAT |
| prod | mentra.app | Main VPS(es) | Docker Postgres on dedicated VPS | Live |

Staging can co-locate everything on one small VPS to save cost. Prod separates app and DB once you cross ~1k DAU.

---

## 9. CI/CD Per Module

GitHub Actions builds Docker images and ships them to your VPS over SSH.

```
PR opened
 ├─ Lint (eslint + prettier)
 ├─ Type-check (tsc)
 ├─ Unit tests (jest)
 ├─ Integration tests (against ephemeral Postgres in CI)
 ├─ Build Docker image (tag: pr-<n>-<sha>)
 └─ Push to ghcr.io  (preview deploy optional)

Merge to main
 ├─ All of above
 ├─ Migration plan check (prisma migrate diff)
 ├─ Push image tagged `staging-<sha>` to ghcr.io
 ├─ SSH into staging VPS → `docker compose pull && docker compose up -d`
 ├─ Smoke tests against staging
 ├─ Manual approval (GitHub Environments)
 ├─ Push image tagged `prod-<sha>` to ghcr.io
 └─ SSH into prod VPS → rolling restart via docker compose
```

**Zero-downtime deploys on a single VPS:**
- Nginx upstream points at two backend containers (`api-blue`, `api-green`).
- Deploy script: pull image → start green → health check → swap Nginx upstream → stop blue.
- Migrations: run in a one-shot container before the swap. All migrations must be backward-compatible (expand-then-contract pattern).

A module is **done** when:
- [ ] Spec doc updated in `softwareBootstraps/`
- [ ] Migrations written + rolled forward
- [ ] Feature flag created (off by default in prod)
- [ ] Unit + integration tests ≥ 80% coverage
- [ ] Observability: logs, metrics, alerts
- [ ] Runbook in module README
- [ ] Smoke test in CI

---

## 10. Capacity & Cost @ 2k DAU (Self-Hosted VPS)

### Recommended VPS layout

**Option A — single beefy VPS (simplest, recommended to start):**

| VPS | Specs | Runs | Provider examples | ~Monthly |
|---|---|---|---|---|
| Main | 4 vCPU / 16 GB RAM / 200 GB NVMe | Nginx, Next.js, NestJS, Postgres, Redis, monitoring | Hetzner CCX23, Contabo VPS L, DO 4vCPU | $25–50 |

**Option B — split (when you cross ~3k DAU):**

| VPS | Specs | Runs | ~Monthly |
|---|---|---|---|
| App | 4 vCPU / 8 GB | Nginx, Next.js, NestJS, Redis | $20–30 |
| DB | 4 vCPU / 16 GB / 200 GB SSD | Postgres, daily backups | $30–50 |
| Monitoring (optional) | 2 vCPU / 4 GB | Grafana, Loki, Prometheus, Uptime Kuma | $10–15 |

### Total cost @ 2k DAU

| Item | Monthly |
|---|---|
| VPS (Option A) | $30 |
| Object storage (Backblaze B2, ~500 GB) | $3 |
| Cloudflare | $0 |
| Sentry + PostHog (starter / self-hosted) | $0–30 |
| Resend (free tier covers 3k emails/mo) | $0 |
| Backup storage (B2) | ~$2 |
| Domain | ~$1 |
| **Total** | **~$35–70** |

### Headroom
A 4 vCPU / 16 GB VPS comfortably handles 2k DAU and grows to ~5–8k DAU before you split DB onto its own box. Postgres write throughput (progress tracking, event logs) is the first bottleneck — solve with batched writes and a read replica, not by jumping clouds.

---

## 11. Open Questions (for you to decide)

1. **VPS provider** — Hetzner (best price/perf, EU/US), DigitalOcean (easy, pricier), Contabo (cheapest, ok perf), OVH?
2. **VPS data center region** — India users → closest is Singapore / Mumbai. Hetzner has no India region; DO has Bangalore.
3. **Object storage** — MinIO on the same VPS (free, you manage), or Backblaze B2 (cheap, managed)?
4. **ORM** — Prisma (DX-friendly) vs Drizzle (faster, leaner).
5. **Telegram client lib** — `node-telegram-bot-api` (simple, popular) vs `grammY` (TS-first, cleaner) — both work fine for outbound-only.
6. **Group class limit** — Jitsi `meet.jit.si` is free + unlimited time, but quality dips above ~15 concurrent video streams. Acceptable for MVP cohort sizes, or do we need self-hosted Jitsi from day 1?
7. **Mobile** — web-only for MVP, or PWA from day one?
8. **Default language for content** — English only, or Hindi + English?

---

## Next

Once this is approved, I'll create one spec file per module in execution order, starting with `01-auth.md`.
