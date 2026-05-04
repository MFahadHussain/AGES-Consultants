'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Printer, FileText, Building2, User, Calendar, Download,
  Loader2, ChevronDown, ChevronUp
} from 'lucide-react'

// ── TYPES ───────────────────────────────────────────────────────────────

interface EmployeeInfo {
  id: string; name: string; employeeCode: string; designation: string | null
  department: string | null; cnic: string; ntn: string | null
  joiningDate: string | null; employmentType: string | null
  bankName: string | null; bankAccountNumber: string | null
  baseSalary: number; taxFilingStatus: string | null; taxCity: string | null
}

interface PayrollLine {
  id: string; employeeId: string; employeeName: string; employeeCode: string | null
  basicSalary: number; dailyRate: number; workingDays: number; eligibleDays: number
  leaveDays: number; absentDays: number; calendarDays: number; payableDays: number
  allowances: number; grossSalary: number
  incomeTax: number; eobiEmployee: number; eobiEmployer: number
  pfEmployee: number; pfEmployer: number; essiEmployee: number; essiEmployer: number
  loanDeduction: number; advanceDeduction: number; otherDeductions: number; totalDeductions: number
  netPay: number; socialCharges: number; gratuity: number
  allowanceDetails: string | null; taxBreakdown: string | null; projectAllocations: string | null
  lineStatus: string
}

interface BatchInfo {
  id: string; batchNumber: string; name: string; period: string; status: string
  lines: PayrollLine[]
}

// ── HELPERS ───────────────────────────────────────────────────────────────

function fmtPKR(n: number): string {
  if (n === 0) return '—'
  return 'PKR ' + Math.round(n).toLocaleString('en-PK')
}

function fmtPKRNum(n: number): string {
  return Math.round(n).toLocaleString('en-PK')
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtMonth(ms: string): string {
  const [y, m] = ms.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

/** Convert number to words (PKR format with Lakh/Crore) */
function numberToWordsPKR(num: number): string {
  if (num === 0) return 'Zero'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convert(n: number): string {
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '')
  }

  const rupees = Math.floor(num)
  const paisa = Math.round((num - rupees) * 100)
  let result = 'Rupees ' + convert(rupees)
  if (paisa > 0) result += ' and ' + convert(paisa) + ' Paisa'
  result += ' Only'
  return result
}

function parseJSON<T>(str: string | null, fallback: T): T {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}

function maskAccount(acc: string | null): string {
  if (!acc) return '—'
  if (acc.length <= 4) return acc
  return '****' + acc.slice(-4)
}

// ── COMPONENT ────────────────────────────────────────────────────────────

export function PayrollSlips() {
  const [batches, setBatches] = useState<BatchInfo[]>([])
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState<'slip' | 'letter'>('slip')
  const [showPreview, setShowPreview] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  // ── Fetch data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [batchRes, empRes] = await Promise.all([
          fetch('/api/payroll'),
          fetch('/api/employees?pageSize=200'),
        ])
        if (batchRes.ok) {
          const batchData = await batchRes.json()
          setBatches(Array.isArray(batchData) ? batchData : [])
        }
        if (empRes.ok) {
          const empData = await empRes.json()
          const rawEmps = empData.data || empData.employees || empData || []
          setEmployees(rawEmps.map((e: Record<string, unknown>) => ({
            id: e.id as string,
            name: e.name as string,
            employeeCode: (e.employeeCode as string) || '',
            designation: (e.designation as string) || null,
            department: (e.department as string) || null,
            cnic: (e.cnic as string) || '',
            ntn: (e.ntn as string) || null,
            joiningDate: e.joiningDate ? new Date(e.joiningDate as string).toISOString() : null,
            employmentType: (e.employmentType as string) || null,
            bankName: (e.bankName as string) || null,
            bankAccountNumber: (e.bankAccountNumber as string) || null,
            baseSalary: (e.baseSalary as number) || 0,
            taxFilingStatus: (e.taxFilingStatus as string) || null,
            taxCity: (e.taxCity as string) || null,
          })))
        }
      } catch (err) {
        console.error('Failed to fetch data:', err)
        toast.error('Failed to load payroll data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ── Derived ─────────────────────────────────────────────────────────────
  const approvedBatches = useMemo(() =>
    batches.filter(b => b.status === 'approved' || b.status === 'posted'),
    [batches]
  )

  const selectedBatch = useMemo(() =>
    batches.find(b => b.id === selectedBatchId),
    [batches, selectedBatchId]
  )

  const filteredLines = useMemo(() => {
    if (!selectedBatch) return []
    if (selectedEmployeeId === 'all') return selectedBatch.lines
    return selectedBatch.lines.filter(l => l.employeeId === selectedEmployeeId)
  }, [selectedBatch, selectedEmployeeId])

  const batchEmployees = useMemo(() => {
    if (!selectedBatch) return []
    return selectedBatch.lines.map(l => ({
      id: l.employeeId,
      name: l.employeeName,
      code: l.employeeCode || '',
    }))
  }, [selectedBatch])

  // ── Print Handler ───────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      toast.error('Please allow popups to print')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${docType === 'slip' ? 'Salary Slip' : 'Bank Disbursement Letter'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 20px; }
          .slip-container { max-width: 800px; margin: 0 auto; border: 2px solid #1e293b; padding: 24px; }
          .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
          .header h1 { font-size: 18px; font-weight: 700; letter-spacing: 2px; }
          .header h2 { font-size: 14px; font-weight: 600; color: #475569; margin-top: 4px; }
          .header .month { font-size: 12px; color: #64748b; margin-top: 4px; }
          .section { margin-bottom: 16px; }
          .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
            background: #f1f5f9; padding: 6px 10px; border-left: 3px solid #1e293b; margin-bottom: 8px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
          .info-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #e2e8f0; }
          .info-label { color: #64748b; font-size: 10px; min-width: 120px; }
          .info-value { font-weight: 600; font-size: 10px; text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #1e293b; color: white; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 600; }
          td { padding: 5px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
          tr:nth-child(even) { background: #f8fafc; }
          .amount { text-align: right; font-family: 'Courier New', monospace; }
          .total-row { background: #f1f5f9 !important; font-weight: 700; border-top: 2px solid #1e293b; }
          .net-pay { font-size: 14px; font-weight: 700; text-align: center; padding: 10px;
            background: #ecfdf5; border: 2px solid #10b981; border-radius: 4px; margin: 12px 0; }
          .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
          .footer p { font-size: 9px; color: #94a3b8; text-align: center; }
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; }
          .signature-line { border-top: 1px solid #1e293b; padding-top: 6px; font-size: 10px; text-align: center; }
          .letter-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .letter-date { text-align: right; font-size: 11px; }
          .letter-subject { font-weight: 700; font-size: 12px; margin: 16px 0 12px; }
          .letter-body { font-size: 11px; line-height: 1.6; margin-bottom: 16px; }
          .amount-words { font-size: 10px; color: #475569; font-style: italic; margin-top: 8px; }
          @media print { body { padding: 0; } .slip-container { border: none; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `)

    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }, [docType])

  // ── Render: Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  // ── Render: No Data ────────────────────────────────────────────────────
  if (approvedBatches.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Printer className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">No Approved Batches</h3>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Approve a payroll batch first to generate salary slips and bank letters.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Render: Controls ───────────────────────────────────────────────────
  const renderControls = () => (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Payroll Slips & Letters Generator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Batch Selector */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Payroll Batch</label>
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select batch..." />
              </SelectTrigger>
              <SelectContent>
                {approvedBatches.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.batchNumber} — {fmtMonth(b.period)} ({b.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee Selector */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Employee</label>
            <Select
              value={selectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
              disabled={!selectedBatchId}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {batchEmployees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.code} — {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Document Type */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Document Type</label>
            <Select value={docType} onValueChange={(v) => setDocType(v as 'slip' | 'letter')}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slip">Salary Slip</SelectItem>
                <SelectItem value="letter">Bank Disbursement Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <div className="flex items-end gap-2">
            <Button
              className="flex-1 h-9 text-xs bg-slate-900 text-white hover:bg-slate-800"
              disabled={!selectedBatchId || !selectedEmployeeId}
              onClick={() => setShowPreview(true)}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Generate
            </Button>
            {showPreview && filteredLines.length > 0 && (
              <Button
                variant="outline"
                className="h-9 text-xs"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Print
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // ── Render: Salary Slip ────────────────────────────────────────────────
  const renderSalarySlip = (line: PayrollLine) => {
    const emp = employees.find(e => e.id === line.employeeId)
    const allowances = parseJSON<Array<{name: string; amount: number}>>(line.allowanceDetails, [])
    const taxInfo = parseJSON<Record<string, number>>(line.taxBreakdown, {})
    const projectAllocs = parseJSON<Array<{projectName: string; projectCode: string; days: number; weightPct: string; salaryShare: number; scShare: number}>>(line.projectAllocations, [])

    return (
      <div key={line.id} className="slip-container" style={{
        maxWidth: 800, margin: '0 auto 24px', border: '2px solid #1e293b', padding: 24,
        fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 11, color: '#1e293b'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1e293b', paddingBottom: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>AcctFin ERP</h1>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginTop: 4 }}>SALARY SLIP</h2>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {selectedBatch ? fmtMonth(selectedBatch.period) : ''} — {line.employeeCode || line.employeeId}
          </div>
        </div>

        {/* Employee Details */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
            background: '#f1f5f9', padding: '6px 10px', borderLeft: '3px solid #1e293b', marginBottom: 8 }}>
            Employee Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
            {[
              ['Name', emp?.name || line.employeeName],
              ['Employee Code', line.employeeCode || '—'],
              ['Designation', emp?.designation || '—'],
              ['Department', emp?.department || '—'],
              ['CNIC', emp?.cnic || '—'],
              ['NTN', emp?.ntn || '—'],
              ['Joining Date', fmtDate(emp?.joiningDate || null)],
              ['Employment Type', emp?.employmentType || '—'],
              ['Bank', emp?.bankName || '—'],
              ['Account', maskAccount(emp?.bankAccountNumber || null)],
              ['Tax Filing', emp?.taxFilingStatus === 'filer' ? 'Filer' : emp?.taxFilingStatus === 'non-filer' ? 'Non-Filer' : '—'],
              ['Tax City', emp?.taxCity || '—'],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dotted #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: 10, minWidth: 120 }}>{label}</span>
                <span style={{ fontWeight: 600, fontSize: 10, textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Summary */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
            background: '#f1f5f9', padding: '6px 10px', borderLeft: '3px solid #1e293b', marginBottom: 8 }}>
            Attendance Summary
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 24px' }}>
            {[
              ['Calendar Days', String(line.calendarDays || '—')],
              ['Present Days', String(line.eligibleDays - line.leaveDays)],
              ['Leave Days', String(line.leaveDays)],
              ['Absent Days', String(line.absentDays)],
              ['Payable Days', String(line.payableDays || line.eligibleDays)],
              ['Daily Rate', fmtPKR(line.dailyRate)],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dotted #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: 10 }}>{label}</span>
                <span style={{ fontWeight: 600, fontSize: 10 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Earnings */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
            background: '#f1f5f9', padding: '6px 10px', borderLeft: '3px solid #1e293b', marginBottom: 8 }}>
            Earnings
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ background: '#1e293b', color: 'white', padding: '6px 10px', textAlign: 'left', fontSize: 10 }}>Component</th>
                <th style={{ background: '#1e293b', color: 'white', padding: '6px 10px', textAlign: 'right', fontSize: 10 }}>Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '5px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 10 }}>Basic Salary</td><td style={{ padding: '5px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 10 }}>{fmtPKRNum(line.basicSalary)}</td></tr>
              {allowances.map((a, i) => (
                <tr key={i}><td style={{ padding: '5px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 10 }}>{a.name}</td><td style={{ padding: '5px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 10 }}>{fmtPKRNum(a.amount)}</td></tr>
              ))}
              <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                <td style={{ padding: '6px 10px', borderTop: '2px solid #1e293b', fontSize: 10 }}>Gross Salary</td>
                <td style={{ padding: '6px 10px', borderTop: '2px solid #1e293b', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 10 }}>{fmtPKRNum(line.grossSalary)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Deductions */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
            background: '#f1f5f9', padding: '6px 10px', borderLeft: '3px solid #1e293b', marginBottom: 8 }}>
            Deductions
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ background: '#1e293b', color: 'white', padding: '6px 10px', textAlign: 'left', fontSize: 10 }}>Component</th>
                <th style={{ background: '#1e293b', color: 'white', padding: '6px 10px', textAlign: 'right', fontSize: 10 }}>Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Income Tax', line.incomeTax],
                ['EOBI (Employee)', line.eobiEmployee],
                ['ESSI (Employee)', line.essiEmployee],
                ['Provident Fund (Employee)', line.pfEmployee],
                ['Loan Deduction', line.loanDeduction],
                ['Advance Deduction', line.advanceDeduction],
                ['Other Deductions', line.otherDeductions],
              ].filter(([, amt]) => amt > 0).map(([label, amt]) => (
                <tr key={String(label)}><td style={{ padding: '5px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 10 }}>{label}</td><td style={{ padding: '5px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 10 }}>{fmtPKRNum(amt)}</td></tr>
              ))}
              <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                <td style={{ padding: '6px 10px', borderTop: '2px solid #1e293b', fontSize: 10 }}>Total Deductions</td>
                <td style={{ padding: '6px 10px', borderTop: '2px solid #1e293b', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 10 }}>{fmtPKRNum(line.totalDeductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net Pay */}
        <div style={{ fontSize: 14, fontWeight: 700, textAlign: 'center', padding: 10,
          background: '#ecfdf5', border: '2px solid #10b981', borderRadius: 4, margin: '12px 0' }}>
          NET PAY: PKR {fmtPKRNum(line.netPay)}
        </div>

        {/* Project Allocation */}
        {projectAllocs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
              background: '#f1f5f9', padding: '6px 10px', borderLeft: '3px solid #1e293b', marginBottom: 8 }}>
              Project Allocation Breakdown
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'left', fontSize: 9 }}>Project</th>
                  <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'center', fontSize: 9 }}>Days</th>
                  <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'center', fontSize: 9 }}>Weight</th>
                  <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'right', fontSize: 9 }}>Salary Share</th>
                  <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'right', fontSize: 9 }}>SC Share</th>
                </tr>
              </thead>
              <tbody>
                {projectAllocs.map((pa, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 9 }}>{pa.projectName || pa.projectCode}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontSize: 9 }}>{pa.days}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontSize: 9 }}>{pa.weightPct}%</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 9 }}>{fmtPKRNum(pa.salaryShare)}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 9 }}>{fmtPKRNum(pa.scShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Employer Cost */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
            background: '#f1f5f9', padding: '6px 10px', borderLeft: '3px solid #1e293b', marginBottom: 8 }}>
            Employer Cost
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ background: '#1e293b', color: 'white', padding: '6px 10px', textAlign: 'left', fontSize: 10 }}>Component</th>
                <th style={{ background: '#1e293b', color: 'white', padding: '6px 10px', textAlign: 'right', fontSize: 10 }}>Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['EOBI (Employer)', line.eobiEmployer],
                ['ESSI (Employer)', line.essiEmployer],
                ['Provident Fund (Employer)', line.pfEmployer],
                ['Gratuity Provision', line.gratuity],
                ['Social Charges', line.socialCharges],
              ].filter(([, amt]) => amt > 0).map(([label, amt]) => (
                <tr key={String(label)}><td style={{ padding: '5px 10px', borderBottom: '1px solid #e2e8f0', fontSize: 10 }}>{label}</td><td style={{ padding: '5px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 10 }}>{fmtPKRNum(amt)}</td></tr>
              ))}
              <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                <td style={{ padding: '6px 10px', borderTop: '2px solid #1e293b', fontSize: 10 }}>Total Employer Cost</td>
                <td style={{ padding: '6px 10px', borderTop: '2px solid #1e293b', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 10 }}>{fmtPKRNum(line.eobiEmployer + line.essiEmployer + line.pfEmployer + line.gratuity + line.socialCharges)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* YTD Tax Info */}
        {taxInfo.ytdIncome && (
          <div style={{ marginBottom: 16, padding: 10, background: '#fffbeb', borderRadius: 4, border: '1px solid #fbbf24' }}>
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, color: '#92400e' }}>YTD Tax Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 9 }}>
              <div>YTD Income: <strong>{fmtPKR(taxInfo.ytdIncome || 0)}</strong></div>
              <div>Projected Annual: <strong>{fmtPKR(taxInfo.projectedAnnualIncome || 0)}</strong></div>
              <div>Tax Paid YTD: <strong>{fmtPKR(taxInfo.taxPaidYtd || 0)}</strong></div>
              <div>Months Worked: <strong>{taxInfo.monthsWorkedYtd || 0}</strong></div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>
            This is a system-generated document from AcctFin ERP v1.0.0 • Generated on {new Date().toLocaleDateString('en-PK')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 30 }}>
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: 6, fontSize: 10, textAlign: 'center' }}>Employee Signature</div>
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: 6, fontSize: 10, textAlign: 'center' }}>Authorized Signatory</div>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Bank Disbursement Letter ───────────────────────────────────
  const renderBankLetter = () => {
    if (!selectedBatch || filteredLines.length === 0) return null
    const totalNet = filteredLines.reduce((s, l) => s + l.netPay, 0)

    return (
      <div className="slip-container" style={{
        maxWidth: 800, margin: '0 auto', border: '2px solid #1e293b', padding: 24,
        fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 11, color: '#1e293b'
      }}>
        {/* Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>AcctFin ERP</h1>
            <p style={{ fontSize: 10, color: '#64748b' }}>Accounts & Finance Department</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11 }}>
            <div>Date: {new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div style={{ marginTop: 4 }}>Ref: PAY-{selectedBatch.period}</div>
          </div>
        </div>

        <Separator style={{ marginBottom: 16 }} />

        {/* Bank Info */}
        {filteredLines[0] && (() => {
          const firstEmp = employees.find(e => e.id === filteredLines[0].employeeId)
          return (
            <div style={{ marginBottom: 12 }}>
              <div>To: <strong>{firstEmp?.bankName || 'The Bank Manager'}</strong></div>
            </div>
          )
        })()}

        {/* Subject */}
        <div style={{ fontWeight: 700, fontSize: 12, margin: '16px 0 12px' }}>
          Subject: Salary Disbursement for {selectedBatch ? fmtMonth(selectedBatch.period) : ''}
        </div>

        {/* Body */}
        <div style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 16 }}>
          <p>Dear Sir/Madam,</p>
          <p style={{ marginTop: 8 }}>
            Please credit the following employees' salary for the month of{' '}
            {selectedBatch ? fmtMonth(selectedBatch.period) : ''} to their respective bank accounts as per the details below:
          </p>
        </div>

        {/* Employee Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'left', fontSize: 9 }}>#</th>
              <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'left', fontSize: 9 }}>Employee Name</th>
              <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'left', fontSize: 9 }}>Designation</th>
              <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'left', fontSize: 9 }}>Bank Account</th>
              <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'right', fontSize: 9 }}>Net Salary (PKR)</th>
              <th style={{ background: '#1e293b', color: 'white', padding: '6px 8px', textAlign: 'left', fontSize: 9 }}>Payment Ref</th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.map((line, i) => {
              const emp = employees.find(e => e.id === line.employeeId)
              return (
                <tr key={line.id} style={{ background: i % 2 === 0 ? 'transparent' : '#f8fafc' }}>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 9 }}>{i + 1}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 9 }}>{line.employeeName}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 9 }}>{emp?.designation || '—'}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 9, fontFamily: "'Courier New', monospace" }}>{maskAccount(emp?.bankAccountNumber || null)}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 9 }}>{fmtPKRNum(line.netPay)}</td>
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 9 }}>{selectedBatch?.batchNumber}-{line.employeeCode || line.id.slice(-4)}</td>
                </tr>
              )
            })}
            <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: '6px 8px', borderTop: '2px solid #1e293b', fontSize: 9, textAlign: 'right' }}>Total</td>
              <td style={{ padding: '6px 8px', borderTop: '2px solid #1e293b', textAlign: 'right', fontFamily: "'Courier New', monospace", fontSize: 9 }}>{fmtPKRNum(totalNet)}</td>
              <td style={{ padding: '6px 8px', borderTop: '2px solid #1e293b' }}></td>
            </tr>
          </tbody>
        </table>

        {/* Amount in Words */}
        <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic', marginTop: 8 }}>
          Amount in Words: {numberToWordsPKR(totalNet)}
        </div>

        {/* Closing */}
        <div style={{ marginTop: 24, fontSize: 11, lineHeight: 1.6 }}>
          <p>Please process the above payments at your earliest convenience.</p>
          <p style={{ marginTop: 8 }}>Thank you for your continued support.</p>
        </div>

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 40 }}>
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 6, fontSize: 10, textAlign: 'center' }}>Prepared By</div>
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 6, fontSize: 10, textAlign: 'center' }}>Authorized Signatory</div>
        </div>
      </div>
    )
  }

  // ── Main Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {renderControls()}

      {showPreview && selectedBatch && filteredLines.length > 0 && (
        <div ref={printRef}>
          {docType === 'slip' ? (
            filteredLines.map(line => renderSalarySlip(line))
          ) : (
            renderBankLetter()
          )}
        </div>
      )}

      {showPreview && filteredLines.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No payroll lines found for the selected employee/batch combination.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
