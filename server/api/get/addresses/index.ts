import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = query.search as string

  const where = search ? {
    OR: [
      { street: { contains: search } },
      { city: { contains: search } },
      { zip: { contains: search } }
    ]
  } : {}

  const addresses = await prisma.address.findMany({
    where,
    take: 20,
    orderBy: {
      street: 'asc'
    }
  })

  return addresses.map(a => ({
    id: a.id,
    label: `${a.street}, ${a.city}, ${a.state} ${a.zip}`,
    address: a 
  }))
})
