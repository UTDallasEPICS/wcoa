import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.name || !body.street || !body.city || !body.state || !body.zip) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields',
    })
  }

  // 1. Upsert User
  let user = null
  if (body.email) {
    user = await prisma.user.findUnique({
      where: { email: body.email }
    })
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email || null,
        phone: body.phone,
        role: 'CLIENT'
      }
    })
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        phone: body.phone,
        // Don't downgrade ADMIN/VOLUNTEER
      }
    })
  }

  // 2. Upsert Address
  // Using findFirst because unique constraint might not match perfectly if we don't normalize
  // But strictly, we should use upsert or findUnique if strictly defined
  // The schema has @@unique([street, city, state, zip])
  const addressData = {
    street: body.street,
    city: body.city,
    state: body.state,
    zip: body.zip,
  }

  const address = await prisma.address.upsert({
    where: {
      street_city_state_zip: addressData
    },
    update: {},
    create: addressData
  })

  // 3. Create Client profile
  const existingClient = await prisma.client.findUnique({
    where: { userId: user.id }
  })

  if (existingClient) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User is already a client',
    })
  }

  return await prisma.client.create({
    data: {
      userId: user.id,
      homeAddressId: address.id
    },
    include: {
      user: true,
      homeAddress: true
    }
  })
})
