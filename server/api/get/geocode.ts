// Open-source address autocomplete/verification via Photon (photon.komoot.io),
// an OpenStreetMap-based geocoder — no API key. Used by the create-ride address
// field (AddressField.vue). Admin-only, matching the sibling address lookup
// (server/api/get/addresses): the create form is admin-only and this keeps the
// proxy from being an open geocoding relay.
//
// The Photon call (and its MAPS_OFFLINE test-mode short-circuit) lives in the
// shared helper so the estimate endpoint and this one behave identically.
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const q = ((getQuery(event).q as string) || '').trim()
  // Photon wants a few characters to return anything useful.
  if (q.length < 3) return []

  return photonSearch(q, 5)
})
