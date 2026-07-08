import { describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #1: every core CRUD endpoint must require an authenticated session.
// Issue #2: only admins may create/promote admins.
describe('API auth middleware (#1, #2)', () => {
  it('rejects unauthenticated reads of core data', async () => {
    for (const path of [
      '/api/get/rides',
      '/api/get/clients',
      '/api/get/volunteers',
      '/api/get/users',
      '/api/get/admins',
      '/api/get/addresses',
      '/api/get/metrics/completionRate',
    ]) {
      await expect($fetch(path), `${path} should require auth`).rejects.toMatchObject({
        statusCode: 401,
      })
    }
  })

  it('rejects unauthenticated writes and deletes', async () => {
    await expect(
      $fetch('/api/post/admins', {
        method: 'POST',
        body: { name: 'Intruder', email: 'intruder@example.com' },
      })
    ).rejects.toMatchObject({ statusCode: 401 })

    await expect(
      $fetch('/api/delete/clients/any-id', { method: 'DELETE' })
    ).rejects.toMatchObject({ statusCode: 401 })

    await expect(
      $fetch('/api/put/rides/any-id', { method: 'PUT', body: { notes: 'hax' } })
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('forbids volunteers from admin-only actions (#2)', async () => {
    const cookie = await loginAs('bob@example.com')

    await expect(
      $fetch('/api/post/admins', {
        method: 'POST',
        headers: { cookie },
        body: { name: 'Evil Bob', email: 'evil-bob@example.com' },
      })
    ).rejects.toMatchObject({ statusCode: 403 })

    await expect(
      $fetch('/api/delete/volunteers/any-id', { method: 'DELETE', headers: { cookie } })
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('forbids client-role users entirely', async () => {
    const cookie = await loginAs('martha@example.com')
    await expect($fetch('/api/get/rides', { headers: { cookie } })).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('volunteers keep the access their dashboard needs', async () => {
    const cookie = await loginAs('bob@example.com')
    const rides = await $fetch('/api/get/rides', { headers: { cookie } })
    expect(Array.isArray(rides)).toBe(true)

    const me = await $fetch<{ user: { email: string } }>('/api/get/volunteers/bySession', {
      headers: { cookie },
    })
    expect(me.user.email).toBe('bob@example.com')
  })

  it('admins can still manage admins', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const created = await $fetch<{ role: string }>('/api/post/admins', {
      method: 'POST',
      headers: { cookie },
      body: { name: 'New Admin', email: 'new-admin@example.com' },
    })
    expect(created.role).toBe('ADMIN')
  })

  it('login gate still blocks unknown emails from requesting an OTP (#20 regression guard)', async () => {
    const res = await appFetch('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.99.9.1' },
      body: JSON.stringify({ email: 'total-stranger@example.com', type: 'sign-in' }),
    })
    expect(res.status).toBe(400)
  })
})
