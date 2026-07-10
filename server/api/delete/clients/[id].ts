import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  // Issue #23: a client with existing rides is still blocked with a clear 409
  // (rather than crashing or orphaning). Soft delete (issue #27) preserves
  // historical rides regardless, but keeping the block avoids archiving a client
  // out from under their active/upcoming rides — reassign or archive those first.
  const rideCount = await prisma.ride.count({
    where: { clientId: id, deletedAt: null },
  })
  if (rideCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'Cannot delete a client with existing rides — reassign or archive them first',
    })
  }

  // Issue #8 / #27: soft-delete the underlying User AND the Client row together
  // (roles are singular, so a User won't also hold a volunteer profile). On the
  // user we also RELEASE the unique contact values (email -> deletedEmail,
  // phone -> deletedPhone, then null email/phone) so a new client can reuse the
  // same email/phone without a unique violation (decision #2). Do both writes in
  // a transaction so we can't leave a half-archived record.
  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
    select: { userId: true, user: { select: { email: true, phone: true } } },
  })
  if (!client) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Client not found',
    })
  }

  const now = new Date()
  return await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id },
      data: { deletedAt: now },
    })
    return await tx.user.update({
      where: { id: client.userId },
      data: {
        deletedAt: now,
        deletedEmail: client.user.email,
        deletedPhone: client.user.phone,
        email: null,
        phone: null,
      },
    })
  })
})
