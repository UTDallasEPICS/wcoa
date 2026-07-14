import { Prisma } from '../../../../prisma/generated/client'
import { prisma } from '../../../utils/prisma'
import { getPageParams, getStringParam } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  // Bulk client roster carries full PII (name/phone/address) and is only used
  // by admin-facing UI — keep it admin-only (issue #3).
  requireAdmin(event)

  const { page, pageSize, skip, take } = getPageParams(event)
  const search = getStringParam(event, 'search')

  // Soft delete (issue #27): hide archived clients from the active roster.
  const where: Prisma.ClientWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          user: {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          },
        }
      : {}),
  }

  // Server-side pagination (issue #13): skip/take + a matching count in one
  // transaction, so the roster is bounded and the total stays consistent.
  const [items, total] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      include: { user: true, homeAddress: true },
      // `id` tiebreaker keeps clients with identical names in a stable order
      // across pages (skip/take is otherwise non-deterministic on ties).
      orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
      skip,
      take,
    }),
    prisma.client.count({ where }),
  ])

  return { items, total, page, pageSize }
})
