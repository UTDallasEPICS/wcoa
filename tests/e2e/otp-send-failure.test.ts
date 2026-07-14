import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Regression test for issue #25: sendEmail used to swallow every SMTP failure
// (just console.error), so POST /api/auth/email-otp/send-verification-otp always
// reported success even when the OTP email never sent — a false positive that
// left the user unable to sign in.
//
// The fix makes sendEmail return a success/failure boolean, and the OTP hook
// (sendVerificationOTP) throws an APIError when the send fails, so the endpoint
// reports the failure instead of a false success.
//
// How this is pinned without SMTP (revert-check shape): the 'email-send' fault
// (testHooks.ts, gated on TEST_HOOKS) forces sendEmail to return false. We arm
// it via the gated _test/arm-fault endpoint, hit the OTP-send route, and assert
// a non-2xx response.
//   - PRE-FIX: sendVerificationOTP fire-and-forgets sendEmail and never inspects
//     the result, so the endpoint still returns 200 -> this assertion FAILS.
//   - POST-FIX: sendEmail returns false -> the hook throws -> non-2xx.
// The un-faulted case (and the whole loginAs-dependent suite) proves a normal
// OTP send still succeeds.

// A seeded account exists so the OTP send reaches the email step (the auth
// before-hook rejects unknown users before any OTP is issued).
const SEEDED_EMAIL = 'bob@example.com'

// Admin cookie captured ONCE, before any fault is armed. Arm AND disarm must be
// independent of loginAs()/OTP-send: routing them through a fresh login would
// itself hit send-verification-otp, so if the session cache were cold while the
// 'email-send' fault is armed (e.g. a resetDb()/clearSessionCache() from #62/#72
// landing mid-test), that login would 500 on the armed fault, the disarm would
// throw, the global fault would stay armed, and every later loginAs in the
// serial suite would cascade-fail. Capturing the cookie up front and POSTing
// arm-fault directly with it keeps both arm and disarm unblockable.
let adminCookie: string

beforeAll(async () => {
  adminCookie = await loginAs('reachtusharwani@gmail.com')
})

async function setEmailFault(armed: boolean): Promise<void> {
  // The _test route is behind the auth middleware, so it needs the admin cookie
  // — but never a fresh login (see the note above).
  const res = await appFetch('/api/_test/arm-fault', {
    method: 'POST',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ label: 'email-send', disarm: !armed }),
  })
  if (res.status !== 200) {
    throw new Error(`arm-fault(${armed ? 'arm' : 'disarm'}) failed: ${res.status}`)
  }
}

async function sendOtp(email: string): Promise<number> {
  const res = await appFetch('/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    // Unique IP so the per-IP rate limiter doesn't interfere.
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.77.0.${Math.floor(Math.random() * 250) + 1}`,
    },
    body: JSON.stringify({ email, type: 'sign-in' }),
  })
  return res.status
}

describe('OTP send surfaces email failures (#25)', () => {
  afterEach(async () => {
    // Always runs, using the pre-captured admin cookie, so the global fault can
    // never leak into other tests / files even if an assertion above threw.
    await setEmailFault(false)
  })

  it('reports a failure when the OTP email cannot be sent', async () => {
    await setEmailFault(true)
    const status = await sendOtp(SEEDED_EMAIL)
    // Pre-fix: the swallowed send still returns 200 (false success) -> FAILS.
    // Post-fix: the hook throws on a failed send -> non-2xx.
    expect(status).toBeGreaterThanOrEqual(400)
  })

  it('a normal OTP send (no fault) still succeeds', async () => {
    // Fault not armed: sendEmail reports success, so the endpoint returns 2xx —
    // this is exactly what loginAs() relies on across the whole suite.
    const status = await sendOtp(SEEDED_EMAIL)
    expect(status).toBeLessThan(400)
  })
})
