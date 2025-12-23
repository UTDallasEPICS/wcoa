import { defineCronHandler } from '#nuxt/cron'
import { processReminders } from '../utils/scheduler'

export default defineCronHandler('everyFiveMinutes', async () => {
  try {
    console.log('[Cron] Checking for ride reminders...')
    await processReminders()
  } catch (err) {
    console.error('[Cron] Error in reminder job:', err)
  }
}, {
  runOnInit: true
})
