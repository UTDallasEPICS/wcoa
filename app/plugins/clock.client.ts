import { clockHour12 } from '../utils/datetime'

// Detect the viewer's 12h/24h clock preference and share it with formatDateTime
// (app/utils/datetime.ts). Runs on the client only, AFTER the app is mounted, so
// the first client render still matches the server's en-US default (12h) — no
// hydration mismatch — and times then re-render in the user's preferred cycle.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    try {
      const cycle = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions()
        .hourCycle
      clockHour12.value = cycle === 'h11' || cycle === 'h12'
    } catch {
      // Fall back to the 12h default if the environment can't report a cycle.
    }
  })
})
