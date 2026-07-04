import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Admin roster is management data / PII (issue #41). Consumer: people.vue,
  // an admin-only page (volunteers are redirected by the route guard).
  requireAdmin(event)

  return await prisma.user.findMany({
    where: {
      role: 'ADMIN',
    },
    orderBy: {
      name: 'asc',
    },
  })
})
