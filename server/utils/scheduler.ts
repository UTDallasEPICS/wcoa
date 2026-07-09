import { prisma } from './prisma'
import { sendNotification } from './notification'
import { maybeFault } from './testHooks'

export async function processReminders() {
  const now = new Date()

  // Test-only fault point (issue #45): a test can arm 'reminders-scan' (via the
  // _test/run-reminders endpoint) to simulate the job crashing mid-run. No-op in
  // production. #17 can add a finer point between send and the SentReminder write.
  maybeFault('reminders-scan')

  // 1. Fetch upcoming rides that are assigned but not completed
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
            await sendNotification('RIDE_REMINDER', ride.volunteer.id, {
              name: ride.volunteer.user.name,
              client: ride.client.user.name,
              pickup: ride.pickupDisplay,
              dropoff: ride.dropoffDisplay,
              time: scheduledTime.toLocaleString(),
              notes: ride.notes || 'None',
              link: `${process.env.APP_URL || 'http://localhost:3000'}/rides/${ride.id}`,
            })
            
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

