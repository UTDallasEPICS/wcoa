import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #6: server/api/delete/admins/[id].ts read the route param with
// getRouterParam(event, '') (empty name), so `id` was always undefined and the
// handler always threw 400 — admin deletion never worked. This test creates a
// throwaway admin and deletes it, which requires the param to be read as 'id'.
//
// Pre-fix this fails: the DELETE returns 400 regardless of the real id, so the
// "delete succeeds" assertion never passes and the admin is never removed.

describe('admin delete route param (#6)', () => {
  it('deletes an admin by id and the record is gone afterward', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')

    // Create a throwaway admin (do NOT touch seeded accounts, keep idempotent).
    const email = `throwaway-admin-${Date.now()}@example.com`
    const created = await $fetch<{ id: string; email: string }>('/api/post/admins', {
      method: 'POST',
      headers: { cookie },
      body: { name: 'Throwaway Admin', email },
    })
    expect(created.id).toBeTruthy()
    expect(created.email).toBe(email)

    // Delete it — this is the assertion that fails pre-fix (endpoint returns 400).
    const deleted = await $fetch<{ id: string }>(`/api/delete/admins/${created.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(deleted.id).toBe(created.id)

    // Confirm it is actually gone: it must no longer appear in the roster and a
    // second delete must fail (record not found).
    const { items: admins } = await $fetch<{ items: Array<{ id: string }> }>(
      '/api/get/admins?pageSize=100',
      { headers: { cookie } }
    )
    expect(admins.some((a) => a.id === created.id)).toBe(false)

    await expect(
      $fetch(`/api/delete/admins/${created.id}`, { method: 'DELETE', headers: { cookie } })
    ).rejects.toBeTruthy()
  })
})
