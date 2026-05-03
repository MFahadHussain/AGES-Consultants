import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findAccountByRole, findFirstBankAccount } from '@/lib/account-roles'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const taxType = searchParams.get('taxType')
    const includeCalculations = searchParams.get('includeCalculations')

    // If requesting calculation history
    if (includeCalculations === 'true') {
      const calculations = await db.taxCalculation.findMany({
        include: { taxRate: true },
        orderBy: { calculatedAt: 'desc' },
        take: 100,
      })
      return NextResponse.json(calculations)
    }

    const where: any = { isActive: true }
    if (taxType) where.taxType = taxType

    const taxRates = await db.taxRate.findMany({ where, orderBy: { name: 'asc' } })
    return NextResponse.json(taxRates)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    if (data.action === 'calculate') {
      // Calculate tax for a given amount
      const { taxRateId, baseAmount } = data
      const taxRate = await db.taxRate.findUnique({ where: { id: taxRateId } })
      if (!taxRate) return NextResponse.json({ error: 'Tax rate not found' }, { status: 404 })

      const taxAmount = (baseAmount * taxRate.rate) / 100
      const calculation = await db.taxCalculation.create({
        data: {
          taxRateId,
          baseAmount,
          taxAmount,
          period: new Date().toISOString().slice(0, 7),
        },
      })
      return NextResponse.json({ ...calculation, rate: taxRate.rate, taxName: taxRate.name })
    }

    if (data.action === 'post-to-gl') {
      // Post a tax calculation to the General Ledger
      const { calculationId, financialYearId } = data
      if (!calculationId || !financialYearId) {
        return NextResponse.json({ error: 'Calculation ID and financial year ID required' }, { status: 400 })
      }

      const calculation = await db.taxCalculation.findUnique({
        where: { id: calculationId },
        include: { taxRate: true },
      })
      if (!calculation) return NextResponse.json({ error: 'Tax calculation not found' }, { status: 404 })
      if (calculation.postedToGL) return NextResponse.json({ error: 'Already posted to GL' }, { status: 400 })

      // Get GL accounts for tax posting
      const taxPayableAccount = await findAccountByRole('TAX_PAYABLE')
      const taxExpenseAccount = await findAccountByRole('TAX_EXPENSE')
      const bankAccount = await findFirstBankAccount()

      if (!taxPayableAccount) {
        return NextResponse.json({ error: 'Tax payable account not found in COA' }, { status: 400 })
      }

      // Use the tax rate's linked account if available, otherwise fallback
      const creditAccountId = calculation.taxRate.accountId || taxPayableAccount.id
      const debitAccountId = taxExpenseAccount?.id || taxPayableAccount.id

      const entries = [
        { lineNumber: 1, accountId: debitAccountId, debit: calculation.taxAmount, credit: 0, description: `Tax expense - ${calculation.taxRate.name}` },
        { lineNumber: 2, accountId: creditAccountId, debit: 0, credit: calculation.taxAmount, description: `Tax payable - ${calculation.taxRate.name}` },
      ]

      const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
      const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

      const voucher = await db.voucher.create({
        data: {
          voucherNumber: `JV-TAX-${Date.now()}`,
          voucherType: 'JV',
          voucherTypeName: 'Journal Voucher',
          date: new Date(),
          narration: `Tax posting for ${calculation.taxRate.name} - ${calculation.period}`,
          status: 'draft',
          financialYearId,
          totalDebit,
          totalCredit,
          createdBy: 'system',
          entries: { create: entries },
        },
      })

      // Mark calculation as posted
      await db.taxCalculation.update({
        where: { id: calculationId },
        data: { postedToGL: true, voucherId: voucher.id },
      })

      return NextResponse.json({
        message: 'Tax calculation posted to GL',
        voucherId: voucher.id,
        voucherNumber: voucher.voucherNumber,
        totalDebit,
        totalCredit,
      })
    }

    // Create tax rate
    if (!data.name || !data.taxType || data.rate === undefined) {
      return NextResponse.json({ error: 'Name, tax type, and rate are required' }, { status: 400 })
    }
    const taxRate = await db.taxRate.create({
      data: {
        name: data.name,
        taxType: data.taxType,
        rate: data.rate,
        accountId: data.accountId || null,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    })
    return NextResponse.json(taxRate, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Tax rate ID required' }, { status: 400 })

    const data = await request.json()
    const taxRate = await db.taxRate.findUnique({ where: { id } })
    if (!taxRate) return NextResponse.json({ error: 'Tax rate not found' }, { status: 404 })

    const updated = await db.taxRate.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.taxType && { taxType: data.taxType }),
        ...(data.rate !== undefined && { rate: data.rate }),
        ...(data.effectiveFrom && { effectiveFrom: new Date(data.effectiveFrom) }),
        ...(data.effectiveTo !== undefined && { effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
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
    if (!id) return NextResponse.json({ error: 'Tax rate ID required' }, { status: 400 })

    const taxRate = await db.taxRate.findUnique({ where: { id } })
    if (!taxRate) return NextResponse.json({ error: 'Tax rate not found' }, { status: 404 })

    // Check if tax rate has calculations
    const calcCount = await db.taxCalculation.count({ where: { taxRateId: id } })
    if (calcCount > 0) {
      // Soft delete instead
      await db.taxRate.update({ where: { id }, data: { isActive: false } })
      return NextResponse.json({ message: 'Tax rate deactivated (has existing calculations)' })
    }

    await db.taxRate.delete({ where: { id } })
    return NextResponse.json({ message: 'Tax rate deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
