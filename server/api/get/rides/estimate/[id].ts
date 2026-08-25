import { prisma } from '../../../../utils/prisma'

interface EstimateResponse {
  duration: string | null
  distance: string | null
  durationValue: number | null
  distanceValue: number | null
  pickupLat: number | null
  pickupLng: number | null
  dropoffLat: number | null
  dropoffLng: number | null
  routeGeometry: number[][] | null
  error: string | null
}

export default defineEventHandler(async (event): Promise<EstimateResponse> => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID is required' })
  }

  // Soft delete (issue #27): an archived ride is treated as not found.
  const ride = await prisma.ride.findFirst({
    where: { id, deletedAt: null },
    select: {
      status: true,
      pickupDisplay: true,
      dropoffDisplay: true,
      cachedDistanceText: true,
      cachedDistanceValue: true,
      cachedDurationText: true,
      cachedDurationValue: true,
      cachedPickupLat: true,
      cachedPickupLng: true,
      cachedDropoffLat: true,
      cachedDropoffLng: true,
      cachedRouteGeometry: true,
      estimatedAt: true,
      volunteer: { select: { userId: true } },
    },
  })

  if (!ride) {
    throw createError({ statusCode: 404, statusMessage: 'Ride not found' })
  }

  // Record-level scoping (issue #93): a non-admin may only read the estimate of
  // a ride available to sign up for (CREATED) or assigned to them. Return 404
  // (not 403) so we don't reveal the ride exists.
  const session = getAuth(event)
  const role = session?.user?.role
  if (role !== 'ADMIN') {
    const userId = session?.user?.id
    const isAvailable = ride.status === 'CREATED'
    const isMine = !!userId && ride.volunteer?.userId === userId
    if (!isAvailable && !isMine) {
      throw createError({ statusCode: 404, statusMessage: 'Ride not found' })
    }
  }

  // Issue #14: serve the cached estimate + coordinates when present. The cache is
  // invalidated whenever pickup/dropoff change (server/api/put/rides/[id].ts), so
  // a populated cache is always current. Caching also keeps us light on the free
  // public Nominatim/OSRM instances.
  if (ride.estimatedAt !== null) {
    let routeGeometry = parseGeometry(ride.cachedRouteGeometry)
    let durationText = ride.cachedDurationText
    let distanceText = ride.cachedDistanceText
    let durationValue = ride.cachedDurationValue
    let distanceValue = ride.cachedDistanceValue

    // Backfill for legacy cache rows: rides estimated before the route path was
    // cached have coordinates but no geometry, so the map drew a straight line
    // AND the distance/duration were computed by the old (Google) estimator, so
    // they wouldn't match the real path. Re-run just the routing once from the
    // cached coordinates (no re-geocode) and refresh distance + duration + line
    // together, so all three come from one consistent OSRM response. Offline
    // (tests) or an OSRM outage leaves the cached values in place with a
    // straight-line fallback — no error, still a valid hit.
    if (
      !routeGeometry &&
      ride.cachedPickupLat != null &&
      ride.cachedPickupLng != null &&
      ride.cachedDropoffLat != null &&
      ride.cachedDropoffLng != null
    ) {
      const backfill = await osrmRoute(
        { lat: ride.cachedPickupLat, lon: ride.cachedPickupLng },
        { lat: ride.cachedDropoffLat, lon: ride.cachedDropoffLng }
      )
      if (backfill) {
        routeGeometry = backfill.geometry
        durationText = formatDuration(backfill.durationSec)
        distanceText = formatDistance(backfill.distanceMeters)
        durationValue = Math.round(backfill.durationSec)
        distanceValue = Math.round(backfill.distanceMeters)
        await prisma.ride.update({
          where: { id },
          data: {
            cachedRouteGeometry: backfill.geometry ? JSON.stringify(backfill.geometry) : null,
            cachedDurationText: durationText,
            cachedDistanceText: distanceText,
            cachedDurationValue: durationValue,
            cachedDistanceValue: distanceValue,
          },
        })
      }
    }

    return {
      duration: durationText,
      distance: distanceText,
      durationValue,
      distanceValue,
      pickupLat: ride.cachedPickupLat,
      pickupLng: ride.cachedPickupLng,
      dropoffLat: ride.cachedDropoffLat,
      dropoffLng: ride.cachedDropoffLng,
      routeGeometry,
      error: null,
    }
  }

  const empty = {
    duration: null,
    distance: null,
    durationValue: null,
    distanceValue: null,
    pickupLat: null,
    pickupLng: null,
    dropoffLat: null,
    dropoffLng: null,
    routeGeometry: null,
  }

  // Geocode both endpoints (Nominatim), then route between them (OSRM) — all
  // open-source, no key. Each helper returns null on failure so we surface a
  // friendly message instead of erroring the page.
  const [from, to] = await Promise.all([
    geocodeOne(ride.pickupDisplay),
    geocodeOne(ride.dropoffDisplay),
  ])
  if (!from || !to) {
    return { ...empty, error: "Couldn't locate one of the addresses on the map." }
  }

  const route = await osrmRoute(from, to)
  if (!route) {
    return { ...empty, error: "Couldn't calculate a route for this trip." }
  }

  const durationText = formatDuration(route.durationSec)
  const distanceText = formatDistance(route.distanceMeters)

  // Persist so subsequent loads skip the geocode + route calls.
  await prisma.ride.update({
    where: { id },
    data: {
      cachedDurationText: durationText,
      cachedDistanceText: distanceText,
      cachedDurationValue: Math.round(route.durationSec),
      cachedDistanceValue: Math.round(route.distanceMeters),
      cachedPickupLat: from.lat,
      cachedPickupLng: from.lon,
      cachedDropoffLat: to.lat,
      cachedDropoffLng: to.lon,
      cachedRouteGeometry: route.geometry ? JSON.stringify(route.geometry) : null,
      estimatedAt: new Date(),
    },
  })

  return {
    duration: durationText,
    distance: distanceText,
    durationValue: Math.round(route.durationSec),
    distanceValue: Math.round(route.distanceMeters),
    pickupLat: from.lat,
    pickupLng: from.lon,
    dropoffLat: to.lat,
    dropoffLng: to.lon,
    routeGeometry: route.geometry,
    error: null,
  }
})

// The route geometry is cached as a JSON string ([lon,lat][]); tolerate a
// malformed value by returning null rather than throwing the request.
function parseGeometry(raw: string | null): number[][] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as number[][]) : null
  } catch {
    return null
  }
}
