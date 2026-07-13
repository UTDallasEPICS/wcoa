import { Prisma } from '../../../../prisma/generated/client'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const sort = query.sort === 'desc' ? 'desc' : 'asc'

  // The global auth middleware guarantees a session and stashes it here.
  const session = event.context.auth as
    | { user: { id: string; role?: string } }
    | undefined
  const role = session?.user?.role
  const userId = session?.user?.id

  // Data scoping (issue #3): a VOLUNTEER must only receive rides that are
  // available to sign up for (CREATED) or that are assigned to them — never
  // other volunteers' rides or the full roster of client PII. ADMINs see all.
  // Fail closed: if the user id is somehow absent, never widen past available
  // rides — { volunteer: { userId: undefined } } would make Prisma drop the
  // filter and match every assigned ride, leaking PII.
  // Soft delete (issue #27): archived rides are always hidden from active ride
  // views (both admin and volunteer). The scoping filter below is ANDed on top.
  const where: Prisma.RideWhereInput = { deletedAt: null }
  if (role !== 'ADMIN') {
    Object.assign(where, {
      OR: userId
        ? [{ status: 'CREATED' }, { volunteer: { userId } }]
        : [{ status: 'CREATED' }],
    })
  }

  return await prisma.ride.findMany({
    where,
    include: {
      client: {
        include: {
          user: true,
        },
      },
      volunteer: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      scheduledTime: sort,
    },
  })
})
