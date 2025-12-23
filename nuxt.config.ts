export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', 'nuxt-cron'],
  css: ['./assets/css/main.css'],
  runtimeConfig: {
    public: {
      googleMapsApiKey: '', // Overridden by NUXT_PUBLIC_GOOGLE_MAPS_API_KEY
    },
  },
})
