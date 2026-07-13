import { Prisma } from '../../../../prisma/generated/client'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  // Soft delete (issue #27): mark the ride archived instead of destroying it, so
  // it disappears from active views while COMPLETED rides still feed historical
  // metrics. Guard on deletedAt: null so a second delete of an already-archived
  // ride 404s (P2025) rather than silently re-archiving.
  try {
    const archived = await prisma.ride.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    // Audit (issue #28): record the archival (soft delete).
    await writeAuditLog(event, {
      action: 'RIDE_DELETED',
      targetType: 'Ride',
      targetId: id,
    })
    return archived
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw createError({ statusCode: 404, statusMessage: 'Ride not found' })
    }
    throw err
  }
})
