import { armFault, disarmFault } from '../../utils/testHooks'

// Test-only endpoint (issues #25, #45). Arms or disarms a context-free fault
// label so an e2e test can force a failure inside code that has no request
// event of its own — e.g. sendEmail() in better-auth's sendVerificationOTP hook
// (issue #25), which the OTP-send route surfaces as an error.
//
// Hard-gated: returns 404 unless TEST_HOOKS=1 (only the harness sets it), so it
// does not exist in production. Still behind the global auth middleware (admin).
//
// Body: { label: string, disarm?: boolean }. The fault stays armed on the
// server until disarmed, so a test must disarm it after use. Because the e2e
// suite runs test files serially (vitest fileParallelism: false), no other
// request overlaps the armed window.
export default defineEventHandler(async (event) => {
  if (process.env.TEST_HOOKS !== '1') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const body = await readBody(event).catch(() => ({}))
  const label = typeof body?.label === 'string' ? body.label : undefined
  if (!label) {
    throw createError({ statusCode: 400, statusMessage: 'label required' })
  }

  const disarm = body?.disarm === true
  if (disarm) disarmFault(label)
  else armFault(label)

  return { ok: true, label, armed: !disarm }
})
