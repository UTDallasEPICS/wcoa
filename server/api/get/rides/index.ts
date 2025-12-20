import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async () => {
  return await prisma.ride.findMany({
    include: {
      client: {
        include: {
          user: true,
        },
      },
      volunteer: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      scheduledTime: 'desc',
    },
  })
})

