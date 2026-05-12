'use client'

import React, { useState } from 'react'
import { formatPKR, isNegative, NoteBadge } from '@/components/reports/ReportLayout'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────────
// Interfaces
// ────────────────────────────────────────────────────────────────

import type { CashFlowData as CashFlowDataType } from '@/lib/reporting/financials'

type CashFlowData = CashFlowDataType

interface CashFlowProps {
  data: CashFlowData
  projectName?: string
  periodString: string
  priorPeriodString: string
}

// ────────────────────────────────────────────────────────────────
// Section configuration
// ────────────────────────────────────────────────────────────────

type SectionKey = 'operating' | 'investing' | 'financing'

interface SectionConfig {
  key: SectionKey
  label: string
  borderColor: string
  badgeVariant: 'default' | 'secondary' | 'outline'
}

const SECTIONS: SectionConfig[] = [
  { key: 'operating', label: 'OPERATING ACTIVITIES', borderColor: 'border-l-blue-500', badgeVariant: 'default' },
  { key: 'investing', label: 'INVESTING ACTIVITIES', borderColor: 'border-l-purple-500', badgeVariant: 'secondary' },
  { key: 'financing', label: 'FINANCING ACTIVITIES', borderColor: 'border-l-amber-500', badgeVariant: 'outline' },
]

// ────────────────────────────────────────────────────────────────
// Amount cell renderer
// ────────────────────────────────────────────────────────────────

function AmountCell({
  amount,
  className,
  isAddBack = false,
}: {
  amount: number
  className?: string
  isAddBack?: boolean
}) {
  const negative = isNegative(amount)
  const colorClass = negative
    ? 'text-red-600'
    : isAddBack && amount > 0
      ? 'text-emerald-700 dark:text-emerald-400'
      : ''

  return (
    <TableCell
      className={`text-right tabular-nums font-mono text-sm ${colorClass} ${className ?? ''}`}
    >
      {formatPKR(amount)}
    </TableCell>
  )
}

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

export default function CashFlow({
  data,
  projectName,
  periodString,
  priorPeriodString,
}: CashFlowProps) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    operating: true,
    investing: true,
    financing: true,
  })

  // Defensive guard: if the API returned an error or data is malformed, show error state
  if (!data || !data.operatingActivities) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Unable to generate Cash Flow Statement</p>
            <p className="text-xs text-muted-foreground mt-1">
              The report data could not be loaded. This may be due to missing chart of accounts configuration or no posted voucher entries for the selected period.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const { operatingActivities, investingActivities, financingActivities } = data

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-lg font-bold tracking-tight">
          Statement of Cash Flows
        </h2>
        {projectName && (
          <p className="text-sm text-muted-foreground">{projectName}</p>
        )}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium">{periodString}</span>
          <span className="text-border">|</span>
          <span>{priorPeriodString}</span>
        </div>
      </div>

      {/* ── Cash Flow Table ── */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[70%] text-xs uppercase tracking-wider">
              Description
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider w-[30%]">
              PKR
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {/* ════════════════════════════════════════════════════════
              OPERATING ACTIVITIES
              ════════════════════════════════════════════════════════ */}
          <TableRow
            className={`bg-muted/30 border-l-4 ${SECTIONS[0].borderColor} cursor-pointer select-none`}
            onClick={() => toggleSection('operating')}
          >
            <TableCell
              colSpan={2}
              className="font-bold text-xs uppercase tracking-wider py-3"
            >
              <span className="inline-flex items-center gap-1.5">
                {openSections.operating ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {SECTIONS[0].label}
              </span>
            </TableCell>
          </TableRow>

          {openSections.operating && (
            <>
              {/* Profit before taxation */}
              <TableRow>
                <TableCell className="text-sm">
                  Profit before taxation
                </TableCell>
                <AmountCell amount={operatingActivities.profitBeforeTaxation} />
              </TableRow>

              {/* Add: Depreciation on PPE */}
              <TableRow>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-2">
                    <span>Add: Depreciation on PPE</span>
                    <NoteBadge note={4} />
                    <span className="text-[9px] text-muted-foreground">
                      ← link to FA Schedule
                    </span>
                  </div>
                </TableCell>
                <AmountCell
                  amount={operatingActivities.depreciationOnPPE}
                  isAddBack
                />
              </TableRow>

              {/* Add: Amortization of intangibles */}
              <TableRow>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-2">
                    <span>Add: Amortization of intangibles</span>
                    <NoteBadge note={5} />
                    <span className="text-[9px] text-muted-foreground">
                      ← link to IA Schedule
                    </span>
                  </div>
                </TableCell>
                <AmountCell
                  amount={operatingActivities.amortizationOfIntangibles}
                  isAddBack
                />
              </TableRow>

              {/* Working capital changes header */}
              <TableRow>
                <TableCell className="text-sm font-medium pl-4">
                  Working capital changes:
                </TableCell>
                <TableCell />
              </TableRow>

              {/* (Increase)/decrease in receivables */}
              <TableRow>
                <TableCell className="text-sm pl-8">
                  (Increase)/decrease in receivables
                </TableCell>
                <AmountCell
                  amount={
                    operatingActivities.workingCapitalChanges
                      .increaseDecreaseInReceivables
                  }
                />
              </TableRow>

              {/* (Increase)/decrease in advances */}
              <TableRow>
                <TableCell className="text-sm pl-8">
                  (Increase)/decrease in advances
                </TableCell>
                <AmountCell
                  amount={
                    operatingActivities.workingCapitalChanges
                      .increaseDecreaseInAdvances
                  }
                />
              </TableRow>

              {/* Increase/(decrease) in accrued expenses */}
              <TableRow>
                <TableCell className="text-sm pl-8">
                  Increase/(decrease) in accrued expenses
                </TableCell>
                <AmountCell
                  amount={
                    operatingActivities.workingCapitalChanges
                      .increaseDecreaseInAccruedExpenses
                  }
                />
              </TableRow>

              {/* Income tax paid */}
              <TableRow>
                <TableCell className="text-sm">
                  Income tax paid
                </TableCell>
                <AmountCell amount={operatingActivities.incomeTaxPaid} />
              </TableRow>

              {/* Net cash from operating activities */}
              <TableRow className="border-t-2">
                <TableCell className="text-sm font-semibold">
                  NET CASH FROM OPERATING ACTIVITIES
                </TableCell>
                <AmountCell
                  amount={operatingActivities.netCashFromOperatingActivities}
                  className="font-semibold"
                />
              </TableRow>
            </>
          )}

          {/* ════════════════════════════════════════════════════════
              INVESTING ACTIVITIES
              ════════════════════════════════════════════════════════ */}
          <TableRow
            className={`bg-muted/30 border-l-4 ${SECTIONS[1].borderColor} cursor-pointer select-none`}
            onClick={() => toggleSection('investing')}
          >
            <TableCell
              colSpan={2}
              className="font-bold text-xs uppercase tracking-wider py-3"
            >
              <span className="inline-flex items-center gap-1.5">
                {openSections.investing ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {SECTIONS[1].label}
              </span>
            </TableCell>
          </TableRow>

          {openSections.investing && (
            <>
              {/* Capital expenditure on PPE */}
              <TableRow>
                <TableCell className="text-sm">
                  Capital expenditure on PPE
                </TableCell>
                <AmountCell amount={investingActivities.capitalExpenditureOnPPE} />
              </TableRow>

              {/* Proceeds from disposal of assets */}
              <TableRow>
                <TableCell className="text-sm">
                  Proceeds from disposal of assets
                </TableCell>
                <AmountCell
                  amount={investingActivities.proceedsFromDisposalOfAssets}
                />
              </TableRow>

              {/* Net cash from investing activities */}
              <TableRow className="border-t-2">
                <TableCell className="text-sm font-semibold">
                  NET CASH FROM INVESTING ACTIVITIES
                </TableCell>
                <AmountCell
                  amount={investingActivities.netCashFromInvestingActivities}
                  className="font-semibold"
                />
              </TableRow>
            </>
          )}

          {/* ════════════════════════════════════════════════════════
              FINANCING ACTIVITIES
              ════════════════════════════════════════════════════════ */}
          <TableRow
            className={`bg-muted/30 border-l-4 ${SECTIONS[2].borderColor} cursor-pointer select-none`}
            onClick={() => toggleSection('financing')}
          >
            <TableCell
              colSpan={2}
              className="font-bold text-xs uppercase tracking-wider py-3"
            >
              <span className="inline-flex items-center gap-1.5">
                {openSections.financing ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {SECTIONS[2].label}
              </span>
            </TableCell>
          </TableRow>

          {openSections.financing && (
            <>
              {/* Loan receipts */}
              <TableRow>
                <TableCell className="text-sm">Loan receipts</TableCell>
                <AmountCell amount={financingActivities.loanReceipts} />
              </TableRow>

              {/* Loan repayments */}
              <TableRow>
                <TableCell className="text-sm">Loan repayments</TableCell>
                <AmountCell amount={financingActivities.loanRepayments} />
              </TableRow>

              {/* Net cash from financing activities */}
              <TableRow className="border-t-2">
                <TableCell className="text-sm font-semibold">
                  NET CASH FROM FINANCING ACTIVITIES
                </TableCell>
                <AmountCell
                  amount={financingActivities.netCashFromFinancingActivities}
                  className="font-semibold"
                />
              </TableRow>
            </>
          )}

          {/* ════════════════════════════════════════════════════════
              SUMMARY LINES
              ════════════════════════════════════════════════════════ */}

          {/* Net increase/(decrease) in cash */}
          <TableRow>
            <TableCell className="text-sm font-medium">
              Net increase/(decrease) in cash
            </TableCell>
            <AmountCell
              amount={data.netIncreaseDecreaseInCash}
              className="font-medium"
            />
          </TableRow>

          {/* Opening cash and bank balances */}
          <TableRow>
            <TableCell className="text-sm">
              Opening cash and bank balances
            </TableCell>
            <AmountCell amount={data.openingCashAndBankBalances} />
          </TableRow>

          {/* Closing cash and bank balances – final total */}
          <TableRow className="border-t-4 bg-primary/5">
            <TableCell className="text-sm font-bold">
              CLOSING CASH AND BANK BALANCES
            </TableCell>
            <AmountCell
              amount={data.closingCashAndBankBalances}
              className="font-bold"
            />
          </TableRow>
        </TableBody>
      </Table>

      {/* ── Reconciliation Callout ── */}
      {data.reconciled ? (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
          <CardContent className="flex items-start gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-400 text-emerald-700 dark:border-emerald-600 dark:text-emerald-300 text-[10px]">
                Reconciled
              </Badge>
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                Closing cash PKR{' '}
                {formatPKR(data.closingCashAndBankBalances)} reconciles to Cash
                and bank balances on the Balance Sheet.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-[10px]">
                Variance
              </Badge>
              <p className="text-sm text-red-800 dark:text-red-200">
                Closing cash PKR{' '}
                {formatPKR(data.closingCashAndBankBalances)} does NOT reconcile to
                Balance Sheet (BS: PKR{' '}
                {formatPKR(data.balanceSheetCashBalance)}, Variance: PKR{' '}
                {formatPKR(data.reconciliationVariance)})
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export type { CashFlowProps, CashFlowData }
