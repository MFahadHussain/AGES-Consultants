'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  RefreshCw,
} from 'lucide-react'

interface ValidationRule {
  name: string
  status: 'pass' | 'fail'
  detail: string
  actualValue?: number
  expectedValue?: number
  variance?: number
}

interface ValidationResult {
  rules: ValidationRule[]
  allPassed: boolean
}

interface ValidationPanelProps {
  data: ValidationResult
  onRevalidate?: () => void
  loading?: boolean
}

function formatAmount(value: number | undefined): string {
  if (value === undefined) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function ValidationPanel({
  data,
  onRevalidate,
  loading = false,
}: ValidationPanelProps) {
  // Guard against missing data
  if (!data || !data.rules) {
    return (
      <Card className="border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">
              Validation Dashboard
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle className="size-4 shrink-0" />
            <span>No validation data available. Generate a report first.</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const failedCount = data.rules.filter((r) => r.status === 'fail').length

  return (
    <Card className="border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">
            Validation Dashboard
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {data.allPassed ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
              <CheckCircle2 className="size-3" />
              All checks passed
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
              <XCircle className="size-3" />
              {failedCount} {failedCount === 1 ? 'check' : 'checks'} failed
            </Badge>
          )}
          {onRevalidate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRevalidate}
              disabled={loading}
            >
              <RefreshCw
                className={`size-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Revalidate
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]">Rule</TableHead>
              <TableHead className="w-[90px] text-center">Status</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rules.map((rule, idx) => (
              <TableRow
                key={idx}
                className={`
                  border-l-4
                  ${rule.status === 'pass'
                    ? 'border-l-emerald-400'
                    : 'border-l-red-400 bg-red-50/50'
                  }
                `}
              >
                <TableCell className="font-medium text-sm">
                  {rule.name}
                </TableCell>
                <TableCell className="text-center">
                  {rule.status === 'pass' ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1">
                      <CheckCircle2 className="size-3" />
                      Pass
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 gap-1">
                      <XCircle className="size-3" />
                      Fail
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div
                    className={`text-xs ${
                      rule.status === 'pass' ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    <span>{rule.detail}</span>
                    {(rule.actualValue !== undefined ||
                      rule.expectedValue !== undefined) && (
                      <span className="ml-1 font-mono text-[10px]">
                        {rule.actualValue !== undefined && (
                          <span>
                            Actual:{' '}
                            <span className="font-semibold">
                              {formatAmount(rule.actualValue)}
                            </span>
                          </span>
                        )}
                        {rule.actualValue !== undefined &&
                          rule.expectedValue !== undefined && (
                            <span className="mx-1.5 text-muted-foreground">
                              ·
                            </span>
                          )}
                        {rule.expectedValue !== undefined && (
                          <span>
                            Expected:{' '}
                            <span className="font-semibold">
                              {formatAmount(rule.expectedValue)}
                            </span>
                          </span>
                        )}
                        {rule.variance !== undefined && (
                          <>
                            <span className="mx-1.5 text-muted-foreground">
                              ·
                            </span>
                            <span
                              className={
                                rule.variance !== 0
                                  ? 'font-bold text-red-600'
                                  : 'text-emerald-600'
                              }
                            >
                              Var: {formatAmount(rule.variance)}
                            </span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {!data.allPassed && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              <strong>Block report finalization</strong> — one or more
              validation checks have failed. Resolve all issues before
              finalizing the statutory report.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export type { ValidationPanelProps, ValidationResult, ValidationRule }
