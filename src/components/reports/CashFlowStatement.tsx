'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CheckCircle2, XCircle, ChevronDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPKR, formatNegativePKR, formatVariance, type RowType } from '@/lib/report-utils';

interface CashFlowRow {
  id: string;
  label: string;
  rowType: RowType;
  indentLevel?: number;
  values: Record<string, number | null>; // projectId -> value, plus 'total' and 'priorYear'
  noteRef?: string;
}

interface CashFlowSection {
  id: string;
  title: string;
  noteRef?: string;
  rows: CashFlowRow[];
  sectionTotal: number;
  sectionTotalPrior?: number;
  defaultOpen?: boolean;
}

interface CashFlowStatementProps {
  data: any;
}

export default function CashFlowStatement({ data }: CashFlowStatementProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    if (!data?.sections) return new Set();
    // Default: all open
    return new Set(data.sections.map((s) => s.id));
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!data || !data.sections || data.sections.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <p>No cash flow data available. Generate a report to view data.</p>
      </div>
    );
  }

  const columns = data.columns || [];
  const isReconciled = data.closingCashPerCF === data.cashPerBS;
  const variance = Math.abs(data.closingCashPerCF - data.cashPerBS);

  const projectCols = columns.filter((c) => !c.isConsolidated && !c.isPriorYear);
  const consolidatedCol = columns.find((c) => c.isConsolidated);
  const priorYearCol = columns.find((c) => c.isPriorYear);

  return (
    <div className="w-full space-y-4">
      {/* Three Collapsible Sections */}
      {data.sections.map((section: any) => {
        const isOpen = openSections.has(section.id);
        const visibleRows = section.rows.filter((row: any) => {
          if (row.rowType === 'line_item' || row.rowType === 'sub_line') {
            return Object.values(row.values || {}).some(
              (val) => typeof val === 'number' && Math.abs(val) > 0.001
            );
          }
          return true;
        });

        return (
          <Collapsible
            key={section.id}
            open={isOpen}
            onOpenChange={() => toggleSection(section.id)}
          >
            <Card className="shadow-sm">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ChevronDown
                        className={cn(
                          'size-4 transition-transform',
                          !isOpen && '-rotate-90'
                        )}
                      />
                      {section.title}
                      {section.noteRef && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {section.noteRef}
                        </Badge>
                      )}
                    </CardTitle>
                    <span className="text-sm font-mono tabular-nums">
                      {formatPKR(section.sectionTotal)}
                    </span>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4">
                  <ScrollArea className="w-full [&_[data-radix-scroll-area-viewport]]:print:!overflow-visible print:!overflow-visible print:h-auto">
                    <div className="min-w-fit">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 300 }}>
                              Particulars
                            </th>
                            {projectCols.map((col) => (
                              <th key={col.id} className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 120 }}>
                                {col.label}
                              </th>
                            ))}
                            {consolidatedCol && (
                              <th className="text-right text-xs font-semibold bg-muted/30 px-3 py-2" style={{ minWidth: 140 }}>
                                Consolidated
                              </th>
                            )}
                            {priorYearCol && (
                              <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 140 }}>
                                Prior Year
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row: any) => {
                            const indentPx = row.rowType === 'section_header' ? 0 : (row.indentLevel ?? 1) * 16;
                            return (
                              <tr
                                key={row.id}
                                className={cn(
                                  'border-b border-border/30 hover:bg-accent/20 transition-colors',
                                  row.rowType === 'subtotal' && 'font-medium bg-muted/10 border-t border-border',
                                  row.rowType === 'grand_total' && 'font-semibold bg-muted/20 border-t-2 border-b-2 border-border',
                                  row.rowType === 'memo' && 'italic text-muted-foreground',
                                )}
                              >
                                <td
                                  className="px-3 py-1.5 text-sm"
                                  style={{ minWidth: 300, paddingLeft: `${indentPx + 12}px` }}
                                >
                                  {row.label}
                                  {row.noteRef && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 ml-1.5">
                                      {row.noteRef}
                                    </Badge>
                                  )}
                                </td>
                                {projectCols.map((col) => {
                                  const val = row.values?.[col.id];
                                  const { text, isNegative } = formatNegativePKR(val ?? 0);
                                  return (
                                    <td key={col.id} className="text-right px-3 py-1.5 tabular-nums font-mono text-sm" style={{ minWidth: 120 }}>
                                      <span className={cn(isNegative && 'text-red-600')}>
                                        {row.rowType === 'memo' ? '—' : text}
                                      </span>
                                    </td>
                                  );
                                })}
                                {consolidatedCol && (() => {
                                  const val = row.values?.[consolidatedCol.id] ?? row.values?.consolidated;
                                  const { text, isNegative } = formatNegativePKR(val ?? 0);
                                  return (
                                    <td className="text-right px-3 py-1.5 tabular-nums font-mono text-sm font-semibold bg-muted/5" style={{ minWidth: 140 }}>
                                      <span className={cn(isNegative && 'text-red-600')}>
                                        {row.rowType === 'memo' ? '—' : text}
                                      </span>
                                    </td>
                                  );
                                })()}
                                {priorYearCol && (() => {
                                  const val = row.values?.[priorYearCol.id] ?? row.values?.priorYear;
                                  const { text, isNegative } = formatNegativePKR(val ?? 0);
                                  return (
                                    <td className="text-right px-3 py-1.5 tabular-nums font-mono text-sm text-muted-foreground" style={{ minWidth: 140 }}>
                                      <span className={cn(isNegative && 'text-red-600')}>
                                        {row.rowType === 'memo' ? '—' : text}
                                      </span>
                                    </td>
                                  );
                                })()}
                              </tr>
                            );
                          })}
                          {/* Section Total */}
                          <tr className="font-medium bg-muted/10 border-t border-border">
                            <td className="px-3 py-2 text-sm" style={{ minWidth: 300 }}>
                              Net Cash from {section.title}
                            </td>
                            {projectCols.map((col) => (
                              <td key={col.id} className="text-right px-3 py-2 tabular-nums font-mono text-sm" style={{ minWidth: 120 }}>
                                {formatPKR(section.sectionTotal)}
                              </td>
                            ))}
                            {consolidatedCol && (
                              <td className="text-right px-3 py-2 tabular-nums font-mono text-sm font-semibold bg-muted/5" style={{ minWidth: 140 }}>
                                {formatPKR(section.sectionTotal)}
                              </td>
                            )}
                            {priorYearCol && (
                              <td className="text-right px-3 py-2 tabular-nums font-mono text-sm text-muted-foreground" style={{ minWidth: 140 }}>
                                {formatPKR(section.sectionTotalPrior ?? 0)}
                              </td>
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Reconciliation Callout Box */}
      <Card
        className={cn(
          'shadow-sm border-2',
          isReconciled ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'
        )}
      >
        <CardContent className="py-4 px-4">
          <div className="flex items-start gap-3">
            {isReconciled ? (
              <CheckCircle2 className="size-5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="size-5 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              <h4 className={cn('font-semibold text-sm', isReconciled ? 'text-emerald-800' : 'text-red-800')}>
                {isReconciled
                  ? 'Cash Flow Reconciliation — Verified'
                  : 'Cash Flow Reconciliation — Mismatch Detected'}
              </h4>
              <div className="text-sm space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Closing Cash per Cash Flow Statement:</span>
                  <span className="font-mono tabular-nums font-medium">{formatPKR(data.closingCashPerCF)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Cash & Cash Equivalents per Balance Sheet:</span>
                  <span className="font-mono tabular-nums font-medium">{formatPKR(data.cashPerBS)}</span>
                </div>
                {!isReconciled && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-red-700 font-medium">Variance:</span>
                    <span className="font-mono tabular-nums font-semibold text-red-700">
                      {formatPKR(variance)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
