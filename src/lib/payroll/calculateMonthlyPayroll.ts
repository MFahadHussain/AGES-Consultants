// ============================================================================
// Payroll Calculation Engine v2.0 — YTD Tax + Multi-Project Allocation
// ============================================================================
// CRITICAL RULES:
//   1. Earned Salary = (Monthly Base Salary / Calendar Days) × Payable Days
//      Payable Days = Calendar Days − Absent Days
//   2. Multi-project allocation: total MUST equal Earned Salary — NO duplication
//      Projects are cost centers only, NOT salary sources
//   3. Tax Engine uses YTD + Rolling Projection (Pakistan FBR 2024-25)
//   4. Social contributions (EOBI, ESSI, Gratuity, PF) are conditional on flags
//   5. Fiscal year runs July to June (Pakistan)
//   6. All PKR amounts must be integers (Math.round)
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

// ── Pakistan FBR Tax Slabs 2024-25 (Salaried Persons) ──────────────────────

interface TaxSlabEntry {
  min: number
  max: number | null // null = no upper limit
  fixedTax: number
  rate: number // percentage on amount exceeding min
}

const FBR_TAX_SLABS_2024_25: TaxSlabEntry[] = [
  { min: 0,      max: 600000,   fixedTax: 0,      rate: 0   },
  { min: 600001, max: 1200000,  fixedTax: 0,      rate: 5   },
  { min: 1200001, max: 2200000, fixedTax: 60000,  rate: 15  },
  { min: 2200001, max: 3200000, fixedTax: 210000, rate: 25  },
  { min: 3200001, max: 4100000, fixedTax: 460000, rate: 30  },
  { min: 4100001, max: null,    fixedTax: 730000, rate: 35  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function roundPKR(n: number): number {
  return Math.round(n)
}

/** Get the number of calendar days in a month */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Get Pakistan fiscal year boundaries for a given date.
 * Pakistan FY runs July to June: FY 2024-25 = Jul 2024 to Jun 2025.
 */
function getFiscalYear(date: Date): { fyStart: Date; fyEnd: Date; fyLabel: string } {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1 // 1-indexed

  // If month is July (7) or later, FY starts this year; otherwise previous year
  const fyStartYear = month >= 7 ? year : year - 1
  const fyStart = new Date(Date.UTC(fyStartYear, 6, 1)) // July 1
  const fyEnd = new Date(Date.UTC(fyStartYear + 1, 5, 30, 23, 59, 59, 999)) // June 30

  return {
    fyStart,
    fyEnd,
    fyLabel: `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`,
  }
}

/**
 * Calculate annual tax using Pakistan FBR slabs.
 */
function calculateFbrTax(annualIncome: number): { annualTax: number; slab: TaxSlabEntry; variableTax: number } {
  let applicableSlab = FBR_TAX_SLABS_2024_25[0]
  for (const slab of FBR_TAX_SLABS_2024_25) {
    if (annualIncome >= slab.min && (slab.max === null || annualIncome <= slab.max)) {
      applicableSlab = slab
      break
    }
  }

  const excessAmount = annualIncome - applicableSlab.min
  const variableTax = (excessAmount * applicableSlab.rate) / 100
  const annualTax = applicableSlab.fixedTax + variableTax

  return { annualTax, slab: applicableSlab, variableTax }
}

/**
 * Format tax slab description for display.
 */
function formatTaxSlab(slab: TaxSlabEntry): string {
  const min = `PKR ${slab.min.toLocaleString()}`
  const max = slab.max ? `PKR ${slab.max.toLocaleString()}` : 'Above'
  return `${min} - ${max}`
}

// ── Interfaces ─────────────────────────────────────────────────────────────

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
  calendarDays: number   // 28-31
  payableDays: number    // Calendar Days - Absent Days
  eligibleDays: number
  leaveDays: number
  absentDays: number
  monthlySalary: number  // Earned salary = (base / calendarDays) × payableDays
  dailyRate: number      // baseSalary / calendarDays
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
    essiEmployee: number
    essiEmployer: number
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
  employerCost: number
  taxBreakdown: {
    taxableIncome: number
    ytdIncome: number
    projectedAnnualIncome: number
    monthsWorkedYtd: number
    taxSlab: string
    fixedTax: number
    variableTax: number
    taxPaidYtd: number
  }
  scBreakdown: {
    monthlySC: number
    workingRatio: number
    earnedSC: number
    leaveDeduction: number
    finalSC: number
  }
}

// ── Main Calculation ───────────────────────────────────────────────────────

/**
 * Calculate the full monthly payroll for a single employee.
 *
 * FORMULAS:
 *   Earned Salary = (Monthly Base Salary / Calendar Days) × Payable Days
 *   Payable Days = Calendar Days − Absent Days
 *   Daily Rate = Monthly Base Salary / Calendar Days
 *
 *   Project Allocation:
 *     Weight = Days on Project / Total Billable Days
 *     Salary Share = Earned Salary × Weight
 *     (Total allocations MUST equal Earned Salary — NO duplication)
 *
 *   Tax Engine (YTD + Rolling Projection):
 *     1. YTD Income = Sum of PayrollBatchLine.grossSalary in current fiscal year
 *     2. Add current month's gross salary
 *     3. Months Worked YTD = Count of months with payroll + 1 (current)
 *     4. Projected Annual = (YTD / Months Worked YTD) × 12
 *     5. Apply FBR slabs on Projected Annual Income
 *     6. Monthly Tax = Annual Tax / 12
 *     7. Tax Paid YTD = Sum of incomeTax from previous months
 *     8. Current Month Tax = Monthly Tax (adjusted for YTD cumulative)
 *
 *   Social Contributions (conditional on employee flags):
 *     EOBI: Employee = Rs 370 (fixed), Employer = Rs 870 (fixed) — if eobiEnabled
 *     ESSI: Employer = 6% of earned salary, Employee = 0% (default) — if essiEnabled
 *     Gratuity: Basic Salary / 12 — if gratuityEnabled
 *     PF: Employee = 8.33% of basic, Employer = 8.33% of basic — if pfEnabled
 *
 *   Net Pay = Gross Salary - Income Tax - EOBI Employee - ESSI Employee - PF Employee
 *             - Loan Deduction - Advance Deduction - Other Deductions
 *   Employer Cost = EOBI Employer + ESSI Employer + PF Employer + Social Charges + Gratuity
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
  const calendarDays = getDaysInMonth(year, mon)

  // ── 2. Fetch all attendance records for this month ──
  const monthStart = new Date(Date.UTC(year, mon - 1, 1))
  const monthEnd = new Date(Date.UTC(year, mon - 1, calendarDays, 23, 59, 59, 999))

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

  // ── 4. Core attendance calculations ──
  const eligibleDays = attendance.filter(a => ELIGIBLE_STATUSES.has(a.status)).length
  const leaveDays = attendance.filter(a => LEAVE_STATUSES.has(a.status)).length
  const absentDays = attendance.filter(a => a.status === 'A' || a.status === 'CD').length

  // ── 5. Earned Salary Calculation (CRITICAL) ──
  // Payable Days = Calendar Days − Absent Days
  const payableDays = calendarDays - absentDays
  // Daily Rate = Monthly Base Salary / Calendar Days
  const dailyRate = roundPKR(employee.baseSalary / calendarDays)
  // Earned Salary = (Monthly Base Salary / Calendar Days) × Payable Days
  const earnedSalary = roundPKR((employee.baseSalary / calendarDays) * payableDays)

  // ── 6. Multi-Project Allocation (CRITICAL — NO duplication) ──
  const billableProjects = dailyProjects.filter(dp => BILLABLE_STATUSES.has(dp.status))
  const totalBillableDays = billableProjects.length

  // Group daily project records by projectId
  const projectGroups: Record<string, number> = {}
  for (const rec of billableProjects) {
    projectGroups[rec.projectId] = (projectGroups[rec.projectId] || 0) + 1
  }

  // Fetch project details
  const projectIds = Object.keys(projectGroups)
  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, code: true, name: true },
  })
  const projectMap = new Map(projects.map(p => [p.id, p]))

  // Fetch EmployeeProjectAssignments for designation info
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
  const assignmentMap = new Map<string, { salaryAmount: number; role: string | null }>()
  for (const pa of projectAssignments) {
    assignmentMap.set(pa.projectId, { salaryAmount: pa.salaryAmount, role: pa.role })
  }

  // Allocate earned salary across projects by weight
  // Weight = Days on Project / Total Billable Days
  // Salary Share = Earned Salary × Weight
  // Total MUST equal Earned Salary — NO duplication
  const projectAllocations: ProjectAllocation[] = []

  if (totalBillableDays > 0) {
    let allocatedTotal = 0

    for (const [pId, days] of Object.entries(projectGroups)) {
      const proj = projectMap.get(pId)
      const assignment = assignmentMap.get(pId)
      const weight = days / totalBillableDays
      const weightPct = (weight * 100).toFixed(2) + '%'

      // Salary share is earned salary × weight (projects are cost centers only)
      let salaryShare = roundPKR(earnedSalary * weight)
      allocatedTotal += salaryShare

      // Adjust last allocation to ensure total = earnedSalary (avoid rounding drift)
      const projectDailyRate = roundPKR(salaryShare / days)

      projectAllocations.push({
        projectId: pId,
        projectName: proj?.name || 'Unknown',
        projectCode: proj?.code || 'UNK',
        days,
        weight: roundPKR(weight * 10000) / 10000, // 4 decimal precision
        weightPct,
        salaryShare, // will be adjusted below for last item
        scShare: 0, // filled after SC calculation
        scBalance: 0,
        scOtherPayable: 0,
        scEarnedLeave: 0,
        scSickLeave: 0,
        scCasualLeave: 0,
        projectDailyRate,
        projectSalary: assignment?.salaryAmount || null,
        designation: assignment?.role || null,
      })
    }

    // Fix rounding: adjust the largest project allocation so total = earnedSalary
    if (projectAllocations.length > 0 && allocatedTotal !== earnedSalary) {
      const diff = earnedSalary - allocatedTotal
      // Find the project with the most days and adjust
      const maxProject = projectAllocations.reduce((max, p) => p.days > max.days ? p : max, projectAllocations[0])
      maxProject.salaryShare = roundPKR(maxProject.salaryShare + diff)
      maxProject.projectDailyRate = roundPKR(maxProject.salaryShare / maxProject.days)
    }
  }

  const monthlySalary = earnedSalary // This is the earned salary (not base salary)

  // ── 7. SC calculation ──
  const workingRatio = calendarDays > 0 ? roundPKR((eligibleDays / calendarDays) * 10000) / 10000 : 0
  const monthlySC = roundPKR(monthlySalary * SC_RATE)
  const earnedSC = roundPKR(monthlySC * workingRatio)
  const leaveDeduction = roundPKR(dailyRate * leaveDays)
  const finalSC = Math.max(0, roundPKR(earnedSC - leaveDeduction))
  const scBalance = leaveDeduction

  const scComponents = {
    otherPayable: roundPKR(finalSC * SC_COMPONENTS.otherPayable),
    earnedLeave:  roundPKR(finalSC * SC_COMPONENTS.earnedLeave),
    sickLeave:    roundPKR(finalSC * SC_COMPONENTS.sickLeave),
    casualLeave:  roundPKR(finalSC * SC_COMPONENTS.casualLeave),
  }

  // ── 8. Distribute SC across project allocations ──
  const totalSalaryShares = projectAllocations.reduce((sum, p) => sum + p.salaryShare, 0)

  for (const pa of projectAllocations) {
    const salaryWeight = totalSalaryShares > 0 ? pa.salaryShare / totalSalaryShares : pa.weight
    pa.scShare = roundPKR(finalSC * salaryWeight)
    pa.scBalance = roundPKR(scBalance * salaryWeight)
    pa.scOtherPayable = roundPKR(scComponents.otherPayable * salaryWeight)
    pa.scEarnedLeave = roundPKR(scComponents.earnedLeave * salaryWeight)
    pa.scSickLeave = roundPKR(scComponents.sickLeave * salaryWeight)
    pa.scCasualLeave = roundPKR(scComponents.casualLeave * salaryWeight)
  }

  // ── 9. Persist to ProjectCostLedger (upsert for idempotency) ──
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
      amount: roundPKR(finalAmount),
      isTaxable: ea.allowance.isTaxable,
    })

    totalAllowances += finalAmount
    if (!ea.allowance.isTaxable) {
      taxFreeAllowances += finalAmount
    }
  }

  totalAllowances = roundPKR(totalAllowances)
  taxFreeAllowances = roundPKR(taxFreeAllowances)

  // ── 11. Gross Salary ──
  const grossSalary = roundPKR(monthlySalary + totalAllowances)

  // ── 12. EOBI (only if eobiEnabled) ──
  let eobiEmployee = 0
  let eobiEmployer = 0
  if (employee.eobiEnabled === true) {
    // FIXED amounts as per Pakistan EOBI regulations
    eobiEmployee = 370   // Rs 370 FIXED employee contribution
    eobiEmployer = 870   // Rs 870 FIXED employer contribution
  }

  // ── 13. ESSI (only if essiEnabled) ──
  let essiEmployee = 0
  let essiEmployer = 0
  if (employee.essiEnabled === true) {
    // Employer = 6% of earned salary (Gross = monthlySalary = earned salary)
    essiEmployer = roundPKR(monthlySalary * 0.06)
    // Employee = 0% (default, configurable) — currently set to 0
    essiEmployee = roundPKR(monthlySalary * 0.00) // configurable but default 0
  }

  // ── 14. Provident Fund (only if pfEnabled) ──
  let pfEmployee = 0
  let pfEmployer = 0
  if (employee.pfEnabled === true) {
    // 8.33% of basic salary (earned salary = basic)
    pfEmployee = roundPKR(monthlySalary * 0.0833)
    pfEmployer = roundPKR(monthlySalary * 0.0833)
  }

  // ── 15. Income Tax — YTD + Rolling Projection (MOST CRITICAL) ──
  let incomeTax = 0
  const taxBreakdown = {
    taxableIncome: 0,
    ytdIncome: 0,
    projectedAnnualIncome: 0,
    monthsWorkedYtd: 0,
    taxSlab: '',
    fixedTax: 0,
    variableTax: 0,
    taxPaidYtd: 0,
  }

  if (employee.incomeTaxEnabled !== false && grossSalary > 0) {
    // Step 1: Determine fiscal year boundaries
    const fy = getFiscalYear(monthStart)

    // Step 2: Get YTD gross salary from previous payroll lines in this FY
    // (exclude current month's batch lines to avoid double-counting)
    const ytdLines = await db.payrollBatchLine.findMany({
      where: {
        employeeId,
        grossSalary: { gt: 0 },
      },
      include: { batch: { select: { period: true } } },
    })

    // Filter to current fiscal year periods
    let ytdIncome = 0
    let monthsWorkedYtd = 0
    const processedPeriods = new Set<string>()

    for (const line of ytdLines) {
      if (!line.batch?.period) continue
      const linePeriod = line.batch.period // "YYYY-MM"
      const [lineYear, lineMonth] = linePeriod.split('-').map(Number)
      const lineDate = new Date(Date.UTC(lineYear, lineMonth - 1, 1))

      // Check if within fiscal year
      if (lineDate >= fy.fyStart && lineDate <= fy.fyEnd) {
        // Skip current month to avoid double-counting
        if (linePeriod === `${year}-${String(mon).padStart(2, '0')}`) continue

        ytdIncome += line.grossSalary
        if (!processedPeriods.has(linePeriod)) {
          processedPeriods.add(linePeriod)
          monthsWorkedYtd++
        }
      }
    }

    // Step 3: Add current month's gross salary to YTD
    ytdIncome = roundPKR(ytdIncome + grossSalary)
    monthsWorkedYtd += 1 // +1 for current month

    // Step 4: Projected Annual Income = (YTD / Months Worked YTD) × 12
    const projectedAnnualIncome = monthsWorkedYtd > 0
      ? roundPKR((ytdIncome / monthsWorkedYtd) * 12)
      : roundPKR(grossSalary * 12)

    // Step 5: Taxable income for current month
    const taxableIncome = roundPKR(grossSalary - taxFreeAllowances)

    // Step 6: Apply FBR Tax Slabs on Projected Annual Income
    const { annualTax, slab, variableTax } = calculateFbrTax(projectedAnnualIncome)

    // Step 7: Monthly Tax = Annual Tax / 12
    const monthlyTax = roundPKR(annualTax / 12)

    // Step 8: Tax Paid YTD = Sum of incomeTax from previous months
    let taxPaidYtd = 0
    for (const line of ytdLines) {
      if (!line.batch?.period) continue
      const linePeriod = line.batch.period
      const [lineYear, lineMonth] = linePeriod.split('-').map(Number)
      const lineDate = new Date(Date.UTC(lineYear, lineMonth - 1, 1))

      if (lineDate >= fy.fyStart && lineDate <= fy.fyEnd) {
        if (linePeriod === `${year}-${String(mon).padStart(2, '0')}`) continue
        taxPaidYtd += line.incomeTax
      }
    }
    taxPaidYtd = roundPKR(taxPaidYtd)

    // Step 9: Current Month Tax = Monthly Tax (adjusted so YTD total equals correct cumulative)
    // The adjustment ensures: taxPaidYtd + currentMonthTax = monthlyTax * monthsWorkedYtd
    const expectedYtdTax = roundPKR(monthlyTax * monthsWorkedYtd)
    incomeTax = Math.max(0, roundPKR(expectedYtdTax - taxPaidYtd))

    // Populate tax breakdown
    taxBreakdown.taxableIncome = taxableIncome
    taxBreakdown.ytdIncome = ytdIncome
    taxBreakdown.projectedAnnualIncome = projectedAnnualIncome
    taxBreakdown.monthsWorkedYtd = monthsWorkedYtd
    taxBreakdown.taxSlab = formatTaxSlab(slab)
    taxBreakdown.fixedTax = slab.fixedTax
    taxBreakdown.variableTax = roundPKR(variableTax)
    taxBreakdown.taxPaidYtd = taxPaidYtd
  }

  // ── 16. Loan deduction ──
  const activeLoans = await db.loan.findMany({
    where: {
      employeeId,
      status: 'active',
      isDisbursed: true,
      startDate: { lte: monthEnd },
    },
  })
  const loanDeduction = roundPKR(activeLoans.reduce((sum, loan) => sum + loan.monthlyDeduction, 0))

  // ── 17. Total Deductions ──
  const advanceDeduction = 0
  const otherDeductions = 0
  const totalDeductions = roundPKR(
    incomeTax + eobiEmployee + essiEmployee + pfEmployee +
    loanDeduction + advanceDeduction + otherDeductions
  )

  // ── 18. Net Pay ──
  const netPay = roundPKR(grossSalary - totalDeductions)

  // ── 19. Gratuity (only if gratuityEnabled) ──
  const gratuity = employee.gratuityEnabled === true
    ? roundPKR(employee.baseSalary / 12)  // Monthly provision = Basic Salary / 12
    : 0

  // ── 20. Employer Cost ──
  const employerCost = roundPKR(
    eobiEmployer + essiEmployer + pfEmployer + finalSC + gratuity
  )

  // ── 21. Return summary ──
  return {
    employee: {
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode,
      baseSalary: employee.baseSalary,
    },
    month: `${year}-${String(mon).padStart(2, '0')}`,
    calendarDays,
    payableDays,
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
      essiEmployee,
      essiEmployer,
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
    employerCost,
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
