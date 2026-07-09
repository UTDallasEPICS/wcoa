import { describe, expect, it } from 'vitest'
import { fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Validates the fault-injection seam (issue #45): a test-only way to make a
// handler/util throw at a labeled point so crash-recovery / non-blocking fixes
// (#17, #32) can be pinned. Exercised through the gated _test/run-reminders
// endpoint (which also gives #17 an on-demand trigger for the cron job).

async function runReminders(
  cookie: string,
  opts: { fault?: string; header?: string } = {},
): Promise<number> {
  const headers: Record<string, string> = { cookie, 'content-type': 'application/json' }
  if (opts.header) headers['x-test-fault'] = opts.header
  const res = await appFetch('/api/_test/run-reminders', {
    method: 'POST',
    headers,
    body: JSON.stringify(opts.fault ? { fault: opts.fault } : {}),
  })
  return res.status
}

describe('fault-injection seam (#45)', () => {
  it('runs the reminder job on demand with no fault (200)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    expect(await runReminders(cookie)).toBe(200)
  })

  it('request-scoped fault fires on a matching x-test-fault header (500)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    expect(await runReminders(cookie, { header: 'run-reminders' })).toBe(500)
  })

  it('does not fire on a non-matching fault label (200)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    expect(await runReminders(cookie, { header: 'some-other-label' })).toBe(200)
  })

  it('context-free (armed) fault fires inside the cron job when armed via body (500)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    // Arms 'reminders-scan', which processReminders() checks with maybeFault()
    // (no request event) — proving the cron-context path works for #17.
    expect(await runReminders(cookie, { fault: 'reminders-scan' })).toBe(500)
  })

  it('the fault is disarmed after the run (a subsequent run succeeds)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    await runReminders(cookie, { fault: 'reminders-scan' })
    // If armFault leaked, this second run would 500. The endpoint disarms in finally.
    expect(await runReminders(cookie)).toBe(200)
  })
})
