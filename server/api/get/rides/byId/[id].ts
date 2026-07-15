import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  // Soft delete (issue #27): an archived ride is treated as gone — findFirst
  // with deletedAt: null yields null, and the scoping below turns that into a 404.
  const ride = await prisma.ride.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: {
        include: {
          user: true
        }
      },
      volunteer: {
        include: {
          user: true
        }
      }
    }
  })

  // Missing/archived ride is gone for everyone (issue #94): return 404 rather
  // than falling through to a null body (which Nitro serializes as 204). The
  // admin path skips the non-admin scoping block below, so without this check
  // an admin would get a 204 for a truly-missing ride.
  if (!ride) {
    throw createError({ statusCode: 404, statusMessage: 'Ride not found' })
  }

  // Record-level scoping (issue #41, same class as #3): a non-admin may only
  // retrieve a ride that is available to sign up for (CREATED) or that is
  // assigned to them — never another volunteer's ride and its client PII.
  // Return 404 rather than 403 so we don't reveal that the ride exists.
  const session = getAuth(event)
  const role = session?.user?.role
  if (role !== 'ADMIN') {
    const userId = session?.user?.id
    const isAvailable = ride?.status === 'CREATED'
    const isMine = !!userId && ride?.volunteer?.userId === userId
    if (!ride || (!isAvailable && !isMine)) {
      throw createError({ statusCode: 404, statusMessage: 'Ride not found' })
    }
  }

  return ride
})
