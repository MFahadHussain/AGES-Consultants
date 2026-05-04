'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  BarChart3,
  Building2,
  User,
  Briefcase,
  Receipt,
  ListChecks,
  Search,
  AlertTriangle,
  Landmark,
  Calendar,
  TrendingUp,
  BookOpen,
  Scale,
  ArrowUpDown,
  Download,
  Printer,
  Loader2,
  ChevronLeft,
  FileBarChart,
  Shield,
  Users,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatPKR } from '@/lib/report-utils'

// ============================================================
// Report Type Definitions
// ============================================================

type ReportCategory = 'Summary' | 'Tax' | 'Audit' | 'Operational'

interface ReportTypeDef {
  key: string
  name: string
  description: string
  icon: any
  category: ReportCategory
  needsMonth: boolean
  needsFiscalYear: boolean
  needsEmployee: boolean
  needsDateRange: boolean
}

const CATEGORY_COLORS: Record<ReportCategory, { border: string; bg: string; text: string; badge: string }> = {
  Summary: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  Tax: { border: 'border-l-sky-500', bg: 'bg-sky-50', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-800' },
  Audit: { border: 'border-l-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  Operational: { border: 'border-l-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
}

const REPORT_TYPES: ReportTypeDef[] = [
  // Summary
  { key: 'payroll-summary', name: 'Monthly Payroll Summary', description: 'Overview of payroll batches with totals by period', icon: BarChart3, category: 'Summary', needsMonth: true, needsFiscalYear: false, needsEmployee: false, needsDateRange: false },
  { key: 'project-cost', name: 'Project-wise Cost Report', description: 'Salary and cost allocation by project', icon: Building2, category: 'Summary', needsMonth: true, needsFiscalYear: false, needsEmployee: false, needsDateRange: false },
  { key: 'employee-earnings', name: 'Employee-wise Earnings', description: 'Detailed earnings breakdown per employee over a date range', icon: User, category: 'Summary', needsMonth: false, needsFiscalYear: false, needsEmployee: false, needsDateRange: true },
  { key: 'employer-cost', name: 'Employer Cost Report', description: 'Employer-borne costs: EOBI, PF, ESSI, gratuity', icon: Briefcase, category: 'Summary', needsMonth: true, needsFiscalYear: false, needsEmployee: false, needsDateRange: false },
  // Tax
  { key: 'tax-deduction', name: 'Tax Deduction Report (YTD)', description: 'Income tax deductions with YTD projections', icon: Receipt, category: 'Tax', needsMonth: false, needsFiscalYear: true, needsEmployee: false, needsDateRange: false },
  { key: 'ytd-earnings', name: 'YTD Earnings Report', description: 'Year-to-date earnings aggregation by employee', icon: ListChecks, category: 'Tax', needsMonth: false, needsFiscalYear: true, needsEmployee: false, needsDateRange: false },
  { key: 'tax-reconciliation', name: 'Tax Reconciliation', description: 'Reconcile tax deducted vs expected tax liability', icon: Scale, category: 'Tax', needsMonth: false, needsFiscalYear: true, needsEmployee: false, needsDateRange: false },
  { key: 'tax-psid', name: 'FBR Tax PSID Report', description: 'FBR Payment Slip ID report for Pakistan tax filing', icon: Landmark, category: 'Tax', needsMonth: true, needsFiscalYear: false, needsEmployee: false, needsDateRange: false },
  // Audit & Compliance
  { key: 'payroll-audit', name: 'Payroll Audit Report', description: 'Audit trail with fraud and duplication detection flags', icon: Search, category: 'Audit', needsMonth: true, needsFiscalYear: false, needsEmployee: false, needsDateRange: false },
  { key: 'exception-warnings', name: 'Exception/Warning Report', description: 'Anomalies: missing payroll, zero net pay, high deductions', icon: AlertTriangle, category: 'Audit', needsMonth: true, needsFiscalYear: false, needsEmployee: false, needsDateRange: false },
  { key: 'social-contributions', name: 'Social Contributions Report', description: 'EOBI, PF, ESSI, and gratuity contributions summary', icon: Shield, category: 'Audit', needsMonth: true, needsFiscalYear: true, needsEmployee: false, needsDateRange: false },
  // Operational
  { key: 'attendance-impact', name: 'Attendance Impact Report', description: 'Attendance stats and salary impact analysis', icon: Calendar, category: 'Operational', needsMonth: true, needsFiscalYear: false, needsEmployee: false, needsDateRange: false },
  { key: 'project-utilization', name: 'Project Resource Utilization', description: 'Employee allocation and utilization by project', icon: TrendingUp, category: 'Operational', needsMonth: true, needsFiscalYear: false, needsEmployee: false, needsDateRange: false },
  { key: 'employee-ledger', name: 'Employee Ledger', description: 'Complete payroll history for a single employee', icon: BookOpen, category: 'Operational', needsMonth: false, needsFiscalYear: false, needsEmployee: true, needsDateRange: true },
]

// ============================================================
// Column Definitions for each report type
// ============================================================

interface ColumnDef {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  format?: 'currency' | 'number' | 'percent' | 'date' | 'badge' | 'text'
  badgeColors?: Record<string, string>
}

const REPORT_COLUMNS: Record<string, ColumnDef[]> = {
  'payroll-summary': [
    { key: 'employeeCode', label: 'Emp Code', align: 'center' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'department', label: 'Department' },
    { key: 'basicSalary', label: 'Basic Salary', align: 'right', format: 'currency' },
    { key: 'allowances', label: 'Allowances', align: 'right', format: 'currency' },
    { key: 'grossSalary', label: 'Gross', align: 'right', format: 'currency' },
    { key: 'incomeTax', label: 'Income Tax', align: 'right', format: 'currency' },
    { key: 'totalDeductions', label: 'Total Ded.', align: 'right', format: 'currency' },
    { key: 'netPay', label: 'Net Pay', align: 'right', format: 'currency' },
    { key: 'employerCost', label: 'Employer Cost', align: 'right', format: 'currency' },
    { key: 'lineStatus', label: 'Status', format: 'badge', badgeColors: { draft: 'bg-amber-100 text-amber-800', approved: 'bg-emerald-100 text-emerald-800' } },
  ],
  'project-cost': [
    { key: 'projectCode', label: 'Project Code', align: 'center' },
    { key: 'projectName', label: 'Project Name' },
    { key: 'projectType', label: 'Type', align: 'center' },
    { key: 'employeeCount', label: 'Employees', align: 'center', format: 'number' },
    { key: 'totalSalaryAllocated', label: 'Salary Share', align: 'right', format: 'currency' },
    { key: 'totalSocialChargesAllocated', label: 'SC Share', align: 'right', format: 'currency' },
    { key: 'totalEmployerCharges', label: 'Employer Charges', align: 'right', format: 'currency' },
    { key: 'totalGratuity', label: 'Gratuity', align: 'right', format: 'currency' },
    { key: 'totalProjectBurden', label: 'Total Burden', align: 'right', format: 'currency' },
  ],
  'employee-earnings': [
    { key: 'employeeCode', label: 'Emp Code', align: 'center' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'totalEarnings', label: 'Total Earnings', align: 'right', format: 'currency' },
    { key: 'totalDeductions', label: 'Total Ded.', align: 'right', format: 'currency' },
    { key: 'totalNetPay', label: 'Net Pay', align: 'right', format: 'currency' },
  ],
  'tax-deduction': [
    { key: 'employeeCode', label: 'Emp Code', align: 'center' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'ytdIncome', label: 'YTD Income', align: 'right', format: 'currency' },
    { key: 'projectedAnnual', label: 'Projected Annual', align: 'right', format: 'currency' },
    { key: 'taxPaidYtd', label: 'Tax Paid YTD', align: 'right', format: 'currency' },
    { key: 'taxSlabApplied', label: 'Tax Slab', align: 'center' },
  ],
  'employer-cost': [
    { key: 'employeeCode', label: 'Emp Code', align: 'center' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'grossSalary', label: 'Gross', align: 'right', format: 'currency' },
    { key: 'eobiEmployer', label: 'EOBI (Er)', align: 'right', format: 'currency' },
    { key: 'essiEmployer', label: 'ESSI (Er)', align: 'right', format: 'currency' },
    { key: 'pfEmployer', label: 'PF (Er)', align: 'right', format: 'currency' },
    { key: 'gratuity', label: 'Gratuity', align: 'right', format: 'currency' },
    { key: 'socialCharges', label: 'SC', align: 'right', format: 'currency' },
    { key: 'totalCTC', label: 'CTC', align: 'right', format: 'currency' },
  ],
  'payroll-audit': [
    { key: 'employeeCode', label: 'Emp Code', align: 'center' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'grossSalary', label: 'Gross', align: 'right', format: 'currency' },
    { key: 'incomeTax', label: 'Tax', align: 'right', format: 'currency' },
    { key: 'netPay', label: 'Net Pay', align: 'right', format: 'currency' },
    { key: 'employerCost', label: 'Er. Cost', align: 'right', format: 'currency' },
    { key: 'payableDays', label: 'Pay Days', align: 'center', format: 'number' },
    { key: 'absentDays', label: 'Absent', align: 'center', format: 'number' },
    { key: 'lineStatus', label: 'Line Status', format: 'badge', badgeColors: { draft: 'bg-amber-100 text-amber-800', approved: 'bg-emerald-100 text-emerald-800' } },
  ],
  'ytd-earnings': [
    { key: 'employeeCode', label: 'Emp Code', align: 'center' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'monthsWorked', label: 'Months', align: 'center', format: 'number' },
    { key: 'cumulativeYtdIncome', label: 'YTD Gross', align: 'right', format: 'currency' },
    { key: 'projectedAnnualIncome', label: 'Projected Annual', align: 'right', format: 'currency' },
    { key: 'taxPaidYtd', label: 'Tax Paid YTD', align: 'right', format: 'currency' },
    { key: 'expectedTotalTax', label: 'Expected Tax', align: 'right', format: 'currency' },
    { key: 'remainingTaxLiability', label: 'Remaining Tax', align: 'right', format: 'currency' },
  ],
  'employee-ledger': [
    { key: 'month', label: 'Period', align: 'center' },
    { key: 'basicSalary', label: 'Basic', align: 'right', format: 'currency' },
    { key: 'allowances', label: 'Allowances', align: 'right', format: 'currency' },
    { key: 'grossSalary', label: 'Gross', align: 'right', format: 'currency' },
    { key: 'incomeTax', label: 'Tax', align: 'right', format: 'currency' },
    { key: 'totalDeductions', label: 'Total Ded.', align: 'right', format: 'currency' },
    { key: 'netPay', label: 'Net Pay', align: 'right', format: 'currency' },
    { key: 'payableDays', label: 'Pay Days', align: 'center', format: 'number' },
    { key: 'absentDays', label: 'Absent', align: 'center', format: 'number' },
    { key: 'lineStatus', label: 'Status', format: 'badge', badgeColors: { draft: 'bg-amber-100 text-amber-800', approved: 'bg-emerald-100 text-emerald-800' } },
  ],
  'attendance-impact': [
    { key: 'employeeCode', label: 'Emp Code', align: 'center' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'department', label: 'Department' },
    { key: 'baseSalary', label: 'Base Salary', align: 'right', format: 'currency' },
    { key: 'calendarDays', label: 'Cal. Days', align: 'center', format: 'number' },
    { key: 'presentDays', label: 'Present', align: 'center', format: 'number' },
    { key: 'absentDays', label: 'Absent', align: 'center', format: 'number' },
    { key: 'leaveDays', label: 'Leave', align: 'center', format: 'number' },
    { key: 'dailyRate', label: 'Daily Rate', align: 'right', format: 'currency' },
    { key: 'totalSalaryImpact', label: 'Impact (PKR)', align: 'right', format: 'currency' },
    { key: 'earnedSalary', label: 'Earned Salary', align: 'right', format: 'currency' },
  ],
  'project-utilization': [
    { key: 'projectCode', label: 'Project Code', align: 'center' },
    { key: 'projectName', label: 'Project Name' },
    { key: 'projectType', label: 'Type', align: 'center' },
    { key: 'employeeCount', label: 'Employees', align: 'center', format: 'number' },
    { key: 'totalDaysAllocated', label: 'Days Allocated', align: 'center', format: 'number' },
    { key: 'totalCost', label: 'Total Cost', align: 'right', format: 'currency' },
    { key: 'costPerEmployee', label: 'Cost/Emp', align: 'right', format: 'currency' },
    { key: 'productivityVsCostRatio', label: 'Productivity %', align: 'center', format: 'percent' },
  ],
  'tax-reconciliation': [
    { key: 'employeeCode', label: 'Emp Code', align: 'center' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'ytdIncome', label: 'YTD Income', align: 'right', format: 'currency' },
    { key: 'projectedAnnualIncome', label: 'Projected Annual', align: 'right', format: 'currency' },
    { key: 'expectedTax', label: 'Expected Tax', align: 'right', format: 'currency' },
    { key: 'actualTaxDeducted', label: 'Actual Tax', align: 'right', format: 'currency' },
    { key: 'difference', label: 'Difference', align: 'right', format: 'currency' },
    { key: 'status', label: 'Status', format: 'badge', badgeColors: { matched: 'bg-emerald-100 text-emerald-800', under_deduction: 'bg-amber-100 text-amber-800', over_deduction: 'bg-red-100 text-red-800' } },
  ],
  'social-contributions': [
    { key: 'employeeCode', label: 'Emp Code', align: 'center' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'eobiEmployee', label: 'EOBI (Ee)', align: 'right', format: 'currency' },
    { key: 'eobiEmployer', label: 'EOBI (Er)', align: 'right', format: 'currency' },
    { key: 'pfEmployee', label: 'PF (Ee)', align: 'right', format: 'currency' },
    { key: 'pfEmployer', label: 'PF (Er)', align: 'right', format: 'currency' },
    { key: 'essiEmployee', label: 'ESSI (Ee)', align: 'right', format: 'currency' },
    { key: 'essiEmployer', label: 'ESSI (Er)', align: 'right', format: 'currency' },
    { key: 'gratuity', label: 'Gratuity', align: 'right', format: 'currency' },
    { key: 'socialCharges', label: 'SC', align: 'right', format: 'currency' },
    { key: 'totalSocialBurden', label: 'Total Burden', align: 'right', format: 'currency' },
  ],
  'exception-warnings': [
    { key: 'type', label: 'Type', format: 'badge', badgeColors: { MISSING_PAYROLL: 'bg-red-100 text-red-800', ZERO_NET_PAY: 'bg-red-100 text-red-800', HIGH_DEDUCTIONS: 'bg-amber-100 text-amber-800', DUPLICATE_ENTRY: 'bg-red-100 text-red-800', negative_net_pay: 'bg-red-100 text-red-800', missing_attendance: 'bg-amber-100 text-amber-800', wrong_project_allocation: 'bg-red-100 text-red-800', tax_mismatch: 'bg-amber-100 text-amber-800', duplicate_salary_entry: 'bg-red-100 text-red-800' } },
    { key: 'severity', label: 'Severity', format: 'badge', badgeColors: { high: 'bg-red-100 text-red-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-sky-100 text-sky-800' } },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'message', label: 'Message' },
  ],
  'tax-psid': [
    { key: 'employeeCode', label: 'Emp Code', align: 'center' },
    { key: 'employeeName', label: 'Employee Name' },
    { key: 'cnic', label: 'CNIC', align: 'center' },
    { key: 'grossSalary', label: 'Gross Salary', align: 'right', format: 'currency' },
    { key: 'incomeTax', label: 'Tax Deducted', align: 'right', format: 'currency' },
    { key: 'psidStatus', label: 'PSID Status', format: 'badge', badgeColors: { Generated: 'bg-emerald-100 text-emerald-800', Pending: 'bg-amber-100 text-amber-800' } },
  ],
}

// ============================================================
// Helpers
// ============================================================

function formatCellValue(value: unknown, format?: string): string {
  if (value === null || value === undefined) return '—'
  if (format === 'currency') return formatPKR(value as number)
  if (format === 'number') return (value as number).toLocaleString('en-US')
  if (format === 'percent') return `${value}%`
  if (format === 'date') {
    try { return new Date(value as string).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return String(value) }
  }
  return String(value)
}

function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const FISCAL_YEARS = ['2024-25', '2025-26', '2026-27']

// ============================================================
// Normalize API responses to consistent { data, totals } format
// ============================================================

function normalizeResponse(reportType: string, json: Record<string, unknown>): { data: Record<string, unknown>[]; totals: Record<string, unknown>; meta: Record<string, unknown> } {
  switch (reportType) {
    case 'payroll-summary':
      return {
        data: (json.lines || []) as Record<string, unknown>[],
        totals: (json.summary || {}) as Record<string, unknown>,
        meta: { month: json.month },
      }
    case 'project-cost':
      return {
        data: ((json.projects || []) as Record<string, unknown>[]).map((p: Record<string, unknown>) => ({
          ...p,
          employeeCount: (p.employeeIds as unknown[])?.length || (p.employeeCount as number) || 0,
        })),
        totals: (json.grandTotal || {}) as Record<string, unknown>,
        meta: { month: json.month },
      }
    case 'employee-earnings':
      return {
        data: (json.employees || []) as Record<string, unknown>[],
        totals: {},
        meta: { fromMonth: json.fromMonth, toMonth: json.toMonth },
      }
    case 'tax-deduction':
      return {
        data: (json.employees || []) as Record<string, unknown>[],
        totals: {},
        meta: { fiscalYear: json.fiscalYear },
      }
    case 'employer-cost':
      return {
        data: (json.employees || []) as Record<string, unknown>[],
        totals: (json.totals || {}) as Record<string, unknown>,
        meta: { month: json.month },
      }
    case 'payroll-audit':
      return {
        data: (json.auditLines || []) as Record<string, unknown>[],
        totals: (json.flagSummary || {}) as Record<string, unknown>,
        meta: { month: json.month, flags: json.flags },
      }
    case 'ytd-earnings':
      return {
        data: (json.employees || []) as Record<string, unknown>[],
        totals: {},
        meta: { fiscalYear: json.fiscalYear },
      }
    case 'employee-ledger':
      return {
        data: (json.ledger || []) as Record<string, unknown>[],
        totals: {},
        meta: { employee: json.employee, fromMonth: json.fromMonth, toMonth: json.toMonth },
      }
    case 'attendance-impact':
      return {
        data: (json.report || []) as Record<string, unknown>[],
        totals: (json.totals || {}) as Record<string, unknown>,
        meta: { month: json.month },
      }
    case 'project-utilization':
      return {
        data: (json.projects || []) as Record<string, unknown>[],
        totals: {},
        meta: { month: json.month },
      }
    case 'tax-reconciliation':
      return {
        data: (json.employees || []) as Record<string, unknown>[],
        totals: (json.summary || {}) as Record<string, unknown>,
        meta: { fiscalYear: json.fiscalYear },
      }
    case 'social-contributions': {
      const employees = (json.employees || []) as Record<string, unknown>[]
      const totals = (json.totals || {}) as Record<string, unknown>
      return { data: employees, totals, meta: {} }
    }
    case 'exception-warnings': {
      // Combine flags from payroll-audit and general warnings
      const flags = (json.flags || []) as Record<string, unknown>[]
      const warnings = (json.warnings || []) as Record<string, unknown>[]
      const combined = [...warnings, ...flags]
      return {
        data: combined,
        totals: (json.flagSummary || json.totals || {}) as Record<string, unknown>,
        meta: { month: json.month },
      }
    }
    case 'tax-psid':
      return {
        data: (json.employees || json.lines || []) as Record<string, unknown>[],
        totals: (json.totals || {}) as Record<string, unknown>,
        meta: { month: json.month },
      }
    default:
      return { data: [], totals: {}, meta: {} }
  }
}

// ============================================================
// Main Component
// ============================================================

export function PayrollReports() {
  const { toast } = useToast()
  const [selectedReport, setSelectedReport] = useState<string>('')
  const [reportParams, setReportParams] = useState<Record<string, string>>({
    month: new Date().toISOString().slice(0, 7),
    fiscalYear: '2025-26',
    employeeId: '',
    fromMonth: '',
    toMonth: '',
  })
  const [reportData, setReportData] = useState<Record<string, unknown>[]>([])
  const [reportTotals, setReportTotals] = useState<Record<string, unknown>>({})
  const [reportMeta, setReportMeta] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [employees, setEmployees] = useState<{ id: string; name: string; employeeCode: string }[]>([])
  const [activeTab, setActiveTab] = useState<string>('selector')

  // Fetch employees for employee-ledger and employee-earnings
  useEffect(() => {
    fetch('/api/employees?pageSize=500')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d?.data ?? d?.employees ?? [])
        setEmployees(list.map((e: any) => ({ id: e.id, name: e.name, employeeCode: e.employeeCode || '' })))
      })
      .catch(() => {})
  }, [])

  const currentReportDef = REPORT_TYPES.find(r => r.key === selectedReport)
  const currentColumns = REPORT_COLUMNS[selectedReport] || []

  const fetchReport = useCallback(async (type: string, params: Record<string, string>) => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ type, ...params }).toString()
      const res = await fetch(`/api/payroll/reports?${query}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to fetch report')
      const normalized = normalizeResponse(type, json)
      setReportData(normalized.data)
      setReportTotals(normalized.totals)
      setReportMeta(normalized.meta)
      if (normalized.data.length === 0) {
        toast({ title: 'No Data', description: 'No data found for the selected parameters' })
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setReportData([])
      setReportTotals({})
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleGenerate = () => {
    if (!selectedReport) return
    const params: Record<string, string> = {}
    if (currentReportDef?.needsMonth && reportParams.month) params.month = reportParams.month
    if (currentReportDef?.needsFiscalYear && reportParams.fiscalYear) params.fiscalYear = reportParams.fiscalYear
    if (currentReportDef?.needsEmployee && reportParams.employeeId) params.employeeId = reportParams.employeeId
    if (currentReportDef?.needsDateRange) {
      params.fromMonth = reportParams.fromMonth || reportParams.month
      params.toMonth = reportParams.toMonth || reportParams.month
    }
    fetchReport(selectedReport, params)
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedData = [...reportData].sort((a, b) => {
    if (!sortColumn) return 0
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    const aStr = String(aVal ?? '')
    const bStr = String(bVal ?? '')
    return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
  })

  const handlePrint = () => {
    window.print()
  }

  const handleSelectReport = (key: string) => {
    setSelectedReport(key)
    setReportData([])
    setReportTotals({})
    setError(null)
    setActiveTab('params')
  }

  const renderCellValue = (value: unknown, col: ColumnDef) => {
    if (col.format === 'badge' && col.badgeColors && value) {
      const colorClass = col.badgeColors[String(value)] || 'bg-muted text-muted-foreground'
      return (
        <Badge className={`text-[10px] border ${colorClass}`}>
          {String(value).replace(/_/g, ' ')}
        </Badge>
      )
    }
    return <span>{formatCellValue(value, col.format)}</span>
  }

  // Group reports by category
  const groupedReports = REPORT_TYPES.reduce<Record<ReportCategory, ReportTypeDef[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category].push(r)
    return acc
  }, {} as Record<ReportCategory, ReportTypeDef[]>)

  // Compute the totals row for the current data
  const computedTotals: Record<string, unknown> = {}
  if (reportData.length > 0) {
    for (const col of currentColumns) {
      if (col.format === 'currency' || col.format === 'number') {
        computedTotals[col.key] = reportData.reduce((sum, row) => sum + ((row[col.key] as number) || 0), 0)
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            Payroll Reports
          </h2>
          <p className="text-xs text-muted-foreground">Generate and export payroll reports for analysis, compliance, and audit</p>
        </div>
        {selectedReport && reportData.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCSV(reportData, `payroll-report-${selectedReport}-${Date.now()}`)}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print
            </Button>
          </div>
        )}
      </div>

      {/* Print Header */}
      <div className="hidden print:block print:mb-4">
        <div className="text-center border-b pb-3 mb-3">
          <h1 className="text-xl font-bold">AcctFin ERP</h1>
          <h2 className="text-sm font-semibold mt-1">{currentReportDef?.name || 'Payroll Report'}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Generated: {new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
            {reportParams.month && ` | Period: ${reportParams.month}`}
            {reportParams.fiscalYear && ` | FY: ${reportParams.fiscalYear}`}
            {(reportMeta as any)?.employee && ` | Employee: ${(reportMeta as any).employee.name}`}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="print:hidden">
          <TabsTrigger value="selector">Report Types</TabsTrigger>
          <TabsTrigger value="params" disabled={!selectedReport}>Parameters</TabsTrigger>
          <TabsTrigger value="results" disabled={!reportData.length && !loading}>Results</TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* TAB 1: Report Type Selector */}
        {/* ============================================ */}
        <TabsContent value="selector" className="print:hidden">
          <div className="space-y-6">
            {(Object.entries(groupedReports) as [ReportCategory, ReportTypeDef[]][]).map(([category, reports]) => {
              const catColors = CATEGORY_COLORS[category]
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={`text-xs ${catColors.badge}`}>{category}</Badge>
                    <Separator className="flex-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {reports.map(report => {
                      const Icon = report.icon
                      const isSelected = selectedReport === report.key
                      return (
                        <Card
                          key={report.key}
                          className={`cursor-pointer transition-all hover:shadow-md border-l-4 ${catColors.border} ${isSelected ? 'ring-2 ring-primary shadow-md' : 'hover:border-l-4'}`}
                          onClick={() => handleSelectReport(report.key)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${catColors.bg}`}>
                                <Icon className={`h-5 w-5 ${catColors.text}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold truncate">{report.name}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{report.description}</p>
                              </div>
                              {isSelected && (
                                <div className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                  <span className="text-[10px] font-bold">✓</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB 2: Report Parameters */}
        {/* ============================================ */}
        <TabsContent value="params" className="print:hidden">
          {currentReportDef && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('selector')} className="mr-1">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className={`p-1.5 rounded-lg ${CATEGORY_COLORS[currentReportDef.category].bg}`}>
                    <currentReportDef.icon className={`h-4 w-4 ${CATEGORY_COLORS[currentReportDef.category].text}`} />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{currentReportDef.name}</CardTitle>
                    <CardDescription className="text-xs">{currentReportDef.description}</CardDescription>
                  </div>
                  <Badge className={`ml-auto text-[10px] ${CATEGORY_COLORS[currentReportDef.category].badge}`}>
                    {currentReportDef.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Month Selector */}
                  {currentReportDef.needsMonth && (
                    <div>
                      <Label className="text-xs font-medium">Month / Period</Label>
                      <Input
                        type="month"
                        className="h-9 text-xs"
                        value={reportParams.month}
                        onChange={e => setReportParams(p => ({ ...p, month: e.target.value }))}
                      />
                    </div>
                  )}

                  {/* Fiscal Year Selector */}
                  {currentReportDef.needsFiscalYear && (
                    <div>
                      <Label className="text-xs font-medium">Fiscal Year</Label>
                      <Select
                        value={reportParams.fiscalYear}
                        onValueChange={v => setReportParams(p => ({ ...p, fiscalYear: v }))}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FISCAL_YEARS.map(fy => (
                            <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Employee Selector */}
                  {currentReportDef.needsEmployee && (
                    <div>
                      <Label className="text-xs font-medium">Employee</Label>
                      <Select
                        value={reportParams.employeeId}
                        onValueChange={v => setReportParams(p => ({ ...p, employeeId: v }))}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.employeeCode} — {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Date Range (fromMonth / toMonth) */}
                  {currentReportDef.needsDateRange && (
                    <>
                      <div>
                        <Label className="text-xs font-medium">From Month</Label>
                        <Input
                          type="month"
                          className="h-9 text-xs"
                          value={reportParams.fromMonth}
                          onChange={e => setReportParams(p => ({ ...p, fromMonth: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium">To Month</Label>
                        <Input
                          type="month"
                          className="h-9 text-xs"
                          value={reportParams.toMonth}
                          onChange={e => setReportParams(p => ({ ...p, toMonth: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex items-center gap-3">
                  <Button onClick={handleGenerate} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileBarChart className="h-4 w-4 mr-2" />
                        Generate Report
                      </>
                    )}
                  </Button>
                  {reportData.length > 0 && (
                    <Button variant="outline" onClick={() => setActiveTab('results')}>
                      View Results ({reportData.length} rows)
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* TAB 3: Report Results */}
        {/* ============================================ */}
        <TabsContent value="results">
          {error && (
            <Card className="border-red-200 bg-red-50 mb-4 print:hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {loading && (
            <div className="flex items-center justify-center py-20 print:hidden">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating report...</p>
              </div>
            </div>
          )}

          {!loading && reportData.length > 0 && (
            <Card>
              <CardHeader className="pb-3 print:hidden">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('params')}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    {currentReportDef && (
                      <>
                        <div className={`p-1.5 rounded-lg ${CATEGORY_COLORS[currentReportDef.category].bg}`}>
                          <currentReportDef.icon className={`h-4 w-4 ${CATEGORY_COLORS[currentReportDef.category].text}`} />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{currentReportDef.name}</CardTitle>
                          <CardDescription className="text-[10px]">
                            {reportData.length} rows
                            {reportParams.month && ` | ${reportParams.month}`}
                            {reportParams.fiscalYear && ` | FY ${reportParams.fiscalYear}`}
                          </CardDescription>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportCSV(reportData, `payroll-${selectedReport}-${Date.now()}`)}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint}>
                      <Printer className="h-3.5 w-3.5 mr-1.5" />
                      Print
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[65vh]">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-800 hover:bg-slate-800">
                          <TableHead className="text-[10px] font-semibold text-white w-8 text-center">#</TableHead>
                          {currentColumns.map(col => (
                            <TableHead
                              key={col.key}
                              className={`text-[10px] font-semibold text-white cursor-pointer select-none hover:bg-slate-700 transition-colors ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                              onClick={() => handleSort(col.key)}
                            >
                              <span className="inline-flex items-center gap-1">
                                {col.label}
                                {sortColumn === col.key && (
                                  <ArrowUpDown className={`h-3 w-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                                )}
                              </span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData.map((row, idx) => (
                          <TableRow
                            key={idx}
                            className={idx % 2 === 1 ? 'bg-muted/30' : ''}
                          >
                            <TableCell className="text-[10px] text-muted-foreground text-center">{idx + 1}</TableCell>
                            {currentColumns.map(col => (
                              <TableCell
                                key={col.key}
                                className={`text-xs ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                              >
                                {renderCellValue(row[col.key], col)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                        {/* Totals Row */}
                        {Object.keys(computedTotals).length > 0 && (
                          <TableRow className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                            <TableCell className="text-[10px] text-center font-bold">Σ</TableCell>
                            {currentColumns.map(col => (
                              <TableCell
                                key={`total-${col.key}`}
                                className={`text-xs font-bold ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                              >
                                {computedTotals[col.key] !== undefined && computedTotals[col.key] !== null
                                  ? formatCellValue(computedTotals[col.key], col.format)
                                  : ''}
                              </TableCell>
                            ))}
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>

                {/* Summary Footer */}
                {Object.keys(computedTotals).length > 0 && selectedReport !== 'payroll-audit' && selectedReport !== 'exception-warnings' && (
                  <div className="border-t p-4 print:hidden">
                    <div className="flex items-center gap-4 flex-wrap text-xs">
                      <span className="text-muted-foreground">Summary:</span>
                      {currentColumns
                        .filter(col => (col.format === 'currency' || col.format === 'number') && computedTotals[col.key])
                        .slice(0, 5)
                        .map(col => (
                          <span key={col.key} className="flex items-center gap-1">
                            <span className="text-muted-foreground">{col.label}:</span>
                            <span className="font-semibold">{formatCellValue(computedTotals[col.key], col.format)}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!loading && !error && reportData.length === 0 && selectedReport && activeTab === 'results' && (
            <Card className="print:hidden">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <FileBarChart className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No data found for this report</p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting the parameters or generate the report first</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab('params')}>
                  Adjust Parameters
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
