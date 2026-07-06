import type { H3Event } from 'h3'
import type { ZodType } from 'zod'

/**
 * Reads and validates the request body against a zod schema (issue #31).
 *
 * On failure throws a 400 with per-field messages instead of letting an
 * unvalidated body reach Prisma (which mass-assigns unknown columns and
 * 500s on unrecognized keys). On success returns the parsed, whitelisted
 * data — callers should build their Prisma `data` object only from this.
 */
export async function readValidatedBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: { errors: result.error.flatten().fieldErrors },
    })
  }
  return result.data
}
