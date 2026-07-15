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

export const APP_TIME_ZONE = 'America/Chicago'

/**
 * Format an instant in the app's fixed locale + timezone. Extra
 * `Intl.DateTimeFormatOptions` are merged in so each call site keeps its own
 * date/time style; only the locale and timezone are forced.
 */
export function formatDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Date(value).toLocaleString('en-US', {
    timeZone: APP_TIME_ZONE,
    ...options,
  })
}
