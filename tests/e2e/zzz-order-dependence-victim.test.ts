import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

// Order-independence regression, part 2 of 2 (issue #62).
//
// This `zzz-` file runs AFTER `aaa-order-dependence-mutator.test.ts`, which
// deletes every seeded ride and does not clean up. Its assertions depend on the
// seeded rows still being present.
//
// PRE-FIX (no per-file reset): the mutator's deletions persist and this file
// sees 0 rides — `toBeGreaterThanOrEqual(9)` fails, proving the suite is
// order-dependent (the pre-existing smoke.test.ts fails the same way).
//
// POST-FIX: the per-file reset in tests/setup-reset-db.ts restores the seed
// snapshot before this file runs, so the seeded rows are back regardless of
// what earlier files did.

await bootShared()

describe('order-dependence: seed-dependent victim', () => {
  it('still sees the seeded rides even though an earlier file deleted them all', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const rides = await $fetch<unknown[]>('/api/get/rides', { headers: { cookie } })
    expect(rides.length).toBeGreaterThanOrEqual(9)
  })

  it('restores seeded clients and volunteers too', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const clients = await $fetch<unknown[]>('/api/get/clients', { headers: { cookie } })
    const volunteers = await $fetch<unknown[]>('/api/get/volunteers', { headers: { cookie } })
    expect(clients.length).toBeGreaterThanOrEqual(3)
    expect(volunteers.length).toBeGreaterThanOrEqual(3)
  })
})
