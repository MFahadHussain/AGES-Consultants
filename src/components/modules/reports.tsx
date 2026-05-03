'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, Printer, RefreshCw, FileText, ChevronDown, ChevronRight, Building2, Filter, X, Loader2, Scale, Shield, FileSpreadsheet } from 'lucide-react'
import ReportControlPanel from '@/components/reports/ReportControlPanel'
import MultiColumnBalanceSheet from '@/components/reports/MultiColumnBalanceSheet'
import MultiColumnPL from '@/components/reports/MultiColumnPL'
import CashFlowStatement from '@/components/reports/CashFlowStatement'
import FixedAssetSchedule from '@/components/reports/FixedAssetSchedule'
import ValidationDashboard from '@/components/reports/ValidationDashboard'
import ReportLayout from '@/components/reports/ReportLayout'
import { formatPKR, formatPeriodString } from '@/lib/report-utils'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

interface FilterOption {
  id: string
  name: string
  code?: string
  status?: string
  industry?: string
}

interface FilterData {
  projects: FilterOption[]
  clients: FilterOption[]
  donors: FilterOption[]
  locations: FilterOption[]
  financialYears: FilterOption[]
}

// ─── Standard Report Types ───
const reportTypes = [
  { value: 'trial_balance', label: 'Trial Balance', description: 'List of all accounts with debit/credit balances' },
  { value: 'balance_sheet', label: 'Balance Sheet', description: 'Assets = Liabilities + Equity' },
  { value: 'pnl', label: 'Profit & Loss', description: 'Income vs Expenses statement' },
  { value: 'cash_flow', label: 'Cash Flow Statement', description: 'Operating cash inflows and outflows' },
  { value: 'receipts_payments', label: 'Receipts & Payments', description: 'Summary of all receipts and payments' },
  { value: 'general_ledger', label: 'General Ledger', description: 'Detailed account transaction history' },
  { value: 'aging', label: 'Aging Report', description: 'Receivables/payables aging analysis' },
  { value: 'budget_vs_actual', label: 'Budget vs Actual', description: 'Budget variance analysis' },
  { value: 'donor_wise', label: 'Donor-wise Report', description: 'Financial summary by donor' },
  { value: 'project_wise', label: 'Project-wise Report', description: 'Financial summary by project' },
  { value: 'location_wise', label: 'Location-wise Report', description: 'Financial summary by location' },
  { value: 'client_wise_project', label: 'Client-wise Project', description: 'Financial summary by client with project breakdown' },
]

// ═══════════════════════════════════════════════════════════════════════════
// STATUTORY REPORTS TAB
// ═══════════════════════════════════════════════════════════════════════════

function StatutoryReports() {
  const [reportType, setReportType] = useState('balance_sheet')
  const [viewMode, setViewMode] = useState('multi_column')
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [detailLevel, setDetailLevel] = useState('detailed')
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [validationStatus, setValidationStatus] = useState<'ready' | 'validating' | 'errors'>('ready')
  const [showValidation, setShowValidation] = useState(false)

  const handleGenerate = useCallback(async (params: {
    reportType: string
    viewMode: string
    projectIds: string[]
    fromDate: string
    toDate: string
    detailLevel: string
  }) => {
    setLoading(true)
    setValidationStatus('validating')
    setReportType(params.reportType)
    setViewMode(params.viewMode)
    setSelectedProjectIds(params.projectIds)
    setFromDate(params.fromDate)
    setToDate(params.toDate)
    setDetailLevel(params.detailLevel)

    try {
      const searchParams = new URLSearchParams({
        reportType: params.reportType,
        fromDate: params.fromDate,
        toDate: params.toDate,
        projectIds: params.projectIds.join(','),
        viewMode: params.viewMode,
        detailLevel: params.detailLevel,
      })

      const res = await fetch(`/api/reports/statutory?${searchParams}`)
      const data = await res.json()
      setReportData(data)

      if (data?.data?.validation?.accounting_equation === 'FAIL' ||
          data?.data?.validation?.status === 'FAIL') {
        setValidationStatus('errors')
      } else {
        setValidationStatus('ready')
      }
    } catch (e) {
      console.error('Statutory report error:', e)
      setValidationStatus('errors')
    }
    setLoading(false)
  }, [])

  // Transform API validation data into ValidationDashboard format
  const getValidationResults = useCallback(() => {
    const v = reportData?.data?.validation
    if (!v) return null
    const results: Array<{ id: string; rule: string; project: string; status: 'passed' | 'failed' | 'warning'; expected: number; actual: number; variance: number; description?: string }> = []

    // Accounting equation check
    if (v.accounting_equation) {
      results.push({
        id: 'R001',
        rule: 'R001: Accounting Equation',
        project: 'Consolidated',
        status: v.accounting_equation === 'PASS' ? 'passed' : 'failed',
        expected: 0,
        actual: 0,
        variance: 0,
        description: v.accounting_equation === 'PASS'
          ? 'Total Assets = Total Capital & Liabilities'
          : `Variance detected: ${v.errors?.join('; ') || 'See details'}`,
      })
    }

    // Individual project errors
    if (v.errors && v.errors.length > 0) {
      v.errors.forEach((err: string, i: number) => {
        results.push({
          id: `E${i + 1}`,
          rule: 'Accounting Equation Check',
          project: err.split(':')[0]?.trim() || 'Unknown',
          status: 'failed' as const,
          expected: 0,
          actual: 0,
          variance: 0,
          description: err,
        })
      })
    }

    // If no results were added but validation exists, add a pass
    if (results.length === 0 && v.accounting_equation === 'PASS') {
      results.push({
        id: 'R001',
        rule: 'Accounting Equation',
        project: 'All Projects',
        status: 'passed',
        expected: 0,
        actual: 0,
        variance: 0,
        description: 'All project columns balanced',
      })
    }

    return results
  }, [reportData])

  const statutoryReportTitle: Record<string, string> = {
    balance_sheet: 'Statement of Financial Position (Balance Sheet)',
    profit_loss: 'Profit & Loss Account',
    cash_flow: 'Statement of Cash Flows',
    fixed_assets: 'Fixed Asset Schedule',
    fixed_asset_schedule: 'Fixed Asset Schedule',
    intangible_assets: 'Intangible Asset Schedule',
    intangible_asset_schedule: 'Intangible Asset Schedule',
  }

  const renderStatutoryReport = () => {
    if (!reportData?.data) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileSpreadsheet className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-sm font-medium">Select parameters and generate a report</p>
          <p className="text-xs mt-1">Choose report type, projects, and date range above</p>
        </div>
      )
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    const projects = reportData?.meta?.projects || reportData?.data?.columns?.filter((c: any) => c.type === 'project') || []
    const periodFrom = reportData?.meta?.period?.from || fromDate
    const periodTo = reportData?.meta?.period?.to || toDate

    switch (reportType) {
      case 'balance_sheet':
        return (
          <ReportLayout
            reportTitle={statutoryReportTitle.balance_sheet}
            fromDate={periodFrom}
            toDate={periodTo}
            projectName={viewMode === 'consolidated' ? 'Consolidated' : viewMode === 'single' ? 'Single Project' : 'Multi-Project'}
            isConsolidated={viewMode === 'consolidated'}
            validationFailed={validationStatus === 'errors'}
            onPrint={() => window.print()}
            onExportCSV={() => {/* TODO */}}
          >
            <MultiColumnBalanceSheet data={reportData.data} detailLevel={detailLevel as 'summary' | 'detailed'} />
          </ReportLayout>
        )
      case 'profit_loss':
        return (
          <ReportLayout
            reportTitle={statutoryReportTitle.profit_loss}
            fromDate={periodFrom}
            toDate={periodTo}
            projectName={viewMode === 'consolidated' ? 'Consolidated' : 'Multi-Project'}
            isConsolidated={viewMode === 'consolidated'}
            validationFailed={validationStatus === 'errors'}
            onPrint={() => window.print()}
            onExportCSV={() => {/* TODO */}}
          >
            <MultiColumnPL data={reportData.data} detailLevel={detailLevel as 'summary' | 'detailed'} />
          </ReportLayout>
        )
      case 'cash_flow':
        return (
          <ReportLayout
            reportTitle={statutoryReportTitle.cash_flow}
            fromDate={periodFrom}
            toDate={periodTo}
            projectName={viewMode === 'consolidated' ? 'Consolidated' : 'Multi-Project'}
            isConsolidated={viewMode === 'consolidated'}
            validationFailed={validationStatus === 'errors'}
            onPrint={() => window.print()}
            onExportCSV={() => {/* TODO */}}
          >
            <CashFlowStatement data={reportData.data} />
          </ReportLayout>
        )
      case 'fixed_assets':
      case 'fixed_asset_schedule':
      case 'intangible_assets':
      case 'intangible_asset_schedule': {
        const isIntangible = reportType === 'intangible_assets' || reportType === 'intangible_asset_schedule'
        const scheduleTitle = isIntangible ? 'Intangible Asset Schedule' : 'Fixed Asset Schedule'
        // Build proper project label from actual selected project names
        const reportProjects = reportData?.meta?.projects || []
        let projectLabel = 'Consolidated'
        if (viewMode === 'single' && reportProjects.length === 1) {
          projectLabel = `${reportProjects[0].code} - ${reportProjects[0].name}`
        } else if (viewMode === 'multi_column' && reportProjects.length > 1) {
          projectLabel = reportProjects.map((p: any) => p.code).join(', ')
        }
        return (
          <ReportLayout
            reportTitle={scheduleTitle}
            fromDate={periodFrom}
            toDate={periodTo}
            projectName={projectLabel}
            isConsolidated={viewMode === 'consolidated'}
            validationFailed={validationStatus === 'errors'}
            onPrint={() => window.print()}
            onExportCSV={() => {/* TODO */}}
          >
            <FixedAssetSchedule
              data={reportData.data}
              scheduleType={isIntangible ? 'intangible' : 'ppe'}
              projectName={projectLabel}
              detailLevel={detailLevel as 'summary' | 'detailed'}
            />
          </ReportLayout>
        )
      }
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <ReportControlPanel
        onGenerate={handleGenerate}
        loading={loading}
        validationStatus={validationStatus}
      />

      {/* Validation Toggle */}
      {reportData?.data?.validation && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowValidation(!showValidation)}
            className="text-xs"
          >
            <Shield className="h-3.5 w-3.5 mr-1" />
            {showValidation ? 'Hide' : 'Show'} Validation Dashboard
          </Button>
          {validationStatus === 'errors' && (
            <Badge variant="destructive" className="text-[10px]">Validation Issues Found</Badge>
          )}
          {validationStatus === 'ready' && reportData && (
            <Badge className="text-[10px] bg-green-100 text-green-800">✓ All Checks Passed</Badge>
          )}
        </div>
      )}

      {/* Validation Dashboard */}
      {showValidation && (
        <ValidationDashboard
          results={getValidationResults()}
          isOpen={showValidation}
          onClose={() => setShowValidation(false)}
        />
      )}

      {/* Report Content */}
      {renderStatutoryReport()}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STANDARD REPORTS TAB
// ═══════════════════════════════════════════════════════════════════════════

function StandardReports() {
  const [reportType, setReportType] = useState('trial_balance')
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])

  const [projectId, setProjectId] = useState<string>('all')
  const [clientId, setClientId] = useState<string>('all')
  const [donorId, setDonorId] = useState<string>('all')
  const [locationId, setLocationId] = useState<string>('all')
  const [financialYearId, setFinancialYearId] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  const [glAccountId, setGlAccountId] = useState<string>('')
  const [allAccounts, setAllAccounts] = useState<Array<{id: string; code: string; name: string; accountType: string}>>([])
  const [agingType, setAgingType] = useState<string>('receivables')

  const [filterData, setFilterData] = useState<FilterData>({
    projects: [], clients: [], donors: [], locations: [], financialYears: [],
  })

  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchFilters = async () => {
      try { const r = await fetch('/api/projects'); const d = await r.json(); setFilterData(prev => ({ ...prev, projects: Array.isArray(d) ? d : d.data || [] })) } catch {}
      try { const r = await fetch('/api/clients'); const d = await r.json(); setFilterData(prev => ({ ...prev, clients: Array.isArray(d) ? d : d.data || [] })) } catch {}
      try { const r = await fetch('/api/donors'); const d = await r.json(); setFilterData(prev => ({ ...prev, donors: Array.isArray(d) ? d : d.data || [] })) } catch {}
      try { const r = await fetch('/api/locations'); const d = await r.json(); setFilterData(prev => ({ ...prev, locations: Array.isArray(d) ? d : d.data || [] })) } catch {}
      try { const r = await fetch('/api/financial-year'); const d = await r.json(); setFilterData(prev => ({ ...prev, financialYears: Array.isArray(d) ? d : d.data || [] })) } catch {}
      try {
        const r = await fetch('/api/accounts?isActive=true&allowPosting=true')
        const d = await r.json()
        setAllAccounts((Array.isArray(d) ? d : d.accounts || []).map((a: any) => ({ id: a.id, code: a.code, name: a.name, accountType: a.accountType })))
      } catch {}
    }
    fetchFilters()
  }, [])

  const generateReport = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ reportType, dateFrom, dateTo })
    if (projectId && projectId !== 'all') params.set('projectId', projectId)
    if (clientId && clientId !== 'all') params.set('clientId', clientId)
    if (donorId && donorId !== 'all') params.set('donorId', donorId)
    if (locationId && locationId !== 'all') params.set('locationId', locationId)
    if (financialYearId && financialYearId !== 'all') params.set('financialYearId', financialYearId)
    if (reportType === 'general_ledger' && glAccountId) params.set('accountId', glAccountId)
    if (reportType === 'aging') params.set('agingType', agingType)
    try {
      const res = await fetch(`/api/reports?${params}`)
      setReportData(await res.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [reportType, dateFrom, dateTo, projectId, clientId, donorId, locationId, financialYearId, glAccountId, agingType])

  useEffect(() => { queueMicrotask(() => generateReport()) }, [reportType, generateReport])

  const clearFilters = () => { setProjectId('all'); setClientId('all'); setDonorId('all'); setLocationId('all'); setFinancialYearId('all') }
  const hasActiveFilters = projectId !== 'all' || clientId !== 'all' || donorId !== 'all' || locationId !== 'all' || financialYearId !== 'all'

  const getRelevantFilters = () => {
    const common = ['project', 'client', 'donor', 'location', 'financialYear']
    switch (reportType) {
      case 'donor_wise': return ['project', 'client', 'location', 'financialYear']
      case 'project_wise': return ['client', 'donor', 'location', 'financialYear']
      case 'location_wise': return ['project', 'client', 'donor', 'financialYear']
      case 'client_wise_project': return ['project', 'donor', 'location', 'financialYear']
      default: return common
    }
  }
  const relevantFilters = getRelevantFilters()

  const handlePrint = () => {
    const printContent = document.getElementById('report-content')
    if (!printContent) return
    const reportTitle = reportTypes.find(r => r.value === reportType)?.label || reportType
    const win = window.open('', '', 'width=1000,height=750')
    win?.document.write(`<html><head><title>${reportTitle} - AcctFin ERP</title>
      <style>
        @page{margin:15mm 12mm;size:A4} *{box-sizing:border-box}
        body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;padding:0;margin:0;color:#1a1a1a;line-height:1.4}
        table{width:100%;border-collapse:collapse;margin-bottom:16px} th{background:#f5f5f5;font-weight:700;padding:7px 8px;text-align:left;border-bottom:2px solid #bbb;font-size:9px} td{padding:5px 8px;border-bottom:1px solid #e5e5e5} .text-right{text-align:right} .font-bold{font-weight:700} .font-mono{font-family:'Courier New',monospace}
      </style></head><body>${printContent.innerHTML}</body></html>`)
    win?.document.close()
    setTimeout(() => win?.print(), 500)
  }

  const handleExport = async (format: string) => {
    if (!reportData) return
    const reportTitle = reportTypes.find(r => r.value === reportType)?.label || reportType
    const rows: string[][] = []
    if (format === 'CSV') {
      if (reportType === 'trial_balance' && reportData.data) {
        rows.push(['Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Balance'])
        reportData.data.forEach((row: any) => rows.push([row.code, row.name, row.accountType, row.totalDebit || '', row.totalCredit || '', row.balance]))
      } else if (reportType === 'balance_sheet' && reportData.sections) {
        rows.push(['Section', 'Code', 'Name', 'Amount'])
        reportData.sections.assets?.forEach((a: any) => rows.push(['Assets', a.code, a.name, a.balance]))
        rows.push(['Assets', '', 'Total Assets', reportData.totalAssets])
        reportData.sections.liabilities?.forEach((a: any) => rows.push(['Liabilities', a.code, a.name, a.balance]))
        reportData.sections.equity?.forEach((a: any) => rows.push(['Equity', a.code, a.name, a.balance]))
      } else if (reportType === 'pnl' && reportData.income) {
        rows.push(['Section', 'Code', 'Name', 'Amount'])
        reportData.income.forEach((a: any) => rows.push(['Income', a.code, a.name, a.balance]))
        reportData.expenses.forEach((a: any) => rows.push(['Expenses', a.code, a.name, a.balance]))
      } else if (reportData.data) {
        rows.push(['Code', 'Name', 'Total Debit', 'Total Credit', 'Net Balance'])
        reportData.data.forEach((d: any) => rows.push([d.code, d.project || d.donor || d.location || d.name, d.totalDebit, d.totalCredit, d.balance]))
      }
      const content = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([content], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`; a.click()
      URL.revokeObjectURL(url)
    }
  }

  // ─── Standard Report Renderers ───

  const renderTrialBalance = () => {
    if (!reportData?.data) return <p className="text-xs text-muted-foreground text-center py-8">No data</p>
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px]">Code</TableHead>
            <TableHead className="text-[10px]">Account Name</TableHead>
            <TableHead className="text-[10px]">Type</TableHead>
            <TableHead className="text-[10px] text-right">Debit</TableHead>
            <TableHead className="text-[10px] text-right">Credit</TableHead>
            <TableHead className="text-[10px] text-right">Balance</TableHead>
            <TableHead className="text-[10px]">Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reportData.data.map((row: any, i: number) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{row.code}</TableCell>
              <TableCell className="text-xs font-medium">{row.name}</TableCell>
              <TableCell><Badge className="text-[8px]">{row.accountType}</Badge></TableCell>
              <TableCell className="text-xs text-right">{row.totalDebit > 0 ? formatCurrency(row.totalDebit) : ''}</TableCell>
              <TableCell className="text-xs text-right">{row.totalCredit > 0 ? formatCurrency(row.totalCredit) : ''}</TableCell>
              <TableCell className="text-xs text-right font-semibold">{formatCurrency(row.balance)}</TableCell>
              <TableCell className="text-xs">{row.balanceType}</TableCell>
            </TableRow>
          ))}
          <TableRow className="font-bold bg-muted/50">
            <TableCell colSpan={3} className="text-xs">TOTAL</TableCell>
            <TableCell className="text-xs text-right">{formatCurrency(reportData.totalDebit)}</TableCell>
            <TableCell className="text-xs text-right">{formatCurrency(reportData.totalCredit)}</TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableBody>
      </Table>
    )
  }

  const renderBalanceSheet = () => {
    if (!reportData?.sections) return <p className="text-xs text-muted-foreground text-center py-8">No data</p>
    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-xs font-bold mb-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded">ASSETS</h4>
          <Table>
            <TableHeader><TableRow><TableHead className="text-[10px]">Code</TableHead><TableHead className="text-[10px]">Name</TableHead><TableHead className="text-[10px]">Sub Type</TableHead><TableHead className="text-[10px] text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {reportData.sections.assets.map((a: any, i: number) => (
                <TableRow key={i}><TableCell className="font-mono text-xs">{a.code}</TableCell><TableCell className="text-xs">{a.name}</TableCell><TableCell className="text-[10px] text-muted-foreground">{a.subType}</TableCell><TableCell className="text-xs text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
              ))}
              <TableRow className="font-bold bg-emerald-50"><TableCell colSpan={3} className="text-xs">Total Assets</TableCell><TableCell className="text-xs text-right">{formatCurrency(reportData.totalAssets)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
        <div>
          <h4 className="text-xs font-bold mb-2 text-red-700 bg-red-50 px-3 py-1.5 rounded">LIABILITIES</h4>
          <Table>
            <TableBody>
              {reportData.sections.liabilities.map((a: any, i: number) => (
                <TableRow key={i}><TableCell className="font-mono text-xs">{a.code}</TableCell><TableCell className="text-xs">{a.name}</TableCell><TableCell className="text-xs text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
              ))}
              <TableRow className="font-bold bg-red-50"><TableCell colSpan={2} className="text-xs">Total Liabilities</TableCell><TableCell className="text-xs text-right">{formatCurrency(reportData.totalLiabilities)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
        <div>
          <h4 className="text-xs font-bold mb-2 text-violet-700 bg-violet-50 px-3 py-1.5 rounded">EQUITY</h4>
          <Table>
            <TableBody>
              {reportData.sections.equity.map((a: any, i: number) => (
                <TableRow key={i}><TableCell className="font-mono text-xs">{a.code}</TableCell><TableCell className="text-xs">{a.name}</TableCell><TableCell className="text-xs text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
              ))}
              <TableRow className="font-bold bg-violet-50"><TableCell colSpan={2} className="text-xs">Total Equity</TableCell><TableCell className="text-xs text-right">{formatCurrency(reportData.totalEquity)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="p-3 rounded-lg border-2 text-center">
          <p className="text-xs font-bold">Assets = Liabilities + Equity</p>
          <p className="text-[10px] text-muted-foreground">{formatCurrency(reportData.totalAssets)} = {formatCurrency(reportData.totalLiabilities)} + {formatCurrency(reportData.totalEquity)}</p>
          <Badge className={`mt-1 text-[9px] ${reportData.check === 'Balanced' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{reportData.check}</Badge>
        </div>
      </div>
    )
  }

  const renderPnL = () => {
    if (!reportData?.income) return <p className="text-xs text-muted-foreground text-center py-8">No data</p>
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-bold mb-2 text-blue-700 bg-blue-50 px-3 py-1.5 rounded">INCOME</h4>
          <Table>
            <TableBody>
              {reportData.income.map((a: any, i: number) => (
                <TableRow key={i}><TableCell className="font-mono text-xs">{a.code}</TableCell><TableCell className="text-xs">{a.name}</TableCell><TableCell className="text-xs text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
              ))}
              <TableRow className="font-bold bg-blue-50"><TableCell colSpan={2} className="text-xs">Total Income</TableCell><TableCell className="text-xs text-right">{formatCurrency(reportData.totalIncome)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
        <div>
          <h4 className="text-xs font-bold mb-2 text-orange-700 bg-orange-50 px-3 py-1.5 rounded">EXPENSES</h4>
          <Table>
            <TableBody>
              {reportData.expenses.map((a: any, i: number) => (
                <TableRow key={i}><TableCell className="font-mono text-xs">{a.code}</TableCell><TableCell className="text-xs">{a.name}</TableCell><TableCell className="text-xs text-right">{formatCurrency(a.balance)}</TableCell></TableRow>
              ))}
              <TableRow className="font-bold bg-orange-50"><TableCell colSpan={2} className="text-xs">Total Expenses</TableCell><TableCell className="text-xs text-right">{formatCurrency(reportData.totalExpenses)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
        <div className={`p-4 rounded-lg border-2 text-center ${reportData.netSurplus >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs font-bold">{reportData.netSurplus >= 0 ? 'NET SURPLUS' : 'NET DEFICIT'}</p>
          <p className="text-2xl font-bold">{formatCurrency(Math.abs(reportData.netSurplus))}</p>
        </div>
      </div>
    )
  }

  const renderCashFlow = () => {
    if (!reportData?.entries) return <p className="text-xs text-muted-foreground text-center py-8">No data</p>
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-emerald-400"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Inflow</p><p className="text-sm font-bold text-emerald-600">{formatCurrency(reportData.totalInflow)}</p></CardContent></Card>
          <Card className="border-l-4 border-l-red-400"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Outflow</p><p className="text-sm font-bold text-red-600">{formatCurrency(reportData.totalOutflow)}</p></CardContent></Card>
          <Card className={`border-l-4 ${reportData.netCashFlow >= 0 ? 'border-l-emerald-400' : 'border-l-red-400'}`}><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Net Cash Flow</p><p className={`text-sm font-bold ${reportData.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(reportData.netCashFlow)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead className="text-[10px]">Date</TableHead><TableHead className="text-[10px]">Voucher</TableHead><TableHead className="text-[10px]">Account</TableHead><TableHead className="text-[10px] text-right">Inflow</TableHead><TableHead className="text-[10px] text-right">Outflow</TableHead></TableRow></TableHeader>
          <TableBody>
            {reportData.entries.map((e: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{new Date(e.voucher?.date).toLocaleDateString()}</TableCell>
                <TableCell className="text-xs font-mono">{e.voucher?.voucherNumber}</TableCell>
                <TableCell className="text-xs">{e.account?.code} - {e.account?.name}</TableCell>
                <TableCell className="text-xs text-right text-emerald-600">{e.debit > 0 ? formatCurrency(e.debit) : ''}</TableCell>
                <TableCell className="text-xs text-right text-red-600">{e.credit > 0 ? formatCurrency(e.credit) : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderSegmentReport = () => {
    if (!reportData?.data) return <p className="text-xs text-muted-foreground text-center py-8">No data</p>
    return (
      <Table>
        <TableHeader><TableRow>
          <TableHead className="text-[10px]">Code</TableHead>
          <TableHead className="text-[10px]">Name</TableHead>
          {reportData.reportType?.includes('project') && <TableHead className="text-[10px]">Status</TableHead>}
          <TableHead className="text-[10px] text-right">Total Debit</TableHead>
          <TableHead className="text-[10px] text-right">Total Credit</TableHead>
          <TableHead className="text-[10px] text-right">Net Balance</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {reportData.data.map((d: any, i: number) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{d.code}</TableCell>
              <TableCell className="text-xs font-medium">{d.project || d.donor || d.location}</TableCell>
              {reportData.reportType?.includes('project') && !reportData.reportType?.includes('Client') && <TableCell className="text-xs"><Badge className="text-[9px]">{d.status}</Badge></TableCell>}
              <TableCell className="text-xs text-right">{formatCurrency(d.totalDebit)}</TableCell>
              <TableCell className="text-xs text-right">{formatCurrency(d.totalCredit)}</TableCell>
              <TableCell className="text-xs text-right font-semibold">{formatCurrency(d.balance)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  const renderClientWiseProject = () => {
    if (!reportData?.data) return <p className="text-xs text-muted-foreground text-center py-8">No data</p>
    const toggleClientExpand = (clientId: string) => {
      const next = new Set(expandedClients)
      if (next.has(clientId)) next.delete(clientId); else next.add(clientId)
      setExpandedClients(next)
    }
    return (
      <div className="space-y-1">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="border-l-4 border-l-emerald-400"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Debit</p><p className="text-sm font-bold text-emerald-600">{formatCurrency(reportData.grandTotalDebit)}</p></CardContent></Card>
          <Card className="border-l-4 border-l-red-400"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Credit</p><p className="text-sm font-bold text-red-600">{formatCurrency(reportData.grandTotalCredit)}</p></CardContent></Card>
          <Card className={`border-l-4 ${reportData.grandBalance >= 0 ? 'border-l-emerald-400' : 'border-l-red-400'}`}><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Net Balance</p><p className={`text-sm font-bold ${reportData.grandBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(reportData.grandBalance)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-[10px] w-8"></TableHead>
            <TableHead className="text-[10px]">Client</TableHead>
            <TableHead className="text-[10px]">Industry</TableHead>
            <TableHead className="text-[10px] text-right">Debit</TableHead>
            <TableHead className="text-[10px] text-right">Credit</TableHead>
            <TableHead className="text-[10px] text-right">Net</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {reportData.data.map((client: any) => {
              const isExpanded = expandedClients.has(client.id)
              return (
                <React.Fragment key={client.id}>
                  <TableRow className="hover:bg-accent/50 font-medium">
                    <TableCell>
                      {client.projects?.length > 0 ? (
                        <button onClick={() => toggleClientExpand(client.id)} className="p-0.5 rounded hover:bg-muted">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      ) : <span className="w-5 inline-block" />}
                    </TableCell>
                    <TableCell className="text-xs"><Building2 className="h-3 w-3 inline mr-1" />{client.name}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{client.industry || '-'}</TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(client.totalDebit)}</TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(client.totalCredit)}</TableCell>
                    <TableCell className="text-xs text-right font-bold">{formatCurrency(client.balance)}</TableCell>
                  </TableRow>
                  {isExpanded && client.projects?.map((proj: any) => (
                    <TableRow key={proj.id} className="bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell className="text-[10px] text-muted-foreground pl-6">↳ {proj.name}</TableCell>
                      <TableCell><Badge className="text-[8px]">{proj.status}</Badge></TableCell>
                      <TableCell className="text-[10px] text-right text-muted-foreground">{formatCurrency(proj.totalDebit)}</TableCell>
                      <TableCell className="text-[10px] text-right text-muted-foreground">{formatCurrency(proj.totalCredit)}</TableCell>
                      <TableCell className="text-[10px] text-right font-medium">{formatCurrency(proj.balance)}</TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderGeneralLedger = () => {
    if (!glAccountId) return <p className="text-xs text-muted-foreground text-center py-8">Select an account to view its General Ledger</p>
    if (!reportData?.entries) return <p className="text-xs text-muted-foreground text-center py-8">No transactions found</p>
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-bold">{reportData.account?.code} — {reportData.account?.name}</p>
            <p className="text-[10px] text-muted-foreground">{reportData.account?.accountType} • {reportData.account?.subType || 'N/A'}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-muted-foreground">Closing Balance</p>
            <p className="text-sm font-bold">{formatCurrency(reportData.closingBalance || 0)}</p>
          </div>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead className="text-[10px]">Date</TableHead><TableHead className="text-[10px]">Voucher</TableHead><TableHead className="text-[10px]">Narration</TableHead><TableHead className="text-[10px] text-right">Debit</TableHead><TableHead className="text-[10px] text-right">Credit</TableHead><TableHead className="text-[10px] text-right">Balance</TableHead></TableRow></TableHeader>
          <TableBody>
            {reportData.entries.map((e: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                <TableCell className="font-mono text-xs">{e.voucherNumber}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{e.narration}</TableCell>
                <TableCell className="text-xs text-right text-emerald-600">{e.debit > 0 ? formatCurrency(e.debit) : ''}</TableCell>
                <TableCell className="text-xs text-right text-red-600">{e.credit > 0 ? formatCurrency(e.credit) : ''}</TableCell>
                <TableCell className={`text-xs text-right font-semibold ${e.balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(e.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderReport = () => {
    switch (reportType) {
      case 'trial_balance': return renderTrialBalance()
      case 'balance_sheet': return renderBalanceSheet()
      case 'pnl': return renderPnL()
      case 'cash_flow': return renderCashFlow()
      case 'receipts_payments': return renderCashFlow()
      case 'general_ledger': return renderGeneralLedger()
      case 'aging': return renderSegmentReport()
      case 'budget_vs_actual': return renderSegmentReport()
      case 'donor_wise': case 'project_wise': case 'location_wise': return renderSegmentReport()
      case 'client_wise_project': return renderClientWiseProject()
      default: return <p className="text-xs text-center py-8">Select a report type</p>
    }
  }

  return (
    <div className="space-y-4">
      {/* Report Type & Date Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Label className="text-[10px] font-medium">Report Type</Label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {reportTypes.map(r => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {reportType === 'general_ledger' && (
          <div className="w-64">
            <Label className="text-[10px] font-medium">Account</Label>
            <Select value={glAccountId} onValueChange={setGlAccountId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select account..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {allAccounts.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.code} - {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {reportType === 'aging' && (
          <div className="w-40">
            <Label className="text-[10px] font-medium">Aging Type</Label>
            <Select value={agingType} onValueChange={setAgingType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receivables" className="text-xs">Receivables</SelectItem>
                <SelectItem value="payables" className="text-xs">Payables</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="w-36">
          <Label className="text-[10px] font-medium">From Date</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="w-36">
          <Label className="text-[10px] font-medium">To Date</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
        </div>
        <Button onClick={() => generateReport()} size="sm" className="h-8" disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Generate
        </Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-3.5 w-3.5 mr-1" /> Filters
          {hasActiveFilters && <Badge className="ml-1 text-[8px] h-4">Active</Badge>}
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="border-dashed">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">Advanced Filters</p>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={clearFilters}>Clear All</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {relevantFilters.includes('project') && (
                <div><Label className="text-[10px]">Project</Label>
                  <Select value={projectId} onValueChange={setProjectId}><SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all" className="text-[10px]">All Projects</SelectItem>{filterData.projects.map(p => <SelectItem key={p.id} value={p.id} className="text-[10px]">{p.code} - {p.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              )}
              {relevantFilters.includes('client') && (
                <div><Label className="text-[10px]">Client</Label>
                  <Select value={clientId} onValueChange={setClientId}><SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all" className="text-[10px]">All Clients</SelectItem>{filterData.clients.map(c => <SelectItem key={c.id} value={c.id} className="text-[10px]">{c.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              )}
              {relevantFilters.includes('donor') && (
                <div><Label className="text-[10px]">Donor</Label>
                  <Select value={donorId} onValueChange={setDonorId}><SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all" className="text-[10px]">All Donors</SelectItem>{filterData.donors.map(d => <SelectItem key={d.id} value={d.id} className="text-[10px]">{d.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              )}
              {relevantFilters.includes('location') && (
                <div><Label className="text-[10px]">Location</Label>
                  <Select value={locationId} onValueChange={setLocationId}><SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all" className="text-[10px]">All Locations</SelectItem>{filterData.locations.map(l => <SelectItem key={l.id} value={l.id} className="text-[10px]">{l.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              )}
              {relevantFilters.includes('financialYear') && (
                <div><Label className="text-[10px]">Financial Year</Label>
                  <Select value={financialYearId} onValueChange={setFinancialYearId}><SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all" className="text-[10px]">All Years</SelectItem>{filterData.financialYears.map(fy => <SelectItem key={fy.id} value={fy.id} className="text-[10px]">{fy.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Bar */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 text-[10px] print:hidden" onClick={handlePrint}><Printer className="h-3 w-3 mr-1" />Print</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] print:hidden" onClick={() => handleExport('CSV')}><Download className="h-3 w-3 mr-1" />CSV</Button>
      </div>

      {/* Report Content */}
      <div id="report-content">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : renderReport()}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export function FinancialReports() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Scale className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-lg font-bold">Financial Reports</h2>
          <p className="text-xs text-muted-foreground">Standard & Statutory Financial Reporting Engine</p>
        </div>
      </div>

      <Tabs defaultValue="statutory" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="statutory" className="text-xs">
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            Statutory Reports
          </TabsTrigger>
          <TabsTrigger value="standard" className="text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Standard Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="statutory" className="mt-4">
          <StatutoryReports />
        </TabsContent>

        <TabsContent value="standard" className="mt-4">
          <StandardReports />
        </TabsContent>
      </Tabs>
    </div>
  )
}
