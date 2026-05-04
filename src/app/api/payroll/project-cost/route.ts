import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// GET /api/payroll/project-cost?month=YYYY-MM
// Returns ProjectCostLedger entries for a given month
// ============================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const employeeId = searchParams.get('employeeId')
    const projectId = searchParams.get('projectId')

    if (!month) {
      return NextResponse.json({ error: 'month parameter is required (YYYY-MM format)' }, { status: 400 })
    }

    const match = /^(\d{4})-(\d{2})$/.exec(month)
    if (!match) {
      return NextResponse.json({ error: 'Invalid month format. Expected YYYY-MM' }, { status: 400 })
    }

    const year = Number(match[1])
    const mon = Number(match[2])
    const monthStart = new Date(Date.UTC(year, mon - 1, 1))

    const where: Record<string, unknown> = { month: monthStart }
    if (employeeId) where.employeeId = employeeId
    if (projectId) where.projectId = projectId

    const entries = await db.projectCostLedger.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, employeeCode: true, designation: true } },
        project: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ employeeId: 'asc' }, { projectId: 'asc' }],
    })

    // Group by employee
    const byEmployee: Record<string, {
      employee: { id: string; name: string; employeeCode: string; designation: string | null }
      projects: {
        projectId: string
        projectCode: string
        projectName: string
        days: number
        salaryShare: number
        scShare: number
        scBalance: number
        scOtherPayable: number
        scEarnedLeave: number
        scSickLeave: number
        scCasualLeave: number
      }[]
      totalSalary: number
      totalSC: number
      totalDays: number
    }> = {}

    for (const entry of entries) {
      const empId = entry.employeeId
      if (!byEmployee[empId]) {
        byEmployee[empId] = {
          employee: entry.employee,
          projects: [],
          totalSalary: 0,
          totalSC: 0,
          totalDays: 0,
        }
      }
      byEmployee[empId].projects.push({
        projectId: entry.projectId,
        projectCode: entry.project.code,
        projectName: entry.project.name,
        days: entry.totalDays,
        salaryShare: entry.salaryShare,
        scShare: entry.scShare,
        scBalance: entry.scBalance,
        scOtherPayable: entry.scOtherPayable,
        scEarnedLeave: entry.scEarnedLeave,
        scSickLeave: entry.scSickLeave,
        scCasualLeave: entry.scCasualLeave,
      })
      byEmployee[empId].totalSalary += entry.salaryShare
      byEmployee[empId].totalSC += entry.scShare
      byEmployee[empId].totalDays += entry.totalDays
    }

    // Group by project
    const byProject: Record<string, {
      projectId: string
      projectCode: string
      projectName: string
      employees: {
        employeeId: string
        employeeName: string
        employeeCode: string
        designation: string | null
        days: number
        salaryShare: number
        scShare: number
      }[]
      totalSalary: number
      totalSC: number
      totalDays: number
    }> = {}

    for (const entry of entries) {
      const projId = entry.projectId
      if (!byProject[projId]) {
        byProject[projId] = {
          projectId: projId,
          projectCode: entry.project.code,
          projectName: entry.project.name,
          employees: [],
          totalSalary: 0,
          totalSC: 0,
          totalDays: 0,
        }
      }
      byProject[projId].employees.push({
        employeeId: entry.employeeId,
        employeeName: entry.employee.name,
        employeeCode: entry.employee.employeeCode,
        designation: entry.employee.designation,
        days: entry.totalDays,
        salaryShare: entry.salaryShare,
        scShare: entry.scShare,
      })
      byProject[projId].totalSalary += entry.salaryShare
      byProject[projId].totalSC += entry.scShare
      byProject[projId].totalDays += entry.totalDays
    }

    return NextResponse.json({
      month,
      entries,
      byEmployee: Object.values(byEmployee),
      byProject: Object.values(byProject),
      grandTotal: {
        salary: entries.reduce((s, e) => s + e.salaryShare, 0),
        sc: entries.reduce((s, e) => s + e.scShare, 0),
        days: entries.reduce((s, e) => s + e.totalDays, 0),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
