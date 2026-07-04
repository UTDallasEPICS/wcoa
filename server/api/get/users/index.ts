import { prisma } from '../../../utils/prisma'

export default defineEventHandler((event) => {
  // Admin management data (issue #41): the full user table is PII.
  requireAdmin(event)
  return prisma.user.findMany()
})
