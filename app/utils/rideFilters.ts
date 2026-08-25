// Pure, testable logic for the Rides list status filter.
//
// The list used to carry two filters — an "include" set and an "exclude" set —
// persisted as browser cookies. That's now a single "which statuses to show"
// selection, persisted per-user in the DB (see /api/{get,put}/preferences) so it
// follows the user across devices. These helpers convert that selection to the
// rides API's `include` query param and defend against unknown stored values.

export type RideStatus = 'CREATED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED'

// Every ride status with a display label, for the status filter toggles.
export const RIDE_STATUS_OPTIONS: { label: string; value: RideStatus }[] = [
  { label: 'Created', value: 'CREATED' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export const ALL_RIDE_STATUSES: RideStatus[] = RIDE_STATUS_OPTIONS.map((o) => o.value)

// Default view for a user who has never saved a preference: active work only
// (hide Completed/Cancelled). Matches the pre-DB cookie default (issue #22).
export const DEFAULT_RIDE_STATUSES: RideStatus[] = ['CREATED', 'ASSIGNED']

/**
 * Keep only known ride statuses. Defensive when hydrating a saved preference so
 * a stale/renamed value can never drive the UI or reach the API.
 */
export function sanitizeStatuses(saved: unknown): RideStatus[] {
  if (!Array.isArray(saved)) return []
  const valid = new Set<string>(ALL_RIDE_STATUSES)
  return saved.filter((s): s is RideStatus => typeof s === 'string' && valid.has(s))
}

/**
 * Build the rides API `include` param from the selected statuses plus the
 * volunteer-only "assigned to me" toggle. An empty selection returns undefined:
 * the server treats "no include" as "all statuses", which is the intuitive
 * meaning of clearing every status filter.
 */
export function buildRidesInclude(
  statuses: RideStatus[],
  assignedToMe: boolean
): string | undefined {
  const parts = sanitizeStatuses(statuses).map((s) => `status:${s}`)
  if (assignedToMe) parts.push('assign:ME')
  return parts.length ? parts.join(',') : undefined
}

/**
 * One-time migration of the legacy cookie filter model (an include set and an
 * exclude set of `status:X` values, stored as `{ label, value }[]`) into the new
 * "shown statuses" selection. Effective shown set = (included statuses, or all
 * statuses if none were included) minus the excluded statuses. Tolerates either
 * the raw cookie object shape or plain strings.
 */
export function legacyCookieToStatuses(active: unknown, excluded: unknown): RideStatus[] {
  const values = (raw: unknown): string[] =>
    Array.isArray(raw)
      ? raw
          .map((x) => (typeof x === 'string' ? x : (x as { value?: string })?.value))
          .filter((v): v is string => typeof v === 'string')
      : []
  const strip = (v: string) => (v.startsWith('status:') ? v.slice('status:'.length) : v)

  const included = sanitizeStatuses(values(active).map(strip))
  const excludedSet = new Set(sanitizeStatuses(values(excluded).map(strip)))
  const base = included.length ? included : [...ALL_RIDE_STATUSES]
  return base.filter((s) => !excludedSet.has(s))
}
