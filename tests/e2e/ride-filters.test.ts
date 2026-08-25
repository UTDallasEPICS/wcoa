import { describe, expect, it } from 'vitest'
import {
  ALL_RIDE_STATUSES,
  DEFAULT_RIDE_STATUSES,
  RIDE_STATUS_OPTIONS,
  buildRidesInclude,
  legacyCookieToStatuses,
  sanitizeStatuses,
} from '../../app/utils/rideFilters'

// Pure-function unit test for the rides status-filter helpers. Intentionally
// does NOT call setup() — it exercises pure helpers and must not boot the Nuxt
// app, so it stays fast (mirrors trusted-origins.test.ts).
describe('ride filter helpers', () => {
  it('exposes all four real ride statuses, including CANCELLED (#5)', () => {
    expect(ALL_RIDE_STATUSES).toEqual(['CREATED', 'ASSIGNED', 'COMPLETED', 'CANCELLED'])
    expect(RIDE_STATUS_OPTIONS.map((o) => o.value)).toEqual(ALL_RIDE_STATUSES)
  })

  it('defaults to active work only (hides Completed/Cancelled)', () => {
    expect(DEFAULT_RIDE_STATUSES).toEqual(['CREATED', 'ASSIGNED'])
  })

  describe('sanitizeStatuses', () => {
    it('keeps known statuses and strips unknown ones', () => {
      expect(sanitizeStatuses(['CREATED', 'BOGUS', 'COMPLETED'])).toEqual(['CREATED', 'COMPLETED'])
    })
    it('handles null/undefined/non-array gracefully', () => {
      expect(sanitizeStatuses(null)).toEqual([])
      expect(sanitizeStatuses(undefined)).toEqual([])
      expect(sanitizeStatuses('CREATED')).toEqual([])
    })
  })

  describe('buildRidesInclude', () => {
    it('maps selected statuses to prefixed include values', () => {
      expect(buildRidesInclude(['CREATED', 'ASSIGNED'], false)).toBe(
        'status:CREATED,status:ASSIGNED'
      )
    })
    it('appends assign:ME when assignedToMe is set', () => {
      expect(buildRidesInclude(['CREATED'], true)).toBe('status:CREATED,assign:ME')
    })
    it('returns undefined for an empty selection (server treats it as all)', () => {
      expect(buildRidesInclude([], false)).toBeUndefined()
    })
    it('assign:ME alone still produces a param', () => {
      expect(buildRidesInclude([], true)).toBe('assign:ME')
    })
    it('drops unknown statuses before building', () => {
      expect(buildRidesInclude(['CREATED', 'BOGUS'] as never, false)).toBe('status:CREATED')
    })
  })

  describe('legacyCookieToStatuses (cookie -> DB migration)', () => {
    it('converts the default cookie state (exclude Completed+Cancelled) to active work', () => {
      const excluded = [
        { label: 'Completed', value: 'status:COMPLETED' },
        { label: 'Cancelled', value: 'status:CANCELLED' },
      ]
      expect(legacyCookieToStatuses([], excluded)).toEqual(['CREATED', 'ASSIGNED'])
    })
    it('intersects an explicit include with the exclude set', () => {
      const active = [
        { label: 'Created', value: 'status:CREATED' },
        { label: 'Completed', value: 'status:COMPLETED' },
      ]
      const excluded = [{ label: 'Completed', value: 'status:COMPLETED' }]
      expect(legacyCookieToStatuses(active, excluded)).toEqual(['CREATED'])
    })
    it('with no include and no exclude, shows every status', () => {
      expect(legacyCookieToStatuses([], [])).toEqual(ALL_RIDE_STATUSES)
    })
    it('tolerates plain strings and null cookies', () => {
      expect(legacyCookieToStatuses(['status:ASSIGNED'], null)).toEqual(['ASSIGNED'])
      expect(legacyCookieToStatuses(null, undefined)).toEqual(ALL_RIDE_STATUSES)
    })
  })
})
