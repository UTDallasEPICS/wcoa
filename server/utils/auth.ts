import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'
import nodemailer from 'nodemailer'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { sendEmail } from './email'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  trustedOrigins: ['http://localhost:3000', 'http://192.168.4.240:3000'],
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
