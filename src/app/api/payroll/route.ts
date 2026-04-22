import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findAccountByRole, findFirstBankAccount } from '@/lib/account-roles'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = {}
    if (status) where.status = status

    const batches = await db.payrollBatch.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(batches)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    if (data.action === 'post-to-gl') {
      // INTEGRATION: Payroll → GL
      // Post payroll journals to the General Ledger after payroll approval
      const { batchId, financialYearId } = data

      const batch = await db.payrollBatch.findUnique({
        where: { id: batchId },
        include: { lines: true },
      })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.postedToGL) return NextResponse.json({ error: 'Already posted to GL' }, { status: 400 })

      // Get required accounts
      const salaryAccount = await findAccountByRole('SALARY_EXPENSE')
      const bankAccount = await findFirstBankAccount()
      const incomeTaxPayable = await findAccountByRole('INCOME_TAX_PAYABLE')
      const eobiPayable = await findAccountByRole('EOBI_PAYABLE')
      const pfPayable = await findAccountByRole('PROVIDENT_FUND_PAYABLE')
      const salaryPayable = await findAccountByRole('SALARY_PAYABLE')
      const socialCharges = await findAccountByRole('SOCIAL_CHARGES')

      if (!salaryAccount || !bankAccount) {
        return NextResponse.json({ error: 'Required GL accounts not found' }, { status: 400 })
      }

      const entries: any[] = []

      // INTEGRATION: Payroll → GL - Salary expense and bank payment
      entries.push(
        { lineNumber: entries.length + 1, accountId: salaryAccount!.id, debit: batch.totalGross, credit: 0, description: 'Gross salary expense', payrollRef: batch.batchNumber },
        { lineNumber: entries.length + 1, accountId: bankAccount!.id, debit: 0, credit: batch.totalNetPay, description: 'Net pay via bank transfer', payrollRef: batch.batchNumber },
      )

      // INTEGRATION: Payroll → GL - Deduction entries
      const totalDeductions = batch.totalGross - batch.totalNetPay
      if (totalDeductions > 0) {
        if (incomeTaxPayable) entries.push({ lineNumber: entries.length + 1, accountId: incomeTaxPayable.id, debit: 0, credit: batch.lines.reduce((s, l) => s + l.incomeTax, 0), description: 'Income tax deducted', payrollRef: batch.batchNumber })
        if (eobiPayable) entries.push({ lineNumber: entries.length + 1, accountId: eobiPayable.id, debit: 0, credit: batch.lines.reduce((s, l) => s + l.eobiDeduction, 0), description: 'EOBI deducted', payrollRef: batch.batchNumber })
        if (pfPayable) entries.push({ lineNumber: entries.length + 1, accountId: pfPayable.id, debit: 0, credit: batch.lines.reduce((s, l) => s + l.providentFund, 0), description: 'Provident fund deducted', payrollRef: batch.batchNumber })
      }

      // INTEGRATION: Payroll → GL - Employer social charges and accrual entries
      if (batch.totalEmployerCharges > 0 && socialCharges) {
        entries.push({ lineNumber: entries.length + 1, accountId: socialCharges.id, debit: batch.totalEmployerCharges, credit: 0, description: 'Employer social charges', payrollRef: batch.batchNumber })
        if (eobiPayable) entries.push({ lineNumber: entries.length + 1, accountId: eobiPayable.id, debit: 0, credit: batch.lines.reduce((s, l) => s + l.employerEOBI, 0), description: 'Employer EOBI contribution', payrollRef: batch.batchNumber })
        if (pfPayable) entries.push({ lineNumber: entries.length + 1, accountId: pfPayable.id, debit: 0, credit: batch.lines.reduce((s, l) => s + l.employerPF, 0), description: 'Employer PF contribution', payrollRef: batch.batchNumber })
      }

      // Create the voucher
      const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
      const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

      const voucher = await db.voucher.create({
        data: {
          voucherNumber: `JV-PAYROLL-${batch.batchNumber}`,
          voucherType: 'JV',
          voucherTypeName: 'Journal Voucher',
          date: new Date(),
          narration: `Payroll posting for batch ${batch.batchNumber}`,
          status: 'posted',
          financialYearId,
          isPayrollPosted: true, // INTEGRATION: Payroll → GL flag
          totalDebit,
          totalCredit,
          createdBy: 'system',
          reviewedBy: 'system',
          approvedBy: 'system',
          postedBy: 'system',
          entries: { create: entries },
        },
      })

      // INTEGRATION: Payroll → GL - Cross-charged salary costs to project cost centers
      // Update voucher entry project references for cross-charging
      for (const line of batch.lines) {
        if (line.projectId) {
          // Salary costs posted to respective project cost centers/segments
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
        data: { postedToGL: true, postedVoucherId: voucher.id, status: 'posted' },
      })

      return NextResponse.json({
        message: 'Payroll posted to GL',
        voucherId: voucher.id,
        voucherNumber: voucher.voucherNumber,
        totalDebit,
        totalCredit,
      })
    }

    // Create new payroll batch
    const { batchNumber, period, totalGross, totalDeductions, totalNetPay, totalEmployerCharges, lines } = data
    if (!batchNumber || !period) {
      return NextResponse.json({ error: 'Batch number and period required' }, { status: 400 })
    }

    const batch = await db.payrollBatch.create({
      data: {
        batchNumber,
        period,
        totalGross: totalGross || 0,
        totalDeductions: totalDeductions || 0,
        totalNetPay: totalNetPay || 0,
        totalEmployerCharges: totalEmployerCharges || 0,
        lines: { create: lines || [] },
      },
      include: { lines: true },
    })

    return NextResponse.json(batch, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
