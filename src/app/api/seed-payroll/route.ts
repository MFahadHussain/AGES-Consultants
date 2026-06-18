import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// Seed Payroll Data — Idempotent endpoint
// POST /api/seed-payroll  or  GET /api/seed-payroll
// Seeds: Tax Slabs, Allowances, GL Mappings, Employees,
//        Attendance, and Project Assignments
// ============================================================

// --- Default Tax Slabs (Pakistan Income Tax FY 2024-25) ---
const DEFAULT_TAX_SLABS = [
  { slabOrder: 1, minAmount: 0,      maxAmount: 600000,   rate: 0,  fixedAmount: 0 },
  { slabOrder: 2, minAmount: 600001,  maxAmount: 1200000,  rate: 5,  fixedAmount: 0 },
  { slabOrder: 3, minAmount: 1200001, maxAmount: 2200000,  rate: 15, fixedAmount: 60000 },
  { slabOrder: 4, minAmount: 2200001, maxAmount: 3200000,  rate: 25, fixedAmount: 300000 },
  { slabOrder: 5, minAmount: 3200001, maxAmount: 4100000,  rate: 30, fixedAmount: 550000 },
  { slabOrder: 6, minAmount: 4100001, maxAmount: null,     rate: 35, fixedAmount: 820000 },
]

// --- Default Allowances ---
const DEFAULT_ALLOWANCES = [
  { code: 'MED', name: 'Medical Allowance',    allowanceType: 'fixed',      value: 5000, baseOnSalary: false, isTaxable: false, isProjectSpecific: false, isActive: true },
  { code: 'HRA', name: 'House Rent Allowance',  allowanceType: 'percentage', value: 45,   baseOnSalary: true,  isTaxable: false, isProjectSpecific: false, isActive: true },
  { code: 'TA',  name: 'Transport Allowance',   allowanceType: 'fixed',      value: 3000, baseOnSalary: false, isTaxable: true,  isProjectSpecific: false, isActive: true },
  { code: 'PA',  name: 'Project Allowance',      allowanceType: 'fixed',      value: 0,    baseOnSalary: false, isTaxable: true,  isProjectSpecific: true,  isActive: true },
]

// --- Default Payroll GL Mapping component types ---
const DEFAULT_GL_COMPONENT_TYPES = [
  { componentType: 'SALARY_EXPENSE',      description: 'Salary Expense - Debit to salary expense account' },
  { componentType: 'ALLOWANCE_EXPENSE',   description: 'Allowance Expense - Debit to allowance expense account' },
  { componentType: 'INCOME_TAX_PAYABLE',  description: 'Income Tax Payable - Credit to income tax payable account' },
  { componentType: 'EOBI_EMPLOYEE',       description: 'EOBI Employee Contribution - Credit to EOBI payable account' },
  { componentType: 'EOBI_EMPLOYER',       description: 'EOBI Employer Contribution - Debit to social charges, Credit to EOBI payable' },
  { componentType: 'PF_EMPLOYEE',         description: 'Provident Fund Employee - Credit to PF payable account' },
  { componentType: 'PF_EMPLOYER',         description: 'Provident Fund Employer - Debit to PF expense, Credit to PF payable' },
  { componentType: 'SOCIAL_CHARGES',      description: 'Social Charges - Debit to social charges expense account' },
  { componentType: 'SALARY_PAYABLE',      description: 'Salary Payable - Credit to salary payable account' },
  { componentType: 'GRATUITY',            description: 'Gratuity - Debit to gratuity expense, Credit to gratuity payable' },
  { componentType: 'LOAN_DEDUCTION',      description: 'Loan Deduction - Credit to loan receivable account' },
  { componentType: 'ADVANCE_DEDUCTION',   description: 'Advance Deduction - Credit to advance receivable account' },
]

// --- Sample Employees ---
const SAMPLE_EMPLOYEES = [
  { employeeCode: 'EMP-0001', name: 'Ahmed Khan',      designation: 'Manager',     department: 'IT',             baseSalary: 150000, cnic: '33100-1234567-1', gender: 'Male',   employmentType: 'Permanent', category: 'Management', contactNo: '0300-1234567', email: 'ahmed.khan@acctfin.pk' },
  { employeeCode: 'EMP-0002', name: 'Fatima Ali',      designation: 'Accountant',  department: 'Finance',        baseSalary: 120000, cnic: '33100-2345678-2', gender: 'Female', employmentType: 'Permanent', category: 'Staff',      contactNo: '0301-2345678', email: 'fatima.ali@acctfin.pk' },
  { employeeCode: 'EMP-0003', name: 'Muhammad Raza',   designation: 'Engineer',    department: 'Engineering',    baseSalary: 180000, cnic: '33100-3456789-3', gender: 'Male',   employmentType: 'Permanent', category: 'Staff',      contactNo: '0302-3456789', email: 'm.raza@acctfin.pk' },
  { employeeCode: 'EMP-0004', name: 'Sara Ahmed',      designation: 'HR Officer',  department: 'HR',             baseSalary: 100000, cnic: '33100-4567890-4', gender: 'Female', employmentType: 'Permanent', category: 'Officer',    contactNo: '0303-4567890', email: 'sara.ahmed@acctfin.pk' },
  { employeeCode: 'EMP-0005', name: 'Ali Hassan',      designation: 'Admin',       department: 'Administration', baseSalary: 80000,  cnic: '33100-5678901-5', gender: 'Male',   employmentType: 'Permanent', category: 'Staff',      contactNo: '0304-5678901', email: 'ali.hassan@acctfin.pk' },
]

// ============================================================
// Seed Functions
// ============================================================

/** Seed tax slabs for FY 2024-25 — idempotent by fiscalYear + slabOrder */
async function seedTaxSlabs() {
  const fiscalYear = '2024-25'
  let created = 0
  let skipped = 0
  const details: string[] = []

  for (const slab of DEFAULT_TAX_SLABS) {
    const existing = await db.taxSlab.findFirst({
      where: { fiscalYear, slabOrder: slab.slabOrder },
    })

    if (existing) {
      skipped++
      details.push(`Slab ${slab.slabOrder}: skipped (exists)`)
      continue
    }

    await db.taxSlab.create({
      data: {
        fiscalYear,
        slabOrder: slab.slabOrder,
        minAmount: slab.minAmount,
        maxAmount: slab.maxAmount,
        rate: slab.rate,
        fixedAmount: slab.fixedAmount,
        isActive: true,
      },
    })
    created++
    details.push(`Slab ${slab.slabOrder}: ${slab.minAmount}-${slab.maxAmount ?? '∞'} @ ${slab.rate}% + ${slab.fixedAmount} fixed`)
  }

  return { created, skipped, details }
}

/** Seed default allowances — idempotent by unique code */
async function seedAllowances() {
  let created = 0
  let skipped = 0
  const details: string[] = []

  for (const allowance of DEFAULT_ALLOWANCES) {
    const existing = await db.allowance.findUnique({
      where: { code: allowance.code },
    })

    if (existing) {
      skipped++
      details.push(`${allowance.code}: skipped (exists)`)
      continue
    }

    await db.allowance.create({ data: allowance })
    created++
    details.push(`${allowance.code} (${allowance.name}): ${allowance.allowanceType === 'percentage' ? `${allowance.value}%` : `${allowance.value} PKR`}, taxable=${allowance.isTaxable}`)
  }

  return { created, skipped, details }
}

/** Seed default payroll GL mappings — idempotent by unique componentType */
async function seedGLMappings() {
  let created = 0
  let skipped = 0
  const details: string[] = []

  for (const item of DEFAULT_GL_COMPONENT_TYPES) {
    const existing = await db.payrollAccountMapping.findUnique({
      where: { componentType: item.componentType },
    })

    if (existing) {
      skipped++
      details.push(`${item.componentType}: skipped (exists)`)
      continue
    }

    await db.payrollAccountMapping.create({
      data: {
        componentType: item.componentType,
        description: item.description,
        isActive: true,
      },
    })
    created++
    details.push(`${item.componentType}: created`)
  }

  return { created, skipped, details }
}

/** Seed sample employees — idempotent by unique employeeCode and CNIC */
async function seedEmployees(headOfficeProjectId: string | null) {
  let created = 0
  let skipped = 0
  const details: string[] = []
  const employeeIds: { code: string; id: string }[] = []

  for (const emp of SAMPLE_EMPLOYEES) {
    // Check by employeeCode (unique)
    const existingByCode = await db.employee.findUnique({
      where: { employeeCode: emp.employeeCode },
    })

    if (existingByCode) {
      skipped++
      details.push(`${emp.employeeCode} (${emp.name}): skipped (exists)`)
      employeeIds.push({ code: emp.employeeCode, id: existingByCode.id })
      continue
    }

    // Check by CNIC (unique)
    const existingByCnic = await db.employee.findUnique({
      where: { cnic: emp.cnic },
    })

    if (existingByCnic) {
      skipped++
      details.push(`${emp.employeeCode} (${emp.name}): skipped (CNIC exists)`)
      employeeIds.push({ code: emp.employeeCode, id: existingByCnic.id })
      continue
    }

    const joiningDate = new Date('2024-07-01')

    const employee = await db.employee.create({
      data: {
        employeeCode: emp.employeeCode,
        name: emp.name,
        cnic: emp.cnic,
        designation: emp.designation,
        department: emp.department,
        baseSalary: emp.baseSalary,
        gender: emp.gender,
        employmentType: emp.employmentType,
        category: emp.category,
        contactNo: emp.contactNo,
        email: emp.email,
        joiningDate,
        status: 'active',
        paymentType: 'monthly',
        defaultProjectId: headOfficeProjectId,
        createdBy: 'system-seed',
        salaryHistory: {
          create: {
            effectiveDate: joiningDate,
            previousSalary: 0,
            newSalary: emp.baseSalary,
            changeReason: 'Initial salary',
            createdBy: 'system-seed',
          },
        },
      },
    })

    created++
    details.push(`${emp.employeeCode} (${emp.name}): created, salary=${emp.baseSalary} PKR`)
    employeeIds.push({ code: emp.employeeCode, id: employee.id })
  }

  return { created, skipped, details, employeeIds }
}

/** Seed sample attendance for the current month — idempotent via upsert */
async function seedAttendance(employeeIds: { code: string; id: string }[], headOfficeProjectId: string | null) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-indexed
  const today = now.getUTCDate()
  const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  let created = 0
  let updated = 0
  const details: string[] = []

  for (const emp of employeeIds) {
    let empPresent = 0
    let empLeave = 0

    for (let day = 1; day <= Math.min(today, totalDays); day++) {
      const date = new Date(Date.UTC(year, month, day))
      const dayOfWeek = date.getUTCDay() // 0=Sun, 6=Sat

      // Determine attendance status
      let status: string

      if (dayOfWeek === 0) {
        // Sunday — mark as Present (working Sunday in Pakistan context)
        status = 'P'
      } else if (dayOfWeek === 6) {
        // Saturday — mark as Present
        status = 'P'
      } else {
        // Weekdays: mostly Present, some CL/SL
        // Deterministic pattern based on employee and day
        const seed = (day * 7 + emp.code.charCodeAt(4)) % 20
        if (seed === 0) {
          status = 'CL' // ~5% chance Casual Leave
        } else if (seed === 1) {
          status = 'SL' // ~5% chance Sick Leave
        } else {
          status = 'P' // ~90% Present
        }
      }

      if (status === 'P') empPresent++
      else if (status === 'CL' || status === 'SL') empLeave++

      // Use upsert for idempotency
      const existing = await db.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: emp.id,
            date,
          },
        },
      })

      if (existing) {
        updated++
      } else {
        created++
      }

      await db.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: emp.id,
            date,
          },
        },
        update: {
          status,
          projectId: headOfficeProjectId,
        },
        create: {
          employeeId: emp.id,
          date,
          status,
          projectId: headOfficeProjectId,
          createdBy: 'system-seed',
        },
      })
    }

    details.push(`${emp.code}: ${empPresent}P + ${empLeave}L (days 1-${Math.min(today, totalDays)})`)
  }

  return { created, updated, details }
}

/** Seed sample project assignments — assign all employees to Head Office project */
async function seedProjectAssignments(
  employeeIds: { code: string; id: string }[],
  headOfficeProjectId: string | null
) {
  if (!headOfficeProjectId) {
    return { created: 0, skipped: 0, details: ['Head Office project not found — skipping assignments'] }
  }

  let created = 0
  let skipped = 0
  const details: string[] = []

  const startDate = new Date('2024-07-01')

  for (const emp of employeeIds) {
    // Check if an active assignment already exists for this employee + project
    const existing = await db.employeeProjectAssignment.findFirst({
      where: {
        employeeId: emp.id,
        projectId: headOfficeProjectId,
        isActive: true,
      },
    })

    if (existing) {
      skipped++
      details.push(`${emp.code}: skipped (active assignment exists)`)
      continue
    }

    // Get the employee's salary for the assignment
    const employee = await db.employee.findUnique({
      where: { id: emp.id },
      select: { baseSalary: true, designation: true },
    })

    await db.employeeProjectAssignment.create({
      data: {
        employeeId: emp.id,
        projectId: headOfficeProjectId,
        role: employee?.designation || null,
        salaryAmount: employee?.baseSalary || 0,
        allocationType: 'fixed',
        allocationValue: 100,
        startDate,
        endDate: null, // Ongoing
        isActive: true,
        createdBy: 'system-seed',
      },
    })

    created++
    details.push(`${emp.code}: assigned to Head Office`)
  }

  return { created, skipped, details }
}

// ============================================================
// POST handler — Orchestrates all seeding
// ============================================================

async function POST_HANDLER() {
  try {
    const summary: Record<string, unknown> = {}

    // --- 0. Find Head Office project ---
    const headOffice = await db.project.findFirst({
      where: { isHeadOffice: true },
    })
    const headOfficeProjectId = headOffice?.id || null

    // --- 1. Tax Slabs ---
    const taxSlabResult = await seedTaxSlabs()
    summary.taxSlabs = taxSlabResult

    // --- 2. Allowances ---
    const allowanceResult = await seedAllowances()
    summary.allowances = allowanceResult

    // --- 3. GL Mappings ---
    const glMappingResult = await seedGLMappings()
    summary.glMappings = glMappingResult

    // --- 4. Employees ---
    const employeeResult = await seedEmployees(headOfficeProjectId)
    summary.employees = {
      created: employeeResult.created,
      skipped: employeeResult.skipped,
      details: employeeResult.details,
    }

    // --- 5. Attendance ---
    const attendanceResult = await seedAttendance(employeeResult.employeeIds, headOfficeProjectId)
    summary.attendance = attendanceResult

    // --- 6. Project Assignments ---
    const assignmentResult = await seedProjectAssignments(employeeResult.employeeIds, headOfficeProjectId)
    summary.projectAssignments = assignmentResult

    // --- Final summary ---
    const totalCreated =
      taxSlabResult.created +
      allowanceResult.created +
      glMappingResult.created +
      employeeResult.created +
      attendanceResult.created +
      assignmentResult.created

    const totalSkipped =
      taxSlabResult.skipped +
      allowanceResult.skipped +
      glMappingResult.skipped +
      employeeResult.skipped +
      attendanceResult.updated +
      assignmentResult.skipped

    return NextResponse.json({
      success: true,
      message: `Payroll seed completed: ${totalCreated} created, ${totalSkipped} skipped/updated`,
      headOfficeProject: headOffice ? { id: headOffice.id, code: headOffice.code, name: headOffice.name } : null,
      summary,
    })
  } catch (error) {
    console.error('[SEED_PAYROLL]', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: 'Failed to seed payroll data', details: message },
      { status: 500 }
    )
  }
}

// GET handler — convenience: triggers the same seed via GET
async function GET_HANDLER() {
  return POST()
}

export const POST = withAudit('seed-payroll', POST_HANDLER);

export const GET = withAudit('seed-payroll', GET_HANDLER);
