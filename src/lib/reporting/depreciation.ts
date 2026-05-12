/**
 * Depreciation Engine — AcctFin ERP Statutory Financial Reporting
 *
 * Core service that computes monthly depreciation charges, runs period-wide
 * depreciation batches, and produces asset schedules for statutory reports
 * (PPE & Intangible schedules per IAS 16 / IAS 38 disclosure requirements).
 *
 * All monetary values use `number` (Float) to stay consistent with the
 * Prisma / SQLite schema throughout the codebase.
 */

import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default annual depreciation rates (%) by asset category.
 * Used when an asset does not specify its own `decliningRate`.
 */
export const DEFAULT_DEPRECIATION_RATES: Record<string, number> = {
  'Land': 0,
  'Buildings': 10,
  'Machinery': 15,
  'Vehicles': 20,
  'Furniture': 10,
  'IT Assets': 33,
  'Office Equipment': 20,
  'Computer Software': 30,
  'Other': 10,
}

/**
 * Categories classified as Property, Plant & Equipment (tangible).
 * Everything else is treated as Intangible for schedule grouping.
 */
const PPE_CATEGORIES = new Set([
  'Land',
  'Buildings',
  'Machinery',
  'Vehicles',
  'Furniture',
  'Office Equipment',
  'IT Assets',
  'Other',
])

/**
 * Month-index to three-letter abbreviation (1 = July, 12 = June).
 * Matches the fiscal-year convention used in FAMSFiscalYear & FixedAssetDepreciation.
 */
const FISCAL_MONTH_ABBR: Record<number, string> = {
  1: 'Jul',
  2: 'Aug',
  3: 'Sep',
  4: 'Oct',
  5: 'Nov',
  6: 'Dec',
  7: 'Jan',
  8: 'Feb',
  9: 'Mar',
  10: 'Apr',
  11: 'May',
  12: 'Jun',
}

/** Reverse map: "Jul" -> 1, "Aug" -> 2, etc. */
const MONTH_ABBR_TO_FISCAL: Record<string, number> = {
  Jan: 7,
  Feb: 8,
  Mar: 9,
  Apr: 10,
  May: 11,
  Jun: 12,
  Jul: 1,
  Aug: 2,
  Sep: 3,
  Oct: 4,
  Nov: 5,
  Dec: 6,
}

/** Calendar month number (0-based) for each fiscal month index. */
const FISCAL_MONTH_CALENDAR: Record<number, number> = {
  1: 6,  // Jul -> 6 (0-based)
  2: 7,  // Aug
  3: 8,  // Sep
  4: 9,  // Oct
  5: 10, // Nov
  6: 11, // Dec
  7: 0,  // Jan
  8: 1,  // Feb
  9: 2,  // Mar
  10: 3, // Apr
  11: 4, // May
  12: 5, // Jun
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Look up the default annual depreciation rate for a given asset category.
 * Falls back to 10 % when the category is not found in the rate table.
 *
 * @param category - Asset category string (e.g. "Buildings", "IT Assets")
 * @returns Annual depreciation percentage
 */
export function getDepreciationRate(category: string): number {
  return DEFAULT_DEPRECIATION_RATES[category] ?? 10
}

/**
 * Build the period string (e.g. "Jul-2024") from a financial-year label
 * and a fiscal month number (1-12).
 *
 * @param financialYear - Format "YYYY-YY" (e.g. "2024-25")
 * @param monthNumber   - 1 = July of the FY, ..., 12 = June
 * @returns Period string in "MMM-YYYY" format
 */
export function toPeriodString(financialYear: string, monthNumber: number): string {
  const abbr = FISCAL_MONTH_ABBR[monthNumber]
  if (!abbr) throw new Error(`Invalid monthNumber: ${monthNumber}. Must be 1-12.`)

  // months 1-6 fall in the first calendar year of the FY,
  // months 7-12 fall in the second calendar year.
  const yearPart = monthNumber <= 6
    ? financialYear.slice(0, 4)                        // "2024"
    : '20' + financialYear.slice(5)                    // "25" -> "2025"

  return `${abbr}-${yearPart}`
}

/**
 * Parse a period string (e.g. "Jul-2024") back into a JavaScript Date
 * representing the first day of that month.
 *
 * @param period - Period string in "MMM-YYYY" format
 * @returns Date object for the 1st of that month
 */
export function periodToDate(period: string): Date {
  const [abbr, yearStr] = period.split('-')
  const year = parseInt(yearStr, 10)
  const fiscalNum = MONTH_ABBR_TO_FISCAL[abbr]
  if (fiscalNum === undefined) throw new Error(`Cannot parse period: ${period}`)
  const calMonth = FISCAL_MONTH_CALENDAR[fiscalNum]
  return new Date(year, calMonth, 1)
}

/**
 * Derive the financial-year label ("YYYY-YY") from a calendar year and month.
 * Uses the Pakistani fiscal-year convention: July-June.
 *
 * @param year  - Calendar year (e.g. 2024)
 * @param month - Calendar month 1-12 (1 = January)
 * @returns Financial-year string, e.g. "2024-25"
 */
export function toFinancialYear(year: number, month: number): string {
  if (month >= 7) {
    const endYear = year + 1
    return `${year}-${String(endYear).slice(-2)}`
  }
  const endYear = year
  return `${year - 1}-${String(endYear).slice(-2)}`
}

/**
 * Derive the fiscal month number (1-12) from a calendar month.
 * July = 1, August = 2, ..., June = 12.
 */
export function calendarMonthToFiscalMonth(calMonth: number): number {
  return calMonth >= 7 ? calMonth - 6 : calMonth + 6
}

/**
 * Round a number to 2 decimal places.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/**
 * Minimal view of a FixedAsset row consumed by depreciation calculations.
 * Only the fields required for computation are included.
 */
export interface AssetForDepreciation {
  /** Internal database id */
  id: string
  /** Human-readable asset identifier (e.g. AST-2024-0001) */
  assetId: string
  /** Asset name / description */
  name: string
  /** Asset category */
  category: string
  /** Original purchase price */
  purchasePrice: number
  /** Estimated residual value at end of useful life */
  residualValue: number
  /** Useful life in years */
  usefulLifeYears: number
  /** Depreciation method: "Straight-Line", "Declining-Balance", or "None" */
  depreciationMethod: string
  /** Declining balance rate as a percentage (0 if not applicable) */
  decliningRate: number
  /** Current net book value */
  netBookValue: number
  /** Current accumulated depreciation */
  accumulatedDepreciation: number
  /** Asset status */
  status: string
  /** Date the asset was purchased */
  dateOfPurchase: Date
  /** Date the asset was capitalized */
  dateOfCapitalization: Date
  /** Project code (optional) */
  project: string | null
}

/** A single row in the asset schedule (one asset). */
export interface AssetScheduleRow {
  /** Internal database id of the fixed asset */
  assetDbId: string
  /** Human-readable asset identifier (e.g. AST-2024-0001) */
  assetId: string
  /** Asset name / description */
  assetName: string
  /** Asset category */
  category: string
  /** Original cost at the start of the reporting period */
  openingCost: number
  /** Sum of Addition transactions within the period */
  additions: number
  /** Sum of Disposal transactions within the period */
  deletions: number
  /** openingCost + additions - deletions */
  closingCost: number
  /** Accumulated depreciation at the start of the period */
  openingDepreciation: number
  /** Depreciation charged within the from-to range */
  depreciationForPeriod: number
  /** openingDepreciation + depreciationForPeriod */
  closingDepreciation: number
  /** closingCost - closingDepreciation */
  netBookValue: number
}

/** Category-level sub-totals. */
export interface CategoryTotals {
  /** Total opening cost for the category */
  openingCost: number
  /** Total additions for the category */
  additions: number
  /** Total deletions for the category */
  deletions: number
  /** Total closing cost for the category */
  closingCost: number
  /** Total opening depreciation for the category */
  openingDepreciation: number
  /** Total depreciation for the period for the category */
  depreciationForPeriod: number
  /** Total closing depreciation for the category */
  closingDepreciation: number
  /** Total net book value for the category */
  netBookValue: number
}

/** Complete asset schedule result, grouped by PPE / Intangibles. */
export interface AssetScheduleResult {
  /** Property, Plant & Equipment rows keyed by category */
  ppe: Record<string, AssetScheduleRow[]>
  /** Intangible asset rows keyed by category */
  intangibles: Record<string, AssetScheduleRow[]>
  /** Sub-totals per category for PPE */
  ppeCategoryTotals: Record<string, CategoryTotals>
  /** Sub-totals per category for Intangibles */
  intangiblesCategoryTotals: Record<string, CategoryTotals>
  /** Grand totals for all PPE categories */
  ppeTotals: CategoryTotals
  /** Grand totals for all Intangible categories */
  intangiblesTotals: CategoryTotals
  /** Grand totals across both PPE and Intangibles */
  grandTotals: CategoryTotals
}

/** Return shape for `getDepreciationForDateRange`. */
export interface DepreciationRangeResult {
  /** Total depreciation per asset database id */
  byAsset: Record<string, number>
  /** Sum of all asset depreciation in the range */
  grandTotal: number
}

// ---------------------------------------------------------------------------
// DepreciationEngine
// ---------------------------------------------------------------------------

/**
 * DepreciationEngine - central service for computing, recording, and
 * reporting fixed-asset depreciation across financial periods.
 *
 * Typical usage:
 * ```ts
 * const engine = new DepreciationEngine()
 * await engine.runDepreciationForPeriod("2024-25", 1)   // July
 * const schedule = await engine.getAssetSchedule(from, to)
 * ```
 */
export class DepreciationEngine {
  // -----------------------------------------------------------------------
  // 1. calculateMonthlyDepreciation
  // -----------------------------------------------------------------------

  /**
   * Compute the monthly depreciation charge for a single asset.
   *
   * - **Straight-Line**: `(purchasePrice - residualValue) / (usefulLifeYears * 12)`
   *   Returns 0 when `usefulLifeYears` is 0 or negative.
   * - **Declining-Balance**: `(netBookValue - residualValue) * (annualRate / 100) / 12`
   *   The `annualRate` is taken from `asset.decliningRate` when > 0, otherwise
   *   falls back to `DEFAULT_DEPRECIATION_RATES[category]`.
   * - **None**: returns 0.
   *
   * The result is rounded to 2 decimal places. If the computed charge would
   * push the net book value below the residual value, the charge is capped.
   *
   * @param asset  - The fixed-asset record (or a compatible subset)
   * @param _year  - Financial year label (e.g. "2024-25"). Reserved for future
   *                 partial-period logic; not currently used in the formula.
   * @param _month - Fiscal month number 1-12. Reserved for future use.
   * @returns Monthly depreciation amount (rounded to 2 dp)
   */
  calculateMonthlyDepreciation(
    asset: AssetForDepreciation,
    _year: string,
    _month: number,
  ): number {
    const {
      purchasePrice,
      residualValue,
      usefulLifeYears,
      depreciationMethod,
      netBookValue,
      category,
      decliningRate,
    } = asset

    // Assets with no depreciable base cannot be depreciated
    const depreciableAmount = netBookValue - residualValue
    if (depreciableAmount <= 0) return 0

    let charge = 0

    switch (depreciationMethod) {
      case 'Straight-Line': {
        if (usefulLifeYears <= 0) {
          charge = 0
        } else {
          charge = (purchasePrice - residualValue) / (usefulLifeYears * 12)
        }
        break
      }

      case 'Declining-Balance': {
        const annualRate = decliningRate > 0 ? decliningRate : getDepreciationRate(category)
        charge = depreciableAmount * (annualRate / 100) / 12
        break
      }

      case 'None':
      default:
        charge = 0
        break
    }

    // Cap charge so NBV never drops below residual value
    if (charge > depreciableAmount) {
      charge = depreciableAmount
    }

    return round2(Math.max(charge, 0))
  }

  // -----------------------------------------------------------------------
  // 2. runDepreciationForPeriod
  // -----------------------------------------------------------------------

  /**
   * Execute a depreciation run for every eligible asset in the given period.
   *
   * An asset is eligible when:
   * - `status` is **"Active"** (Disposed / Written Off assets are excluded)
   * - `depreciationMethod` is not **"None"**
   * - The asset's net book value exceeds its residual value
   * - No depreciation entry already exists for the same
   *   `assetId + financialYear + period + monthNumber` combination
   *
   * For each eligible asset the method:
   * 1. Calls `calculateMonthlyDepreciation`
   * 2. Creates a `FixedAssetDepreciation` record
   * 3. Updates `accumulatedDepreciation` and `netBookValue` on the `FixedAsset`
   *
   * @param financialYear - Financial-year label, e.g. "2024-25"
   * @param monthNumber   - Fiscal month number (1 = July ... 12 = June)
   * @param projectId     - Optional project code to restrict the run to
   * @returns Object with count of processed assets and total depreciation charged
   */
  async runDepreciationForPeriod(
    financialYear: string,
    monthNumber: number,
    projectId?: string,
  ): Promise<{ assetsProcessed: number; totalCharge: number }> {
    if (monthNumber < 1 || monthNumber > 12) {
      throw new Error(`monthNumber must be 1-12, got ${monthNumber}`)
    }

    const period = toPeriodString(financialYear, monthNumber)

    // Build the where-clause for eligible assets
    const assetWhere: {
      status: string
      depreciationMethod: { not: string }
      project?: string
    } = {
      status: 'Active',
      depreciationMethod: { not: 'None' },
    }
    if (projectId) {
      assetWhere.project = projectId
    }

    const assets = await db.fixedAsset.findMany({ where: assetWhere })

    let assetsProcessed = 0
    let totalCharge = 0

    for (const asset of assets) {
      // Skip if a depreciation entry already exists for this combination
      const existing = await db.fixedAssetDepreciation.findFirst({
        where: {
          assetId: asset.id,
          financialYear,
          period,
          monthNumber,
          isTaxDepreciation: false,
        },
      })
      if (existing) continue

      // Compute charge
      const charge = this.calculateMonthlyDepreciation(asset, financialYear, monthNumber)
      if (charge <= 0) continue

      const newAccDep = round2(asset.accumulatedDepreciation + charge)
      const newNBV = round2(Math.max(asset.purchasePrice - newAccDep, asset.residualValue))

      // Create depreciation record
      await db.fixedAssetDepreciation.create({
        data: {
          assetId: asset.id,
          financialYear,
          period,
          monthNumber,
          openingNBV: round2(asset.netBookValue),
          depreciationCharge: charge,
          accumulatedDepreciation: newAccDep,
          closingNBV: newNBV,
          isPosted: false,
          journalStatus: 'Pending Export',
          isTaxDepreciation: false,
        },
      })

      // Update the asset's running totals
      await db.fixedAsset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: newAccDep,
          netBookValue: newNBV,
        },
      })

      assetsProcessed++
      totalCharge += charge
    }

    return { assetsProcessed, totalCharge: round2(totalCharge) }
  }

  // -----------------------------------------------------------------------
  // 3. getDepreciationForDateRange
  // -----------------------------------------------------------------------

  /**
   * Aggregate depreciation charges for all assets within a date range.
   *
   * Period strings stored in `FixedAssetDepreciation` (e.g. "Jul-2024") are
   * mapped to actual dates so that standard date-range filtering can be
   * applied.  An optional `assetClass` filter restricts results to a single
   * asset category.
   *
   * @param fromDate    - Start of the range (inclusive)
   * @param toDate      - End of the range (inclusive)
   * @param assetClass  - Optional asset category to filter by
   * @returns An object with per-asset totals and a grand total
   */
  async getDepreciationForDateRange(
    fromDate: Date,
    toDate: Date,
    assetClass?: string,
  ): Promise<DepreciationRangeResult> {
    // Fetch all depreciation records (non-tax) and filter by period -> date
    const records = await db.fixedAssetDepreciation.findMany({
      where: { isTaxDepreciation: false },
    })

    // If filtering by asset class, look up asset ids for that category
    let categoryAssetIds: Set<string> | null = null
    if (assetClass) {
      const matchingAssets = await db.fixedAsset.findMany({
        where: { category: assetClass },
        select: { id: true },
      })
      categoryAssetIds = new Set(matchingAssets.map(a => a.id))
    }

    const byAsset: Record<string, number> = {}
    let grandTotal = 0

    for (const rec of records) {
      // Filter by category if specified
      if (categoryAssetIds && !categoryAssetIds.has(rec.assetId)) continue

      // Convert period string to date for range comparison
      let recDate: Date
      try {
        recDate = periodToDate(rec.period)
      } catch {
        // Skip records with unparseable period strings
        continue
      }

      // Check if the record falls within the date range
      if (recDate < fromDate || recDate > toDate) continue

      const prev = byAsset[rec.assetId] ?? 0
      byAsset[rec.assetId] = round2(prev + rec.depreciationCharge)
      grandTotal += rec.depreciationCharge
    }

    return { byAsset, grandTotal: round2(grandTotal) }
  }

  // -----------------------------------------------------------------------
  // 4. getAssetSchedule
  // -----------------------------------------------------------------------

  /**
   * Produce a full statutory asset schedule (PPE + Intangibles) for the
   * given reporting period.
   *
   * For each asset the schedule computes:
   * - **openingCost**: `purchasePrice` if the asset was purchased before `fromDate`, else 0
   * - **additions**: sum of `AssetTransaction` amounts where `type = "Addition"`
   *   and `date` is within [fromDate, toDate]
   * - **deletions**: sum of `AssetTransaction` amounts where `type = "Disposal"`
   *   and `date` is within [fromDate, toDate]
   * - **closingCost**: `openingCost + additions - deletions`
   * - **openingDepreciation**: accumulated depreciation at the start of the
   *   period (sum of depreciation charges for entries before fromDate)
   * - **depreciationForPeriod**: depreciation charged within [fromDate, toDate]
   * - **closingDepreciation**: `openingDepreciation + depreciationForPeriod`
   * - **netBookValue**: `closingCost - closingDepreciation`
   *
   * Results are grouped by asset category and separated into PPE and
   * Intangibles sections, with category-level and grand totals.
   *
   * @param fromDate   - Start of the reporting period (inclusive)
   * @param toDate     - End of the reporting period (inclusive)
   * @param projectId  - Optional project code filter
   * @returns Complete schedule with PPE / Intangibles split and totals
   */
  async getAssetSchedule(
    fromDate: Date,
    toDate: Date,
    projectId?: string,
  ): Promise<AssetScheduleResult> {
    // --- Fetch assets -------------------------------------------------------
    const assetWhere: { project?: string } = {}
    if (projectId) assetWhere.project = projectId

    const assets = await db.fixedAsset.findMany({ where: assetWhere })

    // --- Fetch all depreciation records for these assets --------------------
    const assetIds = assets.map(a => a.id)
    const allDepRecords = assetIds.length > 0
      ? await db.fixedAssetDepreciation.findMany({
          where: { assetId: { in: assetIds }, isTaxDepreciation: false },
        })
      : []

    // --- Fetch all transactions for these assets ----------------------------
    const allTransactions = assetIds.length > 0
      ? await db.assetTransaction.findMany({
          where: { assetId: { in: assetIds } },
        })
      : []

    // --- Build per-asset rows -----------------------------------------------
    const rows: AssetScheduleRow[] = []

    for (const asset of assets) {
      // openingCost: purchasePrice if purchased before fromDate
      const openingCost = asset.dateOfPurchase < fromDate ? asset.purchasePrice : 0

      // Additions within the period
      const additions = allTransactions
        .filter(t =>
          t.assetId === asset.id &&
          t.type === 'Addition' &&
          t.date >= fromDate &&
          t.date <= toDate,
        )
        .reduce((sum, t) => sum + t.amount, 0)

      // Deletions within the period
      const deletions = allTransactions
        .filter(t =>
          t.assetId === asset.id &&
          t.type === 'Disposal' &&
          t.date >= fromDate &&
          t.date <= toDate,
        )
        .reduce((sum, t) => sum + t.amount, 0)

      const closingCost = round2(openingCost + additions - deletions)

      // Opening depreciation = sum of depreciation charges for periods before fromDate
      let openingDepreciation = 0
      for (const rec of allDepRecords) {
        if (rec.assetId !== asset.id) continue
        let recDate: Date
        try {
          recDate = periodToDate(rec.period)
        } catch {
          continue
        }
        if (recDate < fromDate) {
          openingDepreciation += rec.depreciationCharge
        }
      }
      openingDepreciation = round2(openingDepreciation)

      // Depreciation for the period itself
      let depreciationForPeriod = 0
      for (const rec of allDepRecords) {
        if (rec.assetId !== asset.id) continue
        let recDate: Date
        try {
          recDate = periodToDate(rec.period)
        } catch {
          continue
        }
        if (recDate >= fromDate && recDate <= toDate) {
          depreciationForPeriod += rec.depreciationCharge
        }
      }
      depreciationForPeriod = round2(depreciationForPeriod)

      const closingDepreciation = round2(openingDepreciation + depreciationForPeriod)
      const netBookValue = round2(closingCost - closingDepreciation)

      rows.push({
        assetDbId: asset.id,
        assetId: asset.assetId,
        assetName: asset.name,
        category: asset.category,
        openingCost: round2(openingCost),
        additions: round2(additions),
        deletions: round2(deletions),
        closingCost,
        openingDepreciation,
        depreciationForPeriod,
        closingDepreciation,
        netBookValue,
      })
    }

    // --- Group into PPE / Intangibles ---------------------------------------
    const ppe: Record<string, AssetScheduleRow[]> = {}
    const intangibles: Record<string, AssetScheduleRow[]> = {}

    for (const row of rows) {
      const group = PPE_CATEGORIES.has(row.category) ? ppe : intangibles
      if (!group[row.category]) group[row.category] = []
      group[row.category].push(row)
    }

    // --- Compute category & grand totals ------------------------------------
    const ppeCategoryTotals = this._computeCategoryTotals(ppe)
    const intangiblesCategoryTotals = this._computeCategoryTotals(intangibles)
    const ppeTotals = this._sumTotals(Object.values(ppeCategoryTotals))
    const intangiblesTotals = this._sumTotals(Object.values(intangiblesCategoryTotals))
    const grandTotals = this._sumTotals([ppeTotals, intangiblesTotals])

    return {
      ppe,
      intangibles,
      ppeCategoryTotals,
      intangiblesCategoryTotals,
      ppeTotals,
      intangiblesTotals,
      grandTotals,
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Compute sub-totals for each category in a grouped row set.
   *
   * @param grouped - Asset rows grouped by category name
   * @returns CategoryTotals for each category
   */
  private _computeCategoryTotals(
    grouped: Record<string, AssetScheduleRow[]>,
  ): Record<string, CategoryTotals> {
    const result: Record<string, CategoryTotals> = {}
    for (const [category, catRows] of Object.entries(grouped)) {
      result[category] = catRows.reduce(
        (acc, row) => ({
          openingCost: round2(acc.openingCost + row.openingCost),
          additions: round2(acc.additions + row.additions),
          deletions: round2(acc.deletions + row.deletions),
          closingCost: round2(acc.closingCost + row.closingCost),
          openingDepreciation: round2(acc.openingDepreciation + row.openingDepreciation),
          depreciationForPeriod: round2(acc.depreciationForPeriod + row.depreciationForPeriod),
          closingDepreciation: round2(acc.closingDepreciation + row.closingDepreciation),
          netBookValue: round2(acc.netBookValue + row.netBookValue),
        }),
        {
          openingCost: 0,
          additions: 0,
          deletions: 0,
          closingCost: 0,
          openingDepreciation: 0,
          depreciationForPeriod: 0,
          closingDepreciation: 0,
          netBookValue: 0,
        },
      )
    }
    return result
  }

  /**
   * Sum an array of CategoryTotals into a single total.
   *
   * @param totals - Array of CategoryTotals to aggregate
   * @returns Single CategoryTotals representing the sum
   */
  private _sumTotals(totals: CategoryTotals[]): CategoryTotals {
    return totals.reduce(
      (acc, t) => ({
        openingCost: round2(acc.openingCost + t.openingCost),
        additions: round2(acc.additions + t.additions),
        deletions: round2(acc.deletions + t.deletions),
        closingCost: round2(acc.closingCost + t.closingCost),
        openingDepreciation: round2(acc.openingDepreciation + t.openingDepreciation),
        depreciationForPeriod: round2(acc.depreciationForPeriod + t.depreciationForPeriod),
        closingDepreciation: round2(acc.closingDepreciation + t.closingDepreciation),
        netBookValue: round2(acc.netBookValue + t.netBookValue),
      }),
      {
        openingCost: 0,
        additions: 0,
        deletions: 0,
        closingCost: 0,
        openingDepreciation: 0,
        depreciationForPeriod: 0,
        closingDepreciation: 0,
        netBookValue: 0,
      },
    )
  }
}
