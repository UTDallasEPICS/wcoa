---
name: issue-loop
description: Orchestrate the fix-issue loop across the GitHub backlog with independent verification and gated auto-merge. For each issue — an author agent produces a fix PR in an isolated worktree, an independent reviewer agent re-runs the suite and revert-checks the regression test, and the PR auto-merges only if every confidence gate passes; otherwise it is labeled needs-human-review and the loop moves on. Usage — /issue-loop [count | issue numbers…], default 3 issues per run.
---

Work through open issues sequentially: fix → independently verify → auto-merge or flag. Default to 3 issues per invocation (bounded autonomy); an explicit count or list of issue numbers overrides. For continuous operation the user can run `/loop /issue-loop`.

> **Merging to `main` deploys to production.** The CI workflow builds and pushes the prod Docker image on every push to `main`. That is why the gate below is strict, why merges are strictly sequential, and why the deploy run must be watched to completion after every merge.

## Per-issue cycle

### 1. Pick
Refresh `main` (`git fetch && git status`). Select the next issue: milestone order (1 Security → 2 Data Integrity → 3 Performance → 4 Features), then priority `P0`→`P3`, then oldest. Skip issues that:
- are labeled `needs-human-review`, or
- already have an open PR referencing them (`gh pr list --state open --json body,title` and scan for `#<n>`), or
- require actions outside the repository — secret rotation, git history rewrite, GitHub support tickets, partner-org decisions (e.g. #29's history purge). Label those `needs-human-review` with a comment saying exactly which human action is needed, and move on.

### 2. Author
Spawn an author subagent in an **isolated worktree** whose instructions are the `fix-issue` skill steps (`.claude/skills/fix-issue/SKILL.md`) for this issue number, with one addition: it must stop after opening the PR — it never merges. Require it to report back: PR number, regression test file/names, whether it confirmed the test failing pre-fix, and any live-check evidence.

### 3. Verify independently
Spawn a **fresh reviewer subagent** (separate worktree, no author context) that must:
1. `gh pr checkout <pr>` and run `pnpm test` itself — the author's claim of green is not evidence.
2. **Revert-check**: restore the non-test files to `origin/main` (`git checkout origin/main -- <changed src files>`), run the new regression test, and confirm it **fails**; then restore the fix and confirm it passes. This proves the test actually pins the bug.
3. **Scope check**: `gh pr diff` — changed files must be the issue's referenced files plus tests and obviously-necessary neighbors; report net non-test line count.
4. **Risk-file check**: flag any change to `.github/`, `dockerfile`, `prisma/schema/`, `nuxt.config.ts`, `package.json` dependencies, or auth configuration.
5. Adversarially review the diff for correctness/security regressions (does the fix break an adjacent endpoint? weaken a check? change behavior the frontend depends on?).
6. Return a structured verdict: suite result, revert-check result, scope, risk flags, findings, and a recommend/flag conclusion with reasons.

Additionally run `/review <pr>` from the orchestrating session and treat its confirmed findings as reviewer findings.

### 4. Gate — auto-merge requires ALL of:
- Reviewer-run full suite is green.
- Revert-check passed (regression test fails without the fix, passes with it).
- No risk-file changes (schema/db migrations, CI, docker, dependencies, auth config ⇒ always human review).
- Zero unresolved correctness or security findings from the reviewer and `/review`.
- Net non-test diff ≤ 200 lines and scoped to the issue.
- The issue itself is not `P0: critical` security (P0 fixes get everything above **plus** a human look before deploy — flag them even when green, with a note that they passed all gates).

### 5a. Merge path (all gates pass)
- `gh pr merge <pr> --squash --delete-branch`.
- Comment on the PR with the evidence summary (reviewer suite result, revert-check, scope) so the audit trail lives with the merge.
- **Watch the deploy**: `gh run list --workflow main.yml` for the run triggered by the merge, then `gh run watch` it. If the deploy fails: stop the loop immediately, do not attempt fixes on `main`, and flag the user with the run URL — this is the highest-priority flag the loop can raise.

### 5b. Flag path (any gate fails)
- Add the `needs-human-review` label to the PR (create the label if missing) and leave the PR open.
- Comment on the PR listing **exactly which gates failed and why**, with the reviewer's evidence — the user should be able to decide from the comment alone.
- Continue to the next issue. Note in the comment that later merges may require this branch to be rebased.

### 6. Loop hygiene
- Strictly sequential — never run two author agents at once; every cycle starts from fresh `main` so fixes stack correctly.
- Stop the whole run early if: a deploy fails, the suite is red on fresh `main`, or **two consecutive issues get flagged** (the gate is telling you something — report instead of grinding).

## Final report
End every run with: a list of merged PRs (issue → PR → deploy status), flagged PRs with one-line reasons, issues skipped and why, and what the next invocation would pick up. If anything was flagged and the run is unattended (cron//loop), send a PushNotification summarizing what needs the user's attention.
