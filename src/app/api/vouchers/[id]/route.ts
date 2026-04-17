import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const voucher = await db.voucher.findUnique({
      where: { id },
      include: {
        entries: { include: { account: true, customer: true, supplier: true }, orderBy: { lineNumber: 'asc' } },
        approvals: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } },
        attachments: true,
        financialYear: true,
        project: true,
        donor: true,
        location: true,
      },
    })
    if (!voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    return NextResponse.json(voucher)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await request.json()

    // Handle status transitions
    if (data.action === 'review') {
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'reviewed', reviewedBy: 'system' },
      })
      await db.voucherApproval.create({
        data: { voucherId: id, userId: 'system', action: 'REVIEW', comments: data.comments },
      })
      await db.auditLog.create({
        data: { userId: 'system', action: 'REVIEW', entity: 'Voucher', entityId: id, details: 'Voucher reviewed' },
      })
      return NextResponse.json(voucher)
    }

    if (data.action === 'approve') {
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'approved', approvedBy: 'system' },
      })
      await db.voucherApproval.create({
        data: { voucherId: id, userId: 'system', action: 'APPROVE', comments: data.comments },
      })
      await db.auditLog.create({
        data: { userId: 'system', action: 'APPROVE', entity: 'Voucher', entityId: id, details: 'Voucher approved' },
      })
      return NextResponse.json(voucher)
    }

    if (data.action === 'post') {
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'posted', postedBy: 'system' },
      })
      await db.voucherApproval.create({
        data: { voucherId: id, userId: 'system', action: 'POST', comments: data.comments },
      })
      await db.auditLog.create({
        data: { userId: 'system', action: 'POST', entity: 'Voucher', entityId: id, details: 'Voucher posted to GL' },
      })
      return NextResponse.json(voucher)
    }

    if (data.action === 'reject') {
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'rejected' },
      })
      await db.voucherApproval.create({
        data: { voucherId: id, userId: 'system', action: 'REJECT', comments: data.comments },
      })
      return NextResponse.json(voucher)
    }

    // General update
    const voucher = await db.voucher.update({ where: { id }, data })
    return NextResponse.json(voucher)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
