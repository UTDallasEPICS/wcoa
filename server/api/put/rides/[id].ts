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

  const updateData: any = { ...body }
  if (updateData.scheduledTime) {
    updateData.scheduledTime = new Date(updateData.scheduledTime)
  }

  return await prisma.ride.update({
    where: { id },
    data: updateData,
  })
})
