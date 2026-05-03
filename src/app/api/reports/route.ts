import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findAccountsByRole } from '@/lib/account-roles'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('reportType') || 'trial_balance'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const projectId = searchParams.get('projectId')
    const donorId = searchParams.get('donorId')
    const locationId = searchParams.get('locationId')
    const clientId = searchParams.get('clientId')
    const financialYearId = searchParams.get('financialYearId')
    const accountId = searchParams.get('accountId')

    // Build voucher filter — only posted/approved vouchers by default
    const statusParam = searchParams.get('status') || 'posted'
    const voucherWhere: any = {}
    if (statusParam === 'posted') {
      voucherWhere.status = { in: ['approved', 'posted'] }
    } else if (statusParam === 'all') {
      // No status filter
    } else {
      voucherWhere.status = statusParam
    }
    if (dateFrom || dateTo) {
      voucherWhere.date = {}
      if (dateFrom) voucherWhere.date.gte = new Date(dateFrom)
      if (dateTo) voucherWhere.date.lte = new Date(dateTo + 'T23:59:59.999Z')
    }
    if (financialYearId) voucherWhere.financialYearId = financialYearId
    if (projectId) voucherWhere.projectId = projectId
    if (donorId) voucherWhere.donorId = donorId
    if (locationId) voucherWhere.locationId = locationId
    if (clientId) voucherWhere.clientId = clientId

    switch (reportType) {
      // ─── TRIAL BALANCE ─────────────────────────────────────────────────
      case 'trial_balance': {
        const accounts = await db.account.findMany({
          where: { isActive: true, allowPosting: true },
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

          // Always include accounts with activity
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

        return NextResponse.json({
          reportType: 'Trial Balance',
          data: trialBalance,
          totalDebit,
          totalCredit,
          asOf: dateTo || new Date().toISOString(),
        })
      }

      // ─── BALANCE SHEET ─────────────────────────────────────────────────
      case 'balance_sheet': {
        const accounts = await db.account.findMany({
          where: { isActive: true, accountType: { in: ['ASSET', 'LIABILITY', 'EQUITY'] }, allowPosting: true },
          orderBy: { code: 'asc' },
        })

        const sections: Record<string, any[]> = { assets: [], liabilities: [], equity: [] }
        const subTypeGroups: Record<string, Record<string, { accounts: any[]; total: number }>> = {
          assets: {},
          liabilities: {},
          equity: {},
        }
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

          if (account.accountType === 'ASSET') {
            // Accumulated depreciation / contra assets have credit balance
            if (account.subType === 'ACCUMULATED_DEPRECIATION' || account.subType === 'CONTRA_ASSET') {
              balance = credit - debit
            }
            totalAssets += balance
            const entry = { code: account.code, name: account.name, subType: account.subType, balance }
            sections.assets.push(entry)

            // Group by sub-type
            const st = account.subType || 'OTHER'
            if (!subTypeGroups.assets[st]) subTypeGroups.assets[st] = { accounts: [], total: 0 }
            subTypeGroups.assets[st].accounts.push(entry)
            subTypeGroups.assets[st].total += balance
          } else if (account.accountType === 'LIABILITY') {
            balance = credit - debit
            totalLiabilities += balance
            const entry = { code: account.code, name: account.name, subType: account.subType, balance }
            sections.liabilities.push(entry)

            const st = account.subType || 'OTHER'
            if (!subTypeGroups.liabilities[st]) subTypeGroups.liabilities[st] = { accounts: [], total: 0 }
            subTypeGroups.liabilities[st].accounts.push(entry)
            subTypeGroups.liabilities[st].total += balance
          } else if (account.accountType === 'EQUITY') {
            balance = credit - debit
            totalEquity += balance
            const entry = { code: account.code, name: account.name, subType: account.subType, balance }
            sections.equity.push(entry)

            const st = account.subType || 'OTHER'
            if (!subTypeGroups.equity[st]) subTypeGroups.equity[st] = { accounts: [], total: 0 }
            subTypeGroups.equity[st].accounts.push(entry)
            subTypeGroups.equity[st].total += balance
          }
        }

        return NextResponse.json({
          reportType: 'Balance Sheet',
          sections,
          subTypeGroups,
          totalAssets,
          totalLiabilities,
          totalEquity,
          check: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1 ? 'Balanced' : 'Out of Balance',
          asOf: dateTo || new Date().toISOString(),
        })
      }

      // ─── PROFIT & LOSS ─────────────────────────────────────────────────
      case 'pnl': {
        const accounts = await db.account.findMany({
          where: { isActive: true, accountType: { in: ['INCOME', 'EXPENSE'] }, allowPosting: true },
          orderBy: { code: 'asc' },
        })

        const income: any[] = []
        const expenses: any[] = []
        const incomeGroups: Record<string, { accounts: any[]; total: number }> = {}
        const expenseGroups: Record<string, { accounts: any[]; total: number }> = {}
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
            const entry = { code: account.code, name: account.name, subType: account.subType, balance }
            income.push(entry)

            const st = account.subType || 'OTHER'
            if (!incomeGroups[st]) incomeGroups[st] = { accounts: [], total: 0 }
            incomeGroups[st].accounts.push(entry)
            incomeGroups[st].total += balance
          } else {
            const balance = debit - credit
            totalExpenses += balance
            const entry = { code: account.code, name: account.name, subType: account.subType, balance }
            expenses.push(entry)

            const st = account.subType || 'OTHER'
            if (!expenseGroups[st]) expenseGroups[st] = { accounts: [], total: 0 }
            expenseGroups[st].accounts.push(entry)
            expenseGroups[st].total += balance
          }
        }

        return NextResponse.json({
          reportType: 'Profit & Loss Statement',
          income,
          expenses,
          incomeGroups,
          expenseGroups,
          totalIncome,
          totalExpenses,
          netSurplus: totalIncome - totalExpenses,
          periodFrom: dateFrom,
          periodTo: dateTo,
        })
      }

      // ─── CASH FLOW ─────────────────────────────────────────────────────
      case 'cash_flow': {
        const cashAccounts = await findAccountsByRole('CASH_AND_BANK')

        // If no cash accounts found via role system, fallback to all CASH/BANK sub-types
        const accountIds = cashAccounts.length > 0
          ? cashAccounts.map(a => a.id)
          : (await db.account.findMany({
              where: { isActive: true, subType: { in: ['CASH', 'BANK'] } },
              select: { id: true },
            })).map(a => a.id)

        const entries = await db.voucherEntry.findMany({
          where: {
            accountId: { in: accountIds },
            voucher: voucherWhere,
          },
          include: {
            account: { select: { code: true, name: true } },
            voucher: { select: { date: true, voucherNumber: true, voucherType: true, narration: true } },
          },
          orderBy: { voucher: { date: 'asc' } },
        })

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

      // ─── RECEIPTS & PAYMENTS ───────────────────────────────────────────
      case 'receipts_payments': {
        const cashAccounts = await findAccountsByRole('CASH_AND_BANK')
        const accountIds = cashAccounts.length > 0
          ? cashAccounts.map(a => a.id)
          : (await db.account.findMany({
              where: { isActive: true, subType: { in: ['CASH', 'BANK'] } },
              select: { id: true },
            })).map(a => a.id)

        const vouchers = await db.voucher.findMany({
          where: { ...voucherWhere, entries: { some: { accountId: { in: accountIds } } } },
          include: {
            entries: {
              where: { accountId: { in: accountIds } },
              include: { account: { select: { code: true, name: true } } },
            },
          },
          orderBy: { date: 'asc' },
        })

        const receipts = vouchers.filter(v => ['BR', 'CR'].includes(v.voucherType) || v.entries.some(e => e.debit > 0))
        const payments = vouchers.filter(v => ['BP', 'CP'].includes(v.voucherType) || v.entries.some(e => e.credit > 0))

        const totalReceipts = receipts.reduce((s, v) => s + v.entries.filter(e => e.debit > 0).reduce((s2, e) => s2 + e.debit, 0), 0)
        const totalPayments = payments.reduce((s, v) => s + v.entries.filter(e => e.credit > 0).reduce((s2, e) => s2 + e.credit, 0), 0)

        return NextResponse.json({
          reportType: 'Receipts & Payments',
          receipts,
          payments,
          totalReceipts,
          totalPayments,
          netAmount: totalReceipts - totalPayments,
          periodFrom: dateFrom,
          periodTo: dateTo,
        })
      }

      // ─── GENERAL LEDGER ────────────────────────────────────────────────
      case 'general_ledger': {
        if (!accountId) return NextResponse.json({ error: 'accountId is required for General Ledger' }, { status: 400 })

        const account = await db.account.findUnique({ where: { id: accountId } })
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

        const entries = await db.voucherEntry.findMany({
          where: { accountId, voucher: voucherWhere },
          include: {
            voucher: { select: { voucherNumber: true, date: true, narration: true, voucherType: true, voucherTypeName: true } },
          },
          orderBy: { voucher: { date: 'asc' } },
        })

        // Calculate running balance
        let runningBalance = 0
        const ledgerEntries = entries.map(e => {
          runningBalance += e.debit - e.credit
          return {
            id: e.id,
            date: e.voucher.date,
            voucherNumber: e.voucher.voucherNumber,
            voucherType: e.voucher.voucherType,
            voucherTypeName: e.voucher.voucherTypeName,
            narration: e.voucher.narration,
            description: e.description,
            debit: e.debit,
            credit: e.credit,
            balance: runningBalance,
          }
        })

        const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
        const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

        return NextResponse.json({
          reportType: 'General Ledger',
          account: { id: account.id, code: account.code, name: account.name, accountType: account.accountType, subType: account.subType },
          entries: ledgerEntries,
          totalDebit,
          totalCredit,
          closingBalance: totalDebit - totalCredit,
          periodFrom: dateFrom,
          periodTo: dateTo,
        })
      }

      // ─── AGING REPORT ──────────────────────────────────────────────────
      case 'aging': {
        const agingType = searchParams.get('agingType') || 'receivables'
        const subType = agingType === 'receivables' ? 'RECEIVABLE' : 'PAYABLE'
        const accountType = agingType === 'receivables' ? 'ASSET' : 'LIABILITY'

        const agingAccounts = await db.account.findMany({
          where: { isActive: true, accountType, subType },
        })

        const today = new Date()
        const periods = [
          { label: 'Current', min: 0, max: 30 },
          { label: '31-60 Days', min: 31, max: 60 },
          { label: '61-90 Days', min: 61, max: 90 },
          { label: '91-180 Days', min: 91, max: 180 },
          { label: '181-365 Days', min: 181, max: 365 },
          { label: 'Over 1 Year', min: 366, max: Infinity },
        ]

        const agingData: any[] = []
        const periodTotals = periods.map(() => 0)
        let grandTotal = 0

        for (const account of agingAccounts) {
          const entries = await db.voucherEntry.findMany({
            where: { accountId: account.id, voucher: voucherWhere },
            include: { voucher: { select: { date: true } } },
            orderBy: { voucher: { date: 'asc' } },
          })

          const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
          const totalCredit = entries.reduce((s, e) => s + e.credit, 0)
          const balance = agingType === 'receivables' ? totalDebit - totalCredit : totalCredit - totalDebit

          if (balance <= 0) continue

          const agingBuckets = periods.map(() => 0)
          const unpaidEntries = entries.filter(e =>
            agingType === 'receivables' ? e.debit > 0 : e.credit > 0
          )

          for (const entry of unpaidEntries) {
            const daysDiff = Math.floor((today.getTime() - new Date(entry.voucher.date).getTime()) / (1000 * 60 * 60 * 24))
            const amount = agingType === 'receivables' ? entry.debit : entry.credit
            for (let i = 0; i < periods.length; i++) {
              if (daysDiff >= periods[i].min && daysDiff <= periods[i].max) {
                agingBuckets[i] += amount
                break
              }
            }
          }

          agingData.push({
            code: account.code,
            name: account.name,
            balance,
            buckets: agingBuckets,
          })

          for (let i = 0; i < periods.length; i++) {
            periodTotals[i] += agingBuckets[i]
          }
          grandTotal += balance
        }

        return NextResponse.json({
          reportType: agingType === 'receivables' ? 'Aging - Receivables' : 'Aging - Payables',
          agingType,
          periods: periods.map(p => p.label),
          data: agingData,
          periodTotals,
          grandTotal,
          asOf: dateTo || new Date().toISOString(),
        })
      }

      // ─── BUDGET VS ACTUAL ──────────────────────────────────────────────
      case 'budget_vs_actual': {
        const budgets = await db.budget.findMany({
          where: { status: { in: ['approved', 'active'] } },
          include: {
            lines: {
              include: { account: { select: { code: true, name: true, accountType: true, subType: true } } },
            },
            financialYear: { select: { name: true } },
            project: { select: { code: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        })

        const budgetData: any[] = []
        let totalBudget = 0
        let totalActual = 0
        let totalVariance = 0

        for (const budget of budgets) {
          for (const line of budget.lines) {
            const actualResult = await db.voucherEntry.aggregate({
              _sum: { debit: true, credit: true },
              where: { accountId: line.accountId, voucher: voucherWhere },
            })
            const actual = (actualResult._sum.debit || 0) - (actualResult._sum.credit || 0)
            const variance = line.budgetAmount - actual

            budgetData.push({
              accountCode: line.account.code,
              accountName: line.account.name,
              accountType: line.account.accountType,
              subType: line.account.subType,
              period: line.period,
              budgetAmount: line.budgetAmount,
              actualAmount: actual,
              variance,
              variancePct: line.budgetAmount > 0 ? ((variance / line.budgetAmount) * 100) : 0,
              budgetName: budget.name,
              projectName: budget.project?.name,
            })

            totalBudget += line.budgetAmount
            totalActual += actual
            totalVariance += variance
          }
        }

        return NextResponse.json({
          reportType: 'Budget vs Actual',
          data: budgetData,
          totalBudget,
          totalActual,
          totalVariance,
          periodFrom: dateFrom,
          periodTo: dateTo,
        })
      }

      // ─── DONOR-WISE ────────────────────────────────────────────────────
      case 'donor_wise': {
        const donors = await db.donor.findMany()
        const donorData = []

        for (const donor of donors) {
          const result = await db.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: { voucher: { ...voucherWhere, donorId: donor.id } },
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

      // ─── PROJECT-WISE ──────────────────────────────────────────────────
      case 'project_wise': {
        const projects = await db.project.findMany()
        const projectData = []

        for (const project of projects) {
          const result = await db.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: { voucher: { ...voucherWhere, projectId: project.id } },
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

      // ─── LOCATION-WISE ─────────────────────────────────────────────────
      case 'location_wise': {
        const locations = await db.location.findMany()
        const locationData = []

        for (const location of locations) {
          const result = await db.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: { voucher: { ...voucherWhere, locationId: location.id } },
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

      // ─── CLIENT-WISE PROJECT ───────────────────────────────────────────
      case 'client_wise_project': {
        const clients = await db.client.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
        })

        const clientData = []

        for (const client of clients) {
          const clientVoucherWhere = { ...voucherWhere, clientId: client.id }

          const clientResult = await db.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: { voucher: clientVoucherWhere },
          })

          const clientProjects = await db.voucher.findMany({
            where: { ...clientVoucherWhere, projectId: { not: null } },
            select: { projectId: true, project: { select: { id: true, code: true, name: true, status: true } } },
            distinct: ['projectId'],
          })

          const projects = []
          for (const vp of clientProjects) {
            if (!vp.project) continue
            const projectResult = await db.voucherEntry.aggregate({
              _sum: { debit: true, credit: true },
              where: { voucher: { ...voucherWhere, clientId: client.id, projectId: vp.project.id } },
            })
            projects.push({
              id: vp.project.id,
              code: vp.project.code,
              name: vp.project.name,
              status: vp.project.status,
              totalDebit: projectResult._sum.debit || 0,
              totalCredit: projectResult._sum.credit || 0,
              balance: (projectResult._sum.debit || 0) - (projectResult._sum.credit || 0),
            })
          }

          clientData.push({
            id: client.id,
            code: client.code,
            name: client.name,
            industry: client.industry,
            totalDebit: clientResult._sum.debit || 0,
            totalCredit: clientResult._sum.credit || 0,
            balance: (clientResult._sum.debit || 0) - (clientResult._sum.credit || 0),
            projects,
            projectCount: projects.length,
          })
        }

        const grandTotalDebit = clientData.reduce((s, c) => s + c.totalDebit, 0)
        const grandTotalCredit = clientData.reduce((s, c) => s + c.totalCredit, 0)

        return NextResponse.json({
          reportType: 'Client-wise Project Report',
          data: clientData,
          grandTotalDebit,
          grandTotalCredit,
          grandBalance: grandTotalDebit - grandTotalCredit,
          periodFrom: dateFrom,
          periodTo: dateTo,
        })
      }

      // ─── ACCOUNT HEAD ──────────────────────────────────────────────────
      case 'account_head': {
        if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })

        const account = await db.account.findUnique({ where: { id: accountId } })
        if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

        const entries = await db.voucherEntry.findMany({
          where: { accountId, voucher: voucherWhere },
          include: {
            voucher: { select: { voucherNumber: true, date: true, narration: true, voucherType: true, voucherTypeName: true } },
          },
          orderBy: { voucher: { date: 'asc' } },
        })

        // Running balance
        let runningBalance = 0
        const ledgerEntries = entries.map(e => {
          runningBalance += e.debit - e.credit
          return {
            id: e.id,
            date: e.voucher.date,
            voucherNumber: e.voucher.voucherNumber,
            voucherType: e.voucher.voucherTypeName || e.voucher.voucherType,
            narration: e.voucher.narration,
            description: e.description,
            debit: e.debit,
            credit: e.credit,
            balance: runningBalance,
          }
        })

        return NextResponse.json({
          reportType: 'Account Head-wise Report',
          account: { id: account.id, code: account.code, name: account.name, accountType: account.accountType, subType: account.subType },
          entries: ledgerEntries,
          totalDebit: entries.reduce((s, e) => s + e.debit, 0),
          totalCredit: entries.reduce((s, e) => s + e.credit, 0),
        })
      }

      default:
        return NextResponse.json({ error: `Invalid report type: ${reportType}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
