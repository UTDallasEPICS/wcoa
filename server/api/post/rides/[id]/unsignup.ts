import { Prisma } from '../../../../../prisma/generated/client'
import { prisma } from '../../../../utils/prisma'
import { auth } from '../../../../utils/auth'
import { sendEmail } from '../../../../utils/email'

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
    where: { userId: user.id },
    include: { user: true }
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

  // 3. Unassign Volunteer (atomic — issue #12, same check-then-act shape)
  // Guard the update on the state we validated above so a concurrent unsignup
  // (or a reassignment) can't cause a redundant/incorrect unassign. If the ride
  // is no longer this volunteer's ASSIGNED ride, Prisma throws P2025 and we
  // reject cleanly.
  let updatedRide
  try {
    updatedRide = await prisma.ride.update({
      where: { id, status: 'ASSIGNED', volunteerId: volunteer.id },
      data: {
        volunteerId: null,
        status: 'CREATED'
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
    notifications.push(sendEmail(
      volunteerEmail,
      'Ride Unsignup Confirmation',
      `
        <h1>Unsignup Confirmed</h1>
        <p>You have successfully unsigned from the following ride:</p>
        <p><strong>From:</strong> ${ride.pickupDisplay}</p>
        <p><strong>To:</strong> ${ride.dropoffDisplay}</p>
        <p><strong>Time:</strong> ${new Date(ride.scheduledTime).toLocaleString()}</p>
      `
    ))
  }

  // To Admins
  adminEmails.forEach(email => {
    notifications.push(sendEmail(
      email,
      'Volunteer Unsigned Up from Ride',
      `
        <h1>Volunteer Unsigned Up</h1>
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
