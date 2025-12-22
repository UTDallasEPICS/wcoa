import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  
  let startFilter: Date
  let endFilter: Date

  if (query.startDate || query.endDate) {
    startFilter = query.startDate ? new Date(String(query.startDate)) : new Date(0) // Beginning of time if not set
    endFilter = query.endDate ? new Date(String(query.endDate)) : new Date(8640000000000000) // Max date if not set
  } else {
    // Default to Year to Date
    const currentYear = new Date().getFullYear()
    startFilter = new Date(currentYear, 0, 1)
    endFilter = new Date(currentYear + 1, 0, 1)
  }

  const topRidersRaw = await prisma.ride.groupBy({
    by: ['clientId'],
    where: {
      status: 'COMPLETED',
      scheduledTime: {
        gte: startFilter,
        lt: endFilter
      }
    },
    _count: {
      id: true
    },
    orderBy: {
      _count: {
        id: 'desc'
      }
    },
    take: 5
  })

  const topRiders = await Promise.all(topRidersRaw.map(async (item) => {
    const client = await prisma.client.findUnique({
      where: { id: item.clientId },
      include: { user: true }
    })
    return {
      name: client?.user?.name || 'Unknown',
      completedRides: item._count.id
    }
  }))

  return topRiders
})
