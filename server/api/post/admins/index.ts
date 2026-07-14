import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { readValidatedBody } from '../../../utils/validation'

// Validate the create payload (issue #90): name + email are required, phone is
// optional, and unknown keys are rejected via .strict().
const createAdminSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().min(1),
    phone: z.string().nullable().optional(),
  })
  .strict()

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, createAdminSchema)

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: body.email },
  })

  if (existingUser) {
    // If user exists, promote to ADMIN. Update phone only when the caller sent
    // it (issue #89) so promoting a user without a phone field doesn't wipe it.
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: 'ADMIN',
        name: body.name,
        ...(body.phone !== undefined ? { phone: emptyToNull(body.phone) } : {}),
      },
    })
    // Audit (issue #28): a user was promoted to ADMIN — a privileged change.
    await writeAuditLog(event, {
      action: 'USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: updated.id,
      details: { from: existingUser.role, to: 'ADMIN' },
    })
    return updated
  } else {
    // Create new user
    const created = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: emptyToNull(body.phone),
        role: 'ADMIN',
      },
    })
    // Audit (issue #28): a new ADMIN user was created.
    await writeAuditLog(event, {
      action: 'USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: created.id,
      details: { from: null, to: 'ADMIN' },
    })
    return created
  }
})
