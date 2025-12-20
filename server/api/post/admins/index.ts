import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.name || !body.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name and Email are required',
    })
  }

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: body.email },
  })

  if (existingUser) {
    // If user exists, update role to ADMIN
    return await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: 'ADMIN',
        name: body.name,
        phone: body.phone,
      },
    })
  } else {
    // Create new user
    return await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        role: 'ADMIN',
      },
    })
  }
})
