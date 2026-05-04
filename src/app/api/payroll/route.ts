import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

// Helper: recalculate batch totals from all lines
async function recalcBatchTotals(batchId: string) {
  const lines = await db.payrollBatchLine.findMany({ where: { batchId } })

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
    // 2. RUN PAYROLL — THE MOST CRITICAL ACTION
    // ----------------------------------------------------------
    if (action === 'run-payroll') {
      const { batchId } = data
      if (!batchId) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({ where: { id: batchId } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.status !== 'draft') {
        return NextResponse.json({ error: 'Payroll can only be run on draft batches' }, { status: 400 })
      }

      const { startDate, endDate } = getPeriodDates(batch.period)
      const daysInMonth = getDaysInMonth(batch.period)

      // Step 1: Load all active employees for the period/project
      const employeeWhere: any = { status: 'active' }
      if (batch.projectId) {
        // Get employees assigned to this project
        const assignments = await db.employeeProjectAssignment.findMany({
          where: {
            projectId: batch.projectId,
            isActive: true,
            startDate: { lte: endDate },
            OR: [
              { endDate: null },
              { endDate: { gte: startDate } },
            ],
          },
          select: { employeeId: true },
        })
        employeeWhere.id = { in: assignments.map(a => a.employeeId) }
      }

      const employees = await db.employee.findMany({ where: employeeWhere })

      if (employees.length === 0) {
        return NextResponse.json({ error: 'No active employees found for this period/project' }, { status: 400 })
      }

      // Load tax slabs for the current fiscal year (try "2024-25" or "2025-26")
      const taxSlabs = await db.taxSlab.findMany({
        where: { isActive: true },
        orderBy: { slabOrder: 'asc' },
      })

      // Delete existing lines for this batch (re-run)
      await db.payrollBatchLine.deleteMany({ where: { batchId } })

      const linesData: any[] = []

      // Step 2 & 3: For each employee, load data and calculate
      for (const emp of employees) {
        // a) Daily Rate
        const basicSalary = emp.baseSalary || 0
        const dailyRate = daysInMonth > 0 ? basicSalary / daysInMonth : 0

        // b) Attendance records
        const attendanceRecords = await db.attendance.findMany({
          where: {
            employeeId: emp.id,
            date: { gte: startDate, lte: endDate },
          },
        })

        // Count attendance statuses
        const eligibleStatuses = ['P', 'W', 'H', 'T', 'WH', 'WW', 'CL', 'SL', 'EL']
        const leaveStatuses = ['CL', 'SL']  // Only CL+SL trigger SC deduction (not EL, not CO)
        const absentStatuses = ['A', 'CD']

        const eligibleDays = attendanceRecords.filter(a => eligibleStatuses.includes(a.status)).length
        const leaveDays = attendanceRecords.filter(a => leaveStatuses.includes(a.status)).length
        const absentDays = attendanceRecords.filter(a => absentStatuses.includes(a.status)).length
        const workingDays = daysInMonth  // Always days in month (28-31)

        // If no attendance records, assume full month present
        const finalEligibleDays = attendanceRecords.length > 0 ? eligibleDays : daysInMonth
        const finalLeaveDays = attendanceRecords.length > 0 ? leaveDays : 0
        const finalAbsentDays = attendanceRecords.length > 0 ? absentDays : 0
        const finalWorkingDays = daysInMonth  // Always days in month

        // c) Allowances
        const empAllowances = await db.employeeAllowance.findMany({
          where: {
            employeeId: emp.id,
            isActive: true,
            effectiveDate: { lte: endDate },
          },
          include: { allowance: true },
        })

        const allowanceDetailsArr: { allowanceId: string; name: string; amount: number; isTaxable: boolean }[] = []
        let totalAllowances = 0
        let taxFreeAllowances = 0

        for (const ea of empAllowances) {
          const amount = ea.customValue !== null && ea.customValue !== undefined
            ? ea.customValue
            : ea.allowance.value

          let finalAmount = amount
          if (ea.allowance.allowanceType === 'percentage') {
            finalAmount = (basicSalary * amount) / 100
          }

          allowanceDetailsArr.push({
            allowanceId: ea.allowanceId,
            name: ea.allowance.name,
            amount: finalAmount,
            isTaxable: ea.allowance.isTaxable,
          })

          totalAllowances += finalAmount
          if (!ea.allowance.isTaxable) {
            taxFreeAllowances += finalAmount
          }
        }

        // d) Gross Salary
        const grossSalary = basicSalary + totalAllowances

        // e) Social Charges (SC) calculation (20% of salary)
        const monthlySC = basicSalary * 0.20
        const workingRatio = daysInMonth > 0 ? finalEligibleDays / daysInMonth : 0
        const earnedSC = monthlySC * workingRatio
        const leaveDeductionSC = dailyRate * finalLeaveDays
        const finalSC = Math.max(0, earnedSC - leaveDeductionSC)

        const scBreakdown = {
          monthlySC,
          workingRatio: Math.round(workingRatio * 10000) / 10000,
          earnedSC: Math.round(earnedSC * 100) / 100,
          leaveDeduction: Math.round(leaveDeductionSC * 100) / 100,
          finalSC: Math.round(finalSC * 100) / 100,
        }

        // f) EOBI: Employee 1% of basic, Employer 5% of basic (capped at minimum wage)
        const EOBI_MIN_WAGE_CAP = 32000 // PKR minimum wage cap for EOBI
        const eobiBase = Math.min(basicSalary, EOBI_MIN_WAGE_CAP)
        const eobiEmployee = Math.round(eobiBase * 0.01 * 100) / 100
        const eobiEmployer = Math.round(eobiBase * 0.05 * 100) / 100

        // g) Provident Fund: Employee 8.33% of basic, Employer 8.33% of basic
        const pfEmployee = Math.round(basicSalary * 0.0833 * 100) / 100
        const pfEmployer = Math.round(basicSalary * 0.0833 * 100) / 100

        // h) Income Tax: Calculate using tax slabs
        let incomeTax = 0
        let taxBreakdownData: any = { taxableIncome: 0, taxSlab: '', fixedTax: 0, variableTax: 0, monthlyTax: 0 }

        if (taxSlabs.length > 0 && grossSalary > 0) {
          const annualTaxableIncome = (grossSalary - taxFreeAllowances) * 12
          taxBreakdownData.taxableIncome = annualTaxableIncome

          // Find applicable slab
          let applicableSlab = taxSlabs[taxSlabs.length - 1] // default to last slab
          for (const slab of taxSlabs) {
            if (annualTaxableIncome >= slab.minAmount && (slab.maxAmount === null || annualTaxableIncome <= slab.maxAmount)) {
              applicableSlab = slab
              break
            }
          }

          taxBreakdownData.taxSlab = `PKR ${applicableSlab.minAmount.toLocaleString()} - ${applicableSlab.maxAmount ? 'PKR ' + applicableSlab.maxAmount.toLocaleString() : 'Above'}`
          taxBreakdownData.fixedTax = applicableSlab.fixedAmount

          const variableTax = (annualTaxableIncome - applicableSlab.minAmount) * applicableSlab.rate / 100
          taxBreakdownData.variableTax = Math.round(variableTax * 100) / 100

          const annualTax = applicableSlab.fixedAmount + variableTax
          incomeTax = Math.round((annualTax / 12) * 100) / 100
          taxBreakdownData.monthlyTax = incomeTax
        }

        // i) Loan deduction
        const activeLoans = await db.loan.findMany({
          where: {
            employeeId: emp.id,
            status: 'active',
            isDisbursed: true,
            startDate: { lte: endDate },
          },
        })
        const loanDeduction = activeLoans.reduce((sum, loan) => sum + loan.monthlyDeduction, 0)

        // j) Total Deductions
        const advanceDeduction = 0 // Manual entry
        const otherDeductions = 0 // Manual entry
        const totalDeductions = incomeTax + eobiEmployee + pfEmployee + loanDeduction + advanceDeduction + otherDeductions

        // k) Net Pay
        const netPay = grossSalary - totalDeductions

        // Gratuity
        const gratuity = Math.round(basicSalary * 0.0833 * 100) / 100 // 8.33% gratuity

        // Determine project from employee assignment
        let lineProjectId = batch.projectId
        if (!lineProjectId && emp.defaultProjectId) {
          lineProjectId = emp.defaultProjectId
        }

        linesData.push({
          batchId,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeCode: emp.employeeCode,
          basicSalary,
          dailyRate: Math.round(dailyRate * 100) / 100,
          workingDays: finalWorkingDays,
          eligibleDays: finalEligibleDays,
          leaveDays: finalLeaveDays,
          absentDays: finalAbsentDays,
          allowanceDetails: JSON.stringify(allowanceDetailsArr),
          allowances: Math.round(totalAllowances * 100) / 100,
          grossSalary: Math.round(grossSalary * 100) / 100,
          incomeTax,
          eobiEmployee,
          eobiEmployer,
          pfEmployee,
          pfEmployer,
          loanDeduction: Math.round(loanDeduction * 100) / 100,
          advanceDeduction,
          otherDeductions,
          totalDeductions: Math.round(totalDeductions * 100) / 100,
          netPay: Math.round(netPay * 100) / 100,
          socialCharges: Math.round(finalSC * 100) / 100,
          gratuity,
          scBreakdown: JSON.stringify(scBreakdown),
          taxBreakdown: JSON.stringify(taxBreakdownData),
          projectId: lineProjectId,
          department: emp.department,
        })
      }

      // Step 4: Create PayrollBatchLine for each employee
      await db.payrollBatchLine.createMany({ data: linesData })

      // Step 5: Update PayrollBatch totals
      await recalcBatchTotals(batchId)

      const updatedBatch = await db.payrollBatch.findUnique({
        where: { id: batchId },
        include: { lines: { orderBy: { employeeName: 'asc' } } },
      })

      return NextResponse.json({
        message: `Payroll processed for ${employees.length} employees`,
        batch: updatedBatch,
        employeeCount: employees.length,
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

      const basicSalary = line.basicSalary || 0
      const allowances = line.allowances || 0
      const grossSalary = basicSalary + allowances
      const incomeTax = line.incomeTax || 0
      const eobiEmployee = line.eobiEmployee || 0
      const pfEmployee = line.pfEmployee || 0
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
          eobiEmployer: line.eobiEmployer || 0,
          pfEmployee,
          pfEmployer: line.pfEmployer || 0,
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

      const basicSalary = line.basicSalary ?? existingLine.basicSalary
      const allowances = line.allowances ?? existingLine.allowances
      const grossSalary = basicSalary + allowances
      const incomeTax = line.incomeTax ?? existingLine.incomeTax
      const eobiEmployee = line.eobiEmployee ?? existingLine.eobiEmployee
      const pfEmployee = line.pfEmployee ?? existingLine.pfEmployee
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
          eobiEmployer: line.eobiEmployer ?? existingLine.eobiEmployer,
          pfEmployee,
          pfEmployer: line.pfEmployer ?? existingLine.pfEmployer,
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

      // Helper to get debit/credit accounts with mapping fallback
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

      // 8. Dr EOBI Payable / Cr EOBI Payable (employer contribution) — Employer EOBI
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

      // 9. Dr PF Payable / Cr PF Payable (employer contribution) — Employer PF
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
              userId: 'system',
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
