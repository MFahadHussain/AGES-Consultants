import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

/**
 * PUT /api/fams/fiscal-years/[id] - Update fiscal year or close it
 * Body: { action?: "close", depRunStatus?: object, status?: string }
 */
async function PUT_HANDLER(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const userId = await getSystemUserId()

    const existing = await db.fAMSFiscalYear.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Fiscal year not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.action === 'close') {
      if (existing.status === 'Closed') {
        return NextResponse.json(
          { error: 'Fiscal year is already closed' },
          { status: 400 }
        )
      }

      const validationErrors: string[] = []

      // 1. Check all 12 periods have depreciation run
      const depRunStatus = existing.depRunStatus ? JSON.parse(existing.depRunStatus as string) : {}
      const pendingMonths = Object.entries(depRunStatus)
        .filter(([, status]) => status === 'Pending')
        .map(([month]) => month)

      if (pendingMonths.length > 0) {
        validationErrors.push(`Pending depreciation runs for: ${pendingMonths.join(', ')}`)
      }

      // 2. No assets in "Draft" approval status
      const draftAssets = await db.fixedAsset.count({
        where: { approvalStatus: 'Draft' },
      })
      if (draftAssets > 0) {
        validationErrors.push(`${draftAssets} asset(s) pending approval`)
      }

      // 3. No journals in "Pending Export"
      const pendingJournals = await db.fAMSJournal.count({
        where: { status: 'Pending Export' },
      })
      if (pendingJournals > 0) {
        validationErrors.push(`${pendingJournals} journal entries pending export`)
      }

      // 4. No transactions in "Draft"
      const draftTransactions = await db.assetTransaction.count({
        where: { status: 'Draft' },
      })
      if (draftTransactions > 0) {
        validationErrors.push(`${draftTransactions} transaction(s) in Draft status`)
      }

      if (validationErrors.length > 0) {
        return NextResponse.json(
          { error: 'Cannot close fiscal year — resolve the following issues first', validationErrors },
          { status: 400 }
        )
      }

      updateData.status = 'Closed'
      updateData.closedBy = userId
      updateData.closedAt = new Date()
    }

    if (body.depRunStatus !== undefined) {
      updateData.depRunStatus = typeof body.depRunStatus === 'string'
        ? body.depRunStatus
        : JSON.stringify(body.depRunStatus)
    }

    if (body.status !== undefined && body.action !== 'close') {
      updateData.status = body.status
    }

    const fiscalYear = await db.fAMSFiscalYear.update({
      where: { id },
      data: updateData,
    })

    // Audit log for close action
    if (body.action === 'close') {
      // Get carry forward data
      const activeAssets = await db.fixedAsset.findMany({
        where: { status: 'Active' },
        select: { assetId: true, name: true, netBookValue: true, category: true },
      })

      await db.auditLog.create({
        data: {
          userId,
          action: 'CLOSE_FISCAL_YEAR',
          entity: 'FAMSFiscalYear',
          entityId: id,
          details: JSON.stringify({
            label: existing.label,
            carriedForwardAssets: activeAssets.length,
            totalNBV: Math.round(activeAssets.reduce((s, a) => s + a.netBookValue, 0)),
          }),
        },
      })
    }

    return NextResponse.json(fiscalYear)
  } catch (error) {
    console.error('FAMS Fiscal Year PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update fiscal year', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export const PUT = withAudit('fams', PUT_HANDLER);
