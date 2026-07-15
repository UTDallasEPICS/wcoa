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
    where: { email: body.email },
    include: { client: true }
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
    // Singular-role guard (issue #92): reject creating a volunteer profile on an
    // email that already belongs to a client account, instead of silently
    // upgrading CLIENT -> VOLUNTEER while the client profile + rides remain
    // stranded under a now-VOLUNTEER user. An existing VOLUNTEER falls through to
    // the "already a volunteer" 400 below.
    const hasActiveClient = !!user.client && user.client.deletedAt === null
    if (user.role === 'CLIENT' || hasActiveClient) {
      throw createError({
        statusCode: 409,
        statusMessage: 'That email belongs to a client account',
      })
    }
    // Update name and (presence-aware, issue #89) phone; only touch phone when
    // the caller actually sent it, so re-posting an existing user without a phone
    // field doesn't wipe their stored number. Role is left untouched (never
    // downgrade an ADMIN; CLIENT is already rejected above).
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        ...(body.phone !== undefined ? { phone: emptyToNull(body.phone) } : {}),
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
