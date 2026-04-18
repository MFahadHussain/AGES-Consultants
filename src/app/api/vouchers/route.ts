import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

// ============================================================
// Advanced Voucher Search & Listing API
// Supports: search, filters, date range, amount range, party name,
// project/donor/location, status, pagination, sorting
// ============================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Search parameters
    const search = searchParams.get('search')
    const partyName = searchParams.get('partyName')
    const amountMin = searchParams.get('amountMin')
    const amountMax = searchParams.get('amountMax')

    // Filter parameters
    const voucherType = searchParams.get('voucherType')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const projectId = searchParams.get('projectId')
    const donorId = searchParams.get('donorId')
    const locationId = searchParams.get('locationId')

    // Pagination & sorting
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sort = searchParams.get('sort') || 'createdAt'

    // Build where clause
    const where: any = {}

    // General search (voucher number, narration, reference, payee, cheque)
    if (search) {
      where.OR = [
        { voucherNumber: { contains: search } },
        { narration: { contains: search } },
        { reference: { contains: search } },
        { payeeName: { contains: search } },
        { voucherNo: { contains: search } },
        { chequeNumber: { contains: search } },
      ]
    }

    // Party name search (fuzzy match on payeeName)
    if (partyName) {
      where.payeeName = { contains: partyName }
    }

    // Amount range filter
    if (amountMin || amountMax) {
      where.totalDebit = {}
      if (amountMin) where.totalDebit.gte = parseFloat(amountMin)
      if (amountMax) where.totalDebit.lte = parseFloat(amountMax)
    }

    // Voucher type filter
    if (voucherType) where.voucherType = voucherType

    // Status filter
    if (status) where.status = status

    // Date range filter
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }

    // Project filter
    if (projectId) where.projectId = projectId

    // Donor filter
    if (donorId) where.donorId = donorId

    // Location filter
    if (locationId) where.locationId = locationId

    // Determine sort order
    let orderBy: any = { createdAt: 'desc' }
    if (sort === 'date') orderBy = { date: 'desc' }
    else if (sort === 'date_asc') orderBy = { date: 'asc' }
    else if (sort === 'amount') orderBy = { totalDebit: 'desc' }
    else if (sort === 'amount_asc') orderBy = { totalDebit: 'asc' }
    else if (sort === 'voucherNumber') orderBy = { voucherNumber: 'asc' }

    const [vouchers, total] = await Promise.all([
      db.voucher.findMany({
        where,
        include: {
          financialYear: { select: { name: true } },
          project: { select: { name: true } },
          donor: { select: { name: true } },
          location: { select: { name: true } },
          _count: { select: { entries: true, attachments: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.voucher.count({ where }),
    ])

    // Collect active filters for response
    const activeFilters: Record<string, string> = {}
    if (search) activeFilters.search = search
    if (partyName) activeFilters.partyName = partyName
    if (amountMin) activeFilters.amountMin = amountMin
    if (amountMax) activeFilters.amountMax = amountMax
    if (voucherType) activeFilters.voucherType = voucherType
    if (status) activeFilters.status = status
    if (dateFrom) activeFilters.dateFrom = dateFrom
    if (dateTo) activeFilters.dateTo = dateTo
    if (projectId) activeFilters.projectId = projectId
    if (donorId) activeFilters.donorId = donorId
    if (locationId) activeFilters.locationId = locationId

    return NextResponse.json({
      data: vouchers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      activeFilters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
    })
  } catch (error) {
    console.error('GET /api/vouchers error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { voucherType, voucherTypeName, date, narration, reference, payeeName, chequeNumber, chequeDate, voucherNo, amountInWords, financialYearId, projectId, donorId, locationId, entries, autoPost } = data

    if (!voucherType || !date || !narration || !entries?.length) {
      return NextResponse.json({ error: 'Voucher type, date, narration, and entries are required' }, { status: 400 })
    }

    // Validate: debits must equal credits
    const totalDebit = entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0)
    const totalCredit = entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({ error: `Debits (${totalDebit}) must equal credits (${totalCredit})` }, { status: 400 })
    }

    const systemUserId = await getSystemUserId()
    const userRole = data.userRole || 'accountant' // Default to accountant for creation

    // Generate voucher number
    const count = await db.voucher.count({ where: { voucherType } })
    const voucherNumber = `${voucherType}-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`

    // Determine initial status
    // Accountant creates as Draft, Admin can auto-post
    const initialStatus = autoPost ? 'posted' : 'draft'

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
        status: initialStatus,
        financialYearId,
        projectId: projectId || null,
        donorId: donorId || null,
        locationId: locationId || null,
        totalDebit,
        totalCredit,
        createdBy: systemUserId,
        ...(autoPost ? { reviewedBy: systemUserId, approvedBy: systemUserId, postedBy: systemUserId } : {}),
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

    // Create audit trail
    try {
      const action = autoPost ? 'QUICK_POST' : 'CREATE'
      await db.voucherApproval.create({
        data: {
          voucherId: voucher.id,
          userId: systemUserId,
          action,
          fromStatus: 'new',
          toStatus: initialStatus,
          comments: autoPost ? 'Auto-posted on creation' : 'Voucher created as draft',
          userRole,
        },
      })
      await db.auditLog.create({
        data: { userId: systemUserId, action, entity: 'Voucher', entityId: voucher.id, details: `Created ${voucherNumber} (status: ${initialStatus}) by ${userRole}` },
      })
    } catch (auditError) {
      console.error('Audit log creation failed (non-critical):', auditError)
    }

    return NextResponse.json(voucher, { status: 201 })
  } catch (error) {
    console.error('POST /api/vouchers error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
