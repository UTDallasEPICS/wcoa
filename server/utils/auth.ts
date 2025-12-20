import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'
import nodemailer from 'nodemailer'
import { createAuthMiddleware, APIError } from 'better-auth/api'

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
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'OTP',
          html: `${otp}`,
        })
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
