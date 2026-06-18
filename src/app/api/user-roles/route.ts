import { withAudit } from '@/lib/audit-wrapper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { revalidatePermissionsCache } from '@/lib/permissions'

// GET /api/user-roles - Get roles for a user
async function GET_HANDLER(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId query parameter is required' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const userRoles = await db.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            _count: { select: { rolePermissions: true } },
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { grantedAt: 'desc' }],
    })

    const data = userRoles.map((ur) => ({
      id: ur.id,
      userId: ur.userId,
      roleId: ur.roleId,
      isPrimary: ur.isPrimary,
      grantedBy: ur.grantedBy,
      grantedAt: ur.grantedAt,
      expiresAt: ur.expiresAt,
      role: {
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
        description: ur.role.description,
        level: ur.role.level,
        isSystem: ur.role.isSystem,
        isActive: ur.role.isActive,
        permissionCount: ur.role._count.rolePermissions,
      },
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching user roles:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user roles' },
      { status: 500 }
    )
  }
}

// POST /api/user-roles - Assign role to user
async function POST_HANDLER(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, roleId, isPrimary, grantedBy, expiresAt } = body

    if (!userId || !roleId) {
      return NextResponse.json(
        { success: false, error: 'userId and roleId are required' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const role = await db.role.findUnique({ where: { id: roleId } })
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    if (!role.isActive) {
      return NextResponse.json(
        { success: false, error: 'Cannot assign inactive role' },
        { status: 400 }
      )
    }

    // Check if already assigned
    const existing = await db.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Role already assigned to this user' },
        { status: 409 }
      )
    }

    // If setting as primary, unset any existing primary
    if (isPrimary) {
      await db.userRole.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const userRole = await db.userRole.create({
      data: {
        userId,
        roleId,
        isPrimary: isPrimary ?? false,
        grantedBy: grantedBy || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        role: { select: { id: true, code: true, name: true, level: true } },
      },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'PERMISSION_CHANGE',
          entity: 'User',
          entityId: userId,
          entityName: user.name,
          details: JSON.stringify({
            action: 'assign_role',
            roleCode: role.code,
            roleName: role.name,
            isPrimary: isPrimary ?? false,
          }),
          module: 'rbac',
          severity: 'info',
        },
      })
    } catch {
      // Non-blocking
    }
    await revalidatePermissionsCache()
    return NextResponse.json({ success: true, data: userRole }, { status: 201 })
  } catch (error) {
    console.error('Error assigning user role:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to assign user role' },
      { status: 500 }
    )
  }
}

// DELETE /api/user-roles - Remove role from user
async function DELETE_HANDLER(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const roleId = searchParams.get('roleId')

    if (!userId || !roleId) {
      return NextResponse.json(
        { success: false, error: 'userId and roleId query parameters are required' },
        { status: 400 }
      )
    }

    const userRole = await db.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      include: {
        user: { select: { id: true, name: true } },
        role: { select: { id: true, code: true, name: true } },
      },
    })

    if (!userRole) {
      return NextResponse.json(
        { success: false, error: 'User-role assignment not found' },
        { status: 404 }
      )
    }

    await db.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'PERMISSION_CHANGE',
          entity: 'User',
          entityId: userId,
          entityName: userRole.user.name,
          details: JSON.stringify({
            action: 'remove_role',
            roleCode: userRole.role.code,
            roleName: userRole.role.name,
          }),
          module: 'rbac',
          severity: 'warning',
        },
      })
    } catch {
      // Non-blocking
    }
    await revalidatePermissionsCache()
    return NextResponse.json({
      success: true,
      message: `Removed role "${userRole.role.name}" from user "${userRole.user.name}"`,
    })
  } catch (error) {
    console.error('Error removing user role:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove user role' },
      { status: 500 }
    )
  }
}

export const POST = withAudit('user-roles', POST_HANDLER);

export const DELETE = withAudit('user-roles', DELETE_HANDLER);

export const GET = withAudit('user-roles', GET_HANDLER);
