import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

// Order-independence regression, part 1 of 2 (issue #62).
//
// Vitest runs files alphabetically with fileParallelism:false, so this `aaa-`
// file runs BEFORE `zzz-order-dependence-victim.test.ts`. It deliberately
// destroys seeded rows (deletes every ride) and does NOT clean up after
// itself — exactly the hostile, poorly-behaved mutating test the harness must
// tolerate. Before the fix this corruption leaked into every later file; now
// the per-file reset in tests/setup-reset-db.ts restores the seed snapshot at
// the start of each file, so no file inherits these deletions.

await bootShared()

describe('order-dependence: hostile mutator', () => {
  it('deletes every seeded ride and leaves the DB corrupted for the next file', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')

    const before = await $fetch<{ id: string }[]>('/api/get/rides', { headers: { cookie } })
    expect(before.length).toBeGreaterThanOrEqual(9)

    for (const ride of before) {
      await $fetch(`/api/delete/rides/${ride.id}`, { method: 'DELETE', headers: { cookie } })
    }

    const after = await $fetch<unknown[]>('/api/get/rides', { headers: { cookie } })
    expect(after.length).toBe(0)
    // Intentionally no cleanup: later files must not depend on our leftovers.
  })
})
