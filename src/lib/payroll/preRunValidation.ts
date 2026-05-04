// ============================================================================
// Payroll Pre-Run Validation
// ============================================================================
// Before running payroll, validate that all billable attendance days have
// a project assigned. Return a list of issues that must be resolved first.
// ============================================================================

import { db } from '@/lib/db'

const BILLABLE_STATUSES = new Set(['P', 'W', 'H', 'WH', 'WW', 'T', 'CO'])

export interface ValidationResult {
  isValid: boolean
  issues: string[]
  unlinkedDays: { date: string; status: string }[]
}

/**
 * Validate that an employee's attendance data is ready for payroll processing.
 * Checks for billable attendance days without a project link.
 */
export async function validateBeforePayrollRun(
  employeeId: string,
  month: Date // 1st of the target month
): Promise<ValidationResult> {
  const issues: string[] = []
  const unlinkedDays: { date: string; status: string }[] = []

  const year = month.getUTCFullYear()
  const mon = month.getUTCMonth() + 1
  const daysInMonth = new Date(year, mon, 0).getDate()
  const monthStart = new Date(Date.UTC(year, mon - 1, 1))
  const monthEnd = new Date(Date.UTC(year, mon - 1, daysInMonth, 23, 59, 59, 999))

  // Find billable attendance days with no project linked
  const allAttendance = await db.attendance.findMany({
    where: {
      employeeId,
      date: { gte: monthStart, lte: monthEnd },
      status: { in: Array.from(BILLABLE_STATUSES) },
    },
    select: { date: true, status: true, id: true },
  })

  // Get all daily project records for this month
  const dailyProjects = await db.attendanceDailyProject.findMany({
    where: {
      employeeId,
      date: { gte: monthStart, lte: monthEnd },
    },
    select: { date: true },
  })

  // Build a set of dates that have project links
  const linkedDates = new Set(
    dailyProjects.map(dp => dp.date.toISOString().slice(0, 10))
  )

  // Find unlinked billable days
  for (const att of allAttendance) {
    const dateStr = new Date(att.date).toISOString().slice(0, 10)
    if (!linkedDates.has(dateStr)) {
      unlinkedDays.push({ date: dateStr, status: att.status })
    }
  }

  if (unlinkedDays.length > 0) {
    issues.push(
      `${unlinkedDays.length} billable day(s) have no project assigned: ` +
      unlinkedDays.map(d => `${d.date} (${d.status})`).join(', ')
    )
  }

  // Check for employees with no attendance at all
  if (allAttendance.length === 0) {
    issues.push('No attendance records found for this employee in the specified month')
  }

  return {
    isValid: issues.length === 0,
    issues,
    unlinkedDays,
  }
}

/**
 * Validate all active employees for a given month.
 * Returns a map of employeeId → ValidationResult.
 */
export async function validateAllEmployeesForMonth(
  month: Date
): Promise<Record<string, ValidationResult>> {
  const employees = await db.employee.findMany({
    where: { status: 'active' },
    select: { id: true },
  })

  const results: Record<string, ValidationResult> = {}

  for (const emp of employees) {
    results[emp.id] = await validateBeforePayrollRun(emp.id, month)
  }

  return results
}
