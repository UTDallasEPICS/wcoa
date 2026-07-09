import { processReminders } from '../../utils/scheduler'
import { armFault, disarmFault, maybeFault } from '../../utils/testHooks'

// Test-only endpoint (issue #45). The reminder job runs on a cron timer, so an
// e2e test can't otherwise invoke it. This lets a test drive processReminders()
// on demand and optionally arm a fault (e.g. simulate a crash between the email
// send and the SentReminder write) to pin the crash-recovery fix (#17).
//
// Hard-gated: returns 404 unless TEST_HOOKS=1 (only the harness sets it), so it
// does not exist in production. Still behind the global auth middleware (admin).
//
// Body: { fault?: string } — arms that fault label for the duration of the run.
export default defineEventHandler(async (event) => {
  if (process.env.TEST_HOOKS !== '1') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  // Validates the request-scoped fault path (x-test-fault: run-reminders).
  maybeFault('run-reminders', event)

  const body = await readBody(event).catch(() => ({}))
  const fault = typeof body?.fault === 'string' ? body.fault : undefined

  if (fault) armFault(fault)
  try {
    await processReminders()
    return { ok: true }
  } finally {
    if (fault) disarmFault(fault)
  }
})
