import { PrismaClient } from '../prisma/generated/client'

declare module 'h3' {
  interface H3EventContext {
    prisma: PrismaClient
  }
}
