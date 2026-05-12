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

// POST /api/role-permissions - Set permissions for a role (replace all)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roleId, permissions } = body

    if (!roleId) {
      return NextResponse.json(
        { success: false, error: 'roleId is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: 'permissions must be an array' },
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

    // Validate all permission IDs exist
    if (permissions.length > 0) {
      const permissionIds = permissions.map((p: { permissionId: string }) => p.permissionId)
      const existingPermissions = await db.permission.findMany({
        where: { id: { in: permissionIds } },
      })
      if (existingPermissions.length !== permissionIds.length) {
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
