import { describe, expect, it } from 'vitest'
import { APP_TIME_ZONE, formatDateTime } from '../../app/utils/datetime'

// Issue #98: Vue logged "Hydration completed but contains mismatches." on every
// SSR page that rendered a date. The pages formatted dates with bare
// `toLocaleString()` / `toLocaleString('en-US', { … })` and NO fixed timeZone,
// so the server (UTC in the production container) and the browser (viewer's
// local timezone) turned the SAME instant into DIFFERENT strings — e.g. the
// /rides "Date" column rendered "Jul 19, 2026, 04:52 AM" on the server and
// "Jul 18, 2026, 11:52 PM" in a US-Central browser. `formatDateTime` pins the
// locale + timezone so both renders agree.
//
// This is a pure-function revert-check (cf. issue #9's
// notification-datetime.test.ts): the helper does not exist on origin/main, so
// this file fails to import/compile pre-fix. The assertions below also prove
// the behaviour is timezone-stable — they hold on any host TZ because the
// helper pins the zone rather than reading the process's.
describe('formatDateTime (issue #98 SSR hydration mismatch)', () => {
  // 2026-07-19T04:52:00Z is 11:52 PM the PREVIOUS calendar day in
  // America/Chicago (CDT, UTC-5 in July). A host in UTC would render "Jul 19";
  // the pinned formatter must render the Chicago view instead.
  const instant = new Date('2026-07-19T04:52:00Z')

  it('pins the app timezone to America/Chicago', () => {
    expect(APP_TIME_ZONE).toBe('America/Chicago')
  })

  it('renders the /rides column style deterministically (not the UTC instant)', () => {
    const formatted = formatDateTime(instant, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(formatted).toContain('Jul 18, 2026')
    expect(formatted).toMatch(/11:52\s?PM/)
    // Must NOT leak the UTC calendar day the server would otherwise emit.
    expect(formatted).not.toContain('Jul 19')
  })

  it('is stable for the default style used by ride detail + audit', () => {
    // No options → en-US default ("M/D/YYYY, h:mm:ss AM/PM"), still Chicago.
    const formatted = formatDateTime(instant)
    expect(formatted).toContain('7/18/2026')
    expect(formatted).not.toContain('7/19/2026')
  })
})
