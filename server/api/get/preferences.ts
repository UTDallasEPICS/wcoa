import { prisma } from '../../utils/prisma'

// The current user's cross-device UI preferences (rides list filter/sort).
// Returns a normalised shape; a user who has never saved gets nulls/false so
// the client applies its own sensible defaults (active work, newest first).
//
// Auth: the global middleware (server/middleware/auth.ts) already requires a
// session for every /api route, so event.context.auth is present here. The
// preference is always the caller's own — there is no id in the path.
export default defineEventHandler(async (event) => {
  const session = event.context.auth as { user: { id: string } } | undefined
  const userId = session?.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const pref = await prisma.userPreference.findUnique({ where: { userId } })

  return {
    // Stored as a CSV string (SQLite has no scalar arrays); expose an array so
    // the client doesn't have to parse. null = never set -> client default.
    rideStatusFilter:
      pref?.rideStatusFilter != null ? pref.rideStatusFilter.split(',').filter(Boolean) : null,
    rideSort: pref?.rideSort ?? null,
    rideAssignedToMeOnly: pref?.rideAssignedToMeOnly ?? false,
  }
})
