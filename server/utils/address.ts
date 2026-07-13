/**
 * Normalizes an address for storage + dedup (issues #16, #57).
 *
 * Equivalent addresses ("123 Main St", "123 Main st", " 123 Main St ") must
 * collapse to a single `Address` row, but the stored street/city/state/zip
 * back `Client.homeAddress`, which is rendered on the people page — so they
 * must stay presentable and faithful to what the user typed.
 *
 * #16 achieved dedup by Title-Casing every field before upserting on the raw
 * `@@unique([street, city, state, zip])` key. That mangled the display value
 * for a minority of inputs (acronyms/directionals/mixed-case): "123 NW 5th
 * Ave" -> "123 Nw 5th Ave", "PO Box 12" -> "Po Box 12", "McDonald Ave" ->
 * "Mcdonald Ave".
 *
 * #57 fixes this by splitting the two concerns:
 *   - Display fields: trimmed + internal whitespace collapsed, but casing is
 *     preserved exactly as entered (no Title-Case, no lowercasing).
 *   - `matchKey`: a lossy, case/whitespace-insensitive derivation of all four
 *     fields, uniqued in the schema so variants still dedup to one row.
 */

interface AddressFields {
  street: string
  city: string
  state: string
  zip: string
}

export interface NormalizedAddress extends AddressFields {
  matchKey: string
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * The dedup key: lowercased + whitespace-collapsed fields joined on a "|"
 * separator (so field boundaries can't blur, e.g. street "12 3"/city "4" vs
 * street "12"/city "3 4"). Kept as a standalone export so the migration
 * backfill can reproduce it in SQL for existing rows
 * (lower(street)||'|'||lower(city)||...) -- old #16 rows already have
 * whitespace collapsed, so lowercasing the stored fields yields the same key.
 */
export function addressMatchKey(addr: AddressFields): string {
  return [addr.street, addr.city, addr.state, addr.zip]
    .map((v) => collapse(v).toLowerCase())
    .join('|')
}

export function normalizeAddress(addr: AddressFields): NormalizedAddress {
  const display: AddressFields = {
    street: collapse(addr.street),
    city: collapse(addr.city),
    state: collapse(addr.state),
    zip: collapse(addr.zip),
  }
  return {
    ...display,
    matchKey: addressMatchKey(display),
  }
}
