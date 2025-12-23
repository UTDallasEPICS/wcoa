import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const startDate = query.startDate ? new Date(String(query.startDate)) : undefined
  const endDate = query.endDate ? new Date(String(query.endDate)) : undefined

  const dateFilter = startDate || endDate ? {
    scheduledTime: {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate })
    }
  } : {}

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
