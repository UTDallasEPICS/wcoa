/**
 * Formats a ride's scheduled time into the `{{date}}` and `{{time}}` fields
 * used by notification email templates (issue #9).
 *
 * The old code did:
 *
 *   const formattedTime = date.toLocaleString('en-US', { dateStyle: 'full', ... })
 *   date: formattedTime.split(',')[0]
 *
 * With `dateStyle: 'full'` the output looks like
 * "Monday, February 16, 2026 at 9:00 AM", so `split(',')[0]` extracts the
 * weekday ("Monday") — NOT a date — into `{{date}}`. It is also fragile to
 * server locale/format changes. We instead format with explicit
 * `Intl.DateTimeFormat` options so `{{date}}` is a real calendar date and
 * `{{time}}` a real clock time regardless of the host environment.
 *
 * The timezone is pinned to 'America/Chicago' to match the intent already
 * present in server/api/post/rides/index.ts.
 */

const TIME_ZONE = 'America/Chicago'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
})

/** e.g. "February 16, 2026" */
export function formatNotificationDate(date: Date): string {
  return dateFormatter.format(date)
}

/** e.g. "9:00 AM" */
export function formatNotificationTime(date: Date): string {
  return timeFormatter.format(date)
}
