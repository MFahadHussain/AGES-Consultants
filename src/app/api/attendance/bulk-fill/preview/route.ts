import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BILLABLE_STATUSES = new Set(['P', 'W', 'H', 'WH', 'WW', 'T', 'CO', 'CL', 'SL', 'EL', 'PW', 'TW', 'WHW', 'PH', 'TH', 'WHH'])

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

// ---------------------------------------------------------------------------
// POST /api/attendance/bulk-fill/preview
// Find billable attendance records with no project yet in the given date range
// ---------------------------------------------------------------------------

async function POST_HANDLER(request: Request) {
  try {
    const { employeeId, startDate, endDate } = await request.json()

    if (!employeeId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'employeeId, startDate, and endDate are required' },
        { status: 400 },
      )
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

    // Find billable attendance records
    const billableRecords = await db.attendance.findMany({
      where: {
        employeeId,
        date: { gte: start, lte: end },
        status: { in: Array.from(BILLABLE_STATUSES) },
      },
      select: { date: true, status: true },
      orderBy: { date: 'asc' },
    })

    // Filter to only unassigned days
    const unassigned = billableRecords.filter(rec => {
      const dateStr = new Date(rec.date).toISOString().slice(0, 10)
      return !linkedDates.has(dateStr)
    })

    return NextResponse.json({
      unassignedDays: unassigned.length,
      dates: unassigned.map(d => ({
        date: new Date(d.date).toISOString().slice(0, 10),
        status: d.status,
      })),
      totalBillableDays: billableRecords.length,
      alreadyAssignedDays: linkedDates.size,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withAudit('attendance', POST_HANDLER);
