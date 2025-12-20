import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async () => {
  return await prisma.user.findMany({
    where: {
      role: 'ADMIN',
    },
    orderBy: {
      name: 'asc',
    },
  })
})
