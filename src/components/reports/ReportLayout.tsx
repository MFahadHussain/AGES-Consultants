'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Printer,
  Download,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPeriodString } from '@/lib/report-utils';

interface ReportLayoutProps {
  companyName?: string;
  reportTitle: string;
  fromDate: string;
  toDate: string;
  projectName?: string;
  isConsolidated?: boolean;
  validationFailed?: boolean;
  validationMessage?: string;
  onPrint?: () => void;
  onExportCSV?: () => void;
  exportDisabled?: boolean;
  children: React.ReactNode;
}

export default function ReportLayout({
  companyName = 'AcctFin ERP',
  reportTitle,
  fromDate,
  toDate,
  projectName,
  isConsolidated = false,
  validationFailed = false,
  validationMessage,
  onPrint,
  onExportCSV,
  exportDisabled = false,
  children,
}: ReportLayoutProps) {
  const periodString = formatPeriodString(fromDate, toDate);
  const displayProjectName = isConsolidated ? 'Consolidated' : projectName || 'All Projects';

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-8 text-center shadow-sm print:shadow-none print:border-b-4 print:border-t-0 print:border-x-0 print:border-primary/80 print:rounded-none print:bg-transparent print:p-6 print:mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background/0 to-background/0 print:hidden" />
        <div className="relative z-10">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/10 uppercase tracking-widest text-[10px] print:hidden px-3 py-1">
            Official Financial Statement
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary print:text-4xl">
            {companyName}
          </h1>
          <h2 className="text-xl font-bold mt-2 text-foreground/90 uppercase tracking-wider print:text-foreground">
            {reportTitle}
          </h2>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground bg-background/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-border/50 shadow-sm print:border print:border-border print:bg-transparent print:rounded-md print:px-4 print:py-1 print:shadow-none">
              <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse print:hidden" />
              <span>Period: <strong className="text-foreground">{periodString}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground bg-background/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-border/50 shadow-sm print:border print:border-border print:bg-transparent print:rounded-md print:px-4 print:py-1 print:shadow-none">
              <span className="w-2 h-2 rounded-full bg-primary/60 print:hidden" />
              <span>Project: <strong className="text-foreground">{displayProjectName}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Banner */}
      {validationFailed && (
        <Card className="border-2 border-red-300 bg-red-50 mb-4 print:hidden">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="size-5 text-red-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-sm text-red-800">Validation Failed</h4>
                <p className="text-xs text-red-700 mt-0.5">
                  {validationMessage || 'One or more validation checks have failed. Export is blocked until all issues are resolved.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Content */}
      <div className="mb-8">
        {children}
      </div>

      {/* Footer */}
      <div className="border-t border-border pt-6 mt-8 space-y-8">
        {/* Notes statement */}
        <p className="text-xs text-muted-foreground text-center italic">
          The annexed notes from 1 to 20 form an integral part of financial statements.
        </p>

        {/* Signature blocks */}
        <div className="grid grid-cols-2 gap-8 max-w-xl mx-auto">
          <div className="text-center space-y-8">
            <div />
            <div className="border-t border-foreground pt-2">
              <p className="text-sm font-medium">Managing Partner</p>
            </div>
          </div>
          <div className="text-center space-y-8">
            <div />
            <div className="border-t border-foreground pt-2">
              <p className="text-sm font-medium">Partner</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-end gap-3 mt-8 pt-4 border-t border-border print:hidden">
        <Button variant="outline" onClick={onPrint} className="gap-2">
          <Printer className="size-4" />
          Print
        </Button>
        <Button
          onClick={onExportCSV}
          disabled={exportDisabled || validationFailed}
          className="gap-2"
        >
          <Download className="size-4" />
          Export CSV
        </Button>
        {validationFailed && (
          <span className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle className="size-3" /> Export blocked due to validation errors
          </span>
        )}
      </div>
    </div>
  );
}
