import { prisma } from '../../../utils/prisma'

// How many rows we ever return in one call. Audit logs grow unbounded over
// time, so this endpoint is capped (issue #13 — never return unbounded lists).
const MAX_LIMIT = 100

export default defineEventHandler(async (event) => {
  // Admin-only (issue #28). Mirrors the metrics routes' requireAdmin guard —
  // the global middleware already enforces authentication.
  requireAdmin(event)

  const query = getQuery(event)

  // Optional filters: by action string and/or by acting user id.
  const where: { action?: string; userId?: string } = {}
  if (typeof query.action === 'string' && query.action.trim() !== '') {
    where.action = query.action.trim()
  }
  if (typeof query.userId === 'string' && query.userId.trim() !== '') {
    where.userId = query.userId.trim()
  }

  // Bounded page size (1..MAX_LIMIT), newest first.
  const requested = Number.parseInt(String(query.limit ?? ''), 10)
  const take =
    Number.isFinite(requested) && requested > 0
      ? Math.min(requested, MAX_LIMIT)
      : MAX_LIMIT

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
  })

  return logs
})
