'use client'

import React from 'react'
import { formatPKR, isNegative, NoteBadge } from '@/components/reports/ReportLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

import type { BalanceSheetData } from '@/lib/reporting/financials'

// ─── Types ────────────────────────────────────────────────────────────────

interface ProjectColumn {
  id: string
  name: string
  code: string
  data: BalanceSheetData
}

interface ConsolidatedBalanceSheetProps {
  byProject: Record<string, {
    projectName: string
    projectCode: string
    balanceSheet: BalanceSheetData
  }>
  consolidated: {
    projectName: string
    balanceSheet: BalanceSheetData
  }
  periodString: string
  priorPeriodString: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function ValueCell({ value, className = '' }: { value: number; className?: string }) {
  if (value === 0) {
    return <span className={`text-muted-foreground/60 ${className}`}>-</span>
  }
  const neg = isNegative(value)
  return (
    <span className={`font-mono tabular-nums text-[11px] ${neg ? 'text-red-600' : ''} ${className}`}>
      {formatPKR(value)}
    </span>
  )
}

function equationHolds(bs: BalanceSheetData): boolean {
  return bs.validated
}

// ─── Main Component ───────────────────────────────────────────────────────

export function ConsolidatedBalanceSheet({
  byProject,
  consolidated,
  periodString,
  priorPeriodString,
}: ConsolidatedBalanceSheetProps) {
  // Build project columns sorted by code
  const projectColumns: ProjectColumn[] = Object.entries(byProject)
    .map(([id, proj]) => ({
      id,
      name: proj.projectName,
      code: proj.projectCode,
      data: proj.balanceSheet,
    }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const consolidatedData = consolidated.balanceSheet
  const totalCols = projectColumns.length + 1 // +1 for consolidated total

  // Guard
  if (projectColumns.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No Projects Found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create active projects and post vouchers to generate the consolidated balance sheet.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Helper to extract per-project current values
  const projCurrent = (accessor: (bs: BalanceSheetData) => number) =>
    projectColumns.map((col) => accessor(col.data))
  const consolidatedCurrent = (accessor: (bs: BalanceSheetData) => number) =>
    accessor(consolidatedData)

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="text-xs">
            {/* ── Header ── */}
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs w-[200px] min-w-[200px] sticky left-0 bg-muted/30 z-10">
                  Particulars
                </TableHead>
                <TableHead className="text-xs text-center w-[40px] min-w-[40px]">Note</TableHead>
                <TableHead className="text-xs text-right min-w-[110px]">
                  PKR<br />{periodString}
                </TableHead>
                <TableHead className="text-xs text-right min-w-[110px]">
                  PKR<br />{priorPeriodString}
                </TableHead>
                {projectColumns.map((col) => {
                  const holds = equationHolds(col.data)
                  return (
                    <TableHead key={col.id} className="text-xs text-right min-w-[120px]">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-semibold">{col.name}</span>
                        {!holds && (
                          <Badge variant="destructive" className="text-[7px] h-3.5 px-1">
                            Variance
                          </Badge>
                        )}
                      </div>
                    </TableHead>
                  )
                })}
                <TableHead className="text-xs text-right min-w-[130px] bg-primary/5">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-bold">Consolidated Total</span>
                    {!equationHolds(consolidatedData) && (
                      <Badge variant="destructive" className="text-[7px] h-3.5 px-1">
                        Variance
                      </Badge>
                    )}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {/* ═══════════════════════════════════════════════════
                  ASSETS
                  ═══════════════════════════════════════════════════ */}
              {sectionHeader('ASSETS', totalCols)}

              {/* ── Non-Current Assets ── */}
              {categoryHeader('Non-Current Assets', totalCols)}

              {multiLineRow(
                'Property, plant and equipment',
                consolidatedData.nonCurrentAssets.propertyPlantEquipment.note,
                consolidatedData.nonCurrentAssets.propertyPlantEquipment.current,
                consolidatedData.nonCurrentAssets.propertyPlantEquipment.prior,
                projCurrent((bs) => bs.nonCurrentAssets.propertyPlantEquipment.current),
                consolidatedCurrent((bs) => bs.nonCurrentAssets.propertyPlantEquipment.current),
              )}

              {multiLineRow(
                'Intangible assets',
                consolidatedData.nonCurrentAssets.intangibleAssets.note,
                consolidatedData.nonCurrentAssets.intangibleAssets.current,
                consolidatedData.nonCurrentAssets.intangibleAssets.prior,
                projCurrent((bs) => bs.nonCurrentAssets.intangibleAssets.current),
                consolidatedCurrent((bs) => bs.nonCurrentAssets.intangibleAssets.current),
              )}

              {multiLineRow(
                'Capital work in progress',
                consolidatedData.nonCurrentAssets.capitalWorkInProgress.note,
                consolidatedData.nonCurrentAssets.capitalWorkInProgress.current,
                consolidatedData.nonCurrentAssets.capitalWorkInProgress.prior,
                projCurrent((bs) => bs.nonCurrentAssets.capitalWorkInProgress.current),
                consolidatedCurrent((bs) => bs.nonCurrentAssets.capitalWorkInProgress.current),
              )}

              {multiSubtotalRow(
                'Subtotal Non-Current Assets',
                consolidatedData.nonCurrentAssets.subtotal.current,
                consolidatedData.nonCurrentAssets.subtotal.prior,
                projCurrent((bs) => bs.nonCurrentAssets.subtotal.current),
                consolidatedCurrent((bs) => bs.nonCurrentAssets.subtotal.current),
              )}

              {/* ── Current Assets ── */}
              {categoryHeader('Current Assets', totalCols)}

              {multiLineRow(
                'Receivable against work done',
                consolidatedData.currentAssets.receivableAgainstWorkDone.note,
                consolidatedData.currentAssets.receivableAgainstWorkDone.current,
                consolidatedData.currentAssets.receivableAgainstWorkDone.prior,
                projCurrent((bs) => bs.currentAssets.receivableAgainstWorkDone.current),
                consolidatedCurrent((bs) => bs.currentAssets.receivableAgainstWorkDone.current),
              )}

              {multiLineRow(
                'Advances, deposits, prepayments and other receivables',
                consolidatedData.currentAssets.advancesDepositsPrepayments.note,
                consolidatedData.currentAssets.advancesDepositsPrepayments.current,
                consolidatedData.currentAssets.advancesDepositsPrepayments.prior,
                projCurrent((bs) => bs.currentAssets.advancesDepositsPrepayments.current),
                consolidatedCurrent((bs) => bs.currentAssets.advancesDepositsPrepayments.current),
              )}

              {multiLineRow(
                'Advance income tax',
                undefined,
                consolidatedData.currentAssets.advanceIncomeTax.current,
                consolidatedData.currentAssets.advanceIncomeTax.prior,
                projCurrent((bs) => bs.currentAssets.advanceIncomeTax.current),
                consolidatedCurrent((bs) => bs.currentAssets.advanceIncomeTax.current),
              )}

              {multiLineRow(
                'Cash and bank balances',
                consolidatedData.currentAssets.cashAndBankBalances.note,
                consolidatedData.currentAssets.cashAndBankBalances.current,
                consolidatedData.currentAssets.cashAndBankBalances.prior,
                projCurrent((bs) => bs.currentAssets.cashAndBankBalances.current),
                consolidatedCurrent((bs) => bs.currentAssets.cashAndBankBalances.current),
              )}

              {multiSubtotalRow(
                'Subtotal Current Assets',
                consolidatedData.currentAssets.subtotal.current,
                consolidatedData.currentAssets.subtotal.prior,
                projCurrent((bs) => bs.currentAssets.subtotal.current),
                consolidatedCurrent((bs) => bs.currentAssets.subtotal.current),
              )}

              {/* ── Total Assets ── */}
              {multiTotalRow(
                'TOTAL ASSETS',
                consolidatedData.totalAssets.current,
                consolidatedData.totalAssets.prior,
                projCurrent((bs) => bs.totalAssets.current),
                consolidatedCurrent((bs) => bs.totalAssets.current),
              )}

              {/* ═══════════════════════════════════════════════════
                  CAPITAL AND LIABILITIES
                  ═══════════════════════════════════════════════════ */}
              {sectionHeader('CAPITAL AND LIABILITIES', totalCols)}

              {multiLineRow(
                'Capital account',
                consolidatedData.capital.capitalAccount.note,
                consolidatedData.capital.capitalAccount.current,
                consolidatedData.capital.capitalAccount.prior,
                projCurrent((bs) => bs.capital.capitalAccount.current),
                consolidatedCurrent((bs) => bs.capital.capitalAccount.current),
              )}

              {/* Intra Company Loan — orange highlight */}
              {multiIntraCompanyRow(
                consolidatedData.capital.intraCompanyLoan.current,
                consolidatedData.capital.intraCompanyLoan.prior,
                consolidatedData.capital.intraCompanyLoan.isInterProject,
                projCurrent((bs) => bs.capital.intraCompanyLoan.current),
                consolidatedCurrent((bs) => bs.capital.intraCompanyLoan.current),
              )}

              {/* ── Non-Current Liabilities ── */}
              {multiSubtotalRow(
                'Non-Current Liabilities',
                consolidatedData.nonCurrentLiabilities.current,
                consolidatedData.nonCurrentLiabilities.prior,
                projCurrent((bs) => bs.nonCurrentLiabilities.current),
                consolidatedCurrent((bs) => bs.nonCurrentLiabilities.current),
              )}

              {/* ── Current Liabilities ── */}
              {categoryHeader('Current Liabilities', totalCols)}

              {multiLineRow(
                'Accrued expenses and other payables',
                consolidatedData.currentLiabilities.accruedExpenses.note,
                consolidatedData.currentLiabilities.accruedExpenses.current,
                consolidatedData.currentLiabilities.accruedExpenses.prior,
                projCurrent((bs) => bs.currentLiabilities.accruedExpenses.current),
                consolidatedCurrent((bs) => bs.currentLiabilities.accruedExpenses.current),
              )}

              {multiLineRow(
                'Provision for taxation',
                undefined,
                consolidatedData.currentLiabilities.provisionForTaxation.current,
                consolidatedData.currentLiabilities.provisionForTaxation.prior,
                projCurrent((bs) => bs.currentLiabilities.provisionForTaxation.current),
                consolidatedCurrent((bs) => bs.currentLiabilities.provisionForTaxation.current),
              )}

              {multiSubtotalRow(
                'Subtotal Current Liabilities',
                consolidatedData.currentLiabilities.subtotal.current,
                consolidatedData.currentLiabilities.subtotal.prior,
                projCurrent((bs) => bs.currentLiabilities.subtotal.current),
                consolidatedCurrent((bs) => bs.currentLiabilities.subtotal.current),
              )}

              {multiLineRow(
                'Contingencies and commitments',
                consolidatedData.contingenciesAndCommitments.note,
                consolidatedData.contingenciesAndCommitments.current,
                consolidatedData.contingenciesAndCommitments.prior,
                projCurrent((bs) => bs.contingenciesAndCommitments.current),
                consolidatedCurrent((bs) => bs.contingenciesAndCommitments.current),
              )}

              {/* ── Total Capital and Liabilities ── */}
              {multiTotalRow(
                'TOTAL CAPITAL AND LIABILITIES',
                consolidatedData.totalCapitalAndLiabilities.current,
                consolidatedData.totalCapitalAndLiabilities.prior,
                projCurrent((bs) => bs.totalCapitalAndLiabilities.current),
                consolidatedCurrent((bs) => bs.totalCapitalAndLiabilities.current),
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Validation footer ── */}
        <div className="px-4 py-3 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            Consolidated Financial Position — {projectColumns.length} project{projectColumns.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Accounting Equation:</span>
            {equationHolds(consolidatedData) ? (
              <Badge className="text-[9px] bg-[#EEF1F8] text-[#0F2D78] border-[#A5B4D2] hover:bg-[#EEF1F8]">
                <CheckCircle2 className="h-3 w-3 mr-1" />Balanced
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[9px]">
                <AlertTriangle className="h-3 w-3 mr-1" />Variance PKR {formatPKR(Math.abs(consolidatedData.variance))}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// ROW HELPERS
// ══════════════════════════════════════════════════════════════════════════

function sectionHeader(label: string, totalCols: number) {
  return (
    <TableRow className="bg-primary/10 hover:bg-primary/10">
      <TableCell colSpan={2 + totalCols} className="text-xs font-bold tracking-wide py-2 text-primary">
        {label}
      </TableCell>
    </TableRow>
  )
}

function categoryHeader(label: string, totalCols: number) {
  return (
    <TableRow className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={2 + totalCols} className="text-xs font-semibold py-1.5 pl-4">
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
    <TableRow className="hover:bg-muted/20">
      <TableCell className="text-xs pl-6 sticky left-0 bg-background z-10">{label}</TableCell>
      <TableCell className="text-xs text-center">
        {note !== undefined ? <NoteBadge note={note} /> : null}
      </TableCell>
      <TableCell className="text-xs text-right"><ValueCell value={current} /></TableCell>
      <TableCell className="text-xs text-right"><ValueCell value={prior} /></TableCell>
      {projectValues.map((val, i) => (
        <TableCell key={i} className="text-xs text-right"><ValueCell value={val} /></TableCell>
      ))}
      <TableCell className="text-xs text-right bg-primary/5 font-medium"><ValueCell value={consolidatedValue} className="font-medium" /></TableCell>
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
    <TableRow className="border-t-2 hover:bg-muted/30">
      <TableCell className="text-xs font-semibold py-2 sticky left-0 bg-background z-10">{label}</TableCell>
      <TableCell />
      <TableCell className="text-xs text-right font-semibold"><ValueCell value={current} className="font-semibold" /></TableCell>
      <TableCell className="text-xs text-right font-semibold"><ValueCell value={prior} className="font-semibold" /></TableCell>
      {projectValues.map((val, i) => (
        <TableCell key={i} className="text-xs text-right font-semibold"><ValueCell value={val} className="font-semibold" /></TableCell>
      ))}
      <TableCell className="text-xs text-right font-bold bg-primary/5"><ValueCell value={consolidatedValue} className="font-bold" /></TableCell>
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
    <TableRow className="border-t-4 bg-primary/5 hover:bg-primary/10">
      <TableCell className="text-xs font-bold py-2.5 sticky left-0 bg-primary/5 z-10">{label}</TableCell>
      <TableCell className="bg-primary/5" />
      <TableCell className="text-xs text-right font-bold"><ValueCell value={current} className="font-bold" /></TableCell>
      <TableCell className="text-xs text-right font-bold"><ValueCell value={prior} className="font-bold" /></TableCell>
      {projectValues.map((val, i) => (
        <TableCell key={i} className="text-xs text-right font-bold"><ValueCell value={val} className="font-bold" /></TableCell>
      ))}
      <TableCell className="text-xs text-right font-bold bg-primary/10"><ValueCell value={consolidatedValue} className="font-bold" /></TableCell>
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
    <TableRow className="bg-[#FFF3E0] hover:bg-[#FFF3E0] border-l-4 border-l-amber-400">
      <TableCell className="text-xs pl-6 font-medium sticky left-0 bg-[#FFF3E0] z-10">
        Intra company loan{isInterProject ? ' (inter-project)' : ''}
      </TableCell>
      <TableCell className="bg-[#FFF3E0]" />
      <TableCell className="text-xs text-right"><ValueCell value={current} /></TableCell>
      <TableCell className="text-xs text-right"><ValueCell value={prior} /></TableCell>
      {projectValues.map((val, i) => (
        <TableCell key={i} className="text-xs text-right"><ValueCell value={val} /></TableCell>
      ))}
      <TableCell className="text-xs text-right font-medium bg-[#FFF8E1]"><ValueCell value={consolidatedValue} className="font-medium" /></TableCell>
    </TableRow>
  )
}
