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
  // public Photon/OSRM instances.
  if (ride.estimatedAt !== null) {
    return {
      duration: ride.cachedDurationText,
      distance: ride.cachedDistanceText,
      durationValue: ride.cachedDurationValue,
      distanceValue: ride.cachedDistanceValue,
      pickupLat: ride.cachedPickupLat,
      pickupLng: ride.cachedPickupLng,
      dropoffLat: ride.cachedDropoffLat,
      dropoffLng: ride.cachedDropoffLng,
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
  }

  // Geocode both endpoints (Photon), then route between them (OSRM) — all
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
    error: null,
  }
})
