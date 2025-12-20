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
      statusMessage: 'You must be a registered volunteer to sign up.',
    })
  }

  // 2. Check Ride status
  const ride = await prisma.ride.findUnique({
    where: { id }
  })

  if (!ride) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ride not found',
    })
  }

  if (ride.status !== 'CREATED') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ride is not available for signup',
    })
  }

  // 3. Assign Volunteer
  return await prisma.ride.update({
    where: { id },
    data: {
      volunteerId: volunteer.id,
      status: 'ASSIGNED'
    }
  })
})
