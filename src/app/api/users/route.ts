import { NextRequest, NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

// GET /api/users - List all users
export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            auditLogs: true,
            voucherActions: true,
          },
        },
      },
    })

    // Get last login from audit logs for each user
    const usersWithLastLogin = await Promise.all(
      users.map(async (user) => {
        const lastAudit = await db.auditLog.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })
        return {
          ...user,
          lastLogin: lastAudit?.createdAt?.toISOString() || null,
          auditCount: user._count.auditLogs,
          actionCount: user._count.voucherActions,
        }
      })
    )

    return NextResponse.json(usersWithLastLogin)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, role, isActive } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }

    const validRoles = ['admin', 'manager', 'accountant', 'auditor', 'viewer']
    const userRole = role || 'viewer'
    if (!validRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        role: userRole,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    // Log the creation using the system user
    try {
      const systemUserId = await getSystemUserId()
      await db.auditLog.create({
        data: {
          userId: systemUserId,
          action: 'CREATE',
          entity: 'User',
          entityId: user.id,
          details: JSON.stringify({ name, email, role: userRole }),
        },
      })
    } catch {
      // Audit log failure shouldn't block user creation
    }

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
