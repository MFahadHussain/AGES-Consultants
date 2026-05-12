import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Helper to get or create the system user for audit logs and voucher actions
let _systemUserId: string | null = null

export async function getSystemUserId(): Promise<string> {
  if (_systemUserId) return _systemUserId

  const existing = await db.user.findFirst({ where: { email: 'system@acctfin.erp' } })
  if (existing) {
    _systemUserId = existing.id
    return _systemUserId
  }

  const created = await db.user.create({
    data: { email: 'system@acctfin.erp', name: 'System', role: 'admin', isActive: true },
  })
  _systemUserId = created.id
  return _systemUserId
}
