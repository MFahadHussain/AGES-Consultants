import { withAudit } from '@/lib/audit-wrapper'
import { NextRequest, NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'
import { findAccountByRole, findFirstBankAccount } from '@/lib/account-roles'

// GET /api/fams/transactions
async function GET_HANDLER(request: NextRequest) {
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
async function POST_HANDLER(request: NextRequest) {
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

      // Resolve account codes using account-roles (fallback to asset GL fields, then defaults)
      const bankAccount = await findFirstBankAccount()
      const gainOnDisposalAccount = await findAccountByRole('GAIN_ON_DISPOSAL')
      const lossOnDisposalAccount = await findAccountByRole('LOSS_ON_DISPOSAL')
      const accDepCode = asset.glAccDepAccount || '1610'
      const assetCode = asset.glAssetAccount || '1510'
      const bankCode = bankAccount?.code || '1121'
      const gainCode = gainOnDisposalAccount?.code || '4430'
      const lossCode = lossOnDisposalAccount?.code || '5910'

      // Create disposal journal entries
      const jPrefix = `JV-FAMS-${year}-`
      const lastJ = await db.fAMSJournal.findFirst({ where: { journalNumber: { startsWith: jPrefix } }, orderBy: { journalNumber: 'desc' } })
      let jNum = 1
      if (lastJ) { const p = lastJ.journalNumber.split('-'); const n = parseInt(p[p.length - 1] || '0'); if (!isNaN(n)) jNum = n + 1 }

      // Journal 1: Remove asset from books
      // Dr. Accumulated Depreciation, Cr. Asset Cost
      await db.fAMSJournal.create({
        data: {
          journalNumber: `${jPrefix}${String(jNum).padStart(4, '0')}`,
          type: 'Disposal', date: new Date(),
          narration: `Disposal: ${asset.name} (${asset.assetId}) - ${body.disposalMethod || 'Sale'}`,
          assetId: asset.assetId, assetName: asset.name,
          drAccountCode: accDepCode, drAccountName: 'Accumulated Depreciation',
          drAmount: Math.round(asset.accumulatedDepreciation),
          crAccountCode: assetCode, crAccountName: `Fixed Asset - ${asset.category}`,
          crAmount: Math.round(asset.purchasePrice),
          status: 'Pending Export',
        },
      })

      // Journal 2: Record proceeds and gain/loss
      if (proceeds > 0 || Math.abs(gainLoss) > 0) {
        const isGain = gainLoss > 0
        const jvNum2 = `${jPrefix}${String(jNum + 1).padStart(4, '0')}`

        if (isGain) {
          // Dr. Bank (for proceeds), Cr. Gain on Disposal (for gain)
          await db.fAMSJournal.create({
            data: {
              journalNumber: jvNum2,
              type: 'Disposal', date: new Date(),
              narration: `Disposal gain: ${asset.name} (${asset.assetId}) - ${body.disposalMethod || 'Sale'}`,
              assetId: asset.assetId, assetName: asset.name,
              drAccountCode: bankCode, drAccountName: bankAccount?.name || 'Bank',
              drAmount: Math.round(proceeds),
              crAccountCode: gainCode, crAccountName: gainOnDisposalAccount?.name || 'Gain on Disposal',
              crAmount: Math.round(proceeds),
              status: 'Pending Export',
            },
          })
        } else {
          // Dr. Loss on Disposal (for loss), Cr. Bank (for proceeds)
          const lossAmount = Math.round(Math.abs(gainLoss))
          const proceedsAmount = Math.round(proceeds)
          await db.fAMSJournal.create({
            data: {
              journalNumber: jvNum2,
              type: 'Disposal', date: new Date(),
              narration: `Disposal loss: ${asset.name} (${asset.assetId}) - ${body.disposalMethod || 'Sale'}`,
              assetId: asset.assetId, assetName: asset.name,
              drAccountCode: lossCode, drAccountName: lossOnDisposalAccount?.name || 'Loss on Disposal',
              drAmount: lossAmount + proceedsAmount,
              crAccountCode: bankCode, crAccountName: bankAccount?.name || 'Bank',
              crAmount: lossAmount + proceedsAmount,
              status: 'Pending Export',
            },
          })
        }
      }

      // Journal 3: If no proceeds but there's a loss (write-off/scrap), record the loss
      if (proceeds === 0 && asset.netBookValue > 0) {
        const jvNum3 = `${jPrefix}${String(jNum + 2).padStart(4, '0')}`
        await db.fAMSJournal.create({
          data: {
            journalNumber: jvNum3,
            type: 'Disposal', date: new Date(),
            narration: `Write-off loss: ${asset.name} (${asset.assetId}) - NBV written off`,
            assetId: asset.assetId, assetName: asset.name,
            drAccountCode: lossCode, drAccountName: lossOnDisposalAccount?.name || 'Loss on Disposal',
            drAmount: Math.round(asset.netBookValue),
            crAccountCode: assetCode, crAccountName: `Fixed Asset - ${asset.category}`,
            crAmount: Math.round(asset.netBookValue),
            status: 'Pending Export',
          },
        })
      }
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
      data.journalStatus = 'Pending Export'

      // Update asset location/custodian
      await db.fixedAsset.update({
        where: { id: asset.id },
        data: { location: body.toLocation || asset.location, custodian: body.toCustodian || asset.custodian, costCenter: body.toCostCenter || asset.costCenter },
      })

      // Create transfer journal entry for GL traceability
      const jPrefix = `JV-FAMS-${year}-`
      const lastJ = await db.fAMSJournal.findFirst({ where: { journalNumber: { startsWith: jPrefix } }, orderBy: { journalNumber: 'desc' } })
      let jNum = 1
      if (lastJ) { const p = lastJ.journalNumber.split('-'); const n = parseInt(p[p.length - 1] || '0'); if (!isNaN(n)) jNum = n + 1 }

      const fromDesc = [asset.location, asset.costCenter].filter(Boolean).join(' / ') || 'N/A'
      const toDesc = [body.toLocation, body.toCostCenter].filter(Boolean).join(' / ') || 'N/A'
      const assetCode = asset.glAssetAccount || '1510'

      await db.fAMSJournal.create({
        data: {
          journalNumber: `${jPrefix}${String(jNum).padStart(4, '0')}`,
          type: 'Transfer', date: new Date(),
          narration: `Transfer: ${asset.name} (${asset.assetId}) from ${fromDesc} to ${toDesc}`,
          assetId: asset.assetId, assetName: asset.name,
          drAccountCode: assetCode, drAccountName: `Fixed Asset - ${asset.category} (from)`,
          drAmount: Math.round(asset.netBookValue),
          crAccountCode: assetCode, crAccountName: `Fixed Asset - ${asset.category} (to)`,
          crAmount: Math.round(asset.netBookValue),
          costCenter: body.toCostCenter || asset.costCenter || undefined,
          project: asset.project || undefined,
          status: 'Pending Export',
        },
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

export const POST = withAudit('fams', POST_HANDLER);

export const GET = withAudit('fams', GET_HANDLER);
