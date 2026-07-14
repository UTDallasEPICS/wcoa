import { prisma } from '../../../utils/prisma'

// Bounded options list for the volunteer-assignment dropdowns in the create-ride
// form (app/pages/rides/index.vue) and the edit-ride modal
// (app/pages/rides/[id].vue). The full roster endpoint (./index) is paginated
// for issue #13; these pickers need the assignable roster at once.
//
// Returns ALL non-deleted volunteers (not just AVAILABLE): on main the pickers
// used /api/get/volunteers, which returned every status, so an admin could
// assign any volunteer. Issue #13 is a pagination change and must not narrow
// assignment policy. Minimal shape: id + name (no phone/email PII). Hard-capped
// so it can never become an unbounded query (the issue #13 point).
const OPTIONS_CAP = 500

export default defineEventHandler(async (event) => {
  // Only the admin create/edit-ride UI assigns volunteers.
  requireAdmin(event)

  const volunteers = await prisma.volunteer.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      user: { select: { name: true } },
    },
    orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
    take: OPTIONS_CAP,
  })

  return volunteers.map((v) => ({
    id: v.id,
    name: v.user?.name ?? '',
  }))
})
