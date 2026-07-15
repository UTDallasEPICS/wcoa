import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { sendEmail } from '../../../utils/email'
import { sendNotification } from '../../../utils/notification'
import { readValidatedBody } from '../../../utils/validation'

// Whitelist of the ONLY fields an update may set (issue #31). Anything else
// (clientId, createdAt, address ids, unknown keys, …) is rejected with a 400
// rather than mass-assigned into prisma.ride.update. All fields are optional so
// partial updates (e.g. the "mark complete" flow sending only status +
// totalRideTime) still work; unknown keys are rejected via .strict().
const updateRideSchema = z
  .object({
    status: z.enum(['CREATED', 'ASSIGNED', 'COMPLETED', 'CANCELLED']).optional(),
    // Empty string means "unassign"; handled below into null.
    volunteerId: z.string().nullable().optional(),
    scheduledTime: z.string().min(1).optional(),
    pickupTime: z.string().min(1).nullable().optional(),
    totalRideTime: z.number().optional(),
    notes: z.string().nullable().optional(),
    pickupDisplay: z.string().min(1).optional(),
    dropoffDisplay: z.string().min(1).optional(),
  })
  .strict()

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  const body = await readValidatedBody(event, updateRideSchema)

  // Fetch existing ride to check previous state.
  // Soft delete (issue #27): an archived ride can't be updated/completed — 404.
  const existingRide = await prisma.ride.findFirst({
    where: { id, deletedAt: null },
    include: {
      volunteer: {
        include: { user: true },
      },
      client: {
        include: { user: true },
      },
    },
  })

  if (!existingRide) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ride not found',
    })
  }

  // Issue #95: COMPLETED and CANCELLED are terminal states. Reject an explicit
  // status change *out* of one of them. e.g. sending {status:'CREATED'} to a
  // COMPLETED ride would re-enter it into the signup pool while keeping its
  // stale totalRideTime, silently corrupting completion metrics; CANCELLED→
  // ASSIGNED is likewise wrong. This fires only when the caller explicitly
  // sends a *different* status, so same-status no-op edits (e.g. editing a
  // COMPLETED ride's notes with status:'COMPLETED') stay allowed, and the
  // implicit ASSIGNED→CREATED unassign auto-reset below — which runs only when
  // body.status is undefined — is untouched. Forward transitions (CREATED↔
  // ASSIGNED, ASSIGNED→COMPLETED, CREATED/ASSIGNED→CANCELLED) all still work.
  const TERMINAL = ['COMPLETED', 'CANCELLED']
  if (
    body.status !== undefined &&
    body.status !== existingRide.status &&
    TERMINAL.includes(existingRide.status)
  ) {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot change the status of a ${existingRide.status.toLowerCase()} ride`,
    })
  }

  // Issue #10: a ride can only be marked COMPLETED with a valid duration.
  // The Complete modal (app/pages/rides/[id].vue) already enforces
  // totalRideTime >= 0.1 via zod, but a direct API call could complete a ride
  // with no duration — producing "Total Time: N/A" in the admin email and a
  // completed ride with null hours that skews the metrics (#18). Require a
  // valid totalRideTime either on this request OR already stored on the ride
  // (so re-updating an already-completed ride without re-sending it still works).
  if (body.status === 'COMPLETED') {
    const effectiveRideTime =
      body.totalRideTime !== undefined ? body.totalRideTime : existingRide.totalRideTime
    if (effectiveRideTime == null || effectiveRideTime < 0.1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'totalRideTime (at least 0.1 hours) is required to complete a ride',
      })
    }
  }

  // Build the Prisma update payload only from validated, whitelisted fields.
  const updateData: {
    status?: 'CREATED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED'
    volunteerId?: string | null
    scheduledTime?: Date
    pickupTime?: Date | null
    totalRideTime?: number
    notes?: string | null
    pickupDisplay?: string
    dropoffDisplay?: string
    cachedDistanceText?: string | null
    cachedDistanceValue?: number | null
    cachedDurationText?: string | null
    cachedDurationValue?: number | null
    estimatedAt?: Date | null
  } = {}

  if (body.status !== undefined) updateData.status = body.status
  if (body.totalRideTime !== undefined) updateData.totalRideTime = body.totalRideTime
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.pickupDisplay !== undefined) updateData.pickupDisplay = body.pickupDisplay
  if (body.dropoffDisplay !== undefined) updateData.dropoffDisplay = body.dropoffDisplay

  // Issue #14: a cached Maps estimate is only valid for the addresses it was
  // computed from. If either display address actually changes, invalidate the
  // cache (null all cache columns) so the next /estimate call re-fetches.
  const pickupChanged =
    body.pickupDisplay !== undefined && body.pickupDisplay !== existingRide.pickupDisplay
  const dropoffChanged =
    body.dropoffDisplay !== undefined && body.dropoffDisplay !== existingRide.dropoffDisplay
  if (pickupChanged || dropoffChanged) {
    updateData.cachedDistanceText = null
    updateData.cachedDistanceValue = null
    updateData.cachedDurationText = null
    updateData.cachedDurationValue = null
    updateData.estimatedAt = null
  }

  if (body.scheduledTime !== undefined) {
    updateData.scheduledTime = new Date(body.scheduledTime)
  }
  if (body.pickupTime !== undefined) {
    // null (or empty) clears the pickup time; a string sets it.
    updateData.pickupTime = body.pickupTime ? new Date(body.pickupTime) : null
  }

  // Handle volunteer assignment/unassignment (empty string => unassign)
  if (body.volunteerId !== undefined) {
    updateData.volunteerId =
      body.volunteerId && body.volunteerId.trim() !== '' ? body.volunteerId : null

    // Issue #7: unassigning a volunteer must also return the ride to the
    // available pool, otherwise it is left ASSIGNED with no volunteer — a stuck
    // state. Mirror the unsignup endpoint (volunteerId: null, status: 'CREATED').
    // Only auto-set CREATED when (a) the caller didn't explicitly request a
    // status (a deliberate COMPLETED must be respected), and (b) the ride was
    // actually ASSIGNED — never silently un-complete a COMPLETED ride, which
    // would drop it from completion metrics while leaving its totalRideTime.
    if (
      updateData.volunteerId === null &&
      body.status === undefined &&
      existingRide.status === 'ASSIGNED'
    ) {
      updateData.status = 'CREATED'
    }
  }

  const ride = await prisma.ride.update({
    where: { id },
    data: updateData,
    include: {
      volunteer: {
        include: { user: true },
      },
      client: {
        include: { user: true },
      },
    },
  })

  // Audit (issue #28): record ride lifecycle transitions after the update
  // succeeds. A volunteer change is logged as RIDE_ASSIGNED/RIDE_UNASSIGNED so
  // it stays distinct from a genuine status transition — otherwise an admin
  // unassigning a volunteer (which auto-resets status to CREATED, see above)
  // would log RIDE_CREATED and collide with actual ride creation in the trail.
  // Pure status changes (cancel/complete) log RIDE_<status>. details keep only
  // the from/to, never the full ride record.
  const statusChanged = ride.status !== existingRide.status
  const volunteerChanged = ride.volunteerId !== existingRide.volunteerId
  if (statusChanged || volunteerChanged) {
    const action = volunteerChanged
      ? ride.volunteerId === null
        ? 'RIDE_UNASSIGNED'
        : 'RIDE_ASSIGNED'
      : `RIDE_${ride.status}`
    await writeAuditLog(event, {
      action,
      targetType: 'Ride',
      targetId: ride.id,
      details: {
        from: existingRide.status,
        to: ride.status,
        ...(volunteerChanged
          ? { fromVolunteerId: existingRide.volunteerId, toVolunteerId: ride.volunteerId }
          : {}),
      },
    })
  }

  // Notifications
  const scheduledTime = new Date(ride.scheduledTime)
  const commonContext = {
    client: ride.client.user.name,
    pickup: ride.pickupDisplay,
    dropoff: ride.dropoffDisplay,
    date: formatNotificationDate(scheduledTime),
    time: formatNotificationTime(scheduledTime),
    link: `${process.env.APP_URL || 'http://localhost:3000'}/rides/${ride.id}`,
    notes: ride.notes || 'None',
  }

  // 1. RIDE_COMPLETED
  if (body.status === 'COMPLETED' && existingRide.status !== 'COMPLETED') {
    if (ride.volunteer) {
      await sendNotification('RIDE_COMPLETED', ride.volunteer.id, {
        name: ride.volunteer.user.name,
        ...commonContext,
      })
    }

    // Notify Admins (legacy/direct email)
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } })
    const adminEmails = admins.map((admin) => admin.email).filter(Boolean)

    adminEmails.forEach((email) => {
      if (email) {
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
      }
    })
  }

  // 2. RIDE_CANCELLED
  // Fires when an admin cancels a ride (status -> CANCELLED). Notify the
  // volunteer who was assigned before cancellation so they know the ride is off.
  if (body.status === 'CANCELLED' && existingRide.status !== 'CANCELLED') {
    const volunteerToNotify = existingRide.volunteer

    if (volunteerToNotify) {
      await sendNotification('RIDE_CANCELLED', volunteerToNotify.id, {
        name: volunteerToNotify.user.name,
        ...commonContext,
      })
    }
  }

  return ride
})
