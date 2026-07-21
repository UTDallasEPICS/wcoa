<script setup lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css'

  // Route map for the ride detail page — MapLibre GL JS rendering free OpenFreeMap
  // vector tiles (no API key). Plots pickup + dropoff markers and frames both.
  // Client-only (the parent wraps it in <ClientOnly>); MapLibre is imported
  // dynamically in onMounted so nothing touches `window` during SSR.
  const props = defineProps<{
    pickup: { lat: number; lng: number } | null
    dropoff: { lat: number; lng: number } | null
  }>()

  const container = ref<HTMLElement | null>(null)
  const failed = ref(false)
  let map: any = null

  const hasCoords = computed(
    () =>
      !!props.pickup &&
      !!props.dropoff &&
      Number.isFinite(props.pickup.lat) &&
      Number.isFinite(props.dropoff.lat)
  )

  async function initMap() {
    if (!container.value || !hasCoords.value || map) return
    try {
      const maplibregl = (await import('maplibre-gl')).default
      map = new maplibregl.Map({
        container: container.value,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [props.pickup!.lng, props.pickup!.lat],
        zoom: 11,
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.on('error', () => {
        failed.value = true
      })

      new maplibregl.Marker({ color: '#16a34a' })
        .setLngLat([props.pickup!.lng, props.pickup!.lat])
        .addTo(map)
      new maplibregl.Marker({ color: '#dc2626' })
        .setLngLat([props.dropoff!.lng, props.dropoff!.lat])
        .addTo(map)

      const bounds = new maplibregl.LngLatBounds()
      bounds.extend([props.pickup!.lng, props.pickup!.lat])
      bounds.extend([props.dropoff!.lng, props.dropoff!.lat])
      map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 })
    } catch (err) {
      console.error('Map failed to load', err)
      failed.value = true
    }
  }

  onMounted(initMap)
  // Coords can arrive after mount (estimate still resolving) — init once they do.
  watch(hasCoords, (ok) => {
    if (ok) initMap()
  })
  onUnmounted(() => map?.remove?.())
</script>

<template>
  <div
    class="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
  >
    <div v-show="hasCoords && !failed" ref="container" class="absolute inset-0"></div>
    <div
      v-if="!hasCoords || failed"
      class="flex h-full items-center justify-center bg-gray-100 p-4 text-center text-sm text-gray-400 dark:bg-gray-800"
    >
      {{ failed ? 'Map could not be loaded.' : 'Map unavailable for these addresses.' }}
    </div>
  </div>
</template>
