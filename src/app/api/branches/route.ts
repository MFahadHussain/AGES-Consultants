import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/branches - List all branches
export async function GET() {
  try {
    const branches = await db.branch.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { users: true, departments: true },
        },
      },
    })

    const data = branches.map((branch) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      address: branch.address,
      city: branch.city,
      province: branch.province,
      phone: branch.phone,
      email: branch.email,
      managerName: branch.managerName,
      isActive: branch.isActive,
      userCount: branch._count.users,
      departmentCount: branch._count.departments,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching branches:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch branches' },
      { status: 500 }
    )
  }
}

// POST /api/branches - Create branch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, address, city, province, phone, email, managerName, isActive } = body

    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: 'Branch code and name are required' },
        { status: 400 }
      )
    }

    // Check if code already exists
    const existing = await db.branch.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Branch code already exists' },
        { status: 409 }
      )
    }

    const branch = await db.branch.create({
      data: {
        code,
        name,
        address: address || null,
        city: city || null,
        province: province || null,
        phone: phone || null,
        email: email || null,
        managerName: managerName || null,
        isActive: isActive ?? true,
      },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'Branch',
          entityId: branch.id,
          entityName: branch.name,
          details: JSON.stringify({ code, name, city, province }),
          module: 'branches',
          severity: 'info',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, data: branch }, { status: 201 })
  } catch (error) {
    console.error('Error creating branch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create branch' },
      { status: 500 }
    )
  }
}
