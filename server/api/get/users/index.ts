import { Prisma } from '../../../../prisma/generated/client'
import { prisma } from '../../../utils/prisma'
import { getPageParams } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  // Admin management data (issue #41): the full user table is PII.
  requireAdmin(event)

  const { page, pageSize, skip, take } = getPageParams(event)

  // Soft delete (issue #27): hide archived users from the active list.
  const where: Prisma.UserWhereInput = { deletedAt: null }

  // Server-side pagination (issue #13): bounded page + matching count. This
  // list was the one #13 missed (issue #97); mirror the volunteers/admins
  // envelope so a growing user table can never be loaded whole into memory.
  // `id` is a random uuid, so it also serves as a stable, deterministic sort
  // key that keeps page walks from dropping/duplicating rows.
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, orderBy: { id: 'asc' }, skip, take }),
    prisma.user.count({ where }),
  ])

  return { items, total, page, pageSize }
})
