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

  // Data scoping (issue #3): a VOLUNTEER must only receive rides that are
  // available to sign up for (CREATED) or that are assigned to them — never
  // other volunteers' rides or the full roster of client PII. ADMINs see all.
  let where: Prisma.RideWhereInput | undefined
  if (role !== 'ADMIN') {
    where = {
      OR: [{ status: 'CREATED' }, { volunteer: { userId: session?.user?.id } }],
    }
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
