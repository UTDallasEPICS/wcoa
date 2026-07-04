import { fetch as appFetch } from '@nuxt/test-utils/e2e'
import Database from 'better-sqlite3'

// Seeded logins (see prisma/seed.ts):
//   ADMIN:     reachtusharwani@gmail.com
//   VOLUNTEER: bob@example.com, alice@example.com
//   CLIENT:    martha@example.com, george@example.com, sarah@example.com

const sessionCache = new Map<string, string>()
let ipCounter = 0

/**
 * Logs in through the real better-auth email-OTP flow without SMTP.
 * The app swallows email-send failures, but better-auth stores the OTP in the
 * `verification` table first — so we request an OTP, read it straight from the
 * test database, and complete sign-in. Returns a Cookie header value.
 *
 * Sessions are cached per email, and each login uses a unique X-Forwarded-For
 * so better-auth's per-IP rate limiter (active in production builds) doesn't
 * throttle suites that log in repeatedly.
 */
export async function loginAs(email: string): Promise<string> {
  const cached = sessionCache.get(email)
  if (cached) return cached

  const fakeIp = `10.99.0.${++ipCounter}`
  const sendRes = await appFetch('/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': fakeIp },
    body: JSON.stringify({ email, type: 'sign-in' }),
  })
  if (!sendRes.ok) {
    throw new Error(`send-verification-otp failed for ${email}: ${sendRes.status} ${await sendRes.text()}`)
  }

  const otp = readLatestOtp(email)

  const signInRes = await appFetch('/api/auth/sign-in/email-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': fakeIp },
    body: JSON.stringify({ email, otp }),
  })
  if (!signInRes.ok) {
    throw new Error(`sign-in failed for ${email}: ${signInRes.status} ${await signInRes.text()}`)
  }

  const setCookies = signInRes.headers.getSetCookie()
  if (!setCookies.length) {
    throw new Error(`sign-in for ${email} returned no Set-Cookie header`)
  }
  // "name=value; Path=/; HttpOnly" -> "name=value", joined for a Cookie header
  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ')
  sessionCache.set(email, cookie)
  return cookie
}

function readLatestOtp(email: string): string {
  const dbPath = (process.env.DATABASE_URL ?? '').replace(/^file:/, '')
  const db = new Database(dbPath, { readonly: true })
  try {
    const row = db
      .prepare(
        `SELECT value FROM verification WHERE identifier LIKE '%' || ? ORDER BY createdAt DESC LIMIT 1`
      )
      .get(email) as { value: string } | undefined
    if (!row) throw new Error(`No OTP found in verification table for ${email}`)
    // better-auth stores either "123456" or "123456:<attempt count>"
    return row.value.split(':')[0]!
  } finally {
    db.close()
  }
}
