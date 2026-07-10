import { Prisma } from '../../../../prisma/generated/client'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Admin ID is required',
    })
  }

  // Soft delete (issue #27): archive the user instead of destroying it. Read the
  // current contact values so we can RELEASE them: copy email -> deletedEmail and
  // phone -> deletedPhone, then null out email/phone so the same email/phone can
  // be reused by a new record without a unique violation (decision #2). Guard on
  // deletedAt: null so a second delete 404s (P2025) rather than re-archiving.
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { email: true, phone: true },
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Admin not found' })
  }

  try {
    return await prisma.user.update({
      where: { id, deletedAt: null },
      data: {
        deletedAt: new Date(),
        deletedEmail: existing.email,
        deletedPhone: existing.phone,
        email: null,
        phone: null,
      },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw createError({ statusCode: 404, statusMessage: 'Admin not found' })
    }
    throw err
  }
})
