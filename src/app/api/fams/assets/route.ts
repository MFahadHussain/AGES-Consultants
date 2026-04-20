import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/fams/assets - List assets
export async function GET() {
  try {
    const assets = await db.fixedAsset.findMany({
      orderBy: { assetId: 'asc' },
    })

    const totalCost = assets.reduce((s, a) => s + a.purchasePrice, 0)
    const totalAccDep = assets.reduce((s, a) => s + a.accumulatedDepreciation, 0)
    const totalNBV = assets.reduce((s, a) => s + a.netBookValue, 0)
    const donorAssets = assets.filter(a => a.isDonorFunded)

    return NextResponse.json({
      assets,
      total: assets.length,
      summary: {
        totalCost: Math.round(totalCost),
        totalAccDep: Math.round(totalAccDep),
        totalNBV: Math.round(totalNBV),
        donorCount: donorAssets.length,
        donorCost: Math.round(donorAssets.reduce((s, a) => s + a.purchasePrice, 0)),
        totalCount: assets.length,
      },
    })
  } catch (error) {
    console.error('FAMS Assets GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
  }
}

// POST /api/fams/assets - Create new asset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.name || !body.category || !body.dateOfPurchase || body.purchasePrice == null) {
      return NextResponse.json({ error: 'Name, category, date, and price are required' }, { status: 400 })
    }

    // Business rules
    if (body.isDonorFunded === true) { body.depreciationMethod = 'None'; body.usefulLifeYears = 0 }
    if (body.category === 'Land') { body.depreciationMethod = 'None'; body.usefulLifeYears = 0; body.residualValue = body.purchasePrice }

    // Auto-generate assetId
    const year = new Date(body.dateOfPurchase).getFullYear()
    const prefix = `AST-${year}-`
    const last = await db.fixedAsset.findFirst({ where: { assetId: { startsWith: prefix } }, orderBy: { assetId: 'desc' } })
    let num = 1
    if (last) { const p = last.assetId.split('-'); const n = parseInt(p[p.length - 1]); if (!isNaN(n)) num = n + 1 }
    const assetId = `${prefix}${String(num).padStart(4, '0')}`

    const FBR: Record<string, number> = { Land: 0, Buildings: 10, Vehicles: 15, Furniture: 15, 'Office Equipment': 15, 'IT Assets': 30, Machinery: 15, Other: 15 }
    const GL: Record<string, { a: string; d: string; e: string }> = { Land: { a: '1210', d: '1300', e: '5300' }, Buildings: { a: '1215', d: '1300', e: '5300' }, Vehicles: { a: '1220', d: '1300', e: '5300' }, Furniture: { a: '1225', d: '1300', e: '5300' }, 'Office Equipment': { a: '1230', d: '1300', e: '5300' }, 'IT Assets': { a: '1235', d: '1300', e: '5300' }, Machinery: { a: '1240', d: '1300', e: '5300' }, Other: { a: '1250', d: '1300', e: '5300' } }
    const gl = GL[body.category] || GL.Other
    const nbv = body.purchasePrice - (body.accumulatedDepreciation || 0)

    const asset = await db.fixedAsset.create({
      data: {
        assetId, name: body.name, description: body.description || null, category: body.category,
        subCategory: body.subCategory || null, dateOfPurchase: new Date(body.dateOfPurchase),
        dateOfCapitalization: new Date(body.dateOfCapitalization || body.dateOfPurchase),
        purchasePrice: body.purchasePrice, residualValue: body.residualValue ?? 0,
        usefulLifeYears: body.usefulLifeYears || 0, depreciationMethod: body.depreciationMethod || 'Straight-Line',
        decliningRate: body.decliningRate || 0, custodian: body.custodian || null, location: body.location || null,
        province: body.province || 'KPK', donor: body.donor || null, isDonorFunded: body.isDonorFunded || false,
        donorRestrictions: body.donorRestrictions || null, grantReference: body.grantReference || null,
        invoiceNumber: body.invoiceNumber || null, supplierName: body.supplierName || null,
        supplierNTN: body.supplierNTN || null, serialNumber: body.serialNumber || null,
        status: 'Active', condition: body.condition || 'Good',
        insuranceValue: body.insuranceValue || 0, insurancePolicyNumber: body.insurancePolicyNumber || null,
        costCenter: body.costCenter || null, project: body.project || null, fundCode: body.fundCode || null,
        donorCode: body.donorCode || null, glAssetAccount: body.glAssetAccount || gl.a,
        glAccDepAccount: body.glAccDepAccount || gl.d, glDepExpAccount: body.glDepExpAccount || gl.e,
        taxCategory: body.category, taxRate: FBR[body.category] ?? 15,
        taxMethod: body.taxMethod || 'Declining-Balance', approvalStatus: body.approvalStatus || 'Draft',
        createdBy: 'system', journalStatus: 'Pending Export', notes: body.notes || null,
        accumulatedDepreciation: body.accumulatedDepreciation || 0, netBookValue: Math.round(nbv),
        warrantyExpiryDate: body.warrantyExpiryDate ? new Date(body.warrantyExpiryDate) : null,
        insuranceExpiryDate: body.insuranceExpiryDate ? new Date(body.insuranceExpiryDate) : null,
      },
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error('FAMS Assets POST error:', error)
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 })
  }
}
