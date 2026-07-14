import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

describe('test harness smoke test', () => {
  it('boots the app and serves seeded data (authenticated)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    // /api/get/rides returns a paginated envelope (issue #13).
    const rides = await $fetch<{ items: unknown[]; total: number }>(
      '/api/get/rides?pageSize=100',
      { headers: { cookie } }
    )
    expect(Array.isArray(rides.items)).toBe(true)
    expect(rides.total).toBeGreaterThanOrEqual(9)
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
