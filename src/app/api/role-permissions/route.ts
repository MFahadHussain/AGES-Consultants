import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/role-permissions - Get all permissions for a role
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get('roleId')

    if (!roleId) {
      return NextResponse.json(
        { success: false, error: 'roleId query parameter is required' },
        { status: 400 }
      )
    }

    const role = await db.role.findUnique({ where: { id: roleId } })
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    const rolePermissions = await db.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: true,
      },
      orderBy: { permission: { module: 'asc' } },
    })

    const data = rolePermissions.map((rp) => ({
      id: rp.id,
      roleId: rp.roleId,
      permissionId: rp.permissionId,
      isGranted: rp.isGranted,
      conditions: rp.conditions,
      createdBy: rp.createdBy,
      createdAt: rp.createdAt,
      permission: rp.permission,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching role permissions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch role permissions' },
      { status: 500 }
    )
  }
}

// POST /api/role-permissions - Create/update role-permission mappings
// Supports three modes:
// 1. Replace all: { roleId, permissions: [{ permissionId, isGranted }] }
// 2. Single mapping: { roleId, permissionId, isGranted }
// 3. Batch grant: { roleId, permissionIds: string[] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roleId, permissions, permissionId, isGranted, permissionIds } = body

    if (!roleId) {
      return NextResponse.json(
        { success: false, error: 'roleId is required' },
        { status: 400 }
      )
    }

    const role = await db.role.findUnique({ where: { id: roleId } })
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    // Mode 2: Single mapping { roleId, permissionId, isGranted }
    if (permissionId && !permissions && !permissionIds) {
      const perm = await db.permission.findUnique({ where: { id: permissionId } })
      if (!perm) {
        return NextResponse.json(
          { success: false, error: 'Permission not found' },
          { status: 404 }
        )
      }

      const result = await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: { isGranted: isGranted ?? true },
        create: {
          roleId,
          permissionId,
          isGranted: isGranted ?? true,
        },
        include: { permission: true },
      })

      // Audit log
      try {
        await db.auditLog.create({
          data: {
            action: 'PERMISSION_CHANGE',
            entity: 'Role',
            entityId: roleId,
            entityName: role.name,
            details: JSON.stringify({
              action: 'set_permission',
              permissionCode: perm.code,
              isGranted: isGranted ?? true,
            }),
            module: 'rbac',
            severity: 'info',
          },
        })
      } catch {
        // Non-blocking
      }

      return NextResponse.json({ success: true, data: result }, { status: 201 })
    }

    // Mode 3: Batch grant { roleId, permissionIds: string[] }
    if (permissionIds && Array.isArray(permissionIds)) {
      // Validate all permission IDs exist
      const existingPerms = await db.permission.findMany({
        where: { id: { in: permissionIds } },
      })
      if (existingPerms.length !== permissionIds.length) {
        const foundIds = new Set(existingPerms.map((p) => p.id))
        const missing = permissionIds.filter((id: string) => !foundIds.has(id))
        return NextResponse.json(
          { success: false, error: `Permission IDs not found: ${missing.join(', ')}` },
          { status: 400 }
        )
      }

      // Create mappings in bulk (skip existing)
      let created = 0
      let skipped = 0
      for (const pid of permissionIds as string[]) {
        const existing = await db.rolePermission.findUnique({
          where: { roleId_permissionId: { roleId, permissionId: pid } },
        })
        if (existing) {
          skipped++
        } else {
          await db.rolePermission.create({
            data: { roleId, permissionId: pid, isGranted: true },
          })
          created++
        }
      }

      // Audit log
      try {
        await db.auditLog.create({
          data: {
            action: 'PERMISSION_CHANGE',
            entity: 'Role',
            entityId: roleId,
            entityName: role.name,
            details: JSON.stringify({
              action: 'batch_grant',
              permissionCount: permissionIds.length,
              created,
              skipped,
            }),
            module: 'rbac',
            severity: 'info',
          },
        })
      } catch {
        // Non-blocking
      }

      const updatedPermissions = await db.rolePermission.findMany({
        where: { roleId },
        include: { permission: true },
      })

      return NextResponse.json({
        success: true,
        data: updatedPermissions,
        message: `Granted ${created} permissions to role "${role.name}" (${skipped} already existed)`,
      })
    }

    // Mode 1: Replace all { roleId, permissions: [...] }
    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: 'permissions must be an array, or provide permissionId/isGranted, or permissionIds' },
        { status: 400 }
      )
    }

    // Validate all permission IDs exist
    if (permissions.length > 0) {
      const permIds = permissions.map((p: { permissionId: string }) => p.permissionId)
      const existingPermissions = await db.permission.findMany({
        where: { id: { in: permIds } },
      })
      if (existingPermissions.length !== permIds.length) {
        return NextResponse.json(
          { success: false, error: 'One or more permission IDs not found' },
          { status: 400 }
        )
      }
    }

    // Get current permissions for audit
    const currentPermissions = await db.rolePermission.findMany({
      where: { roleId },
      include: { permission: { select: { code: true } } },
    })

    // Delete existing and create new in a transaction
    await db.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } })

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p: { permissionId: string; isGranted?: boolean; conditions?: string; createdBy?: string }) => ({
            roleId,
            permissionId: p.permissionId,
            isGranted: p.isGranted ?? true,
            conditions: p.conditions || null,
            createdBy: p.createdBy || null,
          })),
        })
      }
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'PERMISSION_CHANGE',
          entity: 'Role',
          entityId: roleId,
          entityName: role.name,
          oldValues: JSON.stringify(
            currentPermissions.map((rp) => ({
              permissionCode: rp.permission.code,
              isGranted: rp.isGranted,
            }))
          ),
          newValues: JSON.stringify(permissions),
          module: 'rbac',
          severity: 'warning',
        },
      })
    } catch {
      // Non-blocking
    }

    // Fetch the updated role permissions
    const updatedPermissions = await db.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    })

    return NextResponse.json({
      success: true,
      data: updatedPermissions,
      message: `Updated ${permissions.length} permissions for role "${role.name}"`,
    })
  } catch (error) {
    console.error('Error setting role permissions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to set role permissions' },
      { status: 500 }
    )
  }
}

// DELETE /api/role-permissions - Remove a role-permission mapping
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get('roleId')
    const permissionId = searchParams.get('permissionId')

    if (!roleId || !permissionId) {
      return NextResponse.json(
        { success: false, error: 'roleId and permissionId query parameters are required' },
        { status: 400 }
      )
    }

    const rolePermission = await db.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
      include: {
        role: { select: { id: true, code: true, name: true } },
        permission: { select: { id: true, code: true, name: true } },
      },
    })

    if (!rolePermission) {
      return NextResponse.json(
        { success: false, error: 'Role-permission mapping not found' },
        { status: 404 }
      )
    }

    await db.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'PERMISSION_CHANGE',
          entity: 'Role',
          entityId: roleId,
          entityName: rolePermission.role.name,
          details: JSON.stringify({
            action: 'remove_permission',
            permissionCode: rolePermission.permission.code,
            permissionName: rolePermission.permission.name,
          }),
          module: 'rbac',
          severity: 'warning',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      message: `Removed permission "${rolePermission.permission.name}" from role "${rolePermission.role.name}"`,
    })
  } catch (error) {
    console.error('Error removing role permission:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove role permission' },
      { status: 500 }
    )
  }
}
