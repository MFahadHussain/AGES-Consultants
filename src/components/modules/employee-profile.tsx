'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import {
  Eye, ChevronDown, ChevronRight, Calendar, MapPin, Landmark, Phone, Mail,
  Briefcase, Edit3, Upload, Plus, Loader2, Info, Search, Printer, Save,
  FileText, File, Calculator, BarChart3, PieChart
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

// ── TYPES ───────────────────────────────────────────────────────────────

interface EmployeeData {
  id: string; name: string; designation: string | null; department: string | null
  joinDate: string | null; location: string | null; bank: string | null; phone: string | null; email: string | null
  contractType: string | null; monthlySalary: number; workingDays: number
  scRate: number; taxRate: number; status: string; projects: string[]
  loanEMI: number; advanceBalance: number
  eobiEnabled: boolean; pfEnabled: boolean; incomeTaxEnabled: boolean
  essiEnabled: boolean; gratuityEnabled: boolean
  applyToAllProjects: boolean
  defaultAllocationMethod: string
  taxFilingStatus: string | null
  taxCity: string | null
  employeeCode: string; baseSalary: number; cnic: string
}

interface AttEntry { status: string; project: string | null }

interface ScLedgerEntry {
  month: string; grossSalary: number; scRate: number; scAmount: number
  paid: number; outstanding: number; status: 'Remitted' | 'Pending' | 'Partial'
  paidOn: string | null
}

interface LoanData {
  id: string; loanType: string; principal: number; disbursedDate: string
  tenure: number; emi: number; interestRate: number; remaining: number
  monthsLeft: number; status: 'Active' | 'Closed' | 'Overdue'
  schedule: { month: number; emi: number; principal: number; interest: number; balance: number }[]
}

interface AdvanceData {
  id: string; date: string; amount: number; purpose: string
  recoveryMode: string; monthlyRecovery: number; recovered: number
  balance: number; status: 'Recovering' | 'Cleared' | 'Pending Approval'
}

interface DocData {
  id: number; name: string; type: string; uploaded: string; size: string
}

interface SalaryRow {
  month: string; workingDays: number; present: number; absent: number; leave: number
  earnedSalary: number; absentDeduction: number; taxAmount: number
  loanDeduction: number; totalDeductions: number; netPaid: number
  status: 'Paid' | 'Pending' | 'Draft'
  earnings: { basic: number; housing: number; transport: number; other: number }
  deductionBreakdown: { absentDeduction: number; tax: number; loanEmi: number; scEmployee: number }
  taxBreakdown?: { ytdIncome?: number; projectedAnnualIncome?: number; taxSlab?: string; taxPaidYtd?: number } | null
  projectAllocations?: { projectId: string; projectName: string; projectCode: string; days: number; weight: number; weightPct: string; salaryShare: number; scShare: number }[] | null
}

// Payroll API result type
interface PayrollResult {
  employee: { id: string; name: string; employeeCode: string; baseSalary: number }
  month: string
  daysInMonth: number
  eligibleDays: number
  leaveDays: number
  absentDays: number
  monthlySalary: number
  dailyRate: number
  workingRatio: number
  monthlySC: number
  earnedSC: number
  leaveDeduction: number
  finalSC: number
  scBalance: number
  scComponents: {
    otherPayable: number
    earnedLeave: number
    sickLeave: number
    casualLeave: number
  }
  projectAllocations: {
    projectId: string; projectName: string; projectCode: string
    days: number; weight: number; weightPct: string
    salaryShare: number; scShare: number; scBalance: number
    scOtherPayable: number; scEarnedLeave: number; scSickLeave: number; scCasualLeave: number
  }[]
  totalBillableDays: number
  deductions: {
    incomeTax: number; eobiEmployee: number; eobiEmployer: number
    pfEmployee: number; pfEmployer: number; loanDeduction: number
    advanceDeduction: number; otherDeductions: number; totalDeductions: number
  }
  grossSalary: number
  netPay: number
  gratuity: number
  allowances: { details: { name: string; amount: number }[]; totalAllowances: number }
}

// Attendance API response type
interface AttendanceCalendarEntry {
  date: string; day: number; dayOfWeek: number
  record: { id: string; status: string; projectId: string | null } | null
  dailyProject: { projectId: string; project: { id: string; code: string; name: string }; status: string } | null
  statusLabel: string | null; scCategory: string | null
  isBillable: boolean; needsProject: boolean
}

interface AttendanceMonthlyResponse {
  employeeId: string; month: string; totalDays: number
  presentDays: number; absentDays: number; leaveDays: number
  earnedSC: number; deductedSC: number; netSC: number
  calendar: AttendanceCalendarEntry[]
}

// ── CONSTANTS ──────────────────────────────────────────────────────────

const PROJECT_COLORS = ['bg-blue-50 text-blue-700','bg-emerald-50 text-emerald-700','bg-purple-50 text-purple-700']
const PROJECT_BAR_COLORS = ['bg-blue-500','bg-emerald-500','bg-purple-500','bg-amber-500','bg-rose-500']

const STATUS_LABELS: Record<string,string> = {
  P:'Present',W:'Weekend Working',H:'Holiday Working',SL:'Sick Leave',
  CL:'Casual Leave',EL:'Earned Leave',A:'Absent',WH:'Work from Home',CO:'Comp Off',
  T:'Tour / Field',WW:'Work on Weekend',CD:'Compensatory Deduction'
}

const STATUS_COLORS: Record<string,string> = {
  P:'bg-emerald-500 text-white',W:'bg-blue-400 text-white',H:'bg-purple-400 text-white',
  SL:'bg-orange-400 text-white',CL:'bg-yellow-400 text-black',EL:'bg-teal-400 text-white',
  A:'bg-red-500 text-white',WH:'bg-cyan-400 text-white',CO:'bg-violet-400 text-white',
  T:'bg-pink-400 text-white',WW:'bg-indigo-400 text-white',CD:'bg-gray-400 text-white'
}

const SC_COMPONENT_COLORS: Record<string,{bg:string;text:string;border:string;icon:string}> = {
  otherPayable: {bg:'bg-sky-50',text:'text-sky-700',border:'border-sky-200',icon:'🏗️'},
  earnedLeave:  {bg:'bg-emerald-50',text:'text-emerald-700',border:'border-emerald-200',icon:'🏖️'},
  sickLeave:    {bg:'bg-orange-50',text:'text-orange-700',border:'border-orange-200',icon:'🏥'},
  casualLeave:  {bg:'bg-amber-50',text:'text-amber-700',border:'border-amber-200',icon:'📋'},
}

// ── HELPERS ──────────────────────────────────────────────────────────

function formatPKR(n: number): string { return 'PKR ' + n.toLocaleString('en-PK') }
function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-PK',{year:'numeric',month:'short',day:'numeric'})
}
function fmtMonth(ms: string): string { const [y,m]=ms.split('-').map(Number); return new Date(y,m-1,1).toLocaleDateString('en-US',{year:'numeric',month:'long'}) }

function calcEMI(principal: number, annualRate: number, tenure: number): number {
  if (annualRate === 0) return Math.round(principal / tenure)
  const r = annualRate / 12 / 100
  const f = Math.pow(1 + r, tenure)
  return Math.round(principal * r * f / (f - 1))
}

/** Generate a list of recent months for dropdowns */
function getRecentMonths(count: number = 12): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  return months
}

// ── BADGE COMPONENTS ───────────────────────────────────────────────

function SalaryBadge({status}:{status:string}) {
  const s: Record<string,string> = {Paid:'bg-emerald-50 text-emerald-700 border-emerald-200',Pending:'bg-amber-50 text-amber-700 border-amber-200',Draft:'bg-slate-100 text-slate-500 border-slate-200'}
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${s[status]||s.Draft}`}>{status}</span>
}
function ScBadge({status}:{status:string}) {
  const s: Record<string,string> = {Remitted:'bg-emerald-50 text-emerald-700 border-emerald-200',Pending:'bg-amber-50 text-amber-700 border-amber-200',Partial:'bg-blue-50 text-blue-700 border-blue-200'}
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${s[status]||s.Pending}`}>{status}</span>
}
function LoanBadge({status}:{status:string}) {
  const s: Record<string,string> = {Active:'bg-emerald-50 text-emerald-700 border-emerald-200',active:'bg-emerald-50 text-emerald-700 border-emerald-200',Closed:'bg-slate-100 text-slate-500 border-slate-200',closed:'bg-slate-100 text-slate-500 border-slate-200',Overdue:'bg-red-50 text-red-700 border-red-200',written_off:'bg-gray-100 text-gray-500 border-gray-200'}
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${s[status]||s.Active}`}>{status}</span>
}
function AdvBadge({status}:{status:string}) {
  const s: Record<string,string> = {Recovering:'bg-blue-50 text-blue-700 border-blue-200',Cleared:'bg-emerald-50 text-emerald-700 border-emerald-200','Pending Approval':'bg-amber-50 text-amber-700 border-amber-200'}
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${s[status]||s.Recovering}`}>{status}</span>
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EmployeeProfile() {
  const { authUser } = useAppStore()
  const isAdmin = authUser?.role === 'admin'

  // ---- State ----
  const [employees, setEmployees] = useState<EmployeeData[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [employeesLoading, setEmployeesLoading] = useState(true)

  // Search
  const [searchQ, setSearchQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [hlIdx, setHlIdx] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)

  // Tab
  const [activeTab, setActiveTab] = useState('salary-history')

  // Profile edit
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<EmployeeData>>({})

  // Salary
  const [expandedPayslip, setExpandedPayslip] = useState<string|null>(null)

  // Salary history from API (payroll batch lines)
  const [salaryHistory, setSalaryHistory] = useState<SalaryRow[]>([])
  const [salaryHistoryLoading, setSalaryHistoryLoading] = useState(false)

  // Payroll calculation
  const [payrollResults, setPayrollResults] = useState<Record<string, PayrollResult>>({})
  const [payrollLoading, setPayrollLoading] = useState(false)
  const [payrollMonth, setPayrollMonth] = useState('')

  // SC
  const [scLedgers, setScLedgers] = useState<Record<string,ScLedgerEntry[]>>({})
  const [showScForm, setShowScForm] = useState(false)
  const [scPayment, setScPayment] = useState({amount:'',date:'',reference:''})
  const [scCoveredMonths, setScCoveredMonths] = useState<string[]>([])

  // Loans & Advances
  const [loansStore, setLoansStore] = useState<Record<string,LoanData[]>>({})
  const [advStore, setAdvStore] = useState<Record<string,AdvanceData[]>>({})
  const [loansLoading, setLoansLoading] = useState(false)
  const [expandedLoan, setExpandedLoan] = useState<string|null>(null)
  const [newLoanOpen, setNewLoanOpen] = useState(false)
  const [newLoanForm, setNewLoanForm] = useState({loanType:'Personal',amount:'',date:'',tenure:'',interestRate:'12'})
  const [newAdvOpen, setNewAdvOpen] = useState(false)
  const [newAdvForm, setNewAdvForm] = useState({amount:'',purpose:'',recoveryMode:'Installments',monthlyRecovery:''})

  // Attendance
  const [attMonths, setAttMonths] = useState<Record<string,string>>({})
  const [attData, setAttData] = useState<Record<number, AttEntry>>({})
  const [attStats, setAttStats] = useState<{presentDays:number;absentDays:number;leaveDays:number;totalDays:number}>({presentDays:0,absentDays:0,leaveDays:0,totalDays:0})
  const [attLoading, setAttLoading] = useState(false)

  // Documents
  const [docStore, setDocStore] = useState<Record<string,DocData[]>>({})
  const [previewDoc, setPreviewDoc] = useState<DocData|null>(null)
  const [replaceDocId, setReplaceDocId] = useState<number|null>(null)

  // Available months for dropdowns
  const availableMonths = useMemo(() => getRecentMonths(12), [])

  // ---- Fetch Employees on mount ----
  useEffect(() => {
    const fetchEmployees = async () => {
      setEmployeesLoading(true)
      try {
        const res = await fetch('/api/employees?pageSize=200')
        if (res.ok) {
          const json = await res.json()
          const rawEmployees = json.data || json.employees || json || []
          const mapped: EmployeeData[] = rawEmployees.map((e: Record<string, unknown>) => ({
            id: e.id as string,
            name: e.name as string,
            designation: (e.designation as string) || null,
            department: (e.department as string) || null,
            joinDate: e.joiningDate ? new Date(e.joiningDate as string).toISOString().split('T')[0] : null,
            location: (e.presentAddress as string) || (e.permanentAddress as string) || null,
            bank: e.bankName ? `${e.bankName}${e.bankAccountNumber ? ' ****'+String(e.bankAccountNumber).slice(-4) : ''}` : null,
            phone: (e.contactNo as string) || null,
            email: (e.email as string) || null,
            contractType: (e.employmentType as string) || null,
            monthlySalary: (e.baseSalary as number) || 0,
            workingDays: 26,
            scRate: 0.20,
            taxRate: e.incomeTaxEnabled ? 0.05 : 0,
            status: ((e.status as string) || 'active').charAt(0).toUpperCase() + ((e.status as string) || 'active').slice(1),
            projects: e.defaultProject ? [((e.defaultProject as Record<string, unknown>).code as string || (e.defaultProject as Record<string, unknown>).name as string)] : [],
            loanEMI: 0,
            advanceBalance: 0,
            eobiEnabled: e.eobiEnabled as boolean || false,
            pfEnabled: e.pfEnabled as boolean || false,
            incomeTaxEnabled: e.incomeTaxEnabled as boolean !== false,
            essiEnabled: e.essiEnabled as boolean || false,
            gratuityEnabled: e.gratuityEnabled as boolean || false,
            applyToAllProjects: e.applyToAllProjects as boolean || false,
            defaultAllocationMethod: (e.defaultAllocationMethod as string) || 'days',
            taxFilingStatus: (e.taxFilingStatus as string) || null,
            taxCity: (e.taxCity as string) || null,
            employeeCode: e.employeeCode as string || '',
            baseSalary: (e.baseSalary as number) || 0,
            cnic: e.cnic as string || '',
          }))
          setEmployees(mapped)
          if (mapped.length > 0 && !selectedId) {
            setSelectedId(mapped[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch employees:', err)
        toast.error('Failed to load employees')
      } finally {
        setEmployeesLoading(false)
        setLoading(false)
      }
    }
    fetchEmployees()
  }, [])

  // ---- Fetch employee detail, attendance, loans when selected ----
  useEffect(() => {
    if (!selectedId) return

    // Fetch attendance for current month
    const fetchAttendance = async () => {
      setAttLoading(true)
      try {
        const month = attMonths[selectedId] || new Date().toISOString().slice(0, 7)
        const res = await fetch(`/api/attendance?view=monthly&employeeId=${selectedId}&month=${month}`)
        if (res.ok) {
          const data: AttendanceMonthlyResponse = await res.json()
          // Convert calendar to our attData format
          const mapped: Record<number, AttEntry> = {}
          data.calendar.forEach((entry) => {
            if (entry.record) {
              const dayNum = entry.day
              const projectCode = entry.dailyProject?.project?.code || entry.dailyProject?.project?.name || null
              mapped[dayNum] = { status: entry.record.status, project: projectCode }
            }
          })
          setAttData(mapped)
          setAttStats({
            presentDays: data.presentDays,
            absentDays: data.absentDays,
            leaveDays: data.leaveDays,
            totalDays: data.totalDays,
          })
        } else {
          setAttData({})
          setAttStats({ presentDays: 0, absentDays: 0, leaveDays: 0, totalDays: 0 })
        }
      } catch {
        setAttData({})
        setAttStats({ presentDays: 0, absentDays: 0, leaveDays: 0, totalDays: 0 })
      } finally {
        setAttLoading(false)
      }
    }

    // Fetch loans for this employee
    const fetchLoans = async () => {
      setLoansLoading(true)
      try {
        const res = await fetch(`/api/loans?employeeId=${selectedId}`)
        if (res.ok) {
          const data = await res.json()
          const apiLoans: LoanData[] = []
          const apiAdvances: AdvanceData[] = []

          ;(Array.isArray(data) ? data : []).forEach((loan: Record<string, unknown>) => {
            const installments = (loan.installments as { installmentNo: number; amount: number; principalPart: number; interestPart: number; paidAmount: number; status: string }[]) || []
            const paidCount = installments.filter(i => i.status === 'paid').length
            const totalPaid = installments.reduce((s: number, i: { paidAmount: number }) => s + i.paidAmount, 0)
            const remaining = Math.max(0, (loan.balanceAmount as number) || 0)

            if ((loan.loanType as string) === 'Advance Salary') {
              apiAdvances.push({
                id: loan.id as string,
                date: loan.disbursementDate ? new Date(loan.disbursementDate as string).toISOString().split('T')[0] : '',
                amount: (loan.principalAmount as number) || 0,
                purpose: 'Salary Advance',
                recoveryMode: 'Installments',
                monthlyRecovery: (loan.monthlyDeduction as number) || 0,
                recovered: totalPaid,
                balance: remaining,
                status: (loan.status as string) === 'active' ? 'Recovering' : 'Cleared',
              })
            } else {
              const schedule = installments.map(inst => ({
                month: inst.installmentNo,
                emi: inst.amount,
                principal: inst.principalPart,
                interest: inst.interestPart,
                balance: Math.max(0, (loan.principalAmount as number) - inst.principalPart * inst.installmentNo),
              }))

              apiLoans.push({
                id: loan.loanNumber as string || loan.id as string,
                loanType: (loan.loanType as string) || 'Personal',
                principal: (loan.principalAmount as number) || 0,
                disbursedDate: loan.disbursementDate ? new Date(loan.disbursementDate as string).toISOString().split('T')[0] : '',
                tenure: (loan.tenureMonths as number) || 0,
                emi: (loan.monthlyDeduction as number) || 0,
                interestRate: (loan.interestRate as number) || 0,
                remaining,
                monthsLeft: Math.max(0, ((loan.tenureMonths as number) || 0) - paidCount),
                status: (loan.status as string) === 'active' ? 'Active' : (loan.status as string) === 'closed' ? 'Closed' : 'Overdue',
                schedule,
              })
            }
          })

          setLoansStore(prev => ({ ...prev, [selectedId]: apiLoans }))
          setAdvStore(prev => ({ ...prev, [selectedId]: apiAdvances }))
        }
      } catch {
        setLoansStore(prev => ({ ...prev, [selectedId]: [] }))
        setAdvStore(prev => ({ ...prev, [selectedId]: [] }))
      } finally {
        setLoansLoading(false)
      }
    }

    // Fetch salary history (payroll batch lines for this employee)
    const fetchSalaryHistory = async () => {
      setSalaryHistoryLoading(true)
      try {
        const res = await fetch(`/api/payroll`)
        if (res.ok) {
          const batches = await res.json()
          const allRows: SalaryRow[] = []
          const lines: Record<string, unknown>[] = []

          // Extract lines from all batches for this employee
          for (const batch of Array.isArray(batches) ? batches : []) {
            const batchLines = ((batch as Record<string, unknown>).lines as Record<string, unknown>[]) || []
            for (const line of batchLines) {
              if ((line.employeeId as string) === selectedId) {
                lines.push({ ...line, period: (batch as Record<string, unknown>).period, batchStatus: (batch as Record<string, unknown>).status })
              }
            }
          }

          for (const line of lines) {
            const grossSalary = (line.grossSalary as number) || 0
            const basic = (line.basicSalary as number) || 0
            const housing = Math.round(grossSalary * 0.15)
            const transport = Math.round(grossSalary * 0.06)
            const other = grossSalary - basic - housing - transport
            const period = (line.period as string) || ''
            const batchStatus = (line.batchStatus as string) || 'draft'

            allRows.push({
              month: period,
              workingDays: (line.workingDays as number) || 0,
              present: ((line.eligibleDays as number) || 0) - ((line.leaveDays as number) || 0),
              absent: (line.absentDays as number) || 0,
              leave: (line.leaveDays as number) || 0,
              earnedSalary: grossSalary,
              absentDeduction: Math.round(((line.absentDays as number) || 0) * ((line.dailyRate as number) || 0)),
              taxAmount: (line.incomeTax as number) || 0,
              loanDeduction: (line.loanDeduction as number) || 0,
              totalDeductions: (line.totalDeductions as number) || 0,
              netPaid: (line.netPay as number) || 0,
              status: batchStatus === 'posted' ? 'Paid' : batchStatus === 'approved' ? 'Pending' : 'Draft',
              earnings: { basic, housing, transport, other: Math.max(0, other) },
              deductionBreakdown: {
                absentDeduction: Math.round(((line.absentDays as number) || 0) * ((line.dailyRate as number) || 0)),
                tax: (line.incomeTax as number) || 0,
                loanEmi: (line.loanDeduction as number) || 0,
                scEmployee: 0,
              },
              taxBreakdown: line.taxBreakdown ? JSON.parse(line.taxBreakdown as string) : null,
              projectAllocations: line.projectAllocations ? JSON.parse(line.projectAllocations as string) : null,
            })
          }

          // Sort by month desc
          allRows.sort((a, b) => b.month.localeCompare(a.month))
          setSalaryHistory(allRows)

          // Build SC ledger from salary history
          const scLedger: ScLedgerEntry[] = []
          let cumOutstanding = 0
          const sortedAsc = [...allRows].sort((a, b) => a.month.localeCompare(b.month))
          for (const row of sortedAsc) {
            const scAmount = Math.round(row.earnedSalary * 0.20)
            cumOutstanding += scAmount
            const isPaid = row.status === 'Paid'
            const paid = isPaid ? scAmount : 0
            if (isPaid) cumOutstanding -= scAmount
            scLedger.push({
              month: row.month,
              grossSalary: row.earnedSalary,
              scRate: 0.20,
              scAmount,
              paid,
              outstanding: cumOutstanding,
              status: isPaid ? 'Remitted' : 'Pending',
              paidOn: isPaid ? `${row.month}-28` : null,
            })
          }
          setScLedgers(prev => ({ ...prev, [selectedId]: scLedger }))
        }
      } catch {
        setSalaryHistory([])
      } finally {
        setSalaryHistoryLoading(false)
      }
    }

    fetchAttendance()
    fetchLoans()
    fetchSalaryHistory()
  }, [selectedId, attMonths[selectedId || '']])

  // Set default payroll month
  useEffect(() => {
    if (!payrollMonth && availableMonths.length > 0) {
      setPayrollMonth(availableMonths[0])
    }
  }, [availableMonths, payrollMonth])

  // ---- Derived ----
  const emp = useMemo(() => employees.find(e => e.id === selectedId), [employees, selectedId])
  const empId = emp?.id || ''
  const scLedger = empId ? (scLedgers[empId] || []) : []
  const loans = empId ? (loansStore[empId] || []) : []
  const advances = empId ? (advStore[empId] || []) : []
  const docs = empId ? (docStore[empId] || []) : []
  const attMonth = empId ? (attMonths[empId] || new Date().toISOString().slice(0, 7)) : new Date().toISOString().slice(0, 7)

  const initials = emp?.name?.split(' ').map(w=>w[0]).join('').slice(0,2) || '??'
  // Quick stats
  const scOutstanding = useMemo(() => scLedger.reduce((s,r) => s + r.scAmount - r.paid, 0), [scLedger])
  const loanOutstanding = useMemo(() => loans.reduce((s,l) => s + l.remaining, 0), [loans])
  const advBalance = useMemo(() => advances.reduce((s,a) => s + a.balance, 0), [advances])

  // Salary YTD
  const paidRows = salaryHistory.filter(r=>r.status==='Paid')
  const totalPaidYtd = paidRows.reduce((s,r)=>s+r.netPaid,0)
  const totalDeductedYtd = paidRows.reduce((s,r)=>s+r.totalDeductions,0)

  // SC totals
  const totalScAccrued = scLedger.reduce((s,r)=>s+r.scAmount,0)
  const totalScPaid = scLedger.reduce((s,r)=>s+r.paid,0)

  // Attendance stats from API data
  const attEntries = Object.entries(attData)
  const attPresent = attStats.presentDays || attEntries.filter(([,e])=>['P','WH'].includes(e.status)).length
  const attAbsent = attStats.absentDays || attEntries.filter(([,e])=>e.status==='A').length
  const attLeave = attStats.leaveDays || attEntries.filter(([,e])=>['SL','CL','EL'].includes(e.status)).length
  const attWeekend = attEntries.filter(([,e])=>e.status==='W').length
  const attHoliday = attEntries.filter(([,e])=>e.status==='H').length

  // Billable vs non-billable
  const billableStatuses = ['P','W','H','WH','WW','T','CO']
  const billableDays = attEntries.filter(([,e]) => billableStatuses.includes(e.status) && e.project).length
  const nonBillableDays = attEntries.filter(([,e]) => billableStatuses.includes(e.status) && !e.project).length

  // Project allocation from attendance data
  const projectAlloc = useMemo(() => {
    const map: Record<string,number> = {}
    Object.values(attData).forEach(e=>{ if(e.project) map[e.project]=(map[e.project]||0)+1 })
    const total = Object.values(map).reduce((s,v)=>s+v,0)
    return Object.entries(map).map(([name,days])=>({name,days,pct:total>0?Math.round(days/total*100):0})).sort((a,b)=>b.days-a.days)
  }, [attData])

  // API payroll result key
  const payrollKey = `${empId}-${payrollMonth}`
  const apiPayrollResult = payrollResults[payrollKey]

  // Effective payroll result (API if available)
  const effectivePayroll = apiPayrollResult || null

  // Pending SC months
  const pendingScMonths = scLedger.filter(r=>r.status==='Pending').map(r=>r.month)

  // ---- Handlers ----
  const selectEmployee = useCallback((id: string) => {
    if (id === selectedId) return
    setLoading(true)
    setExpandedPayslip(null)
    setShowScForm(false)
    setEditMode(false)
    setExpandedLoan(null)
    setAttData({})
    setTimeout(() => { setSelectedId(id); setLoading(false) }, 150)
  }, [selectedId])

  // Run Payroll Calculation
  const handleRunPayroll = useCallback(async () => {
    if (!empId) return
    setPayrollLoading(true)
    try {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId, month: payrollMonth, skipValidation: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setPayrollResults(prev => ({...prev, [payrollKey]: data}))
        toast.success('Payroll calculation completed')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Payroll calculation failed')
      }
    } catch {
      toast.error('Failed to connect to payroll API')
    } finally {
      setPayrollLoading(false)
    }
  }, [empId, payrollMonth, payrollKey])

  // Search keyboard
  const filteredEmployees = useMemo(() => {
    if (!searchQ.trim()) return employees
    const q = searchQ.toLowerCase()
    return employees.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || (e.department || '').toLowerCase().includes(q) || (e.employeeCode || '').toLowerCase().includes(q))
  }, [employees, searchQ])

  const handleSearchKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHlIdx(i => Math.min(i+1, filteredEmployees.length-1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHlIdx(i => Math.max(i-1, 0)) }
    else if (e.key === 'Enter' && hlIdx >= 0 && hlIdx < filteredEmployees.length) { selectEmployee(filteredEmployees[hlIdx].id); setSearchQ(''); setSearchOpen(false); setHlIdx(-1) }
    else if (e.key === 'Escape') { setSearchOpen(false); setHlIdx(-1) }
  }, [filteredEmployees, hlIdx, selectEmployee])

  // Click outside search
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Profile edit
  const startEdit = () => { if (emp) setEditForm({...emp}); setEditMode(true) }
  const cancelEdit = () => { setEditMode(false); setEditForm({}) }
  const saveEdit = async () => {
    try {
      const res = await fetch(`/api/employees?id=${empId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          designation: editForm.designation,
          department: editForm.department,
          contactNo: editForm.phone,
          email: editForm.email,
          presentAddress: editForm.location,
          employmentType: editForm.contractType,
          baseSalary: editForm.monthlySalary || editForm.baseSalary,
        }),
      })
      if (res.ok) {
        // Update local state
        setEmployees(prev => prev.map(e => e.id === empId ? {...e, ...editForm} as EmployeeData : e))
        setEditMode(false)
        setEditForm({})
        toast.success('Profile updated successfully')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to update profile')
      }
    } catch {
      toast.error('Failed to connect to API')
    }
  }

  // SC Payment save
  const handleScPaymentSave = () => {
    if (!scPayment.amount || !scPayment.date || scCoveredMonths.length === 0) {
      toast.error('Please fill all fields and select at least one month')
      return
    }
    setScLedgers(prev => {
      const ledger = [...(prev[empId]||[])]
      scCoveredMonths.forEach(m => {
        const idx = ledger.findIndex(l => l.month === m)
        if (idx >= 0) {
          const entry = {...ledger[idx]}
          entry.paid = entry.scAmount
          entry.outstanding = 0
          entry.status = 'Remitted'
          entry.paidOn = scPayment.date
          ledger[idx] = entry
        }
      })
      let cum = 0
      ledger.forEach(l => { cum += l.scAmount - l.paid; l.outstanding = cum })
      return {...prev, [empId]: ledger}
    })
    setShowScForm(false)
    setScPayment({amount:'',date:'',reference:''})
    setScCoveredMonths([])
    toast.success('SC Payment recorded successfully')
  }

  // New Loan save
  const handleNewLoan = () => {
    const amount = parseFloat(newLoanForm.amount)
    const tenure = parseInt(newLoanForm.tenure)
    const rate = parseFloat(newLoanForm.interestRate)
    if (!amount || !tenure || !newLoanForm.date) { toast.error('Please fill all required fields'); return }
    const emi = calcEMI(amount, rate, tenure)
    const r = rate / 12 / 100
    const schedule = []
    let bal = amount
    for (let m=1; m<=tenure; m++) { const intP=Math.round(bal*r); const prP=emi-intP; bal=bal-prP; schedule.push({month:m,emi,principal:prP,interest:intP,balance:Math.max(0,bal)}) }
    const newLoan: LoanData = { id:`LN-${Date.now().toString(36).toUpperCase()}`, loanType:newLoanForm.loanType, principal:amount, disbursedDate:newLoanForm.date, tenure, emi, interestRate:rate, remaining:amount, monthsLeft:tenure, status:'Active', schedule }
    setLoansStore(prev => ({...prev, [empId]: [...(prev[empId]||[]), newLoan]}))
    setNewLoanOpen(false)
    setNewLoanForm({loanType:'Personal',amount:'',date:'',tenure:'',interestRate:'12'})
    toast.success('Loan added successfully')
  }

  // New Advance save
  const handleNewAdvance = () => {
    const amount = parseFloat(newAdvForm.amount)
    const monthly = parseFloat(newAdvForm.monthlyRecovery)
    if (!amount || !newAdvForm.purpose || !monthly) { toast.error('Please fill all required fields'); return }
    const newAdv: AdvanceData = { id:`ADV-${Date.now().toString(36).toUpperCase()}`, date:new Date().toISOString().split('T')[0], amount, purpose:newAdvForm.purpose, recoveryMode:newAdvForm.recoveryMode, monthlyRecovery:monthly, recovered:0, balance:amount, status:'Recovering' }
    setAdvStore(prev => ({...prev, [empId]: [...(prev[empId]||[]), newAdv]}))
    setNewAdvOpen(false)
    setNewAdvForm({amount:'',purpose:'',recoveryMode:'Installments',monthlyRecovery:''})
    toast.success('Advance added successfully')
  }

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return <>{text.slice(0,idx)}<mark className="bg-yellow-100 text-yellow-800 rounded px-0.5">{text.slice(idx,idx+query.length)}</mark>{text.slice(idx+query.length)}</>
  }

  // Calendar layout
  const calendarWeeks = useMemo(() => {
    const [y,m] = attMonth.split('-').map(Number)
    const firstDay = new Date(y,m-1,1).getDay()
    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1
    const daysInMonth = new Date(y,m,0).getDate()
    const weeks: (number|null)[][] = []
    let week: (number|null)[] = Array(mondayOffset).fill(null)
    for (let d=1; d<=daysInMonth; d++) {
      week.push(d)
      if (week.length === 7) { weeks.push(week); week = [] }
    }
    if (week.length > 0) { while(week.length<7) week.push(null); weeks.push(week) }
    return weeks
  }, [attMonth])

  // Tabs
  const tabs = [
    {key:'salary-history',label:'Salary History'},
    {key:'social-charges',label:'Social Charges'},
    {key:'loans-advances',label:'Loans & Advances'},
    {key:'attendance-summary',label:'Attendance Summary'},
    {key:'documents',label:'Documents'},
  ]

  // ========================================================================
  // RENDER: Search Bar
  // ========================================================================
  const renderSearch = () => (
    <div ref={searchRef} className="relative mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          className="bg-white border border-slate-200 rounded-xl px-4 py-3 pl-10 w-full text-[14px] outline-none focus:ring-2 focus:ring-slate-300 transition-shadow"
          placeholder="Search employee by name, code, or department..."
          value={searchQ}
          onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); setHlIdx(-1) }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={handleSearchKey}
        />
      </div>
      {searchOpen && searchQ.trim() && (
        <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 z-50 max-h-[280px] overflow-y-auto">
          {filteredEmployees.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No employees found</div>
          ) : (
            filteredEmployees.map((e, i) => (
              <button key={e.id} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${i===hlIdx?'bg-slate-50':''} ${e.id===selectedId?'bg-slate-50/50':''}`}
                onClick={() => { selectEmployee(e.id); setSearchQ(''); setSearchOpen(false) }}
                onMouseEnter={() => setHlIdx(i)}
              >
                <div className="h-8 w-8 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs font-semibold shrink-0">
                  {e.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{highlightMatch(e.name, searchQ)}</div>
                  <div className="text-[11px] text-slate-500">{e.designation || '—'}</div>
                </div>
                <span className="bg-slate-100 text-slate-600 text-[10px] rounded px-1.5 py-0.5 font-mono shrink-0">{highlightMatch(e.employeeCode || e.id, searchQ)}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{highlightMatch(e.department || '', searchQ)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )

  // ========================================================================
  // RENDER: Profile Card
  // ========================================================================
  const renderProfileCard = () => {
    if (editMode) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col items-center text-center mb-4">
            <div className="h-16 w-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-2xl font-semibold mb-2">{initials}</div>
            <p className="text-xs text-slate-400">Editing Profile</p>
          </div>
          <Separator className="my-3" />
          <div className="space-y-3">
            {[
              {key:'name',label:'Full Name',icon:Edit3},
              {key:'designation',label:'Designation',icon:Edit3},
              {key:'department',label:'Department',icon:Edit3},
              {key:'phone',label:'Phone',icon:Phone},
              {key:'email',label:'Email',icon:Mail},
              {key:'location',label:'Location',icon:MapPin},
              {key:'bank',label:'Bank Account',icon:Landmark},
              {key:'contractType',label:'Contract Type',icon:Briefcase},
            ].map(f => (
              <div key={f.key}>
                <Label className="text-xs text-slate-500">{f.label}</Label>
                <Input className="h-8 text-xs mt-0.5" value={(editForm as Record<string,string|number|null|undefined>)[f.key]?.toString()||''}
                  onChange={e => setEditForm(prev => ({...prev,[f.key]:e.target.value}))} />
              </div>
            ))}
            <div>
              <Label className="text-xs text-slate-500">Monthly Salary</Label>
              <Input type="number" className="h-8 text-xs mt-0.5" value={editForm.monthlySalary?.toString()||editForm.baseSalary?.toString()||''}
                onChange={e => setEditForm(prev => ({...prev,monthlySalary:parseFloat(e.target.value)||0,baseSalary:parseFloat(e.target.value)||0}))} />
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex gap-2">
            <Button className="flex-1 h-9 text-xs bg-slate-900 text-white hover:bg-slate-800" onClick={saveEdit}>
              <Save className="h-3.5 w-3.5 mr-1.5" />Save
            </Button>
            <Button variant="outline" className="flex-1 h-9 text-xs" onClick={cancelEdit}>Cancel</Button>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-2xl font-semibold mb-3">{initials}</div>
          <h2 className="text-xl font-semibold text-slate-900">{emp?.name || 'No Employee'}</h2>
          <div className="mt-1.5"><span className="bg-slate-100 text-slate-500 text-[11px] rounded px-2 py-0.5 font-mono">{emp?.employeeCode || empId}</span></div>
          <p className="text-[13px] text-slate-500 mt-2">{emp?.designation || '—'}</p>
          <p className="text-[13px] text-slate-500">{emp?.department || '—'}</p>
          <div className="mt-2.5">
            <span className={`rounded-full text-[11px] px-3 py-1 font-medium border ${emp?.status==='Active'||emp?.status==='active'?'bg-emerald-50 text-emerald-600 border-emerald-200':'bg-red-50 text-red-600 border-red-200'}`}>{emp?.status || '—'}</span>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="space-y-2.5">
          {[
            {icon:Calendar,label:'Join Date',value:formatDate(emp?.joinDate || null)},
            {icon:MapPin,label:'Location',value:emp?.location || '—'},
            {icon:Landmark,label:'Bank Account',value:emp?.bank || '—'},
            {icon:Phone,label:'Phone',value:emp?.phone || '—'},
            {icon:Mail,label:'Email',value:emp?.email || '—'},
            {icon:Briefcase,label:'Contract Type',value:emp?.contractType || '—'},
          ].map(r => (
            <div key={r.label} className="flex items-center gap-2.5 text-[13px]">
              <r.icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500 w-24">{r.label}</span>
              <span className="text-slate-900 font-medium ml-auto truncate">{r.value}</span>
            </div>
          ))}
        </div>
        {(emp?.projects?.length || 0) > 0 && (
          <>
            <Separator className="my-4" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-500">Projects:</span>
              {emp?.projects?.map((p,i) => (
                <span key={p} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PROJECT_COLORS[i%PROJECT_COLORS.length]}`}>{p}</span>
              ))}
            </div>
          </>
        )}
        {/* EOBI / PF / Income Tax / ESSI / Gratuity / Tax Filing Status Badges */}
        <Separator className="my-4" />
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500 font-medium">Statutory Status</p>
          <div className="flex flex-wrap gap-2">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${emp?.eobiEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
              EOBI {emp?.eobiEnabled ? '✓' : '✗'}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${emp?.pfEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
              PF {emp?.pfEnabled ? '✓' : '✗'}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${emp?.incomeTaxEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
              Income Tax {emp?.incomeTaxEnabled ? '✓' : '✗'}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${emp?.essiEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
              ESSI {emp?.essiEnabled ? '✓' : '✗'}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${emp?.gratuityEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
              Gratuity {emp?.gratuityEnabled ? '✓' : '✗'}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${emp?.taxFilingStatus === 'filer' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : emp?.taxFilingStatus === 'non-filer' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
              {emp?.taxFilingStatus === 'filer' ? 'Filer' : emp?.taxFilingStatus === 'non-filer' ? 'Non-Filer' : 'Tax —'}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium border bg-blue-50 text-blue-700 border-blue-200">
              {emp?.defaultAllocationMethod === 'percentage' ? 'Pct' : 'Days'}
            </span>
          </div>
        </div>
        {isAdmin && (
          <>
            <Separator className="my-4" />
            <Button variant="outline" className="w-full h-9 text-xs" onClick={startEdit}>
              <Edit3 className="h-3.5 w-3.5 mr-1.5" />Edit Profile
            </Button>
          </>
        )}
      </div>
    )
  }

  // ========================================================================
  // RENDER: Quick Stats
  // ========================================================================
  const renderQuickStats = () => (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-[11px] text-slate-500">Monthly Salary</p>
        <p className="text-[18px] font-semibold text-slate-900">{formatPKR(emp?.monthlySalary || emp?.baseSalary || 0)}</p>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="bg-white border border-slate-200 rounded-xl p-4 cursor-help">
              <p className="text-[11px] text-slate-500">SC Balance</p>
              <p className="text-[18px] font-semibold text-amber-600">{formatPKR(scOutstanding)}</p>
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-[11px]">Accrued social charges not yet paid</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-[11px] text-slate-500">Loan Outstanding</p>
        <p className="text-[18px] font-semibold text-red-500">{formatPKR(loanOutstanding)}</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-[11px] text-slate-500">Advance Balance</p>
        <p className="text-[18px] font-semibold text-orange-500">{formatPKR(advBalance)}</p>
      </div>
    </div>
  )

  // ========================================================================
  // RENDER: Project Cost Distribution (shared between tabs)
  // ========================================================================
  const renderProjectCostDistribution = (scCalc: PayrollResult, source: string) => {
    if (scCalc.projectAllocations.length === 0) {
      return (
        <div className="bg-slate-50 rounded-xl p-4 text-center text-[12px] text-slate-400">
          No project allocations for this period
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Stacked bar visualization */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-700">Project Weight Distribution</h4>
            <span className="text-[10px] text-slate-400">{source}</span>
          </div>
          <div className="flex h-6 rounded-full overflow-hidden bg-slate-100 mb-3">
            {scCalc.projectAllocations.map((p, i) => (
              <div key={p.projectName} className={`${PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length]} transition-all duration-500 flex items-center justify-center`}
                style={{width: `${Math.max(p.weight * 100, 3)}%`}}>
                <span className="text-[9px] text-white font-semibold truncate px-1">{p.weightPct}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {scCalc.projectAllocations.map((p, i) => (
              <span key={p.projectName} className="flex items-center gap-1 text-[10px]">
                <span className={`w-2.5 h-2.5 rounded-full ${PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length]}`}/>
                <span className="text-slate-700 font-medium">{p.projectName}</span>
                <span className="text-slate-400">({p.days}d)</span>
              </span>
            ))}
          </div>
        </div>

        {/* Per-project cost table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-2 px-3 text-[11px] font-medium text-slate-500">Project</th>
                <th className="text-center py-2 px-3 text-[11px] font-medium text-slate-500">Days</th>
                <th className="text-center py-2 px-3 text-[11px] font-medium text-slate-500">Weight</th>
                <th className="text-right py-2 px-3 text-[11px] font-medium text-slate-500">Salary Share</th>
                <th className="text-right py-2 px-3 text-[11px] font-medium text-slate-500">SC Share</th>
                <th className="text-right py-2 px-3 text-[11px] font-medium text-slate-500">SC Balance</th>
              </tr>
            </thead>
            <tbody>
              {scCalc.projectAllocations.map((p, i) => (
                <tr key={p.projectName} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2 px-3">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length]}`}/>
                      <span className="font-medium text-slate-900">{p.projectName}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center text-slate-600">{p.days}</td>
                  <td className="py-2 px-3 text-center text-slate-600">{p.weightPct}</td>
                  <td className="py-2 px-3 text-right text-slate-900">{formatPKR(p.salaryShare)}</td>
                  <td className="py-2 px-3 text-right text-slate-900">{formatPKR(p.scShare)}</td>
                  <td className="py-2 px-3 text-right text-amber-600">{formatPKR(p.scBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ========================================================================
  // RENDER: SC Component Breakdown Cards
  // ========================================================================
  const renderScComponentCards = (scCalc: PayrollResult) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        {key:'otherPayable' as const, label:'Other Payable', rate:'8.33%', value: scCalc.scComponents.otherPayable},
        {key:'earnedLeave' as const, label:'Earned Leave', rate:'8.33%', value: scCalc.scComponents.earnedLeave},
        {key:'sickLeave' as const, label:'Sick Leave', rate:'1.67%', value: scCalc.scComponents.sickLeave},
        {key:'casualLeave' as const, label:'Casual Leave', rate:'1.67%', value: scCalc.scComponents.casualLeave},
      ].map(comp => {
        const colors = SC_COMPONENT_COLORS[comp.key]
        return (
          <div key={comp.key} className={`${colors.bg} border ${colors.border} rounded-xl p-3`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{colors.icon}</span>
              <span className={`text-[10px] ${colors.text} font-medium`}>{comp.label}</span>
            </div>
            <p className={`text-base font-semibold ${colors.text}`}>{formatPKR(comp.value)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{comp.rate} of SC</p>
          </div>
        )
      })}
    </div>
  )

  // ========================================================================
  // RENDER: Tab 1 — Salary History
  // ========================================================================
  const renderSalaryHistory = () => (
    <div className="space-y-4">
      {/* YTD summary cards */}
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
          <p className="text-base font-semibold text-slate-900">{paidRows.length}</p>
        </div>
      </div>

      {/* Run Payroll Calculation (admin only) */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-slate-600"/>
              <h4 className="text-xs font-semibold text-slate-700">Payroll Calculation</h4>
            </div>
            <div className="flex items-center gap-2">
              <Select value={payrollMonth} onValueChange={setPayrollMonth}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {availableMonths.map(m=><SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="h-7 text-[11px] bg-slate-900 text-white hover:bg-slate-800 px-3"
                onClick={handleRunPayroll} disabled={payrollLoading}>
                {payrollLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin"/> : <Calculator className="h-3 w-3 mr-1"/>}
                {apiPayrollResult ? 'Recalculate' : 'Calculate'}
              </Button>
            </div>
          </div>
          {apiPayrollResult && (
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">Eligible Days</span>
                  <p className="font-semibold text-slate-900">{apiPayrollResult.eligibleDays}/{apiPayrollResult.daysInMonth}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">Working Ratio</span>
                  <p className="font-semibold text-slate-900">{(apiPayrollResult.workingRatio * 100).toFixed(2)}%</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">Final SC Payable</span>
                  <p className="font-semibold text-emerald-600">{formatPKR(apiPayrollResult.finalSC)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">SC Balance (deferred)</span>
                  <p className="font-semibold text-amber-600">{formatPKR(apiPayrollResult.scBalance)}</p>
                </div>
              </div>
              {/* Deductions summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">Gross Salary</span>
                  <p className="font-semibold text-slate-900">{formatPKR(apiPayrollResult.grossSalary)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">Income Tax</span>
                  <p className="font-semibold text-red-500">{formatPKR(apiPayrollResult.deductions.incomeTax)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">Loan Deduction</span>
                  <p className="font-semibold text-red-500">{formatPKR(apiPayrollResult.deductions.loanDeduction)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">Net Pay</span>
                  <p className="font-semibold text-emerald-600">{formatPKR(apiPayrollResult.netPay)}</p>
                </div>
              </div>
              {renderProjectCostDistribution(apiPayrollResult, 'API Calculation')}
            </div>
          )}
          {!apiPayrollResult && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[11px] text-slate-400 mb-2">Click Calculate to run payroll for {fmtMonth(payrollMonth)}</p>
            </div>
          )}
        </div>
      )}

      {/* Salary table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {salaryHistoryLoading ? (
            <div className="p-8 text-center text-sm text-slate-400">
              <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin"/>
              Loading salary history...
            </div>
          ) : salaryHistory.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No salary history found. Run payroll to generate records.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Month</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">WD</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Present</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Absent</th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Earned</th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Deductions</th>
                  <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Net Paid</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Status</th>
                  <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {salaryHistory.map(row => {
                  const isExp = expandedPayslip === row.month
                  return (
                    <React.Fragment key={row.month}>
                      <tr className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isExp?'bg-slate-50/50':''}`}>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{fmtMonth(row.month)}</td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{row.workingDays}</td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{row.present}</td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{row.absent}</td>
                        <td className="py-2.5 px-3 text-right text-slate-900">{formatPKR(row.earnedSalary)}</td>
                        <td className="py-2.5 px-3 text-right text-red-500">{formatPKR(row.totalDeductions)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900">{formatPKR(row.netPaid)}</td>
                        <td className="py-2.5 px-3 text-center"><SalaryBadge status={row.status}/></td>
                        <td className="py-2.5 px-3 text-center">
                          <button className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-slate-100 transition-colors" onClick={()=>setExpandedPayslip(isExp?null:row.month)}>
                            <Eye className="h-3.5 w-3.5 text-slate-500"/>
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={9} className="p-0">
                          <div className="overflow-hidden transition-all duration-200 ease-in-out" style={{maxHeight:isExp?'800px':'0px',opacity:isExp?1:0}}>
                            <div className="bg-slate-50/70 px-6 py-4 border-b border-slate-100">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-semibold text-slate-700">Payslip — {fmtMonth(row.month)}</h4>
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={()=>window.print()}><Printer className="h-3 w-3 mr-1"/>Print</Button>
                              </div>
                              <div className="grid grid-cols-2 gap-6 max-w-2xl">
                                <div>
                                  <h5 className="text-[11px] font-semibold text-slate-700 mb-2 uppercase tracking-wider">Earnings</h5>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[12px]"><span className="text-slate-500">Basic</span><span className="text-slate-900">{formatPKR(row.earnings.basic)}</span></div>
                                    <div className="flex justify-between text-[12px]"><span className="text-slate-500">Housing</span><span className="text-slate-900">{formatPKR(row.earnings.housing)}</span></div>
                                    <div className="flex justify-between text-[12px]"><span className="text-slate-500">Transport</span><span className="text-slate-900">{formatPKR(row.earnings.transport)}</span></div>
                                    <div className="flex justify-between text-[12px]"><span className="text-slate-500">Other Allowances</span><span className="text-slate-900">{formatPKR(row.earnings.other)}</span></div>
                                    <Separator className="my-1"/>
                                    <div className="flex justify-between text-[12px] font-semibold"><span>Total Earnings</span><span>{formatPKR(row.earnedSalary)}</span></div>
                                  </div>
                                </div>
                                <div>
                                  <h5 className="text-[11px] font-semibold text-slate-700 mb-2 uppercase tracking-wider">Deductions</h5>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[12px]"><span className="text-slate-500">Absent Deduction</span><span className="text-red-500">{formatPKR(row.deductionBreakdown.absentDeduction)}</span></div>
                                    <div className="flex justify-between text-[12px]"><span className="text-slate-500">Tax</span><span className="text-red-500">{formatPKR(row.deductionBreakdown.tax)}</span></div>
                                    <div className="flex justify-between text-[12px]"><span className="text-slate-500">Loan EMI</span><span className="text-red-500">{formatPKR(row.deductionBreakdown.loanEmi)}</span></div>
                                    <div className="flex justify-between text-[12px]"><span className="text-slate-500">SC Employee Share</span><span className="text-red-500">{formatPKR(row.deductionBreakdown.scEmployee)}</span></div>
                                    <Separator className="my-1"/>
                                    <div className="flex justify-between text-[12px] font-semibold"><span>Total Deductions</span><span className="text-red-500">{formatPKR(row.totalDeductions)}</span></div>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-slate-200 text-right">
                                <span className="text-[12px] text-slate-500 mr-3">Net Pay:</span>
                                <span className="text-[14px] font-semibold text-emerald-600">{formatPKR(row.netPaid)}</span>
                              </div>
                              {/* YTD Tax Info */}
                              {row.taxBreakdown && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  <h5 className="text-[11px] font-semibold text-slate-700 mb-2 uppercase tracking-wider">YTD Tax Information</h5>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {row.taxBreakdown.ytdIncome != null && (
                                      <div className="bg-white rounded-lg p-2 border border-slate-100">
                                        <span className="text-[10px] text-slate-500 block">YTD Income</span>
                                        <span className="text-[12px] font-semibold text-slate-900">{formatPKR(row.taxBreakdown.ytdIncome)}</span>
                                      </div>
                                    )}
                                    {row.taxBreakdown.projectedAnnualIncome != null && (
                                      <div className="bg-white rounded-lg p-2 border border-slate-100">
                                        <span className="text-[10px] text-slate-500 block">Projected Annual</span>
                                        <span className="text-[12px] font-semibold text-slate-900">{formatPKR(row.taxBreakdown.projectedAnnualIncome)}</span>
                                      </div>
                                    )}
                                    {row.taxBreakdown.taxSlab && (
                                      <div className="bg-white rounded-lg p-2 border border-slate-100">
                                        <span className="text-[10px] text-slate-500 block">Tax Slab</span>
                                        <span className="text-[12px] font-semibold text-slate-900">{row.taxBreakdown.taxSlab}</span>
                                      </div>
                                    )}
                                    {row.taxBreakdown.taxPaidYtd != null && (
                                      <div className="bg-white rounded-lg p-2 border border-slate-100">
                                        <span className="text-[10px] text-slate-500 block">Tax Paid YTD</span>
                                        <span className="text-[12px] font-semibold text-red-500">{formatPKR(row.taxBreakdown.taxPaidYtd)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {/* Project Allocation Breakdown */}
                              {row.projectAllocations && row.projectAllocations.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  <h5 className="text-[11px] font-semibold text-slate-700 mb-2 uppercase tracking-wider">Project Allocation</h5>
                                  <div className="overflow-hidden rounded-lg border border-slate-200">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50">
                                          <th className="text-left py-1.5 px-2 text-[10px] font-medium text-slate-500">Project</th>
                                          <th className="text-center py-1.5 px-2 text-[10px] font-medium text-slate-500">Days</th>
                                          <th className="text-center py-1.5 px-2 text-[10px] font-medium text-slate-500">Weight</th>
                                          <th className="text-right py-1.5 px-2 text-[10px] font-medium text-slate-500">Salary Share</th>
                                          <th className="text-right py-1.5 px-2 text-[10px] font-medium text-slate-500">SC Share</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {row.projectAllocations.map((pa, i) => (
                                          <tr key={pa.projectId || i} className="border-b border-slate-50 last:border-0">
                                            <td className="py-1.5 px-2">
                                              <span className="flex items-center gap-1.5">
                                                <span className={`w-2 h-2 rounded-full ${PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length]}`}/>
                                                <span className="font-medium text-slate-900">{pa.projectName}</span>
                                              </span>
                                            </td>
                                            <td className="py-1.5 px-2 text-center text-slate-600">{pa.days}</td>
                                            <td className="py-1.5 px-2 text-center text-slate-600">{pa.weightPct}</td>
                                            <td className="py-1.5 px-2 text-right text-slate-900">{formatPKR(pa.salaryShare)}</td>
                                            <td className="py-1.5 px-2 text-right text-slate-900">{formatPKR(pa.scShare)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )

  // ========================================================================
  // RENDER: Tab 2 — Social Charges
  // ========================================================================
  const renderSocialCharges = () => {
    const scCalc = effectivePayroll

    return (
      <div className="space-y-4">
        <div className="border-l-4 border-amber-400 bg-amber-50 rounded-lg p-4 text-[13px] text-amber-800">
          <div className="flex items-start gap-2"><Info className="h-4 w-4 shrink-0 mt-0.5"/><span>Social charges (SC) are calculated at <strong>20% of monthly salary</strong> per AGES Consultants methodology. Components: Other Payable (8.33%), Earned Leave (8.33%), Sick Leave (1.67%), Casual Leave (1.67%). Leave days reduce the final payable SC.</span></div>
        </div>

        {/* Summary: Accrued vs Paid vs Outstanding */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] text-slate-500">Total SC Accrued</p>
            <p className="text-base font-semibold text-slate-900">{formatPKR(totalScAccrued)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] text-slate-500">Total SC Paid</p>
            <p className="text-base font-semibold text-emerald-600">{formatPKR(totalScPaid)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] text-slate-500">Outstanding Balance</p>
            <p className="text-base font-semibold text-amber-600">{formatPKR(scOutstanding)}</p>
          </div>
        </div>

        {/* SC Component Breakdown */}
        {scCalc && (
          <div>
            <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><PieChart className="h-3.5 w-3.5"/>SC Component Breakdown — {fmtMonth(payrollMonth)}</h3>
            {renderScComponentCards(scCalc)}
          </div>
        )}

        {/* Project-wise SC Distribution */}
        {scCalc && scCalc.projectAllocations.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5"/>Project-wise SC Distribution — {fmtMonth(payrollMonth)}</h3>
            {renderProjectCostDistribution(scCalc, 'API Calculation')}
          </div>
        )}

        {/* SC Ledger Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            {scLedger.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                No SC ledger entries. Run payroll to generate records.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Month</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Gross Salary</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">SC Rate</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">SC Amount</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Paid</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Outstanding</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Status</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Paid On</th>
                  </tr>
                </thead>
                <tbody>
                  {scLedger.map(row => (
                    <tr key={row.month} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${row.status==='Pending'?'bg-amber-50/40':row.status==='Partial'?'bg-blue-50/30':''}`}>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{fmtMonth(row.month)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{formatPKR(row.grossSalary)}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{(row.scRate*100).toFixed(0)}%</td>
                      <td className="py-2.5 px-3 text-right text-slate-900">{formatPKR(row.scAmount)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{formatPKR(row.paid)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{formatPKR(row.outstanding)}</td>
                      <td className="py-2.5 px-3 text-center"><ScBadge status={row.status}/></td>
                      <td className="py-2.5 px-3 text-slate-500">{row.paidOn ? formatDate(row.paidOn) : '—'}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 bg-slate-50/50 font-semibold">
                    <td className="py-2.5 px-3 text-slate-900">Total</td>
                    <td></td><td></td>
                    <td className="py-2.5 px-3 text-right text-slate-900">{formatPKR(totalScAccrued)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600">{formatPKR(totalScPaid)}</td>
                    <td className="py-2.5 px-3 text-right text-amber-600">{formatPKR(scOutstanding)}</td>
                    <td></td><td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Record SC Payment */}
        {isAdmin && (
          <div>
            <Button className="bg-slate-900 text-white rounded-lg px-4 py-2 h-9 text-xs hover:bg-slate-800" onClick={()=>setShowScForm(!showScForm)}>
              {showScForm ? 'Cancel' : 'Record SC Payment'}
            </Button>
            <div className="overflow-hidden transition-all duration-200 ease-in-out" style={{maxHeight:showScForm?'400px':'0px',opacity:showScForm?1:0}}>
              <div className="bg-white border border-slate-200 rounded-xl p-5 mt-3 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><Label className="text-xs">Amount Paid (PKR)</Label><Input type="number" className="h-8 text-xs mt-1" placeholder="0" value={scPayment.amount} onChange={e=>setScPayment(p=>({...p,amount:e.target.value}))}/></div>
                  <div><Label className="text-xs">Payment Date</Label><Input type="date" className="h-8 text-xs mt-1" value={scPayment.date} onChange={e=>setScPayment(p=>({...p,date:e.target.value}))}/></div>
                  <div><Label className="text-xs">Reference / Bank Ref</Label><Input className="h-8 text-xs mt-1" placeholder="e.g. CHQ-12345" value={scPayment.reference} onChange={e=>setScPayment(p=>({...p,reference:e.target.value}))}/></div>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Covers Months</Label>
                  <div className="flex flex-wrap gap-3">
                    {pendingScMonths.length === 0 && <span className="text-[12px] text-slate-400">No pending months</span>}
                    {scLedger.map(r=> (
                      <label key={r.month} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={scCoveredMonths.includes(r.month)}
                          onCheckedChange={c=>{if(c) setScCoveredMonths(p=>[...p,r.month]); else setScCoveredMonths(p=>p.filter(x=>x!==r.month))}}
                          disabled={r.status==='Remitted'}
                        />
                        <span className={`text-[12px] ${r.status==='Remitted'?'text-slate-300 line-through':'text-slate-700'}`}>{fmtMonth(r.month)}</span>
                        <span className={`text-[10px] ${r.status==='Pending'?'text-amber-500':r.status==='Partial'?'text-blue-500':'text-emerald-500'}`}>{r.status}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button className="bg-slate-900 text-white rounded-lg px-4 py-2 h-9 text-xs hover:bg-slate-800" onClick={handleScPaymentSave}>Save Payment</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ========================================================================
  // RENDER: Tab 3 — Loans & Advances
  // ========================================================================
  const renderLoansAdvances = () => {
    const totalLiability = loanOutstanding + advBalance
    return (
      <div className="space-y-5">
        {loansLoading && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin"/>Loading loans & advances...
          </div>
        )}
        {/* Loans */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Active Loans</h3>
            {isAdmin && <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={()=>setNewLoanOpen(true)}><Plus className="h-3 w-3 mr-1"/>New Loan</Button>}
          </div>
          {loans.length === 0 && !loansLoading && <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">No active loans</div>}
          {loans.map(loan => {
            const isExp = expandedLoan === loan.id
            const paidTotal = loan.principal - loan.remaining
            const pct = loan.principal > 0 ? Math.round(paidTotal / loan.principal * 100) : 0
            return (
              <div key={loan.id} className="bg-white border border-slate-200 rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-slate-900">{loan.id}</span><LoanBadge status={loan.status}/></div>
                    <span className="text-[11px] text-slate-500">{loan.loanType} Loan</span>
                  </div>
                  <button className="text-slate-400 hover:text-slate-600 transition-colors" onClick={()=>setExpandedLoan(isExp?null:loan.id)}>
                    {isExp ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px] mb-3">
                  <div><span className="text-slate-500">Principal:</span> <span className="font-medium text-slate-900">{formatPKR(loan.principal)}</span></div>
                  <div><span className="text-slate-500">Disbursed:</span> <span className="font-medium text-slate-900">{formatDate(loan.disbursedDate)}</span></div>
                  <div><span className="text-slate-500">Tenure:</span> <span className="font-medium text-slate-900">{loan.tenure} months</span></div>
                  <div><span className="text-slate-500">EMI:</span> <span className="font-medium text-slate-900">{formatPKR(loan.emi)}/mo</span></div>
                  <div><span className="text-slate-500">Remaining:</span> <span className="font-medium text-red-500">{formatPKR(loan.remaining)}</span></div>
                  <div><span className="text-slate-500">Months Left:</span> <span className="font-medium text-slate-900">{loan.monthsLeft}</span></div>
                </div>
                <div className="mb-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1"><span>{formatPKR(paidTotal)} paid</span><span>{pct}%</span></div>
                  <div className="bg-slate-100 rounded-full h-2 w-full"><div className="bg-slate-900 rounded-full h-2 transition-all duration-700" style={{width:`${pct}%`}}/></div>
                </div>
                {isExp && loan.schedule.length > 0 && (
                  <div className="mt-3 overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <thead><tr className="border-b border-slate-100"><th className="text-left py-1.5 px-2 text-slate-500">Mo</th><th className="text-right py-1.5 px-2 text-slate-500">EMI</th><th className="text-right py-1.5 px-2 text-slate-500">Principal</th><th className="text-right py-1.5 px-2 text-slate-500">Interest</th><th className="text-right py-1.5 px-2 text-slate-500">Balance</th></tr></thead>
                      <tbody>{loan.schedule.map(s=><tr key={s.month} className="border-b border-slate-50"><td className="py-1.5 px-2 text-slate-700">{s.month}</td><td className="py-1.5 px-2 text-right text-slate-900">{formatPKR(s.emi)}</td><td className="py-1.5 px-2 text-right text-slate-600">{formatPKR(s.principal)}</td><td className="py-1.5 px-2 text-right text-slate-600">{formatPKR(s.interest)}</td><td className="py-1.5 px-2 text-right text-slate-900">{formatPKR(s.balance)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Advances */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Salary Advances</h3>
            {isAdmin && <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={()=>setNewAdvOpen(true)}><Plus className="h-3 w-3 mr-1"/>New Advance</Button>}
          </div>
          {advances.length === 0 && !loansLoading && <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">No active advances</div>}
          {advances.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-100 bg-slate-50/50"><th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Date</th><th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Amount</th><th className="text-left py-2.5 px-3 text-[11px] font-medium text-slate-500">Purpose</th><th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Recovered</th><th className="text-right py-2.5 px-3 text-[11px] font-medium text-slate-500">Balance</th><th className="text-center py-2.5 px-3 text-[11px] font-medium text-slate-500">Status</th></tr></thead>
                  <tbody>
                    {advances.map(a => {
                      const pct = a.amount > 0 ? Math.round(a.recovered / a.amount * 100) : 0
                      return (
                        <tr key={a.id} className="border-b border-slate-50">
                          <td className="py-2.5 px-3 font-medium text-slate-900">{formatDate(a.date)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-900">{formatPKR(a.amount)}</td>
                          <td className="py-2.5 px-3 text-slate-600">{a.purpose}</td>
                          <td className="py-2.5 px-3 text-right">
                            <div>{formatPKR(a.recovered)}</div>
                            <div className="bg-slate-100 rounded-full h-1.5 w-16 mt-1"><div className="bg-slate-900 rounded-full h-1.5 transition-all duration-700" style={{width:`${pct}%`}}/></div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-orange-500 font-medium">{formatPKR(a.balance)}</td>
                          <td className="py-2.5 px-3 text-center"><AdvBadge status={a.status}/></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {/* Total Liability */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Total Liability (Loans + Advances)</span>
          <span className="text-base font-semibold text-red-600">{formatPKR(totalLiability)}</span>
        </div>

        {/* New Loan Modal */}
        <Dialog open={newLoanOpen} onOpenChange={setNewLoanOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add New Loan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Loan Type</Label><Select value={newLoanForm.loanType} onValueChange={v=>setNewLoanForm(p=>({...p,loanType:v}))}><SelectTrigger className="h-8 text-xs mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Personal">Personal</SelectItem><SelectItem value="Emergency">Emergency</SelectItem><SelectItem value="Education">Education</SelectItem><SelectItem value="Vehicle">Vehicle</SelectItem><SelectItem value="Housing">Housing</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">Amount (PKR)</Label><Input type="number" className="h-8 text-xs mt-1" value={newLoanForm.amount} onChange={e=>setNewLoanForm(p=>({...p,amount:e.target.value}))}/></div>
              <div><Label className="text-xs">Disbursement Date</Label><Input type="date" className="h-8 text-xs mt-1" value={newLoanForm.date} onChange={e=>setNewLoanForm(p=>({...p,date:e.target.value}))}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Tenure (months)</Label><Input type="number" className="h-8 text-xs mt-1" value={newLoanForm.tenure} onChange={e=>setNewLoanForm(p=>({...p,tenure:e.target.value}))}/></div>
                <div><Label className="text-xs">Interest Rate (% p.a.)</Label><Input type="number" className="h-8 text-xs mt-1" value={newLoanForm.interestRate} onChange={e=>setNewLoanForm(p=>({...p,interestRate:e.target.value}))}/></div>
              </div>
              {newLoanForm.amount && newLoanForm.tenure && newLoanForm.interestRate && (
                <div className="bg-slate-50 rounded-lg p-3 text-center"><span className="text-xs text-slate-500">Calculated EMI: </span><span className="text-sm font-semibold text-slate-900">{formatPKR(calcEMI(parseFloat(newLoanForm.amount)||0, parseFloat(newLoanForm.interestRate)||0, parseInt(newLoanForm.tenure)||1))}</span></div>
              )}
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setNewLoanOpen(false)}>Cancel</Button><Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={handleNewLoan}>Add Loan</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Advance Modal */}
        <Dialog open={newAdvOpen} onOpenChange={setNewAdvOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add New Advance</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Amount (PKR)</Label><Input type="number" className="h-8 text-xs mt-1" value={newAdvForm.amount} onChange={e=>setNewAdvForm(p=>({...p,amount:e.target.value}))}/></div>
              <div><Label className="text-xs">Purpose</Label><Input className="h-8 text-xs mt-1" value={newAdvForm.purpose} onChange={e=>setNewAdvForm(p=>({...p,purpose:e.target.value}))}/></div>
              <div><Label className="text-xs">Recovery Mode</Label><Select value={newAdvForm.recoveryMode} onValueChange={v=>setNewAdvForm(p=>({...p,recoveryMode:v}))}><SelectTrigger className="h-8 text-xs mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Installments">Installments</SelectItem><SelectItem value="One-time">One-time</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs">Monthly Recovery Amount</Label><Input type="number" className="h-8 text-xs mt-1" value={newAdvForm.monthlyRecovery} onChange={e=>setNewAdvForm(p=>({...p,monthlyRecovery:e.target.value}))}/></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={()=>setNewAdvOpen(false)}>Cancel</Button><Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={handleNewAdvance}>Add Advance</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ========================================================================
  // RENDER: Tab 4 — Attendance Summary
  // ========================================================================
  const renderAttendance = () => (
    <div className="space-y-4">
      {/* Month Selector */}
      <div className="flex items-center gap-3">
        <Label className="text-xs text-slate-500">Month</Label>
        <Select value={attMonth} onValueChange={v=>setAttMonths(p=>({...p,[empId]:v}))}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue/></SelectTrigger>
          <SelectContent>
            {availableMonths.map(m=><SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        {attLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400"/>}
      </div>

      {attLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
          <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin"/>Loading attendance data...
        </div>
      ) : Object.keys(attData).length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
          No attendance data found for {fmtMonth(attMonth)}.
        </div>
      ) : (
        <>
          {/* Calendar Heatmap */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d=><div key={d} className="text-center text-[10px] font-medium text-slate-400 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {calendarWeeks.flat().map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} className="h-8"/>
                const entry = attData[day]
                if (!entry) return <div key={day} className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] text-slate-300">{day}</div>
                const color = STATUS_COLORS[entry.status] || 'bg-slate-50 text-slate-400'
                return (
                  <TooltipProvider key={day}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-semibold cursor-default ${color}`}>
                          {day}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[11px]">
                        Day {day} — {STATUS_LABELS[entry.status] || entry.status}{entry.project ? ` — ${entry.project}` : ''}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-2">
            {[
              {label:'Present',count:attPresent,color:'bg-emerald-50 text-emerald-700 border-emerald-200'},
              {label:'Absent',count:attAbsent,color:'bg-red-50 text-red-700 border-red-200'},
              {label:'Leave',count:attLeave,color:'bg-orange-50 text-orange-700 border-orange-200'},
              {label:'Weekend Work',count:attWeekend,color:'bg-blue-50 text-blue-700 border-blue-200'},
              {label:'Holiday Work',count:attHoliday,color:'bg-purple-50 text-purple-700 border-purple-200'},
              {label:'Billable',count:billableDays,color:'bg-teal-50 text-teal-700 border-teal-200'},
              {label:'Non-Billable',count:nonBillableDays,color:'bg-slate-50 text-slate-700 border-slate-200'},
            ].map(s=>(
              <span key={s.label} className={`text-[11px] px-3 py-1 rounded-full font-medium border ${s.color}`}>{s.label}: {s.count}</span>
            ))}
          </div>

          {/* Project Allocation Stacked Bar */}
          {projectAlloc.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5"/>Project Allocation — Stacked View
              </h4>
              {/* Horizontal stacked bar */}
              <div className="flex h-8 rounded-lg overflow-hidden bg-slate-100 mb-3">
                {projectAlloc.map((p, i) => (
                  <TooltipProvider key={p.name}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`${PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length]} flex items-center justify-center transition-all duration-500 cursor-default`}
                          style={{width: `${p.pct}%`}}>
                          <span className="text-[10px] text-white font-semibold truncate px-1">{p.name}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="text-[11px]">{p.name}: {p.days} days ({p.pct}%)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>

              {/* Per-project bars */}
              <div className="space-y-3">
                {projectAlloc.map((p,i) => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length]}`}/>
                        <span className="text-slate-700 font-medium">{p.name}</span>
                      </span>
                      <span className="text-slate-500">{p.days} days ({p.pct}%)</span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-2 w-full">
                      <div className={`${PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length]} rounded-full h-2 transition-all duration-700`} style={{width:`${p.pct}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project Allocation Detail */}
          {projectAlloc.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-3">Project Allocation Details</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-[11px] font-medium text-slate-500">Project</th>
                      <th className="text-center py-2 px-3 text-[11px] font-medium text-slate-500">Days</th>
                      <th className="text-center py-2 px-3 text-[11px] font-medium text-slate-500">Allocation</th>
                      <th className="text-right py-2 px-3 text-[11px] font-medium text-slate-500">Est. Salary Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectAlloc.map((p,i) => {
                      const daysInMonth = attStats.totalDays || 30
                      return (
                        <tr key={p.name} className="border-b border-slate-50">
                          <td className="py-2 px-3">
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length]}`}/>
                              <span className="font-medium text-slate-900">{p.name}</span>
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600">{p.days}</td>
                          <td className="py-2 px-3 text-center text-slate-600">{p.pct}%</td>
                          <td className="py-2 px-3 text-right text-slate-900">{formatPKR(Math.round((emp?.monthlySalary || emp?.baseSalary || 0) * p.days / daysInMonth))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )

  // ========================================================================
  // RENDER: Tab 5 — Documents
  // ========================================================================
  const renderDocuments = () => {
    const docsList = docs.length > 0 ? docs : [
      { id:1, name:'CNIC Copy', type:'pdf', uploaded: emp?.joinDate || new Date().toISOString().split('T')[0], size:'—' },
      { id:2, name:'Employment Contract', type:'pdf', uploaded: emp?.joinDate || new Date().toISOString().split('T')[0], size:'—' },
    ]

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {docsList.map(doc => {
            const isReplacing = replaceDocId === doc.id
            const typeColor = doc.type === 'pdf' ? 'bg-red-100 text-red-700' : doc.type === 'zip' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
            return (
              <div key={doc.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-[10px] font-bold ${typeColor}`}>
                    {doc.type.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 truncate">{doc.name}</p>
                    <p className="text-[11px] text-slate-500">{formatDate(doc.uploaded)} • {doc.size}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={()=>setPreviewDoc(doc)}>
                    <Eye className="h-3 w-3 mr-1"/>View
                  </Button>
                  {isAdmin && !isReplacing && (
                    <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={()=>setReplaceDocId(doc.id)}>
                      <Edit3 className="h-3 w-3 mr-1"/>Replace
                    </Button>
                  )}
                  {isAdmin && isReplacing && (
                    <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={()=>setReplaceDocId(null)}>Cancel</Button>
                  )}
                </div>
                {isReplacing && (
                  <div className="mt-2">
                    <Input type="file" className="h-8 text-xs" onChange={() => { setReplaceDocId(null); toast.success('Document replaced successfully') }} accept=".pdf,.zip,.jpg,.png" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {isAdmin && (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-slate-300 transition-colors">
            <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2"/>
            <p className="text-sm text-slate-500 mb-1">Upload New Document</p>
            <p className="text-[11px] text-slate-400 mb-3">PDF, ZIP, or image files</p>
            <Input type="file" className="max-w-xs mx-auto h-8 text-xs" onChange={() => toast.success('Document uploaded successfully')} accept=".pdf,.zip,.jpg,.png"/>
          </div>
        )}
        {/* Document Preview Sheet */}
        <Sheet open={!!previewDoc} onOpenChange={()=>setPreviewDoc(null)}>
          <SheetContent className="w-full sm:max-w-lg">
            {previewDoc && (
              <>
                <SheetHeader>
                  <SheetTitle className="text-left">{previewDoc.name}</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-sm font-bold ${previewDoc.type==='pdf'?'bg-red-100 text-red-700':previewDoc.type==='zip'?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>
                      {previewDoc.type.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{previewDoc.name}</p>
                      <p className="text-[12px] text-slate-500">Uploaded: {formatDate(previewDoc.uploaded)}</p>
                      <p className="text-[12px] text-slate-500">Size: {previewDoc.size}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="bg-slate-50 rounded-xl p-8 text-center">
                    <FileText className="h-12 w-12 text-slate-300 mx-auto mb-2"/>
                    <p className="text-sm text-slate-500">Document preview</p>
                    <p className="text-[11px] text-slate-400 mt-1">File: {previewDoc.name}.{previewDoc.type}</p>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  // ========================================================================
  // RENDER: Main Layout
  // ========================================================================
  if (employeesLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-slate-100 rounded-xl"/>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-4">
            <div className="h-64 bg-slate-100 rounded-xl"/>
            <div className="h-24 bg-slate-100 rounded-xl"/>
          </div>
          <div className="lg:col-span-2 h-96 bg-slate-100 rounded-xl"/>
        </div>
      </div>
    )
  }

  if (employees.length === 0 && !employeesLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <Info className="h-10 w-10 text-slate-300 mx-auto mb-3"/>
        <h3 className="text-lg font-semibold text-slate-700 mb-1">No Employees Found</h3>
        <p className="text-sm text-slate-400">There are no employees in the system. Add employees first to view their profiles.</p>
      </div>
    )
  }

  if (!emp) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <Info className="h-10 w-10 text-slate-300 mx-auto mb-3"/>
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Select an Employee</h3>
        <p className="text-sm text-slate-400">Use the search bar above to find and select an employee to view their profile.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-slate-100 rounded-xl"/>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-4">
            <div className="h-64 bg-slate-100 rounded-xl"/>
            <div className="h-24 bg-slate-100 rounded-xl"/>
          </div>
          <div className="lg:col-span-2 h-96 bg-slate-100 rounded-xl"/>
        </div>
      </div>
    )
  }

  return (
    <div className={`transition-opacity duration-150`}>
      {renderSearch()}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {renderProfileCard()}
          {renderQuickStats()}
        </div>
        {/* Right Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-1 bg-white border border-slate-200 rounded-xl p-1.5">
            {tabs.map(t => (
              <button key={t.key} className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab===t.key?'bg-slate-900 text-white':'text-slate-500 hover:text-slate-700'}`} onClick={()=>setActiveTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          {/* Tab Content */}
          <div className="transition-opacity duration-150">
            {activeTab==='salary-history' && renderSalaryHistory()}
            {activeTab==='social-charges' && renderSocialCharges()}
            {activeTab==='loans-advances' && renderLoansAdvances()}
            {activeTab==='attendance-summary' && renderAttendance()}
            {activeTab==='documents' && renderDocuments()}
          </div>
        </div>
      </div>
    </div>
  )
}
