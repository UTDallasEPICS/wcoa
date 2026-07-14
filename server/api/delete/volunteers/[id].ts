import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  // Issue #23: volunteerId is optional, so deleting a volunteer doesn't crash,
  // but their ASSIGNED rides would keep status ASSIGNED with no active volunteer
  // (the stuck state from #7). Reset those rides back to CREATED so they return
  // to the available pool, then archive the volunteer. Do it all atomically.
  //
  // Issue #8 / #27: soft-delete the underlying User AND the Volunteer row
  // together (roles are singular, so a User won't also hold a client profile).
  // On the user we RELEASE the unique contact values (email -> deletedEmail,
  // phone -> deletedPhone, then null email/phone) so the same email/phone can be
  // reused by a new record without a unique violation (decision #2). We clear
  // volunteerId on their ASSIGNED rides so the available-rides scoping (which
  // still sees CREATED rides) doesn't leak the archived volunteer's link.
  const result = await prisma.$transaction(async (tx) => {
    const volunteer = await tx.volunteer.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true, user: { select: { email: true, phone: true } } },
    })
    if (!volunteer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Volunteer not found',
      })
    }

    await tx.ride.updateMany({
      where: { volunteerId: id, status: 'ASSIGNED' },
      data: { status: 'CREATED', volunteerId: null },
    })

    const now = new Date()
    await tx.volunteer.update({
      where: { id, deletedAt: null },
      data: { deletedAt: now },
    })
    const updated = await tx.user.update({
      where: { id: volunteer.userId, deletedAt: null },
      data: {
        deletedAt: now,
        deletedEmail: volunteer.user.email,
        deletedPhone: volunteer.user.phone,
        email: null,
        phone: null,
      },
    })
    // Revoke sessions (issue #27, decision #1): a hard delete used to cascade to
    // the session table and log the user out. Soft delete must do the same
    // explicitly, or an archived volunteer's live cookie would keep API access.
    await tx.session.deleteMany({ where: { userId: volunteer.userId } })
    return updated
  })

  // Audit (issue #28): record the archival after the transaction commits.
  await writeAuditLog(event, {
    action: 'VOLUNTEER_DELETED',
    targetType: 'Volunteer',
    targetId: id,
  })

  return result
})
