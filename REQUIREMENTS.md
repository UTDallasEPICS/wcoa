# WCOA — Requirements Catalog & Traceability Matrix

Every behavior the codebase is expected to have, extracted from the code, issues, and PR history
(2026-07-14 exhaustive audit of main @ 0b8a6d7). Each requirement has a stable ID (`R-###`).
**The traceability gate (`pnpm trace`) fails CI when a requirement has no coverage**, so this file
is not documentation that can rot — it is enforced.

## How to read the Status column

| Status | Meaning |
|---|---|
| `auto` | Covered by an automated test (file listed in Coverage) |
| `pin` | Behavior is currently **broken** — a `test.fails` pin asserts the *correct* behavior and flips loudly when fixed (issue linked) |
| `decision` | Current behavior is pinned but the requirement itself needs an owner decision (issue linked) |
| `manual` | Verified by hand in the 2026-07-14 audit; not automatable in this harness (reason given) |

## How to keep this regression-proof (the contract)

1. **New feature → new `R-###` row + a test whose title contains the ID** (e.g. `it('R-131: loser of a signup race gets 409', ...)`), or list the covering file in the Coverage column.
2. **Bug fix → flip the pin**: remove `.fails` from the pinned test in `tests/e2e/known-bugs.test.ts` and move it next to its feature.
3. `pnpm trace` cross-references this file against test titles/files and fails on any uncovered row.

---

## 1. Authentication (better-auth, email OTP)

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-001 | Login is email-OTP only; no password auth surface exists | `server/utils/auth.ts` | auto | `auth-middleware.test.ts` |
| R-002 | OTP can only be requested for a **known, non-deleted** user email (#20, #27) | `server/utils/auth.ts` | auto | `auth-middleware.test.ts`, `soft-deletes.test.ts` |
| R-003 | An OTP-send SMTP failure is surfaced to the caller (500 `FAILED_TO_SEND…`), not swallowed; the OTP row is stored **before** the send so a retry can succeed (#25) | `server/utils/auth.ts`, `email.ts` | auto | `otp-send-failure.test.ts` |
| R-004 | Sign-in with a wrong/expired OTP is rejected (400) with a user-visible error toast | better-auth, `app/pages/auth.vue` | auto | `requirements-flows.test.ts` (API), browser: `auth.spec.ts` |
| R-005 | Successful OTP sign-in issues a session cookie; prod builds enforce `BETTER_AUTH_SECRET` ≥ 32 chars | better-auth | auto | `smoke.test.ts` |
| R-006 | Logout destroys the session (subsequent API calls 401) | `app/app.vue` user menu | auto | browser: `auth.spec.ts` |
| R-007 | A soft-deleted user's live session is revoked at delete time; a stale cookie gets 401 (#27) | all 3 delete endpoints | auto | `soft-deletes.test.ts` |
| R-008 | Auth endpoints only trust configured origins (#21) | `server/utils/auth.ts` | auto | `trusted-origins.test.ts` |
| R-009 | Per-IP rate limiting is active on auth endpoints in production builds | better-auth default | manual | exercised implicitly by `tests/utils/auth.ts` X-Forwarded-For workaround |
| R-010 | OTP expiry and attempt limits follow better-auth defaults | better-auth | manual | library behavior; not re-tested |

## 2. Authorization (global middleware + per-route guards)

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-020 | Every `/api/**` route except `/api/auth/**` requires an authenticated session (401) | `server/middleware/auth.ts` | auto | `requirements-authz-matrix.test.ts` |
| R-021 | CLIENT-role users have **no** internal API access (403 on every route) | `server/middleware/auth.ts` | auto | `requirements-authz-matrix.test.ts` |
| R-022 | VOLUNTEER writes are limited to signup, unsignup, and `put/volunteers/bySession/**`; all other writes 403 | `server/middleware/auth.ts` | auto | `requirements-authz-matrix.test.ts` |
| R-023 | ADMIN passes the middleware for every route | `server/middleware/auth.ts` | auto | `requirements-authz-matrix.test.ts` |
| R-024 | Bulk-PII listings are admin-only: clients(+options), volunteers(+options), users(×3), admins, addresses, metrics(×3), audit, templates (#3, #41) | `requireAdmin` in each handler | auto | `requirements-authz-matrix.test.ts`, `pii-scoping.test.ts` |
| R-025 | Record-level scoping on `get/rides/byId`: non-admin sees only CREATED rides or rides assigned to them; others 404 (not 403 — no existence leak) (#41) | `get/rides/byId/[id].ts` | auto | `record-scoping.test.ts` |
| R-026 | `get/rides` list scoping: volunteer receives only CREATED + own rides; fails closed if userId missing (#3) | `get/rides/index.ts` | auto | `pii-scoping.test.ts` |
| R-027 | `get/rides/estimate/[id]` applies the same record-level scoping as byId | `estimate/[id].ts` | auto | `known-bugs.test.ts` |
| R-028 | Frontend route guard: non-admin is redirected away from admin pages (`/`, `/people`, `/admin/**` → `/rides`); unauthenticated → `/auth` (#4) | `app/middleware/auth.global.ts` | auto | `route-guard.test.ts`, browser: `volunteer-flows.spec.ts` |
| R-029 | `/api/_test/**` seams return 404 unless `TEST_HOOKS=1` (strict prod no-op) | `server/utils/testHooks.ts` | auto | `fault-injection-seam.test.ts` + manual prod-mode boot (audit) |
| R-030 | Volunteer self-service lookups never trust a session alone — archived volunteer profiles are re-checked (`deletedAt: null`) on signup/unsignup/bySession (#27) | those 5 handlers | auto | `soft-deletes.test.ts` |

## 3. People — Clients

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-040 | Client create requires name + full address (400 otherwise); email is optional (nullable) | `post/clients/index.ts` | auto | `requirements-flows.test.ts` |
| R-041 | Client create with an existing email reuses that user (upsert); never downgrades an ADMIN/VOLUNTEER role | `post/clients/index.ts` | auto | `requirements-flows.test.ts` |
| R-042 | Creating a second client profile for the same user → 400 "already a client" | `post/clients/index.ts` | auto | `requirements-flows.test.ts` |
| R-043 | Blank/whitespace phone is stored as NULL so multiple blank-phone records don't trip the unique constraint (#15, #53) | `server/utils/sanitize.ts` | auto | `empty-phone.test.ts`, `admin-empty-phone.test.ts` |
| R-044 | Client home address is deduped onto the `matchKey` unique (case/whitespace variants collapse; display casing preserved, state uppercased) (#16, #57) | `server/utils/address.ts` | auto | `address-normalization.test.ts`, `address-matchkey-display.test.ts` |
| R-045 | A partial update (`{name}` only) must NOT wipe email/phone — omitted fields are no-ops | `put/clients/[id].ts` et al | auto | `known-bugs.test.ts` |
| R-046 | Update/delete of an unknown or archived client → 404 | `put/clients/[id].ts` | auto | `requirements-flows.test.ts` |
| R-047 | Setting a client's email to another user's email → clean 4xx conflict, not 500 | `put/clients/[id].ts` | auto | `known-bugs.test.ts` |
| R-048 | People creates on an email that belongs to a different active profile type are rejected (no dual profiles, no silent role upgrades) | `post/clients`, `post/volunteers` | pin [#92](https://github.com/UTDallasEPICS/wcoa/issues/92) | `known-bugs.test.ts` |
| R-049 | Deleting a client with active (non-deleted) rides is blocked with 409 (#23) | `delete/clients/[id].ts` | auto | `safe-delete.test.ts` |
| R-050 | Client soft-delete archives user+client, releases email/phone to `deletedEmail/deletedPhone` (reusable), revokes sessions, hides from lists, preserves metrics history (#27) | `delete/clients/[id].ts` | auto | `soft-deletes.test.ts` |

## 4. People — Volunteers

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-060 | Volunteer create requires name + email (400 otherwise) | `post/volunteers/index.ts` | auto | `requirements-flows.test.ts` |
| R-061 | Duplicate volunteer profile → 400 "already a volunteer" | `post/volunteers/index.ts` | auto | `requirements-flows.test.ts` |
| R-062 | Welcome email on volunteer create is fire-and-forget (a send failure never fails the request) | `post/volunteers/index.ts` | auto | `requirements-flows.test.ts` |
| R-063 | `status` on volunteer create/update is validated against the VolunteerStatus enum (400 on bogus values) — admin endpoints, matching the already-validated bySession endpoint | `post/volunteers`, `put/volunteers/[id]` | auto | `known-bugs.test.ts` |
| R-064 | Volunteer soft-delete: ASSIGNED rides return to the pool (`CREATED`, volunteerId NULL), user archived, email/phone released, sessions revoked, hidden from lists (#7, #23, #27) | `delete/volunteers/[id].ts` | auto | `safe-delete.test.ts`, `soft-deletes.test.ts` |
| R-065 | `put/volunteers/bySession/status` accepts only valid enum values (400 otherwise) and updates only the session volunteer | bySession/status.ts | auto | `requirements-flows.test.ts` |
| R-066 | `put/volunteers/bySession/reminders` replaces the reminder set atomically; zod-validated (`minutesBefore` positive int) | bySession/reminders.ts | auto | `requirements-flows.test.ts` |
| R-067 | `put/volunteers/bySession/notifications` merges per-type opt-outs into `notificationSettings` | bySession/notifications.ts | auto | `requirements-flows.test.ts` |
| R-068 | Update of unknown/archived volunteer → 404 | `put/volunteers/[id].ts` | auto | `requirements-flows.test.ts` |

## 5. People — Admins

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-080 | Admin create requires name+email; promoting an existing user writes a `USER_ROLE_CHANGED` audit row (#28) | `post/admins/index.ts` | auto | `audit-log.test.ts`, `requirements-flows.test.ts` |
| R-081 | Admin update of an unknown id → 404, not 500 | `put/admins/[id].ts` | auto | `known-bugs.test.ts` |
| R-082 | `delete/admins` only archives users whose role is ADMIN (404 otherwise) | `delete/admins/[id].ts` | auto | `known-bugs.test.ts` |
| R-083 | An admin cannot delete their own account, and the last remaining admin cannot be deleted (lockout guard) | `delete/admins/[id].ts` | auto | `known-bugs.test.ts` |
| R-084 | Admin soft-delete releases email/phone, revokes sessions; double-delete 404s | `delete/admins/[id].ts` | auto | `admin-delete.test.ts`, `soft-deletes.test.ts` |

## 6. Rides — CRUD & lifecycle

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-100 | Ride create requires clientId, pickup, dropoff, scheduledTime (400) | `post/rides/index.ts` | auto | `requirements-flows.test.ts` |
| R-101 | Ride create resolves both addresses through the matchKey upsert (no duplicate Address rows) | `post/rides/index.ts` | auto | `address-normalization.test.ts` |
| R-102 | Ride create with volunteerId starts ASSIGNED; without starts CREATED | `post/rides/index.ts` | auto | `requirements-flows.test.ts` |
| R-103 | The RIDE_CREATED broadcast is fire-and-forget: a slow/failing broadcast neither delays nor fails ride creation (#32) | `post/rides/index.ts` | auto | `ride-broadcast-nonblocking.test.ts` |
| R-104 | Ride create validates input shape (bad clientId / non-object addresses / invalid date → 400, never 500) | `post/rides/index.ts` | auto | `known-bugs.test.ts` |
| R-105 | Ride update accepts ONLY whitelisted fields; unknown keys 400 via `.strict()` (mass-assignment guard, #31) | `put/rides/[id].ts` | auto | `ride-input-validation.test.ts` |
| R-106 | Unassigning a volunteer (volunteerId → null/"") auto-resets status to CREATED — but only when the ride was ASSIGNED and no explicit status was sent (#7) | `put/rides/[id].ts` | auto | `unassign-status.test.ts` |
| R-107 | Completing a ride requires totalRideTime ≥ 0.1 (on the request or already stored) (#10) | `put/rides/[id].ts` | auto | `complete-requires-ridetime.test.ts` |
| R-108 | Ride status transitions are guarded server-side (no COMPLETED→CREATED un-complete with stale totalRideTime) | `put/rides/[id].ts` | pin [#95](https://github.com/UTDallasEPICS/wcoa/issues/95) | `known-bugs.test.ts` |
| R-109 | Cancelling notifies the previously-assigned volunteer via the RIDE_CANCELLED template (#5) | `put/rides/[id].ts` | auto | `ride-cancel.test.ts` |
| R-110 | Completing notifies the volunteer (RIDE_COMPLETED) and emails admins | `put/rides/[id].ts` | auto | `requirements-flows.test.ts` |
| R-111 | Update/complete/signup against an archived ride → 404 (#27) | `put/rides`, signup | auto | `soft-deletes.test.ts` |
| R-112 | Changing pickup/dropoff display invalidates the cached Maps estimate (#14) | `put/rides/[id].ts` | auto | `estimate-cache.test.ts` |
| R-113 | Ride delete is a soft-delete: hidden from lists/byId/estimate, row + history preserved (#27) | `delete/rides/[id].ts` | auto | `soft-deletes.test.ts` |
| R-114 | `get/rides/byId` of a missing/archived ride → 404 for every role (currently 204 null for admins) | `get/rides/byId/[id].ts` | pin [#94](https://github.com/UTDallasEPICS/wcoa/issues/94) | `known-bugs.test.ts` |
| R-115 | Estimate endpoint: serves cache when `estimatedAt` set; on miss with no server key returns a clean "not configured" payload (never the public embed key — #30) | `estimate/[id].ts` | auto | `estimate-cache.test.ts`, `maps-key-split.test.ts` |

## 7. Rides — volunteer self-service (signup / unsignup / complete)

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-130 | Signup requires an active (non-deleted) volunteer profile with status AVAILABLE (403 / 400) | `signup.ts` | auto | `requirements-flows.test.ts` |
| R-131 | Signup is atomic: the status precondition lives in the UPDATE's WHERE; a concurrent loser gets 409/400, never a silent overwrite (#12) | `signup.ts` | auto | `signup-race.test.ts` |
| R-132 | Signup is only possible on a CREATED, non-archived ride (400/404) | `signup.ts` | auto | `requirements-flows.test.ts` |
| R-133 | Unsignup allowed only for the assigned volunteer (403) and only from ASSIGNED (400); atomic like signup | `unsignup.ts` | auto | `requirements-flows.test.ts` |
| R-134 | Signup/unsignup notify the volunteer and admins; failures never fail the request | `signup.ts`, `unsignup.ts` | auto | `requirements-flows.test.ts` |
| R-135 | **A volunteer can complete their OWN assigned ride** (with totalRideTime) through the UI's "Mark as Completed" flow | middleware + `post/rides/[id]/complete` | auto | `known-bugs.test.ts`, browser: `volunteer-flows.spec.ts` |

## 8. List endpoints — pagination, filtering, search

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-150 | List endpoints (rides, clients, volunteers, admins) return `{items, total, page, pageSize}`; default 20, hard cap 100; page/pageSize clamp on all garbage input (#13) | `server/utils/pagination.ts` | auto | `pagination.test.ts` |
| R-151 | Page slice + total come from one `$transaction` (consistent snapshot); sort has an `{id:'asc'}` tiebreaker so page walks never drop/duplicate rows | list handlers | auto | `pagination.test.ts` |
| R-152 | Rides list: include/exclude status filter chips compose server-side; bogus status values are ignored (whitelist incl. CANCELLED) | `get/rides/index.ts` | auto | `ride-filters.test.ts` |
| R-153 | Rides list: date range filter, end date inclusive of the whole day | `get/rides/index.ts` | auto | `ride-filters.test.ts` |
| R-154 | Rides list: free-text search across id, displays, client name, volunteer name | `get/rides/index.ts` | auto | `ride-filters.test.ts` |
| R-155 | `get/users` is bounded/paginated like every other list | `get/users/index.ts` | pin [#97](https://github.com/UTDallasEPICS/wcoa/issues/97) | `known-bugs.test.ts` |
| R-156 | `get/audit` is capped (≤100) with action/userId filters | `get/audit/index.ts` | auto | `audit-log.test.ts` |
| R-157 | `get/addresses` is bounded and returns `{id, label, address}` for the typeahead; `/options` endpoints are bounded dropdown feeds | `get/addresses`, `*/options` | auto | `address-search.test.ts`, `pagination.test.ts` |
| R-158 | `users/byEmail` & `users/byId` of an unknown user → 404, not 204 null | `get/users/*` | pin [#94](https://github.com/UTDallasEPICS/wcoa/issues/94) | `known-bugs.test.ts` |

## 9. Metrics

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-170 | All three metrics are admin-only (#41) | metrics handlers | auto | `requirements-authz-matrix.test.ts` |
| R-171 | completionRate = completed/total ×100 rounded, with optional date range; returns zeros for an empty range | completionRate | auto | `metrics-date-range.test.ts`, `requirements-flows.test.ts` |
| R-172 | Metrics deliberately INCLUDE soft-deleted rows (history preservation is the point of soft-delete, #27) | all metrics | auto | `soft-deletes.test.ts` |
| R-173 | Whether CANCELLED rides belong in the completionRate denominator | completionRate | decision [#96](https://github.com/UTDallasEPICS/wcoa/issues/96) | `known-bugs.test.ts` (pins current include-CANCELLED behavior) |
| R-174 | hours = sum of totalRideTime over COMPLETED rides in range | hours | auto | `requirements-flows.test.ts` |
| R-175 | topRiders: top 5 clients by completed rides, default year-to-date, batched lookup (no N+1, #24) | topRiders | auto | `topRiders-n1.test.ts` |
| R-176 | Date ranges: endDate inclusive of the entire end day (#18) | `server/utils/dateRange.ts` | auto | `metrics-date-range.test.ts` |

## 10. Notifications & templates

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-190 | Five templates exist (CREATED/ASSIGNED/REMINDER/CANCELLED/COMPLETED); GET is admin-only; PUT updates subject/body/enabled; unknown name → 400 | templates handlers | auto | `requirements-flows.test.ts` |
| R-191 | A disabled template (or missing template) suppresses that notification type globally | `notification.ts` | auto | `requirements-flows.test.ts` |
| R-192 | Per-volunteer opt-out: `notificationSettings[type] === false` suppresses; default (unset) is opt-in | `notification.ts` | auto | `requirements-flows.test.ts` |
| R-193 | `{{placeholder}}` context substitution in subject and body | `notification.ts` | auto | `notification-datetime.test.ts` |
| R-194 | Broadcasts go only to AVAILABLE, non-deleted volunteers; sends run parallel via allSettled (one failure never aborts the rest) | `broadcastNotification` | auto | `ride-broadcast-nonblocking.test.ts` |
| R-195 | `sendEmail` returns boolean and never throws; under TEST_HOOKS it's a strict no-op seam; in prod it always really sends (#25) | `server/utils/email.ts` | auto | `otp-send-failure.test.ts` + code inspection |
| R-196 | Notification dates render as real calendar dates/times, not bare weekdays (#9) | `server/utils/datetime.ts` | auto | `notification-datetime.test.ts` |

## 11. Reminder cron

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-210 | Cron runs every 5 minutes + on boot; errors are caught and logged, never crash the process | `server/cron/reminders.ts` | auto | `fault-injection-seam.test.ts` |
| R-211 | Scan covers only ASSIGNED, future, non-deleted rides with a non-deleted volunteer | `scheduler.ts` | auto | `reminder-claim-before-send.test.ts` |
| R-212 | At-most-once delivery: SentReminder row is claimed BEFORE the send under `@@unique([rideId, type])`; a crash after claim never re-sends; a concurrent claim (P2002) skips cleanly (#17) | `scheduler.ts` | auto | `reminder-claim-before-send.test.ts` |
| R-213 | A reminder respects the volunteer's RIDE_REMINDER opt-out | `scheduler.ts` → `sendNotification` | auto | `requirements-flows.test.ts` |
| R-214 | Reminder timing honors each volunteer's configured `minutesBefore` thresholds | `scheduler.ts` | auto | `reminder-claim-before-send.test.ts` |

## 12. Audit log

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-230 | Every mutating route writes an audit row: RIDE_CREATED, VOLUNTEER_SIGNED_UP/UNSIGNED_UP, RIDE_<status> on pure status change, RIDE_ASSIGNED/RIDE_UNASSIGNED on volunteer change (distinct from creation — #28 review fix), 4× *_DELETED, USER_ROLE_CHANGED | `server/utils/audit.ts` + 8 routes | auto | `audit-log.test.ts` |
| R-231 | Audit writes are non-blocking (try/caught) — an audit failure never fails the mutation | `server/utils/audit.ts` | auto | `audit-log.test.ts` |
| R-232 | Audit `details` carry only from/to + ids, never full records / PII | route call sites | auto | `audit-log.test.ts` |

## 13. Database

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-270 | The committed migration chain applies linearly to a fresh DB and produces a schema semantically identical to `db push` (#33) | `prisma/migrations/` | manual | verified in 2026-07-14 audit (normalized column/index/FK diff); re-verify on schema changes |
| R-271 | `foreign_key_check` and `integrity_check` stay clean under heavy mutation | schema FKs | manual | verified in audit after full CRUD battery |
| R-272 | Unique constraints: `address.matchKey`, `user.email`, `user.phone`, `sentReminder(rideId,type)` enforced | schema | auto | `address-matchkey-display.test.ts`, `empty-phone.test.ts`, `reminder-claim-before-send.test.ts` |
| R-273 | Seed produces the documented accounts/rides and is the substrate of every test (times relative to seed moment — never assert exact timestamps) | `prisma/seed.ts` | auto | `smoke.test.ts` |

## 14. Frontend (pages, flows, UI behavior)

| ID | Requirement | Source | Status | Coverage |
|---|---|---|---|---|
| R-290 | `/auth`: two-step OTP form (email → 6-digit pin); error toasts on failed send/sign-in; Back returns to email step | `app/pages/auth.vue` | auto | browser: `auth.spec.ts` |
| R-291 | Nav is role-dependent: admin sees Dashboard/Rides/People/Notifications/Audit; volunteer sees Rides only (+ Settings/Logout in the user menu) | `app/app.vue` | auto | browser: `volunteer-flows.spec.ts`, `admin-flows.spec.ts` |
| R-292 | Dashboard renders the three metric cards with per-card date-range pickers | `app/pages/index.vue` | auto | browser: `admin-flows.spec.ts` |
| R-293 | Rides list: server-driven search/sort/status-filters/date-range/pagination; default view excludes COMPLETED+CANCELLED | `app/pages/rides/index.vue` | auto | browser: `admin-flows.spec.ts` + `ride-filters.test.ts` |
| R-294 | Create Ride modal: client dropdown fed by the bounded `/options` endpoint; selecting a client auto-fills pickup with their home address; address typeahead searches existing addresses (#19) | rides/index.vue | auto | browser: `admin-flows.spec.ts` |
| R-295 | Modal state fully resets when closed/reopened (#11) | rides/index.vue | auto | `ride-form-reset.test.ts` |
| R-296 | Ride detail: status badge, Edit/Cancel/Delete (admin); Cancel goes through a confirm modal, shows a toast, hides the button once CANCELLED | `app/pages/rides/[id].vue` | auto | browser: `admin-flows.spec.ts` |
| R-297 | Ride detail "Navigate" is a Google-Maps deep link (`maps/dir/?api=1`) with URL-encoded origin/destination (#26) | `app/utils/mapsLink.ts` | auto | `ride-navigate-link.test.ts` |
| R-298 | Map embed uses ONLY the public embed key; with no key it degrades to a friendly placeholder, never an error page (#30) | rides/[id].vue | auto | `maps-key-split.test.ts` + browser: `admin-flows.spec.ts` |
| R-299 | Volunteer ride detail: Sign Up on CREATED rides; Unsign Up + Mark-as-Completed (duration modal) on own ASSIGNED rides | rides/[id].vue | auto | browser: `volunteer-flows.spec.ts` (completion pinned by [#87](https://github.com/UTDallasEPICS/wcoa/issues/87)) |
| R-300 | People page: Volunteers/Clients/Admins tabs, search, role filter; edit modal prefills ALL fields and sends a full payload with phone normalized to digits | `app/pages/people.vue` | auto | browser: `admin-flows.spec.ts` |
| R-301 | Settings (volunteer): profile card, status selector, per-type notification toggles, reminder editor — all persisted via bySession endpoints | `app/pages/settings.vue` | auto | browser: `volunteer-flows.spec.ts` |
| R-302 | Admin notification page: 5 template cards with Edit/Disable reflecting `enabled` | `app/pages/admin/notifications.vue` | auto | browser: `admin-flows.spec.ts` |
| R-303 | Admin audit page: bounded table, action/user filters | `app/pages/admin/audit.vue` | auto | browser: `admin-flows.spec.ts` |
| R-304 | Pages hydrate without mismatches (SSR output == client render) | layout | manual [#98](https://github.com/UTDallasEPICS/wcoa/issues/98) | browser: `admin-flows.spec.ts` non-gating diagnostic (mismatch reproduces intermittently; observed in audit) |
| R-305 | Success/error toasts on every mutating UI action | all pages | auto | browser specs (asserted on key flows) |

## Known non-requirements / accepted behavior

- Clients (role CLIENT) can obtain a session but reach nothing — the app is admin/volunteer-facing by design.
- Admins have no volunteer profile, so signup/unsignup 403/404 for them — assignment happens via `put/rides`.
- Seeded COMPLETED rides carry no `totalRideTime` → fresh installs show 0 hours (seed-quality nit, not filed).
