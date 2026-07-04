import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Client addresses are PII (issue #41). Only the create-ride autocomplete
  // uses this, and that form is admin-only (rides/index.vue gates it behind
  // isAdmin; #3 already made the sibling clients/volunteers lists admin-only).
  requireAdmin(event)

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
