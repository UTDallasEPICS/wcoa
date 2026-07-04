# WCOA — Ride Scheduling App

Volunteer ride-scheduling platform (UTDallas EPICS): admins manage clients/volunteers/rides, volunteers sign up for rides, email notifications + cron reminders.

**Stack**: Nuxt 4 + Nuxt UI (`app/`), Nitro API routes (`server/api/{get,post,put,delete}/...`), Prisma 7 + SQLite via better-sqlite3 (`prisma/schema/` multi-file schema), better-auth with email-OTP only (no passwords), nodemailer (Gmail), nuxt-cron (`server/cron/reminders.ts`).

## Commands

- `pnpm dev` — dev server on :3000 (needs `.env`: `DATABASE_URL=file:./dev.db`, `BETTER_AUTH_SECRET=<anything>`; `EMAIL_*` optional — send failures are swallowed)
- `pnpm test` — e2e suite: `nuxt prepare` → vitest builds the app and runs it against a fresh seeded `.data/test.db` (see `tests/`)
- `npx prisma db push && npx tsx prisma/seed.ts` — reset + seed a database by hand (`DATABASE_URL` selects the file)

## Testing & verification

The e2e harness (`vitest.config.ts`, `tests/global-setup.ts`) boots the real built app against a throwaway seeded SQLite file. Test files must live in `tests/e2e/*.test.ts` and start with `await setup({ rootDir: ... })` (copy `smoke.test.ts`).

**Authenticated requests without SMTP**: `loginAs(email)` in `tests/utils/auth.ts` runs the real OTP flow by reading the OTP from the `verification` table (better-auth stores it before the email send, and send failures are swallowed). Returns a `Cookie` header value. Seeded accounts:

- ADMIN: `reachtusharwani@gmail.com`
- VOLUNTEER: `bob@example.com`, `alice@example.com` (both AVAILABLE)
- CLIENT: `martha@example.com`, `george@example.com`, `sarah@example.com`

Same trick works for manual dev-server verification: POST `/api/auth/email-otp/send-verification-otp` `{email, type: 'sign-in'}`, read the OTP with `sqlite3 dev.db "SELECT value FROM verification ORDER BY createdAt DESC LIMIT 1"` (strip any `:n` suffix), POST `/api/auth/sign-in/email-otp` `{email, otp}`, use the returned cookie.

## Gotchas

- **Merging to `main` deploys**: CI builds and pushes the production Docker image on every push to `main` (`.github/workflows/main.yml`). All work goes through PR branches.
- **Do not open or copy `prod.sql` / `deploy.tar.gz`**: `prod.sql` is a production dump containing real client PII, pending removal and history purge (issue #29). Never quote its contents anywhere.
- `prisma/migrations` is gitignored (issue #33) — schema changes are applied with `db push` locally; flag migration needs in the PR until #33 is fixed.
- `RideStatus` enum is only `CREATED | ASSIGNED | COMPLETED` — code paths mentioning `CANCELLED` are dead/broken (issues #5, #22).
- `sendEmail` swallows all failures (issue #25); most API routes have no auth (issue #1) — don't "fix" these in passing, they have dedicated issues.
- Seeded ride times are relative to `new Date()` at seed time; don't assert exact timestamps in tests.

## Issue workflow

The GitHub board is organized by milestone (work them in order: 1 Security → 2 Data Integrity → 3 Performance → 4 Features) with `P0`–`P3` priority, type (`bug`/`security`/`performance`/`tech debt`), and `area:` labels. Issues #1–#28 carry verification comments (2026-07-04) with exact file/line findings — read the comments, not just the body. Use `/fix-issue <number>` for the standard fix loop. One issue per PR; if a fix naturally resolves a sibling issue (e.g. #1 covers most of #2), say so in the PR body with `Fixes #N` lines rather than expanding scope further.
