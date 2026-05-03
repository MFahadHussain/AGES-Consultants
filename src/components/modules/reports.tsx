'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, Printer, RefreshCw, FileText, ChevronDown, ChevronRight, Building2, Filter, X, Loader2 } from 'lucide-react'

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

export function FinancialReports() {
  const [reportType, setReportType] = useState('trial_balance')
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])

  // Filter state
  const [projectId, setProjectId] = useState<string>('all')
  const [clientId, setClientId] = useState<string>('all')
  const [donorId, setDonorId] = useState<string>('all')
  const [locationId, setLocationId] = useState<string>('all')
  const [financialYearId, setFinancialYearId] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // New report-specific state
  const [glAccountId, setGlAccountId] = useState<string>('')
  const [allAccounts, setAllAccounts] = useState<Array<{id: string; code: string; name: string; accountType: string}>>([])
  const [agingType, setAgingType] = useState<string>('receivables')

  // Filter options data
  const [filterData, setFilterData] = useState<FilterData>({
    projects: [],
    clients: [],
    donors: [],
    locations: [],
    financialYears: [],
  })

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilters = async () => {
      // Fetch projects
      try {
        const projectsRes = await fetch('/api/projects')
        const projects = await projectsRes.json()
        setFilterData(prev => ({ ...prev, projects: Array.isArray(projects) ? projects : projects.data || [] }))
      } catch (e) { console.error('Failed to fetch projects:', e) }

      // Fetch clients
      try {
        const clientsRes = await fetch('/api/clients')
        const clients = await clientsRes.json()
        setFilterData(prev => ({ ...prev, clients: Array.isArray(clients) ? clients : clients.data || [] }))
      } catch (e) { console.error('Failed to fetch clients:', e) }

      // Fetch donors
      try {
        const donorsRes = await fetch('/api/donors')
        const donors = await donorsRes.json()
        setFilterData(prev => ({ ...prev, donors: Array.isArray(donors) ? donors : donors.data || [] }))
      } catch (e) { console.error('Failed to fetch donors:', e) }

      // Fetch locations
      try {
        const locationsRes = await fetch('/api/locations')
        const locations = await locationsRes.json()
        setFilterData(prev => ({ ...prev, locations: Array.isArray(locations) ? locations : locations.data || [] }))
      } catch (e) { console.error('Failed to fetch locations:', e) }

      // Fetch financial years
      try {
        const fyRes = await fetch('/api/financial-year')
        const financialYears = await fyRes.json()
        setFilterData(prev => ({ ...prev, financialYears: Array.isArray(financialYears) ? financialYears : financialYears.data || [] }))
      } catch (e) { console.error('Failed to fetch financial years:', e) }

      // Fetch accounts for GL dropdown
      try {
        const accRes = await fetch('/api/accounts?isActive=true&allowPosting=true')
        const accData = await accRes.json()
        const accList = Array.isArray(accData) ? accData : accData.accounts || []
        setAllAccounts(accList.map((a: any) => ({ id: a.id, code: a.code, name: a.name, accountType: a.accountType })))
      } catch (e) { console.error('Failed to fetch accounts:', e) }
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

  const clearFilters = () => {
    setProjectId('all')
    setClientId('all')
    setDonorId('all')
    setLocationId('all')
    setFinancialYearId('all')
  }

  const hasActiveFilters = projectId !== 'all' || clientId !== 'all' || donorId !== 'all' || locationId !== 'all' || financialYearId !== 'all'

  // Determine which filters are relevant for the current report type
  const getRelevantFilters = () => {
    const common = ['project', 'client', 'donor', 'location', 'financialYear']
    switch (reportType) {
      case 'trial_balance':
      case 'balance_sheet':
      case 'pnl':
        return common
      case 'cash_flow':
      case 'receipts_payments':
        return ['project', 'client', 'donor', 'location', 'financialYear']
      case 'donor_wise':
        return ['project', 'client', 'location', 'financialYear'] // donor is the grouping dimension
      case 'project_wise':
        return ['client', 'donor', 'location', 'financialYear'] // project is the grouping dimension
      case 'location_wise':
        return ['project', 'client', 'donor', 'financialYear'] // location is the grouping dimension
      case 'client_wise_project':
        return ['project', 'donor', 'location', 'financialYear'] // client is the grouping dimension
      case 'general_ledger':
      case 'aging':
      case 'budget_vs_actual':
        return common
      default:
        return common
    }
  }

  const relevantFilters = getRelevantFilters()

  const handlePrint = () => {
    const printContent = document.getElementById('report-content')
    if (printContent) {
      const reportTitle = reportTypes.find(r => r.value === reportType)?.label || reportType.replace(/_/g, ' ').toUpperCase()
      const activeFilterLabels: string[] = []
      if (projectId !== 'all') {
        const p = filterData.projects.find(p => p.id === projectId)
        if (p) activeFilterLabels.push(`Project: ${p.name}`)
      }
      if (clientId !== 'all') {
        const c = filterData.clients.find(c => c.id === clientId)
        if (c) activeFilterLabels.push(`Client: ${c.name}`)
      }
      if (donorId !== 'all') {
        const d = filterData.donors.find(d => d.id === donorId)
        if (d) activeFilterLabels.push(`Donor: ${d.name}`)
      }
      if (locationId !== 'all') {
        const l = filterData.locations.find(l => l.id === locationId)
        if (l) activeFilterLabels.push(`Location: ${l.name}`)
      }
      if (financialYearId !== 'all') {
        const fy = filterData.financialYears.find(fy => fy.id === financialYearId)
        if (fy) activeFilterLabels.push(`FY: ${fy.name}`)
      }
      const filterMeta = activeFilterLabels.length > 0 ? activeFilterLabels.join(' • ') : 'All'

      const win = window.open('', '', 'width=1000,height=750')
      win?.document.write(`<html><head><title>${reportTitle} - AcctFin ERP</title>
        <style>
          @page{margin:15mm 12mm;size:A4}
          *{box-sizing:border-box}
          body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;padding:0;margin:0;color:#1a1a1a;line-height:1.4}
          .report-header{border-bottom:3px double #333;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start}
          .report-header .left h1{font-size:16px;font-weight:700;margin:0 0 2px;color:#111;letter-spacing:-0.3px}
          .report-header .left h2{font-size:13px;font-weight:600;margin:0 0 4px;color:#333}
          .report-header .left p{font-size:9px;color:#666;margin:1px 0}
          .report-header .right{text-align:right;font-size:9px;color:#666}
          .report-header .right .logo{font-size:20px;font-weight:800;color:#16a34a;letter-spacing:-1px}
          .report-meta{display:flex;justify-content:space-between;font-size:9px;color:#888;border-bottom:1px solid #ddd;padding-bottom:8px;margin-bottom:12px}
          table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px}
          th{background:#f5f5f5;font-weight:700;padding:7px 8px;text-align:left;border-bottom:2px solid #bbb;font-size:9px;text-transform:uppercase;letter-spacing:0.3px;color:#444}
          td{padding:5px 8px;border-bottom:1px solid #e5e5e5}
          tr:hover{background:#fafafa}
          .text-right{text-align:right}
          .font-bold{font-weight:700}
          .font-mono{font-family:'Courier New',monospace}
          .section-header{background:#f0f4f0;font-weight:700;padding:8px 10px;border-left:3px solid #16a34a;font-size:10px}
          .total-row{background:#f5f5f5;font-weight:700;border-top:2px solid #999;font-size:10px}
          .badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:8px;font-weight:600;border:1px solid #ddd}
          .balance-check{border:2px solid #16a34a;background:#f0fdf4;border-radius:6px;padding:10px;text-align:center;margin-top:12px}
          .balance-check.fail{border-color:#dc2626;background:#fef2f2}
          .footer{position:fixed;bottom:0;left:0;right:0;border-top:1px solid #ddd;padding:6px 12mm;font-size:8px;color:#999;display:flex;justify-content:space-between}
          .page-break{page-break-before:always}
          @media print{body{padding:0}.footer{position:fixed;bottom:0}table{page-break-inside:auto}tr{page-break-inside:avoid}thead{display:table-header-group}}
        </style></head><body>
        <div class="report-header">
          <div class="left">
            <h1>${reportTitle}</h1>
            <h2>AcctFin ERP - Accounting & Financial Management System</h2>
            <p>Multi-Project • Multi-Donor • Multi-Currency • Multi-Location</p>
          </div>
          <div class="right">
            <div class="logo">AF</div>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p>FY 2024-25</p>
          </div>
        </div>
        <div class="report-meta">
          <span>${dateFrom ? `Period: ${dateFrom} to ${dateTo}` : `As at: ${dateTo || new Date().toLocaleDateString()}`}</span>
          <span>Filters: ${filterMeta}</span>
          <span>Printed by: Admin</span>
        </div>
        ${printContent.innerHTML}
        <div class="footer">
          <span>AcctFin ERP v1.0.0 • Confidential</span>
          <span>This report is computer generated and does not require a signature.</span>
          <span>Page 1</span>
        </div>
        </body></html>`)
      win?.document.close()
      setTimeout(() => win?.print(), 500)
    }
  }

  const handleExport = async (format: string) => {
    if (!reportData) return
    const reportTitle = reportTypes.find(r => r.value === reportType)?.label || reportType
    let content: string
    let mimeType: string
    let extension: string

    if (format === 'CSV') {
      const rows: string[][] = []
      if (reportType === 'trial_balance' && reportData.data) {
        rows.push(['Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Balance', 'Balance Type'])
        reportData.data.forEach((row: any) => {
          rows.push([row.code, row.name, row.accountType, row.totalDebit || '', row.totalCredit || '', row.balance, row.balanceType])
        })
        rows.push(['', '', 'TOTAL', reportData.totalDebit, reportData.totalCredit, '', ''])
      } else if (reportType === 'balance_sheet' && reportData.sections) {
        rows.push(['Section', 'Code', 'Name', 'Sub Type', 'Amount'])
        reportData.sections.assets?.forEach((a: any) => rows.push(['Assets', a.code, a.name, a.subType || '', a.balance]))
        rows.push(['Assets', '', 'Total Assets', '', reportData.totalAssets])
        reportData.sections.liabilities?.forEach((a: any) => rows.push(['Liabilities', a.code, a.name, '', a.balance]))
        rows.push(['Liabilities', '', 'Total Liabilities', '', reportData.totalLiabilities])
        reportData.sections.equity?.forEach((a: any) => rows.push(['Equity', a.code, a.name, '', a.balance]))
        rows.push(['Equity', '', 'Total Equity', '', reportData.totalEquity])
      } else if (reportType === 'pnl' && reportData.income) {
        rows.push(['Section', 'Code', 'Name', 'Amount'])
        reportData.income.forEach((a: any) => rows.push(['Income', a.code, a.name, a.balance]))
        rows.push(['Income', '', 'Total Income', reportData.totalIncome])
        reportData.expenses.forEach((a: any) => rows.push(['Expenses', a.code, a.name, a.balance]))
        rows.push(['Expenses', '', 'Total Expenses', reportData.totalExpenses])
        rows.push(['', '', reportData.netSurplus >= 0 ? 'Net Surplus' : 'Net Deficit', Math.abs(reportData.netSurplus)])
      } else if (reportType === 'cash_flow' && reportData.entries) {
        rows.push(['Date', 'Voucher', 'Account', 'Narration', 'Inflow', 'Outflow'])
        reportData.entries.forEach((e: any) => {
          rows.push([new Date(e.voucher?.date).toLocaleDateString(), e.voucher?.voucherNumber, `${e.account?.code} - ${e.account?.name}`, e.voucher?.narration, e.debit > 0 ? e.debit : '', e.credit > 0 ? e.credit : ''])
        })
      } else if (reportType === 'client_wise_project' && reportData.data) {
        rows.push(['Client Code', 'Client Name', 'Industry', 'Project Code', 'Project Name', 'Project Status', 'Total Debit', 'Total Credit', 'Net Balance'])
        reportData.data.forEach((client: any) => {
          if (client.projects && client.projects.length > 0) {
            client.projects.forEach((proj: any) => {
              rows.push([client.code, client.name, client.industry || '', proj.code, proj.name, proj.status, proj.totalDebit, proj.totalCredit, proj.balance])
            })
          } else {
            rows.push([client.code, client.name, client.industry || '', '', '', '', client.totalDebit, client.totalCredit, client.balance])
          }
        })
        rows.push(['', '', '', '', '', 'GRAND TOTAL', reportData.grandTotalDebit, reportData.grandTotalCredit, reportData.grandBalance])
      } else if (reportType === 'general_ledger' && reportData.entries) {
        rows.push(['Date', 'Voucher', 'Type', 'Narration', 'Debit', 'Credit', 'Balance'])
        reportData.entries.forEach((e: any) => {
          rows.push([new Date(e.date).toLocaleDateString(), e.voucherNumber, e.voucherType, e.narration, e.debit || '', e.credit || '', e.balance])
        })
        rows.push(['', '', 'TOTAL', '', reportData.totalDebit, reportData.totalCredit, reportData.closingBalance || ''])
      } else if (reportType === 'receipts_payments') {
        rows.push(['Section', 'Date', 'Voucher', 'Narration', 'Amount'])
        ;(reportData.receipts || []).forEach((v: any) => {
          rows.push(['Receipt', new Date(v.date).toLocaleDateString(), v.voucherNumber, v.narration, v.entries?.reduce((s: number, e: any) => s + e.debit, 0) || 0])
        })
        ;(reportData.payments || []).forEach((v: any) => {
          rows.push(['Payment', new Date(v.date).toLocaleDateString(), v.voucherNumber, v.narration, v.entries?.reduce((s: number, e: any) => s + e.credit, 0) || 0])
        })
      } else if (reportType === 'aging' && reportData.data) {
        const periods = reportData.periods || []
        rows.push(['Code', 'Name', 'Balance', ...periods])
        reportData.data.forEach((d: any) => {
          rows.push([d.code, d.name, d.balance, ...(d.buckets || [])])
        })
        rows.push(['', 'TOTAL', reportData.grandTotal, ...(reportData.periodTotals || [])])
      } else if (reportType === 'budget_vs_actual' && reportData.data) {
        rows.push(['Account Code', 'Account Name', 'Budget Name', 'Budget Amt', 'Actual Amt', 'Variance', 'Var %'])
        reportData.data.forEach((d: any) => {
          rows.push([d.accountCode, d.accountName, d.budgetName, d.budgetAmount, d.actualAmount, d.variance, `${d.variancePct.toFixed(1)}%`])
        })
      } else {
        rows.push(['Code', 'Name', 'Total Debit', 'Total Credit', 'Net Balance'])
        reportData.data?.forEach((d: any) => {
          rows.push([d.code, d.project || d.donor || d.location, d.totalDebit, d.totalCredit, d.balance])
        })
      }
      content = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
      mimeType = 'text/csv'
      extension = 'csv'
    } else {
      content = JSON.stringify(reportData, null, 2)
      mimeType = 'application/json'
      extension = 'json'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${extension}`
    a.click()
    URL.revokeObjectURL(url)
  }

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
            <TableHead className="text-[10px]">Balance Type</TableHead>
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
            <TableHeader><TableRow><TableHead className="text-[10px]">Code</TableHead><TableHead className="text-[10px]">Name</TableHead><TableHead className="text-[10px] text-right">Amount</TableHead></TableRow></TableHeader>
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
            <TableHeader><TableRow><TableHead className="text-[10px]">Code</TableHead><TableHead className="text-[10px]">Name</TableHead><TableHead className="text-[10px] text-right">Amount</TableHead></TableRow></TableHeader>
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
          <p className="text-[10px] text-muted-foreground mt-1">Income: {formatCurrency(reportData.totalIncome)} − Expenses: {formatCurrency(reportData.totalExpenses)}</p>
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
          <TableHeader><TableRow><TableHead className="text-[10px]">Date</TableHead><TableHead className="text-[10px]">Voucher</TableHead><TableHead className="text-[10px]">Account</TableHead><TableHead className="text-[10px]">Narration</TableHead><TableHead className="text-[10px] text-right">Inflow</TableHead><TableHead className="text-[10px] text-right">Outflow</TableHead></TableRow></TableHeader>
          <TableBody>
            {reportData.entries.map((e: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{new Date(e.voucher?.date).toLocaleDateString()}</TableCell>
                <TableCell className="text-xs font-mono">{e.voucher?.voucherNumber}</TableCell>
                <TableCell className="text-xs">{e.account?.code} - {e.account?.name}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{e.voucher?.narration}</TableCell>
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

  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  const toggleClientExpand = (clientId: string) => {
    const next = new Set(expandedClients)
    if (next.has(clientId)) next.delete(clientId)
    else next.add(clientId)
    setExpandedClients(next)
  }

  const renderClientWiseProject = () => {
    if (!reportData?.data) return <p className="text-xs text-muted-foreground text-center py-8">No data</p>
    return (
      <div className="space-y-1">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="border-l-4 border-l-emerald-400"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Debit</p><p className="text-sm font-bold text-emerald-600">{formatCurrency(reportData.grandTotalDebit)}</p></CardContent></Card>
          <Card className="border-l-4 border-l-red-400"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Credit</p><p className="text-sm font-bold text-red-600">{formatCurrency(reportData.grandTotalCredit)}</p></CardContent></Card>
          <Card className={`border-l-4 ${reportData.grandBalance >= 0 ? 'border-l-emerald-400' : 'border-l-red-400'}`}><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Net Balance</p><p className={`text-sm font-bold ${reportData.grandBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(reportData.grandBalance)}</p></CardContent></Card>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] w-8"></TableHead>
              <TableHead className="text-[10px]">Client Code</TableHead>
              <TableHead className="text-[10px]">Client Name</TableHead>
              <TableHead className="text-[10px]">Industry</TableHead>
              <TableHead className="text-[10px] text-center">Projects</TableHead>
              <TableHead className="text-[10px] text-right">Total Debit</TableHead>
              <TableHead className="text-[10px] text-right">Total Credit</TableHead>
              <TableHead className="text-[10px] text-right">Net Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportData.data.map((client: any) => {
              const isExpanded = expandedClients.has(client.id)
              const hasProjects = client.projects && client.projects.length > 0
              return (
                <React.Fragment key={client.id}>
                  <TableRow className="hover:bg-accent/50 font-medium">
                    <TableCell>
                      {hasProjects ? (
                        <button onClick={() => toggleClientExpand(client.id)} className="p-0.5 rounded hover:bg-muted">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        <span className="w-5 inline-block" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{client.code}</TableCell>
                    <TableCell className="text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {client.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{client.industry || '-'}</TableCell>
                    <TableCell className="text-xs text-center">
                      {client.projectCount > 0 && (
                        <Badge className="text-[9px] bg-amber-100 text-amber-800">{client.projectCount}</Badge>
                      )}
                      {client.projectCount === 0 && <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(client.totalDebit)}</TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(client.totalCredit)}</TableCell>
                    <TableCell className="text-xs text-right font-bold">{formatCurrency(client.balance)}</TableCell>
                  </TableRow>
                  {isExpanded && hasProjects && client.projects.map((proj: any) => (
                    <TableRow key={proj.id} className="bg-muted/30 hover:bg-muted/50">
                      <TableCell></TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">↳ {proj.code}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground pl-6">{proj.name}</TableCell>
                      <TableCell><Badge className="text-[8px]">{proj.status}</Badge></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-[10px] text-right text-muted-foreground">{formatCurrency(proj.totalDebit)}</TableCell>
                      <TableCell className="text-[10px] text-right text-muted-foreground">{formatCurrency(proj.totalCredit)}</TableCell>
                      <TableCell className="text-[10px] text-right font-medium">{formatCurrency(proj.balance)}</TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              )
            })}
            {reportData.data.length > 0 && (
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={5} className="text-xs">GRAND TOTAL</TableCell>
                <TableCell className="text-xs text-right">{formatCurrency(reportData.grandTotalDebit)}</TableCell>
                <TableCell className="text-xs text-right">{formatCurrency(reportData.grandTotalCredit)}</TableCell>
                <TableCell className="text-xs text-right">{formatCurrency(reportData.grandBalance)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderGeneralLedger = () => {
    if (!glAccountId) return <p className="text-xs text-muted-foreground text-center py-8">Select an account to view its General Ledger</p>
    if (!reportData?.entries) return <p className="text-xs text-muted-foreground text-center py-8">No transactions found for this account</p>
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
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Date</TableHead>
              <TableHead className="text-[10px]">Voucher</TableHead>
              <TableHead className="text-[10px]">Type</TableHead>
              <TableHead className="text-[10px]">Narration</TableHead>
              <TableHead className="text-[10px] text-right">Debit</TableHead>
              <TableHead className="text-[10px] text-right">Credit</TableHead>
              <TableHead className="text-[10px] text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportData.entries.map((e: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                <TableCell className="font-mono text-xs">{e.voucherNumber}</TableCell>
                <TableCell><Badge className="text-[8px]">{e.voucherType}</Badge></TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{e.narration}</TableCell>
                <TableCell className="text-xs text-right text-emerald-600">{e.debit > 0 ? formatCurrency(e.debit) : ''}</TableCell>
                <TableCell className="text-xs text-right text-red-600">{e.credit > 0 ? formatCurrency(e.credit) : ''}</TableCell>
                <TableCell className={`text-xs text-right font-semibold ${e.balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(e.balance)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-muted/50">
              <TableCell colSpan={4} className="text-xs">TOTAL</TableCell>
              <TableCell className="text-xs text-right">{formatCurrency(reportData.totalDebit)}</TableCell>
              <TableCell className="text-xs text-right">{formatCurrency(reportData.totalCredit)}</TableCell>
              <TableCell className="text-xs text-right">{formatCurrency(reportData.closingBalance || 0)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderReceiptsPayments = () => {
    if (!reportData?.receipts && !reportData?.payments) return <p className="text-xs text-muted-foreground text-center py-8">No data</p>
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-emerald-400"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Receipts</p><p className="text-sm font-bold text-emerald-600">{formatCurrency(reportData.totalReceipts)}</p></CardContent></Card>
          <Card className="border-l-4 border-l-red-400"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Payments</p><p className="text-sm font-bold text-red-600">{formatCurrency(reportData.totalPayments)}</p></CardContent></Card>
          <Card className={`border-l-4 ${reportData.netAmount >= 0 ? 'border-l-emerald-400' : 'border-l-red-400'}`}><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Net Amount</p><p className={`text-sm font-bold ${reportData.netAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(reportData.netAmount)}</p></CardContent></Card>
        </div>
        <div>
          <h4 className="text-xs font-bold mb-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded">RECEIPTS</h4>
          <Table>
            <TableHeader><TableRow><TableHead className="text-[10px]">Date</TableHead><TableHead className="text-[10px]">Voucher</TableHead><TableHead className="text-[10px]">Narration</TableHead><TableHead className="text-[10px] text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {(reportData.receipts || []).map((v: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{new Date(v.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell className="font-mono text-xs">{v.voucherNumber}</TableCell>
                  <TableCell className="text-xs">{v.narration}</TableCell>
                  <TableCell className="text-xs text-right text-emerald-600 font-semibold">{formatCurrency(v.entries?.reduce((s: number, e: any) => s + e.debit, 0) || 0)}</TableCell>
                </TableRow>
              ))}
              {(!reportData.receipts || reportData.receipts.length === 0) && <TableRow><TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-4">No receipts</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        <div>
          <h4 className="text-xs font-bold mb-2 text-red-700 bg-red-50 px-3 py-1.5 rounded">PAYMENTS</h4>
          <Table>
            <TableHeader><TableRow><TableHead className="text-[10px]">Date</TableHead><TableHead className="text-[10px]">Voucher</TableHead><TableHead className="text-[10px]">Narration</TableHead><TableHead className="text-[10px] text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {(reportData.payments || []).map((v: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{new Date(v.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell className="font-mono text-xs">{v.voucherNumber}</TableCell>
                  <TableCell className="text-xs">{v.narration}</TableCell>
                  <TableCell className="text-xs text-right text-red-600 font-semibold">{formatCurrency(v.entries?.reduce((s: number, e: any) => s + e.credit, 0) || 0)}</TableCell>
                </TableRow>
              ))}
              {(!reportData.payments || reportData.payments.length === 0) && <TableRow><TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-4">No payments</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  const renderAgingReport = () => {
    if (!reportData?.data) return <p className="text-xs text-muted-foreground text-center py-8">No data</p>
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Badge className={`text-xs ${reportData.agingType === 'receivables' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
            {reportData.agingType === 'receivables' ? 'Receivables' : 'Payables'}
          </Badge>
          <span className="text-sm font-bold">Grand Total: {formatCurrency(reportData.grandTotal)}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Code</TableHead>
              <TableHead className="text-[10px]">Name</TableHead>
              <TableHead className="text-[10px] text-right">Balance</TableHead>
              {(reportData.periods || []).map((p: string, i: number) => (
                <TableHead key={i} className="text-[10px] text-right">{p}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportData.data.map((d: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{d.code}</TableCell>
                <TableCell className="text-xs">{d.name}</TableCell>
                <TableCell className="text-xs text-right font-semibold">{formatCurrency(d.balance)}</TableCell>
                {(d.buckets || []).map((b: number, j: number) => (
                  <TableCell key={j} className="text-xs text-right">{b > 0 ? formatCurrency(b) : ''}</TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="font-bold bg-muted/50">
              <TableCell colSpan={2} className="text-xs">TOTAL</TableCell>
              <TableCell className="text-xs text-right">{formatCurrency(reportData.grandTotal)}</TableCell>
              {(reportData.periodTotals || []).map((t: number, i: number) => (
                <TableCell key={i} className="text-xs text-right">{t > 0 ? formatCurrency(t) : ''}</TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderBudgetVsActual = () => {
    if (!reportData?.data) return <p className="text-xs text-muted-foreground text-center py-8">No budget data found. Create and approve budgets first.</p>
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-sky-400"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Budget</p><p className="text-sm font-bold text-sky-600">{formatCurrency(reportData.totalBudget)}</p></CardContent></Card>
          <Card className="border-l-4 border-l-amber-400"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Actual</p><p className="text-sm font-bold text-amber-600">{formatCurrency(reportData.totalActual)}</p></CardContent></Card>
          <Card className={`border-l-4 ${reportData.totalVariance >= 0 ? 'border-l-emerald-400' : 'border-l-red-400'}`}><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Variance</p><p className={`text-sm font-bold ${reportData.totalVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(reportData.totalVariance)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Account</TableHead>
              <TableHead className="text-[10px]">Budget</TableHead>
              <TableHead className="text-[10px] text-right">Budget Amt</TableHead>
              <TableHead className="text-[10px] text-right">Actual Amt</TableHead>
              <TableHead className="text-[10px] text-right">Variance</TableHead>
              <TableHead className="text-[10px] text-right">Var %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportData.data.map((d: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="text-xs"><span className="font-mono text-[10px] text-muted-foreground mr-1">{d.accountCode}</span>{d.accountName}</TableCell>
                <TableCell className="text-[10px] text-muted-foreground">{d.budgetName}</TableCell>
                <TableCell className="text-xs text-right">{formatCurrency(d.budgetAmount)}</TableCell>
                <TableCell className="text-xs text-right">{formatCurrency(d.actualAmount)}</TableCell>
                <TableCell className={`text-xs text-right font-semibold ${d.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(d.variance)}</TableCell>
                <TableCell className={`text-xs text-right ${d.variancePct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{d.variancePct.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  const reportTypes = [
    { value: 'trial_balance', label: 'Trial Balance', desc: 'List of all accounts with debit/credit balances' },
    { value: 'balance_sheet', label: 'Balance Sheet', desc: 'Assets = Liabilities + Equity' },
    { value: 'pnl', label: 'Profit & Loss', desc: 'Income vs Expenses statement' },
    { value: 'cash_flow', label: 'Cash Flow Statement', desc: 'Operating cash inflows and outflows' },
    { value: 'receipts_payments', label: 'Receipts & Payments', desc: 'Summary of all receipts and payments' },
    { value: 'general_ledger', label: 'General Ledger', desc: 'Detailed account transaction history' },
    { value: 'aging', label: 'Aging Report', desc: 'Receivables/payables aging analysis' },
    { value: 'budget_vs_actual', label: 'Budget vs Actual', desc: 'Budget variance analysis' },
    { value: 'donor_wise', label: 'Donor-wise Report', desc: 'Financial summary by donor' },
    { value: 'project_wise', label: 'Project-wise Report', desc: 'Financial summary by project' },
    { value: 'location_wise', label: 'Location-wise Report', desc: 'Financial summary by location' },
    { value: 'client_wise_project', label: 'Client-wise Project', desc: 'Financial summary by client with project breakdown' },
  ]

  // Get active filter labels for display
  const getActiveFilterLabels = () => {
    const labels: { key: string; label: string; value: string }[] = []
    if (projectId !== 'all') {
      const p = filterData.projects.find(p => p.id === projectId)
      if (p) labels.push({ key: 'project', label: 'Project', value: p.name })
    }
    if (clientId !== 'all') {
      const c = filterData.clients.find(c => c.id === clientId)
      if (c) labels.push({ key: 'client', label: 'Client', value: c.name })
    }
    if (donorId !== 'all') {
      const d = filterData.donors.find(d => d.id === donorId)
      if (d) labels.push({ key: 'donor', label: 'Donor', value: d.name })
    }
    if (locationId !== 'all') {
      const l = filterData.locations.find(l => l.id === locationId)
      if (l) labels.push({ key: 'location', label: 'Location', value: l.name })
    }
    if (financialYearId !== 'all') {
      const fy = filterData.financialYears.find(fy => fy.id === financialYearId)
      if (fy) labels.push({ key: 'fy', label: 'Fin. Year', value: fy.name })
    }
    return labels
  }

  const activeFilterLabels = getActiveFilterLabels()

  return (
    <div className="space-y-4">
      {/* Report Controls */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52">
              <Label className="text-[10px]">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {reportTypes.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="text-[10px]">From Date</Label>
              <Input type="date" className="h-8 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="w-36">
              <Label className="text-[10px]">To Date</Label>
              <Input type="date" className="h-8 text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            {reportType === 'general_ledger' && (
              <div className="w-64">
                <Label className="text-[10px]">Account</Label>
                <Select value={glAccountId} onValueChange={setGlAccountId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="font-mono text-[10px] text-muted-foreground mr-1">{a.code}</span>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {reportType === 'aging' && (
              <div className="w-40">
                <Label className="text-[10px]">Aging Type</Label>
                <Select value={agingType} onValueChange={setAgingType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receivables">Receivables</SelectItem>
                    <SelectItem value="payables">Payables</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button size="sm" className="h-8 text-xs" onClick={generateReport} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />Generate
            </Button>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              Filters
              {hasActiveFilters && (
                <Badge className="ml-1.5 h-4 w-4 p-0 text-[8px] flex items-center justify-center rounded-full">{activeFilterLabels.length}</Badge>
              )}
            </Button>
            <div className="flex gap-1 ml-auto">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handlePrint} disabled={!reportData}><Printer className="h-3.5 w-3.5 mr-1" />Print</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleExport('CSV')} disabled={!reportData}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleExport('JSON')} disabled={!reportData}><Download className="h-3.5 w-3.5 mr-1" />JSON</Button>
            </div>
          </div>

          {/* Expandable Filter Panel */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">Advanced Filters</span>
                  <span className="text-[10px] text-muted-foreground">— Filter report data by specific dimensions</span>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground hover:text-destructive" onClick={clearFilters}>
                    <X className="h-3 w-3 mr-1" />Clear All
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {/* Project Filter */}
                {relevantFilters.includes('project') && (
                  <div>
                    <Label className="text-[10px] font-medium">
                      Project
                      {filterData.projects.length === 0 && <span className="text-muted-foreground ml-1">(none)</span>}
                    </Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {filterData.projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="font-mono text-[10px] text-muted-foreground mr-1">{p.code}</span>
                            {p.name}
                            {p.status && <span className="ml-1 text-[9px] text-muted-foreground">({p.status})</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Client Filter */}
                {relevantFilters.includes('client') && (
                  <div>
                    <Label className="text-[10px] font-medium">
                      Client
                      {filterData.clients.length === 0 && <span className="text-muted-foreground ml-1">(none)</span>}
                    </Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Clients</SelectItem>
                        {filterData.clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="font-mono text-[10px] text-muted-foreground mr-1">{c.code}</span>
                            {c.name}
                            {c.industry && <span className="ml-1 text-[9px] text-muted-foreground">({c.industry})</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Donor Filter */}
                {relevantFilters.includes('donor') && (
                  <div>
                    <Label className="text-[10px] font-medium">
                      Donor
                      {filterData.donors.length === 0 && <span className="text-muted-foreground ml-1">(none)</span>}
                    </Label>
                    <Select value={donorId} onValueChange={setDonorId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Donors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Donors</SelectItem>
                        {filterData.donors.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            <span className="font-mono text-[10px] text-muted-foreground mr-1">{d.code}</span>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Location Filter */}
                {relevantFilters.includes('location') && (
                  <div>
                    <Label className="text-[10px] font-medium">
                      Location
                      {filterData.locations.length === 0 && <span className="text-muted-foreground ml-1">(none)</span>}
                    </Label>
                    <Select value={locationId} onValueChange={setLocationId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Locations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {filterData.locations.map(l => (
                          <SelectItem key={l.id} value={l.id}>
                            <span className="font-mono text-[10px] text-muted-foreground mr-1">{l.code}</span>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Financial Year Filter */}
                {relevantFilters.includes('financialYear') && (
                  <div>
                    <Label className="text-[10px] font-medium">Financial Year</Label>
                    <Select value={financialYearId} onValueChange={setFinancialYearId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Years" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Financial Years</SelectItem>
                        {filterData.financialYears.map(fy => (
                          <SelectItem key={fy.id} value={fy.id}>
                            {fy.name}
                            <span className="ml-1 text-[9px] text-muted-foreground">({fy.status})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Active Filter Tags */}
              {activeFilterLabels.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-dashed">
                  <span className="text-[10px] text-muted-foreground mr-1">Active:</span>
                  {activeFilterLabels.map(f => (
                    <Badge key={f.key} variant="secondary" className="text-[9px] gap-1 pr-1">
                      {f.label}: {f.value}
                      <button
                        onClick={() => {
                          if (f.key === 'project') setProjectId('all')
                          if (f.key === 'client') setClientId('all')
                          if (f.key === 'donor') setDonorId('all')
                          if (f.key === 'location') setLocationId('all')
                          if (f.key === 'fy') setFinancialYearId('all')
                        }}
                        className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Description */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {reportTypes.find(r => r.value === reportType)?.desc}
          </p>
        </div>
        {activeFilterLabels.length > 0 && !showFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilterLabels.map(f => (
              <Badge key={f.key} variant="outline" className="text-[9px]">
                {f.label}: {f.value}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Report Content */}
      <Card id="report-content">
        <CardHeader className="pb-2">
          <div className="text-center">
            <CardTitle className="text-sm">{reportData?.reportType || reportTypes.find(r => r.value === reportType)?.label}</CardTitle>
            <CardDescription className="text-[10px]">
              {dateFrom && `From: ${dateFrom}`} {dateTo && `To: ${dateTo}`} | Generated: {new Date().toLocaleString()}
              {activeFilterLabels.length > 0 && (
                <> | Filtered: {activeFilterLabels.map(f => `${f.label}: ${f.value}`).join(', ')}</>
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Generating report...</span>
            </div>
          ) : !reportData ? (
            <p className="text-xs text-center py-8 text-muted-foreground">Click Generate to create the report</p>
          ) : (
            <>
              {reportType === 'trial_balance' && renderTrialBalance()}
              {reportType === 'balance_sheet' && renderBalanceSheet()}
              {reportType === 'pnl' && renderPnL()}
              {reportType === 'cash_flow' && renderCashFlow()}
              {reportType === 'client_wise_project' && renderClientWiseProject()}
              {reportType === 'general_ledger' && renderGeneralLedger()}
              {reportType === 'receipts_payments' && renderReceiptsPayments()}
              {reportType === 'aging' && renderAgingReport()}
              {reportType === 'budget_vs_actual' && renderBudgetVsActual()}
              {!['trial_balance', 'balance_sheet', 'pnl', 'cash_flow', 'client_wise_project', 'general_ledger', 'receipts_payments', 'aging', 'budget_vs_actual'].includes(reportType) && renderSegmentReport()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
