import { describe, expect, it } from 'vitest'
import { fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #4: the global route middleware must guard internal pages per role,
// not only special-case VOLUNTEER. A logged-in CLIENT (or any unmapped role)
// must not be able to render /people, /admin/*, or the dashboard.
//
// Nuxt route middleware runs during SSR, so a blocked navigation returns an
// HTTP redirect. We use `fetch` (not `$fetch`) so redirects are NOT followed,
// and assert on the redirect status + Location.

// Internal admin-only pages that a CLIENT and a VOLUNTEER must never reach.
const ADMIN_ONLY = ['/', '/people', '/admin/notifications']
// Pages the global middleware lets a VOLUNTEER reach. `/settings` is
// additionally guarded by the page itself (volunteer-only, out of scope for
// #4), so we only assert /rides here for the "VOLUNTEER can reach" case.
const VOLUNTEER_ALLOWED = ['/rides', '/settings']
const VOLUNTEER_REACHABLE = ['/rides']

function isRedirect(res: { status: number }) {
  return res.status >= 300 && res.status < 400
}

describe('frontend route guard (#4)', () => {
  it('redirects a logged-in CLIENT away from every internal page', async () => {
    const cookie = await loginAs('martha@example.com')
    for (const path of [...ADMIN_ONLY, ...VOLUNTEER_ALLOWED]) {
      const res = await appFetch(path, { headers: { cookie }, redirect: 'manual' })
      expect(isRedirect(res), `CLIENT should be redirected away from ${path} (got ${res.status})`).toBe(
        true
      )
      const location = res.headers.get('location') || ''
      expect(location, `CLIENT redirect from ${path} should not stay on an internal page`).toContain(
        '/auth'
      )
    }
  })

  it('redirects a VOLUNTEER away from admin-only pages', async () => {
    const cookie = await loginAs('bob@example.com')
    for (const path of ADMIN_ONLY) {
      const res = await appFetch(path, { headers: { cookie }, redirect: 'manual' })
      expect(
        isRedirect(res),
        `VOLUNTEER should be redirected away from ${path} (got ${res.status})`
      ).toBe(true)
    }
  })

  it('lets a VOLUNTEER reach their own pages', async () => {
    const cookie = await loginAs('bob@example.com')
    for (const path of VOLUNTEER_REACHABLE) {
      const res = await appFetch(path, { headers: { cookie }, redirect: 'manual' })
      expect(isRedirect(res), `VOLUNTEER should reach ${path} (got redirect ${res.status})`).toBe(
        false
      )
      expect(res.status).toBe(200)
    }
  })

  it('lets an ADMIN reach the admin-only internal pages', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    for (const path of ADMIN_ONLY) {
      const res = await appFetch(path, { headers: { cookie }, redirect: 'manual' })
      expect(isRedirect(res), `ADMIN should reach ${path} (got redirect ${res.status})`).toBe(false)
      expect(res.status).toBe(200)
    }
  })

  it('redirects an unauthenticated visitor to /auth', async () => {
    const res = await appFetch('/people', { redirect: 'manual' })
    expect(isRedirect(res)).toBe(true)
    expect(res.headers.get('location') || '').toContain('/auth')
  })
})
