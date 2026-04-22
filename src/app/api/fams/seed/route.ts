import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

/**
 * GET /api/fams/seed - Seed FAMS demo data
 * Generic organization setup. No org-specific branding.
 * All amounts in PKR
 */
export async function GET() {
  try {
    // Check if data already exists
    const existingAssets = await db.fixedAsset.count()
    if (existingAssets > 0) {
      return NextResponse.json({
        message: 'Data already seeded. Skipping.',
        assetCount: existingAssets,
      })
    }

    const userId = await getSystemUserId()

    // ============================================================
    // 1. Create FAMS Users (5 users)
    // ============================================================
    const users = await Promise.all([
      db.user.upsert({
        where: { email: 'admin@erp.local' },
        update: {},
        create: { email: 'admin@erp.local', name: 'Super Admin', role: 'admin', isActive: true },
      }),
      db.user.upsert({
        where: { email: 'finance@erp.local' },
        update: {},
        create: { email: 'finance@erp.local', name: 'Finance Officer', role: 'manager', isActive: true },
      }),
      db.user.upsert({
        where: { email: 'assets@erp.local' },
        update: {},
        create: { email: 'assets@erp.local', name: 'Asset Manager', role: 'accountant', isActive: true },
      }),
      db.user.upsert({
        where: { email: 'custodian@erp.local' },
        update: {},
        create: { email: 'custodian@erp.local', name: 'Custodian', role: 'accountant', isActive: true },
      }),
      db.user.upsert({
        where: { email: 'auditor@erp.local' },
        update: {},
        create: { email: 'auditor@erp.local', name: 'Auditor', role: 'auditor', isActive: true },
      }),
    ])

    // ============================================================
    // 2. Create Fiscal Years
    // ============================================================
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

    // FY 2023-24 (Closed) - all 12 periods complete
    const depRunStatus2324: Record<string, string> = {}
    for (let i = 0; i < 12; i++) {
      const year = i < 6 ? 2023 : 2024
      depRunStatus2324[`${months[i]}-${year}`] = 'Complete'
    }

    await db.fAMSFiscalYear.create({
      data: {
        label: '2023-24',
        startDate: new Date('2023-07-01'),
        endDate: new Date('2024-06-30'),
        status: 'Closed',
        depRunStatus: JSON.stringify(depRunStatus2324),
        openedBy: userId,
        closedBy: userId,
        closedAt: new Date('2024-07-01'),
      },
    })

    // FY 2024-25 (Open) - Jul-2024 through Mar-2025 = Complete, Apr-2025 through Jun-2025 = Pending
    const depRunStatus2425: Record<string, string> = {}
    for (let i = 0; i < 12; i++) {
      const year = i < 6 ? 2024 : 2025
      if (i < 9) {
        depRunStatus2425[`${months[i]}-${year}`] = 'Complete'
      } else {
        depRunStatus2425[`${months[i]}-${year}`] = 'Pending'
      }
    }

    await db.fAMSFiscalYear.create({
      data: {
        label: '2024-25',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2025-06-30'),
        status: 'Open',
        depRunStatus: JSON.stringify(depRunStatus2425),
        openedBy: userId,
      },
    })

    // ============================================================
    // 3. Create Assets (10 active + 1 disposed) — no demo data
    // ============================================================
    // Only create a minimal set: 2 example assets to show the structure
    // Users will add their own assets via the UI

    const createdAssets = []

    // No demo assets seeded — users add assets through the UI or CSV import
    // This ensures the FAMS module starts clean and is ready for real data

    // ============================================================
    // 4. Create FAMS Settings (GL Account Mapping)
    // ============================================================
    const settings = [
      // Organization
      { key: 'org_name', value: 'Organization', category: 'fams', description: 'Organization name' },
      { key: 'org_province', value: '', category: 'fams', description: 'Organization province' },
      { key: 'org_city', value: '', category: 'fams', description: 'Organization city' },
      // GL Account Mapping (per spec - matching the new COA)
      { key: 'gl_land', value: '1510', category: 'gl-mapping', description: 'GL account for Land' },
      { key: 'gl_buildings', value: '1515', category: 'gl-mapping', description: 'GL account for Buildings' },
      { key: 'gl_vehicles', value: '1520', category: 'gl-mapping', description: 'GL account for Vehicles' },
      { key: 'gl_furniture', value: '1525', category: 'gl-mapping', description: 'GL account for Furniture' },
      { key: 'gl_office_equip', value: '1530', category: 'gl-mapping', description: 'GL account for Office Equipment' },
      { key: 'gl_it_assets', value: '1535', category: 'gl-mapping', description: 'GL account for IT Assets' },
      { key: 'gl_machinery', value: '1540', category: 'gl-mapping', description: 'GL account for Machinery' },
      { key: 'gl_other_fixed', value: '1545', category: 'gl-mapping', description: 'GL account for Other Fixed Assets' },
      { key: 'gl_cwip', value: '1550', category: 'gl-mapping', description: 'GL account for Capital Work in Progress' },
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
      { key: 'gl_other_fixed_asset', value: '1545', category: 'gl-mapping', description: 'GL asset account for Other Fixed Assets' },
      { key: 'gl_other_fixed_acc_dep', value: '1670', category: 'gl-mapping', description: 'GL acc dep account for Other Fixed Assets' },
      { key: 'gl_other_fixed_dep_exp', value: '5670', category: 'gl-mapping', description: 'GL dep expense account for Other Fixed Assets' },
      // Thresholds (per spec)
      { key: 'threshold_cfo_approval', value: '500000', category: 'thresholds', description: 'PKR threshold for CFO approval' },
      { key: 'threshold_manager_approval', value: '100000', category: 'thresholds', description: 'PKR threshold for Manager approval' },
      { key: 'capitalization_threshold', value: '50000', category: 'thresholds', description: 'Minimum cost (PKR) to capitalize as fixed asset' },
      // Tax Rates - FBR Schedule III
      { key: 'tax_building_rate', value: '10', category: 'tax-rates', description: 'FBR Schedule III rate for Buildings (%)' },
      { key: 'tax_vehicle_rate', value: '15', category: 'tax-rates', description: 'FBR Schedule III rate for Vehicles (%)' },
      { key: 'tax_furniture_rate', value: '15', category: 'tax-rates', description: 'FBR Schedule III rate for Furniture (%)' },
      { key: 'tax_office_equip_rate', value: '15', category: 'tax-rates', description: 'FBR Schedule III rate for Office Equipment (%)' },
      { key: 'tax_it_asset_rate', value: '30', category: 'tax-rates', description: 'FBR Schedule III rate for IT Assets (%)' },
      { key: 'tax_machinery_rate', value: '15', category: 'tax-rates', description: 'FBR Schedule III rate for Machinery (%)' },
      { key: 'tax_land_rate', value: '0', category: 'tax-rates', description: 'FBR Schedule III rate for Land (%)' },
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

    for (const setting of settings) {
      await db.fAMSSetting.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: {
          key: setting.key,
          value: setting.value,
          category: setting.category,
          description: setting.description,
        },
      })
    }

    // ============================================================
    // 5. Create Audit Log for seeding
    // ============================================================
    await db.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'FAMS',
        entityId: 'seed',
        details: JSON.stringify({
          message: 'FAMS initialized (no demo assets)',
          fiscalYears: 2,
          settings: settings.length,
          users: users.length,
        }),
      },
    })

    return NextResponse.json({
      message: 'FAMS initialized successfully. No demo assets — add assets via the UI or CSV import.',
      summary: {
        assets: 0,
        fiscalYears: 2,
        users: users.length,
        settings: settings.length,
      },
    })
  } catch (error) {
    console.error('FAMS Seed error:', error)
    return NextResponse.json(
      { error: 'Failed to seed FAMS data', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/fams/seed - Clear all FAMS demo/seed data
 */
export async function DELETE() {
  try {
    // Delete in correct order to respect foreign key constraints
    const depResult = await db.fixedAssetDepreciation.deleteMany({})
    const txnResult = await db.assetTransaction.deleteMany({})
    const journalResult = await db.fAMSJournal.deleteMany({})
    const batchResult = await db.fAMSExportBatch.deleteMany({})
    const assetResult = await db.fixedAsset.deleteMany({})
    const fyResult = await db.fAMSFiscalYear.deleteMany({})
    const settingResult = await db.fAMSSetting.deleteMany({})

    return NextResponse.json({
      message: 'All FAMS data cleared successfully',
      deleted: {
        assets: assetResult.count,
        depreciationRecords: depResult.count,
        transactions: txnResult.count,
        journals: journalResult.count,
        exportBatches: batchResult.count,
        fiscalYears: fyResult.count,
        settings: settingResult.count,
      },
    })
  } catch (error) {
    console.error('FAMS Seed DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to clear FAMS data', details: String(error) },
      { status: 500 }
    )
  }
}
