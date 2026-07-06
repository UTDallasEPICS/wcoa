import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  // Issue #23: volunteerId is optional, so the ride->volunteer FK is ON DELETE
  // SET NULL — deleting a volunteer doesn't crash, but their ASSIGNED rides
  // keep status ASSIGNED with no volunteer (the stuck state from #7). Reset
  // those rides back to CREATED so they return to the available pool, then
  // delete the volunteer. Do both atomically so we can't leave rides stuck if
  // the delete fails.
  return await prisma.$transaction(async (tx) => {
    await tx.ride.updateMany({
      where: { volunteerId: id, status: 'ASSIGNED' },
      data: { status: 'CREATED' },
    })

    return await tx.volunteer.delete({
      where: { id },
    })
  })
})
