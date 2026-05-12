import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/permissions - List all permissions, optionally filtered by module
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const moduleFilter = searchParams.get('module')
    const action = searchParams.get('action')
    const resource = searchParams.get('resource')
    const includeCounts = searchParams.get('includeCounts') === 'true'

    const where: Record<string, unknown> = {}
    if (moduleFilter) where.module = moduleFilter
    if (action) where.action = action
    if (resource) where.resource = resource

    const permissions = await db.permission.findMany({
      where,
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
      include: includeCounts
        ? {
            _count: {
              select: { rolePermissions: true, userPermissions: true },
            },
          }
        : undefined,
    })

    const data = includeCounts
      ? permissions.map((p) => ({
          ...p,
          roleCount: (p as typeof p & { _count: { rolePermissions: number; userPermissions: number } })._count.rolePermissions,
          userOverrideCount: (p as typeof p & { _count: { rolePermissions: number; userPermissions: number } })._count.userPermissions,
        }))
      : permissions

    // Group by module for convenience
    const modules = [...new Set(permissions.map((p) => p.module))].sort()

    return NextResponse.json({
      success: true,
      data,
      meta: { modules, total: permissions.length },
    })
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch permissions' },
      { status: 500 }
    )
  }
}

// POST /api/permissions - Create a permission or seed default permissions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action: postAction } = body

    // Seed action: create default permissions for all modules
    if (postAction === 'seed') {
      return await seedDefaultPermissions()
    }

    const { description, module: permModule, action: permAction, resource: permResource, isActive } = body
    let { code, name } = body

    if (!permModule || !permAction || !permResource) {
      return NextResponse.json(
        {
          success: false,
          error: 'module, action, and resource are required',
        },
        { status: 400 }
      )
    }

    // Auto-generate code and name if not provided
    if (!code) {
      code = `${permModule.toUpperCase().replace(/-/g, '_')}_${permAction.toUpperCase().replace(/-/g, '_')}`
    }
    if (!name) {
      const actionLabel = permAction.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const resourceLabel = permResource.replace(/-/g, ' ')
      name = `${actionLabel} ${resourceLabel}`
    }

    // Check if code already exists
    const existingByCode = await db.permission.findUnique({ where: { code } })
    if (existingByCode) {
      return NextResponse.json(
        { success: false, error: 'Permission code already exists' },
        { status: 409 }
      )
    }

    // Check unique constraint on module+action+resource
    const existingCombo = await db.permission.findFirst({
      where: { module: permModule, action: permAction, resource: permResource },
    })
    if (existingCombo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission with this module/action/resource combination already exists',
        },
        { status: 409 }
      )
    }

    const permission = await db.permission.create({
      data: {
        code,
        name,
        description: description || null,
        module: permModule,
        action: permAction,
        resource: permResource,
        isActive: isActive ?? true,
      },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'Permission',
          entityId: permission.id,
          entityName: permission.name,
          details: JSON.stringify({ code, name, module: permModule, action: permAction, resource: permResource }),
          module: 'rbac',
          severity: 'info',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, data: permission }, { status: 201 })
  } catch (error) {
    console.error('Error creating permission:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create permission' },
      { status: 500 }
    )
  }
}

async function seedDefaultPermissions() {
  const modules = [
    { module: 'dashboard', resource: 'dashboard', actions: ['view'] },
    { module: 'users', resource: 'user', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    { module: 'roles', resource: 'role', actions: ['view', 'create', 'edit', 'delete'] },
    { module: 'permissions', resource: 'permission', actions: ['view', 'create', 'edit', 'delete'] },
    { module: 'accounts', resource: 'account', actions: ['view', 'create', 'edit', 'delete', 'export', 'print'] },
    { module: 'vouchers', resource: 'voucher', actions: ['view', 'create', 'edit', 'delete', 'approve', 'reject', 'export', 'print', 'reverse', 'post', 'unpost'] },
    { module: 'ledgers', resource: 'ledger', actions: ['view', 'export', 'print'] },
    { module: 'reports', resource: 'report', actions: ['view', 'export', 'print'] },
    { module: 'budgets', resource: 'budget', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
    { module: 'payroll', resource: 'payroll', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'post'] },
    { module: 'employees', resource: 'employee', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    { module: 'attendance', resource: 'attendance', actions: ['view', 'create', 'edit', 'export'] },
    { module: 'fixed-assets', resource: 'fixed-asset', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'post'] },
    { module: 'bank-reconciliation', resource: 'bank-reconciliation', actions: ['view', 'create', 'edit', 'approve', 'export'] },
    { module: 'taxation', resource: 'tax', actions: ['view', 'create', 'edit', 'export', 'post'] },
    { module: 'customers', resource: 'customer', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    { module: 'suppliers', resource: 'supplier', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    { module: 'projects', resource: 'project', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    { module: 'departments', resource: 'department', actions: ['view', 'create', 'edit', 'delete'] },
    { module: 'branches', resource: 'branch', actions: ['view', 'create', 'edit', 'delete'] },
    { module: 'audit', resource: 'audit-log', actions: ['view', 'export'] },
    { module: 'settings', resource: 'setting', actions: ['view', 'edit'] },
    { module: 'approval-workflows', resource: 'approval-workflow', actions: ['view', 'create', 'edit', 'delete', 'approve', 'reject'] },
    { module: 'documents', resource: 'document', actions: ['view', 'upload', 'delete'] },
    { module: 'sessions', resource: 'session', actions: ['view', 'terminate'] },
  ]

  let created = 0
  let skipped = 0

  for (const m of modules) {
    for (const act of m.actions) {
      const code = `${m.module.toUpperCase().replace(/-/g, '_')}_${act.toUpperCase()}`
      const name = `${act.charAt(0).toUpperCase() + act.slice(1)} ${m.resource.replace(/-/g, ' ')}`
      const moduleKey = m.module

      try {
        const existing = await db.permission.findFirst({
          where: { module: moduleKey, action: act, resource: m.resource },
        })
        if (existing) {
          skipped++
          continue
        }

        await db.permission.create({
          data: {
            code,
            name,
            module: moduleKey,
            action: act,
            resource: m.resource,
            isActive: true,
          },
        })
        created++
      } catch {
        skipped++
      }
    }
  }

  // Audit log
  try {
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Permission',
        entityName: 'Seed Default Permissions',
        details: JSON.stringify({ created, skipped }),
        module: 'rbac',
        severity: 'info',
      },
    })
  } catch {
    // Non-blocking
  }

  return NextResponse.json({
    success: true,
    data: { created, skipped },
    message: `Seeded ${created} permissions, ${skipped} already existed`,
  })
}
