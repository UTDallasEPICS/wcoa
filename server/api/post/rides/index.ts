import { prisma } from '../../../utils/prisma'
import { broadcastNotification } from '../../../utils/notification'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.clientId || !body.pickup || !body.dropoff || !body.scheduledTime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields',
    })
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
      notes: body.notes,
      volunteerId: body.volunteerId ? body.volunteerId : undefined,
      status: body.volunteerId ? 'ASSIGNED' : 'CREATED',
    },
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
