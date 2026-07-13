import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Bulk volunteer roster carries full PII and is only used by admin-facing UI
  // (create/edit-ride volunteer picker, people page) — keep it admin-only (issue #3).
  requireAdmin(event)

  // Soft delete (issue #27): hide archived volunteers from the active roster.
  return await prisma.volunteer.findMany({
    where: { deletedAt: null },
    include: {
      user: true,
    },
    orderBy: {
      user: {
        name: 'asc',
      },
    },
  })
})
