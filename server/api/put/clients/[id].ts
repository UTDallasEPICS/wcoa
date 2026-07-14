import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { readValidatedBody } from '../../../utils/validation'
import { throwOnPrismaWriteConflict } from '../../../utils/prismaErrors'

// Validate the update payload (issue #90): unknown keys are rejected via
// .strict(), and every field is optional so a partial update only touches what
// it sends — an omitted contact field is a no-op, not a wipe (issue #89).
const updateClientSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
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

  const body = await readValidatedBody(event, updateClientSchema)

  // Soft delete (issue #27): an archived client can't be edited — treat as 404.
  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  })

  if (!client) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Client not found',
    })
  }

  // Build the User update only from fields the caller actually sent (issue #89):
  // omitting email/phone leaves the stored value untouched instead of nulling it.
  const userData: { name?: string; email?: string | null; phone?: string | null } = {}
  if (body.name !== undefined) userData.name = body.name
  if (body.email !== undefined) userData.email = emptyToNull(body.email)
  if (body.phone !== undefined) userData.phone = emptyToNull(body.phone)

  // Wrap the writes so a unique-constraint violation (e.g. setting the email to
  // one another active user already owns) is a clean 409, not a 500 (issue #91).
  try {
    return await prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: client.userId },
          data: userData,
        })
      }

      // Update Address (Link to new/existing address)
      if (body.street && body.city && body.state && body.zip) {
        // Normalize first so case/whitespace-variant addresses collapse onto the
        // unique matchKey (issues #16, #57). Display fields keep original casing.
        const addressData = normalizeAddress({
          street: body.street,
          city: body.city,
          state: body.state,
          zip: body.zip,
        })

        const address = await tx.address.upsert({
          where: {
            matchKey: addressData.matchKey,
          },
          update: {},
          create: addressData,
        })

        await tx.client.update({
          where: { id },
          data: {
            homeAddressId: address.id,
          },
        })
      }

      return await tx.client.findUnique({
        where: { id },
        include: {
          user: true,
          homeAddress: true,
        },
      })
    })
  } catch (err) {
    throwOnPrismaWriteConflict(err, { notFoundMessage: 'Client not found' })
  }
})
