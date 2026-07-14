import type { H3Event } from 'h3'
import { prisma } from './prisma'
import { getAuth } from './authz'

type AuditEntry = {
  action: string
  targetType: string
  targetId?: string | null
  // Keep this MINIMAL — a small description of the change (e.g. { from, to }).
  // Never dump full client records / PII / secrets in here.
  details?: Record<string, unknown> | null
}

/**
 * Records an audit-log row for a successful mutation (issue #28).
 *
 * The acting user is resolved from the session the global auth middleware
 * already put on the event (`event.context.auth`, via getAuth) — the same
 * source the authz guards use — so callers don't re-run the session lookup.
 *
 * Fire-and-forget by contract: an audit-write failure MUST NEVER break or fail
 * the underlying action. Everything is wrapped in try/catch and errors are
 * swallowed + logged, mirroring the codebase's non-blocking style (sendEmail,
 * broadcastNotification). Call this AFTER the action has succeeded.
 */
export async function writeAuditLog(event: H3Event, entry: AuditEntry): Promise<void> {
  try {
    const auth = getAuth(event)
    // If we can't resolve an actor (shouldn't happen behind the auth middleware)
    // fall back to 'unknown' rather than throwing — the log is best-effort.
    const userId = auth?.user?.id ?? 'unknown'

    await prisma.auditLog.create({
      data: {
        userId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        details: entry.details ?? undefined,
      },
    })
  } catch (err) {
    // Never propagate — the mutation already succeeded.
    console.error('[audit] failed to write audit log', err)
  }
}
