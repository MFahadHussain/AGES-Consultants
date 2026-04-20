import { NextRequest, NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

// GET /api/fams/transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('assetId')
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (assetId) where.assetId = assetId
    if (type) where.type = type
    if (status) where.status = status

    const transactions = await db.assetTransaction.findMany({ where, orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('FAMS Txn GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

// POST /api/fams/transactions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type } = body
    if (!type) return NextResponse.json({ error: 'Transaction type required' }, { status: 400 })
    if (!body.assetId) return NextResponse.json({ error: 'Asset ID required' }, { status: 400 })

    const userId = await getSystemUserId()
    const asset = await db.fixedAsset.findUnique({ where: { id: body.assetId } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    // Auto-generate txnId
    const year = new Date().getFullYear()
    const prefix = `TXN-${year}-`
    const last = await db.assetTransaction.findFirst({ where: { txnId: { startsWith: prefix } }, orderBy: { txnId: 'desc' } })
    let num = 1
    if (last) { const p = last.txnId.split('-'); const n = parseInt(p[p.length - 1]); if (!isNaN(n)) num = n + 1 }
    const txnId = `${prefix}${String(num).padStart(4, '0')}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {
      txnId, assetId: asset.id, type, date: new Date(body.date || new Date()),
      description: body.description || null, notes: body.notes || null,
      status: body.status || 'Draft', createdBy: userId,
    }

    if (type === 'Disposal') {
      if (asset.isDonorFunded) return NextResponse.json({ error: 'Cannot dispose donor-funded assets' }, { status: 400 })
      const proceeds = body.proceeds || 0
      const gainLoss = proceeds - asset.netBookValue
      data.proceeds = proceeds
      data.gainLoss = Math.round(gainLoss)
      data.disposalMethod = body.disposalMethod || 'Sale'
      data.amount = asset.netBookValue

      // Update asset status
      await db.fixedAsset.update({ where: { id: asset.id }, data: { status: 'Disposed' } })

      // Create disposal journal
      const jPrefix = `JV-FAMS-${year}-`
      const lastJ = await db.fAMSJournal.findFirst({ where: { journalNumber: { startsWith: jPrefix } }, orderBy: { journalNumber: 'desc' } })
      let jNum = 1
      if (lastJ) { const p = lastJ.journalNumber.split('-'); const n = parseInt(p[p.length - 1] || '0'); if (!isNaN(n)) jNum = n + 1 }

      // Dr. Accumulated Depreciation, Dr. Bank (proceeds), Cr. Asset Cost, Cr./Dr. Gain/Loss
      await db.fAMSJournal.create({
        data: {
          journalNumber: `${jPrefix}${String(jNum).padStart(4, '0')}`,
          type: 'Disposal', date: new Date(),
          narration: `Disposal: ${asset.name} (${asset.assetId}) - ${body.disposalMethod || 'Sale'}`,
          assetId: asset.assetId, assetName: asset.name,
          drAccountCode: asset.glAccDepAccount || '1300', drAccountName: 'Accumulated Depreciation',
          drAmount: Math.round(asset.accumulatedDepreciation),
          crAccountCode: asset.glAssetAccount || '1200', crAccountName: `Fixed Asset - ${asset.category}`,
          crAmount: Math.round(asset.purchasePrice),
          status: 'Pending Export',
        },
      })
    } else if (type === 'Transfer') {
      data.fromLocation = asset.location
      data.toLocation = body.toLocation || null
      data.fromCustodian = asset.custodian
      data.toCustodian = body.toCustodian || null
      data.fromCostCenter = asset.costCenter
      data.toCostCenter = body.toCostCenter || null
      const tcPrefix = `TC-${year}-`
      const lastTC = await db.assetTransaction.findFirst({ where: { transferCertNo: { startsWith: tcPrefix } }, orderBy: { transferCertNo: 'desc' } })
      let tcNum = 1
      if (lastTC?.transferCertNo) { const p = lastTC.transferCertNo.split('-'); const n = parseInt(p[p.length - 1]); if (!isNaN(n)) tcNum = n + 1 }
      data.transferCertNo = `${tcPrefix}${String(tcNum).padStart(4, '0')}`
      data.status = 'Pending Acknowledgment'
      data.journalStatus = 'N/A'

      // Update asset location/custodian
      await db.fixedAsset.update({
        where: { id: asset.id },
        data: { location: body.toLocation || asset.location, custodian: body.toCustodian || asset.custodian, costCenter: body.toCostCenter || asset.costCenter },
      })
    } else if (type === 'Adjustment') {
      data.adjustmentType = body.adjustmentType || 'Correction'
      data.newValue = body.newValue || null
      data.amount = body.newValue ? Math.abs(body.newValue - asset.netBookValue) : 0
    }

    const transaction = await db.assetTransaction.create({ data })
    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('FAMS Txn POST error:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
