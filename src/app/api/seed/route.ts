import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// Seed endpoint: AGES Consultants ERP v1.0.0 — Partnership Firm COA
// Comprehensive Chart of Accounts for a multi-project hydropower
// consulting firm. All figures in PKR.
// ============================================================

interface COAAccount {
  code: string
  name: string
  accountType: string
  subType: string | null
  parentCode: string | null
  level: number
  allowPosting: boolean
  isSystem: boolean
  description: string | null
}

const NEW_COA: COAAccount[] = [
  // ═══════════════════════════════════════════════════════════
  // 01. ASSETS
  // ═══════════════════════════════════════════════════════════
  { code: '01', name: 'Assets', accountType: 'ASSET', subType: null, parentCode: null, level: 0, allowPosting: false, isSystem: true, description: 'Total Assets' },

    // ── 01-01 Non-Current Assets ──
    { code: '01-01', name: 'Non-Current Assets', accountType: 'ASSET', subType: null, parentCode: '01', level: 1, allowPosting: false, isSystem: true, description: 'Assets not expected to be realized within 12 months' },

      // 01-01-01 Intangible Assets
      { code: '01-01-01', name: 'Intangible Assets', accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', parentCode: '01-01', level: 2, allowPosting: false, isSystem: true, description: 'Software licenses and intangible assets' },
        { code: '01-01-01-0001', name: 'Turbon Pro', accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', parentCode: '01-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Turbon Pro software license' },
        { code: '01-01-01-0002', name: 'CivilStrips', accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', parentCode: '01-01-01', level: 3, allowPosting: true, isSystem: true, description: 'CivilStrips software license' },
        { code: '01-01-01-0003', name: 'Hydrohelp 2.6', accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', parentCode: '01-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Hydrohelp 2.6 software license' },

      // 01-01-02 Tangible Assets (PPE)
      { code: '01-01-02', name: 'Tangible Assets', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01', level: 2, allowPosting: false, isSystem: true, description: 'Property, Plant & Equipment' },
        { code: '01-01-02-0001', name: 'Electrical Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Electrical equipment at cost' },
        { code: '01-01-02-0002', name: 'Office Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Office equipment at cost' },
        { code: '01-01-02-0003', name: 'Vehicle', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Motor vehicles at cost' },
        { code: '01-01-02-0004', name: 'Furniture', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Furniture at cost' },
        { code: '01-01-02-0005', name: 'Fixtures', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Fixtures at cost' },
        { code: '01-01-02-0006', name: 'Computer Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01-02', level: 3, allowPosting: true, isSystem: true, description: 'IT hardware and computer equipment at cost' },
        { code: '01-01-02-0007', name: 'Land', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Land at cost' },
        { code: '01-01-02-0008', name: 'Building', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Buildings at cost' },
        { code: '01-01-02-0009', name: 'Geo tech Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Geotechnical equipment at cost' },
        { code: '01-01-02-0010', name: 'Survey Equipments', accountType: 'ASSET', subType: 'FIXED_ASSET', parentCode: '01-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Survey equipment at cost' },

      // 01-01-03 Accumulated Depreciation
      { code: '01-01-03', name: 'Accumulated Depreciation', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01', level: 2, allowPosting: false, isSystem: true, description: 'Total accumulated depreciation on tangible assets' },
        { code: '01-01-03-0001', name: 'Acc Dep - Electrical Equipment', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-03-0002', name: 'Acc Dep - Office Equipment', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-03-0003', name: 'Acc Dep - Vehicle', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-03-0004', name: 'Acc Dep - Furniture', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-03-0005', name: 'Acc Dep - Fixtures', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-03-0006', name: 'Acc Dep - Computer Equipment', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-03-0007', name: 'Acc Dep - Land', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-03-0008', name: 'Acc Dep - Building', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-03-0009', name: 'Acc Dep - Geo tech Equipment', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-03-0010', name: 'Acc Dep - Survey Equipments', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', parentCode: '01-01-03', level: 3, allowPosting: true, isSystem: true, description: null },

      // 01-01-04 Accumulated Amortization
      { code: '01-01-04', name: 'Accumulated Amortization', accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', parentCode: '01-01', level: 2, allowPosting: false, isSystem: true, description: 'Total accumulated amortization on intangible assets' },
        { code: '01-01-04-0001', name: 'Acc Amort - Turbon Pro', accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', parentCode: '01-01-04', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-04-0002', name: 'Acc Amort - CivilStrips', accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', parentCode: '01-01-04', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '01-01-04-0003', name: 'Acc Amort - Hydrohelp 2.6', accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', parentCode: '01-01-04', level: 3, allowPosting: true, isSystem: true, description: null },

      // 01-01-05 Capital Work in Progress
      { code: '01-01-05', name: 'Capital Work in Progress', accountType: 'ASSET', subType: 'WORK_IN_PROGRESS', parentCode: '01-01', level: 2, allowPosting: false, isSystem: true, description: 'Assets under construction / installation' },
        { code: '01-01-05-0001', name: 'General CWIP', accountType: 'ASSET', subType: 'WORK_IN_PROGRESS', parentCode: '01-01-05', level: 3, allowPosting: true, isSystem: true, description: 'General capital work in progress' },

    // ── 01-02 Current Assets ──
    { code: '01-02', name: 'Current Assets', accountType: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '01', level: 1, allowPosting: false, isSystem: true, description: 'Assets expected to be realized within 12 months' },

      // 01-02-01 Advance to Supplier
      { code: '01-02-01', name: 'Advance to Supplier', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02', level: 2, allowPosting: false, isSystem: true, description: 'Advances paid to suppliers' },
        { code: '01-02-01-0001', name: 'Capital Rent A Car Service', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-01', level: 3, allowPosting: true, isSystem: true, description: 'Advance to Capital Rent A Car Service' },

      // 01-02-02 Advance Income Tax
      { code: '01-02-02', name: 'Advance Income Tax', accountType: 'ASSET', subType: 'TAX_RECEIVABLE', parentCode: '01-02', level: 2, allowPosting: false, isSystem: true, description: 'Tax deducted at source / paid in advance' },
        { code: '01-02-02-0001', name: 'Services/Invoices', accountType: 'ASSET', subType: 'TAX_RECEIVABLE', parentCode: '01-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Advance income tax on services/invoices' },

      // 01-02-03 Bank
      { code: '01-02-03', name: 'Bank', accountType: 'ASSET', subType: 'BANK', parentCode: '01-02', level: 2, allowPosting: false, isSystem: true, description: 'Bank accounts' },
        { code: '01-02-03-0001', name: 'Allied Bank', accountType: 'ASSET', subType: 'BANK', parentCode: '01-02-03', level: 3, allowPosting: true, isSystem: true, description: 'Allied Bank Limited' },
        { code: '01-02-03-0002', name: 'Bank of Khyber', accountType: 'ASSET', subType: 'BANK', parentCode: '01-02-03', level: 3, allowPosting: true, isSystem: true, description: 'Bank of Khyber' },
        { code: '01-02-03-0003', name: 'Habib Bank Limited', accountType: 'ASSET', subType: 'BANK', parentCode: '01-02-03', level: 3, allowPosting: true, isSystem: true, description: 'Habib Bank Limited' },
        { code: '01-02-03-0004', name: 'National Bank', accountType: 'ASSET', subType: 'BANK', parentCode: '01-02-03', level: 3, allowPosting: true, isSystem: true, description: 'National Bank of Pakistan' },

      // 01-02-04 Petty Cash
      { code: '01-02-04', name: 'Petty Cash', accountType: 'ASSET', subType: 'CASH', parentCode: '01-02', level: 2, allowPosting: false, isSystem: true, description: 'Petty cash funds' },
        { code: '01-02-04-0001', name: 'Salman Khan', accountType: 'ASSET', subType: 'CASH', parentCode: '01-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Petty cash - Salman Khan' },
        { code: '01-02-04-0002', name: 'Izhar Ali', accountType: 'ASSET', subType: 'CASH', parentCode: '01-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Petty cash - Izhar Ali' },
        { code: '01-02-04-0003', name: 'Imdad Ullah', accountType: 'ASSET', subType: 'CASH', parentCode: '01-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Petty cash - Imdad Ullah' },
        { code: '01-02-04-0004', name: 'Nouman Gul', accountType: 'ASSET', subType: 'CASH', parentCode: '01-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Petty cash - Nouman Gul' },

      // 01-02-05 Staff Advance
      { code: '01-02-05', name: 'Staff Advance', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02', level: 2, allowPosting: false, isSystem: true, description: 'Advances to staff and partners' },
        { code: '01-02-05-0001', name: 'Partners Advance', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-05', level: 3, allowPosting: true, isSystem: true, description: 'Advances to partners' },
        { code: '01-02-05-0002', name: 'Staff Advance', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-05', level: 3, allowPosting: true, isSystem: true, description: 'Advances to staff' },

      // 01-02-06 Advance Salary
      { code: '01-02-06', name: 'Advance Salary', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02', level: 2, allowPosting: false, isSystem: true, description: 'Salary advances' },
        { code: '01-02-06-0001', name: 'Partners Advance Salary', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-06', level: 3, allowPosting: true, isSystem: true, description: 'Salary advances to partners' },
        { code: '01-02-06-0002', name: 'Staff Advance Salary', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-06', level: 3, allowPosting: true, isSystem: true, description: 'Salary advances to staff' },

      // 01-02-07 Advance for Expenses
      { code: '01-02-07', name: 'Advance for Expenses', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02', level: 2, allowPosting: false, isSystem: true, description: 'Expense advances to individuals' },
        { code: '01-02-07-0001', name: 'Alamgir Khan', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Expense advance - Alamgir Khan' },
        { code: '01-02-07-0002', name: 'Aziz-ul-Haq', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Expense advance - Aziz-ul-Haq' },
        { code: '01-02-07-0003', name: 'Mukhtar Muhammad', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Expense advance - Mukhtar Muhammad' },
        { code: '01-02-07-0004', name: 'Nasir-ul-Mulk', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Expense advance - Nasir-ul-Mulk' },
        { code: '01-02-07-0005', name: 'Rahat Ali Khan', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Expense advance - Rahat Ali Khan' },
        { code: '01-02-07-0006', name: 'Tariq Khurshid', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Expense advance - Tariq Khurshid' },
        { code: '01-02-07-0007', name: 'Zahoor Ahmad', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Expense advance - Zahoor Ahmad' },
        { code: '01-02-07-0008', name: 'Rehmat Shah', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Expense advance - Rehmat Shah' },
        { code: '01-02-07-0009', name: 'Naeem Jan', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Expense advance - Naeem Jan' },
        { code: '01-02-07-0010', name: 'Nasir Alam', accountType: 'ASSET', subType: 'ADVANCE', parentCode: '01-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Expense advance - Nasir Alam' },

      // 01-02-08 Security and Deposits
      { code: '01-02-08', name: 'Security and Deposits', accountType: 'ASSET', subType: 'DEPOSIT', parentCode: '01-02', level: 2, allowPosting: false, isSystem: true, description: 'Security deposits paid' },
        { code: '01-02-08-0001', name: 'Office Security', accountType: 'ASSET', subType: 'DEPOSIT', parentCode: '01-02-08', level: 3, allowPosting: true, isSystem: true, description: 'Office security deposit' },
        { code: '01-02-08-0002', name: 'Call Deposit', accountType: 'ASSET', subType: 'DEPOSIT', parentCode: '01-02-08', level: 3, allowPosting: true, isSystem: true, description: 'Call deposit' },

      // 01-02-09 Prepaid Rent
      { code: '01-02-09', name: 'Prepaid Rent', accountType: 'ASSET', subType: 'PREPAYMENT', parentCode: '01-02', level: 2, allowPosting: false, isSystem: true, description: 'Rent paid in advance' },
        { code: '01-02-09-0001', name: 'Prepaid Rent - Town Office', accountType: 'ASSET', subType: 'PREPAYMENT', parentCode: '01-02-09', level: 3, allowPosting: true, isSystem: true, description: 'Prepaid rent for Town Office' },
        { code: '01-02-09-0002', name: 'Prepaid Rent - Phase 07 Office', accountType: 'ASSET', subType: 'PREPAYMENT', parentCode: '01-02-09', level: 3, allowPosting: true, isSystem: true, description: 'Prepaid rent for Phase 07 Office' },

      // 01-02-12 Loan Receivables
      { code: '01-02-12', name: 'Loan Receivables', accountType: 'ASSET', subType: 'RECEIVABLE', parentCode: '01-02', level: 2, allowPosting: false, isSystem: true, description: 'Loans and receivables from third parties' },
        { code: '01-02-12-0001', name: 'BAK Consulting', accountType: 'ASSET', subType: 'RECEIVABLE', parentCode: '01-02-12', level: 3, allowPosting: true, isSystem: true, description: 'Loan receivable from BAK Consulting' },
        { code: '01-02-12-0002', name: 'Sheladia Associates', accountType: 'ASSET', subType: 'RECEIVABLE', parentCode: '01-02-12', level: 3, allowPosting: true, isSystem: true, description: 'Loan receivable from Sheladia Associates' },
        { code: '01-02-12-0003', name: 'Afkar Associates', accountType: 'ASSET', subType: 'RECEIVABLE', parentCode: '01-02-12', level: 3, allowPosting: true, isSystem: true, description: 'Loan receivable from Afkar Associates' },
        { code: '01-02-12-0004', name: 'Infra-D Consultants', accountType: 'ASSET', subType: 'RECEIVABLE', parentCode: '01-02-12', level: 3, allowPosting: true, isSystem: true, description: 'Loan receivable from Infra-D Consultants' },
        { code: '01-02-12-0005', name: '4 FS', accountType: 'ASSET', subType: 'RECEIVABLE', parentCode: '01-02-12', level: 3, allowPosting: true, isSystem: true, description: 'Loan receivable from 4 FS' },
        { code: '01-02-12-0006', name: 'Mazhar Hussain', accountType: 'ASSET', subType: 'RECEIVABLE', parentCode: '01-02-12', level: 3, allowPosting: true, isSystem: true, description: 'Loan receivable from Mazhar Hussain' },
        { code: '01-02-12-0007', name: 'Muhammad Iqbal', accountType: 'ASSET', subType: 'RECEIVABLE', parentCode: '01-02-12', level: 3, allowPosting: true, isSystem: true, description: 'Loan receivable from Muhammad Iqbal' },
        { code: '01-02-12-0008', name: 'Hamid Iqbal', accountType: 'ASSET', subType: 'RECEIVABLE', parentCode: '01-02-12', level: 3, allowPosting: true, isSystem: true, description: 'Loan receivable from Hamid Iqbal' },

  // ═══════════════════════════════════════════════════════════
  // 02. CAPITAL (EQUITY)
  // ═══════════════════════════════════════════════════════════
  { code: '02', name: 'Capital', accountType: 'EQUITY', subType: null, parentCode: null, level: 0, allowPosting: false, isSystem: true, description: 'Total Capital / Equity' },

    // 02-01 Equity
    { code: '02-01', name: 'Equity', accountType: 'EQUITY', subType: null, parentCode: '02', level: 1, allowPosting: false, isSystem: true, description: 'Partners equity' },

      // 02-01-01 Partner Capital
      { code: '02-01-01', name: 'Partner Capital', accountType: 'EQUITY', subType: 'CAPITAL_FUND', parentCode: '02-01', level: 2, allowPosting: false, isSystem: true, description: 'Capital accounts of partners' },
        { code: '02-01-01-0001', name: 'Alamgir Khan', accountType: 'EQUITY', subType: 'CAPITAL_FUND', parentCode: '02-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Capital - Alamgir Khan' },
        { code: '02-01-01-0002', name: 'Aziz-ul-Haq', accountType: 'EQUITY', subType: 'CAPITAL_FUND', parentCode: '02-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Capital - Aziz-ul-Haq' },
        { code: '02-01-01-0003', name: 'Mukhtar Muhammad', accountType: 'EQUITY', subType: 'CAPITAL_FUND', parentCode: '02-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Capital - Mukhtar Muhammad' },
        { code: '02-01-01-0004', name: 'Nasir-ul-Mulk', accountType: 'EQUITY', subType: 'CAPITAL_FUND', parentCode: '02-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Capital - Nasir-ul-Mulk' },
        { code: '02-01-01-0005', name: 'Rahat Ali Khan', accountType: 'EQUITY', subType: 'CAPITAL_FUND', parentCode: '02-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Capital - Rahat Ali Khan' },
        { code: '02-01-01-0006', name: 'Zahoor Ahmad', accountType: 'EQUITY', subType: 'CAPITAL_FUND', parentCode: '02-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Capital - Zahoor Ahmad' },
        { code: '02-01-01-0007', name: 'Memona Tariq', accountType: 'EQUITY', subType: 'CAPITAL_FUND', parentCode: '02-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Capital - Memona Tariq' },

    // 02-02 Retained Earning
    { code: '02-02', name: 'Retained Earning', accountType: 'EQUITY', subType: null, parentCode: '02', level: 1, allowPosting: false, isSystem: true, description: 'Retained earnings and accumulated results' },

      // 02-02-01 Retained Earning
      { code: '02-02-01', name: 'Retained Earning', accountType: 'EQUITY', subType: 'RETAINED_EARNINGS', parentCode: '02-02', level: 2, allowPosting: false, isSystem: true, description: 'Retained earnings' },
        { code: '02-02-01-0001', name: 'Profit & Loss', accountType: 'EQUITY', subType: 'RETAINED_EARNINGS', parentCode: '02-02-01', level: 3, allowPosting: true, isSystem: true, description: 'Profit & Loss account' },
        { code: '02-02-01-0002', name: 'Other', accountType: 'EQUITY', subType: 'RETAINED_EARNINGS', parentCode: '02-02-01', level: 3, allowPosting: true, isSystem: true, description: 'Other retained earnings' },

    // 02-03 Drawing
    { code: '02-03', name: 'Drawing', accountType: 'EQUITY', subType: null, parentCode: '02', level: 1, allowPosting: false, isSystem: true, description: 'Partners drawings' },

      // 02-03-01 Partner Drawing
      { code: '02-03-01', name: 'Partner Drawing', accountType: 'EQUITY', subType: 'DRAWING', parentCode: '02-03', level: 2, allowPosting: false, isSystem: true, description: 'Drawings by partners' },
        { code: '02-03-01-0001', name: 'Alamgir Khan', accountType: 'EQUITY', subType: 'DRAWING', parentCode: '02-03-01', level: 3, allowPosting: true, isSystem: true, description: 'Drawing - Alamgir Khan' },
        { code: '02-03-01-0002', name: 'Aziz-ul-Haq', accountType: 'EQUITY', subType: 'DRAWING', parentCode: '02-03-01', level: 3, allowPosting: true, isSystem: true, description: 'Drawing - Aziz-ul-Haq' },
        { code: '02-03-01-0003', name: 'Mukhtar Muhammad', accountType: 'EQUITY', subType: 'DRAWING', parentCode: '02-03-01', level: 3, allowPosting: true, isSystem: true, description: 'Drawing - Mukhtar Muhammad' },
        { code: '02-03-01-0004', name: 'Nasir-ul-Mulk', accountType: 'EQUITY', subType: 'DRAWING', parentCode: '02-03-01', level: 3, allowPosting: true, isSystem: true, description: 'Drawing - Nasir-ul-Mulk' },
        { code: '02-03-01-0005', name: 'Rahat Ali Khan', accountType: 'EQUITY', subType: 'DRAWING', parentCode: '02-03-01', level: 3, allowPosting: true, isSystem: true, description: 'Drawing - Rahat Ali Khan' },
        { code: '02-03-01-0006', name: 'Zahoor Ahmad', accountType: 'EQUITY', subType: 'DRAWING', parentCode: '02-03-01', level: 3, allowPosting: true, isSystem: true, description: 'Drawing - Zahoor Ahmad' },
        { code: '02-03-01-0007', name: 'Memona Tariq', accountType: 'EQUITY', subType: 'DRAWING', parentCode: '02-03-01', level: 3, allowPosting: true, isSystem: true, description: 'Drawing - Memona Tariq' },

  // ═══════════════════════════════════════════════════════════
  // 03. LIABILITY
  // ═══════════════════════════════════════════════════════════
  { code: '03', name: 'Liability', accountType: 'LIABILITY', subType: null, parentCode: null, level: 0, allowPosting: false, isSystem: true, description: 'Total Liabilities' },

    // 03-01 Long Term Liability
    { code: '03-01', name: 'Long Term Liability', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', parentCode: '03', level: 1, allowPosting: false, isSystem: true, description: 'Liabilities due after 12 months' },

      // 03-01-01 Loans from Partner
      { code: '03-01-01', name: 'Loans from Partner', accountType: 'LIABILITY', subType: 'LONG_TERM_LOAN', parentCode: '03-01', level: 2, allowPosting: false, isSystem: true, description: 'Long-term loans from partners' },
        { code: '03-01-01-0001', name: 'Alamgir Khan', accountType: 'LIABILITY', subType: 'LONG_TERM_LOAN', parentCode: '03-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Loan from Alamgir Khan' },
        { code: '03-01-01-0002', name: 'Aziz-ul-Haq', accountType: 'LIABILITY', subType: 'LONG_TERM_LOAN', parentCode: '03-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Loan from Aziz-ul-Haq' },
        { code: '03-01-01-0003', name: 'Mukhtar Muhammad', accountType: 'LIABILITY', subType: 'LONG_TERM_LOAN', parentCode: '03-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Loan from Mukhtar Muhammad' },
        { code: '03-01-01-0004', name: 'Nasir-ul-Mulk', accountType: 'LIABILITY', subType: 'LONG_TERM_LOAN', parentCode: '03-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Loan from Nasir-ul-Mulk' },
        { code: '03-01-01-0005', name: 'Rahat Ali Khan', accountType: 'LIABILITY', subType: 'LONG_TERM_LOAN', parentCode: '03-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Loan from Rahat Ali Khan' },
        { code: '03-01-01-0006', name: 'Zahoor Ahmad', accountType: 'LIABILITY', subType: 'LONG_TERM_LOAN', parentCode: '03-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Loan from Zahoor Ahmad' },
        { code: '03-01-01-0007', name: 'Memona Tariq', accountType: 'LIABILITY', subType: 'LONG_TERM_LOAN', parentCode: '03-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Loan from Memona Tariq' },

    // 03-02 Current Liability
    { code: '03-02', name: 'Current Liability', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '03', level: 1, allowPosting: false, isSystem: true, description: 'Liabilities due within 12 months' },

      // 03-02-01 Payable to Suppliers/Vendors
      { code: '03-02-01', name: 'Payable to Suppliers/Vendors', accountType: 'LIABILITY', subType: 'PAYABLE', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Amounts owed to suppliers and vendors' },
        { code: '03-02-01-0001', name: 'Payable to Suppliers/Vendors', accountType: 'LIABILITY', subType: 'PAYABLE', parentCode: '03-02-01', level: 3, allowPosting: true, isSystem: true, description: 'Trade payables' },

      // 03-02-02 Salary Payable
      { code: '03-02-02', name: 'Salary Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Salary payables by category' },
        { code: '03-02-02-0001', name: 'Salary Payable Partners', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Salary payable to partners' },
        { code: '03-02-02-0002', name: 'Salary Payable Key Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Salary payable to key staff' },
        { code: '03-02-02-0003', name: 'Salary Payable Technical Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Salary payable to technical staff' },
        { code: '03-02-02-0004', name: 'Salary Payable Technical Support Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Salary payable to technical support staff' },
        { code: '03-02-02-0005', name: 'Salary Payable Admin & Finance Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Salary payable to admin & finance staff' },
        { code: '03-02-02-0006', name: 'Salary Payable Support Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Salary payable to support staff' },
        { code: '03-02-02-0007', name: 'Salary Payable Geo Tech Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Salary payable to geo tech staff' },

      // 03-02-03 Social Charges Payable
      { code: '03-02-03', name: 'Social Charges Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Employer social charges payable by category' },
        { code: '03-02-03-0001', name: 'Social Charges Payable - Partners', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-03', level: 3, allowPosting: true, isSystem: true, description: 'Social charges payable - Partners' },
        { code: '03-02-03-0002', name: 'Social Charges Payable - Key Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-03', level: 3, allowPosting: true, isSystem: true, description: 'Social charges payable - Key Staff' },
        { code: '03-02-03-0003', name: 'Social Charges Payable - Technical Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-03', level: 3, allowPosting: true, isSystem: true, description: 'Social charges payable - Technical Staff' },
        { code: '03-02-03-0004', name: 'Social Charges Payable - Technical Support Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-03', level: 3, allowPosting: true, isSystem: true, description: 'Social charges payable - Technical Support Staff' },
        { code: '03-02-03-0005', name: 'Social Charges Payable - Admin & Finance Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-03', level: 3, allowPosting: true, isSystem: true, description: 'Social charges payable - Admin & Finance Staff' },
        { code: '03-02-03-0006', name: 'Social Charges Payable - Support Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-03', level: 3, allowPosting: true, isSystem: true, description: 'Social charges payable - Support Staff' },
        { code: '03-02-03-0007', name: 'Social Charges Payable - Geo Tech Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-03', level: 3, allowPosting: true, isSystem: true, description: 'Social charges payable - Geo Tech Staff' },

      // 03-02-04 Escalation Payable
      { code: '03-02-04', name: 'Escalation Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Salary escalation payables by category' },
        { code: '03-02-04-0001', name: 'Escalation Payable Partners', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Escalation payable to partners' },
        { code: '03-02-04-0002', name: 'Escalation Payable Key Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Escalation payable to key staff' },
        { code: '03-02-04-0003', name: 'Escalation Payable Technical Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Escalation payable to technical staff' },
        { code: '03-02-04-0004', name: 'Escalation Payable Technical Support Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Escalation payable to technical support staff' },
        { code: '03-02-04-0005', name: 'Escalation Payable Admin & Finance Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Escalation payable to admin & finance staff' },
        { code: '03-02-04-0006', name: 'Escalation Payable Support Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Escalation payable to support staff' },
        { code: '03-02-04-0007', name: 'Escalation Payable Geo Tech Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-04', level: 3, allowPosting: true, isSystem: true, description: 'Escalation payable to geo tech staff' },

      // 03-02-05 EOBI Payable
      { code: '03-02-05', name: 'EOBI Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Employees Old-Age Benefits Institution payable' },
        { code: '03-02-05-0001', name: 'Employer Contribution', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-05', level: 3, allowPosting: true, isSystem: true, description: 'EOBI employer contribution payable' },
        { code: '03-02-05-0002', name: 'Employee Contribution', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', parentCode: '03-02-05', level: 3, allowPosting: true, isSystem: true, description: 'EOBI employee contribution payable' },

      // 03-02-06 WHT Payable Supplier
      { code: '03-02-06', name: 'WHT Payable Supplier', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Withholding tax payable to suppliers' },
        { code: '03-02-06-0001', name: 'WHT Payable Suppliers', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-06', level: 3, allowPosting: true, isSystem: true, description: 'Withholding tax payable to suppliers' },

      // 03-02-07 WHT Payable Employees
      { code: '03-02-07', name: 'WHT Payable Employees', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Withholding tax payable on employee salaries' },
        { code: '03-02-07-0001', name: 'WHT Payable Employees', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-07', level: 3, allowPosting: true, isSystem: true, description: 'Withholding tax payable on employee salaries' },

      // 03-02-08 WHT Payable Office Rent
      { code: '03-02-08', name: 'WHT Payable Office Rent', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Withholding tax payable on office rent' },
        { code: '03-02-08-0001', name: 'WHT Payable Office', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-08', level: 3, allowPosting: true, isSystem: true, description: 'Withholding tax payable on office rent' },
        { code: '03-02-08-0002', name: 'WHT Payable Accommodation', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-08', level: 3, allowPosting: true, isSystem: true, description: 'Withholding tax payable on accommodation rent' },
        { code: '03-02-08-0003', name: 'WHT Payable Site Office', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-08', level: 3, allowPosting: true, isSystem: true, description: 'Withholding tax payable on site office rent' },
        { code: '03-02-08-0004', name: 'WHT Payable Laboratory', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-08', level: 3, allowPosting: true, isSystem: true, description: 'Withholding tax payable on laboratory rent' },

      // 03-02-09 Sales Tax on Services Payable
      { code: '03-02-09', name: 'Sales Tax on Services Payable', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Sales tax on services payable' },
        { code: '03-02-09-0001', name: 'Sales Tax on Services (Invoices)', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-09', level: 3, allowPosting: true, isSystem: true, description: 'Sales tax on services - invoices' },
        { code: '03-02-09-0002', name: 'STS - Suppliers', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-09', level: 3, allowPosting: true, isSystem: true, description: 'Sales tax on services - suppliers' },

      // 03-02-10 WHT Payable Supplier - Client
      { code: '03-02-10', name: 'WHT Payable Supplier - Client', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Withholding tax payable to suppliers on behalf of client' },
        { code: '03-02-10-0001', name: 'WHT Payable Suppliers - Client', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-10', level: 3, allowPosting: true, isSystem: true, description: 'Withholding tax payable to suppliers - client' },

      // 03-02-11 GST Payable Supplier - Client
      { code: '03-02-11', name: 'GST Payable Supplier - Client', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'GST payable to suppliers on behalf of client' },
        { code: '03-02-11-0001', name: 'Client-Sale Tax Payable', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-11', level: 3, allowPosting: true, isSystem: true, description: 'Client sale tax payable' },

      // 03-02-12 WHT Office Rent - Client
      { code: '03-02-12', name: 'WHT Office Rent - Client', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Withholding tax on office rent - client' },
        { code: '03-02-12-0001', name: 'WHT Office Rent - Client', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-12', level: 3, allowPosting: true, isSystem: true, description: 'Withholding tax on office rent - client' },

      // 03-02-13 Retention Money Payable
      { code: '03-02-13', name: 'Retention Money Payable', accountType: 'LIABILITY', subType: 'PAYABLE', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Retention money payable to contractors/suppliers' },
        { code: '03-02-13-0001', name: 'Country Survey & Mapping', accountType: 'LIABILITY', subType: 'PAYABLE', parentCode: '03-02-13', level: 3, allowPosting: true, isSystem: true, description: 'Retention money payable - Country Survey & Mapping' },

      // 03-02-14 Accrued Office Rent
      { code: '03-02-14', name: 'Accrued Office Rent', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Accrued office rent expenses' },
        { code: '03-02-14-0001', name: 'Accrued Office', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02-14', level: 3, allowPosting: true, isSystem: true, description: 'Accrued office rent' },
        { code: '03-02-14-0002', name: 'Accrued Accommodation', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02-14', level: 3, allowPosting: true, isSystem: true, description: 'Accrued accommodation rent' },
        { code: '03-02-14-0003', name: 'Accrued Site Office', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02-14', level: 3, allowPosting: true, isSystem: true, description: 'Accrued site office rent' },
        { code: '03-02-14-0004', name: 'Accrued Laboratory', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02-14', level: 3, allowPosting: true, isSystem: true, description: 'Accrued laboratory rent' },

      // 03-02-15 Accrued Vehicle Rent
      { code: '03-02-15', name: 'Accrued Vehicle Rent', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Accrued vehicle rent expenses' },
        { code: '03-02-15-0001', name: 'Capital Rent A Car Service Payable', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02-15', level: 3, allowPosting: true, isSystem: true, description: 'Capital Rent A Car Service payable' },

      // 03-02-16 Accrued Utilities
      { code: '03-02-16', name: 'Accrued Utilities', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Accrued utility expenses' },
        { code: '03-02-16-0001', name: 'Electricity Bill', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02-16', level: 3, allowPosting: true, isSystem: true, description: 'Accrued electricity bill' },
        { code: '03-02-16-0002', name: 'Gas Bill', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02-16', level: 3, allowPosting: true, isSystem: true, description: 'Accrued gas bill' },
        { code: '03-02-16-0003', name: 'Telephone Bill', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02-16', level: 3, allowPosting: true, isSystem: true, description: 'Accrued telephone bill' },
        { code: '03-02-16-0004', name: 'Internet Bill', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02-16', level: 3, allowPosting: true, isSystem: true, description: 'Accrued internet bill' },
        { code: '03-02-16-0005', name: 'Water Bill', accountType: 'LIABILITY', subType: 'ACCRUAL', parentCode: '03-02-16', level: 3, allowPosting: true, isSystem: true, description: 'Accrued water bill' },

      // 03-02-17 Provision for Taxation Payables
      { code: '03-02-17', name: 'Provision for Taxation Payables', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Provision for taxation payables' },
        { code: '03-02-17-0001', name: 'Provision for Taxation Payables', accountType: 'LIABILITY', subType: 'TAX_PAYABLE', parentCode: '03-02-17', level: 3, allowPosting: true, isSystem: true, description: 'Provision for taxation payables' },

      // 03-02-18 Loan Payable
      { code: '03-02-18', name: 'Loan Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '03-02', level: 2, allowPosting: false, isSystem: true, description: 'Short-term loans payable' },
        { code: '03-02-18-0001', name: 'BAK Consulting', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '03-02-18', level: 3, allowPosting: true, isSystem: true, description: 'Loan payable to BAK Consulting' },
        { code: '03-02-18-0002', name: 'Sheladia Associates', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '03-02-18', level: 3, allowPosting: true, isSystem: true, description: 'Loan payable to Sheladia Associates' },
        { code: '03-02-18-0003', name: 'Afkar Associates', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '03-02-18', level: 3, allowPosting: true, isSystem: true, description: 'Loan payable to Afkar Associates' },
        { code: '03-02-18-0004', name: 'Infra-D Consultants', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '03-02-18', level: 3, allowPosting: true, isSystem: true, description: 'Loan payable to Infra-D Consultants' },
        { code: '03-02-18-0005', name: '4 FS', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '03-02-18', level: 3, allowPosting: true, isSystem: true, description: 'Loan payable to 4 FS' },
        { code: '03-02-18-0006', name: 'Mazhar Hussain', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '03-02-18', level: 3, allowPosting: true, isSystem: true, description: 'Loan payable to Mazhar Hussain' },
        { code: '03-02-18-0007', name: 'Muhammad Iqbal', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '03-02-18', level: 3, allowPosting: true, isSystem: true, description: 'Loan payable to Muhammad Iqbal' },
        { code: '03-02-18-0008', name: 'Hamid Iqbal', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '03-02-18', level: 3, allowPosting: true, isSystem: true, description: 'Loan payable to Hamid Iqbal' },

  // ═══════════════════════════════════════════════════════════
  // 04. REVENUE
  // ═══════════════════════════════════════════════════════════
  { code: '04', name: 'Revenue', accountType: 'INCOME', subType: null, parentCode: null, level: 0, allowPosting: false, isSystem: true, description: 'Total Revenue / Income' },

    // 04-01 Operating Revenue
    { code: '04-01', name: 'Operating Revenue', accountType: 'INCOME', subType: null, parentCode: '04', level: 1, allowPosting: false, isSystem: true, description: 'Revenue from core operations' },

      // 04-01-01 Service
      { code: '04-01-01', name: 'Service Revenue', accountType: 'INCOME', subType: 'PROGRAM_INCOME', parentCode: '04-01', level: 2, allowPosting: false, isSystem: true, description: 'Service and consultancy revenue' },
        { code: '04-01-01-0001', name: 'Operating Revenue', accountType: 'INCOME', subType: 'PROGRAM_INCOME', parentCode: '04-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Operating revenue from services' },
        { code: '04-01-01-0002', name: 'JV Share', accountType: 'INCOME', subType: 'PROGRAM_INCOME', parentCode: '04-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Joint venture share of revenue' },

    // 04-02 Other Income
    { code: '04-02', name: 'Other Income', accountType: 'INCOME', subType: null, parentCode: '04', level: 1, allowPosting: false, isSystem: true, description: 'Non-operating income' },

      // 04-02-01 Gain/Loss on Disposal
      { code: '04-02-01', name: 'Gain/Loss on Disposal of Assets', accountType: 'INCOME', subType: 'GAIN_ON_DISPOSAL', parentCode: '04-02', level: 2, allowPosting: false, isSystem: true, description: 'Gain or loss on disposal of fixed assets' },
        { code: '04-02-01-0001', name: 'Gain/Loss on Disposal of Assets', accountType: 'INCOME', subType: 'GAIN_ON_DISPOSAL', parentCode: '04-02-01', level: 3, allowPosting: true, isSystem: true, description: 'Net gain/loss on disposal of assets' },

      // 04-02-02 Gain/Loss on Foreign Exchange
      { code: '04-02-02', name: 'Gain/Loss on Foreign Exchange', accountType: 'INCOME', subType: null, parentCode: '04-02', level: 2, allowPosting: false, isSystem: true, description: 'Foreign exchange gains and losses' },
        { code: '04-02-02-0001', name: 'Other Exchange Gain/Loss', accountType: 'INCOME', subType: 'OTHER_INCOME', parentCode: '04-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Other exchange gain or loss' },
        { code: '04-02-02-0002', name: 'Unrealised Gain/Loss on Exchange', accountType: 'INCOME', subType: 'OTHER_INCOME', parentCode: '04-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Unrealised foreign exchange gain or loss' },
        { code: '04-02-02-0003', name: 'Realised Gain/Loss on Exchange', accountType: 'INCOME', subType: 'OTHER_INCOME', parentCode: '04-02-02', level: 3, allowPosting: true, isSystem: true, description: 'Realised foreign exchange gain or loss' },

  // ═══════════════════════════════════════════════════════════
  // 05. EXPENSES (Required for ERP voucher entry system)
  // ═══════════════════════════════════════════════════════════
  { code: '05', name: 'Expenses', accountType: 'EXPENSE', subType: null, parentCode: null, level: 0, allowPosting: false, isSystem: true, description: 'Total Expenses' },

    // 05-01 Personnel Costs
    { code: '05-01', name: 'Personnel Costs', accountType: 'EXPENSE', subType: null, parentCode: '05', level: 1, allowPosting: false, isSystem: true, description: 'Salary and wage expenses' },

      // 05-01-01 Salaries & Wages
      { code: '05-01-01', name: 'Salaries & Wages', accountType: 'EXPENSE', subType: 'SALARY', parentCode: '05-01', level: 2, allowPosting: false, isSystem: true, description: 'Gross salary and wage expense' },
        { code: '05-01-01-0001', name: 'Partners Salary', accountType: 'EXPENSE', subType: 'SALARY', parentCode: '05-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Salary expense for partners' },
        { code: '05-01-01-0002', name: 'Key Staff Salary', accountType: 'EXPENSE', subType: 'SALARY', parentCode: '05-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Salary expense for key staff' },
        { code: '05-01-01-0003', name: 'Technical Staff Salary', accountType: 'EXPENSE', subType: 'SALARY', parentCode: '05-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Salary expense for technical staff' },
        { code: '05-01-01-0004', name: 'Technical Support Staff Salary', accountType: 'EXPENSE', subType: 'SALARY', parentCode: '05-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Salary expense for technical support staff' },
        { code: '05-01-01-0005', name: 'Admin & Finance Staff Salary', accountType: 'EXPENSE', subType: 'SALARY', parentCode: '05-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Salary expense for admin & finance staff' },
        { code: '05-01-01-0006', name: 'Support Staff Salary', accountType: 'EXPENSE', subType: 'SALARY', parentCode: '05-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Salary expense for support staff' },
        { code: '05-01-01-0007', name: 'Geo Tech Staff Salary', accountType: 'EXPENSE', subType: 'SALARY', parentCode: '05-01-01', level: 3, allowPosting: true, isSystem: true, description: 'Salary expense for geo tech staff' },

      // 05-01-02 Overtime & Allowances
      { code: '05-01-02', name: 'Overtime & Allowances', accountType: 'EXPENSE', subType: 'PERSONNEL', parentCode: '05-01', level: 2, allowPosting: false, isSystem: true, description: 'Overtime and allowance expenses' },
        { code: '05-01-02-0001', name: 'Overtime Allowance', accountType: 'EXPENSE', subType: 'PERSONNEL', parentCode: '05-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Overtime allowance expense' },
        { code: '05-01-02-0002', name: 'Field Allowance', accountType: 'EXPENSE', subType: 'PERSONNEL', parentCode: '05-01-02', level: 3, allowPosting: true, isSystem: true, description: 'Field allowance expense' },

    // 05-02 Employer Social Charges
    { code: '05-02', name: 'Employer Social Charges', accountType: 'EXPENSE', subType: null, parentCode: '05', level: 1, allowPosting: false, isSystem: true, description: "Employer's share of social charges" },

      // 05-02-01 EOBI Contribution
      { code: '05-02-01', name: 'EOBI Contribution', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02', level: 2, allowPosting: false, isSystem: true, description: "Employer's EOBI contribution" },
        { code: '05-02-01-0001', name: 'EOBI - Partners Salary', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-01-0002', name: 'EOBI - Key Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-01-0003', name: 'EOBI - Technical Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-01-0004', name: 'EOBI - Technical Support Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-01-0005', name: 'EOBI - Admin & Finance Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-01-0006', name: 'EOBI - Support Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-01-0007', name: 'EOBI - Geo Tech Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-01', level: 3, allowPosting: true, isSystem: true, description: null },

      // 05-02-02 Provident Fund
      { code: '05-02-02', name: 'Provident Fund', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02', level: 2, allowPosting: false, isSystem: true, description: "Employer's provident fund contribution" },
        { code: '05-02-02-0001', name: 'Provident Fund - Partners Salary', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-02', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-02-0002', name: 'Provident Fund - Key Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-02', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-02-0003', name: 'Provident Fund - Technical Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-02', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-02-0004', name: 'Provident Fund - Technical Support Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-02', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-02-0005', name: 'Provident Fund - Admin & Finance Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-02', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-02-0006', name: 'Provident Fund - Support Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-02', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-02-0007', name: 'Provident Fund - Geo Tech Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-02', level: 3, allowPosting: true, isSystem: true, description: null },

      // 05-02-03 Social Security
      { code: '05-02-03', name: 'Social Security', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02', level: 2, allowPosting: false, isSystem: true, description: "Employer's social security contribution" },
        { code: '05-02-03-0001', name: 'Social Security - Partners Salary', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-03-0002', name: 'Social Security - Key Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-03-0003', name: 'Social Security - Technical Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-03-0004', name: 'Social Security - Technical Support Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-03-0005', name: 'Social Security - Admin & Finance Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-03-0006', name: 'Social Security - Support Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-03', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-02-03-0007', name: 'Social Security - Geo Tech Staff', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', parentCode: '05-02-03', level: 3, allowPosting: true, isSystem: true, description: null },

    // 05-03 Travel & Transportation
    { code: '05-03', name: 'Travel & Transportation', accountType: 'EXPENSE', subType: null, parentCode: '05', level: 1, allowPosting: false, isSystem: true, description: 'Travel and vehicle expenses' },

      // 05-03-01 Travel Expenses
      { code: '05-03-01', name: 'Travel Expenses', accountType: 'EXPENSE', subType: 'TRAVEL', parentCode: '05-03', level: 2, allowPosting: false, isSystem: true, description: 'Travel and related expenses' },
        { code: '05-03-01-0001', name: 'Domestic Travel', accountType: 'EXPENSE', subType: 'TRAVEL', parentCode: '05-03-01', level: 3, allowPosting: true, isSystem: true, description: 'Domestic travel and related expenses' },
        { code: '05-03-01-0002', name: 'International Travel', accountType: 'EXPENSE', subType: 'TRAVEL', parentCode: '05-03-01', level: 3, allowPosting: true, isSystem: true, description: 'International travel and related expenses' },

      // 05-03-02 Vehicle Running & Maintenance
      { code: '05-03-02', name: 'Vehicle Running & Maintenance', accountType: 'EXPENSE', subType: 'TRAVEL', parentCode: '05-03', level: 2, allowPosting: false, isSystem: true, description: 'Fuel, repairs, and maintenance of vehicles' },
        { code: '05-03-02-0001', name: 'Fuel & Oil', accountType: 'EXPENSE', subType: 'TRAVEL', parentCode: '05-03-02', level: 3, allowPosting: true, isSystem: true, description: 'Fuel and oil expenses' },
        { code: '05-03-02-0002', name: 'Vehicle Repair & Maintenance', accountType: 'EXPENSE', subType: 'TRAVEL', parentCode: '05-03-02', level: 3, allowPosting: true, isSystem: true, description: 'Vehicle repair and maintenance' },

      // 05-03-03 Conveyance
      { code: '05-03-03', name: 'Conveyance', accountType: 'EXPENSE', subType: 'TRAVEL', parentCode: '05-03', level: 2, allowPosting: false, isSystem: true, description: 'Conveyance and transport' },
        { code: '05-03-03-0001', name: 'Conveyance Allowance', accountType: 'EXPENSE', subType: 'TRAVEL', parentCode: '05-03-03', level: 3, allowPosting: true, isSystem: true, description: 'Daily conveyance allowance' },
        { code: '05-03-03-0002', name: 'Capital Rent A Car Service', accountType: 'EXPENSE', subType: 'TRAVEL', parentCode: '05-03-03', level: 3, allowPosting: true, isSystem: true, description: 'Rent a car service expense' },

    // 05-04 Office Expenses
    { code: '05-04', name: 'Office Expenses', accountType: 'EXPENSE', subType: null, parentCode: '05', level: 1, allowPosting: false, isSystem: true, description: 'Office and administrative expenses' },

      // 05-04-01 Rent Expense
      { code: '05-04-01', name: 'Rent Expense', accountType: 'EXPENSE', subType: 'RENT_EXPENSE', parentCode: '05-04', level: 2, allowPosting: false, isSystem: true, description: 'Office and building rent' },
        { code: '05-04-01-0001', name: 'Office Rent', accountType: 'EXPENSE', subType: 'RENT_EXPENSE', parentCode: '05-04-01', level: 3, allowPosting: true, isSystem: true, description: 'Office rent expense' },

      // 05-04-02 Utilities
      { code: '05-04-02', name: 'Utilities', accountType: 'EXPENSE', subType: 'UTILITY_EXPENSE', parentCode: '05-04', level: 2, allowPosting: false, isSystem: true, description: 'Electricity, gas, water, telephone' },
        { code: '05-04-02-0001', name: 'Electricity', accountType: 'EXPENSE', subType: 'UTILITY_EXPENSE', parentCode: '05-04-02', level: 3, allowPosting: true, isSystem: true, description: 'Electricity expense' },
        { code: '05-04-02-0002', name: 'Gas', accountType: 'EXPENSE', subType: 'UTILITY_EXPENSE', parentCode: '05-04-02', level: 3, allowPosting: true, isSystem: true, description: 'Gas expense' },
        { code: '05-04-02-0003', name: 'Telephone', accountType: 'EXPENSE', subType: 'UTILITY_EXPENSE', parentCode: '05-04-02', level: 3, allowPosting: true, isSystem: true, description: 'Telephone expense' },
        { code: '05-04-02-0004', name: 'Internet', accountType: 'EXPENSE', subType: 'UTILITY_EXPENSE', parentCode: '05-04-02', level: 3, allowPosting: true, isSystem: true, description: 'Internet expense' },
        { code: '05-04-02-0005', name: 'Water', accountType: 'EXPENSE', subType: 'UTILITY_EXPENSE', parentCode: '05-04-02', level: 3, allowPosting: true, isSystem: true, description: 'Water expense' },

      // 05-04-03 Office Supplies
      { code: '05-04-03', name: 'Office Supplies', accountType: 'EXPENSE', subType: 'OFFICE', parentCode: '05-04', level: 2, allowPosting: false, isSystem: true, description: 'Consumable office supplies' },
        { code: '05-04-03-0001', name: 'Office Supplies', accountType: 'EXPENSE', subType: 'OFFICE', parentCode: '05-04-03', level: 3, allowPosting: true, isSystem: true, description: 'Office supplies expense' },

      // 05-04-04 Printing & Stationery
      { code: '05-04-04', name: 'Printing & Stationery', accountType: 'EXPENSE', subType: 'OFFICE', parentCode: '05-04', level: 2, allowPosting: false, isSystem: true, description: 'Printing and stationery costs' },
        { code: '05-04-04-0001', name: 'Printing & Stationery', accountType: 'EXPENSE', subType: 'OFFICE', parentCode: '05-04-04', level: 3, allowPosting: true, isSystem: true, description: 'Printing and stationery expense' },

      // 05-04-05 Communication
      { code: '05-04-05', name: 'Communication', accountType: 'EXPENSE', subType: 'COMMUNICATION_EXPENSE', parentCode: '05-04', level: 2, allowPosting: false, isSystem: true, description: 'Postage and courier' },
        { code: '05-04-05-0001', name: 'Postage & Courier', accountType: 'EXPENSE', subType: 'COMMUNICATION_EXPENSE', parentCode: '05-04-05', level: 3, allowPosting: true, isSystem: true, description: 'Postage and courier expense' },

    // 05-05 Professional Fees
    { code: '05-05', name: 'Professional Fees', accountType: 'EXPENSE', subType: null, parentCode: '05', level: 1, allowPosting: false, isSystem: true, description: 'Professional and consultancy fees' },

      // 05-05-01 Audit Fee
      { code: '05-05-01', name: 'Audit Fee', accountType: 'EXPENSE', subType: 'AUDIT_FEE', parentCode: '05-05', level: 2, allowPosting: false, isSystem: true, description: 'External audit fees' },
        { code: '05-05-01-0001', name: 'Audit Fee', accountType: 'EXPENSE', subType: 'AUDIT_FEE', parentCode: '05-05-01', level: 3, allowPosting: true, isSystem: true, description: 'Audit fee expense' },

      // 05-05-02 Legal Fee
      { code: '05-05-02', name: 'Legal Fee', accountType: 'EXPENSE', subType: 'LEGAL_FEE', parentCode: '05-05', level: 2, allowPosting: false, isSystem: true, description: 'Legal consultation and litigation' },
        { code: '05-05-02-0001', name: 'Legal Fee', accountType: 'EXPENSE', subType: 'LEGAL_FEE', parentCode: '05-05-02', level: 3, allowPosting: true, isSystem: true, description: 'Legal fee expense' },

      // 05-05-03 Consultancy Fee
      { code: '05-05-03', name: 'Consultancy Fee', accountType: 'EXPENSE', subType: 'CONSULTANCY_EXPENSE', parentCode: '05-05', level: 2, allowPosting: false, isSystem: true, description: 'Technical and management consultancy' },
        { code: '05-05-03-0001', name: 'Consultancy Fee', accountType: 'EXPENSE', subType: 'CONSULTANCY_EXPENSE', parentCode: '05-05-03', level: 3, allowPosting: true, isSystem: true, description: 'Consultancy fee expense' },

    // 05-06 Depreciation & Amortization
    { code: '05-06', name: 'Depreciation & Amortization', accountType: 'EXPENSE', subType: null, parentCode: '05', level: 1, allowPosting: false, isSystem: true, description: 'Depreciation and amortization expense' },

      // 05-06-01 Depreciation Expense
      { code: '05-06-01', name: 'Depreciation Expense', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06', level: 2, allowPosting: false, isSystem: true, description: 'Depreciation on tangible assets' },
        { code: '05-06-01-0001', name: 'Dep - Electrical Equipment', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-01-0002', name: 'Dep - Office Equipment', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-01-0003', name: 'Dep - Vehicle', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-01-0004', name: 'Dep - Furniture', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-01-0005', name: 'Dep - Fixtures', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-01-0006', name: 'Dep - Computer Equipment', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-01-0007', name: 'Dep - Land', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-01-0008', name: 'Dep - Building', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-01-0009', name: 'Dep - Geo tech Equipment', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-01', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-01-0010', name: 'Dep - Survey Equipments', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-01', level: 3, allowPosting: true, isSystem: true, description: null },

      // 05-06-02 Amortization Expense
      { code: '05-06-02', name: 'Amortization Expense', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06', level: 2, allowPosting: false, isSystem: true, description: 'Amortization on intangible assets' },
        { code: '05-06-02-0001', name: 'Amort - Turbon Pro', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-02', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-02-0002', name: 'Amort - CivilStrips', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-02', level: 3, allowPosting: true, isSystem: true, description: null },
        { code: '05-06-02-0003', name: 'Amort - Hydrohelp 2.6', accountType: 'EXPENSE', subType: 'DEPRECIATION', parentCode: '05-06-02', level: 3, allowPosting: true, isSystem: true, description: null },

    // 05-07 Financial Costs
    { code: '05-07', name: 'Financial Costs', accountType: 'EXPENSE', subType: null, parentCode: '05', level: 1, allowPosting: false, isSystem: true, description: 'Bank charges and financial costs' },

      // 05-07-01 Bank Charges
      { code: '05-07-01', name: 'Bank Charges', accountType: 'EXPENSE', subType: 'BANK_CHARGES', parentCode: '05-07', level: 2, allowPosting: false, isSystem: true, description: 'Bank service charges and fees' },
        { code: '05-07-01-0001', name: 'Bank Charges', accountType: 'EXPENSE', subType: 'BANK_CHARGES', parentCode: '05-07-01', level: 3, allowPosting: true, isSystem: true, description: 'Bank service charges' },

      // 05-07-02 Exchange Loss
      { code: '05-07-02', name: 'Exchange Loss', accountType: 'EXPENSE', subType: 'FINANCIAL', parentCode: '05-07', level: 2, allowPosting: false, isSystem: true, description: 'Foreign exchange losses' },
        { code: '05-07-02-0001', name: 'Realised Loss on Exchange', accountType: 'EXPENSE', subType: 'FINANCIAL', parentCode: '05-07-02', level: 3, allowPosting: true, isSystem: true, description: 'Realised foreign exchange loss' },
        { code: '05-07-02-0002', name: 'Unrealised Loss on Exchange', accountType: 'EXPENSE', subType: 'FINANCIAL', parentCode: '05-07-02', level: 3, allowPosting: true, isSystem: true, description: 'Unrealised foreign exchange loss' },

    // 05-08 Other Expenses
    { code: '05-08', name: 'Other Expenses', accountType: 'EXPENSE', subType: null, parentCode: '05', level: 1, allowPosting: false, isSystem: true, description: 'Other miscellaneous expenses' },

      // 05-08-01 Insurance
      { code: '05-08-01', name: 'Insurance', accountType: 'EXPENSE', subType: 'INSURANCE_EXPENSE', parentCode: '05-08', level: 2, allowPosting: false, isSystem: true, description: 'Insurance premiums' },
        { code: '05-08-01-0001', name: 'Insurance Expense', accountType: 'EXPENSE', subType: 'INSURANCE_EXPENSE', parentCode: '05-08-01', level: 3, allowPosting: true, isSystem: true, description: 'Insurance premium expense' },

      // 05-08-02 Repairs & Maintenance
      { code: '05-08-02', name: 'Repairs & Maintenance', accountType: 'EXPENSE', subType: 'MAINTENANCE_EXPENSE', parentCode: '05-08', level: 2, allowPosting: false, isSystem: true, description: 'Repairs and maintenance' },
        { code: '05-08-02-0001', name: 'Repairs & Maintenance', accountType: 'EXPENSE', subType: 'MAINTENANCE_EXPENSE', parentCode: '05-08-02', level: 3, allowPosting: true, isSystem: true, description: 'General repairs and maintenance' },

      // 05-08-03 Sundry Expenses
      { code: '05-08-03', name: 'Sundry Expenses', accountType: 'EXPENSE', subType: 'OTHER_EXPENSE', parentCode: '05-08', level: 2, allowPosting: false, isSystem: true, description: 'Other miscellaneous expenses' },
        { code: '05-08-03-0001', name: 'Sundry Expenses', accountType: 'EXPENSE', subType: 'OTHER_EXPENSE', parentCode: '05-08-03', level: 3, allowPosting: true, isSystem: true, description: 'Sundry expenses' },

      // 05-08-04 Loss on Disposal of Assets
      { code: '05-08-04', name: 'Loss on Disposal of Assets', accountType: 'EXPENSE', subType: 'LOSS_ON_DISPOSAL', parentCode: '05-08', level: 2, allowPosting: false, isSystem: true, description: 'Loss from sale/disposal of fixed assets' },
        { code: '05-08-04-0001', name: 'Loss on Disposal of Assets', accountType: 'EXPENSE', subType: 'LOSS_ON_DISPOSAL', parentCode: '05-08-04', level: 3, allowPosting: true, isSystem: true, description: 'Loss on disposal of assets' },

      // 05-08-05 Income Tax Expense
      { code: '05-08-05', name: 'Income Tax Expense', accountType: 'EXPENSE', subType: 'TAX_EXPENSE', parentCode: '05-08', level: 2, allowPosting: false, isSystem: true, description: 'Income tax expense' },
        { code: '05-08-05-0001', name: 'Income Tax Expense', accountType: 'EXPENSE', subType: 'TAX_EXPENSE', parentCode: '05-08-05', level: 3, allowPosting: true, isSystem: true, description: 'Provision for income tax' },
]

async function GET_HANDLER() {
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

    const codeToIdMap: Record<string, string> = {}

    // First pass: create all accounts without parent references
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

    // Second pass: update parent references using explicit parentCode
    for (const acc of NEW_COA) {
      if (acc.parentCode && codeToIdMap[acc.parentCode]) {
        await db.account.update({
          where: { id: codeToIdMap[acc.code] },
          data: { parentId: codeToIdMap[acc.parentCode] },
        })
      }
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 2b: Create sample segment data
    // ═══════════════════════════════════════════════════════════

    // Donors
    const donor1 = await db.donor.create({ data: { code: 'DON-001', name: 'USAID Pakistan', contactPerson: 'Sarah Johnson', email: 'sarah.johnson@usaid.gov', phone: '+1-202-712-0000', address: 'U.S. Embassy, Islamabad' } })
    const donor2 = await db.donor.create({ data: { code: 'DON-002', name: 'European Union Delegation', contactPerson: 'Marc Dupont', email: 'marc.dupont@eeas.europa.eu', phone: '+32-2-584-0000', address: 'EU Delegation, Islamabad' } })
    const donor3 = await db.donor.create({ data: { code: 'DON-003', name: 'UNDP Pakistan', contactPerson: 'Ahmed Khan', email: 'ahmed.khan@undp.org', phone: '+92-51-835-5000', address: 'UN House, Serena Business Complex, Islamabad' } })

    // Clients
    const client1 = await db.client.create({ data: { code: 'CLI-001', name: 'WAPDA', contactPerson: 'Chairman WAPDA', email: 'info@wapda.gov.pk', phone: '+92-51-9262000', address: 'WAPDA House, Lahore', industry: 'Government', taxNumber: 'NTN-1234567-1', isActive: true } })
    const client2 = await db.client.create({ data: { code: 'CLI-002', name: 'Government of KPK', contactPerson: 'Secretary Energy', email: 'energy@kpk.gov.pk', phone: '+92-91-9210000', address: 'Civil Secretariat, Peshawar', industry: 'Government', taxNumber: 'NTN-7654321-2', isActive: true } })
    const client3 = await db.client.create({ data: { code: 'CLI-003', name: 'JKCHD', contactPerson: 'Chief Engineer', email: 'info@jkchd.gov.pk', phone: '+92-581-920000', address: 'Muzaffarabad, AJK', industry: 'Government', taxNumber: 'NTN-9876543-3', isActive: true } })

    // Locations
    const loc1 = await db.location.create({ data: { code: 'LOC-ISB', name: 'Islamabad', address: 'Federal Capital Territory' } })
    const loc2 = await db.location.create({ data: { code: 'LOC-LHR', name: 'Lahore', address: 'Punjab Province' } })
    const loc3 = await db.location.create({ data: { code: 'LOC-PESH', name: 'Peshawar', address: 'KPK Province' } })
    const loc4 = await db.location.create({ data: { code: 'LOC-MUZ', name: 'Muzaffarabad', address: 'AJK' } })

    // Projects (18 as per statutory reporting spec)
    const projects = [
      { code: 'HO', name: 'Head Office', projectType: 'Head Office', isHeadOffice: true, sortOrder: 0 },
      { code: 'AJK-HPP', name: 'AJK Hydropower Project', projectType: 'Hydropower', sortOrder: 1 },
      { code: 'DASU', name: 'Dasu Dam Project', projectType: 'Dam', sortOrder: 2 },
      { code: 'DIAMER', name: 'Diamer Bhasha Dam', projectType: 'Dam', sortOrder: 3 },
      { code: 'GHAZI-BAROTHA', name: 'Ghazi Barotha Hydropower', projectType: 'Hydropower', sortOrder: 4 },
      { code: 'GILGIT', name: 'Gilgit-Baltistan Infrastructure', projectType: 'Infrastructure', sortOrder: 5 },
      { code: 'GOLPING', name: 'Golping Hydropower', projectType: 'Hydropower', sortOrder: 6 },
      { code: 'KAROT', name: 'Karot Hydropower', projectType: 'Hydropower', sortOrder: 7 },
      { code: 'KEYAL', name: 'Keyal Khwar Hydropower', projectType: 'Hydropower', sortOrder: 8 },
      { code: 'KOTLI', name: 'Kotli Hydropower', projectType: 'Hydropower', sortOrder: 9 },
      { code: 'MOHMAND', name: 'Mohmand Dam', projectType: 'Dam', sortOrder: 10 },
      { code: 'NEELUM', name: 'Neelum Jhelum Hydropower', projectType: 'Hydropower', sortOrder: 11 },
      { code: 'PATAN', name: 'Patan Hydropower', projectType: 'Hydropower', sortOrder: 12 },
      { code: 'SUKLEJI', name: 'Sukleji Dam', projectType: 'Dam', sortOrder: 13 },
      { code: 'TANGIR', name: 'Tangir Hydropower', projectType: 'Hydropower', sortOrder: 14 },
      { code: 'THAKOT', name: 'Thakot Hydropower', projectType: 'Hydropower', sortOrder: 15 },
      { code: 'TARBELA', name: 'Tarbela Dam Extension', projectType: 'Dam', sortOrder: 16 },
      { code: 'WUSASA', name: 'Wusasa Infrastructure', projectType: 'Infrastructure', sortOrder: 17 },
    ]

    for (const p of projects) {
      await db.project.create({
        data: {
          code: p.code,
          name: p.name,
          projectType: p.projectType,
          isHeadOffice: p.isHeadOffice || false,
          reportingCurrency: 'PKR',
          sortOrder: p.sortOrder,
          status: 'active',
          startDate: new Date('2024-07-01'),
        },
      })
    }

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
    // STEP 4: Validation — no duplicates, all codes present
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

    const expectedCodes = NEW_COA.map(a => a.code)
    const missingCodes = expectedCodes.filter(c => !codes.includes(c))

    if (missingCodes.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing account codes: ${missingCodes.join(', ')}`,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Chart of Accounts replaced successfully. All transactional data cleared.',
      coa: {
        totalAccounts: allAccounts.length,
        assets: allAccounts.filter(a => a.accountType === 'ASSET').length,
        capital: allAccounts.filter(a => a.accountType === 'EQUITY').length,
        liabilities: allAccounts.filter(a => a.accountType === 'LIABILITY').length,
        revenue: allAccounts.filter(a => a.accountType === 'INCOME').length,
        expenses: allAccounts.filter(a => a.accountType === 'EXPENSE').length,
        postingAccounts: allAccounts.filter(a => a.allowPosting).length,
        systemAccounts: allAccounts.filter(a => a.isSystem).length,
      },
      projects: { total: projects.length, headOffice: projects.filter(p => p.isHeadOffice).length },
      financialYear: financialYearName,
    })
  } catch (error: any) {
    console.error('Seed error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error during seeding',
    }, { status: 500 })
  }
}

export const GET = withAudit('seed', GET_HANDLER);
