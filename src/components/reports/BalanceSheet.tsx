'use client'

import React from 'react'
import { FileText } from 'lucide-react'
import { formatPKR, isNegative, NoteBadge } from '@/components/reports/ReportLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { BalanceSheetData } from '@/lib/reporting/financials'

// ────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────

interface BalanceSheetProps {
  data: BalanceSheetData
  projectName?: string
  periodString: string
  priorPeriodString: string
  isConsolidated?: boolean
  projectColumns?: Array<{ id: string; name: string; data: BalanceSheetData }>
}

// ────────────────────────────────────────────────────────────────
// Value cell helper
// ────────────────────────────────────────────────────────────────

function ValueCell({ value, className = '' }: { value: number; className?: string }) {
  if (value === 0) {
    return <span className={`text-muted-foreground ${className}`}>-</span>
  }
  const neg = isNegative(value)
  return (
    <span className={`font-mono tabular-nums ${neg ? 'text-red-600' : ''} ${className}`}>
      {formatPKR(value)}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────
// Accounting equation check helper
// ────────────────────────────────────────────────────────────────

function equationHolds(bs: BalanceSheetData): boolean {
  return bs.validated
}

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

export function BalanceSheet({
  data,
  projectName,
  periodString,
  priorPeriodString,
  isConsolidated,
  projectColumns,
}: BalanceSheetProps) {
  // Defensive guard: if the API returned an error or data is malformed, show error state
  if (!data || !data.nonCurrentAssets) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Unable to generate Balance Sheet</p>
            <p className="text-xs text-muted-foreground mt-1">
              The report data could not be loaded. This may be due to missing chart of accounts configuration or no posted voucher entries for the selected period.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const multiProject = projectColumns && projectColumns.length > 0

  // Compute consolidated total from projectColumns if available
  const consolidatedData: BalanceSheetData | null = multiProject
    ? computeConsolidated(projectColumns!)
    : null

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <div className={`${multiProject ? 'overflow-x-auto' : ''}`}>
          <Table className="text-xs">
            {/* ── Header ── */}
            <TableHeader>
              {multiProject ? (
                renderMultiProjectHeader(periodString, priorPeriodString, projectColumns!, consolidatedData)
              ) : (
                <TableRow>
                  <TableHead className="text-xs w-[40%]">Particulars</TableHead>
                  <TableHead className="text-xs text-center w-[10%]">Note</TableHead>
                  <TableHead className="text-xs text-right w-[25%]">
                    PKR Rupees<br />{periodString}
                  </TableHead>
                  <TableHead className="text-xs text-right w-[25%]">
                    PKR Rupees<br />{priorPeriodString}
                  </TableHead>
                </TableRow>
              )}
            </TableHeader>

            <TableBody>
              {multiProject
                ? renderMultiProjectBody(
                    data,
                    projectColumns!,
                    consolidatedData!,
                    periodString,
                    priorPeriodString,
                  )
                : renderSingleBody(data, periodString, priorPeriodString)}
            </TableBody>
          </Table>
        </div>

        {/* ── Validation badge ── */}
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {projectName || data.projectName || 'Entity'}
            {isConsolidated ? ' (Consolidated)' : ''}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Accounting Equation:</span>
            {equationHolds(data) ? (
              <Badge className="text-[9px] bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                Balanced
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[9px]">
                Variance PKR {formatPKR(Math.abs(data.variance))}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════
// SINGLE-PROJECT RENDER
// ════════════════════════════════════════════════════════════════

function renderSingleBody(data: BalanceSheetData, periodString: string, priorPeriodString: string) {
  const rows: React.ReactNode[] = []

  // ── ASSETS header ──
  rows.push(sectionHeader('ASSETS'))

  // ── Non-Current Assets ──
  rows.push(categoryHeader('Non-Current Assets'))

  rows.push(lineRow(
    'Property, plant and equipment',
    data.nonCurrentAssets.propertyPlantEquipment.note,
    data.nonCurrentAssets.propertyPlantEquipment.current,
    data.nonCurrentAssets.propertyPlantEquipment.prior,
  ))

  // PPE detail items
  data.nonCurrentAssets.propertyPlantEquipment.items.forEach((item) => {
    rows.push(detailRow(item.name, item.current, item.prior))
  })

  rows.push(lineRow(
    'Intangible assets',
    data.nonCurrentAssets.intangibleAssets.note,
    data.nonCurrentAssets.intangibleAssets.current,
    data.nonCurrentAssets.intangibleAssets.prior,
  ))

  data.nonCurrentAssets.intangibleAssets.items.forEach((item) => {
    rows.push(detailRow(item.name, item.current, item.prior))
  })

  rows.push(lineRow(
    'Capital work in progress',
    data.nonCurrentAssets.capitalWorkInProgress.note,
    data.nonCurrentAssets.capitalWorkInProgress.current,
    data.nonCurrentAssets.capitalWorkInProgress.prior,
  ))

  data.nonCurrentAssets.capitalWorkInProgress.items.forEach((item) => {
    rows.push(detailRow(item.name, item.current, item.prior))
  })

  rows.push(subtotalRow(
    'Subtotal Non-Current Assets',
    data.nonCurrentAssets.subtotal.current,
    data.nonCurrentAssets.subtotal.prior,
  ))

  // ── Current Assets ──
  rows.push(categoryHeader('Current Assets'))

  rows.push(lineRow(
    'Receivable against work done',
    data.currentAssets.receivableAgainstWorkDone.note,
    data.currentAssets.receivableAgainstWorkDone.current,
    data.currentAssets.receivableAgainstWorkDone.prior,
  ))

  rows.push(lineRow(
    'Advances, deposits & prepayments',
    data.currentAssets.advancesDepositsPrepayments.note,
    data.currentAssets.advancesDepositsPrepayments.current,
    data.currentAssets.advancesDepositsPrepayments.prior,
  ))

  rows.push(lineRow(
    'Advance income tax',
    undefined,
    data.currentAssets.advanceIncomeTax.current,
    data.currentAssets.advanceIncomeTax.prior,
  ))

  rows.push(lineRow(
    'Cash and bank balances',
    data.currentAssets.cashAndBankBalances.note,
    data.currentAssets.cashAndBankBalances.current,
    data.currentAssets.cashAndBankBalances.prior,
  ))

  rows.push(subtotalRow(
    'Subtotal Current Assets',
    data.currentAssets.subtotal.current,
    data.currentAssets.subtotal.prior,
  ))

  // ── Total Assets ──
  rows.push(totalRow(
    'TOTAL ASSETS',
    data.totalAssets.current,
    data.totalAssets.prior,
  ))

  // ── CAPITAL AND LIABILITIES header ──
  rows.push(sectionHeader('CAPITAL AND LIABILITIES'))

  rows.push(lineRow(
    'Capital account',
    data.capital.capitalAccount.note,
    data.capital.capitalAccount.current,
    data.capital.capitalAccount.prior,
  ))

  // Intra-company loan — special orange row
  rows.push(intraCompanyRow(
    data.capital.intraCompanyLoan.current,
    data.capital.intraCompanyLoan.prior,
    data.capital.intraCompanyLoan.isInterProject,
  ))

  // ── Non-Current Liabilities ──
  rows.push(subtotalRow(
    'Non-Current Liabilities',
    data.nonCurrentLiabilities.current,
    data.nonCurrentLiabilities.prior,
  ))

  data.nonCurrentLiabilities.items.forEach((item) => {
    rows.push(detailRow(item.name, item.current, item.prior))
  })

  // ── Current Liabilities ──
  rows.push(categoryHeader('Current Liabilities'))

  rows.push(lineRow(
    'Accrued expenses and other payables',
    data.currentLiabilities.accruedExpenses.note,
    data.currentLiabilities.accruedExpenses.current,
    data.currentLiabilities.accruedExpenses.prior,
  ))

  rows.push(lineRow(
    'Provision for taxation',
    undefined,
    data.currentLiabilities.provisionForTaxation.current,
    data.currentLiabilities.provisionForTaxation.prior,
  ))

  rows.push(subtotalRow(
    'Subtotal Current Liabilities',
    data.currentLiabilities.subtotal.current,
    data.currentLiabilities.subtotal.prior,
  ))

  rows.push(lineRow(
    'Contingencies and commitments',
    data.contingenciesAndCommitments.note,
    data.contingenciesAndCommitments.current,
    data.contingenciesAndCommitments.prior,
  ))

  // ── Total Capital and Liabilities ──
  rows.push(totalRow(
    'TOTAL CAPITAL AND LIABILITIES',
    data.totalCapitalAndLiabilities.current,
    data.totalCapitalAndLiabilities.prior,
  ))

  return rows
}

// ════════════════════════════════════════════════════════════════
// MULTI-PROJECT RENDER
// ════════════════════════════════════════════════════════════════

function renderMultiProjectHeader(
  periodString: string,
  priorPeriodString: string,
  projectColumns: Array<{ id: string; name: string; data: BalanceSheetData }>,
  consolidatedData: BalanceSheetData | null,
) {
  return (
    <>
      {/* Main header row */}
      <TableRow>
        <TableHead className="text-xs w-[180px] min-w-[180px]">Particulars</TableHead>
        <TableHead className="text-xs text-center w-[40px] min-w-[40px]">Note</TableHead>
        {/* Main data columns */}
        <TableHead className="text-xs text-right min-w-[90px]">
          PKR<br />{periodString}
        </TableHead>
        <TableHead className="text-xs text-right min-w-[90px]">
          PKR<br />{priorPeriodString}
        </TableHead>
        {/* Per-project columns: current year only for brevity */}
        {projectColumns.map((col) => {
          const holds = equationHolds(col.data)
          return (
            <TableHead key={col.id} className="text-xs text-right min-w-[100px]">
              <div className="flex flex-col items-end gap-0.5">
                <span>{col.name}</span>
                {!holds && (
                  <Badge variant="destructive" className="text-[7px] h-3.5 px-1">
                    Variance
                  </Badge>
                )}
              </div>
            </TableHead>
          )
        })}
        {/* Consolidated total column */}
        {consolidatedData && (
          <TableHead className="text-xs text-right min-w-[110px]">
            <div className="flex flex-col items-end gap-0.5">
              <span>Consolidated Total</span>
              {!equationHolds(consolidatedData) && (
                <Badge variant="destructive" className="text-[7px] h-3.5 px-1">
                  Variance
                </Badge>
              )}
            </div>
          </TableHead>
        )}
      </TableRow>
    </>
  )
}

function renderMultiProjectBody(
  data: BalanceSheetData,
  projectColumns: Array<{ id: string; name: string; data: BalanceSheetData }>,
  consolidatedData: BalanceSheetData,
  periodString: string,
  priorPeriodString: string,
) {
  const rows: React.ReactNode[] = []

  // Helper to extract per-project current values for a given accessor
  const projCurrent = (accessor: (bs: BalanceSheetData) => number) =>
    projectColumns.map((col) => accessor(col.data))
  const consolidatedCurrent = (accessor: (bs: BalanceSheetData) => number) =>
    accessor(consolidatedData)

  // ── ASSETS header ──
  rows.push(sectionHeaderMulti('ASSETS', projectColumns.length, !!consolidatedData))

  // ── Non-Current Assets ──
  rows.push(categoryHeaderMulti('Non-Current Assets', projectColumns.length, !!consolidatedData))

  rows.push(multiLineRow(
    'Property, plant and equipment',
    data.nonCurrentAssets.propertyPlantEquipment.note,
    data.nonCurrentAssets.propertyPlantEquipment.current,
    data.nonCurrentAssets.propertyPlantEquipment.prior,
    projCurrent((bs) => bs.nonCurrentAssets.propertyPlantEquipment.current),
    consolidatedCurrent((bs) => bs.nonCurrentAssets.propertyPlantEquipment.current),
  ))

  rows.push(multiLineRow(
    'Intangible assets',
    data.nonCurrentAssets.intangibleAssets.note,
    data.nonCurrentAssets.intangibleAssets.current,
    data.nonCurrentAssets.intangibleAssets.prior,
    projCurrent((bs) => bs.nonCurrentAssets.intangibleAssets.current),
    consolidatedCurrent((bs) => bs.nonCurrentAssets.intangibleAssets.current),
  ))

  rows.push(multiLineRow(
    'Capital work in progress',
    data.nonCurrentAssets.capitalWorkInProgress.note,
    data.nonCurrentAssets.capitalWorkInProgress.current,
    data.nonCurrentAssets.capitalWorkInProgress.prior,
    projCurrent((bs) => bs.nonCurrentAssets.capitalWorkInProgress.current),
    consolidatedCurrent((bs) => bs.nonCurrentAssets.capitalWorkInProgress.current),
  ))

  rows.push(multiSubtotalRow(
    'Subtotal Non-Current Assets',
    data.nonCurrentAssets.subtotal.current,
    data.nonCurrentAssets.subtotal.prior,
    projCurrent((bs) => bs.nonCurrentAssets.subtotal.current),
    consolidatedCurrent((bs) => bs.nonCurrentAssets.subtotal.current),
  ))

  // ── Current Assets ──
  rows.push(categoryHeaderMulti('Current Assets', projectColumns.length, !!consolidatedData))

  rows.push(multiLineRow(
    'Receivable against work done',
    data.currentAssets.receivableAgainstWorkDone.note,
    data.currentAssets.receivableAgainstWorkDone.current,
    data.currentAssets.receivableAgainstWorkDone.prior,
    projCurrent((bs) => bs.currentAssets.receivableAgainstWorkDone.current),
    consolidatedCurrent((bs) => bs.currentAssets.receivableAgainstWorkDone.current),
  ))

  rows.push(multiLineRow(
    'Advances, deposits & prepayments',
    data.currentAssets.advancesDepositsPrepayments.note,
    data.currentAssets.advancesDepositsPrepayments.current,
    data.currentAssets.advancesDepositsPrepayments.prior,
    projCurrent((bs) => bs.currentAssets.advancesDepositsPrepayments.current),
    consolidatedCurrent((bs) => bs.currentAssets.advancesDepositsPrepayments.current),
  ))

  rows.push(multiLineRow(
    'Advance income tax',
    undefined,
    data.currentAssets.advanceIncomeTax.current,
    data.currentAssets.advanceIncomeTax.prior,
    projCurrent((bs) => bs.currentAssets.advanceIncomeTax.current),
    consolidatedCurrent((bs) => bs.currentAssets.advanceIncomeTax.current),
  ))

  rows.push(multiLineRow(
    'Cash and bank balances',
    data.currentAssets.cashAndBankBalances.note,
    data.currentAssets.cashAndBankBalances.current,
    data.currentAssets.cashAndBankBalances.prior,
    projCurrent((bs) => bs.currentAssets.cashAndBankBalances.current),
    consolidatedCurrent((bs) => bs.currentAssets.cashAndBankBalances.current),
  ))

  rows.push(multiSubtotalRow(
    'Subtotal Current Assets',
    data.currentAssets.subtotal.current,
    data.currentAssets.subtotal.prior,
    projCurrent((bs) => bs.currentAssets.subtotal.current),
    consolidatedCurrent((bs) => bs.currentAssets.subtotal.current),
  ))

  // ── Total Assets ──
  rows.push(multiTotalRow(
    'TOTAL ASSETS',
    data.totalAssets.current,
    data.totalAssets.prior,
    projCurrent((bs) => bs.totalAssets.current),
    consolidatedCurrent((bs) => bs.totalAssets.current),
  ))

  // ── CAPITAL AND LIABILITIES header ──
  rows.push(sectionHeaderMulti('CAPITAL AND LIABILITIES', projectColumns.length, !!consolidatedData))

  rows.push(multiLineRow(
    'Capital account',
    data.capital.capitalAccount.note,
    data.capital.capitalAccount.current,
    data.capital.capitalAccount.prior,
    projCurrent((bs) => bs.capital.capitalAccount.current),
    consolidatedCurrent((bs) => bs.capital.capitalAccount.current),
  ))

  // Intra-company loan — special orange row (multi-project)
  rows.push(multiIntraCompanyRow(
    data.capital.intraCompanyLoan.current,
    data.capital.intraCompanyLoan.prior,
    data.capital.intraCompanyLoan.isInterProject,
    projCurrent((bs) => bs.capital.intraCompanyLoan.current),
    consolidatedCurrent((bs) => bs.capital.intraCompanyLoan.current),
  ))

  rows.push(multiSubtotalRow(
    'Non-Current Liabilities',
    data.nonCurrentLiabilities.current,
    data.nonCurrentLiabilities.prior,
    projCurrent((bs) => bs.nonCurrentLiabilities.current),
    consolidatedCurrent((bs) => bs.nonCurrentLiabilities.current),
  ))

  // ── Current Liabilities ──
  rows.push(categoryHeaderMulti('Current Liabilities', projectColumns.length, !!consolidatedData))

  rows.push(multiLineRow(
    'Accrued expenses and other payables',
    data.currentLiabilities.accruedExpenses.note,
    data.currentLiabilities.accruedExpenses.current,
    data.currentLiabilities.accruedExpenses.prior,
    projCurrent((bs) => bs.currentLiabilities.accruedExpenses.current),
    consolidatedCurrent((bs) => bs.currentLiabilities.accruedExpenses.current),
  ))

  rows.push(multiLineRow(
    'Provision for taxation',
    undefined,
    data.currentLiabilities.provisionForTaxation.current,
    data.currentLiabilities.provisionForTaxation.prior,
    projCurrent((bs) => bs.currentLiabilities.provisionForTaxation.current),
    consolidatedCurrent((bs) => bs.currentLiabilities.provisionForTaxation.current),
  ))

  rows.push(multiSubtotalRow(
    'Subtotal Current Liabilities',
    data.currentLiabilities.subtotal.current,
    data.currentLiabilities.subtotal.prior,
    projCurrent((bs) => bs.currentLiabilities.subtotal.current),
    consolidatedCurrent((bs) => bs.currentLiabilities.subtotal.current),
  ))

  rows.push(multiLineRow(
    'Contingencies and commitments',
    data.contingenciesAndCommitments.note,
    data.contingenciesAndCommitments.current,
    data.contingenciesAndCommitments.prior,
    projCurrent((bs) => bs.contingenciesAndCommitments.current),
    consolidatedCurrent((bs) => bs.contingenciesAndCommitments.current),
  ))

  // ── Total Capital and Liabilities ──
  rows.push(multiTotalRow(
    'TOTAL CAPITAL AND LIABILITIES',
    data.totalCapitalAndLiabilities.current,
    data.totalCapitalAndLiabilities.prior,
    projCurrent((bs) => bs.totalCapitalAndLiabilities.current),
    consolidatedCurrent((bs) => bs.totalCapitalAndLiabilities.current),
  ))

  return rows
}

// ════════════════════════════════════════════════════════════════
// SINGLE-PROJECT ROW HELPERS
// ════════════════════════════════════════════════════════════════

/** Major section header (ASSETS / CAPITAL AND LIABILITIES) */
function sectionHeader(label: string) {
  return (
    <TableRow key={`section-${label}`} className="bg-primary/10 hover:bg-primary/10">
      <TableCell colSpan={4} className="text-xs font-bold tracking-wide py-2 text-primary">
        {label}
      </TableCell>
    </TableRow>
  )
}

/** Category header (Non-Current Assets, Current Assets, etc.) */
function categoryHeader(label: string) {
  return (
    <TableRow key={`cat-${label}`} className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={4} className="text-xs font-semibold py-1.5 pl-4">
        {label}
      </TableCell>
    </TableRow>
  )
}

/** Standard line item row */
function lineRow(
  label: string,
  note: number | undefined,
  current: number,
  prior: number,
) {
  return (
    <TableRow key={`line-${label}`}>
      <TableCell className="text-xs pl-6">{label}</TableCell>
      <TableCell className="text-xs text-center">
        {note !== undefined ? <NoteBadge note={note} /> : null}
      </TableCell>
      <TableCell className="text-xs text-right">
        <ValueCell value={current} />
      </TableCell>
      <TableCell className="text-xs text-right">
        <ValueCell value={prior} />
      </TableCell>
    </TableRow>
  )
}

/** Detail / sub-item row (indented further) */
function detailRow(label: string, current: number, prior: number) {
  return (
    <TableRow key={`detail-${label}`} className="text-muted-foreground">
      <TableCell className="text-[10px] pl-10">{label}</TableCell>
      <TableCell />
      <TableCell className="text-[10px] text-right">
        <ValueCell value={current} />
      </TableCell>
      <TableCell className="text-[10px] text-right">
        <ValueCell value={prior} />
      </TableCell>
    </TableRow>
  )
}

/** Subtotal row — border-t-2, font-semibold */
function subtotalRow(label: string, current: number, prior: number) {
  return (
    <TableRow key={`sub-${label}`} className="border-t-2 hover:bg-muted/30">
      <TableCell className="text-xs font-semibold py-2">{label}</TableCell>
      <TableCell />
      <TableCell className="text-xs text-right font-semibold">
        <ValueCell value={current} className="font-semibold" />
      </TableCell>
      <TableCell className="text-xs text-right font-semibold">
        <ValueCell value={prior} className="font-semibold" />
      </TableCell>
    </TableRow>
  )
}

/** Total row — double border, bold, tinted background */
function totalRow(label: string, current: number, prior: number) {
  return (
    <TableRow key={`total-${label}`} className="border-t-4 bg-primary/5 hover:bg-primary/5">
      <TableCell className="text-xs font-bold py-2.5">{label}</TableCell>
      <TableCell />
      <TableCell className="text-xs text-right font-bold">
        <ValueCell value={current} className="font-bold" />
      </TableCell>
      <TableCell className="text-xs text-right font-bold">
        <ValueCell value={prior} className="font-bold" />
      </TableCell>
    </TableRow>
  )
}

/** Intra-company loan row — orange/amber styling */
function intraCompanyRow(current: number, prior: number, isInterProject: boolean) {
  return (
    <TableRow
      key="intra-company-loan"
      className="bg-[#FFF3E0] hover:bg-[#FFF3E0] border-l-4 border-l-amber-400"
    >
      <TableCell className="text-xs pl-6 font-medium">
        Intra company loan{isInterProject ? ' (inter-project)' : ''}
      </TableCell>
      <TableCell />
      <TableCell className="text-xs text-right">
        <ValueCell value={current} />
      </TableCell>
      <TableCell className="text-xs text-right">
        <ValueCell value={prior} />
      </TableCell>
    </TableRow>
  )
}

// ════════════════════════════════════════════════════════════════
// MULTI-PROJECT ROW HELPERS
// ════════════════════════════════════════════════════════════════

function sectionHeaderMulti(label: string, projectCount: number, hasConsolidated: boolean) {
  const colSpan = 4 + projectCount + (hasConsolidated ? 1 : 0)
  return (
    <TableRow key={`section-${label}`} className="bg-primary/10 hover:bg-primary/10">
      <TableCell colSpan={colSpan} className="text-xs font-bold tracking-wide py-2 text-primary">
        {label}
      </TableCell>
    </TableRow>
  )
}

function categoryHeaderMulti(label: string, projectCount: number, hasConsolidated: boolean) {
  const colSpan = 4 + projectCount + (hasConsolidated ? 1 : 0)
  return (
    <TableRow key={`cat-${label}`} className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={colSpan} className="text-xs font-semibold py-1.5 pl-4">
        {label}
      </TableCell>
    </TableRow>
  )
}

function multiLineRow(
  label: string,
  note: number | undefined,
  current: number,
  prior: number,
  projectValues: number[],
  consolidatedValue: number,
) {
  return (
    <TableRow key={`line-${label}`}>
      <TableCell className="text-xs pl-6">{label}</TableCell>
      <TableCell className="text-xs text-center">
        {note !== undefined ? <NoteBadge note={note} /> : null}
      </TableCell>
      <TableCell className="text-xs text-right"><ValueCell value={current} /></TableCell>
      <TableCell className="text-xs text-right"><ValueCell value={prior} /></TableCell>
      {projectValues.map((val, i) => (
        <TableCell key={i} className="text-xs text-right"><ValueCell value={val} /></TableCell>
      ))}
      <TableCell className="text-xs text-right font-medium"><ValueCell value={consolidatedValue} /></TableCell>
    </TableRow>
  )
}

function multiSubtotalRow(
  label: string,
  current: number,
  prior: number,
  projectValues: number[],
  consolidatedValue: number,
) {
  return (
    <TableRow key={`sub-${label}`} className="border-t-2 hover:bg-muted/30">
      <TableCell className="text-xs font-semibold py-2">{label}</TableCell>
      <TableCell />
      <TableCell className="text-xs text-right font-semibold"><ValueCell value={current} className="font-semibold" /></TableCell>
      <TableCell className="text-xs text-right font-semibold"><ValueCell value={prior} className="font-semibold" /></TableCell>
      {projectValues.map((val, i) => (
        <TableCell key={i} className="text-xs text-right font-semibold"><ValueCell value={val} className="font-semibold" /></TableCell>
      ))}
      <TableCell className="text-xs text-right font-bold"><ValueCell value={consolidatedValue} className="font-bold" /></TableCell>
    </TableRow>
  )
}

function multiTotalRow(
  label: string,
  current: number,
  prior: number,
  projectValues: number[],
  consolidatedValue: number,
) {
  return (
    <TableRow key={`total-${label}`} className="border-t-4 bg-primary/5 hover:bg-primary/5">
      <TableCell className="text-xs font-bold py-2.5">{label}</TableCell>
      <TableCell />
      <TableCell className="text-xs text-right font-bold"><ValueCell value={current} className="font-bold" /></TableCell>
      <TableCell className="text-xs text-right font-bold"><ValueCell value={prior} className="font-bold" /></TableCell>
      {projectValues.map((val, i) => (
        <TableCell key={i} className="text-xs text-right font-bold"><ValueCell value={val} className="font-bold" /></TableCell>
      ))}
      <TableCell className="text-xs text-right font-bold"><ValueCell value={consolidatedValue} className="font-bold" /></TableCell>
    </TableRow>
  )
}

function multiIntraCompanyRow(
  current: number,
  prior: number,
  isInterProject: boolean,
  projectValues: number[],
  consolidatedValue: number,
) {
  return (
    <TableRow
      key="intra-company-loan"
      className="bg-[#FFF3E0] hover:bg-[#FFF3E0] border-l-4 border-l-amber-400"
    >
      <TableCell className="text-xs pl-6 font-medium">
        Intra company loan{isInterProject ? ' (inter-project)' : ''}
      </TableCell>
      <TableCell />
      <TableCell className="text-xs text-right"><ValueCell value={current} /></TableCell>
      <TableCell className="text-xs text-right"><ValueCell value={prior} /></TableCell>
      {projectValues.map((val, i) => (
        <TableCell key={i} className="text-xs text-right"><ValueCell value={val} /></TableCell>
      ))}
      <TableCell className="text-xs text-right font-medium"><ValueCell value={consolidatedValue} /></TableCell>
    </TableRow>
  )
}

// ════════════════════════════════════════════════════════════════
// CONSOLIDATION HELPER
// ════════════════════════════════════════════════════════════════

function computeConsolidated(
  projectColumns: Array<{ id: string; name: string; data: BalanceSheetData }>,
): BalanceSheetData {
  const sum = (accessor: (bs: BalanceSheetData) => number) =>
    projectColumns.reduce((acc, col) => acc + accessor(col.data), 0)

  const current = sum((bs) => bs.totalAssets.current)
  const liabilities = sum((bs) => bs.totalCapitalAndLiabilities.current)
  const variance = Math.abs(current - liabilities)

  return {
    nonCurrentAssets: {
      propertyPlantEquipment: {
        note: 4,
        current: sum((bs) => bs.nonCurrentAssets.propertyPlantEquipment.current),
        prior: sum((bs) => bs.nonCurrentAssets.propertyPlantEquipment.prior),
        items: [],
      },
      intangibleAssets: {
        note: 5,
        current: sum((bs) => bs.nonCurrentAssets.intangibleAssets.current),
        prior: sum((bs) => bs.nonCurrentAssets.intangibleAssets.prior),
        items: [],
      },
      capitalWorkInProgress: {
        note: 6,
        current: sum((bs) => bs.nonCurrentAssets.capitalWorkInProgress.current),
        prior: sum((bs) => bs.nonCurrentAssets.capitalWorkInProgress.prior),
        items: [],
      },
      subtotal: {
        current: sum((bs) => bs.nonCurrentAssets.subtotal.current),
        prior: sum((bs) => bs.nonCurrentAssets.subtotal.prior),
      },
    },
    currentAssets: {
      receivableAgainstWorkDone: {
        note: 7,
        current: sum((bs) => bs.currentAssets.receivableAgainstWorkDone.current),
        prior: sum((bs) => bs.currentAssets.receivableAgainstWorkDone.prior),
      },
      advancesDepositsPrepayments: {
        note: 8,
        current: sum((bs) => bs.currentAssets.advancesDepositsPrepayments.current),
        prior: sum((bs) => bs.currentAssets.advancesDepositsPrepayments.prior),
      },
      advanceIncomeTax: {
        current: sum((bs) => bs.currentAssets.advanceIncomeTax.current),
        prior: sum((bs) => bs.currentAssets.advanceIncomeTax.prior),
      },
      cashAndBankBalances: {
        note: 9,
        current: sum((bs) => bs.currentAssets.cashAndBankBalances.current),
        prior: sum((bs) => bs.currentAssets.cashAndBankBalances.prior),
      },
      subtotal: {
        current: sum((bs) => bs.currentAssets.subtotal.current),
        prior: sum((bs) => bs.currentAssets.subtotal.prior),
      },
    },
    totalAssets: {
      current: sum((bs) => bs.totalAssets.current),
      prior: sum((bs) => bs.totalAssets.prior),
    },
    capital: {
      capitalAccount: {
        note: 10,
        current: sum((bs) => bs.capital.capitalAccount.current),
        prior: sum((bs) => bs.capital.capitalAccount.prior),
      },
      intraCompanyLoan: {
        current: 0, // eliminated in consolidation
        prior: 0,
        isInterProject: true,
      },
    },
    nonCurrentLiabilities: {
      current: sum((bs) => bs.nonCurrentLiabilities.current),
      prior: sum((bs) => bs.nonCurrentLiabilities.prior),
      items: [],
    },
    currentLiabilities: {
      accruedExpenses: {
        note: 11,
        current: sum((bs) => bs.currentLiabilities.accruedExpenses.current),
        prior: sum((bs) => bs.currentLiabilities.accruedExpenses.prior),
      },
      provisionForTaxation: {
        current: sum((bs) => bs.currentLiabilities.provisionForTaxation.current),
        prior: sum((bs) => bs.currentLiabilities.provisionForTaxation.prior),
      },
      subtotal: {
        current: sum((bs) => bs.currentLiabilities.subtotal.current),
        prior: sum((bs) => bs.currentLiabilities.subtotal.prior),
      },
    },
    contingenciesAndCommitments: {
      note: 12,
      current: sum((bs) => bs.contingenciesAndCommitments.current),
      prior: sum((bs) => bs.contingenciesAndCommitments.prior),
    },
    totalCapitalAndLiabilities: {
      current: liabilities,
      prior: sum((bs) => bs.totalCapitalAndLiabilities.prior),
    },
    validated: variance <= 1.0,
    variance,
    projectName: 'Consolidated',
  }
}
