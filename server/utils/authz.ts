import type { H3Event } from 'h3'

type SessionCtx = { user: { id: string; role?: string } }

/**
 * Reads the session resolved by the global auth middleware
 * (server/middleware/auth.ts) from the event context.
 */
export function getAuth(event: H3Event): SessionCtx | undefined {
  return event.context.auth as SessionCtx | undefined
}

/**
 * Guards an endpoint so only ADMINs can reach it. Used to keep bulk PII
 * listings (client/volunteer rosters) off limits to non-admins (issue #3).
 * The global middleware already enforces authentication, so a missing/non-admin
 * role here means a logged-in non-admin.
 */
export function requireAdmin(event: H3Event): SessionCtx {
  const session = getAuth(event)
  if (session?.user?.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }
  return session
}
