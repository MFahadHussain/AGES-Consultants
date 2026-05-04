// ============================================================================
// Payroll Calculation Engine — Attendance-Based Project Cost Distribution
// ============================================================================
// Core Business Rule: A project allocation only exists if attendance exists.
// No attendance record = no project cost = no SC allocation.
//
// Supports project-specific salaries from EmployeeProjectAssignment.
// If an assignment has a salaryAmount, that rate is used for that project.
// Otherwise, the employee's baseSalary is distributed by weight.
// ============================================================================

import { db } from '@/lib/db'

// ── Status Classification ──────────────────────────────────────────────────

/** Statuses eligible for salary + SC earning */
const ELIGIBLE_STATUSES = new Set(['P', 'W', 'H', 'T', 'WH', 'WW', 'CL', 'SL', 'EL'])

/** Leave statuses that trigger SC deduction */
const LEAVE_STATUSES = new Set(['CL', 'SL'])

/** Statuses that are billable and require a project assignment */
const BILLABLE_STATUSES = new Set(['P', 'W', 'H', 'WH', 'WW', 'T', 'CO', 'CL', 'SL', 'EL'])

// ── SC Rate Constants ──────────────────────────────────────────────────────

const SC_RATE = 0.20

const SC_COMPONENTS = {
  otherPayable: 0.0833, // 8.33 / 20 relative
  earnedLeave:  0.0833,
  sickLeave:    0.0167, // 1.67 / 20 relative
  casualLeave:  0.0167,
}

// ── Helper ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Get the number of calendar days in a month */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// ── Main Calculation ───────────────────────────────────────────────────────

export interface ProjectAllocation {
  projectId: string
  projectName: string
  projectCode: string
  days: number
  weight: number
  weightPct: string
  salaryShare: number
  scShare: number
  scBalance: number
  scOtherPayable: number
  scEarnedLeave: number
  scSickLeave: number
  scCasualLeave: number
  /** Project-specific daily rate (from assignment salary / days in month) */
  projectDailyRate: number
  /** The salary from EmployeeProjectAssignment (if any) */
  projectSalary: number | null
  designation: string | null
}

export interface PayrollResult {
  employee: {
    id: string
    name: string
    employeeCode: string
    baseSalary: number
  }
  month: string          // YYYY-MM
  daysInMonth: number
  eligibleDays: number
  leaveDays: number
  absentDays: number
  monthlySalary: number  // Total effective salary (may differ from baseSalary)
  dailyRate: number      // Weighted average daily rate
  workingRatio: number
  monthlySC: number
  earnedSC: number
  leaveDeduction: number
  finalSC: number
  scBalance: number
  scComponents: {
    otherPayable: number
    earnedLeave: number
    sickLeave: number
    casualLeave: number
  }
  projectAllocations: ProjectAllocation[]
  totalBillableDays: number
  /** Allowance calculations */
  allowances: {
    details: { allowanceId: string; name: string; amount: number; isTaxable: boolean }[]
    totalAllowances: number
    taxFreeAllowances: number
  }
  /** Deduction calculations */
  deductions: {
    incomeTax: number
    eobiEmployee: number
    eobiEmployer: number
    pfEmployee: number
    pfEmployer: number
    loanDeduction: number
    advanceDeduction: number
    otherDeductions: number
    totalDeductions: number
  }
  grossSalary: number
  netPay: number
  gratuity: number
  taxBreakdown: {
    taxableIncome: number
    taxSlab: string
    fixedTax: number
    variableTax: number
    monthlyTax: number
  }
  scBreakdown: {
    monthlySC: number
    workingRatio: number
    earnedSC: number
    leaveDeduction: number
    finalSC: number
  }
}

/**
 * Calculate the full monthly payroll for a single employee.
 *
 * Formulas (AGES Consultants methodology):
 *   Daily Salary Rate  = Monthly Salary ÷ Days in Month
 *   Monthly SC         = Monthly Salary × 20%
 *   Eligible Days      = COUNT(P + W + H + T + WH + WW + CL + SL + EL)
 *   Leave Days         = COUNT(CL + SL)
 *   Working Ratio      = Eligible Days ÷ Days in Month
 *   Earned SC          = Monthly SC × Working Ratio
 *   Leave Deduction    = Daily Rate × Leave Days
 *   Final Payable SC   = Earned SC − Leave Deduction
 *   SC Balance         = Leave Deduction (deferred)
 *
 * Project Distribution (with project-specific salaries):
 *   For each project, if EmployeeProjectAssignment.salaryAmount exists:
 *     Project Daily Rate = Assignment Salary / Days In Month
 *     Project Salary Share = Project Daily Rate × Days on Project
 *   Otherwise (fallback):
 *     Weight = Days on Project / Total Billable Days
 *     Project Salary Share = Total Monthly Salary × Weight
 *
 *   SC Share = Final SC × (Project Salary Share / Total Salary)
 */
export async function calculateMonthlyPayroll(
  employeeId: string,
  month: Date // Pass the 1st of the target month
): Promise<PayrollResult> {
  // ── 1. Fetch employee and salary ──
  const employee = await db.employee.findUniqueOrThrow({
    where: { id: employeeId },
  })

  const year = month.getUTCFullYear()
  const mon = month.getUTCMonth() + 1 // 1-indexed
  const daysInMonth = getDaysInMonth(year, mon)

  // ── 2. Fetch all attendance records for this month ──
  const monthStart = new Date(Date.UTC(year, mon - 1, 1))
  const monthEnd = new Date(Date.UTC(year, mon - 1, daysInMonth, 23, 59, 59, 999))

  const attendance = await db.attendance.findMany({
    where: {
      employeeId,
      date: { gte: monthStart, lte: monthEnd },
    },
    select: { date: true, status: true },
  })

  // ── 3. Fetch all daily project links for this month ──
  const dailyProjects = await db.attendanceDailyProject.findMany({
    where: {
      employeeId,
      date: { gte: monthStart, lte: monthEnd },
    },
    select: { date: true, projectId: true, status: true },
  })

  // ── 4. Fetch EmployeeProjectAssignments (for project-specific salaries) ──
  const projectAssignments = await db.employeeProjectAssignment.findMany({
    where: {
      employeeId,
      isActive: true,
      startDate: { lte: monthEnd },
      OR: [
        { endDate: null },
        { endDate: { gte: monthStart } },
      ],
    },
    select: {
      projectId: true,
      salaryAmount: true,
      role: true,
    },
  })

  // Build a map of projectId → assignment info
  const assignmentMap = new Map<string, { salaryAmount: number; role: string | null }>()
  for (const pa of projectAssignments) {
    if (pa.salaryAmount && pa.salaryAmount > 0) {
      assignmentMap.set(pa.projectId, { salaryAmount: pa.salaryAmount, role: pa.role })
    }
  }

  // ── 5. Core attendance calculations ──
  const eligibleDays = attendance.filter(a => ELIGIBLE_STATUSES.has(a.status)).length
  const leaveDays = attendance.filter(a => LEAVE_STATUSES.has(a.status)).length
  const absentDays = attendance.filter(a => a.status === 'A' || a.status === 'CD').length

  // ── 6. Project-level cost distribution ──
  // Filter daily project records to only billable statuses (includes CL/SL/EL)
  const billableProjects = dailyProjects.filter(dp => BILLABLE_STATUSES.has(dp.status))
  const totalBillableDays = billableProjects.length

  // Group daily project records by projectId
  const projectGroups: Record<string, number> = {}
  for (const rec of billableProjects) {
    projectGroups[rec.projectId] = (projectGroups[rec.projectId] || 0) + 1
  }

  // Fetch project details for all referenced projects
  const projectIds = Object.keys(projectGroups)
  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, code: true, name: true },
  })
  const projectMap = new Map(projects.map(p => [p.id, p]))

  // Calculate project salary shares
  // If project has a specific salary in assignment, use it; otherwise use weight-based
  let totalSalaryFromProjects = 0
  const projectSalaryShares: {
    projectId: string
    days: number
    projectSalary: number | null
    projectDailyRate: number
    salaryShare: number
    designation: string | null
  }[] = []

  for (const [projectId, days] of Object.entries(projectGroups)) {
    const assignment = assignmentMap.get(projectId)
    let projectDailyRate = 0
    let salaryShare = 0
    let projectSalary: number | null = null
    let designation: string | null = null

    if (assignment && assignment.salaryAmount > 0) {
      // Project-specific salary from assignment
      projectSalary = assignment.salaryAmount
      designation = assignment.role
      projectDailyRate = round2(projectSalary / daysInMonth)
      salaryShare = round2(projectDailyRate * days)
    } else {
      // Fallback: will calculate after we know total monthly salary
      projectDailyRate = 0
      salaryShare = 0
    }

    projectSalaryShares.push({
      projectId,
      days,
      projectSalary,
      projectDailyRate,
      salaryShare,
      designation,
    })
    totalSalaryFromProjects += salaryShare
  }

  // Determine total monthly salary
  // If all projects have assignment salaries, total = sum of project salary shares
  // Otherwise, use employee.baseSalary
  const hasAnyProjectSalary = projectSalaryShares.some(p => p.projectSalary !== null)
  const hasAllProjectSalaries = projectSalaryShares.length > 0 && projectSalaryShares.every(p => p.projectSalary !== null)

  let monthlySalary: number
  if (hasAllProjectSalaries) {
    // All projects have specific salaries - total is the sum of actual worked shares
    monthlySalary = totalSalaryFromProjects
  } else if (hasAnyProjectSalary) {
    // Mixed: some have project salaries, some don't
    // Use baseSalary as fallback for the rest, distributed by weight
    monthlySalary = employee.baseSalary
  } else {
    // No project-specific salaries - use baseSalary
    monthlySalary = employee.baseSalary
  }

  // Fill in fallback salary shares for projects without assignment salaries
  const totalAssignedSalary = projectSalaryShares.reduce((sum, p) => sum + p.salaryShare, 0)
  const remainingSalary = monthlySalary - totalAssignedSalary
  const unassignedDays = projectSalaryShares.filter(p => p.projectSalary === null).reduce((sum, p) => sum + p.days, 0)

  for (const p of projectSalaryShares) {
    if (p.projectSalary === null && totalBillableDays > 0) {
      // Distribute remaining salary by weight
      const weight = unassignedDays > 0 ? p.days / unassignedDays : p.days / totalBillableDays
      p.salaryShare = round2(remainingSalary * weight)
      p.projectDailyRate = round2(p.salaryShare / p.days)
    }
  }

  // Recalculate total after filling in fallbacks
  monthlySalary = projectSalaryShares.reduce((sum, p) => sum + p.salaryShare, 0)
  if (monthlySalary === 0) {
    // No attendance at all - use baseSalary
    monthlySalary = employee.baseSalary
  }

  const dailyRate = round2(monthlySalary / daysInMonth)

  // ── 7. SC calculation ──
  const workingRatio = round2(eligibleDays / daysInMonth)
  const monthlySC = round2(monthlySalary * SC_RATE)
  const earnedSC = round2(monthlySC * workingRatio)
  const leaveDeduction = round2(dailyRate * leaveDays)
  const finalSC = round2(earnedSC - leaveDeduction)
  const scBalance = leaveDeduction

  const scComponents = {
    otherPayable: round2(finalSC * SC_COMPONENTS.otherPayable),
    earnedLeave:  round2(finalSC * SC_COMPONENTS.earnedLeave),
    sickLeave:    round2(finalSC * SC_COMPONENTS.sickLeave),
    casualLeave:  round2(finalSC * SC_COMPONENTS.casualLeave),
  }

  // ── 8. Project allocation with SC distribution ──
  const totalSalaryShares = projectSalaryShares.reduce((sum, p) => sum + p.salaryShare, 0)

  const projectAllocations: ProjectAllocation[] = projectSalaryShares.map(p => {
    const proj = projectMap.get(p.projectId)
    const weight = totalBillableDays > 0 ? p.days / totalBillableDays : 0
    const salaryWeight = totalSalaryShares > 0 ? p.salaryShare / totalSalaryShares : weight

    return {
      projectId: p.projectId,
      projectName: proj?.name || 'Unknown',
      projectCode: proj?.code || 'UNK',
      days: p.days,
      weight: round2(weight),
      weightPct: (weight * 100).toFixed(2) + '%',
      salaryShare: p.salaryShare,
      projectDailyRate: p.projectDailyRate,
      projectSalary: p.projectSalary,
      designation: p.designation,
      scShare: round2(finalSC * salaryWeight),
      scBalance: round2(scBalance * salaryWeight),
      scOtherPayable: round2(scComponents.otherPayable * salaryWeight),
      scEarnedLeave: round2(scComponents.earnedLeave * salaryWeight),
      scSickLeave: round2(scComponents.sickLeave * salaryWeight),
      scCasualLeave: round2(scComponents.casualLeave * salaryWeight),
    }
  })

  // ── 9. Persist to ledger (upsert for idempotency) ──
  // First, delete any existing ledger entries for this employee/month that are no longer valid
  const existingLedger = await db.projectCostLedger.findMany({
    where: { employeeId, month: monthStart },
    select: { projectId: true },
  })
  const currentProjectIds = new Set(projectAllocations.map(pa => pa.projectId))
  for (const existing of existingLedger) {
    if (!currentProjectIds.has(existing.projectId)) {
      await db.projectCostLedger.deleteMany({
        where: { employeeId, projectId: existing.projectId, month: monthStart },
      })
    }
  }

  for (const entry of projectAllocations) {
    await db.projectCostLedger.upsert({
      where: {
        employeeId_projectId_month: {
          employeeId,
          projectId: entry.projectId,
          month: monthStart,
        },
      },
      create: {
        employeeId,
        projectId: entry.projectId,
        month: monthStart,
        totalDays: entry.days,
        salaryShare: entry.salaryShare,
        scShare: entry.scShare,
        scBalance: entry.scBalance,
        scOtherPayable: entry.scOtherPayable,
        scEarnedLeave: entry.scEarnedLeave,
        scSickLeave: entry.scSickLeave,
        scCasualLeave: entry.scCasualLeave,
      },
      update: {
        totalDays: entry.days,
        salaryShare: entry.salaryShare,
        scShare: entry.scShare,
        scBalance: entry.scBalance,
        scOtherPayable: entry.scOtherPayable,
        scEarnedLeave: entry.scEarnedLeave,
        scSickLeave: entry.scSickLeave,
        scCasualLeave: entry.scCasualLeave,
      },
    })
  }

  // ── 10. Allowances ──
  const empAllowances = await db.employeeAllowance.findMany({
    where: {
      employeeId,
      isActive: true,
      effectiveDate: { lte: monthEnd },
    },
    include: { allowance: true },
  })

  const allowanceDetails: { allowanceId: string; name: string; amount: number; isTaxable: boolean }[] = []
  let totalAllowances = 0
  let taxFreeAllowances = 0

  for (const ea of empAllowances) {
    const amount = ea.customValue !== null && ea.customValue !== undefined
      ? ea.customValue
      : ea.allowance.value

    let finalAmount = amount
    if (ea.allowance.allowanceType === 'percentage') {
      finalAmount = (monthlySalary * amount) / 100
    }

    allowanceDetails.push({
      allowanceId: ea.allowanceId,
      name: ea.allowance.name,
      amount: round2(finalAmount),
      isTaxable: ea.allowance.isTaxable,
    })

    totalAllowances += finalAmount
    if (!ea.allowance.isTaxable) {
      taxFreeAllowances += finalAmount
    }
  }

  totalAllowances = round2(totalAllowances)
  taxFreeAllowances = round2(taxFreeAllowances)

  // ── 11. Gross Salary ──
  const grossSalary = round2(monthlySalary + totalAllowances)

  // ── 12. EOBI ──
  const EOBI_MIN_WAGE_CAP = 32000
  const eobiBase = Math.min(monthlySalary, EOBI_MIN_WAGE_CAP)
  const eobiEmployee = round2(eobiBase * 0.01)
  const eobiEmployer = round2(eobiBase * 0.05)

  // ── 13. Provident Fund ──
  const pfEmployee = round2(monthlySalary * 0.0833)
  const pfEmployer = round2(monthlySalary * 0.0833)

  // ── 14. Income Tax ──
  const taxSlabs = await db.taxSlab.findMany({
    where: { isActive: true },
    orderBy: { slabOrder: 'asc' },
  })

  let incomeTax = 0
  const taxBreakdown = {
    taxableIncome: 0,
    taxSlab: '',
    fixedTax: 0,
    variableTax: 0,
    monthlyTax: 0,
  }

  if (taxSlabs.length > 0 && grossSalary > 0) {
    const annualTaxableIncome = (grossSalary - taxFreeAllowances) * 12
    taxBreakdown.taxableIncome = annualTaxableIncome

    let applicableSlab = taxSlabs[taxSlabs.length - 1]
    for (const slab of taxSlabs) {
      if (annualTaxableIncome >= slab.minAmount && (slab.maxAmount === null || annualTaxableIncome <= slab.maxAmount)) {
        applicableSlab = slab
        break
      }
    }

    taxBreakdown.taxSlab = `PKR ${applicableSlab.minAmount.toLocaleString()} - ${applicableSlab.maxAmount ? 'PKR ' + applicableSlab.maxAmount.toLocaleString() : 'Above'}`
    taxBreakdown.fixedTax = applicableSlab.fixedAmount

    const variableTax = (annualTaxableIncome - applicableSlab.minAmount) * applicableSlab.rate / 100
    taxBreakdown.variableTax = round2(variableTax)

    const annualTax = applicableSlab.fixedAmount + variableTax
    incomeTax = round2(annualTax / 12)
    taxBreakdown.monthlyTax = incomeTax
  }

  // ── 15. Loan deduction ──
  const activeLoans = await db.loan.findMany({
    where: {
      employeeId,
      status: 'active',
      isDisbursed: true,
      startDate: { lte: monthEnd },
    },
  })
  const loanDeduction = round2(activeLoans.reduce((sum, loan) => sum + loan.monthlyDeduction, 0))

  // ── 16. Total Deductions ──
  const advanceDeduction = 0
  const otherDeductions = 0
  const totalDeductions = round2(incomeTax + eobiEmployee + pfEmployee + loanDeduction + advanceDeduction + otherDeductions)

  // ── 17. Net Pay ──
  const netPay = round2(grossSalary - totalDeductions)

  // ── 18. Gratuity ──
  const gratuity = round2(monthlySalary * 0.0833)

  // ── 19. Return summary ──
  return {
    employee: {
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode,
      baseSalary: employee.baseSalary,
    },
    month: `${year}-${String(mon).padStart(2, '0')}`,
    daysInMonth,
    eligibleDays,
    leaveDays,
    absentDays,
    monthlySalary,
    dailyRate,
    workingRatio,
    monthlySC,
    earnedSC,
    leaveDeduction,
    finalSC,
    scBalance,
    scComponents,
    projectAllocations,
    totalBillableDays,
    allowances: {
      details: allowanceDetails,
      totalAllowances,
      taxFreeAllowances,
    },
    deductions: {
      incomeTax,
      eobiEmployee,
      eobiEmployer,
      pfEmployee,
      pfEmployer,
      loanDeduction,
      advanceDeduction,
      otherDeductions,
      totalDeductions,
    },
    grossSalary,
    netPay,
    gratuity,
    taxBreakdown,
    scBreakdown: {
      monthlySC,
      workingRatio,
      earnedSC,
      leaveDeduction,
      finalSC,
    },
  }
}
