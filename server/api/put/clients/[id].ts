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

  // Soft delete (issue #27): an archived client can't be edited — treat as 404.
  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  })

  if (!client) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Client not found',
    })
  }

  return await prisma.$transaction(async (tx) => {
    // Update User
    if (body.name || body.email !== undefined || body.phone !== undefined) {
      await tx.user.update({
        where: { id: client.userId },
        data: {
          name: body.name,
          email: body.email || null,
          phone: emptyToNull(body.phone),
        },
      })
    }

    // Update Address (Link to new/existing address)
    if (body.street && body.city && body.state && body.zip) {
      // Normalize first so case/whitespace-variant addresses collapse onto the
      // @@unique([street, city, state, zip]) key (issue #16).
      const addressData = normalizeAddress({
        street: body.street,
        city: body.city,
        state: body.state,
        zip: body.zip,
      })

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
