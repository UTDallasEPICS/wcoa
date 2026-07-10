// Builds a universal Google Maps directions deep-link. On phones, this URL is
// handed off by the OS to the native maps app (Apple Maps / Google Maps / Waze
// prompt); on desktop it opens Google Maps directions in the browser.
// See https://developers.google.com/maps/documentation/urls/get-started#directions-action
export function buildMapsDeepLink(
  origin: string | null | undefined,
  destination: string | null | undefined,
): string {
  const params = new URLSearchParams({ api: '1' })
  if (origin) params.set('origin', origin)
  if (destination) params.set('destination', destination)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
