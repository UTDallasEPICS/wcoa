import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Dashboard metrics are admin-only (issue #41). Consumer: index.vue, the
  // admin dashboard (volunteers are redirected by the route guard, #4).
  requireAdmin(event)

  const query = getQuery(event)
  // Shared helper makes endDate inclusive of the whole day (issue #18).
  const range = parseDateRange(query.startDate, query.endDate)
  const dateFilter = range ? { scheduledTime: range } : {}

  const result = await prisma.ride.aggregate({
    _sum: {
      totalRideTime: true
    },
    where: {
      status: 'COMPLETED',
      ...dateFilter
    }
  })

  return {
    totalHours: result._sum.totalRideTime || 0
  }
})
