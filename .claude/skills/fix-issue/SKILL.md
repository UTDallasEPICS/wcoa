---
name: fix-issue
description: Fix one GitHub issue end-to-end with a full verification loop — read the issue and its verification comments, write a failing regression test, implement the minimal fix, get the suite green, run a live check and code review, then open a PR that closes the issue. Usage — /fix-issue <issue-number>.
---

Fix exactly one GitHub issue with verifiable evidence. The issue number is given as the argument; if missing, run `gh issue list --milestone "1 — Security Hardening" --state open` (then milestone 2, 3, 4) and propose the highest-priority unblocked issue, but wait for confirmation before starting.

## Definition of done — you are NOT finished until ALL of these are true

**The deliverable is an open PR on the remote, not a code change in your worktree.** A perfect fix that was never pushed is a failed task. Before you end your turn, confirm every box:

- [ ] The fix and its regression test are **committed** (`git status` is clean — nothing staged/unstaged left behind).
- [ ] The branch is **pushed** to `origin`.
- [ ] A PR exists — you ran `gh pr view <n> --json url,state` and saw `state: OPEN`. Paste that URL in your report.
- [ ] Your final message is the **Report** (see the template at the end) and contains the PR URL. Never end with only a summary of the code or a self-review — if there's no PR URL in your last message, you are not done.

If you cannot complete a box (e.g. tests won't pass, an unavoidable schema change, a blocking decision), **stop and say so explicitly in the report** — name the blocker and the exact state you left behind (branch pushed? commit made?). A clear "blocked because X, branch `fix/...` pushed with the test committed" is a valid ending; silently stopping mid-way is not.

**Commit early.** As soon as the suite is green (step 5), commit — before the review and PR steps. A committed change survives a crash or an API error; an uncommitted one is lost and forces a full restart. If you're resumed after a failure, run `git status` and `git log --oneline origin/main..HEAD` first to see what already exists, and continue from there rather than redoing work.

## Steps

1. **Understand the issue.** `gh issue view <n> --comments`. Issues #1–#28 have dated verification comments with exact file/line findings and corrections — they override the issue body where they disagree. Note related issues referenced there; if your fix will fully resolve a sibling issue, plan to declare `Fixes #sibling` in the PR rather than widening the diff.

2. **Branch.** From up-to-date `origin/main`: `git fetch origin && git checkout -b fix/<n>-<short-slug> origin/main`. Never work on or push to `main` — pushing `main` triggers the production deploy workflow.

3. **Reproduce with a failing test.** Add a regression test in `tests/e2e/` (copy the `setup()` preamble from `smoke.test.ts`; use `loginAs()` from `tests/utils/auth.ts` for authenticated calls — accounts are listed in CLAUDE.md). Run the new test and confirm it **fails for the reason the issue describes** before touching the fix — capture the exact failing assertion; you must quote it in the report. If it doesn't fail, either the issue is stale (stop, report, suggest closing) or the test is wrong (fix the test).
   - Frontend-only issues that an API test can't capture: verify by driving the real UI (dev server + browser tools) and record before/after evidence instead; still add an API-level test if any part of the fix is server-side.
   - Race-condition / concurrency issues: fire genuinely concurrent requests (`Promise.all` of raw `fetch`es) and assert the invariant. **If the test cannot be made to fail pre-fix because of a harness limitation** (e.g. the synchronous better-sqlite3 adapter serializes writes so a TOCTOU window can't open — see #12/#47/#45), do NOT hide it: say so loudly in the report and PR body, explain why, and describe how you otherwise proved the fix (e.g. an inspection argument or a controlled experiment). The reviewer/gate needs to know the revert-check is inconclusive.

4. **Implement the minimal fix.** Match existing code style. Schema changes go in `prisma/schema/*.prisma` and are applied to the test DB automatically by the harness (`db push`); note in the PR that a production migration is needed (see issue #33). Don't fix unrelated bugs you notice — comment on their issue or file a new one.

5. **Verify, then commit immediately.**
   - `pnpm test` — entire suite green, including your new test.
   - If the change affects runtime behavior a test can't fully cover (emails, cron, UI), run `pnpm dev` and exercise it for real; capture the evidence (response bodies, screenshots).
   - `pnpm build` must succeed if you touched anything the build could reject.
   - **Then `git add -A && git commit`** with a message referencing the issue. End the commit body with:
     `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
   - Do not proceed to review/PR with uncommitted work.

6. **Review.** Run `/code-review` on the diff and address findings; commit any follow-up changes.

7. **Open the PR (required terminal step — do not skip or defer).**
   - `git push -u origin fix/<n>-<short-slug>`
   - `gh pr create` with:
     - Title: `Fix #<n>: <issue title>`
     - Body: what was broken (one paragraph), what changed, a **Verification** section listing the regression test name(s), the pre-fix failing assertion, and any live-check evidence (and any revert-check caveat from step 3), plus `Fixes #<n>` (add `Fixes #<sibling>` only if fully resolved).
   - **Self-check:** run `gh pr view <n> --json url,state` and confirm `OPEN`. If `gh pr create` failed, retry; if it keeps failing, report the exact error and the pushed branch name.

8. **Report** (this is your final message — use this exact shape, do not replace it with a code walkthrough or a findings array):
   - **PR:** `<url>` (confirmed OPEN)
   - **Root cause:** one sentence.
   - **Fix:** one sentence.
   - **Test(s):** file + test names; the pre-fix failing assertion you observed (quoted); any revert-check caveat.
   - **Files changed:** non-test files + net line count; any risk files touched (schema/auth/CI/docker/deps) — call these out loudly.
   - **Suite + build:** pass counts.
   - **Follow-ups:** sibling issues filed/declared, or "none".

## Constraints

- **Never merge the PR.** Merging `main` deploys to production; the merge decision belongs to the user or the `/issue-loop` orchestrator's gate.
- One issue per invocation. Resist scope creep — the backlog is interlocking and reviewability matters more than batching.
- Never read or quote `prod.sql` or `deploy.tar.gz` (real client PII, issue #29).
- Never commit `.env`, database files, or dumps.
- If the fix requires a decision the issue doesn't settle (e.g. cascade vs. block on #23), present the options and your recommendation in the PR body — pick one, don't stall.
