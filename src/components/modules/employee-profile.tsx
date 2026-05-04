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
  id: string; name: string; designation: string; department: string
  joinDate: string; location: string; bank: string; phone: string; email: string
  contractType: string; monthlySalary: number; workingDays: number
  scRate: number; taxRate: number; status: string; projects: string[]
  loanEMI: number; advanceBalance: number
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
}

// ── CONSTANTS ──────────────────────────────────────────────────────────

const EMPLOYEES: EmployeeData[] = [
  { id:'EMP-0001', name:'Ahmed Khan', designation:'Senior Accountant', department:'Finance', joinDate:'2021-03-15', location:'Peshawar HQ', bank:'HBL ****4521', phone:'+92-301-1234567', email:'ahmed.khan@acctfin.com', contractType:'Permanent', monthlySalary:85000, workingDays:26, scRate:0.20, taxRate:0.05, status:'Active', projects:['BTHPP','AGES HO'], loanEMI:5556, advanceBalance:5000 },
  { id:'EMP-0002', name:'Fatima Ali', designation:'HR Manager', department:'HR', joinDate:'2020-07-01', location:'Peshawar HQ', bank:'MCB ****8834', phone:'+92-333-9876543', email:'fatima.ali@acctfin.com', contractType:'Permanent', monthlySalary:95000, workingDays:26, scRate:0.20, taxRate:0.05, status:'Active', projects:['BTHPP'], loanEMI:0, advanceBalance:0 },
  { id:'EMP-0003', name:'Muhammad Raza', designation:'Junior Accountant', department:'Finance', joinDate:'2023-01-10', location:'Islamabad Office', bank:'UBL ****2210', phone:'+92-300-1122334', email:'m.raza@acctfin.com', contractType:'Contract', monthlySalary:55000, workingDays:26, scRate:0.20, taxRate:0.0, status:'Active', projects:['AGES HO'], loanEMI:0, advanceBalance:10000 },
  { id:'EMP-0004', name:'Sara Ahmed', designation:'Finance Analyst', department:'Finance', joinDate:'2022-05-20', location:'Peshawar HQ', bank:'Allied ****6678', phone:'+92-321-5544332', email:'sara.ahmed@acctfin.com', contractType:'Permanent', monthlySalary:75000, workingDays:26, scRate:0.20, taxRate:0.05, status:'Active', projects:['BTHPP'], loanEMI:3000, advanceBalance:0 },
  { id:'EMP-0005', name:'Ali Hassan', designation:'Payroll Officer', department:'HR', joinDate:'2019-11-05', location:'Peshawar HQ', bank:'HBL ****9901', phone:'+92-345-6677889', email:'ali.hassan@acctfin.com', contractType:'Permanent', monthlySalary:70000, workingDays:26, scRate:0.20, taxRate:0.05, status:'Active', projects:['BTHPP','AGES HO','Proj Alpha'], loanEMI:0, advanceBalance:0 },
]

const ATT_MAY_2026: Record<string, Record<number, AttEntry>> = {
  'EMP-0001': {
    1:{status:'P',project:'BTHPP'},2:{status:'W',project:'BTHPP'},3:{status:'W',project:'BTHPP'},
    4:{status:'P',project:'AGES HO'},5:{status:'P',project:'AGES HO'},6:{status:'P',project:'BTHPP'},
    7:{status:'P',project:'BTHPP'},8:{status:'P',project:'BTHPP'},9:{status:'SL',project:null},
    10:{status:'SL',project:null},11:{status:'P',project:'AGES HO'},12:{status:'CL',project:null},
    13:{status:'P',project:'BTHPP'},14:{status:'P',project:'BTHPP'},15:{status:'P',project:'AGES HO'},
    16:{status:'W',project:'BTHPP'},17:{status:'W',project:'AGES HO'},18:{status:'P',project:'BTHPP'},
    19:{status:'P',project:'BTHPP'},20:{status:'A',project:null},21:{status:'P',project:'AGES HO'},
    22:{status:'P',project:'BTHPP'},23:{status:'W',project:'AGES HO'},24:{status:'W',project:'BTHPP'},
    25:{status:'P',project:'BTHPP'},26:{status:'P',project:'AGES HO'},27:{status:'P',project:'BTHPP'},
    28:{status:'P',project:'BTHPP'},29:{status:'EL',project:null},30:{status:'P',project:'BTHPP'},
    31:{status:'P',project:'BTHPP'}
  },
  'EMP-0002': {
    1:{status:'P',project:'BTHPP'},2:{status:'W',project:'BTHPP'},3:{status:'CO',project:null},
    4:{status:'P',project:'BTHPP'},5:{status:'P',project:'BTHPP'},6:{status:'P',project:'BTHPP'},
    7:{status:'P',project:'BTHPP'},8:{status:'P',project:'BTHPP'},9:{status:'W',project:'BTHPP'},10:{status:'CO',project:null},
    11:{status:'P',project:'BTHPP'},12:{status:'CL',project:null},13:{status:'P',project:'BTHPP'},
    14:{status:'P',project:'BTHPP'},15:{status:'P',project:'BTHPP'},16:{status:'W',project:'BTHPP'},17:{status:'CO',project:null},
    18:{status:'P',project:'BTHPP'},19:{status:'P',project:'BTHPP'},20:{status:'P',project:'BTHPP'},
    21:{status:'P',project:'BTHPP'},22:{status:'P',project:'BTHPP'},23:{status:'CO',project:null},24:{status:'CO',project:null},
    25:{status:'P',project:'BTHPP'},26:{status:'P',project:'BTHPP'},27:{status:'SL',project:null},
    28:{status:'P',project:'BTHPP'},29:{status:'P',project:'BTHPP'},30:{status:'W',project:'BTHPP'},31:{status:'CO',project:null}
  },
  'EMP-0003': {
    1:{status:'P',project:'AGES HO'},2:{status:'CO',project:null},3:{status:'CO',project:null},
    4:{status:'P',project:'AGES HO'},5:{status:'P',project:'AGES HO'},6:{status:'CL',project:null},
    7:{status:'P',project:'AGES HO'},8:{status:'P',project:'AGES HO'},9:{status:'CO',project:null},10:{status:'CO',project:null},
    11:{status:'P',project:'AGES HO'},12:{status:'P',project:'AGES HO'},13:{status:'A',project:null},
    14:{status:'P',project:'AGES HO'},15:{status:'P',project:'AGES HO'},16:{status:'W',project:'AGES HO'},17:{status:'CO',project:null},
    18:{status:'P',project:'AGES HO'},19:{status:'P',project:'AGES HO'},20:{status:'A',project:null},
    21:{status:'P',project:'AGES HO'},22:{status:'P',project:'AGES HO'},23:{status:'CO',project:null},24:{status:'CO',project:null},
    25:{status:'P',project:'AGES HO'},26:{status:'P',project:'AGES HO'},27:{status:'SL',project:null},
    28:{status:'P',project:'AGES HO'},29:{status:'P',project:'AGES HO'},30:{status:'CO',project:null},31:{status:'CO',project:null}
  },
  'EMP-0004': {
    1:{status:'P',project:'BTHPP'},2:{status:'W',project:'BTHPP'},3:{status:'CO',project:null},
    4:{status:'P',project:'BTHPP'},5:{status:'P',project:'BTHPP'},6:{status:'P',project:'BTHPP'},
    7:{status:'P',project:'BTHPP'},8:{status:'P',project:'BTHPP'},9:{status:'SL',project:null},10:{status:'CO',project:null},
    11:{status:'P',project:'BTHPP'},12:{status:'P',project:'BTHPP'},13:{status:'P',project:'BTHPP'},
    14:{status:'P',project:'BTHPP'},15:{status:'P',project:'BTHPP'},16:{status:'W',project:'BTHPP'},17:{status:'W',project:'BTHPP'},
    18:{status:'P',project:'BTHPP'},19:{status:'P',project:'BTHPP'},20:{status:'P',project:'BTHPP'},
    21:{status:'P',project:'BTHPP'},22:{status:'P',project:'BTHPP'},23:{status:'CO',project:null},24:{status:'CO',project:null},
    25:{status:'P',project:'BTHPP'},26:{status:'P',project:'BTHPP'},27:{status:'P',project:'BTHPP'},
    28:{status:'CL',project:null},29:{status:'P',project:'BTHPP'},30:{status:'W',project:'BTHPP'},31:{status:'CO',project:null}
  },
  'EMP-0005': {
    1:{status:'P',project:'BTHPP'},2:{status:'W',project:'AGES HO'},3:{status:'W',project:'BTHPP'},
    4:{status:'P',project:'Proj Alpha'},5:{status:'P',project:'BTHPP'},6:{status:'P',project:'AGES HO'},
    7:{status:'P',project:'BTHPP'},8:{status:'P',project:'Proj Alpha'},9:{status:'W',project:'BTHPP'},10:{status:'CO',project:null},
    11:{status:'P',project:'AGES HO'},12:{status:'P',project:'BTHPP'},13:{status:'P',project:'Proj Alpha'},
    14:{status:'P',project:'BTHPP'},15:{status:'P',project:'AGES HO'},16:{status:'W',project:'BTHPP'},17:{status:'W',project:'Proj Alpha'},
    18:{status:'P',project:'BTHPP'},19:{status:'P',project:'AGES HO'},20:{status:'P',project:'BTHPP'},
    21:{status:'P',project:'Proj Alpha'},22:{status:'P',project:'BTHPP'},23:{status:'W',project:'AGES HO'},24:{status:'W',project:'BTHPP'},
    25:{status:'P',project:'AGES HO'},26:{status:'P',project:'BTHPP'},27:{status:'P',project:'Proj Alpha'},
    28:{status:'P',project:'BTHPP'},29:{status:'P',project:'AGES HO'},30:{status:'W',project:'BTHPP'},31:{status:'CO',project:null}
  },
}

const DEFAULT_DOCS: DocData[] = [
  { id:1, name:'CNIC', type:'pdf', uploaded:'2021-03-15', size:'234 KB' },
  { id:2, name:'Employment Contract', type:'pdf', uploaded:'2021-03-15', size:'412 KB' },
  { id:3, name:'Offer Letter', type:'pdf', uploaded:'2021-03-14', size:'189 KB' },
  { id:4, name:'Tax Certificate', type:'pdf', uploaded:'2026-01-10', size:'156 KB' },
  { id:5, name:'Experience Letter', type:'pdf', uploaded:'2021-03-01', size:'201 KB' },
  { id:6, name:'Payslips Archive', type:'zip', uploaded:'2026-05-01', size:'1.2 MB' },
]

const MONTHS = ['2025-12','2026-01','2026-02','2026-03','2026-04','2026-05']
const WD_PER_MONTH: Record<string,number> = {'2025-12':26,'2026-01':26,'2026-02':24,'2026-03':26,'2026-04':26,'2026-05':26}

const MONTHLY_ATT: Record<string,{present:number;absent:number;leave:number}[]> = {
  'EMP-0001': [{present:22,absent:2,leave:2},{present:24,absent:0,leave:2},{present:21,absent:2,leave:1},{present:23,absent:1,leave:2},{present:24,absent:0,leave:2}],
  'EMP-0002': [{present:24,absent:0,leave:2},{present:23,absent:1,leave:2},{present:22,absent:0,leave:2},{present:24,absent:1,leave:1},{present:24,absent:0,leave:2}],
  'EMP-0003': [{present:22,absent:3,leave:1},{present:23,absent:2,leave:1},{present:20,absent:2,leave:2},{present:22,absent:2,leave:2},{present:23,absent:1,leave:2}],
  'EMP-0004': [{present:24,absent:1,leave:1},{present:24,absent:0,leave:2},{present:22,absent:1,leave:1},{present:23,absent:1,leave:2},{present:25,absent:0,leave:1}],
  'EMP-0005': [{present:24,absent:0,leave:2},{present:23,absent:1,leave:2},{present:22,absent:0,leave:2},{present:24,absent:1,leave:1},{present:24,absent:0,leave:2}],
}

const PROJECT_COLORS = ['bg-blue-50 text-blue-700','bg-emerald-50 text-emerald-700','bg-purple-50 text-purple-700']
const PROJECT_BAR_COLORS = ['bg-blue-500','bg-emerald-500','bg-purple-500','bg-amber-500','bg-rose-500']

const STATUS_LABELS: Record<string,string> = {
  P:'Present',W:'Weekend Working',H:'Holiday Working',SL:'Sick Leave',
  CL:'Casual Leave',EL:'Earned Leave',A:'Absent',WH:'Work from Home',CO:'Comp Off'
}

const STATUS_COLORS: Record<string,string> = {
  P:'bg-emerald-500 text-white',W:'bg-blue-400 text-white',H:'bg-purple-400 text-white',
  SL:'bg-orange-400 text-white',CL:'bg-yellow-400 text-black',EL:'bg-teal-400 text-white',
  A:'bg-red-500 text-white',WH:'bg-cyan-400 text-white',CO:'bg-violet-400 text-white'
}

const SC_COMPONENT_COLORS: Record<string,{bg:string;text:string;border:string;icon:string}> = {
  otherPayable: {bg:'bg-sky-50',text:'text-sky-700',border:'border-sky-200',icon:'🏗️'},
  earnedLeave:  {bg:'bg-emerald-50',text:'text-emerald-700',border:'border-emerald-200',icon:'🏖️'},
  sickLeave:    {bg:'bg-orange-50',text:'text-orange-700',border:'border-orange-200',icon:'🏥'},
  casualLeave:  {bg:'bg-amber-50',text:'text-amber-700',border:'border-amber-200',icon:'📋'},
}

// ── HELPERS ──────────────────────────────────────────────────────────

function formatPKR(n: number): string { return 'PKR ' + n.toLocaleString('en-PK') }
function formatDate(d: string): string { return new Date(d).toLocaleDateString('en-PK',{year:'numeric',month:'short',day:'numeric'}) }
function fmtMonth(ms: string): string { const [y,m]=ms.split('-').map(Number); return new Date(y,m-1,1).toLocaleDateString('en-US',{year:'numeric',month:'long'}) }

function calcEMI(principal: number, annualRate: number, tenure: number): number {
  if (annualRate === 0) return Math.round(principal / tenure)
  const r = annualRate / 12 / 100
  const f = Math.pow(1 + r, tenure)
  return Math.round(principal * r * f / (f - 1))
}

// Local SC calculation using AGES formula (for demo data)
function computeLocalSC(emp: EmployeeData, month: string) {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const att = ATT_MAY_2026[emp.id] || {}
  const eligibleStatuses = ['P','W','H','T','WH','WW','CL','SL','EL']
  const leaveStatuses = ['CL','SL']
  const billableStatuses = ['P','W','H','WH','WW','T','CO']

  let eligibleDays = 0; let leaveDays = 0; let absentDays = 0; let totalBillableDays = 0
  const projectDays: Record<string,number> = {}

  if (month === '2026-05') {
    Object.values(att).forEach(e => {
      if (eligibleStatuses.includes(e.status)) eligibleDays++
      if (leaveStatuses.includes(e.status)) leaveDays++
      if (e.status === 'A') absentDays++
      if (billableStatuses.includes(e.status) && e.project) {
        totalBillableDays++
        projectDays[e.project] = (projectDays[e.project] || 0) + 1
      }
    })
  } else {
    // For non-May months, derive from summary data
    const summaries = MONTHLY_ATT[emp.id] || MONTHLY_ATT['EMP-0001']
    const mi = MONTHS.indexOf(month)
    if (mi >= 0 && mi < summaries.length) {
      const s = summaries[mi]
      eligibleDays = s.present + s.leave
      leaveDays = s.leave
      absentDays = s.absent
    }
    // No project breakdown for non-May months in demo data
  }

  const dailyRate = emp.monthlySalary / daysInMonth
  const monthlySC = emp.monthlySalary * 0.20
  const workingRatio = eligibleDays / daysInMonth
  const earnedSC = monthlySC * workingRatio
  const leaveDeduction = dailyRate * leaveDays
  const finalSC = earnedSC - leaveDeduction
  const scBalance = leaveDeduction

  const scComponents = {
    otherPayable: Math.round(finalSC * 0.0833),
    earnedLeave:  Math.round(finalSC * 0.0833),
    sickLeave:    Math.round(finalSC * 0.0167),
    casualLeave:  Math.round(finalSC * 0.0167),
  }

  const projectAllocations = Object.entries(projectDays).map(([name, days]) => {
    const weight = totalBillableDays > 0 ? days / totalBillableDays : 0
    return {
      projectName: name, projectCode: name, days, weight,
      weightPct: (weight * 100).toFixed(1) + '%',
      salaryShare: Math.round(emp.monthlySalary * weight),
      scShare: Math.round(finalSC * weight),
      scBalance: Math.round(scBalance * weight),
      scOtherPayable: Math.round(scComponents.otherPayable * weight),
      scEarnedLeave: Math.round(scComponents.earnedLeave * weight),
      scSickLeave: Math.round(scComponents.sickLeave * weight),
      scCasualLeave: Math.round(scComponents.casualLeave * weight),
    }
  })

  return {
    daysInMonth, eligibleDays, leaveDays, absentDays,
    monthlySalary: emp.monthlySalary, dailyRate: Math.round(dailyRate),
    workingRatio: Math.round(workingRatio * 10000) / 10000,
    monthlySC: Math.round(monthlySC), earnedSC: Math.round(earnedSC),
    leaveDeduction: Math.round(leaveDeduction), finalSC: Math.round(finalSC),
    scBalance: Math.round(scBalance), scComponents,
    projectAllocations, totalBillableDays,
  }
}

function buildSalaryHistory(emp: EmployeeData): SalaryRow[] {
  const dailyRate = emp.monthlySalary / emp.workingDays
  const att = ATT_MAY_2026[emp.id] || {}
  const mayPresent = Object.values(att).filter(e=>['P','W','H','WH','CO'].includes(e.status)).length
  const mayLeave = Object.values(att).filter(e=>['SL','CL','EL'].includes(e.status)).length
  const mayAbsent = Object.values(att).filter(e=>e.status==='A').length

  const summaries = MONTHLY_ATT[emp.id] || MONTHLY_ATT['EMP-0001']

  return MONTHS.map((month, idx) => {
    const wd = WD_PER_MONTH[month]
    let present: number, absent: number, leave: number
    if (month === '2026-05') {
      present = mayPresent; absent = mayAbsent; leave = mayLeave
    } else {
      const s = summaries[idx]
      present = s.present; absent = s.absent; leave = s.leave
    }
    const effectiveDays = present + leave
    const earnedSalary = Math.round(effectiveDays * dailyRate)
    const absentDeduction = Math.round(absent * dailyRate)
    const taxAmount = Math.round(earnedSalary * emp.taxRate)
    const loanDeduction = emp.loanEMI
    const totalDeductions = absentDeduction + taxAmount + loanDeduction
    const netPaid = earnedSalary - totalDeductions
    const basic = Math.round(earnedSalary * 0.765)
    const housing = Math.round(earnedSalary * 0.15)
    const transport = Math.round(earnedSalary * 0.06)
    const other = earnedSalary - basic - housing - transport
    const status: SalaryRow['status'] = idx < 4 ? 'Paid' : idx === 4 ? 'Pending' : 'Draft'
    return { month, workingDays:wd, present, absent, leave, earnedSalary, absentDeduction, taxAmount, loanDeduction, totalDeductions, netPaid, status, earnings:{basic,housing,transport,other}, deductionBreakdown:{absentDeduction,tax:taxAmount,loanEmi:loanDeduction,scEmployee:0} }
  })
}

function buildScLedger(salaryRows: SalaryRow[], scRate: number): ScLedgerEntry[] {
  let cumOutstanding = 0
  return salaryRows.map((row, idx) => {
    const scAmount = Math.round(row.earnedSalary * scRate)
    cumOutstanding += scAmount
    let status: ScLedgerEntry['status'] = 'Pending'
    let paid = 0
    let paidOn: string | null = null
    if (idx < 2) { status = 'Remitted'; paid = scAmount; cumOutstanding -= scAmount; paidOn = `${MONTHS[idx+1]}-15` }
    else if (idx === 2) { status = 'Remitted'; paid = scAmount; cumOutstanding -= scAmount; paidOn = '2026-03-15' }
    else if (idx === 3) { status = 'Partial'; paid = Math.round(scAmount * 0.5); cumOutstanding -= paid; paidOn = '2026-04-10' }
    return { month:row.month, grossSalary:row.earnedSalary, scRate, scAmount, paid, outstanding:cumOutstanding, status, paidOn }
  })
}

function buildLoans(emp: EmployeeData): LoanData[] {
  if (emp.loanEMI === 0) return []
  const principal = emp.id === 'EMP-0001' ? 100000 : emp.id === 'EMP-0004' ? 50000 : 0
  if (principal === 0) return []
  const tenure = 18
  const interestRate = emp.id === 'EMP-0001' ? 12 : 10
  const emi = emp.loanEMI
  const totalPaid = emi * (emp.id === 'EMP-0001' ? 10 : 5)
  const remaining = principal - totalPaid + Math.round(principal * interestRate / 100 / 12 * (emp.id === 'EMP-0001' ? 10 : 5))
  const monthsLeft = tenure - (emp.id === 'EMP-0001' ? 10 : 5)
  const r = interestRate / 12 / 100
  const schedule = []
  let bal = principal
  for (let m = 1; m <= tenure; m++) {
    const intPart = Math.round(bal * r)
    const prinPart = emi - intPart
    bal = bal - prinPart
    schedule.push({ month:m, emi, principal:prinPart, interest:intPart, balance:Math.max(0,bal) })
  }
  return [{ id: emp.id === 'EMP-0001' ? 'LN-001' : 'LN-002', loanType: emp.id === 'EMP-0001' ? 'Personal' : 'Emergency', principal, disbursedDate: emp.id === 'EMP-0001' ? '2025-07-01' : '2025-12-01', tenure, emi, interestRate, remaining:Math.max(0,remaining), monthsLeft, status:'Active', schedule }]
}

function buildAdvances(emp: EmployeeData): AdvanceData[] {
  if (emp.advanceBalance === 0) return []
  const amount = emp.advanceBalance * 2
  return [{ id: emp.id === 'EMP-0001' ? 'ADV-001' : 'ADV-002', date: emp.id === 'EMP-0001' ? '2026-03-15' : '2026-02-01', amount, purpose: emp.id === 'EMP-0001' ? 'Medical Emergency' : 'Relocation', recoveryMode:'Installments', monthlyRecovery:Math.round(amount/6), recovered:amount - emp.advanceBalance, balance:emp.advanceBalance, status:'Recovering' }]
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
  const s: Record<string,string> = {Active:'bg-emerald-50 text-emerald-700 border-emerald-200',Closed:'bg-slate-100 text-slate-500 border-slate-200',Overdue:'bg-red-50 text-red-700 border-red-200'}
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
  const [employees, setEmployees] = useState<EmployeeData[]>(EMPLOYEES)
  const [selectedId, setSelectedId] = useState('EMP-0001')
  const [loading, setLoading] = useState(false)

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

  // Payroll calculation
  const [payrollResults, setPayrollResults] = useState<Record<string, PayrollResult>>({})
  const [payrollLoading, setPayrollLoading] = useState(false)
  const [payrollMonth, setPayrollMonth] = useState('2026-05')

  // SC
  const [scLedgers, setScLedgers] = useState<Record<string,ScLedgerEntry[]>>(() => {
    const m: Record<string,ScLedgerEntry[]> = {}
    EMPLOYEES.forEach(e => { m[e.id] = buildScLedger(buildSalaryHistory(e), e.scRate) })
    return m
  })
  const [showScForm, setShowScForm] = useState(false)
  const [scPayment, setScPayment] = useState({amount:'',date:'',reference:''})
  const [scCoveredMonths, setScCoveredMonths] = useState<string[]>([])

  // Loans & Advances
  const [loansStore, setLoansStore] = useState<Record<string,LoanData[]>>(() => {
    const m: Record<string,LoanData[]> = {}; EMPLOYEES.forEach(e => { m[e.id] = buildLoans(e) }); return m
  })
  const [advStore, setAdvStore] = useState<Record<string,AdvanceData[]>>(() => {
    const m: Record<string,AdvanceData[]> = {}; EMPLOYEES.forEach(e => { m[e.id] = buildAdvances(e) }); return m
  })
  const [expandedLoan, setExpandedLoan] = useState<string|null>(null)
  const [newLoanOpen, setNewLoanOpen] = useState(false)
  const [newLoanForm, setNewLoanForm] = useState({loanType:'Personal',amount:'',date:'',tenure:'',interestRate:'12'})
  const [newAdvOpen, setNewAdvOpen] = useState(false)
  const [newAdvForm, setNewAdvForm] = useState({amount:'',purpose:'',recoveryMode:'Installments',monthlyRecovery:''})

  // Attendance
  const [attMonths, setAttMonths] = useState<Record<string,string>>(() => {
    const m: Record<string,string> = {}; EMPLOYEES.forEach(e => { m[e.id] = '2026-05' }); return m
  })

  // Documents
  const [docStore, setDocStore] = useState<Record<string,DocData[]>>(() => {
    const m: Record<string,DocData[]> = {}; EMPLOYEES.forEach(e => { m[e.id] = [...DEFAULT_DOCS] }); return m
  })
  const [previewDoc, setPreviewDoc] = useState<DocData|null>(null)
  const [replaceDocId, setReplaceDocId] = useState<number|null>(null)

  // ---- Derived ----
  const emp = useMemo(() => employees.find(e => e.id === selectedId) || employees[0], [employees, selectedId])
  const salaryHistory = useMemo(() => buildSalaryHistory(emp), [emp])
  const scLedger = scLedgers[emp.id] || []
  const loans = loansStore[emp.id] || []
  const advances = advStore[emp.id] || []
  const docs = docStore[emp.id] || []
  const attMonth = attMonths[emp.id] || '2026-05'
  const attData = ATT_MAY_2026[emp.id] || {}

  const initials = emp.name.split(' ').map(w=>w[0]).join('').slice(0,2)

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

  // Attendance stats
  const attEntries = Object.entries(attData)
  const attPresent = attEntries.filter(([,e])=>['P','WH'].includes(e.status)).length
  const attAbsent = attEntries.filter(([,e])=>e.status==='A').length
  const attLeave = attEntries.filter(([,e])=>['SL','CL','EL'].includes(e.status)).length
  const attWeekend = attEntries.filter(([,e])=>e.status==='W').length
  const attHoliday = attEntries.filter(([,e])=>e.status==='H').length

  // Billable vs non-billable
  const billableStatuses = ['P','W','H','WH','WW','T','CO']
  const billableDays = attEntries.filter(([,e]) => billableStatuses.includes(e.status) && e.project).length
  const nonBillableDays = attEntries.filter(([,e]) => billableStatuses.includes(e.status) && !e.project).length

  // Project allocation
  const projectAlloc = useMemo(() => {
    const map: Record<string,number> = {}
    Object.values(ATT_MAY_2026[emp.id] || {}).forEach(e=>{ if(e.project) map[e.project]=(map[e.project]||0)+1 })
    const total = Object.values(map).reduce((s,v)=>s+v,0)
    return Object.entries(map).map(([name,days])=>({name,days,pct:total>0?Math.round(days/total*100):0})).sort((a,b)=>b.days-a.days)
  }, [emp.id])

  // Local SC calculation for current payroll month
  const localScCalc = useMemo(() => computeLocalSC(emp, payrollMonth), [emp, payrollMonth])

  // API payroll result key
  const payrollKey = `${emp.id}-${payrollMonth}`
  const apiPayrollResult = payrollResults[payrollKey]

  // Effective payroll result (API if available, else local)
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
    setTimeout(() => { setSelectedId(id); setLoading(false) }, 200)
  }, [selectedId])

  // Run Payroll Calculation
  const handleRunPayroll = useCallback(async () => {
    setPayrollLoading(true)
    try {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: emp.id, month: payrollMonth, skipValidation: true }),
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
  }, [emp.id, payrollMonth, payrollKey])

  // Search keyboard
  const filteredEmployees = useMemo(() => {
    if (!searchQ.trim()) return employees
    const q = searchQ.toLowerCase()
    return employees.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.department.toLowerCase().includes(q))
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
  const startEdit = () => { setEditForm({...emp}); setEditMode(true) }
  const cancelEdit = () => { setEditMode(false); setEditForm({}) }
  const saveEdit = () => {
    setEmployees(prev => prev.map(e => e.id === emp.id ? {...e, ...editForm} as EmployeeData : e))
    setEditMode(false)
    setEditForm({})
    toast.success('Profile updated successfully')
  }

  // SC Payment save
  const handleScPaymentSave = () => {
    if (!scPayment.amount || !scPayment.date || scCoveredMonths.length === 0) {
      toast.error('Please fill all fields and select at least one month')
      return
    }
    setScLedgers(prev => {
      const ledger = [...(prev[emp.id]||[])]
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
      return {...prev, [emp.id]: ledger}
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
    setLoansStore(prev => ({...prev, [emp.id]: [...(prev[emp.id]||[]), newLoan]}))
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
    setAdvStore(prev => ({...prev, [emp.id]: [...(prev[emp.id]||[]), newAdv]}))
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
          placeholder="Search employee by name, ID, or department..."
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
                  <div className="text-[11px] text-slate-500">{e.designation}</div>
                </div>
                <span className="bg-slate-100 text-slate-600 text-[10px] rounded px-1.5 py-0.5 font-mono shrink-0">{highlightMatch(e.id, searchQ)}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{highlightMatch(e.department, searchQ)}</span>
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
                <Input className="h-8 text-xs mt-0.5" value={(editForm as Record<string,string|number>)[f.key]?.toString()||''}
                  onChange={e => setEditForm(prev => ({...prev,[f.key]:e.target.value}))} />
              </div>
            ))}
            <div>
              <Label className="text-xs text-slate-500">Monthly Salary</Label>
              <Input type="number" className="h-8 text-xs mt-0.5" value={editForm.monthlySalary?.toString()||''}
                onChange={e => setEditForm(prev => ({...prev,monthlySalary:parseFloat(e.target.value)||0}))} />
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
          <h2 className="text-xl font-semibold text-slate-900">{emp.name}</h2>
          <div className="mt-1.5"><span className="bg-slate-100 text-slate-500 text-[11px] rounded px-2 py-0.5 font-mono">{emp.id}</span></div>
          <p className="text-[13px] text-slate-500 mt-2">{emp.designation}</p>
          <p className="text-[13px] text-slate-500">{emp.department}</p>
          <div className="mt-2.5">
            <span className={`rounded-full text-[11px] px-3 py-1 font-medium border ${emp.status==='Active'?'bg-emerald-50 text-emerald-600 border-emerald-200':'bg-red-50 text-red-600 border-red-200'}`}>{emp.status}</span>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="space-y-2.5">
          {[
            {icon:Calendar,label:'Join Date',value:formatDate(emp.joinDate)},
            {icon:MapPin,label:'Location',value:emp.location},
            {icon:Landmark,label:'Bank Account',value:emp.bank},
            {icon:Phone,label:'Phone',value:emp.phone},
            {icon:Mail,label:'Email',value:emp.email},
            {icon:Briefcase,label:'Contract Type',value:emp.contractType},
          ].map(r => (
            <div key={r.label} className="flex items-center gap-2.5 text-[13px]">
              <r.icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500 w-24">{r.label}</span>
              <span className="text-slate-900 font-medium ml-auto truncate">{r.value}</span>
            </div>
          ))}
        </div>
        {emp.projects.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-500">Projects:</span>
              {emp.projects.map((p,i) => (
                <span key={p} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PROJECT_COLORS[i%PROJECT_COLORS.length]}`}>{p}</span>
              ))}
            </div>
          </>
        )}
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
        <p className="text-[18px] font-semibold text-slate-900">{formatPKR(emp.monthlySalary)}</p>
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
  const renderProjectCostDistribution = (scCalc: typeof localScCalc, source: string) => {
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
  const renderScComponentCards = (scCalc: typeof localScCalc) => (
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
                  {MONTHS.map(m=><SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
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
              {renderProjectCostDistribution(apiPayrollResult, 'API Calculation')}
            </div>
          )}
          {!apiPayrollResult && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[11px] text-slate-400 mb-2">Local preview (demo data):</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">Eligible Days</span>
                  <p className="font-semibold text-slate-900">{localScCalc.eligibleDays}/{localScCalc.daysInMonth}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">Working Ratio</span>
                  <p className="font-semibold text-slate-900">{(localScCalc.workingRatio * 100).toFixed(2)}%</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">Final SC Payable</span>
                  <p className="font-semibold text-emerald-600">{formatPKR(localScCalc.finalSC)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-500">SC Balance (deferred)</span>
                  <p className="font-semibold text-amber-600">{formatPKR(localScCalc.scBalance)}</p>
                </div>
              </div>
              {localScCalc.projectAllocations.length > 0 && renderProjectCostDistribution(localScCalc, 'Local Demo')}
            </div>
          )}
        </div>
      )}

      {/* Salary table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
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
                // Get SC calc for this month
                const rowScCalc = computeLocalSC(emp, row.month)
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
                            {/* SC Breakdown in payslip */}
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <h5 className="text-[11px] font-semibold text-slate-700 mb-2">Social Charges Breakdown (AGES Formula)</h5>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                <div className="bg-white rounded-lg p-2 border border-slate-100">
                                  <span className="text-slate-500">Monthly SC (20%)</span>
                                  <p className="font-semibold text-slate-900">{formatPKR(rowScCalc.monthlySC)}</p>
                                </div>
                                <div className="bg-white rounded-lg p-2 border border-slate-100">
                                  <span className="text-slate-500">Earned SC</span>
                                  <p className="font-semibold text-emerald-600">{formatPKR(rowScCalc.earnedSC)}</p>
                                </div>
                                <div className="bg-white rounded-lg p-2 border border-slate-100">
                                  <span className="text-slate-500">Leave Deduction</span>
                                  <p className="font-semibold text-red-500">{formatPKR(rowScCalc.leaveDeduction)}</p>
                                </div>
                                <div className="bg-white rounded-lg p-2 border border-slate-100">
                                  <span className="text-slate-500">Final Payable SC</span>
                                  <p className="font-semibold text-slate-900">{formatPKR(rowScCalc.finalSC)}</p>
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

  // ========================================================================
  // RENDER: Tab 2 — Social Charges
  // ========================================================================
  const renderSocialCharges = () => {
    const scCalc = effectivePayroll || localScCalc
    const scSource = effectivePayroll ? 'API Calculation' : 'Local Demo'

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
        <div>
          <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><PieChart className="h-3.5 w-3.5"/>SC Component Breakdown — {fmtMonth(payrollMonth)}</h3>
          {renderScComponentCards(scCalc)}
        </div>

        {/* Project-wise SC Distribution */}
        {scCalc.projectAllocations.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5"/>Project-wise SC Distribution — {fmtMonth(payrollMonth)}</h3>
            {renderProjectCostDistribution(scCalc, scSource)}
          </div>
        )}

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
        {/* Loans */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Active Loans</h3>
            {isAdmin && <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={()=>setNewLoanOpen(true)}><Plus className="h-3 w-3 mr-1"/>New Loan</Button>}
          </div>
          {loans.length === 0 && <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">No active loans</div>}
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
          {advances.length === 0 && <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">No active advances</div>}
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
        <Select value={attMonth} onValueChange={v=>setAttMonths(p=>({...p,[emp.id]:v}))}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue/></SelectTrigger>
          <SelectContent>
            {MONTHS.map(m=><SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {attMonth !== '2026-05' ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
          Detailed attendance data is only available for May 2026.
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
                    {projectAlloc.map((p,i) => (
                      <tr key={p.name} className="border-b border-slate-50">
                        <td className="py-2 px-3">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length]}`}/>
                            <span className="font-medium text-slate-900">{p.name}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600">{p.days}</td>
                        <td className="py-2 px-3 text-center text-slate-600">{p.pct}%</td>
                        <td className="py-2 px-3 text-right text-slate-900">{formatPKR(Math.round(emp.monthlySalary * p.days / 31))}</td>
                      </tr>
                    ))}
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
  const renderDocuments = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {docs.map(doc => {
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

  // ========================================================================
  // RENDER: Main Layout
  // ========================================================================
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
