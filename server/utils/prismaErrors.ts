import { Prisma } from '../../prisma/generated/client'

/**
 * Maps the two Prisma errors that ordinary user input can trigger on people /
 * template writes onto clean HTTP responses instead of an opaque 500 (issue #91):
 *
 *   P2002 (unique constraint) → 409  — e.g. changing an email/phone to one that
 *                                       already belongs to another active user.
 *   P2025 (record not found)  → 404  — e.g. updating a record that doesn't exist.
 *
 * Call it from a catch block wrapping the write(s). Anything that isn't one of
 * these two known request errors is rethrown unchanged, so genuine faults still
 * surface as 500s.
 */
export function throwOnPrismaWriteConflict(
  err: unknown,
  opts: { notFoundMessage?: string } = {},
): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: 'That email or phone number is already in use',
      })
    }
    if (err.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: opts.notFoundMessage ?? 'Not found',
      })
    }
  }
  throw err
}
