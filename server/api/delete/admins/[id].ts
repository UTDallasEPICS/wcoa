import { Prisma } from '../../../../prisma/generated/client'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Admin ID is required',
    })
  }

  // Issue #88: reject self-delete. An admin archiving their own account (and, in
  // particular, the last admin — see the count guard below) can permanently lock
  // the org out of user management, since only an ADMIN can create/promote
  // admins (POST /api/post/admins is admin-only). The caller's session is
  // resolved by the global auth middleware onto event.context.auth.
  const session = getAuth(event)
  if (session?.user?.id === id) {
    throw createError({
      statusCode: 409,
      statusMessage: 'You cannot delete your own admin account',
    })
  }

  // Issue #88: this endpoint deletes ADMINs only. Without the role filter it
  // would archive ANY user (e.g. a VOLUNTEER's user row), leaving a half-archived
  // inconsistent state — the volunteer profile stays active and their ASSIGNED
  // rides are never released, unlike a proper delete/volunteers. Scope the lookup
  // to role: 'ADMIN' so a non-admin id resolves to "not found" (404).
  //
  // Soft delete (issue #27): archive the user instead of destroying it. Read the
  // current contact values so we can RELEASE them: copy email -> deletedEmail and
  // phone -> deletedPhone, then null out email/phone so the same email/phone can
  // be reused by a new record without a unique violation (decision #2). Guard on
  // deletedAt: null so a second delete 404s (P2025) rather than re-archiving.
  const existing = await prisma.user.findFirst({
    where: { id, role: 'ADMIN', deletedAt: null },
    select: { email: true, phone: true },
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Admin not found' })
  }

  // Issue #88: never delete the last remaining admin. In practice this is almost
  // always a self-delete (only an admin can call this, and the sole admin
  // deleting themselves is caught above), so this early check is mainly a clear,
  // fast error for the common sequential case. It is NOT sufficient on its own:
  // two admins deleting EACH OTHER concurrently are not self-deletes and could
  // both read count > 1 here before either archive commits — so the invariant is
  // re-checked inside the write-serialized transaction below.
  const activeAdmins = await prisma.user.count({
    where: { role: 'ADMIN', deletedAt: null },
  })
  if (activeAdmins <= 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cannot delete the last remaining admin',
    })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        // role: 'ADMIN' mirrors the findFirst guard above (issue #88,
        // defense-in-depth) so this path can never archive a non-admin.
        where: { id, role: 'ADMIN', deletedAt: null },
        data: {
          deletedAt: new Date(),
          deletedEmail: existing.email,
          deletedPhone: existing.phone,
          email: null,
          phone: null,
        },
      })
      // Revoke sessions (issue #27, decision #1): a hard delete used to cascade
      // to the session table and log the user out. Soft delete must do the same
      // explicitly, or an archived user's live cookie would keep API access.
      await tx.session.deleteMany({ where: { userId: id } })
      // Concurrency backstop for the last-admin guard (issue #88): re-count
      // admins AFTER this archive, inside the transaction. better-sqlite3
      // serializes write transactions, so a concurrent cross-delete has already
      // committed (and is counted) or is still blocked; either way, if archiving
      // this admin would leave zero admins, roll back with the same 409 rather
      // than lock the org out.
      const remainingAdmins = await tx.user.count({
        where: { role: 'ADMIN', deletedAt: null },
      })
      if (remainingAdmins < 1) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Cannot delete the last remaining admin',
        })
      }
      return u
    })

    // Audit (issue #28): record the archival after the transaction commits.
    await writeAuditLog(event, {
      action: 'ADMIN_DELETED',
      targetType: 'User',
      targetId: id,
    })

    return updated
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw createError({ statusCode: 404, statusMessage: 'Admin not found' })
    }
    throw err
  }
})
