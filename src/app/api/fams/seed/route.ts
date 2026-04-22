import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

/**
 * GET /api/fams/seed - Seed FAMS demo data
 * Organization: Khyber Development Trust, Peshawar, KPK
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
        where: { email: 'admin@kdt.org' },
        update: {},
        create: { email: 'admin@kdt.org', name: 'Super Admin', role: 'admin', isActive: true },
      }),
      db.user.upsert({
        where: { email: 'finance@kdt.org' },
        update: {},
        create: { email: 'finance@kdt.org', name: 'Finance Officer', role: 'manager', isActive: true },
      }),
      db.user.upsert({
        where: { email: 'assets@kdt.org' },
        update: {},
        create: { email: 'assets@kdt.org', name: 'Asset Manager', role: 'accountant', isActive: true },
      }),
      db.user.upsert({
        where: { email: 'custodian@kdt.org' },
        update: {},
        create: { email: 'custodian@kdt.org', name: 'Custodian', role: 'accountant', isActive: true },
      }),
      db.user.upsert({
        where: { email: 'auditor@kdt.org' },
        update: {},
        create: { email: 'auditor@kdt.org', name: 'Auditor', role: 'auditor', isActive: true },
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
    // 3. Create Assets (10 active + 1 disposed)
    // ============================================================
    const assetDefinitions = [
      {
        assetId: 'AST-2024-0001', name: 'Head Office Building', category: 'Buildings',
        purchasePrice: 85000000, residualValue: 5000000, usefulLifeYears: 40,
        depreciationMethod: 'Straight-Line', decliningRate: 0,
        accumulatedDepreciation: 8500000, netBookValue: 76500000,
        location: 'Peshawar HQ', province: 'KPK', custodian: 'Ahmad Khan',
        condition: 'Good', costCenter: 'CC-1001', project: 'PROJ-001', fundCode: 'FC-001',
        glAssetAccount: '1515', glAccDepAccount: '1610', glDepExpAccount: '5610',
        serialNumber: 'BLD-2010-001', supplierName: 'Peshawar Construction Co.',
        dateOfPurchase: '2010-07-01', dateOfCapitalization: '2010-07-01',
      },
      {
        assetId: 'AST-2024-0002', name: 'Toyota Hilux Vigo', category: 'Vehicles',
        purchasePrice: 7500000, residualValue: 500000, usefulLifeYears: 5,
        depreciationMethod: 'Declining-Balance', decliningRate: 20,
        accumulatedDepreciation: 2700000, netBookValue: 4800000,
        location: 'Peshawar HQ', province: 'KPK', custodian: 'Ali Shah',
        condition: 'Good', costCenter: 'CC-1002', project: 'PROJ-002', fundCode: 'FC-001',
        glAssetAccount: '1520', glAccDepAccount: '1620', glDepExpAccount: '5620',
        serialNumber: 'VH-2023-001', supplierName: 'Toyota Motors Pakistan',
        invoiceNumber: 'INV-2023-001',
        dateOfPurchase: '2023-07-15', dateOfCapitalization: '2023-07-15',
      },
      {
        assetId: 'AST-2024-0003', name: 'Generator 100KVA', category: 'Machinery',
        purchasePrice: 3200000, residualValue: 0, usefulLifeYears: 0,
        depreciationMethod: 'None', decliningRate: 0,
        accumulatedDepreciation: 0, netBookValue: 3200000,
        location: 'Peshawar HQ', province: 'KPK', custodian: 'Usman Ali',
        condition: 'Good', isDonorFunded: true, donor: 'USAID',
        donorRestrictions: 'Cannot be disposed without donor approval',
        grantReference: 'KPK-USAID-2023', donorCode: 'DC-USAID',
        costCenter: 'CC-1001', project: 'PROJ-003', fundCode: 'FC-002',
        glAssetAccount: '1540', glAccDepAccount: '1660', glDepExpAccount: '5660',
        serialNumber: 'GEN-2023-001', supplierName: 'Cummins Pakistan',
        invoiceNumber: 'INV-2023-005',
        dateOfPurchase: '2023-09-01', dateOfCapitalization: '2023-09-01',
      },
      {
        assetId: 'AST-2024-0004', name: 'Dell Server + UPS', category: 'IT Assets',
        purchasePrice: 1800000, residualValue: 0, usefulLifeYears: 3,
        depreciationMethod: 'Straight-Line', decliningRate: 0,
        accumulatedDepreciation: 1200000, netBookValue: 600000,
        location: 'Server Room - Peshawar', province: 'KPK', custodian: 'Ali Shah',
        condition: 'Good', costCenter: 'CC-1003', project: 'PROJ-001', fundCode: 'FC-001',
        glAssetAccount: '1535', glAccDepAccount: '1650', glDepExpAccount: '5650',
        serialNumber: 'IT-2022-SRV-001', supplierName: 'Dell Technologies Pakistan',
        invoiceNumber: 'INV-2022-012',
        dateOfPurchase: '2022-07-01', dateOfCapitalization: '2022-07-01',
      },
      {
        assetId: 'AST-2024-0005', name: 'Office Furniture HQ', category: 'Furniture',
        purchasePrice: 950000, residualValue: 50000, usefulLifeYears: 10,
        depreciationMethod: 'Straight-Line', decliningRate: 0,
        accumulatedDepreciation: 190000, netBookValue: 760000,
        location: 'Peshawar HQ', province: 'KPK', custodian: 'Fatima Rahman',
        condition: 'Good', costCenter: 'CC-1001', project: 'PROJ-001', fundCode: 'FC-001',
        glAssetAccount: '1525', glAccDepAccount: '1630', glDepExpAccount: '5630',
        serialNumber: 'FRN-2022-001', supplierName: 'Peshawar Furniture House',
        invoiceNumber: 'INV-2022-020',
        dateOfPurchase: '2022-07-01', dateOfCapitalization: '2022-07-01',
      },
      {
        assetId: 'AST-2024-0006', name: 'Land — Peshawar Office', category: 'Land',
        purchasePrice: 45000000, residualValue: 45000000, usefulLifeYears: 0,
        depreciationMethod: 'None', decliningRate: 0,
        accumulatedDepreciation: 0, netBookValue: 45000000,
        location: 'University Road, Peshawar', province: 'KPK', custodian: 'Ahmad Khan',
        condition: 'Excellent', costCenter: 'CC-1001', project: 'PROJ-001', fundCode: 'FC-001',
        glAssetAccount: '1510', glAccDepAccount: '1610', glDepExpAccount: '5670',
        serialNumber: 'LND-2010-001', supplierName: 'Government of KPK',
        invoiceNumber: 'ALLOT-2010-001',
        dateOfPurchase: '2010-01-15', dateOfCapitalization: '2010-01-15',
      },
      {
        assetId: 'AST-2024-0007', name: 'Dell/HP Laptops x20', category: 'IT Assets',
        purchasePrice: 2400000, residualValue: 0, usefulLifeYears: 3,
        depreciationMethod: 'Straight-Line', decliningRate: 0,
        accumulatedDepreciation: 1600000, netBookValue: 800000,
        location: 'Peshawar HQ', province: 'KPK', custodian: 'Ali Shah',
        condition: 'Good', costCenter: 'CC-1003', project: 'PROJ-001', fundCode: 'FC-001',
        glAssetAccount: '1535', glAccDepAccount: '1650', glDepExpAccount: '5650',
        serialNumber: 'IT-2022-LAP-020', supplierName: 'HP Pakistan',
        invoiceNumber: 'INV-2022-015',
        dateOfPurchase: '2022-07-01', dateOfCapitalization: '2022-07-01',
      },
      {
        assetId: 'AST-2024-0008', name: 'Suzuki Carry Field', category: 'Vehicles',
        purchasePrice: 1750000, residualValue: 0, usefulLifeYears: 0,
        depreciationMethod: 'None', decliningRate: 0,
        accumulatedDepreciation: 0, netBookValue: 1750000,
        location: 'Field Office - Swat', province: 'KPK', custodian: 'Usman Ali',
        condition: 'Good', isDonorFunded: true, donor: 'EU',
        donorRestrictions: 'Field use only, not transferable',
        grantReference: 'EU-KPK-HEALTH-2022', donorCode: 'DC-EU',
        costCenter: 'CC-2001', project: 'PROJ-004', fundCode: 'FC-003',
        glAssetAccount: '1520', glAccDepAccount: '1620', glDepExpAccount: '5620',
        serialNumber: 'VH-2023-002', supplierName: 'Suzuki Motors Pakistan',
        invoiceNumber: 'INV-2023-008',
        dateOfPurchase: '2023-10-01', dateOfCapitalization: '2023-10-01',
      },
      {
        assetId: 'AST-2024-0009', name: 'Air Conditioners x6', category: 'Office Equipment',
        purchasePrice: 720000, residualValue: 0, usefulLifeYears: 8,
        depreciationMethod: 'Straight-Line', decliningRate: 0,
        accumulatedDepreciation: 180000, netBookValue: 540000,
        location: 'Peshawar HQ', province: 'KPK', custodian: 'Fatima Rahman',
        condition: 'Good', costCenter: 'CC-1001', project: 'PROJ-001', fundCode: 'FC-001',
        glAssetAccount: '1530', glAccDepAccount: '1640', glDepExpAccount: '5640',
        serialNumber: 'OFE-2022-AC-006', supplierName: 'Gree Pakistan',
        invoiceNumber: 'INV-2022-025',
        dateOfPurchase: '2022-07-01', dateOfCapitalization: '2022-07-01',
      },
      {
        assetId: 'AST-2024-0010', name: 'Ricoh Photocopier', category: 'Office Equipment',
        purchasePrice: 380000, residualValue: 0, usefulLifeYears: 5,
        depreciationMethod: 'Straight-Line', decliningRate: 0,
        accumulatedDepreciation: 152000, netBookValue: 228000,
        location: 'Peshawar HQ', province: 'KPK', custodian: 'Sara Wazir',
        condition: 'Good', costCenter: 'CC-1001', project: 'PROJ-001', fundCode: 'FC-001',
        glAssetAccount: '1530', glAccDepAccount: '1640', glDepExpAccount: '5640',
        serialNumber: 'OFE-2022-CP-001', supplierName: 'Ricoh Pakistan',
        invoiceNumber: 'INV-2022-030',
        dateOfPurchase: '2022-07-01', dateOfCapitalization: '2022-07-01',
      },
    ]

    const createdAssets = []
    for (const def of assetDefinitions) {
      const asset = await db.fixedAsset.create({
        data: {
          assetId: def.assetId,
          name: def.name,
          category: def.category,
          purchasePrice: def.purchasePrice,
          residualValue: def.residualValue,
          usefulLifeYears: def.usefulLifeYears,
          depreciationMethod: def.depreciationMethod,
          decliningRate: def.decliningRate,
          accumulatedDepreciation: def.accumulatedDepreciation,
          netBookValue: def.netBookValue,
          location: def.location || null,
          province: def.province || 'KPK',
          custodian: def.custodian || null,
          condition: def.condition || 'Good',
          costCenter: def.costCenter || null,
          project: def.project || null,
          fundCode: def.fundCode || null,
          glAssetAccount: def.glAssetAccount || null,
          glAccDepAccount: def.glAccDepAccount || null,
          glDepExpAccount: def.glDepExpAccount || null,
          serialNumber: def.serialNumber || null,
          supplierName: def.supplierName || null,
          invoiceNumber: def.invoiceNumber || null,
          isDonorFunded: (def as Record<string, unknown>).isDonorFunded as boolean || false,
          donor: (def as Record<string, unknown>).donor as string || null,
          donorRestrictions: (def as Record<string, unknown>).donorRestrictions as string || null,
          grantReference: (def as Record<string, unknown>).grantReference as string || null,
          donorCode: (def as Record<string, unknown>).donorCode as string || null,
          dateOfPurchase: new Date(def.dateOfPurchase),
          dateOfCapitalization: new Date(def.dateOfCapitalization),
          status: 'Active',
          approvalStatus: 'Approved',
          approvedBy: userId,
          createdBy: userId,
          journalStatus: 'Pending Export',
          taxMethod: 'Declining-Balance',
        },
      })
      createdAssets.push(asset)
    }

    // ============================================================
    // 4. Create Disposed Asset (AST-2023-0001)
    // ============================================================
    const disposedAsset = await db.fixedAsset.create({
      data: {
        assetId: 'AST-2023-0001',
        name: 'Old Generator',
        category: 'Machinery',
        purchasePrice: 800000,
        residualValue: 0,
        usefulLifeYears: 10,
        depreciationMethod: 'Straight-Line',
        decliningRate: 0,
        accumulatedDepreciation: 640000,
        netBookValue: 160000,
        location: 'Peshawar HQ',
        province: 'KPK',
        custodian: 'Ahmad Khan',
        condition: 'Poor',
        costCenter: 'CC-1001',
        glAssetAccount: '1540',
        glAccDepAccount: '1660',
        glDepExpAccount: '5660',
        serialNumber: 'GEN-2015-001',
        supplierName: 'Local Supplier',
        dateOfPurchase: new Date('2015-03-01'),
        dateOfCapitalization: new Date('2015-03-01'),
        status: 'Disposed',
        approvalStatus: 'Approved',
        approvedBy: userId,
        createdBy: userId,
        journalStatus: 'Exported',
        taxMethod: 'Declining-Balance',
      },
    })

    // Create disposal transaction for the disposed asset
    await db.assetTransaction.create({
      data: {
        txnId: 'TXN-2025-0001',
        assetId: disposedAsset.id,
        type: 'Disposal',
        date: new Date('2025-01-15'),
        description: 'Disposal of Old Generator - Sold to scrap dealer',
        amount: 800000,
        proceeds: 120000,
        gainLoss: -40000,
        disposalMethod: 'Sale',
        status: 'Approved',
        journalStatus: 'Exported',
        approvedBy: userId,
        createdBy: userId,
        notes: 'Net Book Value: 160,000, Proceeds: 120,000, Loss: 40,000 PKR',
      },
    })

    // ============================================================
    // 5. Create Depreciation Records (Jul-2024 through Mar-2025 = 9 months)
    // ============================================================
    const depPeriods = [
      { period: 'Jul-2024', monthNumber: 1, financialYear: '2024-25' },
      { period: 'Aug-2024', monthNumber: 2, financialYear: '2024-25' },
      { period: 'Sep-2024', monthNumber: 3, financialYear: '2024-25' },
      { period: 'Oct-2024', monthNumber: 4, financialYear: '2024-25' },
      { period: 'Nov-2024', monthNumber: 5, financialYear: '2024-25' },
      { period: 'Dec-2024', monthNumber: 6, financialYear: '2024-25' },
      { period: 'Jan-2025', monthNumber: 7, financialYear: '2024-25' },
      { period: 'Feb-2025', monthNumber: 8, financialYear: '2024-25' },
      { period: 'Mar-2025', monthNumber: 9, financialYear: '2024-25' },
    ]

    // Monthly charge calculations for SL assets
    const slCharges: Record<string, number> = {
      'AST-2024-0001': (85000000 - 5000000) / 40 / 12, // Building: 166,666.67
      'AST-2024-0004': 1800000 / 3 / 12,               // Server: 50,000
      'AST-2024-0005': (950000 - 50000) / 10 / 12,     // Furniture: 7,500
      'AST-2024-0007': 2400000 / 3 / 12,               // Laptops: 66,666.67
      'AST-2024-0009': 720000 / 8 / 12,                // ACs: 7,500
      'AST-2024-0010': 380000 / 5 / 12,                // Copier: 6,333.33
    }

    for (const depPeriod of depPeriods) {
      for (const asset of createdAssets) {
        // Skip non-depreciating assets
        if (asset.depreciationMethod === 'None') continue
        if (asset.isDonorFunded) continue
        if (asset.category === 'Land') continue

        const chargeKey = asset.assetId
        if (!slCharges[chargeKey]) continue

        // For Straight-Line assets, use pre-calculated monthly charge
        // For Declining-Balance, we skip in seed and use a simplified approach
        if (asset.depreciationMethod === 'Declining-Balance') continue

        const monthlyCharge = Math.round(slCharges[chargeKey] * 100) / 100
        if (monthlyCharge <= 0) continue

        const openingNBV = asset.netBookValue
        const newAccDep = asset.accumulatedDepreciation + monthlyCharge
        const closingNBV = asset.purchasePrice - newAccDep

        await db.fixedAssetDepreciation.create({
          data: {
            assetId: asset.id,
            financialYear: depPeriod.financialYear,
            period: depPeriod.period,
            monthNumber: depPeriod.monthNumber,
            openingNBV: Math.round(openingNBV * 100) / 100,
            depreciationCharge: monthlyCharge,
            accumulatedDepreciation: Math.round(newAccDep * 100) / 100,
            closingNBV: Math.round(closingNBV * 100) / 100,
            isPosted: true,
            journalStatus: 'Exported',
            isTaxDepreciation: false,
          },
        })
      }
    }

    // Handle Declining-Balance asset (AST-2024-0002 Toyota Hilux)
    const vehicleAsset = createdAssets.find(a => a.assetId === 'AST-2024-0002')
    if (vehicleAsset) {
      let runningNBV = vehicleAsset.purchasePrice
      let runningAccDep = 0

      for (const depPeriod of depPeriods) {
        if (runningNBV <= vehicleAsset.residualValue) break

        let monthlyCharge = runningNBV * (vehicleAsset.decliningRate / 100) / 12
        const maxCharge = runningNBV - vehicleAsset.residualValue
        if (monthlyCharge > maxCharge) monthlyCharge = maxCharge
        monthlyCharge = Math.round(monthlyCharge * 100) / 100

        if (monthlyCharge <= 0) break

        const openingNBV = runningNBV
        runningAccDep += monthlyCharge
        runningNBV -= monthlyCharge

        await db.fixedAssetDepreciation.create({
          data: {
            assetId: vehicleAsset.id,
            financialYear: depPeriod.financialYear,
            period: depPeriod.period,
            monthNumber: depPeriod.monthNumber,
            openingNBV: Math.round(openingNBV * 100) / 100,
            depreciationCharge: monthlyCharge,
            accumulatedDepreciation: Math.round(runningAccDep * 100) / 100,
            closingNBV: Math.round(runningNBV * 100) / 100,
            isPosted: true,
            journalStatus: 'Exported',
            isTaxDepreciation: false,
          },
        })
      }

      // Update the vehicle asset with actual accumulated depreciation from depreciation run
      await db.fixedAsset.update({
        where: { id: vehicleAsset.id },
        data: {
          accumulatedDepreciation: Math.round(runningAccDep * 100) / 100,
          netBookValue: Math.round(runningNBV * 100) / 100,
        },
      })
    }

    // ============================================================
    // 6. Create FAMS Settings (GL Account Mapping per spec)
    // ============================================================
    const settings = [
      // Organization
      { key: 'org_name', value: 'Khyber Development Trust', category: 'fams', description: 'Organization name' },
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
    // 7. Create Audit Log for seeding
    // ============================================================
    await db.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'FAMS',
        entityId: 'seed',
        details: JSON.stringify({
          message: 'FAMS demo data seeded',
          assets: createdAssets.length + 1,
          fiscalYears: 2,
          settings: settings.length,
          users: users.length,
        }),
      },
    })

    return NextResponse.json({
      message: 'FAMS demo data seeded successfully',
      summary: {
        assets: createdAssets.length + 1,
        disposedAsset: 1,
        fiscalYears: 2,
        users: users.length,
        settings: settings.length,
        depreciationPeriods: 9,
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
