import { afterEach, describe, expect, it } from 'vitest'
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

async function armEmailFault(disarm = false): Promise<void> {
  // Requires an admin session (the _test route is behind the auth middleware).
  const cookie = await loginAs('reachtusharwani@gmail.com')
  const res = await appFetch('/api/_test/arm-fault', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ label: 'email-send', disarm }),
  })
  if (res.status !== 200) {
    throw new Error(`arm-fault(${disarm ? 'disarm' : 'arm'}) failed: ${res.status}`)
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
    // Never leak the armed fault into other tests / files.
    await armEmailFault(true)
  })

  it('reports a failure when the OTP email cannot be sent', async () => {
    await armEmailFault()
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
