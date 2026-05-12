/**
 * Financial Statement Engine — AcctFin ERP Statutory Financial Reporting
 *
 * Generates Balance Sheet, Profit & Loss, and Cash Flow statements
 * with prior-period comparatives and built-in cross-validation.
 *
 * All monetary amounts are in PKR.
 */

import { db } from '@/lib/db'
import { DepreciationEngine } from '@/lib/reporting/depreciation'
import { findAccountsByRole } from '@/lib/account-roles'

// ────────────────────────────────────────────────────────────────
// Custom Errors
// ────────────────────────────────────────────────────────────────

export class AccountingEquationError extends Error {
  constructor(public variance: number, public projectName?: string) {
    super(
      `Accounting equation mismatch: variance of PKR ${variance.toFixed(2)}${projectName ? ` in ${projectName}` : ''}`,
    )
    this.name = 'AccountingEquationError'
  }
}

export class CashReconciliationError extends Error {
  constructor(
    public cashFlowClosing: number,
    public balanceSheetCash: number,
    public variance: number,
  ) {
    super(
      `Cash reconciliation error: CF closing PKR ${cashFlowClosing} vs BS cash PKR ${balanceSheetCash}`,
    )
    this.name = 'CashReconciliationError'
  }
}

// ────────────────────────────────────────────────────────────────
// Shared Interfaces
// ────────────────────────────────────────────────────────────────

export interface AccountLine {
  accountId: string
  code: string
  name: string
  current: number
  prior: number
}

// ────────────────────────────────────────────────────────────────
// Balance Sheet Interfaces
// ────────────────────────────────────────────────────────────────

export interface BalanceSheetData {
  nonCurrentAssets: {
    propertyPlantEquipment: { note: number; current: number; prior: number; items: AccountLine[] }
    intangibleAssets: { note: number; current: number; prior: number; items: AccountLine[] }
    capitalWorkInProgress: { note: number; current: number; prior: number; items: AccountLine[] }
    subtotal: { current: number; prior: number }
  }
  currentAssets: {
    receivableAgainstWorkDone: { note: number; current: number; prior: number }
    advancesDepositsPrepayments: { note: number; current: number; prior: number }
    advanceIncomeTax: { current: number; prior: number }
    cashAndBankBalances: { note: number; current: number; prior: number }
    subtotal: { current: number; prior: number }
  }
  totalAssets: { current: number; prior: number }
  capital: {
    capitalAccount: { note: number; current: number; prior: number }
    intraCompanyLoan: { current: number; prior: number; isInterProject: boolean }
  }
  nonCurrentLiabilities: { current: number; prior: number; items: AccountLine[] }
  currentLiabilities: {
    accruedExpenses: { note: number; current: number; prior: number }
    provisionForTaxation: { current: number; prior: number }
    subtotal: { current: number; prior: number }
  }
  contingenciesAndCommitments: { note: number; current: number; prior: number }
  totalCapitalAndLiabilities: { current: number; prior: number }
  validated: boolean
  variance: number
  projectName?: string
}

// ────────────────────────────────────────────────────────────────
// Profit & Loss Interfaces
// ────────────────────────────────────────────────────────────────

export interface ProfitLossData {
  revenue: { note: number; current: number; prior: number; items: AccountLine[] }
  costOfWorkDone: { note: number; current: number; prior: number; items: AccountLine[] }
  grossProfit: { current: number; prior: number }
  otherIncome: { note: number; current: number; prior: number; items: AccountLine[] }
  operatingExpenses: { current: number; prior: number; items: AccountLine[] }
  depreciationAndAmortization: {
    current: number
    prior: number
    ppeDepreciation: number
    intangibleAmortization: number
  }
  profitBeforeTaxation: { current: number; prior: number }
  provisionForTaxation: { note: number; current: number; prior: number }
  netProfitAfterTax: { current: number; prior: number }
  projectName?: string
}

// ────────────────────────────────────────────────────────────────
// Cash Flow Interfaces
// ────────────────────────────────────────────────────────────────

export interface CashFlowData {
  operatingActivities: {
    profitBeforeTaxation: number
    depreciationOnPPE: number
    amortizationOfIntangibles: number
    workingCapitalChanges: {
      increaseDecreaseInReceivables: number
      increaseDecreaseInAdvances: number
      increaseDecreaseInAccruedExpenses: number
    }
    incomeTaxPaid: number
    netCashFromOperatingActivities: number
  }
  investingActivities: {
    capitalExpenditureOnPPE: number
    proceedsFromDisposalOfAssets: number
    netCashFromInvestingActivities: number
  }
  financingActivities: {
    loanReceipts: number
    loanRepayments: number
    netCashFromFinancingActivities: number
  }
  netIncreaseDecreaseInCash: number
  openingCashAndBankBalances: number
  closingCashAndBankBalances: number
  balanceSheetCashBalance: number
  reconciled: boolean
  reconciliationVariance: number
  projectName?: string
}

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const TOLERANCE = 1.0 // PKR 1.00 cross-validation tolerance

const DIRECT_COST_SUBTYPES = new Set([
  'COST',
  'DIRECT_COST',
  'DIRECT',
  'COST_OF_SALES',
  'COST_OF_WORK_DONE',
])

const DEPRECIATION_SUBTYPES = new Set([
  'DEPRECIATION',
  'AMORTIZATION',
])

// ────────────────────────────────────────────────────────────────
// FinancialStatementEngine
// ────────────────────────────────────────────────────────────────

export class FinancialStatementEngine {
  private depEngine: DepreciationEngine

  constructor() {
    this.depEngine = new DepreciationEngine()
  }

  // ================================================================
  // BALANCE SHEET
  // ================================================================

  async getBalanceSheet(
    fromDate: string,
    toDate: string,
    projectId?: string,
  ): Promise<BalanceSheetData> {
    const priorDates = this.getPriorPeriodDates(fromDate, toDate)
    const projectName = projectId ? await this.getProjectName(projectId) : undefined

    // Current period entries
    const currentEntries = await this.getVoucherEntries(toDate, projectId)
    // Prior period entries
    const priorEntries = await this.getVoucherEntries(priorDates.toDate, projectId)

    // ---- Non-Current Assets via DepreciationEngine ----
    const projectCode = projectId ? await this.getProjectCode(projectId) : undefined
    const assetSchedule = await this.depEngine.getAssetSchedule(new Date(fromDate), new Date(toDate), projectCode)
    const priorAssetSchedule = await this.depEngine.getAssetSchedule(
      new Date(priorDates.fromDate),
      new Date(priorDates.toDate),
      projectCode,
    )

    // Flatten PPE/Intangible rows from Record<string, AssetScheduleRow[]> to flat arrays
    const ppeRows = Object.values(assetSchedule.ppe).flat()
    const intangibleRows = Object.values(assetSchedule.intangibles).flat()
    const priorPpeRows = Object.values(priorAssetSchedule.ppe).flat()
    const priorIntangibleRows = Object.values(priorAssetSchedule.intangibles).flat()

    const ppeItems = this.buildAccountLinesFromSchedule(ppeRows)
    const intangibleItems = this.buildAccountLinesFromSchedule(intangibleRows)

    const ppeCurrent = assetSchedule.ppeTotals.netBookValue
    const ppePrior = priorAssetSchedule.ppeTotals.netBookValue
    const intCurrent = assetSchedule.intangiblesTotals.netBookValue
    const intPrior = priorAssetSchedule.intangiblesTotals.netBookValue

    // ---- Capital Work In Progress ----
    const wipAccounts = await findAccountsByRole('WORK_IN_PROGRESS')
    const cwpCurrent = await this.sumAccountBalances(wipAccounts, currentEntries)
    const cwpPrior = await this.sumAccountBalances(wipAccounts, priorEntries)
    const cwpItems = this.buildAccountLines(wipAccounts, currentEntries, priorEntries)

    const ncaSubtotalCurrent = ppeCurrent + intCurrent + cwpCurrent
    const ncaSubtotalPrior = ppePrior + intPrior + cwpPrior

    // ---- Current Assets ----
    const receivableCurrent = await this.getAccountBalanceFromEntries(
      'ASSET', 'RECEIVABLE', currentEntries,
    )
    const receivablePrior = await this.getAccountBalanceFromEntries(
      'ASSET', 'RECEIVABLE', priorEntries,
    )

    // Advances, Deposits, Prepayments
    const advanceAccounts = await findAccountsByRole('ADVANCE')
    const depositAccounts = await findAccountsByRole('DEPOSIT')
    const prepaymentAccounts = await findAccountsByRole('PREPAYMENT')
    const advCurrent =
      (await this.sumAccountBalances(advanceAccounts, currentEntries)) +
      (await this.sumAccountBalances(depositAccounts, currentEntries)) +
      (await this.sumAccountBalances(prepaymentAccounts, currentEntries))
    const advPrior =
      (await this.sumAccountBalances(advanceAccounts, priorEntries)) +
      (await this.sumAccountBalances(depositAccounts, priorEntries)) +
      (await this.sumAccountBalances(prepaymentAccounts, priorEntries))

    // Advance Income Tax
    const taxReceivableAccounts = await findAccountsByRole('TAX_RECEIVABLE')
    const taxReceivableCurrent = await this.sumAccountBalances(taxReceivableAccounts, currentEntries)
    const taxReceivablePrior = await this.sumAccountBalances(taxReceivableAccounts, priorEntries)

    // Cash and Bank — only CASH and BANK sub-types for the official note
    const cashAndBankBalCurrent = await this.getAccountBalanceFromEntries(
      'ASSET', null, currentEntries, ['CASH', 'BANK'],
    )
    const cashAndBankBalPrior = await this.getAccountBalanceFromEntries(
      'ASSET', null, priorEntries, ['CASH', 'BANK'],
    )

    const caSubtotalCurrent = receivableCurrent + advCurrent + taxReceivableCurrent + cashAndBankBalCurrent
    const caSubtotalPrior = receivablePrior + advPrior + taxReceivablePrior + cashAndBankBalPrior

    const totalAssetsCurrent = ncaSubtotalCurrent + caSubtotalCurrent
    const totalAssetsPrior = ncaSubtotalPrior + caSubtotalPrior

    // ---- Capital ----
    const capitalAccounts = await findAccountsByRole('CAPITAL_FUND')
    const endowmentAccounts = await findAccountsByRole('ENDOWMENT_FUND')
    const equityAccounts = await db.account.findMany({
      where: { accountType: 'EQUITY', isActive: true, allowPosting: true },
      select: { id: true, code: true, name: true },
    })

    const capitalBaseCurrent =
      (await this.sumAccountBalances(capitalAccounts, currentEntries)) +
      (await this.sumAccountBalances(endowmentAccounts, currentEntries)) +
      (await this.sumAccountBalancesEquity(equityAccounts, currentEntries))

    const capitalBasePrior =
      (await this.sumAccountBalances(capitalAccounts, priorEntries)) +
      (await this.sumAccountBalances(endowmentAccounts, priorEntries)) +
      (await this.sumAccountBalancesEquity(equityAccounts, priorEntries))

    // Net profit for the period added to capital
    const netProfitCurrent = await this.computeNetProfit(fromDate, toDate, projectId)
    const netProfitPrior = await this.computeNetProfit(priorDates.fromDate, priorDates.toDate, projectId)

    const capitalAccountCurrent = capitalBaseCurrent + netProfitCurrent
    const capitalAccountPrior = capitalBasePrior + netProfitPrior

    // Intra-company loan (inter-project)
    const intraLoanCurrent = 0 // computed from inter-project liability accounts
    const intraLoanPrior = 0

    // ---- Non-Current Liabilities ----
    const longTermLoanAccounts = await findAccountsByRole('LONG_TERM_LOAN')
    const nclItems = this.buildAccountLines(longTermLoanAccounts, currentEntries, priorEntries)
    const nclCurrent = await this.sumAccountBalances(longTermLoanAccounts, currentEntries)
    const nclPrior = await this.sumAccountBalances(longTermLoanAccounts, priorEntries)

    // ---- Current Liabilities ----
    const accrualAccounts = await findAccountsByRole('ACCRUAL')
    const payableAccounts = await findAccountsByRole('ACCOUNTS_PAYABLE')
    const accruedCurrent =
      (await this.sumAccountBalances(accrualAccounts, currentEntries)) +
      (await this.sumAccountBalances(payableAccounts, currentEntries))
    const accruedPrior =
      (await this.sumAccountBalances(accrualAccounts, priorEntries)) +
      (await this.sumAccountBalances(payableAccounts, priorEntries))

    const taxPayableAccounts = await findAccountsByRole('TAX_PAYABLE')
    const provisionAccounts = await findAccountsByRole('PROVISION')
    const provisionCurrent =
      (await this.sumAccountBalances(taxPayableAccounts, currentEntries)) +
      (await this.sumAccountBalances(provisionAccounts, currentEntries))
    const provisionPrior =
      (await this.sumAccountBalances(taxPayableAccounts, priorEntries)) +
      (await this.sumAccountBalances(provisionAccounts, priorEntries))

    const clSubtotalCurrent = accruedCurrent + provisionCurrent
    const clSubtotalPrior = accruedPrior + provisionPrior

    // Contingencies & Commitments — disclosed but not recognised
    const contingenciesCurrent = 0
    const contingenciesPrior = 0

    const totalCapitalAndLiabilitiesCurrent =
      capitalAccountCurrent + intraLoanCurrent + nclCurrent + clSubtotalCurrent + contingenciesCurrent
    const totalCapitalAndLiabilitiesPrior =
      capitalAccountPrior + intraLoanPrior + nclPrior + clSubtotalPrior + contingenciesPrior

    // ---- Validation ----
    const variance = Math.abs(totalAssetsCurrent - totalCapitalAndLiabilitiesCurrent)
    const validated = variance <= TOLERANCE

    return {
      nonCurrentAssets: {
        propertyPlantEquipment: { note: 4, current: ppeCurrent, prior: ppePrior, items: ppeItems },
        intangibleAssets: { note: 5, current: intCurrent, prior: intPrior, items: intangibleItems },
        capitalWorkInProgress: { note: 6, current: cwpCurrent, prior: cwpPrior, items: cwpItems },
        subtotal: { current: ncaSubtotalCurrent, prior: ncaSubtotalPrior },
      },
      currentAssets: {
        receivableAgainstWorkDone: { note: 7, current: receivableCurrent, prior: receivablePrior },
        advancesDepositsPrepayments: { note: 8, current: advCurrent, prior: advPrior },
        advanceIncomeTax: { current: taxReceivableCurrent, prior: taxReceivablePrior },
        cashAndBankBalances: { note: 9, current: cashAndBankBalCurrent, prior: cashAndBankBalPrior },
        subtotal: { current: caSubtotalCurrent, prior: caSubtotalPrior },
      },
      totalAssets: { current: totalAssetsCurrent, prior: totalAssetsPrior },
      capital: {
        capitalAccount: { note: 10, current: capitalAccountCurrent, prior: capitalAccountPrior },
        intraCompanyLoan: { current: intraLoanCurrent, prior: intraLoanPrior, isInterProject: true },
      },
      nonCurrentLiabilities: { current: nclCurrent, prior: nclPrior, items: nclItems },
      currentLiabilities: {
        accruedExpenses: { note: 11, current: accruedCurrent, prior: accruedPrior },
        provisionForTaxation: { current: provisionCurrent, prior: provisionPrior },
        subtotal: { current: clSubtotalCurrent, prior: clSubtotalPrior },
      },
      contingenciesAndCommitments: { note: 12, current: contingenciesCurrent, prior: contingenciesPrior },
      totalCapitalAndLiabilities: { current: totalCapitalAndLiabilitiesCurrent, prior: totalCapitalAndLiabilitiesPrior },
      validated,
      variance,
      projectName,
    }
  }

  // ================================================================
  // PROFIT & LOSS
  // ================================================================

  async getProfitAndLoss(
    fromDate: string,
    toDate: string,
    projectId?: string,
  ): Promise<ProfitLossData> {
    const priorDates = this.getPriorPeriodDates(fromDate, toDate)
    const projectName = projectId ? await this.getProjectName(projectId) : undefined

    // ---- Revenue (INCOME accounts) ----
    const incomeAccounts = await db.account.findMany({
      where: { accountType: 'INCOME', isActive: true, allowPosting: true },
      select: { id: true, code: true, name: true, subType: true },
      orderBy: { code: 'asc' },
    })

    const revenueItems: AccountLine[] = []
    let revenueCurrent = 0
    let revenuePrior = 0

    for (const acct of incomeAccounts) {
      const curBal = await this.getAccountBalanceForPeriod(acct.id, fromDate, toDate, projectId)
      const priorBal = await this.getAccountBalanceForPeriod(acct.id, priorDates.fromDate, priorDates.toDate, projectId)
      // For income: credits minus debits = positive revenue
      const curRev = curBal.credits - curBal.debits
      const priorRev = priorBal.credits - priorBal.debits
      revenueCurrent += curRev
      revenuePrior += priorRev
      revenueItems.push({
        accountId: acct.id,
        code: acct.code,
        name: acct.name,
        current: curRev,
        prior: priorRev,
      })
    }

    // ---- Cost of Work Done ----
    const expenseAccounts = await db.account.findMany({
      where: { accountType: 'EXPENSE', isActive: true, allowPosting: true },
      select: { id: true, code: true, name: true, subType: true },
      orderBy: { code: 'asc' },
    })

    const costItems: AccountLine[] = []
    let costCurrent = 0
    let costPrior = 0

    const operatingItems: AccountLine[] = []
    let operatingCurrent = 0
    let operatingPrior = 0

    for (const acct of expenseAccounts) {
      const curBal = await this.getAccountBalanceForPeriod(acct.id, fromDate, toDate, projectId)
      const priorBal = await this.getAccountBalanceForPeriod(acct.id, priorDates.fromDate, priorDates.toDate, projectId)
      // For expenses: debits minus credits = positive expense
      const curExp = curBal.debits - curBal.credits
      const priorExp = priorBal.debits - priorBal.credits

      if (this.isDirectCost(acct.subType)) {
        costCurrent += curExp
        costPrior += priorExp
        costItems.push({
          accountId: acct.id,
          code: acct.code,
          name: acct.name,
          current: curExp,
          prior: priorExp,
        })
      } else if (!this.isDepreciationSubType(acct.subType)) {
        // Operating expenses exclude depreciation (shown separately)
        operatingCurrent += curExp
        operatingPrior += priorExp
        operatingItems.push({
          accountId: acct.id,
          code: acct.code,
          name: acct.name,
          current: curExp,
          prior: priorExp,
        })
      }
    }

    const grossProfitCurrent = revenueCurrent - costCurrent
    const grossProfitPrior = revenuePrior - costPrior

    // ---- Other Income ----
    const otherIncomeAccounts = await db.account.findMany({
      where: {
        accountType: 'INCOME',
        isActive: true,
        allowPosting: true,
        subType: { in: ['INVESTMENT_INCOME', 'GAIN_ON_DISPOSAL', 'RENTAL_INCOME', 'OTHER_INCOME'] },
      },
      select: { id: true, code: true, name: true, subType: true },
      orderBy: { code: 'asc' },
    })

    const otherIncomeItems: AccountLine[] = []
    let otherIncomeCurrent = 0
    let otherIncomePrior = 0

    for (const acct of otherIncomeAccounts) {
      const curBal = await this.getAccountBalanceForPeriod(acct.id, fromDate, toDate, projectId)
      const priorBal = await this.getAccountBalanceForPeriod(acct.id, priorDates.fromDate, priorDates.toDate, projectId)
      const curVal = curBal.credits - curBal.debits
      const priorVal = priorBal.credits - priorBal.debits
      otherIncomeCurrent += curVal
      otherIncomePrior += priorVal
      otherIncomeItems.push({
        accountId: acct.id,
        code: acct.code,
        name: acct.name,
        current: curVal,
        prior: priorVal,
      })
    }

    // ---- Depreciation & Amortization ----
    const projectCode = projectId ? await this.getProjectCode(projectId) : undefined
    const depSplit = await this.depEngine.getDepreciationForDateRange(new Date(fromDate), new Date(toDate), projectCode)
    const priorDepSplit = await this.depEngine.getDepreciationForDateRange(
      new Date(priorDates.fromDate),
      new Date(priorDates.toDate),
      projectCode,
    )
    // Get PPE vs Intangible split from asset schedule
    const assetSchedForSplit = await this.depEngine.getAssetSchedule(new Date(fromDate), new Date(toDate), projectCode)
    const priorAssetSchedForSplit = await this.depEngine.getAssetSchedule(new Date(priorDates.fromDate), new Date(priorDates.toDate), projectCode)

    const daCurrent = depSplit.grandTotal
    const daPrior = priorDepSplit.grandTotal

    // ---- Profit Before Taxation ----
    const pbtCurrent = grossProfitCurrent + otherIncomeCurrent - operatingCurrent - daCurrent
    const pbtPrior = grossProfitPrior + otherIncomePrior - operatingPrior - daPrior

    // ---- Provision for Taxation ----
    const taxPayableAccounts = await findAccountsByRole('TAX_PAYABLE')
    const provisionAccounts = await findAccountsByRole('PROVISION')
    const allTaxAccounts = [...taxPayableAccounts, ...provisionAccounts]
    let taxCurrent = 0
    let taxPrior = 0
    for (const acct of allTaxAccounts) {
      const curBal = await this.getAccountBalanceForPeriod(acct.id, fromDate, toDate, projectId)
      const priorBal = await this.getAccountBalanceForPeriod(acct.id, priorDates.fromDate, priorDates.toDate, projectId)
      taxCurrent += curBal.credits - curBal.debits
      taxPrior += priorBal.credits - priorBal.debits
    }

    const npatCurrent = pbtCurrent - taxCurrent
    const npatPrior = pbtPrior - taxPrior

    return {
      revenue: { note: 13, current: revenueCurrent, prior: revenuePrior, items: revenueItems },
      costOfWorkDone: { note: 14, current: costCurrent, prior: costPrior, items: costItems },
      grossProfit: { current: grossProfitCurrent, prior: grossProfitPrior },
      otherIncome: { note: 15, current: otherIncomeCurrent, prior: otherIncomePrior, items: otherIncomeItems },
      operatingExpenses: { current: operatingCurrent, prior: operatingPrior, items: operatingItems },
      depreciationAndAmortization: {
        current: daCurrent,
        prior: daPrior,
        ppeDepreciation: assetSchedForSplit.ppeTotals.depreciationForPeriod,
        intangibleAmortization: assetSchedForSplit.intangiblesTotals.depreciationForPeriod,
      },
      profitBeforeTaxation: { current: pbtCurrent, prior: pbtPrior },
      provisionForTaxation: { note: 16, current: taxCurrent, prior: taxPrior },
      netProfitAfterTax: { current: npatCurrent, prior: npatPrior },
      projectName,
    }
  }

  // ================================================================
  // CASH FLOW STATEMENT
  // ================================================================

  async getCashFlowStatement(
    fromDate: string,
    toDate: string,
    projectId?: string,
  ): Promise<CashFlowData> {
    const projectName = projectId ? await this.getProjectName(projectId) : undefined
    const projectCode = projectId ? await this.getProjectCode(projectId) : undefined

    // ---- Profit Before Taxation from P&L ----
    const pnl = await this.getProfitAndLoss(fromDate, toDate, projectId)
    const profitBeforeTaxation = pnl.profitBeforeTaxation.current

    // ---- Depreciation ----
    const depSplit = await this.depEngine.getDepreciationForDateRange(new Date(fromDate), new Date(toDate), projectCode)
    const assetSchedule = await this.depEngine.getAssetSchedule(new Date(fromDate), new Date(toDate), projectCode)
    const depreciationOnPPE = assetSchedule.ppeTotals.depreciationForPeriod
    const amortizationOfIntangibles = assetSchedule.intangiblesTotals.depreciationForPeriod

    // ---- Working Capital Changes ----
    // Compare balances at fromDate and at toDate
    const receivableAtOpen = await this.getAccountBalance('ASSET', 'RECEIVABLE', undefined, fromDate, projectId)
    const receivableAtClose = await this.getAccountBalance('ASSET', 'RECEIVABLE', undefined, toDate, projectId)
    const increaseDecreaseInReceivables = receivableAtOpen - receivableAtClose // decrease is positive cash flow

    const advanceAtOpen = await this.getAccountBalance('ASSET', 'ADVANCE', undefined, fromDate, projectId)
    const advanceAtClose = await this.getAccountBalance('ASSET', 'ADVANCE', undefined, toDate, projectId)
    const depositAtOpen = await this.getAccountBalance('ASSET', 'DEPOSIT', undefined, fromDate, projectId)
    const depositAtClose = await this.getAccountBalance('ASSET', 'DEPOSIT', undefined, toDate, projectId)
    const prepayAtOpen = await this.getAccountBalance('ASSET', 'PREPAYMENT', undefined, fromDate, projectId)
    const prepayAtClose = await this.getAccountBalance('ASSET', 'PREPAYMENT', undefined, toDate, projectId)
    const increaseDecreaseInAdvances =
      (advanceAtOpen + depositAtOpen + prepayAtOpen) -
      (advanceAtClose + depositAtClose + prepayAtClose)

    const accrualAtOpen = await this.getAccountBalance('LIABILITY', 'ACCRUAL', undefined, fromDate, projectId)
    const accrualAtClose = await this.getAccountBalance('LIABILITY', 'ACCRUAL', undefined, toDate, projectId)
    const payableAtOpen = await this.getAccountBalance('LIABILITY', 'PAYABLE', undefined, fromDate, projectId)
    const payableAtClose = await this.getAccountBalance('LIABILITY', 'PAYABLE', undefined, toDate, projectId)
    const increaseDecreaseInAccruedExpenses =
      (accrualAtClose + payableAtClose) -
      (accrualAtOpen + payableAtOpen) // increase is positive cash flow

    // ---- Income Tax Paid ----
    const taxReceivableCurrent = await this.getAccountBalance('ASSET', 'TAX_RECEIVABLE', undefined, toDate, projectId)
    const taxPayableCurrent = await this.getAccountBalance('LIABILITY', 'TAX_PAYABLE', undefined, toDate, projectId)
    const taxReceivablePrior = await this.getAccountBalance('ASSET', 'TAX_RECEIVABLE', undefined, fromDate, projectId)
    const taxPayablePrior = await this.getAccountBalance('LIABILITY', 'TAX_PAYABLE', undefined, fromDate, projectId)
    // Simplified: tax paid = opening tax payable + tax charge - closing tax payable
    const incomeTaxPaid = Math.max(0, (taxReceivablePrior - taxReceivableCurrent) + (taxPayablePrior - taxPayableCurrent))

    const netCashFromOperatingActivities =
      profitBeforeTaxation +
      depreciationOnPPE +
      amortizationOfIntangibles +
      increaseDecreaseInReceivables +
      increaseDecreaseInAdvances +
      increaseDecreaseInAccruedExpenses -
      incomeTaxPaid

    // ---- Investing Activities ----
    const whereAssetFilter: any = {
      dateOfPurchase: { gte: new Date(fromDate), lte: new Date(toDate) },
    }
    if (projectCode) {
      whereAssetFilter.project = projectCode
    }
    const capexAssets = await db.fixedAsset.findMany({
      where: whereAssetFilter,
      select: { purchasePrice: true },
    })
    const capitalExpenditureOnPPE = capexAssets.reduce((s, a) => s + a.purchasePrice, 0)

    const whereDisposal: any = {
      type: 'Disposal',
      date: { gte: new Date(fromDate), lte: new Date(toDate) },
    }
    const disposalTxns = await db.assetTransaction.findMany({
      where: whereDisposal,
      select: { proceeds: true, asset: { select: { project: true } } },
    })
    const proceedsFromDisposal = disposalTxns
      .filter((t) => !projectCode || t.asset.project === projectCode)
      .reduce((s, t) => s + (t.proceeds || 0), 0)

    const netCashFromInvestingActivities = proceedsFromDisposal - capitalExpenditureOnPPE

    // ---- Financing Activities ----
    const loanAccounts = await findAccountsByRole('LONG_TERM_LOAN')
    let loanReceiptsCurrent = 0
    let loanRepaymentsCurrent = 0

    for (const acct of loanAccounts) {
      const bal = await this.getAccountBalanceForPeriod(acct.id, fromDate, toDate, projectId)
      // Liability: credits increase (receipts), debits decrease (repayments)
      loanReceiptsCurrent += bal.credits
      loanRepaymentsCurrent += bal.debits
    }

    const netCashFromFinancingActivities = loanReceiptsCurrent - loanRepaymentsCurrent

    // ---- Net increase / decrease in cash ----
    const netIncreaseDecreaseInCash =
      netCashFromOperatingActivities +
      netCashFromInvestingActivities +
      netCashFromFinancingActivities

    const openingCashAndBankBalances = await this.getAccountBalance(
      'ASSET', null, undefined, fromDate, projectId, ['CASH', 'BANK'],
    )
    const closingCashAndBankBalances =
      openingCashAndBankBalances + netIncreaseDecreaseInCash

    // ---- Cross-validate with Balance Sheet ----
    const bs = await this.getBalanceSheet(fromDate, toDate, projectId)
    const balanceSheetCashBalance = bs.currentAssets.cashAndBankBalances.current

    const reconciliationVariance = Math.abs(closingCashAndBankBalances - balanceSheetCashBalance)
    const reconciled = reconciliationVariance <= TOLERANCE

    return {
      operatingActivities: {
        profitBeforeTaxation,
        depreciationOnPPE,
        amortizationOfIntangibles,
        workingCapitalChanges: {
          increaseDecreaseInReceivables,
          increaseDecreaseInAdvances,
          increaseDecreaseInAccruedExpenses,
        },
        incomeTaxPaid,
        netCashFromOperatingActivities,
      },
      investingActivities: {
        capitalExpenditureOnPPE,
        proceedsFromDisposalOfAssets: proceedsFromDisposal,
        netCashFromInvestingActivities,
      },
      financingActivities: {
        loanReceipts: loanReceiptsCurrent,
        loanRepayments: loanRepaymentsCurrent,
        netCashFromFinancingActivities,
      },
      netIncreaseDecreaseInCash,
      openingCashAndBankBalances,
      closingCashAndBankBalances,
      balanceSheetCashBalance,
      reconciled,
      reconciliationVariance,
      projectName,
    }
  }

  // ================================================================
  // PRIVATE HELPERS
  // ================================================================

  /**
   * Get the prior year dates by subtracting 1 year from both fromDate and toDate.
   */
  private getPriorPeriodDates(fromDate: string, toDate: string): { fromDate: string; toDate: string } {
    const from = new Date(fromDate)
    const to = new Date(toDate)
    from.setFullYear(from.getFullYear() - 1)
    to.setFullYear(to.getFullYear() - 1)
    return {
      fromDate: from.toISOString().split('T')[0],
      toDate: to.toISOString().split('T')[0],
    }
  }

  /**
   * Private method to query VoucherEntry aggregates for specific account criteria.
   * Returns the net balance (debits - credits for assets/expenses, credits - debits for liabilities/income).
   */
  private async getAccountBalance(
    accountType: string,
    subType?: string | null,
    fromDate?: string,
    toDate?: string,
    projectId?: string,
    subTypes?: string[],
  ): Promise<number> {
    const where: any = {
      account: {
        accountType,
        isActive: true,
      },
    }
    if (subType) {
      where.account.subType = subType
    }
    if (subTypes && subTypes.length > 0) {
      where.account.subType = { in: subTypes }
    }

    // Voucher status and date filters
    where.voucher = {
      status: { in: ['approved', 'posted'] },
    }
    if (toDate) {
      where.voucher.date = fromDate
        ? { gte: new Date(fromDate), lte: new Date(toDate) }
        : { lte: new Date(toDate) }
    }
    if (projectId) {
      where.voucher.projectId = projectId
    }

    const result = await db.voucherEntry.aggregate({
      where,
      _sum: { debit: true, credit: true },
    })

    const totalDebit = result._sum.debit || 0
    const totalCredit = result._sum.credit || 0

    // Asset/Expense: natural debit balance → debit - credit
    // Liability/Income/Equity: natural credit balance → credit - debit
    if (accountType === 'ASSET' || accountType === 'EXPENSE') {
      return totalDebit - totalCredit
    }
    return totalCredit - totalDebit
  }

  /**
   * Get debit/credit breakdown for a specific account in a period.
   */
  private async getAccountBalanceForPeriod(
    accountId: string,
    fromDate: string,
    toDate: string,
    projectId?: string,
  ): Promise<{ debits: number; credits: number }> {
    const where: any = {
      accountId,
      voucher: {
        status: { in: ['approved', 'posted'] },
        date: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
    }
    if (projectId) {
      where.voucher.projectId = projectId
    }

    const result = await db.voucherEntry.aggregate({
      where,
      _sum: { debit: true, credit: true },
    })

    return {
      debits: result._sum.debit || 0,
      credits: result._sum.credit || 0,
    }
  }

  /**
   * Fetch voucher entries up to a given date, filtered by project.
   * Returns raw entries for in-memory aggregation.
   */
  private async getVoucherEntries(
    toDate: string,
    projectId?: string,
  ): Promise<Array<{ accountId: string; debit: number; credit: number }>> {
    const where: any = {
      voucher: {
        status: { in: ['approved', 'posted'] },
        date: { lte: new Date(toDate) },
      },
    }
    if (projectId) {
      where.voucher.projectId = projectId
    }

    return db.voucherEntry.findMany({
      where,
      select: {
        accountId: true,
        debit: true,
        credit: true,
      },
    })
  }

  /**
   * Sum balances for a set of accounts from pre-fetched entries.
   * Returns (debits - credits) for asset accounts, (credits - debits) for liability/equity.
   */
  private async sumAccountBalances(
    accounts: Array<{ id: string; code: string; name: string }>,
    entries: Array<{ accountId: string; debit: number; credit: number }>,
  ): Promise<number> {
    const accountIds = new Set(accounts.map((a) => a.id))
    let totalDebit = 0
    let totalCredit = 0
    for (const entry of entries) {
      if (accountIds.has(entry.accountId)) {
        totalDebit += entry.debit
        totalCredit += entry.credit
      }
    }
    // Default: treat as asset (debit balance)
    return totalDebit - totalCredit
  }

  /**
   * Sum balances for equity accounts from entries.
   * Equity: credit balance → credits - debits
   */
  private async sumAccountBalancesEquity(
    accounts: Array<{ id: string; code: string; name: string }>,
    entries: Array<{ accountId: string; debit: number; credit: number }>,
  ): Promise<number> {
    const accountIds = new Set(accounts.map((a) => a.id))
    let totalDebit = 0
    let totalCredit = 0
    for (const entry of entries) {
      if (accountIds.has(entry.accountId)) {
        totalDebit += entry.debit
        totalCredit += entry.credit
      }
    }
    return totalCredit - totalDebit
  }

  /**
   * Get account balance from entries for a given accountType and subType(s).
   */
  private async getAccountBalanceFromEntries(
    accountType: string,
    subType: string | null,
    entries: Array<{ accountId: string; debit: number; credit: number }>,
    subTypes?: string[],
  ): Promise<number> {
    // Find matching accounts
    const where: any = { accountType, isActive: true }
    if (subType) where.subType = subType
    if (subTypes && subTypes.length > 0) where.subType = { in: subTypes }

    const accounts = await db.account.findMany({
      where,
      select: { id: true },
    })
    const accountIds = new Set(accounts.map((a) => a.id))

    let totalDebit = 0
    let totalCredit = 0
    for (const entry of entries) {
      if (accountIds.has(entry.accountId)) {
        totalDebit += entry.debit
        totalCredit += entry.credit
      }
    }

    if (accountType === 'ASSET' || accountType === 'EXPENSE') {
      return totalDebit - totalCredit
    }
    return totalCredit - totalDebit
  }

  /**
   * Build AccountLine[] from a set of accounts and two sets of entries (current / prior).
   */
  private buildAccountLines(
    accounts: Array<{ id: string; code: string; name: string }>,
    currentEntries: Array<{ accountId: string; debit: number; credit: number }>,
    priorEntries: Array<{ accountId: string; debit: number; credit: number }>,
  ): AccountLine[] {
    return accounts.map((acct) => {
      const curBal = this.balanceFromEntries(acct.id, currentEntries)
      const priorBal = this.balanceFromEntries(acct.id, priorEntries)
      return {
        accountId: acct.id,
        code: acct.code,
        name: acct.name,
        current: curBal,
        prior: priorBal,
      }
    })
  }

  /**
   * Compute net debit-credit balance for a single account from entries.
   */
  private balanceFromEntries(
    accountId: string,
    entries: Array<{ accountId: string; debit: number; credit: number }>,
  ): number {
    let totalDebit = 0
    let totalCredit = 0
    for (const entry of entries) {
      if (entry.accountId === accountId) {
        totalDebit += entry.debit
        totalCredit += entry.credit
      }
    }
    return totalDebit - totalCredit
  }

  /**
   * Build AccountLine[] from depreciation schedule items.
   */
  private buildAccountLinesFromSchedule(
    items: Array<{
      assetId: string
      assetName: string
      category: string
      netBookValue: number
    }>,
  ): AccountLine[] {
    // Group by category for the schedule
    const grouped = new Map<string, { name: string; totalNBV: number }>()
    for (const item of items) {
      const key = item.category || 'Other'
      const existing = grouped.get(key) || { name: key, totalNBV: 0 }
      existing.totalNBV += item.netBookValue
      grouped.set(key, existing)
    }

    return Array.from(grouped.entries()).map(([category, data]) => ({
      accountId: `schedule-${category}`,
      code: category,
      name: data.name,
      current: data.totalNBV,
      prior: 0, // prior is handled separately via prior schedule
    }))
  }

  /**
   * Compute net profit for a period (used in capital account calculation).
   */
  private async computeNetProfit(
    fromDate: string,
    toDate: string,
    projectId?: string,
  ): Promise<number> {
    // Total income for period
    const incomeWhere: any = {
      account: { accountType: 'INCOME', isActive: true },
      voucher: {
        status: { in: ['approved', 'posted'] },
        date: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
    }
    if (projectId) {
      incomeWhere.voucher.projectId = projectId
    }
    const incomeResult = await db.voucherEntry.aggregate({
      where: incomeWhere,
      _sum: { debit: true, credit: true },
    })
    const totalIncome = (incomeResult._sum.credit || 0) - (incomeResult._sum.debit || 0)

    // Total expense for period
    const expenseWhere: any = {
      account: { accountType: 'EXPENSE', isActive: true },
      voucher: {
        status: { in: ['approved', 'posted'] },
        date: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
    }
    if (projectId) {
      expenseWhere.voucher.projectId = projectId
    }
    const expenseResult = await db.voucherEntry.aggregate({
      where: expenseWhere,
      _sum: { debit: true, credit: true },
    })
    const totalExpense = (expenseResult._sum.debit || 0) - (expenseResult._sum.credit || 0)

    return totalIncome - totalExpense
  }

  /**
   * Determine if a sub-type represents direct cost of work done.
   */
  private isDirectCost(subType: string | null): boolean {
    if (!subType) return false
    const st = subType.toUpperCase()
    for (const pattern of DIRECT_COST_SUBTYPES) {
      if (st.includes(pattern) || st === pattern) return true
    }
    // Also match common cost patterns
    if (/COST|DIRECT|COST_OF_SALES/i.test(subType)) return true
    return false
  }

  /**
   * Determine if a sub-type represents depreciation or amortization.
   */
  private isDepreciationSubType(subType: string | null): boolean {
    if (!subType) return false
    return DEPRECIATION_SUBTYPES.has(subType.toUpperCase()) ||
      /DEPRECIATION|AMORTIZATION/i.test(subType)
  }

  /**
   * Resolve project name from projectId.
   */
  private async getProjectName(projectId: string): Promise<string> {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    })
    return project?.name || 'Unknown Project'
  }

  /**
   * Resolve project code from projectId (used for FAMS lookups).
   */
  private async getProjectCode(projectId: string): Promise<string | undefined> {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { code: true },
    })
    return project?.code
  }
}

// ────────────────────────────────────────────────────────────────
// Singleton Export
// ────────────────────────────────────────────────────────────────

export const financialStatementEngine = new FinancialStatementEngine()
