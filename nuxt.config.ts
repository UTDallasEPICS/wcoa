export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', 'nuxt-cron'],
  css: ['./assets/css/main.css'],
  runtimeConfig: {
    // Server-only (issue #30): the Directions API key used by the estimate
    // endpoint. It NEVER reaches the client bundle. Overridden by the
    // NUXT_GOOGLE_MAPS_API_KEY env var. This MUST be a DIFFERENT Google Cloud
    // key from the public embed key below — a private, IP/API-restricted
    // Directions key.
    googleMapsApiKey: '', // Overridden by NUXT_GOOGLE_MAPS_API_KEY
    public: {
      // Client-visible (issue #30): the Maps *embed* iframe key. This ships to
      // the browser by design, so it MUST be HTTP-referrer-restricted in Google
      // Cloud and scoped to the Maps Embed API only. Overridden by
      // NUXT_PUBLIC_GOOGLE_MAPS_API_KEY.
      googleMapsApiKey: '', // Overridden by NUXT_PUBLIC_GOOGLE_MAPS_API_KEY
    },
  },
  nitro: {
    externals: {
      external: ['better-sqlite3']
    }
  }
})
