import { Prisma } from '../../../../../prisma/generated/client'
import { prisma } from '../../../../utils/prisma'
import { auth } from '../../../../utils/auth'
import { sendEmail } from '../../../../utils/email'
import { sendNotification } from '../../../../utils/notification'

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
  // Soft delete (issue #27): an archived volunteer must not self-assign, even
  // with a stale session — a lookup shouldn't trust a session alone.
  const volunteer = await prisma.volunteer.findFirst({
    where: { userId: user.id, deletedAt: null },
    include: { user: true }
  })

  if (!volunteer) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You must be a registered volunteer to sign up.',
    })
  }

  if (volunteer.status !== 'AVAILABLE') {
    throw createError({
      statusCode: 400,
      statusMessage: "Please set your status to 'AVAILABLE' in settings to sign up for a ride.",
    })
  }

  // 2. Check Ride status
  // Soft delete (issue #27): an archived ride can't be signed up for — treat it
  // as not found. The atomic assignment below also re-checks status.
  const ride = await prisma.ride.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: {
        include: {
          user: true
        }
      }
    }
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

  // Test-only seam (issue #45): widen the read→write window so the signup race
  // is reproducible through HTTP in e2e. No-op in production (see raceDelay).
  await raceDelay(event, 'ride-signup')

  // 3. Assign Volunteer (atomic — issue #12)
  // The pre-checks above give good error messages, but they are a read
  // separate from the write below: two volunteers can both pass the in-memory
  // `ride.status === 'CREATED'` check and then race to update, with the second
  // silently overwriting the first (TOCTOU). Put the precondition inside the
  // WHERE clause so the assignment only succeeds while the ride is still
  // unclaimed. If it was taken in between, Prisma throws P2025 (record to
  // update not found) and we reject cleanly instead of overwriting.
  let updatedRide
  try {
    updatedRide = await prisma.ride.update({
      where: { id, status: 'CREATED', volunteerId: null, deletedAt: null },
      data: {
        volunteerId: volunteer.id,
        status: 'ASSIGNED'
      }
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Ride is no longer available',
      })
    }
    throw err
  }

  // 4. Notifications
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' }
  })

  const adminEmails = admins.map(admin => admin.email).filter(Boolean)
  const volunteerEmail = volunteer.user.email

  const notifications = []

  // To Volunteer
  if (volunteerEmail) {
    const scheduledTime = new Date(ride.scheduledTime)
    notifications.push(sendNotification('RIDE_ASSIGNED', volunteer.id, {
      name: volunteer.user.name,
      date: formatNotificationDate(scheduledTime),
      time: formatNotificationTime(scheduledTime),
      client: ride.client.user.name,
      pickup: ride.pickupDisplay,
      dropoff: ride.dropoffDisplay,
      link: `${process.env.APP_URL || 'http://localhost:3000'}/rides/${id}`
    }))
  }

  // To Admins
  adminEmails.forEach(email => {
    notifications.push(sendEmail(
      email,
      'Volunteer Signed Up for Ride',
      `
        <h1>Volunteer Signed Up</h1>
        <p><strong>Volunteer:</strong> ${volunteer.user.name}</p>
        <p><strong>Ride Details:</strong></p>
        <p><strong>From:</strong> ${ride.pickupDisplay}</p>
        <p><strong>To:</strong> ${ride.dropoffDisplay}</p>
        <p><strong>Time:</strong> ${new Date(ride.scheduledTime).toLocaleString()}</p>
      `
    ))
  })

  Promise.allSettled(notifications).catch(console.error)

  return updatedRide
})
