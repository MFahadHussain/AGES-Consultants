#!/usr/bin/env bun
/**
 * AcctFin ERP - SQLite to PostgreSQL Data Migration Script
 * =========================================================
 * Migrates all data from the existing SQLite database to PostgreSQL.
 *
 * Usage:
 *   1. Ensure PostgreSQL is running and accessible
 *   2. Set DATABASE_URL to PostgreSQL connection string
 *   3. Run: bun run scripts/migrate-sqlite-to-pg.ts
 *
 * The script reads from the SQLite file specified by SQLITE_DB_PATH
 * and writes to the PostgreSQL database specified by DATABASE_URL.
 *
 * Options:
 *   SQLITE_DB_PATH   Path to SQLite database (default: ./db/custom.db)
 *   BATCH_SIZE       Records per batch (default: 100)
 *   DRY_RUN          Set to "true" to preview without writing (default: false)
 *   SKIP_TABLES      Comma-separated list of tables to skip
 *   ONLY_TABLES      Comma-separated list of tables to migrate (exclusively)
 */

import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'

// ============================================================
// Configuration
// ============================================================

const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'db', 'custom.db')
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100')
const DRY_RUN = process.env.DRY_RUN === 'true'
const SKIP_TABLES = (process.env.SKIP_TABLES || '').split(',').filter(Boolean)
const ONLY_TABLES = (process.env.ONLY_TABLES || '').split(',').filter(Boolean)

// ============================================================
// Migration Order (respecting foreign key dependencies)
// ============================================================

const MIGRATION_ORDER = [
  // Level 0: No FK dependencies
  'branch',
  'department',
  'role',
  'permission',
  'securityPolicy',
  'approvalWorkflow',
  'account',
  'financialYear',
  'financialReportConfig',
  'donor',
  'location',
  'client',
  'customer',
  'supplier',
  'fixedAsset',
  'famsFiscalYear',
  'famsJournal',
  'famsExportBatch',
  'famsSetting',
  'documentType',
  'allowance',
  'taxSlab',
  'payrollAccountMapping',
  'project',        // self-referencing, but can handle
  'importLog',
  'exportLog',
  'systemSetting',

  // Level 1: Depends on Level 0
  'user',           // depends on Branch, Department
  'workflowStep',   // depends on ApprovalWorkflow
  'accountBalance', // depends on Account, FinancialYear (no formal FK)
  'fixedAssetDepreciation', // depends on FixedAsset
  'assetTransaction',       // depends on FixedAsset

  // Level 2: Depends on Level 0+1
  'rolePermission',   // depends on Role, Permission
  'voucher',          // depends on FinancialYear, Project, Donor, Location, Client

  // Level 3: Depends on Level 0+1+2
  'userRole',         // depends on User, Role
  'userPermission',   // depends on User, Permission
  'userSession',      // depends on User
  'loginHistory',     // depends on User
  'passwordHistory',  // depends on User
  'approvalInstance', // depends on ApprovalWorkflow
  'bankStatement',    // depends on Account
  'budget',           // depends on FinancialYear, Project, Donor
  'taxRate',          // depends on Account
  'employee',         // depends on Project, Account(s)

  // Level 4: Depends on Level 0+1+2+3
  'approvalInstanceStep', // depends on ApprovalInstance, User
  'voucherEntry',        // depends on Voucher, Account, Customer, Supplier
  'voucherApproval',     // depends on Voucher, User
  'voucherAttachment',   // depends on Voucher
  'bankStatementItem',   // depends on BankStatement
  'bankReconciliation',  // depends on Account
  'bankReconciliationItem', // depends on BankStatementItem, Voucher
  'budgetLine',          // depends on Budget, Account
  'taxCalculation',      // depends on TaxRate
  'employeeSalaryHistory',      // depends on Employee
  'employeeProjectAssignment',  // depends on Employee, Project
  'employeeAllowance',          // depends on Employee, Allowance
  'attendance',                 // depends on Employee
  'attendanceDailyProject',     // depends on Employee, Project, Attendance
  'projectCostLedger',          // depends on Employee, Project
  'loan',                       // depends on Employee
  'employeeDocument',           // depends on Employee, DocumentType
  'payrollBatch',
  'finalSettlement',            // depends on Employee

  // Level 5: Depends on Level 0+1+2+3+4
  'loanInstallment',          // depends on Loan
  'documentAuditLog',         // depends on EmployeeDocument
  'payrollBatchLine',         // depends on PayrollBatch, Employee
  'auditLog',                 // depends on User, ApprovalInstance
]

// ============================================================
// Utility Functions
// ============================================================

function log(message: string) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
}

function logError(message: string, error?: unknown) {
  const timestamp = new Date().toISOString()
  console.error(`[${timestamp}] ERROR: ${message}`)
  if (error) {
    console.error(error)
  }
}

function logSuccess(message: string) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ✅ ${message}`)
}

function logWarning(message: string) {
  const timestamp = new Date().toISOString()
  console.warn(`[${timestamp}] ⚠️  ${message}`)
}

function logInfo(message: string) {
  const timestamp = new Date().toISOString()
  console.info(`[${timestamp}] ℹ️  ${message}`)
}

function parseBoolean(val: unknown): boolean | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val !== 0
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim()
    if (['true', '1', 'yes', 'y'].includes(lower)) return true
    if (['false', '0', 'no', 'n'].includes(lower)) return false
  }
  return null
}

function parseDate(val: unknown): Date | null {
  if (val === null || val === undefined) return null
  if (val instanceof Date) return val
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function parseFloat(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return val
  const parsed = parseFloat(String(val))
  return isNaN(parsed) ? null : parsed
}

function parseInt_(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return Math.floor(val)
  const parsed = parseInt(String(val), 10)
  return isNaN(parsed) ? null : parsed
}

// ============================================================
// SQLite Reader (using better-sqlite3)
// ============================================================

let sqliteDb: any = null

async function openSQLite(dbPath: string): Promise<any> {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite database not found at: ${dbPath}`)
  }
  const { Database } = await import('bun:sqlite')
  sqliteDb = new Database(dbPath, { readonly: true })
  logSuccess(`Opened SQLite database: ${dbPath}`)
  return sqliteDb
}

function getSQLiteTables(db: any): string[] {
  const rows = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").all()
  return rows.map((r: any) => r.name)
}

function getSQLiteRowCount(db: any, tableName: string): number {
  const row = db.query(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as any
  return row?.count || 0
}

function getSQLiteRows(db: any, tableName: string, offset: number, limit: number): any[] {
  return db.query(`SELECT * FROM "${tableName}" LIMIT ?1 OFFSET ?2`).all(limit, offset)
}

// ============================================================
// Prisma Writer
// ============================================================

const prisma = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// ============================================================
// SQLite table name → Prisma model name mapping
// ============================================================

const TABLE_TO_MODEL: Record<string, string> = {
  'Branch': 'branch',
  'Department': 'department',
  'User': 'user',
  'Role': 'role',
  'Permission': 'permission',
  'RolePermission': 'rolePermission',
  'UserRole': 'userRole',
  'UserPermission': 'userPermission',
  'UserSession': 'userSession',
  'LoginHistory': 'loginHistory',
  'PasswordHistory': 'passwordHistory',
  'SecurityPolicy': 'securityPolicy',
  'ApprovalWorkflow': 'approvalWorkflow',
  'WorkflowStep': 'workflowStep',
  'ApprovalInstance': 'approvalInstance',
  'ApprovalInstanceStep': 'approvalInstanceStep',
  'AuditLog': 'auditLog',
  'Account': 'account',
  'FinancialYear': 'financialYear',
  'Project': 'project',
  'FinancialReportConfig': 'financialReportConfig',
  'Donor': 'donor',
  'Location': 'location',
  'Client': 'client',
  'Customer': 'customer',
  'Supplier': 'supplier',
  'Voucher': 'voucher',
  'VoucherEntry': 'voucherEntry',
  'VoucherApproval': 'voucherApproval',
  'VoucherAttachment': 'voucherAttachment',
  'BankStatement': 'bankStatement',
  'BankStatementItem': 'bankStatementItem',
  'BankReconciliationItem': 'bankReconciliationItem',
  'BankReconciliation': 'bankReconciliation',
  'Budget': 'budget',
  'BudgetLine': 'budgetLine',
  'TaxRate': 'taxRate',
  'TaxCalculation': 'taxCalculation',
  'AccountBalance': 'accountBalance',
  'FixedAsset': 'fixedAsset',
  'FixedAssetDepreciation': 'fixedAssetDepreciation',
  'AssetTransaction': 'assetTransaction',
  'FAMSFiscalYear': 'famsFiscalYear',
  'FAMSJournal': 'famsJournal',
  'FAMSExportBatch': 'famsExportBatch',
  'FAMSSetting': 'famsSetting',
  'Employee': 'employee',
  'DocumentType': 'documentType',
  'EmployeeDocument': 'employeeDocument',
  'DocumentAuditLog': 'documentAuditLog',
  'EmployeeSalaryHistory': 'employeeSalaryHistory',
  'EmployeeProjectAssignment': 'employeeProjectAssignment',
  'Allowance': 'allowance',
  'EmployeeAllowance': 'employeeAllowance',
  'Attendance': 'attendance',
  'AttendanceDailyProject': 'attendanceDailyProject',
  'ProjectCostLedger': 'projectCostLedger',
  'Loan': 'loan',
  'LoanInstallment': 'loanInstallment',
  'TaxSlab': 'taxSlab',
  'PayrollAccountMapping': 'payrollAccountMapping',
  'FinalSettlement': 'finalSettlement',
  'PayrollBatch': 'payrollBatch',
  'PayrollBatchLine': 'payrollBatchLine',
  'ImportLog': 'importLog',
  'ExportLog': 'exportLog',
  'SystemSetting': 'systemSetting',
}

function sqliteTableToModel(tableName: string): string | null {
  // Try direct mapping first
  if (TABLE_TO_MODEL[tableName]) return TABLE_TO_MODEL[tableName]
  // Try case-insensitive
  const lower = tableName.toLowerCase()
  for (const [key, value] of Object.entries(TABLE_TO_MODEL)) {
    if (key.toLowerCase() === lower) return value
  }
  return null
}

// ============================================================
// Data Transformation
// ============================================================

// Fields that contain JSON data and need special handling
const JSON_FIELDS: Record<string, string[]> = {
  'UserSession': ['deviceInfo', 'geoLocation'],
  'LoginHistory': ['geoLocation'],
  'RolePermission': ['conditions'],
  'UserPermission': ['conditions'],
  'SecurityPolicy': ['ipWhitelist', 'ipBlacklist', 'geoRestrictions', 'allowedLoginHours'],
  'ApprovalWorkflow': [],
  'WorkflowStep': ['condition'],
  'FinancialReportConfig': ['projectIds'],
  'FAMSFiscalYear': ['depRunStatus'],
  'PayrollBatchLine': ['allowanceDetails', 'scBreakdown', 'taxBreakdown', 'projectAllocations', 'contractEarnings'],
  'AuditLog': ['details', 'oldValues', 'newValues'],
  'ImportLog': ['errors'],
  'ExportLog': ['parameters'],
}

// Fields that are boolean and need type coercion
const BOOLEAN_FIELDS: Record<string, string[]> = {
  'Branch': ['isActive'],
  'Department': ['isActive'],
  'User': ['isActive', 'isLocked', 'forcePasswordChange'],
  'Role': ['isSystem', 'isActive'],
  'Permission': ['isActive'],
  'RolePermission': ['isGranted'],
  'UserRole': ['isPrimary'],
  'UserPermission': ['isGranted'],
  'UserSession': ['isActive'],
  'SecurityPolicy': [
    'passwordRequireUppercase', 'passwordRequireLowercase', 'passwordRequireNumbers',
    'passwordRequireSpecial', 'lockoutIncrementDuration', 'singleSessionEnforcement',
    'allowRememberMe', 'requireMfa', 'isDefault', 'isActive'
  ],
  'ApprovalWorkflow': ['isActive'],
  'WorkflowStep': ['isParallel', 'isRequired'],
  'Account': ['isActive', 'isSystem', 'allowPosting'],
  'Project': ['isHeadOffice'],
  'Client': ['isActive'],
  'Customer': ['isActive'],
  'Supplier': ['isActive'],
  'Voucher': ['isPayrollPosted', 'isAssetPosted', 'isReconciled'],
  'VoucherAttachment': ['isVerified'],
  'BankStatementItem': ['isMatched'],
  'TaxRate': ['isActive'],
  'TaxCalculation': ['postedToGL'],
  'FixedAsset': ['isDonorFunded'],
  'FixedAssetDepreciation': ['isPosted', 'isTaxDepreciation'],
  'Allowance': ['isTaxable', 'isProjectSpecific', 'isActive', 'baseOnSalary'],
  'EmployeeAllowance': ['isActive'],
  'EmployeeProjectAssignment': ['isActive'],
  'Employee': ['eobiEnabled', 'pfEnabled', 'incomeTaxEnabled', 'essiEnabled', 'gratuityEnabled', 'applyToAllProjects', 'isFinancialUsed'],
  'DocumentType': ['isRequired', 'hasExpiry', 'isActive'],
  'EmployeeDocument': ['isArchived'],
  'Loan': ['isDisbursed'],
  'TaxSlab': ['isActive'],
  'PayrollAccountMapping': ['isActive'],
  'SystemSetting': ['isPublic'],
}

// Float fields that need coercion
const FLOAT_FIELDS_PER_MODEL: Record<string, string[]> = {
  'Account': ['openingBalance'],
  'Customer': ['creditLimit', 'openingBalance'],
  'Supplier': ['openingBalance'],
  'Voucher': ['totalDebit', 'totalCredit'],
  'VoucherEntry': ['debit', 'credit'],
  'BankStatement': ['openingBalance', 'closingBalance'],
  'BankStatementItem': ['amount'],
  'BankReconciliationItem': [],
  'BankReconciliation': ['statementBalance', 'bookBalance', 'unpresentedTotal', 'uncreditedTotal', 'adjustedBookBalance', 'adjustedBankBalance'],
  'Budget': ['totalAmount'],
  'BudgetLine': ['budgetAmount', 'actualAmount', 'commitmentAmount'],
  'TaxRate': ['rate'],
  'TaxCalculation': ['baseAmount', 'taxAmount'],
  'AccountBalance': ['openingDebit', 'openingCredit', 'periodDebit', 'periodCredit', 'closingDebit', 'closingCredit'],
  'FixedAsset': ['purchasePrice', 'residualValue', 'decliningRate', 'insuranceValue', 'taxRate', 'accumulatedDepreciation', 'netBookValue'],
  'FixedAssetDepreciation': ['openingNBV', 'depreciationCharge', 'accumulatedDepreciation', 'closingNBV', 'taxOpeningWDV', 'taxCharge', 'taxClosingWDV'],
  'AssetTransaction': ['amount', 'proceeds', 'gainLoss', 'newValue'],
  'FAMSJournal': ['drAmount', 'crAmount'],
  'FAMSExportBatch': ['totalDrAmount', 'totalCrAmount'],
  'Employee': ['baseSalary'],
  'EmployeeSalaryHistory': ['previousSalary', 'newSalary'],
  'EmployeeProjectAssignment': ['salaryAmount', 'allocationValue'],
  'Allowance': ['value'],
  'EmployeeAllowance': ['customValue'],
  'Attendance': ['overtimeHours'],
  'ProjectCostLedger': ['salaryShare', 'scShare', 'scBalance', 'scOtherPayable', 'scEarnedLeave', 'scSickLeave', 'scCasualLeave'],
  'Loan': ['principalAmount', 'interestRate', 'disbursedAmount', 'balanceAmount', 'monthlyDeduction'],
  'LoanInstallment': ['amount', 'principalPart', 'interestPart', 'paidAmount'],
  'TaxSlab': ['minAmount', 'maxAmount', 'fixedAmount', 'rate'],
  'FinalSettlement': ['basicSalary', 'unpaidSalary', 'leaveEncashment', 'gratuity', 'socialChargesPayout', 'loanBalance', 'advanceBalance', 'otherDeductions', 'totalPayable', 'totalDeductions', 'netSettlement'],
  'PayrollBatch': ['totalBasicSalary', 'totalAllowances', 'totalGross', 'totalIncomeTax', 'totalEobiEmployee', 'totalEobiEmployer', 'totalPfEmployee', 'totalPfEmployer', 'totalLoanDeduction', 'totalAdvanceDeduction', 'totalOtherDeductions', 'totalDeductions', 'totalNetPay', 'totalEmployerCharges', 'totalSocialCharges', 'totalGratuity', 'totalEssiEmployee', 'totalEssiEmployer'],
  'PayrollBatchLine': ['basicSalary', 'dailyRate', 'allowances', 'grossSalary', 'incomeTax', 'eobiEmployee', 'eobiEmployer', 'pfEmployee', 'pfEmployer', 'loanDeduction', 'advanceDeduction', 'otherDeductions', 'totalDeductions', 'netPay', 'socialCharges', 'gratuity', 'essiEmployee', 'essiEmployer'],
}

// Date fields that need coercion
const DATE_FIELDS_PER_MODEL: Record<string, string[]> = {
  'Branch': ['createdAt', 'updatedAt'],
  'Department': ['createdAt', 'updatedAt'],
  'User': ['lockedUntil', 'lastLoginAt', 'passwordChangedAt', 'passwordExpiresAt', 'deletedAt', 'createdAt', 'updatedAt'],
  'Role': ['createdAt', 'updatedAt'],
  'Permission': ['createdAt', 'updatedAt'],
  'RolePermission': ['createdAt'],
  'UserRole': ['grantedAt', 'expiresAt'],
  'UserPermission': ['createdAt', 'expiresAt'],
  'UserSession': ['expiresAt', 'lastActivityAt', 'createdAt'],
  'LoginHistory': ['createdAt'],
  'PasswordHistory': ['changedAt', 'createdAt'],
  'SecurityPolicy': ['createdAt', 'updatedAt'],
  'ApprovalWorkflow': ['createdAt', 'updatedAt'],
  'WorkflowStep': ['createdAt', 'updatedAt'],
  'ApprovalInstance': ['requestedAt', 'completedAt', 'createdAt', 'updatedAt'],
  'ApprovalInstanceStep': ['actionDate', 'createdAt', 'updatedAt'],
  'AuditLog': ['createdAt'],
  'Account': ['createdAt', 'updatedAt'],
  'FinancialYear': ['startDate', 'endDate', 'closedAt', 'createdAt', 'updatedAt'],
  'Project': ['startDate', 'endDate', 'createdAt', 'updatedAt'],
  'FinancialReportConfig': ['fromDate', 'toDate', 'createdAt', 'updatedAt'],
  'Donor': ['createdAt', 'updatedAt'],
  'Location': ['createdAt', 'updatedAt'],
  'Client': ['createdAt', 'updatedAt'],
  'Customer': ['createdAt', 'updatedAt'],
  'Supplier': ['createdAt', 'updatedAt'],
  'Voucher': ['date', 'chequeDate', 'clearanceDate', 'createdAt', 'updatedAt'],
  'VoucherApproval': ['createdAt'],
  'VoucherAttachment': ['createdAt'],
  'BankStatement': ['statementDate', 'importedAt', 'createdAt'],
  'BankStatementItem': ['date'],
  'BankReconciliationItem': ['reconciliationDate', 'createdAt'],
  'BankReconciliation': ['finalizedAt', 'createdAt', 'updatedAt'],
  'Budget': ['createdAt', 'updatedAt'],
  'TaxRate': ['effectiveFrom', 'effectiveTo', 'createdAt'],
  'TaxCalculation': ['calculatedAt', 'createdAt'],
  'FixedAsset': ['dateOfPurchase', 'dateOfCapitalization', 'warrantyExpiryDate', 'insuranceExpiryDate', 'createdAt', 'updatedAt'],
  'FixedAssetDepreciation': ['createdAt'],
  'AssetTransaction': ['date', 'createdAt'],
  'FAMSFiscalYear': ['startDate', 'endDate', 'openedAt', 'closedAt', 'createdAt', 'updatedAt'],
  'FAMSJournal': ['date', 'createdAt', 'exportedAt'],
  'FAMSExportBatch': ['exportDate', 'createdAt'],
  'Employee': ['dateOfBirth', 'joiningDate', 'leavingDate', 'createdAt', 'updatedAt'],
  'DocumentType': ['createdAt', 'updatedAt'],
  'EmployeeDocument': ['issueDate', 'expiryDate', 'createdAt', 'updatedAt'],
  'DocumentAuditLog': ['createdAt'],
  'EmployeeSalaryHistory': ['effectiveDate', 'createdAt'],
  'EmployeeProjectAssignment': ['startDate', 'endDate', 'createdAt', 'updatedAt'],
  'EmployeeAllowance': ['effectiveDate', 'createdAt', 'updatedAt'],
  'Attendance': ['date', 'createdAt', 'updatedAt'],
  'AttendanceDailyProject': ['date'],
  'ProjectCostLedger': ['month', 'createdAt'],
  'Loan': ['disbursementDate', 'startDate', 'endDate', 'createdAt', 'updatedAt'],
  'LoanInstallment': ['dueDate', 'paidDate', 'createdAt', 'updatedAt'],
  'FinalSettlement': ['leavingDate', 'createdAt', 'updatedAt'],
  'PayrollBatch': ['createdAt', 'updatedAt'],
  'ImportLog': ['createdAt'],
  'ExportLog': ['createdAt'],
  'SystemSetting': ['updatedAt'],
}

function transformRow(tableName: string, row: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = {}

  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue

    // Handle null values
    if (value === null || value === '') {
      // Keep empty strings for required String fields
      if (value === '' && key === 'passwordHash') {
        transformed[key] = ''
      } else if (value === '' && key === 'narration') {
        transformed[key] = ''
      } else if (value === null && key === 'value' && tableName === 'SystemSetting') {
        transformed[key] = ''  // SystemSetting.value is required, default to empty string
      } else {
        transformed[key] = value === '' ? null : value
      }
      continue
    }

    // Transform boolean fields
    const boolFields = BOOLEAN_FIELDS[tableName] || []
    if (boolFields.includes(key)) {
      const boolVal = parseBoolean(value)
      transformed[key] = boolVal !== null ? boolVal : false
      continue
    }

    // Transform date fields (explicit list)
    const dateFields = DATE_FIELDS_PER_MODEL[tableName] || []
    if (dateFields.includes(key)) {
      const dateVal = parseDate(value)
      transformed[key] = dateVal
      continue
    }

    // Auto-detect: SQLite stores DateTime as integer milliseconds via Prisma
    if (typeof value === 'number' && value > 1_000_000_000_000 && Number.isInteger(value)) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        transformed[key] = d
        continue
      }
    }

    // Transform float fields
    const floatFields = FLOAT_FIELDS_PER_MODEL[tableName] || []
    if (floatFields.includes(key)) {
      transformed[key] = parseFloat(value) ?? 0
      continue
    }

    // Default: pass through
    transformed[key] = value
  }

  return transformed
}

// ============================================================
// Migration Logic
// ============================================================

interface MigrationStats {
  table: string
  total: number
  migrated: number
  skipped: number
  errors: number
  durationMs: number
}

async function migrateTable(
  db: any,
  tableName: string,
  modelName: string
): Promise<MigrationStats> {
  const startTime = Date.now()
  const stats: MigrationStats = {
    table: tableName,
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
  }

  try {
    stats.total = getSQLiteRowCount(db, tableName)
    if (stats.total === 0) {
      logInfo(`  ${tableName}: 0 records - skipping`)
      stats.durationMs = Date.now() - startTime
      return stats
    }

    logInfo(`  ${tableName}: ${stats.total} records to migrate`)

    if (DRY_RUN) {
      logInfo(`  ${tableName}: DRY RUN - would migrate ${stats.total} records`)
      stats.migrated = stats.total
      stats.durationMs = Date.now() - startTime
      return stats
    }

    // Get the Prisma delegate
    const prismaDelegate = (prisma as any)[modelName]
    if (!prismaDelegate) {
      logWarning(`  ${tableName}: No Prisma delegate found for model "${modelName}" - skipping`)
      stats.skipped = stats.total
      stats.durationMs = Date.now() - startTime
      return stats
    }

    // Migrate in batches
    let offset = 0
    while (offset < stats.total) {
      const rows = getSQLiteRows(db, tableName, offset, BATCH_SIZE)

      for (const row of rows) {
        try {
          const transformed = transformRow(tableName, row)
          await prismaDelegate.create({
            data: transformed,
          })
          stats.migrated++
        } catch (error: any) {
          stats.errors++
          // Log first few errors, then suppress
          if (stats.errors <= 5) {
            logWarning(`  ${tableName}: Error inserting record (id=${row.id || 'unknown'}): ${error.message?.substring(0, 200)}`)
          }
          if (stats.errors === 5) {
            logWarning(`  ${tableName}: Suppressing further error messages...`)
          }
        }
      }

      offset += BATCH_SIZE

      // Progress report
      const progress = Math.min(offset, stats.total)
      const pct = ((progress / stats.total) * 100).toFixed(1)
      if (progress % (BATCH_SIZE * 5) === 0 || progress === stats.total) {
        logInfo(`  ${tableName}: ${progress}/${stats.total} (${pct}%) - ${stats.errors} errors`)
      }
    }

    if (stats.errors > 0) {
      logWarning(`  ${tableName}: Completed with ${stats.errors} errors out of ${stats.total} records`)
    }

  } catch (error: any) {
    logError(`  ${tableName}: Failed - ${error.message}`)
    stats.errors = stats.total - stats.migrated
  }

  stats.durationMs = Date.now() - startTime
  return stats
}

// ============================================================
// Main Migration
// ============================================================

async function main() {
  const overallStart = Date.now()

  log('============================================')
  log('AcctFin ERP - SQLite to PostgreSQL Migration')
  log('============================================')
  log(`SQLite DB:      ${SQLITE_DB_PATH}`)
  log(`DATABASE_URL:   ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`)
  log(`Batch Size:     ${BATCH_SIZE}`)
  log(`Dry Run:        ${DRY_RUN}`)
  log(`Skip Tables:    ${SKIP_TABLES.length > 0 ? SKIP_TABLES.join(', ') : 'none'}`)
  log(`Only Tables:    ${ONLY_TABLES.length > 0 ? ONLY_TABLES.join(', ') : 'all'}`)
  log('============================================')

  // Step 1: Open SQLite database
  log('\n--- Step 1: Opening SQLite database ---')
  const db = await openSQLite(SQLITE_DB_PATH)

  // Step 2: Verify PostgreSQL connection
  log('\n--- Step 2: Verifying PostgreSQL connection ---')
  try {
    await prisma.$queryRaw`SELECT 1`
    logSuccess('PostgreSQL connection verified')
  } catch (error) {
    logError('Cannot connect to PostgreSQL. Check DATABASE_URL.', error)
    process.exit(1)
  }

  // Step 3: List SQLite tables
  log('\n--- Step 3: Inspecting SQLite database ---')
  const sqliteTables = getSQLiteTables(db)
  logInfo(`Found ${sqliteTables.length} tables in SQLite: ${sqliteTables.join(', ')}`)

  // Step 4: Determine migration order
  log('\n--- Step 4: Planning migration order ---')
  const tablesToMigrate: Array<{ tableName: string; modelName: string }> = []

  for (const modelName of MIGRATION_ORDER) {
    // Find the SQLite table name for this model
    const tableName = Object.entries(TABLE_TO_MODEL).find(([_, v]) => v === modelName)?.[0]
    if (!tableName) continue

    // Check if table exists in SQLite
    if (!sqliteTables.includes(tableName)) continue

    // Check skip/only filters
    if (SKIP_TABLES.includes(modelName) || SKIP_TABLES.includes(tableName)) continue
    if (ONLY_TABLES.length > 0 && !ONLY_TABLES.includes(modelName) && !ONLY_TABLES.includes(tableName)) continue

    tablesToMigrate.push({ tableName, modelName })
  }

  logInfo(`Will migrate ${tablesToMigrate.length} tables in the following order:`)
  for (const { tableName } of tablesToMigrate) {
    const count = getSQLiteRowCount(db, tableName)
    log(`  ${tableName}: ${count} records`)
  }

  // Step 5: Migrate data
  log('\n--- Step 5: Migrating data ---')
  const allStats: MigrationStats[] = []

  for (const { tableName, modelName } of tablesToMigrate) {
    const stats = await migrateTable(db, tableName, modelName)
    allStats.push(stats)
  }

  // Step 6: Summary
  log('\n============================================')
  log('Migration Summary')
  log('============================================')

  let totalRecords = 0
  let totalMigrated = 0
  let totalErrors = 0

  for (const stats of allStats) {
    const status = stats.errors > 0 ? '⚠️ ' : stats.migrated > 0 ? '✅' : '⏭️ '
    log(`  ${status} ${stats.table}: ${stats.migrated}/${stats.total} migrated, ${stats.errors} errors (${stats.durationMs}ms)`)
    totalRecords += stats.total
    totalMigrated += stats.migrated
    totalErrors += stats.errors
  }

  const overallDuration = Date.now() - startTime
  log('============================================')
  log(`Total: ${totalMigrated}/${totalRecords} records migrated, ${totalErrors} errors`)
  log(`Duration: ${(overallDuration / 1000).toFixed(1)}s`)
  log('============================================')

  if (totalErrors > 0) {
    logWarning('Some records failed to migrate. Check the errors above and re-run after fixing issues.')
    logWarning('You can use ONLY_TABLES to re-migrate specific tables:')
    logWarning('  ONLY_TABLES=auditLog,importLog bun run db:migrate:sqlite-to-pg')
  }

  if (DRY_RUN) {
    logInfo('This was a DRY RUN. No data was written to PostgreSQL.')
    logInfo('Remove DRY_RUN=true to perform actual migration.')
  }

  // Cleanup
  if (sqliteDb) {
    sqliteDb.close()
  }
  await prisma.$disconnect()
}

// Need to define startTime before main()
const startTime = Date.now()

// Run
main().catch((error) => {
  logError('Migration failed with uncaught error', error)
  if (sqliteDb) {
    sqliteDb.close()
  }
  prisma.$disconnect()
  process.exit(1)
})
