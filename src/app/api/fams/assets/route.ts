import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findAccountByRole, findAccDepForCategory, findDepExpenseForCategory } from '@/lib/account-roles'

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

// GL account mapping — matches the new COA (Pakistani NGO)
const GL_CATEGORY_MAP: Record<string, { asset: string; accDep: string; depExp: string }> = {
  'Land':              { asset: '1510', accDep: '', depExp: '' },  // Land doesn't depreciate
  'Buildings':         { asset: '1515', accDep: '1610', depExp: '5610' },
  'Vehicles':          { asset: '1520', accDep: '1620', depExp: '5620' },
  'Furniture':         { asset: '1525', accDep: '1630', depExp: '5630' },
  'Office Equipment':  { asset: '1530', accDep: '1640', depExp: '5640' },
  'IT Assets':         { asset: '1535', accDep: '1650', depExp: '5650' },
  'Machinery':         { asset: '1540', accDep: '1660', depExp: '5660' },
  'Other':             { asset: '1545', accDep: '1670', depExp: '5670' },
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

    // Resolve GL accounts using account-roles utility first, then fall back to category mapping
    const glDefaults = GL_CATEGORY_MAP[body.category] || GL_CATEGORY_MAP.Other

    // Try account-roles for more accurate mapping
    const assetAccount = await findAccountByRole(`FA_${body.category.toUpperCase().replace(/\s+/g, '_').replace(/_EQUIPMENT/, '_EQUIP').replace(/_ASSETS/, '_ASSETS')}`)
    const accDepAccount = await findAccDepForCategory(body.category)
    const depExpAccount = await findDepExpenseForCategory(body.category)

    const glAssetCode = assetAccount?.code || body.glAssetAccount || glDefaults.asset
    // Land doesn't depreciate — always clear acc dep and dep exp codes
    const isNonDepreciating = body.category === 'Land' || body.depreciationMethod === 'None'
    const glAccDepCode = isNonDepreciating ? '' : (accDepAccount?.code || body.glAccDepAccount || glDefaults.accDep)
    const glDepExpCode = isNonDepreciating ? '' : (depExpAccount?.code || body.glDepExpAccount || glDefaults.depExp)

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
        donorCode: body.donorCode || null,
        glAssetAccount: glAssetCode,
        glAccDepAccount: glAccDepCode,
        glDepExpAccount: glDepExpCode,
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
