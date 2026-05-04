'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Eye, ChevronDown, ChevronRight, Calendar, MapPin, Landmark, Phone, Mail,
  Briefcase, Edit3, FileText, Upload, Plus, Loader2, Info,
  DollarSign, CreditCard, TrendingDown, AlertCircle, CheckCircle2,
  Clock, Building2, FolderOpen, File, FileImage
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPKR(amount: number): string {
  return 'PKR ' + amount.toLocaleString('en-PK')
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMonthYear(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const employee = {
  id: 'EMP-0001',
  name: 'Ahmed Khan',
  designation: 'Senior Accountant',
  department: 'Finance',
  joinDate: '2021-03-15',
  location: 'Peshawar HQ',
  bank: '****4521',
  phone: '+92-301-1234567',
  email: 'ahmed.khan@acctfin.com',
  contractType: 'Permanent',
  monthlySalary: 85000,
  workingDays: 26,
  scRate: 0.15,
  status: 'Active',
}

const salaryHistory = [
  { month: '2025-12', workingDays: 26, present: 24, absent: 2, earnedSalary: 78462, deductions: 8500, netPaid: 69962, status: 'Paid' as const, earnings: { basic: 65000, housing: 10000, transport: 5000, other: 0 }, deductionBreakdown: { absentDeduction: 6538, tax: 1200, loanEmi: 5556, scEmployee: 0 } },
  { month: '2026-01', workingDays: 26, present: 26, absent: 0, earnedSalary: 85000, deductions: 6756, netPaid: 78244, status: 'Paid' as const, earnings: { basic: 65000, housing: 10000, transport: 5000, other: 5000 }, deductionBreakdown: { absentDeduction: 0, tax: 1200, loanEmi: 5556, scEmployee: 0 } },
  { month: '2026-02', workingDays: 24, present: 23, absent: 1, earnedSalary: 81458, deductions: 7256, netPaid: 74202, status: 'Paid' as const, earnings: { basic: 65000, housing: 10000, transport: 5000, other: 1458 }, deductionBreakdown: { absentDeduction: 3542, tax: 1200, loanEmi: 5556, scEmployee: 0 } },
  { month: '2026-03', workingDays: 26, present: 25, absent: 1, earnedSalary: 81731, deductions: 6756, netPaid: 74975, status: 'Paid' as const, earnings: { basic: 65000, housing: 10000, transport: 5000, other: 1731 }, deductionBreakdown: { absentDeduction: 3269, tax: 1200, loanEmi: 5556, scEmployee: 0 } },
  { month: '2026-04', workingDays: 26, present: 26, absent: 0, earnedSalary: 85000, deductions: 6756, netPaid: 78244, status: 'Pending' as const, earnings: { basic: 65000, housing: 10000, transport: 5000, other: 5000 }, deductionBreakdown: { absentDeduction: 0, tax: 1200, loanEmi: 5556, scEmployee: 0 } },
  { month: '2026-05', workingDays: 26, present: 24, absent: 2, earnedSalary: 78462, deductions: 7956, netPaid: 70506, status: 'Draft' as const, earnings: { basic: 65000, housing: 10000, transport: 5000, other: 0 }, deductionBreakdown: { absentDeduction: 6538, tax: 1200, loanEmi: 5556, scEmployee: 0 } },
]

const scLedger = [
  { month: '2025-12', grossSalary: 78462, scRate: 0.15, scAmount: 11769, cumulativeBalance: 11769, paymentStatus: 'Remitted' as const, paidOn: '2026-01-15' },
  { month: '2026-01', grossSalary: 85000, scRate: 0.15, scAmount: 12750, cumulativeBalance: 24519, paymentStatus: 'Remitted' as const, paidOn: '2026-02-15' },
  { month: '2026-02', grossSalary: 81458, scRate: 0.15, scAmount: 12219, cumulativeBalance: 36738, paymentStatus: 'Remitted' as const, paidOn: '2026-03-15' },
  { month: '2026-03', grossSalary: 81731, scRate: 0.15, scAmount: 12260, cumulativeBalance: 48998, paymentStatus: 'Partial' as const, paidOn: '2026-04-10' },
  { month: '2026-04', grossSalary: 85000, scRate: 0.15, scAmount: 12750, cumulativeBalance: 61748, paymentStatus: 'Pending' as const, paidOn: null },
  { month: '2026-05', grossSalary: 78462, scRate: 0.15, scAmount: 11769, cumulativeBalance: 73517, paymentStatus: 'Pending' as const, paidOn: null },
]

const activeLoans = [
  {
    id: 'LN-001',
    loanType: 'Personal',
    principal: 100000,
    disbursedDate: '2025-07-01',
    emiPerMonth: 5556,
    totalPaid: 55560,
    remainingBalance: 44440,
    monthsLeft: 8,
    totalMonths: 18,
    status: 'Active' as const,
    repaymentSchedule: [
      { month: 1, emi: 5556, principal: 5000, interest: 556, balance: 95000 },
      { month: 2, emi: 5556, principal: 5028, interest: 528, balance: 89972 },
      { month: 3, emi: 5556, principal: 5056, interest: 500, balance: 84916 },
      { month: 4, emi: 5556, principal: 5084, interest: 472, balance: 79832 },
      { month: 5, emi: 5556, principal: 5112, interest: 444, balance: 74720 },
      { month: 6, emi: 5556, principal: 5141, interest: 415, balance: 69579 },
      { month: 7, emi: 5556, principal: 5170, interest: 386, balance: 64409 },
      { month: 8, emi: 5556, principal: 5198, interest: 358, balance: 59211 },
      { month: 9, emi: 5556, principal: 5227, interest: 329, balance: 53984 },
      { month: 10, emi: 5556, principal: 5256, interest: 300, balance: 48728 },
    ],
  },
]

const salaryAdvances = [
  { id: 'ADV-001', date: '2026-03-15', amount: 10000, purpose: 'Medical Emergency', recoveryMode: 'Installments', recovered: 5000, balance: 5000, status: 'Recovering' as const },
]

const attendanceData2026_05 = (() => {
  const days: { day: number; status: string; project: string | null }[] = []
  const statuses: Record<number, { status: string; project: string | null }> = {
    1: { status: 'Present', project: 'Proj Alpha' },
    2: { status: 'Weekend', project: null },
    3: { status: 'Weekend', project: null },
    4: { status: 'Present', project: 'Proj Alpha' },
    5: { status: 'Present', project: 'Proj Alpha' },
    6: { status: 'Present', project: 'Proj Beta' },
    7: { status: 'Present', project: 'Proj Alpha' },
    8: { status: 'Present', project: 'Proj Alpha' },
    9: { status: 'Weekend', project: null },
    10: { status: 'Weekend', project: null },
    11: { status: 'Present', project: 'Proj Beta' },
    12: { status: 'Leave', project: null },
    13: { status: 'Leave', project: null },
    14: { status: 'Present', project: 'Proj Alpha' },
    15: { status: 'Present', project: 'Proj Alpha' },
    16: { status: 'Weekend', project: null },
    17: { status: 'Weekend', project: null },
    18: { status: 'Present', project: 'Proj Alpha' },
    19: { status: 'Present', project: 'Proj Alpha' },
    20: { status: 'Absent', project: null },
    21: { status: 'Present', project: 'Proj Beta' },
    22: { status: 'Present', project: 'Proj Alpha' },
    23: { status: 'Weekend', project: null },
    24: { status: 'Weekend', project: null },
    25: { status: 'Present', project: 'Proj Alpha' },
    26: { status: 'Present', project: 'Proj Alpha' },
    27: { status: 'Holiday', project: null },
    28: { status: 'Present', project: 'Proj Alpha' },
    29: { status: 'Present', project: 'Proj Beta' },
    30: { status: 'Weekend', project: null },
    31: { status: 'Weekend', project: null },
  }
  for (let d = 1; d <= 31; d++) {
    days.push({ day: d, ...statuses[d] })
  }
  return days
})()

const documents = [
  { id: 'DOC-001', name: 'CNIC', type: 'PDF', uploadDate: '2021-03-15' },
  { id: 'DOC-002', name: 'Contract', type: 'PDF', uploadDate: '2021-03-20' },
  { id: 'DOC-003', name: 'Offer Letter', type: 'PDF', uploadDate: '2021-03-10' },
  { id: 'DOC-004', name: 'Experience Letter', type: 'PDF', uploadDate: '2021-03-12' },
  { id: 'DOC-005', name: 'Tax Certificate', type: 'PDF', uploadDate: '2026-01-15' },
  { id: 'DOC-006', name: 'Payslips Archive', type: 'ZIP', uploadDate: '2026-05-01' },
]

// ---------------------------------------------------------------------------
// Status Badge helpers
// ---------------------------------------------------------------------------

function SalaryStatusBadge({ status }: { status: 'Paid' | 'Pending' | 'Draft' }) {
  const styles = {
    Paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    Pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    Draft: 'bg-slate-100 text-slate-500',
  }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>{status}</span>
}

function SCStatusBadge({ status }: { status: 'Remitted' | 'Pending' | 'Partial' }) {
  const styles = {
    Remitted: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    Pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    Partial: 'bg-blue-50 text-blue-700 border border-blue-200',
  }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>{status}</span>
}

function LoanStatusBadge({ status }: { status: 'Active' | 'Closed' | 'Overdue' }) {
  const styles = {
    Active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    Closed: 'bg-slate-100 text-slate-500',
    Overdue: 'bg-red-50 text-red-700 border border-red-200',
  }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>{status}</span>
}

function AdvanceStatusBadge({ status }: { status: 'Recovering' | 'Cleared' | 'Pending Approval' }) {
  const styles = {
    Recovering: 'bg-blue-50 text-blue-700 border border-blue-200',
    Cleared: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'Pending Approval': 'bg-amber-50 text-amber-700 border border-amber-200',
  }
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>{status}</span>
}

// ---------------------------------------------------------------------------
// Attendance Heatmap Cell
// ---------------------------------------------------------------------------

function AttendanceDayCell({ day, status, project }: { day: number; status: string; project: string | null }) {
  const bgMap: Record<string, string> = {
    Present: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Absent: 'bg-red-100 text-red-800 border-red-200',
    Leave: 'bg-blue-100 text-blue-800 border-blue-200',
    Weekend: 'bg-slate-50 text-slate-400 border-slate-200',
    Holiday: 'bg-purple-100 text-purple-800 border-purple-200',
  }
  const cls = bgMap[status] || 'bg-slate-50 text-slate-400 border-slate-200'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`h-9 w-full rounded-md border flex flex-col items-center justify-center cursor-default ${cls}`}>
            <span className="text-[10px] font-semibold">{day}</span>
            {project && <span className="text-[7px] leading-tight truncate max-w-full px-0.5">{project.replace('Proj ', '')}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px]">
          <span>{status}{project ? ` — ${project}` : ''}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function EmployeeProfile() {
  const { authUser } = useAppStore()
  const isAdmin = authUser?.role === 'admin'

  // Tab state
  const [activeTab, setActiveTab] = useState('salary-history')

  // Payslip expansion
  const [expandedPayslip, setExpandedPayslip] = useState<string | null>(null)

  // SC Payment form
  const [showScForm, setShowScForm] = useState(false)
  const [scPayment, setScPayment] = useState({ amount: '', date: '', reference: '' })
  const [scCoveredMonths, setScCoveredMonths] = useState<string[]>([])
  const [scSaving, setScSaving] = useState(false)

  // Loan repayment schedule
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null)

  // Attendance month
  const [attendanceMonth, setAttendanceMonth] = useState('2026-05')

  // Fade transition
  const [fadeKey, setFadeKey] = useState(0)
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setFadeKey(k => k + 1)
  }

  // Computed SC values
  const totalScAccrued = scLedger.reduce((s, r) => s + r.scAmount, 0)
  const totalScPaid = scLedger.filter(r => r.paymentStatus === 'Remitted').reduce((s, r) => s + r.scAmount, 0)
  const partialPaid = scLedger.filter(r => r.paymentStatus === 'Partial').reduce((s, r) => s + r.scAmount, 0)
  const totalScPaidAmount = totalScPaid + partialPaid * 0.5 // assume 50% of partial was paid
  const outstandingSc = 12750

  // Salary YTD
  const paidMonths = salaryHistory.filter(r => r.status === 'Paid')
  const totalPaidYtd = paidMonths.reduce((s, r) => s + r.netPaid, 0)
  const totalDeductedYtd = paidMonths.reduce((s, r) => s + r.deductions, 0)

  // Attendance summary
  const presentDays = attendanceData2026_05.filter(d => d.status === 'Present').length
  const absentDays = attendanceData2026_05.filter(d => d.status === 'Absent').length
  const leaveDays = attendanceData2026_05.filter(d => d.status === 'Leave').length
  const weekendDays = attendanceData2026_05.filter(d => d.status === 'Weekend').length
  const holidayDays = attendanceData2026_05.filter(d => d.status === 'Holiday').length

  // Project breakdown
  const projectBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    attendanceData2026_05.forEach(d => {
      if (d.project) {
        map[d.project] = (map[d.project] || 0) + 1
      }
    })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
      .map(([name, days]) => ({ name, days, pct: total > 0 ? Math.round((days / total) * 100) : 0 }))
      .sort((a, b) => b.days - a.days)
  }, [])

  // SC Form save
  const handleScPaymentSave = () => {
    setScSaving(true)
    setTimeout(() => {
      setScSaving(false)
      setShowScForm(false)
      setScPayment({ amount: '', date: '', reference: '' })
      setScCoveredMonths([])
    }, 1200)
  }

  // Initials
  const initials = employee.name.split(' ').map(w => w[0]).join('').slice(0, 2)

  const pendingScMonths = scLedger.filter(r => r.paymentStatus === 'Pending').map(r => r.month)

  // Tab items
  const tabs = [
    { key: 'salary-history', label: 'Salary History' },
    { key: 'social-charges', label: 'Social Charges' },
    { key: 'loans-advances', label: 'Loans & Advances' },
    { key: 'attendance-summary', label: 'Attendance Summary' },
    { key: 'documents', label: 'Documents' },
  ]

  // -------------------------------------------------------------------------
  // Render: Left Column — Profile Card
  // -------------------------------------------------------------------------
  const renderProfileCard = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      {/* Avatar + Name */}
      <div className="flex flex-col items-center text-center">
        <div className="h-16 w-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-2xl font-semibold mb-3">
          {initials}
        </div>
        <h2 className="text-xl font-semibold text-slate-900">{employee.name}</h2>
        <div className="mt-1.5">
          <span className="bg-slate-100 text-slate-500 text-[11px] rounded px-2 py-0.5 font-mono">{employee.id}</span>
        </div>
        <p className="text-[13px] text-slate-500 mt-2">{employee.designation}</p>
        <p className="text-[13px] text-slate-500">{employee.department}</p>
        <div className="mt-2.5">
          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[11px] px-3 py-1 font-medium">
            {employee.status}
          </span>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Metadata List */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5 text-[13px]">
          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 w-24">Join Date</span>
          <span className="text-slate-900 font-medium ml-auto">{formatDate(employee.joinDate)}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[13px]">
          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 w-24">Location</span>
          <span className="text-slate-900 font-medium ml-auto">{employee.location}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[13px]">
          <Landmark className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 w-24">Bank Account</span>
          <span className="text-slate-900 font-medium ml-auto">{employee.bank}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[13px]">
          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 w-24">Phone</span>
          <span className="text-slate-900 font-medium ml-auto">{employee.phone}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[13px]">
          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 w-24">Email</span>
          <span className="text-slate-900 font-medium ml-auto text-[12px] truncate">{employee.email}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[13px]">
          <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500 w-24">Contract Type</span>
          <span className="text-slate-900 font-medium ml-auto">{employee.contractType}</span>
        </div>
      </div>

      {/* Edit Profile Button — Admin Only */}
      {isAdmin && (
        <>
          <Separator className="my-4" />
          <Button variant="outline" className="w-full h-9 text-xs" size="sm">
            <Edit3 className="h-3.5 w-3.5 mr-1.5" />
            Edit Profile
          </Button>
        </>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Render: Left Column — Quick Stats
  // -------------------------------------------------------------------------
  const renderQuickStats = () => (
    <div className="grid grid-cols-2 gap-3">
      <TooltipProvider>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Monthly Salary</p>
          <p className="text-[18px] font-semibold text-slate-900">{formatPKR(employee.monthlySalary)}</p>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="bg-white border border-slate-200 rounded-xl p-4 cursor-help">
              <p className="text-[11px] text-slate-500">SC Balance</p>
              <p className="text-[18px] font-semibold text-amber-600">{formatPKR(outstandingSc)}</p>
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-[11px]">
            Accrued social charges not yet paid
          </TooltipContent>
        </Tooltip>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Loan Outstanding</p>
          <p className="text-[18px] font-semibold text-red-500">{formatPKR(44440)}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Advance Balance</p>
          <p className="text-[18px] font-semibold text-orange-500">{formatPKR(5000)}</p>
        </div>
      </TooltipProvider>
    </div>
  )

  // -------------------------------------------------------------------------
  // Render: Tab 1 — Salary History
  // -------------------------------------------------------------------------
  const renderSalaryHistory = () => (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Total Paid YTD</p>
          <p className="text-base font-semibold text-emerald-600">{formatPKR(totalPaidYtd)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Total Deducted YTD</p>
          <p className="text-base font-semibold text-red-500">{formatPKR(totalDeductedYtd)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] text-slate-500">Months Paid</p>
          <p className="text-base font-semibold text-slate-900">{paidMonths.length}</p>
        </div>
      </div>

      {/* Salary Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Month</th>
                <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Working Days</th>
                <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Present</th>
                <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Absent</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Earned Salary</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Deductions</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Net Paid</th>
                <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Status</th>
                <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {salaryHistory.map((row) => {
                const isExpanded = expandedPayslip === row.month
                return (
                  <React.Fragment key={row.month}>
                    <tr className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-slate-50/50' : ''}`}>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{formatMonthYear(row.month)}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{row.workingDays}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{row.present}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{row.absent}</td>
                      <td className="py-2.5 px-3 text-right text-slate-900">{formatPKR(row.earnedSalary)}</td>
                      <td className="py-2.5 px-3 text-right text-red-500">{formatPKR(row.deductions)}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-900">{formatPKR(row.netPaid)}</td>
                      <td className="py-2.5 px-3 text-center"><SalaryStatusBadge status={row.status} /></td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-slate-100 transition-colors"
                          onClick={() => setExpandedPayslip(isExpanded ? null : row.month)}
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                      </td>
                    </tr>
                    {/* Expanded Payslip Breakdown */}
                    <tr>
                      <td colSpan={9} className="p-0">
                        <div
                          className="overflow-hidden transition-all duration-200 ease-in-out"
                          style={{
                            maxHeight: isExpanded ? '400px' : '0px',
                            opacity: isExpanded ? 1 : 0,
                          }}
                        >
                          <div className="bg-slate-50/70 px-6 py-4 border-b border-slate-100">
                            <div className="grid grid-cols-2 gap-6 max-w-2xl">
                              {/* Earnings */}
                              <div>
                                <h4 className="text-[11px] font-semibold text-slate-700 mb-2 uppercase tracking-wider">Earnings</h4>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[12px]"><span className="text-slate-500">Basic</span><span className="text-slate-900">{formatPKR(row.earnings.basic)}</span></div>
                                  <div className="flex justify-between text-[12px]"><span className="text-slate-500">Housing</span><span className="text-slate-900">{formatPKR(row.earnings.housing)}</span></div>
                                  <div className="flex justify-between text-[12px]"><span className="text-slate-500">Transport</span><span className="text-slate-900">{formatPKR(row.earnings.transport)}</span></div>
                                  <div className="flex justify-between text-[12px]"><span className="text-slate-500">Other Allowances</span><span className="text-slate-900">{formatPKR(row.earnings.other)}</span></div>
                                  <Separator className="my-1" />
                                  <div className="flex justify-between text-[12px] font-semibold"><span>Total Earnings</span><span>{formatPKR(row.earnedSalary)}</span></div>
                                </div>
                              </div>
                              {/* Deductions */}
                              <div>
                                <h4 className="text-[11px] font-semibold text-slate-700 mb-2 uppercase tracking-wider">Deductions</h4>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[12px]"><span className="text-slate-500">Absent Deduction</span><span className="text-red-500">{formatPKR(row.deductionBreakdown.absentDeduction)}</span></div>
                                  <div className="flex justify-between text-[12px]"><span className="text-slate-500">Tax</span><span className="text-red-500">{formatPKR(row.deductionBreakdown.tax)}</span></div>
                                  <div className="flex justify-between text-[12px]"><span className="text-slate-500">Loan EMI</span><span className="text-red-500">{formatPKR(row.deductionBreakdown.loanEmi)}</span></div>
                                  <div className="flex justify-between text-[12px]"><span className="text-slate-500">SC Employee Share</span><span className="text-red-500">{formatPKR(row.deductionBreakdown.scEmployee)}</span></div>
                                  <Separator className="my-1" />
                                  <div className="flex justify-between text-[12px] font-semibold"><span>Total Deductions</span><span className="text-red-500">{formatPKR(row.deductions)}</span></div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-200 text-right">
                              <span className="text-[12px] text-slate-500 mr-3">Net Pay:</span>
                              <span className="text-[14px] font-semibold text-emerald-600">{formatPKR(row.netPaid)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // -------------------------------------------------------------------------
  // Render: Tab 2 — Social Charges
  // -------------------------------------------------------------------------
  const renderSocialCharges = () => (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="border-l-4 border-amber-400 bg-amber-50 rounded-lg p-4 text-[13px] text-amber-800">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Social charges are accrued monthly and settled separately. The balance below reflects total charges accumulated but not yet remitted.</span>
        </div>
      </div>

      {/* SC Balance Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[11px] text-slate-500">Total SC Accrued (All Time)</p>
          <p className="text-base font-semibold text-slate-900">{formatPKR(totalScAccrued)}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">Total SC Paid</p>
          <p className="text-base font-semibold text-emerald-600">{formatPKR(Math.round(totalScPaidAmount))}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">Outstanding Balance</p>
          <p className="text-base font-semibold text-amber-600">{formatPKR(outstandingSc)}</p>
        </div>
      </div>

      {/* SC Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Month</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Gross Salary</th>
                <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">SC Rate</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">SC Amount</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Cumulative Balance</th>
                <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Payment Status</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Paid On</th>
              </tr>
            </thead>
            <tbody>
              {scLedger.map((row) => (
                <tr key={row.month} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${row.paymentStatus === 'Pending' ? 'bg-amber-50/30' : ''}`}>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{formatMonthYear(row.month)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{formatPKR(row.grossSalary)}</td>
                  <td className="py-2.5 px-3 text-center text-slate-600">{(row.scRate * 100).toFixed(0)}%</td>
                  <td className="py-2.5 px-3 text-right text-slate-900">{formatPKR(row.scAmount)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{formatPKR(row.cumulativeBalance)}</td>
                  <td className="py-2.5 px-3 text-center"><SCStatusBadge status={row.paymentStatus} /></td>
                  <td className="py-2.5 px-3 text-slate-500">{row.paidOn ? formatDate(row.paidOn) : '—'}</td>
                </tr>
              ))}
              {/* Footer Totals */}
              <tr className="border-t-2 border-slate-200 bg-slate-50/50 font-semibold">
                <td className="py-2.5 px-3 text-slate-900">Total</td>
                <td className="py-2.5 px-3"></td>
                <td className="py-2.5 px-3"></td>
                <td className="py-2.5 px-3 text-right text-slate-900">{formatPKR(totalScAccrued)}</td>
                <td className="py-2.5 px-3"></td>
                <td className="py-2.5 px-3 text-center">
                  <span className="text-amber-600 text-[11px]">Outstanding: {formatPKR(outstandingSc)}</span>
                </td>
                <td className="py-2.5 px-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Record SC Payment Button — Admin Only */}
      {isAdmin && (
        <div>
          <Button
            className="bg-slate-900 text-white rounded-lg px-4 py-2 h-9 text-xs hover:bg-slate-800"
            onClick={() => setShowScForm(!showScForm)}
          >
            {showScForm ? 'Cancel' : 'Record SC Payment'}
          </Button>

          {/* Inline Form */}
          <div
            className="overflow-hidden transition-all duration-200 ease-in-out"
            style={{
              maxHeight: showScForm ? '400px' : '0px',
              opacity: showScForm ? 1 : 0,
            }}
          >
            <div className="bg-white border border-slate-200 rounded-xl p-5 mt-3 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Amount Paid (PKR)</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs mt-1"
                    placeholder="0"
                    value={scPayment.amount}
                    onChange={e => setScPayment(p => ({ ...p, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Payment Date</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs mt-1"
                    value={scPayment.date}
                    onChange={e => setScPayment(p => ({ ...p, date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Reference / Bank Ref</Label>
                  <Input
                    className="h-8 text-xs mt-1"
                    placeholder="e.g. CHQ-12345"
                    value={scPayment.reference}
                    onChange={e => setScPayment(p => ({ ...p, reference: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Covers Months</Label>
                <div className="flex flex-wrap gap-3">
                  {pendingScMonths.map(m => (
                    <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={scCoveredMonths.includes(m)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setScCoveredMonths(prev => [...prev, m])
                          } else {
                            setScCoveredMonths(prev => prev.filter(x => x !== m))
                          }
                        }}
                      />
                      <span className="text-[12px] text-slate-700">{formatMonthYear(m)}</span>
                    </label>
                  ))}
                  {pendingScMonths.length === 0 && (
                    <span className="text-[12px] text-slate-400">No pending months</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  className="bg-slate-900 text-white rounded-lg px-4 py-2 h-9 text-xs hover:bg-slate-800"
                  onClick={handleScPaymentSave}
                  disabled={scSaving}
                >
                  {scSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Save Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Render: Tab 3 — Loans & Advances
  // -------------------------------------------------------------------------
  const renderLoansAdvances = () => {
    const totalLiability = 44440 + 5000

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Loans Sub-Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Active Loans</h3>
              {isAdmin && (
                <Button variant="outline" size="sm" className="h-7 text-[11px]">
                  <Plus className="h-3 w-3 mr-1" /> New Loan
                </Button>
              )}
            </div>

            {activeLoans.map(loan => {
              const isExpanded = expandedLoan === loan.id
              const progressPct = Math.round((loan.totalPaid / loan.principal) * 100)
              return (
                <div key={loan.id} className="bg-white border border-slate-200 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-slate-900">{loan.id}</span>
                        <LoanStatusBadge status={loan.status} />
                      </div>
                      <span className="text-[11px] text-slate-500">{loan.loanType} Loan</span>
                    </div>
                    <button
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[12px] mb-3">
                    <div><span className="text-slate-500">Principal:</span> <span className="font-medium text-slate-900">{formatPKR(loan.principal)}</span></div>
                    <div><span className="text-slate-500">Disbursed:</span> <span className="font-medium text-slate-900">{formatDate(loan.disbursedDate)}</span></div>
                    <div><span className="text-slate-500">EMI:</span> <span className="font-medium text-slate-900">{formatPKR(loan.emiPerMonth)}/mo</span></div>
                    <div><span className="text-slate-500">Remaining:</span> <span className="font-medium text-red-500">{formatPKR(loan.remainingBalance)}</span></div>
                    <div><span className="text-slate-500">Months Left:</span> <span className="font-medium text-slate-900">{loan.monthsLeft}</span></div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>{formatPKR(loan.totalPaid)} paid</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-1.5 w-full">
                      <div className="bg-slate-900 rounded-full h-1.5 transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  {/* Collapsible Repayment Schedule */}
                  <div
                    className="overflow-hidden transition-all duration-200 ease-in-out"
                    style={{
                      maxHeight: isExpanded ? '500px' : '0px',
                      opacity: isExpanded ? 1 : 0,
                    }}
                  >
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <h4 className="text-[11px] font-semibold text-slate-700 mb-2 uppercase tracking-wider">Repayment Schedule</h4>
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-1.5 px-2 font-medium text-slate-500">Month</th>
                            <th className="text-right py-1.5 px-2 font-medium text-slate-500">EMI</th>
                            <th className="text-right py-1.5 px-2 font-medium text-slate-500">Principal</th>
                            <th className="text-right py-1.5 px-2 font-medium text-slate-500">Interest</th>
                            <th className="text-right py-1.5 px-2 font-medium text-slate-500">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loan.repaymentSchedule.map(r => (
                            <tr key={r.month} className="border-b border-slate-50">
                              <td className="py-1.5 px-2 text-slate-900">{r.month}</td>
                              <td className="py-1.5 px-2 text-right text-slate-700">{formatPKR(r.emi)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-700">{formatPKR(r.principal)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-500">{formatPKR(r.interest)}</td>
                              <td className="py-1.5 px-2 text-right text-slate-900 font-medium">{formatPKR(r.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })}

            {activeLoans.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                <CreditCard className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No active loans</p>
              </div>
            )}
          </div>

          {/* Advances Sub-Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Salary Advances</h3>
              {isAdmin && (
                <Button variant="outline" size="sm" className="h-7 text-[11px]">
                  <Plus className="h-3 w-3 mr-1" /> New Advance
                </Button>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Date</th>
                      <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Amount</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Purpose</th>
                      <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Recovery</th>
                      <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Recovered</th>
                      <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Balance</th>
                      <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryAdvances.map(adv => (
                      <tr key={adv.id} className="border-b border-slate-50">
                        <td className="py-2.5 px-3 text-slate-900">{formatDate(adv.date)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-900">{formatPKR(adv.amount)}</td>
                        <td className="py-2.5 px-3 text-slate-600">{adv.purpose}</td>
                        <td className="py-2.5 px-3 text-slate-600">{adv.recoveryMode}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600">{formatPKR(adv.recovered)}</td>
                        <td className="py-2.5 px-3 text-right text-orange-500 font-medium">{formatPKR(adv.balance)}</td>
                        <td className="py-2.5 px-3 text-center"><AdvanceStatusBadge status={adv.status} /></td>
                      </tr>
                    ))}
                    {salaryAdvances.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">No salary advances</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Total Liability Footer */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <span className="text-[13px] text-slate-500">Total Liability (Loan Outstanding + Advance Balance)</span>
          <span className="text-base font-semibold text-slate-900">{formatPKR(totalLiability)}</span>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render: Tab 4 — Attendance Summary
  // -------------------------------------------------------------------------
  const renderAttendanceSummary = () => {
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    const firstDayOffset = new Date(2026, 4, 1).getDay() // May 2026 — 0=Sunday

    return (
      <div className="space-y-4">
        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-slate-500">Month / Year</Label>
          <Input
            type="month"
            className="h-8 text-xs w-40"
            value={attendanceMonth}
            onChange={e => setAttendanceMonth(e.target.value)}
          />
        </div>

        {/* Calendar Heatmap */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="text-[11px] font-semibold text-slate-700 mb-3 uppercase tracking-wider">May 2026</h4>
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {dayNames.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOffset }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {attendanceData2026_05.map(d => (
              <AttendanceDayCell key={d.day} day={d.day} status={d.status} project={d.project} />
            ))}
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[10px]"><div className="h-3 w-3 rounded bg-emerald-100 border border-emerald-200" /><span className="text-slate-500">Present</span></div>
            <div className="flex items-center gap-1.5 text-[10px]"><div className="h-3 w-3 rounded bg-red-100 border border-red-200" /><span className="text-slate-500">Absent</span></div>
            <div className="flex items-center gap-1.5 text-[10px]"><div className="h-3 w-3 rounded bg-blue-100 border border-blue-200" /><span className="text-slate-500">Leave</span></div>
            <div className="flex items-center gap-1.5 text-[10px]"><div className="h-3 w-3 rounded bg-slate-50 border border-slate-200" /><span className="text-slate-500">Weekend</span></div>
            <div className="flex items-center gap-1.5 text-[10px]"><div className="h-3 w-3 rounded bg-purple-100 border border-purple-200" /><span className="text-slate-500">Holiday</span></div>
          </div>
        </div>

        {/* Summary Stats Row */}
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-500">Present</p>
            <p className="text-base font-semibold text-emerald-600">{presentDays}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-500">Absent</p>
            <p className="text-base font-semibold text-red-500">{absentDays}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-500">Leave</p>
            <p className="text-base font-semibold text-blue-600">{leaveDays}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-500">Weekends</p>
            <p className="text-base font-semibold text-slate-500">{weekendDays}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-500">Holidays</p>
            <p className="text-base font-semibold text-purple-600">{holidayDays}</p>
          </div>
        </div>

        {/* Project Breakdown - CSS-only horizontal bars */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="text-[11px] font-semibold text-slate-700 mb-3 uppercase tracking-wider">Project Breakdown</h4>
          <div className="space-y-3">
            {projectBreakdown.map(proj => (
              <div key={proj.name} className="flex items-center gap-3">
                <span className="text-[12px] text-slate-700 w-24 shrink-0">{proj.name}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 relative">
                  <div
                    className="bg-slate-900 rounded-full h-2 transition-all"
                    style={{ width: `${proj.pct}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 w-24 text-right shrink-0">
                  {proj.days} days ({proj.pct}%)
                </span>
              </div>
            ))}
            {projectBreakdown.length === 0 && (
              <p className="text-[12px] text-slate-400">No project data</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render: Tab 5 — Documents
  // -------------------------------------------------------------------------
  const renderDocuments = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {documents.map(doc => (
          <div key={doc.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              {doc.type === 'PDF' ? (
                <FileText className="h-4 w-4 text-red-500" />
              ) : doc.type === 'ZIP' ? (
                <FolderOpen className="h-4 w-4 text-amber-500" />
              ) : (
                <FileImage className="h-4 w-4 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-slate-900 truncate">{doc.name}</p>
              <p className="text-[11px] text-slate-400">{doc.type} · Uploaded {formatDate(doc.uploadDate)}</p>
              <div className="flex items-center gap-2 mt-2">
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-slate-500 hover:text-slate-900">
                  <Eye className="h-3 w-3 mr-1" /> View
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-slate-500 hover:text-slate-900">
                    <Upload className="h-3 w-3 mr-1" /> Replace
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Zone — Admin Only */}
      {isAdmin && (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
          <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-[13px] text-slate-500">Drop files here or click to upload</p>
          <p className="text-[11px] text-slate-400 mt-1">Supports PDF, DOC, DOCX, JPG, PNG (max 10MB)</p>
          <Button variant="outline" size="sm" className="mt-3 h-8 text-xs">
            <File className="h-3.5 w-3.5 mr-1.5" /> Browse Files
          </Button>
        </div>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Tab Content Map
  // -------------------------------------------------------------------------
  const tabContentMap: Record<string, () => JSX.Element> = {
    'salary-history': renderSalaryHistory,
    'social-charges': renderSocialCharges,
    'loans-advances': renderLoansAdvances,
    'attendance-summary': renderAttendanceSummary,
    'documents': renderDocuments,
  }

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <span>HR &amp; Payroll</span>
        <ChevronRight className="h-3 w-3" />
        <span>Employee Master</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-900 font-medium">Employee Profile</span>
      </nav>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-4 items-start">
        {/* Left Column */}
        <div className="space-y-4">
          {renderProfileCard()}
          {renderQuickStats()}
        </div>

        {/* Right Column */}
        <div>
          {/* Tab Bar */}
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div
            key={fadeKey}
            className="transition-opacity duration-150"
            style={{ opacity: 1 }}
          >
            {tabContentMap[activeTab]?.()}
          </div>
        </div>
      </div>
    </div>
  )
}

