import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.clientId || !body.pickup || !body.dropoff || !body.scheduledTime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields',
    })
  }

  // Helper to find or create address
  const resolveAddress = async (addr: { street: string; city: string; state: string; zip: string }) => {
    return await prisma.address.upsert({
      where: {
        street_city_state_zip: {
          street: addr.street,
          city: addr.city,
          state: addr.state,
          zip: addr.zip,
        },
      },
      update: {},
      create: {
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
      },
    })
  }

  const pickupAddress = await resolveAddress(body.pickup)
  const dropoffAddress = await resolveAddress(body.dropoff)

  const pickupDisplay = `${body.pickup.street}, ${body.pickup.city}, ${body.pickup.state} ${body.pickup.zip}`
  const dropoffDisplay = `${body.dropoff.street}, ${body.dropoff.city}, ${body.dropoff.state} ${body.dropoff.zip}`

  return await prisma.ride.create({
    data: {
      clientId: body.clientId,
      pickupDisplay,
      dropoffDisplay,
      pickupAddressId: pickupAddress.id,
      dropoffAddressId: dropoffAddress.id,
      scheduledTime: new Date(body.scheduledTime),
      notes: body.notes,
      status: 'CREATED',
    },
  })
})
