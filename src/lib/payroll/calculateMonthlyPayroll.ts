// ============================================================================
// Payroll Calculation Engine — Attendance-Based Project Cost Distribution
// ============================================================================
// Core Business Rule: A project allocation only exists if attendance exists.
// No attendance record = no project cost = no SC allocation.
// The ProjectAssignment table is retained only as a lookup reference for the
// modal dropdown. It no longer drives payroll.
// ============================================================================

import { db } from '@/lib/db'

// ── Status Classification ──────────────────────────────────────────────────

/** Statuses eligible for salary + SC earning */
const ELIGIBLE_STATUSES = new Set(['P', 'W', 'H', 'T', 'WH', 'WW', 'CL', 'SL', 'EL'])

/** Leave statuses that trigger SC deduction */
const LEAVE_STATUSES = new Set(['CL', 'SL'])

/** Statuses that are billable and require a project assignment */
const BILLABLE_STATUSES = new Set(['P', 'W', 'H', 'WH', 'WW', 'T', 'CO'])

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
  monthlySalary: number
  dailyRate: number
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
  projectAllocations: {
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
  }[]
  totalBillableDays: number
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
 * Project Distribution:
 *   Days on Project X  = COUNT(AttendanceDailyProject WHERE projectId = X)
 *   Project Weight     = Days on X ÷ Total Billable Days
 *   Salary Share       = Monthly Salary × Weight
 *   SC Share           = Final SC × Weight
 *   SC Balance Share   = SC Balance × Weight
 */
export async function calculateMonthlyPayroll(
  employeeId: string,
  month: Date // Pass the 1st of the target month
): Promise<PayrollResult> {
  // ── 1. Fetch employee and salary ──
  const employee = await db.employee.findUniqueOrThrow({
    where: { id: employeeId },
  })

  const monthlySalary = employee.baseSalary
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

  // ── 4. Core calculations ──
  const eligibleDays = attendance.filter(a => ELIGIBLE_STATUSES.has(a.status)).length
  const leaveDays = attendance.filter(a => LEAVE_STATUSES.has(a.status)).length
  const absentDays = attendance.filter(a => a.status === 'A' || a.status === 'CD').length

  const dailyRate      = round2(monthlySalary / daysInMonth)
  const monthlySC      = round2(monthlySalary * SC_RATE)
  const workingRatio   = round2(eligibleDays / daysInMonth)
  const earnedSC       = round2(monthlySC * workingRatio)
  const leaveDeduction = round2(dailyRate * leaveDays)
  const finalSC        = round2(earnedSC - leaveDeduction)
  const scBalance      = leaveDeduction

  // ── 5. SC component breakdown ──
  const scComponents = {
    otherPayable: round2(finalSC * SC_COMPONENTS.otherPayable),
    earnedLeave:  round2(finalSC * SC_COMPONENTS.earnedLeave),
    sickLeave:    round2(finalSC * SC_COMPONENTS.sickLeave),
    casualLeave:  round2(finalSC * SC_COMPONENTS.casualLeave),
  }

  // ── 6. Project-level cost distribution ──
  const totalBillableDays = dailyProjects.length

  // Group daily project records by projectId
  const projectGroups: Record<string, number> = {}
  for (const rec of dailyProjects) {
    projectGroups[rec.projectId] = (projectGroups[rec.projectId] || 0) + 1
  }

  // Fetch project details for all referenced projects
  const projectIds = Object.keys(projectGroups)
  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, code: true, name: true },
  })
  const projectMap = new Map(projects.map(p => [p.id, p]))

  const projectAllocations = Object.entries(projectGroups).map(([projectId, days]) => {
    const weight = totalBillableDays > 0 ? days / totalBillableDays : 0
    const proj = projectMap.get(projectId)

    return {
      projectId,
      projectName: proj?.name || 'Unknown',
      projectCode: proj?.code || 'UNK',
      days,
      weight: round2(weight),
      weightPct: (weight * 100).toFixed(2) + '%',
      salaryShare:    round2(monthlySalary * weight),
      scShare:        round2(finalSC * weight),
      scBalance:      round2(scBalance * weight),
      scOtherPayable: round2(scComponents.otherPayable * weight),
      scEarnedLeave:  round2(scComponents.earnedLeave * weight),
      scSickLeave:    round2(scComponents.sickLeave * weight),
      scCasualLeave:  round2(scComponents.casualLeave * weight),
    }
  })

  // ── 7. Persist to ledger (upsert for idempotency) ──
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

  // ── 8. Return summary ──
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
  }
}
