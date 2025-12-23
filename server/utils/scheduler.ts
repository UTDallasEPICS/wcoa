import { prisma } from './prisma'
import { sendEmail } from './email'

export async function processReminders() {
  const now = new Date()

  // 1. Fetch upcoming rides that are assigned but not completed/cancelled
  const rides = await prisma.ride.findMany({
    where: {
      status: 'ASSIGNED',
      scheduledTime: {
        gt: now,
      },
      volunteerId: {
        not: null,
      },
    },
    include: {
      volunteer: {
        include: {
          user: true,
          reminders: true,
        },
      },
      client: {
        include: {
          user: true,
        },
      },
      sentReminders: true,
    },
  })

  for (const ride of rides) {
    if (!ride.volunteer?.reminders) continue

    for (const reminderConfig of ride.volunteer.reminders) {
      const scheduledTime = new Date(ride.scheduledTime)
      const reminderThreshold = new Date(scheduledTime.getTime() - (reminderConfig.minutesBefore * 60000))

      // Check if it's time to send this reminder
      if (now >= reminderThreshold) {
        // Check if already sent
        const alreadySent = ride.sentReminders.some(sr => sr.type === String(reminderConfig.minutesBefore))

        if (!alreadySent) {
          try {
            await sendReminderEmail(ride, reminderConfig.minutesBefore)
            
            // Log that it was sent
            await prisma.sentReminder.create({
              data: {
                rideId: ride.id,
                type: String(reminderConfig.minutesBefore),
              }
            })
            console.log(`Sent ${reminderConfig.minutesBefore}m reminder for ride ${ride.id} to ${ride.volunteer.user.email}`)
          } catch (err) {
            console.error(`Failed to send reminder for ride ${ride.id}:`, err)
          }
        }
      }
    }
  }
}

async function sendReminderEmail(ride: any, minutesBefore: number) {
  const volunteerEmail = ride.volunteer.user.email
  const timeStr = new Date(ride.scheduledTime).toLocaleString()
  
  const subject = `Upcoming Ride Reminder: ${ride.pickupDisplay}`
  const text = `
    Hi ${ride.volunteer.user.name},
    
    This is a reminder for your upcoming ride.
    
    Scheduled Time: ${timeStr}
    Client: ${ride.client.user.name}
    Pickup: ${ride.pickupDisplay}
    Dropoff: ${ride.dropoffDisplay}
    Notes: ${ride.notes || 'None'}
    
    Thank you for volunteering!
  `
  
  await sendEmail(volunteerEmail, subject, text)
}
