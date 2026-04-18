import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const voucherType = searchParams.get('voucherType')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const projectId = searchParams.get('projectId')
    const donorId = searchParams.get('donorId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    if (voucherType) where.voucherType = voucherType
    if (status) where.status = status
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }
    if (projectId) where.projectId = projectId
    if (donorId) where.donorId = donorId
    if (search) {
      where.OR = [
        { voucherNumber: { contains: search } },
        { narration: { contains: search } },
        { reference: { contains: search } },
      ]
    }

    const [vouchers, total] = await Promise.all([
      db.voucher.findMany({
        where,
        include: {
          financialYear: { select: { name: true } },
          project: { select: { name: true } },
          donor: { select: { name: true } },
          location: { select: { name: true } },
          _count: { select: { entries: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.voucher.count({ where }),
    ])

    return NextResponse.json({ data: vouchers, total, page, limit })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { voucherType, voucherTypeName, date, narration, reference, payeeName, chequeNumber, chequeDate, voucherNo, amountInWords, financialYearId, projectId, donorId, locationId, entries } = data

    if (!voucherType || !date || !narration || !entries?.length) {
      return NextResponse.json({ error: 'Voucher type, date, narration, and entries are required' }, { status: 400 })
    }

    // Validate: debits must equal credits
    const totalDebit = entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0)
    const totalCredit = entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({ error: `Debits (${totalDebit}) must equal credits (${totalCredit})` }, { status: 400 })
    }

    // Generate voucher number
    const count = await db.voucher.count({ where: { voucherType } })
    const voucherNumber = `${voucherType}-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`

    const voucher = await db.voucher.create({
      data: {
        voucherNumber,
        voucherType,
        voucherTypeName: voucherTypeName || voucherType,
        date: new Date(date),
        narration,
        reference: reference || null,
        payeeName: payeeName || null,
        chequeNumber: chequeNumber || null,
        chequeDate: chequeDate ? new Date(chequeDate) : null,
        voucherNo: voucherNo || null,
        amountInWords: amountInWords || null,
        status: 'draft',
        financialYearId,
        projectId: projectId || null,
        donorId: donorId || null,
        locationId: locationId || null,
        totalDebit,
        totalCredit,
        createdBy: 'system',
        entries: {
          create: entries.map((e: any, i: number) => ({
            lineNumber: i + 1,
            accountId: e.accountId,
            debit: e.debit || 0,
            credit: e.credit || 0,
            customerId: e.customerId || null,
            supplierId: e.supplierId || null,
            description: e.description || null,
            projectId: e.projectId || null,
            donorId: e.donorId || null,
            locationId: e.locationId || null,
            payrollRef: e.payrollRef || null,
            assetRef: e.assetRef || null,
          })),
        },
      },
      include: { entries: { include: { account: true } } },
    })

    await db.auditLog.create({
      data: { userId: 'system', action: 'CREATE', entity: 'Voucher', entityId: voucher.id, details: `Created ${voucherNumber}` },
    })

    return NextResponse.json(voucher, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
