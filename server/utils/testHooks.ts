import type { H3Event } from 'h3'

// Test-only seams (issue #45). All are complete no-ops in production: they do
// nothing unless the server was started with `TEST_HOOKS=1` (only
// tests/global-setup.ts sets this) AND the request opts in via a header.

// Fault-injection: widen a handler's read→write window so concurrency bugs
// (e.g. the signup TOCTOU #12) are reproducible through HTTP. The synchronous
// better-sqlite3 adapter otherwise runs read and write too close together for a
// competing request to interleave, so a race test would pass even on buggy code.
// Enabled per-request via `x-test-race-delay: <label>:<ms>`.
export async function raceDelay(event: H3Event, label: string): Promise<void> {
  if (process.env.TEST_HOOKS !== '1') return
  const header = getHeader(event, 'x-test-race-delay')
  if (!header) return
  const [target, ms] = header.split(':')
  if (target !== label) return
  await new Promise((resolve) => setTimeout(resolve, Number(ms) || 0))
}
