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

  // Soft delete (issue #27): metrics DELIBERATELY do NOT filter deletedAt — a
  // soft-deleted client's COMPLETED rides still count here, and the client
  // lookup below is likewise unfiltered so an archived client's name still
  // resolves. Historical preservation is the whole point of soft-delete.
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

  // Batch the client lookups into a single query to avoid an N+1 (issue #24):
  // resolve every grouped clientId at once, then map by id to preserve the
  // existing output shape and the count-desc ordering from the groupBy above.
  const clientIds = topRidersRaw.map((item) => item.clientId)
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    include: { user: true }
  })
  const clientsById = new Map(clients.map((client) => [client.id, client]))

  const topRiders = topRidersRaw.map((item) => {
    const client = clientsById.get(item.clientId)
    return {
      name: client?.user?.name || 'Unknown',
      completedRides: item._count.id
    }
  })

  return topRiders
})
