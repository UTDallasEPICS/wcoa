import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email is required',
    })
  }

  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  })

  return user
})
