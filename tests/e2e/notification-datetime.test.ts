import { describe, expect, it } from 'vitest'
import {
  formatNotificationDate,
  formatNotificationTime,
} from '../../server/utils/datetime'

// Pure-function unit test for the notification date/time formatters (issue #9).
// The date/time values only flow into notification emails, which the e2e
// harness swallows (no API response to assert against), so we exercise the
// pure helpers directly and do NOT call setup() — no Nuxt boot needed
// (cf. trusted-origins.test.ts, issue #21).
//
// Revert-check shape: these helpers do not exist before the fix, so this file
// fails to import/compile pre-fix (like the #21 helper-absence check).
describe('formatNotificationDate / formatNotificationTime (issue #9)', () => {
  // 2026-02-16T15:00:00Z is a Monday; 15:00 UTC == 9:00 AM in America/Chicago (CST).
  const date = new Date('2026-02-16T15:00:00Z')

  it('formats a real calendar date, not a bare weekday', () => {
    const formatted = formatNotificationDate(date)
    // Pins the bug: old `split(',')[0]` on dateStyle:'full' yielded "Monday".
    expect(formatted).toMatch(/February/)
    expect(formatted).toMatch(/16/)
    expect(formatted).not.toBe('Monday')
    expect(formatted).not.toMatch(/^Monday$/)
  })

  it('formats a real clock time', () => {
    const formatted = formatNotificationTime(date)
    expect(formatted).toMatch(/\d{1,2}:\d{2}/)
    // Chicago is UTC-6 in February, so 15:00Z -> 9:00 AM.
    expect(formatted).toMatch(/9:00/)
    expect(formatted).toMatch(/AM/)
  })
})
