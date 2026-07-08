/**
 * Normalizes the fields of an address before it is upserted on the
 * `@@unique([street, city, state, zip])` key (issue #16).
 *
 * Without normalization, "123 Main st", "123 Main St" and " 123 Main St "
 * miss the unique constraint and each spawn a near-duplicate Address row,
 * bloating the table and defeating the constraint's intent.
 *
 * We deliberately do NOT lowercase (the issue's literal suggestion). The
 * Address row backs `Client.homeAddress`, which is rendered on the people
 * page, so lowercasing would be a visible UI regression. Instead we trim,
 * collapse internal whitespace and Title-Case each field: equivalent
 * addresses collapse to one row while staying presentable. `state` is
 * upper-cased (postal abbreviations like "TX") and `zip` is only
 * trimmed/whitespace-collapsed so any format is preserved.
 */

interface AddressFields {
  street: string
  city: string
  state: string
  zip: string
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function titleCase(value: string): string {
  return collapse(value)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function normalizeAddress(addr: AddressFields): AddressFields {
  return {
    street: titleCase(addr.street),
    city: titleCase(addr.city),
    state: collapse(addr.state).toUpperCase(),
    zip: collapse(addr.zip),
  }
}
