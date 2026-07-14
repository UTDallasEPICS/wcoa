import { Prisma } from '../../../../prisma/generated/client'
import { prisma } from '../../../utils/prisma'
import { getPageParams, getStringParam } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  // Bulk volunteer roster carries full PII and is only used by admin-facing UI
  // (people page). The assignment pickers use /api/get/volunteers/options
  // instead — keep this admin-only (issue #3).
  requireAdmin(event)

  const { page, pageSize, skip, take } = getPageParams(event)
  const search = getStringParam(event, 'search')
  const statusFilter = getStringParam(event, 'status')

  // Soft delete (issue #27): hide archived volunteers from the active roster.
  const where: Prisma.VolunteerWhereInput = {
    deletedAt: null,
    ...(statusFilter === 'AVAILABLE' || statusFilter === 'UNAVAILABLE'
      ? { status: statusFilter }
      : {}),
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

  // Server-side pagination (issue #13): bounded page + matching count.
  const [items, total] = await prisma.$transaction([
    prisma.volunteer.findMany({
      where,
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
      skip,
      take,
    }),
    prisma.volunteer.count({ where }),
  ])

  return { items, total, page, pageSize }
})
