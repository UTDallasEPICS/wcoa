import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { readValidatedBody } from '../../../utils/validation'
import { throwOnPrismaWriteConflict } from '../../../utils/prismaErrors'

// Validate the update payload (issue #90): status is enum-checked (a bogus value
// is a 400, not silently stored), and unknown keys are rejected via .strict().
// All fields are optional so a partial update only touches what it sends — an
// omitted contact field is a no-op, not a wipe (issue #89).
const updateVolunteerSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    status: z.enum(['AVAILABLE', 'UNAVAILABLE']).optional(),
  })
  .strict()

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  const body = await readValidatedBody(event, updateVolunteerSchema)

  // Soft delete (issue #27): an archived volunteer can't be edited — treat as 404.
  const volunteer = await prisma.volunteer.findFirst({
    where: { id, deletedAt: null },
  })

  if (!volunteer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Volunteer not found',
    })
  }

  // Build the User update only from fields the caller actually sent (issue #89):
  // omitting email/phone leaves the stored value untouched instead of nulling it.
  const userData: { name?: string; email?: string | null; phone?: string | null } = {}
  if (body.name !== undefined) userData.name = body.name
  if (body.email !== undefined) userData.email = emptyToNull(body.email)
  if (body.phone !== undefined) userData.phone = emptyToNull(body.phone)

  // Transaction to update both. Wrap the writes so a unique-constraint violation
  // (e.g. reusing another active user's email/phone) is a clean 409 (issue #91).
  try {
    return await prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: volunteer.userId },
          data: userData,
        })
      }

      return await tx.volunteer.update({
        where: { id },
        data: {
          // undefined leaves status unchanged; a present value is a validated enum.
          status: body.status,
        },
        include: {
          user: true,
          reminders: true,
        },
      })
    })
  } catch (err) {
    throwOnPrismaWriteConflict(err, { notFoundMessage: 'Volunteer not found' })
  }
})
