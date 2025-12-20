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

  return await prisma.user.update({
    where: { id },
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
    },
  })
})
