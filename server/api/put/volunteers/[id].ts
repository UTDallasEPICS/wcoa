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

  const volunteer = await prisma.volunteer.findUnique({
    where: { id },
  })

  if (!volunteer) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Volunteer not found',
    })
  }

  // Transaction to update both
  return await prisma.$transaction(async (tx) => {
    // Update User
    if (body.name || body.email || body.phone) {
      await tx.user.update({
        where: { id: volunteer.userId },
        data: {
          name: body.name,
          email: body.email,
          phone: body.phone,
        },
      })
    }

    // Update Volunteer
    return await tx.volunteer.update({
      where: { id },
      data: {
        status: body.status,
      },
      include: {
        user: true,
        reminders: true,
      },
    })
  })
})
