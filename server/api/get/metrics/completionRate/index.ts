import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Dashboard metrics are admin-only (issue #41). Consumer: index.vue, the
  // admin dashboard (volunteers are redirected by the route guard, #4).
  requireAdmin(event)

  const query = getQuery(event)
  const startDate = query.startDate ? new Date(String(query.startDate)) : undefined
  const endDate = query.endDate ? new Date(String(query.endDate)) : undefined

  const dateFilter = startDate || endDate ? {
    scheduledTime: {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate })
    }
  } : {}

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
