import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// GET /api/employees — List employees with search, filter, pagination
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20))
    const skip = (page - 1) * pageSize

    // Search
    const search = searchParams.get('search')?.trim() || ''

    // Filters
    const status = searchParams.get('status')?.trim() || ''
    const department = searchParams.get('department')?.trim() || ''
    const projectId = searchParams.get('projectId')?.trim() || ''

    // Build where clause
    const where: Record<string, unknown> = {}

    // Search across name, cnic, employeeCode, designation, department
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { cnic: { contains: search } },
        { employeeCode: { contains: search } },
        { designation: { contains: search } },
        { department: { contains: search } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (department) {
      where.department = department
    }

    if (projectId) {
      where.defaultProjectId = projectId
    }

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        include: {
          defaultProject: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { employeeCode: 'asc' },
        skip,
        take: pageSize,
      }),
      db.employee.count({ where }),
    ])

    return NextResponse.json({
      data: employees,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Employee GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/employees — Create employee with auto-generated employeeCode
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // ---------- Validation ----------
    if (!body.name || !body.cnic) {
      return NextResponse.json(
        { error: 'Name and CNIC are required' },
        { status: 400 }
      )
    }

    // CNIC uniqueness check
    const existingCnic = await db.employee.findUnique({
      where: { cnic: body.cnic },
    })
    if (existingCnic) {
      return NextResponse.json(
        { error: `Employee with CNIC "${body.cnic}" already exists` },
        { status: 409 }
      )
    }

    // ---------- Auto-generate employeeCode (EMP-0001 pattern) ----------
    const lastEmployee = await db.employee.findFirst({
      where: { employeeCode: { startsWith: 'EMP-' } },
      orderBy: { employeeCode: 'desc' },
    })

    let nextNumber = 1
    if (lastEmployee) {
      const parts = lastEmployee.employeeCode.split('-')
      const lastNum = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1
      }
    }
    const employeeCode = `EMP-${String(nextNumber).padStart(4, '0')}`

    // ---------- Build create data ----------
    const createData: Record<string, unknown> = {
      employeeCode,
      name: body.name,
      fatherName: body.fatherName || null,
      cnic: body.cnic,
      ntn: body.ntn || null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      religion: body.religion || null,
      gender: body.gender || null,
      contactNo: body.contactNo || null,
      email: body.email || null,
      permanentAddress: body.permanentAddress || null,
      presentAddress: body.presentAddress || null,
      profilePhotoUrl: body.profilePhotoUrl || null,

      designation: body.designation || null,
      department: body.department || null,
      joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
      leavingDate: body.leavingDate ? new Date(body.leavingDate) : null,
      employmentType: body.employmentType || null,
      category: body.category || null,
      defaultProjectId: body.defaultProjectId || null,
      status: body.status || 'active',

      bankName: body.bankName || null,
      branchName: body.branchName || null,
      branchCode: body.branchCode || null,
      bankAccountNumber: body.bankAccountNumber || null,

      eobiNumber: body.eobiNumber || null,
      socialSecurityNo: body.socialSecurityNo || null,
      eobiEnabled: body.eobiEnabled === true,
      pfEnabled: body.pfEnabled === true,
      incomeTaxEnabled: body.incomeTaxEnabled !== false,
      essiEnabled: body.essiEnabled === true,
      gratuityEnabled: body.gratuityEnabled === true,
      applyToAllProjects: body.applyToAllProjects === true,
      defaultAllocationMethod: body.defaultAllocationMethod || 'days',
      taxFilingStatus: body.taxFilingStatus || null,
      taxCity: body.taxCity || null,

      qualification1: body.qualification1 || null,
      institute1: body.institute1 || null,
      year1: body.year1 || null,
      qualification2: body.qualification2 || null,
      institute2: body.institute2 || null,
      year2: body.year2 || null,

      previousEmployer: body.previousEmployer || null,
      yearsOfExperience: body.yearsOfExperience || null,

      nokName: body.nokName || null,
      nokCnic: body.nokCnic || null,
      nokContact: body.nokContact || null,
      nokRelation: body.nokRelation || null,

      baseSalary: body.baseSalary ?? 0,
      paymentType: body.paymentType || 'monthly',

      isFinancialUsed: false,
      createdBy: body.createdBy || null,
    }

    // If baseSalary is provided, also create a salary history entry
    if (body.baseSalary && body.baseSalary > 0) {
      createData.salaryHistory = {
        create: {
          effectiveDate: body.joiningDate ? new Date(body.joiningDate) : new Date(),
          previousSalary: 0,
          newSalary: body.baseSalary,
          changeReason: 'Initial salary',
          approvedBy: body.createdBy || null,
          createdBy: body.createdBy || null,
        },
      }
    }

    const employee = await db.employee.create({
      data: createData,
      include: {
        defaultProject: {
          select: { id: true, code: true, name: true },
        },
        salaryHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    return NextResponse.json(employee, { status: 201 })
  } catch (error) {
    console.error('Employee POST error:', error)
    let message = 'Failed to create employee'
    if (error instanceof Error) {
      message = error.message
      if (message.includes('Unique constraint')) {
        message = 'An employee with this CNIC or employee code already exists'
      }
    } else {
      message = String(error)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PUT /api/employees — Update employee (id in query params)
// If baseSalary changes, create a salary history entry.
// Prevent modification if isFinancialUsed is true (for critical fields).
// ---------------------------------------------------------------------------
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    const body = await request.json()

    // Check employee exists
    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // If financially used, prevent critical modifications
    if (existing.isFinancialUsed) {
      // Allow only limited fields: contactNo, email, presentAddress, profilePhotoUrl
      const allowedFields = ['contactNo', 'email', 'presentAddress', 'profilePhotoUrl']
      const attemptedFields = Object.keys(body).filter(
        (k) => !['id', 'updatedBy'].includes(k)
      )
      const disallowedFields = attemptedFields.filter(
        (k) => !allowedFields.includes(k)
      )
      if (disallowedFields.length > 0) {
        return NextResponse.json(
          {
            error:
              'Employee is marked as financially used. Only contact info (contactNo, email, presentAddress, profilePhotoUrl) can be updated.',
            disallowedFields,
          },
          { status: 403 }
        )
      }
    }

    // CNIC uniqueness check if CNIC is being changed
    if (body.cnic && body.cnic !== existing.cnic) {
      const duplicateCnic = await db.employee.findUnique({
        where: { cnic: body.cnic },
      })
      if (duplicateCnic) {
        return NextResponse.json(
          { error: `Employee with CNIC "${body.cnic}" already exists` },
          { status: 409 }
        )
      }
    }

    // Build update data — only include fields that are explicitly provided
    const updateData: Record<string, unknown> = {}

    // Personal
    if (body.name !== undefined) updateData.name = body.name
    if (body.fatherName !== undefined) updateData.fatherName = body.fatherName
    if (body.cnic !== undefined) updateData.cnic = body.cnic
    if (body.ntn !== undefined) updateData.ntn = body.ntn
    if (body.dateOfBirth !== undefined)
      updateData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null
    if (body.religion !== undefined) updateData.religion = body.religion
    if (body.gender !== undefined) updateData.gender = body.gender
    if (body.contactNo !== undefined) updateData.contactNo = body.contactNo
    if (body.email !== undefined) updateData.email = body.email
    if (body.permanentAddress !== undefined)
      updateData.permanentAddress = body.permanentAddress
    if (body.presentAddress !== undefined)
      updateData.presentAddress = body.presentAddress
    if (body.profilePhotoUrl !== undefined)
      updateData.profilePhotoUrl = body.profilePhotoUrl

    // Employment
    if (body.designation !== undefined) updateData.designation = body.designation
    if (body.department !== undefined) updateData.department = body.department
    if (body.joiningDate !== undefined)
      updateData.joiningDate = body.joiningDate ? new Date(body.joiningDate) : null
    if (body.leavingDate !== undefined)
      updateData.leavingDate = body.leavingDate ? new Date(body.leavingDate) : null
    if (body.employmentType !== undefined)
      updateData.employmentType = body.employmentType
    if (body.category !== undefined) updateData.category = body.category
    if (body.defaultProjectId !== undefined)
      updateData.defaultProjectId = body.defaultProjectId || null
    if (body.status !== undefined) updateData.status = body.status

    // Banking
    if (body.bankName !== undefined) updateData.bankName = body.bankName
    if (body.branchName !== undefined) updateData.branchName = body.branchName
    if (body.branchCode !== undefined) updateData.branchCode = body.branchCode
    if (body.bankAccountNumber !== undefined)
      updateData.bankAccountNumber = body.bankAccountNumber

    // Statutory
    if (body.eobiNumber !== undefined) updateData.eobiNumber = body.eobiNumber
    if (body.socialSecurityNo !== undefined)
      updateData.socialSecurityNo = body.socialSecurityNo
    if (body.eobiEnabled !== undefined) updateData.eobiEnabled = body.eobiEnabled === true
    if (body.pfEnabled !== undefined) updateData.pfEnabled = body.pfEnabled === true
    if (body.incomeTaxEnabled !== undefined) updateData.incomeTaxEnabled = body.incomeTaxEnabled !== false
    if (body.essiEnabled !== undefined) updateData.essiEnabled = body.essiEnabled === true
    if (body.gratuityEnabled !== undefined) updateData.gratuityEnabled = body.gratuityEnabled === true
    if (body.applyToAllProjects !== undefined) updateData.applyToAllProjects = body.applyToAllProjects === true
    if (body.defaultAllocationMethod !== undefined) updateData.defaultAllocationMethod = body.defaultAllocationMethod
    if (body.taxFilingStatus !== undefined) updateData.taxFilingStatus = body.taxFilingStatus
    if (body.taxCity !== undefined) updateData.taxCity = body.taxCity

    // Qualification
    if (body.qualification1 !== undefined)
      updateData.qualification1 = body.qualification1
    if (body.institute1 !== undefined) updateData.institute1 = body.institute1
    if (body.year1 !== undefined) updateData.year1 = body.year1
    if (body.qualification2 !== undefined)
      updateData.qualification2 = body.qualification2
    if (body.institute2 !== undefined) updateData.institute2 = body.institute2
    if (body.year2 !== undefined) updateData.year2 = body.year2

    // Experience
    if (body.previousEmployer !== undefined)
      updateData.previousEmployer = body.previousEmployer
    if (body.yearsOfExperience !== undefined)
      updateData.yearsOfExperience = body.yearsOfExperience

    // Next of Kin
    if (body.nokName !== undefined) updateData.nokName = body.nokName
    if (body.nokCnic !== undefined) updateData.nokCnic = body.nokCnic
    if (body.nokContact !== undefined) updateData.nokContact = body.nokContact
    if (body.nokRelation !== undefined) updateData.nokRelation = body.nokRelation

    // Salary
    if (body.paymentType !== undefined) updateData.paymentType = body.paymentType

    // Handle baseSalary change — create salary history entry
    if (body.baseSalary !== undefined && body.baseSalary !== existing.baseSalary) {
      updateData.baseSalary = body.baseSalary

      // Create salary history entry
      updateData.salaryHistory = {
        create: {
          effectiveDate: new Date(),
          previousSalary: existing.baseSalary,
          newSalary: body.baseSalary,
          changeReason: body.salaryChangeReason || 'Salary update',
          approvedBy: body.updatedBy || null,
          createdBy: body.updatedBy || null,
        },
      }
    }

    // System
    if (body.isFinancialUsed !== undefined)
      updateData.isFinancialUsed = body.isFinancialUsed

    const updated = await db.employee.update({
      where: { id },
      data: updateData,
      include: {
        defaultProject: {
          select: { id: true, code: true, name: true },
        },
        salaryHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Employee PUT error:', error)
    let message = 'Failed to update employee'
    if (error instanceof Error) {
      message = error.message
      if (message.includes('Unique constraint')) {
        message = 'An employee with this CNIC already exists'
      }
    } else {
      message = String(error)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/employees?id=xxx — Only allow if isFinancialUsed is false
// ---------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Prevent deletion if employee has been used in financial transactions
    if (existing.isFinancialUsed) {
      return NextResponse.json(
        {
          error:
            'Cannot delete employee — this employee has been used in financial transactions (isFinancialUsed = true). Deactivate the employee instead by setting status to "inactive".',
          employeeCode: existing.employeeCode,
          name: existing.name,
        },
        { status: 403 }
      )
    }

    // Delete related records first (cascading order matters)
    await db.$transaction([
      db.employeeSalaryHistory.deleteMany({ where: { employeeId: id } }),
      db.employeeAllowance.deleteMany({ where: { employeeId: id } }),
      db.employeeProjectAssignment.deleteMany({ where: { employeeId: id } }),
      db.attendance.deleteMany({ where: { employeeId: id } }),
      db.employee.delete({ where: { id } }),
    ])

    return NextResponse.json({
      success: true,
      message: `Employee "${existing.name}" (${existing.employeeCode}) deleted successfully`,
    })
  } catch (error) {
    console.error('Employee DELETE error:', error)
    let message = 'Failed to delete employee'
    if (error instanceof Error) {
      message = error.message
      // Foreign key constraint errors
      if (
        message.includes('Foreign key constraint') ||
        message.includes('CONSTRAINT')
      ) {
        message =
          'Cannot delete employee — there are related records that prevent deletion. Mark the employee as inactive instead.'
      }
    } else {
      message = String(error)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
