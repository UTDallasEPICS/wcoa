import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.name || !body.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name and Email are required',
    })
  }

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: body.email },
  })

  if (existingUser) {
    // If user exists, update role to ADMIN
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: 'ADMIN',
        name: body.name,
        phone: emptyToNull(body.phone),
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
