import { prisma } from '../../../utils/prisma'

export default defineEventHandler((event) => {
  // Admin management data (issue #41): the full user table is PII.
  requireAdmin(event)
  // Soft delete (issue #27): hide archived users from the active list.
  return prisma.user.findMany({ where: { deletedAt: null } })
})
