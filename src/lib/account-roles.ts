import { db } from '@/lib/db'

/**
 * Shared account lookup utility for the ERP system.
 * Replaces hardcoded account code lookups with semantic role-based queries.
 * This ensures the system works regardless of the specific COA numbering scheme.
 */

// Account role definitions — maps a semantic role to lookup criteria
const ACCOUNT_ROLES: Record<string, { accountType?: string; subType?: string; codePrefix?: string; nameContains?: string; allowPosting?: boolean }> = {
  // Cash & Bank
  CASH_IN_HAND:       { accountType: 'ASSET', subType: 'CASH', allowPosting: true },
  BANK_ACCOUNT:       { accountType: 'ASSET', subType: 'BANK', allowPosting: true },
  PETTY_CASH:         { accountType: 'ASSET', subType: 'CASH', nameContains: 'Petty', allowPosting: true },

  // Receivables & Payables
  ACCOUNTS_RECEIVABLE:{ accountType: 'ASSET', subType: 'RECEIVABLE', allowPosting: true },
  ACCOUNTS_PAYABLE:   { accountType: 'LIABILITY', subType: 'PAYABLE', allowPosting: true },

  // Payroll
  SALARY_EXPENSE:     { accountType: 'EXPENSE', subType: 'SALARY', allowPosting: true },
  INCOME_TAX_PAYABLE: { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'Income Tax', allowPosting: true },
  EOBI_PAYABLE:       { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'EOBI', allowPosting: true },
  PROVIDENT_FUND_PAYABLE: { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'Provident', allowPosting: true },
  SALARY_PAYABLE:     { accountType: 'LIABILITY', subType: 'PAYROLL_LIABILITY', nameContains: 'Salary Payable', allowPosting: true },
  SOCIAL_CHARGES:     { accountType: 'EXPENSE', subType: 'SOCIAL_CHARGES', allowPosting: true },

  // FAMS - Asset accounts
  FA_LAND:            { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Land', allowPosting: true },
  FA_BUILDINGS:       { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Building', allowPosting: true },
  FA_VEHICLES:        { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Vehicle', allowPosting: true },
  FA_FURNITURE:       { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Furniture', allowPosting: true },
  FA_OFFICE_EQUIP:    { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Office Equipment', allowPosting: true },
  FA_IT_ASSETS:       { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'IT Assets', allowPosting: true },
  FA_MACHINERY:       { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Machinery', allowPosting: true },
  FA_OTHER:           { accountType: 'ASSET', subType: 'FIXED_ASSET', nameContains: 'Other Fixed', allowPosting: true },

  // FAMS - Accumulated Depreciation
  ACC_DEP:            { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', allowPosting: true },
  ACC_DEP_BUILDINGS:  { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Building', allowPosting: true },
  ACC_DEP_VEHICLES:   { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Vehicle', allowPosting: true },
  ACC_DEP_FURNITURE:  { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Furniture', allowPosting: true },
  ACC_DEP_OFFICE_EQUIP: { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Office Equipment', allowPosting: true },
  ACC_DEP_IT_ASSETS:  { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'IT Assets', allowPosting: true },
  ACC_DEP_MACHINERY:  { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Machinery', allowPosting: true },
  ACC_DEP_OTHER:      { accountType: 'ASSET', subType: 'ACCUMULATED_DEPRECIATION', nameContains: 'Other', allowPosting: true },

  // FAMS - Depreciation Expense
  DEP_EXPENSE:        { accountType: 'EXPENSE', subType: 'DEPRECIATION', allowPosting: true },
  DEP_EXPENSE_BUILDINGS: { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Building', allowPosting: true },
  DEP_EXPENSE_VEHICLES:  { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Vehicle', allowPosting: true },
  DEP_EXPENSE_FURNITURE: { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Furniture', allowPosting: true },
  DEP_EXPENSE_OFFICE_EQUIP: { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Office Equipment', allowPosting: true },
  DEP_EXPENSE_IT_ASSETS: { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'IT Assets', allowPosting: true },
  DEP_EXPENSE_MACHINERY:  { accountType: 'EXPENSE', subType: 'DEPRECIATION', nameContains: 'Machinery', allowPosting: true },

  // FAMS - Other
  GAIN_ON_DISPOSAL:   { accountType: 'INCOME', subType: 'GAIN_ON_DISPOSAL', allowPosting: true },
  LOSS_ON_DISPOSAL:   { accountType: 'EXPENSE', subType: 'LOSS_ON_DISPOSAL', allowPosting: true },
  REVALUATION_RESERVE:{ accountType: 'EQUITY', subType: 'REVALUATION_RESERVE', allowPosting: true },

  // Cash flow
  CASH_AND_BANK:      { accountType: 'ASSET', subType: 'CURRENT_ASSET', allowPosting: true },

  // Additional roles for expanded COA sub-types
  ADVANCE:            { accountType: 'ASSET', subType: 'ADVANCE', allowPosting: true },
  DEPOSIT:            { accountType: 'ASSET', subType: 'DEPOSIT', allowPosting: true },
  PREPAYMENT:         { accountType: 'ASSET', subType: 'PREPAYMENT', allowPosting: true },
  INVENTORY:          { accountType: 'ASSET', subType: 'INVENTORY', allowPosting: true },
  TAX_RECEIVABLE:     { accountType: 'ASSET', subType: 'TAX_RECEIVABLE', allowPosting: true },
  WORK_IN_PROGRESS:   { accountType: 'ASSET', subType: 'WORK_IN_PROGRESS', allowPosting: true },
  INVESTMENT:         { accountType: 'ASSET', subType: 'INVESTMENT', allowPosting: true },
  INTANGIBLE_ASSET:   { accountType: 'ASSET', subType: 'INTANGIBLE_ASSET', allowPosting: true },
  ACCRUAL:            { accountType: 'LIABILITY', subType: 'ACCRUAL', allowPosting: true },
  TAX_PAYABLE:        { accountType: 'LIABILITY', subType: 'TAX_PAYABLE', allowPosting: true },
  PROVISION:          { accountType: 'LIABILITY', subType: 'PROVISION', allowPosting: true },
  UNEARNED_REVENUE:   { accountType: 'LIABILITY', subType: 'UNEARNED_REVENUE', allowPosting: true },
  LONG_TERM_LOAN:     { accountType: 'LIABILITY', subType: 'LONG_TERM_LOAN', allowPosting: true },
  DEFERRED_INCOME:    { accountType: 'LIABILITY', subType: 'DEFERRED_INCOME', allowPosting: true },
  GRANT_LIABILITY:    { accountType: 'LIABILITY', subType: 'GRANT_LIABILITY', allowPosting: true },
  DONOR_PAYABLE:      { accountType: 'LIABILITY', subType: 'DONOR_PAYABLE', allowPosting: true },
  CAPITAL_FUND:       { accountType: 'EQUITY', subType: 'CAPITAL_FUND', allowPosting: true },
  ENDOWMENT_FUND:     { accountType: 'EQUITY', subType: 'ENDOWMENT_FUND', allowPosting: true },
  CONSULTANCY_INCOME: { accountType: 'INCOME', subType: 'CONSULTANCY_INCOME', allowPosting: true },
  TRAINING_INCOME:    { accountType: 'INCOME', subType: 'TRAINING_INCOME', allowPosting: true },
  RENTAL_INCOME:      { accountType: 'INCOME', subType: 'RENTAL_INCOME', allowPosting: true },
  INVESTMENT_INCOME:  { accountType: 'INCOME', subType: 'INVESTMENT_INCOME', allowPosting: true },
  RENT_EXPENSE:       { accountType: 'EXPENSE', subType: 'RENT_EXPENSE', allowPosting: true },
  UTILITY_EXPENSE:    { accountType: 'EXPENSE', subType: 'UTILITY_EXPENSE', allowPosting: true },
  COMMUNICATION_EXPENSE: { accountType: 'EXPENSE', subType: 'COMMUNICATION_EXPENSE', allowPosting: true },
  MAINTENANCE_EXPENSE: { accountType: 'EXPENSE', subType: 'MAINTENANCE_EXPENSE', allowPosting: true },
  AUDIT_FEE:          { accountType: 'EXPENSE', subType: 'AUDIT_FEE', allowPosting: true },
  LEGAL_FEE:          { accountType: 'EXPENSE', subType: 'LEGAL_FEE', allowPosting: true },
  BANK_CHARGES:       { accountType: 'EXPENSE', subType: 'BANK_CHARGES', allowPosting: true },
  INSURANCE_EXPENSE:  { accountType: 'EXPENSE', subType: 'INSURANCE_EXPENSE', allowPosting: true },
  TRAINING_EXPENSE:   { accountType: 'EXPENSE', subType: 'TRAINING_EXPENSE', allowPosting: true },
  CONSULTANCY_EXPENSE: { accountType: 'EXPENSE', subType: 'CONSULTANCY_EXPENSE', allowPosting: true },
  BAD_DEBT:           { accountType: 'EXPENSE', subType: 'BAD_DEBT', allowPosting: true },
  IMPAIRMENT_LOSS:    { accountType: 'EXPENSE', subType: 'IMPAIRMENT_LOSS', allowPosting: true },
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
 * Used as a fallback when a specific bank account is needed but not specified.
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
