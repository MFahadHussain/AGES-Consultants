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

      // Salary expense and bank payment
      entries.push(
        { lineNumber: entries.length + 1, accountId: salaryAccount!.id, debit: batch.totalGross, credit: 0, description: 'Gross salary expense', payrollRef: batch.batchNumber },
        { lineNumber: entries.length + 1, accountId: bankAccount!.id, debit: 0, credit: batch.totalNetPay, description: 'Net pay via bank transfer', payrollRef: batch.batchNumber },
      )

      // Deduction entries
      const totalDeductions = batch.totalGross - batch.totalNetPay
      if (totalDeductions > 0) {
        if (incomeTaxPayable) entries.push({ lineNumber: entries.length + 1, accountId: incomeTaxPayable.id, debit: 0, credit: batch.lines.reduce((s, l) => s + l.incomeTax, 0), description: 'Income tax deducted', payrollRef: batch.batchNumber })
        if (eobiPayable) entries.push({ lineNumber: entries.length + 1, accountId: eobiPayable.id, debit: 0, credit: batch.lines.reduce((s, l) => s + l.eobiDeduction, 0), description: 'EOBI deducted', payrollRef: batch.batchNumber })
        if (pfPayable) entries.push({ lineNumber: entries.length + 1, accountId: pfPayable.id, debit: 0, credit: batch.lines.reduce((s, l) => s + l.providentFund, 0), description: 'Provident fund deducted', payrollRef: batch.batchNumber })
      }

      // Employer social charges
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
          status: 'draft',
          financialYearId,
          isPayrollPosted: true,
          totalDebit,
          totalCredit,
          createdBy: 'system',
          entries: { create: entries },
        },
      })

      // Audit cross-charging
      for (const line of batch.lines) {
        if (line.projectId) {
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

    if (data.action === 'add-line') {
      // Add a line to an existing batch
      const { batchId, line } = data
      if (!batchId || !line) return NextResponse.json({ error: 'Batch ID and line data required' }, { status: 400 })

      const batch = await db.payrollBatch.findUnique({ where: { id: batchId }, include: { lines: true } })
      if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batch.postedToGL) return NextResponse.json({ error: 'Cannot modify a posted batch' }, { status: 400 })

      const grossSalary = (line.basicSalary || 0) + (line.allowances || 0)
      const totalDeductions = (line.incomeTax || 0) + (line.eobiDeduction || 0) + (line.providentFund || 0) + (line.loanDeduction || 0) + (line.otherDeductions || 0)
      const netPay = grossSalary - totalDeductions

      const newLine = await db.payrollBatchLine.create({
        data: {
          batchId,
          employeeName: line.employeeName || '',
          employeeId: line.employeeId || `EMP-${Date.now()}`,
          basicSalary: line.basicSalary || 0,
          allowances: line.allowances || 0,
          grossSalary,
          incomeTax: line.incomeTax || 0,
          eobiDeduction: line.eobiDeduction || 0,
          providentFund: line.providentFund || 0,
          loanDeduction: line.loanDeduction || 0,
          otherDeductions: line.otherDeductions || 0,
          netPay,
          employerEOBI: line.employerEOBI || 0,
          employerPF: line.employerPF || 0,
          projectId: line.projectId || null,
          department: line.department || null,
        },
      })

      // Recalculate batch totals
      await recalcBatchTotals(batchId)

      return NextResponse.json(newLine, { status: 201 })
    }

    if (data.action === 'update-line') {
      // Update an existing line
      const { lineId, line } = data
      if (!lineId || !line) return NextResponse.json({ error: 'Line ID and line data required' }, { status: 400 })

      const existingLine = await db.payrollBatchLine.findUnique({ where: { id: lineId } })
      if (!existingLine) return NextResponse.json({ error: 'Line not found' }, { status: 404 })

      const batch = await db.payrollBatch.findUnique({ where: { id: existingLine.batchId } })
      if (batch?.postedToGL) return NextResponse.json({ error: 'Cannot modify a posted batch' }, { status: 400 })

      const grossSalary = (line.basicSalary ?? existingLine.basicSalary) + (line.allowances ?? existingLine.allowances)
      const totalDeductions = (line.incomeTax ?? existingLine.incomeTax) + (line.eobiDeduction ?? existingLine.eobiDeduction) + (line.providentFund ?? existingLine.providentFund) + (line.loanDeduction ?? existingLine.loanDeduction) + (line.otherDeductions ?? existingLine.otherDeductions)
      const netPay = grossSalary - totalDeductions

      const updated = await db.payrollBatchLine.update({
        where: { id: lineId },
        data: {
          employeeName: line.employeeName ?? existingLine.employeeName,
          basicSalary: line.basicSalary ?? existingLine.basicSalary,
          allowances: line.allowances ?? existingLine.allowances,
          grossSalary,
          incomeTax: line.incomeTax ?? existingLine.incomeTax,
          eobiDeduction: line.eobiDeduction ?? existingLine.eobiDeduction,
          providentFund: line.providentFund ?? existingLine.providentFund,
          loanDeduction: line.loanDeduction ?? existingLine.loanDeduction,
          otherDeductions: line.otherDeductions ?? existingLine.otherDeductions,
          netPay,
          employerEOBI: line.employerEOBI ?? existingLine.employerEOBI,
          employerPF: line.employerPF ?? existingLine.employerPF,
          projectId: line.projectId !== undefined ? line.projectId : existingLine.projectId,
          department: line.department ?? existingLine.department,
        },
      })

      await recalcBatchTotals(existingLine.batchId)

      return NextResponse.json(updated)
    }

    if (data.action === 'delete-line') {
      const { lineId } = data
      if (!lineId) return NextResponse.json({ error: 'Line ID required' }, { status: 400 })

      const line = await db.payrollBatchLine.findUnique({ where: { id: lineId } })
      if (!line) return NextResponse.json({ error: 'Line not found' }, { status: 404 })

      const batch = await db.payrollBatch.findUnique({ where: { id: line.batchId } })
      if (batch?.postedToGL) return NextResponse.json({ error: 'Cannot modify a posted batch' }, { status: 400 })

      await db.payrollBatchLine.delete({ where: { id: lineId } })
      await recalcBatchTotals(line.batchId)

      return NextResponse.json({ message: 'Line deleted' })
    }

    // Create new payroll batch
    const { batchNumber, name, period, projectId, lines } = data
    if (!batchNumber || !period) {
      return NextResponse.json({ error: 'Batch number and period required' }, { status: 400 })
    }

    // Process lines to compute derived values
    const processedLines = (lines || []).map((l: any) => {
      const grossSalary = (l.basicSalary || 0) + (l.allowances || 0)
      const totalDeductions = (l.incomeTax || 0) + (l.eobiDeduction || 0) + (l.providentFund || 0) + (l.loanDeduction || 0) + (l.otherDeductions || 0)
      const netPay = grossSalary - totalDeductions
      return {
        employeeName: l.employeeName || '',
        employeeId: l.employeeId || `EMP-${Date.now()}`,
        basicSalary: l.basicSalary || 0,
        allowances: l.allowances || 0,
        grossSalary,
        incomeTax: l.incomeTax || 0,
        eobiDeduction: l.eobiDeduction || 0,
        providentFund: l.providentFund || 0,
        loanDeduction: l.loanDeduction || 0,
        otherDeductions: l.otherDeductions || 0,
        netPay,
        employerEOBI: l.employerEOBI || 0,
        employerPF: l.employerPF || 0,
        projectId: l.projectId || null,
        department: l.department || null,
      }
    })

    const totalGross = processedLines.reduce((s: number, l: any) => s + l.grossSalary, 0)
    const totalDeductions = processedLines.reduce((s: number, l: any) => s + (l.incomeTax + l.eobiDeduction + l.providentFund + l.loanDeduction + l.otherDeductions), 0)
    const totalNetPay = totalGross - totalDeductions
    const totalEmployerCharges = processedLines.reduce((s: number, l: any) => s + l.employerEOBI + l.employerPF, 0)

    const batch = await db.payrollBatch.create({
      data: {
        batchNumber,
        name: name || 'Payroll Batch',
        period,
        projectId: projectId || null,
        totalGross,
        totalDeductions,
        totalNetPay,
        totalEmployerCharges,
        lines: { create: processedLines },
      },
      include: { lines: true },
    })

    return NextResponse.json(batch, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

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
        ...(data.status && { status: data.status }),
      },
      include: { lines: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })

    const batch = await db.payrollBatch.findUnique({ where: { id } })
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    if (batch.postedToGL) return NextResponse.json({ error: 'Cannot delete a posted batch' }, { status: 400 })

    await db.payrollBatchLine.deleteMany({ where: { batchId: id } })
    await db.payrollBatch.delete({ where: { id } })

    return NextResponse.json({ message: 'Batch deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// Helper to recalculate batch totals from lines
async function recalcBatchTotals(batchId: string) {
  const lines = await db.payrollBatchLine.findMany({ where: { batchId } })

  const totalGross = lines.reduce((s, l) => s + l.grossSalary, 0)
  const totalDeductions = lines.reduce((s, l) => s + l.incomeTax + l.eobiDeduction + l.providentFund + l.loanDeduction + l.otherDeductions, 0)
  const totalNetPay = totalGross - totalDeductions
  const totalEmployerCharges = lines.reduce((s, l) => s + l.employerEOBI + l.employerPF, 0)

  await db.payrollBatch.update({
    where: { id: batchId },
    data: { totalGross, totalDeductions, totalNetPay, totalEmployerCharges },
  })
}
