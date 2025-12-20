import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  return await prisma.ride.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          user: true
        }
      },
      volunteer: {
        include: {
          user: true
        }
      }
    }
  })
})
