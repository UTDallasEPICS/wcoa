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
      try {
        const user = await $fetch(`/api/get/users/byEmail/${ctx.body?.email}`)
        if (!user) {
          throw new APIError('BAD_REQUEST', {
            message: 'Contact admin to add your user to the system first',
          })
        }
      } catch (err) {
        if (err instanceof APIError) {
          throw err
        }
        console.log(`Error fetching user using email: ${err}`)
      }
    }),
  },
})
