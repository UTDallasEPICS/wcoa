import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Dashboard metrics are admin-only (issue #41). Consumer: index.vue, the
  // admin dashboard (volunteers are redirected by the route guard, #4).
  requireAdmin(event)

  const query = getQuery(event)
  // Shared helper makes endDate inclusive of the whole day (issue #18).
  const range = parseDateRange(query.startDate, query.endDate)
  const dateFilter = range ? { scheduledTime: range } : {}

  // Soft delete (issue #27): metrics DELIBERATELY do NOT filter deletedAt —
  // soft-deleted rides must still count so historical completion rate is
  // preserved. Preserving history is the entire point of soft-delete here.
  const totalRides = await prisma.ride.count({
    where: dateFilter
  })
  
  if (totalRides === 0) {
    return {
      percentage: 0,
      total: 0,
      completed: 0
    }
  }

  const completedRides = await prisma.ride.count({
    where: {
      status: 'COMPLETED',
      ...dateFilter
    }
  })

  return {
    percentage: Math.round((completedRides / totalRides) * 100),
    total: totalRides,
    completed: completedRides
  }
})
