import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'
import { calculateMonthlyPayroll } from '@/lib/payroll/calculateMonthlyPayroll'
import { findAccountByRole, findFirstBankAccount } from '@/lib/account-roles'

// ============================================================
// Enhanced Payroll Engine API v2.0
// Supports: create batch, run-payroll, add-line, update-line,
// delete-line, review, approve, mark-voucher-created,
// recalculate
// recalculate
// ============================================================

// Helper: get days in month from period string "YYYY-MM"
function getDaysInMonth(period: string): number {
  const [year, month] = period.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

// Helper: get start/end date of a period
function getPeriodDates(period: string): { startDate: Date; endDate: Date } {
  const [year, month] = period.split('-').map(Number)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)
  return { startDate, endDate }
}

// Helper: recalculate batch totals from lines
// When batch status is "approved" or "posted", only include lines with lineStatus = "approved"
async function recalcBatchTotals(batchId: string) {
  const batch = await db.payrollBatch.findUnique({ where: { id: batchId } })
  const filterApproved = batch && (batch.status === 'approved' || batch.status === 'posted' || batch.status === 'voucher-created')
  const lines = await db.payrollBatchLine.findMany({
    where: { batchId, ...(filterApproved ? { lineStatus: 'approved' } : {}) },
  })

  const totals = lines.reduce(
    (acc, l) => ({
      totalBasicSalary: acc.totalBasicSalary + l.basicSalary,
      totalAllowances: acc.totalAllowances + l.allowances,
      totalGross: acc.totalGross + l.grossSalary,
      totalIncomeTax: acc.totalIncomeTax + l.incomeTax,
      totalEobiEmployee: acc.totalEobiEmployee + l.eobiEmployee,
      totalEobiEmployer: acc.totalEobiEmployer + l.eobiEmployer,
      totalEssiEmployee: acc.totalEssiEmployee + l.essiEmployee,
      totalEssiEmployer: acc.totalEssiEmployer + l.essiEmployer,
      totalPfEmployee: acc.totalPfEmployee + l.pfEmployee,
      totalPfEmployer: acc.totalPfEmployer + l.pfEmployer,
      totalLoanDeduction: acc.totalLoanDeduction + l.loanDeduction,
      totalAdvanceDeduction: acc.totalAdvanceDeduction + l.advanceDeduction,
      totalOtherDeductions: acc.totalOtherDeductions + l.otherDeductions,
      totalDeductions: acc.totalDeductions + l.totalDeductions,
      totalNetPay: acc.totalNetPay + l.netPay,
      totalSocialCharges: acc.totalSocialCharges + l.socialCharges,
      totalGratuity: acc.totalGratuity + l.gratuity,
      totalEmployerCharges: acc.totalEmployerCharges + l.eobiEmployer + l.pfEmployer + l.essiEmployer + l.socialCharges + l.gratuity,
    }),
    {
      totalBasicSalary: 0,
      totalAllowances: 0,
      totalGross: 0,
      totalIncomeTax: 0,
      totalEobiEmployee: 0,
      totalEobiEmployer: 0,
      totalEssiEmployee: 0,
      totalEssiEmployer: 0,
      totalPfEmployee: 0,
      totalPfEmployer: 0,
      totalLoanDeduction: 0,
      totalAdvanceDeduction: 0,
      totalOtherDeductions: 0,
      totalDeductions: 0,
      totalNetPay: 0,
      totalSocialCharges: 0,
      totalGratuity: 0,
      totalEmployerCharges: 0,
    }
  )

  await db.payrollBatch.update({
    where: { id: batchId },
    data: totals,
  })
}

// ============================================================
// GET - List payroll batches
// ============================================================
async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const id = searchParams.get('id')

    if (id) {
      const batch = await db.payrollBatch.findUnique({
        where: { id },
        include: { lines: { orderBy: { employeeName: 'asc' } } },
      })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      return NextResponse.json(batch)
    }

    // If fetching voucher for a batch
    const voucherId = searchParams.get('voucherId')
    if (voucherId) {
      const voucher = await db.voucher.findUnique({
        where: { id: voucherId },
        include: {
          entries: {
            include: { account: { select: { id: true, name: true, code: true } } },
            orderBy: { lineNumber: 'asc' },
          },
        },
      })
      if (!voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      return NextResponse.json(voucher)
    }

    const where: Record<string, string> = {}
    if (status) where.status = status

    const batches = await db.payrollBatch.findMany({
      where,
      include: { lines: { orderBy: { employeeName: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(batches)
  } catch (error) {
    console.error('Payroll GET error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// ============================================================
// POST - All payroll actions
// ============================================================
async function POST_HANDLER(request: Request) {
  try {
    const data = await request.json()
    const action = data.action

    // ----------------------------------------------------------
    // 1. CREATE BATCH (default, no action)
    // ----------------------------------------------------------
    if (!action) {
      const { name, period, projectId } = data
      if (!period) {
        return NextResponse.json({ error: 'Period is required' }, { status: 400 })
      }

      // Generate batch number
      const batchCount = await db.payrollBatch.count({
        where: { period },
      })
      const batchNumber = `PAY-${period.replace('-', '')}-${String(batchCount + 1).padStart(3, '0')}`

      const batch = await db.payrollBatch.create({
        data: {
          batchNumber,
          name: name || `Payroll - ${period}`,
          period,
          projectId: projectId || null,
          status: 'draft',
          createdBy: 'system',
        },
        include: { lines: true },
      })

      return NextResponse.json(batch, { status: 201 })
    }

    // ----------------------------------------------------------
    // 2. RUN PAYROLL — Uses Attendance-Driven Calculator v2.0
    // ----------------------------------------------------------
    if (action === 'run-payroll') {
      const { batchId } = data
      if (!batchId) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({ where: { id: batchId } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.status !== 'draft') {
        return NextResponse.json({ error: 'Payroll can only be run on draft batches' }, { status: 400 })
      }

      // Parse the period to get month start date
      const [pYear, pMonth] = batch.period.split('-').map(Number)
      const monthDate = new Date(Date.UTC(pYear, pMonth - 1, 1))

      // Step 1: Load all active employees
      const employees = await db.employee.findMany({
        where: { status: 'active' },
      })

      if (employees.length === 0) {
        return NextResponse.json({ error: 'No active employees found' }, { status: 400 })
      }

      // Delete existing lines for this batch (re-run)
      await db.payrollBatchLine.deleteMany({ where: { batchId } })

      const linesData: Record<string, unknown>[] = []
      const errors: { employeeId: string; name: string; error: string }[] = []

      // Step 2: For each employee, use the Attendance-Driven Calculator
      for (const emp of employees) {
        try {
          const result = await calculateMonthlyPayroll(emp.id, monthDate)

          // Build the PayrollBatchLine from calculator result
          // Determine primary project (the one with most days)
          const primaryProject = result.projectAllocations.length > 0
            ? result.projectAllocations.reduce((max, p) => p.days > max.days ? p : max, result.projectAllocations[0])
            : null

          // Build project allocations JSON for storage
          const projectAllocationsJson = result.projectAllocations.map(pa => ({
            projectId: pa.projectId,
            projectName: pa.projectName,
            projectCode: pa.projectCode,
            days: pa.days,
            weight: pa.weight,
            weightPct: pa.weightPct,
            salaryShare: pa.salaryShare,
            scShare: pa.scShare,
            projectDailyRate: pa.projectDailyRate,
            projectSalary: pa.projectSalary,
            designation: pa.designation,
          }))

          // Build contract earnings JSON for storage (multi-contract breakdown)
          const contractEarningsJson = (result as any).contractEarnings
            ? (result as any).contractEarnings.map((ce: any) => ({
                assignmentId: ce.assignmentId,
                projectId: ce.projectId,
                projectName: ce.projectName,
                projectCode: ce.projectCode,
                contractSalary: ce.contractSalary,
                dailyRate: ce.dailyRate,
                daysWorked: ce.daysWorked,
                earnedSalary: ce.earnedSalary,
                absentDays: ce.absentDays,
                designation: ce.designation,
                scShare: ce.scShare,
                scBalance: ce.scBalance,
                scOtherPayable: ce.scOtherPayable,
                scEarnedLeave: ce.scEarnedLeave,
                scSickLeave: ce.scSickLeave,
                scCasualLeave: ce.scCasualLeave,
              }))
            : []

          linesData.push({
            batchId,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.employeeCode,
            basicSalary: result.monthlySalary,
            dailyRate: result.dailyRate,
            workingDays: result.calendarDays,
            eligibleDays: result.eligibleDays,
            leaveDays: result.leaveDays,
            absentDays: result.absentDays,
            calendarDays: result.calendarDays,
            payableDays: result.payableDays,
            allowanceDetails: JSON.stringify(result.allowances.details),
            allowances: result.allowances.totalAllowances,
            grossSalary: result.grossSalary,
            incomeTax: result.deductions.incomeTax,
            eobiEmployee: result.deductions.eobiEmployee,
            eobiEmployer: result.deductions.eobiEmployer,
            essiEmployee: result.deductions.essiEmployee,
            essiEmployer: result.deductions.essiEmployer,
            pfEmployee: result.deductions.pfEmployee,
            pfEmployer: result.deductions.pfEmployer,
            loanDeduction: result.deductions.loanDeduction,
            advanceDeduction: result.deductions.advanceDeduction,
            otherDeductions: result.deductions.otherDeductions,
            totalDeductions: result.deductions.totalDeductions,
            netPay: result.netPay,
            socialCharges: result.finalSC,
            gratuity: result.gratuity,
            scBreakdown: JSON.stringify(result.scBreakdown),
            taxBreakdown: JSON.stringify(result.taxBreakdown),
            projectAllocations: JSON.stringify(projectAllocationsJson),
            contractEarnings: JSON.stringify(contractEarningsJson),
            projectId: primaryProject?.projectId || emp.defaultProjectId || null,
            department: emp.department,
            lineStatus: 'draft',
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push({ employeeId: emp.id, name: emp.name, error: message })
        }
      }

      // Step 3: Create PayrollBatchLine for each employee
      if (linesData.length > 0) {
        await db.payrollBatchLine.createMany({ data: linesData as any })
      }

      // Step 4: Update PayrollBatch totals
      await recalcBatchTotals(batchId)

      const updatedBatch = await db.payrollBatch.findUnique({
        where: { id: batchId },
        include: { lines: { orderBy: { employeeName: 'asc' } } },
      })

      return NextResponse.json({
        message: `Payroll processed for ${linesData.length} employees${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
        batch: updatedBatch,
        employeeCount: linesData.length,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // ----------------------------------------------------------
    // 3. ADD LINE — Add a single employee line manually
    // ----------------------------------------------------------
    if (action === 'add-line') {
      const { batchId, line } = data
      if (!batchId || !line) return NextResponse.json({ error: 'Batch ID and line data required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({ where: { id: batchId } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.status !== 'draft') return NextResponse.json({ error: 'Can only add lines to draft batches' }, { status: 400 })

      // Conditional deduction check: fetch all employee flags
      let empFlags: {
        eobiEnabled: boolean
        pfEnabled: boolean
        incomeTaxEnabled: boolean
        essiEnabled: boolean
        gratuityEnabled: boolean
      } | null = null
      if (line.employeeId && !String(line.employeeId).startsWith('MANUAL-')) {
        const emp = await db.employee.findUnique({
          where: { id: line.employeeId },
          select: {
            eobiEnabled: true,
            pfEnabled: true,
            incomeTaxEnabled: true,
            essiEnabled: true,
            gratuityEnabled: true,
          },
        })
        if (emp) empFlags = emp
      }

      const basicSalary = line.basicSalary || 0
      const allowances = line.allowances || 0
      const grossSalary = basicSalary + allowances
      const incomeTax = (empFlags && !empFlags.incomeTaxEnabled) ? 0 : (line.incomeTax || 0)
      const eobiEmployee = (empFlags && !empFlags.eobiEnabled) ? 0 : (line.eobiEmployee || 0)
      const eobiEmployer = (empFlags && !empFlags.eobiEnabled) ? 0 : (line.eobiEmployer || 0)
      const essiEmployee = (empFlags && !empFlags.essiEnabled) ? 0 : (line.essiEmployee || 0)
      const essiEmployer = (empFlags && !empFlags.essiEnabled) ? 0 : (line.essiEmployer || 0)
      const pfEmployee = (empFlags && !empFlags.pfEnabled) ? 0 : (line.pfEmployee || 0)
      const pfEmployer = (empFlags && !empFlags.pfEnabled) ? 0 : (line.pfEmployer || 0)
      const gratuity = (empFlags && !empFlags.gratuityEnabled) ? 0 : (line.gratuity || 0)
      const loanDeduction = line.loanDeduction || 0
      const advanceDeduction = line.advanceDeduction || 0
      const otherDeductions = line.otherDeductions || 0
      const totalDeductions = incomeTax + eobiEmployee + essiEmployee + pfEmployee + loanDeduction + advanceDeduction + otherDeductions
      const netPay = grossSalary - totalDeductions

      // Calendar days / payable days
      const calendarDays = line.calendarDays || getDaysInMonth(batch.period)
      const absentDays = line.absentDays || 0
      const payableDays = line.payableDays || (calendarDays - absentDays)

      const newLine = await db.payrollBatchLine.create({
        data: {
          batchId,
          employeeId: line.employeeId || `MANUAL-${Date.now()}`,
          employeeName: line.employeeName || '',
          employeeCode: line.employeeCode || null,
          basicSalary,
          dailyRate: line.dailyRate || 0,
          workingDays: line.workingDays || calendarDays,
          eligibleDays: line.eligibleDays || 0,
          leaveDays: line.leaveDays || 0,
          absentDays,
          calendarDays,
          payableDays,
          allowanceDetails: line.allowanceDetails || null,
          allowances,
          grossSalary,
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
          netPay,
          socialCharges: line.socialCharges || 0,
          gratuity,
          scBreakdown: line.scBreakdown || null,
          taxBreakdown: line.taxBreakdown || null,
          projectAllocations: line.projectAllocations || null,
          projectId: line.projectId || null,
          department: line.department || null,
        },
      })

      await recalcBatchTotals(batchId)

      return NextResponse.json(newLine, { status: 201 })
    }

    // ----------------------------------------------------------
    // 4. UPDATE LINE — Update a single line
    // ----------------------------------------------------------
    if (action === 'update-line') {
      const { lineId, line } = data
      if (!lineId || !line) return NextResponse.json({ error: 'Line ID and line data required' }, { status: 400 })

      const existingLine = await db.payrollBatchLine.findUnique({ where: { id: lineId } })
      if (!existingLine) return NextResponse.json({ error: 'Line not found' }, { status: 404 })

      const batch = await db.payrollBatch.findUnique({ where: { id: existingLine.batchId } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.status !== 'draft') return NextResponse.json({ error: 'Can only update lines in draft batches' }, { status: 400 })

      // Conditional deduction check: fetch all employee flags
      let empFlags: {
        eobiEnabled: boolean
        pfEnabled: boolean
        incomeTaxEnabled: boolean
        essiEnabled: boolean
        gratuityEnabled: boolean
      } | null = null
      const empId = line.employeeId || existingLine.employeeId
      if (empId && !String(empId).startsWith('MANUAL-')) {
        const emp = await db.employee.findUnique({
          where: { id: empId },
          select: {
            eobiEnabled: true,
            pfEnabled: true,
            incomeTaxEnabled: true,
            essiEnabled: true,
            gratuityEnabled: true,
          },
        })
        if (emp) empFlags = emp
      }

      const basicSalary = line.basicSalary ?? existingLine.basicSalary
      const allowances = line.allowances ?? existingLine.allowances
      const grossSalary = basicSalary + allowances
      const rawIncomeTax = line.incomeTax ?? existingLine.incomeTax
      const rawEobiEmployee = line.eobiEmployee ?? existingLine.eobiEmployee
      const rawEobiEmployer = line.eobiEmployer ?? existingLine.eobiEmployer
      const rawEssiEmployee = line.essiEmployee ?? existingLine.essiEmployee
      const rawEssiEmployer = line.essiEmployer ?? existingLine.essiEmployer
      const rawPfEmployee = line.pfEmployee ?? existingLine.pfEmployee
      const rawPfEmployer = line.pfEmployer ?? existingLine.pfEmployer
      const rawGratuity = line.gratuity ?? existingLine.gratuity

      const incomeTax = (empFlags && !empFlags.incomeTaxEnabled) ? 0 : rawIncomeTax
      const eobiEmployee = (empFlags && !empFlags.eobiEnabled) ? 0 : rawEobiEmployee
      const eobiEmployer = (empFlags && !empFlags.eobiEnabled) ? 0 : rawEobiEmployer
      const essiEmployee = (empFlags && !empFlags.essiEnabled) ? 0 : rawEssiEmployee
      const essiEmployer = (empFlags && !empFlags.essiEnabled) ? 0 : rawEssiEmployer
      const pfEmployee = (empFlags && !empFlags.pfEnabled) ? 0 : rawPfEmployee
      const pfEmployer = (empFlags && !empFlags.pfEnabled) ? 0 : rawPfEmployer
      const gratuity = (empFlags && !empFlags.gratuityEnabled) ? 0 : rawGratuity

      const loanDeduction = line.loanDeduction ?? existingLine.loanDeduction
      const advanceDeduction = line.advanceDeduction ?? existingLine.advanceDeduction
      const otherDeductions = line.otherDeductions ?? existingLine.otherDeductions
      const totalDeductions = incomeTax + eobiEmployee + essiEmployee + pfEmployee + loanDeduction + advanceDeduction + otherDeductions
      const netPay = grossSalary - totalDeductions

      // Calendar / payable days
      const calendarDays = line.calendarDays ?? existingLine.calendarDays
      const absentDays = line.absentDays ?? existingLine.absentDays
      const payableDays = line.payableDays ?? (calendarDays > 0 ? calendarDays - absentDays : existingLine.payableDays)

      const updated = await db.payrollBatchLine.update({
        where: { id: lineId },
        data: {
          employeeName: line.employeeName ?? existingLine.employeeName,
          employeeCode: line.employeeCode ?? existingLine.employeeCode,
          basicSalary,
          dailyRate: line.dailyRate ?? existingLine.dailyRate,
          workingDays: line.workingDays ?? existingLine.workingDays,
          eligibleDays: line.eligibleDays ?? existingLine.eligibleDays,
          leaveDays: line.leaveDays ?? existingLine.leaveDays,
          absentDays,
          calendarDays,
          payableDays,
          allowanceDetails: line.allowanceDetails !== undefined ? line.allowanceDetails : existingLine.allowanceDetails,
          allowances,
          grossSalary,
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
          netPay,
          socialCharges: line.socialCharges ?? existingLine.socialCharges,
          gratuity,
          scBreakdown: line.scBreakdown !== undefined ? line.scBreakdown : existingLine.scBreakdown,
          taxBreakdown: line.taxBreakdown !== undefined ? line.taxBreakdown : existingLine.taxBreakdown,
          projectAllocations: line.projectAllocations !== undefined ? line.projectAllocations : existingLine.projectAllocations,
          projectId: line.projectId !== undefined ? line.projectId : existingLine.projectId,
          department: line.department ?? existingLine.department,
        },
      })

      await recalcBatchTotals(existingLine.batchId)

      return NextResponse.json(updated)
    }

    // ----------------------------------------------------------
    // 5. DELETE LINE — Delete a line
    // ----------------------------------------------------------
    if (action === 'delete-line') {
      const { lineId } = data
      if (!lineId) return NextResponse.json({ error: 'Line ID required' }, { status: 400 })

      const line = await db.payrollBatchLine.findUnique({ where: { id: lineId } })
      if (!line) return NextResponse.json({ error: 'Line not found' }, { status: 404 })

      const batch = await db.payrollBatch.findUnique({ where: { id: line.batchId } })
      if (batch && batch.status !== 'draft') {
        return NextResponse.json({ error: 'Can only delete lines from draft batches' }, { status: 400 })
      }

      await db.payrollBatchLine.delete({ where: { id: lineId } })
      await recalcBatchTotals(line.batchId)

      return NextResponse.json({ message: 'Line deleted' })
    }

    // ----------------------------------------------------------
    // 6. REVIEW — Move batch from draft → reviewed
    // ----------------------------------------------------------
    if (action === 'review') {
      const { batchId } = data
      if (!batchId) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({ where: { id: batchId }, include: { lines: true } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.status !== 'draft') return NextResponse.json({ error: 'Only draft batches can be reviewed' }, { status: 400 })
      if (batch.lines.length === 0) return NextResponse.json({ error: 'Cannot review a batch with no lines' }, { status: 400 })

      const updated = await db.payrollBatch.update({
        where: { id: batchId },
        data: {
          status: 'reviewed',
          reviewedBy: 'system',
        },
        include: { lines: true },
      })

      return NextResponse.json({ message: 'Batch submitted for review', batch: updated })
    }

    // ----------------------------------------------------------
    // 7. APPROVE — Move batch from reviewed → approved
    // ----------------------------------------------------------
    if (action === 'approve') {
      const { batchId } = data
      if (!batchId) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({ where: { id: batchId } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.status !== 'reviewed') return NextResponse.json({ error: 'Only reviewed batches can be approved' }, { status: 400 })

      const updated = await db.payrollBatch.update({
        where: { id: batchId },
        data: {
          status: 'approved',
          approvedBy: 'system',
        },
        include: { lines: true },
      })

      return NextResponse.json({ message: 'Batch approved', batch: updated })
    }

    // ----------------------------------------------------------
    // 8. SEND BACK — Move batch from reviewed → draft
    // ----------------------------------------------------------
    if (action === 'send-back') {
      const { batchId } = data
      if (!batchId) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({ where: { id: batchId } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.status !== 'reviewed') return NextResponse.json({ error: 'Only reviewed batches can be sent back' }, { status: 400 })

      const updated = await db.payrollBatch.update({
        where: { id: batchId },
        data: {
          status: 'draft',
          reviewedBy: null,
        },
        include: { lines: true },
      })

      return NextResponse.json({ message: 'Batch sent back to draft', batch: updated })
    }

    // ----------------------------------------------------------
    // 9a. REVIEW LINE — Review individual line(s)
    // ----------------------------------------------------------
    if (action === 'review-line') {
      const { lineId, lineIds } = data
      const ids: string[] = lineIds || (lineId ? [lineId] : [])
      if (ids.length === 0) return NextResponse.json({ error: 'lineId or lineIds required' }, { status: 400 })

      const lines = await db.payrollBatchLine.findMany({ where: { id: { in: ids } } })
      if (lines.length === 0) return NextResponse.json({ error: 'No lines found' }, { status: 404 })

      const batchIds = [...new Set(lines.map(l => l.batchId))]
      const batches = await db.payrollBatch.findMany({ where: { id: { in: batchIds } } })
      for (const b of batches) {
        if (b.status !== 'draft' && b.status !== 'reviewed') {
          return NextResponse.json({ error: `Batch ${b.batchNumber} status is '${b.status}', must be 'draft' or 'reviewed' to review lines` }, { status: 400 })
        }
      }

      await db.payrollBatchLine.updateMany({
        where: { id: { in: ids } },
        data: { lineStatus: 'reviewed' },
      })

      // Auto-advance batch to reviewed if still draft
      for (const bid of batchIds) {
        const batch = await db.payrollBatch.findUnique({ where: { id: bid } })
        if (batch && batch.status === 'draft') {
          await db.payrollBatch.update({
            where: { id: bid },
            data: { status: 'reviewed', reviewedBy: 'system' },
          })
        }
        await recalcBatchTotals(bid)
      }

      return NextResponse.json({ message: `${ids.length} line(s) reviewed`, reviewedIds: ids })
    }

    // ----------------------------------------------------------
    // 9b. APPROVE LINE — Approve individual line(s)
    // ----------------------------------------------------------
    if (action === 'approve-line') {
      const { lineId, lineIds } = data
      const ids: string[] = lineIds || (lineId ? [lineId] : [])
      if (ids.length === 0) return NextResponse.json({ error: 'lineId or lineIds required' }, { status: 400 })

      const lines = await db.payrollBatchLine.findMany({ where: { id: { in: ids } } })
      if (lines.length === 0) return NextResponse.json({ error: 'No lines found' }, { status: 404 })

      const batchIds = [...new Set(lines.map(l => l.batchId))]
      const batches = await db.payrollBatch.findMany({ where: { id: { in: batchIds } } })
      for (const b of batches) {
        if (b.status !== 'reviewed' && b.status !== 'approved') {
          return NextResponse.json({ error: `Batch ${b.batchNumber} status is '${b.status}', must be 'reviewed' or 'approved' to approve lines` }, { status: 400 })
        }
      }

      await db.payrollBatchLine.updateMany({
        where: { id: { in: ids } },
        data: { lineStatus: 'approved' },
      })

      for (const bid of batchIds) {
        await recalcBatchTotals(bid)
      }

      return NextResponse.json({ message: `${ids.length} line(s) approved`, approvedIds: ids })
    }

    // ----------------------------------------------------------
    // 9b. APPROVE ALL LINES — Approve all lines in a batch
    // ----------------------------------------------------------
    if (action === 'approve-all-lines') {
      const { batchId } = data
      if (!batchId) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({ where: { id: batchId } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.status !== 'reviewed' && batch.status !== 'approved') {
        return NextResponse.json({ error: 'Batch status must be reviewed or approved to approve lines' }, { status: 400 })
      }

      const result = await db.payrollBatchLine.updateMany({
        where: { batchId },
        data: { lineStatus: 'approved' },
      })

      await recalcBatchTotals(batchId)

      return NextResponse.json({ message: `All lines approved`, count: result.count })
    }

    // ----------------------------------------------------------
    // 9c. VOUCHER CREATED — Mark batch as voucher-created after salary vouchers are generated
    // ----------------------------------------------------------
    if (action === 'mark-voucher-created') {
      const { batchId } = data
      if (!batchId) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({ where: { id: batchId } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

      await db.payrollBatch.update({
        where: { id: batchId },
        data: { status: 'voucher-created' },
      })

      await db.payrollBatchLine.updateMany({
        where: { batchId },
        data: { lineStatus: 'voucher-created' },
      })

      return NextResponse.json({ message: 'Batch marked as vouchers created', batchId })
    }

        // ----------------------------------------------------------
    // 10. RECALCULATE — Re-run payroll calculation for all lines
    //     Useful when tax slabs change or YTD data updates
    // ----------------------------------------------------------
    if (action === 'recalculate') {
      const { batchId } = data
      if (!batchId) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({
        where: { id: batchId },
        include: { lines: true },
      })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.status !== 'draft') {
        return NextResponse.json({ error: 'Can only recalculate draft batches' }, { status: 400 })
      }
      if (batch.lines.length === 0) {
        return NextResponse.json({ error: 'No lines to recalculate' }, { status: 400 })
      }

      // Parse the period to get month start date
      const [pYear, pMonth] = batch.period.split('-').map(Number)
      const monthDate = new Date(Date.UTC(pYear, pMonth - 1, 1))

      const updatedLines: string[] = []
      const errors: { employeeId: string; name: string; error: string }[] = []

      for (const existingLine of batch.lines) {
        // Only recalculate lines linked to real employees
        if (!existingLine.employeeId || String(existingLine.employeeId).startsWith('MANUAL-')) continue

        try {
          const result = await calculateMonthlyPayroll(existingLine.employeeId, monthDate)

          // Build project allocations JSON
          const projectAllocationsJson = result.projectAllocations.map(pa => ({
            projectId: pa.projectId,
            projectName: pa.projectName,
            projectCode: pa.projectCode,
            days: pa.days,
            weight: pa.weight,
            weightPct: pa.weightPct,
            salaryShare: pa.salaryShare,
            scShare: pa.scShare,
            projectDailyRate: pa.projectDailyRate,
            projectSalary: pa.projectSalary,
            designation: pa.designation,
          }))

          // Build contract earnings JSON
          const contractEarningsJson = (result as any).contractEarnings
            ? (result as any).contractEarnings.map((ce: any) => ({
                assignmentId: ce.assignmentId,
                projectId: ce.projectId,
                projectName: ce.projectName,
                projectCode: ce.projectCode,
                contractSalary: ce.contractSalary,
                dailyRate: ce.dailyRate,
                daysWorked: ce.daysWorked,
                earnedSalary: ce.earnedSalary,
                absentDays: ce.absentDays,
                designation: ce.designation,
                scShare: ce.scShare,
                scBalance: ce.scBalance,
                scOtherPayable: ce.scOtherPayable,
                scEarnedLeave: ce.scEarnedLeave,
                scSickLeave: ce.scSickLeave,
                scCasualLeave: ce.scCasualLeave,
              }))
            : []

          // Determine primary project
          const primaryProject = result.projectAllocations.length > 0
            ? result.projectAllocations.reduce((max, p) => p.days > max.days ? p : max, result.projectAllocations[0])
            : null

          await db.payrollBatchLine.update({
            where: { id: existingLine.id },
            data: {
              basicSalary: result.monthlySalary,
              dailyRate: result.dailyRate,
              workingDays: result.calendarDays,
              eligibleDays: result.eligibleDays,
              leaveDays: result.leaveDays,
              absentDays: result.absentDays,
              calendarDays: result.calendarDays,
              payableDays: result.payableDays,
              allowanceDetails: JSON.stringify(result.allowances.details),
              allowances: result.allowances.totalAllowances,
              grossSalary: result.grossSalary,
              incomeTax: result.deductions.incomeTax,
              eobiEmployee: result.deductions.eobiEmployee,
              eobiEmployer: result.deductions.eobiEmployer,
              essiEmployee: result.deductions.essiEmployee,
              essiEmployer: result.deductions.essiEmployer,
              pfEmployee: result.deductions.pfEmployee,
              pfEmployer: result.deductions.pfEmployer,
              loanDeduction: result.deductions.loanDeduction,
              advanceDeduction: result.deductions.advanceDeduction,
              otherDeductions: result.deductions.otherDeductions,
              totalDeductions: result.deductions.totalDeductions,
              netPay: result.netPay,
              socialCharges: result.finalSC,
              gratuity: result.gratuity,
              scBreakdown: JSON.stringify(result.scBreakdown),
              taxBreakdown: JSON.stringify(result.taxBreakdown),
              projectAllocations: JSON.stringify(projectAllocationsJson),
              contractEarnings: JSON.stringify(contractEarningsJson),
              projectId: primaryProject?.projectId || existingLine.projectId,
            },
          })

          updatedLines.push(existingLine.id)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          errors.push({ employeeId: existingLine.employeeId, name: existingLine.employeeName, error: message })
        }
      }

      // Recalculate batch totals
      await recalcBatchTotals(batchId)

      const updatedBatch = await db.payrollBatch.findUnique({
        where: { id: batchId },
        include: { lines: { orderBy: { employeeName: 'asc' } } },
      })

      return NextResponse.json({
        message: `Recalculated ${updatedLines.length} lines${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
        batch: updatedBatch,
        recalculatedCount: updatedLines.length,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // Unknown action
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })

  } catch (error) {
    console.error('Payroll POST error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// ============================================================
// PUT - Update batch metadata
// ============================================================
async function PUT_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

    const data = await request.json()
    const batch = await db.payrollBatch.findUnique({ where: { id } })
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    if (batch.status === 'voucher-created') return NextResponse.json({ error: 'Cannot modify a batch with vouchers created' }, { status: 400 })

    const updated = await db.payrollBatch.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.period && { period: data.period }),
        ...(data.projectId !== undefined && { projectId: data.projectId || null }),
      },
      include: { lines: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// ============================================================
// DELETE - Delete a batch
// ============================================================
async function DELETE_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

    const batch = await db.payrollBatch.findUnique({ where: { id } })
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    if (batch.status === 'voucher-created') return NextResponse.json({ error: 'Cannot delete a batch with vouchers created' }, { status: 400 })
    if (batch.status !== 'draft') return NextResponse.json({ error: 'Can only delete draft batches' }, { status: 400 })

    await db.payrollBatchLine.deleteMany({ where: { batchId: id } })
    await db.payrollBatch.delete({ where: { id } })

    return NextResponse.json({ message: 'Batch deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// ============================================================
// Shared Helper: Build GL Entries from batch totals
// Includes ESSI employee/employer GL entries
// ============================================================
interface GlTotals {
  totalBasicSalary: number
  totalAllowances: number
  totalGross: number
  totalIncomeTax: number
  totalEobiEmployee: number
  totalEobiEmployer: number
  totalEssiEmployee: number
  totalEssiEmployer: number
  totalPfEmployee: number
  totalPfEmployer: number
  totalLoanDeduction: number
  totalAdvanceDeduction: number
  totalOtherDeductions: number
  totalDeductions: number
  totalNetPay: number
  totalSocialCharges: number
  totalGratuity: number
  totalEmployerCharges: number
}

async function buildGlEntries(batch: { batchNumber: string; projectId: string | null }, totals: GlTotals) {
  // Use PayrollAccountMapping table to find GL accounts
  const mappings = await db.payrollAccountMapping.findMany({ where: { isActive: true } })
  const getMappedAccounts = (componentType: string) => {
    const mapping = mappings.find(m => m.componentType === componentType)
    return { debitAccountId: mapping?.debitAccountId, creditAccountId: mapping?.creditAccountId }
  }

  // Fallback: use account roles if mappings not found
  const salaryExpenseAccount = await findAccountByRole('SALARY_EXPENSE')
  const salaryPayableAccount = await findAccountByRole('SALARY_PAYABLE')
  const bankAccount = await findFirstBankAccount()
  const incomeTaxPayableAccount = await findAccountByRole('INCOME_TAX_PAYABLE')
  const eobiPayableAccount = await findAccountByRole('EOBI_PAYABLE')
  const pfPayableAccount = await findAccountByRole('PROVIDENT_FUND_PAYABLE')
  const socialChargesAccount = await findAccountByRole('SOCIAL_CHARGES')
  const socialChargesPayableAccount = await findAccountByRole('SOCIAL_CHARGES_PAYABLE')
  const gratuityPayableAccount = await findAccountByRole('GRATUITY_PAYABLE')

  const getDebitAccount = (componentType: string, fallback: { id: string } | null) => {
    const mapped = getMappedAccounts(componentType)
    return mapped.debitAccountId || fallback?.id
  }
  const getCreditAccount = (componentType: string, fallback: { id: string } | null) => {
    const mapped = getMappedAccounts(componentType)
    return mapped.creditAccountId || fallback?.id
  }

  const entries: { lineNumber: number; accountId: string; debit: number; credit: number; description: string; payrollRef: string }[] = []
  let lineNumber = 0

  const addEntry = (accountId: string | null | undefined, debit: number, credit: number, description: string) => {
    if (!accountId || (debit === 0 && credit === 0)) return
    lineNumber++
    entries.push({
      lineNumber,
      accountId,
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      description,
      payrollRef: batch.batchNumber,
    })
  }

  // 1. Dr Salary Expense / Cr Salary Payable
  addEntry(getDebitAccount('SALARY_EXPENSE', salaryExpenseAccount), totals.totalBasicSalary, 0, 'Basic salary expense')
  addEntry(getCreditAccount('SALARY_EXPENSE', salaryPayableAccount), 0, totals.totalBasicSalary, 'Basic salary payable')

  // 2. Dr Allowance Expense / Cr Allowance Payable
  if (totals.totalAllowances > 0) {
    addEntry(getDebitAccount('ALLOWANCE_EXPENSE', salaryExpenseAccount), totals.totalAllowances, 0, 'Allowances expense')
    addEntry(getCreditAccount('ALLOWANCE_EXPENSE', salaryPayableAccount), 0, totals.totalAllowances, 'Allowances payable')
  }

  // 3. Dr Social Charges Expense / Cr Social Charges Payable
  if (totals.totalSocialCharges > 0) {
    addEntry(getDebitAccount('SOCIAL_CHARGES', socialChargesAccount), totals.totalSocialCharges, 0, 'Social charges expense')
    addEntry(getCreditAccount('SOCIAL_CHARGES', socialChargesPayableAccount || eobiPayableAccount), 0, totals.totalSocialCharges, 'Social charges payable')
  }

  // 4. Dr Salary Payable / Cr Income Tax Payable
  if (totals.totalIncomeTax > 0) {
    addEntry(getDebitAccount('INCOME_TAX_PAYABLE', salaryPayableAccount), totals.totalIncomeTax, 0, 'Income tax deduction from salary')
    addEntry(getCreditAccount('INCOME_TAX_PAYABLE', incomeTaxPayableAccount), 0, totals.totalIncomeTax, 'Income tax payable')
  }

  // 5. Dr Salary Payable / Cr EOBI Payable (employee)
  if (totals.totalEobiEmployee > 0) {
    addEntry(getDebitAccount('EOBI_EMPLOYEE', salaryPayableAccount), totals.totalEobiEmployee, 0, 'EOBI employee deduction from salary')
    addEntry(getCreditAccount('EOBI_EMPLOYEE', eobiPayableAccount), 0, totals.totalEobiEmployee, 'EOBI payable (employee)')
  }

  // 6. Dr Salary Payable / Cr ESSI Payable (employee)
  if (totals.totalEssiEmployee > 0) {
    addEntry(getDebitAccount('ESSI_EMPLOYEE', salaryPayableAccount), totals.totalEssiEmployee, 0, 'ESSI employee deduction from salary')
    addEntry(getCreditAccount('ESSI_EMPLOYEE', eobiPayableAccount), 0, totals.totalEssiEmployee, 'ESSI payable (employee)')
  }

  // 7. Dr Salary Payable / Cr PF Payable (employee)
  if (totals.totalPfEmployee > 0) {
    addEntry(getDebitAccount('PF_EMPLOYEE', salaryPayableAccount), totals.totalPfEmployee, 0, 'PF employee deduction from salary')
    addEntry(getCreditAccount('PF_EMPLOYEE', pfPayableAccount), 0, totals.totalPfEmployee, 'Provident fund payable (employee)')
  }

  // 8. Dr Salary Payable / Cr Bank (for net pay)
  if (totals.totalNetPay > 0) {
    addEntry(salaryPayableAccount?.id || bankAccount?.id, totals.totalNetPay, 0, 'Net salary payable via bank')
    addEntry(bankAccount?.id, 0, totals.totalNetPay, 'Net pay bank transfer')
  }

  // 9. Employer EOBI
  if (totals.totalEobiEmployer > 0) {
    addEntry(getDebitAccount('EOBI_EMPLOYER', socialChargesAccount), totals.totalEobiEmployer, 0, 'Employer EOBI contribution expense')
    addEntry(getCreditAccount('EOBI_EMPLOYER', eobiPayableAccount), 0, totals.totalEobiEmployer, 'Employer EOBI payable')
  }

  // 10. Employer ESSI
  if (totals.totalEssiEmployer > 0) {
    addEntry(getDebitAccount('ESSI_EMPLOYER', socialChargesAccount), totals.totalEssiEmployer, 0, 'Employer ESSI contribution expense')
    addEntry(getCreditAccount('ESSI_EMPLOYER', eobiPayableAccount), 0, totals.totalEssiEmployer, 'Employer ESSI payable')
  }

  // 11. Employer PF
  if (totals.totalPfEmployer > 0) {
    addEntry(getDebitAccount('PF_EMPLOYER', socialChargesAccount), totals.totalPfEmployer, 0, 'Employer PF contribution expense')
    addEntry(getCreditAccount('PF_EMPLOYER', pfPayableAccount), 0, totals.totalPfEmployer, 'Employer PF payable')
  }

  // 12. Gratuity provision
  if (totals.totalGratuity > 0) {
    addEntry(getDebitAccount('GRATUITY', socialChargesAccount), totals.totalGratuity, 0, 'Gratuity provision expense')
    addEntry(getCreditAccount('GRATUITY', gratuityPayableAccount || salaryPayableAccount), 0, totals.totalGratuity, 'Gratuity provision payable')
  }

  // Loan deductions
  if (totals.totalLoanDeduction > 0) {
    addEntry(salaryPayableAccount?.id, totals.totalLoanDeduction, 0, 'Loan deduction from salary')
    addEntry(getCreditAccount('LOAN_DEDUCTION', salaryPayableAccount), 0, totals.totalLoanDeduction, 'Loan recovery payable')
  }

  // Advance deductions
  if (totals.totalAdvanceDeduction > 0) {
    addEntry(salaryPayableAccount?.id, totals.totalAdvanceDeduction, 0, 'Advance deduction from salary')
    addEntry(getCreditAccount('ADVANCE_DEDUCTION', salaryPayableAccount), 0, totals.totalAdvanceDeduction, 'Advance recovery payable')
  }

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

  return { entries, totalDebit, totalCredit }
}

export const POST = withAudit('payroll', POST_HANDLER);

export const PUT = withAudit('payroll', PUT_HANDLER);

export const DELETE = withAudit('payroll', DELETE_HANDLER);

export const GET = withAudit('payroll', GET_HANDLER);
