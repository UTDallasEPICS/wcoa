import { describe, expect, it } from 'vitest'
import { fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// R-020..R-024 (REQUIREMENTS.md): the full role × endpoint authorization matrix.
//
// This is the automated form of the 2026-07-14 audit's hand-run matrix. It pins
// the COARSE gate (server/middleware/auth.ts) plus the per-route requireAdmin
// guards, for every API route, for all four principals:
//   anon      → 401 everywhere
//   CLIENT    → 403 everywhere (no internal API access)
//   VOLUNTEER → reads rides + own profile; writes only signup/unsignup/bySession
//   ADMIN     → passes the middleware everywhere ("pass" = anything but 401/403;
//               a 400/404 from the handler still proves the gate opened)
//
// 'pass' cells assert the request was NOT rejected by authn/authz. Handler-level
// outcomes (validation 400s, not-found 404s) are covered by the feature suites.
// signup/unsignup are 'handler403' for ADMIN: the middleware admits admins, but
// the handler rejects them for lacking a volunteer profile — that 403/404 is a
// handler decision, not a gate failure, and this matrix pins that distinction.

type Expect = number | 'pass' | 'handler403'

interface Row {
  method: string
  path: string
  body?: Record<string, unknown>
  anon: Expect
  client: Expect
  volunteer: Expect
  admin: Expect
}

const NOPE = 'nonexistent-id'

const MATRIX: Row[] = [
  // ---- GET: admin-only PII/config listings (R-024)
  {
    method: 'GET',
    path: '/api/get/addresses',
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  { method: 'GET', path: '/api/get/admins', anon: 401, client: 403, volunteer: 403, admin: 'pass' },
  { method: 'GET', path: '/api/get/audit', anon: 401, client: 403, volunteer: 403, admin: 'pass' },
  {
    method: 'GET',
    path: '/api/get/clients',
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'GET',
    path: '/api/get/clients/options',
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'GET',
    path: '/api/get/metrics/completionRate',
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'GET',
    path: '/api/get/metrics/hours',
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'GET',
    path: '/api/get/metrics/topRiders',
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'GET',
    path: '/api/get/notifications/templates',
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  { method: 'GET', path: '/api/get/users', anon: 401, client: 403, volunteer: 403, admin: 'pass' },
  {
    method: 'GET',
    path: `/api/get/users/byEmail/martha@example.com`,
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'GET',
    path: `/api/get/users/byId/${NOPE}`,
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'GET',
    path: '/api/get/volunteers',
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'GET',
    path: '/api/get/volunteers/options',
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  // ---- GET: volunteer-visible reads (R-022)
  {
    method: 'GET',
    path: '/api/get/rides',
    anon: 401,
    client: 403,
    volunteer: 'pass',
    admin: 'pass',
  },
  {
    method: 'GET',
    path: `/api/get/rides/byId/${NOPE}`,
    anon: 401,
    client: 403,
    volunteer: 'pass',
    admin: 'pass',
  },
  {
    method: 'GET',
    path: `/api/get/rides/estimate/${NOPE}`,
    anon: 401,
    client: 403,
    volunteer: 'pass',
    admin: 'pass',
  },
  {
    method: 'GET',
    path: '/api/get/volunteers/bySession',
    anon: 401,
    client: 403,
    volunteer: 'pass',
    admin: 'pass',
  },
  // ---- POST: admin-only creates
  {
    method: 'POST',
    path: '/api/post/admins',
    body: {},
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'POST',
    path: '/api/post/clients',
    body: {},
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'POST',
    path: '/api/post/volunteers',
    body: {},
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'POST',
    path: '/api/post/rides',
    body: {},
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  // ---- POST: volunteer self-service (R-022); admin lacks a volunteer profile → handler 403/404
  {
    method: 'POST',
    path: `/api/post/rides/${NOPE}/signup`,
    body: {},
    anon: 401,
    client: 403,
    volunteer: 'pass',
    admin: 'handler403',
  },
  {
    method: 'POST',
    path: `/api/post/rides/${NOPE}/unsignup`,
    body: {},
    anon: 401,
    client: 403,
    volunteer: 'pass',
    admin: 'handler403',
  },
  // ---- PUT: admin-only updates
  {
    method: 'PUT',
    path: `/api/put/admins/${NOPE}`,
    body: {},
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'PUT',
    path: `/api/put/clients/${NOPE}`,
    body: {},
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'PUT',
    path: '/api/put/notifications/templates/NOPE',
    body: {},
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'PUT',
    path: `/api/put/rides/${NOPE}`,
    body: {},
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'PUT',
    path: `/api/put/volunteers/${NOPE}`,
    body: {},
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  // ---- PUT: volunteer self-service settings (R-022)
  {
    method: 'PUT',
    path: '/api/put/volunteers/bySession/notifications',
    body: {},
    anon: 401,
    client: 403,
    volunteer: 'pass',
    admin: 'pass',
  },
  {
    method: 'PUT',
    path: '/api/put/volunteers/bySession/reminders',
    body: {},
    anon: 401,
    client: 403,
    volunteer: 'pass',
    admin: 'pass',
  },
  {
    method: 'PUT',
    path: '/api/put/volunteers/bySession/status',
    body: {},
    anon: 401,
    client: 403,
    volunteer: 'pass',
    admin: 'pass',
  },
  // ---- DELETE: admin-only
  {
    method: 'DELETE',
    path: `/api/delete/admins/${NOPE}`,
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'DELETE',
    path: `/api/delete/clients/${NOPE}`,
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'DELETE',
    path: `/api/delete/rides/${NOPE}`,
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
  {
    method: 'DELETE',
    path: `/api/delete/volunteers/${NOPE}`,
    anon: 401,
    client: 403,
    volunteer: 403,
    admin: 'pass',
  },
]

async function probe(row: Row, cookie?: string): Promise<number> {
  const res = await appFetch(row.path, {
    method: row.method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    ...(row.body ? { body: JSON.stringify(row.body) } : {}),
  })
  return res.status
}

function check(row: Row, role: 'anon' | 'client' | 'volunteer' | 'admin', status: number) {
  const expected = row[role]
  const label = `${row.method} ${row.path} as ${role}`
  if (expected === 'pass') {
    // Authn/authz opened the gate; whatever the handler said, it wasn't a rejection
    // by the middleware. (403s here would mean the allowlist regressed.)
    expect([401, 403], `${label} should pass the auth gate, got ${status}`).not.toContain(status)
  } else if (expected === 'handler403') {
    // Admins are admitted by the middleware but rejected by the handler
    // ("must be a registered volunteer") — 403 or 404, never 401.
    expect([403, 404], `${label} should be a handler-level rejection`).toContain(status)
  } else {
    expect(status, label).toBe(expected)
  }
}

describe('R-020/R-021/R-022/R-023/R-024: role × endpoint authorization matrix', () => {
  it('R-020: anonymous requests are rejected with 401 on every endpoint', async () => {
    for (const row of MATRIX) check(row, 'anon', await probe(row))
  })

  it('R-021: CLIENT-role sessions are rejected with 403 on every endpoint', async () => {
    const cookie = await loginAs('martha@example.com')
    for (const row of MATRIX) check(row, 'client', await probe(row, cookie))
  })

  it('R-022: VOLUNTEER sessions pass only the documented read/self-service surface', async () => {
    const cookie = await loginAs('bob@example.com')
    for (const row of MATRIX) check(row, 'volunteer', await probe(row, cookie))
  })

  it('R-023: ADMIN sessions pass the auth gate on every endpoint', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    for (const row of MATRIX) check(row, 'admin', await probe(row, cookie))
  })
})
