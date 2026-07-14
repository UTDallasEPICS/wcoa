import { z } from 'zod'
import { Prisma } from '../../../../../prisma/generated/client'
import { prisma } from '../../../../utils/prisma'
import { sendEmail } from '../../../../utils/email'
import { sendNotification } from '../../../../utils/notification'
import { readValidatedBody } from '../../../../utils/validation'

// Self-service ride completion (issue #87).
//
// The ride-detail UI's "Mark as Completed" button (app/pages/rides/[id].vue) is
// shown to the assigned volunteer, but the only completion path was
// PUT /api/put/rides/[id], which the global auth middleware blocks for
// volunteers (403 "Admin access required"). This dedicated endpoint mirrors the
// signup/unsignup self-service pattern: the middleware allows the POST (via
// VOLUNTEER_WRITE_ALLOW), and authorization is enforced HERE — the caller must
// be an ADMIN or the volunteer actually assigned to this ride.
//
// It reuses the same completion semantics as the admin PUT path so the two
// stay behaviour-consistent:
//   - a ride can only be COMPLETED from ASSIGNED (soft-deleted rides are 404);
//   - a valid totalRideTime (>= 0.1h) is required (issue #10) — otherwise the
//     ride completes with null/zero hours and skews the hours metrics (#18);
//   - on success it writes a RIDE_COMPLETED audit row (issue #28) and sends the
//     RIDE_COMPLETED notification + admin emails (same side-effects as PUT).
const completeSchema = z
  .object({
    // Mirror the issue #10 guard in server/api/put/rides/[id].ts.
    totalRideTime: z.number().min(0.1),
  })
  .strict()

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Ride ID is required' })
  }

  // Session resolved by the global auth middleware (server/middleware/auth.ts).
  const session = getAuth(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Validate the body before any writes (issue #31): a missing/zero/negative
  // duration is a 400 here, mirroring the admin PUT completion guard (#10).
  const { totalRideTime } = await readValidatedBody(event, completeSchema)

  // Soft delete (issue #27): an archived ride can't be completed — treat as 404.
  const ride = await prisma.ride.findFirst({
    where: { id, deletedAt: null },
    include: {
      volunteer: { include: { user: true } },
      client: { include: { user: true } },
    },
  })

  if (!ride) {
    throw createError({ statusCode: 404, statusMessage: 'Ride not found' })
  }

  // Authorization: an ADMIN, or the volunteer actually assigned to this ride.
  // A logged-in non-owner gets 404 (not 403) so the endpoint doesn't reveal
  // another volunteer's ride assignment (mirrors GET rides/byId scoping, #41).
  const isAdmin = session.user.role === 'ADMIN'
  const isOwner = !!ride.volunteer && ride.volunteer.userId === session.user.id
  if (!isAdmin && !isOwner) {
    throw createError({ statusCode: 404, statusMessage: 'Ride not found' })
  }

  // State guard: only an ASSIGNED ride can be completed. Rejecting
  // CREATED/COMPLETED/CANCELLED here keeps the ride state machine honest.
  if (ride.status !== 'ASSIGNED') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only an assigned ride can be completed',
    })
  }

  // Atomic transition (mirrors signup/unsignup, issue #12): guard the write on
  // the exact state we validated — still ASSIGNED AND still assigned to the same
  // volunteer — so a concurrent unassign OR reassignment can't race it. Pinning
  // volunteerId (as unsignup pins it) is what stops the read→write window where
  // an admin reassigns the ride while an owner is completing it, which would
  // otherwise credit the new volunteer with this caller's reported hours. If the
  // ride is no longer this ASSIGNED, same-volunteer ride, Prisma throws P2025 → 409.
  let updated
  try {
    updated = await prisma.ride.update({
      where: { id, status: 'ASSIGNED', volunteerId: ride.volunteerId, deletedAt: null },
      data: { status: 'COMPLETED', totalRideTime },
      include: {
        volunteer: { include: { user: true } },
        client: { include: { user: true } },
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Ride is no longer available to complete',
      })
    }
    throw err
  }

  // Audit (issue #28): a status transition to COMPLETED. Mirrors the PUT path's
  // status-derived RIDE_COMPLETED action + minimal { from, to } details.
  await writeAuditLog(event, {
    action: 'RIDE_COMPLETED',
    targetType: 'Ride',
    targetId: updated.id,
    details: { from: ride.status, to: updated.status },
  })

  // Notifications (mirror the PUT COMPLETED transition): notify the volunteer
  // and the admins. Email sends are swallowed in the test env (issue #25).
  const scheduledTime = new Date(updated.scheduledTime)
  const commonContext = {
    client: updated.client.user.name,
    pickup: updated.pickupDisplay,
    dropoff: updated.dropoffDisplay,
    date: formatNotificationDate(scheduledTime),
    time: formatNotificationTime(scheduledTime),
    link: `${process.env.APP_URL || 'http://localhost:3000'}/rides/${updated.id}`,
    notes: updated.notes || 'None',
  }

  if (updated.volunteer) {
    await sendNotification('RIDE_COMPLETED', updated.volunteer.id, {
      name: updated.volunteer.user.name,
      ...commonContext,
    })
  }

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
  admins
    .map((admin) => admin.email)
    .filter(Boolean)
    .forEach((email) => {
      if (email) {
        sendEmail(
          email,
          'Ride Completed by Volunteer',
          `
            <h1>Ride Completed</h1>
            <p><strong>Volunteer:</strong> ${updated.volunteer?.user?.name || 'N/A'}</p>
            <p><strong>Ride Details:</strong></p>
            <p><strong>From:</strong> ${updated.pickupDisplay}</p>
            <p><strong>To:</strong> ${updated.dropoffDisplay}</p>
            <p><strong>Total Time:</strong> ${updated.totalRideTime || 'N/A'} hours</p>
          `
        ).catch(console.error)
      }
    })

  return updated
})
