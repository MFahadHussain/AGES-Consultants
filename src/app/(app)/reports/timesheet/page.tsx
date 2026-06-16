import { Metadata } from 'next'
import { db } from '@/lib/db'
import { TimesheetReportClient } from '@/components/modules/timesheet-report'

export const metadata: Metadata = {
  title: 'Monthly Staff Timesheet Report',
}

interface PageProps {
  searchParams: Promise<{
    employeeId?: string
    month?: string
    year?: string
    projectId?: string
  }>
}

export default async function TimesheetReportPage({ searchParams }: PageProps) {
  // 1. Resolve search parameters safely (async searchParams support in Next.js 15+)
  const params = await searchParams
  
  const now = new Date()
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear()
  const projectId = params.projectId || ''

  // 2. Fetch active projects to enable project-level filtering
  const projects = await db.project.findMany({
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  // 3. Fetch list of active employees for the searchable Combobox along with active assignments
  const employees = await db.employee.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      designation: true,
      projectAssignments: {
        where: { isActive: true },
        select: {
          projectId: true,
        },
      },
    },
    orderBy: {
      employeeCode: 'asc',
    },
  })

  // 4. Fallback to first active employee (optionally filtered by project if passed)
  let targetEmployeeId = params.employeeId
  if (!targetEmployeeId && employees.length > 0) {
    const filteredByProject = projectId
      ? employees.filter(e => e.projectAssignments?.some(pa => pa.projectId === projectId))
      : employees
    if (filteredByProject.length > 0) {
      targetEmployeeId = filteredByProject[0].id
    } else {
      targetEmployeeId = employees[0].id
    }
  }

  // 5. Fetch the selected employee details along with their assignments
  const selectedEmployee = targetEmployeeId
    ? await db.employee.findUnique({
        where: { id: targetEmployeeId },
        include: {
          projectAssignments: {
            where: { isActive: true },
            include: {
              project: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
      })
    : null

  // 6. Construct date boundaries
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // Day 0 of next month is the last day of this month
  const totalDays = endDate.getDate()

  // 7. Fetch daily attendance/activity records for the specific month/year
  const attendanceLogs = targetEmployeeId
    ? await db.attendance.findMany({
        where: {
          employeeId: targetEmployeeId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          dailyProject: {
            include: {
              project: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
        orderBy: {
          date: 'asc',
        },
      })
    : []

  // 8. Data Transformation: map database logs into high-performance 1-31 day map
  const attendanceMap: Record<number, {
    status: string
    projectName?: string
    projectCode?: string
    checkIn?: string
    checkOut?: string
    overtime?: number
    remarks?: string
  }> = {}

  // Initialize all days of the month with a default unrecorded state
  for (let d = 1; d <= totalDays; d++) {
    attendanceMap[d] = {
      status: '-',
      overtime: 0,
    }
  }

  // Map each attendance record to its calendar day index (1-31)
  for (const record of attendanceLogs) {
    const dayIndex = new Date(record.date).getDate()
    attendanceMap[dayIndex] = {
      status: record.status,
      projectName: record.dailyProject?.project?.name || undefined,
      projectCode: record.dailyProject?.project?.code || undefined,
      checkIn: record.checkInTime || undefined,
      checkOut: record.checkOutTime || undefined,
      overtime: record.overtimeHours || 0,
      remarks: record.remarks || undefined,
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1 print:hidden">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Reports Center</h1>
        <p className="text-xs text-muted-foreground">
          Analyze employee monthly attendance timesheet details, project allocation assignments, and printable landscape PDFs.
        </p>
      </div>

      <TimesheetReportClient
        employees={employees}
        projects={projects}
        selectedEmployee={selectedEmployee}
        month={month}
        year={year}
        projectId={projectId}
        attendanceMap={attendanceMap}
        totalDays={totalDays}
      />
    </div>
  )
}
