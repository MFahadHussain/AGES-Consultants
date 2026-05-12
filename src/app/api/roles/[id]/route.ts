import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/roles/[id] - Get role with permissions and user count
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const role = await db.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        userRoles: {
          include: {
            user: {
              select: { id: true, name: true, email: true, isActive: true },
            },
          },
        },
        parentRole: {
          select: { id: true, name: true, code: true },
        },
        childRoles: {
          select: { id: true, name: true, code: true, level: true },
        },
        _count: {
          select: { rolePermissions: true, userRoles: true },
        },
      },
    })

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        level: role.level,
        parentRoleId: role.parentRoleId,
        parentRole: role.parentRole,
        childRoles: role.childRoles,
        isSystem: role.isSystem,
        isActive: role.isActive,
        permissions: role.rolePermissions.map((rp) => ({
          id: rp.id,
          permissionId: rp.permissionId,
          isGranted: rp.isGranted,
          conditions: rp.conditions,
          permission: rp.permission,
        })),
        users: role.userRoles.map((ur) => ({
          id: ur.id,
          isPrimary: ur.isPrimary,
          grantedAt: ur.grantedAt,
          expiresAt: ur.expiresAt,
          user: ur.user,
        })),
        permissionCount: role._count.rolePermissions,
        userCount: role._count.userRoles,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error fetching role:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch role' },
      { status: 500 }
    )
  }
}

// PUT /api/roles/[id] - Update role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { code, name, description, level, parentRoleId, isActive } = body

    const existing = await db.role.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    // Check code uniqueness if changing
    if (code && code !== existing.code) {
      const codeExists = await db.role.findUnique({ where: { code } })
      if (codeExists) {
        return NextResponse.json(
          { success: false, error: 'Role code already exists' },
          { status: 409 }
        )
      }
    }

    // Validate parent role if changing
    if (parentRoleId !== undefined && parentRoleId !== null) {
      if (parentRoleId === id) {
        return NextResponse.json(
          { success: false, error: 'Role cannot be its own parent' },
          { status: 400 }
        )
      }
      const parentRole = await db.role.findUnique({ where: { id: parentRoleId } })
      if (!parentRole) {
        return NextResponse.json(
          { success: false, error: 'Parent role not found' },
          { status: 404 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (code !== undefined) updateData.code = code
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (level !== undefined) updateData.level = level
    if (parentRoleId !== undefined) updateData.parentRoleId = parentRoleId || null
    if (isActive !== undefined) updateData.isActive = isActive

    const oldValues = {
      code: existing.code,
      name: existing.name,
      description: existing.description,
      level: existing.level,
      parentRoleId: existing.parentRoleId,
      isActive: existing.isActive,
    }

    const role = await db.role.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { rolePermissions: true, userRoles: true } },
        parentRole: { select: { id: true, name: true, code: true } },
      },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'Role',
          entityId: id,
          entityName: existing.name,
          oldValues: JSON.stringify(oldValues),
          newValues: JSON.stringify(updateData),
          module: 'rbac',
          severity: 'info',
        },
      })
    } catch {
      // Audit log failure shouldn't block update
    }

    return NextResponse.json({
      success: true,
      data: {
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        level: role.level,
        parentRoleId: role.parentRoleId,
        parentRole: role.parentRole,
        isSystem: role.isSystem,
        isActive: role.isActive,
        permissionCount: role._count.rolePermissions,
        userCount: role._count.userRoles,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update role' },
      { status: 500 }
    )
  }
}

// DELETE /api/roles/[id] - Delete role (only if not system role)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.role.findUnique({
      where: { id },
      include: {
        _count: { select: { userRoles: true, rolePermissions: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete system role' },
        { status: 400 }
      )
    }

    if (existing._count.userRoles > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete role: ${existing._count.userRoles} user(s) are assigned to this role. Remove role assignments first.`,
        },
        { status: 400 }
      )
    }

    await db.role.delete({ where: { id } })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'DELETE',
          entity: 'Role',
          entityId: id,
          entityName: existing.name,
          oldValues: JSON.stringify({
            code: existing.code,
            name: existing.name,
            description: existing.description,
          }),
          module: 'rbac',
          severity: 'warning',
        },
      })
    } catch {
      // Audit log failure shouldn't block deletion
    }

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete role' },
      { status: 500 }
    )
  }
}
