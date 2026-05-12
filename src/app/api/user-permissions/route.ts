import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/user-permissions - Get permission overrides for a user
export async function GET(request: NextRequest) {
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

    const userPermissions = await db.userPermission.findMany({
      where: { userId },
      include: {
        permission: true,
      },
      orderBy: { permission: { module: 'asc' } },
    })

    const data = userPermissions.map((up) => ({
      id: up.id,
      userId: up.userId,
      permissionId: up.permissionId,
      isGranted: up.isGranted,
      conditions: up.conditions,
      grantedBy: up.grantedBy,
      createdAt: up.createdAt,
      expiresAt: up.expiresAt,
      permission: up.permission,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching user permissions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user permissions' },
      { status: 500 }
    )
  }
}

// POST /api/user-permissions - Set permission override for user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, permissionId, isGranted, conditions, grantedBy, expiresAt } = body

    if (!userId || !permissionId || isGranted === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId, permissionId, and isGranted are required',
        },
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

    const permission = await db.permission.findUnique({
      where: { id: permissionId },
    })
    if (!permission) {
      return NextResponse.json(
        { success: false, error: 'Permission not found' },
        { status: 404 }
      )
    }

    // Upsert: if override already exists, update it; otherwise create
    const userPermission = await db.userPermission.upsert({
      where: { userId_permissionId: { userId, permissionId } },
      update: {
        isGranted,
        conditions: conditions || null,
        grantedBy: grantedBy || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      create: {
        userId,
        permissionId,
        isGranted,
        conditions: conditions || null,
        grantedBy: grantedBy || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        permission: true,
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
            action: 'override_permission',
            permissionCode: permission.code,
            permissionName: permission.name,
            isGranted,
          }),
          module: 'rbac',
          severity: isGranted ? 'info' : 'warning',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, data: userPermission }, { status: 201 })
  } catch (error) {
    console.error('Error setting user permission override:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to set user permission override' },
      { status: 500 }
    )
  }
}

// DELETE /api/user-permissions - Remove permission override
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const permissionId = searchParams.get('permissionId')

    if (!userId || !permissionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId and permissionId query parameters are required',
        },
        { status: 400 }
      )
    }

    const userPermission = await db.userPermission.findUnique({
      where: { userId_permissionId: { userId, permissionId } },
      include: {
        user: { select: { id: true, name: true } },
        permission: { select: { id: true, code: true, name: true } },
      },
    })

    if (!userPermission) {
      return NextResponse.json(
        { success: false, error: 'User permission override not found' },
        { status: 404 }
      )
    }

    await db.userPermission.delete({
      where: { userId_permissionId: { userId, permissionId } },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'PERMISSION_CHANGE',
          entity: 'User',
          entityId: userId,
          entityName: userPermission.user.name,
          details: JSON.stringify({
            action: 'remove_permission_override',
            permissionCode: userPermission.permission.code,
            permissionName: userPermission.permission.name,
          }),
          module: 'rbac',
          severity: 'info',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      message: `Removed permission override "${userPermission.permission.name}" for user "${userPermission.user.name}"`,
    })
  } catch (error) {
    console.error('Error removing user permission override:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove user permission override' },
      { status: 500 }
    )
  }
}
