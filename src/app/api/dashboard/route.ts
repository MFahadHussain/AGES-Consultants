import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findAccountByRole, findAccountsByRole } from '@/lib/account-roles'

export async function GET() {
  try {
    // Dashboard KPIs
    const now = new Date()

    // Cash Position - bank account balances
    const bankAccounts = await findAccountsByRole('BANK_ACCOUNT')
    let cashPosition = 0
    for (const acc of bankAccounts) {
      const result = await db.voucherEntry.aggregate({
        _sum: { debit: true, credit: true },
        where: { accountId: acc.id, voucher: { status: 'posted' } },
      })
      cashPosition += (result._sum.debit || 0) - (result._sum.credit || 0)
    }

    // Cash in hand
    const cashAccount = await findAccountByRole('CASH_IN_HAND')
    let cashInHand = 0
    if (cashAccount) {
      const result = await db.voucherEntry.aggregate({
        _sum: { debit: true, credit: true },
        where: { accountId: cashAccount.id, voucher: { status: 'posted' } },
      })
      cashInHand = (result._sum.debit || 0) - (result._sum.credit || 0)
    }

    // Total Receivables
    const receivablesAccount = await findAccountByRole('ACCOUNTS_RECEIVABLE')
    let totalReceivables = 0
    if (receivablesAccount) {
      const result = await db.voucherEntry.aggregate({
        _sum: { debit: true, credit: true },
        where: { accountId: receivablesAccount.id, voucher: { status: 'posted' } },
      })
      totalReceivables = (result._sum.debit || 0) - (result._sum.credit || 0)
    }

    // Total Payables
    const payablesAccount = await findAccountByRole('ACCOUNTS_PAYABLE')
    let totalPayables = 0
    if (payablesAccount) {
      const result = await db.voucherEntry.aggregate({
        _sum: { debit: true, credit: true },
        where: { accountId: payablesAccount.id, voucher: { status: 'posted' } },
      })
      totalPayables = (result._sum.credit || 0) - (result._sum.debit || 0)
    }

    // Recent vouchers
    const recentVouchers = await db.voucher.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { name: true } },
        donor: { select: { name: true } },
        _count: { select: { entries: true } },
      },
    })

    // Account type summaries for chart
    const accountTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
    const typeSummaries = []
    for (const type of accountTypes) {
      const accounts = await db.account.findMany({ where: { accountType: type, isActive: true } })
      let totalDebit = 0
      let totalCredit = 0
      for (const acc of accounts) {
        const result = await db.voucherEntry.aggregate({
          _sum: { debit: true, credit: true },
          where: { accountId: acc.id, voucher: { status: 'posted' } },
        })
        totalDebit += result._sum.debit || 0
        totalCredit += result._sum.credit || 0
      }
      typeSummaries.push({ type, totalDebit, totalCredit, balance: totalDebit - totalCredit })
    }

    // Budget utilization
    const budgets = await db.budget.findMany({
      where: { status: 'active' },
      include: {
        project: { select: { name: true } },
        lines: true,
      },
    })
    const budgetUtilization = budgets.map(b => ({
      id: b.id,
      name: b.name,
      project: b.project?.name,
      totalBudget: b.totalAmount,
      totalSpent: b.lines.reduce((s, l) => s + l.actualAmount, 0),
      utilization: b.totalAmount > 0 ? ((b.lines.reduce((s, l) => s + l.actualAmount, 0) / b.totalAmount) * 100).toFixed(1) : 0,
    }))

    // Voucher status counts
    const voucherStatusCounts = await db.voucher.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    // Counts
    const counts = {
      accounts: await db.account.count({ where: { isActive: true } }),
      vouchers: await db.voucher.count(),
      projects: await db.project.count(),
      donors: await db.donor.count(),
      customers: await db.customer.count({ where: { isActive: true } }),
      suppliers: await db.supplier.count({ where: { isActive: true } }),
      fixedAssets: await db.fixedAsset.count({ where: { status: 'active' } }),
    }

    return NextResponse.json({
      cashPosition,
      cashInHand,
      totalReceivables,
      totalPayables,
      recentVouchers,
      typeSummaries,
      budgetUtilization,
      voucherStatusCounts,
      counts,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
