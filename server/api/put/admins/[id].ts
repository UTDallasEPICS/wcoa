import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { readValidatedBody } from '../../../utils/validation'
import { throwOnPrismaWriteConflict } from '../../../utils/prismaErrors'

// Validate the update payload (issue #90): unknown keys are rejected via
// .strict(), and every field is optional so a partial update only touches what
// it sends — an omitted contact field is a no-op, not a wipe (issue #89).
const updateAdminSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  })
  .strict()

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID is required',
    })
  }

  const body = await readValidatedBody(event, updateAdminSchema)

  // Existence check (issue #91): without it an unknown id fell through to
  // prisma.user.update and surfaced the raw P2025 as a 500. 404 like the sibling
  // update endpoints (put/clients, put/volunteers). Soft delete (issue #27): an
  // archived user is treated as gone.
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  })
  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Admin not found',
    })
  }

  // Build the update only from fields the caller actually sent (issue #89):
  // omitting email/phone leaves the stored value untouched instead of nulling it.
  const data: { name?: string; email?: string | null; phone?: string | null } = {}
  if (body.name !== undefined) data.name = body.name
  if (body.email !== undefined) data.email = emptyToNull(body.email)
  if (body.phone !== undefined) data.phone = emptyToNull(body.phone)

  // Wrap the write so a unique-constraint violation (e.g. reusing another active
  // user's email/phone) is a clean 409, not a 500 (issue #91).
  try {
    return await prisma.user.update({
      where: { id },
      data,
    })
  } catch (err) {
    throwOnPrismaWriteConflict(err, { notFoundMessage: 'Admin not found' })
  }
})
