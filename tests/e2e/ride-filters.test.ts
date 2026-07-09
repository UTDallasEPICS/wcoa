import { describe, expect, it } from 'vitest'
import {
  BASE_FILTER_OPTIONS,
  DEFAULT_EXCLUDED_FILTERS,
  sanitizeSavedFilters,
} from '../../app/utils/rideFilters'

// Pure-function unit test for the rides status-filter helpers (issue #22).
// Intentionally does NOT call setup() — it exercises pure helpers and must not
// boot the Nuxt app, so it stays fast (mirrors trusted-origins.test.ts).
describe('ride filter helpers (#22)', () => {
  const validValues = BASE_FILTER_OPTIONS.map((o) => o.value)

  it('has no default excluded filter that is absent from the toggleable options', () => {
    // Pins the bug: `status:CANCELLED` was a default exclusion but is not a
    // toggleable filter option, leaving the UI stuck with an un-removable filter.
    for (const f of DEFAULT_EXCLUDED_FILTERS) {
      expect(validValues).toContain(f.value)
    }
  })

  it('keeps the sensible Completed default exclusion', () => {
    expect(DEFAULT_EXCLUDED_FILTERS.map((f) => f.value)).toContain('status:COMPLETED')
  })

  it('strips the stale status:CANCELLED entry but keeps valid ones', () => {
    const saved = [
      { label: 'Completed', value: 'status:COMPLETED' },
      { label: 'Cancelled', value: 'status:CANCELLED' },
    ]
    const result = sanitizeSavedFilters(saved, validValues)
    expect(result.map((f) => f.value)).toEqual(['status:COMPLETED'])
    expect(result.map((f) => f.value)).not.toContain('status:CANCELLED')
  })

  it('keeps runtime-valid values that are passed in validValues (e.g. assign:ME)', () => {
    const saved = [{ label: 'Assigned to Me', value: 'assign:ME' }]
    const result = sanitizeSavedFilters(saved, [...validValues, 'assign:ME'])
    expect(result.map((f) => f.value)).toEqual(['assign:ME'])
  })

  it('handles null/undefined saved cookie gracefully', () => {
    expect(sanitizeSavedFilters(null, validValues)).toEqual([])
    expect(sanitizeSavedFilters(undefined, validValues)).toEqual([])
  })
})
