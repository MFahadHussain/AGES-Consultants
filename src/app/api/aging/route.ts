import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'receivables' // receivables or payables

    const now = new Date()
    const buckets = [
      { label: 'Current', min: 0, max: 30 },
      { label: '31-60 Days', min: 31, max: 60 },
      { label: '61-90 Days', min: 61, max: 90 },
      { label: '91-120 Days', min: 91, max: 120 },
      { label: '120+ Days', min: 121, max: 9999 },
    ]

    if (type === 'receivables') {
      // Get all customer-related entries
      const entries = await db.voucherEntry.findMany({
        where: { customerId: { not: null }, voucher: { status: 'posted' } },
        include: { customer: true, voucher: { select: { date: true, voucherNumber: true } } },
      })

      // Group by customer
      const customerMap: Record<string, any> = {}
      for (const entry of entries) {
        const cid = entry.customerId!
        if (!customerMap[cid]) {
          customerMap[cid] = { customer: entry.customer, totalDebit: 0, totalCredit: 0, balance: 0, buckets: buckets.map(b => ({ ...b, amount: 0 })) }
        }
        customerMap[cid].totalDebit += entry.debit
        customerMap[cid].totalCredit += entry.credit

        const daysDiff = Math.floor((now.getTime() - new Date(entry.voucher.date).getTime()) / (1000 * 60 * 60 * 24))
        const bucket = customerMap[cid].buckets.find((b: any) => daysDiff >= b.min && daysDiff <= b.max)
        if (bucket && entry.debit > 0) bucket.amount += entry.debit
      }

      // Calculate balance
      for (const key of Object.keys(customerMap)) {
        customerMap[key].balance = customerMap[key].totalDebit - customerMap[key].totalCredit
      }

      return NextResponse.json({ type: 'receivables', data: Object.values(customerMap), buckets })
    } else {
      // Payables aging
      const entries = await db.voucherEntry.findMany({
        where: { supplierId: { not: null }, voucher: { status: 'posted' } },
        include: { supplier: true, voucher: { select: { date: true, voucherNumber: true } } },
      })

      const supplierMap: Record<string, any> = {}
      for (const entry of entries) {
        const sid = entry.supplierId!
        if (!supplierMap[sid]) {
          supplierMap[sid] = { supplier: entry.supplier, totalDebit: 0, totalCredit: 0, balance: 0, buckets: buckets.map(b => ({ ...b, amount: 0 })) }
        }
        supplierMap[sid].totalDebit += entry.debit
        supplierMap[sid].totalCredit += entry.credit

        const daysDiff = Math.floor((now.getTime() - new Date(entry.voucher.date).getTime()) / (1000 * 60 * 60 * 24))
        const bucket = supplierMap[sid].buckets.find((b: any) => daysDiff >= b.min && daysDiff <= b.max)
        if (bucket && entry.credit > 0) bucket.amount += entry.credit
      }

      for (const key of Object.keys(supplierMap)) {
        supplierMap[key].balance = supplierMap[key].totalCredit - supplierMap[key].totalDebit
      }

      return NextResponse.json({ type: 'payables', data: Object.values(supplierMap), buckets })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const GET = withAudit('aging', GET_HANDLER);
