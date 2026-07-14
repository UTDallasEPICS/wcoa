import { prisma } from '../../../utils/prisma'

// Bounded options list for the volunteer-assignment dropdowns in the create-ride
// form (app/pages/rides/index.vue) and the edit-ride modal
// (app/pages/rides/[id].vue). The full roster endpoint (./index) is paginated
// for issue #13; these pickers need the assignable roster at once.
//
// Only AVAILABLE volunteers can be assigned, so the picker only lists those.
// Minimal shape: id + name (no phone/email PII). Still hard-capped so it can
// never become an unbounded query (the issue #13 point).
const OPTIONS_CAP = 500

export default defineEventHandler(async (event) => {
  // Only the admin create/edit-ride UI assigns volunteers.
  requireAdmin(event)

  const volunteers = await prisma.volunteer.findMany({
    where: { deletedAt: null, status: 'AVAILABLE' },
    select: {
      id: true,
      user: { select: { name: true } },
    },
    orderBy: { user: { name: 'asc' } },
    take: OPTIONS_CAP,
  })

  return volunteers.map((v) => ({
    id: v.id,
    name: v.user?.name ?? '',
  }))
})
