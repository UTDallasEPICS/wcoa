import { clockHour12, detectHour12 } from '../utils/datetime'

// Decide the viewer's 12h/24h clock cycle and share it with formatDateTime
// (app/utils/datetime.ts). Runs on the client only, AFTER the app is mounted, so
// the first client render still matches the server's en-US default (12h) — no
// hydration mismatch — and times then re-render in the resolved cycle.
//
// An explicit per-user preference (clockFormat: "12h" | "24h") wins; "auto" (or
// no preference) falls back to browser detection. The override exists because
// Chrome/V8 don't honor macOS's force-24h flag for en-US, so detection alone
// can't respect that setting.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', async () => {
    let clockFormat: string | null = null
    try {
      const pref = await $fetch<{ clockFormat: string | null }>('/api/get/preferences')
      clockFormat = pref?.clockFormat ?? null
    } catch {
      // Not signed in / no preference — fall through to detection.
    }
    if (clockFormat === '12h') clockHour12.value = true
    else if (clockFormat === '24h') clockHour12.value = false
    else clockHour12.value = detectHour12()
  })
})
