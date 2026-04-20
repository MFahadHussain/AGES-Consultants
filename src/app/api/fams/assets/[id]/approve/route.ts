import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

/**
 * POST /api/fams/assets/[id]/approve - Approve or reject an asset
 * Body: { action: "approve" | "reject", approvedBy?: string, reason?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const userId = await getSystemUserId()
    const action = body.action || 'approve'

    const existing = await db.fixedAsset.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    if (action === 'approve') {
      if (existing.approvalStatus === 'Approved') {
        return NextResponse.json({ error: 'Asset is already approved' }, { status: 400 })
      }

      const asset = await db.fixedAsset.update({
        where: { id },
        data: {
          approvalStatus: 'Approved',
          approvedBy: body.approvedBy || userId,
        },
      })

      // Create audit log
      await db.auditLog.create({
        data: {
          userId,
          action: 'APPROVE',
          entity: 'FixedAsset',
          entityId: asset.id,
          details: JSON.stringify({
            assetId: asset.assetId,
            name: asset.name,
            approvedBy: body.approvedBy || userId,
          }),
        },
      })

      return NextResponse.json({ message: 'Asset approved successfully', asset })
    }

    if (action === 'reject') {
      if (existing.approvalStatus === 'Rejected') {
        return NextResponse.json({ error: 'Asset is already rejected' }, { status: 400 })
      }

      const asset = await db.fixedAsset.update({
        where: { id },
        data: {
          approvalStatus: 'Rejected',
          notes: body.reason ? `${existing.notes || ''}\nRejection reason: ${body.reason}`.trim() : existing.notes,
        },
      })

      // Create audit log
      await db.auditLog.create({
        data: {
          userId,
          action: 'REJECT',
          entity: 'FixedAsset',
          entityId: asset.id,
          details: JSON.stringify({
            assetId: asset.assetId,
            name: asset.name,
            reason: body.reason,
          }),
        },
      })

      return NextResponse.json({ message: 'Asset rejected', asset })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "approve" or "reject".' },
      { status: 400 }
    )
  } catch (error) {
    console.error('FAMS Asset Approve error:', error)
    return NextResponse.json(
      { error: 'Failed to process approval', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
