import { prisma } from '../../../../utils/prisma'

interface EstimateResponse {
  duration: string | null
  distance: string | null
  durationValue: number | null
  distanceValue: number | null
  error: string | null
}

export default defineEventHandler(async (event): Promise<EstimateResponse> => {
  const id = getRouterParam(event, 'id')
  const config = useRuntimeConfig()

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  const ride = await prisma.ride.findUnique({
    where: { id },
    select: {
      pickupDisplay: true,
      dropoffDisplay: true,
      cachedDistanceText: true,
      cachedDistanceValue: true,
      cachedDurationText: true,
      cachedDurationValue: true,
      estimatedAt: true,
    }
  })

  if (!ride) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ride not found',
    })
  }

  // Issue #14: serve the cached estimate when present. This avoids a live
  // Google Directions call on every ride-detail page load (quota drain +
  // billing). The cache is invalidated (nulled) whenever pickup/dropoff change
  // (see server/api/put/rides/[id].ts), so a populated cache is always current.
  if (ride.estimatedAt !== null) {
    return {
      duration: ride.cachedDurationText,
      distance: ride.cachedDistanceText,
      durationValue: ride.cachedDurationValue,
      distanceValue: ride.cachedDistanceValue,
      error: null,
    }
  }

  const apiKey = config.public.googleMapsApiKey

  if (!apiKey) {
    return {
      duration: null,
      distance: null,
      durationValue: null,
      distanceValue: null,
      error: 'Maps API Key not configured'
    }
  }

  const origin = encodeURIComponent(ride.pickupDisplay)
  const destination = encodeURIComponent(ride.dropoffDisplay)

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${apiKey}`
    const response: any = await $fetch(url)

    if (response.status === 'OK' && response.routes.length > 0 && response.routes[0].legs.length > 0) {
      const leg = response.routes[0].legs[0]
      // Persist to the ride's cache columns so subsequent loads skip the API.
      await prisma.ride.update({
        where: { id },
        data: {
          cachedDurationText: leg.duration.text,
          cachedDistanceText: leg.distance.text,
          cachedDurationValue: leg.duration.value, // seconds
          cachedDistanceValue: leg.distance.value, // meters
          estimatedAt: new Date(),
        },
      })
      return {
        duration: leg.duration.text,
        distance: leg.distance.text,
        durationValue: leg.duration.value, // seconds
        distanceValue: leg.distance.value, // meters
        error: null
      }
    } else {
        return { 
          duration: null,
          distance: null,
          durationValue: null,
          distanceValue: null,
          error: response.status || 'No route found'
        }
    }
  } catch (error) {
    console.error('Maps API error:', error)
    return { 
      duration: null,
      distance: null,
      durationValue: null,
      distanceValue: null,
      error: 'Failed to fetch estimate' 
    }
  }
})
