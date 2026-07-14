import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { sendEmail } from '../../../utils/email'
import { readValidatedBody } from '../../../utils/validation'

// Validate the create payload (issue #90). status is enum-checked against the
// VolunteerStatus values (matching put/volunteers/bySession/status), so a bogus
// status is a 400 instead of being silently stored and dropping the volunteer
// out of the AVAILABLE broadcast. name/email are required; unknown keys are
// rejected via .strict().
const createVolunteerSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().min(1),
    phone: z.string().nullable().optional(),
    status: z.enum(['AVAILABLE', 'UNAVAILABLE']).optional(),
  })
  .strict()

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, createVolunteerSchema)

  // 1. Upsert User
  // We use upsert to create if not exists, or update name/phone if exists
  // Ideally, we might check if they are already a volunteer
  let user = await prisma.user.findUnique({
    where: { email: body.email }
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: emptyToNull(body.phone),
        role: 'VOLUNTEER'
      }
    })
  } else {
    // Update name and (presence-aware, issue #89) phone; only touch phone when
    // the caller actually sent it, so promoting an existing user to volunteer
    // without a phone field doesn't wipe their stored number. Upgrade CLIENT to
    // VOLUNTEER but never downgrade an ADMIN.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        ...(body.phone !== undefined ? { phone: emptyToNull(body.phone) } : {}),
        role: user.role === 'CLIENT' ? 'VOLUNTEER' : user.role
      }
    })
  }

  // 2. Create Volunteer profile if not exists
  const existingVolunteer = await prisma.volunteer.findUnique({
    where: { userId: user.id }
  })

  if (existingVolunteer) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User is already a volunteer',
    })
  }

  const volunteer = await prisma.volunteer.create({
    data: {
      userId: user.id,
      status: body.status || 'AVAILABLE'
    },
    include: {
      user: true
    }
  })

  // Send welcome email
  if (volunteer.user.email) {
    sendEmail(
      volunteer.user.email,
      'Welcome to WCOA Volunteer Program',
      `
        <h1>Welcome, ${volunteer.user.name}!</h1>
        <p>Thank you for signing up as a volunteer.</p>
        <p>You can now log in and browse available rides.</p>
      `
    ).catch(console.error)
  }

  return volunteer
})
