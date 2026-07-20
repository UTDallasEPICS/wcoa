import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { readValidatedBody } from '../../utils/validation'

// The RideStatus values a status filter may contain (mirrors the whitelist in
// server/api/get/rides/index.ts so a bogus value can never be stored).
const RIDE_STATUSES = ['CREATED', 'ASSIGNED', 'COMPLETED', 'CANCELLED'] as const

// Partial upsert of the current user's rides-list preferences (issue: DB-backed
// filter preference). Every field is optional so the client can save just what
// changed. Unknown keys are rejected (.strict). The status filter arrives as an
// array of known statuses and is de-duped + stored as a CSV string.
const prefSchema = z
  .object({
    rideStatusFilter: z.array(z.enum(RIDE_STATUSES)).optional(),
    rideSort: z.enum(['asc', 'desc']).optional(),
    rideAssignedToMeOnly: z.boolean().optional(),
  })
  .strict()

export default defineEventHandler(async (event) => {
  const session = event.context.auth as { user: { id: string } } | undefined
  const userId = session?.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const body = await readValidatedBody(event, prefSchema)

  // Build the write from only the keys the caller actually sent, so a partial
  // save never clobbers an unrelated preference back to its default.
  const data: {
    rideStatusFilter?: string
    rideSort?: string
    rideAssignedToMeOnly?: boolean
  } = {}
  if (body.rideStatusFilter !== undefined) {
    data.rideStatusFilter = Array.from(new Set(body.rideStatusFilter)).join(',')
  }
  if (body.rideSort !== undefined) data.rideSort = body.rideSort
  if (body.rideAssignedToMeOnly !== undefined) {
    data.rideAssignedToMeOnly = body.rideAssignedToMeOnly
  }

  const pref = await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })

  return {
    rideStatusFilter:
      pref.rideStatusFilter != null ? pref.rideStatusFilter.split(',').filter(Boolean) : null,
    rideSort: pref.rideSort ?? null,
    rideAssignedToMeOnly: pref.rideAssignedToMeOnly,
  }
})
