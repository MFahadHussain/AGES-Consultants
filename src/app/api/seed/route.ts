import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Seed endpoint: populates the database with sample data for all modules
export async function GET() {
  try {
    // 1. Create Financial Year
    const fy = await db.financialYear.create({
      data: {
        name: 'FY 2024-25',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2025-06-30'),
        status: 'open',
      },
    })

    // 2. Create Chart of Accounts - hierarchical
    const accountData = [
      // Assets
      { code: '1000', name: 'Current Assets', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 0 },
      { code: '1100', name: 'Cash & Cash Equivalents', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 1 },
      { code: '1110', name: 'Cash in Hand', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 2, allowPosting: true },
      { code: '1120', name: 'Bank Accounts', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 2, allowPosting: true },
      { code: '1121', name: 'Meezan Bank - Main Account', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 3, allowPosting: true },
      { code: '1122', name: 'HBL - Operations Account', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 3, allowPosting: true },
      { code: '1200', name: 'Accounts Receivable', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 1, allowPosting: true },
      { code: '1210', name: 'Trade Receivables', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 2, allowPosting: true },
      { code: '1220', name: 'Advances to Employees', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 2, allowPosting: true },
      { code: '1300', name: 'Inventory', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 1, allowPosting: true },
      { code: '2000', name: 'Non-Current Assets', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 0 },
      { code: '2100', name: 'Fixed Assets', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 1 },
      { code: '2110', name: 'Office Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 2, allowPosting: true },
      { code: '2120', name: 'Vehicles', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 2, allowPosting: true },
      { code: '2130', name: 'Furniture & Fixtures', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 2, allowPosting: true },
      { code: '2140', name: 'IT Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 2, allowPosting: true },
      { code: '2200', name: 'Accumulated Depreciation', accountType: 'ASSET', subType: 'CONTRA_ASSET', level: 1 },
      { code: '2210', name: 'Acc Dep - Office Equipment', accountType: 'ASSET', subType: 'CONTRA_ASSET', level: 2, allowPosting: true },
      { code: '2220', name: 'Acc Dep - Vehicles', accountType: 'ASSET', subType: 'CONTRA_ASSET', level: 2, allowPosting: true },
      { code: '2230', name: 'Acc Dep - Furniture', accountType: 'ASSET', subType: 'CONTRA_ASSET', level: 2, allowPosting: true },
      { code: '2240', name: 'Acc Dep - IT Equipment', accountType: 'ASSET', subType: 'CONTRA_ASSET', level: 2, allowPosting: true },

      // Liabilities
      { code: '3000', name: 'Current Liabilities', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 0 },
      { code: '3100', name: 'Accounts Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 1, allowPosting: true },
      { code: '3200', name: 'Accrued Expenses', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 1, allowPosting: true },
      { code: '3300', name: 'Tax Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 1 },
      { code: '3310', name: 'Income Tax Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 2, allowPosting: true },
      { code: '3320', name: 'Sales Tax Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 2, allowPosting: true },
      { code: '3330', name: 'Zakat Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 2, allowPosting: true },
      { code: '3400', name: 'Payroll Liabilities', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 1 },
      { code: '3410', name: 'EOBI Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 2, allowPosting: true },
      { code: '3420', name: 'Provident Fund Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 2, allowPosting: true },
      { code: '3430', name: 'Salary Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 2, allowPosting: true },
      { code: '3500', name: 'Loans & Advances (Payable)', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 1, allowPosting: true },
      { code: '4000', name: 'Non-Current Liabilities', accountType: 'LIABILITY', subType: 'LONG_TERM_LIABILITY', level: 0 },
      { code: '4100', name: 'Long-term Loans', accountType: 'LIABILITY', subType: 'LONG_TERM_LIABILITY', level: 1, allowPosting: true },

      // Equity
      { code: '5000', name: 'Equity', accountType: 'EQUITY', level: 0 },
      { code: '5100', name: 'General Fund', accountType: 'EQUITY', level: 1, allowPosting: true },
      { code: '5200', name: 'Retained Earnings', accountType: 'EQUITY', level: 1, allowPosting: true },
      { code: '5300', name: 'Surplus/Deficit', accountType: 'EQUITY', level: 1, allowPosting: true },

      // Income
      { code: '6000', name: 'Income', accountType: 'INCOME', level: 0 },
      { code: '6100', name: 'Grant Income', accountType: 'INCOME', subType: 'GRANT_INCOME', level: 1, allowPosting: true },
      { code: '6200', name: 'Donation Income', accountType: 'INCOME', subType: 'DONATION_INCOME', level: 1, allowPosting: true },
      { code: '6300', name: 'Service Revenue', accountType: 'INCOME', subType: 'SERVICE_REVENUE', level: 1, allowPosting: true },
      { code: '6400', name: 'Interest Income', accountType: 'INCOME', subType: 'OTHER_INCOME', level: 1, allowPosting: true },
      { code: '6500', name: 'Other Income', accountType: 'INCOME', subType: 'OTHER_INCOME', level: 1, allowPosting: true },

      // Expenses
      { code: '7000', name: 'Expenses', accountType: 'EXPENSE', level: 0 },
      { code: '7100', name: 'Salary & Wages', accountType: 'EXPENSE', subType: 'SALARY_EXPENSE', level: 1, allowPosting: true },
      { code: '7110', name: 'Basic Salary', accountType: 'EXPENSE', subType: 'SALARY_EXPENSE', level: 2, allowPosting: true },
      { code: '7120', name: 'Overtime', accountType: 'EXPENSE', subType: 'SALARY_EXPENSE', level: 2, allowPosting: true },
      { code: '7200', name: 'Rent Expense', accountType: 'EXPENSE', subType: 'OPERATING_EXPENSE', level: 1, allowPosting: true },
      { code: '7300', name: 'Utilities Expense', accountType: 'EXPENSE', subType: 'OPERATING_EXPENSE', level: 1, allowPosting: true },
      { code: '7400', name: 'Office Supplies', accountType: 'EXPENSE', subType: 'OPERATING_EXPENSE', level: 1, allowPosting: true },
      { code: '7500', name: 'Travel & Transportation', accountType: 'EXPENSE', subType: 'OPERATING_EXPENSE', level: 1, allowPosting: true },
      { code: '7600', name: 'Depreciation Expense', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 1 },
      { code: '7610', name: 'Dep Exp - Office Equipment', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 2, allowPosting: true },
      { code: '7620', name: 'Dep Exp - Vehicles', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 2, allowPosting: true },
      { code: '7630', name: 'Dep Exp - Furniture', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 2, allowPosting: true },
      { code: '7640', name: 'Dep Exp - IT Equipment', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 2, allowPosting: true },
      { code: '7700', name: 'Social Charges', accountType: 'EXPENSE', subType: 'PAYROLL_EXPENSE', level: 1, allowPosting: true },
      { code: '7800', name: 'Professional Fees', accountType: 'EXPENSE', subType: 'OPERATING_EXPENSE', level: 1, allowPosting: true },
      { code: '7900', name: 'Maintenance & Repairs', accountType: 'EXPENSE', subType: 'OPERATING_EXPENSE', level: 1, allowPosting: true },
    ]

    // Create accounts with hierarchy
    const createdAccounts: Record<string, string> = {}
    for (const acc of accountData) {
      const parentId = acc.level > 0 ? findParentId(acc.code, accountData, createdAccounts) : undefined
      const account = await db.account.create({
        data: {
          code: acc.code,
          name: acc.name,
          accountType: acc.accountType,
          subType: acc.subType || null,
          level: acc.level,
          allowPosting: acc.allowPosting ?? false,
          parentId: parentId,
          isSystem: acc.level <= 1,
        },
      })
      createdAccounts[acc.code] = account.id
    }

    // 3. Create Projects
    const projects = await Promise.all([
      db.project.create({ data: { code: 'PRJ-001', name: 'Education Program', description: 'Primary education initiative', startDate: new Date('2024-07-01'), endDate: new Date('2025-06-30'), status: 'active' } }),
      db.project.create({ data: { code: 'PRJ-002', name: 'Healthcare Initiative', description: 'Community healthcare program', startDate: new Date('2024-07-01'), endDate: new Date('2025-06-30'), status: 'active' } }),
      db.project.create({ data: { code: 'PRJ-003', name: 'Women Empowerment', description: 'Skills training program', startDate: new Date('2024-07-01'), endDate: new Date('2025-06-30'), status: 'active' } }),
      db.project.create({ data: { code: 'PRJ-004', name: 'Emergency Relief', description: 'Disaster relief operations', startDate: new Date('2024-10-01'), status: 'active' } }),
    ])

    // 4. Create Donors
    const donors = await Promise.all([
      db.donor.create({ data: { code: 'DON-001', name: 'UNICEF Pakistan', contactPerson: 'Ahmed Khan', email: 'ahmed@unicef.org', phone: '+92-51-1234567', address: 'Islamabad, Pakistan' } }),
      db.donor.create({ data: { code: 'DON-002', name: 'USAID', contactPerson: 'Sarah Johnson', email: 'sjohnson@usaid.gov', phone: '+1-202-712-0000', address: 'Washington DC, USA' } }),
      db.donor.create({ data: { code: 'DON-003', name: 'Bill & Melinda Gates Foundation', contactPerson: 'Mark Peters', email: 'mpeters@gatesfoundation.org', phone: '+1-206-709-0000', address: 'Seattle, USA' } }),
      db.donor.create({ data: { code: 'DON-004', name: 'DFID Pakistan', contactPerson: 'Fatima Raza', email: 'fraza@dfid.gov.uk', phone: '+92-51-9876543', address: 'Islamabad, Pakistan' } }),
    ])

    // 5. Create Locations
    const locations = await Promise.all([
      db.location.create({ data: { code: 'LOC-ISB', name: 'Islamabad Head Office', address: 'Blue Area, Islamabad' } }),
      db.location.create({ data: { code: 'LOC-KHI', name: 'Karachi Regional Office', address: 'Clifton, Karachi' } }),
      db.location.create({ data: { code: 'LOC-LHR', name: 'Lahore Field Office', address: 'Gulberg, Lahore' } }),
      db.location.create({ data: { code: 'LOC-PESH', name: 'Peshawar Field Office', address: 'University Road, Peshawar' } }),
    ])

    // 6. Create Customers
    const customers = await Promise.all([
      db.customer.create({ data: { code: 'CUS-001', name: 'Government of Sindh', contactPerson: 'Ali Hassan', email: 'ali@sindh.gov.pk', phone: '+92-21-99234567', address: 'Karachi, Sindh', creditTerms: 60, creditLimit: 5000000 } }),
      db.customer.create({ data: { code: 'CUS-002', name: 'Pakistan Medical Association', contactPerson: 'Dr. Naveed', email: 'naveed@pma.org.pk', phone: '+92-51-2345678', address: 'Islamabad', creditTerms: 30, creditLimit: 2000000 } }),
      db.customer.create({ data: { code: 'CUS-003', name: 'Aga Khan Foundation', contactPerson: 'Karim Shah', email: 'kshah@akdn.org', phone: '+92-21-3456789', address: 'Karachi', creditTerms: 45, creditLimit: 3000000 } }),
    ])

    // 7. Create Suppliers
    const suppliers = await Promise.all([
      db.supplier.create({ data: { code: 'SUP-001', name: 'OfficeMart Pakistan', contactPerson: 'Bilal Ahmed', email: 'bilal@officemart.pk', phone: '+92-51-5678901', address: 'F-8 Markaz, Islamabad', creditTerms: 30, taxNumber: 'NTN-1234567', bankName: 'HBL', bankAccount: '1234-5678-9012' } }),
      db.supplier.create({ data: { code: 'SUP-002', name: 'TechSolutions Ltd', contactPerson: 'Sara Ali', email: 'sara@techsolutions.pk', phone: '+92-21-6789012', address: 'Clifton, Karachi', creditTerms: 30, taxNumber: 'NTN-2345678', bankName: 'Meezan Bank', bankAccount: '2345-6789-0123' } }),
      db.supplier.create({ data: { code: 'SUP-003', name: 'MedSupply International', contactPerson: 'Dr. Farhan', email: 'farhan@medsupply.com', phone: '+92-51-7890123', address: 'Blue Area, Islamabad', creditTerms: 45, taxNumber: 'NTN-3456789' } }),
      db.supplier.create({ data: { code: 'SUP-004', name: 'Al-Meezan Construction', contactPerson: 'Rashid Khan', email: 'rashid@almeezan.pk', phone: '+92-91-8901234', address: 'Peshawar', creditTerms: 60, taxNumber: 'NTN-4567890' } }),
    ])

    // 8. Create Tax Rates
    const taxRates = await Promise.all([
      db.taxRate.create({ data: { name: 'Income Tax - Standard', taxType: 'INCOME_TAX', rate: 15, effectiveFrom: new Date('2024-07-01'), isActive: true } }),
      db.taxRate.create({ data: { name: 'Sales Tax - Standard', taxType: 'SALES_TAX', rate: 17, effectiveFrom: new Date('2024-07-01'), isActive: true } }),
      db.taxRate.create({ data: { name: 'Sales Tax - Reduced', taxType: 'SALES_TAX', rate: 5, effectiveFrom: new Date('2024-07-01'), isActive: true } }),
      db.taxRate.create({ data: { name: 'Zakat', taxType: 'ZAKAT', rate: 2.5, effectiveFrom: new Date('2024-07-01'), isActive: true } }),
      db.taxRate.create({ data: { name: 'GST - Standard', taxType: 'GST', rate: 17, effectiveFrom: new Date('2024-07-01'), isActive: true } }),
    ])

    // 9. Create sample vouchers
    const bankAccountId = createdAccounts['1121']
    const cashAccountId = createdAccounts['1110']
    const salaryAccountId = createdAccounts['7110']
    const rentAccountId = createdAccounts['7200']
    const utilitiesAccountId = createdAccounts['7300']
    const grantIncomeId = createdAccounts['6100']
    const donationIncomeId = createdAccounts['6200']
    const payablesAccountId = createdAccounts['3100']
    const receivablesAccountId = createdAccounts['1200']
    const eobiPayableId = createdAccounts['3410']
    const pfPayableId = createdAccounts['3420']
    const salaryPayableId = createdAccounts['3430']
    const socialChargesId = createdAccounts['7700']

    // Bank Receipt - Grant Income from UNICEF
    const voucher1 = await db.voucher.create({
      data: {
        voucherNumber: 'BR-2024-001',
        voucherType: 'BR',
        voucherTypeName: 'Bank Receipt',
        date: new Date('2024-07-15'),
        narration: 'Grant received from UNICEF for Education Program',
        reference: 'UNICEF/GR/2024/001',
        status: 'posted',
        financialYearId: fy.id,
        projectId: projects[0].id,
        donorId: donors[0].id,
        locationId: locations[0].id,
        totalDebit: 2500000,
        totalCredit: 2500000,
        createdBy: 'system',
        reviewedBy: 'system',
        approvedBy: 'system',
        postedBy: 'system',
        entries: {
          create: [
            { lineNumber: 1, accountId: bankAccountId, debit: 2500000, credit: 0, description: 'Grant receipt - UNICEF', donorId: donors[0].id, projectId: projects[0].id },
            { lineNumber: 2, accountId: grantIncomeId, debit: 0, credit: 2500000, description: 'Grant income - Education Program', donorId: donors[0].id, projectId: projects[0].id },
          ],
        },
      },
    })

    // Bank Receipt - Donation from Gates Foundation
    const voucher2 = await db.voucher.create({
      data: {
        voucherNumber: 'BR-2024-002',
        voucherType: 'BR',
        voucherTypeName: 'Bank Receipt',
        date: new Date('2024-08-01'),
        narration: 'Donation received from Gates Foundation for Healthcare Initiative',
        reference: 'GATES/DN/2024/001',
        status: 'posted',
        financialYearId: fy.id,
        projectId: projects[1].id,
        donorId: donors[2].id,
        locationId: locations[0].id,
        totalDebit: 1800000,
        totalCredit: 1800000,
        createdBy: 'system',
        reviewedBy: 'system',
        approvedBy: 'system',
        postedBy: 'system',
        entries: {
          create: [
            { lineNumber: 1, accountId: bankAccountId, debit: 1800000, credit: 0, description: 'Donation receipt - Gates Foundation' },
            { lineNumber: 2, accountId: donationIncomeId, debit: 0, credit: 1800000, description: 'Donation income - Healthcare' },
          ],
        },
      },
    })

    // Bank Payment - Salary Payment
    // INTEGRATION: Payroll → GL - Auto-generated from payroll approval
    const voucher3 = await db.voucher.create({
      data: {
        voucherNumber: 'BP-2024-001',
        voucherType: 'BP',
        voucherTypeName: 'Bank Payment',
        date: new Date('2024-07-31'),
        narration: 'Salary payment for July 2024 - All projects',
        status: 'posted',
        financialYearId: fy.id,
        totalDebit: 850000,
        totalCredit: 850000,
        isPayrollPosted: true, // INTEGRATION: Payroll → GL
        createdBy: 'system',
        reviewedBy: 'system',
        approvedBy: 'system',
        postedBy: 'system',
        entries: {
          create: [
            { lineNumber: 1, accountId: salaryAccountId, debit: 850000, credit: 0, description: 'Basic salary expense - July 2024', payrollRef: 'PAYROLL-2024-07' },
            { lineNumber: 2, accountId: bankAccountId, debit: 0, credit: 850000, description: 'Net pay via bank transfer', payrollRef: 'PAYROLL-2024-07' },
          ],
        },
      },
    })

    // Journal Voucher - Payroll Accruals
    // INTEGRATION: Payroll → GL - Social charges and deductions
    const voucher4 = await db.voucher.create({
      data: {
        voucherNumber: 'JV-2024-001',
        voucherType: 'JV',
        voucherTypeName: 'Journal Voucher',
        date: new Date('2024-07-31'),
        narration: 'Payroll deductions and employer charges - July 2024',
        status: 'posted',
        financialYearId: fy.id,
        isPayrollPosted: true, // INTEGRATION: Payroll → GL
        totalDebit: 127500,
        totalCredit: 127500,
        createdBy: 'system',
        entries: {
          create: [
            { lineNumber: 1, accountId: socialChargesId, debit: 63750, credit: 0, description: 'Employer EOBI contribution', payrollRef: 'PAYROLL-2024-07' },
            { lineNumber: 2, accountId: eobiPayableId, debit: 0, credit: 63750, description: 'EOBI payable - employer share', payrollRef: 'PAYROLL-2024-07' },
            { lineNumber: 3, accountId: salaryAccountId, debit: 42500, credit: 0, description: 'Provident fund employer contribution', payrollRef: 'PAYROLL-2024-07' },
            { lineNumber: 4, accountId: pfPayableId, debit: 0, credit: 42500, description: 'PF payable - employer share', payrollRef: 'PAYROLL-2024-07' },
          ],
        },
      },
    })

    // Bank Payment - Rent
    const voucher5 = await db.voucher.create({
      data: {
        voucherNumber: 'BP-2024-002',
        voucherType: 'BP',
        voucherTypeName: 'Bank Payment',
        date: new Date('2024-08-05'),
        narration: 'Office rent payment - August 2024',
        status: 'posted',
        financialYearId: fy.id,
        locationId: locations[0].id,
        totalDebit: 250000,
        totalCredit: 250000,
        createdBy: 'system',
        reviewedBy: 'system',
        approvedBy: 'system',
        postedBy: 'system',
        entries: {
          create: [
            { lineNumber: 1, accountId: rentAccountId, debit: 250000, credit: 0, description: 'Office rent - Islamabad Head Office' },
            { lineNumber: 2, accountId: bankAccountId, debit: 0, credit: 250000, description: 'Rent payment via Meezan Bank' },
          ],
        },
      },
    })

    // Cash Payment - Utilities
    const voucher6 = await db.voucher.create({
      data: {
        voucherNumber: 'CP-2024-001',
        voucherType: 'CP',
        voucherTypeName: 'Cash Payment',
        date: new Date('2024-08-10'),
        narration: 'Utility bills payment - August 2024',
        status: 'posted',
        financialYearId: fy.id,
        locationId: locations[0].id,
        totalDebit: 45000,
        totalCredit: 45000,
        createdBy: 'system',
        entries: {
          create: [
            { lineNumber: 1, accountId: utilitiesAccountId, debit: 45000, credit: 0, description: 'Electricity, gas, water bills' },
            { lineNumber: 2, accountId: cashAccountId, debit: 0, credit: 45000, description: 'Cash payment for utilities' },
          ],
        },
      },
    })

    // Bank Receipt - from Customer
    const voucher7 = await db.voucher.create({
      data: {
        voucherNumber: 'BR-2024-003',
        voucherType: 'BR',
        voucherTypeName: 'Bank Receipt',
        date: new Date('2024-08-20'),
        narration: 'Payment received from Government of Sindh',
        status: 'approved',
        financialYearId: fy.id,
        totalDebit: 1200000,
        totalCredit: 1200000,
        createdBy: 'system',
        reviewedBy: 'system',
        entries: {
          create: [
            { lineNumber: 1, accountId: bankAccountId, debit: 1200000, credit: 0, description: 'Payment received', customerId: customers[0].id },
            { lineNumber: 2, accountId: receivablesAccountId, debit: 0, credit: 1200000, description: 'Against receivables', customerId: customers[0].id },
          ],
        },
      },
    })

    // Bill - Supplier Invoice
    const voucher8 = await db.voucher.create({
      data: {
        voucherNumber: 'BILL-2024-001',
        voucherType: 'BILL',
        voucherTypeName: 'Bill',
        date: new Date('2024-09-01'),
        narration: 'Office supplies purchased from OfficeMart',
        reference: 'INV-OM-2024-089',
        status: 'reviewed',
        financialYearId: fy.id,
        totalDebit: 125000,
        totalCredit: 125000,
        createdBy: 'system',
        reviewedBy: 'system',
        entries: {
          create: [
            { lineNumber: 1, accountId: createdAccounts['7400'], debit: 125000, credit: 0, description: 'Office supplies', supplierId: suppliers[0].id },
            { lineNumber: 2, accountId: payablesAccountId, debit: 0, credit: 125000, description: 'Payable to OfficeMart', supplierId: suppliers[0].id },
          ],
        },
      },
    })

    // Draft voucher
    const voucher9 = await db.voucher.create({
      data: {
        voucherNumber: 'JV-2024-002',
        voucherType: 'JV',
        voucherTypeName: 'Journal Voucher',
        date: new Date('2024-09-15'),
        narration: 'Monthly depreciation entries',
        status: 'draft',
        financialYearId: fy.id,
        isAssetPosted: true, // INTEGRATION: Fixed Assets → GL
        totalDebit: 35000,
        totalCredit: 35000,
        createdBy: 'system',
        entries: {
          create: [
            { lineNumber: 1, accountId: createdAccounts['7610'], debit: 12000, credit: 0, description: 'Depreciation - Office Equipment', assetRef: 'FA-001' },
            { lineNumber: 2, accountId: createdAccounts['7620'], debit: 15000, credit: 0, description: 'Depreciation - Vehicles', assetRef: 'FA-002' },
            { lineNumber: 3, accountId: createdAccounts['7630'], debit: 8000, credit: 0, description: 'Depreciation - Furniture', assetRef: 'FA-003' },
            { lineNumber: 4, accountId: createdAccounts['2210'], debit: 0, credit: 12000, description: 'Accumulated Depreciation - Office Equipment' },
            { lineNumber: 5, accountId: createdAccounts['2220'], debit: 0, credit: 15000, description: 'Accumulated Depreciation - Vehicles' },
            { lineNumber: 6, accountId: createdAccounts['2230'], debit: 0, credit: 8000, description: 'Accumulated Depreciation - Furniture' },
          ],
        },
      },
    })

    // 10. Create Budgets
    const budget1 = await db.budget.create({
      data: {
        name: 'Education Program - Annual Budget FY24-25',
        financialYearId: fy.id,
        projectId: projects[0].id,
        donorId: donors[0].id,
        period: 'ANNUAL',
        status: 'active',
        totalAmount: 5000000,
        lines: {
          create: [
            { accountId: salaryAccountId, period: '2024', budgetAmount: 2400000, actualAmount: 850000 },
            { accountId: rentAccountId, period: '2024', budgetAmount: 600000, actualAmount: 250000 },
            { accountId: utilitiesAccountId, period: '2024', budgetAmount: 200000, actualAmount: 45000 },
            { accountId: createdAccounts['7400'], period: '2024', budgetAmount: 300000, actualAmount: 125000 },
            { accountId: createdAccounts['7500'], period: '2024', budgetAmount: 500000, actualAmount: 0 },
            { accountId: socialChargesId, period: '2024', budgetAmount: 400000, actualAmount: 106250 },
          ],
        },
      },
    })

    // 11. Create Fixed Assets
    // INTEGRATION: Fixed Assets → GL
    const fixedAssets = await Promise.all([
      db.fixedAsset.create({
        data: {
          assetCode: 'FA-001',
          name: 'Dell PowerEdge Server',
          category: 'IT Equipment',
          purchaseDate: new Date('2024-07-01'),
          purchaseCost: 500000,
          usefulLife: 60,
          salvageValue: 50000,
          depreciationMethod: 'straight_line',
          locationId: locations[0].id,
          projectId: projects[0].id,
          supplierId: suppliers[1].id,
          isDonorFunded: false,
          status: 'active',
          netBookValue: 500000,
        },
      }),
      db.fixedAsset.create({
        data: {
          assetCode: 'FA-002',
          name: 'Toyota Hilux - Field Vehicle',
          category: 'Vehicles',
          purchaseDate: new Date('2024-07-01'),
          purchaseCost: 4500000,
          usefulLife: 120,
          salvageValue: 500000,
          depreciationMethod: 'straight_line',
          locationId: locations[2].id,
          projectId: projects[1].id,
          isDonorFunded: false,
          status: 'active',
          netBookValue: 4500000,
        },
      }),
      db.fixedAsset.create({
        data: {
          assetCode: 'FA-003',
          name: 'Office Furniture Set',
          category: 'Furniture & Fixtures',
          purchaseDate: new Date('2024-07-01'),
          purchaseCost: 800000,
          usefulLife: 120,
          salvageValue: 50000,
          depreciationMethod: 'straight_line',
          locationId: locations[0].id,
          isDonorFunded: false,
          status: 'active',
          netBookValue: 800000,
        },
      }),
      db.fixedAsset.create({
        data: {
          assetCode: 'FA-004',
          name: 'Laptop Computers (Donor Funded)',
          category: 'IT Equipment',
          purchaseDate: new Date('2024-08-01'),
          purchaseCost: 1200000,
          usefulLife: 48,
          salvageValue: 0,
          depreciationMethod: 'straight_line',
          locationId: locations[0].id,
          projectId: projects[0].id,
          donorId: donors[0].id,
          isDonorFunded: true, // INTEGRATION: Donor-funded assets - zero depreciation
          status: 'active',
          netBookValue: 1200000,
        },
      }),
    ])

    // 12. Create Payroll Batches (Integration Reference)
    // INTEGRATION: Payroll → GL
    const payrollBatch = await db.payrollBatch.create({
      data: {
        batchNumber: 'PAYROLL-2024-07',
        period: '2024-07',
        totalGross: 850000,
        totalDeductions: 127500,
        totalNetPay: 722500,
        totalEmployerCharges: 106250,
        status: 'posted',
        postedToGL: true,
        postedVoucherId: voucher3.id,
        lines: {
          create: [
            { employeeName: 'Ahmed Ali', employeeId: 'EMP-001', grossSalary: 150000, incomeTax: 15000, eobiDeduction: 2000, providentFund: 7500, netPay: 125500, employerEOBI: 2000, employerPF: 7500, department: 'Finance' },
            { employeeName: 'Fatima Khan', employeeId: 'EMP-002', grossSalary: 120000, incomeTax: 12000, eobiDeduction: 2000, providentFund: 6000, netPay: 100000, employerEOBI: 2000, employerPF: 6000, projectId: projects[0].id, department: 'Programs' },
            { employeeName: 'Hassan Raza', employeeId: 'EMP-003', grossSalary: 95000, incomeTax: 9500, eobiDeduction: 2000, providentFund: 4750, netPay: 78750, employerEOBI: 2000, employerPF: 4750, projectId: projects[1].id, department: 'Healthcare' },
          ],
        },
      },
    })

    // 13. Create sample Audit Logs
    await db.auditLog.createMany({
      data: [
        { userId: 'system', action: 'CREATE', entity: 'Voucher', entityId: voucher1.id, details: 'Created Bank Receipt BR-2024-001' },
        { userId: 'system', action: 'APPROVE', entity: 'Voucher', entityId: voucher1.id, details: 'Approved Bank Receipt BR-2024-001' },
        { userId: 'system', action: 'CREATE', entity: 'Voucher', entityId: voucher3.id, details: 'Created via Payroll Integration - BP-2024-001' },
        { userId: 'system', action: 'CREATE', entity: 'Voucher', entityId: voucher4.id, details: 'Created Payroll Accruals - JV-2024-001' },
      ],
    })

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        financialYear: fy.name,
        accounts: accountData.length,
        projects: projects.length,
        donors: donors.length,
        locations: locations.length,
        customers: customers.length,
        suppliers: suppliers.length,
        taxRates: taxRates.length,
        vouchers: 9,
        fixedAssets: fixedAssets.length,
        payrollBatches: 1,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

function findParentId(code: string, accounts: { code: string; level: number }[], createdAccounts: Record<string, string>): string | undefined {
  // Simple parent logic: remove last digit or segment to find parent
  const level = accounts.find(a => a.code === code)?.level ?? 0
  if (level <= 0) return undefined

  // For level 1 accounts, parent is the level 0 account with matching first digit
  // For level 2+, progressively match shorter codes
  const parentCode = code.slice(0, -1)
  const parent = accounts.find(a => a.code === parentCode && a.level < level)
  if (parent && createdAccounts[parent.code]) {
    return createdAccounts[parent.code]
  }

  // Try finding any parent with matching prefix at one level up
  for (let l = level - 1; l >= 0; l--) {
    const prefixLen = code.length - (level - l)
    const prefix = code.slice(0, Math.max(1, prefixLen))
    const potentialParent = accounts.find(a => a.level === l && a.code.startsWith(prefix) && a.code.length < code.length)
    if (potentialParent && createdAccounts[potentialParent.code]) {
      return createdAccounts[potentialParent.code]
    }
  }

  return undefined
}
