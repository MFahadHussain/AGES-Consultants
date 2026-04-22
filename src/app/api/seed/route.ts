import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// Seed endpoint: Replaces the entire Chart of Accounts with
// a comprehensive Pakistani NGO/Development Organization COA.
// Also ensures a default open Financial Year exists.
// ============================================================

interface COAAccount {
  code: string
  name: string
  accountType: string
  subType: string | null
  parentId: string | null
  level: number
  allowPosting: boolean
  isSystem: boolean
  description: string | null
}

const NEW_COA: COAAccount[] = [
  // ═══════════════════════════════════════════════════════════
  // 1. ASSETS
  // ═══════════════════════════════════════════════════════════
  { code: '1000', name: 'Assets', accountType: 'ASSET', subType: null, parentId: null, level: 0, allowPosting: false, isSystem: true, description: 'Total Assets' },
    { code: '1100', name: 'Current Assets', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 1, allowPosting: false, isSystem: true, description: 'Assets expected to be realized within 12 months' },
      // 1.1 Cash & Cash Equivalents
      { code: '1110', name: 'Cash & Cash Equivalents', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 2, allowPosting: false, isSystem: true, description: null },
        { code: '1111', name: 'Cash in Hand', accountType: 'ASSET', subType: 'CASH', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Physical cash on hand at head office' },
        { code: '1112', name: 'Petty Cash', accountType: 'ASSET', subType: 'CASH', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Petty cash fund for minor expenses' },
      // 1.2 Bank Accounts
      { code: '1120', name: 'Bank Accounts', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 2, allowPosting: false, isSystem: true, description: null },
        { code: '1121', name: 'Meezan Bank - Main', accountType: 'ASSET', subType: 'BANK', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Meezan Bank Islamic Banking - Main Operating Account' },
        { code: '1122', name: 'HBL - Operating', accountType: 'ASSET', subType: 'BANK', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Habib Bank Limited - Operating Account' },
        { code: '1123', name: 'ABL - Main', accountType: 'ASSET', subType: 'BANK', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Allied Bank Limited - Main Account' },
      // 1.3 Short-Term Investments
      { code: '1130', name: 'Short-Term Investments', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Short-term investment instruments' },
      // 1.4 Accounts Receivable
      { code: '1200', name: 'Accounts Receivable', accountType: 'ASSET', subType: 'RECEIVABLE', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Amounts due from third parties' },
        { code: '1210', name: 'Grants Receivable', accountType: 'ASSET', subType: 'RECEIVABLE', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Grant amounts due from donors' },
        { code: '1220', name: 'Employee Advances', accountType: 'ASSET', subType: 'RECEIVABLE', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Salary advances and loans to employees' },
        { code: '1230', name: 'Other Receivables', accountType: 'ASSET', subType: 'RECEIVABLE', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Other amounts receivable' },
      // 1.5 Prepayments & Advances
      { code: '1250', name: 'Prepayments & Advances', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 2, allowPosting: false, isSystem: true, description: null },
        { code: '1251', name: 'Prepaid Rent', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Rent paid in advance' },
        { code: '1252', name: 'Prepaid Insurance', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Insurance premiums paid in advance' },
        { code: '1253', name: 'Advance to Suppliers', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Payments made in advance to suppliers' },
        { code: '1254', name: 'Advance Tax', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Tax paid in advance' },
      // 1.6 Inventory
      { code: '1280', name: 'Inventory', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 2, allowPosting: false, isSystem: true, description: null },
        { code: '1281', name: 'Office Supplies Inventory', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Stock of office supplies on hand' },

  // 1.7 Property, Plant & Equipment
  { code: '1500', name: 'Property, Plant & Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', parentId: null, level: 1, allowPosting: false, isSystem: true, description: 'Tangible non-current assets' },
    { code: '1510', name: 'Land', accountType: 'ASSET', subType: 'FIXED_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Land owned by the organization' },
    { code: '1515', name: 'Buildings', accountType: 'ASSET', subType: 'FIXED_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Buildings owned by the organization' },
    { code: '1520', name: 'Vehicles', accountType: 'ASSET', subType: 'FIXED_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Motor vehicles owned by the organization' },
    { code: '1525', name: 'Furniture & Fixtures', accountType: 'ASSET', subType: 'FIXED_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Furniture and fixtures' },
    { code: '1530', name: 'Office Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Office equipment including ACs, photocopiers, etc.' },
    { code: '1535', name: 'IT Assets', accountType: 'ASSET', subType: 'FIXED_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Computers, servers, networking equipment' },
    { code: '1540', name: 'Machinery', accountType: 'ASSET', subType: 'FIXED_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Machinery and generators' },
    { code: '1545', name: 'Other Fixed Assets', accountType: 'ASSET', subType: 'FIXED_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Other tangible fixed assets not classified elsewhere' },
    { code: '1550', name: 'Capital Work in Progress', accountType: 'ASSET', subType: 'FIXED_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Assets under construction' },

  // 1.8 Accumulated Depreciation (contra-asset)
  { code: '1600', name: 'Accumulated Depreciation', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentId: null, level: 1, allowPosting: false, isSystem: true, description: 'Total accumulated depreciation on fixed assets' },
    { code: '1610', name: 'Acc Dep - Buildings', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
    { code: '1620', name: 'Acc Dep - Vehicles', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
    { code: '1630', name: 'Acc Dep - Furniture', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
    { code: '1640', name: 'Acc Dep - Office Equipment', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
    { code: '1650', name: 'Acc Dep - IT Assets', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
    { code: '1660', name: 'Acc Dep - Machinery', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
    { code: '1670', name: 'Acc Dep - Other Fixed Assets', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },

  // 1.9 Other Non-Current Assets
  { code: '1800', name: 'Other Non-Current Assets', accountType: 'ASSET', subType: 'NON_CURRENT_ASSET', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
    { code: '1810', name: 'Security Deposits', accountType: 'ASSET', subType: 'NON_CURRENT_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Deposits paid as security' },
    { code: '1820', name: 'Intangible Assets', accountType: 'ASSET', subType: 'NON_CURRENT_ASSET', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Software licenses, patents, etc.' },

  // ═══════════════════════════════════════════════════════════
  // 2. LIABILITIES
  // ═══════════════════════════════════════════════════════════
  { code: '2000', name: 'Liabilities', accountType: 'LIABILITY', subType: null, parentId: null, level: 0, allowPosting: false, isSystem: true, description: 'Total Liabilities' },
    { code: '2100', name: 'Current Liabilities', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 1, allowPosting: false, isSystem: true, description: 'Liabilities due within 12 months' },
      // 2.1 Accounts Payable
      { code: '2110', name: 'Accounts Payable', accountType: 'LIABILITY', subType: 'PAYABLE', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Amounts owed to suppliers and vendors' },
      // 2.2 Accrued Liabilities
      { code: '2120', name: 'Accrued Liabilities', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Expenses incurred but not yet paid' },
      // 2.3 Short-Term Borrowings
      { code: '2130', name: 'Short-Term Borrowings', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Short-term loans payable' },
      // 2.4 Payroll Liabilities
      { code: '2200', name: 'Payroll Liabilities', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 2, allowPosting: false, isSystem: true, description: null },
        { code: '2210', name: 'Salary Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Net salary payable to employees' },
        { code: '2220', name: 'Income Tax Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Income tax deducted at source (FBR)' },
        { code: '2230', name: 'EOBI Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Employees Old-Age Benefits Institution dues' },
        { code: '2240', name: 'Provident Fund Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Provident fund contributions payable' },
        { code: '2250', name: 'Staff Welfare Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Staff welfare fund payable' },
      // 2.5 Grant Liabilities
      { code: '2300', name: 'Grant Liabilities', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 2, allowPosting: false, isSystem: true, description: null },
        { code: '2310', name: 'Deferred Grant Income', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Grant funds received but not yet recognized as income' },
        { code: '2320', name: 'Unspent Grant Funds', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Grant funds received but not yet spent' },
      // 2.6 Other Current Liabilities
      { code: '2400', name: 'Other Current Liabilities', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 2, allowPosting: false, isSystem: true, description: null },
        { code: '2410', name: 'Advance from Donors', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Advance payments received from donors' },
        { code: '2420', name: 'TDS Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'Tax deducted at source payable' },
        { code: '2430', name: 'GST Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentId: null, level: 3, allowPosting: true, isSystem: true, description: 'General Sales Tax payable' },
    // 2.7 Non-Current Liabilities
    { code: '2600', name: 'Non-Current Liabilities', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '2610', name: 'Long-Term Borrowings', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Loans payable after 12 months' },
      { code: '2620', name: 'Endowment Liability', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Endowment fund liability' },

  // ═══════════════════════════════════════════════════════════
  // 3. EQUITY
  // ═══════════════════════════════════════════════════════════
  { code: '3000', name: 'Equity', accountType: 'EQUITY', subType: null, parentId: null, level: 0, allowPosting: false, isSystem: true, description: 'Total Equity / Net Assets' },
    { code: '3100', name: 'General Fund', accountType: 'EQUITY', subType: 'GENERAL_FUND', parentId: null, level: 1, allowPosting: true, isSystem: true, description: 'Unrestricted / general fund' },
    { code: '3200', name: 'Accumulated Surplus / (Deficit)', accountType: 'EQUITY', subType: 'ACCUMULATED_SURPLUS', parentId: null, level: 1, allowPosting: true, isSystem: true, description: 'Retained earnings / accumulated surplus or deficit' },
    { code: '3300', name: 'Revaluation Reserve', accountType: 'EQUITY', subType: 'REVALUATION_RESERVE', parentId: null, level: 1, allowPosting: true, isSystem: true, description: 'Surplus from revaluation of fixed assets' },
    { code: '3400', name: 'Restricted Funds', accountType: 'EQUITY', subType: 'RESTRICTED_FUND', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '3410', name: 'Donor-Restricted Fund', accountType: 'EQUITY', subType: 'RESTRICTED_FUND', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Funds restricted by donor conditions' },
      { code: '3420', name: 'Endowment Fund', accountType: 'EQUITY', subType: 'ENDOWMENT_FUND', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Permanently restricted endowment fund' },

  // ═══════════════════════════════════════════════════════════
  // 4. INCOME
  // ═══════════════════════════════════════════════════════════
  { code: '4000', name: 'Income', accountType: 'INCOME', subType: null, parentId: null, level: 0, allowPosting: false, isSystem: true, description: 'Total Income' },
    // 4.1 Grant Income
    { code: '4100', name: 'Grant Income', accountType: 'INCOME', subType: 'GRANT_INCOME', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '4110', name: 'International Grants', accountType: 'INCOME', subType: 'GRANT_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Grants from international donors (USAID, EU, DFID, etc.)' },
      { code: '4120', name: 'Domestic Grants', accountType: 'INCOME', subType: 'GRANT_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Grants from domestic sources' },
      { code: '4130', name: 'Government Grants', accountType: 'INCOME', subType: 'GRANT_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Grants from federal/provincial government' },
    // 4.2 Donation Income
    { code: '4200', name: 'Donation Income', accountType: 'INCOME', subType: 'DONATION_INCOME', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '4210', name: 'Zakat & Sadaqat', accountType: 'INCOME', subType: 'DONATION_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Zakat and Sadaqat contributions' },
      { code: '4220', name: 'General Donations', accountType: 'INCOME', subType: 'DONATION_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Unrestricted donations' },
      { code: '4230', name: 'Corporate Donations', accountType: 'INCOME', subType: 'DONATION_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Donations from corporate entities' },
    // 4.3 Program Income
    { code: '4300', name: 'Program Income', accountType: 'INCOME', subType: 'PROGRAM_INCOME', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '4310', name: 'Service Fees', accountType: 'INCOME', subType: 'PROGRAM_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Fees from services rendered' },
      { code: '4320', name: 'Training Fees', accountType: 'INCOME', subType: 'PROGRAM_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Income from training programs' },
      { code: '4330', name: 'Membership Fees', accountType: 'INCOME', subType: 'PROGRAM_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Membership subscription income' },
    // 4.4 Other Income
    { code: '4400', name: 'Other Income', accountType: 'INCOME', subType: 'OTHER_INCOME', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '4410', name: 'Interest Income', accountType: 'INCOME', subType: 'OTHER_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Interest earned on bank deposits' },
      { code: '4420', name: 'Gain on Foreign Exchange', accountType: 'INCOME', subType: 'OTHER_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Foreign exchange gains' },
      { code: '4430', name: 'Gain on Disposal of Assets', accountType: 'INCOME', subType: 'GAIN_ON_DISPOSAL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Gain from sale of fixed assets' },
      { code: '4440', name: 'Sundry Income', accountType: 'INCOME', subType: 'OTHER_INCOME', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Other miscellaneous income' },

  // ═══════════════════════════════════════════════════════════
  // 5. EXPENSES
  // ═══════════════════════════════════════════════════════════
  { code: '5000', name: 'Expenses', accountType: 'EXPENSE', subType: null, parentId: null, level: 0, allowPosting: false, isSystem: true, description: 'Total Expenses' },
    // 5.1 Personnel Costs
    { code: '5100', name: 'Personnel Costs', accountType: 'EXPENSE', subType: 'PERSONNEL', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '5110', name: 'Salaries & Wages', accountType: 'EXPENSE', subType: 'SALARY', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Gross salary and wage expense' },
      { code: '5120', name: 'Overtime & Allowances', accountType: 'EXPENSE', subType: 'SALARY', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Overtime payments and allowances' },
      { code: '5130', name: 'Medical Benefits', accountType: 'EXPENSE', subType: 'PERSONNEL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Medical insurance and benefits' },
      { code: '5140', name: 'Staff Welfare', accountType: 'EXPENSE', subType: 'PERSONNEL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Staff welfare expenses' },
    // 5.2 Employer Social Charges
    { code: '5200', name: 'Employer Social Charges', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '5210', name: 'Employer EOBI Contribution', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentId: null, level: 2, allowPosting: true, isSystem: true, description: "Employer's EOBI contribution" },
      { code: '5220', name: 'Employer Provident Fund', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentId: null, level: 2, allowPosting: true, isSystem: true, description: "Employer's provident fund contribution" },
      { code: '5230', name: 'Employer Social Security', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentId: null, level: 2, allowPosting: true, isSystem: true, description: "Employer's social security contribution" },
    // 5.3 Travel & Transportation
    { code: '5300', name: 'Travel & Transportation', accountType: 'EXPENSE', subType: 'TRAVEL', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '5310', name: 'Domestic Travel', accountType: 'EXPENSE', subType: 'TRAVEL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Domestic travel and related expenses' },
      { code: '5320', name: 'International Travel', accountType: 'EXPENSE', subType: 'TRAVEL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'International travel and related expenses' },
      { code: '5330', name: 'Vehicle Running & Maintenance', accountType: 'EXPENSE', subType: 'TRAVEL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Fuel, repairs, and maintenance of vehicles' },
      { code: '5340', name: 'Conveyance Allowance', accountType: 'EXPENSE', subType: 'TRAVEL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Daily conveyance allowance' },
    // 5.4 Office Expenses
    { code: '5400', name: 'Office Expenses', accountType: 'EXPENSE', subType: 'OFFICE', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '5410', name: 'Rent Expense', accountType: 'EXPENSE', subType: 'OFFICE', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Office and building rent' },
      { code: '5420', name: 'Utilities Expense', accountType: 'EXPENSE', subType: 'OFFICE', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Electricity, gas, water, and telephone' },
      { code: '5430', name: 'Office Supplies', accountType: 'EXPENSE', subType: 'OFFICE', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Consumable office supplies' },
      { code: '5440', name: 'Printing & Stationery', accountType: 'EXPENSE', subType: 'OFFICE', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Printing and stationery costs' },
      { code: '5450', name: 'Communication Expense', accountType: 'EXPENSE', subType: 'OFFICE', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Telephone, internet, and postage' },
      { code: '5460', name: 'Insurance Expense', accountType: 'EXPENSE', subType: 'OFFICE', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Insurance premiums (non-employee)' },
    // 5.5 Professional & Consultancy Fees
    { code: '5500', name: 'Professional & Consultancy Fees', accountType: 'EXPENSE', subType: 'PROFESSIONAL', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '5510', name: 'Audit Fee', accountType: 'EXPENSE', subType: 'PROFESSIONAL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'External audit fees' },
      { code: '5520', name: 'Legal Fee', accountType: 'EXPENSE', subType: 'PROFESSIONAL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Legal consultation and litigation' },
      { code: '5530', name: 'Consultancy Fee', accountType: 'EXPENSE', subType: 'PROFESSIONAL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Technical and management consultancy' },
    // 5.6 Depreciation & Amortization
    { code: '5600', name: 'Depreciation & Amortization', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentId: null, level: 1, allowPosting: false, isSystem: true, description: 'Depreciation and amortization expense' },
      { code: '5610', name: 'Depreciation - Buildings', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
      { code: '5620', name: 'Depreciation - Vehicles', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
      { code: '5630', name: 'Depreciation - Furniture', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
      { code: '5640', name: 'Depreciation - Office Equipment', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
      { code: '5650', name: 'Depreciation - IT Assets', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
      { code: '5660', name: 'Depreciation - Machinery', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
      { code: '5670', name: 'Amortization - Intangibles', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentId: null, level: 2, allowPosting: true, isSystem: true, description: null },
    // 5.7 Program Expenses
    { code: '5700', name: 'Program Expenses', accountType: 'EXPENSE', subType: 'PROGRAM', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '5710', name: 'Project Direct Costs', accountType: 'EXPENSE', subType: 'PROGRAM', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Direct costs for project activities' },
      { code: '5720', name: 'Training & Workshop Expenses', accountType: 'EXPENSE', subType: 'PROGRAM', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Training, workshops, and capacity building' },
      { code: '5730', name: 'Community Development Expenses', accountType: 'EXPENSE', subType: 'PROGRAM', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Community outreach and development' },
    // 5.8 Bank Charges & Financial Costs
    { code: '5800', name: 'Bank Charges & Financial Costs', accountType: 'EXPENSE', subType: 'FINANCIAL', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '5810', name: 'Bank Charges', accountType: 'EXPENSE', subType: 'FINANCIAL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Bank service charges and fees' },
      { code: '5820', name: 'Loss on Foreign Exchange', accountType: 'EXPENSE', subType: 'FINANCIAL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Foreign exchange losses' },
      { code: '5830', name: 'Interest Expense', accountType: 'EXPENSE', subType: 'FINANCIAL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Interest paid on borrowings' },
    // 5.9 Other Expenses
    { code: '5900', name: 'Other Expenses', accountType: 'EXPENSE', subType: 'OTHER_EXPENSE', parentId: null, level: 1, allowPosting: false, isSystem: true, description: null },
      { code: '5910', name: 'Loss on Disposal of Assets', accountType: 'EXPENSE', subType: 'LOSS_ON_DISPOSAL', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Loss from sale/disposal of fixed assets' },
      { code: '5920', name: 'Write-Off Expenses', accountType: 'EXPENSE', subType: 'OTHER_EXPENSE', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Bad debts and write-offs' },
      { code: '5930', name: 'Sundry Expenses', accountType: 'EXPENSE', subType: 'OTHER_EXPENSE', parentId: null, level: 2, allowPosting: true, isSystem: true, description: 'Other miscellaneous expenses' },
]

export async function GET() {
  try {
    // ═══════════════════════════════════════════════════════════
    // STEP 1: Delete ALL existing data in dependency order
    // ═══════════════════════════════════════════════════════════

    // Level 1: Leaf/child tables with no outgoing FKs
    await db.voucherEntry.deleteMany()
    await db.voucherApproval.deleteMany()
    await db.voucherAttachment.deleteMany()
    await db.bankReconciliationItem.deleteMany()
    await db.bankStatementItem.deleteMany()
    await db.bankStatement.deleteMany()
    await db.bankReconciliation.deleteMany()
    await db.budgetLine.deleteMany()
    await db.fixedAssetDepreciation.deleteMany()
    await db.assetTransaction.deleteMany()
    await db.fAMSJournal.deleteMany()
    await db.fAMSExportBatch.deleteMany()
    await db.payrollBatchLine.deleteMany()
    await db.taxCalculation.deleteMany()
    await db.accountBalance.deleteMany()

    // Level 2: Mid-level tables
    await db.voucher.deleteMany()
    await db.budget.deleteMany()
    await db.fixedAsset.deleteMany()
    await db.payrollBatch.deleteMany()
    await db.taxRate.deleteMany()
    await db.fAMSSetting.deleteMany()
    await db.fAMSFiscalYear.deleteMany()

    // Level 3: Master data tables
    await db.customer.deleteMany()
    await db.supplier.deleteMany()
    await db.project.deleteMany()
    await db.donor.deleteMany()
    await db.location.deleteMany()
    await db.client.deleteMany()
    await db.importLog.deleteMany()
    await db.exportLog.deleteMany()
    await db.auditLog.deleteMany()

    // Level 4: Account hierarchy (children first, then parents)
    await db.account.deleteMany()

    // ═══════════════════════════════════════════════════════════
    // STEP 2: Create the new Chart of Accounts
    // ═══════════════════════════════════════════════════════════

    // First pass: create all accounts without parent references
    // (we'll link parents in a second pass)
    const codeToIdMap: Record<string, string> = {}

    for (const acc of NEW_COA) {
      const account = await db.account.create({
        data: {
          code: acc.code,
          name: acc.name,
          accountType: acc.accountType,
          subType: acc.subType,
          level: acc.level,
          allowPosting: acc.allowPosting,
          isSystem: acc.isSystem,
          isActive: true,
          description: acc.description,
          openingBalance: 0,
        },
      })
      codeToIdMap[acc.code] = account.id
    }

    // Second pass: update parent references
    for (const acc of NEW_COA) {
      if (acc.parentId !== null) continue // already handled

      // Infer parent from code pattern:
      // 4-digit code with trailing zeros → find parent by shorter prefix
      // e.g., 1110 → parent is 1100, 1121 → parent is 1120
      const inferredParent = inferParentCode(acc.code)
      if (inferredParent && codeToIdMap[inferredParent]) {
        await db.account.update({
          where: { id: codeToIdMap[acc.code] },
          data: { parentId: codeToIdMap[inferredParent] },
        })
      }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 2b: Create sample segment data (Projects, Clients, Donors, Locations)
    // ═══════════════════════════════════════════════════════════

    // Donors
    const donor1 = await db.donor.create({ data: { code: 'DON-001', name: 'USAID Pakistan', contactPerson: 'Sarah Johnson', email: 'sarah.johnson@usaid.gov', phone: '+1-202-712-0000', address: 'U.S. Embassy, Islamabad' } })
    const donor2 = await db.donor.create({ data: { code: 'DON-002', name: 'European Union Delegation', contactPerson: 'Marc Dupont', email: 'marc.dupont@eeas.europa.eu', phone: '+32-2-584-0000', address: 'EU Delegation, Islamabad' } })
    const donor3 = await db.donor.create({ data: { code: 'DON-003', name: 'UNDP Pakistan', contactPerson: 'Ahmed Khan', email: 'ahmed.khan@undp.org', phone: '+92-51-835-5000', address: 'UN House, Serena Business Complex, Islamabad' } })
    const donor4 = await db.donor.create({ data: { code: 'DON-004', name: 'DFID (FCDO)', contactPerson: 'Emily Clarke', email: 'emily.clarke@fcdo.gov.uk', phone: '+44-20-7008-5000', address: 'British High Commission, Islamabad' } })

    // Clients
    const client1 = await db.client.create({ data: { code: 'CLI-001', name: 'Government of Punjab', contactPerson: 'Rana Mashhood', email: 'info@punjab.gov.pk', phone: '+92-42-9921-0000', address: 'Civil Secretariat, Lahore', industry: 'Government', taxNumber: 'NTN-1234567-1', isActive: true } })
    const client2 = await db.client.create({ data: { code: 'CLI-002', name: 'UNICEF Pakistan', contactPerson: 'Aida Girma', email: 'aida.girma@unicef.org', phone: '+92-51-227-0000', address: 'UNICEF House, Islamabad', industry: 'NGO', taxNumber: 'NTN-7654321-2', isActive: true } })
    const client3 = await db.client.create({ data: { code: 'CLI-003', name: 'World Health Organization', contactPerson: 'Dr. Palitha Mahipala', email: 'mahipala@who.int', phone: '+92-51-926-0000', address: 'WHO Office, Islamabad', industry: 'NGO', taxNumber: 'NTN-9876543-3', isActive: true } })
    const client4 = await db.client.create({ data: { code: 'CLI-004', name: 'Engro Foundation', contactPerson: 'Favad Soomro', email: 'favad.soomro@engro.com', phone: '+92-21-111-364-776', address: 'Engro Tower, Karachi', industry: 'Corporate', taxNumber: 'NTN-5555555-4', isActive: true } })

    // Locations
    const loc1 = await db.location.create({ data: { code: 'LOC-ISB', name: 'Islamabad', address: 'Federal Capital Territory' } })
    const loc2 = await db.location.create({ data: { code: 'LOC-LHR', name: 'Lahore', address: 'Punjab Province' } })
    const loc3 = await db.location.create({ data: { code: 'LOC-KHI', name: 'Karachi', address: 'Sindh Province' } })
    const loc4 = await db.location.create({ data: { code: 'LOC-PESH', name: 'Peshawar', address: 'KPK Province' } })
    const loc5 = await db.location.create({ data: { code: 'LOC-QTA', name: 'Quetta', address: 'Balochistan Province' } })

    // Projects (client/donor/location associations are at voucher level)
    const proj1 = await db.project.create({ data: { code: 'PRJ-001', name: 'Education Enhancement Program', description: 'Improving quality of education in rural Punjab', startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'), status: 'active' } })
    const proj2 = await db.project.create({ data: { code: 'PRJ-002', name: 'Health & Nutrition Initiative', description: 'Maternal and child health program in Sindh', startDate: new Date('2025-08-01'), endDate: new Date('2026-12-31'), status: 'active' } })
    const proj3 = await db.project.create({ data: { code: 'PRJ-003', name: 'WASH Program KPK', description: 'Water, sanitation and hygiene in KPK', startDate: new Date('2025-09-01'), endDate: new Date('2026-08-31'), status: 'active' } })
    const proj4 = await db.project.create({ data: { code: 'PRJ-004', name: 'Livelihood Support Balochistan', description: 'Skills training and livelihood in Balochistan', startDate: new Date('2025-10-01'), endDate: new Date('2027-03-31'), status: 'active' } })
    const proj5 = await db.project.create({ data: { code: 'PRJ-005', name: 'Capacity Building Islamabad', description: 'Institutional capacity building at HQ level', startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'), status: 'active' } })
    const proj6 = await db.project.create({ data: { code: 'PRJ-006', name: 'COVID-19 Response', description: 'Pandemic response and vaccination support', startDate: new Date('2024-01-01'), endDate: new Date('2025-06-30'), status: 'completed' } })

    // ═══════════════════════════════════════════════════════════
    // STEP 3: Ensure open Financial Year exists
    // ═══════════════════════════════════════════════════════════
    let financialYearName: string | null = null
    const openFY = await db.financialYear.findFirst({ where: { status: 'open' } })
    if (!openFY) {
      const newFY = await db.financialYear.create({
        data: {
          name: 'FY 2025-26',
          startDate: new Date('2025-07-01'),
          endDate: new Date('2026-06-30'),
          status: 'open',
        },
      })
      financialYearName = newFY.name
    } else {
      financialYearName = openFY.name
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 4: Validation — no duplicates, no legacy accounts
    // ═══════════════════════════════════════════════════════════
    const allAccounts = await db.account.findMany({ orderBy: { code: 'asc' } })
    const codes = allAccounts.map(a => a.code)
    const duplicateCodes = codes.filter((c, i) => codes.indexOf(c) !== i)

    if (duplicateCodes.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Duplicate account codes found: ${duplicateCodes.join(', ')}`,
      }, { status: 500 })
    }

    // Verify all new COA codes are present
    const expectedCodes = NEW_COA.map(a => a.code)
    const missingCodes = expectedCodes.filter(c => !codes.includes(c))

    if (missingCodes.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing account codes: ${missingCodes.join(', ')}`,
      }, { status: 500 })
    }

    // Verify no legacy-only codes remain (old codes not in new COA)
    const legacyCodes = codes.filter(c => !expectedCodes.includes(c))
    if (legacyCodes.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Legacy account codes still present: ${legacyCodes.join(', ')}`,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Chart of Accounts replaced successfully. All transactional data cleared.',
      coa: {
        totalAccounts: allAccounts.length,
        assets: allAccounts.filter(a => a.accountType === 'ASSET').length,
        liabilities: allAccounts.filter(a => a.accountType === 'LIABILITY').length,
        equity: allAccounts.filter(a => a.accountType === 'EQUITY').length,
        income: allAccounts.filter(a => a.accountType === 'INCOME').length,
        expenses: allAccounts.filter(a => a.accountType === 'EXPENSE').length,
        postingAccounts: allAccounts.filter(a => a.allowPosting).length,
        systemAccounts: allAccounts.filter(a => a.isSystem).length,
      },
      preserved: {
        financialYears: await db.financialYear.count(),
        users: await db.user.count(),
        openFinancialYear: financialYearName,
      },
      validation: {
        duplicates: duplicateCodes.length,
        missing: missingCodes.length,
        legacy: legacyCodes.length,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

/**
 * Infer parent account code from child code.
 * e.g., 1121 → 1120, 1120 → 1100, 1100 → 1000, 1110 → 1100
 */
function inferParentCode(code: string): string | null {
  // Top-level: no parent
  if (code === '1000' || code === '2000' || code === '3000' || code === '4000' || code === '5000') {
    return null
  }

  // 4-digit codes: try progressive shortening
  // e.g., 1121 → try 1120, then 1100, then 1000
  // e.g., 1110 → try 1100, then 1000

  // Try: replace last digit with 0
  if (code.length === 4 && code[3] !== '0') {
    const candidate = code.slice(0, 3) + '0'
    // Check if this candidate is in our COA
    if (NEW_COA.some(a => a.code === candidate)) {
      return candidate
    }
  }

  // Try: replace last two digits with 00
  if (code.length === 4 && code.slice(2) !== '00') {
    const candidate = code.slice(0, 2) + '00'
    if (NEW_COA.some(a => a.code === candidate)) {
      return candidate
    }
  }

  // Try: first digit + '000'
  if (code.length === 4 && code[0] !== '0') {
    const candidate = code[0] + '000'
    if (NEW_COA.some(a => a.code === candidate)) {
      return candidate
    }
  }

  return null
}
