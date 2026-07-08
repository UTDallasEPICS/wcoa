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
    // onto the @@unique([street, city, state, zip]) key (issue #16).
    const normalized = normalizeAddress(addr)
    return await prisma.address.upsert({
      where: {
        street_city_state_zip: normalized,
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
  const formattedTime = new Date(body.scheduledTime).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'full',
    timeStyle: 'short',
  })

  await broadcastNotification('RIDE_CREATED', {
    pickup: pickupDisplay,
    dropoff: dropoffDisplay,
    date: formattedTime.split(',')[0], // Approximate date
    time: formattedTime,
    link: `${process.env.APP_URL || 'http://localhost:3000'}/rides/${ride.id}`,
  })

  return ride
})
