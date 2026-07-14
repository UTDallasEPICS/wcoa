import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { broadcastNotification } from '../../../utils/notification'
import { readValidatedBody } from '../../../utils/validation'

// Validate the create payload up front (issue #90) so malformed input becomes a
// clean 400 instead of a raw 500 out of Prisma: a non-object pickup/dropoff, an
// unparseable scheduledTime, or unknown keys are all rejected here. A
// well-formed but nonexistent clientId/volunteerId is checked below (a bare FK
// violation would otherwise surface as a 500). Mirrors the zod + .strict()
// pattern established for put/rides in issue #31.
const addressSchema = z
  .object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
  })
  .strict()

const isParseableDate = (s: string) => !Number.isNaN(Date.parse(s))

const createRideSchema = z
  .object({
    clientId: z.string().min(1),
    pickup: addressSchema,
    dropoff: addressSchema,
    scheduledTime: z.string().min(1).refine(isParseableDate, 'scheduledTime must be a valid date'),
    pickupTime: z
      .string()
      .refine((s) => s === '' || isParseableDate(s), 'pickupTime must be a valid date')
      .nullable()
      .optional(),
    notes: z.string().nullable().optional(),
    volunteerId: z.string().nullable().optional(),
  })
  .strict()

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, createRideSchema)

  // A well-formed but nonexistent clientId would trip a foreign-key violation in
  // prisma.ride.create and surface as a 500 (issue #90). Resolve it first so the
  // caller gets a clean 400 — and so we don't leave orphan Address rows behind
  // from the upserts below on the failure path.
  const client = await prisma.client.findFirst({
    where: { id: body.clientId, deletedAt: null },
  })
  if (!client) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid clientId: no such client',
    })
  }

  const volunteerId = body.volunteerId && body.volunteerId.trim() !== '' ? body.volunteerId : null
  if (volunteerId) {
    const volunteer = await prisma.volunteer.findFirst({
      where: { id: volunteerId, deletedAt: null },
    })
    if (!volunteer) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid volunteerId: no such volunteer',
      })
    }
  }

  // Helper to find or create address
  const resolveAddress = async (addr: {
    street: string
    city: string
    state: string
    zip: string
  }) => {
    // Normalize before the upsert so case/whitespace-variant addresses collapse
    // onto the unique matchKey (issues #16, #57). Display fields keep original
    // casing; only matchKey is lowercased for dedup.
    const normalized = normalizeAddress(addr)
    return await prisma.address.upsert({
      where: {
        matchKey: normalized.matchKey,
      },
      update: {},
      create: normalized,
    })
  }

  const pickupAddress = await resolveAddress(body.pickup)
  const dropoffAddress = await resolveAddress(body.dropoff)

  const pickupDisplay = `${body.pickup.street}, ${body.pickup.city}, ${body.pickup.state} ${body.pickup.zip}`
  const dropoffDisplay = `${body.dropoff.street}, ${body.dropoff.city}, ${body.dropoff.state} ${body.dropoff.zip}`

  const ride = await prisma.ride.create({
    data: {
      clientId: body.clientId,
      pickupDisplay,
      dropoffDisplay,
      pickupAddressId: pickupAddress.id,
      dropoffAddressId: dropoffAddress.id,
      scheduledTime: new Date(body.scheduledTime),
      pickupTime: body.pickupTime ? new Date(body.pickupTime) : undefined,
      notes: body.notes ?? undefined,
      volunteerId: volunteerId ?? undefined,
      status: volunteerId ? 'ASSIGNED' : 'CREATED',
    },
  })

  // Audit (issue #28): record the ride creation after it succeeds.
  await writeAuditLog(event, {
    action: 'RIDE_CREATED',
    targetType: 'Ride',
    targetId: ride.id,
    details: { clientId: ride.clientId, status: ride.status },
  })

  // Notify all volunteers
  const scheduledTime = new Date(body.scheduledTime)

  // Fire-and-forget the broadcast (issue #32): the ride is created, so return it
  // immediately instead of blocking the response on N sequential SMTP sends. A
  // slow or failing broadcast must not delay or fail ride creation, so we don't
  // await it and swallow any error in the background (mirrors signup.ts).
  broadcastNotification('RIDE_CREATED', {
    pickup: pickupDisplay,
    dropoff: dropoffDisplay,
    date: formatNotificationDate(scheduledTime),
    time: formatNotificationTime(scheduledTime),
    link: `${process.env.APP_URL || 'http://localhost:3000'}/rides/${ride.id}`,
  }, event).catch(console.error)

  return ride
})
