import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async () => {
  return await prisma.client.findMany({
    include: {
      user: true,
    },
    orderBy: {
      user: {
        name: 'asc',
      },
    },
  })
})
