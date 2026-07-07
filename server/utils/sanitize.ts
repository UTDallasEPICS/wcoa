/**
 * Normalizes an optional string that may arrive as an empty (or whitespace-only)
 * string from the frontend into `null` (issue #15).
 *
 * Optional-unique columns like `User.phone` are `String? @unique`. SQLite treats
 * `""` as a distinct value, so storing a blank `""` works for the first record
 * but a second blank trips the unique constraint (P2002) and 500s the request.
 * Storing blanks as `null` lets any number of records have "no value".
 */
export function emptyToNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
