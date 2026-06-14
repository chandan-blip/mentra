# Module 02 — User Profile (Student)

> Phase 1 · Depends on `01-auth` · Blocks `03-assessment`, `04-dashboard`

---

## 1. Purpose

Own the **self-reported** student profile data: who they are, what they know, what they want.

- Multi-step onboarding flow after signup
- CRUD on profile fields
- Resume upload to object storage
- Tech stack tagging
- Notification preferences (basic — full system lands with `09-notifications`)

Computed/derived attributes (skill scores, interview readiness, project level, DSA rating) do **not** live here. They're produced by `03-assessment`, `06-roadmap`, `09-progress-tracking`, etc., and joined at read time.

---

## 2. In Scope / Out of Scope

### In scope
- `StudentProfile` table with personal, education, experience, goals, links
- Resume upload (single PDF, ≤ 5 MB) to object storage
- Onboarding state machine (`onboardingStep`, `onboardingComplete`)
- `NotificationPreferences` table (minimal; expanded by `09-notifications`)
- Endpoints: GET/PATCH profile, upload resume, set notification prefs

### Out of scope (later modules)
- Mentor profile — `11-mentor-system`
- Admin user data — `18-admin-panel`
- Skill scores — `03-assessment`
- Computed metrics (placement probability, weakness map) — `09-progress-tracking`
- AI resume analysis — deferred indefinitely (user is writing own algos)
- Phone/SMS — dropped from MVP

---

## 3. User Flows

### 3.1 Profile auto-create on signup
1. `01-auth` emits `user.verified` event after OTP confirmation.
2. `user-profile.service` listens, creates an empty `StudentProfile` + default `NotificationPreferences` for that `userId`.
3. `onboardingStep = 0`, `onboardingComplete = false`.

### 3.2 Onboarding wizard (4 steps)
The FE walks the student through 4 screens after first login. Each step PATCHes the profile and advances `onboardingStep`.

| Step | Fields collected | Required? |
|---|---|---|
| 1 — Personal | avatar (optional), city, country, timezone | timezone required |
| 2 — Background | educationLevel, collegeName, graduationYear, experienceLevel, currentRole, currentCompany | educationLevel + experienceLevel required |
| 3 — Goals | goal, targetRoles[], preferredCompanyType[], studyHoursPerDay | goal + targetRoles required |
| 4 — Tech stack | techStack[] (multi-select with autocomplete from canonical list) | ≥ 1 tag required |

On step 4 submit → `onboardingComplete = true` → FE routes to `/assessment`.

### 3.3 Profile editing (settings page)
- Student can edit any field at any time.
- `onboardingComplete` cannot be reset to false.
- Changes emit `student-profile.updated` event so dependent modules (roadmap, assessment) can re-evaluate.

### 3.4 Resume upload
1. FE requests pre-signed upload URL from `POST /profile/resume/upload-url`.
2. BE returns `{ uploadUrl, fileKey }` (presigned PUT to MinIO/B2, TTL 5 min).
3. FE PUTs the PDF directly to storage (no proxy through API).
4. FE calls `POST /profile/resume/confirm` with `fileKey` → BE validates the object exists, mime-type is PDF, size ≤ 5 MB, saves `resumeFileKey` + `resumeUploadedAt`.
5. Replacing a resume deletes the previous object asynchronously (BullMQ `cleanup` queue).

### 3.5 Notification preferences
- Student can toggle per-channel, per-topic flags on a settings page.
- This module only stores the preferences; respecting them is `09-notifications`' job.

---

## 4. Data Model

```prisma
model StudentProfile {
  id                   String   @id @default(cuid())
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Personal
  avatarUrl            String?
  bio                  String?  @db.VarChar(500)

  // Location
  country              String?
  city                 String?
  timezone             String   @default("Asia/Kolkata")

  // Education
  educationLevel       EducationLevel?
  collegeName          String?
  graduationYear       Int?

  // Experience
  experienceLevel      ExperienceLevel?
  currentRole          String?
  currentCompany       String?

  // Goals
  goal                 CareerGoal?
  preferredCompanyType CompanyType[]
  targetRoles          String[]     // e.g. ["frontend","backend"]
  studyHoursPerDay     Int?         // 1..16

  // Tech stack — self-reported tags; canonical IDs from /skills/catalogue
  techStack            String[]

  // Links
  githubUrl            String?
  linkedinUrl          String?
  portfolioUrl         String?
  twitterUrl           String?

  // Resume
  resumeFileKey        String?
  resumeUploadedAt     DateTime?

  // Onboarding
  onboardingStep       Int      @default(0)
  onboardingComplete   Boolean  @default(false)

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([onboardingComplete])
}

model NotificationPreferences {
  id                     String   @id @default(cuid())
  userId                 String   @unique
  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  emailDailyTasks        Boolean  @default(true)
  emailWeeklyReview      Boolean  @default(true)
  emailSessionReminders  Boolean  @default(true)
  emailAnnouncements     Boolean  @default(true)
  inAppEnabled           Boolean  @default(true)

  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}

enum EducationLevel  { high_school undergrad postgrad doctoral working_professional self_taught }
enum ExperienceLevel { none intern under_one one_to_three three_to_five five_plus }
enum CareerGoal      { first_job switch_company fang_prep startup_join freelance upskill }
enum CompanyType     { startup mnc product service government remote }
```

### Skill catalogue (separate, read-mostly reference)

A canonical tag list backs the tech-stack multi-select. Kept in code as a seed; surfaced via API. No table needed in MVP — just a JSON file in `apps/api/src/modules/user-profile/data/skill-catalogue.json` (~150 entries: languages, frameworks, tools, concepts). Migration to a DB table happens only if we need admin-side editing.

---

## 5. API Endpoints

All under `/api/v1/profile`. All require `requireAuth` middleware from `01-auth`.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/me` | — | Full profile + notification prefs + onboarding state |
| PATCH | `/me` | Partial profile fields | Updated profile |
| POST | `/me/onboarding/step` | `{ step, fields }` | `{ onboardingStep, onboardingComplete }` |
| POST | `/me/resume/upload-url` | `{ filename, sizeBytes, mimeType }` | `{ uploadUrl, fileKey, expiresAt }` |
| POST | `/me/resume/confirm` | `{ fileKey }` | `{ resumeFileKey, resumeUploadedAt }` |
| DELETE | `/me/resume` | — | `204` |
| GET | `/me/notifications` | — | NotificationPreferences |
| PATCH | `/me/notifications` | Partial flags | Updated prefs |
| GET | `/skills/catalogue` | `?q=react` | `[{ id, label, category }]` (autocomplete) |

### Validation (Zod)
- All string fields: trimmed, max length enforced.
- URLs: must be `https://` and match an allowlist of hostnames (github.com, linkedin.com, etc.) where applicable.
- `studyHoursPerDay`: `int().min(1).max(16)`.
- `graduationYear`: `int().min(1970).max(currentYear + 10)`.
- `techStack[]`: `array(string()).min(0).max(30)`; each item must exist in the skill catalogue.
- `targetRoles[]`: `array().min(1).max(5)` when set.

---

## 6. Module Layout

```
apps/api/src/modules/user-profile/
├── user-profile.routes.ts
├── user-profile.controller.ts
├── user-profile.service.ts
├── user-profile.repository.ts
├── user-profile.schema.ts         # Zod (shared via packages/shared)
├── onboarding.service.ts          # Step-state machine + validation per step
├── resume.service.ts              # Pre-signed URL + confirm + cleanup
├── notification-prefs.service.ts
├── events.ts                      # Event types this module emits/listens to
├── data/
│   └── skill-catalogue.json
├── tests/
│   ├── user-profile.service.test.ts
│   ├── onboarding.service.test.ts
│   ├── resume.service.test.ts
│   └── user-profile.routes.test.ts
└── README.md
```

### Events
- **Listens:** `user.verified` (from `01-auth`) → create empty profile + prefs.
- **Listens:** `user.deleted` (from `01-auth`) → cascade is automatic via FK, but emits cleanup job to delete resume from object storage.
- **Emits:** `student-profile.updated` with `{ userId, changedFields[] }`.
- **Emits:** `student-profile.onboarding-completed` with `{ userId, completedAt }`.

### Cross-module exports
- `getProfile(userId)` — used by dashboard, assessment, roadmap.
- `requireOnboardingComplete` middleware — gates routes that need a finished profile.

---

## 7. Security

- All endpoints scoped to the **authenticated user's own profile**. No `:userId` in paths; always `me`. Mentor/admin views read via repository functions, not the public REST surface.
- Resume upload:
  - Pre-signed URL is **PUT-only**, 5-min expiry, content-type pinned.
  - Server validates after upload: re-fetches object metadata, rejects if size > 5 MB or mime ≠ `application/pdf`.
  - Object key format: `resumes/<userId>/<uuid>.pdf` — no user-controlled paths.
  - Stored in a private bucket; downloads via short-lived presigned GETs.
- URL fields sanitized — strip query strings if not on allowlist, drop entries with `javascript:`/`data:` schemes.
- Bio + free-text fields HTML-escaped before storage; on read FE treats as plain text.
- Rate limit: 30 PATCHes/min/user, 5 resume uploads/hour/user.

---

## 8. Feature Flags

| Flag | Default (prod) | Purpose |
|---|---|---|
| `profile.resume.upload` | on | Kill switch for resume feature |
| `profile.onboarding.required` | on | When off, students skip wizard and land on dashboard with empty profile |

---

## 9. Telemetry

### Logs (Pino)
- `profile.created`, `profile.updated` (with `changedFields`)
- `profile.onboarding.step_completed` / `onboarding.completed`
- `profile.resume.upload_url_issued` / `upload_confirmed` / `upload_rejected`

### Metrics
- `profile_onboarding_completion_total` (counter)
- `profile_onboarding_step_dropoff{step}` (gauge — derived weekly)
- `profile_resume_uploads_total`
- `profile_resume_rejects_total{reason}` (size, mime, missing-object)

### Alerts
- Resume reject rate > 30% over 1h → warn (likely a FE bug or storage misconfig).
- Onboarding completion drop > 50% week-over-week → warn.

---

## 10. Testing

- **Unit**: Zod schemas (each field's valid/invalid cases), onboarding state machine, URL allowlist.
- **Integration**:
  - Profile auto-created on `user.verified` event
  - PATCH respects partial-update semantics
  - Onboarding step cannot regress
  - Resume upload-url → upload (in-memory MinIO) → confirm flow
  - Rejected upload: oversized file, wrong mime, missing object
  - Skills catalogue search returns relevant entries
- **Contract**: shared Zod schemas in `packages/shared` consumed by FE without drift.

Coverage target: 80%+ on services and the onboarding state machine.

---

## 11. Migrations

Follows project rule (architecture §7): **one DDL change per migration file**.

### Initial set (in order)

| # | Migration | DDL |
|---|---|---|
| 01 | `create_education_level_enum` | `CREATE TYPE education_level AS ENUM (...)` |
| 02 | `create_experience_level_enum` | `CREATE TYPE experience_level AS ENUM (...)` |
| 03 | `create_career_goal_enum` | `CREATE TYPE career_goal AS ENUM (...)` |
| 04 | `create_company_type_enum` | `CREATE TYPE company_type AS ENUM (...)` |
| 05 | `create_student_profiles_table` | `student_profiles` with all initial columns |
| 06 | `add_index_student_profiles_onboarding_complete` | partial index for analytics queries |
| 07 | `create_notification_preferences_table` | `notification_preferences` |

### Future field additions (each its own migration)

Examples we already foresee (write when needed, not now):
- `add_avatar_storage_key_to_student_profiles` — when we move avatars from URL to object storage
- `add_preferred_language_to_student_profiles`
- `add_email_mock_interviews_to_notification_preferences`

### Seed
- Skill catalogue lives as JSON in code, not a table — no migration needed.

---

## 12. Environment Variables

```
OBJECT_STORAGE_ENDPOINT=https://s3.us-west-002.backblazeb2.com
OBJECT_STORAGE_BUCKET=mentra-private
OBJECT_STORAGE_ACCESS_KEY=...
OBJECT_STORAGE_SECRET_KEY=...
OBJECT_STORAGE_REGION=us-west-002
RESUME_MAX_BYTES=5242880          # 5 MB
RESUME_PRESIGN_TTL_SECONDS=300
PROFILE_DEFAULT_TIMEZONE=Asia/Kolkata
```

---

## 13. Frontend Surface (React)

Routes under `apps/web/src/routes/`:

- `/onboarding` — 4-step wizard (Framer Motion slide transitions between steps, dot progress indicator)
- `/settings/profile` — full editable form, autosave on blur
- `/settings/account` — links to password change, sessions (from auth module)
- `/settings/notifications` — toggle grid

Components in `packages/ui`:
- `SkillTagInput` — multi-select with debounced autocomplete (TanStack Query against `/skills/catalogue`)
- `AvatarUploader`
- `ResumeUploader` — drag/drop, pre-signed PUT, progress bar
- `OnboardingStep` — Framer Motion layout primitive

State:
- Profile cached via TanStack Query, key `["profile","me"]`.
- Optimistic updates on PATCH; revert on error.
- Onboarding step persisted server-side — refreshing the page resumes where you left off.

---

## 14. Runbook

- **"Profile not created after signup"** → check `user.verified` event listener is registered; check Pino logs for `profile.created` near the verification timestamp; manually trigger via `POST /admin/profile/backfill/:userId` (admin-only repair endpoint, behind flag).
- **"Resume upload returns 403"** → verify object storage credentials, bucket policy allows PUT for the user's prefix, CORS allows the web origin.
- **"Skill autocomplete empty"** → catalogue JSON failed to load at boot; check container logs for parse errors.
- **Rollback**: PATCH operations are non-destructive. Resume deletes go through a 24-hour soft-delete queue before object removal, allowing recovery.

---

## 15. CI/CD Gate

This module is "done" when:
- [ ] All endpoints in §5 implemented + Zod-validated
- [ ] Profile auto-creation wired to `user.verified` event with integration test
- [ ] Pre-signed upload + confirm + cleanup flow tested end-to-end against ephemeral MinIO in CI
- [ ] Onboarding state machine cannot regress, validated by tests
- [ ] Feature flags created
- [ ] Telemetry: logs + metrics wired up
- [ ] FE: onboarding wizard + settings pages live, animations smooth, autosave works
- [ ] Coverage ≥ 80% on services
- [ ] Smoke test in CI: signup → verify → walk onboarding wizard → land on assessment route

---

## 16. Open Questions

1. **Avatar storage** — uploaded image to object storage (with thumbnail generation later), or just store an external URL (Gravatar/social) for MVP?
2. **Onboarding skippability** — let users skip the wizard and complete it later, or hard-gate the dashboard until done? Recommendation: hard-gate, since the assessment depends on Step 4 (tech stack).
3. **Tech-stack catalogue** — start with 150 hand-curated entries, or seed from a public list (e.g. roadmap.sh / DevHints)?
4. **Resume retention** — keep all resume versions or only the latest? MVP: only latest, prev one async-deleted.
5. **Profile visibility** — public profile pages (e.g. `/u/<username>`) in MVP, or fully private until placement module?
