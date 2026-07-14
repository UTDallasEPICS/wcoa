import { Prisma } from '../../../../prisma/generated/client'
import { prisma } from '../../../utils/prisma'
import { getPageParams, getStringParam } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  // Admin roster is management data / PII (issue #41). Consumer: people.vue,
  // an admin-only page (volunteers are redirected by the route guard).
  requireAdmin(event)

  const { page, pageSize, skip, take } = getPageParams(event)
  const search = getStringParam(event, 'search')

  // Soft delete (issue #27): hide archived admins from the active roster.
  const where: Prisma.UserWhereInput = {
    role: 'ADMIN',
    deletedAt: null,
    ...(search
      ? {
          OR: [{ name: { contains: search } }, { email: { contains: search } }],
        }
      : {}),
  }

  // Server-side pagination (issue #13): bounded page + matching count.
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ])

  return { items, total, page, pageSize }
})
