import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/auth/seed — Create default users for the system
// Uses crypto.subtle for hashing instead of bcrypt to avoid native module issues with Turbopack
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function POST_HANDLER() {
  try {
    const defaultPasswordHash = await hashPassword('AcctFin@2025')

    const users = [
      { email: 'admin@acctfin.com', name: 'Fahad Hussain', role: 'admin', passwordHash: defaultPasswordHash },
      { email: 'manager@acctfin.com', name: 'Ahmed Khan', role: 'manager', passwordHash: defaultPasswordHash },
      { email: 'accountant@acctfin.com', name: 'Sara Ali', role: 'accountant', passwordHash: defaultPasswordHash },
      { email: 'auditor@acctfin.com', name: 'Usman Malik', role: 'auditor', passwordHash: defaultPasswordHash },
      { email: 'viewer@acctfin.com', name: 'Ayesha Noor', role: 'viewer', passwordHash: defaultPasswordHash },
      { email: 'ahussain@acctfin.com', name: 'Ali Hussain', role: 'accountant', passwordHash: defaultPasswordHash, isActive: false },
    ]

    let created = 0
    let skipped = 0

    for (const userData of users) {
      const existing = await db.user.findUnique({ where: { email: userData.email } })
      if (existing) {
        // Update password hash if empty
        if (!existing.passwordHash) {
          await db.user.update({
            where: { id: existing.id },
            data: { passwordHash: userData.passwordHash },
          })
        }
        skipped++
      } else {
        await db.user.create({ data: userData })
        created++
      }
    }

    return NextResponse.json({
      message: 'Default users seeded',
      created,
      skipped,
      defaultPassword: 'AcctFin@2025',
      note: 'All users have the same default password. Change in production.',
    })
  } catch (error) {
    console.error('Seed users error:', error)
    return NextResponse.json({ error: 'Failed to seed users' }, { status: 500 })
  }
}

export const POST = withAudit('auth', POST_HANDLER);
