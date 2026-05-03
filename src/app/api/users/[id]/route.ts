import { NextRequest, NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

// GET /api/users/[id] - Get a single user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, email, role, isActive, passwordHash } = body

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If email is being changed, check for duplicates
    if (email && email !== existing.email) {
      const emailExists = await db.user.findUnique({ where: { email } })
      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['admin', 'manager', 'accountant', 'auditor', 'viewer']
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (role !== undefined) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    if (passwordHash) updateData.passwordHash = passwordHash

    // Build audit details without passwordHash
    const auditChanges = { ...updateData }
    if (auditChanges.passwordHash) {
      auditChanges.passwordHash = '[REDACTED]'
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Log the update
    try {
      const systemUserId = await getSystemUserId()
      await db.auditLog.create({
        data: {
          userId: systemUserId,
          action: 'UPDATE',
          entity: 'User',
          entityId: id,
          details: JSON.stringify({ changes: auditChanges }),
        },
      })
    } catch {
      // Audit log failure shouldn't block user update
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has audit logs or voucher actions (prevent deletion of active users)
    const [auditCount, actionCount] = await Promise.all([
      db.auditLog.count({ where: { userId: id } }),
      db.voucherApproval.count({ where: { userId: id } }),
    ])

    if (auditCount > 0 || actionCount > 0) {
      // Soft delete: deactivate instead
      const user = await db.user.update({
        where: { id },
        data: { isActive: false },
      })
      try {
        const systemUserId = await getSystemUserId()
        await db.auditLog.create({
          data: {
            userId: systemUserId,
            action: 'DELETE',
            entity: 'User',
            entityId: id,
            details: JSON.stringify({ reason: 'Deactivated (has references)', originalName: existing.name }),
          },
        })
      } catch {
        // Audit log failure shouldn't block operation
      }
      return NextResponse.json({ message: 'User deactivated (has existing references)', user })
    }

    // Hard delete if no references
    await db.user.delete({ where: { id } })

    try {
      const systemUserId = await getSystemUserId()
      await db.auditLog.create({
        data: {
          userId: systemUserId,
          action: 'DELETE',
          entity: 'User',
          entityId: id,
          details: JSON.stringify({ name: existing.name, email: existing.email }),
        },
      })
    } catch {
      // Audit log failure shouldn't block operation
    }

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
