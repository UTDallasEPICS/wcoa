import { describe, expect, it, vi } from 'vitest'
import { buildAddressQuery, debounce } from '../../app/utils/addressSearch'

// Pure-function unit test for the create-ride address autocomplete helpers
// (issue #19). Intentionally does NOT call setup() — it exercises pure helpers
// and must not boot the Nuxt app, so it stays fast (mirrors
// trusted-origins.test.ts / ride-filters.test.ts).
//
// Pins the bug: the modal previously fetched `/api/get/addresses` once with NO
// search param and filtered the fixed 20 rows client-side. buildAddressQuery is
// the seam that now carries the user's term to the server so the full table is
// searched. A regression that drops the search param (e.g. reverting to a
// param-less fetch) makes `.search` undefined and fails these assertions.
describe('buildAddressQuery (#19)', () => {
  it('carries the trimmed search term to the server query', () => {
    expect(buildAddressQuery('Main St')).toEqual({ search: 'Main St' })
  })

  it('trims surrounding whitespace so the server sees the real term', () => {
    expect(buildAddressQuery('  Elm  ')).toEqual({ search: 'Elm' })
  })

  it('returns null for an empty or whitespace-only term so no fetch happens', () => {
    // A param-less/empty fetch is exactly the original bug: it pulls the first
    // 20 rows regardless of what the user typed.
    expect(buildAddressQuery('')).toBeNull()
    expect(buildAddressQuery('   ')).toBeNull()
    expect(buildAddressQuery(null)).toBeNull()
    expect(buildAddressQuery(undefined)).toBeNull()
  })
})

describe('debounce (#19)', () => {
  it('invokes fn only once with the latest args after the delay', () => {
    vi.useFakeTimers()
    const spy = vi.fn()
    const d = debounce(spy, 200)

    d('a')
    d('b')
    d('c')
    expect(spy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('c')

    vi.useRealTimers()
  })

  it('cancel() prevents a pending invocation', () => {
    vi.useFakeTimers()
    const spy = vi.fn()
    const d = debounce(spy, 200)

    d('x')
    d.cancel()
    vi.advanceTimersByTime(500)
    expect(spy).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})
