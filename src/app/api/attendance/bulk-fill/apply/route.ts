import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BILLABLE_STATUSES = new Set(['P', 'W', 'H', 'WH', 'WW', 'T', 'CO'])

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

// ---------------------------------------------------------------------------
// POST /api/attendance/bulk-fill/apply
// Apply a project to all unassigned billable days in a date range
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const { employeeId, startDate, endDate, projectId } = await request.json()

    if (!employeeId || !startDate || !endDate || !projectId) {
      return NextResponse.json(
        { error: 'employeeId, startDate, endDate, and projectId are required' },
        { status: 400 },
      )
    }

    // Validate project exists
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: `Project not found: ${projectId}` }, { status: 404 })
    }

    // Validate employee exists
    const employee = await db.employee.findUnique({ where: { id: employeeId } })
    if (!employee) {
      return NextResponse.json({ error: `Employee not found: ${employeeId}` }, { status: 404 })
    }

    const start = parseDate(startDate)
    const end = parseDate(endDate)
    end.setUTCHours(23, 59, 59, 999)

    // Get all daily project records in range to know which dates are already linked
    const linkedProjects = await db.attendanceDailyProject.findMany({
      where: {
        employeeId,
        date: { gte: start, lte: end },
      },
      select: { date: true },
    })

    const linkedDates = new Set(
      linkedProjects.map(dp => new Date(dp.date).toISOString().slice(0, 10))
    )

    // Find billable attendance records without project
    const targetDays = await db.attendance.findMany({
      where: {
        employeeId,
        date: { gte: start, lte: end },
        status: { in: Array.from(BILLABLE_STATUSES) },
      },
      select: { date: true, status: true },
      orderBy: { date: 'asc' },
    })

    // Filter to only unassigned days
    const unassigned = targetDays.filter(rec => {
      const dateStr = new Date(rec.date).toISOString().slice(0, 10)
      return !linkedDates.has(dateStr)
    })

    if (unassigned.length === 0) {
      return NextResponse.json({ filled: 0, message: 'No unassigned billable days found in the specified range' })
    }

    // Create AttendanceDailyProject records for all unassigned days
    // Using createMany with skipDuplicates for idempotency
    await db.attendanceDailyProject.createMany({
      data: unassigned.map(d => ({
        employeeId,
        date: new Date(d.date),
        projectId,
        status: d.status,
      })),
      skipDuplicates: true,
    })

    // Also update the Attendance.projectId for backward compatibility
    for (const d of unassigned) {
      await db.attendance.updateMany({
        where: {
          employeeId,
          date: new Date(d.date),
        },
        data: { projectId },
      })
    }

    return NextResponse.json({
      filled: unassigned.length,
      dates: unassigned.map(d => ({
        date: new Date(d.date).toISOString().slice(0, 10),
        status: d.status,
        projectId,
        projectName: project.name,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
