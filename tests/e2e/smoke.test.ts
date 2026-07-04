import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { loginAs } from '../utils/auth'

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
})

describe('test harness smoke test', () => {
  it('boots the app and serves seeded data', async () => {
    const rides = await $fetch('/api/get/rides')
    expect(Array.isArray(rides)).toBe(true)
    expect(rides.length).toBeGreaterThanOrEqual(9)
  })

  it('logs in via the OTP-from-database helper and reaches an auth-gated endpoint', async () => {
    const cookie = await loginAs('bob@example.com')
    const me = await $fetch<{ user: { email: string } }>('/api/get/volunteers/bySession', {
      headers: { cookie },
    })
    expect(me.user.email).toBe('bob@example.com')
  })

  it('rejects the auth-gated endpoint without a session', async () => {
    await expect($fetch('/api/get/volunteers/bySession')).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})
