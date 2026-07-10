import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { sendEmail } from './email'

/**
 * Resolve the list of origins better-auth trusts for CSRF/Origin validation.
 *
 * Derives the list from the environment instead of hardcoding a value, so a
 * production deployment trusts its real domain (issue #21):
 *   - BETTER_AUTH_URL / APP_URL — the app's own origin(s), already used
 *     elsewhere in this project.
 *   - TRUSTED_ORIGINS — optional comma-separated list of extra origins.
 * `http://localhost:3000` is always included so local dev and the e2e harness
 * keep working.
 *
 * Pure and env-injected so it can be unit-tested without booting better-auth.
 */
export function resolveTrustedOrigins(
  env: Record<string, string | undefined>,
): string[] {
  const origins = ['http://localhost:3000']

  for (const key of ['BETTER_AUTH_URL', 'APP_URL']) {
    const value = env[key]?.trim()
    if (value) origins.push(value)
  }

  const extra = env.TRUSTED_ORIGINS
  if (extra) {
    for (const origin of extra.split(',')) {
      const trimmed = origin.trim()
      if (trimmed) origins.push(trimmed)
    }
  }

  return [...new Set(origins)]
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  trustedOrigins: resolveTrustedOrigins(process.env),
  // Disabled only in the e2e suite (production build ⇒ rate limiting on by
  // default, which throttles a test that logs in many times from one IP).
  rateLimit: {
    enabled: process.env.DISABLE_RATE_LIMIT !== 'true',
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
      },
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        sendEmail(email, 'OTP', `${otp}`)
      },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/email-otp/send-verification-otp') {
        return
      }
      // Query the database directly rather than looping back through the HTTP
      // API (avoids self-request latency/deadlocks, and the API is now behind
      // auth middleware which would reject this pre-session call). See #20.
      const email = ctx.body?.email
      if (!email) return
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        throw new APIError('BAD_REQUEST', {
          message: 'Contact admin to add your user to the system first',
        })
      }
    }),
  },
})
