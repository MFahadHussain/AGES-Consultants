'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Building2, Cpu, Info, TrendingUp, TrendingDown, MapPin, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPKR, formatPKRWithSymbol, formatNegativePKR, formatVariance } from '@/lib/report-utils';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type RowType =
  | 'section_header'
  | 'line_item'
  | 'sub_line'
  | 'subtotal'
  | 'grand_total'
  | 'memo'
  | 'highlighted';

interface ReportRow {
  row_id: string;
  label: string;
  note_ref?: string;
  row_type: RowType;
  indent_level: number;
  values: Record<string, number>;
  prior_values: Record<string, number>;
  drilldown_available: boolean;
  highlight?: string;
}

interface FixedAssetScheduleProps {
  data: {
    columns?: Array<{ key: string; label: string; type: string }>;
    rows?: ReportRow[];
    ppe?:
      | { noteRef: string; totalDepreciationForPeriod: number }
      | Array<LegacyAssetRow>;
    intangibles?:
      | { noteRef: string; totalDepreciationForPeriod: number }
      | Array<LegacyAssetRow>;
    currency?: string;
  };
  scheduleType?: 'ppe' | 'intangible' | 'both';
  projectName?: string;
  detailLevel?: 'summary' | 'detailed';
}

// Legacy row format (old API response)
interface LegacyAssetRow {
  id?: string;
  row_id?: string;
  assetClass?: string;
  label?: string;
  rate?: number | null;
  openingCost?: number;
  opening_cost?: number;
  additions?: number;
  deletions?: number;
  closingCost?: number;
  closing_cost?: number;
  openingAccum?: number;
  opening_acc_dep?: number;
  forPeriod?: number;
  for_period?: number;
  closingAccum?: number;
  closing_acc_dep?: number;
  nbv?: number;
  net_book_value?: number;
  row_type?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW STYLING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getRowClasses(rowType: RowType): string {
  const base = 'border-b border-border/50';
  switch (rowType) {
    case 'section_header':
      return cn(base, 'uppercase font-semibold bg-muted/30 border-b border-border pt-4 text-xs tracking-wider');
    case 'line_item':
      return cn(base, 'font-normal');
    case 'sub_line':
      return cn(base, 'text-muted-foreground text-xs');
    case 'subtotal':
      return cn(base, 'font-semibold bg-muted/10 border-t border-border');
    case 'grand_total':
      return cn(base, 'font-bold bg-muted/20 border-t-4 border-b-2 border-border');
    case 'highlighted':
      return cn(base, 'font-medium bg-amber-50/80 border-l-[3px] border-l-amber-500');
    case 'memo':
      return cn(base, 'italic text-muted-foreground');
    default:
      return base;
  }
}

function getIndentPx(indentLevel: number, rowType: RowType): number {
  if (rowType === 'section_header' || rowType === 'grand_total') return 0;
  return (indentLevel || 1) * 16;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

interface KpiData {
  totalGrossCost: number;
  totalAccumDep: number;
  netBookValue: number;
  totalAdditions: number;
  totalDeletions: number;
  depForPeriod: number;
}

function computeKpiFromRows(rows: ReportRow[], columnKey: string): KpiData {
  let totalGrossCost = 0;
  let totalAccumDep = 0;
  let netBookValue = 0;
  let totalAdditions = 0;
  let totalDeletions = 0;
  let depForPeriod = 0;

  for (const row of rows) {
    const val = row.values?.[columnKey] ?? 0;
    const lower = row.label.toLowerCase();

    if (row.row_type === 'subtotal') {
      if (lower.includes('closing cost')) totalGrossCost = val;
      else if (lower.includes('closing accum')) totalAccumDep = val;
      else if (lower.includes('total additions')) totalAdditions = val;
      else if (lower.includes('total deletions')) totalDeletions = val;
      else if (lower.includes('depreciation for period') || lower.includes('total depreciation')) depForPeriod = val;
    } else if (row.row_type === 'grand_total') {
      if (lower.includes('net book value')) netBookValue = val;
    }
  }

  // Fallback: if we couldn't compute NBV from grand total, derive it
  if (netBookValue === 0 && (totalGrossCost !== 0 || totalAccumDep !== 0)) {
    netBookValue = totalGrossCost - Math.abs(totalAccumDep);
  }

  return { totalGrossCost, totalAccumDep, netBookValue, totalAdditions, totalDeletions, depForPeriod };
}

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN LAYOUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const LABEL_COL_WIDTH = 260;
const NOTE_COL_WIDTH = 56;
const PROJECT_COL_WIDTH = 120;
const CONSOLIDATED_COL_WIDTH = 140;
const PRIOR_COL_WIDTH = 130;
const VARIANCE_COL_WIDTH = 110;

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT HEADER BANNER
// ─────────────────────────────────────────────────────────────────────────────

function ProjectHeaderBanner({
  projectName,
  currency,
  noteRef,
  assetType,
}: {
  projectName?: string;
  currency: string;
  noteRef?: string;
  assetType: 'ppe' | 'intangibles';
}) {
  const title = assetType === 'ppe' ? 'Property, Plant & Equipment' : 'Intangible Assets';
  const icon = assetType === 'ppe' ? Building2 : Cpu;

  return (
    <div className="flex items-center gap-3 bg-muted/40 rounded-lg px-4 py-3 border">
      {React.createElement(icon, { className: 'size-5 text-primary shrink-0' })}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          {noteRef && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5">
              {noteRef}
            </Badge>
          )}
        </div>
        {projectName && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin className="size-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate">{projectName}</span>
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <Badge variant="outline" className="text-[10px] font-mono">
          {currency}
        </Badge>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function KpiCards({ kpi, currency }: { kpi: KpiData; currency: string }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-6">
      <Card className="shadow-sm border-l-4 border-l-emerald-400">
        <CardHeader className="pb-1.5 pt-3 px-4">
          <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5" />
            Closing Cost
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-lg font-bold font-mono tabular-nums">
            {formatPKR(kpi.totalGrossCost)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Consolidated • {currency}</p>
        </CardContent>
      </Card>
      <Card className="shadow-sm border-l-4 border-l-blue-400">
        <CardHeader className="pb-1.5 pt-3 px-4">
          <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="size-3.5" />
            Additions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-lg font-bold font-mono tabular-nums">
            {formatPKR(kpi.totalAdditions)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">During Period</p>
        </CardContent>
      </Card>
      <Card className="shadow-sm border-l-4 border-l-orange-400">
        <CardHeader className="pb-1.5 pt-3 px-4">
          <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingDown className="size-3.5" />
            Deletions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-lg font-bold font-mono tabular-nums">
            {formatPKR(kpi.totalDeletions)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">During Period</p>
        </CardContent>
      </Card>
      <Card className="shadow-sm border-l-4 border-l-red-400">
        <CardHeader className="pb-1.5 pt-3 px-4">
          <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingDown className="size-3.5" />
            Accum. Depreciation
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-lg font-bold font-mono tabular-nums">
            {formatPKR(kpi.totalAccumDep)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Closing</p>
        </CardContent>
      </Card>
      <Card className="shadow-sm border-l-4 border-l-purple-400">
        <CardHeader className="pb-1.5 pt-3 px-4">
          <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <FileText className="size-3.5" />
            Dep. for Period
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-lg font-bold font-mono tabular-nums">
            {formatPKR(kpi.depForPeriod)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Current Year</p>
        </CardContent>
      </Card>
      <Card className="shadow-sm border-l-4 border-l-emerald-600">
        <CardHeader className="pb-1.5 pt-3 px-4">
          <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Building2 className="size-3.5" />
            Net Book Value
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className={cn(
            'text-lg font-bold font-mono tabular-nums',
            kpi.netBookValue >= 0 ? 'text-[#0F2D78]' : 'text-red-600',
          )}>
            {formatPKR(kpi.netBookValue)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Consolidated • {currency}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CASH FLOW LINK CALLOUT
// ─────────────────────────────────────────────────────────────────────────────

function CashFlowCallout({
  totalDepPeriod,
  assetType,
  noteRef,
}: {
  totalDepPeriod: number;
  assetType: 'ppe' | 'intangibles';
  noteRef?: string;
}) {
  const cfLabel =
    assetType === 'ppe'
      ? 'Add: Depreciation on PPE'
      : 'Add: Amortization on Intangibles';

  return (
    <Card className="border-blue-200 bg-blue-50/50 shadow-sm print:bg-white print:border-gray-300">
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-2.5">
          <Info className="size-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-900">
            {assetType === 'ppe' ? 'Depreciation' : 'Amortization'} for period{' '}
            <span className="font-semibold font-mono tabular-nums">
              {formatPKRWithSymbol(totalDepPeriod)}
            </span>{' '}
            is included in the Cash Flow Statement under &ldquo;{cfLabel}&rdquo;
            {noteRef && (
              <>
                {' '}(
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 align-middle">
                  {noteRef}
                </Badge>
                )
              </>
            )}
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-COLUMN TABLE RENDERER (new format)
// ─────────────────────────────────────────────────────────────────────────────

function MultiColumnScheduleTable({
  rows,
  columns,
  detailLevel,
}: {
  rows: ReportRow[];
  columns: Array<{ key: string; label: string; type: string }>;
  detailLevel: 'summary' | 'detailed';
}) {
  const projectCols = columns.filter((c) => c.type === 'project');
  const consolidatedCol = columns.find((c) => c.type === 'total');
  const priorCol = columns.find((c) => c.type === 'prior');
  const varianceCol = columns.find((c) => c.type === 'variance');

  // Filter rows based on detail level
  const filteredRows = useMemo(() => {
    if (detailLevel === 'detailed') return rows;
    // Summary: hide sub_line rows (indent_level >= 3)
    return rows.filter(r => r.row_type !== 'sub_line' || r.indent_level < 3);
  }, [rows, detailLevel]);

  return (
    <ScrollArea className="w-full">
      <div className="min-w-fit">
        <table className="w-full border-collapse text-sm">
          {/* ── Header ── */}
          <thead>
            <tr className="border-b-2 border-border bg-muted/30">
              <th
                className="text-left text-xs font-medium text-muted-foreground sticky left-0 bg-muted/30 z-20 px-3 py-2"
                style={{ minWidth: LABEL_COL_WIDTH, width: LABEL_COL_WIDTH }}
              >
                Particulars
              </th>
              <th
                className="text-center text-xs font-medium text-muted-foreground sticky z-10 px-2 py-2"
                style={{
                  minWidth: NOTE_COL_WIDTH,
                  width: NOTE_COL_WIDTH,
                  left: LABEL_COL_WIDTH,
                  position: 'sticky',
                  backgroundColor: 'hsl(var(--muted) / 0.3)',
                }}
              >
                Note
              </th>
              {/* Project columns */}
              {projectCols.map((col) => (
                <th
                  key={col.key}
                  className="text-right text-xs font-medium text-muted-foreground px-3 py-2 whitespace-nowrap"
                  style={{ minWidth: PROJECT_COL_WIDTH, width: PROJECT_COL_WIDTH }}
                >
                  {col.label}
                </th>
              ))}
              {/* Consolidated */}
              {consolidatedCol && (
                <th
                  className="text-right text-xs font-semibold bg-muted/50 px-3 py-2 whitespace-nowrap border-l border-border"
                  style={{ minWidth: CONSOLIDATED_COL_WIDTH, width: CONSOLIDATED_COL_WIDTH }}
                >
                  Consolidated
                </th>
              )}
              {/* Prior Year */}
              {priorCol && (
                <th
                  className="text-right text-xs font-medium text-muted-foreground px-3 py-2 whitespace-nowrap"
                  style={{ minWidth: PRIOR_COL_WIDTH, width: PRIOR_COL_WIDTH }}
                >
                  Prior Year
                </th>
              )}
              {/* Variance */}
              {varianceCol && (
                <th
                  className="text-right text-xs font-medium px-3 py-2 whitespace-nowrap"
                  style={{ minWidth: VARIANCE_COL_WIDTH, width: VARIANCE_COL_WIDTH }}
                >
                  Variance
                </th>
              )}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {filteredRows.map((row) => {
              const indentPx = getIndentPx(row.indent_level, row.row_type);
              const rowClasses = getRowClasses(row.row_type);
              const isSectionLike =
                row.row_type === 'section_header' ||
                row.row_type === 'grand_total' ||
                row.row_type === 'subtotal';

              return (
                <tr
                  key={row.row_id}
                  className={cn('group transition-colors hover:bg-accent/30', rowClasses)}
                >
                  {/* Label */}
                  <td
                    className={cn(
                      'sticky left-0 z-10 bg-background px-3 py-1.5 text-sm',
                      isSectionLike && 'bg-muted/20',
                      row.row_type === 'highlighted' && 'bg-amber-50/80',
                    )}
                    style={{
                      minWidth: LABEL_COL_WIDTH,
                      width: LABEL_COL_WIDTH,
                      paddingLeft: `${indentPx + 12}px`,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{row.label}</span>
                      {row.note_ref && row.row_type !== 'section_header' && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4 cursor-pointer hover:bg-accent ml-1"
                        >
                          {row.note_ref}
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Note ref column */}
                  <td
                    className={cn(
                      'sticky z-10 bg-background text-center px-2 py-1.5',
                      isSectionLike && 'bg-muted/20',
                      row.row_type === 'highlighted' && 'bg-amber-50/80',
                    )}
                    style={{
                      minWidth: NOTE_COL_WIDTH,
                      width: NOTE_COL_WIDTH,
                      left: LABEL_COL_WIDTH,
                      position: 'sticky',
                    }}
                  >
                    {row.note_ref && row.row_type === 'section_header' ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4 cursor-pointer hover:bg-accent"
                      >
                        {row.note_ref}
                      </Badge>
                    ) : null}
                  </td>

                  {/* Project columns */}
                  {projectCols.map((col) => {
                    const val = row.values?.[col.key];
                    const { text, isNegative } = formatNegativePKR(val ?? 0);
                    return (
                      <td
                        key={col.key}
                        className="text-right px-3 py-1.5 tabular-nums font-mono text-sm"
                        style={{ minWidth: PROJECT_COL_WIDTH, width: PROJECT_COL_WIDTH }}
                      >
                        <span className={cn(isNegative && 'text-red-600')}>
                          {row.row_type === 'memo' ? '—' : text}
                        </span>
                      </td>
                    );
                  })}

                  {/* Consolidated */}
                  {consolidatedCol && (() => {
                    const val = row.values?.[consolidatedCol.key] ?? row.values?.consolidated;
                    const { text, isNegative } = formatNegativePKR(val ?? 0);
                    return (
                      <td
                        className="text-right px-3 py-1.5 tabular-nums font-mono text-sm font-semibold bg-muted/10 border-l border-border"
                        style={{ minWidth: CONSOLIDATED_COL_WIDTH, width: CONSOLIDATED_COL_WIDTH }}
                      >
                        <span className={cn(isNegative && 'text-red-600')}>
                          {row.row_type === 'memo' ? '—' : text}
                        </span>
                      </td>
                    );
                  })()}

                  {/* Prior Year */}
                  {priorCol && (() => {
                    const val = row.values?.[priorCol.key] ?? row.values?.prior_consolidated;
                    const { text, isNegative } = formatNegativePKR(val ?? 0);
                    return (
                      <td
                        className="text-right px-3 py-1.5 tabular-nums font-mono text-sm text-muted-foreground italic"
                        style={{ minWidth: PRIOR_COL_WIDTH, width: PRIOR_COL_WIDTH }}
                      >
                        <span className={cn(isNegative && 'text-red-600')}>
                          {row.row_type === 'memo' ? '—' : text}
                        </span>
                      </td>
                    );
                  })()}

                  {/* Variance */}
                  {varianceCol && (() => {
                    const current = row.values?.consolidated ?? row.values?.[consolidatedCol?.key ?? ''];
                    const prior = row.values?.prior_consolidated ?? row.values?.[priorCol?.key ?? ''];
                    const { text, color } = formatVariance(current ?? 0, prior ?? 0);
                    return (
                      <td
                        className="text-right px-3 py-1.5 tabular-nums font-mono text-sm"
                        style={{ minWidth: VARIANCE_COL_WIDTH, width: VARIANCE_COL_WIDTH }}
                      >
                        <span
                          className={cn(
                            color === '#0F2D78' && 'text-[#0F2D78]',
                            color === 'red' && 'text-red-600',
                          )}
                        >
                          {row.row_type === 'memo' ? '—' : text}
                        </span>
                      </td>
                    );
                  })()}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE SECTION (used for each tab: PPE / Intangibles)
// ─────────────────────────────────────────────────────────────────────────────

function ScheduleSection({
  title,
  noteRef,
  rows,
  columns,
  kpi,
  currency,
  totalDepPeriod,
  assetType,
  projectName,
  detailLevel,
}: {
  title: string;
  noteRef?: string;
  rows: ReportRow[];
  columns: Array<{ key: string; label: string; type: string }>;
  kpi: KpiData;
  currency: string;
  totalDepPeriod: number;
  assetType: 'ppe' | 'intangibles';
  projectName?: string;
  detailLevel: 'summary' | 'detailed';
}) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Cpu className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No {assetType === 'ppe' ? 'PPE' : 'Intangible'} data available for this period.</p>
        <p className="text-xs mt-1">Register assets in FAMS module or select a different date range.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Project Header Banner */}
      <ProjectHeaderBanner
        projectName={projectName}
        currency={currency}
        noteRef={noteRef}
        assetType={assetType}
      />

      {/* KPI Summary Cards */}
      <KpiCards kpi={kpi} currency={currency} />

      {/* Multi-column Schedule Table */}
      <MultiColumnScheduleTable rows={rows} columns={columns} detailLevel={detailLevel} />

      {/* Cash Flow Link Callout */}
      <CashFlowCallout
        totalDepPeriod={totalDepPeriod}
        assetType={assetType}
        noteRef={noteRef}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY TABLE RENDERER (backward-compatible with old API format)
// ─────────────────────────────────────────────────────────────────────────────

function LegacyAssetTable({
  rows,
  noteRef,
  totalDepPeriod,
  assetType,
  currency,
  projectName,
}: {
  rows: LegacyAssetRow[];
  noteRef?: string;
  totalDepPeriod: number;
  assetType: 'ppe' | 'intangibles';
  currency: string;
  projectName?: string;
}) {
  // Normalize rows
  const normalized = rows.map((row, idx) => ({
    id: row.id || row.row_id || `legacy_${idx}`,
    label: row.assetClass || row.label || 'Unknown',
    rate: row.rate,
    openingCost: row.openingCost ?? row.opening_cost ?? 0,
    additions: row.additions ?? 0,
    deletions: row.deletions ?? 0,
    closingCost: row.closingCost ?? row.closing_cost ?? 0,
    openingAccum: row.openingAccum ?? row.opening_acc_dep ?? 0,
    forPeriod: row.forPeriod ?? row.for_period ?? 0,
    closingAccum: row.closingAccum ?? row.closing_acc_dep ?? 0,
    nbv: row.nbv ?? row.net_book_value ?? 0,
    row_type: row.row_type || 'line_item',
  }));

  // Compute totals
  const totals = normalized.reduce(
    (acc, row) => ({
      openingCost: acc.openingCost + (row.row_type !== 'section_header' ? row.openingCost : 0),
      additions: acc.additions + (row.row_type !== 'section_header' ? row.additions : 0),
      deletions: acc.deletions + (row.row_type !== 'section_header' ? row.deletions : 0),
      closingCost: acc.closingCost + (row.row_type !== 'section_header' ? row.closingCost : 0),
      openingAccum: acc.openingAccum + (row.row_type !== 'section_header' ? row.openingAccum : 0),
      forPeriod: acc.forPeriod + (row.row_type !== 'section_header' ? row.forPeriod : 0),
      closingAccum: acc.closingAccum + (row.row_type !== 'section_header' ? row.closingAccum : 0),
      nbv: acc.nbv + (row.row_type !== 'section_header' ? row.nbv : 0),
    }),
    { openingCost: 0, additions: 0, deletions: 0, closingCost: 0, openingAccum: 0, forPeriod: 0, closingAccum: 0, nbv: 0 },
  );

  // KPI
  const kpi: KpiData = {
    totalGrossCost: totals.closingCost,
    totalAccumDep: totals.closingAccum,
    netBookValue: totals.nbv,
    totalAdditions: totals.additions,
    totalDeletions: totals.deletions,
    depForPeriod: totals.forPeriod,
  };

  const sectionTitle =
    assetType === 'ppe'
      ? 'Property, Plant & Equipment'
      : 'Intangible Assets';

  return (
    <div className="space-y-4">
      {/* Project Header Banner */}
      <ProjectHeaderBanner
        projectName={projectName}
        currency={currency}
        noteRef={noteRef}
        assetType={assetType}
      />

      {/* KPI Summary Cards */}
      <KpiCards kpi={kpi} currency={currency} />

      {/* Legacy Table */}
      <ScrollArea className="w-full">
        <div className="min-w-fit">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted/30">
                <th
                  className="text-left text-xs font-medium text-muted-foreground px-3 py-2 sticky left-0 bg-muted/30 z-10"
                  style={{ minWidth: 200 }}
                >
                  Asset Class
                </th>
                <th
                  className="text-center text-xs font-medium text-muted-foreground px-2 py-2"
                  style={{ minWidth: 60 }}
                >
                  Rate %
                </th>
                <th
                  className="text-right text-xs font-medium text-muted-foreground px-3 py-2"
                  style={{ minWidth: 120 }}
                >
                  Opening Cost
                </th>
                <th
                  className="text-right text-xs font-medium text-muted-foreground px-3 py-2"
                  style={{ minWidth: 110 }}
                >
                  Additions
                </th>
                <th
                  className="text-right text-xs font-medium text-muted-foreground px-3 py-2"
                  style={{ minWidth: 110 }}
                >
                  Deletions
                </th>
                <th
                  className="text-right text-xs font-medium text-muted-foreground px-3 py-2"
                  style={{ minWidth: 120 }}
                >
                  Closing Cost
                </th>
                <th
                  className="text-right text-xs font-medium text-muted-foreground px-3 py-2"
                  style={{ minWidth: 130 }}
                >
                  Opening Accum
                </th>
                <th
                  className="text-right text-xs font-medium text-muted-foreground px-3 py-2 bg-blue-50/50 dark:bg-blue-900/20"
                  style={{ minWidth: 120 }}
                >
                  For Period
                </th>
                <th
                  className="text-right text-xs font-medium text-muted-foreground px-3 py-2"
                  style={{ minWidth: 130 }}
                >
                  Closing Accum
                </th>
                <th
                  className="text-right text-xs font-medium text-muted-foreground px-3 py-2"
                  style={{ minWidth: 120 }}
                >
                  NBV
                </th>
              </tr>
            </thead>
            <tbody>
              {normalized.map((row) => {
                const isHeader = row.row_type === 'section_header';
                const isTotal = row.row_type === 'grand_total';

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-border/30 transition-colors',
                      isHeader && 'uppercase font-semibold bg-muted/30 text-xs tracking-wider pt-4',
                      isTotal && 'font-bold bg-muted/20 border-t-4 border-b-2 border-border',
                      !isHeader && !isTotal && 'hover:bg-accent/20',
                    )}
                  >
                    <td
                      className={cn(
                        'px-3 py-2 text-sm sticky left-0 z-10',
                        isHeader && 'bg-muted/30',
                        isTotal && 'bg-muted/20',
                        !isHeader && !isTotal && 'bg-background',
                      )}
                      style={{ minWidth: 200 }}
                    >
                      {row.label}
                    </td>
                    <td className="text-center px-2 py-2 text-sm tabular-nums" style={{ minWidth: 60 }}>
                      {row.rate ? `${row.rate}%` : '—'}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 120 }}>
                      {isHeader ? '' : formatPKR(row.openingCost)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 110 }}>
                      {isHeader ? '' : formatPKR(row.additions)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 110 }}>
                      {isHeader ? '' : formatPKR(row.deletions)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 120 }}>
                      {isHeader ? '' : formatPKR(row.closingCost)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 130 }}>
                      {isHeader ? '' : formatPKR(row.openingAccum)}
                    </td>
                    <td
                      className="text-right px-3 py-2 text-sm tabular-nums font-mono bg-blue-50/30 dark:bg-blue-900/10 font-medium"
                      style={{ minWidth: 120 }}
                    >
                      {isHeader ? '' : formatPKR(row.forPeriod)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 130 }}>
                      {isHeader ? '' : formatPKR(row.closingAccum)}
                    </td>
                    <td
                      className={cn(
                        'text-right px-3 py-2 text-sm tabular-nums font-mono font-semibold',
                        row.nbv < 0 && 'text-red-600',
                      )}
                      style={{ minWidth: 120 }}
                    >
                      {isHeader ? '' : formatPKR(row.nbv)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Cash Flow Callout */}
      <CashFlowCallout
        totalDepPeriod={totalDepPeriod}
        assetType={assetType}
        noteRef={noteRef}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function FixedAssetSchedule({
  data,
  scheduleType = 'both',
  projectName,
  detailLevel = 'detailed',
}: FixedAssetScheduleProps) {
  // ── Detect format ──
  const isNewFormat = !!(data?.columns && data?.rows);
  const isLegacyFormat = !isNewFormat && !!(data?.ppe || data?.intangibles);

  // ── New format: split rows into PPE and Intangibles sections ──
  const { ppeRows, intangibleRows } = useMemo(() => {
    if (!isNewFormat || !data.rows) return { ppeRows: [], intangibleRows: [] };

    const ppe: ReportRow[] = [];
    const intangible: ReportRow[] = [];
    let currentSection: 'ppe' | 'intangible' | null = null;

    for (const row of data.rows!) {
      const idLower = row.row_id.toLowerCase();
      const labelLower = row.label.toLowerCase();

      // Detect section boundaries from row_id prefix or section header labels
      if (row.row_type === 'section_header') {
        if (
          idLower.startsWith('ppe') ||
          labelLower.includes('property') ||
          labelLower.includes('plant') ||
          labelLower.includes('ppe') ||
          labelLower.includes('equipment')
        ) {
          currentSection = 'ppe';
        } else if (
          idLower.startsWith('int') ||
          labelLower.includes('intangible') ||
          labelLower.includes('amortization')
        ) {
          currentSection = 'intangible';
        }
        // Add section headers that are PPE/Intangible specific
        if (
          labelLower.includes('property') ||
          labelLower.includes('plant') ||
          labelLower.includes('ppe') ||
          labelLower.includes('equipment') ||
          labelLower.includes('intangible')
        ) {
          if (currentSection === 'ppe') ppe.push(row);
          else if (currentSection === 'intangible') intangible.push(row);
        }
        // Also add sub-section headers (COST, DEPRECIATION, NET BOOK VALUE) to current section
        if (
          labelLower.includes('cost') ||
          labelLower.includes('depreciation') ||
          labelLower.includes('net book value') ||
          labelLower.includes('opening') ||
          labelLower.includes('addition') ||
          labelLower.includes('deletion') ||
          labelLower.includes('closing')
        ) {
          if (currentSection === 'ppe') ppe.push(row);
          else if (currentSection === 'intangible') intangible.push(row);
        }
        continue;
      }

      // Route rows based on current section or row_id prefix
      if (currentSection === 'ppe' || idLower.startsWith('ppe_')) {
        ppe.push(row);
      } else if (currentSection === 'intangible' || idLower.startsWith('int_')) {
        intangible.push(row);
      } else {
        // Default: PPE-related keywords in label
        if (
          labelLower.includes('depreciation') ||
          labelLower.includes('land') ||
          labelLower.includes('building') ||
          labelLower.includes('machinery') ||
          labelLower.includes('vehicle') ||
          labelLower.includes('furniture')
        ) {
          ppe.push(row);
        } else if (
          labelLower.includes('amortization') ||
          labelLower.includes('software') ||
          labelLower.includes('license')
        ) {
          intangible.push(row);
        } else {
          // If we can't determine, put in PPE
          ppe.push(row);
        }
      }
    }

    return { ppeRows: ppe, intangibleRows: intangible };
  }, [isNewFormat, data.rows]);

  // ── KPI computation ──
  const ppeKpi = useMemo(() => {
    if (isNewFormat && ppeRows.length > 0) {
      return computeKpiFromRows(ppeRows, 'consolidated');
    }
    return null;
  }, [isNewFormat, ppeRows]);

  const intangibleKpi = useMemo(() => {
    if (isNewFormat && intangibleRows.length > 0) {
      return computeKpiFromRows(intangibleRows, 'consolidated');
    }
    return null;
  }, [isNewFormat, intangibleRows]);

  // ── Metadata ──
  const currency = data?.currency || 'PKR';
  const ppeMeta = isNewFormat
    ? (data.ppe as { noteRef: string; totalDepreciationForPeriod: number } | undefined)
    : undefined;
  const intangibleMeta = isNewFormat
    ? (data.intangibles as { noteRef: string; totalDepreciationForPeriod: number } | undefined)
    : undefined;

  // ── Empty state ──
  if (!data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="text-center">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium">No fixed asset schedule data available.</p>
          <p className="text-xs mt-1">Select parameters above and generate a report to view data.</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY FORMAT RENDERING
  // ─────────────────────────────────────────────────────────────────────────
  if (isLegacyFormat) {
    const ppeData = Array.isArray(data.ppe) ? data.ppe : [];
    const intangibleData = Array.isArray(data.intangibles) ? data.intangibles : [];
    const hasPpe = ppeData.length > 0;
    const hasIntangibles = intangibleData.length > 0;

    // Compute totalDepPeriod from legacy rows
    const ppeTotalDep = ppeData.reduce(
      (sum, r) => sum + (r.forPeriod ?? r.for_period ?? 0),
      0,
    );
    const intTotalDep = intangibleData.reduce(
      (sum, r) => sum + (r.forPeriod ?? r.for_period ?? 0),
      0,
    );

    // If scheduleType is specific, show only that tab's content without tabs
    if (scheduleType === 'ppe') {
      return (
        <div className="w-full">
          {hasPpe ? (
            <LegacyAssetTable
              rows={ppeData}
              noteRef="Note 4"
              totalDepPeriod={ppeTotalDep}
              assetType="ppe"
              currency={currency}
              projectName={projectName}
            />
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No PPE data available</p>
            </div>
          )}
        </div>
      );
    }

    if (scheduleType === 'intangible') {
      return (
        <div className="w-full">
          {hasIntangibles ? (
            <LegacyAssetTable
              rows={intangibleData}
              noteRef="Note 5"
              totalDepPeriod={intTotalDep}
              assetType="intangibles"
              currency={currency}
              projectName={projectName}
            />
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Cpu className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No Intangibles data available</p>
            </div>
          )}
        </div>
      );
    }

    // Both tabs
    return (
      <div className="w-full">
        <Tabs defaultValue={hasPpe ? 'ppe' : 'intangibles'} className="w-full">
          <TabsList className="mb-4 print:hidden">
            <TabsTrigger value="ppe" className="flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              PPE
              {hasPpe && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                  Note 4
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="intangibles" className="flex items-center gap-1.5">
              <Cpu className="size-3.5" />
              Intangibles
              {hasIntangibles && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                  Note 5
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ppe">
            {hasPpe ? (
              <LegacyAssetTable
                rows={ppeData}
                noteRef="Note 4"
                totalDepPeriod={ppeTotalDep}
                assetType="ppe"
                currency={currency}
                projectName={projectName}
              />
            ) : (
              <div className="py-8 text-center text-muted-foreground">No PPE data available</div>
            )}
          </TabsContent>

          <TabsContent value="intangibles">
            {hasIntangibles ? (
              <LegacyAssetTable
                rows={intangibleData}
                noteRef="Note 5"
                totalDepPeriod={intTotalDep}
                assetType="intangibles"
                currency={currency}
                projectName={projectName}
              />
            ) : (
              <div className="py-8 text-center text-muted-foreground">No Intangibles data available</div>
            )}
          </TabsContent>

          {/* Print: show both sections */}
          <div className="hidden print:block space-y-6">
            {hasPpe && (
              <LegacyAssetTable
                rows={ppeData}
                noteRef="Note 4"
                totalDepPeriod={ppeTotalDep}
                assetType="ppe"
                currency={currency}
                projectName={projectName}
              />
            )}
            {hasIntangibles && (
              <LegacyAssetTable
                rows={intangibleData}
                noteRef="Note 5"
                totalDepPeriod={intTotalDep}
                assetType="intangibles"
                currency={currency}
                projectName={projectName}
              />
            )}
          </div>
        </Tabs>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NEW FORMAT RENDERING (multi-project columns)
  // ─────────────────────────────────────────────────────────────────────────

  const columns = data.columns || [];
  const hasPpeData = ppeRows.length > 0;
  const hasIntangibleData = intangibleRows.length > 0;

  // If scheduleType is specific, show only that section
  if (scheduleType === 'ppe') {
    return (
      <div className="w-full">
        <ScheduleSection
          title="Property, Plant & Equipment"
          noteRef={ppeMeta?.noteRef || 'Note 4'}
          rows={ppeRows}
          columns={columns}
          kpi={ppeKpi || { totalGrossCost: 0, totalAccumDep: 0, netBookValue: 0, totalAdditions: 0, totalDeletions: 0, depForPeriod: 0 }}
          currency={currency}
          totalDepPeriod={ppeMeta?.totalDepreciationForPeriod || 0}
          assetType="ppe"
          projectName={projectName}
          detailLevel={detailLevel}
        />
      </div>
    );
  }

  if (scheduleType === 'intangible') {
    return (
      <div className="w-full">
        <ScheduleSection
          title="Intangible Assets"
          noteRef={intangibleMeta?.noteRef || 'Note 5'}
          rows={intangibleRows}
          columns={columns}
          kpi={intangibleKpi || { totalGrossCost: 0, totalAccumDep: 0, netBookValue: 0, totalAdditions: 0, totalDeletions: 0, depForPeriod: 0 }}
          currency={currency}
          totalDepPeriod={intangibleMeta?.totalDepreciationForPeriod || 0}
          assetType="intangibles"
          projectName={projectName}
          detailLevel={detailLevel}
        />
      </div>
    );
  }

  // Both: show tabs
  return (
    <div className="w-full">
      <Tabs defaultValue={hasPpeData ? 'ppe' : 'intangibles'} className="w-full">
        <TabsList className="mb-4 print:hidden">
          <TabsTrigger value="ppe" className="flex items-center gap-1.5">
            <Building2 className="size-3.5" />
            PPE
            {hasPpeData && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                Note 4
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="intangibles" className="flex items-center gap-1.5">
            <Cpu className="size-3.5" />
            Intangibles
            {hasIntangibleData && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                Note 5
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ppe">
          <ScheduleSection
            title="Property, Plant & Equipment"
            noteRef={ppeMeta?.noteRef || 'Note 4'}
            rows={ppeRows}
            columns={columns}
            kpi={ppeKpi || { totalGrossCost: 0, totalAccumDep: 0, netBookValue: 0, totalAdditions: 0, totalDeletions: 0, depForPeriod: 0 }}
            currency={currency}
            totalDepPeriod={ppeMeta?.totalDepreciationForPeriod || 0}
            assetType="ppe"
            projectName={projectName}
            detailLevel={detailLevel}
          />
        </TabsContent>

        <TabsContent value="intangibles">
          <ScheduleSection
            title="Intangible Assets"
            noteRef={intangibleMeta?.noteRef || 'Note 5'}
            rows={intangibleRows}
            columns={columns}
            kpi={intangibleKpi || { totalGrossCost: 0, totalAccumDep: 0, netBookValue: 0, totalAdditions: 0, totalDeletions: 0, depForPeriod: 0 }}
            currency={currency}
            totalDepPeriod={intangibleMeta?.totalDepreciationForPeriod || 0}
            assetType="intangibles"
            projectName={projectName}
            detailLevel={detailLevel}
          />
        </TabsContent>

        {/* Print: show both sections */}
        <div className="hidden print:block space-y-8">
          {hasPpeData && (
            <ScheduleSection
              title="Property, Plant & Equipment"
              noteRef={ppeMeta?.noteRef || 'Note 4'}
              rows={ppeRows}
              columns={columns}
              kpi={ppeKpi || { totalGrossCost: 0, totalAccumDep: 0, netBookValue: 0, totalAdditions: 0, totalDeletions: 0, depForPeriod: 0 }}
              currency={currency}
              totalDepPeriod={ppeMeta?.totalDepreciationForPeriod || 0}
              assetType="ppe"
              projectName={projectName}
              detailLevel={detailLevel}
            />
          )}
          {hasIntangibleData && (
            <ScheduleSection
              title="Intangible Assets"
              noteRef={intangibleMeta?.noteRef || 'Note 5'}
              rows={intangibleRows}
              columns={columns}
              kpi={intangibleKpi || { totalGrossCost: 0, totalAccumDep: 0, netBookValue: 0, totalAdditions: 0, totalDeletions: 0, depForPeriod: 0 }}
              currency={currency}
              totalDepPeriod={intangibleMeta?.totalDepreciationForPeriod || 0}
              assetType="intangibles"
              projectName={projectName}
              detailLevel={detailLevel}
            />
          )}
        </div>
      </Tabs>
    </div>
  );
}
