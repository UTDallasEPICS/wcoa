import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { readValidatedBody } from '../../../utils/validation'

// Validate the create payload (issue #90): name + a full address are required,
// email is optional (a client may have none), and unknown keys are rejected via
// .strict().
const createClientSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
  })
  .strict()

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, createClientSchema)

  // 1. Upsert User
  // Normalize the email once (issue #15/#89 semantics) so the lookup and the
  // stored value agree — otherwise a padded "a@b.com " would miss the untrimmed
  // lookup yet collide with the trimmed stored value on insert (P2002 -> 500).
  const email = emptyToNull(body.email)
  let user = null
  if (email) {
    user = await prisma.user.findUnique({
      where: { email },
      include: { volunteer: true }
    })
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: body.name,
        email,
        phone: emptyToNull(body.phone),
        role: 'CLIENT'
      }
    })
  } else {
    // Singular-role guard (issue #92): reject creating a client profile on an
    // email that already belongs to a volunteer or admin account. Roles are
    // singular here; without this the user would end up with BOTH a volunteer
    // and a client profile while role stays VOLUNTEER — a dual profile invisible
    // to the role model that delete/volunteers would strand. An existing CLIENT
    // (or a plain user with no profile) is unaffected and falls through to the
    // "already a client" 400 / normal create below.
    const hasActiveVolunteer = !!user.volunteer && user.volunteer.deletedAt === null
    if (user.role === 'VOLUNTEER' || user.role === 'ADMIN' || hasActiveVolunteer) {
      const accountType = user.role === 'ADMIN' ? 'an admin' : 'a volunteer'
      throw createError({
        statusCode: 409,
        statusMessage: `That email belongs to ${accountType} account`,
      })
    }
    // Existing user (matched by email): update name, and phone only when the
    // caller actually sent it (issue #89) — omitting phone here must not wipe the
    // stored number.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        ...(body.phone !== undefined ? { phone: emptyToNull(body.phone) } : {}),
        // Don't downgrade ADMIN/VOLUNTEER
      }
    })
  }

  // 2. Upsert Address
  // Normalize first so case/whitespace-variant addresses collapse onto the
  // unique matchKey instead of spawning duplicate rows (issues #16, #57). The
  // display fields keep the user's original casing; only matchKey is lossy.
  const addressData = normalizeAddress({
    street: body.street,
    city: body.city,
    state: body.state,
    zip: body.zip,
  })

  const address = await prisma.address.upsert({
    where: {
      matchKey: addressData.matchKey
    },
    update: {},
    create: addressData
  })

  // 3. Create Client profile
  const existingClient = await prisma.client.findUnique({
    where: { userId: user.id }
  })

  if (existingClient) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User is already a client',
    })
  }

  return await prisma.client.create({
    data: {
      userId: user.id,
      homeAddressId: address.id
    },
    include: {
      user: true,
      homeAddress: true
    }
  })
})
