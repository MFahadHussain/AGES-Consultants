// ============================================================================
// Payroll Calculation Engine v3.1 — Multi-Contract + YTD Tax + SC Fix
// ============================================================================
// CRITICAL RULES:
//   1. This is a MULTI-CONTRACT payroll system, NOT multi-project allocation
//   2. Each contract (EmployeeProjectAssignment) has its OWN monthly salary
//   3. Earned Salary per Contract = (Contract Salary / Calendar Days) × Days Worked
//   4. Total Monthly Income = Sum of ALL contract earned salaries
//   5. Tax is applied on COMBINED income using YTD + Rolling Projection
//   6. Social contributions (EOBI, ESSI, Gratuity, PF) are conditional on flags
//   7. Fiscal year runs July to June (Pakistan)
//   8. All PKR amounts must be integers (Math.round)
//   9. SL, CL, EL are PAID (earn salary) but NOT SC eligible
//  10. SC = monthlySalary × (scEligDays / calendarDays) × 20%
//  11. SC is NOT deducted from net pay — goes to SC balance ledger
//  12. For multi-contract, SC is calculated per project using that project's salary
//
// EXAMPLE (Assad Ali Khan):
//   AGES HO contract:    Rs 265,000/mo, 10 days worked → 265,000/30 × 10 = 88,333
//   Jabba Dam contract:  Rs 388,000/mo,  8 days worked → 388,000/30 ×  8 = 103,467
//   Balakot HPP contract: Rs 451,576/mo, 12 days worked → 451,576/30 × 12 = 180,630
//   Total Monthly Earnings = 88,333 + 103,467 + 180,630 = 372,430
//   → Tax applied on COMBINED total (YTD + Rolling Projection)
// ============================================================================

import { db } from '@/lib/db'

// ── Status Classification ──────────────────────────────────────────────────

/** Statuses that earn salary (paid days) — includes leave days */
const PAID_STATUSES = new Set(['P', 'W', 'H', 'WH', 'T', 'CO', 'SL', 'EL', 'CL'])

/** Statuses eligible for salary + SC earning (legacy compat) */
const ELIGIBLE_STATUSES = new Set(['P', 'W', 'H', 'T', 'WH', 'WW', 'CL', 'SL', 'EL', 'HP'])

/** SC EARN statuses — leave days (SL, CL, EL) are PAID but do NOT earn SC */
const SC_EARN_STATUSES = new Set(['P', 'W', 'H', 'WH', 'T', 'CO'])

/** Leave statuses that are paid but NOT SC eligible */
const LEAVE_STATUSES_PAID = new Set(['CL', 'SL', 'EL'])

/** Leave statuses (legacy) */
const LEAVE_STATUSES = new Set(['CL', 'SL', 'EL'])

/** Paid non-billable statuses (salary continues, no project required) */
const PAID_NON_BILLABLE = new Set(['W', 'HP', 'CL', 'SL', 'EL', 'T'])

/** Statuses that are billable and require a project assignment */
const BILLABLE_STATUSES = new Set(['P', 'WH', 'WW', 'CO'])

// ── SC Rate Constants ──────────────────────────────────────────────────────

const SC_RATE = 0.20

const SC_COMPONENTS = {
  otherPayable: 0.0833, // 8.33% of SC (relative to 20%)
  earnedLeave:  0.0833, // 8.33%
  sickLeave:    0.0167, // 1.67%
  casualLeave:  0.0167, // 1.67%
}

// ── Pakistan FBR Tax Slabs 2025-26 (Salaried Persons) ──────────────────────

interface TaxSlabEntry {
  min: number
  max: number | null // null = no upper limit
  fixedTax: number
  rate: number // percentage on amount exceeding min
}

const FBR_TAX_SLABS_2025_26: TaxSlabEntry[] = [
  { min: 0,      max: 600000,   fixedTax: 0,      rate: 0   },
  { min: 600001, max: 1200000,  fixedTax: 0,      rate: 1   },
  { min: 1200001, max: 2200000, fixedTax: 6000,   rate: 11  },
  { min: 2200001, max: 3200000, fixedTax: 116000, rate: 23  },
  { min: 3200001, max: 4100000, fixedTax: 346000, rate: 30  },
  { min: 4100001, max: null,    fixedTax: 616000, rate: 35  },
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
  let applicableSlab = FBR_TAX_SLABS_2025_26[0]
  for (const slab of FBR_TAX_SLABS_2025_26) {
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

/** A single contract's earning breakdown */
export interface ContractEarning {
  assignmentId: string
  projectId: string
  projectName: string
  projectCode: string
  contractSalary: number   // The monthly salary from the assignment
  dailyRate: number        // contractSalary / calendarDays
  daysWorked: number       // Days actually worked on this project
  earnedSalary: number     // dailyRate × daysWorked
  absentDays: number       // Days absent attributable to this contract
  designation: string | null
  /** SC allocated to this contract */
  scShare: number
  scBalance: number
  scOtherPayable: number
  scEarnedLeave: number
  scSickLeave: number
  scCasualLeave: number
}

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

  // ── Multi-Contract Earnings ──
  contractEarnings: ContractEarning[]  // Per-contract breakdown
  totalContractEarnings: number        // Sum of all contract earned salaries

  monthlySalary: number  // Total earned salary (= totalContractEarnings)
  dailyRate: number      // Weighted average daily rate (for backward compat)
  workingRatio: number

  // ── SC ──
  monthlySC: number
  earnedSC: number
  leaveDeduction: number
  finalSC: number
  scBalance: number
  scEligDays: number       // SC eligible days (excludes SL, CL, EL)
  leaveDaysPaid: number   // Leave days paid in salary but NOT SC eligible
  attendanceRatio: number // scEligDays / calendarDays
  scBase: number          // monthlySalary × attendanceRatio
  scComponents: {
    otherPayable: number
    earnedLeave: number
    sickLeave: number
    casualLeave: number
  }
  /** Per-project SC breakdown for multi-contract employees */
  projectScDetails: {
    projectId: string
    projectName: string
    projectScEligDays: number
    projectRatio: number
    projectScBase: number
    projectSC: number
  }[]

  // ── Project Allocations (backward compat — maps from contractEarnings) ──
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
    monthlyTax: number
  }
  scBreakdown: {
    monthlySC: number
    workingRatio: number
    earnedSC: number
    leaveDeduction: number
    finalSC: number
    scEligDays: number
    leaveDaysPaid: number
    attendanceRatio: number
    scBase: number
    projectScDetails: {
      projectId: string
      projectName: string
      projectScEligDays: number
      projectRatio: number
      projectScBase: number
      projectSC: number
    }[]
  }
}

// ── Main Calculation ───────────────────────────────────────────────────────

/**
 * Calculate the full monthly payroll for a single employee using
 * the MULTI-CONTRACT method.
 *
 * ALGORITHM:
 *   Step 1: Fetch employee + active project assignments (contracts)
 *   Step 2: For each contract, calculate:
 *     - Daily Rate = Contract Salary / Calendar Days
 *     - Days Worked = attendance records linked to this project
 *     - Earned Salary = Daily Rate × Days Worked
 *   Step 3: Total Monthly Earnings = Sum of all contract earned salaries
 *   Step 4: If NO contracts, fall back to single-salary method:
 *     - Earned = (Base Salary / Calendar Days) × Payable Days
 *   Step 5: Apply YTD + Rolling Projection Tax on COMBINED income
 *   Step 6: Apply conditional deductions (EOBI, ESSI, Gratuity, PF)
 *   Step 7: Net Pay = Gross - Total Deductions
 *
 * CRITICAL: ALWAYS combine all income first, THEN apply tax.
 *           NEVER calculate tax per-contract.
 */
export async function calculateMonthlyPayroll(
  employeeId: string,
  month: Date // Pass the 1st of the target month
): Promise<PayrollResult> {
  // ── 1. Fetch employee ──
  const employee = await db.employee.findUniqueOrThrow({
    where: { id: employeeId },
  })

  const year = month.getUTCFullYear()
  const mon = month.getUTCMonth() + 1 // 1-indexed
  const calendarDays = getDaysInMonth(year, mon)
  const monthStart = new Date(Date.UTC(year, mon - 1, 1))
  const monthEnd = new Date(Date.UTC(year, mon - 1, calendarDays, 23, 59, 59, 999))

  // ── 2. Fetch all attendance records for this month ──
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
  const payableDays = calendarDays - absentDays

  // FIX 1: Separate paid days and SC-eligible days
  // SL, CL, EL are PAID (employee gets salary) but NOT SC eligible
  const paidDaysCount = attendance.filter(a => PAID_STATUSES.has(a.status)).length
  const scEligDays = attendance.filter(a => SC_EARN_STATUSES.has(a.status)).length
  const leaveDaysPaid = attendance.filter(a => LEAVE_STATUSES_PAID.has(a.status)).length

  // ── 5. Fetch active project assignments (contracts) ──
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
      id: true,
      projectId: true,
      salaryAmount: true,
      role: true,
      project: { select: { id: true, code: true, name: true } },
    },
  })

  // ── 6. MULTI-CONTRACT EARNINGS CALCULATION ──

  // Count days worked per project from AttendanceDailyProject
  const projectDaysMap: Record<string, number> = {}
  for (const dp of dailyProjects) {
    if (BILLABLE_STATUSES.has(dp.status)) {
      projectDaysMap[dp.projectId] = (projectDaysMap[dp.projectId] || 0) + 1
    }
  }

  // Also count paid non-billable days (leave, holiday, etc.) — these
  // contribute to earnings but are not project-specific.
  // We distribute these proportionally across contracts later.
  const paidNonBillableDays = attendance.filter(a => PAID_NON_BILLABLE.has(a.status)).length

  const contractEarnings: ContractEarning[] = []
  let totalContractEarnings = 0

  if (projectAssignments.length > 0) {
    // ── Multi-Contract Mode ──
    // Each assignment is a contract with its own salary

    for (const assignment of projectAssignments) {
      const contractSalary = assignment.salaryAmount || employee.baseSalary
      const dailyRate = roundPKR(contractSalary / calendarDays)
      const daysWorked = projectDaysMap[assignment.projectId] || 0
      const earnedSalary = roundPKR(dailyRate * daysWorked)

      contractEarnings.push({
        assignmentId: assignment.id,
        projectId: assignment.projectId,
        projectName: assignment.project?.name || 'Unknown',
        projectCode: assignment.project?.code || 'UNK',
        contractSalary,
        dailyRate,
        daysWorked,
        earnedSalary,
        absentDays: 0, // Will be distributed below
        designation: assignment.role || null,
        scShare: 0,
        scBalance: 0,
        scOtherPayable: 0,
        scEarnedLeave: 0,
        scSickLeave: 0,
        scCasualLeave: 0,
      })

      totalContractEarnings += earnedSalary
    }

    // Distribute global absent days across contracts proportionally
    if (absentDays > 0 && contractEarnings.length > 0) {
      const totalDaysWorked = contractEarnings.reduce((s, c) => s + c.daysWorked, 0)
      let remainingAbsents = absentDays

      for (let i = 0; i < contractEarnings.length; i++) {
        if (i === contractEarnings.length - 1) {
          contractEarnings[i].absentDays = remainingAbsents
        } else {
          const share = totalDaysWorked > 0
            ? Math.round(absentDays * (contractEarnings[i].daysWorked / totalDaysWorked))
            : Math.round(absentDays / contractEarnings.length)
          contractEarnings[i].absentDays = share
          remainingAbsents -= share
        }
      }
    }

    // Handle projects with attendance but NO assignment (orphan days)
    // These get paid at the employee's base salary rate
    const assignedProjectIds = new Set(projectAssignments.map(a => a.projectId))
    let orphanDaysTotal = 0

    for (const [pId, days] of Object.entries(projectDaysMap)) {
      if (!assignedProjectIds.has(pId)) {
        // Project has attendance but no contract — use base salary
        const fallbackDailyRate = roundPKR(employee.baseSalary / calendarDays)
        const earnedSalary = roundPKR(fallbackDailyRate * days)

        // Fetch project details
        const proj = await db.project.findUnique({
          where: { id: pId },
          select: { code: true, name: true },
        })

        contractEarnings.push({
          assignmentId: `FALLBACK-${pId}`,
          projectId: pId,
          projectName: proj?.name || 'Unknown',
          projectCode: proj?.code || 'UNK',
          contractSalary: employee.baseSalary,
          dailyRate: fallbackDailyRate,
          daysWorked: days,
          earnedSalary,
          absentDays: 0,
          designation: null,
          scShare: 0,
          scBalance: 0,
          scOtherPayable: 0,
          scEarnedLeave: 0,
          scSickLeave: 0,
          scCasualLeave: 0,
        })

        totalContractEarnings += earnedSalary
        orphanDaysTotal += days
      }
    }

    // Handle paid non-billable days (leave, holidays)
    // These are paid at a weighted average rate and distributed proportionally
    const totalBillableDaysInContracts = contractEarnings.reduce((s, c) => s + c.daysWorked, 0)
    if (paidNonBillableDays > 0 && totalContractEarnings > 0) {
      const avgDailyRate = totalBillableDaysInContracts > 0
        ? roundPKR(totalContractEarnings / totalBillableDaysInContracts)
        : roundPKR(employee.baseSalary / calendarDays)

      // Add non-billable pay to each contract proportionally
      const nonBillablePay = roundPKR(avgDailyRate * paidNonBillableDays)
      // Distribute proportionally by days worked
      const totalBillableDays = contractEarnings.reduce((s, c) => s + c.daysWorked, 0)

      if (totalBillableDays > 0) {
        let distributedPay = 0
        for (let i = 0; i < contractEarnings.length; i++) {
          const share = roundPKR(nonBillablePay * (contractEarnings[i].daysWorked / totalBillableDays))
          contractEarnings[i].earnedSalary += share
          distributedPay += share
        }
        // Fix rounding on last item
        if (contractEarnings.length > 0) {
          const diff = nonBillablePay - distributedPay
          contractEarnings[contractEarnings.length - 1].earnedSalary += diff
        }
        totalContractEarnings += nonBillablePay
      }
    }

  } else {
    // ── Single-Salary Mode (no project assignments) ──
    // Fall back to the original formula: (base / calendar) × payable
    const dailyRate = roundPKR(employee.baseSalary / calendarDays)
    const earnedSalary = roundPKR((employee.baseSalary / calendarDays) * payableDays)

    // If there ARE daily project records, create contract earnings per project
    if (Object.keys(projectDaysMap).length > 0) {
      // Has projects but no assignments — use base salary
      const projectIds = Object.keys(projectDaysMap)
      const projects = await db.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, code: true, name: true },
      })
      const projectMap = new Map(projects.map(p => [p.id, p]))

      let allocatedTotal = 0
      const totalBillableDaysCount = Object.values(projectDaysMap).reduce((s, v) => s + v, 0)

      for (const [pId, days] of Object.entries(projectDaysMap)) {
        const weight = totalBillableDaysCount > 0 ? days / totalBillableDaysCount : 0
        const salaryShare = roundPKR(earnedSalary * weight)
        allocatedTotal += salaryShare

        contractEarnings.push({
          assignmentId: `FALLBACK-${pId}`,
          projectId: pId,
          projectName: projectMap.get(pId)?.name || 'Unknown',
          projectCode: projectMap.get(pId)?.code || 'UNK',
          contractSalary: employee.baseSalary,
          dailyRate,
          daysWorked: days,
          earnedSalary: salaryShare,
          absentDays: 0,
          designation: null,
          scShare: 0,
          scBalance: 0,
          scOtherPayable: 0,
          scEarnedLeave: 0,
          scSickLeave: 0,
          scCasualLeave: 0,
        })
      }

      // Fix rounding: adjust largest so total = earnedSalary
      if (contractEarnings.length > 0 && allocatedTotal !== earnedSalary) {
        const diff = earnedSalary - allocatedTotal
        const maxEarning = contractEarnings.reduce((max, c) => c.daysWorked > max.daysWorked ? c : max, contractEarnings[0])
        maxEarning.earnedSalary = roundPKR(maxEarning.earnedSalary + diff)
      }

      totalContractEarnings = earnedSalary
    } else {
      // No projects at all — simple single salary
      contractEarnings.push({
        assignmentId: 'SINGLE-SALARY',
        projectId: employee.defaultProjectId || 'NO-PROJECT',
        projectName: 'Default',
        projectCode: 'DEF',
        contractSalary: employee.baseSalary,
        dailyRate,
        daysWorked: payableDays,
        earnedSalary,
        absentDays,
        designation: employee.designation,
        scShare: 0,
        scBalance: 0,
        scOtherPayable: 0,
        scEarnedLeave: 0,
        scSickLeave: 0,
        scCasualLeave: 0,
      })
      totalContractEarnings = earnedSalary
    }
  }

  const monthlySalary = totalContractEarnings
  const totalBillableDays = contractEarnings.reduce((s, c) => s + c.daysWorked, 0)

  // Weighted average daily rate (for backward compat)
  const dailyRate = totalBillableDays > 0
    ? roundPKR(totalContractEarnings / totalBillableDays)
    : roundPKR(employee.baseSalary / calendarDays)

  // ── 7. SC Calculation (FIX 1 + FIX 2) ──
  // FIX 1: SL, CL, EL are PAID but NOT SC eligible
  // FIX 2: SC = monthlySalary × (scEligDays / calendarDays) × 20%
  //         No leave deduction from SC — leave days already excluded from ratio

  const attendanceRatio = calendarDays > 0 ? scEligDays / calendarDays : 0
  const monthlySC = roundPKR(monthlySalary * SC_RATE) // Full 20% of salary (for reference)

  let finalSC = 0
  let scBase = 0
  const projectScDetails: {
    projectId: string
    projectName: string
    projectScEligDays: number
    projectRatio: number
    projectScBase: number
    projectSC: number
  }[] = []

  if (projectAssignments.length > 0) {
    // ── Multi-Contract SC: calculated per project using that project's monthly salary ──

    // Count SC eligible billable days per project from AttendanceDailyProject
    const projectScEligMap: Record<string, number> = {}
    for (const dp of dailyProjects) {
      if (SC_EARN_STATUSES.has(dp.status)) {
        projectScEligMap[dp.projectId] = (projectScEligMap[dp.projectId] || 0) + 1
      }
    }

    // Count global non-billable SC eligible days (W, H, T, etc. — no project link)
    const totalBillableScDays = Object.values(projectScEligMap).reduce((s, v) => s + v, 0)
    const nonBillableScDays = Math.max(0, scEligDays - totalBillableScDays)

    for (const assignment of projectAssignments) {
      const contractSalary = assignment.salaryAmount || employee.baseSalary
      const projectBillableScDays = projectScEligMap[assignment.projectId] || 0

      // Distribute non-billable SC days proportionally across projects
      const projectNonBillableScShare = totalBillableScDays > 0
        ? (nonBillableScDays * projectBillableScDays) / totalBillableScDays
        : nonBillableScDays / projectAssignments.length

      const projectScEligDaysVal = projectBillableScDays + projectNonBillableScShare
      const projectRatio = calendarDays > 0 ? projectScEligDaysVal / calendarDays : 0
      const projectScBaseVal = roundPKR(contractSalary * projectRatio)
      const projectSCVal = roundPKR(projectScBaseVal * SC_RATE)

      projectScDetails.push({
        projectId: assignment.projectId,
        projectName: assignment.project?.name || 'Unknown',
        projectScEligDays: Math.round(projectScEligDaysVal),
        projectRatio: Math.round(projectRatio * 10000) / 10000,
        projectScBase: projectScBaseVal,
        projectSC: projectSCVal,
      })

      finalSC += projectSCVal
    }

    // Handle orphan projects (attendance with no assignment) for SC
    const assignedProjectIds = new Set(projectAssignments.map(a => a.projectId))
    for (const [pId, billableScDays] of Object.entries(projectScEligMap)) {
      if (!assignedProjectIds.has(pId)) {
        const fallbackSalary = employee.baseSalary
        const projectRatio = calendarDays > 0 ? billableScDays / calendarDays : 0
        const projectScBaseVal = roundPKR(fallbackSalary * projectRatio)
        const projectSCVal = roundPKR(projectScBaseVal * SC_RATE)

        const proj = await db.project.findUnique({ where: { id: pId }, select: { name: true } })

        projectScDetails.push({
          projectId: pId,
          projectName: proj?.name || 'Unknown',
          projectScEligDays: billableScDays,
          projectRatio: Math.round(projectRatio * 10000) / 10000,
          projectScBase: projectScBaseVal,
          projectSC: projectSCVal,
        })

        finalSC += projectSCVal
      }
    }

    scBase = projectScDetails.reduce((s, p) => s + p.projectScBase, 0)

  } else {
    // ── Single-Salary SC: global attendance ratio ──
    scBase = roundPKR(monthlySalary * attendanceRatio)
    finalSC = roundPKR(scBase * SC_RATE)
  }

  // SC is NOT deducted from net pay — goes to SC balance ledger
  const earnedSC = finalSC  // backward compat alias
  const leaveDeduction = 0  // No longer deducted — leave already excluded from ratio
  const scBalance = finalSC // Amount added to SC balance ledger this month
  const workingRatio = attendanceRatio  // backward compat alias

  // SC Components applied to scBase (8.33/8.33/1.67/1.67 = 20% of scBase)
  const scComponents = {
    otherPayable: roundPKR(scBase * SC_COMPONENTS.otherPayable),
    earnedLeave:  roundPKR(scBase * SC_COMPONENTS.earnedLeave),
    sickLeave:    roundPKR(scBase * SC_COMPONENTS.sickLeave),
    casualLeave:  roundPKR(scBase * SC_COMPONENTS.casualLeave),
  }

  // ── 8. Distribute SC across contract earnings ──
  if (projectScDetails.length > 0) {
    // Multi-contract: each project has its own SC calculated above
    // Map project SC details to contract earnings
    const projectScMap = new Map(projectScDetails.map(p => [p.projectId, p]))

    for (const ce of contractEarnings) {
      const psc = projectScMap.get(ce.projectId)
      if (psc) {
        // Per-project SC components
        const pScBase = psc.projectScBase
        ce.scShare = psc.projectSC
        ce.scBalance = psc.projectSC   // Added to SC ledger
        ce.scOtherPayable = roundPKR(pScBase * SC_COMPONENTS.otherPayable)
        ce.scEarnedLeave = roundPKR(pScBase * SC_COMPONENTS.earnedLeave)
        ce.scSickLeave = roundPKR(pScBase * SC_COMPONENTS.sickLeave)
        ce.scCasualLeave = roundPKR(pScBase * SC_COMPONENTS.casualLeave)
      } else {
        // Fallback: distribute proportionally
        const salaryWeight = totalContractEarnings > 0 ? ce.earnedSalary / totalContractEarnings : 0
        ce.scShare = roundPKR(finalSC * salaryWeight)
        ce.scBalance = roundPKR(scBalance * salaryWeight)
        ce.scOtherPayable = roundPKR(scComponents.otherPayable * salaryWeight)
        ce.scEarnedLeave = roundPKR(scComponents.earnedLeave * salaryWeight)
        ce.scSickLeave = roundPKR(scComponents.sickLeave * salaryWeight)
        ce.scCasualLeave = roundPKR(scComponents.casualLeave * salaryWeight)
      }
    }
  } else {
    // Single-salary: distribute proportionally by earned salary
    const totalEarnedForScDist = contractEarnings.reduce((s, c) => s + c.earnedSalary, 0)
    for (const ce of contractEarnings) {
      const salaryWeight = totalEarnedForScDist > 0 ? ce.earnedSalary / totalEarnedForScDist : 0
      ce.scShare = roundPKR(finalSC * salaryWeight)
      ce.scBalance = roundPKR(scBalance * salaryWeight)
      ce.scOtherPayable = roundPKR(scComponents.otherPayable * salaryWeight)
      ce.scEarnedLeave = roundPKR(scComponents.earnedLeave * salaryWeight)
      ce.scSickLeave = roundPKR(scComponents.sickLeave * salaryWeight)
      ce.scCasualLeave = roundPKR(scComponents.casualLeave * salaryWeight)
    }
  }

  // ── 9. Build projectAllocations (backward compat) from contractEarnings ──
  const projectAllocations: ProjectAllocation[] = contractEarnings.map(ce => ({
    projectId: ce.projectId,
    projectName: ce.projectName,
    projectCode: ce.projectCode,
    days: ce.daysWorked,
    weight: totalBillableDays > 0 ? roundPKR((ce.daysWorked / totalBillableDays) * 10000) / 10000 : 0,
    weightPct: totalBillableDays > 0 ? Math.round((ce.daysWorked / totalBillableDays) * 100) + '%' : '0%',
    salaryShare: ce.earnedSalary,
    scShare: ce.scShare,
    scBalance: ce.scBalance,
    scOtherPayable: ce.scOtherPayable,
    scEarnedLeave: ce.scEarnedLeave,
    scSickLeave: ce.scSickLeave,
    scCasualLeave: ce.scCasualLeave,
    projectDailyRate: ce.dailyRate,
    projectSalary: ce.contractSalary,
    designation: ce.designation,
  }))

  // ── 10. Persist to ProjectCostLedger (upsert for idempotency) ──
  const existingLedger = await db.projectCostLedger.findMany({
    where: { employeeId, month: monthStart },
    select: { projectId: true },
  })
  const currentProjectIds = new Set(contractEarnings.map(ce => ce.projectId))
  for (const existing of existingLedger) {
    if (!currentProjectIds.has(existing.projectId)) {
      await db.projectCostLedger.deleteMany({
        where: { employeeId, projectId: existing.projectId, month: monthStart },
      })
    }
  }

  for (const entry of contractEarnings) {
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
        totalDays: entry.daysWorked,
        salaryShare: entry.earnedSalary,
        scShare: entry.scShare,
        scBalance: entry.scBalance,
        scOtherPayable: entry.scOtherPayable,
        scEarnedLeave: entry.scEarnedLeave,
        scSickLeave: entry.scSickLeave,
        scCasualLeave: entry.scCasualLeave,
      },
      update: {
        totalDays: entry.daysWorked,
        salaryShare: entry.earnedSalary,
        scShare: entry.scShare,
        scBalance: entry.scBalance,
        scOtherPayable: entry.scOtherPayable,
        scEarnedLeave: entry.scEarnedLeave,
        scSickLeave: entry.scSickLeave,
        scCasualLeave: entry.scCasualLeave,
      },
    })
  }

  // ── 11. Allowances ──
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

  // ── 12. Gross Salary = Total Contract Earnings + Allowances ──
  const grossSalary = roundPKR(monthlySalary + totalAllowances)

  // ── 13. EOBI (only if eobiEnabled) ──
  let eobiEmployee = 0
  let eobiEmployer = 0
  if (employee.eobiEnabled === true) {
    eobiEmployee = 370   // Rs 370 FIXED employee contribution
    eobiEmployer = 870   // Rs 870 FIXED employer contribution
  }

  // ── 14. ESSI (only if essiEnabled) ──
  let essiEmployee = 0
  let essiEmployer = 0
  if (employee.essiEnabled === true) {
    essiEmployer = roundPKR(monthlySalary * 0.06)  // Employer 6%
    essiEmployee = roundPKR(monthlySalary * 0.00)   // Employee 0% (default)
  }

  // ── 15. Provident Fund (only if pfEnabled) ──
  let pfEmployee = 0
  let pfEmployer = 0
  if (employee.pfEnabled === true) {
    pfEmployee = roundPKR(monthlySalary * 0.0833)
    pfEmployer = roundPKR(monthlySalary * 0.0833)
  }

  // ── 16. Income Tax — YTD + Rolling Projection on COMBINED income ──
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
    monthlyTax: 0,
  }

  if (employee.incomeTaxEnabled !== false && grossSalary > 0) {
    const fy = getFiscalYear(monthStart)

    // Get YTD gross salary from previous payroll lines in this FY
    const ytdLines = await db.payrollBatchLine.findMany({
      where: {
        employeeId,
        grossSalary: { gt: 0 },
      },
      include: { batch: { select: { period: true } } },
    })

    let ytdIncome = 0
    let monthsWorkedYtd = 0
    const processedPeriods = new Set<string>()

    for (const line of ytdLines) {
      if (!line.batch?.period) continue
      const linePeriod = line.batch.period
      const [lineYear, lineMonth] = linePeriod.split('-').map(Number)
      const lineDate = new Date(Date.UTC(lineYear, lineMonth - 1, 1))

      if (lineDate >= fy.fyStart && lineDate <= fy.fyEnd) {
        if (linePeriod === `${year}-${String(mon).padStart(2, '0')}`) continue
        ytdIncome += line.grossSalary
        if (!processedPeriods.has(linePeriod)) {
          processedPeriods.add(linePeriod)
          monthsWorkedYtd++
        }
      }
    }

    // Add current month's COMBINED gross salary
    ytdIncome = roundPKR(ytdIncome + grossSalary)
    monthsWorkedYtd += 1

    // Projected Annual = (YTD / Months Worked) × 12
    const projectedAnnualIncome = monthsWorkedYtd > 0
      ? roundPKR((ytdIncome / monthsWorkedYtd) * 12)
      : roundPKR(grossSalary * 12)

    const taxableIncome = roundPKR(grossSalary - taxFreeAllowances)

    // Apply FBR Tax Slabs on Projected Annual
    const { annualTax, slab, variableTax } = calculateFbrTax(projectedAnnualIncome)

    // Monthly Tax = Annual Tax / 12
    const monthlyTax = roundPKR(annualTax / 12)

    // Tax Paid YTD from previous months
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

    // Current Month Tax: adjusted so YTD cumulative matches expected
    const expectedYtdTax = roundPKR(monthlyTax * monthsWorkedYtd)
    incomeTax = Math.max(0, roundPKR(expectedYtdTax - taxPaidYtd))

    taxBreakdown.taxableIncome = taxableIncome
    taxBreakdown.ytdIncome = ytdIncome
    taxBreakdown.projectedAnnualIncome = projectedAnnualIncome
    taxBreakdown.monthsWorkedYtd = monthsWorkedYtd
    taxBreakdown.taxSlab = formatTaxSlab(slab)
    taxBreakdown.fixedTax = slab.fixedTax
    taxBreakdown.variableTax = roundPKR(variableTax)
    taxBreakdown.taxPaidYtd = taxPaidYtd
    taxBreakdown.monthlyTax = monthlyTax
  }

  // ── 17. Loan deduction ──
  const activeLoans = await db.loan.findMany({
    where: {
      employeeId,
      status: 'active',
      isDisbursed: true,
      startDate: { lte: monthEnd },
    },
  })
  const loanDeduction = roundPKR(activeLoans.reduce((sum, loan) => sum + loan.monthlyDeduction, 0))

  // ── 18. Total Deductions ──
  const advanceDeduction = 0
  const otherDeductions = 0
  const totalDeductions = roundPKR(
    incomeTax + eobiEmployee + essiEmployee + pfEmployee +
    loanDeduction + advanceDeduction + otherDeductions
  )

  // ── 19. Net Pay ──
  const netPay = roundPKR(grossSalary - totalDeductions)

  // ── 20. Gratuity (only if gratuityEnabled) ──
  const gratuity = employee.gratuityEnabled === true
    ? roundPKR(employee.baseSalary / 12)
    : 0

  // ── 21. Employer Cost ──
  const employerCost = roundPKR(
    eobiEmployer + essiEmployer + pfEmployer + finalSC + gratuity
  )

  // ── 22. Return ──
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
    contractEarnings,
    totalContractEarnings,
    monthlySalary,
    dailyRate,
    workingRatio,
    monthlySC,
    earnedSC,
    leaveDeduction,
    finalSC,
    scBalance,
    scEligDays,
    leaveDaysPaid,
    attendanceRatio,
    scBase,
    scComponents,
    projectScDetails,
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
      scEligDays,
      leaveDaysPaid,
      attendanceRatio,
      scBase,
      projectScDetails,
    },
  }
}
