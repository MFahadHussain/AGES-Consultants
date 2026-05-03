import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

/** Valid attendance status codes */
const VALID_STATUSES = ['P', 'W', 'H', 'CL', 'SL', 'EL', 'CO', 'T', 'WH', 'CD', 'A'] as const
type AttendanceStatus = (typeof VALID_STATUSES)[number]

/** Status codes that earn Social Charges (SC) */
const SC_EARN_STATUSES: Set<string> = new Set(['P', 'W', 'H', 'T', 'WH'])

/** Status codes that deduct Social Charges (SC) */
const SC_DEDUCT_STATUSES: Set<string> = new Set(['CL', 'SL', 'EL', 'CO'])

/** Status codes that have no SC impact */
const SC_NO_IMPACT_STATUSES: Set<string> = new Set(['A', 'CD'])

/** Human-readable labels for status codes */
const STATUS_LABELS: Record<string, string> = {
  P: 'Present',
  W: 'Weekend Working',
  H: 'Holiday Working',
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  EL: 'Earned Leave',
  CO: 'Compensatory Off',
  T: 'Tour',
  WH: 'Work From Home',
  CD: 'Compensatory Deduction',
  A: 'Absent',
}

/** Determine the SC category for a given status */
function getScCategory(status: string): 'earn' | 'deduct' | 'none' {
  if (SC_EARN_STATUSES.has(status)) return 'earn'
  if (SC_DEDUCT_STATUSES.has(status)) return 'deduct'
  return 'none'
}

/** Validate that a status string is a recognised attendance code */
function isValidStatus(status: string): status is AttendanceStatus {
  return VALID_STATUSES.includes(status as AttendanceStatus)
}

/** Build a Date object at midnight UTC for a given YYYY-MM-DD string */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) throw new Error(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD`)
  return new Date(Date.UTC(year, month - 1, day))
}

/** Format a Date to YYYY-MM-DD */
function formatDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Get the number of days in a month (0-indexed month) */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Validate HH:mm time format */
function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time)
}

// ---------------------------------------------------------------------------
// GET /api/attendance
// ---------------------------------------------------------------------------
// Query params:
//   employeeId  – filter by employee
//   month       – YYYY-MM (returns all days for the employee in that month)
//   startDate   – YYYY-MM-DD (inclusive)
//   endDate     – YYYY-MM-DD (inclusive)
//   status      – filter by attendance status
//   projectId   – filter by project
//   page        – page number (default 1)
//   pageSize    – items per page (default 50)
//   view        – "summary" | "monthly" (default "summary")
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const employeeId = searchParams.get('employeeId')
    const month = searchParams.get('month')          // YYYY-MM
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const status = searchParams.get('status')
    const projectId = searchParams.get('projectId')
    const view = searchParams.get('view') || 'summary'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(500, Math.max(1, Number(searchParams.get('pageSize')) || 50))

    // ---- Build where clause ----
    const where: Record<string, unknown> = {}

    if (employeeId) where.employeeId = employeeId
    if (status) {
      if (!isValidStatus(status)) {
        return NextResponse.json(
          { error: `Invalid status "${status}". Valid values: ${VALID_STATUSES.join(', ')}` },
          { status: 400 },
        )
      }
      where.status = status
    }
    if (projectId) where.projectId = projectId

    // Date range filters
    const dateFilter: Record<string, unknown> = {}
    if (month) {
      // Parse YYYY-MM
      const match = /^(\d{4})-(\d{2})$/.exec(month)
      if (!match) {
        return NextResponse.json(
          { error: 'Invalid month format. Expected YYYY-MM' },
          { status: 400 },
        )
      }
      const year = Number(match[1])
      const mon = Number(match[2]) - 1 // JS months are 0-indexed
      const firstDay = new Date(Date.UTC(year, mon, 1))
      const lastDay = new Date(Date.UTC(year, mon, daysInMonth(year, mon), 23, 59, 59, 999))
      dateFilter.gte = firstDay
      dateFilter.lte = lastDay
    } else {
      if (startDateStr) {
        dateFilter.gte = parseDate(startDateStr)
      }
      if (endDateStr) {
        const end = parseDate(endDateStr)
        // Include the entire end date
        end.setUTCHours(23, 59, 59, 999)
        dateFilter.lte = end
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter
    }

    // ---- Monthly view: fill all calendar days for employee ----
    if (view === 'monthly' && employeeId && month) {
      const match = /^(\d{4})-(\d{2})$/.exec(month)
      if (!match) {
        return NextResponse.json(
          { error: 'Invalid month format. Expected YYYY-MM' },
          { status: 400 },
        )
      }
      const year = Number(match[1])
      const mon = Number(match[2]) - 1
      const totalDays = daysInMonth(year, mon)

      // Fetch all attendance records for this employee in the month
      const records = await db.attendance.findMany({
        where: {
          employeeId,
          date: {
            gte: new Date(Date.UTC(year, mon, 1)),
            lte: new Date(Date.UTC(year, mon, totalDays, 23, 59, 59, 999)),
          },
        },
        include: {
          employee: { select: { id: true, name: true, employeeCode: true } },
        },
        orderBy: { date: 'asc' },
      })

      // Build a map of date -> record
      const recordMap = new Map<string, (typeof records)[number]>()
      for (const rec of records) {
        recordMap.set(formatDate(new Date(rec.date)), rec)
      }

      // Build the full month grid
      const calendar = []
      let earnedSC = 0
      let deductedSC = 0
      let presentDays = 0
      let absentDays = 0
      let leaveDays = 0

      for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const record = recordMap.get(dateStr) || null
        const dayStatus = record?.status || null

        if (dayStatus) {
          const cat = getScCategory(dayStatus)
          if (cat === 'earn') earnedSC++
          else if (cat === 'deduct') deductedSC++

          if (dayStatus === 'A' || dayStatus === 'CD') absentDays++
          else if (SC_DEDUCT_STATUSES.has(dayStatus)) leaveDays++
          else presentDays++
        }

        calendar.push({
          date: dateStr,
          day,
          dayOfWeek: new Date(Date.UTC(year, mon, day)).getUTCDay(),
          record,
          statusLabel: dayStatus ? STATUS_LABELS[dayStatus] || dayStatus : null,
          scCategory: dayStatus ? getScCategory(dayStatus) : null,
        })
      }

      return NextResponse.json({
        employeeId,
        month,
        totalDays,
        presentDays,
        absentDays,
        leaveDays,
        earnedSC,
        deductedSC,
        netSC: earnedSC - deductedSC,
        calendar,
      })
    }

    // ---- Summary / list view with pagination ----
    const [records, total] = await Promise.all([
      db.attendance.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, employeeCode: true } },
        },
        orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.attendance.count({ where }),
    ])

    // Add computed SC category to each record
    const enriched = records.map((rec) => ({
      ...rec,
      statusLabel: STATUS_LABELS[rec.status] || rec.status,
      scCategory: getScCategory(rec.status),
    }))

    return NextResponse.json({
      data: enriched,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/attendance
// ---------------------------------------------------------------------------
// Supports two modes:
//   1. Single record: { employeeId, date, status, projectId?, checkInTime?,
//                         checkOutTime?, overtimeHours?, remarks?, createdBy? }
//      - Upsert based on employeeId + date
//   2. Bulk records:   { records: [{ employeeId, date, status, ... }, ...] }
//      - Upsert each record individually
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // ---- Bulk mode ----
    if (body.records && Array.isArray(body.records)) {
      return await handleBulkUpsert(body.records, body.createdBy)
    }

    // ---- Single record upsert ----
    return await handleSingleUpsert(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Handle Prisma unique constraint violation gracefully
    if (message.includes('Unique constraint') || message.includes('unique constraint')) {
      return NextResponse.json(
        { error: 'An attendance record already exists for this employee on this date. Use PUT to update it.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PUT /api/attendance?id=xxx
// ---------------------------------------------------------------------------
// Update a single attendance record by its id
// ---------------------------------------------------------------------------

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Attendance record ID is required (query param ?id=)' }, { status: 400 })
    }

    const existing = await db.attendance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    // Check if the record has been used in a processed payroll
    const payrollCheck = await isUsedInPayroll(existing.employeeId, new Date(existing.date))
    if (payrollCheck.used) {
      return NextResponse.json(
        { error: `Cannot update: attendance record is used in payroll batch "${payrollCheck.batchRef}"` },
        { status: 409 },
      )
    }

    const data = await request.json()

    // Validate status if provided
    if (data.status && !isValidStatus(data.status)) {
      return NextResponse.json(
        { error: `Invalid status "${data.status}". Valid values: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      )
    }

    // Validate time format if provided
    if (data.checkInTime && !isValidTimeFormat(data.checkInTime)) {
      return NextResponse.json(
        { error: `Invalid checkInTime format "${data.checkInTime}". Expected HH:mm` },
        { status: 400 },
      )
    }
    if (data.checkOutTime && !isValidTimeFormat(data.checkOutTime)) {
      return NextResponse.json(
        { error: `Invalid checkOutTime format "${data.checkOutTime}". Expected HH:mm` },
        { status: 400 },
      )
    }

    // If employeeId or date is being changed, check for duplicate
    if ((data.employeeId && data.employeeId !== existing.employeeId) || data.date) {
      const checkEmployeeId = data.employeeId || existing.employeeId
      const checkDate = data.date ? parseDate(data.date) : new Date(existing.date)
      const duplicate = await db.attendance.findFirst({
        where: {
          employeeId: checkEmployeeId,
          date: checkDate,
          id: { not: id },
        },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Another attendance record already exists for this employee on this date' },
          { status: 409 },
        )
      }
    }

    // Validate employeeId exists if being changed
    if (data.employeeId && data.employeeId !== existing.employeeId) {
      const emp = await db.employee.findUnique({ where: { id: data.employeeId } })
      if (!emp) {
        return NextResponse.json({ error: `Employee not found: ${data.employeeId}` }, { status: 404 })
      }
    }

    // Build update data (only include fields that are provided)
    const updateData: Record<string, unknown> = {}
    if (data.employeeId) updateData.employeeId = data.employeeId
    if (data.date) updateData.date = parseDate(data.date)
    if (data.status) updateData.status = data.status
    if (data.projectId !== undefined) updateData.projectId = data.projectId || null
    if (data.checkInTime !== undefined) updateData.checkInTime = data.checkInTime || null
    if (data.checkOutTime !== undefined) updateData.checkOutTime = data.checkOutTime || null
    if (data.overtimeHours !== undefined) updateData.overtimeHours = Number(data.overtimeHours) || 0
    if (data.remarks !== undefined) updateData.remarks = data.remarks || null

    const updated = await db.attendance.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
      },
    })

    return NextResponse.json({
      ...updated,
      statusLabel: STATUS_LABELS[updated.status] || updated.status,
      scCategory: getScCategory(updated.status),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/attendance?id=xxx
// ---------------------------------------------------------------------------
// Delete a single attendance record by id (only if not used in payroll)
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Attendance record ID is required (query param ?id=)' }, { status: 400 })
    }

    const existing = await db.attendance.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    // Prevent deletion if used in a processed payroll batch
    const payrollCheck = await isUsedInPayroll(existing.employeeId, new Date(existing.date))
    if (payrollCheck.used) {
      return NextResponse.json(
        { error: `Cannot delete: attendance record is used in payroll batch "${payrollCheck.batchRef}"` },
        { status: 409 },
      )
    }

    await db.attendance.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: `Attendance record for ${existing.employee.name} on ${formatDate(new Date(existing.date))} deleted successfully`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Validate a single attendance record payload */
function validateRecordPayload(record: Record<string, unknown>): string | null {
  if (!record.employeeId || typeof record.employeeId !== 'string') {
    return 'employeeId is required and must be a string'
  }
  if (!record.date || typeof record.date !== 'string') {
    return 'date is required and must be a string (YYYY-MM-DD)'
  }
  // Validate date format
  try {
    parseDate(record.date as string)
  } catch {
    return `Invalid date format: "${record.date}". Expected YYYY-MM-DD`
  }
  if (!record.status || typeof record.status !== 'string') {
    return 'status is required and must be a string'
  }
  if (!isValidStatus(record.status as string)) {
    return `Invalid status "${record.status}". Valid values: ${VALID_STATUSES.join(', ')}`
  }
  if (record.checkInTime && typeof record.checkInTime === 'string' && !isValidTimeFormat(record.checkInTime)) {
    return `Invalid checkInTime format "${record.checkInTime}". Expected HH:mm`
  }
  if (record.checkOutTime && typeof record.checkOutTime === 'string' && !isValidTimeFormat(record.checkOutTime)) {
    return `Invalid checkOutTime format "${record.checkOutTime}". Expected HH:mm`
  }
  if (record.overtimeHours !== undefined && record.overtimeHours !== null && isNaN(Number(record.overtimeHours))) {
    return 'overtimeHours must be a number'
  }
  return null
}

/** Handle upsert of a single attendance record */
async function handleSingleUpsert(data: Record<string, unknown>) {
  const validationError = validateRecordPayload(data)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  // Validate employeeId exists
  const employee = await db.employee.findUnique({ where: { id: data.employeeId as string } })
  if (!employee) {
    return NextResponse.json(
      { error: `Employee not found: ${data.employeeId}` },
      { status: 404 },
    )
  }

  const attendanceDate = parseDate(data.date as string)

  // Prevent modification if existing record is used in payroll
  const payrollCheck = await isUsedInPayroll(data.employeeId as string, attendanceDate)
  if (payrollCheck.used) {
    return NextResponse.json(
      { error: `Cannot upsert: attendance for this employee/date is used in payroll batch "${payrollCheck.batchRef}"` },
      { status: 409 },
    )
  }

  const status = data.status as string
  const record = await db.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: data.employeeId as string,
        date: attendanceDate,
      },
    },
    update: {
      status,
      projectId: (data.projectId as string) || null,
      checkInTime: (data.checkInTime as string) || null,
      checkOutTime: (data.checkOutTime as string) || null,
      overtimeHours: Number(data.overtimeHours) || 0,
      remarks: (data.remarks as string) || null,
      createdBy: (data.createdBy as string) || null,
    },
    create: {
      employeeId: data.employeeId as string,
      date: attendanceDate,
      status,
      projectId: (data.projectId as string) || null,
      checkInTime: (data.checkInTime as string) || null,
      checkOutTime: (data.checkOutTime as string) || null,
      overtimeHours: Number(data.overtimeHours) || 0,
      remarks: (data.remarks as string) || null,
      createdBy: (data.createdBy as string) || null,
    },
    include: {
      employee: { select: { id: true, name: true, employeeCode: true } },
    },
  })

  return NextResponse.json(
    {
      ...record,
      statusLabel: STATUS_LABELS[record.status] || record.status,
      scCategory: getScCategory(record.status),
    },
    { status: 201 },
  )
}

/** Handle bulk upsert of attendance records */
async function handleBulkUpsert(records: Record<string, unknown>[], createdBy?: string) {
  if (records.length === 0) {
    return NextResponse.json({ error: 'Records array cannot be empty' }, { status: 400 })
  }
  if (records.length > 1000) {
    return NextResponse.json({ error: 'Bulk upsert limited to 1000 records per request' }, { status: 400 })
  }

  // Validate all records first
  const errors: { index: number; error: string }[] = []
  for (let i = 0; i < records.length; i++) {
    const err = validateRecordPayload(records[i])
    if (err) errors.push({ index: i, error: err })
  }
  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'Validation failed for one or more records', details: errors },
      { status: 400 },
    )
  }

  // Collect unique employee IDs and validate they all exist
  const employeeIds = [...new Set(records.map((r) => r.employeeId as string))]
  const employees = await db.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true },
  })
  const foundIds = new Set(employees.map((e) => e.id))
  const missingIds = employeeIds.filter((id) => !foundIds.has(id))
  if (missingIds.length > 0) {
    return NextResponse.json(
      { error: `Employees not found: ${missingIds.join(', ')}` },
      { status: 404 },
    )
  }

  // Process each record with upsert
  const results: {
    index: number
    success: boolean
    action: 'created' | 'updated'
    record?: Record<string, unknown>
    error?: string
  }[] = []

  let created = 0
  let updated = 0
  let failed = 0

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    try {
      const attendanceDate = parseDate(rec.date as string)

      // Check payroll lock
      const payrollCheck = await isUsedInPayroll(rec.employeeId as string, attendanceDate)
      if (payrollCheck.used) {
        results.push({
          index: i,
          success: false,
          action: 'updated',
          error: `Used in payroll batch "${payrollCheck.batchRef}"`,
        })
        failed++
        continue
      }

      // Determine if this is a create or update by checking existence
      const existing = await db.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: rec.employeeId as string,
            date: attendanceDate,
          },
        },
      })

      const upserted = await db.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: rec.employeeId as string,
            date: attendanceDate,
          },
        },
        update: {
          status: rec.status as string,
          projectId: (rec.projectId as string) || null,
          checkInTime: (rec.checkInTime as string) || null,
          checkOutTime: (rec.checkOutTime as string) || null,
          overtimeHours: Number(rec.overtimeHours) || 0,
          remarks: (rec.remarks as string) || null,
          createdBy: (createdBy || rec.createdBy as string) || null,
        },
        create: {
          employeeId: rec.employeeId as string,
          date: attendanceDate,
          status: rec.status as string,
          projectId: (rec.projectId as string) || null,
          checkInTime: (rec.checkInTime as string) || null,
          checkOutTime: (rec.checkOutTime as string) || null,
          overtimeHours: Number(rec.overtimeHours) || 0,
          remarks: (rec.remarks as string) || null,
          createdBy: (createdBy || rec.createdBy as string) || null,
        },
        include: {
          employee: { select: { id: true, name: true, employeeCode: true } },
        },
      })

      const action = existing ? 'updated' : 'created'
      if (existing) updated++
      else created++

      results.push({
        index: i,
        success: true,
        action,
        record: {
          ...upserted,
          statusLabel: STATUS_LABELS[upserted.status] || upserted.status,
          scCategory: getScCategory(upserted.status),
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ index: i, success: false, action: 'created', error: message })
      failed++
    }
  }

  return NextResponse.json({
    summary: { total: records.length, created, updated, failed },
    results,
  }, { status: failed === records.length ? 500 : 201 })
}

/**
 * Check whether an attendance record for the given employee and date
 * has been used in a processed payroll batch.
 *
 * A payroll batch line references an employee and covers a period (YYYY-MM).
 * If the batch is not in "draft" status, the attendance is considered locked.
 */
async function isUsedInPayroll(
  employeeId: string,
  date: Date,
): Promise<{ used: boolean; batchRef?: string }> {
  const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

  const line = await db.payrollBatchLine.findFirst({
    where: {
      employeeId,
      batch: {
        period,
        status: { not: 'draft' }, // only non-draft batches lock attendance
      },
    },
    select: {
      batch: {
        select: { batchNumber: true },
      },
    },
  })

  if (line) {
    return { used: true, batchRef: line.batch.batchNumber }
  }
  return { used: false }
}
