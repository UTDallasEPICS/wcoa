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
  //
  // Issue #8: deleting only the Volunteer profile left an orphaned User (role
  // VOLUNTEER, no profile) that crashes frontend queries reading
  // user.volunteer.id. Delete the underlying User instead — Volunteer.user is
  // onDelete: Cascade, so this removes the volunteer row too, leaving no
  // orphan. The reset rides keep pointing at null (ride->volunteer FK is SET
  // NULL), so historical/available rides are unaffected. (Roles are singular in
  // this app, so a User won't also hold a client profile.)
  return await prisma.$transaction(async (tx) => {
    const volunteer = await tx.volunteer.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!volunteer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Volunteer not found',
      })
    }

    await tx.ride.updateMany({
      where: { volunteerId: id, status: 'ASSIGNED' },
      data: { status: 'CREATED' },
    })

    return await tx.user.delete({
      where: { id: volunteer.userId },
    })
  })
})
