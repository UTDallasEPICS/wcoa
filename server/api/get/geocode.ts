// Open-source address autocomplete/verification via Nominatim
// (nominatim.openstreetmap.org), an OpenStreetMap-based geocoder — no API key.
// Used by the create-ride address field (AddressField.vue). Admin-only, matching
// the sibling address lookup (server/api/get/addresses): the create form is
// admin-only and this keeps the proxy from being an open geocoding relay.
//
// The geocoder call (and its MAPS_OFFLINE test-mode short-circuit) lives in the
// shared helper so the estimate endpoint and this one behave identically.
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const q = ((getQuery(event).q as string) || '').trim()
  // The geocoder needs a few characters to return anything useful.
  if (q.length < 3) return []

  return geocodeSearch(q, 5)
})
