import { defineEventHandler, readBody } from 'h3'
import { auth } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers
  })
  if (!session || !session.user || session.user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const name = event.context.params?.name
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Missing template name' })
  }

  const { subject, body, enabled } = await readBody(event)

  if (subject === undefined && body === undefined && enabled === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const template = await prisma.notificationTemplate.update({
    where: { name },
    data: {
      subject,
      body,
      enabled,
    },
  })

  return template
})
