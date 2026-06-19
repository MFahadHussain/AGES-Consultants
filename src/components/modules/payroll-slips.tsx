'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  FileText, Download, Eye, Printer, RefreshCw, X, Search,
  Building2, Landmark, Users, DollarSign, AlertCircle,
  CheckCircle2, CheckSquare, Square, Mail, Loader2,
  TrendingDown, TrendingUp, Shield, Receipt
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ── Helpers ──────────────────────────────────────────────────

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-PK')
}

function fmtPKR(n: number): string {
  return `Rs ${fmt(n)}`
}

function periodLabel(period: string): string {
  if (!period) return ''
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
    </div>
  )
}

// ── Preview Modal ─────────────────────────────────────────────

function PreviewModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0F2D78]" />
            <span className="font-semibold text-sm text-gray-900">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0F2D78] text-white rounded-lg hover:bg-[#0A1F54] transition-colors">
              <Download className="w-3.5 h-3.5" /> Open in new tab
            </a>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-all">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
        <iframe src={url} className="flex-1 border-0 rounded-b-2xl" title={title} />
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl py-16 text-center shadow-sm">
      <div className="flex justify-center mb-3 text-gray-300">{icon}</div>
      <p className="text-gray-500 font-medium">{title}</p>
      <p className="text-gray-400 text-sm mt-1">{desc}</p>
    </div>
  )
}

// ── SALARY SLIPS TAB ──────────────────────────────────────────

function SalarySlipsTab() {
  const { toast } = useToast()
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<Record<string, boolean>>({})
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  const handleLoad = async () => {
    if (!period) { toast({ title: 'Select a period', variant: 'destructive' }); return }
    setLoading(true)
    setEmployees([])
    setSelected(new Set())
    try {
      const res = await fetch(`/api/payroll/slips/employees?period=${period}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setEmployees(data.employees || [])
      if ((data.employees || []).length === 0) {
        toast({ title: 'No employees found', description: `No approved payroll for ${periodLabel(period)}` })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (emp: any) => {
    setDownloading(p => ({ ...p, [emp.employeeId]: true }))
    try {
      const url = `/api/payroll/slips/${emp.employeeId}?period=${period}&format=html`
      window.open(url, '_blank')
      toast({ title: 'Slip opened', description: `${emp.employeeName} — use browser print to save as PDF` })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setDownloading(p => ({ ...p, [emp.employeeId]: false }))
    }
  }

  const handlePreview = (emp: any) => {
    setPreview({
      url: `/api/payroll/slips/${emp.employeeId}?period=${period}&format=html`,
      title: `Salary Slip — ${emp.employeeName} — ${periodLabel(period)}`,
    })
  }

  const handleBulkPrint = () => {
    const ids = selected.size > 0 ? Array.from(selected) : employees.map((e: any) => e.employeeId)
    if (ids.length === 0) { toast({ title: 'No employees selected', variant: 'destructive' }); return }
    // Open first slip — user can print all by navigating
    const emp = employees.find((e: any) => e.employeeId === ids[0])
    if (emp) handlePreview(emp)
    toast({ title: 'Tip', description: 'Open each slip and use Ctrl+P to print' })
  }

  const filtered = employees.filter(e =>
    !search || e.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
    e.employeeCode?.toLowerCase().includes(search.toLowerCase())
  )

  const totals = filtered.reduce((acc, e) => ({
    gross: acc.gross + (e.grossSalary || 0),
    tax: acc.tax + (e.incomeTax || 0),
    net: acc.net + (e.netSalary || 0),
    sc: acc.sc + (e.totalSC || 0),
  }), { gross: 0, tax: 0, net: 0, sc: 0 })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Period</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2D78]" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Name or code..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2D78]" />
            </div>
          </div>
          <Button onClick={handleLoad} disabled={loading} className="bg-[#0F2D78] hover:bg-[#0A1F54] text-white h-9 px-5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            {loading ? 'Loading...' : 'Load'}
          </Button>
          {employees.length > 0 && (
            <Button variant="outline" onClick={handleBulkPrint} className="h-9 px-4">
              <Printer className="w-4 h-4 mr-1" /> Print All
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {employees.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total Gross" value={fmtPKR(totals.gross)} icon={<DollarSign className="w-4 h-4" />} color="#2563EB" />
          <KpiCard label="Total Tax" value={fmtPKR(totals.tax)} icon={<TrendingDown className="w-4 h-4" />} color="#DC2626" />
          <KpiCard label="Total Net" value={fmtPKR(totals.net)} icon={<TrendingUp className="w-4 h-4" />} color="#0F2D78" />
          <KpiCard label="Total SC" value={fmtPKR(totals.sc)} icon={<Shield className="w-4 h-4" />} color="#D97706" />
        </div>
      )}

      {/* Select bar */}
      {employees.length > 0 && (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
          <button onClick={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((e: any) => e.employeeId)))}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#0F2D78] transition-colors">
            {selected.size === filtered.length
              ? <CheckSquare className="w-4 h-4 text-[#0F2D78]" />
              : <Square className="w-4 h-4" />}
            {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
          </button>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5" />
            {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </div>
        </div>
      )}

      {/* Employee cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-48" />
                  <div className="h-3 bg-gray-100 rounded w-32" />
                  <div className="flex gap-2 mt-2">
                    {[1, 2, 3, 4].map(j => <div key={j} className="h-10 w-24 bg-gray-100 rounded-lg" />)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((emp: any) => (
            <div key={emp.employeeId}
              className={`bg-white border rounded-xl p-4 transition-all ${selected.has(emp.employeeId) ? 'border-[#1E3C87] ring-1 ring-green-500' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => setSelected(prev => {
                  const next = new Set(prev)
                  next.has(emp.employeeId) ? next.delete(emp.employeeId) : next.add(emp.employeeId)
                  return next
                })} className="mt-0.5 flex-shrink-0">
                  {selected.has(emp.employeeId)
                    ? <CheckSquare className="w-5 h-5 text-[#0F2D78]" />
                    : <Square className="w-5 h-5 text-gray-400" />}
                </button>
                <div className="w-10 h-10 rounded-full bg-[#EEF1F8] text-[#0A1F54] flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {emp.employeeName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{emp.employeeName}</span>
                    <span className="text-xs text-gray-400 font-mono">{emp.employeeCode}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#EEF1F8] text-[#0A1F54] border border-[#A5B4D2]">
                      {emp.batchStatus}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{emp.designation} · {emp.department}</div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[
                      { label: 'Gross', value: emp.grossSalary, color: 'bg-blue-50 text-blue-700' },
                      { label: 'Tax', value: emp.incomeTax, color: 'bg-red-50 text-red-700' },
                      { label: 'Net Pay', value: emp.netSalary, color: 'bg-[#EEF1F8] text-[#0A1F54]' },
                      { label: 'SC', value: emp.totalSC, color: 'bg-amber-50 text-amber-700' },
                    ].map(chip => (
                      <div key={chip.label} className={`px-3 py-1.5 rounded-lg ${chip.color}`}>
                        <div className="text-xs font-medium opacity-70">{chip.label}</div>
                        <div className="text-sm font-bold font-mono">Rs {fmt(chip.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => handlePreview(emp)} title="Preview"
                    className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDownload(emp)} disabled={!!downloading[emp.employeeId]} title="Open Slip"
                    className="p-2 rounded-lg text-gray-500 hover:text-[#0F2D78] hover:bg-[#EEF1F8] transition-all disabled:opacity-40">
                    {downloading[emp.employeeId] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : employees.length === 0 && !loading ? (
        <EmptyState icon={<FileText className="w-12 h-12" />} title="No salary slips loaded" desc="Select a period and click Load to get started" />
      ) : null}

      {preview && <PreviewModal url={preview.url} title={preview.title} onClose={() => setPreview(null)} />}
    </div>
  )
}

// ── BANK LETTER TAB ───────────────────────────────────────────

function BankLetterTab() {
  const { toast } = useToast()
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleLoad = async () => {
    if (!period) { toast({ title: 'Select a period', variant: 'destructive' }); return }
    setLoading(true)
    setSummary(null)
    try {
      const res = await fetch(`/api/payroll/bank-letter?period=${period}&format=json`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setSummary(data.data)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = () => {
    setPreview(`/api/payroll/bank-letter?period=${period}&format=html`)
  }

  const handlePrint = () => {
    window.open(`/api/payroll/bank-letter?period=${period}&format=html`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Period</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2D78]" />
          </div>
          <Button onClick={handleLoad} disabled={loading} className="bg-[#0F2D78] hover:bg-[#0A1F54] text-white h-9 px-5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            {loading ? 'Loading...' : 'Generate Preview'}
          </Button>
          {summary && (
            <>
              <Button variant="outline" onClick={handlePreview} className="h-9 px-4">
                <Eye className="w-4 h-4 mr-1" /> Preview
              </Button>
              <Button variant="outline" onClick={handlePrint} className="h-9 px-4">
                <Printer className="w-4 h-4 mr-1" /> Print / Save PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {summary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Employees" value={String(summary.totalEmployees)} icon={<Users className="w-4 h-4" />} color="#2563EB" />
            <KpiCard label="Total Gross" value={fmtPKR(summary.totalGross)} icon={<DollarSign className="w-4 h-4" />} color="#6B7280" />
            <KpiCard label="Total Deductions" value={fmtPKR(summary.totalDeductions)} icon={<TrendingDown className="w-4 h-4" />} color="#DC2626" />
            <KpiCard label="Net Disbursement" value={fmtPKR(summary.totalNet)} icon={<CheckCircle2 className="w-4 h-4" />} color="#0F2D78" />
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-900 text-sm">Disbursement Schedule — {summary.periodLabel}</span>
              <span className="text-xs text-gray-500">{summary.totalEmployees} employees</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['#', 'Employee', 'Bank', 'Account No.', 'Net Payable (Rs)'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.rows.map((row: any) => (
                    <tr key={row.srNo} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs">{row.srNo}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{row.employeeName}</div>
                        <div className="text-xs text-gray-400">{row.employeeCode} · {row.designation}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{row.bankName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.accountNumber}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#0A1F54]">{fmt(row.netSalary)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#EEF1F8] border-t-2 border-[#A5B4D2]">
                    <td colSpan={4} className="px-4 py-3 font-bold text-gray-900 text-sm">TOTAL — {summary.totalEmployees} Employees</td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-[#0A1F54]">{fmt(summary.totalNet)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!summary && !loading && (
        <EmptyState icon={<Building2 className="w-12 h-12" />} title="No letter generated yet" desc="Select a period and click Generate Preview" />
      )}

      {preview && <PreviewModal url={preview} title={`Bank Disbursement Letter — ${periodLabel(period)}`} onClose={() => setPreview(null)} />}
    </div>
  )
}

// ── FBR TAX REPORT TAB ────────────────────────────────────────

function FBRReportTab() {
  const { toast } = useToast()
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [records, setRecords] = useState<any[]>([])
  const [totals, setTotals] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleLoad = async () => {
    if (!period) { toast({ title: 'Select a period', variant: 'destructive' }); return }
    setLoading(true)
    setRecords([])
    setTotals(null)
    try {
      const res = await fetch(`/api/payroll/reports?type=tax-psid&month=${period}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setRecords(data.records || [])
      setTotals(data.totals || null)
      if ((data.records || []).length === 0) {
        toast({ title: 'No taxable employees', description: `No income tax deductions found for ${periodLabel(period)}` })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (records.length === 0) return
    const headers = Object.keys(records[0]).join(',')
    const rows = records.map(r => Object.values(r).map(v => JSON.stringify(v ?? '')).join(','))
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fbr-wht-section149-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'CSV exported', description: 'Use this file for FBR IRIS upload' })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="bg-[#EEF1F8] border border-[#A5B4D2] rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Landmark className="w-5 h-5 text-[#0A1F54] flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[#0A1F54] text-sm">FBR WHT Statement — Section 149</div>
            <div className="text-xs text-[#0A1F54] mt-1">
              Monthly Withholding Tax on Salary under Income Tax Ordinance 2001.
              Export CSV for FBR IRIS portal upload. CNIC format: 13 digits, no dashes.
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Period</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2D78]" />
          </div>
          <Button onClick={handleLoad} disabled={loading} className="bg-[#0F2D78] hover:bg-[#0A1F54] text-white h-9 px-5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            {loading ? 'Loading...' : 'Generate Report'}
          </Button>
          {records.length > 0 && (
            <>
              <Button variant="outline" onClick={handleExportCSV} className="h-9 px-4">
                <Download className="w-4 h-4 mr-1" /> Export CSV (IRIS)
              </Button>
              <Button variant="outline" onClick={handlePrint} className="h-9 px-4">
                <Printer className="w-4 h-4 mr-1" /> Print
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      {totals && (
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Taxable Employees" value={String(totals.totalRecords)} icon={<Users className="w-4 h-4" />} color="#2563EB" />
          <KpiCard label="Total Taxable Amount" value={fmtPKR(totals.totalTaxableAmount)} icon={<DollarSign className="w-4 h-4" />} color="#6B7280" />
          <KpiCard label="Total Tax Deducted" value={fmtPKR(totals.totalTaxAmount)} icon={<Receipt className="w-4 h-4" />} color="#DC2626" />
        </div>
      )}

      {/* PSID Payment Box */}
      {totals && totals.totalTaxAmount > 0 && (
        <div className="bg-white border-2 border-[#0F2D78] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="w-4 h-4 text-[#0A1F54]" />
            <span className="font-semibold text-[#0A1F54] text-sm">CPR / PSID Payment Details</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              ['Payment Head', 'Income Tax — Withholding'],
              ['Tax Type Code', '149 — Salary'],
              ['Section', 'Section 149, ITO 2001'],
              ['Period', periodLabel(period)],
              ['Amount to Deposit', fmtPKR(totals.totalTaxAmount)],
              ['Due Date', '15th of following month'],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{label}</div>
                <div className="font-semibold text-gray-900" style={label === 'Amount to Deposit' ? { color: '#DC2626', fontSize: '15px' } : {}}>{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            Generate PSID from FBR IRIS portal (iris.fbr.gov.pk). Tax must be deposited by 15th of following month.
            Late payment attracts default surcharge @ 12% per annum under Section 205.
          </div>
        </div>
      )}

      {/* Table */}
      {records.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden print:shadow-none">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <span className="font-semibold text-gray-900 text-sm">WHT Statement — Section 149</span>
              <span className="text-xs text-gray-500 ml-2">{periodLabel(period)}</span>
            </div>
            <span className="text-xs text-gray-500">{records.length} taxable employee{records.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0F2D78] text-white">
                  <th className="px-3 py-3 text-left font-semibold uppercase tracking-wider">#</th>
                  <th className="px-3 py-3 text-left font-semibold uppercase tracking-wider">Employee Name</th>
                  <th className="px-3 py-3 text-left font-semibold uppercase tracking-wider">CNIC (13 Digits)</th>
                  <th className="px-3 py-3 text-left font-semibold uppercase tracking-wider">NTN</th>
                  <th className="px-3 py-3 text-left font-semibold uppercase tracking-wider">City</th>
                  <th className="px-3 py-3 text-left font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-left font-semibold uppercase tracking-wider">Section</th>
                  <th className="px-3 py-3 text-right font-semibold uppercase tracking-wider">Taxable Amt (Rs)</th>
                  <th className="px-3 py-3 text-right font-semibold uppercase tracking-wider">Tax Deducted (Rs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#EEF1F8]/30'}>
                    <td className="px-3 py-2.5 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{r.TaxPayer_Name}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-700">
                      {r.TaxPayer_CNIC || <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Missing</span>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-gray-600">{r.TaxPayer_NTN || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{r.TaxPayer_City || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.TaxPayer_Status === 'Filer' ? 'bg-[#EEF1F8] text-[#0A1F54]' : 'bg-amber-100 text-amber-700'}`}>
                        {r.TaxPayer_Status || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-red-600 font-semibold">{r.Payment_Section}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700">{fmt(r.Taxable_Amount)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-red-600">{fmt(r.Tax_Amount)}</td>
                  </tr>
                ))}
                {totals && (
                  <tr className="bg-[#EEF1F8] border-t-2 border-[#0F2D78] font-bold">
                    <td colSpan={7} className="px-3 py-3 text-[#0A1F54]">TOTAL — {totals.totalRecords} Employee(s)</td>
                    <td className="px-3 py-3 text-right font-mono text-gray-900">{fmt(totals.totalTaxableAmount)}</td>
                    <td className="px-3 py-3 text-right font-mono text-red-700">{fmt(totals.totalTaxAmount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {records.length === 0 && !loading && (
        <EmptyState icon={<Landmark className="w-12 h-12" />} title="No FBR report generated" desc="Select a period and click Generate Report" />
      )}
    </div>
  )
}

// ── MAIN EXPORT ───────────────────────────────────────────────

export function PayrollSlips() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0F2D78]" />
            Payroll Documents
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate salary slips, bank disbursement letters, and FBR WHT reports
          </p>
        </div>

        <Tabs defaultValue="slips">
          <TabsList className="mb-5 bg-white border border-gray-200 p-1 rounded-xl shadow-sm">
            <TabsTrigger value="slips" className="flex items-center gap-1.5 text-xs font-medium rounded-lg data-[state=active]:bg-[#0F2D78] data-[state=active]:text-white">
              <FileText className="w-3.5 h-3.5" /> Salary Slips
            </TabsTrigger>
            <TabsTrigger value="bank" className="flex items-center gap-1.5 text-xs font-medium rounded-lg data-[state=active]:bg-[#0F2D78] data-[state=active]:text-white">
              <Building2 className="w-3.5 h-3.5" /> Bank Letter
            </TabsTrigger>
            <TabsTrigger value="fbr" className="flex items-center gap-1.5 text-xs font-medium rounded-lg data-[state=active]:bg-[#0F2D78] data-[state=active]:text-white">
              <Landmark className="w-3.5 h-3.5" /> FBR WHT Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="slips"><SalarySlipsTab /></TabsContent>
          <TabsContent value="bank"><BankLetterTab /></TabsContent>
          <TabsContent value="fbr"><FBRReportTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
