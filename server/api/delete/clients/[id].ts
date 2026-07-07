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

  // Issue #8: deleting only the Client profile left an orphaned User (role
  // CLIENT, no profile) that crashes frontend queries reading user.client.id.
  // Delete the underlying User instead — Client.user is onDelete: Cascade, so
  // this removes the client row too, leaving no orphan. (Roles are singular in
  // this app, so a User won't also hold a volunteer profile.)
  const client = await prisma.client.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!client) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Client not found',
    })
  }

  try {
    return await prisma.user.delete({
      where: { id: client.userId },
    })
  } catch (err) {
    // Race-safe fallback: a ride could be created between the count and the
    // delete. We now delete the User, whose cascade to the client row is what
    // trips the ride->client RESTRICT FK. Empirically (better-sqlite3 adapter)
    // this surfaces as P2003; we also accept P2014 (required-relation
    // violation) defensively so a driver quirk can't leak a 500. Treat both as
    // the same 409 block.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2003' || err.code === 'P2014')
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
