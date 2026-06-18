import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findDepExpenseForCategory, findAccDepForCategory } from '@/lib/account-roles'

async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = {}
    if (status) where.status = status

    const assets = await db.fixedAsset.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        depreciationEntries: { orderBy: { period: 'desc' } },
      },
      orderBy: { assetCode: 'asc' },
    })

    return NextResponse.json(assets)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function POST_HANDLER(request: Request) {
  try {
    const data = await request.json()

    if (data.action === 'depreciation') {
      // INTEGRATION: Fixed Assets → GL
      // Generate monthly depreciation journal entries for all active, non-donor-funded assets
      const { period } = data // e.g., "2024-07"

      const assets = await db.fixedAsset.findMany({
        where: {
          status: 'active',
          isDonorFunded: false, // INTEGRATION: Donor-funded assets excluded from depreciation
        },
      })

      const results = []
      for (const asset of assets) {
        // Check if depreciation already posted for this period
        const existing = await db.fixedAssetDepreciation.findFirst({
          where: { assetId: asset.id, period },
        })
        if (existing) continue

        // Calculate monthly depreciation
        const depreciableAmount = asset.purchaseCost - asset.salvageValue
        const monthlyDepreciation = depreciableAmount / asset.usefulLife

        // Find depreciation expense and accumulated depreciation accounts
        const depExpenseAccount = await findDepExpenseForCategory(asset.category)
        const accumDepAccount = await findAccDepForCategory(asset.category)

        if (!depExpenseAccount || !accumDepAccount) {
          results.push({ asset: asset.assetCode, error: 'Depreciation accounts not found' })
          continue
        }

        const depreciation = await db.fixedAssetDepreciation.create({
          data: {
            assetId: asset.id,
            period,
            amount: monthlyDepreciation,
            depExpenseAccountId: depExpenseAccount.id,
            accumDepAccountId: accumDepAccount.id,
          },
        })

        // Update asset's accumulated depreciation and net book value
        const newAccumDep = asset.accumulatedDepreciation + monthlyDepreciation
        await db.fixedAsset.update({
          where: { id: asset.id },
          data: {
            accumulatedDepreciation: newAccumDep,
            netBookValue: asset.purchaseCost - newAccumDep,
          },
        })

        // INTEGRATION: Fixed Assets → GL
        // Auto-generate journal entry for depreciation
        // This would create a JV in the voucher system
        results.push({
          asset: asset.assetCode,
          name: asset.name,
          depreciation: monthlyDepreciation,
          newAccumDep,
          netBookValue: asset.purchaseCost - newAccumDep,
          depExpenseAccount: depExpenseAccount.code,
          accumDepAccount: accumDepAccount.code,
        })
      }

      return NextResponse.json({
        message: `Depreciation run completed for period ${period}`,
        processed: results.length,
        results,
      })
    }

    if (data.action === 'dispose') {
      // INTEGRATION: Fixed Assets → GL - Asset disposal with gain/loss
      const { assetId, disposalAmount, disposalDate } = data
      const asset = await db.fixedAsset.findUnique({ where: { id: assetId } })
      if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

      const gainLoss = disposalAmount - asset.netBookValue
      await db.fixedAsset.update({
        where: { id: assetId },
        data: {
          status: 'disposed',
          disposalDate: new Date(disposalDate),
          disposalAmount,
          gainLoss,
        },
      })

      return NextResponse.json({
        message: 'Asset disposed',
        asset: asset.assetCode,
        bookValue: asset.netBookValue,
        disposalAmount,
        gainLoss,
        gainLossType: gainLoss >= 0 ? 'Gain' : 'Loss',
      })
    }

    if (data.action === 'transfer') {
      // INTEGRATION: Fixed Assets → GL - Asset transfer between locations/projects
      const { assetId, newLocationId, newProjectId } = data
      const asset = await db.fixedAsset.update({
        where: { id: assetId },
        data: {
          locationId: newLocationId || undefined,
          projectId: newProjectId || undefined,
        },
      })
      return NextResponse.json({ message: 'Asset transferred', asset: asset.assetCode })
    }

    // Create new fixed asset
    // INTEGRATION: Fixed Assets → GL - Asset purchase creates entries in Asset account and reduces bank/cash/payables
    const asset = await db.fixedAsset.create({ data })
    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const POST = withAudit('fixed-assets', POST_HANDLER);

export const GET = withAudit('fixed-assets', GET_HANDLER);
