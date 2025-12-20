import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  const client = await prisma.client.findUnique({
    where: { id },
  })

  if (!client) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Client not found',
    })
  }

  return await prisma.$transaction(async (tx) => {
    // Update User
    if (body.name || body.email || body.phone) {
      await tx.user.update({
        where: { id: client.userId },
        data: {
          name: body.name,
          email: body.email,
          phone: body.phone,
        },
      })
    }

    // Update Address (Link to new/existing address)
    if (body.street && body.city && body.state && body.zip) {
      const addressData = {
        street: body.street,
        city: body.city,
        state: body.state,
        zip: body.zip,
      }

      const address = await tx.address.upsert({
        where: {
          street_city_state_zip: addressData,
        },
        update: {},
        create: addressData,
      })

      await tx.client.update({
        where: { id },
        data: {
          homeAddressId: address.id,
        },
      })
    }

    return await tx.client.findUnique({
      where: { id },
      include: {
        user: true,
        homeAddress: true,
      },
    })
  })
})
