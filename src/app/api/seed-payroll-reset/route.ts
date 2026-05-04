import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// Reset & Seed Payroll Data — Clears old data and seeds new
// POST /api/seed-payroll-reset
// ============================================================

// --- New Employee Data ---
const ASSAD_DATA = {
  employeeCode: 'EMP-0001',
  name: 'Assad Ali Khan',
  cnic: '33100-1234567-1',
  gender: 'Male',
  contactNo: '0300-1234567',
  email: 'assad.khan@ages.pk',
  employmentType: 'Permanent',
  category: 'Consultant',
  status: 'active',
  paymentType: 'monthly',
  eobiEnabled: true,
  pfEnabled: true,
  incomeTaxEnabled: true,
  joiningDate: '2023-01-01',
  projectAssignments: [
    { designation: 'Environmentalist', salary: 265000, projectName: 'AGES HO', projectCode: 'AGES-HO' },
    { designation: 'Principal Environment Engineer/Environmentalist', salary: 265000, projectName: 'Jabba Dam Project', projectCode: 'JABBA-DAM' },
    { designation: 'Environmental Specialist', salary: 265000, projectName: 'Kurram Tangi Dam', projectCode: 'KURRAM-TD' },
    { designation: 'Expert (Environmental)', salary: 265000, projectName: 'Hingol Dam', projectCode: 'HINGOL-DAM' },
    { designation: 'Principal Environmental Engineer', salary: 265000, projectName: '03 Dams', projectCode: '03-DAMS' },
    { designation: 'Environmental Specialist', salary: 388098, projectName: 'PHLCE', projectCode: 'PHLCE' },
    { designation: 'Environmental Engineer', salary: 451576, projectName: 'Balakot HPP', projectCode: 'BALAKOT-HPP' },
  ],
}

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

export async function POST() {
  try {
    const summary: string[] = []

    // ── Step 1: Clear old payroll data ──
    summary.push('--- Clearing old data ---')
    
    await db.payrollBatchLine.deleteMany({})
    summary.push('✓ Cleared PayrollBatchLine')

    await db.projectCostLedger.deleteMany({})
    summary.push('✓ Cleared ProjectCostLedger')

    await db.payrollBatch.deleteMany({})
    summary.push('✓ Cleared PayrollBatch')

    await db.attendanceDailyProject.deleteMany({})
    summary.push('✓ Cleared AttendanceDailyProject')

    await db.attendance.deleteMany({})
    summary.push('✓ Cleared Attendance')

    await db.employeeAllowance.deleteMany({})
    summary.push('✓ Cleared EmployeeAllowance')

    await db.employeeProjectAssignment.deleteMany({})
    summary.push('✓ Cleared EmployeeProjectAssignment')

    await db.employeeSalaryHistory.deleteMany({})
    summary.push('✓ Cleared EmployeeSalaryHistory')

    await db.finalSettlement.deleteMany({})
    summary.push('✓ Cleared FinalSettlement')

    await db.loanInstallment.deleteMany({})
    summary.push('✓ Cleared LoanInstallment')

    await db.loan.deleteMany({})
    summary.push('✓ Cleared Loan')

    await db.employee.deleteMany({})
    summary.push('✓ Cleared Employee')

    // ── Step 2: Seed Tax Slabs ──
    summary.push('--- Seeding Tax Slabs ---')
    for (const slab of DEFAULT_TAX_SLABS) {
      const existing = await db.taxSlab.findFirst({
        where: { fiscalYear: '2024-25', slabOrder: slab.slabOrder },
      })
      if (!existing) {
        await db.taxSlab.create({
          data: { fiscalYear: '2024-25', ...slab, isActive: true },
        })
        summary.push(`  Created slab ${slab.slabOrder}`)
      } else {
        summary.push(`  Slab ${slab.slabOrder} already exists`)
      }
    }

    // ── Step 3: Seed Allowances ──
    summary.push('--- Seeding Allowances ---')
    for (const allowance of DEFAULT_ALLOWANCES) {
      const existing = await db.allowance.findUnique({ where: { code: allowance.code } })
      if (!existing) {
        await db.allowance.create({ data: allowance })
        summary.push(`  Created ${allowance.code}`)
      } else {
        summary.push(`  ${allowance.code} already exists`)
      }
    }

    // ── Step 4: Seed GL Mappings ──
    summary.push('--- Seeding GL Mappings ---')
    for (const item of DEFAULT_GL_COMPONENT_TYPES) {
      const existing = await db.payrollAccountMapping.findUnique({ where: { componentType: item.componentType } })
      if (!existing) {
        await db.payrollAccountMapping.create({ data: { ...item, isActive: true } })
        summary.push(`  Created ${item.componentType}`)
      } else {
        summary.push(`  ${item.componentType} already exists`)
      }
    }

    // ── Step 5: Create/ensure Projects exist ──
    summary.push('--- Ensuring Projects ---')
    const projectRecords: { code: string; id: string; name: string }[] = []

    for (const pa of ASSAD_DATA.projectAssignments) {
      let project = await db.project.findFirst({ where: { code: pa.projectCode } })
      if (!project) {
        project = await db.project.findFirst({ where: { name: pa.projectName } })
      }
      if (!project) {
        project = await db.project.create({
          data: {
            code: pa.projectCode,
            name: pa.projectName,
            projectType: 'Construction',
            status: 'active',
            isHeadOffice: false,
          },
        })
        summary.push(`  Created project: ${pa.projectCode} - ${pa.projectName}`)
      } else {
        summary.push(`  Project exists: ${project.code} - ${project.name}`)
      }
      projectRecords.push({ code: pa.projectCode, id: project.id, name: pa.projectName })
    }

    // ── Step 6: Create Employee ──
    summary.push('--- Creating Employee ---')
    
    // The baseSalary is set to the sum of all project assignment salaries
    const totalSalary = ASSAD_DATA.projectAssignments.reduce((sum, pa) => sum + pa.salary, 0)
    
    const employee = await db.employee.create({
      data: {
        employeeCode: ASSAD_DATA.employeeCode,
        name: ASSAD_DATA.name,
        cnic: ASSAD_DATA.cnic,
        gender: ASSAD_DATA.gender,
        contactNo: ASSAD_DATA.contactNo,
        email: ASSAD_DATA.email,
        employmentType: ASSAD_DATA.employmentType,
        category: ASSAD_DATA.category,
        status: ASSAD_DATA.status,
        paymentType: ASSAD_DATA.paymentType,
        eobiEnabled: ASSAD_DATA.eobiEnabled,
        pfEnabled: ASSAD_DATA.pfEnabled,
        incomeTaxEnabled: ASSAD_DATA.incomeTaxEnabled,
        joiningDate: new Date(ASSAD_DATA.joiningDate),
        baseSalary: totalSalary,
        designation: ASSAD_DATA.projectAssignments[0].designation,
        department: 'Environment',
        defaultProjectId: projectRecords[0]?.id || null,
        createdBy: 'system-seed',
        salaryHistory: {
          create: {
            effectiveDate: new Date(ASSAD_DATA.joiningDate),
            previousSalary: 0,
            newSalary: totalSalary,
            changeReason: 'Initial salary',
            createdBy: 'system-seed',
          },
        },
      },
    })
    summary.push(`  Created employee: ${employee.employeeCode} - ${employee.name}`)
    summary.push(`  Base Salary: PKR ${totalSalary.toLocaleString()}`)

    // ── Step 7: Create EmployeeProjectAssignments ──
    summary.push('--- Creating Project Assignments ---')
    const startDate = new Date(ASSAD_DATA.joiningDate)

    for (let i = 0; i < ASSAD_DATA.projectAssignments.length; i++) {
      const pa = ASSAD_DATA.projectAssignments[i]
      const project = projectRecords[i]
      if (!project) continue

      await db.employeeProjectAssignment.create({
        data: {
          employeeId: employee.id,
          projectId: project.id,
          role: pa.designation,
          salaryAmount: pa.salary,
          allocationType: 'fixed',
          allocationValue: 100,
          startDate,
          endDate: null,
          isActive: true,
          createdBy: 'system-seed',
        },
      })
      summary.push(`  ${pa.designation} @ ${pa.projectName}: PKR ${pa.salary.toLocaleString()}/month`)
    }

    // ── Step 8: Generate Attendance for Current Month ──
    summary.push('--- Generating Attendance ---')
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() // 0-indexed
    const today = now.getUTCDate()
    const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

    let totalCreated = 0
    let totalADP = 0

    // Distribute attendance across projects evenly in a rotating pattern
    const projectList = projectRecords
    const numProjects = projectList.length

    for (let day = 1; day <= Math.min(today, totalDays); day++) {
      const date = new Date(Date.UTC(year, month, day))
      const dayOfWeek = date.getUTCDay() // 0=Sun, 6=Sat

      // Determine attendance status and project
      let status: string
      let projectIndex: number

      if (dayOfWeek === 0) {
        // Sunday - Weekend (W) - paid, project selected
        status = 'W'
        projectIndex = day % numProjects
      } else if (dayOfWeek === 6) {
        // Saturday - Present
        status = 'P'
        projectIndex = day % numProjects
      } else {
        // Weekdays: mostly Present, some CL/SL
        const seed = (day * 7 + employee.name.charCodeAt(0)) % 20
        if (seed === 0) {
          status = 'CL' // ~5% Casual Leave
          projectIndex = day % numProjects
        } else if (seed === 1) {
          status = 'SL' // ~5% Sick Leave
          projectIndex = day % numProjects
        } else {
          status = 'P'
          projectIndex = (day - 1) % numProjects
        }
      }

      const project = projectList[projectIndex]
      if (!project) continue

      // Create attendance record
      await db.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date,
          },
        },
        update: {
          status,
          projectId: project.id,
        },
        create: {
          employeeId: employee.id,
          date,
          status,
          projectId: project.id,
          createdBy: 'system-seed',
        },
      })
      totalCreated++

      // Create AttendanceDailyProject record
      await db.attendanceDailyProject.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date,
          },
        },
        update: {
          status,
          projectId: project.id,
        },
        create: {
          employeeId: employee.id,
          date,
          status,
          projectId: project.id,
        },
      })
      totalADP++
    }

    summary.push(`  Created ${totalCreated} attendance records`)
    summary.push(`  Created ${totalADP} daily project records`)

    // ── Final summary ──
    return NextResponse.json({
      success: true,
      message: 'Payroll data reset and seeded successfully',
      employee: {
        id: employee.id,
        name: employee.name,
        code: employee.employeeCode,
        baseSalary: totalSalary,
        projectCount: projectRecords.length,
      },
      projects: projectRecords.map(p => ({ id: p.id, code: p.code, name: p.name })),
      attendanceGenerated: totalCreated,
      summary,
    })
  } catch (error) {
    console.error('[SEED_PAYROLL_RESET]', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: 'Failed to seed payroll data', details: message },
      { status: 500 }
    )
  }
}

// GET handler — convenience: triggers the same seed via GET
export async function GET() {
  return POST()
}
