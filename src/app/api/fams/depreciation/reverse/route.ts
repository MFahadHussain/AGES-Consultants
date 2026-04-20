import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

/**
 * POST /api/fams/depreciation/reverse - Reverse depreciation for a period
 * Requires: financialYear, period, reason
 * Optional: role (CFO required for reversal in production)
 *
 * Steps:
 * 1. Find all depreciation records for the period
 * 2. Group by asset to calculate reversal charges
 * 3. Delete depreciation records (financial + tax)
 * 4. Recalculate asset NBV
 * 5. Mark related journals as Reversed
 * 6. Update fiscal year dep run status
 * 7. Create audit log
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { financialYear, period, reason, role } = body

    if (!financialYear || !period || !reason) {
      return NextResponse.json(
        { error: 'financialYear, period, and reason are required' },
        { status: 400 }
      )
    }

    // CFO role check (simplified — in production would check actual user role)
    if (role && role !== 'CFO' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only CFO or admin can reverse depreciation' },
        { status: 403 }
      )
    }

    const userId = await getSystemUserId()

    // Find all depreciation records for this period (financial depreciation)
    const depRecords = await db.fixedAssetDepreciation.findMany({
      where: {
        financialYear,
        period,
        isTaxDepreciation: false,
      },
    })

    if (depRecords.length === 0) {
      return NextResponse.json(
        { error: `No depreciation records found for ${period} in FY ${financialYear}` },
        { status: 404 }
      )
    }

    // Group by asset to recalculate NBV
    const assetCharges: Record<string, number> = {}
    for (const record of depRecords) {
      if (!assetCharges[record.assetId]) {
        assetCharges[record.assetId] = 0
      }
      assetCharges[record.assetId] += record.depreciationCharge
    }

    // Delete financial depreciation records
    const deletedFinancial = await db.fixedAssetDepreciation.deleteMany({
      where: {
        financialYear,
        period,
        isTaxDepreciation: false,
      },
    })

    // Also delete tax depreciation records for this period
    const deletedTax = await db.fixedAssetDepreciation.deleteMany({
      where: {
        financialYear,
        period,
        isTaxDepreciation: true,
      },
    })

    // Recalculate asset NBV
    const updatedAssets: Array<{ assetId: string; previousAccDep: number; newAccDep: number; previousNBV: number; newNBV: number }> = []
    for (const [assetId, totalCharge] of Object.entries(assetCharges)) {
      const asset = await db.fixedAsset.findUnique({ where: { id: assetId } })
      if (!asset) continue

      const previousAccDep = asset.accumulatedDepreciation
      const previousNBV = asset.netBookValue
      const newAccDep = Math.max(0, asset.accumulatedDepreciation - totalCharge)
      const newNBV = asset.purchasePrice - newAccDep

      await db.fixedAsset.update({
        where: { id: assetId },
        data: {
          accumulatedDepreciation: Math.round(newAccDep),
          netBookValue: Math.round(newNBV),
        },
      })

      updatedAssets.push({
        assetId: asset.assetId,
        previousAccDep: Math.round(previousAccDep),
        newAccDep: Math.round(newAccDep),
        previousNBV: Math.round(previousNBV),
        newNBV: Math.round(newNBV),
      })
    }

    // Mark related journals as Reversed
    const reversedJournals = await db.fAMSJournal.updateMany({
      where: {
        type: 'Depreciation',
        narration: { contains: period },
        status: 'Pending Export',
      },
      data: { status: 'Reversed' },
    })

    // Update fiscal year dep run status
    const fiscalYear = await db.fAMSFiscalYear.findFirst({
      where: { label: financialYear },
    })
    if (fiscalYear) {
      const depRunStatus = fiscalYear.depRunStatus ? JSON.parse(fiscalYear.depRunStatus as string) : {}
      depRunStatus[period] = 'Reversed'
      await db.fAMSFiscalYear.update({
        where: { id: fiscalYear.id },
        data: { depRunStatus: JSON.stringify(depRunStatus) },
      })
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'DEPRECIATION_REVERSE',
        entity: 'FixedAssetDepreciation',
        entityId: period,
        details: JSON.stringify({
          financialYear,
          period,
          reason,
          reversedFinancialCount: deletedFinancial.count,
          reversedTaxCount: deletedTax.count,
          reversedJournalsCount: reversedJournals.count,
          assetCharges: Object.fromEntries(
            Object.entries(assetCharges).map(([k, v]) => [k, Math.round(v)])
          ),
          updatedAssets: updatedAssets.length,
        }),
      },
    })

    return NextResponse.json({
      message: `Depreciation reversed for ${period}`,
      reversedCount: depRecords.length,
      deletedFinancialCount: deletedFinancial.count,
      deletedTaxCount: deletedTax.count,
      reversedJournalsCount: reversedJournals.count,
      updatedAssetsCount: updatedAssets.length,
      reason,
    })
  } catch (error) {
    console.error('FAMS Depreciation Reverse error:', error)
    return NextResponse.json(
      { error: 'Failed to reverse depreciation', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
