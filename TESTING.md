# Testing & Regression Framework

This app has three layers of automated coverage plus an enforced requirements catalog.
The goal is not "every possible input" (impossible) but **every documented requirement is
mapped to a test, and any coverage gap fails CI**.

## Layers

| Layer | Runs | What it covers | Command |
|---|---|---|---|
| **API / e2e** | real built app + throwaway seeded SQLite (`tests/e2e/**`, vitest) | every endpoint, role matrix, lifecycle, validation, cron, metrics | `pnpm test` |
| **Browser** | production build + throwaway seeded SQLite, driven by Playwright/Chromium (`tests/browser/**`) | real user flows: OTP login, ride lifecycle, people mgmt, settings, route guard | `pnpm test:browser` |
| **Traceability gate** | static check of `REQUIREMENTS.md` ⇄ tests | fails if any requirement has no covering test | `pnpm trace` |
| **Everything** | all three in sequence | — | `pnpm test:all` |

## The requirements catalog — [`REQUIREMENTS.md`](./REQUIREMENTS.md)

Every behavior the code is expected to have is a numbered row (`R-###`) with its source file,
a status, and its covering test(s). This is the single source of truth for "what should the app do."

Status values: `auto` (has an automated test), `pin` (currently **broken** — a `test.fails`/`test.fail`
asserts the correct behavior and flips loudly when fixed, issue linked), `decision` (behavior pinned,
needs an owner call), `manual` (verified by hand; not automatable here, reason given).

`pnpm trace` parses the catalog and confirms each `auto`/`pin` row is covered by either a test whose
title contains its `R-ID` or the test file named in its Coverage column. **A dropped test or a new
untagged requirement turns CI red** — that's what keeps the catalog honest instead of rotting.

## Known-bug pins — [`tests/e2e/known-bugs.test.ts`](./tests/e2e/known-bugs.test.ts) + `test.fail` browser specs

The 2026-07-14 audit found 12 open defects (issues #87–#98). Each has a pin that asserts the
**correct** behavior, wrapped so today's wrong behavior is "expected":
- API pins use `it.fails(...)` in `known-bugs.test.ts`.
- UI pins use `test.fail()` in the browser specs (R-135/#87). The R-304/#98 hydration check is now a
  hard assertion (`/rides` hydrates clean) — its server-side determinism is guarded by
  `tests/e2e/hydration-datetime.test.ts`.

**When you fix a bug, its pin starts failing** (because the assertion now passes). That is the signal to:
1. remove the `.fails` / `test.fail()`, and
2. keep the test as the permanent regression guard (move API pins next to their feature suite).

This is how the suite becomes regression-proof for the current bug list: a fix can't land without
turning its pin green, and the pin then blocks the bug from ever coming back.

## How to add coverage for new work (the contract)

1. Add an `R-###` row to `REQUIREMENTS.md` (source + status + coverage).
2. Write a test whose title contains the `R-###` (e.g. `it('R-140: …')`) **or** name the test file in the Coverage column.
3. `pnpm trace` must pass; `pnpm test` (and `pnpm test:browser` for UI) must be green.

## Running locally

```bash
pnpm install
npx prisma generate            # once, or after a schema change
pnpm test                      # API/e2e (vitest) — ~30s
pnpm test:browser              # Playwright (first run builds the app + installs Chromium)
pnpm trace                     # traceability gate
pnpm test:all                  # all three
```

- The browser layer serves a **production build** on :3210 with a fresh seeded `.data/browser-test.db`
  (`scripts/browser-server.mjs`) and reads OTPs straight from that DB (no SMTP needed), the same trick
  as the API harness. `pnpm dev` is avoided because it hits `EMFILE` on macOS with many worktrees.
- Both layers seed times relative to `new Date()` — never assert exact timestamps (see CLAUDE.md).

## What is deliberately NOT automated here

Honesty about the boundary (see `manual` rows in the catalog):
- **Real SMTP / Google Maps.** No credentials in CI, so email delivery/rendering and live Directions
  calls run only through their fallback/seam paths. Verify these once in staging with real keys.
- **Migration-chain application & DB integrity** (R-270, R-271) — verified by hand in the audit
  (normalized schema diff, `foreign_key_check`); re-run on any schema change. Could be scripted later.
- **Load/scale** — boundedness (caps, pagination) is asserted; throughput is not.
- **Adversarial security** (stored-XSS in notes/templates, injection) — not yet a dedicated suite; a
  good next investment.

"Every possible user flow" is infinite and can't be enumerated. "Every requirement we can name is
written down, mapped to a test, and gaps fail the build" is what this framework delivers.
