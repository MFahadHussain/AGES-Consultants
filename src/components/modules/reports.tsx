'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileBarChart, Download, Printer, RefreshCw, FileText, ChevronDown, ChevronRight, Building2 } from 'lucide-react'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function FinancialReports() {
  const [reportType, setReportType] = useState('trial_balance')
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])

  const generateReport = async () => {
    setLoading(true)
    const params = new URLSearchParams({ reportType, dateFrom, dateTo })
    try {
      const res = await fetch(`/api/reports?${params}`)
      setReportData(await res.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { queueMicrotask(() => generateReport()) }, [reportType])

  const handlePrint = () => {
    const printContent = document.getElementById('report-content')
    if (printContent) {
      const reportTitle = reportTypes.find(r => r.value === reportType)?.label || reportType.replace(/_/g, ' ').toUpperCase()
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
          <span>Report Type: ${reportTitle}</span>
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
      // Generate CSV
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
      } else {
        // Segment reports
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
        {/* Summary cards */}
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

  const reportTypes = [
    { value: 'trial_balance', label: 'Trial Balance', desc: 'List of all accounts with debit/credit balances' },
    { value: 'balance_sheet', label: 'Balance Sheet', desc: 'Assets = Liabilities + Equity' },
    { value: 'pnl', label: 'Profit & Loss', desc: 'Income vs Expenses statement' },
    { value: 'cash_flow', label: 'Cash Flow Statement', desc: 'Operating cash inflows and outflows' },
    { value: 'donor_wise', label: 'Donor-wise Report', desc: 'Financial summary by donor' },
    { value: 'project_wise', label: 'Project-wise Report', desc: 'Financial summary by project' },
    { value: 'location_wise', label: 'Location-wise Report', desc: 'Financial summary by location' },
    { value: 'client_wise_project', label: 'Client-wise Project', desc: 'Financial summary by client with project breakdown' },
  ]

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
            <Button size="sm" className="h-8 text-xs" onClick={generateReport} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />Generate
            </Button>
            <div className="flex gap-1 ml-auto">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handlePrint} disabled={!reportData}><Printer className="h-3.5 w-3.5 mr-1" />Print</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleExport('CSV')} disabled={!reportData}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleExport('JSON')} disabled={!reportData}><Download className="h-3.5 w-3.5 mr-1" />JSON</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Description */}
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          {reportTypes.find(r => r.value === reportType)?.desc}
        </p>
      </div>

      {/* Report Content */}
      <Card id="report-content">
        <CardHeader className="pb-2">
          <div className="text-center">
            <CardTitle className="text-sm">{reportData?.reportType || reportTypes.find(r => r.value === reportType)?.label}</CardTitle>
            <CardDescription className="text-[10px]">
              {dateFrom && `From: ${dateFrom}`} {dateTo && `To: ${dateTo}`} | Generated: {new Date().toLocaleString()}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">Generating report...</span>
            </div>
          ) : !reportData ? (
            <p className="text-xs text-center py-8 text-muted-foreground">Click Generate to create the report</p>
          ) :
            reportType === 'trial_balance' ? renderTrialBalance() :
            reportType === 'balance_sheet' ? renderBalanceSheet() :
            reportType === 'pnl' ? renderPnL() :
            reportType === 'cash_flow' ? renderCashFlow() :
            reportType === 'client_wise_project' ? renderClientWiseProject() :
            renderSegmentReport()
          }
        </CardContent>
      </Card>
    </div>
  )
}
