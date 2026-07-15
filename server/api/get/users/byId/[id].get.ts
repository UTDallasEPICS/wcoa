import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Admin management data (issue #41): looking up arbitrary users is PII.
  requireAdmin(event)

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email is required',
    })
  }

  // Soft delete (issue #27): an archived user must not resolve here — active
  // views treat it as gone.
  const user = await prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  })

  // Missing/archived user is gone (issue #94): return 404 rather than a null
  // body, which Nitro serializes as 204 No Content.
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return user
})
