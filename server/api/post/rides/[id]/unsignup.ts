import { prisma } from '../../../../utils/prisma'
import { auth } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const session = await auth.api.getSession({
    headers: event.headers
  })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = session.user

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ride ID is required',
    })
  }

  // 1. Get Volunteer profile
  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: user.id }
  })

  if (!volunteer) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You must be a registered volunteer to unsign up.',
    })
  }

  // 2. Check Ride status and assignment
  const ride = await prisma.ride.findUnique({
    where: { id }
  })

  if (!ride) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ride not found',
    })
  }

  if (ride.volunteerId !== volunteer.id) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You are not assigned to this ride.',
    })
  }

  if (ride.status !== 'ASSIGNED') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ride cannot be unsigned from in its current state.',
    })
  }

  // 3. Unassign Volunteer
  return await prisma.ride.update({
    where: { id },
    data: {
      volunteerId: null,
      status: 'CREATED'
    }
  })
})
