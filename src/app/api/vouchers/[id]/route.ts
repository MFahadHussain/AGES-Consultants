import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

// ============================================================
// Voucher Approval Workflow with Role-Based Access Control
// Status Flow: Draft → Pending → Approved → Posted
// Roles: Accountant (create/submit), Manager (review/approve), Admin (post/anything)
// ============================================================

const VALID_ROLES = ['admin', 'manager', 'accountant', 'auditor', 'viewer'] as const
type Role = typeof VALID_ROLES[number]

// Role hierarchy for workflow actions
const ROLE_PERMISSIONS: Record<string, string[]> = {
  submit: ['admin', 'manager', 'accountant'],
  approve: ['admin', 'manager'],
  post: ['admin'],
  reject: ['admin', 'manager'],
  quick_post: ['admin'],
  edit: ['admin', 'manager', 'accountant'],
  revoke: ['admin'],
}

function hasPermission(action: string, role: string): boolean {
  const allowed = ROLE_PERMISSIONS[action]
  if (!allowed) return false
  return allowed.includes(role)
}

function validateRole(role: string): string {
  if ((VALID_ROLES as readonly string[]).includes(role)) return role
  return 'admin' // Default to admin for backward compatibility
}

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
        client: true,
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
    const userRole = validateRole(data.userRole || 'admin')

    // Helper: create approval record with full audit trail
    const createApproval = async (action: string, fromStatus: string, toStatus: string, comments?: string) => {
      try {
        await db.voucherApproval.create({
          data: {
            voucherId: id,
            userId: systemUserId,
            action,
            fromStatus,
            toStatus,
            comments: comments || null,
            userRole,
          },
        })
        await db.auditLog.create({
          data: {
            userId: systemUserId,
            action,
            entity: 'Voucher',
            entityId: id,
            details: `Status: ${fromStatus} → ${toStatus} by ${userRole}`,
          },
        })
      } catch (auditError) {
        console.error('Audit log error (non-critical):', auditError)
      }
    }

    // ==================== WORKFLOW ACTIONS ====================

    // SUBMIT: Draft → Pending (Accountant or above)
    if (data.action === 'submit') {
      if (!hasPermission('submit', userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions. Accountant role or above required to submit vouchers.' }, { status: 403 })
      }
      const current = await db.voucher.findUnique({ where: { id }, select: { status: true } })
      if (!current) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      if (current.status !== 'draft' && current.status !== 'rejected') {
        return NextResponse.json({ error: `Cannot submit voucher with status "${current.status}". Only draft or rejected vouchers can be submitted.` }, { status: 400 })
      }
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'pending', reviewedBy: systemUserId },
      })
      await createApproval('SUBMIT', current.status, 'pending', data.comments)
      return NextResponse.json(voucher)
    }

    // APPROVE: Pending → Approved (Manager or Admin)
    if (data.action === 'approve') {
      if (!hasPermission('approve', userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions. Manager role or above required to approve vouchers.' }, { status: 403 })
      }
      const current = await db.voucher.findUnique({ where: { id }, select: { status: true } })
      if (!current) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      if (current.status !== 'pending') {
        return NextResponse.json({ error: `Cannot approve voucher with status "${current.status}". Only pending vouchers can be approved.` }, { status: 400 })
      }
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'approved', approvedBy: systemUserId },
      })
      await createApproval('APPROVE', 'pending', 'approved', data.comments)
      return NextResponse.json(voucher)
    }

    // POST: Approved → Posted (Admin only)
    if (data.action === 'post') {
      if (!hasPermission('post', userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions. Admin role required to post vouchers to GL.' }, { status: 403 })
      }
      const current = await db.voucher.findUnique({ where: { id }, select: { status: true } })
      if (!current) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      if (current.status !== 'approved' && current.status !== 'draft') {
        return NextResponse.json({ error: `Cannot post voucher with status "${current.status}". Only approved or draft vouchers can be posted.` }, { status: 400 })
      }
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'posted', reviewedBy: systemUserId, approvedBy: systemUserId, postedBy: systemUserId },
      })
      await createApproval('POST', current.status, 'posted', data.comments || 'Payroll voucher posted to GL')
      return NextResponse.json(voucher)
    }

    // REJECT: Any non-posted → Rejected (Manager or Admin)
    if (data.action === 'reject') {
      if (!hasPermission('reject', userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions. Manager role or above required to reject vouchers.' }, { status: 403 })
      }
      const current = await db.voucher.findUnique({ where: { id }, select: { status: true } })
      if (!current) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      if (current.status === 'posted') {
        return NextResponse.json({ error: 'Cannot reject a posted voucher. Revoke it first.' }, { status: 400 })
      }
      if (current.status === 'rejected') {
        return NextResponse.json({ error: 'Voucher is already rejected.' }, { status: 400 })
      }
      const voucher = await db.voucher.update({
        where: { id },
        data: { status: 'rejected' },
      })
      await createApproval('REJECT', current.status, 'rejected', data.comments)
      return NextResponse.json(voucher)
    }

    // QUICK POST: Draft/Pending → Posted (Admin only, bypasses workflow)
    if (data.action === 'quick_post') {
      if (!hasPermission('quick_post', userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions. Admin role required to quick post vouchers.' }, { status: 403 })
      }
      const current = await db.voucher.findUnique({ where: { id }, select: { status: true } })
      if (!current) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      if (current.status === 'posted') {
        return NextResponse.json({ error: 'Voucher already posted.' }, { status: 400 })
      }
      const voucher = await db.voucher.update({
        where: { id },
        data: {
          status: 'posted',
          reviewedBy: systemUserId,
          approvedBy: systemUserId,
          postedBy: systemUserId,
        },
      })
      await createApproval('QUICK_POST', current.status, 'posted', data.comments || 'Quick posted to GL (bypassed workflow)')
      return NextResponse.json(voucher)
    }

    // REVOKE: Posted → Draft (Admin only, reverses posting)
    if (data.action === 'revoke') {
      if (!hasPermission('revoke', userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions. Admin role required to revoke posted vouchers.' }, { status: 403 })
      }
      const current = await db.voucher.findUnique({ where: { id }, select: { status: true } })
      if (!current) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      if (current.status !== 'posted') {
        return NextResponse.json({ error: 'Only posted vouchers can be revoked.' }, { status: 400 })
      }
      const voucher = await db.voucher.update({
        where: { id },
        data: {
          status: 'draft',
          reviewedBy: null,
          approvedBy: null,
          postedBy: null,
        },
      })
      await createApproval('REVOKE', 'posted', 'draft', data.comments || 'Voucher revoked from posted status')
      return NextResponse.json(voucher)
    }

    // ==================== EDIT VOUCHER ====================
    if (data.action === 'edit' || data.entries) {
      if (!hasPermission('edit', userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions to edit vouchers.' }, { status: 403 })
      }
      const current = await db.voucher.findUnique({ where: { id }, select: { status: true } })
      if (!current) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
      if (current.status !== 'draft' && current.status !== 'rejected') {
        return NextResponse.json({ error: 'Only draft or rejected vouchers can be edited' }, { status: 400 })
      }

      if (data.entries?.length) {
        const totalDebit = data.entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0)
        const totalCredit = data.entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0)
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          return NextResponse.json({ error: `Debits (${totalDebit}) must equal credits (${totalCredit})` }, { status: 400 })
        }
      }

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
      if (data.clientId !== undefined) updateData.clientId = data.clientId || null

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
        include: { entries: { include: { account: true } }, project: true, donor: true, location: true, client: true },
      })

      await createApproval('UPDATE', current.status, updateData.status || current.status, 'Voucher edited')

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

    if (voucher.status !== 'draft' && voucher.status !== 'rejected') {
      return NextResponse.json(
        { error: `Cannot delete voucher with status "${voucher.status}". Only draft or rejected vouchers can be deleted.` },
        { status: 400 }
      )
    }

    // Delete related records first
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
