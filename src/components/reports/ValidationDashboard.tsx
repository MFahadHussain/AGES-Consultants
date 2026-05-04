'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPKR } from '@/lib/report-utils';

interface ValidationResult {
  id: string;
  rule: string;
  project: string;
  status: 'passed' | 'failed' | 'warning';
  expected: number;
  actual: number;
  variance: number;
  description?: string;
}

interface ValidationDashboardProps {
  results: ValidationResult[] | null;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ValidationDashboard({
  results,
  isOpen = true,
  onClose,
}: ValidationDashboardProps) {
  const summary = useMemo(() => {
    if (!results || results.length === 0) {
      return { total: 0, passed: 0, failed: 0, warnings: 0, allPassed: false };
    }
    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const warnings = results.filter((r) => r.status === 'warning').length;
    return {
      total: results.length,
      passed,
      failed,
      warnings,
      allPassed: failed === 0,
    };
  }, [results]);

  const content = (
    <div className="space-y-4">
      {/* Summary Bar */}
      <Card
        className={cn(
          'shadow-sm border-2',
          summary.allPassed ? 'border-emerald-300 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'
        )}
      >
        <CardContent className="py-4 px-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {summary.allPassed ? (
                <ShieldCheck className="size-6 text-emerald-600" />
              ) : (
                <ShieldAlert className="size-6 text-red-600" />
              )}
              <div>
                <h3 className={cn('font-semibold text-sm', summary.allPassed ? 'text-emerald-800' : 'text-red-800')}>
                  {summary.allPassed
                    ? '✓ Approved for Export'
                    : '✗ Validation Failed — Export Blocked'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summary.passed} of {summary.total} checks passed
                  {summary.warnings > 0 && `, ${summary.warnings} warning${summary.warnings > 1 ? 's' : ''}`}
                  {summary.failed > 0 && `, ${summary.failed} failure${summary.failed > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {summary.passed > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1">
                  <CheckCircle2 className="size-3" /> {summary.passed} Passed
                </Badge>
              )}
              {summary.warnings > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
                  <AlertTriangle className="size-3" /> {summary.warnings} Warning{summary.warnings > 1 ? 's' : ''}
                </Badge>
              )}
              {summary.failed > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-300 gap-1">
                  <XCircle className="size-3" /> {summary.failed} Failed
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Results Table */}
      {!results || results.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No validation results available. Generate a report first.
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="min-w-fit">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 250 }}>
                    Rule
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 120 }}>
                    Project
                  </th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 80 }}>
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 120 }}>
                    Expected
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 120 }}>
                    Actual
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-3 py-2" style={{ minWidth: 120 }}>
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr
                    key={result.id}
                    className={cn(
                      'border-b border-border/30 transition-colors',
                      result.status === 'failed' && 'bg-red-50/50',
                      result.status === 'warning' && 'bg-amber-50/50',
                      result.status === 'passed' && 'hover:bg-accent/20',
                    )}
                  >
                    <td className="px-3 py-2 text-sm" style={{ minWidth: 250 }}>
                      <div>
                        <span className="font-medium">{result.rule}</span>
                        {result.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{result.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground" style={{ minWidth: 120 }}>
                      {result.project}
                    </td>
                    <td className="px-3 py-2 text-center" style={{ minWidth: 80 }}>
                      {result.status === 'passed' && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1 text-[10px]">
                          <CheckCircle2 className="size-3" /> Pass
                        </Badge>
                      )}
                      {result.status === 'failed' && (
                        <Badge className="bg-red-100 text-red-700 border-red-300 gap-1 text-[10px]">
                          <XCircle className="size-3" /> Fail
                        </Badge>
                      )}
                      {result.status === 'warning' && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1 text-[10px]">
                          <AlertTriangle className="size-3" /> Warn
                        </Badge>
                      )}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 120 }}>
                      {formatPKR(result.expected)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm tabular-nums font-mono" style={{ minWidth: 120 }}>
                      {formatPKR(result.actual)}
                    </td>
                    <td
                      className={cn(
                        'text-right px-3 py-2 text-sm tabular-nums font-mono font-medium',
                        result.variance > 0 && 'text-emerald-600',
                        result.variance < 0 && 'text-red-600',
                        result.variance === 0 && 'text-muted-foreground',
                      )}
                      style={{ minWidth: 120 }}
                    >
                      {formatPKR(result.variance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );

  // If used as a dialog/modal
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Validation Dashboard
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
