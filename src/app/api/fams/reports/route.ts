import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/fams/reports?type=X
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'asset-register'

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
      default:
        return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('FAMS Reports GET error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
