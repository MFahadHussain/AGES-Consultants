import { NextRequest, NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'
import bcrypt from 'bcryptjs'

// GET /api/users/[id] - Get a single user with full details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        phone: true,
        role: true,
        isActive: true,
        isLocked: true,
        lockedUntil: true,
        failedLoginAttempts: true,
        forcePasswordChange: true,
        passwordChangedAt: true,
        passwordExpiresAt: true,
        avatarUrl: true,
        branchId: true,
        departmentId: true,
        employeeId: true,
        designation: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdBy: true,
        updatedBy: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: { id: true, code: true, name: true, city: true },
        },
        department: {
          select: { id: true, code: true, name: true },
        },
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        userPermissions: {
          include: {
            permission: true,
          },
        },
        sessions: {
          where: { isActive: true },
          orderBy: { lastActivityAt: 'desc' },
          take: 5,
          select: {
            id: true,
            ipAddress: true,
            deviceInfo: true,
            lastActivityAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            auditLogs: true,
            voucherActions: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Compute effective permissions (from roles + user overrides)
    const rolePermissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => ({
        permissionId: rp.permissionId,
        code: rp.permission.code,
        name: rp.permission.name,
        module: rp.permission.module,
        action: rp.permission.action,
        resource: rp.permission.resource,
        isGranted: rp.isGranted,
        source: `role:${ur.role.code}`,
      }))
    )

    const userOverrides = user.userPermissions.map((up) => ({
      permissionId: up.permissionId,
      code: up.permission.code,
      name: up.permission.name,
      module: up.permission.module,
      action: up.permission.action,
      resource: up.permission.resource,
      isGranted: up.isGranted,
      source: 'user_override',
    }))

    // Merge: user overrides take precedence
    const permissionMap = new Map<string, (typeof rolePermissions)[0] & { source: string }>()
    for (const rp of rolePermissions) {
      const existing = permissionMap.get(rp.permissionId)
      if (!existing || rp.isGranted) {
        permissionMap.set(rp.permissionId, rp)
      }
    }
    for (const up of userOverrides) {
      permissionMap.set(up.permissionId, up)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        roles: user.userRoles.map((ur) => ({
          id: ur.role.id,
          code: ur.role.code,
          name: ur.role.name,
          level: ur.role.level,
          isPrimary: ur.isPrimary,
          grantedAt: ur.grantedAt,
          expiresAt: ur.expiresAt,
        })),
        primaryRole: user.userRoles.find((ur) => ur.isPrimary)?.role || null,
        effectivePermissions: Array.from(permissionMap.values()),
        activeSessions: user.sessions,
        auditCount: user._count.auditLogs,
        actionCount: user._count.voucherActions,
      },
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

// PUT /api/users/[id] - Update a user (with new fields, password reset, activation, lock/unlock)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      name,
      email,
      username,
      phone,
      role,
      isActive,
      branchId,
      departmentId,
      employeeId,
      designation,
      forcePasswordChange,
      avatarUrl,
      // Special actions
      resetPassword,
      newPassword,
      activate,
      deactivate,
      lock,
      unlock,
      updatedBy,
    } = body

    const existing = await db.user.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // If email is being changed, check for duplicates
    if (email && email !== existing.email) {
      const emailExists = await db.user.findUnique({ where: { email } })
      if (emailExists) {
        return NextResponse.json(
          { success: false, error: 'Email already in use' },
          { status: 409 }
        )
      }
    }

    // If username is being changed, check for duplicates
    if (username && username !== existing.username) {
      const usernameExists = await db.user.findUnique({ where: { username } })
      if (usernameExists) {
        return NextResponse.json(
          { success: false, error: 'Username already in use' },
          { status: 409 }
        )
      }
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['admin', 'manager', 'accountant', 'auditor', 'viewer']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { success: false, error: 'Invalid role' },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (username !== undefined) updateData.username = username || null
    if (phone !== undefined) updateData.phone = phone || null
    if (role !== undefined) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    if (branchId !== undefined) updateData.branchId = branchId || null
    if (departmentId !== undefined) updateData.departmentId = departmentId || null
    if (employeeId !== undefined) updateData.employeeId = employeeId || null
    if (designation !== undefined) updateData.designation = designation || null
    if (forcePasswordChange !== undefined) updateData.forcePasswordChange = forcePasswordChange
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null
    if (updatedBy !== undefined) updateData.updatedBy = updatedBy

    // Handle activation/deactivation
    if (activate === true) {
      updateData.isActive = true
      updateData.isLocked = false
      updateData.lockedUntil = null
      updateData.failedLoginAttempts = 0
    }
    if (deactivate === true) {
      updateData.isActive = false
    }

    // Handle lock/unlock
    if (lock === true) {
      updateData.isLocked = true
    }
    if (unlock === true) {
      updateData.isLocked = false
      updateData.lockedUntil = null
      updateData.failedLoginAttempts = 0
    }

    // Handle password reset
    if (resetPassword && newPassword) {
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(newPassword, salt)
      updateData.passwordHash = hashedPassword
      updateData.passwordChangedAt = new Date()
      updateData.forcePasswordChange = true
      updateData.isLocked = false
      updateData.lockedUntil = null
      updateData.failedLoginAttempts = 0

      // Save to password history
      try {
        await db.passwordHistory.create({
          data: {
            userId: id,
            passwordHash: hashedPassword,
            changeType: 'admin_reset',
            changedBy: updatedBy || null,
          },
        })
      } catch {
        // Non-blocking
      }
    }

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
        username: true,
        phone: true,
        role: true,
        isActive: true,
        isLocked: true,
        forcePasswordChange: true,
        branchId: true,
        departmentId: true,
        employeeId: true,
        designation: true,
        avatarUrl: true,
        lastLoginAt: true,
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
          action: resetPassword ? 'PASSWORD_CHANGE' : 'UPDATE',
          entity: 'User',
          entityId: id,
          entityName: existing.name,
          details: JSON.stringify({ changes: auditChanges }),
          module: 'users',
          severity: resetPassword ? 'warning' : 'info',
        },
      })
    } catch {
      // Audit log failure shouldn't block user update
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] - Soft delete (set deletedAt)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.user.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting deletedAt
    const user = await db.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    })

    // Terminate all active sessions
    try {
      await db.userSession.updateMany({
        where: { userId: id, isActive: true },
        data: { isActive: false },
      })
    } catch {
      // Non-blocking
    }

    // Audit log
    try {
      const systemUserId = await getSystemUserId()
      await db.auditLog.create({
        data: {
          userId: systemUserId,
          action: 'DELETE',
          entity: 'User',
          entityId: id,
          entityName: existing.name,
          details: JSON.stringify({
            action: 'soft_delete',
            name: existing.name,
            email: existing.email,
          }),
          module: 'users',
          severity: 'warning',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      data: { id: user.id, deletedAt: user.deletedAt },
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
