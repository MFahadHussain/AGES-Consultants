import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'general'
    const accountId = searchParams.get('accountId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const projectId = searchParams.get('projectId')
    const donorId = searchParams.get('donorId')
    const statusFilter = searchParams.get('status') || 'posted' // 'posted', 'all', 'approved'

    // Build where clause for voucher entries
    // By default, show approved and posted vouchers in ledgers
    // If status=all, show all vouchers including drafts
    const entryWhere: any = {}
    if (statusFilter === 'posted') {
      entryWhere.voucher = { status: { in: ['approved', 'posted'] } }
    } else if (statusFilter === 'approved') {
      entryWhere.voucher = { status: { in: ['reviewed', 'approved', 'posted'] } }
    }
    // status='all' => no status filter, show everything including drafts

    if (accountId) entryWhere.accountId = accountId
    if (dateFrom || dateTo) {
      if (!entryWhere.voucher) entryWhere.voucher = {}
      entryWhere.voucher.date = {}
      if (dateFrom) entryWhere.voucher.date.gte = new Date(dateFrom)
      if (dateTo) entryWhere.voucher.date.lte = new Date(dateTo)
    }
    if (projectId) {
      if (!entryWhere.voucher) entryWhere.voucher = {}
      entryWhere.voucher.projectId = projectId
    }
    if (donorId) {
      if (!entryWhere.voucher) entryWhere.voucher = {}
      entryWhere.voucher.donorId = donorId
    }

    switch (type) {
      case 'general': {
        // General Ledger - entries grouped by account
        const entries = await db.voucherEntry.findMany({
          where: entryWhere,
          include: {
            account: { select: { code: true, name: true, accountType: true } },
            voucher: { select: { voucherNumber: true, date: true, narration: true, voucherType: true, voucherTypeName: true, status: true } },
          },
          orderBy: [{ voucher: { date: 'asc' } }, { lineNumber: 'asc' }],
        })

        // Group by account
        const grouped: Record<string, any> = {}
        for (const entry of entries) {
          const key = entry.accountId
          if (!grouped[key]) {
            grouped[key] = {
              accountId: key,
              accountCode: entry.account.code,
              accountName: entry.account.name,
              accountType: entry.account.accountType,
              entries: [],
              totalDebit: 0,
              totalCredit: 0,
            }
          }
          grouped[key].entries.push(entry)
          grouped[key].totalDebit += entry.debit
          grouped[key].totalCredit += entry.credit
        }
        return NextResponse.json(Object.values(grouped))
      }

      case 'receivables': {
        // Receivables Ledger - entries with customer references
        entryWhere.customerId = { not: null }
        const entries = await db.voucherEntry.findMany({
          where: entryWhere,
          include: {
            account: { select: { code: true, name: true, accountType: true } },
            customer: true,
            voucher: { select: { voucherNumber: true, date: true, narration: true, voucherTypeName: true, status: true } },
          },
          orderBy: { voucher: { date: 'asc' } },
        })
        const grouped: Record<string, any> = {}
        for (const entry of entries) {
          const key = entry.customerId
          if (!grouped[key!]) {
            grouped[key!] = { customerId: key, customer: entry.customer, entries: [], totalDebit: 0, totalCredit: 0 }
          }
          grouped[key!].entries.push(entry)
          grouped[key!].totalDebit += entry.debit
          grouped[key!].totalCredit += entry.credit
        }
        return NextResponse.json(Object.values(grouped))
      }

      case 'payables': {
        // Payables Ledger - entries with supplier references
        entryWhere.supplierId = { not: null }
        const entries = await db.voucherEntry.findMany({
          where: entryWhere,
          include: {
            account: { select: { code: true, name: true, accountType: true } },
            supplier: true,
            voucher: { select: { voucherNumber: true, date: true, narration: true, voucherTypeName: true, status: true } },
          },
          orderBy: { voucher: { date: 'asc' } },
        })
        const grouped: Record<string, any> = {}
        for (const entry of entries) {
          const key = entry.supplierId
          if (!grouped[key!]) {
            grouped[key!] = { supplierId: key, supplier: entry.supplier, entries: [], totalDebit: 0, totalCredit: 0 }
          }
          grouped[key!].entries.push(entry)
          grouped[key!].totalDebit += entry.debit
          grouped[key!].totalCredit += entry.credit
        }
        return NextResponse.json(Object.values(grouped))
      }

      case 'bank': {
        // Bank Ledger - entries grouped by bank account with running balances
        const bankAccounts = await db.account.findMany({
          where: { subType: 'CURRENT_ASSET', code: { startsWith: '112' }, allowPosting: true },
          select: { id: true, code: true, name: true, accountType: true },
        })

        if (bankAccounts.length === 0) {
          return NextResponse.json([])
        }

        const bankAccountIds = bankAccounts.map(a => a.id)
        const bankAccountMap: Record<string, { code: string; name: string; accountType: string }> = {}
        for (const acc of bankAccounts) {
          bankAccountMap[acc.id] = { code: acc.code, name: acc.name, accountType: acc.accountType }
        }

        entryWhere.accountId = { in: bankAccountIds }
        const entries = await db.voucherEntry.findMany({
          where: entryWhere,
          include: {
            account: { select: { code: true, name: true, accountType: true } },
            voucher: { select: { voucherNumber: true, date: true, narration: true, voucherType: true, voucherTypeName: true, status: true } },
          },
          orderBy: [{ voucher: { date: 'asc' } }, { lineNumber: 'asc' }],
        })

        // Group by account with running balances
        const grouped: Record<string, any> = {}
        for (const acc of bankAccounts) {
          grouped[acc.id] = {
            accountId: acc.id,
            accountCode: acc.code,
            accountName: acc.name,
            accountType: acc.accountType,
            entries: [],
            totalDebit: 0,
            totalCredit: 0,
          }
        }

        for (const entry of entries) {
          const key = entry.accountId
          if (!grouped[key]) {
            // Account not in our bank accounts list - skip (shouldn't happen due to filter)
            continue
          }
          grouped[key].entries.push(entry)
          grouped[key].totalDebit += entry.debit
          grouped[key].totalCredit += entry.credit
        }

        return NextResponse.json(Object.values(grouped))
      }

      case 'expense': {
        // Expense Ledger - entries grouped by expense account with running balances
        const expenseAccounts = await db.account.findMany({
          where: { accountType: 'EXPENSE', allowPosting: true },
          select: { id: true, code: true, name: true, accountType: true },
        })

        if (expenseAccounts.length === 0) {
          return NextResponse.json([])
        }

        const expenseAccountIds = expenseAccounts.map(a => a.id)
        const expenseAccountMap: Record<string, { code: string; name: string; accountType: string }> = {}
        for (const acc of expenseAccounts) {
          expenseAccountMap[acc.id] = { code: acc.code, name: acc.name, accountType: acc.accountType }
        }

        entryWhere.accountId = { in: expenseAccountIds }
        const entries = await db.voucherEntry.findMany({
          where: entryWhere,
          include: {
            account: { select: { code: true, name: true, accountType: true } },
            voucher: { select: { voucherNumber: true, date: true, narration: true, voucherType: true, voucherTypeName: true, status: true } },
          },
          orderBy: [{ voucher: { date: 'asc' } }, { lineNumber: 'asc' }],
        })

        // Group by account with running balances
        const grouped: Record<string, any> = {}
        for (const acc of expenseAccounts) {
          grouped[acc.id] = {
            accountId: acc.id,
            accountCode: acc.code,
            accountName: acc.name,
            accountType: acc.accountType,
            entries: [],
            totalDebit: 0,
            totalCredit: 0,
          }
        }

        for (const entry of entries) {
          const key = entry.accountId
          if (!grouped[key]) {
            // Account not in our expense accounts list - skip (shouldn't happen due to filter)
            continue
          }
          grouped[key].entries.push(entry)
          grouped[key].totalDebit += entry.debit
          grouped[key].totalCredit += entry.credit
        }

        return NextResponse.json(Object.values(grouped))
      }

      default:
        return NextResponse.json({ error: 'Invalid ledger type' }, { status: 400 })
    }
  } catch (error) {
    console.error('GET /api/ledgers error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
