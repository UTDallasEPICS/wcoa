import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared, fetchWithQueryCount } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #13: the list endpoints used to run unbounded findMany() (no take/skip),
// loading the entire table on every request. They now return a paginated
// envelope { items, total, page, pageSize } with a hard-capped pageSize, and the
// dropdowns use dedicated bounded options endpoints.

type RideEnvelope = {
  items: Array<{ id: string }>
  total: number
  page: number
  pageSize: number
}

describe('list pagination (#13)', () => {
  it('returns a bounded page-1 envelope for /api/get/rides', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const res = await $fetch<RideEnvelope>('/api/get/rides?page=1&pageSize=2', {
      headers: { cookie },
    })

    expect(Array.isArray(res.items)).toBe(true)
    expect(res.items.length).toBe(2)
    // Seed has 9 rides; the total reflects the full matching set, not the page.
    expect(res.total).toBeGreaterThanOrEqual(9)
    expect(res.page).toBe(1)
    expect(res.pageSize).toBe(2)
  })

  it('page 2 returns a different, non-overlapping slice', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const p1 = await $fetch<RideEnvelope>('/api/get/rides?page=1&pageSize=2', {
      headers: { cookie },
    })
    const p2 = await $fetch<RideEnvelope>('/api/get/rides?page=2&pageSize=2', {
      headers: { cookie },
    })

    expect(p2.page).toBe(2)
    expect(p2.items.length).toBe(2)
    const p1Ids = new Set(p1.items.map((r) => r.id))
    const overlap = p2.items.filter((r) => p1Ids.has(r.id))
    expect(overlap).toHaveLength(0)
  })

  it('hard-caps an oversized pageSize (never unbounded)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const res = await $fetch<RideEnvelope>('/api/get/rides?page=1&pageSize=100000', {
      headers: { cookie },
    })
    // Clamped to MAX_PAGE_SIZE (100), not honored verbatim.
    expect(res.pageSize).toBe(100)
    expect(res.items.length).toBeLessThanOrEqual(100)
  })

  it('all four list endpoints return the envelope shape', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    for (const path of [
      '/api/get/rides',
      '/api/get/clients',
      '/api/get/volunteers',
      '/api/get/admins',
    ]) {
      const res = await $fetch<RideEnvelope>(path, { headers: { cookie } })
      expect(Array.isArray(res.items), `${path} .items`).toBe(true)
      expect(typeof res.total, `${path} .total`).toBe('number')
      expect(res.page, `${path} .page`).toBe(1)
      expect(typeof res.pageSize, `${path} .pageSize`).toBe('number')
    }
  })

  it('stays query-bounded (page query + count), not proportional to rows', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const { status, queryCount, body } = await fetchWithQueryCount<RideEnvelope>(
      '/api/get/rides?page=1&pageSize=2',
      { headers: { cookie } }
    )
    expect(status).toBe(200)
    expect(Array.isArray(body.items)).toBe(true)
    // findMany (with includes) + count in one transaction — a small constant,
    // independent of how many rides exist.
    expect(queryCount).toBeLessThanOrEqual(6)
  })

  it('applies server-side status filtering with pagination', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const res = await $fetch<RideEnvelope & { items: Array<{ status: string }> }>(
      '/api/get/rides?include=status:CREATED&pageSize=100',
      { headers: { cookie } }
    )
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.items.every((r) => r.status === 'CREATED')).toBe(true)
    // Seed has 4 CREATED rides.
    expect(res.total).toBe(4)
  })
})

describe('dropdown options endpoints (#13)', () => {
  it('/api/get/clients/options returns a minimal { id, name } list', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const clients = await $fetch<Array<{ id: string; name: string; homeAddress: unknown }>>(
      '/api/get/clients/options',
      { headers: { cookie } }
    )
    expect(Array.isArray(clients)).toBe(true)
    expect(clients.length).toBeGreaterThanOrEqual(3)
    for (const c of clients) {
      expect(typeof c.id).toBe('string')
      expect(typeof c.name).toBe('string')
      // No PII leak: name only (plus homeAddress for the autofill), no email/phone.
      expect(c).not.toHaveProperty('user')
    }
  })

  it('/api/get/volunteers/options returns AVAILABLE volunteers as { id, name }', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const vols = await $fetch<Array<{ id: string; name: string }>>(
      '/api/get/volunteers/options',
      { headers: { cookie } }
    )
    expect(Array.isArray(vols)).toBe(true)
    // All 3 seeded volunteers are AVAILABLE.
    expect(vols.length).toBe(3)
    for (const v of vols) {
      expect(typeof v.id).toBe('string')
      expect(typeof v.name).toBe('string')
      expect(v).not.toHaveProperty('user')
    }
  })
})
