'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileBarChart, Download, Printer } from 'lucide-react'

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
      const win = window.open('', '', 'width=800,height=600')
      win?.document.write(`<html><head><title>Financial Report</title><style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-weight:bold}.text-right{text-align:right}h2{margin-bottom:4px}p{color:#666;margin:2px 0}</style></head><body>${printContent.innerHTML}</body></html>`)
      win?.document.close()
      win?.print()
    }
  }

  const handleExport = async (format: string) => {
    await fetch('/api/import-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export', exportType: reportType, format, parameters: { dateFrom, dateTo } }),
    })
    // For now, generate a downloadable text
    if (reportData) {
      const text = JSON.stringify(reportData, null, 2)
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportType}-report.txt`
      a.click()
      URL.revokeObjectURL(url)
    }
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
        {/* Assets */}
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
        {/* Liabilities */}
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
        {/* Equity */}
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
        <div className={`p-3 rounded-lg border-2 text-center ${reportData.netSurplus >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs font-bold">{reportData.netSurplus >= 0 ? 'NET SURPLUS' : 'NET DEFICIT'}</p>
          <p className="text-lg font-bold">{formatCurrency(Math.abs(reportData.netSurplus))}</p>
        </div>
      </div>
    )
  }

  const renderCashFlow = () => {
    if (!reportData?.entries) return <p className="text-xs text-muted-foreground text-center py-8">No data</p>
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Inflow</p><p className="text-sm font-bold text-green-600">{formatCurrency(reportData.totalInflow)}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Outflow</p><p className="text-sm font-bold text-red-600">{formatCurrency(reportData.totalOutflow)}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Net Cash Flow</p><p className={`text-sm font-bold ${reportData.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(reportData.netCashFlow)}</p></CardContent></Card>
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
                <TableCell className="text-xs text-right text-green-600">{e.debit > 0 ? formatCurrency(e.debit) : ''}</TableCell>
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
          {reportData.reportType.includes('project') && <TableHead className="text-[10px]">Status</TableHead>}
          <TableHead className="text-[10px] text-right">Total Debit</TableHead>
          <TableHead className="text-[10px] text-right">Total Credit</TableHead>
          <TableHead className="text-[10px] text-right">Net Balance</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {reportData.data.map((d: any, i: number) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{d.code}</TableCell>
              <TableCell className="text-xs font-medium">{d.project || d.donor || d.location}</TableCell>
              {reportData.reportType.includes('project') && <TableCell className="text-xs"><Badge className="text-[9px]">{d.status}</Badge></TableCell>}
              <TableCell className="text-xs text-right">{formatCurrency(d.totalDebit)}</TableCell>
              <TableCell className="text-xs text-right">{formatCurrency(d.totalCredit)}</TableCell>
              <TableCell className="text-xs text-right font-semibold">{formatCurrency(d.balance)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  const reportTypes = [
    { value: 'trial_balance', label: 'Trial Balance' },
    { value: 'balance_sheet', label: 'Balance Sheet' },
    { value: 'pnl', label: 'Profit & Loss' },
    { value: 'cash_flow', label: 'Cash Flow Statement' },
    { value: 'donor_wise', label: 'Donor-wise Report' },
    { value: 'project_wise', label: 'Project-wise Report' },
    { value: 'location_wise', label: 'Location-wise Report' },
  ]

  return (
    <div className="space-y-4">
      {/* Report Controls */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
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
              <FileBarChart className="h-3.5 w-3.5 mr-1" />Generate
            </Button>
            <div className="flex gap-1 ml-auto">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-1" />Print</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleExport('XLSX')}><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      <Card id="report-content">
        <CardHeader className="pb-2">
          <div className="text-center">
            <CardTitle className="text-sm">{reportData?.reportType || 'Financial Report'}</CardTitle>
            <CardDescription className="text-[10px]">
              {dateFrom && `From: ${dateFrom}`} {dateTo && `To: ${dateTo}`} | Generated: {new Date().toLocaleString()}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-xs text-center py-8 text-muted-foreground">Generating report...</p> :
            reportType === 'trial_balance' ? renderTrialBalance() :
            reportType === 'balance_sheet' ? renderBalanceSheet() :
            reportType === 'pnl' ? renderPnL() :
            reportType === 'cash_flow' ? renderCashFlow() :
            renderSegmentReport()
          }
        </CardContent>
      </Card>
    </div>
  )
}
