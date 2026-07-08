import type { H3Event } from 'h3'

// Test-only fault-injection seam (issue #45).
//
// Concurrency bugs like the signup TOCTOU (#12) can't be reproduced through the
// HTTP layer in the e2e harness: the synchronous better-sqlite3 adapter runs a
// handler's read and write close enough together that a competing request never
// interleaves between them, so a race test would pass even against buggy code.
//
// This seam lets a test deliberately widen that read→write window. It is a
// complete no-op in production: it does nothing unless BOTH the server was
// started with `TEST_RACE_HOOKS=1` (only tests/global-setup.ts sets this) AND
// the request carries a matching `x-test-race-delay: <label>:<ms>` header.
export async function raceDelay(event: H3Event, label: string): Promise<void> {
  if (process.env.TEST_RACE_HOOKS !== '1') return
  const header = getHeader(event, 'x-test-race-delay')
  if (!header) return
  const [target, ms] = header.split(':')
  if (target !== label) return
  await new Promise((resolve) => setTimeout(resolve, Number(ms) || 0))
}
