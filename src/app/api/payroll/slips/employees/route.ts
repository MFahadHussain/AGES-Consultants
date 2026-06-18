import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/payroll/slips/employees?period=2025-05
// Returns list of employees with payroll data for a period

async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: 'Invalid period format. Use YYYY-MM (e.g. 2025-05)' },
        { status: 400 }
      )
    }

    const batches = await db.payrollBatch.findMany({
      where: { period },
      include: {
        lines: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeCode: true,
                designation: true,
                department: true,
                email: true,
                cnic: true,
                ntn: true,
                bankName: true,
                bankAccountNumber: true,
                taxFilingStatus: true,
                taxCity: true,
                joiningDate: true,
                employmentType: true,
              },
            },
          },
          orderBy: { employeeName: 'asc' },
        },
      },
    })

    if (batches.length === 0) {
      return NextResponse.json({ employees: [], period })
    }

    // Deduplicate employees — keep line from most advanced batch status
    const statusRank: Record<string, number> = {
      'voucher-created': 4, approved: 3, reviewed: 2, draft: 1,
    }
    const empMap = new Map<string, any>()

    for (const batch of batches) {
      for (const line of batch.lines) {
        const existing = empMap.get(line.employeeId)
        const existingRank = statusRank[existing?.batchStatus || ''] || 0
        const newRank = statusRank[batch.status] || 0
        if (!existing || newRank > existingRank) {
          empMap.set(line.employeeId, {
            ...line,
            batchStatus: batch.status,
            batchPeriod: batch.period,
            batchNumber: batch.batchNumber,
          })
        }
      }
    }

    const employees = Array.from(empMap.values()).map(line => ({
      employeeId:   line.employeeId,
      employeeCode: line.employeeCode || line.employee?.employeeCode || '',
      employeeName: line.employeeName,
      designation:  line.employee?.designation || '',
      department:   line.employee?.department || '',
      email:        line.employee?.email || '',
      grossSalary:  Math.round(line.grossSalary),
      incomeTax:    Math.round(line.incomeTax),
      netSalary:    Math.round(line.netPay),
      totalSC:      Math.round(line.socialCharges),
      batchStatus:  line.batchStatus,
      batchNumber:  line.batchNumber,
    }))

    return NextResponse.json({ employees, period, count: employees.length })
  } catch (err) {
    console.error('[PAYROLL SLIPS EMPLOYEES ERROR]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const GET = withAudit('payroll', GET_HANDLER);
