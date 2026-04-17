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

    // Build where clause for voucher entries
    const entryWhere: any = { voucher: { status: 'posted' } }
    if (accountId) entryWhere.accountId = accountId
    if (dateFrom || dateTo) {
      entryWhere.voucher = { ...entryWhere.voucher, date: {} }
      if (dateFrom) entryWhere.voucher.date.gte = new Date(dateFrom)
      if (dateTo) entryWhere.voucher.date.lte = new Date(dateTo)
    }
    if (projectId) entryWhere.voucher.projectId = projectId
    if (donorId) entryWhere.voucher.donorId = donorId

    switch (type) {
      case 'general': {
        // General Ledger - entries grouped by account
        const entries = await db.voucherEntry.findMany({
          where: entryWhere,
          include: {
            account: { select: { code: true, name: true, accountType: true } },
            voucher: { select: { voucherNumber: true, date: true, narration: true, voucherType: true } },
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
            account: { select: { code: true, name: true } },
            customer: true,
            voucher: { select: { voucherNumber: true, date: true, narration: true } },
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
            account: { select: { code: true, name: true } },
            supplier: true,
            voucher: { select: { voucherNumber: true, date: true, narration: true } },
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
        // Bank Ledger - entries for bank accounts
        const bankAccounts = await db.account.findMany({
          where: { subType: 'CURRENT_ASSET', code: { startsWith: '112' } },
        })
        entryWhere.accountId = { in: bankAccounts.map(a => a.id) }
        const entries = await db.voucherEntry.findMany({
          where: entryWhere,
          include: {
            account: { select: { code: true, name: true } },
            voucher: { select: { voucherNumber: true, date: true, narration: true, voucherType: true } },
          },
          orderBy: { voucher: { date: 'asc' } },
        })
        return NextResponse.json(entries)
      }

      case 'expense': {
        // Expense Ledger
        const expenseAccounts = await db.account.findMany({ where: { accountType: 'EXPENSE' } })
        entryWhere.accountId = { in: expenseAccounts.map(a => a.id) }
        const entries = await db.voucherEntry.findMany({
          where: entryWhere,
          include: {
            account: { select: { code: true, name: true } },
            voucher: { select: { voucherNumber: true, date: true, narration: true } },
          },
          orderBy: { voucher: { date: 'asc' } },
        })
        return NextResponse.json(entries)
      }

      default:
        return NextResponse.json({ error: 'Invalid ledger type' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
