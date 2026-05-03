'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Info, Building2, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPKR, formatPKRWithSymbol } from '@/lib/report-utils';

interface AssetRow {
  id: string;
  assetClass: string;
  rate: number;
  openingCost: number;
  additions: number;
  deletions: number;
  closingCost: number;
  openingAccum: number;
  forPeriod: number;
  closingAccum: number;
  nbv: number;
}

interface FixedAssetScheduleProps {
  data: any;
  scheduleType?: 'ppe' | 'intangible';
}

export default function FixedAssetSchedule({ data }: FixedAssetScheduleProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <p>No fixed asset schedule data available. Generate a report to view data.</p>
      </div>
    );
  }

  const renderAssetTable = (
    rows: AssetRow[],
    noteRef: string,
    totalDepPeriod: number,
    assetType: 'ppe' | 'intangibles'
  ) => {
    // Compute totals
    const totals = rows.reduce(
      (acc, row) => ({
        openingCost: acc.openingCost + (row.openingCost || 0),
        additions: acc.additions + (row.additions || 0),
        deletions: acc.deletions + (row.deletions || 0),
        closingCost: acc.closingCost + (row.closingCost || 0),
        openingAccum: acc.openingAccum + (row.openingAccum || 0),
        forPeriod: acc.forPeriod + (row.forPeriod || 0),
        closingAccum: acc.closingAccum + (row.closingAccum || 0),
        nbv: acc.nbv + (row.nbv || 0),
      }),
      { openingCost: 0, additions: 0, deletions: 0, closingCost: 0, openingAccum: 0, forPeriod: 0, closingAccum: 0, nbv: 0 }
    );

    const cfLabel = assetType === 'ppe' ? 'Add: Depreciation on PPE' : 'Add: Amortization on Intangibles';

    return (
      <div className="space-y-4">
        <ScrollArea className="w-full">
          <div className="min-w-fit">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 sticky left-0 bg-muted/30 z-10" style={{ minWidth: 200 }}>
                    Asset Class
                  </th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-2 py-2" style={{ minWidth: 60 }}>
                    Rate %
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 120 }}>
                    Opening Cost
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 110 }}>
                    Additions
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 110 }}>
                    Deletions
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 120 }}>
                    Closing Cost
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 130 }}>
                    Opening Accum
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2 bg-blue-50/50" style={{ minWidth: 120 }}>
                    For Period
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 130 }}>
                    Closing Accum
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 120 }}>
                    NBV
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                    <td className="px-3 py-2 text-sm sticky left-0 bg-background z-10" style={{ minWidth: 200 }}>
                      {row.assetClass}
                    </td>
                    <td className="text-center px-2 py-2 text-sm tabular-nums" style={{ minWidth: 60 }}>
                      {row.rate || '—'}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 120 }}>
                      {formatPKR(row.openingCost)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 110 }}>
                      {formatPKR(row.additions)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 110 }}>
                      {formatPKR(row.deletions)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 120 }}>
                      {formatPKR(row.closingCost)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 130 }}>
                      {formatPKR(row.openingAccum)}
                    </td>
                    <td
                      className="text-right px-3 py-2 text-sm tabular-nums font-mono bg-blue-50/30 font-medium"
                      style={{ minWidth: 120 }}
                    >
                      {formatPKR(row.forPeriod)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 130 }}>
                      {formatPKR(row.closingAccum)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono font-semibold" style={{ minWidth: 120 }}>
                      {formatPKR(row.nbv)}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-border bg-muted/10 font-semibold">
                  <td className="px-3 py-2 text-sm sticky left-0 bg-muted/10 z-10" style={{ minWidth: 200 }}>
                    Total
                  </td>
                  <td className="text-center px-2 py-2 text-sm" style={{ minWidth: 60 }} />
                  <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 120 }}>
                    {formatPKR(totals.openingCost)}
                  </td>
                  <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 110 }}>
                    {formatPKR(totals.additions)}
                  </td>
                  <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 110 }}>
                    {formatPKR(totals.deletions)}
                  </td>
                  <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 120 }}>
                    {formatPKR(totals.closingCost)}
                  </td>
                  <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 130 }}>
                    {formatPKR(totals.openingAccum)}
                  </td>
                  <td className="text-right px-3 py-2 text-sm tabular-nums font-mono bg-blue-50/50" style={{ minWidth: 120 }}>
                    {formatPKR(totals.forPeriod)}
                  </td>
                  <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 130 }}>
                    {formatPKR(totals.closingAccum)}
                  </td>
                  <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 120 }}>
                    {formatPKR(totals.nbv)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Callout: Depreciation linked to Cash Flow */}
        <Card className="border-blue-200 bg-blue-50/50 shadow-sm">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-2.5">
              <Info className="size-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-900">
                Depreciation for period {formatPKRWithSymbol(totalDepPeriod)} is included in the
                Cash Flow Statement under &ldquo;{cfLabel}&rdquo;.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="w-full">
      <Tabs defaultValue="ppe" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="ppe" className="flex items-center gap-1.5">
            <Building2 className="size-3.5" />
            PPE
            {data.ppe && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                {data.ppe.noteRef}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="intangibles" className="flex items-center gap-1.5">
            <Cpu className="size-3.5" />
            Intangibles
            {data.intangibles && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                {data.intangibles.noteRef}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ppe">
          {data.ppe ? (
            renderAssetTable(data.ppe.rows, data.ppe.noteRef, data.ppe.totalDepreciationForPeriod, 'ppe')
          ) : (
            <div className="py-8 text-center text-muted-foreground">No PPE data available</div>
          )}
        </TabsContent>

        <TabsContent value="intangibles">
          {data.intangibles ? (
            renderAssetTable(data.intangibles.rows, data.intangibles.noteRef, data.intangibles.totalDepreciationForPeriod, 'intangibles')
          ) : (
            <div className="py-8 text-center text-muted-foreground">No Intangibles data available</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
