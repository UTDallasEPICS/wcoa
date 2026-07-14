import { Prisma } from '../../../../prisma/generated/client'
import { prisma } from '../../../utils/prisma'
import { getPageParams, getStringParam } from '../../../utils/pagination'

// The full RideStatus enum (CANCELLED became a real status in issue #5).
// Whitelist filter input against this so a bogus `?include` value can never
// crash the Prisma query with an invalid enum.
const VALID_STATUSES = new Set(['CREATED', 'ASSIGNED', 'COMPLETED', 'CANCELLED'])

// Parse a comma-separated filter list (e.g. "status:CREATED,assign:ME") into a
// set of statuses plus whether the caller wants rides assigned to themselves.
// Mirrors the include/exclude filter chips the rides dashboard used to apply
// client-side (issue #13 moves that filtering to the backend so it composes
// correctly with pagination).
function parseFilters(raw: string): { statuses: string[]; assignedToMe: boolean } {
  const values = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  const statuses = values
    .filter((v) => v.startsWith('status:'))
    .map((v) => v.slice('status:'.length))
    .filter((s) => VALID_STATUSES.has(s))
  return { statuses, assignedToMe: values.includes('assign:ME') }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const sort = query.sort === 'desc' ? 'desc' : 'asc'
  const { page, pageSize, skip, take } = getPageParams(event)

  // The global auth middleware guarantees a session and stashes it here.
  const session = event.context.auth as
    | { user: { id: string; role?: string } }
    | undefined
  const role = session?.user?.role
  const userId = session?.user?.id

  // Build up an AND list of independent filters. We can't put multiple `OR`
  // keys at the top level (role-scoping OR, inclusion-filter OR, search OR), so
  // each lives as its own clause inside AND.
  const and: Prisma.RideWhereInput[] = []

  // Data scoping (issue #3): a VOLUNTEER must only receive rides that are
  // available to sign up for (CREATED) or that are assigned to them — never
  // other volunteers' rides or the full roster of client PII. ADMINs see all.
  // Fail closed: if the user id is somehow absent, never widen past available
  // rides — { volunteer: { userId: undefined } } would make Prisma drop the
  // filter and match every assigned ride, leaking PII.
  if (role !== 'ADMIN') {
    and.push({
      OR: userId
        ? [{ status: 'CREATED' }, { volunteer: { userId } }]
        : [{ status: 'CREATED' }],
    })
  }

  // Inclusion filters (OR): keep a ride if it matches ANY selected chip.
  const include = parseFilters(getStringParam(event, 'include'))
  if (include.statuses.length || include.assignedToMe) {
    const or: Prisma.RideWhereInput[] = include.statuses.map((status) => ({ status }))
    if (include.assignedToMe && userId) or.push({ volunteer: { userId } })
    if (or.length) and.push({ OR: or })
  }

  // Exclusion filters (AND NOT): drop a ride if it matches ANY excluded chip.
  const exclude = parseFilters(getStringParam(event, 'exclude'))
  for (const status of exclude.statuses) and.push({ NOT: { status } })
  if (exclude.assignedToMe && userId) and.push({ NOT: { volunteer: { userId } } })

  // Date range (issue #13 explicitly calls for backend date filtering). The end
  // date is inclusive of the whole day, matching the old client-side behavior.
  const startDate = getStringParam(event, 'startDate')
  const endDate = getStringParam(event, 'endDate')
  const scheduledTime: Prisma.DateTimeFilter = {}
  if (startDate) {
    const d = new Date(startDate)
    if (!Number.isNaN(d.getTime())) scheduledTime.gte = d
  }
  if (endDate) {
    const d = new Date(endDate)
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() + 1)
      scheduledTime.lt = d
    }
  }
  if (scheduledTime.gte || scheduledTime.lt) and.push({ scheduledTime })

  // Free-text search across the ride and its client/volunteer names. SQLite
  // `contains` (LIKE) is case-insensitive for ASCII, matching the old
  // lower-cased client-side search.
  const search = getStringParam(event, 'search')
  if (search) {
    and.push({
      OR: [
        { id: { contains: search } },
        { pickupDisplay: { contains: search } },
        { dropoffDisplay: { contains: search } },
        { client: { user: { name: { contains: search } } } },
        { volunteer: { user: { name: { contains: search } } } },
      ],
    })
  }

  // Soft delete (issue #27): archived rides are always hidden from active ride
  // views (both admin and volunteer). ANDed on top of everything else.
  const where: Prisma.RideWhereInput = {
    deletedAt: null,
    ...(and.length ? { AND: and } : {}),
  }

  // One transaction so the page slice and the total count see a consistent
  // snapshot. skip/take bound the query (issue #13) — no more full-table loads.
  const [items, total] = await prisma.$transaction([
    prisma.ride.findMany({
      where,
      include: {
        client: { include: { user: true } },
        volunteer: { include: { user: true } },
      },
      // `id` is a stable, unique tiebreaker so rides with an identical
      // scheduledTime keep a deterministic order across pages (otherwise
      // skip/take could drop or duplicate a tied row).
      orderBy: [{ scheduledTime: sort }, { id: 'asc' }],
      skip,
      take,
    }),
    prisma.ride.count({ where }),
  ])

  return { items, total, page, pageSize }
})
