/**
 * Client-side date/time formatting for values that are rendered during SSR and
 * then hydrated in the browser (issue #98).
 *
 * The pages used bare `new Date(x).toLocaleString()` /
 * `toLocaleString('en-US', { … })` with NO fixed `timeZone`. `toLocaleString`
 * resolves the timezone (and, without a locale argument, the locale) from the
 * host environment — so the server (UTC in the production container) and the
 * viewer's browser (their local timezone) format the SAME instant into
 * DIFFERENT strings. Vue then reports
 * "Hydration completed but contains mismatches." on every page that renders a
 * date during SSR (/rides, /rides/[id], /admin/audit).
 *
 * Pinning both the locale and the timezone makes the string deterministic, so
 * the server render and the client render agree and hydration is clean. The
 * timezone matches the org (North Texas) and the server-side convention in
 * server/utils/datetime.ts (issue #9).
 */

import { ref } from 'vue'

export const APP_TIME_ZONE = 'America/Chicago'

// The viewer's 12h/24h clock preference, detected on the client AFTER hydration
// (plugins/clock.client.ts). Left undefined on the server and during the first
// client render so SSR and hydration agree on the en-US default (12h); once set,
// time displays reactively re-render in the user's preferred cycle. A Vue ref
// (never mutated on the server) so it can't leak across SSR requests.
export const clockHour12 = ref<boolean | undefined>(undefined)

/**
 * Format an instant in the app's fixed locale + timezone. Extra
 * `Intl.DateTimeFormatOptions` are merged in so each call site keeps its own
 * date/time style; only the locale and timezone are forced. The hour cycle
 * follows the viewer's system preference once detected (12h by default).
 */
export function formatDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Date(value).toLocaleString('en-US', {
    timeZone: APP_TIME_ZONE,
    hour12: clockHour12.value,
    ...options,
  })
}
