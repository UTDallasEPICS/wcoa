import type { H3Event } from 'h3'

// Test-only seams (issue #45). All are complete no-ops in production: they do
// nothing unless the server was started with `TEST_HOOKS=1` (only
// tests/global-setup.ts sets this) AND the caller opts in (a request header, or
// an explicitly armed fault). This lets e2e tests pin bugs whose fix changes no
// observable output — concurrency (#12), and crash-recovery / non-blocking
// behavior (#17, #32).

// --- Concurrency: widen a handler's read→write window ------------------------
// The synchronous better-sqlite3 adapter runs read and write too close together
// for a competing request to interleave, so a race test would pass even on buggy
// code. Enabled per-request via `x-test-race-delay: <label>:<ms>`.
export async function raceDelay(event: H3Event, label: string): Promise<void> {
  if (process.env.TEST_HOOKS !== '1') return
  const header = getHeader(event, 'x-test-race-delay')
  if (!header) return
  const [target, ms] = header.split(':')
  if (target !== label) return
  await new Promise((resolve) => setTimeout(resolve, Number(ms) || 0))
}

// --- Fault injection: throw at a labeled point -------------------------------
// Lets a test simulate a mid-operation failure so it can prove crash-recovery /
// non-blocking fixes. Two trigger modes:
//   - request-scoped: pass the `event`; fires when `x-test-fault: <label>` matches
//     (for handlers/utils reachable from a request, e.g. the ride-create broadcast, #32).
//   - context-free: no `event`; fires when the label was armed via armFault()
//     (for code with no request, e.g. the cron scheduler, #17 — armed by the
//     test-only reminder-trigger endpoint).
const armedFaults = new Set<string>()

export function armFault(label: string): void {
  armedFaults.add(label)
}

export function disarmFault(label: string): void {
  armedFaults.delete(label)
}

export function maybeFault(label: string, event?: H3Event): void {
  if (process.env.TEST_HOOKS !== '1') return
  const headerMatch = event ? getHeader(event, 'x-test-fault') === label : false
  if (headerMatch || armedFaults.has(label)) {
    throw createError({ statusCode: 500, statusMessage: `injected test fault: ${label}` })
  }
}
