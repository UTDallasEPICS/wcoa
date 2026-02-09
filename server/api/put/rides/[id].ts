import { prisma } from '../../../utils/prisma'
import { sendEmail } from '../../../utils/email'
import { sendNotification } from '../../../utils/notification'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  // Fetch existing ride to check previous state
  const existingRide = await prisma.ride.findUnique({
    where: { id },
    include: {
      volunteer: {
        include: { user: true }
      },
      client: {
        include: { user: true }
      }
    }
  })

  if (!existingRide) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ride not found',
    })
  }

  const updateData: any = { ...body }
  if (updateData.scheduledTime) {
    updateData.scheduledTime = new Date(updateData.scheduledTime)
  }

  // Handle volunteer assignment/unassignment
  if (body.volunteerId !== undefined) {
    if (body.volunteerId && body.volunteerId.trim() !== '') {
      updateData.volunteerId = body.volunteerId
    } else {
      updateData.volunteerId = null
    }
  }

  const ride = await prisma.ride.update({
    where: { id },
    data: updateData,
    include: {
      volunteer: {
        include: { user: true }
      },
      client: {
        include: { user: true }
      }
    }
  })

  // Notifications
  const formattedTime = new Date(ride.scheduledTime).toLocaleString()
  const commonContext = {
    client: ride.client.user.name,
    pickup: ride.pickupDisplay,
    dropoff: ride.dropoffDisplay,
    date: formattedTime.split(',')[0],
    time: formattedTime,
    link: `${process.env.APP_URL || 'http://localhost:3000'}/rides/${ride.id}`,
    notes: ride.notes || 'None'
  }

  // 1. RIDE_COMPLETED
  if (body.status === 'COMPLETED' && existingRide.status !== 'COMPLETED') {
    if (ride.volunteer) {
      await sendNotification('RIDE_COMPLETED', ride.volunteer.id, {
        name: ride.volunteer.user.name,
        ...commonContext
      })
    }

    // Notify Admins (legacy/direct email)
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    const adminEmails = admins.map(admin => admin.email).filter(Boolean)
    
    adminEmails.forEach(email => {
      sendEmail(
        email,
        'Ride Completed by Volunteer',
        `
          <h1>Ride Completed</h1>
          <p><strong>Volunteer:</strong> ${ride.volunteer?.user?.name || 'N/A'}</p>
          <p><strong>Ride Details:</strong></p>
          <p><strong>From:</strong> ${ride.pickupDisplay}</p>
          <p><strong>To:</strong> ${ride.dropoffDisplay}</p>
          <p><strong>Total Time:</strong> ${ride.totalRideTime || 'N/A'} hours</p>
        `
      ).catch(console.error)
    })
  }

  // 2. RIDE_CANCELLED
  if (body.status === 'CANCELLED' && existingRide.status !== 'CANCELLED') {
    // Notify the volunteer who WAS assigned (even if unassigned in this update, though unlikely for cancellation)
    // Assuming volunteer is still attached or was attached in existingRide
    const volunteerToNotify = existingRide.volunteer // Notify the volunteer who was assigned before cancellation

    if (volunteerToNotify) {
      await sendNotification('RIDE_CANCELLED', volunteerToNotify.id, {
        name: volunteerToNotify.user.name,
        ...commonContext
      })
    }
  }

  return ride
})
