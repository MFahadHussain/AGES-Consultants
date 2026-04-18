import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

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
    console.error('GET /api/vouchers/[id] error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await request.json()
    const systemUserId = await getSystemUserId()

    // Handle status transitions
    if (data.action === 'review') {
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'reviewed', reviewedBy: systemUserId },
      })
      try {
        await db.voucherApproval.create({
          data: { voucherId: id, userId: systemUserId, action: 'REVIEW', comments: data.comments },
        })
        await db.auditLog.create({
          data: { userId: systemUserId, action: 'REVIEW', entity: 'Voucher', entityId: id, details: 'Voucher reviewed' },
        })
      } catch (auditError) {
        console.error('Audit log error (non-critical):', auditError)
      }
      return NextResponse.json(voucher)
    }

    if (data.action === 'approve') {
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'approved', approvedBy: systemUserId },
      })
      try {
        await db.voucherApproval.create({
          data: { voucherId: id, userId: systemUserId, action: 'APPROVE', comments: data.comments },
        })
        await db.auditLog.create({
          data: { userId: systemUserId, action: 'APPROVE', entity: 'Voucher', entityId: id, details: 'Voucher approved' },
        })
      } catch (auditError) {
        console.error('Audit log error (non-critical):', auditError)
      }
      return NextResponse.json(voucher)
    }

    if (data.action === 'post') {
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'posted', postedBy: systemUserId },
      })
      try {
        await db.voucherApproval.create({
          data: { voucherId: id, userId: systemUserId, action: 'POST', comments: data.comments },
        })
        await db.auditLog.create({
          data: { userId: systemUserId, action: 'POST', entity: 'Voucher', entityId: id, details: 'Voucher posted to GL' },
        })
      } catch (auditError) {
        console.error('Audit log error (non-critical):', auditError)
      }
      return NextResponse.json(voucher)
    }

    // Quick Post: skip review/approve and post directly from draft/reviewed
    if (data.action === 'quick_post') {
      const current = await db.voucher.findUnique({ where: { id }, select: { status: true } })
      if (!current || current.status === 'posted') {
        return NextResponse.json({ error: 'Voucher already posted or not found' }, { status: 400 })
      }
      const voucher = await db.voucher.update({
        where: { id },
        data: {
          status: 'posted',
          reviewedBy: current.status === 'draft' ? systemUserId : undefined,
          approvedBy: systemUserId,
          postedBy: systemUserId,
        },
      })
      try {
        await db.voucherApproval.create({
          data: { voucherId: id, userId: systemUserId, action: 'QUICK_POST', comments: data.comments || 'Quick posted to GL' },
        })
        await db.auditLog.create({
          data: { userId: systemUserId, action: 'QUICK_POST', entity: 'Voucher', entityId: id, details: 'Voucher quick-posted to GL (skipped review/approve)' },
        })
      } catch (auditError) {
        console.error('Audit log error (non-critical):', auditError)
      }
      return NextResponse.json(voucher)
    }

    if (data.action === 'reject') {
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'rejected' },
      })
      try {
        await db.voucherApproval.create({
          data: { voucherId: id, userId: systemUserId, action: 'REJECT', comments: data.comments },
        })
        await db.auditLog.create({
          data: { userId: systemUserId, action: 'REJECT', entity: 'Voucher', entityId: id, details: 'Voucher rejected' },
        })
      } catch (auditError) {
        console.error('Audit log error (non-critical):', auditError)
      }
      return NextResponse.json(voucher)
    }

    // ============================================================
    // General Update (Edit Voucher) - only allowed for draft/rejected vouchers
    // ============================================================
    if (data.action === 'edit' || data.entries) {
      const current = await db.voucher.findUnique({ where: { id }, select: { status: true } })
      if (!current) {
        return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      }
      if (current.status !== 'draft' && current.status !== 'rejected') {
        return NextResponse.json({ error: 'Only draft or rejected vouchers can be edited' }, { status: 400 })
      }

      // Validate debits = credits if entries are provided
      if (data.entries?.length) {
        const totalDebit = data.entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0)
        const totalCredit = data.entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0)
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          return NextResponse.json({ error: `Debits (${totalDebit}) must equal credits (${totalCredit})` }, { status: 400 })
        }
      }

      // Delete old entries and create new ones
      if (data.entries) {
        await db.voucherEntry.deleteMany({ where: { voucherId: id } })
      }

      const updateData: any = {}
      if (data.voucherType !== undefined) updateData.voucherType = data.voucherType
      if (data.voucherTypeName !== undefined) updateData.voucherTypeName = data.voucherTypeName
      if (data.date !== undefined) updateData.date = new Date(data.date)
      if (data.narration !== undefined) updateData.narration = data.narration
      if (data.reference !== undefined) updateData.reference = data.reference || null
      if (data.payeeName !== undefined) updateData.payeeName = data.payeeName || null
      if (data.chequeNumber !== undefined) updateData.chequeNumber = data.chequeNumber || null
      if (data.chequeDate !== undefined) updateData.chequeDate = data.chequeDate ? new Date(data.chequeDate) : null
      if (data.voucherNo !== undefined) updateData.voucherNo = data.voucherNo || null
      if (data.amountInWords !== undefined) updateData.amountInWords = data.amountInWords || null
      if (data.projectId !== undefined) updateData.projectId = data.projectId || null
      if (data.donorId !== undefined) updateData.donorId = data.donorId || null
      if (data.locationId !== undefined) updateData.locationId = data.locationId || null

      if (data.entries) {
        const totalDebit = data.entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0)
        const totalCredit = data.entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0)
        updateData.totalDebit = totalDebit
        updateData.totalCredit = totalCredit
        updateData.entries = {
          create: data.entries.map((e: any, i: number) => ({
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
        }
      }

      // Reset status to draft if it was rejected
      if (current.status === 'rejected') {
        updateData.status = 'draft'
      }

      const voucher = await db.voucher.update({
        where: { id },
        data: updateData,
        include: { entries: { include: { account: true } }, project: true, donor: true, location: true },
      })

      try {
        await db.auditLog.create({
          data: { userId: systemUserId, action: 'UPDATE', entity: 'Voucher', entityId: id, details: 'Voucher updated' },
        })
      } catch (auditError) {
        console.error('Audit log error (non-critical):', auditError)
      }

      return NextResponse.json(voucher)
    }

    // Fallback general update
    const voucher = await db.voucher.update({ where: { id }, data })
    return NextResponse.json(voucher)
  } catch (error) {
    console.error('PUT /api/vouchers/[id] error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const systemUserId = await getSystemUserId()

    const voucher = await db.voucher.findUnique({
      where: { id },
      select: { status: true, voucherNumber: true },
    })

    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    }

    // Only allow deletion of draft or rejected vouchers
    if (voucher.status !== 'draft' && voucher.status !== 'rejected') {
      return NextResponse.json(
        { error: `Cannot delete voucher with status "${voucher.status}". Only draft or rejected vouchers can be deleted.` },
        { status: 400 }
      )
    }

    // Delete related records first (cascading should handle this, but let's be explicit)
    await db.voucherApproval.deleteMany({ where: { voucherId: id } })
    await db.voucherEntry.deleteMany({ where: { voucherId: id } })
    await db.voucherAttachment.deleteMany({ where: { voucherId: id } })
    await db.bankReconciliationItem.deleteMany({ where: { voucherId: id } })
    await db.voucher.delete({ where: { id } })

    try {
      await db.auditLog.create({
        data: {
          userId: systemUserId,
          action: 'DELETE',
          entity: 'Voucher',
          entityId: id,
          details: `Deleted voucher ${voucher.voucherNumber}`,
        },
      })
    } catch (auditError) {
      console.error('Audit log error (non-critical):', auditError)
    }

    return NextResponse.json({ message: 'Voucher deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/vouchers/[id] error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
