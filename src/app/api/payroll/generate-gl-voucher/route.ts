import { withAudit } from '@/lib/audit-wrapper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findAccountByRole } from '@/lib/account-roles'
import { calculateMonthlyPayroll } from '@/lib/payroll/calculateMonthlyPayroll'

// ============================================================
// Salary Voucher Generation API — New 5-Line Structure
// ============================================================
// Per employee per project:
//   Line 1: DR  Salary Expense — [Project]
//   Line 2: DR  SC Expense — [Project]
//   Line 3: CR  Salary Payable  → Net Salary (Gross − Tax)
//   Line 4: CR  Tax Payable     → Tax Amount
//   Line 5: CR  SC Payable      → SC Amount
//
// Modes: project-wise, by-project, by-employee, combined
// Voucher Number: SV-YYYY-MM-ProjectCode-SequenceNo
// ============================================================

// ── Interfaces ──────────────────────────────────────────────

interface ProjectAllocation {
  projectId: string
  projectName: string
  projectCode: string
  days: number
  weight: number
  weightPct: string
  salaryShare: number
  scShare: number
}

interface ContractEarning {
  assignmentId: string
  projectId: string
  projectName: string
  projectCode: string
  contractSalary: number
  dailyRate: number
  daysWorked: number
  earnedSalary: number
  absentDays: number
  designation: string
  scShare: number
}

interface EmployeePayrollData {
  employeeId: string
  employeeName: string
  employeeCode: string
  grossSalary: number
  tax: number
  netSalary: number
  sc: number
  eobiEmployee: number
  pfEmployee: number
  essiEmployee: number
  loanDeduction: number
  salaryExpenseAccountId: string | null
  scExpenseAccountId: string | null
  salaryPayableAccountId: string | null
  scPayableAccountId: string | null
  taxPayableAccountId: string | null
  projectAllocations: {
    projectId: string
    projectCode: string
    projectName: string
    weightPct: string
    weight: number
    salaryShare: number
    scShare: number
  }[]
}

interface VoucherResult {
  voucherId: string
  voucherNumber: string
  employeeName: string
  employeeCode: string
  project: string
  projectCode: string
  projectName: string
  period: string
  totalDebit: number
  totalCredit: number
  balanced: boolean
  status: string
  employeeCount: number
  entries: Array<{
    lineNumber: number
    accountId: string
    accountCode: string
    accountName: string
    debit: number
    credit: number
    description: string
  }>
  breakdown: {
    grossSalary: number
    tax: number
    netSalary: number
    sc: number
    weightPct: string
  }
}

interface ValidationError {
  employeeId: string
  employeeName: string
  field: string
  message: string
}

// ── Helpers ─────────────────────────────────────────────────

function safeParseJson<T>(value: string | null | undefined): T[] {
  if (!value) return []
  try {
    return JSON.parse(value) as T[]
  } catch {
    return []
  }
}

function formatProjectSuffix(code: string): string {
  return code.toUpperCase().replace(/[\s\-]+/g, '').substring(0, 8)
}

/**
 * Resolve an account ID using the fallback chain:
 * 1. Employee-specific account mapping
 * 2. PayrollAccountMapping table
 * 3. findAccountByRole (account-roles)
 * 4. Look up by account code prefix (hierarchical CoA)
 * 5. Look up by account name pattern
 *
 * The CoA uses hierarchical codes like "05-01-01-0002", "03-02-02-0001".
 * Fallback patterns must match these, not simple codes like "5001".
 */
async function resolveAccount(
  employeeAccountId: string | null,
  componentType: string,
  roleKey: string,
  fallbackCodePrefix: string,
  fallbackNamePattern: string
): Promise<string | null> {
  // 1. Employee-specific account
  if (employeeAccountId) return employeeAccountId

  // 2. PayrollAccountMapping table
  const mapping = await db.payrollAccountMapping.findFirst({
    where: { componentType, isActive: true },
  })
  if (mapping?.debitAccountId) return mapping.debitAccountId
  if (mapping?.creditAccountId) return mapping.creditAccountId

  // 3. Account role lookup
  const roleAccount = await findAccountByRole(roleKey)
  if (roleAccount?.id) return roleAccount.id

  // 4. Code prefix fallback (hierarchical CoA e.g. "05-01-01" matches "05-01-01-0002")
  //    Prefer the most specific (longest) code that starts with the prefix and is a leaf account
  const codeAccounts = await db.account.findMany({
    where: { code: { startsWith: fallbackCodePrefix }, isActive: true },
    select: { id: true, code: true },
    orderBy: { code: 'desc' },
  })
  if (codeAccounts.length > 0) {
    // Prefer leaf accounts (those with 4+ segments like "05-01-01-0002") over parent accounts
    const leaf = codeAccounts.find(a => a.code.split('-').length >= 4)
    if (leaf) return leaf.id
    // Fall back to the first (most specific) matching account
    return codeAccounts[0].id
  }

  // 5. Name pattern fallback (case-insensitive contains)
  if (fallbackNamePattern) {
    const nameAccount = await db.account.findFirst({
      where: {
        name: { contains: fallbackNamePattern },
        isActive: true,
      },
      select: { id: true },
    })
    if (nameAccount?.id) return nameAccount.id
  }

  return null
}

/**
 * Get the next sequence number for a voucher prefix.
 * E.g., for prefix "SV-2025-05-AGESHO", looks for existing vouchers
 * starting with that prefix and returns next sequence.
 */
async function getNextVoucherSequence(prefix: string): Promise<number> {
  const existing = await db.voucher.findMany({
    where: { voucherNumber: { startsWith: prefix } },
    select: { voucherNumber: true },
  })

  let maxSeq = 0
  for (const v of existing) {
    // Extract the sequence number from the end (after last dash)
    const parts = v.voucherNumber.split('-')
    const seqStr = parts[parts.length - 1]
    const seq = parseInt(seqStr, 10)
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
  }

  return maxSeq + 1
}

/**
 * Fetch employee payroll data for non-batch modes
 * using calculateMonthlyPayroll
 */
async function fetchEmployeePayrollData(
  employeeIds: string[],
  period: string
): Promise<EmployeePayrollData[]> {
  const [yearStr, monthStr] = period.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const monthDate = new Date(Date.UTC(year, month - 1, 1))

  const results: EmployeePayrollData[] = []

  for (const empId of employeeIds) {
    try {
      const payroll = await calculateMonthlyPayroll(empId, monthDate)

      // Fetch employee account mappings
      const employee: {
        salaryExpenseAccountId: string | null
        scExpenseAccountId: string | null
        salaryPayableAccountId: string | null
        scPayableAccountId: string | null
        taxPayableAccountId: string | null
      } | null = await db.employee.findUnique({
        where: { id: empId },
        select: {
          salaryExpenseAccountId: true,
          scExpenseAccountId: true,
          salaryPayableAccountId: true,
          scPayableAccountId: true,
          taxPayableAccountId: true,
        },
      })

      results.push({
        employeeId: payroll.employee.id,
        employeeName: payroll.employee.name,
        employeeCode: payroll.employee.employeeCode,
        grossSalary: Math.round(payroll.grossSalary),
        tax: Math.round(payroll.deductions.incomeTax),
        netSalary: Math.round(payroll.netPay),
        sc: Math.round(payroll.finalSC),
        eobiEmployee: Math.round(payroll.deductions.eobiEmployee),
        pfEmployee: Math.round(payroll.deductions.pfEmployee),
        essiEmployee: Math.round(payroll.deductions.essiEmployee),
        loanDeduction: Math.round(payroll.deductions.loanDeduction),
        salaryExpenseAccountId: employee?.salaryExpenseAccountId ?? null,
        scExpenseAccountId: employee?.scExpenseAccountId ?? null,
        salaryPayableAccountId: employee?.salaryPayableAccountId ?? null,
        scPayableAccountId: employee?.scPayableAccountId ?? null,
        taxPayableAccountId: employee?.taxPayableAccountId ?? null,
        projectAllocations: payroll.projectAllocations.map(pa => ({
          projectId: pa.projectId,
          projectCode: pa.projectCode,
          projectName: pa.projectName,
          weightPct: pa.weightPct,
          weight: pa.weight,
          salaryShare: Math.round(pa.salaryShare),
          scShare: Math.round(pa.scShare),
        })),
      })
    } catch (err) {
      console.error(`Failed to calculate payroll for employee ${empId}:`, err)
    }
  }

  return results
}

/**
 * Fetch employee payroll data from batch lines (project-wise mode)
 */
async function fetchBatchLinePayrollData(
  approvedLines: Array<{
    id: string
    employeeId: string
    employeeName: string
    employeeCode: string | null
    grossSalary: number
    incomeTax: number
    netPay: number
    socialCharges: number
    basicSalary: number
    allowances: number
    projectAllocations: string | null
    contractEarnings: string | null
    projectId: string | null
    payableDays: number
    eobiEmployee: number
    pfEmployee: number
    essiEmployee: number
    loanDeduction: number
  }>
): Promise<EmployeePayrollData[]> {
  const results: EmployeePayrollData[] = []

  // Batch fetch employee account mappings
  const employeeIds = [...new Set(approvedLines.map(l => l.employeeId))]
  const employees = await db.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      salaryExpenseAccountId: true,
      scExpenseAccountId: true,
      salaryPayableAccountId: true,
      scPayableAccountId: true,
      taxPayableAccountId: true,
    },
  })
  const employeeMap = new Map<string, typeof employees[0]>(employees.map(e => [e.id, e]))

  for (const line of approvedLines) {
    const emp = employeeMap.get(line.employeeId)

    // Parse project allocations and contract earnings
    const allocations = safeParseJson<ProjectAllocation>(line.projectAllocations)
    const contracts = safeParseJson<ContractEarning>(line.contractEarnings)

    // Build project allocations from available data
    const projectAllocs: EmployeePayrollData['projectAllocations'] = []

    if (allocations.length > 0) {
      for (const alloc of allocations) {
        projectAllocs.push({
          projectId: alloc.projectId,
          projectCode: alloc.projectCode,
          projectName: alloc.projectName,
          weightPct: typeof alloc.weightPct === 'string' ? alloc.weightPct : `${Math.round(alloc.weight * 100)}%`,
          weight: alloc.weight,
          salaryShare: Math.round(alloc.salaryShare),
          scShare: Math.round(alloc.scShare),
        })
      }
    } else if (contracts.length > 0) {
      for (const ce of contracts) {
        const weight = line.basicSalary > 0 ? ce.earnedSalary / line.basicSalary : 0
        projectAllocs.push({
          projectId: ce.projectId,
          projectCode: ce.projectCode,
          projectName: ce.projectName,
          weightPct: `${Math.round(weight * 100)}%`,
          weight,
          salaryShare: Math.round(ce.earnedSalary),
          scShare: Math.round(ce.scShare),
        })
      }
    } else if (line.projectId) {
      // Single project fallback
      const project = await db.project.findUnique({
        where: { id: line.projectId },
        select: { code: true, name: true },
      })
      projectAllocs.push({
        projectId: line.projectId,
        projectCode: project?.code || 'UNK',
        projectName: project?.name || 'Unknown',
        weightPct: '100%',
        weight: 1,
        salaryShare: Math.round(line.grossSalary),
        scShare: Math.round(line.socialCharges),
      })
    }

    results.push({
      employeeId: line.employeeId,
      employeeName: line.employeeName,
      employeeCode: line.employeeCode || '',
      grossSalary: Math.round(line.grossSalary),
      tax: Math.round(line.incomeTax),
      netSalary: Math.round(line.netPay),
      sc: Math.round(line.socialCharges),
      eobiEmployee: Math.round(line.eobiEmployee ?? 0),
      pfEmployee: Math.round(line.pfEmployee ?? 0),
      essiEmployee: Math.round(line.essiEmployee ?? 0),
      loanDeduction: Math.round(line.loanDeduction ?? 0),
      salaryExpenseAccountId: emp?.salaryExpenseAccountId ?? null,
      scExpenseAccountId: emp?.scExpenseAccountId ?? null,
      salaryPayableAccountId: emp?.salaryPayableAccountId ?? null,
      scPayableAccountId: emp?.scPayableAccountId ?? null,
      taxPayableAccountId: emp?.taxPayableAccountId ?? null,
      projectAllocations: projectAllocs,
    })
  }

  return results
}

/**
 * Generate 5-line salary vouchers for a list of employees
 */
async function generateSalaryVouchers(
  employees: EmployeePayrollData[],
  period: string,
  financialYearId: string,
  projectFilter?: string[]
): Promise<{ vouchers: VoucherResult[]; validationErrors: ValidationError[] }> {
  const vouchers: VoucherResult[] = []
  const validationErrors: ValidationError[] = []

  // Pre-cache account resolutions for performance
  const accountCache = new Map<string, string | null>()

  const resolveCached = async (
    empAccountId: string | null,
    componentType: string,
    roleKey: string,
    fallbackCodePrefix: string,
    fallbackNamePattern: string
  ): Promise<string | null> => {
    const cacheKey = `${empAccountId || 'none'}|${componentType}|${roleKey}|${fallbackCodePrefix}|${fallbackNamePattern}`
    if (accountCache.has(cacheKey)) return accountCache.get(cacheKey)!

    const result = await resolveAccount(empAccountId, componentType, roleKey, fallbackCodePrefix, fallbackNamePattern)
    accountCache.set(cacheKey, result)
    return result
  }

  for (const emp of employees) {
    // ── Validation ──
    if (!emp.salaryExpenseAccountId) {
      // Check if we can resolve via fallback chain
      const resolved = await resolveCached(null, 'SALARY_EXPENSE', 'SALARY_EXPENSE', '05-01-01', 'Salary')
      if (!resolved) {
        validationErrors.push({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          field: 'salaryExpenseAccountId',
          message: 'Salary Expense Account not mapped for this employee',
        })
        continue
      }
    }

    // Resolve tax payable account
    const taxPayableAccount = await resolveCached(
      emp.taxPayableAccountId, 'INCOME_TAX_PAYABLE', 'INCOME_TAX_PAYABLE', '03-02-07', 'WHT Payable Employees'
    )
    if (!taxPayableAccount && emp.tax > 0) {
      validationErrors.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        field: 'taxPayableAccountId',
        message: 'Tax Payable Account not mapped',
      })
      continue
    }

    // Tax exceeds gross salary
    if (emp.tax > emp.grossSalary) {
      validationErrors.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        field: 'tax',
        message: `Tax amount (${emp.tax}) exceeds gross salary (${emp.grossSalary})`,
      })
      continue
    }

    // Negative net salary
    const netSalary = emp.grossSalary - emp.tax
    if (netSalary < 0) {
      validationErrors.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        field: 'netSalary',
        message: 'Net salary after tax deduction is negative',
      })
      continue
    }

    // Check project allocation weights total
    const totalWeight = emp.projectAllocations.reduce((sum, pa) => sum + pa.weight, 0)
    if (emp.projectAllocations.length > 0 && Math.abs(totalWeight - 1) > 0.02) {
      // Warn but don't block
      validationErrors.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        field: 'projectAllocations',
        message: `Project allocation weights total ${(totalWeight * 100).toFixed(1)}% instead of 100% — vouchers will still be generated`,
      })
    }

    // Check project allocation totals 100%
    const allocTotalWeight = emp.projectAllocations.reduce((sum, pa) => sum + pa.weight, 0)
    if (emp.projectAllocations.length > 0 && Math.abs(allocTotalWeight - 1) > 0.02) {
      validationErrors.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        field: 'projectAllocations',
        message: `Employee ${emp.employeeName} project allocation totals ${(allocTotalWeight * 100).toFixed(1)}%. Must be exactly 100%.`,
      })
    }

    // Filter by project if specified
    const filteredAllocs = projectFilter
      ? emp.projectAllocations.filter(pa => projectFilter.includes(pa.projectId))
      : emp.projectAllocations

    if (filteredAllocs.length === 0) continue

    // ── Use pre-computed per-project shares directly ──
    // For multi-contract employees, salaryShare/scShare are already the correct
    // per-project earned amounts — do NOT re-split from totals using weight.
    // Only use weight-based distribution as fallback when salaryShare is missing.
    const useDirectShares = filteredAllocs.every(a => a.salaryShare > 0)

    // Rounding-safe distribution (fallback only)
    const distributeWithRounding = (total: number, allocs: typeof filteredAllocs): number[] => {
      const shares = allocs.map(a => Math.round(total * a.weight))
      const distributed = shares.reduce((s, v) => s + v, 0)
      const diff = Math.round(total) - distributed
      const lastIdx = allocs.reduce((last, a, i) => (a.weight > 0 ? i : last), -1)
      if (lastIdx >= 0) shares[lastIdx] += diff
      return shares
    }

    // Deduction totals for distribution
    const eobiEmpTotal = emp.eobiEmployee ?? 0
    const pfEmpTotal = emp.pfEmployee ?? 0
    const essiEmpTotal = emp.essiEmployee ?? 0
    const loanTotal = emp.loanDeduction ?? 0

    // Compute gross shares: prefer stored salaryShare, fall back to weight-based
    const grossShares = useDirectShares
      ? filteredAllocs.map(a => Math.round(a.salaryShare))
      : distributeWithRounding(emp.grossSalary, filteredAllocs)

    // SC shares: prefer stored scShare
    const scShares = filteredAllocs.map(a => Math.round(a.scShare ?? 0))

    // Deductions: always distribute by weight (they are employee-level totals)
    const taxShares = distributeWithRounding(emp.tax, filteredAllocs)
    const eobiShares = distributeWithRounding(eobiEmpTotal, filteredAllocs)
    const pfShares = distributeWithRounding(pfEmpTotal, filteredAllocs)
    const essiShares = distributeWithRounding(essiEmpTotal, filteredAllocs)
    const loanShares = distributeWithRounding(loanTotal, filteredAllocs)

    // ── Generate one voucher per project ──
    for (let allocIdx = 0; allocIdx < filteredAllocs.length; allocIdx++) {
      const alloc = filteredAllocs[allocIdx]

      // Use rounding-safe pre-computed shares
      const salaryShare = grossShares[allocIdx]
      const taxShare = taxShares[allocIdx]
      const eobiShare = eobiShares[allocIdx]
      const pfShare = pfShares[allocIdx]
      const essiShare = essiShares[allocIdx]
      const loanShare = loanShares[allocIdx]
      const scShare = scShares[allocIdx]

      // Net salary = Gross − all employee deductions (tax + EOBI + PF + ESSI + loan)
      const netSalaryShare = salaryShare - taxShare - eobiShare - pfShare - essiShare - loanShare

      // Skip if no amounts
      if (salaryShare === 0 && scShare === 0) continue

      // Validate net salary is not negative
      if (netSalaryShare < 0) {
        validationErrors.push({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          field: 'netSalary',
          message: `Employee ${emp.employeeName} net salary is negative after deductions (Rs ${netSalaryShare}) for project ${alloc.projectCode}. Please review tax and deduction amounts.`,
        })
        continue
      }

      // ── Duplicate Prevention ──
      const projectSuffixCheck = formatProjectSuffix(alloc.projectCode)
      const voucherPrefixCheck = `SV-${projectSuffixCheck}-${period}`
      const existingVoucher = await db.voucher.findFirst({
        where: {
          voucherNumber: { startsWith: voucherPrefixCheck },
          projectId: alloc.projectId,
        },
        select: { id: true, voucherNumber: true, narration: true },
      })

      // Check if this specific employee already has a voucher for this project/period
      if (existingVoucher) {
        const existingEntries = await db.voucherEntry.findFirst({
          where: {
            voucherId: existingVoucher.id,
            description: { contains: emp.employeeName },
          },
        })
        if (existingEntries) {
          // Skip — duplicate voucher for this employee/project/period
          continue
        }
      }

      // ── Resolve accounts ──
      const salaryExpenseAccount = await resolveCached(
        emp.salaryExpenseAccountId, 'SALARY_EXPENSE', 'SALARY_EXPENSE', '05-01-01', 'Salary'
      )
      const scExpenseAccount = await resolveCached(
        emp.scExpenseAccountId, 'SOCIAL_CHARGES', 'SOCIAL_CHARGES', '05-01-02', 'Social Charges'
      )
      const salaryPayableAccount = await resolveCached(
        emp.salaryPayableAccountId, 'SALARY_PAYABLE', 'SALARY_PAYABLE', '03-02-02', 'Salary Payable'
      )
      const scPayableAccount = await resolveCached(
        emp.scPayableAccountId, 'SOCIAL_CHARGES_PAYABLE', 'SOCIAL_CHARGES_PAYABLE', '03-02-03', 'Social Charges Payable'
      )
      const eobiPayableAccount = await resolveCached(
        null, 'EOBI_EMPLOYEE', 'EOBI_PAYABLE', '03-02-03-0001', 'EOBI Payable'
      )
      const pfPayableAccount = await resolveCached(
        null, 'PF_EMPLOYEE', 'PROVIDENT_FUND_PAYABLE', '03-02-03-0002', 'Provident Fund Payable'
      )
      const essiPayableAccount = await resolveCached(
        null, 'ESSI_EMPLOYEE', 'ESSI_PAYABLE', '03-02-03', 'ESSI Payable'
      )
      const loanPayableAccount = await resolveCached(
        null, 'LOAN_DEDUCTION', 'LOAN_RECEIVABLE', '01-02-12', 'Loan Receivable'
      )

      // Validate critical accounts
      if (!salaryExpenseAccount) {
        validationErrors.push({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          field: 'salaryExpenseAccountId',
          message: `Employee ${emp.employeeName} is missing Salary Expense account. Please configure GL accounts before generating vouchers.`,
        })
        continue
      }
      if (!salaryPayableAccount) {
        validationErrors.push({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          field: 'salaryPayableAccountId',
          message: `Employee ${emp.employeeName} is missing Salary Payable account. Please configure GL accounts before generating vouchers.`,
        })
        continue
      }

      // ── Build journal lines ──
      const entries: {
        lineNumber: number
        accountId: string
        debit: number
        credit: number
        description: string
        payrollRef: string
        projectId: string
      }[] = []

      let lineNumber = 0
      const projLabel = ` — ${alloc.projectCode}`
      const payrollRef = `SV-${emp.employeeCode}-${period}-${formatProjectSuffix(alloc.projectCode)}`

      // ── DEBIT LINES (expense side) ──

      // Line 1: DR Salary Expense — [Project]
      lineNumber++
      entries.push({
        lineNumber,
        accountId: salaryExpenseAccount,
        debit: salaryShare,
        credit: 0,
        description: `Salary Expense${projLabel} — ${emp.employeeName}`,
        payrollRef,
        projectId: alloc.projectId,
      })

      // Line 2: DR SC Expense — [Project]
      if (scShare > 0 && scExpenseAccount) {
        lineNumber++
        entries.push({
          lineNumber,
          accountId: scExpenseAccount,
          debit: scShare,
          credit: 0,
          description: `SC Expense${projLabel} — ${emp.employeeName}`,
          payrollRef,
          projectId: alloc.projectId,
        })
      }

      // ── CREDIT LINES (liability side) ──

      // Line 3: CR Salary Payable → Net Salary (Gross − all employee deductions)
      lineNumber++
      entries.push({
        lineNumber,
        accountId: salaryPayableAccount,
        debit: 0,
        credit: netSalaryShare,
        description: `Net Salary Payable${projLabel} — ${emp.employeeName}`,
        payrollRef,
        projectId: alloc.projectId,
      })

      // Line 4: CR Tax Payable → Income Tax
      if (taxShare > 0 && taxPayableAccount) {
        lineNumber++
        entries.push({
          lineNumber,
          accountId: taxPayableAccount,
          debit: 0,
          credit: taxShare,
          description: `Income Tax Payable${projLabel} — ${emp.employeeName}`,
          payrollRef,
          projectId: alloc.projectId,
        })
      }

      // Line 5: CR SC Payable → Social Charges
      if (scShare > 0 && scPayableAccount) {
        lineNumber++
        entries.push({
          lineNumber,
          accountId: scPayableAccount,
          debit: 0,
          credit: scShare,
          description: `SC Payable${projLabel} — ${emp.employeeName}`,
          payrollRef,
          projectId: alloc.projectId,
        })
      }

      // Line 6: CR EOBI Payable → EOBI Employee Contribution
      if (eobiShare > 0 && eobiPayableAccount) {
        lineNumber++
        entries.push({
          lineNumber,
          accountId: eobiPayableAccount,
          debit: 0,
          credit: eobiShare,
          description: `EOBI Payable${projLabel} — ${emp.employeeName}`,
          payrollRef,
          projectId: alloc.projectId,
        })
      }

      // Line 7: CR PF Payable → Provident Fund Employee Contribution
      if (pfShare > 0 && pfPayableAccount) {
        lineNumber++
        entries.push({
          lineNumber,
          accountId: pfPayableAccount,
          debit: 0,
          credit: pfShare,
          description: `PF Payable${projLabel} — ${emp.employeeName}`,
          payrollRef,
          projectId: alloc.projectId,
        })
      }

      // Line 8: CR ESSI Payable → ESSI Employee Contribution
      if (essiShare > 0 && essiPayableAccount) {
        lineNumber++
        entries.push({
          lineNumber,
          accountId: essiPayableAccount,
          debit: 0,
          credit: essiShare,
          description: `ESSI Payable${projLabel} — ${emp.employeeName}`,
          payrollRef,
          projectId: alloc.projectId,
        })
      }

      // Line 9: CR Loan Receivable → Loan Recovery
      if (loanShare > 0 && loanPayableAccount) {
        lineNumber++
        entries.push({
          lineNumber,
          accountId: loanPayableAccount,
          debit: 0,
          credit: loanShare,
          description: `Loan Recovery${projLabel} — ${emp.employeeName}`,
          payrollRef,
          projectId: alloc.projectId,
        })
      }

      // ── VALIDATE BALANCE BEFORE SAVING ──
      const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
      const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

      if (Math.abs(totalDebit - totalCredit) > 1) {
        validationErrors.push({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          field: 'balance',
          message: `Voucher does not balance for ${emp.employeeName} / ${alloc.projectCode}: Debits Rs ${totalDebit.toLocaleString()} ≠ Credits Rs ${totalCredit.toLocaleString()}. Difference: Rs ${Math.abs(totalDebit - totalCredit).toLocaleString()}`,
        })
        continue
      }

      if (entries.length === 0) continue

      // ── Validate all account IDs exist before inserting ──
      const entryAccountIds = [...new Set(entries.map(e => e.accountId))]
      const existingAccounts = await db.account.findMany({
        where: { id: { in: entryAccountIds } },
        select: { id: true, code: true, name: true },
      })
      const existingAccountIds = new Set(existingAccounts.map(a => a.id))
      const missingAccountIds = entryAccountIds.filter(id => !existingAccountIds.has(id))
      if (missingAccountIds.length > 0) {
        validationErrors.push({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          field: 'accounts',
          message: `${missingAccountIds.length} GL account(s) not found for ${emp.employeeName} / ${alloc.projectCode}. Please configure GL accounts in PayrollAccountMapping or Employee profile.`,
        })
        continue
      }

      // ── Generate voucher number: SV-PROJECTCODE-YYYY-MM-SEQ ──
      const projectSuffix = formatProjectSuffix(alloc.projectCode)
      const voucherPrefix = `SV-${projectSuffix}-${period}`
      const seq = await getNextVoucherSequence(voucherPrefix)
      const voucherNumber = `${voucherPrefix}-${String(seq).padStart(3, '0')}`

      // ── Create voucher in DB ──
      const voucher = await db.voucher.create({
        data: {
          voucherNumber,
          voucherType: 'SV',
          voucherTypeName: 'Salary Voucher',
          date: new Date(),
          narration: `Salary Voucher for ${emp.employeeName} (${emp.employeeCode}) — ${alloc.projectName} [${alloc.projectCode}] — ${period}`,
          status: 'draft',
          financialYearId,
          projectId: alloc.projectId,
          isPayrollPosted: false,
          totalDebit,
          totalCredit,
          createdBy: 'system',
          entries: { create: entries },
        },
      })

      // Fetch voucher with account details for display
      // Use a raw approach to avoid null-relation crash when an accountId doesn't exist
      const voucherEntryRows = await db.voucherEntry.findMany({
        where: { voucherId: voucher.id },
        orderBy: { lineNumber: 'asc' },
      })

      // Batch-fetch accounts (only those that exist)
      const accountIds = [...new Set(voucherEntryRows.map(e => e.accountId))]
      const accounts = await db.account.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, name: true, code: true },
      })
      const accountMap = new Map(accounts.map(a => [a.id, a]))

      const displayEntries = voucherEntryRows.map(e => ({
        lineNumber: e.lineNumber,
        accountId: e.accountId,
        accountCode: accountMap.get(e.accountId)?.code || e.accountId.slice(0, 8),
        accountName: accountMap.get(e.accountId)?.name || `Account ${e.accountId.slice(0, 8)}`,
        debit: e.debit,
        credit: e.credit,
        description: e.description || '',
      }))

      vouchers.push({
        voucherId: voucher.id,
        voucherNumber,
        employeeName: emp.employeeName,
        employeeCode: emp.employeeCode,
        project: alloc.projectCode,
        projectCode: alloc.projectCode,
        projectName: alloc.projectName,
        period,
        totalDebit,
        totalCredit,
        balanced: Math.abs(totalDebit - totalCredit) < 1,
        status: 'draft',
        employeeCount: 1,
        entries: displayEntries,
        breakdown: {
          grossSalary: salaryShare,
          tax: taxShare,
          eobi: eobiShare,
          pf: pfShare,
          essi: essiShare,
          loan: loanShare,
          netSalary: netSalaryShare,
          sc: scShare,
          weightPct: alloc.weightPct,
        },
      })
    }
  }

  return { vouchers, validationErrors }
}

// ── POST Handler ────────────────────────────────────────────

async function POST_HANDLER(request: NextRequest) {
  try {
    const data = await request.json()
    const { mode, period, financialYearId } = data

    // ── Validate required fields ──
    if (!period) {
      return NextResponse.json({ error: 'period is required (YYYY-MM format)' }, { status: 400 })
    }
    if (!financialYearId) {
      return NextResponse.json({ error: 'financialYearId is required' }, { status: 400 })
    }

    // Verify financial year
    const fy = await db.financialYear.findUnique({ where: { id: financialYearId } })
    if (!fy) {
      return NextResponse.json({ error: 'Financial year not found' }, { status: 404 })
    }
    if (fy.status === 'closed') {
      return NextResponse.json({ error: 'Financial year is closed' }, { status: 400 })
    }

    let employees: EmployeePayrollData[] = []
    let batchId: string | null = null
    let projectFilter: string[] | undefined

    // =========================================================
    // MODE: project-wise (legacy from batch)
    // =========================================================
    if (mode === 'project-wise') {
      batchId = data.batchId
      if (!batchId) {
        return NextResponse.json({ error: 'batchId is required for project-wise mode' }, { status: 400 })
      }

      const batch = await db.payrollBatch.findUnique({
        where: { id: batchId },
        include: { lines: { orderBy: { employeeName: 'asc' } } },
      })
      if (!batch) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      }

      // Get approved lines, optionally filtered
      const lineIdSet = data.lineIds?.length > 0 ? new Set(data.lineIds as string[]) : null
      const approvedLines = batch.lines.filter(l =>
        l.lineStatus === 'approved' && (!lineIdSet || lineIdSet.has(l.id))
      )
      if (approvedLines.length === 0) {
        return NextResponse.json({ error: 'No approved lines found in batch' }, { status: 400 })
      }

      employees = await fetchBatchLinePayrollData(approvedLines)

      // Mark batch as voucher-created
      await db.payrollBatch.update({
        where: { id: batchId },
        data: { status: 'voucher-created' },
      })
    }

    // =========================================================
    // MODE: by-project
    // =========================================================
    else if (mode === 'by-project') {
      const { projectIds } = data
      if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
        return NextResponse.json({ error: 'projectIds[] is required for by-project mode' }, { status: 400 })
      }

      projectFilter = projectIds

      // Find all employees assigned to these projects
      const assignments = await db.employeeProjectAssignment.findMany({
        where: {
          projectId: { in: projectIds },
          isActive: true,
        },
        select: { employeeId: true },
        distinct: ['employeeId'],
      })

      const empIds = assignments.map(a => a.employeeId)
      if (empIds.length === 0) {
        return NextResponse.json({ error: 'No employees found for selected projects' }, { status: 400 })
      }

      employees = await fetchEmployeePayrollData(empIds, period)
    }

    // =========================================================
    // MODE: by-employee
    // =========================================================
    else if (mode === 'by-employee') {
      const { employeeIds } = data
      if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
        return NextResponse.json({ error: 'employeeIds[] is required for by-employee mode' }, { status: 400 })
      }

      employees = await fetchEmployeePayrollData(employeeIds, period)
    }

    // =========================================================
    // MODE: combined
    // =========================================================
    else if (mode === 'combined') {
      const { projectIds, employeeIds } = data
      if ((!projectIds || projectIds.length === 0) && (!employeeIds || employeeIds.length === 0)) {
        return NextResponse.json({ error: 'projectIds[] or employeeIds[] is required for combined mode' }, { status: 400 })
      }

      projectFilter = projectIds

      // Start with specified employees
      let empIds: string[] = employeeIds || []

      // Add employees from selected projects
      if (projectIds && projectIds.length > 0) {
        const assignments = await db.employeeProjectAssignment.findMany({
          where: {
            projectId: { in: projectIds },
            isActive: true,
          },
          select: { employeeId: true },
          distinct: ['employeeId'],
        })
        const projectEmpIds = assignments.map(a => a.employeeId)
        const allIds = [...empIds, ...projectEmpIds]
        empIds = [...new Set(allIds)]
      }

      if (empIds.length === 0) {
        return NextResponse.json({ error: 'No employees found matching criteria' }, { status: 400 })
      }

      employees = await fetchEmployeePayrollData(empIds, period)
    }

    // =========================================================
    // MODE: sc-only — Social Charges only voucher (legacy)
    // =========================================================
    else if (mode === 'sc-only') {
      const { employeeId, month, scAmount } = data
      if (!employeeId || !month || scAmount === undefined) {
        return NextResponse.json(
          { error: 'employeeId, month, financialYearId, and scAmount are required for sc-only mode' },
          { status: 400 }
        )
      }

      const amount = Math.round(scAmount)
      if (amount <= 0) {
        return NextResponse.json({ error: 'scAmount must be greater than 0' }, { status: 400 })
      }

      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true, employeeCode: true },
      })
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
      }

      const scExpenseAccount = await findAccountByRole('SOCIAL_CHARGES')
      const scPayableAccount = await findAccountByRole('SOCIAL_CHARGES_PAYABLE')
      if (!scExpenseAccount && !scPayableAccount) {
        return NextResponse.json(
          { error: 'Social Charges expense/payable accounts not found' },
          { status: 400 }
        )
      }

      const voucherNumber = `JV-SC-${month.replace('-', '')}-${employee.employeeCode}`
      const entries = [
        {
          lineNumber: 1,
          accountId: scExpenseAccount?.id || scPayableAccount?.id || '',
          debit: amount,
          credit: 0,
          description: `Social charges expense for ${employee.name} (${employee.employeeCode}) - ${month}`,
          payrollRef: `SC-${employee.employeeCode}-${month}`,
        },
        {
          lineNumber: 2,
          accountId: scPayableAccount?.id || scExpenseAccount?.id || '',
          debit: 0,
          credit: amount,
          description: `Social charges payable for ${employee.name} (${employee.employeeCode}) - ${month}`,
          payrollRef: `SC-${employee.employeeCode}-${month}`,
        },
      ]

      const voucher = await db.voucher.create({
        data: {
          voucherNumber,
          voucherType: 'JV',
          voucherTypeName: 'Journal Voucher',
          date: new Date(),
          narration: `Social Charges posting for ${employee.name} (${employee.employeeCode}) - ${month}`,
          status: 'draft',
          financialYearId,
          isPayrollPosted: false,
          totalDebit: amount,
          totalCredit: amount,
          createdBy: 'system',
          entries: { create: entries },
        },
      })

      const voucherWithEntries = await db.voucher.findUnique({
        where: { id: voucher.id },
        include: {
          entries: {
            include: { account: { select: { id: true, name: true, code: true } } },
            orderBy: { lineNumber: 'asc' },
          },
        },
      })

      const displayEntries = (voucherWithEntries?.entries || []).map(e => ({
        lineNumber: e.lineNumber,
        accountId: e.accountId,
        accountCode: e.account?.code || '',
        accountName: e.account?.name || 'Unknown',
        debit: e.debit,
        credit: e.credit,
        description: e.description,
      }))

      return NextResponse.json({
        mode: 'sc-only',
        voucher: {
          voucherId: voucher.id,
          voucherNumber: voucher.voucherNumber,
          voucherType: 'SC-Only',
          employee: { id: employee.id, name: employee.name, code: employee.employeeCode },
          period: month,
          totalDebit: amount,
          totalCredit: amount,
          balanced: true,
          status: 'draft',
          entries: displayEntries,
        },
      }, { status: 201 })
    }

    // =========================================================
    // Invalid mode
    // =========================================================
    else {
      return NextResponse.json(
        { error: `Invalid mode: ${mode}. Supported modes: project-wise, by-project, by-employee, combined, sc-only` },
        { status: 400 }
      )
    }

    // ── Generate vouchers for all collected employees ──
    const { vouchers, validationErrors } = await generateSalaryVouchers(
      employees,
      period,
      financialYearId,
      projectFilter
    )

    // ── Mark batch as voucher created (not posted — voucher is draft) ──
    if (batchId && vouchers.length > 0) {
      await db.payrollBatch.update({
        where: { id: batchId },
        data: {
          status: 'voucher-created',
        },
      })

      // Mark processed lines as voucher-created (not posted to GL yet)
      const lineIds = employees.map(e => e.employeeId)
      await db.payrollBatchLine.updateMany({
        where: {
          batchId,
          employeeId: { in: lineIds },
        },
        data: { lineStatus: 'voucher-created' },
      })
    }

    return NextResponse.json({
      vouchers,
      validationErrors,
    }, { status: 201 })

  } catch (error: unknown) {
    console.error('Error generating salary vouchers:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to generate salary vouchers', details: message },
      { status: 500 }
    )
  }
}

export const POST = withAudit('payroll', POST_HANDLER);
