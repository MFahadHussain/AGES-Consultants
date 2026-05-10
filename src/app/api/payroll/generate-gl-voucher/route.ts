import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findAccountByRole, findFirstBankAccount } from '@/lib/account-roles'

// ============================================================
// GL Voucher Generation API
// Supports: consolidated, project-wise, sc-only modes
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

// Project allocation structure from JSON
interface ProjectAllocation {
  projectId: string
  projectName: string
  projectCode: string
  days: number
  weight: number
  weightPct: number
  salaryShare: number
  scShare: number
}

// Contract earning structure from JSON
interface ContractEarning {
  assignmentId: string
  projectId: string
  projectName: string
  projectCode: string
  contractSalary: number
  dailyRate: number
  daysWorked: number
  earnedSalary: number
  absentDays: number
  designation: string
  scShare: number
}

// Employee line contribution for project-wise breakdown
interface EmployeeLineContribution {
  empId: string
  empName: string
  empCode: string
  days: number
  ratio: string
  earned: number
  sc: number
}

// -----------------------------------------------------------
// Build GL entries from totals — same pattern as payroll/route.ts
// -----------------------------------------------------------
async function buildGlEntries(
  batchRef: string,
  totals: GlTotals,
  options?: { projectId?: string | null }
) {
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

  const entries: {
    lineNumber: number
    accountId: string
    debit: number
    credit: number
    description: string
    payrollRef: string
    projectId?: string | null
  }[] = []
  let lineNumber = 0

  const addEntry = (
    accountId: string | null | undefined,
    debit: number,
    credit: number,
    description: string
  ) => {
    if (!accountId || (debit === 0 && credit === 0)) return
    lineNumber++
    entries.push({
      lineNumber,
      accountId,
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      description,
      payrollRef: batchRef,
      projectId: options?.projectId ?? null,
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

// -----------------------------------------------------------
// Build project-specific GL entries (for project-wise mode)
// -----------------------------------------------------------
async function buildProjectGlEntries(
  batchRef: string,
  totals: GlTotals,
  projectCode: string,
  projectId: string
) {
  // Use PayrollAccountMapping table to find GL accounts
  const mappings = await db.payrollAccountMapping.findMany({ where: { isActive: true } })
  const getMappedAccounts = (componentType: string) => {
    const mapping = mappings.find(m => m.componentType === componentType)
    return { debitAccountId: mapping?.debitAccountId, creditAccountId: mapping?.creditAccountId }
  }

  // Fallback: use account roles if mappings not found
  const salaryExpenseAccount = await findAccountByRole('SALARY_EXPENSE')
  const salaryPayableAccount = await findAccountByRole('SALARY_PAYABLE')
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

  const projLabel = ` [${projectCode}]`
  const entries: {
    lineNumber: number
    accountId: string
    debit: number
    credit: number
    description: string
    payrollRef: string
    projectId: string
  }[] = []
  let lineNumber = 0

  const addEntry = (
    accountId: string | null | undefined,
    debit: number,
    credit: number,
    description: string
  ) => {
    if (!accountId || (debit === 0 && credit === 0)) return
    lineNumber++
    entries.push({
      lineNumber,
      accountId,
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      description: description + projLabel,
      payrollRef: batchRef,
      projectId,
    })
  }

  // DR lines — Expense accounts
  // Salary Expense
  addEntry(getDebitAccount('SALARY_EXPENSE', salaryExpenseAccount), totals.totalBasicSalary, 0, 'Salary expense')
  // Allowance Expense
  if (totals.totalAllowances > 0) {
    addEntry(getDebitAccount('ALLOWANCE_EXPENSE', salaryExpenseAccount), totals.totalAllowances, 0, 'Allowances expense')
  }
  // EOBI Expense Employer
  if (totals.totalEobiEmployer > 0) {
    addEntry(getDebitAccount('EOBI_EMPLOYER', socialChargesAccount), totals.totalEobiEmployer, 0, 'EOBI expense employer')
  }
  // PF Expense Employer
  if (totals.totalPfEmployer > 0) {
    addEntry(getDebitAccount('PF_EMPLOYER', socialChargesAccount), totals.totalPfEmployer, 0, 'PF expense employer')
  }
  // Gratuity Expense
  if (totals.totalGratuity > 0) {
    addEntry(getDebitAccount('GRATUITY', socialChargesAccount), totals.totalGratuity, 0, 'Gratuity expense')
  }
  // SC Expense (social charges)
  if (totals.totalSocialCharges > 0) {
    addEntry(getDebitAccount('SOCIAL_CHARGES', socialChargesAccount), totals.totalSocialCharges, 0, 'Social charges expense')
  }
  // ESSI Employer Expense
  if (totals.totalEssiEmployer > 0) {
    addEntry(getDebitAccount('ESSI_EMPLOYER', socialChargesAccount), totals.totalEssiEmployer, 0, 'ESSI expense employer')
  }

  // CR lines — Liability / Payable accounts
  // Salaries Payable (net pay)
  if (totals.totalNetPay > 0) {
    addEntry(getCreditAccount('SALARY_EXPENSE', salaryPayableAccount), 0, totals.totalNetPay, 'Salaries payable')
  }
  // EOBI Payable (employee + employer)
  const totalEobi = totals.totalEobiEmployee + totals.totalEobiEmployer
  if (totalEobi > 0) {
    addEntry(getCreditAccount('EOBI_EMPLOYER', eobiPayableAccount), 0, totalEobi, 'EOBI payable')
  }
  // PF Payable (employee + employer)
  const totalPf = totals.totalPfEmployee + totals.totalPfEmployer
  if (totalPf > 0) {
    addEntry(getCreditAccount('PF_EMPLOYER', pfPayableAccount), 0, totalPf, 'PF payable')
  }
  // Income Tax Payable
  if (totals.totalIncomeTax > 0) {
    addEntry(getCreditAccount('INCOME_TAX_PAYABLE', incomeTaxPayableAccount), 0, totals.totalIncomeTax, 'Income tax payable')
  }
  // SC Payable (social charges)
  if (totals.totalSocialCharges > 0) {
    addEntry(getCreditAccount('SOCIAL_CHARGES', socialChargesPayableAccount || eobiPayableAccount), 0, totals.totalSocialCharges, 'SC payable')
  }
  // ESSI Payable (employee + employer)
  const totalEssi = totals.totalEssiEmployee + totals.totalEssiEmployer
  if (totalEssi > 0) {
    addEntry(getCreditAccount('ESSI_EMPLOYER', eobiPayableAccount), 0, totalEssi, 'ESSI payable')
  }
  // Loan Deduction Payable
  if (totals.totalLoanDeduction > 0) {
    addEntry(getCreditAccount('LOAN_DEDUCTION', salaryPayableAccount), 0, totals.totalLoanDeduction, 'Loan deduction payable')
  }
  // Advance Recovery Payable
  if (totals.totalAdvanceDeduction > 0) {
    addEntry(getCreditAccount('ADVANCE_DEDUCTION', salaryPayableAccount), 0, totals.totalAdvanceDeduction, 'Advance recovery payable')
  }
  // Gratuity Payable
  if (totals.totalGratuity > 0) {
    addEntry(getCreditAccount('GRATUITY', gratuityPayableAccount || salaryPayableAccount), 0, totals.totalGratuity, 'Gratuity payable')
  }

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

  return { entries, totalDebit, totalCredit }
}

// -----------------------------------------------------------
// Helper: parse JSON field safely
// -----------------------------------------------------------
function safeParseJson<T>(value: string | null | undefined): T[] {
  if (!value) return []
  try {
    return JSON.parse(value) as T[]
  } catch {
    return []
  }
}

// -----------------------------------------------------------
// Helper: format project code for voucher suffix
// -----------------------------------------------------------
function formatProjectSuffix(code: string): string {
  return code.toUpperCase().replace(/\s+/g, '').substring(0, 6)
}

// -----------------------------------------------------------
// POST handler
// -----------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { mode } = data

    // =========================================================
    // MODE: SC-ONLY — Social Charges only voucher for employee
    // =========================================================
    if (mode === 'sc-only') {
      const { employeeId, month, financialYearId, scAmount } = data

      if (!employeeId || !month || !financialYearId || scAmount === undefined) {
        return NextResponse.json(
          { error: 'employeeId, month, financialYearId, and scAmount are required for sc-only mode' },
          { status: 400 }
        )
      }

      const amount = Math.round(scAmount)
      if (amount <= 0) {
        return NextResponse.json(
          { error: 'scAmount must be greater than 0' },
          { status: 400 }
        )
      }

      // Find employee
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true, employeeCode: true },
      })
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
      }

      // Find financial year
      const fy = await db.financialYear.findUnique({ where: { id: financialYearId } })
      if (!fy) {
        return NextResponse.json({ error: 'Financial year not found' }, { status: 404 })
      }
      if (fy.status === 'closed') {
        return NextResponse.json({ error: 'Financial year is closed' }, { status: 400 })
      }

      // Find accounts
      const scExpenseAccount = await findAccountByRole('SOCIAL_CHARGES')
      const scPayableAccount = await findAccountByRole('SOCIAL_CHARGES_PAYABLE')

      if (!scExpenseAccount && !scPayableAccount) {
        return NextResponse.json(
          { error: 'Social Charges expense/payable accounts not found. Configure GL account mappings.' },
          { status: 400 }
        )
      }

      const voucherNumber = `JV-SC-${month.replace('-', '')}-${employee.employeeCode}`
      const entries = [
        {
          lineNumber: 1,
          accountId: scExpenseAccount?.id || scPayableAccount?.id || '',
          debit: amount,
          credit: 0,
          description: `Social charges expense for ${employee.name} (${employee.employeeCode}) - ${month}`,
          payrollRef: `SC-${employee.employeeCode}-${month}`,
        },
        {
          lineNumber: 2,
          accountId: scPayableAccount?.id || scExpenseAccount?.id || '',
          debit: 0,
          credit: amount,
          description: `Social charges payable for ${employee.name} (${employee.employeeCode}) - ${month}`,
          payrollRef: `SC-${employee.employeeCode}-${month}`,
        },
      ]

      const voucher = await db.voucher.create({
        data: {
          voucherNumber,
          voucherType: 'JV',
          voucherTypeName: 'Journal Voucher',
          date: new Date(),
          narration: `Social Charges posting for ${employee.name} (${employee.employeeCode}) - ${month}`,
          status: 'draft',
          financialYearId,
          isPayrollPosted: true,
          totalDebit: amount,
          totalCredit: amount,
          createdBy: 'system',
          entries: { create: entries },
        },
      })

      // Fetch voucher with account details
      const voucherWithEntries = await db.voucher.findUnique({
        where: { id: voucher.id },
        include: {
          entries: {
            include: { account: { select: { id: true, accountName: true, accountCode: true } } },
            orderBy: { lineNumber: 'asc' },
          },
        },
      })

      const displayEntries = (voucherWithEntries?.entries || []).map(e => ({
        lineNumber: e.lineNumber,
        accountId: e.accountId,
        accountCode: e.account?.accountCode || '',
        accountName: e.account?.accountName || 'Unknown',
        debit: e.debit,
        credit: e.credit,
        description: e.description,
      }))

      return NextResponse.json({
        mode: 'sc-only',
        voucher: {
          voucherId: voucher.id,
          voucherNumber: voucher.voucherNumber,
          voucherType: 'SC-Only',
          employee: { id: employee.id, name: employee.name, code: employee.employeeCode },
          period: month,
          totalDebit: amount,
          totalCredit: amount,
          balanced: true,
          status: 'draft',
          entries: displayEntries,
        },
      }, { status: 201 })
    }

    // =========================================================
    // MODE: CONSOLIDATED or PROJECT-WISE
    // Both require a batchId and financialYearId
    // =========================================================
    const { batchId, financialYearId, lineIds } = data

    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required' }, { status: 400 })
    }
    if (!financialYearId) {
      return NextResponse.json({ error: 'financialYearId is required' }, { status: 400 })
    }

    // Find the batch with all lines
    const batch = await db.payrollBatch.findUnique({
      where: { id: batchId },
      include: { lines: { orderBy: { employeeName: 'asc' } } },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Verify batch is in an appropriate status
    if (batch.status !== 'approved' && batch.status !== 'reviewed' && batch.status !== 'draft-to-gl') {
      return NextResponse.json(
        { error: `Batch status is '${batch.status}'. Must be 'approved', 'reviewed', or 'draft-to-gl' to generate GL vouchers.` },
        { status: 400 }
      )
    }

    // Verify not already posted to GL
    if (batch.postedToGL && mode !== 'project-wise') {
      return NextResponse.json({ error: 'Batch already posted to GL' }, { status: 400 })
    }

    // Find financial year
    const fy = await db.financialYear.findUnique({ where: { id: financialYearId } })
    if (!fy) {
      return NextResponse.json({ error: 'Financial year not found' }, { status: 404 })
    }
    if (fy.status === 'closed') {
      return NextResponse.json({ error: 'Financial year is closed' }, { status: 400 })
    }

    // Get approved lines only, optionally filtered by lineIds
    const lineIdSet = lineIds?.length > 0 ? new Set(lineIds as string[]) : null
    const approvedLines = batch.lines.filter(l =>
      l.lineStatus === 'approved' && (!lineIdSet || lineIdSet.has(l.id))
    )
    if (approvedLines.length === 0) {
      return NextResponse.json({ error: 'No approved lines found in batch' }, { status: 400 })
    }

    const period = batch.period // e.g., "2026-06"
    const periodFmt = period.replace('-', '') // e.g., "202606"

    // =========================================================
    // MODE: CONSOLIDATED — One voucher for all
    // =========================================================
    if (mode === 'consolidated') {
      // Calculate totals from approved lines
      const totals: GlTotals = approvedLines.reduce(
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
          totalBasicSalary: 0, totalAllowances: 0, totalGross: 0, totalIncomeTax: 0,
          totalEobiEmployee: 0, totalEobiEmployer: 0, totalEssiEmployee: 0, totalEssiEmployer: 0,
          totalPfEmployee: 0, totalPfEmployer: 0,
          totalLoanDeduction: 0, totalAdvanceDeduction: 0, totalOtherDeductions: 0, totalDeductions: 0,
          totalNetPay: 0, totalSocialCharges: 0, totalGratuity: 0, totalEmployerCharges: 0,
        }
      )

      // Round all totals
      for (const key of Object.keys(totals) as (keyof GlTotals)[]) {
        totals[key] = Math.round(totals[key] * 100) / 100
      }

      const { entries, totalDebit, totalCredit } = await buildGlEntries(batch.batchNumber, totals)

      if (entries.length === 0) {
        return NextResponse.json(
          { error: 'No journal entries could be created. Check GL account mappings.' },
          { status: 400 }
        )
      }

      const voucherNumber = `JV-PAY-${periodFmt}-001`
      const voucher = await db.voucher.create({
        data: {
          voucherNumber,
          voucherType: 'JV',
          voucherTypeName: 'Journal Voucher',
          date: new Date(),
          narration: `Payroll consolidated posting for batch ${batch.batchNumber} - ${batch.name} (${approvedLines.length} employees)`,
          status: 'draft',
          financialYearId,
          projectId: batch.projectId,
          isPayrollPosted: true,
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          createdBy: 'system',
          entries: { create: entries },
        },
      })

      // Mark batch
      await db.payrollBatch.update({
        where: { id: batchId },
        data: {
          postedToGL: true,
          postedVoucherId: voucher.id,
          status: 'draft-to-gl',
          postedBy: 'system',
        },
      })

      // Fetch voucher with account details
      const voucherWithEntries = await db.voucher.findUnique({
        where: { id: voucher.id },
        include: {
          entries: {
            include: { account: { select: { id: true, accountName: true, accountCode: true } } },
            orderBy: { lineNumber: 'asc' },
          },
        },
      })

      const displayEntries = (voucherWithEntries?.entries || []).map(e => ({
        lineNumber: e.lineNumber,
        accountId: e.accountId,
        accountCode: e.account?.accountCode || '',
        accountName: e.account?.accountName || 'Unknown',
        debit: e.debit,
        credit: e.credit,
        description: e.description,
      }))

      return NextResponse.json({
        mode: 'consolidated',
        vouchers: [{
          voucherId: voucher.id,
          voucherNumber,
          voucherType: 'Consolidated',
          period,
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          balanced: Math.abs(totalDebit - totalCredit) < 0.01,
          status: 'draft',
          entries: displayEntries,
          employeeCount: approvedLines.length,
        }],
      }, { status: 201 })
    }

    // =========================================================
    // MODE: PROJECT-WISE — Separate voucher per project
    // =========================================================
    if (mode === 'project-wise') {
      // Collect all unique projects from employee projectAllocations
      const projectMap = new Map<string, { projectId: string; projectCode: string; projectName: string }>()

      for (const line of approvedLines) {
        const allocations = safeParseJson<ProjectAllocation>(line.projectAllocations)
        for (const alloc of allocations) {
          if (!projectMap.has(alloc.projectId)) {
            projectMap.set(alloc.projectId, {
              projectId: alloc.projectId,
              projectCode: alloc.projectCode,
              projectName: alloc.projectName,
            })
          }
        }

        // Also check contractEarnings
        const contracts = safeParseJson<ContractEarning>(line.contractEarnings)
        for (const ce of contracts) {
          if (!projectMap.has(ce.projectId)) {
            projectMap.set(ce.projectId, {
              projectId: ce.projectId,
              projectCode: ce.projectCode,
              projectName: ce.projectName,
            })
          }
        }
      }

      if (projectMap.size === 0) {
        // No project allocations found — fall back to line-level projectId
        const lineProjects = new Map<string, string>()
        for (const line of approvedLines) {
          if (line.projectId && !lineProjects.has(line.projectId)) {
            lineProjects.set(line.projectId, line.projectId)
          }
        }

        if (lineProjects.size === 0) {
          return NextResponse.json(
            { error: 'No project allocations found in batch lines. Cannot generate project-wise vouchers.' },
            { status: 400 }
          )
        }

        // Fetch project details
        const projects = await db.project.findMany({
          where: { id: { in: [...lineProjects.keys()] } },
          select: { id: true, code: true, name: true },
        })

        for (const proj of projects) {
          projectMap.set(proj.id, {
            projectId: proj.id,
            projectCode: proj.code,
            projectName: proj.name,
          })
        }
      }

      // Verify projects exist in DB and get their IDs
      const projectIds = [...projectMap.keys()]
      const dbProjects = await db.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, code: true, name: true },
      })

      // Update project map with DB-verified data
      for (const proj of dbProjects) {
        const existing = projectMap.get(proj.id)
        if (existing) {
          existing.projectCode = proj.code
          existing.projectName = proj.name
        }
      }

      const vouchers: Array<{
        voucherId: string
        voucherNumber: string
        voucherType: string
        project: string
        projectName: string
        period: string
        totalDebit: number
        totalCredit: number
        balanced: boolean
        status: string
        entries: Array<{
          lineNumber: number
          accountId: string
          accountCode: string
          accountName: string
          debit: number
          credit: number
          description: string
        }>
        employeeLines: EmployeeLineContribution[]
      }> = []

      const createdVoucherIds: string[] = []

      for (const [projectId, projectInfo] of projectMap) {
        // Calculate project-specific totals
        let projBasicSalary = 0
        let projAllowances = 0
        let projGross = 0
        let projIncomeTax = 0
        let projEobiEmployee = 0
        let projEobiEmployer = 0
        let projEssiEmployee = 0
        let projEssiEmployer = 0
        let projPfEmployee = 0
        let projPfEmployer = 0
        let projLoanDeduction = 0
        let projAdvanceDeduction = 0
        let projOtherDeductions = 0
        let projDeductions = 0
        let projNetPay = 0
        let projSocialCharges = 0
        let projGratuity = 0
        let projEmployerCharges = 0

        const employeeLines: EmployeeLineContribution[] = []

        for (const line of approvedLines) {
          // Try projectAllocations first
          const allocations = safeParseJson<ProjectAllocation>(line.projectAllocations)
          const allocForProject = allocations.find(a => a.projectId === projectId)

          // Also check contractEarnings for this project
          const contracts = safeParseJson<ContractEarning>(line.contractEarnings)
          const contractForProject = contracts.find(c => c.projectId === projectId)

          // Determine the ratio for this employee on this project
          let ratio = 0
          let earnedForProject = 0
          let scForProject = 0
          let daysForProject = 0

          if (contractForProject) {
            // Use contract earnings data (more accurate)
            earnedForProject = contractForProject.earnedSalary || 0
            scForProject = contractForProject.scShare || 0
            daysForProject = contractForProject.daysWorked || 0
            ratio = line.basicSalary > 0 ? earnedForProject / line.basicSalary : 0
          } else if (allocForProject) {
            // Use allocation weight
            ratio = allocForProject.weight || 0
            earnedForProject = allocForProject.salaryShare || (line.basicSalary * ratio)
            scForProject = allocForProject.scShare || (line.socialCharges * ratio)
            daysForProject = allocForProject.days || 0
          } else if (line.projectId === projectId) {
            // Line-level project assignment (no allocation data)
            ratio = 1
            earnedForProject = line.basicSalary
            scForProject = line.socialCharges
            daysForProject = line.payableDays || 0
          } else {
            // No contribution to this project
            continue
          }

          // Ensure ratio is between 0 and 1
          ratio = Math.min(1, Math.max(0, ratio))

          // Proportionally split line amounts
          const lineBasicSalary = Math.round(line.basicSalary * ratio * 100) / 100
          const lineAllowances = Math.round(line.allowances * ratio * 100) / 100
          const lineGross = lineBasicSalary + lineAllowances
          const lineIncomeTax = Math.round(line.incomeTax * ratio * 100) / 100
          const lineEobiEmployee = Math.round(line.eobiEmployee * ratio * 100) / 100
          const lineEobiEmployer = Math.round(line.eobiEmployer * ratio * 100) / 100
          const lineEssiEmployee = Math.round(line.essiEmployee * ratio * 100) / 100
          const lineEssiEmployer = Math.round(line.essiEmployer * ratio * 100) / 100
          const linePfEmployee = Math.round(line.pfEmployee * ratio * 100) / 100
          const linePfEmployer = Math.round(line.pfEmployer * ratio * 100) / 100
          const lineLoanDeduction = Math.round(line.loanDeduction * ratio * 100) / 100
          const lineAdvanceDeduction = Math.round(line.advanceDeduction * ratio * 100) / 100
          const lineOtherDeductions = Math.round(line.otherDeductions * ratio * 100) / 100
          const lineTotalDeductions = lineIncomeTax + lineEobiEmployee + lineEssiEmployee + linePfEmployee + lineLoanDeduction + lineAdvanceDeduction + lineOtherDeductions
          const lineNetPay = lineGross - lineTotalDeductions
          const lineSocialCharges = scForProject > 0 ? Math.round(scForProject * 100) / 100 : Math.round(line.socialCharges * ratio * 100) / 100
          const lineGratuity = Math.round(line.gratuity * ratio * 100) / 100

          projBasicSalary += lineBasicSalary
          projAllowances += lineAllowances
          projGross += lineGross
          projIncomeTax += lineIncomeTax
          projEobiEmployee += lineEobiEmployee
          projEobiEmployer += lineEobiEmployer
          projEssiEmployee += lineEssiEmployee
          projEssiEmployer += lineEssiEmployer
          projPfEmployee += linePfEmployee
          projPfEmployer += linePfEmployer
          projLoanDeduction += lineLoanDeduction
          projAdvanceDeduction += lineAdvanceDeduction
          projOtherDeductions += lineOtherDeductions
          projDeductions += lineTotalDeductions
          projNetPay += lineNetPay
          projSocialCharges += lineSocialCharges
          projGratuity += lineGratuity
          projEmployerCharges += lineEobiEmployer + linePfEmployer + lineEssiEmployer + lineSocialCharges + lineGratuity

          // Add employee line contribution
          employeeLines.push({
            empId: line.employeeId,
            empName: line.employeeName,
            empCode: line.employeeCode || '',
            days: daysForProject,
            ratio: `${Math.round(ratio * 100)}%`,
            earned: Math.round(earnedForProject * 100) / 100,
            sc: Math.round(scForProject * 100) / 100,
          })
        }

        // Skip project if no amounts
        if (projBasicSalary === 0 && projSocialCharges === 0 && projNetPay === 0) {
          continue
        }

        // Round all project totals
        projBasicSalary = Math.round(projBasicSalary * 100) / 100
        projAllowances = Math.round(projAllowances * 100) / 100
        projGross = Math.round(projGross * 100) / 100
        projIncomeTax = Math.round(projIncomeTax * 100) / 100
        projEobiEmployee = Math.round(projEobiEmployee * 100) / 100
        projEobiEmployer = Math.round(projEobiEmployer * 100) / 100
        projEssiEmployee = Math.round(projEssiEmployee * 100) / 100
        projEssiEmployer = Math.round(projEssiEmployer * 100) / 100
        projPfEmployee = Math.round(projPfEmployee * 100) / 100
        projPfEmployer = Math.round(projPfEmployer * 100) / 100
        projLoanDeduction = Math.round(projLoanDeduction * 100) / 100
        projAdvanceDeduction = Math.round(projAdvanceDeduction * 100) / 100
        projOtherDeductions = Math.round(projOtherDeductions * 100) / 100
        projDeductions = Math.round(projDeductions * 100) / 100
        projNetPay = Math.round(projNetPay * 100) / 100
        projSocialCharges = Math.round(projSocialCharges * 100) / 100
        projGratuity = Math.round(projGratuity * 100) / 100
        projEmployerCharges = Math.round(projEmployerCharges * 100) / 100

        const projectTotals: GlTotals = {
          totalBasicSalary: projBasicSalary,
          totalAllowances: projAllowances,
          totalGross: projGross,
          totalIncomeTax: projIncomeTax,
          totalEobiEmployee: projEobiEmployee,
          totalEobiEmployer: projEobiEmployer,
          totalEssiEmployee: projEssiEmployee,
          totalEssiEmployer: projEssiEmployer,
          totalPfEmployee: projPfEmployee,
          totalPfEmployer: projPfEmployer,
          totalLoanDeduction: projLoanDeduction,
          totalAdvanceDeduction: projAdvanceDeduction,
          totalOtherDeductions: projOtherDeductions,
          totalDeductions: projDeductions,
          totalNetPay: projNetPay,
          totalSocialCharges: projSocialCharges,
          totalGratuity: projGratuity,
          totalEmployerCharges: projEmployerCharges,
        }

        const projectSuffix = formatProjectSuffix(projectInfo.projectCode)
        const voucherNumber = `JV-PAY-${periodFmt}-${projectSuffix}`

        const { entries, totalDebit, totalCredit } = await buildProjectGlEntries(
          batch.batchNumber,
          projectTotals,
          projectInfo.projectCode,
          projectId
        )

        if (entries.length === 0) continue

        const voucher = await db.voucher.create({
          data: {
            voucherNumber,
            voucherType: 'JV',
            voucherTypeName: 'Journal Voucher',
            date: new Date(),
            narration: `Payroll project-wise posting for batch ${batch.batchNumber} - ${batch.name} [Project: ${projectInfo.projectCode} - ${projectInfo.projectName}]`,
            status: 'draft',
            financialYearId,
            projectId,
            isPayrollPosted: true,
            totalDebit: Math.round(totalDebit * 100) / 100,
            totalCredit: Math.round(totalCredit * 100) / 100,
            createdBy: 'system',
            entries: { create: entries },
          },
        })

        createdVoucherIds.push(voucher.id)

        // Fetch voucher with account details
        const voucherWithEntries = await db.voucher.findUnique({
          where: { id: voucher.id },
          include: {
            entries: {
              include: { account: { select: { id: true, accountName: true, accountCode: true } } },
              orderBy: { lineNumber: 'asc' },
            },
          },
        })

        const displayEntries = (voucherWithEntries?.entries || []).map(e => ({
          lineNumber: e.lineNumber,
          accountId: e.accountId,
          accountCode: e.account?.accountCode || '',
          accountName: e.account?.accountName || 'Unknown',
          debit: e.debit,
          credit: e.credit,
          description: e.description,
        }))

        vouchers.push({
          voucherId: voucher.id,
          voucherNumber,
          voucherType: 'Project',
          project: projectSuffix,
          projectName: projectInfo.projectName,
          period,
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          balanced: Math.abs(totalDebit - totalCredit) < 0.01,
          status: 'draft',
          entries: displayEntries,
          employeeLines,
        })
      }

      // Mark batch with the first voucher ID
      if (createdVoucherIds.length > 0) {
        await db.payrollBatch.update({
          where: { id: batchId },
          data: {
            postedToGL: true,
            postedVoucherId: createdVoucherIds[0],
            status: 'draft-to-gl',
            postedBy: 'system',
          },
        })
      }

      if (vouchers.length === 0) {
        return NextResponse.json(
          { error: 'No vouchers could be generated. Check GL account mappings and project allocations.' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        mode: 'project-wise',
        vouchers,
      }, { status: 201 })
    }

    // Invalid mode
    return NextResponse.json(
      { error: 'Invalid mode. Must be "consolidated", "project-wise", or "sc-only"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('GL Voucher generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
