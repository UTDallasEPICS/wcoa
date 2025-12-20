import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.clientId || !body.pickupDisplay || !body.dropoffDisplay || !body.scheduledTime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields',
    })
  }

  return await prisma.ride.create({
    data: {
      clientId: body.clientId,
      pickupDisplay: body.pickupDisplay,
      dropoffDisplay: body.dropoffDisplay,
      scheduledTime: new Date(body.scheduledTime),
      notes: body.notes,
      status: 'CREATED',
    },
  })
})
