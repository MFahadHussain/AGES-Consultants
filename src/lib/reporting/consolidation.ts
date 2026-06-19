/**
 * Consolidation Engine & Validation Engine
 * ==========================================
 * Multi-project consolidation and cross-statement validation for the
 * AGES Consultants ERP Statutory Financial Reporting system.
 *
 * The **ConsolidationEngine** aggregates financial statements across
 * multiple projects, eliminates intra-company balances, and produces
 * a single consolidated view suitable for statutory filing.
 *
 * The **ValidationEngine** performs five critical cross-statement
 * validation checks (accounting equation, net-profit-to-capital linkage,
 * cash reconciliation, depreciation/amortization linkage, and
 * date-precision of asset additions).
 *
 * @module reporting/consolidation
 */

import { db } from '@/lib/db'
import {
  FinancialStatementEngine,
  type AccountLine,
  type BalanceSheetData,
  type ProfitLossData,
  type CashFlowData,
} from '@/lib/reporting/financials'
import {
  DepreciationEngine,
  type AssetScheduleResult,
} from '@/lib/reporting/depreciation'

// ────────────────────────────────────────────────────────────────
// Exported Interfaces
// ────────────────────────────────────────────────────────────────

/**
 * Per-project financial statement bundle.
 * Contains the three primary statements for a single project.
 */
export interface ProjectFinancials {
  /** Display name of the project */
  projectName: string
  /** Unique code of the project (e.g., "PRJ-001") */
  projectCode: string
  /** Balance Sheet data */
  balanceSheet: BalanceSheetData
  /** Profit & Loss data */
  profitAndLoss: ProfitLossData
  /** Cash Flow Statement data */
  cashFlow: CashFlowData
}

/**
 * Consolidated report output.
 *
 * `byProject` maps each projectId to its individual financials,
 * while `consolidated` holds the aggregated (eliminated) totals.
 */
export interface ConsolidatedReport {
  /** Per-project financial statements, keyed by projectId */
  byProject: {
    [projectId: string]: ProjectFinancials
  }
  /** Consolidated (eliminated) financial statements */
  consolidated: {
    /** Label for the consolidated entity */
    projectName: string
    /** Consolidated Balance Sheet */
    balanceSheet: BalanceSheetData
    /** Consolidated Profit & Loss */
    profitAndLoss: ProfitLossData
    /** Consolidated Cash Flow Statement */
    cashFlow: CashFlowData
  }
}

/**
 * Result of a single validation rule check.
 */
export interface ValidationRule {
  /** Human-readable name of the validation rule */
  name: string
  /** Whether the rule passed or failed */
  status: 'pass' | 'fail'
  /** Detailed description of the check result */
  detail: string
  /** Actual computed value (when applicable) */
  actualValue?: number
  /** Expected value (when applicable) */
  expectedValue?: number
  /** Difference between actual and expected (when applicable) */
  variance?: number
}

/**
 * Complete validation result returned by ValidationEngine.validate().
 */
export interface ValidationResult {
  /** Array of individual rule check results */
  rules: ValidationRule[]
  /** `true` only when every rule has status 'pass' */
  allPassed: boolean
}

// ────────────────────────────────────────────────────────────────
// Internal Helpers – Balance Sheet Aggregation
// ────────────────────────────────────────────────────────────────

/**
 * Sum two AccountLine arrays by matching on accountId.
 * If an account exists in one array but not the other, it is included as-is.
 */
function sumAccountLines(
  a: AccountLine[],
  b: AccountLine[],
): AccountLine[] {
  const map = new Map<string, AccountLine>()

  for (const item of a) {
    map.set(item.accountId, { ...item })
  }

  for (const item of b) {
    const existing = map.get(item.accountId)
    if (existing) {
      existing.current += item.current
      existing.prior += item.prior
    } else {
      map.set(item.accountId, { ...item })
    }
  }

  return Array.from(map.values())
}

/**
 * Sum two `{ current: number; prior: number }` objects.
 */
function sumCurrentPrior(
  a: { current: number; prior: number },
  b: { current: number; prior: number },
): { current: number; prior: number } {
  return {
    current: a.current + b.current,
    prior: a.prior + b.prior,
  }
}

/**
 * Sum a note-bearing line item: `{ note, current, prior }`.
 * The note number from the first item is preserved.
 */
function sumNoteLine(
  a: { note: number; current: number; prior: number },
  b: { note: number; current: number; prior: number },
): { note: number; current: number; prior: number } {
  return {
    note: a.note,
    current: a.current + b.current,
    prior: a.prior + b.prior,
  }
}

/**
 * Sum a note-bearing line item with AccountLine items.
 */
function sumNoteLineWithItems(
  a: { note: number; current: number; prior: number; items: AccountLine[] },
  b: { note: number; current: number; prior: number; items: AccountLine[] },
): { note: number; current: number; prior: number; items: AccountLine[] } {
  return {
    note: a.note,
    current: a.current + b.current,
    prior: a.prior + b.prior,
    items: sumAccountLines(a.items, b.items),
  }
}

/**
 * Sum two BalanceSheetData objects field by field.
 * Does NOT eliminate intra-company loans – that is done in a separate step.
 */
function sumTwoBalanceSheets(a: BalanceSheetData, b: BalanceSheetData): BalanceSheetData {
  // Non-current assets
  const nonCurrentAssets = {
    propertyPlantEquipment: sumNoteLineWithItems(
      a.nonCurrentAssets.propertyPlantEquipment,
      b.nonCurrentAssets.propertyPlantEquipment,
    ),
    intangibleAssets: sumNoteLineWithItems(
      a.nonCurrentAssets.intangibleAssets,
      b.nonCurrentAssets.intangibleAssets,
    ),
    capitalWorkInProgress: sumNoteLineWithItems(
      a.nonCurrentAssets.capitalWorkInProgress,
      b.nonCurrentAssets.capitalWorkInProgress,
    ),
    subtotal: sumCurrentPrior(a.nonCurrentAssets.subtotal, b.nonCurrentAssets.subtotal),
  }

  // Current assets
  const currentAssets = {
    receivableAgainstWorkDone: sumNoteLine(
      a.currentAssets.receivableAgainstWorkDone,
      b.currentAssets.receivableAgainstWorkDone,
    ),
    advancesDepositsPrepayments: sumNoteLine(
      a.currentAssets.advancesDepositsPrepayments,
      b.currentAssets.advancesDepositsPrepayments,
    ),
    advanceIncomeTax: sumCurrentPrior(
      a.currentAssets.advanceIncomeTax,
      b.currentAssets.advanceIncomeTax,
    ),
    cashAndBankBalances: sumNoteLine(
      a.currentAssets.cashAndBankBalances,
      b.currentAssets.cashAndBankBalances,
    ),
    subtotal: sumCurrentPrior(a.currentAssets.subtotal, b.currentAssets.subtotal),
  }

  const totalAssets = sumCurrentPrior(a.totalAssets, b.totalAssets)

  // Capital
  const capital = {
    capitalAccount: sumNoteLine(a.capital.capitalAccount, b.capital.capitalAccount),
    intraCompanyLoan: {
      current: a.capital.intraCompanyLoan.current + b.capital.intraCompanyLoan.current,
      prior: a.capital.intraCompanyLoan.prior + b.capital.intraCompanyLoan.prior,
      isInterProject: true,
    },
  }

  // Non-current liabilities
  const nonCurrentLiabilities = {
    current: a.nonCurrentLiabilities.current + b.nonCurrentLiabilities.current,
    prior: a.nonCurrentLiabilities.prior + b.nonCurrentLiabilities.prior,
    items: sumAccountLines(a.nonCurrentLiabilities.items, b.nonCurrentLiabilities.items),
  }

  // Current liabilities
  const currentLiabilities = {
    accruedExpenses: sumNoteLine(
      a.currentLiabilities.accruedExpenses,
      b.currentLiabilities.accruedExpenses,
    ),
    provisionForTaxation: sumCurrentPrior(
      a.currentLiabilities.provisionForTaxation,
      b.currentLiabilities.provisionForTaxation,
    ),
    subtotal: sumCurrentPrior(a.currentLiabilities.subtotal, b.currentLiabilities.subtotal),
  }

  const contingenciesAndCommitments = sumNoteLine(
    a.contingenciesAndCommitments,
    b.contingenciesAndCommitments,
  )

  const totalCapitalAndLiabilities = sumCurrentPrior(
    a.totalCapitalAndLiabilities,
    b.totalCapitalAndLiabilities,
  )

  // Re-validate the accounting equation for the sum
  const variance = Math.abs(totalAssets.current - totalCapitalAndLiabilities.current)
  const validated = variance <= 1.0 // PKR 1.00 tolerance

  return {
    nonCurrentAssets,
    currentAssets,
    totalAssets,
    capital,
    nonCurrentLiabilities,
    currentLiabilities,
    contingenciesAndCommitments,
    totalCapitalAndLiabilities,
    validated,
    variance,
    projectName: 'Consolidated',
  }
}

/**
 * Aggregate an array of BalanceSheetData objects into a single sum.
 */
function aggregateBalanceSheets(sheets: BalanceSheetData[]): BalanceSheetData {
  if (sheets.length === 0) {
    return createEmptyBalanceSheet()
  }
  return sheets.reduce((acc, sheet) => sumTwoBalanceSheets(acc, sheet))
}

/**
 * Create an empty (zero-valued) Balance Sheet.
 * Used as the identity element for aggregation.
 */
function createEmptyBalanceSheet(): BalanceSheetData {
  const zeroNoteLine = (note: number) => ({ note, current: 0, prior: 0 })
  const zeroNoteItems = (note: number) => ({ note, current: 0, prior: 0, items: [] as AccountLine[] })
  const zeroCP = () => ({ current: 0, prior: 0 })

  return {
    nonCurrentAssets: {
      propertyPlantEquipment: zeroNoteItems(4),
      intangibleAssets: zeroNoteItems(5),
      capitalWorkInProgress: zeroNoteItems(6),
      subtotal: zeroCP(),
    },
    currentAssets: {
      receivableAgainstWorkDone: zeroNoteLine(7),
      advancesDepositsPrepayments: zeroNoteLine(8),
      advanceIncomeTax: zeroCP(),
      cashAndBankBalances: zeroNoteLine(9),
      subtotal: zeroCP(),
    },
    totalAssets: zeroCP(),
    capital: {
      capitalAccount: zeroNoteLine(10),
      intraCompanyLoan: { current: 0, prior: 0, isInterProject: true },
    },
    nonCurrentLiabilities: { current: 0, prior: 0, items: [] },
    currentLiabilities: {
      accruedExpenses: zeroNoteLine(11),
      provisionForTaxation: zeroCP(),
      subtotal: zeroCP(),
    },
    contingenciesAndCommitments: zeroNoteLine(12),
    totalCapitalAndLiabilities: zeroCP(),
    validated: true,
    variance: 0,
    projectName: 'Consolidated',
  }
}

// ────────────────────────────────────────────────────────────────
// Internal Helpers – P&L Aggregation
// ────────────────────────────────────────────────────────────────

/**
 * Sum two ProfitLossData objects field by field.
 */
function sumTwoPnLs(a: ProfitLossData, b: ProfitLossData): ProfitLossData {
  return {
    revenue: sumNoteLineWithItems(a.revenue, b.revenue),
    costOfWorkDone: sumNoteLineWithItems(a.costOfWorkDone, b.costOfWorkDone),
    grossProfit: sumCurrentPrior(a.grossProfit, b.grossProfit),
    otherIncome: sumNoteLineWithItems(a.otherIncome, b.otherIncome),
    operatingExpenses: {
      current: a.operatingExpenses.current + b.operatingExpenses.current,
      prior: a.operatingExpenses.prior + b.operatingExpenses.prior,
      items: sumAccountLines(a.operatingExpenses.items, b.operatingExpenses.items),
    },
    depreciationAndAmortization: {
      current: a.depreciationAndAmortization.current + b.depreciationAndAmortization.current,
      prior: a.depreciationAndAmortization.prior + b.depreciationAndAmortization.prior,
      ppeDepreciation:
        a.depreciationAndAmortization.ppeDepreciation + b.depreciationAndAmortization.ppeDepreciation,
      intangibleAmortization:
        a.depreciationAndAmortization.intangibleAmortization +
        b.depreciationAndAmortization.intangibleAmortization,
    },
    profitBeforeTaxation: sumCurrentPrior(a.profitBeforeTaxation, b.profitBeforeTaxation),
    provisionForTaxation: sumNoteLine(a.provisionForTaxation, b.provisionForTaxation),
    netProfitAfterTax: sumCurrentPrior(a.netProfitAfterTax, b.netProfitAfterTax),
    projectName: 'Consolidated',
  }
}

/**
 * Aggregate an array of ProfitLossData objects.
 */
function aggregatePnLs(pnls: ProfitLossData[]): ProfitLossData {
  if (pnls.length === 0) {
    return createEmptyPnL()
  }
  return pnls.reduce((acc, pnl) => sumTwoPnLs(acc, pnl))
}

/**
 * Create an empty (zero-valued) P&L.
 */
function createEmptyPnL(): ProfitLossData {
  const zeroNoteItems = (note: number) => ({ note, current: 0, prior: 0, items: [] as AccountLine[] })
  const zeroNoteLine = (note: number) => ({ note, current: 0, prior: 0 })
  const zeroCP = () => ({ current: 0, prior: 0 })

  return {
    revenue: zeroNoteItems(13),
    costOfWorkDone: zeroNoteItems(14),
    grossProfit: zeroCP(),
    otherIncome: zeroNoteItems(15),
    operatingExpenses: { current: 0, prior: 0, items: [] },
    depreciationAndAmortization: {
      current: 0,
      prior: 0,
      ppeDepreciation: 0,
      intangibleAmortization: 0,
    },
    profitBeforeTaxation: zeroCP(),
    provisionForTaxation: zeroNoteLine(16),
    netProfitAfterTax: zeroCP(),
    projectName: 'Consolidated',
  }
}

// ────────────────────────────────────────────────────────────────
// Internal Helpers – Cash Flow Aggregation
// ────────────────────────────────────────────────────────────────

/**
 * Sum two CashFlowData objects field by field.
 * CashFlowData uses flat numeric fields (not current/prior pairs)
 * since it represents a single period's cash movements.
 */
function sumTwoCashFlows(a: CashFlowData, b: CashFlowData): CashFlowData {
  return {
    operatingActivities: {
      profitBeforeTaxation:
        a.operatingActivities.profitBeforeTaxation + b.operatingActivities.profitBeforeTaxation,
      depreciationOnPPE:
        a.operatingActivities.depreciationOnPPE + b.operatingActivities.depreciationOnPPE,
      amortizationOfIntangibles:
        a.operatingActivities.amortizationOfIntangibles +
        b.operatingActivities.amortizationOfIntangibles,
      workingCapitalChanges: {
        increaseDecreaseInReceivables:
          a.operatingActivities.workingCapitalChanges.increaseDecreaseInReceivables +
          b.operatingActivities.workingCapitalChanges.increaseDecreaseInReceivables,
        increaseDecreaseInAdvances:
          a.operatingActivities.workingCapitalChanges.increaseDecreaseInAdvances +
          b.operatingActivities.workingCapitalChanges.increaseDecreaseInAdvances,
        increaseDecreaseInAccruedExpenses:
          a.operatingActivities.workingCapitalChanges.increaseDecreaseInAccruedExpenses +
          b.operatingActivities.workingCapitalChanges.increaseDecreaseInAccruedExpenses,
      },
      incomeTaxPaid:
        a.operatingActivities.incomeTaxPaid + b.operatingActivities.incomeTaxPaid,
      netCashFromOperatingActivities:
        a.operatingActivities.netCashFromOperatingActivities +
        b.operatingActivities.netCashFromOperatingActivities,
    },
    investingActivities: {
      capitalExpenditureOnPPE:
        a.investingActivities.capitalExpenditureOnPPE + b.investingActivities.capitalExpenditureOnPPE,
      proceedsFromDisposalOfAssets:
        a.investingActivities.proceedsFromDisposalOfAssets +
        b.investingActivities.proceedsFromDisposalOfAssets,
      netCashFromInvestingActivities:
        a.investingActivities.netCashFromInvestingActivities +
        b.investingActivities.netCashFromInvestingActivities,
    },
    financingActivities: {
      loanReceipts: a.financingActivities.loanReceipts + b.financingActivities.loanReceipts,
      loanRepayments: a.financingActivities.loanRepayments + b.financingActivities.loanRepayments,
      netCashFromFinancingActivities:
        a.financingActivities.netCashFromFinancingActivities +
        b.financingActivities.netCashFromFinancingActivities,
    },
    netIncreaseDecreaseInCash:
      a.netIncreaseDecreaseInCash + b.netIncreaseDecreaseInCash,
    openingCashAndBankBalances:
      a.openingCashAndBankBalances + b.openingCashAndBankBalances,
    closingCashAndBankBalances:
      a.closingCashAndBankBalances + b.closingCashAndBankBalances,
    balanceSheetCashBalance:
      a.balanceSheetCashBalance + b.balanceSheetCashBalance,
    reconciled: true, // will be re-validated after consolidation
    reconciliationVariance:
      a.reconciliationVariance + b.reconciliationVariance,
    projectName: 'Consolidated',
  }
}

/**
 * Aggregate an array of CashFlowData objects.
 */
function aggregateCashFlows(cashFlows: CashFlowData[]): CashFlowData {
  if (cashFlows.length === 0) {
    return createEmptyCashFlow()
  }
  return cashFlows.reduce((acc, cf) => sumTwoCashFlows(acc, cf))
}

/**
 * Create an empty (zero-valued) Cash Flow Statement.
 */
function createEmptyCashFlow(): CashFlowData {
  return {
    operatingActivities: {
      profitBeforeTaxation: 0,
      depreciationOnPPE: 0,
      amortizationOfIntangibles: 0,
      workingCapitalChanges: {
        increaseDecreaseInReceivables: 0,
        increaseDecreaseInAdvances: 0,
        increaseDecreaseInAccruedExpenses: 0,
      },
      incomeTaxPaid: 0,
      netCashFromOperatingActivities: 0,
    },
    investingActivities: {
      capitalExpenditureOnPPE: 0,
      proceedsFromDisposalOfAssets: 0,
      netCashFromInvestingActivities: 0,
    },
    financingActivities: {
      loanReceipts: 0,
      loanRepayments: 0,
      netCashFromFinancingActivities: 0,
    },
    netIncreaseDecreaseInCash: 0,
    openingCashAndBankBalances: 0,
    closingCashAndBankBalances: 0,
    balanceSheetCashBalance: 0,
    reconciled: true,
    reconciliationVariance: 0,
    projectName: 'Consolidated',
  }
}

// ────────────────────────────────────────────────────────────────
// Internal Helpers – Elimination Logic
// ────────────────────────────────────────────────────────────────

/**
 * Eliminate intra-company loan balances from the consolidated
 * Balance Sheet. Inter-project loans cancel out from the group
 * perspective, so both the current and prior values are set to 0.
 *
 * After elimination the accounting equation is re-validated.
 */
function eliminateIntraCompanyLoans(bs: BalanceSheetData): BalanceSheetData {
  const loanCurrent = bs.capital.intraCompanyLoan.current
  const loanPrior = bs.capital.intraCompanyLoan.prior

  // If there is nothing to eliminate, return as-is
  if (loanCurrent === 0 && loanPrior === 0) {
    return bs
  }

  // Set intra-company loan to 0 (eliminated)
  // When we eliminate the loan from the capital side, we also need
  // to remove it from totalCapitalAndLiabilities since it was part of it.
  const newTotalCapAndLiab = {
    current: bs.totalCapitalAndLiabilities.current - loanCurrent,
    prior: bs.totalCapitalAndLiabilities.prior - loanPrior,
  }

  // Re-validate accounting equation
  const variance = Math.abs(bs.totalAssets.current - newTotalCapAndLiab.current)
  const validated = variance <= 1.0

  return {
    ...bs,
    capital: {
      ...bs.capital,
      intraCompanyLoan: {
        current: 0,
        prior: 0,
        isInterProject: true,
      },
    },
    totalCapitalAndLiabilities: newTotalCapAndLiab,
    validated,
    variance,
  }
}

/**
 * Eliminate inter-project asset transfers from the consolidated
 * Cash Flow statement. Transfers between projects appear as capex
 * in one project but are non-cash from the group perspective.
 *
 * For the consolidated CF:
 * - capex is the sum of all project capex minus inter-project transfers.
 * - Investing activities and net cash flows are recalculated.
 * - Cash reconciliation is re-checked.
 *
 * @param cf         The aggregated cash flow data
 * @param transfers  Total inter-project transfer amount to eliminate
 */
function eliminateInterProjectTransfers(cf: CashFlowData, transfers: number): CashFlowData {
  if (transfers === 0) {
    return cf
  }

  // Adjust capex: subtract inter-project transfers
  const adjustedCapex = cf.investingActivities.capitalExpenditureOnPPE - transfers

  // Recalculate investing activities
  const netCashFromInvesting =
    cf.investingActivities.proceedsFromDisposalOfAssets - adjustedCapex

  // Recalculate net increase in cash
  const netIncreaseDecreaseInCash =
    cf.operatingActivities.netCashFromOperatingActivities +
    netCashFromInvesting +
    cf.financingActivities.netCashFromFinancingActivities

  // Recalculate closing cash
  const closingCashAndBankBalances =
    cf.openingCashAndBankBalances + netIncreaseDecreaseInCash

  // Re-check reconciliation
  const reconciliationVariance = Math.abs(
    closingCashAndBankBalances - cf.balanceSheetCashBalance,
  )
  const reconciled = reconciliationVariance <= 1.0

  return {
    ...cf,
    investingActivities: {
      capitalExpenditureOnPPE: adjustedCapex,
      proceedsFromDisposalOfAssets: cf.investingActivities.proceedsFromDisposalOfAssets,
      netCashFromInvestingActivities: netCashFromInvesting,
    },
    netIncreaseDecreaseInCash,
    closingCashAndBankBalances,
    reconciled,
    reconciliationVariance,
  }
}

// ────────────────────────────────────────────────────────────────
// Consolidation Engine
// ────────────────────────────────────────────────────────────────

/**
 * ConsolidationEngine aggregates financial statements across multiple
 * projects and produces a consolidated (group-level) view with
 * elimination of intra-company balances.
 *
 * **Elimination rules:**
 * - Intra-company loan balances on the Balance Sheet are set to zero
 *   since inter-project loans cancel out in consolidation.
 * - Capital expenditure in the Cash Flow statement is adjusted by
 *   subtracting inter-project asset transfers (which are non-cash
 *   from the group perspective).
 * - After elimination, the accounting equation and cash reconciliation
 *   are re-validated.
 *
 * @example
 * ```typescript
 * const engine = new ConsolidationEngine()
 * const report = await engine.consolidate('2024-07-01', '2025-06-30')
 * console.log(report.consolidated.balanceSheet.totalAssets.current)
 * ```
 */
export class ConsolidationEngine {
  /**
   * Produce a consolidated financial report across the specified
   * projects (or all active projects if none are specified).
   *
   * @param fromDate   Start of the reporting period (ISO date string)
   * @param toDate     End of the reporting period (ISO date string)
   * @param projectIds Optional list of project IDs to include.
   *                   If omitted, all active projects are included.
   * @returns A ConsolidatedReport containing per-project financials
   *          and the consolidated (eliminated) totals.
   */
  async consolidate(
    fromDate: string,
    toDate: string,
    projectIds?: string[],
  ): Promise<ConsolidatedReport> {
    // ── Step 1: Resolve projects ───────────────────────────────
    let projects: { id: string; code: string; name: string }[]

    if (projectIds && projectIds.length > 0) {
      projects = await db.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, code: true, name: true },
      })
    } else {
      projects = await db.project.findMany({
        where: { status: 'active' },
        select: { id: true, code: true, name: true },
      })
    }

    // ── Step 2: Generate statements per project ────────────────
    const engine = new FinancialStatementEngine()
    const byProject: ConsolidatedReport['byProject'] = {}
    const balanceSheets: BalanceSheetData[] = []
    const profitAndLosses: ProfitLossData[] = []
    const cashFlows: CashFlowData[] = []

    for (const project of projects) {
      const [balanceSheet, profitAndLoss, cashFlow] = await Promise.all([
        engine.getBalanceSheet(fromDate, toDate, project.id),
        engine.getProfitAndLoss(fromDate, toDate, project.id),
        engine.getCashFlowStatement(fromDate, toDate, project.id),
      ])

      byProject[project.id] = {
        projectName: project.name,
        projectCode: project.code,
        balanceSheet,
        profitAndLoss,
        cashFlow,
      }

      balanceSheets.push(balanceSheet)
      profitAndLosses.push(profitAndLoss)
      cashFlows.push(cashFlow)
    }

    // ── Step 3: Aggregate into consolidated column ─────────────
    let consolidatedBS = aggregateBalanceSheets(balanceSheets)
    const consolidatedPnL = aggregatePnLs(profitAndLosses)
    let consolidatedCF = aggregateCashFlows(cashFlows)

    // ── Step 4: Eliminate intra-company balances ────────────────

    // 4a. Eliminate intra-company loan on Balance Sheet
    consolidatedBS = eliminateIntraCompanyLoans(consolidatedBS)

    // 4b. Identify inter-project asset transfers and adjust CF capex.
    //     Inter-project transfers are AssetTransaction records with
    //     type "Transfer" within the reporting period.
    const from = new Date(fromDate)
    const to = new Date(toDate)
    const transferTxns = await db.assetTransaction.findMany({
      where: {
        type: 'Transfer',
        date: { gte: from, lte: to },
      },
      select: { amount: true },
    })
    const interProjectTransfers = transferTxns.reduce((s, t) => s + t.amount, 0)

    consolidatedCF = eliminateInterProjectTransfers(consolidatedCF, interProjectTransfers)

    // ── Step 5: Re-validate consolidated totals ─────────────────

    // Re-validate accounting equation for consolidated BS
    consolidatedBS.variance = Math.abs(
      consolidatedBS.totalAssets.current - consolidatedBS.totalCapitalAndLiabilities.current,
    )
    consolidatedBS.validated = consolidatedBS.variance <= 1.0

    // Re-check cash reconciliation for consolidated CF
    consolidatedCF.reconciliationVariance = Math.abs(
      consolidatedCF.closingCashAndBankBalances - consolidatedCF.balanceSheetCashBalance,
    )
    consolidatedCF.reconciled = consolidatedCF.reconciliationVariance <= 1.0

    // ── Step 6: Assemble and return ─────────────────────────────
    return {
      byProject,
      consolidated: {
        projectName: 'Consolidated',
        balanceSheet: consolidatedBS,
        profitAndLoss: consolidatedPnL,
        cashFlow: consolidatedCF,
      },
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Validation Engine
// ────────────────────────────────────────────────────────────────

/** Tolerance for floating-point comparison (PKR 1.00) */
const TOLERANCE = 1.0

/**
 * ValidationEngine performs cross-statement integrity checks on
 * statutory financial reports. It validates five critical rules:
 *
 * 1. **Accounting Equation** – Total Assets = Total Capital & Liabilities
 * 2. **Net Profit → Capital Account** – P&L net surplus flows to BS capital
 * 3. **Cash Flow closing = BS cash** – CF closing cash equals BS Note 9
 * 4. **Depreciation Linkage** – CF addbacks match depreciation schedules
 * 5. **Date Precision (additions)** – Asset purchase dates within period
 *
 * @example
 * ```typescript
 * const validator = new ValidationEngine()
 * const result = await validator.validate('2024-07-01', '2025-06-30', 'proj-123')
 * if (!result.allPassed) {
 *   for (const rule of result.rules) {
 *     if (rule.status === 'fail') console.error(rule.detail)
 *   }
 * }
 * ```
 */
export class ValidationEngine {
  /**
   * Run all validation rules for the given reporting period and
   * optional project. When projectId is omitted, validation runs
   * on the entity-wide (consolidated) statements.
   *
   * @param fromDate   Start of the reporting period (ISO date string)
   * @param toDate     End of the reporting period (ISO date string)
   * @param projectId  Optional project ID; omit for entity-wide validation
   * @returns ValidationResult with individual rule outcomes and overall pass/fail
   */
  async validate(
    fromDate: string,
    toDate: string,
    projectId?: string,
  ): Promise<ValidationResult> {
    // Generate the three primary statements
    const engine = new FinancialStatementEngine()
    const [balanceSheet, profitAndLoss, cashFlow] = await Promise.all([
      engine.getBalanceSheet(fromDate, toDate, projectId),
      engine.getProfitAndLoss(fromDate, toDate, projectId),
      engine.getCashFlowStatement(fromDate, toDate, projectId),
    ])

    // Get depreciation schedule for linkage checks
    const depEngine = new DepreciationEngine()
    const from = new Date(fromDate)
    const to = new Date(toDate)

    // Get project code for depreciation filter
    let projectCode: string | undefined
    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { code: true },
      })
      projectCode = project?.code
    }

    const [assetSchedule, additionsOutside] = await Promise.all([
      depEngine.getAssetSchedule(from, to, projectCode),
      this.getAdditionsOutsidePeriod(from, to, projectCode),
    ])

    // ── Rule 1: Accounting Equation ────────────────────────────
    const rule1 = validateAccountingEquation(balanceSheet)

    // ── Rule 2: Net Profit → Capital Account ───────────────────
    const rule2 = validateNetProfitToCapital(balanceSheet, profitAndLoss)

    // ── Rule 3: Cash Flow closing = BS cash ────────────────────
    const rule3 = validateCashFlowToBS(balanceSheet, cashFlow)

    // ── Rule 4: Depreciation Linkage ───────────────────────────
    const rule4 = validateDepreciationLinkage(cashFlow, profitAndLoss, assetSchedule)

    // ── Rule 5: Date Precision (additions) ─────────────────────
    const rule5 = validateDatePrecision(additionsOutside, fromDate, toDate)

    // ── Assemble results ───────────────────────────────────────
    const rules = [rule1, rule2, rule3, rule4, rule5]
    const allPassed = rules.every((r) => r.status === 'pass')

    return { rules, allPassed }
  }

  /**
   * Find fixed-asset additions whose dateOfPurchase falls outside
   * the reporting period [fromDate, toDate].
   */
  private async getAdditionsOutsidePeriod(
    fromDate: Date,
    toDate: Date,
    projectCode?: string,
  ): Promise<Array<{ assetId: string; assetName: string; dateOfPurchase: Date }>> {
    // Prisma SQLite doesn't support `not: { gte, lte }` directly,
    // so we use an OR of the two boundary conditions to find assets
    // with dateOfPurchase outside [fromDate, toDate].
    const outsideAssets = await db.fixedAsset.findMany({
      where: {
        status: 'Active',
        OR: [
          { dateOfPurchase: { lt: fromDate } },
          { dateOfPurchase: { gt: toDate } },
        ],
        ...(projectCode ? { project: projectCode } : {}),
      },
      select: {
        id: true,
        name: true,
        dateOfPurchase: true,
      },
    })

    return outsideAssets.map((a) => ({
      assetId: a.id,
      assetName: a.name,
      dateOfPurchase: a.dateOfPurchase,
    }))
  }
}

// ────────────────────────────────────────────────────────────────
// Individual Validation Rule Implementations
// ────────────────────────────────────────────────────────────────

/**
 * Rule 1: Accounting Equation
 *
 * Total Assets must equal Total Capital and Liabilities within PKR 1.00.
 * This is the fundamental double-entry bookkeeping identity.
 */
function validateAccountingEquation(bs: BalanceSheetData): ValidationRule {
  const totalAssets = bs.totalAssets.current
  const totalCapAndLiab = bs.totalCapitalAndLiabilities.current
  const variance = Math.abs(totalAssets - totalCapAndLiab)
  const passed = variance <= TOLERANCE

  return {
    name: 'Accounting Equation',
    status: passed ? 'pass' : 'fail',
    detail: passed
      ? `Total Assets (PKR ${totalAssets.toFixed(2)}) equals Total Capital & Liabilities (PKR ${totalCapAndLiab.toFixed(2)}) within tolerance.`
      : `Accounting equation violated: Total Assets (PKR ${totalAssets.toFixed(2)}) ≠ Total Capital & Liabilities (PKR ${totalCapAndLiab.toFixed(2)}). Variance: PKR ${variance.toFixed(2)}.`,
    actualValue: totalAssets,
    expectedValue: totalCapAndLiab,
    variance,
  }
}

/**
 * Rule 2: Net Profit → Capital Account
 *
 * The P&L net profit after tax for the period must be reflected in the
 * capital movement on the Balance Sheet. The capital account change
 * (current − prior) should approximate the net profit, since
 * accumulated profits flow into the capital/fund balance.
 */
function validateNetProfitToCapital(
  bs: BalanceSheetData,
  pnl: ProfitLossData,
): ValidationRule {
  const netProfit = pnl.netProfitAfterTax.current
  const capitalMovement =
    bs.capital.capitalAccount.current - bs.capital.capitalAccount.prior
  const variance = Math.abs(netProfit - capitalMovement)
  const passed = variance <= TOLERANCE

  return {
    name: 'Net Profit → Capital Account',
    status: passed ? 'pass' : 'fail',
    detail: passed
      ? `P&L net profit after tax (PKR ${netProfit.toFixed(2)}) matches capital movement on BS (PKR ${capitalMovement.toFixed(2)}) within tolerance.`
      : `P&L net profit after tax (PKR ${netProfit.toFixed(2)}) does not match capital movement on BS (PKR ${capitalMovement.toFixed(2)}). Variance: PKR ${variance.toFixed(2)}. Possible missing appropriation or prior-period adjustment.`,
    actualValue: netProfit,
    expectedValue: capitalMovement,
    variance,
  }
}

/**
 * Rule 3: Cash Flow closing = BS cash
 *
 * The closing cash balance on the Cash Flow Statement must equal
 * the Cash & Bank Balances shown on the Balance Sheet (Note 9)
 * within PKR 1.00.
 */
function validateCashFlowToBS(
  bs: BalanceSheetData,
  cf: CashFlowData,
): ValidationRule {
  const cfClosingCash = cf.closingCashAndBankBalances
  const bsCash = bs.currentAssets.cashAndBankBalances.current

  const variance = Math.abs(cfClosingCash - bsCash)
  const passed = variance <= TOLERANCE

  return {
    name: 'Cash Flow closing = BS cash',
    status: passed ? 'pass' : 'fail',
    detail: passed
      ? `CF closing cash (PKR ${cfClosingCash.toFixed(2)}) matches BS Cash & Bank (Note 9) (PKR ${bsCash.toFixed(2)}) within tolerance.`
      : `CF closing cash (PKR ${cfClosingCash.toFixed(2)}) does not match BS Cash & Bank (Note 9) (PKR ${bsCash.toFixed(2)}). Variance: PKR ${variance.toFixed(2)}. Check cash flow reconciliation.`,
    actualValue: cfClosingCash,
    expectedValue: bsCash,
    variance,
  }
}

/**
 * Rule 4: Depreciation & Amortization Linkage
 *
 * The depreciation addback on the Cash Flow Statement must equal
 * the total PPE depreciation from the Fixed Asset Schedule for the year.
 * Similarly, the amortization addback must equal the total intangible
 * asset amortization for the year.
 *
 * Cross-checks:
 * - CF depreciationOnPPE == PPE schedule depreciationForPeriod
 * - CF amortizationOfIntangibles == Intangible schedule depreciationForPeriod
 * - P&L depreciationAndAmortization.ppeDepreciation matches PPE schedule
 * - P&L depreciationAndAmortization.intangibleAmortization matches Intangible schedule
 */
function validateDepreciationLinkage(
  cf: CashFlowData,
  pnl: ProfitLossData,
  assetSchedule: AssetScheduleResult,
): ValidationRule {
  // Get PPE depreciation from the asset schedule
  const schedulePPEDep = assetSchedule.ppeTotals.depreciationForPeriod
  const scheduleIntangibleDep = assetSchedule.intangiblesTotals.depreciationForPeriod

  // CF addback values
  const cfDepOnPPE = cf.operatingActivities.depreciationOnPPE
  const cfAmortOfIntangibles = cf.operatingActivities.amortizationOfIntangibles

  // P&L depreciation breakdown
  const pnlPPEDep = pnl.depreciationAndAmortization.ppeDepreciation
  const pnlIntangibleAmort = pnl.depreciationAndAmortization.intangibleAmortization

  // Check 1: CF depreciation addback vs PPE schedule
  const depVariance1 = Math.abs(cfDepOnPPE - schedulePPEDep)
  const depPassed1 = depVariance1 <= TOLERANCE

  // Check 2: CF amortization addback vs Intangible schedule
  const amortVariance = Math.abs(cfAmortOfIntangibles - scheduleIntangibleDep)
  const amortPassed = amortVariance <= TOLERANCE

  // Check 3: P&L PPE depreciation vs schedule
  const depVariance2 = Math.abs(pnlPPEDep - schedulePPEDep)
  const depPassed2 = depVariance2 <= TOLERANCE

  // Check 4: P&L intangible amortization vs schedule
  const amortVariance2 = Math.abs(pnlIntangibleAmort - scheduleIntangibleDep)
  const amortPassed2 = amortVariance2 <= TOLERANCE

  const passed = depPassed1 && amortPassed && depPassed2 && amortPassed2

  const details: string[] = []
  if (!depPassed1) {
    details.push(
      `CF depreciation addback PKR ${cfDepOnPPE.toFixed(2)} vs PPE schedule PKR ${schedulePPEDep.toFixed(2)} (variance PKR ${depVariance1.toFixed(2)})`,
    )
  }
  if (!amortPassed) {
    details.push(
      `CF amortization addback PKR ${cfAmortOfIntangibles.toFixed(2)} vs Intangible schedule PKR ${scheduleIntangibleDep.toFixed(2)} (variance PKR ${amortVariance.toFixed(2)})`,
    )
  }
  if (!depPassed2) {
    details.push(
      `P&L PPE depreciation PKR ${pnlPPEDep.toFixed(2)} vs PPE schedule PKR ${schedulePPEDep.toFixed(2)} (variance PKR ${depVariance2.toFixed(2)})`,
    )
  }
  if (!amortPassed2) {
    details.push(
      `P&L intangible amortization PKR ${pnlIntangibleAmort.toFixed(2)} vs Intangible schedule PKR ${scheduleIntangibleDep.toFixed(2)} (variance PKR ${amortVariance2.toFixed(2)})`,
    )
  }

  return {
    name: 'Depreciation Linkage',
    status: passed ? 'pass' : 'fail',
    detail: passed
      ? `CF depreciation addback (PKR ${cfDepOnPPE.toFixed(2)}) matches PPE schedule (PKR ${schedulePPEDep.toFixed(2)}), CF amortization addback (PKR ${cfAmortOfIntangibles.toFixed(2)}) matches intangible schedule (PKR ${scheduleIntangibleDep.toFixed(2)}), and P&L figures are consistent.`
      : details.join('. ') + '. Verify depreciation schedule and cash flow adjustments.',
    actualValue: cfDepOnPPE + cfAmortOfIntangibles,
    expectedValue: schedulePPEDep + scheduleIntangibleDep,
    variance: depVariance1 + amortVariance,
  }
}

/**
 * Rule 5: Date Precision (additions)
 *
 * All Fixed Asset additions must have a dateOfPurchase that falls
 * within the reporting period [fromDate, toDate]. Any asset whose
 * purchase date is outside this range is flagged.
 */
function validateDatePrecision(
  additionsOutside: Array<{ assetId: string; assetName: string; dateOfPurchase: Date }>,
  fromDate: string,
  toDate: string,
): ValidationRule {
  const passed = additionsOutside.length === 0

  const detail = passed
    ? `All fixed asset additions have dateOfPurchase within [${fromDate}, ${toDate}].`
    : `${additionsOutside.length} asset(s) have dateOfPurchase outside the reporting period [${fromDate}, ${toDate}]: ${additionsOutside.map((a) => `"${a.assetName}" (${a.dateOfPurchase.toISOString().split('T')[0]})`).join(', ')}.`

  return {
    name: 'Date Precision (additions)',
    status: passed ? 'pass' : 'fail',
    detail,
    actualValue: additionsOutside.length,
    expectedValue: 0,
    variance: additionsOutside.length,
  }
}
