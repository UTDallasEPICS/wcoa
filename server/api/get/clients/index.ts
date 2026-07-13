import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Bulk client roster carries full PII (name/phone/address) and is only used
  // by admin-facing UI — keep it admin-only (issue #3).
  requireAdmin(event)

  // Soft delete (issue #27): hide archived clients from the active roster.
  return await prisma.client.findMany({
    where: { deletedAt: null },
    include: {
      user: true,
      homeAddress: true,
    },
    orderBy: {
      user: {
        name: 'asc',
      },
    },
  })
})
