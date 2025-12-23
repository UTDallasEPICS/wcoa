import { prisma } from '../../../../utils/prisma'
import { auth } from '../../../../utils/auth'

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

  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: session.user.id },
    include: {
      user: true,
      reminders: true,
    },
  })

  if (!volunteer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Volunteer profile not found',
    })
  }

  return volunteer
})
