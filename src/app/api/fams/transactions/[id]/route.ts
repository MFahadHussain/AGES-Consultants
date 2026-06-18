import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

/**
 * GET /api/fams/transactions/[id] - Single transaction detail
 */
async function GET_HANDLER(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const transaction = await db.assetTransaction.findUnique({
      where: { id },
      include: {
        asset: {
          select: {
            id: true,
            assetId: true,
            name: true,
            category: true,
            purchasePrice: true,
            netBookValue: true,
            accumulatedDepreciation: true,
            status: true,
            location: true,
            custodian: true,
            province: true,
            costCenter: true,
            glAssetAccount: true,
            glAccDepAccount: true,
          },
        },
      },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Compute additional info based on transaction type
    const computed: Record<string, unknown> = {}
    if (transaction.type === 'Disposal' && transaction.asset) {
      computed.gainLossPct = transaction.asset.netBookValue > 0
        ? Math.round((transaction.gainLoss / transaction.asset.netBookValue) * 10000) / 100
        : 0
      computed.proceedsVsNBV = transaction.proceeds > transaction.asset.netBookValue ? 'Gain' : 'Loss'
    }

    return NextResponse.json({ ...transaction, computed })
  } catch (error) {
    console.error('FAMS Transaction GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/fams/transactions/[id] - Update transaction
 * Updatable fields: description, notes, status, approvedBy, proceeds, gainLoss,
 * disposalMethod, toLocation, toCustodian, toCostCenter, transferCertNo, journalStatus
 */
async function PUT_HANDLER(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const userId = await getSystemUserId()

    const existing = await db.assetTransaction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Cannot update posted transactions
    if (existing.status === 'Posted') {
      return NextResponse.json(
        { error: 'Cannot update a posted transaction' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    const updatableFields = [
      'description', 'notes', 'approvedBy',
      'proceeds', 'gainLoss', 'disposalMethod',
      'toLocation', 'toCustodian', 'toCostCenter',
      'transferCertNo', 'journalStatus',
    ]

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle status changes with validation
    if (body.status !== undefined && body.status !== existing.status) {
      if (body.status === 'Approved') {
        updateData.status = 'Approved'
        updateData.approvedBy = body.approvedBy || userId
      } else if (body.status === 'Reversed') {
        // Can only reverse approved/posted transactions
        if (existing.status !== 'Approved' && existing.status !== 'Posted') {
          return NextResponse.json(
            { error: 'Can only reverse approved or posted transactions' },
            { status: 400 }
          )
        }
        updateData.status = 'Reversed'
      } else {
        updateData.status = body.status
      }
    }

    if (body.date !== undefined) updateData.date = new Date(body.date)

    const transaction = await db.assetTransaction.update({
      where: { id },
      data: updateData,
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'AssetTransaction',
        entityId: transaction.id,
        details: JSON.stringify({
          txnId: transaction.txnId,
          changes: Object.keys(updateData),
          previousStatus: existing.status,
          newStatus: transaction.status,
        }),
      },
    })

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('FAMS Transaction PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export const PUT = withAudit('fams', PUT_HANDLER);

export const GET = withAudit('fams', GET_HANDLER);
