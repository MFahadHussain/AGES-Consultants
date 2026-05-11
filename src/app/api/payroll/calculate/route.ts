import { NextResponse } from 'next/server'
import { calculateMonthlyPayroll } from '@/lib/payroll/calculateMonthlyPayroll'
import { validateBeforePayrollRun } from '@/lib/payroll/preRunValidation'

// ---------------------------------------------------------------------------
// POST /api/payroll/calculate
// Calculate monthly payroll for one or all employees
//
// Body:
//   { employeeId: string, month: string }          — single employee
//   { employeeIds: string[], month: string }        — multiple employees
//   { month: string, allEmployees?: boolean }       — all active employees
//   { employeeId: string, month: string, skipValidation?: boolean }
//
// month format: YYYY-MM (e.g., "2026-05")
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { employeeId, month: monthStr, allEmployees, skipValidation } = body

    if (!monthStr) {
      return NextResponse.json({ error: 'month is required (YYYY-MM format)' }, { status: 400 })
    }

    // Parse month
    const match = /^(\d{4})-(\d{2})$/.exec(monthStr)
    if (!match) {
      return NextResponse.json({ error: 'Invalid month format. Expected YYYY-MM' }, { status: 400 })
    }
    const year = Number(match[1])
    const mon = Number(match[2])
    const monthDate = new Date(Date.UTC(year, mon - 1, 1))

    // Helper: calculate payroll for a list of employee IDs
    const calculateForEmployees = async (empIds: string[]) => {
      const results: Record<string, unknown> = {}
      const errors: Record<string, string> = {}

      for (const id of empIds) {
        try {
          if (!skipValidation) {
            const validation = await validateBeforePayrollRun(id, monthDate)
            if (!validation.isValid) {
              errors[id] = validation.issues.join('; ')
              continue
            }
          }
          results[id] = await calculateMonthlyPayroll(id, monthDate)
        } catch (err) {
          errors[id] = err instanceof Error ? err.message : String(err)
        }
      }

      return NextResponse.json({
        month: monthStr,
        totalEmployees: empIds.length,
        successful: Object.keys(results).length,
        failed: Object.keys(errors).length,
        results,
        errors,
      })
    }

    if (employeeId) {
      // Single employee calculation
      if (!skipValidation) {
        const validation = await validateBeforePayrollRun(employeeId, monthDate)
        if (!validation.isValid) {
          return NextResponse.json(
            {
              error: 'Payroll pre-run validation failed',
              issues: validation.issues,
              unlinkedDays: validation.unlinkedDays,
            },
            { status: 422 },
          )
        }
      }

      const result = await calculateMonthlyPayroll(employeeId, monthDate)
      return NextResponse.json(result)
    }

    // Support employeeIds (array) for multi-employee calculation
    const { employeeIds } = body
    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      return calculateForEmployees(employeeIds as string[])
    }

    if (allEmployees) {
      // All employees — need to import db
      const { db } = await import('@/lib/db')
      const employees = await db.employee.findMany({
        where: { status: 'active' },
        select: { id: true, name: true, employeeCode: true },
      })

      return calculateForEmployees(employees.map(e => e.id))
    }

    return NextResponse.json(
      { error: 'Provide either employeeId, employeeIds[], or allEmployees=true' },
      { status: 400 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
