import { defineEventHandler } from 'h3'
import { auth } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers
  })
  if (!session || !session.user || session.user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const templates = await prisma.notificationTemplate.findMany({
    orderBy: { name: 'asc' },
  })

  return templates
})
