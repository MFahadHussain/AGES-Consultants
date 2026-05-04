import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// GET /api/employee-allowances — List employee allowances
//   ?employeeId=xxx  — filter by employee
//   ?allowanceId=xxx — filter by allowance
//   ?projectId=xxx   — filter by project
//   ?isActive=true|false
//   Includes: employee, allowance relations
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const allowanceId = searchParams.get('allowanceId')
    const projectId = searchParams.get('projectId')
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId
    if (allowanceId) where.allowanceId = allowanceId
    if (projectId) where.projectId = projectId
    if (isActive !== null) where.isActive = isActive === 'true'

    const employeeAllowances = await db.employeeAllowance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            designation: true,
            department: true,
            status: true,
          },
        },
        allowance: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(employeeAllowances)
  } catch (error) {
    console.error('[EMPLOYEE_ALLOWANCES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee allowances' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/employee-allowances — Create an employee allowance
//   Validates: employeeId exists, allowanceId exists
// ============================================================
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { employeeId, allowanceId, customValue, projectId, isActive, effectiveDate } = body

    // --- Required fields ---
    if (!employeeId) {
      return NextResponse.json(
        { error: 'employeeId is required' },
        { status: 400 }
      )
    }
    if (!allowanceId) {
      return NextResponse.json(
        { error: 'allowanceId is required' },
        { status: 400 }
      )
    }

    // --- Validate employee exists ---
    const employee = await db.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return NextResponse.json(
        { error: `Employee with id "${employeeId}" not found` },
        { status: 404 }
      )
    }

    // --- Validate allowance exists ---
    const allowance = await db.allowance.findUnique({ where: { id: allowanceId } })
    if (!allowance) {
      return NextResponse.json(
        { error: `Allowance with id "${allowanceId}" not found` },
        { status: 404 }
      )
    }

    // --- If allowance is not project-specific but projectId is given, warn ---
    if (projectId && !allowance.isProjectSpecific) {
      return NextResponse.json(
        { error: `Allowance "${allowance.code}" is not project-specific. Remove projectId or update the allowance first.` },
        { status: 400 }
      )
    }

    // --- Validate projectId if provided ---
    if (projectId) {
      const project = await db.project.findUnique({ where: { id: projectId } })
      if (!project) {
        return NextResponse.json(
          { error: `Project with id "${projectId}" not found` },
          { status: 404 }
        )
      }
    }

    // --- Validate customValue if provided ---
    if (customValue !== undefined && customValue !== null) {
      const numValue = Number(customValue)
      if (isNaN(numValue) || numValue < 0) {
        return NextResponse.json(
          { error: 'customValue must be a non-negative number' },
          { status: 400 }
        )
      }
    }

    // --- Check for duplicate: same employee + allowance + project combo ---
    const duplicateCheck: Record<string, unknown> = {
      employeeId,
      allowanceId,
      projectId: projectId || null,
      isActive: true,
    }
    const duplicate = await db.employeeAllowance.findFirst({
      where: duplicateCheck,
    })
    if (duplicate) {
      return NextResponse.json(
        { error: 'This employee already has an active record for this allowance' + (projectId ? ' and project' : '') },
        { status: 409 }
      )
    }

    const employeeAllowance = await db.employeeAllowance.create({
      data: {
        employeeId,
        allowanceId,
        customValue: customValue !== undefined ? Number(customValue) : null,
        projectId: projectId || null,
        isActive: Boolean(isActive ?? true),
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            designation: true,
            department: true,
          },
        },
        allowance: true,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: 'system',
        action: 'CREATE',
        entity: 'EmployeeAllowance',
        entityId: employeeAllowance.id,
        details: JSON.stringify({
          employeeId,
          employeeName: employee.name,
          allowanceId,
          allowanceCode: allowance.code,
          customValue: employeeAllowance.customValue,
          projectId: projectId || null,
        }),
      },
    })

    return NextResponse.json(employeeAllowance, { status: 201 })
  } catch (error) {
    console.error('[EMPLOYEE_ALLOWANCES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create employee allowance' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/employee-allowances?id=xxx — Update an employee allowance
// ============================================================
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Employee allowance ID is required as query parameter' },
        { status: 400 }
      )
    }

    const existing = await db.employeeAllowance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Employee allowance not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { customValue, projectId, isActive, effectiveDate, allowanceId } = body

    // --- If switching to a different allowance, validate it ---
    if (allowanceId && allowanceId !== existing.allowanceId) {
      const allowance = await db.allowance.findUnique({ where: { id: allowanceId } })
      if (!allowance) {
        return NextResponse.json(
          { error: `Allowance with id "${allowanceId}" not found` },
          { status: 404 }
        )
      }

      // If the new allowance is not project-specific but projectId is set
      if ((projectId || existing.projectId) && !allowance.isProjectSpecific) {
        return NextResponse.json(
          { error: `Allowance "${allowance.code}" is not project-specific. Remove projectId or update the allowance first.` },
          { status: 400 }
        )
      }
    }

    // --- Validate projectId if being changed ---
    const effectiveProjectId = projectId !== undefined ? projectId : existing.projectId
    if (effectiveProjectId) {
      const project = await db.project.findUnique({ where: { id: effectiveProjectId } })
      if (!project) {
        return NextResponse.json(
          { error: `Project with id "${effectiveProjectId}" not found` },
          { status: 404 }
        )
      }
    }

    // --- Validate customValue if provided ---
    if (customValue !== undefined && customValue !== null) {
      const numValue = Number(customValue)
      if (isNaN(numValue) || numValue < 0) {
        return NextResponse.json(
          { error: 'customValue must be a non-negative number' },
          { status: 400 }
        )
      }
    }

    // --- Build update data ---
    const updateData: Record<string, unknown> = {}
    if (customValue !== undefined) updateData.customValue = customValue === null ? null : Number(customValue)
    if (projectId !== undefined) updateData.projectId = projectId || null
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)
    if (effectiveDate !== undefined) updateData.effectiveDate = new Date(effectiveDate)
    if (allowanceId !== undefined) updateData.allowanceId = allowanceId

    const updated = await db.employeeAllowance.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            designation: true,
            department: true,
          },
        },
        allowance: true,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: 'system',
        action: 'UPDATE',
        entity: 'EmployeeAllowance',
        entityId: id,
        details: JSON.stringify(updateData),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[EMPLOYEE_ALLOWANCES_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update employee allowance' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/employee-allowances?id=xxx — Delete an employee allowance
// ============================================================
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Employee allowance ID is required as query parameter' },
        { status: 400 }
      )
    }

    const existing = await db.employeeAllowance.findUnique({
      where: { id },
      include: {
        employee: { select: { name: true, employeeCode: true } },
        allowance: { select: { code: true, name: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Employee allowance not found' },
        { status: 404 }
      )
    }

    await db.employeeAllowance.delete({ where: { id } })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: 'system',
        action: 'DELETE',
        entity: 'EmployeeAllowance',
        entityId: id,
        details: `Deleted allowance "${existing.allowance.code}" (${existing.allowance.name}) for employee "${existing.employee.name}" (${existing.employee.employeeCode})`,
      },
    })

    return NextResponse.json({
      message: 'Employee allowance deleted successfully',
    })
  } catch (error) {
    console.error('[EMPLOYEE_ALLOWANCES_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete employee allowance' },
      { status: 500 }
    )
  }
}
