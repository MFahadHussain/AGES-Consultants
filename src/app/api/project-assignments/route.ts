import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// GET /api/project-assignments
// List assignments with filters and include employee/project relations
// ============================================================
async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const employeeId = searchParams.get('employeeId')
    const projectId = searchParams.get('projectId')
    const isActive = searchParams.get('isActive')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const currentActive = searchParams.get('currentActive') // e.g. "true" to get only currently active assignments for an employee

    // Build where clause
    const where: any = {}

    if (employeeId) where.employeeId = employeeId
    if (projectId) where.projectId = projectId
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    // Date range filter: assignments that overlap with the given range
    if (startDate || endDate) {
      const dateFilter: any = {}
      if (startDate) {
        // Assignment ends after the filter start date
        dateFilter.OR = [
          { endDate: null }, // Ongoing assignments
          { endDate: { gte: new Date(startDate) } },
        ]
      }
      if (endDate) {
        // Assignment starts before the filter end date
        if (dateFilter.OR) {
          // Both start and end date filters: assignments that overlap the range
          where.AND = [
            {
              OR: [
                { endDate: null },
                { endDate: { gte: new Date(startDate!) } },
              ],
            },
            { startDate: { lte: new Date(endDate) } },
          ]
          delete dateFilter.OR
        } else {
          where.startDate = { lte: new Date(endDate) }
        }
      }
      if (dateFilter.OR && !where.AND) {
        where.OR = dateFilter.OR
      }
    }

    // Special filter: get current active assignments for an employee
    // (assignments that are active AND whose date range includes today)
    if (currentActive === 'true') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      where.isActive = true
      where.startDate = { lte: today }
      where.OR = [
        { endDate: null },
        { endDate: { gte: today } },
      ]
    }

    const assignments = await db.employeeProjectAssignment.findMany({
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
            baseSalary: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            projectType: true,
            status: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    })

    return NextResponse.json(assignments)
  } catch (error) {
    console.error('Error fetching project assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project assignments' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/project-assignments
// Create a new assignment with validation
// ============================================================
async function POST_HANDLER(request: Request) {
  try {
    const data = await request.json()

    // --- Required field validation ---
    if (!data.employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      )
    }
    if (!data.projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }
    if (!data.startDate) {
      return NextResponse.json(
        { error: 'Start date is required' },
        { status: 400 }
      )
    }

    // --- Validate employee exists ---
    const employee = await db.employee.findUnique({
      where: { id: data.employeeId },
    })
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // --- Validate project exists ---
    const project = await db.project.findUnique({
      where: { id: data.projectId },
    })
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // --- Validate allocationType ---
    const validAllocationTypes = ['fixed', 'percentage', 'attendance_based']
    const allocationType = data.allocationType || 'fixed'
    if (!validAllocationTypes.includes(allocationType)) {
      return NextResponse.json(
        {
          error: `Invalid allocation type. Must be one of: ${validAllocationTypes.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // --- Validate allocationValue for percentage type ---
    const allocationValue = data.allocationValue ?? 100
    if (allocationType === 'percentage') {
      if (allocationValue < 1 || allocationValue > 100) {
        return NextResponse.json(
          { error: 'Allocation value for percentage type must be between 1 and 100' },
          { status: 400 }
        )
      }
    }
    if (allocationType === 'fixed' && allocationValue < 0) {
      return NextResponse.json(
        { error: 'Allocation value cannot be negative' },
        { status: 400 }
      )
    }
    if (allocationType === 'attendance_based' && allocationValue < 0) {
      return NextResponse.json(
        { error: 'Allocation value cannot be negative' },
        { status: 400 }
      )
    }

    // --- Validate date range ---
    const startDate = new Date(data.startDate)
    const endDate = data.endDate ? new Date(data.endDate) : null

    if (endDate && startDate >= endDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // --- Validate salaryAmount ---
    const salaryAmount = data.salaryAmount ?? 0
    if (salaryAmount < 0) {
      return NextResponse.json(
        { error: 'Salary amount cannot be negative' },
        { status: 400 }
      )
    }

    // --- Check for overlapping assignments ---
    // Same employee + project with overlapping date ranges
    const overlappingWhere: any = {
      employeeId: data.employeeId,
      projectId: data.projectId,
      isActive: true,
    }

    // Build overlap condition: two ranges overlap if A.start <= B.end AND B.start <= A.end
    if (endDate) {
      overlappingWhere.OR = [
        { endDate: null }, // Ongoing assignment
        { endDate: { gte: startDate } },
      ]
      // Also need to ensure the existing assignment starts before the new one ends
      overlappingWhere.startDate = { lte: endDate }
    } else {
      // New assignment is ongoing (no end date), so it overlaps any active assignment
      // that starts before now (which all active ones do)
      overlappingWhere.OR = [
        { endDate: null },
        { endDate: { gte: startDate } },
      ]
    }

    const overlapping = await db.employeeProjectAssignment.findFirst({
      where: overlappingWhere,
    })

    if (overlapping) {
      return NextResponse.json(
        {
          error: 'Overlapping assignment exists for this employee and project within the specified date range',
          conflictingAssignment: {
            id: overlapping.id,
            startDate: overlapping.startDate,
            endDate: overlapping.endDate,
            role: overlapping.role,
          },
        },
        { status: 409 }
      )
    }

    // --- Total allocation check for percentage-based assignments ---
    if (allocationType === 'percentage') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const activePercentageAssignments = await db.employeeProjectAssignment.findMany(
        {
          where: {
            employeeId: data.employeeId,
            allocationType: 'percentage',
            isActive: true,
            startDate: { lte: today },
            OR: [
              { endDate: null },
              { endDate: { gte: today } },
            ],
          },
        }
      )

      const currentTotal = activePercentageAssignments.reduce(
        (sum, a) => sum + a.allocationValue,
        0
      )
      if (currentTotal + allocationValue > 100) {
        return NextResponse.json(
          {
            error: `Total percentage allocation would exceed 100%. Current total: ${currentTotal}%, attempting to add: ${allocationValue}%`,
            currentTotal,
            attemptedAdd: allocationValue,
          },
          { status: 400 }
        )
      }
    }

    // --- Auto-set isActive based on dates ---
    let isActive = data.isActive
    if (isActive === undefined || isActive === null) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)

      if (start > today) {
        // Future assignment - not yet active
        isActive = false
      } else if (endDate) {
        const end = new Date(endDate)
        end.setHours(0, 0, 0, 0)
        isActive = end >= today
      } else {
        // No end date and start date is in the past = active
        isActive = true
      }
    }

    // --- Create the assignment ---
    const assignment = await db.employeeProjectAssignment.create({
      data: {
        employeeId: data.employeeId,
        projectId: data.projectId,
        role: data.role || null,
        salaryAmount,
        allocationType,
        allocationValue,
        startDate,
        endDate,
        isActive,
        createdBy: data.createdBy || null,
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
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            projectType: true,
          },
        },
      },
    })

    // --- Audit log ---
    try {
      await db.auditLog.create({
        data: {
          userId: data.createdBy || 'system',
          action: 'CREATE',
          entity: 'EmployeeProjectAssignment',
          entityId: assignment.id,
          details: JSON.stringify({
            employeeId: data.employeeId,
            employeeName: employee.name,
            projectId: data.projectId,
            projectName: project.name,
            role: data.role,
            allocationType,
            allocationValue,
            startDate: data.startDate,
            endDate: data.endDate || null,
          }),
        },
      })
    } catch {
      // Audit log failure shouldn't block assignment creation
    }

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Error creating project assignment:', error)
    return NextResponse.json(
      { error: 'Failed to create project assignment' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/project-assignments?id=xxx
// Update an assignment (reactivation, deactivation, salary allocation)
// ============================================================
async function PUT_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      )
    }

    const data = await request.json()

    // --- Verify assignment exists ---
    const existing = await db.employeeProjectAssignment.findUnique({
      where: { id },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      )
    }

    // --- Build update data ---
    const updateData: any = {}

    // Updatable fields
    if (data.role !== undefined) updateData.role = data.role
    if (data.salaryAmount !== undefined) {
      if (data.salaryAmount < 0) {
        return NextResponse.json(
          { error: 'Salary amount cannot be negative' },
          { status: 400 }
        )
      }
      updateData.salaryAmount = data.salaryAmount
    }
    if (data.allocationType !== undefined) {
      const validAllocationTypes = ['fixed', 'percentage', 'attendance_based']
      if (!validAllocationTypes.includes(data.allocationType)) {
        return NextResponse.json(
          {
            error: `Invalid allocation type. Must be one of: ${validAllocationTypes.join(', ')}`,
          },
          { status: 400 }
        )
      }
      updateData.allocationType = data.allocationType
    }
    if (data.allocationValue !== undefined) {
      const allocationType = data.allocationType || existing.allocationType
      if (allocationType === 'percentage' && (data.allocationValue < 1 || data.allocationValue > 100)) {
        return NextResponse.json(
          { error: 'Allocation value for percentage type must be between 1 and 100' },
          { status: 400 }
        )
      }
      if (data.allocationValue < 0) {
        return NextResponse.json(
          { error: 'Allocation value cannot be negative' },
          { status: 400 }
        )
      }
      updateData.allocationValue = data.allocationValue
    }
    if (data.startDate !== undefined) {
      updateData.startDate = new Date(data.startDate)
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null
    }

    // --- Handle reactivation ---
    if (data.reactivate === true && !existing.isActive) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Check for overlapping active assignments before reactivating
      const overlapCheck: any = {
        employeeId: existing.employeeId,
        projectId: existing.projectId,
        isActive: true,
        id: { not: id },
      }
      const activeStartDate = updateData.startDate || existing.startDate
      const activeEndDate = updateData.endDate !== undefined ? updateData.endDate : existing.endDate

      if (activeEndDate) {
        overlapCheck.OR = [
          { endDate: null },
          { endDate: { gte: activeStartDate } },
        ]
        overlapCheck.startDate = { lte: activeEndDate }
      } else {
        overlapCheck.OR = [
          { endDate: null },
          { endDate: { gte: activeStartDate } },
        ]
      }

      const overlapping = await db.employeeProjectAssignment.findFirst({
        where: overlapCheck,
      })

      if (overlapping) {
        return NextResponse.json(
          {
            error: 'Cannot reactivate: overlapping active assignment exists for this employee and project',
            conflictingAssignment: {
              id: overlapping.id,
              startDate: overlapping.startDate,
              endDate: overlapping.endDate,
            },
          },
          { status: 409 }
        )
      }

      updateData.isActive = true
      // If no end date, set it open; if end date is in the past, extend it
      if (existing.endDate) {
        const endDate = new Date(existing.endDate)
        endDate.setHours(0, 0, 0, 0)
        if (endDate < today) {
          updateData.endDate = null // Make it ongoing
        }
      }
    }

    // --- Handle deactivation ---
    if (data.deactivate === true && existing.isActive) {
      updateData.isActive = false
      // Set end date to today if not already set or if it's in the future
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (!existing.endDate || new Date(existing.endDate) > today) {
        updateData.endDate = today
      }
    }

    // --- Explicit isActive toggle ---
    if (data.isActive !== undefined && data.reactivate === undefined && data.deactivate === undefined) {
      updateData.isActive = data.isActive
    }

    // --- Validate date range if dates are being updated ---
    const newStartDate = updateData.startDate || existing.startDate
    const newEndDate = updateData.endDate !== undefined ? updateData.endDate : existing.endDate
    if (newEndDate && new Date(newStartDate) >= new Date(newEndDate)) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    // --- Check for overlapping assignments if dates or project are changing ---
    if (data.startDate !== undefined || data.endDate !== undefined) {
      const checkStartDate = updateData.startDate ? new Date(updateData.startDate) : existing.startDate
      const checkEndDate = updateData.endDate !== undefined
        ? (updateData.endDate ? new Date(updateData.endDate) : null)
        : existing.endDate

      const overlapWhere: any = {
        employeeId: existing.employeeId,
        projectId: existing.projectId,
        isActive: true,
        id: { not: id },
      }

      if (checkEndDate) {
        overlapWhere.OR = [
          { endDate: null },
          { endDate: { gte: checkStartDate } },
        ]
        overlapWhere.startDate = { lte: checkEndDate }
      } else {
        overlapWhere.OR = [
          { endDate: null },
          { endDate: { gte: checkStartDate } },
        ]
      }

      const overlapping = await db.employeeProjectAssignment.findFirst({
        where: overlapWhere,
      })

      if (overlapping) {
        return NextResponse.json(
          {
            error: 'Updated date range overlaps with an existing active assignment for this employee and project',
            conflictingAssignment: {
              id: overlapping.id,
              startDate: overlapping.startDate,
              endDate: overlapping.endDate,
            },
          },
          { status: 409 }
        )
      }
    }

    // --- Total allocation check for percentage-based updates ---
    if (updateData.allocationType === 'percentage' || (updateData.allocationValue !== undefined && (updateData.allocationType || existing.allocationType) === 'percentage')) {
      const effectiveAllocationValue = updateData.allocationValue ?? existing.allocationValue
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const activePercentageAssignments = await db.employeeProjectAssignment.findMany(
        {
          where: {
            employeeId: existing.employeeId,
            allocationType: 'percentage',
            isActive: true,
            id: { not: id },
            startDate: { lte: today },
            OR: [
              { endDate: null },
              { endDate: { gte: today } },
            ],
          },
        }
      )

      const currentTotal = activePercentageAssignments.reduce(
        (sum, a) => sum + a.allocationValue,
        0
      )
      if (currentTotal + effectiveAllocationValue > 100) {
        return NextResponse.json(
          {
            error: `Total percentage allocation would exceed 100%. Current total (excluding this): ${currentTotal}%, attempting to set: ${effectiveAllocationValue}%`,
            currentTotal,
            attemptedSet: effectiveAllocationValue,
          },
          { status: 400 }
        )
      }
    }

    // --- Perform the update ---
    const updated = await db.employeeProjectAssignment.update({
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
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            projectType: true,
          },
        },
      },
    })

    // --- Audit log ---
    try {
      await db.auditLog.create({
        data: {
          userId: data.updatedBy || 'system',
          action: 'UPDATE',
          entity: 'EmployeeProjectAssignment',
          entityId: id,
          details: JSON.stringify({
            previous: {
              role: existing.role,
              salaryAmount: existing.salaryAmount,
              allocationType: existing.allocationType,
              allocationValue: existing.allocationValue,
              startDate: existing.startDate,
              endDate: existing.endDate,
              isActive: existing.isActive,
            },
            changes: updateData,
          }),
        },
      })
    } catch {
      // Audit log failure shouldn't block the update
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating project assignment:', error)
    return NextResponse.json(
      { error: 'Failed to update project assignment' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/project-assignments?id=xxx
// Delete an assignment (only if not used in payroll)
// ============================================================
async function DELETE_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      )
    }

    // --- Verify assignment exists ---
    const existing = await db.employeeProjectAssignment.findUnique({
      where: { id },
      include: {
        employee: { select: { name: true, employeeCode: true } },
        project: { select: { name: true, code: true } },
      },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      )
    }

    // --- Check if assignment is used in payroll ---
    // Look for payroll batch lines that reference the same employee + project
    // This indicates the employee's salary for this project has been processed
    const payrollLines = await db.payrollBatchLine.findFirst({
      where: {
        employeeId: existing.employeeId,
        projectId: existing.projectId,
      },
    })

    if (payrollLines) {
      return NextResponse.json(
        {
          error: 'Cannot delete assignment: it has been used in payroll processing',
          detail: `Employee "${existing.employee.name}" has payroll records for project "${existing.project.name}". Deactivate the assignment instead.`,
          suggestion: 'Deactivate the assignment rather than deleting it.',
        },
        { status: 409 }
      )
    }

    // --- Perform the delete ---
    await db.employeeProjectAssignment.delete({
      where: { id },
    })

    // --- Audit log ---
    try {
      await db.auditLog.create({
        data: {
          userId: 'system',
          action: 'DELETE',
          entity: 'EmployeeProjectAssignment',
          entityId: id,
          details: JSON.stringify({
            employeeId: existing.employeeId,
            employeeName: existing.employee.name,
            projectId: existing.projectId,
            projectName: existing.project.name,
            role: existing.role,
            allocationType: existing.allocationType,
            allocationValue: existing.allocationValue,
            startDate: existing.startDate,
            endDate: existing.endDate,
          }),
        },
      })
    } catch {
      // Audit log failure shouldn't block the deletion
    }

    return NextResponse.json({
      success: true,
      message: `Assignment for ${existing.employee.name} on project ${existing.project.name} deleted successfully`,
    })
  } catch (error) {
    console.error('Error deleting project assignment:', error)
    return NextResponse.json(
      { error: 'Failed to delete project assignment' },
      { status: 500 }
    )
  }
}

export const POST = withAudit('project-assignments', POST_HANDLER);

export const PUT = withAudit('project-assignments', PUT_HANDLER);

export const DELETE = withAudit('project-assignments', DELETE_HANDLER);

export const GET = withAudit('project-assignments', GET_HANDLER);
