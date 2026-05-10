import { db } from '@/lib/db'

/**
 * Shared account lookup utility for the ERP system.
 * Replaces hardcoded account code lookups with semantic role-based queries.
 * Updated for AcctFin ERP v1.0.0 — Partnership Firm COA (01-XX-XX-XXXX format).
 */

// Account role definitions — maps a semantic role to lookup criteria
const ACCOUNT_ROLES: Record<string, { accountType?: string; subType?: string; codePrefix?: string; nameContains?: string; allowPosting?: boolean }> = {
  // Cash & Bank
  CASH_IN_HAND:       { accountType: 'ASSET', subType: 'CASH', allowPosting: true },
  BANK_ACCOUNT:       { accountType: 'ASSET', subType: 'BANK', allowPosting: true },
  PETTY_CASH:         { accountType: 'ASSET', subType: 'CASH', nameContains: 'Petty', allowPosting: true },

  // Receivables & Payables
  ACCOUNTS_RECEIVABLE:{ accountType: 'ASSET', subType: 'RECEIVABLE', allowPosting: true },
  LOAN_RECEIVABLE:    { accountType: 'ASSET', subType: 'RECEIVABLE', nameContains: 'Loan', allowPosting: true },
  ACCOUNTS_PAYABLE:   { accountType: 'LIABILITY', subType: 'PAYABLE', allowPosting: true },

  // Advances
  ADVANCE_TO_SUPPLIER:{ accountType: 'ASSET', subType: 'ADVANCE', nameContains: 'Advance to Supplier', allowPosting: true },
  STAFF_ADVANCE:      { accountType: 'ASSET', subType: 'ADVANCE', nameContains: 'Staff Advance', allowPosting: true },
  ADVANCE_SALARY:     { accountType: 'ASSET', subType: 'ADVANCE', nameContains: 'Advance Salary', allowPosting: true },
  ADVANCE_EXPENSES:   { accountType: 'ASSET', subType: 'ADVANCE', nameContains: 'Advance for Expenses', allowPosting: true },
  PARTNERS_ADVANCE:   { accountType: 'ASSET', subType: 'ADVANCE', nameContains: 'Partners Advance', allowPosting: true },

  // Deposits & Prepayments
  SECURITY_DEPOSIT:   { accountType: 'ASSET', subType: 'DEPOSIT', allowPosting: true },
  PREPAID_RENT:       { accountType: 'ASSET', subType: 'PREPAYMENT', nameContains: 'Prepaid Rent', allowPosting: true },
  PREPAYMENT:         { accountType: 'ASSET', subType: 'PREPAYMENT', allowPosting: true },

  // Tax
  ADVANCE_INCOME_TAX: { accountType: 'ASSET', subType: 'TAX_RECEIVABLE', allowPosting: true },
  TAX_RECEIVABLE:     { accountType: 'ASSET', subType: 'TAX_RECEIVABLE', allowPosting: true },

  // Payroll Liabilities
  SALARY_PAYABLE:     { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'Salary Payable', allowPosting: true },
  SOCIAL_CHARGES_PAYABLE: { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'Social Charges Payable', allowPosting: true },
  INCOME_TAX_PAYABLE: { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'Income Tax', allowPosting: true },
  EOBI_PAYABLE:       { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'EOBI', allowPosting: true },
  PROVIDENT_FUND_PAYABLE: { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'Provident', allowPosting: true },
  GRATUITY_PAYABLE:     { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'Gratuity', allowPosting: true },
  ESSI_PAYABLE:         { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'ESSI', allowPosting: true },

  // FAMS - Asset accounts (new COA names)
  FA_ELECTRICAL_EQUIP:  { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Electrical Equipment', allowPosting: true },
  FA_OFFICE_EQUIP:      { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Office Equipment', allowPosting: true },
  FA_VEHICLE:           { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Vehicle', allowPosting: true },
  FA_FURNITURE:         { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Furniture', allowPosting: true },
  FA_FIXTURES:          { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Fixtures', allowPosting: true },
  FA_COMPUTER_EQUIP:    { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Computer Equipment', allowPosting: true },
  FA_LAND:              { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Land', allowPosting: true },
  FA_BUILDING:          { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Building', allowPosting: true },
  FA_GEOTECH_EQUIP:     { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Geo tech', allowPosting: true },
  FA_SURVEY_EQUIP:      { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Survey', allowPosting: true },

  // FAMS - Intangible Asset accounts
  FA_TURBON_PRO:        { accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', nameContains: 'Turbon', allowPosting: true },
  FA_CIVILSTRIPS:       { accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', nameContains: 'CivilStrips', allowPosting: true },
  FA_HYDROHELP:         { accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', nameContains: 'Hydrohelp', allowPosting: true },

  // FAMS - Accumulated Depreciation (new COA names)
  ACC_DEP:              { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', allowPosting: true },
  ACC_DEP_ELECTRICAL:   { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Electrical', allowPosting: true },
  ACC_DEP_OFFICE_EQUIP: { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Office Equipment', allowPosting: true },
  ACC_DEP_VEHICLE:      { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Vehicle', allowPosting: true },
  ACC_DEP_FURNITURE:    { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Furniture', allowPosting: true },
  ACC_DEP_FIXTURES:     { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Fixtures', allowPosting: true },
  ACC_DEP_COMPUTER:     { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Computer', allowPosting: true },
  ACC_DEP_LAND:         { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Land', allowPosting: true },
  ACC_DEP_BUILDING:     { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Building', allowPosting: true },
  ACC_DEP_GEOTECH:      { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Geo tech', allowPosting: true },
  ACC_DEP_SURVEY:       { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Survey', allowPosting: true },

  // FAMS - Accumulated Amortization
  ACC_AMORT:            { accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', allowPosting: true },
  ACC_AMORT_TURBON:     { accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', nameContains: 'Turbon', allowPosting: true },
  ACC_AMORT_CIVILSTRIPS:{ accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', nameContains: 'CivilStrips', allowPosting: true },
  ACC_AMORT_HYDROHELP:  { accountType: 'ASSET', subType: 'ACCUMULATED_AMORTIZATION', nameContains: 'Hydrohelp', allowPosting: true },

  // FAMS - Depreciation Expense (new COA names)
  DEP_EXPENSE:          { accountType: 'EXPENSE', subType: 'DEPRECIATION', allowPosting: true },
  DEP_EXPENSE_ELECTRICAL: { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Electrical', allowPosting: true },
  DEP_EXPENSE_OFFICE_EQUIP: { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Office Equipment', allowPosting: true },
  DEP_EXPENSE_VEHICLE:  { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Vehicle', allowPosting: true },
  DEP_EXPENSE_FURNITURE:{ accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Furniture', allowPosting: true },
  DEP_EXPENSE_FIXTURES: { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Fixtures', allowPosting: true },
  DEP_EXPENSE_COMPUTER: { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Computer', allowPosting: true },
  DEP_EXPENSE_LAND:     { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Land', allowPosting: true },
  DEP_EXPENSE_BUILDING: { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Building', allowPosting: true },
  DEP_EXPENSE_GEOTECH:  { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Geo tech', allowPosting: true },
  DEP_EXPENSE_SURVEY:   { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Survey', allowPosting: true },

  // FAMS - Amortization Expense
  AMORT_EXPENSE:        { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Amort', allowPosting: true },

  // FAMS - Other
  GAIN_ON_DISPOSAL:     { accountType: 'INCOME', subType: 'GAIN_ON_DISPOSAL', allowPosting: true },
  LOSS_ON_DISPOSAL:     { accountType: 'EXPENSE', subType: 'LOSS_ON_DISPOSAL', allowPosting: true },
  CWIP:                 { accountType: 'ASSET', subType: 'WORK_IN_PROGRESS', allowPosting: true },

  // Cash flow
  CASH_AND_BANK:        { accountType: 'ASSET', subType: 'BANK', allowPosting: true },

  // Equity / Capital
  PARTNER_CAPITAL:      { accountType: 'EQUITY', subType: 'CAPITAL_FUND', allowPosting: true },
  RETAINED_EARNINGS:    { accountType: 'EQUITY', subType: 'RETAINED_EARNINGS', allowPosting: true },
  PROFIT_AND_LOSS:      { accountType: 'EQUITY', subType: 'RETAINED_EARNINGS', nameContains: 'Profit & Loss', allowPosting: true },
  DRAWING:              { accountType: 'EQUITY', subType: 'DRAWING', allowPosting: true },

  // Revenue
  OPERATING_REVENUE:    { accountType: 'INCOME', subType: 'PROGRAM_INCOME', nameContains: 'Operating Revenue', allowPosting: true },
  JV_SHARE:             { accountType: 'INCOME', subType: 'PROGRAM_INCOME', nameContains: 'JV Share', allowPosting: true },

  // Liability
  LOAN_FROM_PARTNER:    { accountType: 'LIABILITY', subType: 'LONG_TERM_LOAN', allowPosting: true },
  LOAN_PAYABLE:         { accountType: 'LIABILITY', subType: 'CURRENT_LIABILITY', nameContains: 'Loan Payable', allowPosting: true },
  ACCRUED_UTILITIES:    { accountType: 'LIABILITY', subType: 'ACCRUAL', allowPosting: true },
  ESCALATION_PAYABLE:   { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'Escalation Payable', allowPosting: true },
  WHT_PAYABLE_SUPPLIER: { accountType: 'LIABILITY', subType: 'TAX_PAYABLE', nameContains: 'WHT Payable Supplier', allowPosting: true },
  WHT_PAYABLE_EMPLOYEE: { accountType: 'LIABILITY', subType: 'TAX_PAYABLE', nameContains: 'WHT Payable Employees', allowPosting: true },
  WHT_PAYABLE_OFFICE_RENT: { accountType: 'LIABILITY', subType: 'TAX_PAYABLE', nameContains: 'WHT Payable Office Rent', allowPosting: true },
  SALES_TAX_ON_SERVICES: { accountType: 'LIABILITY', subType: 'TAX_PAYABLE', nameContains: 'Sales Tax on Services', allowPosting: true },
  WHT_PAYABLE_SUPPLIER_CLIENT: { accountType: 'LIABILITY', subType: 'TAX_PAYABLE', nameContains: 'WHT Payable Supplier - Client', allowPosting: true },
  GST_PAYABLE_CLIENT:   { accountType: 'LIABILITY', subType: 'TAX_PAYABLE', nameContains: 'GST Payable Supplier - Client', allowPosting: true },
  WHT_OFFICE_RENT_CLIENT: { accountType: 'LIABILITY', subType: 'TAX_PAYABLE', nameContains: 'WHT Office Rent - Client', allowPosting: true },
  RETENTION_MONEY_PAYABLE: { accountType: 'LIABILITY', subType: 'PAYABLE', nameContains: 'Retention Money', allowPosting: true },
  ACCRUED_OFFICE_RENT:  { accountType: 'LIABILITY', subType: 'ACCRUAL', nameContains: 'Accrued Office Rent', allowPosting: true },
  ACCRUED_VEHICLE_RENT: { accountType: 'LIABILITY', subType: 'ACCRUAL', nameContains: 'Accrued Vehicle Rent', allowPosting: true },
  PROVISION_TAXATION:   { accountType: 'LIABILITY', subType: 'TAX_PAYABLE', nameContains: 'Provision for Taxation', allowPosting: true },

  // Expense categories
  SALARY_EXPENSE:       { accountType: 'EXPENSE', subType: 'SALARY', allowPosting: true },
  SOCIAL_CHARGES:       { accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', allowPosting: true },
  TRAVEL_EXPENSE:       { accountType: 'EXPENSE', subType: 'TRAVEL', allowPosting: true },
  RENT_EXPENSE:         { accountType: 'EXPENSE', subType: 'RENT_EXPENSE', allowPosting: true },
  UTILITY_EXPENSE:      { accountType: 'EXPENSE', subType: 'UTILITY_EXPENSE', allowPosting: true },
  OFFICE_EXPENSE:       { accountType: 'EXPENSE', subType: 'OFFICE', allowPosting: true },
  COMMUNICATION_EXPENSE:{ accountType: 'EXPENSE', subType: 'COMMUNICATION_EXPENSE', allowPosting: true },
  AUDIT_FEE:            { accountType: 'EXPENSE', subType: 'AUDIT_FEE', allowPosting: true },
  LEGAL_FEE:            { accountType: 'EXPENSE', subType: 'LEGAL_FEE', allowPosting: true },
  CONSULTANCY_EXPENSE:  { accountType: 'EXPENSE', subType: 'CONSULTANCY_EXPENSE', allowPosting: true },
  BANK_CHARGES:         { accountType: 'EXPENSE', subType: 'BANK_CHARGES', allowPosting: true },
  INSURANCE_EXPENSE:    { accountType: 'EXPENSE', subType: 'INSURANCE_EXPENSE', allowPosting: true },
  MAINTENANCE_EXPENSE:  { accountType: 'EXPENSE', subType: 'MAINTENANCE_EXPENSE', allowPosting: true },
  OTHER_EXPENSE:        { accountType: 'EXPENSE', subType: 'OTHER_EXPENSE', allowPosting: true },
  FINANCIAL_EXPENSE:    { accountType: 'EXPENSE', subType: 'FINANCIAL', allowPosting: true },
  TAX_EXPENSE:          { accountType: 'EXPENSE', subType: 'TAX_EXPENSE', allowPosting: true },

  // Additional legacy-compatible roles (used by existing code)
  ADVANCE:              { accountType: 'ASSET', subType: 'ADVANCE', allowPosting: true },
  DEPOSIT:              { accountType: 'ASSET', subType: 'DEPOSIT', allowPosting: true },
  INVENTORY:            { accountType: 'ASSET', subType: 'INVENTORY', allowPosting: true },
  INVESTMENT:           { accountType: 'ASSET', subType: 'INVESTMENT', allowPosting: true },
  INTANGIBLE_ASSET:     { accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', allowPosting: true },
  ACCRUAL:              { accountType: 'LIABILITY', subType: 'ACCRUAL', allowPosting: true },
  TAX_PAYABLE:          { accountType: 'LIABILITY', subType: 'TAX_PAYABLE', allowPosting: true },
  PROVISION:            { accountType: 'LIABILITY', subType: 'PROVISION', allowPosting: true },
  CAPITAL_FUND:         { accountType: 'EQUITY', subType: 'CAPITAL_FUND', allowPosting: true },
  ENDOWMENT_FUND:       { accountType: 'EQUITY', subType: 'ENDOWMENT_FUND', allowPosting: true },
  PROGRAM_INCOME:       { accountType: 'INCOME', subType: 'PROGRAM_INCOME', allowPosting: true },
  OTHER_INCOME:         { accountType: 'INCOME', subType: 'OTHER_INCOME', allowPosting: true },
}

/**
 * Find an account by its semantic role.
 * Returns the first matching account or null.
 */
export async function findAccountByRole(role: string): Promise<{ id: string; code: string; name: string } | null> {
  const criteria = ACCOUNT_ROLES[role]
  if (!criteria) {
    console.warn(`Unknown account role: ${role}`)
    return null
  }

  const where: any = { isActive: true }
  if (criteria.accountType) where.accountType = criteria.accountType
  if (criteria.subType) where.subType = criteria.subType
  if (criteria.allowPosting !== undefined) where.allowPosting = criteria.allowPosting
  if (criteria.nameContains) where.name = { contains: criteria.nameContains }
  if (criteria.codePrefix) where.code = { startsWith: criteria.codePrefix }

  const account = await db.account.findFirst({ where, select: { id: true, code: true, name: true } })
  return account
}

/**
 * Find multiple accounts by a semantic role (for prefix-based lookups).
 */
export async function findAccountsByRole(role: string): Promise<Array<{ id: string; code: string; name: string }>> {
  const criteria = ACCOUNT_ROLES[role]
  if (!criteria) {
    console.warn(`Unknown account role: ${role}`)
    return []
  }

  const where: any = { isActive: true }
  if (criteria.accountType) where.accountType = criteria.accountType
  if (criteria.subType) where.subType = criteria.subType
  if (criteria.allowPosting !== undefined) where.allowPosting = criteria.allowPosting
  if (criteria.nameContains) where.name = { contains: criteria.nameContains }
  if (criteria.codePrefix) where.code = { startsWith: criteria.codePrefix }

  return db.account.findMany({ where, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } })
}

/**
 * Get account code by role (for FAMS GL mapping lookups).
 * Falls back to looking up by code if role-based lookup fails.
 */
export async function getAccountCodeByRole(role: string): Promise<string | null> {
  const account = await findAccountByRole(role)
  return account?.code || null
}

/**
 * Find the first bank account in the system.
 */
export async function findFirstBankAccount(): Promise<{ id: string; code: string; name: string } | null> {
  return db.account.findFirst({
    where: { accountType: 'ASSET', subType: 'BANK', isActive: true, allowPosting: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  })
}

/**
 * Find accumulated depreciation account for a given asset category.
 */
export async function findAccDepForCategory(category: string): Promise<{ id: string; code: string; name: string } | null> {
  // Try specific category match first
  const specific = await db.account.findFirst({
    where: {
      accountType: 'ASSET',
      subType: 'ACCUMULATED_DEPRECIATION',
      name: { contains: category },
      isActive: true,
      allowPosting: true,
    },
    select: { id: true, code: true, name: true },
  })
  if (specific) return specific

  // Fallback to generic accumulated depreciation
  return db.account.findFirst({
    where: {
      accountType: 'ASSET',
      subType: 'ACCUMULATED_DEPRECIATION',
      isActive: true,
      allowPosting: true,
    },
    select: { id: true, code: true, name: true },
  })
}

/**
 * Find depreciation expense account for a given asset category.
 */
export async function findDepExpenseForCategory(category: string): Promise<{ id: string; code: string; name: string } | null> {
  // Try specific category match first
  const specific = await db.account.findFirst({
    where: {
      accountType: 'EXPENSE',
      subType: 'DEPRECIATION',
      name: { contains: category },
      isActive: true,
      allowPosting: true,
    },
    select: { id: true, code: true, name: true },
  })
  if (specific) return specific

  // Fallback to generic depreciation expense
  return db.account.findFirst({
    where: {
      accountType: 'EXPENSE',
      subType: 'DEPRECIATION',
      isActive: true,
      allowPosting: true,
    },
    select: { id: true, code: true, name: true },
  })
}

/**
 * Find accumulated amortization account for a given intangible asset name.
 */
export async function findAccAmortForCategory(assetName: string): Promise<{ id: string; code: string; name: string } | null> {
  const specific = await db.account.findFirst({
    where: {
      accountType: 'ASSET',
      subType: 'ACCUMULATED_AMORTIZATION',
      name: { contains: assetName },
      isActive: true,
      allowPosting: true,
    },
    select: { id: true, code: true, name: true },
  })
  if (specific) return specific

  return db.account.findFirst({
    where: {
      accountType: 'ASSET',
      subType: 'ACCUMULATED_AMORTIZATION',
      isActive: true,
      allowPosting: true,
    },
    select: { id: true, code: true, name: true },
  })
}
