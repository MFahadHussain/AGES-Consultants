import { withAudit } from '@/lib/audit-wrapper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/branches/[id] - Update branch
async function PUT_HANDLER(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { code, name, address, city, province, phone, email, managerName, isActive } = body

    const existing = await db.branch.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }

    // Check code uniqueness if changing
    if (code && code !== existing.code) {
      const codeExists = await db.branch.findUnique({ where: { code } })
      if (codeExists) {
        return NextResponse.json(
          { success: false, error: 'Branch code already exists' },
          { status: 409 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (code !== undefined) updateData.code = code
    if (name !== undefined) updateData.name = name
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (province !== undefined) updateData.province = province
    if (phone !== undefined) updateData.phone = phone
    if (email !== undefined) updateData.email = email
    if (managerName !== undefined) updateData.managerName = managerName
    if (isActive !== undefined) updateData.isActive = isActive

    const oldValues = {
      code: existing.code,
      name: existing.name,
      address: existing.address,
      city: existing.city,
      province: existing.province,
      phone: existing.phone,
      email: existing.email,
      managerName: existing.managerName,
      isActive: existing.isActive,
    }

    const branch = await db.branch.update({
      where: { id },
      data: updateData,
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'Branch',
          entityId: id,
          entityName: existing.name,
          oldValues: JSON.stringify(oldValues),
          newValues: JSON.stringify(updateData),
          module: 'branches',
          severity: 'info',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, data: branch })
  } catch (error) {
    console.error('Error updating branch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update branch' },
      { status: 500 }
    )
  }
}

// DELETE /api/branches/[id] - Soft delete branch (set isActive=false)
async function DELETE_HANDLER(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.branch.findUnique({
      where: { id },
      include: { _count: { select: { users: true, departments: true } } },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { success: false, error: 'Branch is already deactivated' },
        { status: 400 }
      )
    }

    // Soft delete by setting isActive=false
    const branch = await db.branch.update({
      where: { id },
      data: { isActive: false },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'DELETE',
          entity: 'Branch',
          entityId: id,
          entityName: existing.name,
          details: JSON.stringify({
            action: 'soft_delete',
            affectedUsers: existing._count.users,
            affectedDepartments: existing._count.departments,
          }),
          module: 'branches',
          severity: 'warning',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      data: branch,
      message: `Branch "${existing.name}" deactivated successfully`,
    })
  } catch (error) {
    console.error('Error deleting branch:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete branch' },
      { status: 500 }
    )
  }
}

export const PUT = withAudit('branches', PUT_HANDLER);

export const DELETE = withAudit('branches', DELETE_HANDLER);
