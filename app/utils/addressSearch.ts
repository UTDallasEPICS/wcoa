// Pure, testable logic for the create-ride address autocomplete (issue #19).
//
// Background: the modal used to fetch `/api/get/addresses` once on mount (no
// search param, backend caps at 20 rows) and filter that fixed list client-side.
// Any address outside the first 20 alphabetically was therefore unreachable.
// The backend already supports `?search=` (server/api/get/addresses/index.ts);
// these helpers let the component send the user's search term to the server and
// debounce the requests, while keeping the wiring itself unit-testable.

/**
 * Build the query object for `GET /api/get/addresses` from a raw search input.
 *
 * Returns `null` when the trimmed term is empty — the caller should NOT fetch in
 * that case (an empty term would otherwise pull the first 20 rows and re-create
 * the original bug of a fixed, un-searchable list). Otherwise returns
 * `{ search: <trimmed term> }` so results come from the full table.
 */
export function buildAddressQuery(search: string | null | undefined): { search: string } | null {
  const term = (search ?? '').trim()
  if (!term) return null
  return { search: term }
}

/**
 * Minimal trailing-edge debounce. Delays invoking `fn` until `delay` ms have
 * elapsed since the last call; a newer call cancels the pending one. Used to
 * avoid firing an address request on every keystroke.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): ((...args: Args) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null

  const debounced = (...args: Args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delay)
  }

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return debounced
}
