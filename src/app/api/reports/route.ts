import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('reportType') || 'trial_balance'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const projectId = searchParams.get('projectId')
    const donorId = searchParams.get('donorId')
    const locationId = searchParams.get('locationId')
    const financialYearId = searchParams.get('financialYearId')

    const statusParam = searchParams.get('status') || 'posted'
    const voucherWhere: any = {}
    if (statusParam === 'posted') {
      voucherWhere.status = { in: ['approved', 'posted'] }
    } else if (statusParam === 'all') {
      // No status filter - show all vouchers
    } else {
      voucherWhere.status = statusParam
    }
    if (dateFrom || dateTo) {
      voucherWhere.date = {}
      if (dateFrom) voucherWhere.date.gte = new Date(dateFrom)
      if (dateTo) voucherWhere.date.lte = new Date(dateTo)
    }
    if (financialYearId) voucherWhere.financialYearId = financialYearId
    if (projectId) voucherWhere.projectId = projectId
    if (donorId) voucherWhere.donorId = donorId
    if (locationId) voucherWhere.locationId = locationId

    switch (reportType) {
      case 'trial_balance': {
        const accounts = await db.account.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
        })

        const trialBalance: any[] = []
        let totalDebit = 0
        let totalCredit = 0

        for (const account of accounts) {
          const result = await db.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: { accountId: account.id, voucher: voucherWhere },
          })
          const debit = result._sum.debit || 0
          const credit = result._sum.credit || 0
          const balance = debit - credit

          if (debit !== 0 || credit !== 0) {
            trialBalance.push({
              code: account.code,
              name: account.name,
              accountType: account.accountType,
              subType: account.subType,
              totalDebit: debit,
              totalCredit: credit,
              balance: Math.abs(balance),
              balanceType: balance >= 0 ? 'Debit' : 'Credit',
            })
            totalDebit += debit
            totalCredit += credit
          }
        }

        return NextResponse.json({ reportType: 'Trial Balance', data: trialBalance, totalDebit, totalCredit, asOf: dateTo || new Date().toISOString() })
      }

      case 'balance_sheet': {
        const accounts = await db.account.findMany({
          where: { isActive: true, accountType: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } },
          orderBy: { code: 'asc' },
        })

        const sections: Record<string, any[]> = { assets: [], liabilities: [], equity: [] }
        let totalAssets = 0
        let totalLiabilities = 0
        let totalEquity = 0

        for (const account of accounts) {
          const result = await db.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: { accountId: account.id, voucher: voucherWhere },
          })
          const debit = result._sum.debit || 0
          const credit = result._sum.credit || 0
          let balance = debit - credit

          // Assets have debit balance, Liabilities/Equity have credit balance
          if (account.accountType === 'ASSET') {
            if (account.subType === 'CONTRA_ASSET') balance = credit - debit // Accumulated depreciation
            totalAssets += balance
            sections.assets.push({ code: account.code, name: account.name, subType: account.subType, balance })
          } else if (account.accountType === 'LIABILITY') {
            balance = credit - debit
            totalLiabilities += balance
            sections.liabilities.push({ code: account.code, name: account.name, subType: account.subType, balance })
          } else if (account.accountType === 'EQUITY') {
            balance = credit - debit
            totalEquity += balance
            sections.equity.push({ code: account.code, name: account.name, subType: account.subType, balance })
          }
        }

        return NextResponse.json({
          reportType: 'Balance Sheet',
          sections,
          totalAssets,
          totalLiabilities,
          totalEquity,
          check: totalAssets === totalLiabilities + totalEquity ? 'Balanced' : 'Out of Balance',
          asOf: dateTo || new Date().toISOString(),
        })
      }

      case 'pnl': {
        const accounts = await db.account.findMany({
          where: { isActive: true, accountType: { in: ['INCOME', 'EXPENSE'] } },
          orderBy: { code: 'asc' },
        })

        const income: any[] = []
        const expenses: any[] = []
        let totalIncome = 0
        let totalExpenses = 0

        for (const account of accounts) {
          const result = await db.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: { accountId: account.id, voucher: voucherWhere },
          })
          const debit = result._sum.debit || 0
          const credit = result._sum.credit || 0

          if (account.accountType === 'INCOME') {
            const balance = credit - debit
            totalIncome += balance
            income.push({ code: account.code, name: account.name, subType: account.subType, balance })
          } else {
            const balance = debit - credit
            totalExpenses += balance
            expenses.push({ code: account.code, name: account.name, subType: account.subType, balance })
          }
        }

        return NextResponse.json({
          reportType: 'Profit & Loss Statement',
          income,
          expenses,
          totalIncome,
          totalExpenses,
          netSurplus: totalIncome - totalExpenses,
          periodFrom: dateFrom,
          periodTo: dateTo,
        })
      }

      case 'cash_flow': {
        // Cash flow based on bank/cash account movements
        const cashAccounts = await db.account.findMany({
          where: { isActive: true, subType: 'CURRENT_ASSET', code: { startsWith: '11' } },
        })

        const entries = await db.voucherEntry.findMany({
          where: {
            accountId: { in: cashAccounts.map(a => a.id) },
            voucher: voucherWhere,
          },
          include: {
            account: { select: { code: true, name: true } },
            voucher: { select: { date: true, voucherType: true, narration: true } },
          },
          orderBy: { voucher: { date: 'asc' } },
        })

        const operatingCash = entries.filter(e => ['CP', 'BP', 'CR', 'BR'].includes(e.voucher.voucherType))
        const totalInflow = entries.filter(e => e.debit > 0).reduce((s, e) => s + e.debit, 0)
        const totalOutflow = entries.filter(e => e.credit > 0).reduce((s, e) => s + e.credit, 0)

        return NextResponse.json({
          reportType: 'Cash Flow Statement',
          entries,
          totalInflow,
          totalOutflow,
          netCashFlow: totalInflow - totalOutflow,
          periodFrom: dateFrom,
          periodTo: dateTo,
        })
      }

      case 'donor_wise': {
        const donors = await db.donor.findMany()
        const donorData = []

        for (const donor of donors) {
          const result = await db.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: {
              voucher: { ...voucherWhere, donorId: donor.id },
            },
          })
          donorData.push({
            donor: donor.name,
            code: donor.code,
            totalDebit: result._sum.debit || 0,
            totalCredit: result._sum.credit || 0,
            balance: (result._sum.debit || 0) - (result._sum.credit || 0),
          })
        }

        return NextResponse.json({ reportType: 'Donor-wise Report', data: donorData, periodFrom: dateFrom, periodTo: dateTo })
      }

      case 'project_wise': {
        const projects = await db.project.findMany()
        const projectData = []

        for (const project of projects) {
          const result = await db.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: {
              voucher: { ...voucherWhere, projectId: project.id },
            },
          })
          projectData.push({
            project: project.name,
            code: project.code,
            status: project.status,
            totalDebit: result._sum.debit || 0,
            totalCredit: result._sum.credit || 0,
            balance: (result._sum.debit || 0) - (result._sum.credit || 0),
          })
        }

        return NextResponse.json({ reportType: 'Project-wise Report', data: projectData, periodFrom: dateFrom, periodTo: dateTo })
      }

      case 'location_wise': {
        const locations = await db.location.findMany()
        const locationData = []

        for (const location of locations) {
          const result = await db.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: {
              voucher: { ...voucherWhere, locationId: location.id },
            },
          })
          locationData.push({
            location: location.name,
            code: location.code,
            totalDebit: result._sum.debit || 0,
            totalCredit: result._sum.credit || 0,
            balance: (result._sum.debit || 0) - (result._sum.credit || 0),
          })
        }

        return NextResponse.json({ reportType: 'Location-wise Report', data: locationData, periodFrom: dateFrom, periodTo: dateTo })
      }

      case 'account_head': {
        const accountId = searchParams.get('accountId')
        if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })

        const entries = await db.voucherEntry.findMany({
          where: { accountId, voucher: voucherWhere },
          include: {
            voucher: { select: { voucherNumber: true, date: true, narration: true, voucherType: true } },
          },
          orderBy: { voucher: { date: 'asc' } },
        })

        const account = await db.account.findUnique({ where: { id: accountId } })
        return NextResponse.json({
          reportType: 'Account Head-wise Report',
          account,
          entries,
          totalDebit: entries.reduce((s, e) => s + e.debit, 0),
          totalCredit: entries.reduce((s, e) => s + e.credit, 0),
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
