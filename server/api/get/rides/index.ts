import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const sort = query.sort === 'desc' ? 'desc' : 'asc'

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
      scheduledTime: sort,
    },
  })
})

