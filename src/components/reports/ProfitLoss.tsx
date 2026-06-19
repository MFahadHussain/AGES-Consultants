'use client'

import React from 'react'
import { formatPKR, isNegative, NoteBadge } from '@/components/reports/ReportLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react'

// ─── Type Definitions ────────────────────────────────────────────────────────

import type { ProfitLossData as ProfitLossDataType, AccountLine as AccountLineType } from '@/lib/reporting/financials'

type AccountLine = AccountLineType
type ProfitLossData = ProfitLossDataType

interface ProfitLossProps {
  data: ProfitLossData
  projectName?: string
  periodString: string
  priorPeriodString: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcDelta(current: number, prior: number): { pct: string; direction: 'up' | 'down' | 'flat' } {
  if (prior === 0) {
    if (current === 0) return { pct: 'N/A', direction: 'flat' }
    return { pct: 'N/A', direction: current > 0 ? 'up' : 'down' }
  }
  const raw = ((current - prior) / Math.abs(prior)) * 100
  if (raw > 0) return { pct: `+${raw.toFixed(1)}%`, direction: 'up' }
  if (raw < 0) return { pct: `${raw.toFixed(1)}%`, direction: 'down' }
  return { pct: '0.0%', direction: 'flat' }
}

function formatCell(value: number, isDeduction?: boolean): React.ReactNode {
  const negative = isNegative(value)
  const displayValue = isDeduction && value > 0 ? -value : value
  const abs = Math.abs(displayValue)
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs)

  if (negative || (isDeduction && value > 0)) {
    return <span className="text-red-600">({formatted})</span>
  }
  return <span>{formatted}</span>
}

// ─── KPI Card Sub-component ──────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  current: number
  prior: number
  marginLabel?: string
  marginValue?: number
}

function KpiCard({ title, current, prior, marginLabel, marginValue }: KpiCardProps) {
  const delta = calcDelta(current, prior)
  const DeltaIcon = delta.direction === 'up' ? TrendingUp : delta.direction === 'down' ? TrendingDown : Minus

  return (
    <Card className="gap-3 py-3">
      <CardContent className="p-3 pt-0 space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className={`text-lg font-bold ${isNegative(current) ? 'text-red-600' : ''}`}>
          PKR {formatPKR(current)}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              delta.direction === 'up'
                ? 'bg-[#EEF1F8] text-emerald-700'
                : delta.direction === 'down'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            <DeltaIcon className="h-3 w-3" />
            {delta.pct}
          </span>
          <span className="text-[9px] text-muted-foreground">vs prior</span>
        </div>
        {marginLabel != null && marginValue != null && (
          <p className="text-[10px] text-muted-foreground">
            {marginLabel}{' '}
            <span className={`font-semibold ${isNegative(marginValue) ? 'text-red-600' : 'text-foreground'}`}>
              {marginValue.toFixed(1)}%
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProfitLoss({ data, projectName, periodString, priorPeriodString }: ProfitLossProps) {
  // Defensive guard: if the API returned an error or data is malformed, show error state
  if (!data || !data.revenue) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Unable to generate Profit & Loss</p>
            <p className="text-xs text-muted-foreground mt-1">
              The report data could not be loaded. This may be due to missing chart of accounts configuration or no posted voucher entries for the selected period.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Compute EBITDA: grossProfit + otherIncome - operatingExpenses (exclude D&A)
  const ebitdaCurrent = data.grossProfit.current + data.otherIncome.current - data.operatingExpenses.current
  const ebitdaPrior = data.grossProfit.prior + data.otherIncome.prior - data.operatingExpenses.prior

  // Margin calculations
  const grossMarginCurrent = data.revenue.current !== 0 ? (data.grossProfit.current / data.revenue.current) * 100 : 0
  const grossMarginPrior = data.revenue.prior !== 0 ? (data.grossProfit.prior / data.revenue.prior) * 100 : 0
  const netMarginCurrent = data.revenue.current !== 0 ? (data.netProfitAfterTax.current / data.revenue.current) * 100 : 0
  const netMarginPrior = data.revenue.prior !== 0 ? (data.netProfitAfterTax.prior / data.revenue.prior) * 100 : 0

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Revenue"
          current={data.revenue.current}
          prior={data.revenue.prior}
        />
        <KpiCard
          title="Gross Profit"
          current={data.grossProfit.current}
          prior={data.grossProfit.prior}
          marginLabel="Gross Margin"
          marginValue={grossMarginCurrent}
        />
        <KpiCard
          title="EBITDA"
          current={ebitdaCurrent}
          prior={ebitdaPrior}
        />
        <KpiCard
          title="Net Profit"
          current={data.netProfitAfterTax.current}
          prior={data.netProfitAfterTax.prior}
          marginLabel="Net Margin"
          marginValue={netMarginCurrent}
        />
      </div>

      {/* ── P&L Table ─────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-semibold w-[40%]">Particulars</TableHead>
                <TableHead className="text-[11px] font-semibold w-[15%] text-center">Notes</TableHead>
                <TableHead className="text-[11px] font-semibold text-right w-[22.5%]">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-muted-foreground font-normal">PKR Rupees</span>
                    <span>{periodString}</span>
                  </div>
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-right w-[22.5%]">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-muted-foreground font-normal">PKR Rupees</span>
                    <span>{priorPeriodString}</span>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* ── Revenue Section ──────────────────────────────────────── */}
              {data.revenue.items.length > 0 ? (
                data.revenue.items.map((item, idx) => (
                  <TableRow key={`rev-${idx}`} className="hover:bg-muted/30">
                    <TableCell className="text-xs pl-4">
                      {item.code && <span className="font-mono text-muted-foreground mr-2">{item.code}</span>}
                      {item.name}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-xs text-right font-mono">
                      {formatCell(item.current)}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {formatCell(item.prior)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-muted/30">
                  <TableCell className="text-xs font-medium">Revenue from contracts with customers</TableCell>
                  <TableCell className="text-center"><NoteBadge note={data.revenue.note} /></TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {formatCell(data.revenue.current)}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {formatCell(data.revenue.prior)}
                  </TableCell>
                </TableRow>
              )}

              {/* Revenue total if items exist */}
              {data.revenue.items.length > 0 && (
                <TableRow className="hover:bg-muted/30">
                  <TableCell className="text-xs font-medium">Revenue from contracts with customers</TableCell>
                  <TableCell className="text-center"><NoteBadge note={data.revenue.note} /></TableCell>
                  <TableCell className="text-xs text-right font-mono font-semibold">
                    {formatCell(data.revenue.current)}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono font-semibold">
                    {formatCell(data.revenue.prior)}
                  </TableCell>
                </TableRow>
              )}

              {/* ── Cost of Work Done ────────────────────────────────────── */}
              {data.costOfWorkDone.items.length > 0 ? (
                data.costOfWorkDone.items.map((item, idx) => (
                  <TableRow key={`cowd-${idx}`} className="hover:bg-muted/30">
                    <TableCell className="text-xs pl-4">
                      {item.code && <span className="font-mono text-muted-foreground mr-2">{item.code}</span>}
                      {item.name}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-xs text-right font-mono">
                      {formatCell(item.current, true)}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {formatCell(item.prior, true)}
                    </TableCell>
                  </TableRow>
                ))
              ) : null}

              <TableRow className="hover:bg-muted/30">
                <TableCell className="text-xs font-medium">Cost of work done</TableCell>
                <TableCell className="text-center"><NoteBadge note={data.costOfWorkDone.note} /></TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {formatCell(data.costOfWorkDone.current, true)}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {formatCell(data.costOfWorkDone.prior, true)}
                </TableCell>
              </TableRow>

              {/* ── GROSS PROFIT ─────────────────────────────────────────── */}
              <TableRow className="border-t-2 font-semibold bg-emerald-50/50 hover:bg-emerald-50/70">
                <TableCell className="text-xs uppercase tracking-wider">Gross Profit</TableCell>
                <TableCell />
                <TableCell className="text-xs text-right font-mono font-semibold">
                  {formatCell(data.grossProfit.current)}
                </TableCell>
                <TableCell className="text-xs text-right font-mono font-semibold">
                  {formatCell(data.grossProfit.prior)}
                </TableCell>
              </TableRow>

              {/* ── Other Income ─────────────────────────────────────────── */}
              {data.otherIncome.items.length > 0 ? (
                data.otherIncome.items.map((item, idx) => (
                  <TableRow key={`oi-${idx}`} className="hover:bg-muted/30">
                    <TableCell className="text-xs pl-4">
                      {item.code && <span className="font-mono text-muted-foreground mr-2">{item.code}</span>}
                      {item.name}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-xs text-right font-mono">
                      {formatCell(item.current)}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {formatCell(item.prior)}
                    </TableCell>
                  </TableRow>
                ))
              ) : null}

              <TableRow className="hover:bg-muted/30">
                <TableCell className="text-xs font-medium">Other income</TableCell>
                <TableCell className="text-center"><NoteBadge note={data.otherIncome.note} /></TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {formatCell(data.otherIncome.current)}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {formatCell(data.otherIncome.prior)}
                </TableCell>
              </TableRow>

              {/* ── Operating Expenses ───────────────────────────────────── */}
              {data.operatingExpenses.items.length > 0 ? (
                data.operatingExpenses.items.map((item, idx) => (
                  <TableRow key={`opex-${idx}`} className="hover:bg-muted/30">
                    <TableCell className="text-xs pl-4">
                      {item.code && <span className="font-mono text-muted-foreground mr-2">{item.code}</span>}
                      {item.name}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-xs text-right font-mono">
                      {formatCell(item.current, true)}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {formatCell(item.prior, true)}
                    </TableCell>
                  </TableRow>
                ))
              ) : null}

              <TableRow className="hover:bg-muted/30">
                <TableCell className="text-xs font-medium">Operating expenses</TableCell>
                <TableCell />
                <TableCell className="text-xs text-right font-mono">
                  {formatCell(data.operatingExpenses.current, true)}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {formatCell(data.operatingExpenses.prior, true)}
                </TableCell>
              </TableRow>

              {/* ── Depreciation & Amortization ──────────────────────────── */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="text-xs font-medium">Depreciation &amp; amortization</TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex gap-1">
                    <NoteBadge note={4} />
                    <NoteBadge note={5} />
                  </span>
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {formatCell(data.depreciationAndAmortization.current, true)}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {formatCell(data.depreciationAndAmortization.prior, true)}
                </TableCell>
              </TableRow>

              {/* ── PROFIT BEFORE TAXATION ──────────────────────────────── */}
              <TableRow className="border-t-2 font-semibold bg-blue-50/50 hover:bg-blue-50/70">
                <TableCell className="text-xs uppercase tracking-wider">Profit Before Taxation</TableCell>
                <TableCell />
                <TableCell className="text-xs text-right font-mono font-semibold">
                  {formatCell(data.profitBeforeTaxation.current)}
                </TableCell>
                <TableCell className="text-xs text-right font-mono font-semibold">
                  {formatCell(data.profitBeforeTaxation.prior)}
                </TableCell>
              </TableRow>

              {/* ── Provision for Taxation ──────────────────────────────── */}
              <TableRow className="hover:bg-muted/30">
                <TableCell className="text-xs font-medium">Provision for taxation</TableCell>
                <TableCell className="text-center"><NoteBadge note={data.provisionForTaxation.note} /></TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {formatCell(data.provisionForTaxation.current, true)}
                </TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {formatCell(data.provisionForTaxation.prior, true)}
                </TableCell>
              </TableRow>

              {/* ── NET PROFIT AFTER TAXATION ───────────────────────────── */}
              <TableRow className="border-t-4 font-bold bg-primary/5 hover:bg-primary/10">
                <TableCell className="text-xs uppercase tracking-widest">Net Profit After Taxation</TableCell>
                <TableCell />
                <TableCell className="text-xs text-right font-mono font-bold">
                  {formatCell(data.netProfitAfterTax.current)}
                </TableCell>
                <TableCell className="text-xs text-right font-mono font-bold">
                  {formatCell(data.netProfitAfterTax.prior)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
