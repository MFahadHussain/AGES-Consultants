import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** Default FAMS settings aligned with spec */
const DEFAULT_SETTINGS = [
  // Organization
  { key: 'org_name', value: 'Organization', category: 'fams', description: 'Organization name' },
  { key: 'org_province', value: 'KPK', category: 'fams', description: 'Organization province' },
  { key: 'org_city', value: 'Peshawar', category: 'fams', description: 'Organization city' },
  // GL Account Mapping (per spec)
  { key: 'gl_land', value: '1510', category: 'gl-mapping', description: 'GL account for Land' },
  { key: 'gl_buildings', value: '1515', category: 'gl-mapping', description: 'GL account for Buildings' },
  { key: 'gl_vehicles', value: '1520', category: 'gl-mapping', description: 'GL account for Vehicles' },
  { key: 'gl_furniture', value: '1525', category: 'gl-mapping', description: 'GL account for Furniture' },
  { key: 'gl_office_equip', value: '1530', category: 'gl-mapping', description: 'GL account for Office Equipment' },
  { key: 'gl_it_assets', value: '1535', category: 'gl-mapping', description: 'GL account for IT Assets' },
  { key: 'gl_machinery', value: '1540', category: 'gl-mapping', description: 'GL account for Machinery' },
  { key: 'gl_acc_depreciation', value: '1600', category: 'gl-mapping', description: 'GL account for Accumulated Depreciation' },
  { key: 'gl_dep_expense', value: '5600', category: 'gl-mapping', description: 'GL account for Depreciation Expense' },
  { key: 'gl_gain_disposal', value: '4430', category: 'gl-mapping', description: 'GL account for Gain on Disposal' },
  { key: 'gl_loss_disposal', value: '5910', category: 'gl-mapping', description: 'GL account for Loss on Disposal' },
  { key: 'gl_revaluation_reserve', value: '3300', category: 'gl-mapping', description: 'GL account for Revaluation Reserve' },
  { key: 'gl_bank_account', value: '1121', category: 'gl-mapping', description: 'Default GL bank/cash account' },
  // Category-specific GL mappings (detailed)
  { key: 'gl_building_asset', value: '1515', category: 'gl-mapping', description: 'GL asset account for Buildings' },
  { key: 'gl_building_acc_dep', value: '1610', category: 'gl-mapping', description: 'GL acc dep account for Buildings' },
  { key: 'gl_building_dep_exp', value: '5610', category: 'gl-mapping', description: 'GL dep expense account for Buildings' },
  { key: 'gl_vehicle_asset', value: '1520', category: 'gl-mapping', description: 'GL asset account for Vehicles' },
  { key: 'gl_vehicle_acc_dep', value: '1620', category: 'gl-mapping', description: 'GL acc dep account for Vehicles' },
  { key: 'gl_vehicle_dep_exp', value: '5620', category: 'gl-mapping', description: 'GL dep expense account for Vehicles' },
  { key: 'gl_it_asset', value: '1535', category: 'gl-mapping', description: 'GL asset account for IT Assets' },
  { key: 'gl_it_acc_dep', value: '1650', category: 'gl-mapping', description: 'GL acc dep account for IT Assets' },
  { key: 'gl_it_dep_exp', value: '5650', category: 'gl-mapping', description: 'GL dep expense account for IT Assets' },
  { key: 'gl_furniture_asset', value: '1525', category: 'gl-mapping', description: 'GL asset account for Furniture' },
  { key: 'gl_furniture_acc_dep', value: '1630', category: 'gl-mapping', description: 'GL acc dep account for Furniture' },
  { key: 'gl_furniture_dep_exp', value: '5630', category: 'gl-mapping', description: 'GL dep expense account for Furniture' },
  { key: 'gl_office_equip_asset', value: '1530', category: 'gl-mapping', description: 'GL asset account for Office Equipment' },
  { key: 'gl_office_equip_acc_dep', value: '1640', category: 'gl-mapping', description: 'GL acc dep account for Office Equipment' },
  { key: 'gl_office_equip_dep_exp', value: '5640', category: 'gl-mapping', description: 'GL dep expense account for Office Equipment' },
  { key: 'gl_machinery_asset', value: '1540', category: 'gl-mapping', description: 'GL asset account for Machinery' },
  { key: 'gl_machinery_acc_dep', value: '1660', category: 'gl-mapping', description: 'GL acc dep account for Machinery' },
  { key: 'gl_machinery_dep_exp', value: '5660', category: 'gl-mapping', description: 'GL dep expense account for Machinery' },
  { key: 'gl_land_asset', value: '1510', category: 'gl-mapping', description: 'GL asset account for Land' },
  // Thresholds (per spec)
  { key: 'threshold_cfo_approval', value: '500000', category: 'thresholds', description: 'PKR threshold for CFO approval' },
  { key: 'threshold_manager_approval', value: '100000', category: 'thresholds', description: 'PKR threshold for Manager approval' },
  { key: 'capitalization_threshold', value: '50000', category: 'thresholds', description: 'Minimum cost (PKR) to capitalize as fixed asset' },
  // Tax Rates - FBR Schedule III (updated per task spec)
  { key: 'tax_land_rate', value: '0', category: 'tax-rates', description: 'FBR Schedule III rate for Land (%)' },
  { key: 'tax_building_rate', value: '10', category: 'tax-rates', description: 'FBR Schedule III rate for Buildings (%)' },
  { key: 'tax_vehicle_rate', value: '15', category: 'tax-rates', description: 'FBR Schedule III rate for Vehicles (%)' },
  { key: 'tax_furniture_rate', value: '15', category: 'tax-rates', description: 'FBR Schedule III rate for Furniture (%)' },
  { key: 'tax_office_equip_rate', value: '15', category: 'tax-rates', description: 'FBR Schedule III rate for Office Equipment (%)' },
  { key: 'tax_it_asset_rate', value: '30', category: 'tax-rates', description: 'FBR Schedule III rate for IT Assets (%)' },
  { key: 'tax_machinery_rate', value: '15', category: 'tax-rates', description: 'FBR Schedule III rate for Machinery (%)' },
  // FAMS config
  { key: 'fiscal_year_start_month', value: '7', category: 'fams', description: 'Fiscal year start month (7=July)' },
  { key: 'default_currency', value: 'PKR', category: 'fams', description: 'Default currency' },
  { key: 'asset_id_prefix', value: 'AST', category: 'fams', description: 'Asset ID prefix' },
  { key: 'txn_id_prefix', value: 'TXN', category: 'fams', description: 'Transaction ID prefix' },
  { key: 'journal_prefix', value: 'JV-FAMS', category: 'fams', description: 'Journal entry prefix' },
  { key: 'export_prefix', value: 'EXP', category: 'fams', description: 'Export batch prefix' },
  { key: 'transfer_cert_prefix', value: 'TC', category: 'fams', description: 'Transfer certificate prefix' },
  { key: 'auto_approve_additions', value: 'false', category: 'fams', description: 'Auto-approve new asset additions' },
  { key: 'require_disposal_approval', value: 'true', category: 'fams', description: 'Require approval for disposals' },
  { key: 'track_tax_depreciation', value: 'true', category: 'fams', description: 'Track tax depreciation alongside accounting depreciation' },
]

/**
 * GET /api/fams/settings - All FAMS settings, grouped by category
 * Returns: settings array, grouped object, flatMap for easy lookup
 */
async function GET_HANDLER() {
  try {
    let settings = await db.fAMSSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    // Seed defaults if empty
    if (settings.length === 0) {
      await db.fAMSSetting.createMany({
        data: DEFAULT_SETTINGS.map((s) => ({
          key: s.key,
          value: s.value,
          category: s.category,
          description: s.description,
        })),
      })

      settings = await db.fAMSSetting.findMany({
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      })
    }

    // Group by category
    const grouped: Record<string, Record<string, { value: string; description?: string | null }>> = {}
    for (const setting of settings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = {}
      }
      grouped[setting.category][setting.key] = {
        value: setting.value,
        description: setting.description,
      }
    }

    // Also provide flat key-value map for easy lookup
    const flatMap: Record<string, string> = {}
    for (const setting of settings) {
      flatMap[setting.key] = setting.value
    }

    // Category metadata
    const categoryMeta: Record<string, { label: string; count: number }> = {
      'fams': { label: 'FAMS Configuration', count: 0 },
      'gl-mapping': { label: 'GL Account Mapping', count: 0 },
      'thresholds': { label: 'Approval Thresholds', count: 0 },
      'tax-rates': { label: 'FBR Tax Rates', count: 0 },
    }

    for (const setting of settings) {
      if (categoryMeta[setting.category]) {
        categoryMeta[setting.category].count++
      } else {
        categoryMeta[setting.category] = { label: setting.category, count: 1 }
      }
    }

    return NextResponse.json({
      settings,
      grouped,
      flatMap,
      categoryMeta,
    })
  } catch (error) {
    console.error('FAMS Settings GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/fams/settings - Batch update settings (upsert)
 * Body: { settings: Array<{ key: string; value: string; category?: string; description?: string }> }
 */
async function POST_HANDLER(request: Request) {
  try {
    const body = await request.json()
    const { settings } = body as { settings: Array<{ key: string; value: string; category?: string; description?: string }> }

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json(
        { error: 'settings array is required' },
        { status: 400 }
      )
    }

    if (settings.length === 0) {
      return NextResponse.json(
        { error: 'settings array cannot be empty' },
        { status: 400 }
      )
    }

    // Validate all settings have required fields
    for (const setting of settings) {
      if (!setting.key || setting.value === undefined || setting.value === null) {
        return NextResponse.json(
          { error: `Each setting must have key and value. Missing for: ${JSON.stringify(setting)}` },
          { status: 400 }
        )
      }
    }

    const updated: Array<{ key: string; value: string; category: string }> = []

    for (const setting of settings) {
      const result = await db.fAMSSetting.upsert({
        where: { key: setting.key },
        update: {
          value: String(setting.value),
          ...(setting.category ? { category: setting.category } : {}),
          ...(setting.description !== undefined ? { description: setting.description } : {}),
        },
        create: {
          key: setting.key,
          value: String(setting.value),
          category: setting.category || 'fams',
          description: setting.description || null,
        },
      })
      updated.push({ key: result.key, value: result.value, category: result.category })
    }

    // Rebuild grouped and flatMap from all settings
    const allSettings = await db.fAMSSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    const grouped: Record<string, Record<string, { value: string; description?: string | null }>> = {}
    const flatMap: Record<string, string> = {}
    for (const setting of allSettings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = {}
      }
      grouped[setting.category][setting.key] = {
        value: setting.value,
        description: setting.description,
      }
      flatMap[setting.key] = setting.value
    }

    return NextResponse.json({
      message: `${settings.length} settings updated successfully`,
      updated,
      grouped,
      flatMap,
    })
  } catch (error) {
    console.error('FAMS Settings POST error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export const POST = withAudit('fams', POST_HANDLER);

export const GET = withAudit('fams', GET_HANDLER);
