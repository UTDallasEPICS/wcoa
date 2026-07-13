import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Admin roster is management data / PII (issue #41). Consumer: people.vue,
  // an admin-only page (volunteers are redirected by the route guard).
  requireAdmin(event)

  // Soft delete (issue #27): hide archived admins from the active roster.
  return await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      deletedAt: null,
    },
    orderBy: {
      name: 'asc',
    },
  })
})
