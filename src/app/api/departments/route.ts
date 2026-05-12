import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/departments - List all departments with branch info
export async function GET() {
  try {
    const departments = await db.department.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        branch: {
          select: { id: true, code: true, name: true, city: true },
        },
        _count: {
          select: { users: true },
        },
      },
    })

    const data = departments.map((dept) => ({
      id: dept.id,
      code: dept.code,
      name: dept.name,
      branchId: dept.branchId,
      branch: dept.branch,
      headName: dept.headName,
      isActive: dept.isActive,
      userCount: dept._count.users,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch departments' },
      { status: 500 }
    )
  }
}

// POST /api/departments - Create department
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, branchId, headName, isActive } = body

    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: 'Department code and name are required' },
        { status: 400 }
      )
    }

    // Check if code already exists
    const existing = await db.department.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Department code already exists' },
        { status: 409 }
      )
    }

    // Validate branch if provided
    if (branchId) {
      const branch = await db.branch.findUnique({ where: { id: branchId } })
      if (!branch) {
        return NextResponse.json(
          { success: false, error: 'Branch not found' },
          { status: 404 }
        )
      }
    }

    const department = await db.department.create({
      data: {
        code,
        name,
        branchId: branchId || null,
        headName: headName || null,
        isActive: isActive ?? true,
      },
      include: {
        branch: { select: { id: true, code: true, name: true } },
      },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'Department',
          entityId: department.id,
          entityName: department.name,
          details: JSON.stringify({ code, name, branchId }),
          module: 'departments',
          severity: 'info',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, data: department }, { status: 201 })
  } catch (error) {
    console.error('Error creating department:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create department' },
      { status: 500 }
    )
  }
}
