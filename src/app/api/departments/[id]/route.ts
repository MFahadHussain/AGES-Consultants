import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/departments/[id] - Update department
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { code, name, branchId, headName, isActive } = body

    const existing = await db.department.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      )
    }

    // Check code uniqueness if changing
    if (code && code !== existing.code) {
      const codeExists = await db.department.findUnique({ where: { code } })
      if (codeExists) {
        return NextResponse.json(
          { success: false, error: 'Department code already exists' },
          { status: 409 }
        )
      }
    }

    // Validate branch if changing
    if (branchId !== undefined && branchId !== null) {
      const branch = await db.branch.findUnique({ where: { id: branchId } })
      if (!branch) {
        return NextResponse.json(
          { success: false, error: 'Branch not found' },
          { status: 404 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (code !== undefined) updateData.code = code
    if (name !== undefined) updateData.name = name
    if (branchId !== undefined) updateData.branchId = branchId || null
    if (headName !== undefined) updateData.headName = headName
    if (isActive !== undefined) updateData.isActive = isActive

    const oldValues = {
      code: existing.code,
      name: existing.name,
      branchId: existing.branchId,
      headName: existing.headName,
      isActive: existing.isActive,
    }

    const department = await db.department.update({
      where: { id },
      data: updateData,
      include: {
        branch: { select: { id: true, code: true, name: true } },
      },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'Department',
          entityId: id,
          entityName: existing.name,
          oldValues: JSON.stringify(oldValues),
          newValues: JSON.stringify(updateData),
          module: 'departments',
          severity: 'info',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ success: true, data: department })
  } catch (error) {
    console.error('Error updating department:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update department' },
      { status: 500 }
    )
  }
}

// DELETE /api/departments/[id] - Soft delete department
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      )
    }

    if (!existing.isActive) {
      return NextResponse.json(
        { success: false, error: 'Department is already deactivated' },
        { status: 400 }
      )
    }

    // Soft delete
    const department = await db.department.update({
      where: { id },
      data: { isActive: false },
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'DELETE',
          entity: 'Department',
          entityId: id,
          entityName: existing.name,
          details: JSON.stringify({
            action: 'soft_delete',
            affectedUsers: existing._count.users,
          }),
          module: 'departments',
          severity: 'warning',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      data: department,
      message: `Department "${existing.name}" deactivated successfully`,
    })
  } catch (error) {
    console.error('Error deleting department:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete department' },
      { status: 500 }
    )
  }
}
