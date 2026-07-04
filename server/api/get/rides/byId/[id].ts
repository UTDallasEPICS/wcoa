import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  const ride = await prisma.ride.findUnique({
    where: { id },
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
