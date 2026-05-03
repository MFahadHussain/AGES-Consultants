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
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold tracking-tight">{companyName}</h1>
        <h2 className="text-lg font-semibold mt-1">{reportTitle}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          For the period {periodString}
        </p>
        <p className="text-sm text-muted-foreground">
          {displayProjectName}
        </p>
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
