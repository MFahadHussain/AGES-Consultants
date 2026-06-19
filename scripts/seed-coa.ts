/**
 * Seed script: Replace the entire Chart of Accounts with the new AGES Consultants ERP COA.
 *
 * Usage:  bun run scripts/seed-coa.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ─── Helpers ────────────────────────────────────────────────────────────────
interface AccountDef {
  code: string
  name: string
  accountType: string
  subType?: string
  level: number
  allowPosting: boolean
  parentCode?: string
  isSystem?: boolean
  description?: string
}

async function seed() {
  console.log('🗑  Deleting dependent records...')

  // Delete in dependency order (children first)
  await db.bankReconciliationItem.deleteMany()
  await db.bankStatementItem.deleteMany()
  await db.bankStatement.deleteMany()
  await db.bankReconciliation.deleteMany()
  await db.voucherAttachment.deleteMany()
  await db.voucherApproval.deleteMany()
  await db.voucherEntry.deleteMany()
  await db.voucher.deleteMany()
  await db.budgetLine.deleteMany()
  await db.budget.deleteMany()
  await db.taxCalculation.deleteMany()
  await db.taxRate.deleteMany()
  await db.accountBalance.deleteMany()
  await db.fixedAssetDepreciation.deleteMany()
  await db.assetTransaction.deleteMany()
  await db.fixedAsset.deleteMany()
  await db.fAMSExportBatch.deleteMany()
  await db.fAMSJournal.deleteMany()
  await db.payrollBatchLine.deleteMany()
  await db.payrollBatch.deleteMany()
  await db.financialReportConfig.deleteMany()
  await db.importLog.deleteMany()
  await db.exportLog.deleteMany()
  await db.auditLog.deleteMany()

  console.log('🗑  Deleting all existing accounts...')
  await db.account.deleteMany()

  // ─── New Chart of Accounts ─────────────────────────────────────────────
  const accounts: AccountDef[] = [
    // ================================================================
    // 01 ASSETS
    // ================================================================
    { code: '01', name: 'Assets', accountType: 'ASSET', level: 0, allowPosting: false },

    // 01-01 Non-current Assets
    { code: '01-01', name: 'Non-current Assets', accountType: 'ASSET', subType: 'NON_CURRENT_ASSET', level: 1, allowPosting: false, parentCode: '01' },

    // 01-01-01 Intangible Assets
    { code: '01-01-01', name: 'Intangible Assets', accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', level: 2, allowPosting: false, parentCode: '01-01' },
    { code: '01-01-01-0001', name: 'Turbon Pro', accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', level: 3, allowPosting: true, parentCode: '01-01-01' },
    { code: '01-01-01-0002', name: 'CivilStrips', accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', level: 3, allowPosting: true, parentCode: '01-01-01' },
    { code: '01-01-01-0003', name: 'Hydrohelp 2.6', accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', level: 3, allowPosting: true, parentCode: '01-01-01' },

    // 01-01-02 Tangible Assets
    { code: '01-01-02', name: 'Tangible Assets', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 2, allowPosting: false, parentCode: '01-01' },
    { code: '01-01-02-0001', name: 'Electrical Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 3, allowPosting: true, parentCode: '01-01-02' },
    { code: '01-01-02-0002', name: 'Office Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 3, allowPosting: true, parentCode: '01-01-02' },
    { code: '01-01-02-0003', name: 'Vehicle', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 3, allowPosting: true, parentCode: '01-01-02' },
    { code: '01-01-02-0004', name: 'Furniture', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 3, allowPosting: true, parentCode: '01-01-02' },
    { code: '01-01-02-0005', name: 'Fixtures', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 3, allowPosting: true, parentCode: '01-01-02' },
    { code: '01-01-02-0006', name: 'Z', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 3, allowPosting: true, parentCode: '01-01-02' },
    { code: '01-01-02-0007', name: 'Land', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 3, allowPosting: true, parentCode: '01-01-02' },
    { code: '01-01-02-0008', name: 'Building', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 3, allowPosting: true, parentCode: '01-01-02' },
    { code: '01-01-02-0009', name: 'Geo tech Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 3, allowPosting: true, parentCode: '01-01-02' },
    { code: '01-01-02-0010', name: 'Survey Equipments', accountType: 'ASSET', subType: 'FIXED_ASSET', level: 3, allowPosting: true, parentCode: '01-01-02' },

    // 01-01-03 Accumulated Depreciation
    { code: '01-01-03', name: 'Accumulated Depreciation', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 2, allowPosting: false, parentCode: '01-01' },
    { code: '01-01-03-0001', name: 'Acc Dep - Electrical Equipment', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 3, allowPosting: true, parentCode: '01-01-03' },
    { code: '01-01-03-0002', name: 'Acc Dep - Office Equipment', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 3, allowPosting: true, parentCode: '01-01-03' },
    { code: '01-01-03-0003', name: 'Acc Dep - Vehicle', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 3, allowPosting: true, parentCode: '01-01-03' },
    { code: '01-01-03-0004', name: 'Acc Dep - Furniture', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 3, allowPosting: true, parentCode: '01-01-03' },
    { code: '01-01-03-0005', name: 'Acc Dep - Fixtures', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 3, allowPosting: true, parentCode: '01-01-03' },
    { code: '01-01-03-0006', name: 'Acc Dep - Z', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 3, allowPosting: true, parentCode: '01-01-03' },
    { code: '01-01-03-0007', name: 'Acc Dep - Land', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 3, allowPosting: true, parentCode: '01-01-03' },
    { code: '01-01-03-0008', name: 'Acc Dep - Building', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 3, allowPosting: true, parentCode: '01-01-03' },
    { code: '01-01-03-0009', name: 'Acc Dep - Geo tech Equipment', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 3, allowPosting: true, parentCode: '01-01-03' },
    { code: '01-01-03-0010', name: 'Acc Dep - Survey Equipments', accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', level: 3, allowPosting: true, parentCode: '01-01-03' },

    // 01-01-04 Accumulated Amortization
    { code: '01-01-04', name: 'Accumulated Amortization', accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', level: 2, allowPosting: false, parentCode: '01-01' },
    { code: '01-01-04-0001', name: 'Acc Amort - Turbon Pro', accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', level: 3, allowPosting: true, parentCode: '01-01-04' },
    { code: '01-01-04-0002', name: 'Acc Amort - CivilStrips', accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', level: 3, allowPosting: true, parentCode: '01-01-04' },
    { code: '01-01-04-0003', name: 'Acc Amort - Hydrohelp 2.6', accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', level: 3, allowPosting: true, parentCode: '01-01-04' },

    // 01-01-05 Capital Work in Progress
    { code: '01-01-05', name: 'Capital Work in Progress', accountType: 'ASSET', subType: 'WORK_IN_PROGRESS', level: 2, allowPosting: false, parentCode: '01-01' },
    { code: '01-01-05-0001', name: 'Capital Work in Progress', accountType: 'ASSET', subType: 'WORK_IN_PROGRESS', level: 3, allowPosting: true, parentCode: '01-01-05' },

    // ─── 01-02 Current Assets ────────────────────────────────────────────
    { code: '01-02', name: 'Current Assets', accountType: 'ASSET', subType: 'CURRENT_ASSET', level: 1, allowPosting: false, parentCode: '01' },

    // 01-02-01 Advance to Supplier
    { code: '01-02-01', name: 'Advance to Supplier', accountType: 'ASSET', subType: 'ADVANCE', level: 2, allowPosting: false, parentCode: '01-02' },
    { code: '01-02-01-0001', name: 'Capital Rent A Car Service', accountType: 'ASSET', subType: 'ADVANCE', level: 3, allowPosting: true, parentCode: '01-02-01' },

    // 01-02-02 Advance Income Tax
    { code: '01-02-02', name: 'Advance Income Tax', accountType: 'ASSET', subType: 'TAX_RECEIVABLE', level: 2, allowPosting: false, parentCode: '01-02' },
    { code: '01-02-02-0001', name: 'Services/Invoices', accountType: 'ASSET', subType: 'TAX_RECEIVABLE', level: 3, allowPosting: true, parentCode: '01-02-02' },

    // 01-02-03 Bank
    { code: '01-02-03', name: 'Bank', accountType: 'ASSET', subType: 'BANK', level: 2, allowPosting: false, parentCode: '01-02' },
    { code: '01-02-03-0001', name: 'Allied Bank', accountType: 'ASSET', subType: 'BANK', level: 3, allowPosting: true, parentCode: '01-02-03' },
    { code: '01-02-03-0002', name: 'Bank of Khyber', accountType: 'ASSET', subType: 'BANK', level: 3, allowPosting: true, parentCode: '01-02-03' },
    { code: '01-02-03-0003', name: 'Habib Bank Limited', accountType: 'ASSET', subType: 'BANK', level: 3, allowPosting: true, parentCode: '01-02-03' },
    { code: '01-02-03-0004', name: 'National Bank', accountType: 'ASSET', subType: 'BANK', level: 3, allowPosting: true, parentCode: '01-02-03' },

    // 01-02-04 Petty Cash
    { code: '01-02-04', name: 'Petty Cash', accountType: 'ASSET', subType: 'CASH', level: 2, allowPosting: false, parentCode: '01-02' },
    { code: '01-02-04-0001', name: 'Salman Khan', accountType: 'ASSET', subType: 'CASH', level: 3, allowPosting: true, parentCode: '01-02-04' },
    { code: '01-02-04-0002', name: 'Izhar Ali', accountType: 'ASSET', subType: 'CASH', level: 3, allowPosting: true, parentCode: '01-02-04' },
    { code: '01-02-04-0003', name: 'Imdad Ullah', accountType: 'ASSET', subType: 'CASH', level: 3, allowPosting: true, parentCode: '01-02-04' },
    { code: '01-02-04-0004', name: 'Nouman Gul', accountType: 'ASSET', subType: 'CASH', level: 3, allowPosting: true, parentCode: '01-02-04' },

    // 01-02-05 Partners Advance
    { code: '01-02-05', name: 'Partners Advance', accountType: 'ASSET', subType: 'ADVANCE', level: 2, allowPosting: false, parentCode: '01-02' },
    { code: '01-02-05-0001', name: 'Alamgir Khan', accountType: 'ASSET', subType: 'ADVANCE', level: 3, allowPosting: true, parentCode: '01-02-05' },
    { code: '01-02-05-0002', name: 'Aziz-ul-Haq', accountType: 'ASSET', subType: 'ADVANCE', level: 3, allowPosting: true, parentCode: '01-02-05' },
    { code: '01-02-05-0003', name: 'Mukhtar Muhammad', accountType: 'ASSET', subType: 'ADVANCE', level: 3, allowPosting: true, parentCode: '01-02-05' },
    { code: '01-02-05-0004', name: 'Nasir-ul-Mulk', accountType: 'ASSET', subType: 'ADVANCE', level: 3, allowPosting: true, parentCode: '01-02-05' },
    { code: '01-02-05-0005', name: 'Rahat Ali Khan', accountType: 'ASSET', subType: 'ADVANCE', level: 3, allowPosting: true, parentCode: '01-02-05' },
    { code: '01-02-05-0006', name: 'Zahoor Ahmad', accountType: 'ASSET', subType: 'ADVANCE', level: 3, allowPosting: true, parentCode: '01-02-05' },
    { code: '01-02-05-0007', name: 'Memona Tariq', accountType: 'ASSET', subType: 'ADVANCE', level: 3, allowPosting: true, parentCode: '01-02-05' },

    // 01-02-06 Staff Advance
    { code: '01-02-06', name: 'Staff Advance', accountType: 'ASSET', subType: 'ADVANCE', level: 2, allowPosting: false, parentCode: '01-02' },

    // 01-02-07 Advance for Expenses
    { code: '01-02-07', name: 'Advance for Expenses', accountType: 'ASSET', subType: 'PREPAYMENT', level: 2, allowPosting: false, parentCode: '01-02' },
    { code: '01-02-07-0001', name: 'Alamgir Khan', accountType: 'ASSET', subType: 'PREPAYMENT', level: 3, allowPosting: true, parentCode: '01-02-07' },
    { code: '01-02-07-0002', name: 'Aziz-ul-Haq', accountType: 'ASSET', subType: 'PREPAYMENT', level: 3, allowPosting: true, parentCode: '01-02-07' },
    { code: '01-02-07-0003', name: 'Mukhtar Muhammad', accountType: 'ASSET', subType: 'PREPAYMENT', level: 3, allowPosting: true, parentCode: '01-02-07' },
    { code: '01-02-07-0004', name: 'Nasir-ul-Mulk', accountType: 'ASSET', subType: 'PREPAYMENT', level: 3, allowPosting: true, parentCode: '01-02-07' },
    { code: '01-02-07-0005', name: 'Rahat Ali Khan', accountType: 'ASSET', subType: 'PREPAYMENT', level: 3, allowPosting: true, parentCode: '01-02-07' },
    { code: '01-02-07-0006', name: 'Zahoor Ahmad', accountType: 'ASSET', subType: 'PREPAYMENT', level: 3, allowPosting: true, parentCode: '01-02-07' },
    { code: '01-02-07-0007', name: 'Memona Tariq', accountType: 'ASSET', subType: 'PREPAYMENT', level: 3, allowPosting: true, parentCode: '01-02-07' },
    { code: '01-02-07-0008', name: 'Staff Advance - Others', accountType: 'ASSET', subType: 'PREPAYMENT', level: 3, allowPosting: true, parentCode: '01-02-07' },
    { code: '01-02-07-0009', name: 'Travel Advance', accountType: 'ASSET', subType: 'PREPAYMENT', level: 3, allowPosting: true, parentCode: '01-02-07' },
    { code: '01-02-07-0010', name: 'Field Advance', accountType: 'ASSET', subType: 'PREPAYMENT', level: 3, allowPosting: true, parentCode: '01-02-07' },

    // 01-02-12 Loan Receivables
    { code: '01-02-12', name: 'Loan Receivables', accountType: 'ASSET', subType: 'RECEIVABLE', level: 2, allowPosting: false, parentCode: '01-02' },
    { code: '01-02-12-0001', name: 'BAK Consulting', accountType: 'ASSET', subType: 'RECEIVABLE', level: 3, allowPosting: true, parentCode: '01-02-12' },
    { code: '01-02-12-0002', name: 'Sheladia Associates', accountType: 'ASSET', subType: 'RECEIVABLE', level: 3, allowPosting: true, parentCode: '01-02-12' },
    { code: '01-02-12-0003', name: 'Afkar Associates', accountType: 'ASSET', subType: 'RECEIVABLE', level: 3, allowPosting: true, parentCode: '01-02-12' },
    { code: '01-02-12-0004', name: '4 FS', accountType: 'ASSET', subType: 'RECEIVABLE', level: 3, allowPosting: true, parentCode: '01-02-12' },
    { code: '01-02-12-0005', name: 'Loan Receivable - Other 1', accountType: 'ASSET', subType: 'RECEIVABLE', level: 3, allowPosting: true, parentCode: '01-02-12' },
    { code: '01-02-12-0006', name: 'Loan Receivable - Other 2', accountType: 'ASSET', subType: 'RECEIVABLE', level: 3, allowPosting: true, parentCode: '01-02-12' },
    { code: '01-02-12-0007', name: 'Loan Receivable - Other 3', accountType: 'ASSET', subType: 'RECEIVABLE', level: 3, allowPosting: true, parentCode: '01-02-12' },
    { code: '01-02-12-0008', name: 'Loan Receivable - Other 4', accountType: 'ASSET', subType: 'RECEIVABLE', level: 3, allowPosting: true, parentCode: '01-02-12' },

    // ================================================================
    // 02 CAPITAL (EQUITY)
    // ================================================================
    { code: '02', name: 'Capital', accountType: 'EQUITY', level: 0, allowPosting: false },

    // 02-01 Equity
    { code: '02-01', name: 'Equity', accountType: 'EQUITY', subType: 'CAPITAL_FUND', level: 1, allowPosting: false, parentCode: '02' },

    // 02-01-01 Partner Capital
    { code: '02-01-01', name: 'Partner Capital', accountType: 'EQUITY', subType: 'CAPITAL_FUND', level: 2, allowPosting: false, parentCode: '02-01' },
    { code: '02-01-01-0001', name: 'Alamgir Khan', accountType: 'EQUITY', subType: 'CAPITAL_FUND', level: 3, allowPosting: true, parentCode: '02-01-01' },
    { code: '02-01-01-0002', name: 'Aziz-ul-Haq', accountType: 'EQUITY', subType: 'CAPITAL_FUND', level: 3, allowPosting: true, parentCode: '02-01-01' },
    { code: '02-01-01-0003', name: 'Mukhtar Muhammad', accountType: 'EQUITY', subType: 'CAPITAL_FUND', level: 3, allowPosting: true, parentCode: '02-01-01' },
    { code: '02-01-01-0004', name: 'Nasir-ul-Mulk', accountType: 'EQUITY', subType: 'CAPITAL_FUND', level: 3, allowPosting: true, parentCode: '02-01-01' },
    { code: '02-01-01-0005', name: 'Rahat Ali Khan', accountType: 'EQUITY', subType: 'CAPITAL_FUND', level: 3, allowPosting: true, parentCode: '02-01-01' },
    { code: '02-01-01-0006', name: 'Zahoor Ahmad', accountType: 'EQUITY', subType: 'CAPITAL_FUND', level: 3, allowPosting: true, parentCode: '02-01-01' },
    { code: '02-01-01-0007', name: 'Memona Tariq', accountType: 'EQUITY', subType: 'CAPITAL_FUND', level: 3, allowPosting: true, parentCode: '02-01-01' },

    // 02-02 Retained Earning
    { code: '02-02', name: 'Retained Earning', accountType: 'EQUITY', subType: 'ACCUMULATED_SURPLUS', level: 1, allowPosting: false, parentCode: '02' },
    { code: '02-02-01', name: 'Profit & Loss', accountType: 'EQUITY', subType: 'ACCUMULATED_SURPLUS', level: 2, allowPosting: true, parentCode: '02-02' },

    // 02-03 Partner Drawing
    { code: '02-03', name: 'Drawing', accountType: 'EQUITY', subType: 'DRAWING', level: 1, allowPosting: false, parentCode: '02' },
    { code: '02-03-01', name: 'Partner Drawing', accountType: 'EQUITY', subType: 'DRAWING', level: 2, allowPosting: false, parentCode: '02-03' },
    { code: '02-03-01-0001', name: 'Alamgir Khan', accountType: 'EQUITY', subType: 'DRAWING', level: 3, allowPosting: true, parentCode: '02-03-01' },
    { code: '02-03-01-0002', name: 'Aziz-ul-Haq', accountType: 'EQUITY', subType: 'DRAWING', level: 3, allowPosting: true, parentCode: '02-03-01' },
    { code: '02-03-01-0003', name: 'Mukhtar Muhammad', accountType: 'EQUITY', subType: 'DRAWING', level: 3, allowPosting: true, parentCode: '02-03-01' },
    { code: '02-03-01-0004', name: 'Nasir-ul-Mulk', accountType: 'EQUITY', subType: 'DRAWING', level: 3, allowPosting: true, parentCode: '02-03-01' },
    { code: '02-03-01-0005', name: 'Rahat Ali Khan', accountType: 'EQUITY', subType: 'DRAWING', level: 3, allowPosting: true, parentCode: '02-03-01' },
    { code: '02-03-01-0006', name: 'Zahoor Ahmad', accountType: 'EQUITY', subType: 'DRAWING', level: 3, allowPosting: true, parentCode: '02-03-01' },
    { code: '02-03-01-0007', name: 'Memona Tariq', accountType: 'EQUITY', subType: 'DRAWING', level: 3, allowPosting: true, parentCode: '02-03-01' },

    // ================================================================
    // 03 LIABILITY
    // ================================================================
    { code: '03', name: 'Liability', accountType: 'LIABILITY', level: 0, allowPosting: false },

    // 03-01 Long term liability
    { code: '03-01', name: 'Long term Liability', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', level: 1, allowPosting: false, parentCode: '03' },

    // 03-01-01 Loans from Partner
    { code: '03-01-01', name: 'Loans from Partner', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', level: 2, allowPosting: false, parentCode: '03-01' },
    { code: '03-01-01-0001', name: 'Alamgir Khan', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-01-01' },
    { code: '03-01-01-0002', name: 'Aziz-ul-Haq', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-01-01' },
    { code: '03-01-01-0003', name: 'Mukhtar Muhammad', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-01-01' },
    { code: '03-01-01-0004', name: 'Nasir-ul-Mulk', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-01-01' },
    { code: '03-01-01-0005', name: 'Rahat Ali Khan', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-01-01' },
    { code: '03-01-01-0006', name: 'Zahoor Ahmad', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-01-01' },
    { code: '03-01-01-0007', name: 'Memona Tariq', accountType: 'LIABILITY', subType: 'NON_CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-01-01' },

    // 03-02 Current Liability
    { code: '03-02', name: 'Current Liability', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 1, allowPosting: false, parentCode: '03' },

    // 03-02-01 Payable to suppliers/Vendors
    { code: '03-02-01', name: 'Payable to Suppliers/Vendors', accountType: 'LIABILITY', subType: 'PAYABLE', level: 2, allowPosting: true, parentCode: '03-02' },

    // 03-02-02 Salary Payable
    { code: '03-02-02', name: 'Salary Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', level: 2, allowPosting: false, parentCode: '03-02' },
    { code: '03-02-02-0001', name: 'Salary Payable - Technical Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-02' },
    { code: '03-02-02-0002', name: 'Salary Payable - Admin', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-02' },
    { code: '03-02-02-0003', name: 'Salary Payable - Geo Tech Staff', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-02' },

    // 03-02-03 Social Charges Payable
    { code: '03-02-03', name: 'Social Charges Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', level: 2, allowPosting: false, parentCode: '03-02' },
    { code: '03-02-03-0001', name: 'EOBI Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-03' },
    { code: '03-02-03-0002', name: 'Provident Fund Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-03' },
    { code: '03-02-03-0003', name: 'Staff Welfare Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-03' },

    // 03-02-04 Escalation Payable
    { code: '03-02-04', name: 'Escalation Payable', accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', level: 2, allowPosting: true, parentCode: '03-02' },

    // 03-02-16 Accrued Utilities
    { code: '03-02-16', name: 'Accrued Utilities', accountType: 'LIABILITY', subType: 'ACCRUAL', level: 2, allowPosting: false, parentCode: '03-02' },
    { code: '03-02-16-0001', name: 'Electricity Bill', accountType: 'LIABILITY', subType: 'ACCRUAL', level: 3, allowPosting: true, parentCode: '03-02-16' },
    { code: '03-02-16-0002', name: 'Gas Bill', accountType: 'LIABILITY', subType: 'ACCRUAL', level: 3, allowPosting: true, parentCode: '03-02-16' },
    { code: '03-02-16-0003', name: 'Telephone Bill', accountType: 'LIABILITY', subType: 'ACCRUAL', level: 3, allowPosting: true, parentCode: '03-02-16' },
    { code: '03-02-16-0004', name: 'Internet Bill', accountType: 'LIABILITY', subType: 'ACCRUAL', level: 3, allowPosting: true, parentCode: '03-02-16' },
    { code: '03-02-16-0005', name: 'Water Bill', accountType: 'LIABILITY', subType: 'ACCRUAL', level: 3, allowPosting: true, parentCode: '03-02-16' },

    // 03-02-18 Loan Payable
    { code: '03-02-18', name: 'Loan Payable', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 2, allowPosting: false, parentCode: '03-02' },
    { code: '03-02-18-0001', name: 'BAK Consulting', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-18' },
    { code: '03-02-18-0002', name: 'Sheladia Associates', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-18' },
    { code: '03-02-18-0003', name: 'Afkar Associates', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-18' },
    { code: '03-02-18-0004', name: '4 FS', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-18' },
    { code: '03-02-18-0005', name: 'Loan Payable - Other 1', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-18' },
    { code: '03-02-18-0006', name: 'Loan Payable - Other 2', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-18' },
    { code: '03-02-18-0007', name: 'Loan Payable - Other 3', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-18' },
    { code: '03-02-18-0008', name: 'Loan Payable - Other 4', accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', level: 3, allowPosting: true, parentCode: '03-02-18' },

    // ================================================================
    // 04 REVENUE (INCOME)
    // ================================================================
    { code: '04', name: 'Revenue', accountType: 'INCOME', level: 0, allowPosting: false },

    // 04-01 Operating Revenue
    { code: '04-01', name: 'Operating Revenue', accountType: 'INCOME', subType: 'CONSULTANCY_INCOME', level: 1, allowPosting: false, parentCode: '04' },

    // 04-01-01 Service
    { code: '04-01-01', name: 'Service', accountType: 'INCOME', subType: 'CONSULTANCY_INCOME', level: 2, allowPosting: false, parentCode: '04-01' },
    { code: '04-01-01-0001', name: 'Operating Revenue', accountType: 'INCOME', subType: 'CONSULTANCY_INCOME', level: 3, allowPosting: true, parentCode: '04-01-01' },
    { code: '04-01-01-0002', name: 'JV Share', accountType: 'INCOME', subType: 'CONSULTANCY_INCOME', level: 3, allowPosting: true, parentCode: '04-01-01' },

    // 04-02 Other Income
    { code: '04-02', name: 'Other Income', accountType: 'INCOME', subType: 'OTHER_INCOME', level: 1, allowPosting: false, parentCode: '04' },

    // 04-02-01 Sale of Scrap
    { code: '04-02-01', name: 'Sale Of Scrap', accountType: 'INCOME', subType: 'GAIN_ON_DISPOSAL', level: 2, allowPosting: false, parentCode: '04-02' },
    { code: '04-02-01-0001', name: 'Gain/Loss on Disposal of Assets', accountType: 'INCOME', subType: 'GAIN_ON_DISPOSAL', level: 3, allowPosting: true, parentCode: '04-02-01' },

    // 04-02-02 Gain/Loss on Foreign Exchange
    { code: '04-02-02', name: 'Gain/Loss on Foreign Exchange', accountType: 'INCOME', subType: 'OTHER_INCOME', level: 2, allowPosting: false, parentCode: '04-02' },
    { code: '04-02-02-0001', name: 'Other Exchange Gain/Loss', accountType: 'INCOME', subType: 'OTHER_INCOME', level: 3, allowPosting: true, parentCode: '04-02-02' },
    { code: '04-02-02-0002', name: 'Unrealised Gain/Loss on Exchange', accountType: 'INCOME', subType: 'OTHER_INCOME', level: 3, allowPosting: true, parentCode: '04-02-02' },
    { code: '04-02-02-0003', name: 'Realised Gain/Loss on Exchange', accountType: 'INCOME', subType: 'OTHER_INCOME', level: 3, allowPosting: true, parentCode: '04-02-02' },

    // ================================================================
    // 05 EXPENSES (Required for system integrations: FAMS, Payroll, etc.)
    // ================================================================
    { code: '05', name: 'Expenses', accountType: 'EXPENSE', level: 0, allowPosting: false },

    // 05-01 Depreciation & Amortization
    { code: '05-01', name: 'Depreciation & Amortization', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 1, allowPosting: false, parentCode: '05' },
    { code: '05-01-01', name: 'Depreciation Expense', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 2, allowPosting: false, parentCode: '05-01' },
    { code: '05-01-01-0001', name: 'Depreciation - Electrical Equipment', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-01' },
    { code: '05-01-01-0002', name: 'Depreciation - Office Equipment', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-01' },
    { code: '05-01-01-0003', name: 'Depreciation - Vehicle', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-01' },
    { code: '05-01-01-0004', name: 'Depreciation - Furniture', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-01' },
    { code: '05-01-01-0005', name: 'Depreciation - Fixtures', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-01' },
    { code: '05-01-01-0006', name: 'Depreciation - Building', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-01' },
    { code: '05-01-01-0007', name: 'Depreciation - Geo tech Equipment', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-01' },
    { code: '05-01-01-0008', name: 'Depreciation - Survey Equipments', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-01' },

    { code: '05-01-02', name: 'Amortization Expense', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 2, allowPosting: false, parentCode: '05-01' },
    { code: '05-01-02-0001', name: 'Amortization - Turbon Pro', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-02' },
    { code: '05-01-02-0002', name: 'Amortization - CivilStrips', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-02' },
    { code: '05-01-02-0003', name: 'Amortization - Hydrohelp 2.6', accountType: 'EXPENSE', subType: 'DEPRECIATION', level: 3, allowPosting: true, parentCode: '05-01-02' },

    // 05-02 Personnel Costs
    { code: '05-02', name: 'Personnel Costs', accountType: 'EXPENSE', subType: 'SALARY', level: 1, allowPosting: false, parentCode: '05' },
    { code: '05-02-01', name: 'Salaries & Wages', accountType: 'EXPENSE', subType: 'SALARY', level: 2, allowPosting: true, parentCode: '05-02' },
    { code: '05-02-02', name: 'Overtime & Allowances', accountType: 'EXPENSE', subType: 'SALARY', level: 2, allowPosting: true, parentCode: '05-02' },

    // 05-03 Social Charges
    { code: '05-03', name: 'Employer Social Charges', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', level: 1, allowPosting: false, parentCode: '05' },
    { code: '05-03-01', name: 'Employer EOBI Contribution', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', level: 2, allowPosting: true, parentCode: '05-03' },
    { code: '05-03-02', name: 'Employer Provident Fund', accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', level: 2, allowPosting: true, parentCode: '05-03' },

    // 05-04 Office Expenses
    { code: '05-04', name: 'Office Expenses', accountType: 'EXPENSE', subType: 'OFFICE', level: 1, allowPosting: false, parentCode: '05' },
    { code: '05-04-01', name: 'Rent Expense', accountType: 'EXPENSE', subType: 'RENT_EXPENSE', level: 2, allowPosting: true, parentCode: '05-04' },
    { code: '05-04-02', name: 'Utilities Expense', accountType: 'EXPENSE', subType: 'UTILITY_EXPENSE', level: 2, allowPosting: true, parentCode: '05-04' },
    { code: '05-04-03', name: 'Office Supplies', accountType: 'EXPENSE', subType: 'OFFICE', level: 2, allowPosting: true, parentCode: '05-04' },
    { code: '05-04-04', name: 'Communication Expense', accountType: 'EXPENSE', subType: 'COMMUNICATION_EXPENSE', level: 2, allowPosting: true, parentCode: '05-04' },
    { code: '05-04-05', name: 'Printing & Stationery', accountType: 'EXPENSE', subType: 'OFFICE', level: 2, allowPosting: true, parentCode: '05-04' },

    // 05-05 Professional Fees
    { code: '05-05', name: 'Professional & Consultancy Fees', accountType: 'EXPENSE', subType: 'PROFESSIONAL', level: 1, allowPosting: false, parentCode: '05' },
    { code: '05-05-01', name: 'Audit Fee', accountType: 'EXPENSE', subType: 'AUDIT_FEE', level: 2, allowPosting: true, parentCode: '05-05' },
    { code: '05-05-02', name: 'Legal Fee', accountType: 'EXPENSE', subType: 'LEGAL_FEE', level: 2, allowPosting: true, parentCode: '05-05' },
    { code: '05-05-03', name: 'Consultancy Fee', accountType: 'EXPENSE', subType: 'CONSULTANCY_EXPENSE', level: 2, allowPosting: true, parentCode: '05-05' },

    // 05-06 Travel & Transportation
    { code: '05-06', name: 'Travel & Transportation', accountType: 'EXPENSE', subType: 'TRAVEL', level: 1, allowPosting: false, parentCode: '05' },
    { code: '05-06-01', name: 'Domestic Travel', accountType: 'EXPENSE', subType: 'TRAVEL', level: 2, allowPosting: true, parentCode: '05-06' },
    { code: '05-06-02', name: 'Vehicle Running & Maintenance', accountType: 'EXPENSE', subType: 'TRAVEL', level: 2, allowPosting: true, parentCode: '05-06' },
    { code: '05-06-03', name: 'Conveyance Allowance', accountType: 'EXPENSE', subType: 'TRAVEL', level: 2, allowPosting: true, parentCode: '05-06' },

    // 05-07 Financial Costs
    { code: '05-07', name: 'Financial Costs', accountType: 'EXPENSE', subType: 'FINANCIAL', level: 1, allowPosting: false, parentCode: '05' },
    { code: '05-07-01', name: 'Bank Charges', accountType: 'EXPENSE', subType: 'BANK_CHARGES', level: 2, allowPosting: true, parentCode: '05-07' },
    { code: '05-07-02', name: 'Loss on Foreign Exchange', accountType: 'EXPENSE', subType: 'FINANCIAL', level: 2, allowPosting: true, parentCode: '05-07' },

    // 05-08 Other Expenses
    { code: '05-08', name: 'Other Expenses', accountType: 'EXPENSE', subType: 'OTHER_EXPENSE', level: 1, allowPosting: false, parentCode: '05' },
    { code: '05-08-01', name: 'Loss on Disposal of Assets', accountType: 'EXPENSE', subType: 'LOSS_ON_DISPOSAL', level: 2, allowPosting: true, parentCode: '05-08' },
    { code: '05-08-02', name: 'Write-Off Expenses', accountType: 'EXPENSE', subType: 'OTHER_EXPENSE', level: 2, allowPosting: true, parentCode: '05-08' },
    { code: '05-08-03', name: 'Sundry Expenses', accountType: 'EXPENSE', subType: 'OTHER_EXPENSE', level: 2, allowPosting: true, parentCode: '05-08' },
    { code: '05-08-04', name: 'Insurance Expense', accountType: 'EXPENSE', subType: 'INSURANCE_EXPENSE', level: 2, allowPosting: true, parentCode: '05-08' },
    { code: '05-08-05', name: 'Maintenance & Repairs', accountType: 'EXPENSE', subType: 'MAINTENANCE_EXPENSE', level: 2, allowPosting: true, parentCode: '05-08' },
  ]

  // ─── Create accounts with hierarchy ───────────────────────────────────
  console.log(`📝 Creating ${accounts.length} accounts...`)

  // Build a code→id map as we create accounts
  const codeToId = new Map<string, string>()

  // Create accounts in order (parents first) since the array is already sorted by level
  for (const acct of accounts) {
    const parentId = acct.parentCode ? codeToId.get(acct.parentCode) ?? undefined : undefined

    const created = await db.account.create({
      data: {
        code: acct.code,
        name: acct.name,
        accountType: acct.accountType,
        subType: acct.subType || null,
        level: acct.level,
        allowPosting: acct.allowPosting,
        parentId: parentId || null,
        isSystem: acct.isSystem ?? false,
        description: acct.description || null,
        openingBalance: 0,
      },
      select: { id: true, code: true, name: true },
    })

    codeToId.set(acct.code, created.id)
  }

  // ─── Verify ────────────────────────────────────────────────────────────
  const totalAccounts = await db.account.count()
  console.log(`\n✅ Seed complete! Created ${totalAccounts} accounts.`)

  // Print summary by type
  const byType = await db.account.groupBy({
    by: ['accountType'],
    _count: { id: true },
    orderBy: { accountType: 'asc' },
  })
  for (const row of byType) {
    console.log(`   ${row.accountType}: ${row._count.id} accounts`)
  }
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
