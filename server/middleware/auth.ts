import { auth } from '../utils/auth'

// Global API authorization (issues #1, #2).
//
// Every /api route requires an authenticated session, except:
//   - /api/auth/**  — better-auth's own login/OTP endpoints
// Role model:
//   - ADMIN      — full access
//   - VOLUNTEER  — reads, plus their own self-service writes (see VOLUNTEER_WRITE_ALLOW)
//   - CLIENT     — no access to the internal API (the app is admin/volunteer facing)
//
// Endpoint handlers may still add finer checks (e.g. signup.ts verifies the
// volunteer owns the ride); this middleware is the coarse gate in front of them.

// Volunteer self-service writes, matched against the path.
const VOLUNTEER_WRITE_ALLOW = [
  /^\/api\/post\/rides\/[^/]+\/signup$/,
  /^\/api\/post\/rides\/[^/]+\/unsignup$/,
  /^\/api\/post\/rides\/[^/]+\/complete$/,
  /^\/api\/put\/volunteers\/bySession(\/|$)/,
  // Saving your own UI preferences is a self-service write. The handler scopes
  // strictly to the session user (no id in the path), so there's nothing to
  // escalate — a volunteer can only ever write their own preference row.
  /^\/api\/put\/preferences(\/|$)/,
]

function isWrite(method: string) {
  return method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH'
}

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0]

  // Only guard the API, and let better-auth manage its own routes.
  if (!path.startsWith('/api/')) return
  if (path.startsWith('/api/auth/')) return

  const session = await auth.api.getSession({ headers: event.headers })
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  // Expose the resolved session to downstream handlers so they can scope data
  // (issue #3) without re-running the session lookup.
  event.context.auth = session

  const role = (session.user as { role?: string }).role

  if (role === 'ADMIN') return

  if (role === 'VOLUNTEER') {
    if (isWrite(event.method) && !VOLUNTEER_WRITE_ALLOW.some((re) => re.test(path))) {
      throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
    }
    return
  }

  // CLIENT or any unmapped role: no internal API access.
  throw createError({ statusCode: 403, statusMessage: 'You do not have access to this resource' })
})
