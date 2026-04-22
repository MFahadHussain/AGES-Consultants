import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findAccDepForCategory, findDepExpenseForCategory } from '@/lib/account-roles'

// GET /api/fams/depreciation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('assetId')
    const financialYear = searchParams.get('financialYear')
    const period = searchParams.get('period')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (assetId) where.assetId = assetId
    if (financialYear) where.financialYear = financialYear
    if (period) where.period = period

    const records = await db.fixedAssetDepreciation.findMany({
      where,
      orderBy: [{ financialYear: 'asc' }, { monthNumber: 'asc' }],
    })

    const totalCharge = records.reduce((s, r) => s + r.depreciationCharge, 0)
    return NextResponse.json({ records, totalCharge: Math.round(totalCharge), count: records.length })
  } catch (error) {
    console.error('FAMS Dep GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch depreciation' }, { status: 500 })
  }
}

// POST /api/fams/depreciation - Run depreciation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { financialYear, period, monthNumber } = body
    if (!financialYear || !period || !monthNumber) {
      return NextResponse.json({ error: 'financialYear, period, monthNumber required' }, { status: 400 })
    }

    // Check fiscal year exists and is open
    const fy = await db.fAMSFiscalYear.findFirst({ where: { label: financialYear } })
    if (!fy) return NextResponse.json({ error: `FY ${financialYear} not found` }, { status: 404 })
    if (fy.status === 'Closed') return NextResponse.json({ error: 'FY is closed' }, { status: 400 })

    // Check if already run
    const existing = await db.fixedAssetDepreciation.findFirst({ where: { financialYear, period } })
    if (existing) return NextResponse.json({ error: `Depreciation already run for ${period}` }, { status: 400 })

    // Get eligible assets
    const assets = await db.fixedAsset.findMany({
      where: { status: 'Active', approvalStatus: 'Approved', isDonorFunded: false, depreciationMethod: { not: 'None' } },
    })

    const results = []
    for (const asset of assets) {
      let monthlyCharge = 0
      if (asset.depreciationMethod === 'Straight-Line') {
        monthlyCharge = (asset.purchasePrice - asset.residualValue) / asset.usefulLifeYears / 12
      } else if (asset.depreciationMethod === 'Declining-Balance') {
        monthlyCharge = asset.netBookValue * (asset.decliningRate / 100) / 12
      }
      monthlyCharge = Math.round(monthlyCharge * 100) / 100

      // Stop if fully depreciated
      const maxCharge = asset.netBookValue - asset.residualValue
      if (maxCharge <= 0 || monthlyCharge <= 0) continue
      if (monthlyCharge > maxCharge) monthlyCharge = maxCharge

      const newAccDep = asset.accumulatedDepreciation + monthlyCharge
      const newNBV = asset.purchasePrice - newAccDep

      const record = await db.fixedAssetDepreciation.create({
        data: {
          assetId: asset.id, financialYear, period, monthNumber,
          openingNBV: Math.round(asset.netBookValue * 100) / 100,
          depreciationCharge: monthlyCharge,
          accumulatedDepreciation: Math.round(newAccDep * 100) / 100,
          closingNBV: Math.round(Math.max(newNBV, asset.residualValue) * 100) / 100,
          isPosted: true, journalStatus: 'Pending Export',
        },
      })

      await db.fixedAsset.update({
        where: { id: asset.id },
        data: { accumulatedDepreciation: Math.round(newAccDep), netBookValue: Math.round(Math.max(newNBV, asset.residualValue)) },
      })

      // Create journal entry — use account-roles for GL account resolution
      const depExpAccount = await findDepExpenseForCategory(asset.category)
      const accDepAccount = await findAccDepForCategory(asset.category)

      const jPrefix = `JV-FAMS-${new Date().getFullYear()}-`
      const lastJ = await db.fAMSJournal.findFirst({ where: { journalNumber: { startsWith: jPrefix } }, orderBy: { journalNumber: 'desc' } })
      let jNum = 1
      if (lastJ) { const p = lastJ.journalNumber.split('-'); const n = parseInt(p[p.length - 1] || '0'); if (!isNaN(n)) jNum = n + 1 }

      await db.fAMSJournal.create({
        data: {
          journalNumber: `${jPrefix}${String(jNum).padStart(4, '0')}`,
          type: 'Depreciation', date: new Date(),
          narration: `Depreciation: ${asset.name} (${asset.assetId}) - ${period}`,
          assetId: asset.assetId, assetName: asset.name,
          drAccountCode: depExpAccount?.code || asset.glDepExpAccount || '5600',
          drAccountName: depExpAccount?.name || 'Depreciation Expense',
          drAmount: Math.round(monthlyCharge),
          crAccountCode: accDepAccount?.code || asset.glAccDepAccount || '1600',
          crAccountName: accDepAccount?.name || 'Accumulated Depreciation',
          crAmount: Math.round(monthlyCharge),
          costCenter: asset.costCenter || undefined,
          project: asset.project || undefined,
          fundCode: asset.fundCode || undefined,
          status: 'Pending Export',
        },
      })

      results.push(record)
    }

    // Update FY dep run status
    const depStatus = JSON.parse(fy.depRunStatus as string || '{}')
    depStatus[period] = 'Complete'
    await db.fAMSFiscalYear.update({ where: { id: fy.id }, data: { depRunStatus: JSON.stringify(depStatus) } })

    return NextResponse.json({ message: `Depreciation run for ${period}`, assetsProcessed: results.length, totalCharge: Math.round(results.reduce((s, r) => s + r.depreciationCharge, 0)) })
  } catch (error) {
    console.error('FAMS Dep POST error:', error)
    return NextResponse.json({ error: 'Failed to run depreciation' }, { status: 500 })
  }
}
