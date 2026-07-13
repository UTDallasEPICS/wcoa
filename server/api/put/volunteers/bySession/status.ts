import { prisma } from '../../../../utils/prisma'
import { auth } from '../../../../utils/auth'
import * as z from 'zod'

const statusSchema = z.object({
  status: z.enum(['AVAILABLE', 'UNAVAILABLE'])
})

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
  const validation = statusSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid status',
    })
  }

  // Soft delete (issue #27): an archived volunteer is treated as gone, even
  // with a stale session — a lookup shouldn't trust a session alone.
  const volunteer = await prisma.volunteer.findFirst({
    where: { userId: session.user.id, deletedAt: null }
  })

  if (!volunteer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Volunteer profile not found',
    })
  }

  return await prisma.volunteer.update({
    where: { id: volunteer.id },
    data: {
      status: validation.data.status
    }
  })
})
