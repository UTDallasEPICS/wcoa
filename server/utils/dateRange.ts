/**
 * Parse the `startDate` / `endDate` query params used by the dashboard metrics
 * endpoints into a Prisma `scheduledTime` filter (issue #18).
 *
 * The frontend sends plain day strings (`YYYY-MM-DD`). `new Date('2026-12-31')`
 * is parsed as UTC midnight, so filtering with `lte: endDate` (or `lt: endDate`)
 * wrongly excludes rides that happen *during* the end day (e.g. 14:00). To make
 * the end boundary inclusive of the whole day we use `lt: <start of the next
 * day>`.
 *
 * Timezone assumption: boundaries are computed in UTC to match how the plain
 * `YYYY-MM-DD` strings the frontend sends are already parsed (`new Date(...)`
 * yields UTC midnight). Start stays start-of-day inclusive; end becomes
 * end-of-day inclusive. Callers that pass a full ISO timestamp still get the
 * day-granular window (the time component is normalized away).
 *
 * Returns `undefined` when neither param is present so callers can preserve
 * their existing "no filter" / default behavior.
 */
export interface DateRangeFilter {
  gte?: Date
  lt?: Date
}

// Start of the UTC day containing `d`.
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// Start of the UTC day *after* the one containing `d` — an exclusive upper
// bound that includes every instant of `d`'s day.
function startOfNextUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))
}

export function parseDateRange(
  startDate: unknown,
  endDate: unknown,
): DateRangeFilter | undefined {
  const hasStart = startDate !== undefined && startDate !== null && String(startDate) !== ''
  const hasEnd = endDate !== undefined && endDate !== null && String(endDate) !== ''

  if (!hasStart && !hasEnd) return undefined

  const range: DateRangeFilter = {}
  if (hasStart) {
    range.gte = startOfUtcDay(new Date(String(startDate)))
  }
  if (hasEnd) {
    // Inclusive of the entire end day: next-day-midnight as an exclusive bound.
    range.lt = startOfNextUtcDay(new Date(String(endDate)))
  }
  return range
}
