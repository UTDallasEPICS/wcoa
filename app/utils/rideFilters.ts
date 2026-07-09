// Pure, testable logic for the Rides dashboard status filters (issue #22).
//
// Background: the "Exclude Status" dropdown used to default to excluding a
// `status:CANCELLED` filter, but CANCELLED is not a real RideStatus and is not
// among the toggleable `filterOptions`. That left the filter active in the
// dropdown header with no checkbox to turn it off — an un-toggleable, stuck
// filter. These helpers keep the persisted cookie state in sync with the set of
// filter values the UI can actually toggle.

export type RideFilter = { label: string; value: string }

/**
 * The base status filter values that always exist in the UI. Volunteer-only
 * options (e.g. `assign:ME`) are appended at runtime in the component and are
 * treated as valid there via the `validValues` argument to sanitize.
 */
export const BASE_FILTER_OPTIONS: RideFilter[] = [
  { label: 'Created', value: 'status:CREATED' },
  { label: 'Assigned', value: 'status:ASSIGNED' },
  { label: 'Completed', value: 'status:COMPLETED' },
]

/**
 * Default excluded filters for new users. Only excludes Completed rides, which
 * is a valid, toggleable option. The stale `status:CANCELLED` default has been
 * removed (issue #22) because there is no CANCELLED status to toggle it off.
 */
export const DEFAULT_EXCLUDED_FILTERS: RideFilter[] = [
  { label: 'Completed', value: 'status:COMPLETED' },
]

/**
 * Drop any saved filter whose value is not among the currently toggleable
 * options. This frees existing users whose `ride-excluded-filters` cookie still
 * contains `status:CANCELLED` (or any other stale value) so they aren't stuck
 * with an active-but-unmanageable filter.
 */
export function sanitizeSavedFilters(
  saved: RideFilter[] | null | undefined,
  validValues: string[]
): RideFilter[] {
  if (!Array.isArray(saved)) return []
  const valid = new Set(validValues)
  return saved.filter((f) => f && valid.has(f.value))
}
