import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/roles - List all roles with their permission counts
export async function GET() {
  try {
    const roles = await db.role.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            rolePermissions: true,
            userRoles: true,
          },
        },
        parentRole: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    const data = roles.map((role) => ({
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
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

// POST /api/roles - Create a new role
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, description, level, parentRoleId, isSystem, isActive } = body

    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: 'Role code and name are required' },
        { status: 400 }
      )
    }

    // Check if code already exists
    const existing = await db.role.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Role code already exists' },
        { status: 409 }
      )
    }

    // Validate parent role if provided
    if (parentRoleId) {
      const parentRole = await db.role.findUnique({ where: { id: parentRoleId } })
      if (!parentRole) {
        return NextResponse.json(
          { success: false, error: 'Parent role not found' },
          { status: 404 }
        )
      }
    }

    const role = await db.role.create({
      data: {
        code,
        name,
        description: description || null,
        level: level ?? 0,
        parentRoleId: parentRoleId || null,
        isSystem: isSystem ?? false,
        isActive: isActive ?? true,
      },
      include: {
        _count: { select: { rolePermissions: true, userRoles: true } },
        parentRole: { select: { id: true, name: true, code: true } },
      },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'Role',
          entityId: role.id,
          entityName: role.name,
          details: JSON.stringify({ code, name, description, level, parentRoleId }),
          module: 'rbac',
          severity: 'info',
        },
      })
    } catch {
      // Audit log failure shouldn't block role creation
    }

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating role:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create role' },
      { status: 500 }
    )
  }
}
