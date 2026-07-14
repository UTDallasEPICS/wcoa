import { prisma } from '../../../utils/prisma'

// Bounded options list for the "select a client" dropdown in the create-ride
// form (app/pages/rides/index.vue). The full roster endpoint (./index) is now
// paginated for issue #13, but the dropdown needs every active client at once —
// so this dedicated endpoint returns a minimal, still-bounded shape.
//
// Minimal shape: id + name for the label, plus homeAddress so selecting a
// client can auto-fill the pickup address (existing behavior). No phone/email.
const OPTIONS_CAP = 500

export default defineEventHandler(async (event) => {
  // Client names/addresses are PII and only the admin create-ride UI uses this.
  requireAdmin(event)

  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      user: { select: { name: true } },
      homeAddress: true,
    },
    orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
    take: OPTIONS_CAP,
  })

  return clients.map((c) => ({
    id: c.id,
    name: c.user?.name ?? '',
    homeAddress: c.homeAddress,
  }))
})
