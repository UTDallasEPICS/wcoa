---
name: fix-issue
description: Fix one GitHub issue end-to-end with a full verification loop — read the issue and its verification comments, write a failing regression test, implement the minimal fix, get the suite green, run a live check and code review, then open a PR that closes the issue. Usage — /fix-issue <issue-number>.
---

Fix exactly one GitHub issue with verifiable evidence. The issue number is given as the argument; if missing, run `gh issue list --milestone "1 — Security Hardening" --state open` (then milestone 2, 3, 4) and propose the highest-priority unblocked issue, but wait for confirmation before starting.

## Steps

1. **Understand the issue.** `gh issue view <n> --comments`. Issues #1–#28 have dated verification comments with exact file/line findings and corrections — they override the issue body where they disagree. Note related issues referenced there; if your fix will fully resolve a sibling issue, plan to declare `Fixes #sibling` in the PR rather than widening the diff.

2. **Branch.** From up-to-date `origin/main`: `git checkout -b fix/<n>-<short-slug>`. Never work on or push to `main` — pushing `main` triggers the production deploy workflow.

3. **Reproduce with a failing test.** Add a regression test in `tests/e2e/` (copy the `setup()` preamble from `smoke.test.ts`; use `loginAs()` from `tests/utils/auth.ts` for authenticated calls — accounts are listed in CLAUDE.md). Run `pnpm test` and confirm the new test **fails for the reason the issue describes** before touching the fix. If it doesn't fail, either the issue is stale (stop, report, suggest closing) or the test is wrong (fix the test).
   - Frontend-only issues that an API test can't capture: verify by driving the real UI (dev server + browser tools) and record before/after evidence instead; still add an API-level test if any part of the fix is server-side.
   - Race-condition issues: fire genuinely concurrent requests (`Promise.all` of raw `fetch`es) and assert the invariant.

4. **Implement the minimal fix.** Match existing code style. Schema changes go in `prisma/schema/*.prisma` and are applied to the test DB automatically by the harness (`db push`); note in the PR that a production migration is needed (see issue #33). Don't fix unrelated bugs you notice — comment on their issue or file a new one.

5. **Verify.**
   - `pnpm test` — entire suite green, including your new test.
   - If the change affects runtime behavior a test can't fully cover (emails, cron, UI), run `pnpm dev` and exercise it for real; capture the evidence (response bodies, screenshots).
   - `pnpm build` must succeed if you touched anything the build could reject.

6. **Review.** Run `/code-review` on the diff and address findings before opening the PR.

7. **PR.** Push the branch, then `gh pr create` with:
   - Title: `Fix #<n>: <issue title>`
   - Body: what was broken (one paragraph), what changed, **Verification** section listing the regression test name(s) + any live-check evidence, and `Fixes #<n>` (plus `Fixes #<sibling>` only if fully resolved).
8. **Report.** Tell the user: root cause, the fix in one sentence, verification evidence, PR link, and any follow-ups filed.

## Constraints

- **Never merge the PR.** Merging `main` deploys to production; the merge decision belongs to the user or the `/issue-loop` orchestrator's gate.
- One issue per invocation. Resist scope creep — the backlog is interlocking and reviewability matters more than batching.
- Never read or quote `prod.sql` or `deploy.tar.gz` (real client PII, issue #29).
- Never commit `.env`, database files, or dumps.
- If the fix requires a decision the issue doesn't settle (e.g. cascade vs. block on #23), present the options and your recommendation in the PR body — pick one, don't stall.
