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

  // Issue #23: the ride->client FK is ON DELETE RESTRICT, so deleting a client
  // who has any rides throws P2003 and used to surface as a 500. We must not
  // crash, and we must not destroy historical ride data (COMPLETED rides feed
  // the metrics endpoints — this is the Data-Integrity milestone). Block the
  // delete with a clear 409 while rides exist; only ride-less clients delete.
  const rideCount = await prisma.ride.count({ where: { clientId: id } })
  if (rideCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'Cannot delete a client with existing rides — reassign or archive them first',
    })
  }

  try {
    return await prisma.client.delete({
      where: { id },
    })
  } catch (err) {
    // Race-safe fallback: a ride could be created between the count and the
    // delete. Treat the FK violation as the same 409 block, never a 500.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    ) {
      throw createError({
        statusCode: 409,
        statusMessage:
          'Cannot delete a client with existing rides — reassign or archive them first',
      })
    }
    throw err
  }
})
