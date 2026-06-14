# Module 01 — Auth

> Phase 1 · First module on the critical path · Blocks every other module

---

## 1. Purpose

Sign users up, log them in, identify them on every API call. Nothing more.

- Email + password signup with email-OTP verification
- Google OAuth
- GitHub OAuth
- JWT-based session (access + refresh tokens)
- Password reset
- Logout (single device + all devices)
- Role-based authorization primitive (`student`, `mentor`, `admin`)

---

## 2. In Scope / Out of Scope

### In scope
- Account creation + verification
- Login via email/password, Google, GitHub
- JWT issuance + refresh
- Password reset via email link
- Linked identities (one user can have email + Google + GitHub on the same account)
- Role assignment + RBAC middleware
- Session listing + revocation
- Brute-force + rate limiting

### Out of scope (later modules)
- Profile data — handled by `02-user-profile`
- Phone / SMS — dropped from MVP
- Magic links (passwordless) — defer
- 2FA / TOTP — defer to security pass
- Telegram login — Telegram is outbound-only, not for auth
- Admin user CRUD UI — handled by `18-admin-panel`

---

## 3. User Flows

### 3.1 Signup (email + password)
1. User submits `{ email, password, name }`.
2. Backend creates `User` row (status `pending`), hashes password with **Argon2id**.
3. Backend generates 6-digit OTP, stores hash in Redis (`otp:signup:<userId>`, TTL 10 min), emails it via Resend.
4. User submits OTP → status flips to `active`, JWT pair issued, OTP key deleted.
5. Frontend redirects to `02-user-profile` onboarding.

### 3.2 Login (email + password)
1. Submit `{ email, password }`.
2. Backend verifies Argon2id hash.
3. If `pending`, resend OTP and prompt verification.
4. If `active`, issue access (15 min) + refresh (30 days) tokens.

### 3.3 Google / GitHub OAuth
1. FE hits `/api/v1/auth/google` (or `/github`) → 302 to provider.
2. Provider redirects to `/api/v1/auth/google/callback?code=...`.
3. Backend exchanges code → fetches profile.
4. If `provider_id` exists in `auth_identities` → log in.
5. Else if email matches an existing user → link identity, log in.
6. Else create `User` (status `active`, no password) + `auth_identity` row.

### 3.4 Refresh
1. FE calls `/api/v1/auth/refresh` with refresh token in HTTP-only cookie.
2. Backend verifies token signature + checks `sessions` table (token not revoked).
3. Issues new access token. **Rotates** the refresh token — old one is marked revoked, new one replaces it. Reuse of a revoked refresh token → revoke entire session family (token theft heuristic).

### 3.5 Logout
- Single device: revoke the refresh token in `sessions`.
- All devices: revoke every `sessions` row for the user.

### 3.6 Password reset
1. Submit email → backend issues signed token (HMAC, 30-min TTL), emails reset link.
2. User clicks link → submits new password.
3. Backend validates token, rotates password, **revokes all sessions** for the user.

---

## 4. Data Model

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String?  // null for OAuth-only users
  name          String
  role          Role     @default(student)
  status        UserStatus @default(pending)
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  identities    AuthIdentity[]
  sessions      Session[]
}

model AuthIdentity {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider    AuthProvider     // email | google | github
  providerId  String           // sub from OAuth, or email for password
  createdAt   DateTime @default(now())

  @@unique([provider, providerId])
  @@index([userId])
}

model Session {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokenHash String  @unique // hash, never store raw token
  familyId        String   // shared across rotations of the same login
  userAgent       String?
  ip              String?
  revokedAt       DateTime?
  expiresAt       DateTime
  createdAt       DateTime @default(now())

  @@index([userId])
  @@index([familyId])
}

enum Role { student mentor admin }
enum UserStatus { pending active suspended }
enum AuthProvider { email google github }
```

OTPs and password-reset tokens live in **Redis only** (not Postgres) with TTLs.

---

## 5. API Endpoints

All under `/api/v1/auth`.

| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/signup` | public | `{ email, password, name }` | `{ userId }` |
| POST | `/signup/verify` | public | `{ userId, otp }` | `{ accessToken }` + refresh cookie |
| POST | `/signup/resend-otp` | public | `{ userId }` | `204` |
| POST | `/login` | public | `{ email, password }` | `{ accessToken }` + refresh cookie |
| GET | `/google` | public | — | 302 to Google |
| GET | `/google/callback` | public | `?code` | 302 to FE with access token in fragment |
| GET | `/github` | public | — | 302 to GitHub |
| GET | `/github/callback` | public | `?code` | 302 to FE |
| POST | `/refresh` | refresh cookie | — | `{ accessToken }` + rotated refresh cookie |
| POST | `/logout` | access | — | `204` |
| POST | `/logout-all` | access | — | `204` |
| POST | `/password/forgot` | public | `{ email }` | `204` (always, no enumeration) |
| POST | `/password/reset` | public | `{ token, newPassword }` | `204` |
| GET | `/me` | access | — | `{ id, email, name, role }` |
| GET | `/sessions` | access | — | `[{ id, userAgent, ip, createdAt }]` |
| DELETE | `/sessions/:id` | access | — | `204` |

### Token format
- **Access token**: JWT signed with HS256 (or RS256 if we ever go multi-service). Claims: `sub`, `role`, `sessionId`, `iat`, `exp` (15 min). Sent as `Authorization: Bearer …`.
- **Refresh token**: opaque random 256-bit string. Sent via `HttpOnly; Secure; SameSite=Lax` cookie at `/api/v1/auth/refresh`. Stored hashed in DB.

---

## 6. Module Layout

```
apps/api/src/modules/auth/
├── auth.routes.ts          # Express router → mounted at /api/v1/auth
├── auth.controller.ts
├── auth.service.ts         # signup, login, refresh, password reset
├── auth.repository.ts      # Prisma access
├── auth.schema.ts          # Zod request/response
├── auth.middleware.ts      # requireAuth, requireRole
├── strategies/
│   ├── google.strategy.ts  # Passport
│   └── github.strategy.ts
├── tokens/
│   ├── jwt.ts              # sign / verify access
│   └── refresh.ts          # create / rotate / revoke
├── otp/
│   └── otp.service.ts      # Redis-backed OTP gen + verify
├── tests/
│   ├── auth.service.test.ts
│   ├── auth.routes.test.ts
│   └── tokens.test.ts
└── README.md
```

### Cross-module exports
- `requireAuth` middleware
- `requireRole('student' | 'mentor' | 'admin')` middleware
- `getUserFromRequest(req)` helper
- `AuthEvents` (typed event emitter — fires `user.created`, `user.verified`, `session.revoked`)

---

## 7. Security

- **Passwords**: Argon2id (`memoryCost: 19456 KiB, timeCost: 2, parallelism: 1`).
- **OTPs**: 6-digit numeric, hashed (SHA-256) in Redis, 10-min TTL, 5 attempts max.
- **Rate limits** (Redis token bucket):
  - `/login`: 10/min/IP + 5/min/email
  - `/signup`: 5/min/IP
  - `/signup/resend-otp`: 1/min/userId
  - `/password/forgot`: 3/min/IP
  - `/refresh`: 60/min/userId
- **Refresh-token reuse detection**: if a revoked refresh token is presented, revoke the entire `familyId` and force re-login.
- **OAuth state param**: random nonce stored in Redis, verified on callback (CSRF protection).
- **Cookies**: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/v1/auth/refresh`.
- **JWT secrets**: separate keys for access + refresh (cookie HMAC). Rotated via env vars; previous key kept around for one rotation cycle.
- **No email enumeration**: `/password/forgot` and `/login` return identical responses for "unknown email" and "wrong password".
- **Audit log**: `auth.service` emits structured events for every login/logout/password-change → captured by `09-notifications` logger.

---

## 8. Feature Flags

| Flag | Default (prod) | Purpose |
|---|---|---|
| `auth.signup.email` | on | Disable to freeze new signups during incidents |
| `auth.signup.google` | on | Disable if Google OAuth misbehaves |
| `auth.signup.github` | on | Same as above |
| `auth.password.reset` | on | Kill switch |

Flags live in Postgres `feature_flags`, cached in Redis 30s, read via a single helper.

---

## 9. Telemetry

### Logs (Pino, structured)
- `auth.signup.attempted` / `succeeded` / `failed`
- `auth.login.attempted` / `succeeded` / `failed`
- `auth.refresh.rotated` / `auth.refresh.reuse_detected`
- `auth.password.reset_requested` / `reset_completed`

### Metrics (Prometheus)
- `auth_signups_total{provider}`
- `auth_logins_total{provider, outcome}`
- `auth_refresh_reuse_total` (alert when > 0)
- `auth_otp_verify_failures_total`

### Alerts
- `auth_refresh_reuse_total` > 0 over 5m → page on-call (token theft signal)
- Login success rate < 80% over 10m → warn
- OTP send failure rate > 5% → warn

---

## 10. Testing

- **Unit**: hashing, token sign/verify, OTP gen/check, refresh rotation logic.
- **Integration** (against ephemeral Postgres + Redis in CI):
  - Signup happy path
  - Verify OTP wrong / expired
  - Login with wrong password
  - OAuth callback creates + links identity
  - Refresh token rotation
  - Refresh token reuse → family revocation
  - Password reset revokes all sessions
- **Load** (k6, run weekly in CI):
  - 100 concurrent logins, p95 < 200ms

Coverage target: 85%+ on `auth.service.ts` and `tokens/`.

---

## 11. Migrations (Phase 1)

Follows the project-wide rule (architecture §7): **one DDL change per migration file**. No bundling.

### Initial set (in this order)

| # | Migration | DDL |
|---|---|---|
| 01 | `create_role_enum` | `CREATE TYPE role AS ENUM ('student','mentor','admin')` |
| 02 | `create_user_status_enum` | `CREATE TYPE user_status AS ENUM ('pending','active','suspended')` |
| 03 | `create_auth_provider_enum` | `CREATE TYPE auth_provider AS ENUM ('email','google','github')` |
| 04 | `create_users_table` | `users` with all columns from §4 |
| 05 | `add_index_users_email` | unique index on `users.email` (if not already inline) |
| 06 | `create_auth_identities_table` | `auth_identities` |
| 07 | `add_unique_auth_identities_provider_providerId` | composite unique index |
| 08 | `add_index_auth_identities_userId` | |
| 09 | `create_sessions_table` | `sessions` |
| 10 | `add_index_sessions_userId` | |
| 11 | `add_index_sessions_familyId` | |

Note: when an index is naturally part of the `CREATE TABLE` (e.g. primary key, inline `@@unique`), it ships in the create migration — it's still one DDL statement Prisma generates. The "one change per migration" rule applies to **post-create** schema evolution.

### Future field changes (examples)

- Adding `lastLoginAt` to `users` → its own migration: `add_last_login_at_to_users`.
- Dropping `userAgent` from `sessions` → expand-then-contract:
  1. `nullable_user_agent_on_sessions` (relax constraint)
  2. Code stops writing to it
  3. `drop_user_agent_from_sessions` (in a later release)

### Seed (dev/staging only)
One admin user pulled from `ADMIN_SEED_EMAIL` + `ADMIN_SEED_PASSWORD` env vars. Seeds are not migrations — they live in `prisma/seed.ts` and are idempotent.

---

## 12. Environment Variables

```
JWT_ACCESS_SECRET=...        # 64 random bytes, base64
JWT_REFRESH_COOKIE_SECRET=...
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
ARGON2_MEMORY_COST=19456
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://mentra.app/api/v1/auth/google/callback
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://mentra.app/api/v1/auth/github/callback
RESEND_API_KEY=...
EMAIL_FROM=Mentra <noreply@mentra.app>
WEB_APP_ORIGIN=https://mentra.app
```

---

## 13. Frontend Surface (React)

Routes under `apps/web/src/routes/auth/`:

- `/signup` — email/password + OAuth buttons
- `/signup/verify` — 6-digit OTP input (auto-paste, auto-submit)
- `/login` — email/password + OAuth + "forgot password"
- `/forgot-password`
- `/reset-password?token=...`
- `/oauth/callback` — handles fragment with access token after OAuth

State:
- Access token kept in memory (Zustand). Never persisted.
- On app load: silent `/refresh` call. If it fails, user is logged out.
- On 401 from any API call: trigger `/refresh`, retry once, else redirect to `/login`.

Animations: Framer Motion page transitions, micro-interactions on form errors (subtle shake).

---

## 14. Runbook

- **"Users can't log in"** → check Resend status, Postgres connection, Redis (OTP store), feature flags.
- **"Refresh-reuse alert paging"** → likely token theft. Inspect `sessions` for that `familyId`, force `logout-all`, contact user.
- **"OAuth callback failing"** → check provider client IDs match env, check callback URL whitelisted in Google/GitHub console.
- **Roll back**: every migration is reversible. Auth has no destructive operations from other modules — safe to revert.

---

## 15. CI/CD Gate

This module is "done" when:
- [ ] All endpoints in §5 implemented + Zod-validated
- [ ] Argon2id + token rotation + reuse detection in place
- [ ] Unit + integration tests pass, coverage ≥ 85%
- [ ] All rate limits configured
- [ ] Feature flags created (default on in dev, off in prod until rollout)
- [ ] Telemetry: logs + metrics + alerts wired up
- [ ] FE pages implemented and connected
- [ ] Runbook in this README
- [ ] Smoke test: signup → verify → login → refresh → logout passes in CI against staging

---

## 16. Open Questions

1. **Email-only signup before OAuth?** Ship email/password first (week 1), Google/GitHub a few days later? Or all-three day one?
2. **Refresh token storage on FE** — HTTP-only cookie (recommended, what we picked) vs in-memory + localStorage hybrid?
3. **Cookie domain** — single domain (`mentra.app`) or subdomain split (`api.mentra.app` + `mentra.app`)? Affects cookie scoping.
4. **Admin bootstrap** — env-var seeded admin, or a one-time `npm run create-admin` CLI?
