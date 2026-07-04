import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Admin management data (issue #41): looking up arbitrary users is PII.
  requireAdmin(event)

  const email = getRouterParam(event, 'email')

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email is required',
    })
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  })

  return user
})

