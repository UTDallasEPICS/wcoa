import { Prisma } from '../../prisma/generated/client'
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
          // Claim BEFORE sending (#17). Writing the SentReminder row first, and
          // relying on @@unique([rideId, type]), makes claiming atomic and
          // idempotent: if the process crashes after this point the row already
          // exists, so the next cron tick sees it and never re-sends. Missing a
          // single email on a crash is acceptable; infinite re-sends were not.
          // The claim is OUTSIDE the send try/catch so a claim failure (other
          // than an already-claimed race) surfaces instead of being swallowed.
          try {
            await prisma.sentReminder.create({
              data: {
                rideId: ride.id,
                type: String(reminderConfig.minutesBefore),
              },
            })
          } catch (err) {
            // P2002 = another tick already claimed this (rideId, type). Skip:
            // do not send. Any other error is a real problem — rethrow.
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === 'P2002'
            ) {
              continue
            }
            throw err
          }

          // Test-only fault point (#17): simulates the process crashing after
          // the claim but before the send completes. Placed OUTSIDE the send
          // try/catch so it propagates like a real crash rather than being
          // swallowed. No-op in production. Because the claim above already
          // committed, a crash here leaves the row behind and the reminder is
          // never re-sent on the next tick.
          maybeFault('reminder-after-claim')

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
            console.log(`Sent ${reminderConfig.minutesBefore}m reminder for ride ${ride.id} to ${ride.volunteer.user.email}`)
          } catch (err) {
            // Send failed after a successful claim. Swallow as before (the send
            // path already tolerates failures, issue #25). The claim stands, so
            // we will not retry/spam — at-most-once.
            console.error(`Failed to send reminder for ride ${ride.id}:`, err)
          }
        }
      }
    }
  }
}

