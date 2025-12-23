import { prisma } from '../../../../utils/prisma'
import { auth } from '../../../../utils/auth'
import * as z from 'zod'

const reminderSchema = z.array(z.object({
  minutesBefore: z.number().int().positive(),
  type: z.string().default('email')
}))

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody(event)
  const validation = reminderSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid reminders data',
    })
  }

  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: session.user.id }
  })

  if (!volunteer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Volunteer profile not found',
    })
  }

  // Use a transaction to delete old and create new
  return await prisma.$transaction(async (tx) => {
    await tx.reminder.deleteMany({
      where: { volunteerId: volunteer.id }
    })

    return await tx.volunteer.update({
      where: { id: volunteer.id },
      data: {
        reminders: {
          create: validation.data
        }
      },
      include: {
        reminders: true
      }
    })
  })
})
