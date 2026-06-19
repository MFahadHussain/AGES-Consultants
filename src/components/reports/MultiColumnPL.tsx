'use client';

import React, { useMemo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPKR, formatNegativePKR, formatVariance, type RowType } from '@/lib/report-utils';

interface PLRow {
  id: string;
  label: string;
  rowType: RowType;
  indentLevel?: number;
  noteRef?: string;
  values: Record<string, number | null>;
  drilldownAvailable?: boolean;
}

interface PLColumn {
  id: string;
  label: string;
  isConsolidated?: boolean;
  isPriorYear?: boolean;
  isVariance?: boolean;
  isBalanced?: boolean;
  balanceDiff?: number;
}

interface MultiColumnPLProps {
  data: any;
  detailLevel?: 'summary' | 'detailed';
}

function getRowClasses(rowType: RowType): string {
  const base = 'border-b border-border/50 transition-colors';
  switch (rowType) {
    case 'section_header':
      return cn(base, 'uppercase font-bold text-primary bg-primary/5 border-b-2 border-primary/20 pt-4 pb-2 tracking-wider');
    case 'line_item':
      return cn(base, 'font-medium text-foreground hover:bg-accent/40');
    case 'sub_line':
      return cn(base, 'text-muted-foreground text-sm hover:bg-accent/40');
    case 'sub_subtotal':
      return cn(base, 'font-semibold border-t border-border/50 text-foreground bg-muted/10');
    case 'subtotal':
      return cn(base, 'font-bold bg-muted/30 border-t border-border text-foreground');
    case 'grand_total':
      return cn(base, 'font-extrabold bg-primary/10 border-t-2 border-b-2 border-primary text-primary shadow-sm text-base py-2');
    case 'highlighted':
      return cn(base, 'font-medium bg-amber-50/50 border-l-[4px] border-l-amber-500 hover:bg-amber-50');
    case 'memo':
      return cn(base, 'italic text-muted-foreground bg-muted/5');
    default:
      return base;
  }
}

export default function MultiColumnPL({ data, detailLevel = 'summary' }: MultiColumnPLProps) {
  // Filter rows based on detail level - must be before early return for hooks rules
  const visibleRows = useMemo(() => {
    if (!data?.rows) return [];
    let rows = data.rows;
    if (detailLevel !== 'detailed') {
      rows = rows.filter((row: any) => row.rowType !== 'sub_line' && row.rowType !== 'sub_subtotal');
    }

    // Filter out zero-value rows
    rows = rows.filter((row: any) => {
      if (row.rowType === 'line_item' || row.rowType === 'sub_line') {
        return Object.values(row.values || {}).some(
          (val) => typeof val === 'number' && Math.abs(val) > 0.001
        );
      }
      return true;
    });

    return rows.map((row: any) => {
      if (row.drilldownData) {
        return {
          ...row,
          drilldownData: row.drilldownData.filter((drillRow: any) => {
            return Object.values(drillRow.values || {}).some(
              (val) => typeof val === 'number' && Math.abs(val) > 0.001
            );
          }),
        };
      }
      return row;
    });
  }, [data, detailLevel]);

  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <p>No P&L data available. Generate a report to view data.</p>
      </div>
    );
  }

  const columns = data.columns || [];
  const projects = data.projects || [];
  const kpiData = data.kpiData || [];

  // Column widths
  const labelColWidth = 280;
  const noteColWidth = 60;
  const projectColWidth = 120;
  const consolidatedColWidth = 140;
  const priorYearColWidth = 140;
  const varianceColWidth = 120;

  return (
    <div className="w-full space-y-4">
      {/* KPI Summary Cards */}
      {kpiData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {kpiData.map((kpi) => (
            <Card key={kpi.projectId} className="shadow-sm">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {kpi.projectCode} — {kpi.projectName}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="size-3" /> Revenue
                  </span>
                  <span className="text-sm font-mono tabular-nums">{formatPKR(kpi.revenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="size-3" /> Gross Profit
                  </span>
                  <span
                    className={cn(
                      'text-sm font-mono tabular-nums font-medium',
                      kpi.grossProfit >= 0 ? 'text-[#0F2D78]' : 'text-red-600'
                    )}
                  >
                    {formatPKR(kpi.grossProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="size-3" /> Net Profit
                  </span>
                  <span
                    className={cn(
                      'text-sm font-mono tabular-nums font-medium',
                      kpi.netProfit >= 0 ? 'text-[#0F2D78]' : 'text-red-600'
                    )}
                  >
                    {formatPKR(kpi.netProfit)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* P&L Table */}
      <ScrollArea className="w-full [&_[data-radix-scroll-area-viewport]]:print:!overflow-visible print:!overflow-visible print:h-auto">
        <div className="min-w-fit">
          <table className="w-full border-collapse text-sm">
            {/* Header */}
            <thead>
              <tr className="border-b-2 border-border bg-muted/30">
                <th
                  className="text-left text-xs font-medium text-muted-foreground sticky left-0 bg-muted/30 z-20 px-3 py-2"
                  style={{ minWidth: labelColWidth, width: labelColWidth }}
                >
                  Particulars
                </th>
                <th
                  className="text-center text-xs font-medium text-muted-foreground sticky z-10 px-2 py-2"
                  style={{
                    minWidth: noteColWidth,
                    width: noteColWidth,
                    left: labelColWidth,
                    position: 'sticky',
                    backgroundColor: 'hsl(var(--muted) / 0.3)',
                  }}
                >
                  Note
                </th>
                {columns.map((col) => {
                  if (col.isConsolidated) {
                    return (
                      <th
                        key={col.id}
                        className="text-right text-xs font-semibold bg-muted/50 px-3 py-2 whitespace-nowrap"
                        style={{ minWidth: consolidatedColWidth, width: consolidatedColWidth }}
                      >
                        Consolidated
                      </th>
                    );
                  }

                  if (col.isPriorYear) {
                    return (
                      <th
                        key={col.id}
                        className="text-right text-xs font-medium text-muted-foreground px-3 py-2 whitespace-nowrap"
                        style={{ minWidth: priorYearColWidth, width: priorYearColWidth }}
                      >
                        Prior Year
                      </th>
                    );
                  }

                  if (col.isVariance) {
                    return (
                      <th
                        key={col.id}
                        className="text-right text-xs font-medium px-3 py-2 whitespace-nowrap"
                        style={{ minWidth: varianceColWidth, width: varianceColWidth }}
                      >
                        Variance
                      </th>
                    );
                  }

                  // Project column
                  return (
                    <th
                      key={col.id}
                      className="text-right text-xs font-medium text-muted-foreground px-3 py-2 whitespace-nowrap"
                      style={{ minWidth: projectColWidth, width: projectColWidth }}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {col.label}
                        {col.isBalanced !== undefined && (
                          col.isBalanced ? (
                            <CheckCircle2 className="size-3 text-emerald-500" />
                          ) : (
                            <Tooltip>
                              <TooltipTrigger>
                                <XCircle className="size-3 text-red-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                Unbalanced (diff: {formatPKR(col.balanceDiff ?? 0)})
                              </TooltipContent>
                            </Tooltip>
                          )
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {visibleRows.map((row) => {
                const indentPx = (row.rowType === 'section_header' || row.rowType === 'grand_total')
                  ? 0
                  : (row.indentLevel ?? 1) * 16;

                return (
                  <tr
                    key={row.id}
                    className={cn('group transition-colors hover:bg-accent/30', getRowClasses(row.rowType))}
                  >
                    {/* Label */}
                    <td
                      className={cn(
                        'sticky left-0 z-10 bg-background px-3 py-1.5 text-sm',
                        (row.rowType === 'section_header' || row.rowType === 'grand_total' || row.rowType === 'subtotal') && 'bg-muted/20',
                        row.rowType === 'highlighted' && 'bg-amber-50',
                      )}
                      style={{ minWidth: labelColWidth, width: labelColWidth, paddingLeft: `${indentPx}px` }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{row.label}</span>
                        {row.noteRef && row.rowType !== 'section_header' && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-4 cursor-pointer hover:bg-accent ml-1"
                          >
                            {row.noteRef}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Note */}
                    <td
                      className={cn(
                        'sticky z-10 bg-background text-center px-2 py-1.5',
                        (row.rowType === 'section_header' || row.rowType === 'grand_total' || row.rowType === 'subtotal') && 'bg-muted/20',
                        row.rowType === 'highlighted' && 'bg-amber-50',
                      )}
                      style={{ minWidth: noteColWidth, width: noteColWidth, left: labelColWidth, position: 'sticky' }}
                    >
                      {row.noteRef && row.rowType === 'section_header' ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 cursor-pointer hover:bg-accent">
                          {row.noteRef}
                        </Badge>
                      ) : null}
                    </td>

                    {/* Columns */}
                    {columns.map((col) => {
                      if (col.isConsolidated) {
                        const val = row.values?.[col.id];
                        const { text, isNegative } = formatNegativePKR(val ?? 0);
                        return (
                          <td key={col.id} className="text-right px-3 py-1.5 tabular-nums font-mono text-sm font-semibold bg-muted/10" style={{ minWidth: consolidatedColWidth, width: consolidatedColWidth }}>
                            <span className={cn(isNegative && 'text-red-600')}>
                              {row.rowType === 'memo' ? '—' : text}
                            </span>
                          </td>
                        );
                      }

                      if (col.isPriorYear) {
                        const val = row.values?.[col.id];
                        const { text, isNegative } = formatNegativePKR(val ?? 0);
                        return (
                          <td key={col.id} className="text-right px-3 py-1.5 tabular-nums font-mono text-sm text-muted-foreground" style={{ minWidth: priorYearColWidth, width: priorYearColWidth }}>
                            <span className={cn(isNegative && 'text-red-600')}>
                              {row.rowType === 'memo' ? '—' : text}
                            </span>
                          </td>
                        );
                      }

                      if (col.isVariance) {
                        const current = row.values?.consolidated;
                        const prior = row.values?.priorYear;
                        const { text, color } = formatVariance(current ?? 0, prior ?? 0);
                        return (
                          <td key={col.id} className="text-right px-3 py-1.5 tabular-nums font-mono text-sm" style={{ minWidth: varianceColWidth, width: varianceColWidth }}>
                            <span className={cn(color === '#0F2D78' && 'text-[#0F2D78]', color === 'red' && 'text-red-600')}>
                              {row.rowType === 'memo' ? '—' : text}
                            </span>
                          </td>
                        );
                      }

                      // Project columns
                      const val = row.values?.[col.id];
                      const { text, isNegative } = formatNegativePKR(val ?? 0);
                      return (
                        <td key={col.id} className="text-right px-3 py-1.5 tabular-nums font-mono text-sm" style={{ minWidth: projectColWidth, width: projectColWidth }}>
                          <span className={cn(isNegative && 'text-red-600')}>
                            {row.rowType === 'memo' ? '—' : text}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
