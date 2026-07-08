import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Dashboard metrics expose client names (PII) and are admin-only (issue #41).
  // Consumer: index.vue, the admin dashboard (volunteers are redirected, #4).
  requireAdmin(event)

  const query = getQuery(event)

  let scheduledTime: { gte: Date; lt: Date }

  const range = parseDateRange(query.startDate, query.endDate)
  if (range) {
    // Explicit date(s): the shared helper makes endDate inclusive of the whole
    // day (issue #18 — previously `lt: endDate` dropped the entire end day).
    // Open bounds when only one side is given match the prior behavior.
    scheduledTime = {
      gte: range.gte ?? new Date(0), // Beginning of time if start not set
      lt: range.lt ?? new Date(8640000000000000), // Max date if end not set
    }
  } else {
    // Default to Year to Date
    const currentYear = new Date().getFullYear()
    scheduledTime = {
      gte: new Date(currentYear, 0, 1),
      lt: new Date(currentYear + 1, 0, 1),
    }
  }

  const topRidersRaw = await prisma.ride.groupBy({
    by: ['clientId'],
    where: {
      status: 'COMPLETED',
      scheduledTime,
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
