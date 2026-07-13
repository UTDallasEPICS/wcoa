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

  // Soft delete (issue #27): archived users have their email released to null
  // (moved to deletedEmail), so a findFirst on the live email column already
  // excludes them; the explicit deletedAt: null guard makes that intent clear.
  const user = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
  })

  return user
})

