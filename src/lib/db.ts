import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create a fresh Prisma client. The global cache is only used to avoid
// creating multiple clients during hot reloads in the same dev session.
// If the database file was replaced, the OS-level file handle may still
// point to the old (deleted) inode, so we recreate the client on each
// server start by checking a version stamp.
const DB_VERSION = process.env.PRISMA_DB_VERSION || 'v1'

export const db =
  (globalForPrisma as unknown as { prisma?: PrismaClient; __dbVersion?: string }).__dbVersion === DB_VERSION
    ? (globalForPrisma as unknown as { prisma: PrismaClient }).prisma
    : (() => {
        const client = new PrismaClient({
          log: ['error', 'warn'],
        })
        if (process.env.NODE_ENV !== 'production') {
          globalForPrisma.prisma = client
          ;(globalForPrisma as unknown as { __dbVersion?: string }).__dbVersion = DB_VERSION
        }
        return client
      })()
