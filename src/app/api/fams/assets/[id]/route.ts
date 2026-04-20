import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

/**
 * FBR tax rates for recalculation on update
 */
const FBR_TAX_RATES: Record<string, { category: string; rate: number }> = {
  'Land': { category: 'Land', rate: 0 },
  'Buildings': { category: 'Buildings', rate: 10 },
  'Vehicles': { category: 'Vehicles', rate: 15 },
  'Furniture': { category: 'Furniture', rate: 15 },
  'Office Equipment': { category: 'Office Equipment', rate: 15 },
  'IT Assets': { category: 'IT Assets', rate: 30 },
  'Machinery': { category: 'Machinery', rate: 15 },
  'Other': { category: 'Other', rate: 15 },
}

const GL_ACCOUNT_MAP: Record<string, { asset: string; accDep: string; depExp: string }> = {
  'Land': { asset: '1210', accDep: '1300', depExp: '5300' },
  'Buildings': { asset: '1215', accDep: '1300', depExp: '5300' },
  'Vehicles': { asset: '1220', accDep: '1300', depExp: '5300' },
  'Furniture': { asset: '1225', accDep: '1300', depExp: '5300' },
  'Office Equipment': { asset: '1230', accDep: '1300', depExp: '5300' },
  'IT Assets': { asset: '1235', accDep: '1300', depExp: '5300' },
  'Machinery': { asset: '1240', accDep: '1300', depExp: '5300' },
  'Other': { asset: '1250', accDep: '1300', depExp: '5300' },
}

/**
 * GET /api/fams/assets/[id] - Single asset with depreciation records and transactions
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const asset = await db.fixedAsset.findUnique({
      where: { id },
      include: {
        depreciationRecords: {
          orderBy: [{ financialYear: 'asc' }, { monthNumber: 'asc' }],
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Compute additional fields
    const depreciableAmount = asset.purchasePrice - asset.residualValue
    const depreciationPct = depreciableAmount > 0
      ? Math.round((asset.accumulatedDepreciation / depreciableAmount) * 10000) / 100
      : 0

    // Calculate remaining useful life (in years) based on depreciation rate
    let remainingLife = 0
    if (asset.depreciationMethod !== 'None' && asset.usefulLifeYears > 0 && depreciableAmount > 0) {
      const annualDep = depreciableAmount / asset.usefulLifeYears
      if (annualDep > 0) {
        remainingLife = Math.max(0, Math.round(((asset.netBookValue - asset.residualValue) / annualDep) * 10) / 10)
      }
    }

    // Latest depreciation record
    const latestDep = asset.depreciationRecords.length > 0
      ? asset.depreciationRecords[asset.depreciationRecords.length - 1]
      : null

    // Depreciation history by financial year
    const depByYear: Record<string, { charge: number; periods: number }> = {}
    for (const rec of asset.depreciationRecords.filter(r => !r.isTaxDepreciation)) {
      if (!depByYear[rec.financialYear]) {
        depByYear[rec.financialYear] = { charge: 0, periods: 0 }
      }
      depByYear[rec.financialYear].charge += rec.depreciationCharge
      depByYear[rec.financialYear].periods++
    }

    return NextResponse.json({
      ...asset,
      computed: {
        depreciableAmount: Math.round(depreciableAmount),
        depreciationPct,
        remainingLife,
        isFullyDepreciated: asset.netBookValue <= asset.residualValue && asset.depreciationMethod !== 'None',
        latestDepreciation: latestDep,
        depreciationByYear: Object.entries(depByYear).map(([year, data]) => ({
          financialYear: year,
          totalCharge: Math.round(data.charge),
          periods: data.periods,
        })),
        totalTransactions: asset.transactions.length,
        totalDepreciationRecords: asset.depreciationRecords.length,
      },
    })
  } catch (error) {
    console.error('FAMS Asset GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch asset' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/fams/assets/[id] - Update asset with validation and NBV recalculation
 * - Validates donor/land/depreciation rules
 * - Recalculates NBV = purchasePrice - accumulatedDepreciation
 * - Updates FBR tax rates if category changes
 * - Creates audit log
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const userId = await getSystemUserId()

    const existing = await db.fixedAsset.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Cannot update disposed or written-off assets
    if (existing.status === 'Disposed' || existing.status === 'Written Off') {
      return NextResponse.json(
        { error: `Cannot update asset with status "${existing.status}"` },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}

    const updatableFields = [
      'name', 'description', 'subCategory',
      'custodian', 'location', 'province', 'donor',
      'donorRestrictions', 'grantReference',
      'invoiceNumber', 'supplierName', 'supplierNTN',
      'serialNumber', 'condition', 'insuranceValue',
      'insurancePolicyNumber', 'costCenter', 'project',
      'fundCode', 'donorCode', 'notes',
      'decliningRate', 'approvedBy',
    ]

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle date fields
    if (body.dateOfPurchase !== undefined) updateData.dateOfPurchase = new Date(body.dateOfPurchase)
    if (body.dateOfCapitalization !== undefined) updateData.dateOfCapitalization = new Date(body.dateOfCapitalization)
    if (body.warrantyExpiryDate !== undefined) updateData.warrantyExpiryDate = body.warrantyExpiryDate ? new Date(body.warrantyExpiryDate) : null
    if (body.insuranceExpiryDate !== undefined) updateData.insuranceExpiryDate = body.insuranceExpiryDate ? new Date(body.insuranceExpiryDate) : null

    if (body.purchasePrice !== undefined) updateData.purchasePrice = body.purchasePrice
    if (body.residualValue !== undefined) updateData.residualValue = body.residualValue
    if (body.usefulLifeYears !== undefined) updateData.usefulLifeYears = body.usefulLifeYears
    if (body.depreciationMethod !== undefined) updateData.depreciationMethod = body.depreciationMethod
    if (body.isDonorFunded !== undefined) updateData.isDonorFunded = body.isDonorFunded

    // Determine effective values for validation
    const effectiveDonorFunded = body.isDonorFunded !== undefined ? body.isDonorFunded : existing.isDonorFunded
    const effectiveCategory = body.category !== undefined ? body.category : existing.category
    const effectiveDepMethod = body.depreciationMethod !== undefined ? body.depreciationMethod : existing.depreciationMethod
    const effectiveUsefulLife = body.usefulLifeYears !== undefined ? body.usefulLifeYears : existing.usefulLifeYears
    const effectivePurchasePrice = body.purchasePrice !== undefined ? body.purchasePrice : existing.purchasePrice
    const effectiveResidualValue = body.residualValue !== undefined ? body.residualValue : existing.residualValue

    // If category changed, update GL accounts and tax rates
    if (body.category !== undefined && body.category !== existing.category) {
      updateData.category = body.category
      const taxInfo = FBR_TAX_RATES[body.category] || FBR_TAX_RATES['Other']
      updateData.taxCategory = taxInfo.category
      updateData.taxRate = taxInfo.rate

      const glMap = GL_ACCOUNT_MAP[body.category] || GL_ACCOUNT_MAP['Other']
      if (!body.glAssetAccount) updateData.glAssetAccount = glMap.asset
      if (!body.glAccDepAccount) updateData.glAccDepAccount = glMap.accDep
      if (!body.glDepExpAccount) updateData.glDepExpAccount = glMap.depExp
    }

    // Business rule: If isDonorFunded or category=Land, set depreciation to None
    if (effectiveDonorFunded === true || effectiveCategory === 'Land') {
      updateData.depreciationMethod = 'None'
      updateData.usefulLifeYears = 0
    }

    // Business rule: If category=Land, set residualValue = purchasePrice
    if (effectiveCategory === 'Land') {
      updateData.residualValue = effectivePurchasePrice
    }

    // Validate: residualValue < purchasePrice (except Land)
    const finalResidual = (updateData.residualValue as number) ?? effectiveResidualValue
    const finalPurchase = (updateData.purchasePrice as number) ?? effectivePurchasePrice
    if (effectiveCategory !== 'Land' && finalResidual >= finalPurchase) {
      return NextResponse.json(
        { error: 'Residual value must be less than purchase price' },
        { status: 400 }
      )
    }

    // Validate: dateOfCapitalization >= dateOfPurchase
    const capDate = updateData.dateOfCapitalization
      ? new Date(updateData.dateOfCapitalization as string | Date)
      : existing.dateOfCapitalization
    const purchDate = updateData.dateOfPurchase
      ? new Date(updateData.dateOfPurchase as string | Date)
      : existing.dateOfPurchase
    if (capDate < purchDate) {
      return NextResponse.json(
        { error: 'Date of capitalization must be on or after date of purchase' },
        { status: 400 }
      )
    }

    // Validate: usefulLifeYears > 0 if method != None
    const finalMethod = (updateData.depreciationMethod as string) ?? effectiveDepMethod
    const finalUsefulLife = (updateData.usefulLifeYears as number) ?? effectiveUsefulLife
    if (finalMethod !== 'None' && finalUsefulLife <= 0) {
      return NextResponse.json(
        { error: 'Useful life years must be greater than 0 for depreciating assets' },
        { status: 400 }
      )
    }

    // Validate: decliningRate > 0 if method="Declining-Balance"
    const finalDecliningRate = body.decliningRate !== undefined ? body.decliningRate : existing.decliningRate
    if (finalMethod === 'Declining-Balance' && (!finalDecliningRate || finalDecliningRate <= 0)) {
      return NextResponse.json(
        { error: 'Declining rate must be greater than 0 for Declining-Balance method' },
        { status: 400 }
      )
    }

    // Recalculate netBookValue if price or residual changed
    const currentAccDep = existing.accumulatedDepreciation
    updateData.netBookValue = Math.round(finalPurchase - currentAccDep)

    // Handle approvalStatus changes
    if (body.approvalStatus !== undefined) {
      if (body.approvalStatus === 'Approved' && existing.approvalStatus !== 'Approved') {
        updateData.approvalStatus = 'Approved'
        updateData.approvedBy = body.approvedBy || userId
      } else if (body.approvalStatus === 'Rejected' && existing.approvalStatus !== 'Rejected') {
        updateData.approvalStatus = 'Rejected'
      } else {
        updateData.approvalStatus = body.approvalStatus
      }
    }

    const asset = await db.fixedAsset.update({
      where: { id },
      data: updateData,
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'FixedAsset',
        entityId: asset.id,
        details: JSON.stringify({
          assetId: asset.assetId,
          name: asset.name,
          changes: Object.keys(updateData),
          previousValues: Object.fromEntries(
            Object.keys(updateData).map(k => [k, (existing as Record<string, unknown>)[k]])
          ),
        }),
      },
    })

    return NextResponse.json(asset)
  } catch (error) {
    console.error('FAMS Asset PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update asset', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/fams/assets/[id] - Soft delete (change status to "Written Off")
 * Creates a write-off transaction and journal entries
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = await getSystemUserId()

    const existing = await db.fixedAsset.findUnique({
      where: { id },
      include: { transactions: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    if (existing.status === 'Written Off') {
      return NextResponse.json(
        { error: 'Asset is already written off' },
        { status: 400 }
      )
    }

    if (existing.status === 'Disposed') {
      return NextResponse.json(
        { error: 'Asset is already disposed — cannot write off' },
        { status: 400 }
      )
    }

    // Soft delete - set status to Written Off
    const asset = await db.fixedAsset.update({
      where: { id },
      data: { status: 'Written Off' },
    })

    // Create write-off transaction
    const currentYear = new Date().getFullYear()
    const txnPrefix = `TXN-${currentYear}-`
    const lastTxn = await db.assetTransaction.findFirst({
      where: { txnId: { startsWith: txnPrefix } },
      orderBy: { txnId: 'desc' },
    })
    let nextNum = 1
    if (lastTxn) {
      const parts = lastTxn.txnId.split('-')
      const lastNum = parseInt(parts[parts.length - 1] || '0', 10)
      if (!isNaN(lastNum)) nextNum = lastNum + 1
    }
    const txnId = `${txnPrefix}${String(nextNum).padStart(4, '0')}`

    const writeOffNBV = existing.netBookValue

    await db.assetTransaction.create({
      data: {
        txnId,
        assetId: id,
        type: 'Disposal',
        date: new Date(),
        description: `Write-off: ${existing.name} (${existing.assetId}) — NBV: PKR ${Math.round(writeOffNBV).toLocaleString()}`,
        amount: existing.purchasePrice,
        proceeds: 0,
        gainLoss: -writeOffNBV,
        disposalMethod: 'Write-Off',
        status: 'Draft',
        journalStatus: 'Pending Export',
        createdBy: userId,
        notes: `Asset written off. Net Book Value: PKR ${Math.round(writeOffNBV).toLocaleString()}`,
      },
    })

    // Create write-off journal entries
    const journalPrefix = `JV-FAMS-${currentYear}-`
    const lastJournal = await db.fAMSJournal.findFirst({
      where: { journalNumber: { startsWith: journalPrefix } },
      orderBy: { journalNumber: 'desc' },
    })
    let journalNextNum = 1
    if (lastJournal) {
      const parts = lastJournal.journalNumber.split('-')
      const lastJNum = parseInt(parts[parts.length - 1] || '0', 10)
      if (!isNaN(lastJNum)) journalNextNum = lastJNum + 1
    }

    // Journal 1: Dr. Accumulated Depreciation / Cr. Asset Cost (remove from books)
    const jvNum1 = `${journalPrefix}${String(journalNextNum).padStart(4, '0')}`
    await db.fAMSJournal.create({
      data: {
        journalNumber: jvNum1,
        type: 'Disposal',
        date: new Date(),
        narration: `Write-off: Remove ${existing.name} (${existing.assetId}) — cost & accumulated depreciation`,
        assetId: existing.assetId,
        assetName: existing.name,
        drAccountCode: existing.glAccDepAccount || '1300',
        drAccountName: `Accumulated Depreciation - ${existing.category}`,
        drAmount: Math.round(existing.accumulatedDepreciation),
        crAccountCode: existing.glAssetAccount || '1215',
        crAccountName: `Fixed Asset - ${existing.category}`,
        crAmount: Math.round(existing.purchasePrice),
        costCenter: existing.costCenter,
        project: existing.project,
        fundCode: existing.fundCode,
        source: 'FAMS',
        status: 'Pending Export',
      },
    })

    // Journal 2: Dr. Loss on Write-Off / Cr. Asset (for remaining NBV)
    if (writeOffNBV > 0) {
      const jvNum2 = `${journalPrefix}${String(journalNextNum + 1).padStart(4, '0')}`
      await db.fAMSJournal.create({
        data: {
          journalNumber: jvNum2,
          type: 'Disposal',
          date: new Date(),
          narration: `Write-off loss: ${existing.name} (${existing.assetId}) — NBV written off`,
          assetId: existing.assetId,
          assetName: existing.name,
          drAccountCode: '5400',
          drAccountName: 'Loss on Disposal / Write-Off of Assets',
          drAmount: Math.round(writeOffNBV),
          crAccountCode: existing.glAssetAccount || '1215',
          crAccountName: `Fixed Asset - ${existing.category}`,
          crAmount: Math.round(writeOffNBV),
          costCenter: existing.costCenter,
          project: existing.project,
          fundCode: existing.fundCode,
          source: 'FAMS',
          status: 'Pending Export',
        },
      })
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'WRITE_OFF',
        entity: 'FixedAsset',
        entityId: asset.id,
        details: JSON.stringify({
          assetId: asset.assetId,
          name: asset.name,
          netBookValue: writeOffNBV,
          action: 'written_off',
        }),
      },
    })

    return NextResponse.json({
      message: 'Asset written off successfully',
      asset,
      writeOffDetails: {
        netBookValue: Math.round(writeOffNBV),
        lossAmount: Math.round(writeOffNBV),
      },
    })
  } catch (error) {
    console.error('FAMS Asset DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to write off asset', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
