import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, '')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: '',
    })
  }

  return await prisma.user.delete({
    where: { id },
  })
})
