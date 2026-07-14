# WCOA — Volunteer Ride Scheduling

WCOA is a web app that coordinates volunteer-driven rides for clients who need
transportation. It is a UT Dallas EPICS project handed off to a new student
cohort each semester — this README is the starting point for anyone picking it
up.

**In one sentence:** admins manage clients, volunteers, and rides; volunteers
browse open rides and sign up to drive them; clients are the riders; the app
sends email notifications for important events and cron-based reminders before
scheduled rides.

- Admins create rides (a client + pickup/dropoff + a scheduled time) and manage
  everyone's accounts.
- Volunteers sign up for open rides, un-sign up, and mark rides completed. They
  control which notifications and reminders they receive.
- Clients are the people being driven; they are managed by admins.

---

## Stack

| Layer | Technology |
| --- | --- |
| Framework | [Nuxt 4](https://nuxt.com) + [Nuxt UI](https://ui.nuxt.com) (frontend in `app/`) |
| API | [Nitro](https://nitro.build) server routes under `server/api/` |
| ORM / DB | [Prisma 7](https://www.prisma.io) + SQLite via `better-sqlite3` (multi-file schema in `prisma/schema/`) |
| Auth | [better-auth](https://www.better-auth.com) with **email one-time-password (OTP) only** — there are no passwords |
| Email | [nodemailer](https://nodemailer.com) over Gmail |
| Reminders | [nuxt-cron](https://github.com/danielroe/nuxt-cron) job in `server/cron/reminders.ts` |
| Package manager | pnpm |

---

## Local setup

Requires **Node.js 20+** and **pnpm** (developed against Node 25 / pnpm 10).

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create your `.env`

Copy the checked-in example and fill it in:

```bash
cp .env.example .env
```

The variables the app actually reads:

| Variable | Required? | What it is |
| --- | --- | --- |
| `DATABASE_URL` | **yes** | SQLite file location. Use `file:./dev.db` for local dev. |
| `BETTER_AUTH_SECRET` | **yes** | Any random string; signs sessions/tokens. `openssl rand -base64 32` works. |
| `BETTER_AUTH_URL` | recommended | The app's own origin, e.g. `http://localhost:3000`. Trusted for CSRF/Origin checks. |
| `APP_URL` | optional | Base URL used to build ride links inside emails (falls back to `http://localhost:3000`). Also trusted as an origin. |
| `TRUSTED_ORIGINS` | optional | Comma-separated extra origins trusted for CSRF/Origin validation. |
| `EMAIL_USER` | optional | Gmail address used to send notifications. |
| `EMAIL_PASS` | optional | Gmail **app password** (not your account password — Gmail requires an app-specific password for SMTP). |
| `NUXT_GOOGLE_MAPS_API_KEY` | optional | **Server-only** Google Maps key for the Directions API distance/duration estimate. Never shipped to the browser. Overrides `runtimeConfig.googleMapsApiKey`. Restrict by IP/API in Google Cloud. |
| `NUXT_PUBLIC_GOOGLE_MAPS_API_KEY` | optional | **Client-visible** Google Maps key for the ride map *embed* iframe. Ships to the browser by design, so it must be a **different** Cloud key that is **HTTP-referrer-restricted** and scoped to the Maps Embed API (issue #30). Overrides `runtimeConfig.public.googleMapsApiKey`. |

Email is optional for local development: if `EMAIL_USER` / `EMAIL_PASS` are
unset, sends fail and the failure is swallowed, so the app still runs and you
can develop against everything else. The Google Maps key is likewise only
needed for the map/estimate features on a ride page.

### 3. Initialize and seed the database

```bash
npx prisma generate                 # generate the Prisma client (into prisma/generated)
npx prisma db push                  # create the SQLite schema
npx tsx prisma/seed.ts              # seed sample users, rides, and notification templates
```

`DATABASE_URL` selects which file these commands act on. To reset a database by
hand later, re-run `npx prisma db push && npx tsx prisma/seed.ts`.

> Note: `prisma/migrations` is not tracked in git yet. Schema changes are
> applied locally with `db push` rather than migrations — flag any migration
> need in your PR.

### 4. Run the dev server

```bash
pnpm dev
```

The app runs on http://localhost:3000.

#### Logging in without a working mailbox

Auth is email-OTP only. With no SMTP configured, the OTP is still generated and
stored in the database before the (failing) send, so you can read it directly:

1. Request a code:
   ```bash
   curl -X POST http://localhost:3000/api/auth/email-otp/send-verification-otp \
     -H 'Content-Type: application/json' \
     -d '{"email":"reachtusharwani@gmail.com","type":"sign-in"}'
   ```
2. Read it out of the DB (strip any trailing `:n` suffix):
   ```bash
   sqlite3 dev.db "SELECT value FROM verification ORDER BY createdAt DESC LIMIT 1"
   ```
3. Sign in:
   ```bash
   curl -X POST http://localhost:3000/api/auth/sign-in/email-otp \
     -H 'Content-Type: application/json' \
     -d '{"email":"reachtusharwani@gmail.com","otp":"<code>"}'
   ```

Seeded accounts you can log in as:

- **ADMIN**: `reachtusharwani@gmail.com`
- **VOLUNTEER**: `bob@example.com`, `alice@example.com`
- **CLIENT**: `martha@example.com`, `george@example.com`, `sarah@example.com`

---

## Tests

```bash
pnpm test
```

This runs an **end-to-end suite**: it prepares Nuxt, builds the real app, boots
it against a throwaway seeded SQLite database (`.data/test.db`), and hits it
with real HTTP requests via Vitest. Test files live in `tests/e2e/*.test.ts`.

Because the suite builds the real app, `pnpm install` and `npx prisma generate`
must have been run first (otherwise the Prisma client isn't generated and the
harness fails to boot). Authenticated tests use the same read-the-OTP-from-the-DB
trick described above (`tests/utils/auth.ts`).

---

## Architecture tour

```
app/                      Nuxt frontend
  pages/                  file-based routes (see below)
  assets/css/main.css
server/
  api/                    Nitro API routes, grouped by HTTP verb (see below)
  utils/                  shared server helpers (auth, email, notifications, scheduler)
  cron/reminders.ts       nuxt-cron job that sends ride reminders
  middleware/             request middleware (auth, etc.)
prisma/
  schema/                 multi-file Prisma schema
  seed.ts                 database seed script
notes/                    hand-written design notes (db.md, notifs.md)
```

### Frontend — `app/pages/`

Nuxt maps these files to routes automatically:

- `index.vue` — home / dashboard
- `auth.vue` — email-OTP sign-in
- `people.vue` — manage clients, volunteers, admins
- `rides/index.vue` — ride list
- `rides/[id].vue` — single ride (map, distance estimate, sign up)
- `settings.vue` — the signed-in user's settings (notification & reminder prefs)
- `admin/notifications.vue` — edit notification templates

### API — `server/api/{get,post,put,delete}/...`

API routes are organized by HTTP verb into folders. The verb folder is part of
the URL path, and the path under it is the resource. For example:

- `server/api/get/rides/index.ts` → `GET /api/get/rides`
- `server/api/post/rides/index.ts` → `POST /api/post/rides`
- `server/api/post/rides/[id]/signup.ts` → `POST /api/post/rides/<id>/signup`
- `server/api/put/volunteers/bySession/reminders.ts` → `PUT /api/put/volunteers/bySession/reminders`
- `server/api/delete/clients/[id].ts` → `DELETE /api/delete/clients/<id>`

(`server/api/auth/[...all].ts` is the catch-all that better-auth mounts for its
own endpoints under `/api/auth/...`.)

### Server utilities — `server/utils/`

- `auth.ts` — better-auth setup (email-OTP plugin, trusted origins, nodemailer transport)
- `authz.ts` — authorization helpers, e.g. `requireAdmin()`
- `email.ts` — nodemailer wrapper (`sendEmail`)
- `notification.ts` — renders a `NotificationTemplate` for an event and sends it, respecting each volunteer's per-type opt-outs
- `scheduler.ts` — `processReminders()`, called by the cron job
- `datetime.ts`, `dateRange.ts`, `address.ts`, `sanitize.ts`, `validation.ts`, `prisma.ts` — misc helpers and the shared Prisma client

### Schema — `prisma/schema/`

The schema is split across files:

- `schema.prisma` — generator + `sqlite` datasource
- `enum.prisma` — `Role` and `RideStatus` enums
- `user.prisma`, `client.prisma`, `volunteer.prisma`, `ride.prisma`,
  `notification.prisma`, `auth.prisma`

### Reminders — `server/cron/reminders.ts`

A nuxt-cron handler that runs every five minutes (and once on init) and calls
`processReminders()` in `server/utils/scheduler.ts` to send due ride reminders.

---

## Roles model

The `Role` enum (`prisma/schema/enum.prisma`) has exactly three values:

- **ADMIN** — full management: create/edit/delete rides, clients, volunteers,
  and other admins; edit notification templates; view metrics. Admin-only
  endpoints are guarded by `requireAdmin()` in `server/utils/authz.ts`.
- **VOLUNTEER** — the drivers. They browse rides, sign up (`.../signup`) and
  un-sign up (`.../unsignup`), mark rides completed, and manage their own
  notification and reminder preferences (`.../volunteers/bySession/...`). A
  volunteer also has a `status` (defaults to `"AVAILABLE"`).
- **CLIENT** — the riders. Clients are managed by admins and are attached to
  the rides scheduled for them. `CLIENT` is the default role for a new `User`.

---

## Deployment

CI is a single workflow, `.github/workflows/main.yml`
("Build and Publish Docker Image"):

- **Trigger:** every push to `main`.
- **What it does:** authenticates to AWS via OIDC
  (`aws-actions/configure-aws-credentials`), logs in to Amazon ECR, then builds
  a `linux/arm64` Docker image and pushes it to the `wcoa` ECR repository,
  tagged both with the commit SHA and `prod`.

**Consequence:** merging (or pushing) to `main` builds and publishes the
production image. Do all work on PR branches and merge deliberately.

---

## Domain glossary

### Ride statuses

`RideStatus` (`prisma/schema/enum.prisma`) has three values, and a ride moves
through them in order:

```
CREATED  →  ASSIGNED  →  COMPLETED
```

- **CREATED** — an admin has scheduled the ride; no volunteer yet (default).
- **ASSIGNED** — a volunteer has signed up to drive it.
- **COMPLETED** — the ride has been carried out.

There is no "cancelled" ride status.

### Notifications & reminders

Notifications are driven by editable **`NotificationTemplate`** records (one per
event, keyed by `name`). The live event templates seeded by `prisma/seed.ts`:

- `RIDE_CREATED` — a new ride is available.
- `RIDE_ASSIGNED` — a volunteer signed up for a ride.
- `RIDE_REMINDER` — an upcoming-ride reminder (sent by the cron job).
- `RIDE_COMPLETED` — a ride was marked completed.

Each template has a `subject`, a `body`, and an `enabled` flag. Bodies use
`{{placeholder}}` tokens (e.g. `{{name}}`, `{{date}}`, `{{time}}`, `{{pickup}}`,
`{{dropoff}}`, `{{client}}`, `{{link}}`) which `server/utils/notification.ts`
substitutes at send time. Admins edit templates at
`app/pages/admin/notifications.vue`.

Sending respects two layers of opt-out: the template's `enabled` flag, and each
volunteer's per-type preference stored in `Volunteer.notificationSettings`
(default is "on").

**Reminders** are separate from one-off notifications: each volunteer can
configure `Reminder` rows (`minutesBefore` a ride). The cron job
(`server/cron/reminders.ts` → `processReminders()`) runs every five minutes and
sends the `RIDE_REMINDER` notification for rides now within a volunteer's
configured window. A `SentReminder` row (unique per `rideId` + `type`) records
what has already been sent so reminders aren't duplicated.

---

## Design notes

Original hand-written notes live in `notes/`:

- [`notes/db.md`](notes/db.md) — early data-model sketch (users, roles, rides).
- [`notes/notifs.md`](notes/notifs.md) — which events trigger which emails, and to whom.
