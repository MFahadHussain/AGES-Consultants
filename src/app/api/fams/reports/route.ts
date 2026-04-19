import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/fams/reports?type=X&fiscalYear=YYYY-YY
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'asset-register'
    const fiscalYear = searchParams.get('fiscalYear') || ''

    switch (type) {
      case 'asset-register': {
        const assets = await db.fixedAsset.findMany({ orderBy: { category: 'asc' } })
        const grouped: Record<string, typeof assets> = {}
        for (const a of assets) { (grouped[a.category] = grouped[a.category] || []).push(a) }
        return NextResponse.json({ type, data: grouped, totalAssets: assets.length, totalCost: Math.round(assets.reduce((s, a) => s + a.purchasePrice, 0)) })
      }
      case 'donor-assets': {
        const assets = await db.fixedAsset.findMany({ where: { isDonorFunded: true }, orderBy: { donor: 'asc' } })
        const byDonor: Record<string, typeof assets> = {}
        for (const a of assets) { (byDonor[a.donor || 'Unknown'] = byDonor[a.donor || 'Unknown'] || []).push(a) }
        return NextResponse.json({ type, data: byDonor, totalAssets: assets.length, totalCost: Math.round(assets.reduce((s, a) => s + a.purchasePrice, 0)) })
      }
      case 'fully-depreciated': {
        const assets = await db.fixedAsset.findMany({ where: { status: 'Active', netBookValue: { lte: 0 } } })
        return NextResponse.json({ type, data: assets })
      }
      case 'disposal-gain-loss': {
        const txns = await db.assetTransaction.findMany({ where: { type: 'Disposal' }, orderBy: { date: 'desc' } })
        const totalGainLoss = txns.reduce((s, t) => s + t.gainLoss, 0)
        return NextResponse.json({ type, data: txns, totalGainLoss: Math.round(totalGainLoss) })
      }
      case 'asset-movement': {
        const assets = await db.fixedAsset.findMany({ where: { status: 'Active' } })
        const txns = await db.assetTransaction.findMany()
        const depRecords = await db.fixedAssetDepreciation.findMany()
        const categories = [...new Set(assets.map(a => a.category))]
        const movement = categories.map(cat => {
          const catAssets = assets.filter(a => a.category === cat)
          const additions = txns.filter(t => t.type === 'Addition').reduce((s, t) => s + t.amount, 0)
          const disposals = txns.filter(t => t.type === 'Disposal').reduce((s, t) => s + t.amount, 0)
          const dep = depRecords.filter(d => catAssets.some(a => a.id === d.assetId)).reduce((s, d) => s + d.depreciationCharge, 0)
          const openingNBV = catAssets.reduce((s, a) => s + a.accumulatedDepreciation + a.netBookValue, 0)
          const closingNBV = catAssets.reduce((s, a) => s + a.netBookValue, 0)
          return { category: cat, openingNBV: Math.round(openingNBV), additions: Math.round(additions), disposals: Math.round(disposals), depreciation: Math.round(dep), closingNBV: Math.round(closingNBV) }
        })
        return NextResponse.json({ type, data: movement })
      }
      case 'insurance-renewal': {
        const now = new Date()
        const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
        const assets = await db.fixedAsset.findMany({ where: { insuranceExpiryDate: { lte: ninetyDays }, status: 'Active' } })
        return NextResponse.json({ type, data: assets })
      }
      case 'journal-export-log': {
        const batches = await db.fAMSExportBatch.findMany({ orderBy: { createdAt: 'desc' } })
        return NextResponse.json({ type, data: batches })
      }

      // ===== NEW REPORT TYPES =====

      case 'depreciation-schedule': {
        // Yearly depreciation schedule per asset (financial + tax), grouped by category
        const fy = fiscalYear
        if (!fy) {
          return NextResponse.json({ error: 'fiscalYear query parameter is required (e.g., 2024-25)' }, { status: 400 })
        }

        // Fetch all depreciation records for the fiscal year (both financial and tax)
        const financialDepRecords = await db.fixedAssetDepreciation.findMany({
          where: { financialYear: fy, isTaxDepreciation: false },
          orderBy: { assetId: 'asc' }
        })
        const taxDepRecords = await db.fixedAssetDepreciation.findMany({
          where: { financialYear: fy, isTaxDepreciation: true },
          orderBy: { assetId: 'asc' }
        })

        // Get all related assets
        const assetIds = [...new Set([
          ...financialDepRecords.map(r => r.assetId),
          ...taxDepRecords.map(r => r.assetId)
        ])]
        const assets = await db.fixedAsset.findMany({
          where: { id: { in: assetIds } }
        })
        const assetMap = new Map(assets.map(a => [a.id, a]))

        // Group by category
        const groupedByCategory: Record<string, {
          assetId: string
          assetName: string
          category: string
          purchasePrice: number
          usefulLifeYears: number
          depreciationMethod: string
          financial: { totalDepreciation: number; openingNBV: number; closingNBV: number; accumulatedDepreciation: number }
          tax: { totalDepreciation: number; openingWDV: number; closingWDV: number; taxRate: number; taxMethod: string }
        }[]> = {}

        // Aggregate financial depreciation per asset
        const financialByAsset = new Map<string, {
          totalDep: number
          openingNBV: number
          closingNBV: number
          accumulatedDep: number
        }>()
        for (const rec of financialDepRecords) {
          const existing = financialByAsset.get(rec.assetId) || { totalDep: 0, openingNBV: rec.openingNBV, closingNBV: 0, accumulatedDep: 0 }
          existing.totalDep += rec.depreciationCharge
          existing.closingNBV = rec.closingNBV
          existing.accumulatedDep = rec.accumulatedDepreciation
          // openingNBV should be from the first period
          if (rec.monthNumber < (financialByAsset.get(rec.assetId)?.openingNBV ? 13 : 13)) {
            existing.openingNBV = Math.min(existing.openingNBV, rec.openingNBV)
          }
          financialByAsset.set(rec.assetId, existing)
        }

        // Aggregate tax depreciation per asset
        const taxByAsset = new Map<string, {
          totalDep: number
          openingWDV: number
          closingWDV: number
        }>()
        for (const rec of taxDepRecords) {
          const existing = taxByAsset.get(rec.assetId) || { totalDep: 0, openingWDV: rec.taxOpeningWDV, closingWDV: 0 }
          existing.totalDep += rec.taxCharge
          existing.closingWDV = rec.taxClosingWDV
          existing.openingWDV = Math.min(existing.openingWDV, rec.taxOpeningWDV)
          taxByAsset.set(rec.assetId, existing)
        }

        for (const assetId of assetIds) {
          const asset = assetMap.get(assetId)
          if (!asset) continue

          const finData = financialByAsset.get(assetId) || { totalDep: 0, openingNBV: asset.netBookValue + asset.accumulatedDepreciation, closingNBV: asset.netBookValue, accumulatedDep: asset.accumulatedDepreciation }
          const taxData = taxByAsset.get(assetId) || { totalDep: 0, openingWDV: 0, closingWDV: 0 }

          const entry = {
            assetId: asset.assetId,
            assetName: asset.name,
            category: asset.category,
            purchasePrice: Math.round(asset.purchasePrice),
            usefulLifeYears: asset.usefulLifeYears,
            depreciationMethod: asset.depreciationMethod,
            financial: {
              totalDepreciation: Math.round(finData.totalDep),
              openingNBV: Math.round(finData.openingNBV),
              closingNBV: Math.round(finData.closingNBV),
              accumulatedDepreciation: Math.round(finData.accumulatedDep)
            },
            tax: {
              totalDepreciation: Math.round(taxData.totalDep),
              openingWDV: Math.round(taxData.openingWDV),
              closingWDV: Math.round(taxData.closingWDV),
              taxRate: asset.taxRate,
              taxMethod: asset.taxMethod
            }
          }

          const cat = asset.category
          ;(groupedByCategory[cat] = groupedByCategory[cat] || []).push(entry)
        }

        const totalFinancialDep = Object.values(groupedByCategory).flat().reduce((s, e) => s + e.financial.totalDepreciation, 0)
        const totalTaxDep = Object.values(groupedByCategory).flat().reduce((s, e) => s + e.tax.totalDepreciation, 0)

        return NextResponse.json({
          type,
          fiscalYear: fy,
          data: groupedByCategory,
          totalFinancialDepreciation: Math.round(totalFinancialDep),
          totalTaxDepreciation: Math.round(totalTaxDep),
          assetCount: assetIds.length
        })
      }

      case 'tax-depreciation-fbr': {
        // FBR Schedule III tax depreciation summary: financial vs tax depreciation differences per asset
        const fy = fiscalYear
        if (!fy) {
          return NextResponse.json({ error: 'fiscalYear query parameter is required (e.g., 2024-25)' }, { status: 400 })
        }

        const financialDepRecords = await db.fixedAssetDepreciation.findMany({
          where: { financialYear: fy, isTaxDepreciation: false }
        })
        const taxDepRecords = await db.fixedAssetDepreciation.findMany({
          where: { financialYear: fy, isTaxDepreciation: true }
        })

        const assetIds = [...new Set([
          ...financialDepRecords.map(r => r.assetId),
          ...taxDepRecords.map(r => r.assetId)
        ])]
        const assets = await db.fixedAsset.findMany({
          where: { id: { in: assetIds } }
        })
        const assetMap = new Map(assets.map(a => [a.id, a]))

        // Aggregate financial dep per asset
        const financialByAsset = new Map<string, { totalDep: number; closingNBV: number }>()
        for (const rec of financialDepRecords) {
          const existing = financialByAsset.get(rec.assetId) || { totalDep: 0, closingNBV: 0 }
          existing.totalDep += rec.depreciationCharge
          existing.closingNBV = rec.closingNBV
          financialByAsset.set(rec.assetId, existing)
        }

        // Aggregate tax dep per asset
        const taxByAsset = new Map<string, { totalCharge: number; taxOpeningWDV: number; taxClosingWDV: number }>()
        for (const rec of taxDepRecords) {
          const existing = taxByAsset.get(rec.assetId) || { totalCharge: 0, taxOpeningWDV: rec.taxOpeningWDV, taxClosingWDV: 0 }
          existing.totalCharge += rec.taxCharge
          existing.taxClosingWDV = rec.taxClosingWDV
          existing.taxOpeningWDV = Math.min(existing.taxOpeningWDV, rec.taxOpeningWDV)
          taxByAsset.set(rec.assetId, existing)
        }

        const summary = assetIds.map(assetId => {
          const asset = assetMap.get(assetId)
          if (!asset) return null

          const finData = financialByAsset.get(assetId) || { totalDep: 0, closingNBV: asset.netBookValue }
          const taxData = taxByAsset.get(assetId) || { totalCharge: 0, taxOpeningWDV: asset.purchasePrice, taxClosingWDV: 0 }

          const financialDep = finData.totalDep
          const taxDep = taxData.totalCharge
          const difference = taxDep - financialDep

          return {
            assetId: asset.assetId,
            assetName: asset.name,
            category: asset.category,
            province: asset.province,
            purchasePrice: Math.round(asset.purchasePrice),
            taxRate: asset.taxRate,
            taxMethod: asset.taxMethod,
            financialDepreciation: Math.round(financialDep),
            financialClosingNBV: Math.round(finData.closingNBV),
            taxOpeningWDV: Math.round(taxData.taxOpeningWDV),
            taxDepreciation: Math.round(taxDep),
            taxClosingWDV: Math.round(taxData.taxClosingWDV),
            difference: Math.round(difference)
          }
        }).filter(Boolean)

        const totalFinancialDep = summary.reduce((s, e) => s + (e?.financialDepreciation || 0), 0)
        const totalTaxDep = summary.reduce((s, e) => s + (e?.taxDepreciation || 0), 0)
        const totalDifference = summary.reduce((s, e) => s + (e?.difference || 0), 0)

        return NextResponse.json({
          type,
          fiscalYear: fy,
          data: summary,
          totals: {
            totalFinancialDepreciation: Math.round(totalFinancialDep),
            totalTaxDepreciation: Math.round(totalTaxDep),
            totalDifference: Math.round(totalDifference),
            assetCount: summary.length
          }
        })
      }

      case 'location-wise': {
        // Assets grouped by location with NBV totals
        const assets = await db.fixedAsset.findMany({
          where: { status: { in: ['Active', 'Under Maintenance'] } },
          orderBy: { location: 'asc' }
        })

        const groupedByLocation: Record<string, {
          assets: {
            assetId: string
            name: string
            category: string
            purchasePrice: number
            netBookValue: number
            condition: string
            custodian: string | null
          }[]
          totalCost: number
          totalNBV: number
          assetCount: number
        }> = {}

        for (const asset of assets) {
          const loc = asset.location || 'Unassigned'
          if (!groupedByLocation[loc]) {
            groupedByLocation[loc] = { assets: [], totalCost: 0, totalNBV: 0, assetCount: 0 }
          }
          groupedByLocation[loc].assets.push({
            assetId: asset.assetId,
            name: asset.name,
            category: asset.category,
            purchasePrice: Math.round(asset.purchasePrice),
            netBookValue: Math.round(asset.netBookValue),
            condition: asset.condition,
            custodian: asset.custodian
          })
          groupedByLocation[loc].totalCost += asset.purchasePrice
          groupedByLocation[loc].totalNBV += asset.netBookValue
          groupedByLocation[loc].assetCount++
        }

        // Round totals
        for (const loc of Object.keys(groupedByLocation)) {
          groupedByLocation[loc].totalCost = Math.round(groupedByLocation[loc].totalCost)
          groupedByLocation[loc].totalNBV = Math.round(groupedByLocation[loc].totalNBV)
        }

        const grandTotalCost = Object.values(groupedByLocation).reduce((s, l) => s + l.totalCost, 0)
        const grandTotalNBV = Object.values(groupedByLocation).reduce((s, l) => s + l.totalNBV, 0)

        return NextResponse.json({
          type,
          data: groupedByLocation,
          summary: {
            locationCount: Object.keys(groupedByLocation).length,
            totalAssets: assets.length,
            grandTotalCost: Math.round(grandTotalCost),
            grandTotalNBV: Math.round(grandTotalNBV)
          }
        })
      }

      case 'custodian-wise': {
        // Assets grouped by custodian with counts and NBV
        const assets = await db.fixedAsset.findMany({
          where: { status: { in: ['Active', 'Under Maintenance'] } },
          orderBy: { custodian: 'asc' }
        })

        const groupedByCustodian: Record<string, {
          assets: {
            assetId: string
            name: string
            category: string
            location: string | null
            purchasePrice: number
            netBookValue: number
            condition: string
          }[]
          totalCost: number
          totalNBV: number
          assetCount: number
        }> = {}

        for (const asset of assets) {
          const cust = asset.custodian || 'Unassigned'
          if (!groupedByCustodian[cust]) {
            groupedByCustodian[cust] = { assets: [], totalCost: 0, totalNBV: 0, assetCount: 0 }
          }
          groupedByCustodian[cust].assets.push({
            assetId: asset.assetId,
            name: asset.name,
            category: asset.category,
            location: asset.location,
            purchasePrice: Math.round(asset.purchasePrice),
            netBookValue: Math.round(asset.netBookValue),
            condition: asset.condition
          })
          groupedByCustodian[cust].totalCost += asset.purchasePrice
          groupedByCustodian[cust].totalNBV += asset.netBookValue
          groupedByCustodian[cust].assetCount++
        }

        // Round totals
        for (const cust of Object.keys(groupedByCustodian)) {
          groupedByCustodian[cust].totalCost = Math.round(groupedByCustodian[cust].totalCost)
          groupedByCustodian[cust].totalNBV = Math.round(groupedByCustodian[cust].totalNBV)
        }

        const grandTotalCost = Object.values(groupedByCustodian).reduce((s, c) => s + c.totalCost, 0)
        const grandTotalNBV = Object.values(groupedByCustodian).reduce((s, c) => s + c.totalNBV, 0)

        return NextResponse.json({
          type,
          data: groupedByCustodian,
          summary: {
            custodianCount: Object.keys(groupedByCustodian).length,
            totalAssets: assets.length,
            grandTotalCost: Math.round(grandTotalCost),
            grandTotalNBV: Math.round(grandTotalNBV)
          }
        })
      }

      case 'nbv-summary': {
        // NBV summary by category showing opening cost, accumulated dep, closing NBV, and depreciation %
        const fy = fiscalYear
        if (!fy) {
          return NextResponse.json({ error: 'fiscalYear query parameter is required (e.g., 2024-25)' }, { status: 400 })
        }

        const assets = await db.fixedAsset.findMany({
          where: { status: { in: ['Active', 'Under Maintenance'] } }
        })

        // Get depreciation records for the fiscal year to compute year's depreciation
        const depRecords = await db.fixedAssetDepreciation.findMany({
          where: { financialYear: fy, isTaxDepreciation: false }
        })

        // Aggregate depreciation per asset for the fiscal year
        const depByAsset = new Map<string, { yearDepreciation: number; yearOpeningNBV: number; yearClosingNBV: number }>()
        for (const rec of depRecords) {
          const existing = depByAsset.get(rec.assetId) || { yearDepreciation: 0, yearOpeningNBV: rec.openingNBV, yearClosingNBV: 0 }
          existing.yearDepreciation += rec.depreciationCharge
          existing.yearOpeningNBV = Math.min(existing.yearOpeningNBV, rec.openingNBV)
          existing.yearClosingNBV = rec.closingNBV
          depByAsset.set(rec.assetId, existing)
        }

        // Group by category
        const categories = [...new Set(assets.map(a => a.category))]
        const categorySummary = categories.map(cat => {
          const catAssets = assets.filter(a => a.category === cat)

          // Opening cost = purchase price (original cost for assets active in this category)
          const openingCost = catAssets.reduce((s, a) => s + a.purchasePrice, 0)

          // Total accumulated depreciation from asset records
          const accumulatedDep = catAssets.reduce((s, a) => s + a.accumulatedDepreciation, 0)

          // Year's depreciation from depreciation records
          const yearDepreciation = catAssets.reduce((s, a) => {
            const dep = depByAsset.get(a.id)
            return s + (dep?.yearDepreciation || 0)
          }, 0)

          // Closing NBV
          const closingNBV = catAssets.reduce((s, a) => s + a.netBookValue, 0)

          // Depreciation % = accumulated depreciation / opening cost * 100
          const depreciationPct = openingCost > 0 ? (accumulatedDep / openingCost) * 100 : 0

          return {
            category: cat,
            assetCount: catAssets.length,
            openingCost: Math.round(openingCost),
            yearDepreciation: Math.round(yearDepreciation),
            accumulatedDepreciation: Math.round(accumulatedDep),
            closingNBV: Math.round(closingNBV),
            depreciationPct: Math.round(depreciationPct * 100) / 100
          }
        })

        const totalOpeningCost = categorySummary.reduce((s, c) => s + c.openingCost, 0)
        const totalYearDep = categorySummary.reduce((s, c) => s + c.yearDepreciation, 0)
        const totalAccumDep = categorySummary.reduce((s, c) => s + c.accumulatedDepreciation, 0)
        const totalClosingNBV = categorySummary.reduce((s, c) => s + c.closingNBV, 0)
        const totalDepPct = totalOpeningCost > 0 ? (totalAccumDep / totalOpeningCost) * 100 : 0

        return NextResponse.json({
          type,
          fiscalYear: fy,
          data: categorySummary,
          totals: {
            totalAssets: assets.length,
            totalOpeningCost: Math.round(totalOpeningCost),
            totalYearDepreciation: Math.round(totalYearDep),
            totalAccumulatedDepreciation: Math.round(totalAccumDep),
            totalClosingNBV: Math.round(totalClosingNBV),
            totalDepreciationPct: Math.round(totalDepPct * 100) / 100
          }
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('FAMS Reports GET error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
