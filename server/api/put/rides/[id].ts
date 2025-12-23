import { prisma } from '../../../utils/prisma'
import { sendEmail } from '../../../utils/email'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  const updateData: any = { ...body }
  if (updateData.scheduledTime) {
    updateData.scheduledTime = new Date(updateData.scheduledTime)
  }

  const ride = await prisma.ride.update({
    where: { id },
    data: updateData,
    include: {
      volunteer: {
        include: { user: true }
      }
    }
  })

  // If ride is marked as COMPLETED, send notifications
  if (body.status === 'COMPLETED') {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' }
    })

    const adminEmails = admins.map(admin => admin.email).filter(Boolean)
    const volunteerEmail = ride.volunteer?.user?.email

    const notifications = []

    // To Volunteer
    if (volunteerEmail) {
      notifications.push(sendEmail(
        volunteerEmail,
        'Ride Completion Confirmation',
        `
          <h1>Ride Completed</h1>
          <p>Thank you for completing the ride!</p>
          <p><strong>From:</strong> ${ride.pickupDisplay}</p>
          <p><strong>To:</strong> ${ride.dropoffDisplay}</p>
          <p><strong>Total Time:</strong> ${ride.totalRideTime} hours</p>
        `
      ))
    }

    // To Admins
    adminEmails.forEach(email => {
      notifications.push(sendEmail(
        email,
        'Ride Completed by Volunteer',
        `
          <h1>Ride Completed</h1>
          <p><strong>Volunteer:</strong> ${ride.volunteer?.user?.name || 'N/A'}</p>
          <p><strong>Ride Details:</strong></p>
          <p><strong>From:</strong> ${ride.pickupDisplay}</p>
          <p><strong>To:</strong> ${ride.dropoffDisplay}</p>
          <p><strong>Total Time:</strong> ${ride.totalRideTime} hours</p>
        `
      ))
    })

    Promise.allSettled(notifications).catch(console.error)
  }

  return ride
})
