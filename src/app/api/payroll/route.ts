import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'
import { calculateMonthlyPayroll } from '@/lib/payroll/calculateMonthlyPayroll'
import { findAccountByRole, findFirstBankAccount } from '@/lib/account-roles'

// ============================================================
// Enhanced Payroll Engine API
// Supports: create batch, run-payroll, add-line, update-line,
// delete-line, review, approve, post-to-gl
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
  const filterApproved = batch && (batch.status === 'approved' || batch.status === 'posted')
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
      totalPfEmployee: acc.totalPfEmployee + l.pfEmployee,
      totalPfEmployer: acc.totalPfEmployer + l.pfEmployer,
      totalLoanDeduction: acc.totalLoanDeduction + l.loanDeduction,
      totalAdvanceDeduction: acc.totalAdvanceDeduction + l.advanceDeduction,
      totalOtherDeductions: acc.totalOtherDeductions + l.otherDeductions,
      totalDeductions: acc.totalDeductions + l.totalDeductions,
      totalNetPay: acc.totalNetPay + l.netPay,
      totalSocialCharges: acc.totalSocialCharges + l.socialCharges,
      totalGratuity: acc.totalGratuity + l.gratuity,
      totalEmployerCharges: acc.totalEmployerCharges + l.eobiEmployer + l.pfEmployer + l.socialCharges + l.gratuity,
    }),
    {
      totalBasicSalary: 0,
      totalAllowances: 0,
      totalGross: 0,
      totalIncomeTax: 0,
      totalEobiEmployee: 0,
      totalEobiEmployer: 0,
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
export async function GET(request: Request) {
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

    const where: any = {}
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
export async function POST(request: Request) {
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
    // 2. RUN PAYROLL — Uses Attendance-Driven Calculator
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

      const linesData: any[] = []
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

          linesData.push({
            batchId,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.employeeCode,
            basicSalary: result.monthlySalary,
            dailyRate: result.dailyRate,
            workingDays: result.daysInMonth,
            eligibleDays: result.eligibleDays,
            leaveDays: result.leaveDays,
            absentDays: result.absentDays,
            allowanceDetails: JSON.stringify(result.allowances.details),
            allowances: result.allowances.totalAllowances,
            grossSalary: result.grossSalary,
            incomeTax: result.deductions.incomeTax,
            eobiEmployee: result.deductions.eobiEmployee,
            eobiEmployer: result.deductions.eobiEmployer,
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
        await db.payrollBatchLine.createMany({ data: linesData })
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

      // Conditional deduction check: if employeeId is real, check EOBI/PF/IncomeTax flags
      let empFlags: { eobiEnabled: boolean; pfEnabled: boolean; incomeTaxEnabled: boolean } | null = null
      if (line.employeeId && !String(line.employeeId).startsWith('MANUAL-')) {
        const emp = await db.employee.findUnique({ where: { id: line.employeeId }, select: { eobiEnabled: true, pfEnabled: true, incomeTaxEnabled: true } })
        if (emp) empFlags = emp
      }

      const basicSalary = line.basicSalary || 0
      const allowances = line.allowances || 0
      const grossSalary = basicSalary + allowances
      const incomeTax = (empFlags && !empFlags.incomeTaxEnabled) ? 0 : (line.incomeTax || 0)
      const eobiEmployee = (empFlags && !empFlags.eobiEnabled) ? 0 : (line.eobiEmployee || 0)
      const eobiEmployer = (empFlags && !empFlags.eobiEnabled) ? 0 : (line.eobiEmployer || 0)
      const pfEmployee = (empFlags && !empFlags.pfEnabled) ? 0 : (line.pfEmployee || 0)
      const pfEmployer = (empFlags && !empFlags.pfEnabled) ? 0 : (line.pfEmployer || 0)
      const loanDeduction = line.loanDeduction || 0
      const advanceDeduction = line.advanceDeduction || 0
      const otherDeductions = line.otherDeductions || 0
      const totalDeductions = incomeTax + eobiEmployee + pfEmployee + loanDeduction + advanceDeduction + otherDeductions
      const netPay = grossSalary - totalDeductions

      const newLine = await db.payrollBatchLine.create({
        data: {
          batchId,
          employeeId: line.employeeId || `MANUAL-${Date.now()}`,
          employeeName: line.employeeName || '',
          employeeCode: line.employeeCode || null,
          basicSalary,
          dailyRate: line.dailyRate || 0,
          workingDays: line.workingDays || 0,
          eligibleDays: line.eligibleDays || 0,
          leaveDays: line.leaveDays || 0,
          absentDays: line.absentDays || 0,
          allowanceDetails: line.allowanceDetails || null,
          allowances,
          grossSalary,
          incomeTax,
          eobiEmployee,
          eobiEmployer,
          pfEmployee,
          pfEmployer,
          loanDeduction,
          advanceDeduction,
          otherDeductions,
          totalDeductions,
          netPay,
          socialCharges: line.socialCharges || 0,
          gratuity: line.gratuity || 0,
          scBreakdown: line.scBreakdown || null,
          taxBreakdown: line.taxBreakdown || null,
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

      // Conditional deduction check: if employeeId is real, check EOBI/PF/IncomeTax flags
      let empFlags: { eobiEnabled: boolean; pfEnabled: boolean; incomeTaxEnabled: boolean } | null = null
      const empId = line.employeeId || existingLine.employeeId
      if (empId && !String(empId).startsWith('MANUAL-')) {
        const emp = await db.employee.findUnique({ where: { id: empId }, select: { eobiEnabled: true, pfEnabled: true, incomeTaxEnabled: true } })
        if (emp) empFlags = emp
      }

      const basicSalary = line.basicSalary ?? existingLine.basicSalary
      const allowances = line.allowances ?? existingLine.allowances
      const grossSalary = basicSalary + allowances
      const rawIncomeTax = line.incomeTax ?? existingLine.incomeTax
      const rawEobiEmployee = line.eobiEmployee ?? existingLine.eobiEmployee
      const rawEobiEmployer = line.eobiEmployer ?? existingLine.eobiEmployer
      const rawPfEmployee = line.pfEmployee ?? existingLine.pfEmployee
      const rawPfEmployer = line.pfEmployer ?? existingLine.pfEmployer
      const incomeTax = (empFlags && !empFlags.incomeTaxEnabled) ? 0 : rawIncomeTax
      const eobiEmployee = (empFlags && !empFlags.eobiEnabled) ? 0 : rawEobiEmployee
      const eobiEmployer = (empFlags && !empFlags.eobiEnabled) ? 0 : rawEobiEmployer
      const pfEmployee = (empFlags && !empFlags.pfEnabled) ? 0 : rawPfEmployee
      const pfEmployer = (empFlags && !empFlags.pfEnabled) ? 0 : rawPfEmployer
      const loanDeduction = line.loanDeduction ?? existingLine.loanDeduction
      const advanceDeduction = line.advanceDeduction ?? existingLine.advanceDeduction
      const otherDeductions = line.otherDeductions ?? existingLine.otherDeductions
      const totalDeductions = incomeTax + eobiEmployee + pfEmployee + loanDeduction + advanceDeduction + otherDeductions
      const netPay = grossSalary - totalDeductions

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
          absentDays: line.absentDays ?? existingLine.absentDays,
          allowanceDetails: line.allowanceDetails !== undefined ? line.allowanceDetails : existingLine.allowanceDetails,
          allowances,
          grossSalary,
          incomeTax,
          eobiEmployee,
          eobiEmployer,
          pfEmployee,
          pfEmployer,
          loanDeduction,
          advanceDeduction,
          otherDeductions,
          totalDeductions,
          netPay,
          socialCharges: line.socialCharges ?? existingLine.socialCharges,
          gratuity: line.gratuity ?? existingLine.gratuity,
          scBreakdown: line.scBreakdown !== undefined ? line.scBreakdown : existingLine.scBreakdown,
          taxBreakdown: line.taxBreakdown !== undefined ? line.taxBreakdown : existingLine.taxBreakdown,
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
    // 9a. APPROVE LINE — Approve individual line(s)
    // ----------------------------------------------------------
    if (action === 'approve-line') {
      const { lineId, lineIds } = data
      const ids: string[] = lineIds || (lineId ? [lineId] : [])
      if (ids.length === 0) return NextResponse.json({ error: 'lineId or lineIds required' }, { status: 400 })

      // Verify all lines exist and belong to batches with valid status
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

      // Recalc totals for affected batches
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
    // 9c. DRAFT TO GL — Post only approved lines to GL (creates a draft voucher)
    // ----------------------------------------------------------
    if (action === 'draft-to-gl') {
      const { batchId, financialYearId, lineIds } = data
      if (!batchId) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })
      if (!financialYearId) return NextResponse.json({ error: 'Financial Year ID required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({ where: { id: batchId } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.postedToGL) return NextResponse.json({ error: 'Already posted to GL' }, { status: 400 })

      // Determine which lines to include
      const lineFilter: any = lineIds?.length > 0
        ? { id: { in: lineIds }, lineStatus: 'approved' }
        : { lineStatus: 'approved' }
      lineFilter.batchId = batchId

      const approvedLines = await db.payrollBatchLine.findMany({ where: lineFilter })
      if (approvedLines.length === 0) {
        return NextResponse.json({ error: 'No approved lines found to post' }, { status: 400 })
      }

      // Calculate totals from approved lines only
      const totals = approvedLines.reduce(
        (acc, l) => ({
          totalBasicSalary: acc.totalBasicSalary + l.basicSalary,
          totalAllowances: acc.totalAllowances + l.allowances,
          totalGross: acc.totalGross + l.grossSalary,
          totalIncomeTax: acc.totalIncomeTax + l.incomeTax,
          totalEobiEmployee: acc.totalEobiEmployee + l.eobiEmployee,
          totalEobiEmployer: acc.totalEobiEmployer + l.eobiEmployer,
          totalPfEmployee: acc.totalPfEmployee + l.pfEmployee,
          totalPfEmployer: acc.totalPfEmployer + l.pfEmployer,
          totalLoanDeduction: acc.totalLoanDeduction + l.loanDeduction,
          totalAdvanceDeduction: acc.totalAdvanceDeduction + l.advanceDeduction,
          totalOtherDeductions: acc.totalOtherDeductions + l.otherDeductions,
          totalDeductions: acc.totalDeductions + l.totalDeductions,
          totalNetPay: acc.totalNetPay + l.netPay,
          totalSocialCharges: acc.totalSocialCharges + l.socialCharges,
          totalGratuity: acc.totalGratuity + l.gratuity,
          totalEmployerCharges: acc.totalEmployerCharges + l.eobiEmployer + l.pfEmployer + l.socialCharges + l.gratuity,
        }),
        {
          totalBasicSalary: 0, totalAllowances: 0, totalGross: 0, totalIncomeTax: 0,
          totalEobiEmployee: 0, totalEobiEmployer: 0, totalPfEmployee: 0, totalPfEmployer: 0,
          totalLoanDeduction: 0, totalAdvanceDeduction: 0, totalOtherDeductions: 0, totalDeductions: 0,
          totalNetPay: 0, totalSocialCharges: 0, totalGratuity: 0, totalEmployerCharges: 0,
        }
      )

      // Use PayrollAccountMapping table to find GL accounts
      const mappings = await db.payrollAccountMapping.findMany({ where: { isActive: true } })
      const getMappedAccounts = (componentType: string) => {
        const mapping = mappings.find(m => m.componentType === componentType)
        return { debitAccountId: mapping?.debitAccountId, creditAccountId: mapping?.creditAccountId }
      }

      const salaryExpenseAccount = await findAccountByRole('SALARY_EXPENSE')
      const salaryPayableAccount = await findAccountByRole('SALARY_PAYABLE')
      const bankAccount = await findFirstBankAccount()
      const incomeTaxPayableAccount = await findAccountByRole('INCOME_TAX_PAYABLE')
      const eobiPayableAccount = await findAccountByRole('EOBI_PAYABLE')
      const pfPayableAccount = await findAccountByRole('PROVIDENT_FUND_PAYABLE')
      const socialChargesAccount = await findAccountByRole('SOCIAL_CHARGES')
      const socialChargesPayableAccount = await findAccountByRole('SOCIAL_CHARGES_PAYABLE')

      const getDebitAccount = (componentType: string, fallback: any) => {
        const mapped = getMappedAccounts(componentType)
        return mapped.debitAccountId || fallback?.id
      }
      const getCreditAccount = (componentType: string, fallback: any) => {
        const mapped = getMappedAccounts(componentType)
        return mapped.creditAccountId || fallback?.id
      }

      const entries: any[] = []
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

      // 6. Dr Salary Payable / Cr PF Payable (employee)
      if (totals.totalPfEmployee > 0) {
        addEntry(getDebitAccount('PF_EMPLOYEE', salaryPayableAccount), totals.totalPfEmployee, 0, 'PF employee deduction from salary')
        addEntry(getCreditAccount('PF_EMPLOYEE', pfPayableAccount), 0, totals.totalPfEmployee, 'Provident fund payable (employee)')
      }

      // 7. Dr Salary Payable / Cr Bank (for net pay)
      if (totals.totalNetPay > 0) {
        addEntry(salaryPayableAccount?.id || bankAccount?.id, totals.totalNetPay, 0, 'Net salary payable via bank')
        addEntry(bankAccount?.id, 0, totals.totalNetPay, 'Net pay bank transfer')
      }

      // 8. Employer EOBI
      if (totals.totalEobiEmployer > 0) {
        addEntry(getDebitAccount('EOBI_EMPLOYER', socialChargesAccount), totals.totalEobiEmployer, 0, 'Employer EOBI contribution expense')
        addEntry(getCreditAccount('EOBI_EMPLOYER', eobiPayableAccount), 0, totals.totalEobiEmployer, 'Employer EOBI payable')
      }

      // 9. Employer PF
      if (totals.totalPfEmployer > 0) {
        addEntry(getDebitAccount('PF_EMPLOYER', socialChargesAccount), totals.totalPfEmployer, 0, 'Employer PF contribution expense')
        addEntry(getCreditAccount('PF_EMPLOYER', pfPayableAccount), 0, totals.totalPfEmployer, 'Employer PF payable')
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

      if (entries.length === 0) {
        return NextResponse.json({ error: 'No journal entries could be created. Check GL account mappings.' }, { status: 400 })
      }

      const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
      const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

      // Create a DRAFT voucher (not posted)
      const voucher = await db.voucher.create({
        data: {
          voucherNumber: `JV-PAYROLL-${batch.batchNumber}`,
          voucherType: 'JV',
          voucherTypeName: 'Journal Voucher',
          date: new Date(),
          narration: `Payroll draft posting for batch ${batch.batchNumber} - ${batch.name} (approved lines only)`,
          status: 'draft',
          financialYearId,
          projectId: batch.projectId,
          isPayrollPosted: true,
          totalDebit,
          totalCredit,
          createdBy: 'system',
          entries: { create: entries },
        },
      })

      // Audit cross-charging for approved lines
      for (const line of approvedLines) {
        if (line.projectId && line.projectId !== batch.projectId) {
          await db.auditLog.create({
            data: {
              userId: await getSystemUserId(),
              action: 'CREATE',
              entity: 'VoucherEntry',
              entityId: voucher.id,
              details: `Cross-charged salary to project ${line.projectId}: ${line.grossSalary}`,
            },
          })
        }
      }

      // Mark batch as posted
      await db.payrollBatch.update({
        where: { id: batchId },
        data: {
          postedToGL: true, postedVoucherId: voucher.id, status: 'posted', postedBy: 'system',
        },
      })

      return NextResponse.json({
        message: 'Payroll draft posted to GL (approved lines only)',
        voucherId: voucher.id,
        voucherNumber: voucher.voucherNumber,
        voucherStatus: 'draft',
        totalDebit, totalCredit,
        entryCount: entries.length,
        approvedLineCount: approvedLines.length,
      })
    }

    // ----------------------------------------------------------
    // 9. POST TO GL — Post approved batch to GL (creates voucher)
    // ----------------------------------------------------------
    if (action === 'post-to-gl') {
      const { batchId, financialYearId } = data
      if (!batchId) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({
        where: { id: batchId },
        include: { lines: true },
      })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.status !== 'approved') return NextResponse.json({ error: 'Only approved batches can be posted to GL' }, { status: 400 })
      if (batch.postedToGL) return NextResponse.json({ error: 'Already posted to GL' }, { status: 400 })

      // Check that all lines have lineStatus = 'approved'
      const unapprovedLines = batch.lines.filter(l => l.lineStatus !== 'approved')
      if (unapprovedLines.length > 0) {
        return NextResponse.json({ error: `All lines must be approved before posting to GL. ${unapprovedLines.length} line(s) still in '${unapprovedLines[0].lineStatus}' status` }, { status: 400 })
      }

      if (!financialYearId) {
        return NextResponse.json({ error: 'Financial Year ID required' }, { status: 400 })
      }

      // Use PayrollAccountMapping table to find GL accounts
      const mappings = await db.payrollAccountMapping.findMany({
        where: { isActive: true },
      })

      const getMappedAccounts = (componentType: string) => {
        const mapping = mappings.find(m => m.componentType === componentType)
        return {
          debitAccountId: mapping?.debitAccountId,
          creditAccountId: mapping?.creditAccountId,
        }
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

      const getDebitAccount = (componentType: string, fallback: any) => {
        const mapped = getMappedAccounts(componentType)
        return mapped.debitAccountId || fallback?.id
      }
      const getCreditAccount = (componentType: string, fallback: any) => {
        const mapped = getMappedAccounts(componentType)
        return mapped.creditAccountId || fallback?.id
      }

      const entries: any[] = []
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

      // 1. Dr Salary Expense / Cr Salary Payable (for basic salary)
      addEntry(
        getDebitAccount('SALARY_EXPENSE', salaryExpenseAccount),
        batch.totalBasicSalary, 0,
        'Basic salary expense'
      )
      addEntry(
        getCreditAccount('SALARY_EXPENSE', salaryPayableAccount),
        0, batch.totalBasicSalary,
        'Basic salary payable'
      )

      // 2. Dr Allowance Expense / Cr Allowance Payable
      if (batch.totalAllowances > 0) {
        addEntry(
          getDebitAccount('ALLOWANCE_EXPENSE', salaryExpenseAccount),
          batch.totalAllowances, 0,
          'Allowances expense'
        )
        addEntry(
          getCreditAccount('ALLOWANCE_EXPENSE', salaryPayableAccount),
          0, batch.totalAllowances,
          'Allowances payable'
        )
      }

      // 3. Dr Social Charges Expense / Cr Social Charges Payable
      if (batch.totalSocialCharges > 0) {
        addEntry(
          getDebitAccount('SOCIAL_CHARGES', socialChargesAccount),
          batch.totalSocialCharges, 0,
          'Social charges expense'
        )
        addEntry(
          getCreditAccount('SOCIAL_CHARGES', socialChargesPayableAccount || eobiPayableAccount),
          0, batch.totalSocialCharges,
          'Social charges payable'
        )
      }

      // 4. Dr Salary Payable / Cr Income Tax Payable
      if (batch.totalIncomeTax > 0) {
        addEntry(
          getDebitAccount('INCOME_TAX_PAYABLE', salaryPayableAccount),
          batch.totalIncomeTax, 0,
          'Income tax deduction from salary'
        )
        addEntry(
          getCreditAccount('INCOME_TAX_PAYABLE', incomeTaxPayableAccount),
          0, batch.totalIncomeTax,
          'Income tax payable'
        )
      }

      // 5. Dr Salary Payable / Cr EOBI Payable (employee)
      if (batch.totalEobiEmployee > 0) {
        addEntry(
          getDebitAccount('EOBI_EMPLOYEE', salaryPayableAccount),
          batch.totalEobiEmployee, 0,
          'EOBI employee deduction from salary'
        )
        addEntry(
          getCreditAccount('EOBI_EMPLOYEE', eobiPayableAccount),
          0, batch.totalEobiEmployee,
          'EOBI payable (employee)'
        )
      }

      // 6. Dr Salary Payable / Cr PF Payable (employee)
      if (batch.totalPfEmployee > 0) {
        addEntry(
          getDebitAccount('PF_EMPLOYEE', salaryPayableAccount),
          batch.totalPfEmployee, 0,
          'PF employee deduction from salary'
        )
        addEntry(
          getCreditAccount('PF_EMPLOYEE', pfPayableAccount),
          0, batch.totalPfEmployee,
          'Provident fund payable (employee)'
        )
      }

      // 7. Dr Salary Payable / Cr Bank (for net pay)
      if (batch.totalNetPay > 0) {
        addEntry(
          salaryPayableAccount?.id || bankAccount?.id,
          batch.totalNetPay, 0,
          'Net salary payable via bank'
        )
        addEntry(
          bankAccount?.id,
          0, batch.totalNetPay,
          'Net pay bank transfer'
        )
      }

      // 8. Employer EOBI
      if (batch.totalEobiEmployer > 0) {
        addEntry(
          getDebitAccount('EOBI_EMPLOYER', socialChargesAccount),
          batch.totalEobiEmployer, 0,
          'Employer EOBI contribution expense'
        )
        addEntry(
          getCreditAccount('EOBI_EMPLOYER', eobiPayableAccount),
          0, batch.totalEobiEmployer,
          'Employer EOBI payable'
        )
      }

      // 9. Employer PF
      if (batch.totalPfEmployer > 0) {
        addEntry(
          getDebitAccount('PF_EMPLOYER', socialChargesAccount),
          batch.totalPfEmployer, 0,
          'Employer PF contribution expense'
        )
        addEntry(
          getCreditAccount('PF_EMPLOYER', pfPayableAccount),
          0, batch.totalPfEmployer,
          'Employer PF payable'
        )
      }

      // Loan deductions
      if (batch.totalLoanDeduction > 0) {
        addEntry(
          salaryPayableAccount?.id,
          batch.totalLoanDeduction, 0,
          'Loan deduction from salary'
        )
        addEntry(
          getCreditAccount('LOAN_DEDUCTION', salaryPayableAccount),
          0, batch.totalLoanDeduction,
          'Loan recovery payable'
        )
      }

      // Advance deductions
      if (batch.totalAdvanceDeduction > 0) {
        addEntry(
          salaryPayableAccount?.id,
          batch.totalAdvanceDeduction, 0,
          'Advance deduction from salary'
        )
        addEntry(
          getCreditAccount('ADVANCE_DEDUCTION', salaryPayableAccount),
          0, batch.totalAdvanceDeduction,
          'Advance recovery payable'
        )
      }

      // Validate entries exist
      if (entries.length === 0) {
        return NextResponse.json({ error: 'No journal entries could be created. Check GL account mappings.' }, { status: 400 })
      }

      const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
      const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

      // Create the voucher
      const voucher = await db.voucher.create({
        data: {
          voucherNumber: `JV-PAYROLL-${batch.batchNumber}`,
          voucherType: 'JV',
          voucherTypeName: 'Journal Voucher',
          date: new Date(),
          narration: `Payroll posting for batch ${batch.batchNumber} - ${batch.name}`,
          status: 'draft',
          financialYearId,
          projectId: batch.projectId,
          isPayrollPosted: true,
          totalDebit,
          totalCredit,
          createdBy: 'system',
          entries: { create: entries },
        },
      })

      // Audit cross-charging
      for (const line of batch.lines) {
        if (line.projectId && line.projectId !== batch.projectId) {
          await db.auditLog.create({
            data: {
              userId: await getSystemUserId(),
              action: 'CREATE',
              entity: 'VoucherEntry',
              entityId: voucher.id,
              details: `Cross-charged salary to project ${line.projectId}: ${line.grossSalary}`,
            },
          })
        }
      }

      // Mark batch as posted
      await db.payrollBatch.update({
        where: { id: batchId },
        data: {
          postedToGL: true,
          postedVoucherId: voucher.id,
          status: 'posted',
          postedBy: 'system',
        },
      })

      return NextResponse.json({
        message: 'Payroll posted to GL',
        voucherId: voucher.id,
        voucherNumber: voucher.voucherNumber,
        totalDebit,
        totalCredit,
        entryCount: entries.length,
      })
    }

    // ----------------------------------------------------------
    // 10. DRAFT TO GL — Alias handled above (kept for completeness)
    // ----------------------------------------------------------

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
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

    const data = await request.json()
    const batch = await db.payrollBatch.findUnique({ where: { id } })
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    if (batch.postedToGL) return NextResponse.json({ error: 'Cannot modify a posted batch' }, { status: 400 })

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
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

    const batch = await db.payrollBatch.findUnique({ where: { id } })
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    if (batch.postedToGL) return NextResponse.json({ error: 'Cannot delete a posted batch' }, { status: 400 })
    if (batch.status !== 'draft') return NextResponse.json({ error: 'Can only delete draft batches' }, { status: 400 })

    await db.payrollBatchLine.deleteMany({ where: { batchId: id } })
    await db.payrollBatch.delete({ where: { id } })

    return NextResponse.json({ message: 'Batch deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
