'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Banknote, ArrowRight, CheckCircle, Plus, Pencil, Trash2, Users,
  ChevronDown, ChevronUp, Play, Send, Shield, BookOpen, Loader2,
  TrendingDown, TrendingUp, Building2, Receipt, AlertCircle, Eye
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function formatNumber(amount: number) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)
}

// Status styles
const statusStyles: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  reviewed: 'bg-sky-100 text-sky-800 border-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  posted: 'bg-purple-100 text-purple-800 border-purple-200',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  reviewed: 'Reviewed',
  approved: 'Approved',
  posted: 'Posted to GL',
}

// Workflow steps
const workflowSteps = ['draft', 'reviewed', 'approved', 'posted']

// Line form interface
interface PayrollLineForm {
  employeeId: string
  employeeName: string
  employeeCode: string
  basicSalary: number
  dailyRate: number
  workingDays: number
  eligibleDays: number
  leaveDays: number
  absentDays: number
  allowances: number
  incomeTax: number
  eobiEmployee: number
  eobiEmployer: number
  pfEmployee: number
  pfEmployer: number
  loanDeduction: number
  advanceDeduction: number
  otherDeductions: number
  socialCharges: number
  gratuity: number
  projectId: string
  department: string
}

const emptyLineForm: PayrollLineForm = {
  employeeId: '',
  employeeName: '',
  employeeCode: '',
  basicSalary: 0,
  dailyRate: 0,
  workingDays: 0,
  eligibleDays: 0,
  leaveDays: 0,
  absentDays: 0,
  allowances: 0,
  incomeTax: 0,
  eobiEmployee: 0,
  eobiEmployer: 0,
  pfEmployee: 0,
  pfEmployer: 0,
  loanDeduction: 0,
  advanceDeduction: 0,
  otherDeductions: 0,
  socialCharges: 0,
  gratuity: 0,
  projectId: '',
  department: '',
}

function computeLineTotals(line: PayrollLineForm) {
  const grossSalary = (line.basicSalary || 0) + (line.allowances || 0)
  const totalDeductions = (line.incomeTax || 0) + (line.eobiEmployee || 0) + (line.pfEmployee || 0) + (line.loanDeduction || 0) + (line.advanceDeduction || 0) + (line.otherDeductions || 0)
  const netPay = grossSalary - totalDeductions
  return { grossSalary, totalDeductions, netPay }
}

// ============================================================
// Main PayrollIntegration Component
// ============================================================
export function PayrollIntegration() {
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [runningPayroll, setRunningPayroll] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [addLineDialogOpen, setAddLineDialogOpen] = useState(false)
  const [editLineDialogOpen, setEditLineDialogOpen] = useState(false)
  const [deleteBatchDialogOpen, setDeleteBatchDialogOpen] = useState(false)
  const [deleteLineDialogOpen, setDeleteLineDialogOpen] = useState(false)
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [lineDetailDialogOpen, setLineDetailDialogOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<any>(null)
  const [selectedLine, setSelectedLine] = useState<any>(null)
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [expandedLine, setExpandedLine] = useState<string | null>(null)
  const [financialYears, setFinancialYears] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const { toast } = useToast()

  // Create batch form
  const [batchForm, setBatchForm] = useState({
    name: '',
    period: new Date().toISOString().slice(0, 7),
    projectId: '',
  })

  // Add/Edit line form
  const [lineForm, setLineForm] = useState<PayrollLineForm>({ ...emptyLineForm })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/payroll')
      const data = await res.json()
      setBatches(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load payroll batches', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    queueMicrotask(() => {
      fetchData()
      fetch('/api/financial-year').then(r => r.json()).then(d => setFinancialYears(Array.isArray(d) ? d : [])).catch(() => {})
      fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : [])).catch(() => {})
      fetch('/api/employees?pageSize=200').then(r => r.json()).then(d => {
        if (Array.isArray(d)) setEmployees(d)
        else if (d && Array.isArray(d.data)) setEmployees(d.data)
        else if (d && Array.isArray(d.employees)) setEmployees(d.employees)
        else setEmployees([])
      }).catch(() => {})
    })
  }, [fetchData])

  // KPI totals across all batches
  const kpiTotals = batches.reduce(
    (acc, b) => ({
      totalGross: acc.totalGross + (b.totalGross || 0),
      totalDeductions: acc.totalDeductions + (b.totalDeductions || 0),
      totalNetPay: acc.totalNetPay + (b.totalNetPay || 0),
      totalSocialCharges: acc.totalSocialCharges + (b.totalSocialCharges || 0),
      totalEmployerCharges: acc.totalEmployerCharges + (b.totalEmployerCharges || 0),
    }),
    { totalGross: 0, totalDeductions: 0, totalNetPay: 0, totalSocialCharges: 0, totalEmployerCharges: 0 }
  )

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------

  const handleCreateBatch = async () => {
    if (!batchForm.period) {
      toast({ title: 'Error', description: 'Period is required', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: batchForm.name || `Payroll - ${batchForm.period}`,
          period: batchForm.period,
          projectId: batchForm.projectId || null,
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Created', description: 'Payroll batch created successfully' })
      setCreateDialogOpen(false)
      setBatchForm({ name: '', period: new Date().toISOString().slice(0, 7), projectId: '' })
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleRunPayroll = async (batch: any) => {
    setRunningPayroll(batch.id)
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-payroll', batchId: batch.id }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({
        title: 'Payroll Processed',
        description: `Payroll calculated for ${result.employeeCount} employees`,
      })
      fetchData()
    } catch (e: any) {
      toast({ title: 'Payroll Error', description: e.message, variant: 'destructive' })
    } finally {
      setRunningPayroll(null)
    }
  }

  const handleWorkflowAction = async (action: string, batchId: string) => {
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, batchId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Success', description: result.message })
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handlePostToGL = async () => {
    if (!selectedBatch) return
    const fy = financialYears.find((f: any) => f.status === 'open')
    if (!fy) { toast({ title: 'Error', description: 'No open financial year found', variant: 'destructive' }); return }

    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post-to-gl', batchId: selectedBatch.id, financialYearId: fy.id }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Posted to GL', description: `Voucher ${result.voucherNumber} created with ${result.entryCount} entries` })
      setPostDialogOpen(false)
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleAddLine = async () => {
    if (!selectedBatch || !lineForm.employeeName) {
      toast({ title: 'Error', description: 'Employee name is required', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-line',
          batchId: selectedBatch.id,
          line: { ...lineForm, projectId: lineForm.projectId || null },
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Added', description: 'Employee line added to batch' })
      setAddLineDialogOpen(false)
      setLineForm({ ...emptyLineForm })
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleUpdateLine = async () => {
    if (!selectedLine || !lineForm.employeeName) {
      toast({ title: 'Error', description: 'Employee name is required', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-line',
          lineId: selectedLine.id,
          line: { ...lineForm, projectId: lineForm.projectId || null },
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Updated', description: 'Employee line updated' })
      setEditLineDialogOpen(false)
      setLineForm({ ...emptyLineForm })
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDeleteLine = async () => {
    if (!selectedLine) return
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-line', lineId: selectedLine.id }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Deleted', description: 'Employee line removed' })
      setDeleteLineDialogOpen(false)
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDeleteBatch = async () => {
    if (!selectedBatch) return
    try {
      const res = await fetch(`/api/payroll?id=${selectedBatch.id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Deleted', description: 'Payroll batch deleted' })
      setDeleteBatchDialogOpen(false)
      setSelectedBatch(null)
      setExpandedBatch(null)
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const openAddLineDialog = (batch: any) => {
    setSelectedBatch(batch)
    setLineForm({ ...emptyLineForm })
    setAddLineDialogOpen(true)
  }

  const openEditLineDialog = (batch: any, line: any) => {
    setSelectedBatch(batch)
    setSelectedLine(line)
    setLineForm({
      employeeId: line.employeeId || '',
      employeeName: line.employeeName || '',
      employeeCode: line.employeeCode || '',
      basicSalary: line.basicSalary || 0,
      dailyRate: line.dailyRate || 0,
      workingDays: line.workingDays || 0,
      eligibleDays: line.eligibleDays || 0,
      leaveDays: line.leaveDays || 0,
      absentDays: line.absentDays || 0,
      allowances: line.allowances || 0,
      incomeTax: line.incomeTax || 0,
      eobiEmployee: line.eobiEmployee || 0,
      eobiEmployer: line.eobiEmployer || 0,
      pfEmployee: line.pfEmployee || 0,
      pfEmployer: line.pfEmployer || 0,
      loanDeduction: line.loanDeduction || 0,
      advanceDeduction: line.advanceDeduction || 0,
      otherDeductions: line.otherDeductions || 0,
      socialCharges: line.socialCharges || 0,
      gratuity: line.gratuity || 0,
      projectId: line.projectId || '',
      department: line.department || '',
    })
    setEditLineDialogOpen(true)
  }

  const openLineDetail = (line: any) => {
    setSelectedLine(line)
    setLineDetailDialogOpen(true)
  }

  const lineFormTotals = computeLineTotals(lineForm)

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return '-'
    const p = projects.find((pr: any) => pr.id === projectId)
    return p ? `${p.code} - ${p.name}` : projectId
  }

  // ----------------------------------------------------------
  // Render: Workflow Status Bar
  // ----------------------------------------------------------
  const renderWorkflowBar = (status: string) => {
    const currentIdx = workflowSteps.indexOf(status)
    return (
      <div className="flex items-center gap-1 my-3">
        {workflowSteps.map((step, idx) => (
          <div key={step} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              idx <= currentIdx
                ? idx === currentIdx
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}>
              {idx <= currentIdx && <CheckCircle className="h-3 w-3" />}
              <span>{statusLabels[step]}</span>
            </div>
            {idx < workflowSteps.length - 1 && (
              <ArrowRight className={`h-4 w-4 ${idx < currentIdx ? 'text-primary' : 'text-muted-foreground'}`} />
            )}
          </div>
        ))}
      </div>
    )
  }

  // ----------------------------------------------------------
  // Render: Line Form Fields (shared for Add/Edit)
  // ----------------------------------------------------------
  const renderLineFormFields = () => (
    <div className="space-y-4">
      {/* Employee Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium">Employee *</Label>
          <Select
            value={lineForm.employeeId}
            onValueChange={(v) => {
              const emp = employees.find((e: any) => e.id === v)
              if (emp) {
                setLineForm(p => ({
                  ...p,
                  employeeId: emp.id,
                  employeeName: emp.name,
                  employeeCode: emp.employeeCode || '',
                  basicSalary: emp.baseSalary || 0,
                  department: emp.department || '',
                  projectId: emp.defaultProjectId || '',
                }))
              }
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.filter((e: any) => e.status === 'active').map((emp: any) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.employeeCode} - {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium">Employee Name</Label>
          <Input className="h-9 text-xs" value={lineForm.employeeName} onChange={e => setLineForm(p => ({ ...p, employeeName: e.target.value }))} />
        </div>
      </div>

      <Separator />

      {/* Salary & Attendance */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Salary & Attendance</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><Label className="text-xs">Basic Salary</Label><Input type="number" className="h-9 text-xs" value={lineForm.basicSalary || ''} onChange={e => setLineForm(p => ({ ...p, basicSalary: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Daily Rate</Label><Input type="number" className="h-9 text-xs" value={lineForm.dailyRate || ''} onChange={e => setLineForm(p => ({ ...p, dailyRate: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Working Days</Label><Input type="number" className="h-9 text-xs" value={lineForm.workingDays || ''} onChange={e => setLineForm(p => ({ ...p, workingDays: parseInt(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Eligible Days</Label><Input type="number" className="h-9 text-xs" value={lineForm.eligibleDays || ''} onChange={e => setLineForm(p => ({ ...p, eligibleDays: parseInt(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Leave Days</Label><Input type="number" className="h-9 text-xs" value={lineForm.leaveDays || ''} onChange={e => setLineForm(p => ({ ...p, leaveDays: parseInt(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Absent Days</Label><Input type="number" className="h-9 text-xs" value={lineForm.absentDays || ''} onChange={e => setLineForm(p => ({ ...p, absentDays: parseInt(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Allowances</Label><Input type="number" className="h-9 text-xs" value={lineForm.allowances || ''} onChange={e => setLineForm(p => ({ ...p, allowances: parseFloat(e.target.value) || 0 }))} /></div>
          <div className="flex items-end">
            <div className="w-full p-2 rounded-md bg-muted/60 text-center">
              <p className="text-[10px] text-muted-foreground">Gross Salary</p>
              <p className="text-sm font-bold">{formatCurrency(lineFormTotals.grossSalary)}</p>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Deductions */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Deductions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><Label className="text-xs">Income Tax</Label><Input type="number" className="h-9 text-xs" value={lineForm.incomeTax || ''} onChange={e => setLineForm(p => ({ ...p, incomeTax: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">EOBI (Employee)</Label><Input type="number" className="h-9 text-xs" value={lineForm.eobiEmployee || ''} onChange={e => setLineForm(p => ({ ...p, eobiEmployee: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">EOBI (Employer)</Label><Input type="number" className="h-9 text-xs" value={lineForm.eobiEmployer || ''} onChange={e => setLineForm(p => ({ ...p, eobiEmployer: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">PF (Employee)</Label><Input type="number" className="h-9 text-xs" value={lineForm.pfEmployee || ''} onChange={e => setLineForm(p => ({ ...p, pfEmployee: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">PF (Employer)</Label><Input type="number" className="h-9 text-xs" value={lineForm.pfEmployer || ''} onChange={e => setLineForm(p => ({ ...p, pfEmployer: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Loan Deduction</Label><Input type="number" className="h-9 text-xs" value={lineForm.loanDeduction || ''} onChange={e => setLineForm(p => ({ ...p, loanDeduction: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Advance Deduction</Label><Input type="number" className="h-9 text-xs" value={lineForm.advanceDeduction || ''} onChange={e => setLineForm(p => ({ ...p, advanceDeduction: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Other Deductions</Label><Input type="number" className="h-9 text-xs" value={lineForm.otherDeductions || ''} onChange={e => setLineForm(p => ({ ...p, otherDeductions: parseFloat(e.target.value) || 0 }))} /></div>
        </div>
      </div>

      <Separator />

      {/* Employer Charges */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Employer Charges</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><Label className="text-xs">Social Charges</Label><Input type="number" className="h-9 text-xs" value={lineForm.socialCharges || ''} onChange={e => setLineForm(p => ({ ...p, socialCharges: parseFloat(e.target.value) || 0 }))} /></div>
          <div><Label className="text-xs">Gratuity</Label><Input type="number" className="h-9 text-xs" value={lineForm.gratuity || ''} onChange={e => setLineForm(p => ({ ...p, gratuity: parseFloat(e.target.value) || 0 }))} /></div>
          <div>
            <Label className="text-xs">Project</Label>
            <Select value={lineForm.projectId} onValueChange={v => setLineForm(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 rounded-lg bg-muted/40 border space-y-2">
        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Gross Salary:</span><span className="font-semibold">{formatCurrency(lineFormTotals.grossSalary)}</span></div>
        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total Deductions:</span><span className="font-semibold text-red-600">{formatCurrency(lineFormTotals.totalDeductions)}</span></div>
        <Separator />
        <div className="flex justify-between text-sm font-bold"><span>Net Pay:</span><span className="text-green-600">{formatCurrency(lineFormTotals.netPay)}</span></div>
      </div>
    </div>
  )

  // ----------------------------------------------------------
  // Render: Line Detail Dialog
  // ----------------------------------------------------------
  const renderLineDetailDialog = () => {
    if (!selectedLine) return null

    let scBreakdown: any = null
    let taxBreakdown: any = null
    let allowanceDetails: any[] = []

    try { scBreakdown = selectedLine.scBreakdown ? JSON.parse(selectedLine.scBreakdown) : null } catch {}
    try { taxBreakdown = selectedLine.taxBreakdown ? JSON.parse(selectedLine.taxBreakdown) : null } catch {}
    try { allowanceDetails = selectedLine.allowanceDetails ? JSON.parse(selectedLine.allowanceDetails) : [] } catch {}

    return (
      <Dialog open={lineDetailDialogOpen} onOpenChange={setLineDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {selectedLine.employeeName} — {selectedLine.employeeCode}
            </DialogTitle>
            <DialogDescription className="text-xs">Detailed payroll breakdown</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Attendance */}
            <div>
              <p className="text-xs font-semibold mb-2">Attendance</p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Working', value: selectedLine.workingDays, color: 'text-blue-600' },
                  { label: 'Eligible', value: selectedLine.eligibleDays, color: 'text-green-600' },
                  { label: 'Leave', value: selectedLine.leaveDays, color: 'text-amber-600' },
                  { label: 'Absent', value: selectedLine.absentDays, color: 'text-red-600' },
                  { label: 'Daily Rate', value: formatCurrency(selectedLine.dailyRate), color: 'text-foreground' },
                ].map(item => (
                  <div key={item.label} className="text-center p-2 rounded bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className={`text-xs font-bold ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Salary Breakdown */}
            <div>
              <p className="text-xs font-semibold mb-2">Salary Breakdown</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Basic Salary</p>
                  <p className="text-xs font-bold">{formatCurrency(selectedLine.basicSalary)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Allowances</p>
                  <p className="text-xs font-bold">{formatCurrency(selectedLine.allowances)}</p>
                </div>
                <div className="text-center p-2 rounded bg-green-50 border border-green-200">
                  <p className="text-[10px] text-green-700">Gross Salary</p>
                  <p className="text-xs font-bold text-green-700">{formatCurrency(selectedLine.grossSalary)}</p>
                </div>
              </div>
            </div>

            {/* Allowance Details */}
            {allowanceDetails.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2">Allowance Details</p>
                <div className="rounded border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Allowance</TableHead>
                        <TableHead className="text-[10px] text-right">Amount</TableHead>
                        <TableHead className="text-[10px]">Taxable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allowanceDetails.map((a: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs py-1">{a.name}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{formatCurrency(a.amount)}</TableCell>
                          <TableCell className="text-xs py-1">{a.isTaxable ? 'Yes' : 'No'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <Separator />

            {/* Deductions */}
            <div>
              <p className="text-xs font-semibold mb-2">Deductions</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Income Tax', value: selectedLine.incomeTax },
                  { label: 'EOBI (Emp)', value: selectedLine.eobiEmployee },
                  { label: 'PF (Emp)', value: selectedLine.pfEmployee },
                  { label: 'Loan', value: selectedLine.loanDeduction },
                  { label: 'Advance', value: selectedLine.advanceDeduction },
                  { label: 'Other', value: selectedLine.otherDeductions },
                ].map(item => (
                  <div key={item.label} className="text-center p-2 rounded bg-red-50 border border-red-100">
                    <p className="text-[10px] text-red-700">{item.label}</p>
                    <p className="text-xs font-bold text-red-700">{formatCurrency(item.value || 0)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between items-center p-2 rounded bg-red-100/50 border border-red-200">
                <span className="text-xs font-medium text-red-800">Total Deductions</span>
                <span className="text-sm font-bold text-red-800">{formatCurrency(selectedLine.totalDeductions)}</span>
              </div>
            </div>

            <Separator />

            {/* Net Pay */}
            <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 border-2 border-green-300">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" />
                <span className="text-sm font-bold text-green-800">Net Pay</span>
              </div>
              <span className="text-lg font-bold text-green-700">{formatCurrency(selectedLine.netPay)}</span>
            </div>

            <Separator />

            {/* Employer Charges */}
            <div>
              <p className="text-xs font-semibold mb-2">Employer Charges</p>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">EOBI (Er)</p>
                  <p className="text-xs font-bold">{formatCurrency(selectedLine.eobiEmployer)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">PF (Er)</p>
                  <p className="text-xs font-bold">{formatCurrency(selectedLine.pfEmployer)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Social Charges</p>
                  <p className="text-xs font-bold">{formatCurrency(selectedLine.socialCharges)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Gratuity</p>
                  <p className="text-xs font-bold">{formatCurrency(selectedLine.gratuity)}</p>
                </div>
              </div>
            </div>

            {/* SC Breakdown */}
            {scBreakdown && (
              <div>
                <p className="text-xs font-semibold mb-2">Social Charges Breakdown</p>
                <div className="p-3 rounded border bg-muted/30 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Monthly SC (20% of salary):</span><span>{formatCurrency(scBreakdown.monthlySC)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Working Ratio:</span><span>{(scBreakdown.workingRatio * 100).toFixed(2)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Earned SC:</span><span>{formatCurrency(scBreakdown.earnedSC)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Leave Deduction:</span><span className="text-red-600">-{formatCurrency(scBreakdown.leaveDeduction)}</span></div>
                  <Separator />
                  <div className="flex justify-between font-bold"><span>Final SC:</span><span>{formatCurrency(scBreakdown.finalSC)}</span></div>
                </div>
              </div>
            )}

            {/* Tax Breakdown */}
            {taxBreakdown && (
              <div>
                <p className="text-xs font-semibold mb-2">Tax Calculation Breakdown</p>
                <div className="p-3 rounded border bg-muted/30 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Annual Taxable Income:</span><span>{formatCurrency(taxBreakdown.taxableIncome)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax Slab:</span><span>{taxBreakdown.taxSlab}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fixed Tax:</span><span>{formatCurrency(taxBreakdown.fixedTax)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Variable Tax:</span><span>{formatCurrency(taxBreakdown.variableTax)}</span></div>
                  <Separator />
                  <div className="flex justify-between font-bold"><span>Monthly Tax:</span><span>{formatCurrency(taxBreakdown.monthlyTax)}</span></div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ----------------------------------------------------------
  // Render: Post to GL Dialog with Journal Entry Preview
  // ----------------------------------------------------------
  const renderPostDialog = () => {
    if (!selectedBatch) return null

    const journalEntries = [
      { desc: 'Dr Salary Expense / Cr Salary Payable', amount: selectedBatch.totalBasicSalary, type: 'Basic Salary' },
      { desc: 'Dr Allowance Expense / Cr Allowance Payable', amount: selectedBatch.totalAllowances, type: 'Allowances' },
      { desc: 'Dr Salary Payable / Cr Income Tax Payable', amount: selectedBatch.totalIncomeTax, type: 'Income Tax' },
      { desc: 'Dr Salary Payable / Cr EOBI Payable (Emp)', amount: selectedBatch.totalEobiEmployee, type: 'EOBI (Employee)' },
      { desc: 'Dr Salary Payable / Cr PF Payable (Emp)', amount: selectedBatch.totalPfEmployee, type: 'PF (Employee)' },
      { desc: 'Dr Salary Payable / Cr Bank (Net Pay)', amount: selectedBatch.totalNetPay, type: 'Net Pay' },
      { desc: 'Dr Social Charges / Cr Social Charges Payable', amount: selectedBatch.totalSocialCharges, type: 'Social Charges' },
      { desc: 'Dr Employer EOBI / Cr EOBI Payable', amount: selectedBatch.totalEobiEmployer, type: 'Employer EOBI' },
      { desc: 'Dr Employer PF / Cr PF Payable', amount: selectedBatch.totalPfEmployer, type: 'Employer PF' },
    ].filter(e => e.amount > 0)

    return (
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Post Payroll to General Ledger
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will create journal entries in the General Ledger. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Batch Info */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Batch:</span><strong>{selectedBatch.name || selectedBatch.batchNumber}</strong></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Period:</span><strong>{selectedBatch.period}</strong></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Employees:</span><strong>{selectedBatch.lines?.length || 0}</strong></div>
            </div>

            {/* Journal Entry Preview */}
            <div>
              <p className="text-xs font-semibold mb-2">Journal Entry Preview</p>
              <div className="rounded border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Type</TableHead>
                      <TableHead className="text-[10px]">Entry</TableHead>
                      <TableHead className="text-[10px] text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntries.map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs py-1.5 font-medium">{entry.type}</TableCell>
                        <TableCell className="text-[10px] py-1.5 text-muted-foreground">{entry.desc}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right font-semibold">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm font-bold">Total GL Impact</span>
              <span className="text-sm font-bold">{formatCurrency(selectedBatch.totalGross + selectedBatch.totalEmployerCharges)}</span>
            </div>

            <div className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800">
                Once posted, the batch status will change to &ldquo;Posted&rdquo; and a Journal Voucher will be created in the General Ledger. This action is irreversible.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPostDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handlePostToGL}>
              <BookOpen className="h-3.5 w-3.5 mr-1" />
              Post to GL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ----------------------------------------------------------
  // Main Render
  // ----------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Gross</p>
                <p className="text-sm font-bold">{formatCurrency(kpiTotals.totalGross)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Deductions</p>
                <p className="text-sm font-bold text-red-600">{formatCurrency(kpiTotals.totalDeductions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Net Pay</p>
                <p className="text-sm font-bold text-green-600">{formatCurrency(kpiTotals.totalNetPay)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Social Charges</p>
                <p className="text-sm font-bold">{formatCurrency(kpiTotals.totalSocialCharges)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Employer Charges</p>
                <p className="text-sm font-bold">{formatCurrency(kpiTotals.totalEmployerCharges)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Payroll Batches
        </h3>
        <Button size="sm" className="h-8 text-xs" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />New Batch
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">Loading payroll batches...</p>
          </div>
        </div>
      )}

      {/* Batch Cards */}
      {!loading && batches.map(batch => {
        const isExpanded = expandedBatch === batch.id
        const isRunning = runningPayroll === batch.id
        const statusIdx = workflowSteps.indexOf(batch.status)

        return (
          <Card key={batch.id} className="group overflow-hidden">
            {/* Batch Header */}
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="min-w-0">
                    <CardTitle className="text-sm truncate">{batch.name || batch.batchNumber}</CardTitle>
                    <CardDescription className="text-[10px]">
                      {batch.batchNumber} | Period: {batch.period} | {batch.lines?.length || 0} employees
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`text-[10px] border ${statusStyles[batch.status] || ''}`}>
                    {statusLabels[batch.status] || batch.status}
                  </Badge>
                  {batch.postedToGL && (
                    <Badge className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200">
                      <CheckCircle className="h-3 w-3 mr-1" />GL Posted
                    </Badge>
                  )}
                </div>
              </div>

              {/* Workflow Status Bar */}
              {renderWorkflowBar(batch.status)}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {batch.status === 'draft' && (
                  <>
                    <Button
                      size="sm"
                      className="h-7 text-[10px]"
                      onClick={() => handleRunPayroll(batch)}
                      disabled={isRunning}
                    >
                      {isRunning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                      {isRunning ? 'Processing...' : 'Run Payroll'}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => openAddLineDialog(batch)}>
                      <Plus className="h-3 w-3 mr-1" />Add Line
                    </Button>
                    {batch.lines?.length > 0 && (
                      <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleWorkflowAction('review', batch.id)}>
                        <Send className="h-3 w-3 mr-1" />Submit for Review
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-600 hover:text-red-700" onClick={() => { setSelectedBatch(batch); setDeleteBatchDialogOpen(true) }}>
                      <Trash2 className="h-3 w-3 mr-1" />Delete
                    </Button>
                  </>
                )}
                {batch.status === 'reviewed' && (
                  <>
                    <Button size="sm" className="h-7 text-[10px]" onClick={() => handleWorkflowAction('approve', batch.id)}>
                      <Shield className="h-3 w-3 mr-1" />Approve
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleWorkflowAction('send-back', batch.id)}>
                      <ArrowRight className="h-3 w-3 mr-1 rotate-180" />Send Back
                    </Button>
                  </>
                )}
                {batch.status === 'approved' && (
                  <Button size="sm" className="h-7 text-[10px]" onClick={() => { setSelectedBatch(batch); setPostDialogOpen(true) }}>
                    <BookOpen className="h-3 w-3 mr-1" />Post to GL
                  </Button>
                )}
                {batch.status === 'posted' && (
                  <Badge className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200">
                    <CheckCircle className="h-3 w-3 mr-1" />Posted to GL
                  </Badge>
                )}
              </div>
            </CardHeader>

            {/* Expanded Content */}
            {isExpanded && (
              <CardContent>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
                  {[
                    { label: 'Basic Salary', value: batch.totalBasicSalary, color: '' },
                    { label: 'Allowances', value: batch.totalAllowances, color: '' },
                    { label: 'Gross', value: batch.totalGross, color: 'text-green-700' },
                    { label: 'Deductions', value: batch.totalDeductions, color: 'text-red-700' },
                    { label: 'Net Pay', value: batch.totalNetPay, color: 'text-green-700' },
                    { label: 'Social Charges', value: batch.totalSocialCharges, color: 'text-orange-700' },
                    { label: 'Employer Charges', value: batch.totalEmployerCharges, color: 'text-purple-700' },
                  ].map(item => (
                    <div key={item.label} className="text-center p-2 rounded bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p className={`text-xs font-bold ${item.color}`}>{formatCurrency(item.value)}</p>
                    </div>
                  ))}
                </div>

                <Separator className="mb-4" />

                {/* Employee Lines Table */}
                {batch.lines?.length > 0 ? (
                  <ScrollArea className="w-full">
                    <div className="min-w-[1200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] w-8"></TableHead>
                            <TableHead className="text-[10px]">Employee</TableHead>
                            <TableHead className="text-[10px]">Code</TableHead>
                            <TableHead className="text-[10px] text-center">Work</TableHead>
                            <TableHead className="text-[10px] text-center">Elig</TableHead>
                            <TableHead className="text-[10px] text-right">Basic</TableHead>
                            <TableHead className="text-[10px] text-right">Allow.</TableHead>
                            <TableHead className="text-[10px] text-right">Gross</TableHead>
                            <TableHead className="text-[10px] text-right">Tax</TableHead>
                            <TableHead className="text-[10px] text-right">EOBI(E)</TableHead>
                            <TableHead className="text-[10px] text-right">EOBI(R)</TableHead>
                            <TableHead className="text-[10px] text-right">PF(E)</TableHead>
                            <TableHead className="text-[10px] text-right">PF(R)</TableHead>
                            <TableHead className="text-[10px] text-right">Loan</TableHead>
                            <TableHead className="text-[10px] text-right">Net Pay</TableHead>
                            <TableHead className="text-[10px] text-right">SC</TableHead>
                            <TableHead className="text-[10px]">Project</TableHead>
                            {batch.status === 'draft' && <TableHead className="text-[10px] text-right">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batch.lines.map((line: any) => {
                            const isLineExpanded = expandedLine === line.id
                            return (
                              <Fragment key={line.id}>
                                <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedLine(isLineExpanded ? null : line.id)}>
                                  <TableCell className="py-1.5">
                                    {isLineExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                  </TableCell>
                                  <TableCell className="text-xs py-1.5 font-medium">{line.employeeName}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-muted-foreground">{line.employeeCode || '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-center">{line.workingDays}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-center">{line.eligibleDays}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right">{formatNumber(line.basicSalary)}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right">{line.allowances > 0 ? formatNumber(line.allowances) : '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right font-semibold">{formatNumber(line.grossSalary)}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right text-red-600">{line.incomeTax > 0 ? formatNumber(line.incomeTax) : '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right text-red-600">{line.eobiEmployee > 0 ? formatNumber(line.eobiEmployee) : '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right">{line.eobiEmployer > 0 ? formatNumber(line.eobiEmployer) : '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right text-red-600">{line.pfEmployee > 0 ? formatNumber(line.pfEmployee) : '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right">{line.pfEmployer > 0 ? formatNumber(line.pfEmployer) : '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right text-red-600">{line.loanDeduction > 0 ? formatNumber(line.loanDeduction) : '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right font-bold text-green-600">{formatNumber(line.netPay)}</TableCell>
                                  <TableCell className="text-xs py-1.5 text-right">{line.socialCharges > 0 ? formatNumber(line.socialCharges) : '-'}</TableCell>
                                  <TableCell className="text-xs py-1.5">{getProjectName(line.projectId)}</TableCell>
                                  {batch.status === 'draft' && (
                                    <TableCell className="py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditLineDialog(batch, line)}>
                                          <Pencil className="h-3 w-3 text-blue-600" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedLine(line); setDeleteLineDialogOpen(true) }}>
                                          <Trash2 className="h-3 w-3 text-red-600" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                </TableRow>
                                {/* Expanded Line Detail */}
                                {isLineExpanded && (
                                  <TableRow>
                                    <TableCell colSpan={batch.status === 'draft' ? 18 : 17} className="p-0">
                                      <div className="p-4 bg-muted/20 space-y-3">
                                        {/* Quick Detail Row */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                          {[
                                            { label: 'Leave Days', value: line.leaveDays },
                                            { label: 'Absent Days', value: line.absentDays },
                                            { label: 'Daily Rate', value: formatCurrency(line.dailyRate) },
                                            { label: 'Advance Ded.', value: formatCurrency(line.advanceDeduction) },
                                            { label: 'Other Ded.', value: formatCurrency(line.otherDeductions) },
                                            { label: 'Total Ded.', value: formatCurrency(line.totalDeductions) },
                                            { label: 'EOBI (Employer)', value: formatCurrency(line.eobiEmployer) },
                                            { label: 'PF (Employer)', value: formatCurrency(line.pfEmployer) },
                                            { label: 'Social Charges', value: formatCurrency(line.socialCharges) },
                                            { label: 'Gratuity', value: formatCurrency(line.gratuity) },
                                            { label: 'Department', value: line.department || '-' },
                                            { label: 'Project', value: getProjectName(line.projectId) },
                                          ].map(item => (
                                            <div key={item.label} className="p-2 rounded bg-background border text-center">
                                              <p className="text-[9px] text-muted-foreground">{item.label}</p>
                                              <p className="text-xs font-semibold">{item.value}</p>
                                            </div>
                                          ))}
                                        </div>

                                        {/* SC Breakdown */}
                                        {line.scBreakdown && (() => {
                                          let sc: any = null
                                          try { sc = JSON.parse(line.scBreakdown) } catch {}
                                          if (!sc) return null
                                          return (
                                            <div className="p-2 rounded border bg-background">
                                              <p className="text-[10px] font-semibold mb-1">SC Calculation</p>
                                              <div className="grid grid-cols-5 gap-2 text-[10px]">
                                                <div>Monthly: {formatCurrency(sc.monthlySC)}</div>
                                                <div>Ratio: {(sc.workingRatio * 100).toFixed(1)}%</div>
                                                <div>Earned: {formatCurrency(sc.earnedSC)}</div>
                                                <div>Leave Ded: {formatCurrency(sc.leaveDeduction)}</div>
                                                <div className="font-bold">Final: {formatCurrency(sc.finalSC)}</div>
                                              </div>
                                            </div>
                                          )
                                        })()}

                                        {/* Tax Breakdown */}
                                        {line.taxBreakdown && (() => {
                                          let tx: any = null
                                          try { tx = JSON.parse(line.taxBreakdown) } catch {}
                                          if (!tx) return null
                                          return (
                                            <div className="p-2 rounded border bg-background">
                                              <p className="text-[10px] font-semibold mb-1">Tax Calculation</p>
                                              <div className="grid grid-cols-4 gap-2 text-[10px]">
                                                <div>Annual: {formatCurrency(tx.taxableIncome)}</div>
                                                <div>Slab: {tx.taxSlab}</div>
                                                <div>Fixed: {formatCurrency(tx.fixedTax)} + Var: {formatCurrency(tx.variableTax)}</div>
                                                <div className="font-bold">Monthly: {formatCurrency(tx.monthlyTax)}</div>
                                              </div>
                                            </div>
                                          )
                                        })()}

                                        {/* Allowance Details */}
                                        {line.allowanceDetails && (() => {
                                          let ad: any[] = []
                                          try { ad = JSON.parse(line.allowanceDetails) } catch {}
                                          if (!ad.length) return null
                                          return (
                                            <div className="p-2 rounded border bg-background">
                                              <p className="text-[10px] font-semibold mb-1">Allowance Details</p>
                                              <div className="flex flex-wrap gap-2">
                                                {ad.map((a: any, i: number) => (
                                                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted">
                                                    {a.name}: {formatCurrency(a.amount)} {a.isTaxable ? '(Taxable)' : '(Non-Taxable)'}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )
                                        })()}

                                        <div className="flex justify-end">
                                          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => openLineDetail(line)}>
                                            <Eye className="h-3 w-3 mr-1" />Full Detail
                                          </Button>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No employee lines yet.</p>
                    <p className="text-[10px] text-muted-foreground">Click &ldquo;Run Payroll&rdquo; to auto-calculate or &ldquo;Add Line&rdquo; for manual entry.</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}

      {!loading && batches.length === 0 && (
        <div className="text-center py-12">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No payroll batches found.</p>
          <p className="text-xs text-muted-foreground mb-4">Create a new batch to start processing payroll.</p>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />New Batch
          </Button>
        </div>
      )}

      {/* ============ DIALOGS ============ */}

      {/* Create Batch Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Create Payroll Batch</DialogTitle>
            <DialogDescription className="text-xs">Create a new payroll batch for processing salaries.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Batch Name</Label>
              <Input className="h-9 text-xs" value={batchForm.name} onChange={e => setBatchForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., January 2025 Payroll" />
            </div>
            <div>
              <Label className="text-xs font-medium">Period (Month/Year) *</Label>
              <Input type="month" className="h-9 text-xs" value={batchForm.period} onChange={e => setBatchForm(p => ({ ...p, period: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium">Project</Label>
              <Select value={batchForm.projectId} onValueChange={v => setBatchForm(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Projects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">All Projects</SelectItem>
                  {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateBatch}>Create Batch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Line Dialog */}
      <Dialog open={addLineDialogOpen} onOpenChange={setAddLineDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Employee to Batch</DialogTitle>
            <DialogDescription className="text-xs">Manually add an employee line to the payroll batch.</DialogDescription>
          </DialogHeader>
          {renderLineFormFields()}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddLineDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddLine}>Add Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Line Dialog */}
      <Dialog open={editLineDialogOpen} onOpenChange={setEditLineDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Employee Line</DialogTitle>
            <DialogDescription className="text-xs">Modify the payroll details for this employee.</DialogDescription>
          </DialogHeader>
          {renderLineFormFields()}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditLineDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdateLine}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Line Detail Dialog */}
      {renderLineDetailDialog()}

      {/* Post to GL Dialog */}
      {renderPostDialog()}

      {/* Delete Batch Confirmation */}
      <AlertDialog open={deleteBatchDialogOpen} onOpenChange={setDeleteBatchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Payroll Batch</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete &ldquo;{selectedBatch?.name || selectedBatch?.batchNumber}&rdquo;? All employee lines will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteBatch}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Line Confirmation */}
      <AlertDialog open={deleteLineDialogOpen} onOpenChange={setDeleteLineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Remove Employee</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to remove &ldquo;{selectedLine?.employeeName}&rdquo; from this batch? Batch totals will be recalculated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteLine}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
