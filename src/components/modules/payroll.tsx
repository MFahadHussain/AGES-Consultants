'use client'

import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
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
  TrendingDown, TrendingUp, Building2, Receipt, AlertCircle, Eye,
  FileText, FolderOpen, DollarSign
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function formatNumber(amount: number) {
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

// Status styles
const statusStyles: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  reviewed: 'bg-sky-100 text-sky-800 border-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  posted: 'bg-purple-100 text-purple-800 border-purple-200',
  'draft-to-gl': 'bg-violet-100 text-violet-800 border-violet-200',
}

const lineStatusStyles: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  reviewed: 'bg-sky-100 text-sky-800 border-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  reviewed: 'Reviewed',
  approved: 'Approved',
  posted: 'Posted to GL',
  'draft-to-gl': 'Draft to GL',
}

// Workflow steps — enhanced with action labels
const workflowSteps = ['draft', 'reviewed', 'approved', 'draft-to-gl', 'posted']
const workflowStepActions: Record<string, { label: string; action: string; icon: any }[]> = {
  draft: [{ label: 'Review', action: 'review-line', icon: Eye }],
  reviewed: [
    { label: 'Approve', action: 'approve', icon: Shield },
    { label: 'Send Back', action: 'send-back', icon: ArrowRight },
  ],
  approved: [{ label: 'Draft to Voucher', action: 'draft-to-gl', icon: FileText }],
  'draft-to-gl': [{ label: 'Post to GL', action: 'post-to-gl', icon: BookOpen }],
  posted: [],
}

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

// ── Journal Voucher Card Component ──────────────────────────────────────────
function JournalVoucherCard({ batch, draftVoucher, setDraftVoucher }: { batch: any; draftVoucher: any; setDraftVoucher: (v: any) => void }) {
  const [fetchedVoucher, setFetchedVoucher] = useState<any>(null)
  const [loadingVoucher, setLoadingVoucher] = useState(false)
  const fetchedVoucherIdRef = useRef<string | null>(null)

  // Use draftVoucher directly if available (from API response), otherwise fetch from DB
  const voucherData = draftVoucher?.voucherId ? draftVoucher : fetchedVoucher

  // Fetch voucher data from DB when batch has a postedVoucherId and no draftVoucher
  const fetchVoucherData = useCallback(async (voucherId: string) => {
    setLoadingVoucher(true)
    try {
      const r = await fetch(`/api/vouchers/${voucherId}`)
      const data = await r.json()
      if (data.entries) {
        setFetchedVoucher({
          voucherId: data.id,
          voucherNumber: data.voucherNumber,
          voucherStatus: data.status,
          totalDebit: data.totalDebit,
          totalCredit: data.totalCredit,
          entries: data.entries.map((e: any) => ({
            lineNumber: e.lineNumber,
            accountId: e.accountId,
            accountCode: e.account?.code || '',
            accountName: e.account?.name || 'Unknown',
            debit: e.debit,
            credit: e.credit,
            description: e.description,
          })),
        })
      }
    } catch {
      // ignore
    } finally {
      setLoadingVoucher(false)
    }
  }, [])

  useEffect(() => {
    if (draftVoucher?.voucherId) return
    if (batch.postedVoucherId && fetchedVoucherIdRef.current !== batch.postedVoucherId) {
      fetchedVoucherIdRef.current = batch.postedVoucherId
      fetchVoucherData(batch.postedVoucherId)
    }
  }, [batch.postedVoucherId, draftVoucher?.voucherId, fetchVoucherData])

  const isBalanced = voucherData && Math.abs(voucherData.totalDebit - voucherData.totalCredit) < 1

  if (loadingVoucher) {
    return (
      <Card className="border-violet-200 bg-violet-50/30">
        <CardContent className="p-4 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-violet-600" />
          <p className="text-xs text-violet-600 mt-2">Loading journal voucher...</p>
        </CardContent>
      </Card>
    )
  }

  if (!voucherData) return null

  return (
    <Card className="voucher-print-area border-violet-200 bg-gradient-to-br from-violet-50/50 to-slate-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-600" />
            <CardTitle className="text-sm font-bold text-violet-900">JOURNAL VOUCHER</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-[10px] border ${voucherData.voucherStatus === 'draft' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
              {voucherData.voucherStatus === 'draft' ? 'DRAFT' : voucherData.voucherStatus === 'posted' ? 'POSTED' : (voucherData.voucherStatus || '').toUpperCase()}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-xs text-muted-foreground">Voucher No:</span>
          <span className="text-xs font-mono font-bold text-violet-800">{voucherData.voucherNumber || `JV-PAY-${batch.batchNumber}`}</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Print-only company header */}
        <div className="print-only hidden" style={{textAlign: 'center', marginBottom: '20px'}}>
          <h1 style={{fontSize: '18px', fontWeight: 'bold'}}>AcctFin ERP</h1>
          <p>Journal Voucher - Payroll Posting</p>
          <p>Voucher No: {voucherData.voucherNumber || `JV-PAY-${batch.batchNumber}`} | Date: {new Date().toLocaleDateString()}</p>
        </div>
        <div className="rounded border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-violet-100/50">
                <TableHead className="text-[10px] h-8 w-10">#</TableHead>
                <TableHead className="text-[10px] h-8">Account Code</TableHead>
                <TableHead className="text-[10px] h-8">Account Name</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Debit (PKR)</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Credit (PKR)</TableHead>
                <TableHead className="text-[10px] h-8">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {voucherData.entries.map((entry: any, idx: number) => (
                <TableRow key={idx} className={entry.debit > 0 ? 'bg-red-50/30' : 'bg-green-50/30'}>
                  <TableCell className="text-[10px] py-1.5 font-mono">{entry.lineNumber}</TableCell>
                  <TableCell className="text-[10px] py-1.5 font-mono">{entry.accountCode}</TableCell>
                  <TableCell className="text-[10px] py-1.5 font-medium">{entry.accountName}</TableCell>
                  <TableCell className="text-[10px] py-1.5 text-right font-mono">{entry.debit > 0 ? formatCurrency(entry.debit) : ''}</TableCell>
                  <TableCell className="text-[10px] py-1.5 text-right font-mono">{entry.credit > 0 ? formatCurrency(entry.credit) : ''}</TableCell>
                  <TableCell className="text-[10px] py-1.5 text-muted-foreground">{entry.description}</TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-violet-100/50 font-bold border-t-2 border-violet-300">
                <TableCell className="text-[10px] py-2" colSpan={3}>TOTAL</TableCell>
                <TableCell className="text-[10px] py-2 text-right font-mono">{formatCurrency(voucherData.totalDebit)}</TableCell>
                <TableCell className="text-[10px] py-2 text-right font-mono">{formatCurrency(voucherData.totalCredit)}</TableCell>
                <TableCell className="text-[10px] py-2"></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {/* Balance validation */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {isBalanced ? (
              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle className="h-3 w-3 mr-1" />Balanced (Dr = Cr)
              </Badge>
            ) : (
              <Badge className="text-[10px] bg-red-100 text-red-800 border border-red-200">
                <AlertCircle className="h-3 w-3 mr-1" />Imbalanced (Diff: {formatCurrency(Math.abs(voucherData.totalDebit - voucherData.totalCredit))})
              </Badge>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {voucherData.entries.length} entries | Approved lines: {voucherData.approvedLineCount || '—'}
          </div>
        </div>
        {/* Print-only signature lines */}
        <div className="print-only hidden" style={{marginTop: '30px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '40px'}}>
            <div style={{textAlign: 'center'}}><div style={{borderTop: '1px solid #000', width: '150px', paddingTop: '4px'}}>Prepared By</div></div>
            <div style={{textAlign: 'center'}}><div style={{borderTop: '1px solid #000', width: '150px', paddingTop: '4px'}}>Reviewed By</div></div>
            <div style={{textAlign: 'center'}}><div style={{borderTop: '1px solid #000', width: '150px', paddingTop: '4px'}}>Approved By</div></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
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
  const { authUser } = useAppStore()
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

  // Calculator state (Fix 4)
  const [calculatorPeriod, setCalculatorPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [calculatorData, setCalculatorData] = useState<any[]>([])
  const [calculating, setCalculating] = useState(false)

  // Project Cost state
  const [projectCostData, setProjectCostData] = useState<any>(null)
  const [projectCostPeriod, setProjectCostPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [loadingProjectCost, setLoadingProjectCost] = useState(false)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  // Draft voucher state (Fix 5)
  const [draftVoucher, setDraftVoucher] = useState<any>(null)
  const [voucherPosted, setVoucherPosted] = useState(false)
  const [showJournalEntries, setShowJournalEntries] = useState(false)
  const [postConfirmOpen, setPostConfirmOpen] = useState(false)

  // Line selection state (Task 4)
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set())
  const [draftToGLDialogOpen, setDraftToGLDialogOpen] = useState(false)
  const [processingAction, setProcessingAction] = useState<string | null>(null)

  // Project-wise payment state
  const [projectPayView, setProjectPayView] = useState<string | null>(null) // batchId when active
  const [payingProjectId, setPayingProjectId] = useState<string | null>(null)

  // GL Voucher workflow state
  const [generatedVouchers, setGeneratedVouchers] = useState<any[]>([])
  const [glVoucherLoading, setGlVoucherLoading] = useState(false)
  const [expandedVoucherEmp, setExpandedVoucherEmp] = useState<string | null>(null)

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

  const handlePostAllVouchersToGL = async () => {
    let postedCount = 0
    for (const v of generatedVouchers.filter(v => v.status === 'draft')) {
      try {
        const res = await fetch(`/api/vouchers/${v.voucherId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'post' }),
        })
        if (res.ok) {
          postedCount++
          setGeneratedVouchers(prev => prev.map(vs => vs.voucherId === v.voucherId ? { ...vs, status: 'posted' } : vs))
        }
      } catch {
        // ignore individual errors
      }
    }
    if (postedCount > 0) {
      toast({ title: 'Posted to GL', description: `${postedCount} voucher(s) posted to General Ledger` })
      fetchData()
    }
  }

  const handlePostVoucherToGL = async (voucherId: string) => {
    try {
      const res = await fetch(`/api/vouchers/${voucherId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post' }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Posted', description: 'Voucher posted to General Ledger' })
      setGeneratedVouchers(prev => prev.map(v => v.voucherId === voucherId ? { ...v, status: 'posted' } : v))
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

  // ----------------------------------------------------------
  // Task 4: Line-level approve and Draft to GL handlers
  // ----------------------------------------------------------
  const toggleLineSelection = (lineId: string) => {
    setSelectedLineIds(prev => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const toggleSelectAllLines = (batch: any) => {
    const lineIds = (batch.lines || []).map((l: any) => l.id)
    const allSelected = lineIds.length > 0 && lineIds.every((id: string) => selectedLineIds.has(id))
    if (allSelected) {
      setSelectedLineIds(new Set())
    } else {
      setSelectedLineIds(new Set(lineIds))
    }
  }

  const handleReviewSelectedLines = async () => {
    if (selectedLineIds.size === 0) {
      toast({ title: 'Error', description: 'No lines selected', variant: 'destructive' })
      return
    }
    setProcessingAction('review-line')
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review-line', lineIds: Array.from(selectedLineIds) }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Reviewed', description: `${selectedLineIds.size} line(s) reviewed` })
      setSelectedLineIds(new Set())
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setProcessingAction(null)
    }
  }

  const handleApproveSelectedLines = async () => {
    if (selectedLineIds.size === 0) {
      toast({ title: 'Error', description: 'No lines selected', variant: 'destructive' })
      return
    }
    setProcessingAction('approve-line')
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve-line', lineIds: Array.from(selectedLineIds) }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Approved', description: `${selectedLineIds.size} line(s) approved` })
      setSelectedLineIds(new Set())
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setProcessingAction(null)
    }
  }

  const handleSendBackSelectedLines = async () => {
    if (selectedLineIds.size === 0) {
      toast({ title: 'Error', description: 'No lines selected', variant: 'destructive' })
      return
    }
    setProcessingAction('send-back-lines')
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-back-lines', lineIds: Array.from(selectedLineIds) }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Sent Back', description: `${selectedLineIds.size} line(s) sent back to Draft` })
      setSelectedLineIds(new Set())
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setProcessingAction(null)
    }
  }

  const handleReviewAllLines = async (batchId: string) => {
    setProcessingAction('review-all-lines')
    try {
      const batch = batches.find((b: any) => b.id === batchId)
      if (!batch) return
      const lineIds = (batch.lines || []).map((l: any) => l.id)
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review-line', lineIds }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Reviewed', description: result.message || `${lineIds.length} line(s) reviewed` })
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setProcessingAction(null)
    }
  }

  const handleApproveAllLines = async (batchId: string) => {
    setProcessingAction('approve-all-lines')
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve-all-lines', batchId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Approved', description: result.message || 'All lines approved' })
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setProcessingAction(null)
    }
  }

  const handleDraftToGL = async (lineIds?: string[]) => {
    if (!selectedBatch) return
    const fy = financialYears.find((f: any) => f.status === 'open')
    if (!fy) { toast({ title: 'Error', description: 'No open financial year found', variant: 'destructive' }); return }

    setProcessingAction('draft-to-gl')
    setGlVoucherLoading(true)
    try {
      const body: any = {
        batchId: selectedBatch.id,
        mode: 'project-wise',
        financialYearId: fy.id,
      }
      if (lineIds && lineIds.length > 0) body.lineIds = lineIds

      const res = await fetch('/api/payroll/generate-gl-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')

      setGeneratedVouchers(result.vouchers || [])
      setDraftToGLDialogOpen(false)
      setSelectedLineIds(new Set())
      toast({
        title: 'Project-wise Vouchers Created',
        description: `${result.vouchers?.length || 0} draft voucher(s) created for each project`,
      })
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setProcessingAction(null)
      setGlVoucherLoading(false)
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

  const getProjectCode = (projectId: string | null) => {
    if (!projectId) return 'N/A'
    const p = projects.find((pr: any) => pr.id === projectId)
    return p ? p.code : 'N/A'
  }

  // ----------------------------------------------------------
  // Project-wise Payment: Grouping & Handler
  // ----------------------------------------------------------
  interface ProjectPayGroup {
    projectId: string | null
    projectName: string
    projectCode: string
    employeeCount: number
    totalGross: number
    totalDeductions: number
    totalNetPay: number
    totalSocialCharges: number
    lineIds: string[]
    allLinesApproved: boolean
    anyLinesApproved: boolean
    allLinesPaid: boolean
  }

  const computeProjectPayGroups = (batch: any): ProjectPayGroup[] => {
    const lines = batch.lines || []
    const groupMap = new Map<string, ProjectPayGroup>()

    for (const line of lines) {
      const key = line.projectId || '__unassigned__'
      if (!groupMap.has(key)) {
        const p = line.projectId ? projects.find((pr: any) => pr.id === line.projectId) : null
        groupMap.set(key, {
          projectId: line.projectId,
          projectName: line.projectId ? (p ? p.name : line.projectId) : 'Unassigned',
          projectCode: line.projectId ? (p ? p.code : 'N/A') : '—',
          employeeCount: 0,
          totalGross: 0,
          totalDeductions: 0,
          totalNetPay: 0,
          totalSocialCharges: 0,
          lineIds: [],
          allLinesApproved: true,
          anyLinesApproved: false,
          allLinesPaid: false,
        })
      }

      const group = groupMap.get(key)!
      group.employeeCount++
      group.totalGross += line.grossSalary || 0
      group.totalDeductions += line.totalDeductions || 0
      group.totalNetPay += line.netPay || 0
      group.totalSocialCharges += line.socialCharges || 0
      group.lineIds.push(line.id)

      const lineStatus = line.lineStatus || 'draft'
      if (lineStatus !== 'approved') group.allLinesApproved = false
      if (lineStatus === 'approved') group.anyLinesApproved = true
    }

    // Determine paid status: all lines in group are approved
    for (const group of groupMap.values()) {
      group.allLinesPaid = group.allLinesApproved && group.employeeCount > 0
    }

    // Sort: assigned projects first, unassigned last
    const groups = Array.from(groupMap.values())
    groups.sort((a, b) => {
      if (a.projectId === null) return 1
      if (b.projectId === null) return -1
      return a.projectName.localeCompare(b.projectName)
    })

    return groups
  }

  const handlePayProject = async (group: ProjectPayGroup, batchId: string) => {
    const batch = batches.find((b: any) => b.id === batchId)
    if (!batch) return

    setPayingProjectId(group.projectId || '__unassigned__')
    try {
      // Step 1: If batch is in draft, review it first
      if (batch.status === 'draft') {
        const reviewRes = await fetch('/api/payroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'review', batchId }),
        })
        if (!reviewRes.ok) {
          const err = await reviewRes.json()
          throw new Error(err.error || 'Failed to review batch')
        }
      }

      // Step 2: Approve lines for this project
      const approveRes = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve-line', lineIds: group.lineIds }),
      })
      const approveResult = await approveRes.json()
      if (!approveRes.ok) throw new Error(approveResult.error || 'Failed to approve lines')

      // Step 3: Create a project-wise draft-to-GL voucher for this project's approved lines
      const fy = financialYears.find((f: any) => f.status === 'open')
      if (fy) {
        const glRes = await fetch('/api/payroll/generate-gl-voucher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId,
            mode: 'project-wise',
            financialYearId: fy.id,
            lineIds: group.lineIds,
          }),
        })
        const glResult = await glRes.json()
        if (!glRes.ok) throw new Error(glResult.error || 'Failed to create GL voucher')
      }

      toast({
        title: 'Salary Paid — Project: ' + group.projectName,
        description: `${group.employeeCount} employee(s) paid. Net Pay: ${formatCurrency(group.totalNetPay)}`,
      })
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setPayingProjectId(null)
    }
  }

  // ----------------------------------------------------------
  // Fix 4: Attendance-Driven Payroll Calculator (Backend API)
  // ----------------------------------------------------------
  const handleRecalculate = async () => {
    setCalculating(true)
    try {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allEmployees: true, month: calculatorPeriod, skipValidation: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Calculation failed')

      // data.results is a Record<employeeId, PayrollResult>
      const rows = Object.values(data.results || {}) as any[]
      setCalculatorData(rows)
      setDraftVoucher(null)
      setVoucherPosted(false)
      toast({
        title: 'Calculation Complete',
        description: `Processed ${data.successful || rows.length} employees${data.failed ? ` (${data.failed} failed)` : ''}`,
      })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setCalculating(false)
    }
  }

  // ----------------------------------------------------------
  // Project Cost Breakdown fetcher
  // ----------------------------------------------------------
  const fetchProjectCost = useCallback(async (month?: string) => {
    const period = month || projectCostPeriod
    setLoadingProjectCost(true)
    try {
      const res = await fetch(`/api/payroll/project-cost?month=${period}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load project cost')
      setProjectCostData(data)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
      setProjectCostData(null)
    } finally {
      setLoadingProjectCost(false)
    }
  }, [projectCostPeriod, toast])

  // ----------------------------------------------------------
  // Fix 5: Draft → Post Voucher Workflow
  // ----------------------------------------------------------
  const handleCreateDraftVoucher = () => {
    if (calculatorData.length === 0) {
      toast({ title: 'Error', description: 'Calculate payroll first', variant: 'destructive' })
      return
    }
    const totalNetPay = calculatorData.reduce((sum, r) => sum + r.netPay, 0)
    if (totalNetPay <= 0) {
      toast({ title: 'Error', description: 'Total net pay must be greater than zero', variant: 'destructive' })
      return
    }

    const voucherNo = `DRAFT-PAY-${String(Date.now()).slice(-6)}`
    const periodLabel = new Date(calculatorPeriod + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

    const lines = calculatorData.map((r: any) => ({
      account: `Salary Expense - ${r.employee?.name || r.employeeName || 'Unknown'}`,
      debit: r.netPay,
      credit: 0,
    }))
    lines.push({
      account: 'Salaries Payable',
      debit: 0,
      credit: totalNetPay,
    })

    setDraftVoucher({
      voucherNo,
      type: 'Payroll',
      status: 'Draft',
      period: periodLabel,
      createdBy: authUser?.name || 'System',
      createdAt: new Date().toISOString(),
      lines,
      totalAmount: totalNetPay,
    })
    setVoucherPosted(false)
  }

  const confirmPostVoucher = async () => {
    try {
      setDraftVoucher((prev: any) => ({
        ...prev,
        status: 'Posted',
        postedAt: new Date().toISOString(),
      }))
      setVoucherPosted(true)
      setPostConfirmOpen(false)
      toast({ title: 'Posted', description: 'Voucher posted to general ledger' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // Auto-calculate from attendance when employee selected in add-line dialog
  const handleEmployeeSelectForLine = async (empId: string) => {
    const emp = employees.find((e: any) => e.id === empId)
    if (!emp) return

    const basicSalary = emp.baseSalary || 0
    const period = selectedBatch?.period || calculatorPeriod
    const [pYear, pMonth] = period.split('-').map(Number)
    const workingDays = new Date(pYear, pMonth, 0).getDate()
    const dailyRate = basicSalary / workingDays

    let presentDays = 0
    let leaveDays = 0
    let absentDays = 0

    try {
      const attRes = await fetch(`/api/attendance?month=${period}&pageSize=2000&employeeId=${empId}`)
      const attData = await attRes.json()
      const records = Array.isArray(attData?.data) ? attData.data : Array.isArray(attData) ? attData : []
      const empRecords = records.filter((r: any) => r.employeeId === empId)

      const PRESENT_STATUSES = new Set(['P', 'W', 'H', 'WH', 'WW', 'T', 'CO'])
      const LEAVE_STATUSES = new Set(['SL', 'CL', 'EL'])

      for (const rec of empRecords) {
        if (PRESENT_STATUSES.has(rec.status)) presentDays++
        else if (LEAVE_STATUSES.has(rec.status)) leaveDays++
        else if (rec.status === 'A') absentDays++
      }
    } catch {
      // If attendance fetch fails, leave at 0
    }

    const eligibleDays = presentDays + leaveDays
    const earnedSalary = eligibleDays * dailyRate

    setLineForm(p => ({
      ...p,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.employeeCode || '',
      basicSalary,
      dailyRate: Math.round(dailyRate),
      workingDays,
      eligibleDays,
      leaveDays,
      absentDays,
      department: emp.department || '',
      projectId: emp.defaultProjectId || '',
    }))
  }

  // ----------------------------------------------------------
  // Render: Workflow Status Bar
  // ----------------------------------------------------------
  const renderWorkflowBar = (status: string, batchId: string) => {
    const currentIdx = workflowSteps.indexOf(status)
    const effectiveIdx = currentIdx >= 0 ? currentIdx : 0
    return (
      <div className="flex items-center gap-1 my-3 flex-wrap">
        {workflowSteps.map((step, idx) => {
          const stepActions = workflowStepActions[step] || []
          return (
            <div key={step} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                idx <= effectiveIdx
                  ? idx === effectiveIdx
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {idx <= effectiveIdx && <CheckCircle className="h-3 w-3" />}
                <span>{statusLabels[step]}</span>
                {/* Show action buttons for the current step */}
                {idx === effectiveIdx && stepActions.length > 0 && (
                  <div className="flex items-center gap-1 ml-2">
                    {stepActions.map((sa) => {
                      const IconComp = sa.icon
                      return (
                        <Button
                          key={sa.action}
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[9px] bg-white/20 hover:bg-white/40 text-primary-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (sa.action === 'post-to-gl') {
                              // Post all draft vouchers to GL
                              handlePostAllVouchersToGL()
                            } else if (sa.action === 'draft-to-gl') {
                              setSelectedBatch(batches.find((b: any) => b.id === batchId) || null)
                              setDraftToGLDialogOpen(true)
                            } else {
                              handleWorkflowAction(sa.action, batchId)
                            }
                          }}
                        >
                          <IconComp className="h-2.5 w-2.5 mr-0.5" />
                          {sa.label}
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
              {idx < workflowSteps.length - 1 && (
                <ArrowRight className={`h-4 w-4 ${idx < effectiveIdx ? 'text-primary' : 'text-muted-foreground'}`} />
              )}
            </div>
          )
        })}
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
              handleEmployeeSelectForLine(v)
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
              <Badge className={`text-[9px] border ml-2 ${lineStatusStyles[selectedLine.lineStatus || 'draft']}`}>
                {selectedLine.lineStatus === 'reviewed' ? 'Reviewed' : selectedLine.lineStatus === 'approved' ? 'Approved' : 'Draft'}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">Detailed payroll breakdown</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Line Status & Compliance Indicators */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-[10px] border ${lineStatusStyles[selectedLine.lineStatus || 'draft']}`}>
                Line: {selectedLine.lineStatus === 'reviewed' ? 'Reviewed' : selectedLine.lineStatus === 'approved' ? 'Approved' : 'Draft'}
              </Badge>
              {selectedLine.eobiEmployee > 0 && (
                <Badge className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200">
                  <Shield className="h-3 w-3 mr-1" />EOBI: Active
                </Badge>
              )}
              {selectedLine.essiEmployee > 0 && (
                <Badge className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200">
                  <Shield className="h-3 w-3 mr-1" />ESSI: Active
                </Badge>
              )}
              {selectedLine.pfEmployee > 0 && (
                <Badge className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Building2 className="h-3 w-3 mr-1" />PF: Active
                </Badge>
              )}
              {selectedLine.incomeTax > 0 && (
                <Badge className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                  <Receipt className="h-3 w-3 mr-1" />Income Tax: Deducted
                </Badge>
              )}
              {selectedLine.eobiEmployee === 0 && selectedLine.pfEmployee === 0 && selectedLine.incomeTax === 0 && (
                <Badge className="text-[10px] bg-muted text-muted-foreground border">
                  No statutory deductions
                </Badge>
              )}
            </div>

            {/* Attendance */}
            <div>
              <p className="text-xs font-semibold mb-2">Attendance</p>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { label: 'Calendar Days', value: selectedLine.calendarDays || selectedLine.workingDays, color: 'text-foreground' },
                  { label: 'Payable Days', value: selectedLine.payableDays || selectedLine.eligibleDays, color: 'text-foreground' },
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
                  { label: 'ESSI (Emp)', value: selectedLine.essiEmployee },
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
              <div className="grid grid-cols-5 gap-2">
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">EOBI (Er)</p>
                  <p className="text-xs font-bold">{formatCurrency(selectedLine.eobiEmployer)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">ESSI (Er)</p>
                  <p className="text-xs font-bold">{formatCurrency(selectedLine.essiEmployer)}</p>
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Working Days (Month):</span><span>{selectedLine.calendarDays || selectedLine.workingDays}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SC Eligible Days:</span><span>{scBreakdown.scEligDays ?? '-'} <span className="text-muted-foreground">(P + W + H + WH + T + CO)</span></span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Leave Days (paid, no SC):</span><span>{scBreakdown.leaveDaysPaid ?? scBreakdown.leaveDeduction > 0 ? '-' : '0'} <span className="text-muted-foreground">(SL + CL + EL)</span></span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Absent Days (info):</span><span>{selectedLine.absentDays}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Attendance Ratio:</span><span>{Math.round((scBreakdown.attendanceRatio ?? scBreakdown.workingRatio) * 100)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Monthly Salary:</span><span>{formatCurrency(selectedLine.grossSalary)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SC Base (salary × ratio):</span><span>{formatCurrency(scBreakdown.scBase ?? scBreakdown.earnedSC)}</span></div>
                  <Separator />
                  <div className="flex justify-between"><span className="text-muted-foreground">Other Payable (8.33%):</span><span>{formatCurrency(Math.round((scBreakdown.scBase ?? scBreakdown.earnedSC) * 0.0833))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Earned Leave (8.33%):</span><span>{formatCurrency(Math.round((scBreakdown.scBase ?? scBreakdown.earnedSC) * 0.0833))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Sick Leave (1.67%):</span><span>{formatCurrency(Math.round((scBreakdown.scBase ?? scBreakdown.earnedSC) * 0.0167))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Casual Leave (1.67%):</span><span>{formatCurrency(Math.round((scBreakdown.scBase ?? scBreakdown.earnedSC) * 0.0167))}</span></div>
                  <Separator />
                  <div className="flex justify-between font-bold"><span>TOTAL SC (20.00%):</span><span>{formatCurrency(scBreakdown.finalSC)}</span></div>
                  <div className="text-[10px] text-amber-600 mt-1">⚠ Added to SC balance ledger — not deducted from net pay</div>
                  {/* Per-project SC breakdown for multi-contract */}
                  {scBreakdown.projectScDetails && scBreakdown.projectScDetails.length > 0 && (
                    <>
                      <Separator />
                      <p className="font-semibold text-[10px] mt-1">Per-Project SC Breakdown</p>
                      {scBreakdown.projectScDetails.map((psc: any, idx: number) => (
                        <div key={idx} className="pl-2 border-l-2 border-muted space-y-0.5 mt-1">
                          <div className="flex justify-between"><span className="text-muted-foreground">{psc.projectName}:</span><span>{formatCurrency(psc.projectSC)}</span></div>
                          <div className="text-[10px] text-muted-foreground">SC Days: {psc.projectScEligDays} | Ratio: {Math.round(psc.projectRatio * 100)}% | Base: {formatCurrency(psc.projectScBase)}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Tax Breakdown */}
            {taxBreakdown && (
              <div>
                <p className="text-xs font-semibold mb-2">Tax Calculation Breakdown</p>
                <div className="p-3 rounded border bg-muted/30 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Annual Taxable Income:</span><span>{formatCurrency(taxBreakdown.taxableIncome)}</span></div>
                  {taxBreakdown.ytdIncome != null && <div className="flex justify-between"><span className="text-muted-foreground">YTD Income:</span><span>{formatCurrency(taxBreakdown.ytdIncome)}</span></div>}
                  {taxBreakdown.projectedAnnualIncome != null && <div className="flex justify-between"><span className="text-muted-foreground">Projected Annual Income:</span><span>{formatCurrency(taxBreakdown.projectedAnnualIncome)}</span></div>}
                  {taxBreakdown.taxPaidYtd != null && <div className="flex justify-between"><span className="text-muted-foreground">Tax Paid YTD:</span><span>{formatCurrency(taxBreakdown.taxPaidYtd)}</span></div>}
                  {taxBreakdown.monthsWorkedYtd != null && <div className="flex justify-between"><span className="text-muted-foreground">Months Worked YTD:</span><span>{taxBreakdown.monthsWorkedYtd}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax Slab:</span><span>{taxBreakdown.taxSlab}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fixed Tax:</span><span>{formatCurrency(taxBreakdown.fixedTax)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Variable Tax:</span><span>{formatCurrency(taxBreakdown.variableTax)}</span></div>
                  <Separator />
                  <div className="flex justify-between font-bold"><span>Monthly Tax:</span><span>{formatCurrency(taxBreakdown.monthlyTax)}</span></div>
                </div>
              </div>
            )}

            {/* Multi-Contract Earnings */}
            {selectedLine.contractEarnings && (() => {
              let ce: any[] = []
              try { ce = JSON.parse(selectedLine.contractEarnings) } catch {}
              if (!ce.length) return null
              return (
                <div>
                  <p className="text-xs font-semibold mb-2">Multi-Contract Earnings</p>
                  <div className="rounded border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Contract / Project</TableHead>
                          <TableHead className="text-[10px] text-right">Contract Salary</TableHead>
                          <TableHead className="text-[10px] text-right">Daily Rate</TableHead>
                          <TableHead className="text-[10px] text-center">Days Worked</TableHead>
                          <TableHead className="text-[10px] text-center">Abs</TableHead>
                          <TableHead className="text-[10px] text-right">Earned Salary</TableHead>
                          <TableHead className="text-[10px] text-right">SC Share</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ce.map((contract: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs py-1 font-medium">{contract.projectCode} — {contract.projectName}</TableCell>
                            <TableCell className="text-xs py-1 text-right">{formatCurrency(contract.contractSalary)}</TableCell>
                            <TableCell className="text-xs py-1 text-right">{formatCurrency(contract.dailyRate)}</TableCell>
                            <TableCell className="text-xs py-1 text-center">{contract.daysWorked}</TableCell>
                            <TableCell className="text-xs py-1 text-center text-red-500">{contract.absentDays}</TableCell>
                            <TableCell className="text-xs py-1 text-right font-medium">{formatCurrency(contract.earnedSalary)}</TableCell>
                            <TableCell className="text-xs py-1 text-right text-orange-600">{formatCurrency(contract.scShare)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-50">
                          <TableCell colSpan={5} className="text-xs py-1 text-right font-bold">Total Combined</TableCell>
                          <TableCell className="text-xs py-1 text-right font-bold text-emerald-700">{formatCurrency(ce.reduce((s: number, c: any) => s + c.earnedSalary, 0))}</TableCell>
                          <TableCell className="text-xs py-1 text-right font-bold">{formatCurrency(ce.reduce((s: number, c: any) => s + c.scShare, 0))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 italic">Multi-contract: Each contract has its own salary. Earned = (Contract Salary ÷ Calendar Days) × Days Worked. Tax on combined total.</p>
                </div>
              )
            })()}

            {/* Project Allocation (fallback when no contract earnings) */}
            {!selectedLine.contractEarnings && selectedLine.projectAllocations && (() => {
              let pa: any[] = []
              try { pa = JSON.parse(selectedLine.projectAllocations) } catch {}
              if (!pa.length) return null
              return (
                <div>
                  <p className="text-xs font-semibold mb-2">Project Allocation Breakdown</p>
                  <div className="rounded border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Project</TableHead>
                          <TableHead className="text-[10px] text-center">Days</TableHead>
                          <TableHead className="text-[10px] text-right">Weight</TableHead>
                          <TableHead className="text-[10px] text-right">Salary Share</TableHead>
                          <TableHead className="text-[10px] text-right">SC Share</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pa.map((alloc: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs py-1 font-medium">{alloc.projectCode} — {alloc.projectName}</TableCell>
                            <TableCell className="text-xs py-1 text-center">{alloc.days}</TableCell>
                            <TableCell className="text-xs py-1 text-right">{alloc.weightPct || Math.round((alloc.weight || 0) * 100) + '%'}</TableCell>
                            <TableCell className="text-xs py-1 text-right">{formatCurrency(alloc.salaryShare)}</TableCell>
                            <TableCell className="text-xs py-1 text-right text-orange-600">{formatCurrency(alloc.scShare)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            })()}
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
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .voucher-print-area, .voucher-print-area * { visibility: visible; }
          .voucher-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-only.hidden { display: block !important; }
          table { border-collapse: collapse; }
          table th, table td { border: 1px solid #000; padding: 4px 8px; }
          .voucher-print-area + .voucher-print-area { page-break-before: always; }
          @page { margin: 15mm; }
        }
      `}</style>
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

      {/* Payroll Calculator Section — Attendance-Driven with Project Detail */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Attendance-Driven Payroll Calculator
              </CardTitle>
              <CardDescription className="text-[10px]">
                Calculates salary, deductions &amp; project cost distribution based on actual attendance data
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input type="month" className="h-8 text-xs w-40" value={calculatorPeriod} onChange={e => setCalculatorPeriod(e.target.value)} />
              <Button size="sm" className="h-8 text-xs" onClick={handleRecalculate} disabled={calculating}>
                {calculating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                Recalculate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {calculatorData.length === 0 && !calculating && (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Select a period and click <strong>Recalculate</strong> to compute payroll for all active employees</p>
            </div>
          )}

          {calculating && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Calculating payroll via attendance engine…</span>
            </div>
          )}

          {calculatorData.length > 0 && !calculating && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                  <p className="text-[10px] text-muted-foreground">Total Gross</p>
                  <p className="text-sm font-bold">{formatCurrency(calculatorData.reduce((s: number, r: any) => s + (r.grossSalary || 0), 0))}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-center">
                  <p className="text-[10px] text-red-700">Total Deductions</p>
                  <p className="text-sm font-bold text-red-700">{formatCurrency(calculatorData.reduce((s: number, r: any) => s + (r.deductions?.totalDeductions || 0), 0))}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-green-50 border border-green-100 text-center">
                  <p className="text-[10px] text-green-700">Total Net Pay</p>
                  <p className="text-sm font-bold text-green-700">{formatCurrency(calculatorData.reduce((s: number, r: any) => s + (r.netPay || 0), 0))}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-100 text-center">
                  <p className="text-[10px] text-orange-700">Total SC</p>
                  <p className="text-sm font-bold text-orange-700">{formatCurrency(calculatorData.reduce((s: number, r: any) => s + (r.finalSC || 0), 0))}</p>
                </div>
              </div>

              {/* Employee breakdown table */}
              <div className="rounded border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Employee</TableHead>
                      <TableHead className="text-[10px] text-center">Eligible</TableHead>
                      <TableHead className="text-[10px] text-center">Leave</TableHead>
                      <TableHead className="text-[10px] text-center">Absent</TableHead>
                      <TableHead className="text-[10px] text-right">Gross</TableHead>
                      <TableHead className="text-[10px] text-right">Deductions</TableHead>
                      <TableHead className="text-[10px] text-right">Net Pay</TableHead>
                      <TableHead className="text-[10px] text-right">SC</TableHead>
                      <TableHead className="text-[10px] text-center">Projects</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculatorData.map((row: any) => {
                      const projCount = row.projectAllocations?.length || 0
                      return (
                        <TableRow key={row.employee?.id || row.employeeId}>
                          <TableCell className="text-xs py-1.5">
                            <div><span className="font-medium">{row.employee?.name || row.employeeName}</span></div>
                            <div className="text-[9px] text-muted-foreground">{row.employee?.employeeCode || row.employeeCode}</div>
                          </TableCell>
                          <TableCell className="text-xs py-1.5 text-center text-green-600 font-medium">{row.eligibleDays}</TableCell>
                          <TableCell className="text-xs py-1.5 text-center text-amber-600 font-medium">{row.leaveDays}</TableCell>
                          <TableCell className="text-xs py-1.5 text-center text-red-600 font-medium">{row.absentDays}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right">{formatCurrency(row.grossSalary || 0)}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right text-red-600">{formatCurrency(row.deductions?.totalDeductions || 0)}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-semibold text-green-600">{formatCurrency(row.netPay || 0)}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right text-orange-600">{formatCurrency(row.finalSC || 0)}</TableCell>
                          <TableCell className="text-xs py-1.5 text-center">
                            {projCount > 0 ? (
                              <Badge variant="outline" className="text-[9px] h-5 px-1.5">{projCount} project{projCount > 1 ? 's' : ''}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-[9px]">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {/* Totals row */}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell className="text-xs py-1.5">Total ({calculatorData.length} employees)</TableCell>
                      <TableCell className="text-xs py-1.5 text-center">{calculatorData.reduce((s: number, r: any) => s + (r.eligibleDays || 0), 0)}</TableCell>
                      <TableCell className="text-xs py-1.5 text-center">{calculatorData.reduce((s: number, r: any) => s + (r.leaveDays || 0), 0)}</TableCell>
                      <TableCell className="text-xs py-1.5 text-center">{calculatorData.reduce((s: number, r: any) => s + (r.absentDays || 0), 0)}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right">{formatCurrency(calculatorData.reduce((s: number, r: any) => s + (r.grossSalary || 0), 0))}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right text-red-600">{formatCurrency(calculatorData.reduce((s: number, r: any) => s + (r.deductions?.totalDeductions || 0), 0))}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right text-green-600">{formatCurrency(calculatorData.reduce((s: number, r: any) => s + (r.netPay || 0), 0))}</TableCell>
                      <TableCell className="text-xs py-1.5 text-right text-orange-600">{formatCurrency(calculatorData.reduce((s: number, r: any) => s + (r.finalSC || 0), 0))}</TableCell>
                      <TableCell className="text-xs py-1.5 text-center">&mdash;</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Project-level detail per employee (collapsible) */}
              {calculatorData.some((r: any) => r.projectAllocations?.length > 0) && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Project-Level Salary Distribution
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {calculatorData.filter((r: any) => r.projectAllocations?.length > 0).map((row: any) => (
                      <div key={row.employee?.id} className="rounded border bg-muted/20 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">{row.employee?.name} <span className="text-muted-foreground">({row.employee?.employeeCode})</span></span>
                          <span className="text-[10px] text-muted-foreground">Monthly: {formatCurrency(row.monthlySalary || 0)}</span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[9px] h-7">Project</TableHead>
                              <TableHead className="text-[9px] h-7 text-center">Days</TableHead>
                              <TableHead className="text-[9px] h-7 text-right">Weight</TableHead>
                              <TableHead className="text-[9px] h-7 text-right">Salary Share</TableHead>
                              <TableHead className="text-[9px] h-7 text-right">SC Share</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {row.projectAllocations.map((pa: any) => (
                              <TableRow key={pa.projectId}>
                                <TableCell className="text-[10px] py-1 font-medium">{pa.projectCode} — {pa.projectName}</TableCell>
                                <TableCell className="text-[10px] py-1 text-center">{pa.days}</TableCell>
                                <TableCell className="text-[10px] py-1 text-right">{pa.weightPct}</TableCell>
                                <TableCell className="text-[10px] py-1 text-right">{formatCurrency(pa.salaryShare)}</TableCell>
                                <TableCell className="text-[10px] py-1 text-right text-orange-600">{formatCurrency(pa.scShare)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="outline"
                  className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2"
                  onClick={handleCreateDraftVoucher}
                  disabled={!!draftVoucher}
                >
                  Create Draft Voucher
                </Button>
                <Button
                  variant="outline"
                  className="rounded-lg px-4 py-2"
                  onClick={() => { setProjectCostPeriod(calculatorPeriod); fetchProjectCost(calculatorPeriod) }}
                >
                  <Building2 className="h-3.5 w-3.5 mr-1" />
                  View Project Cost Ledger
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Draft Voucher Preview (Fix 5) */}
      {draftVoucher && (
        <Card className={`border-l-4 ${voucherPosted ? 'border-l-emerald-500 bg-emerald-50' : 'border-l-amber-400 bg-amber-50'} rounded-lg`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge className={`${voucherPosted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} text-[11px] font-medium rounded px-2 py-0.5`}>
                {voucherPosted ? 'POSTED' : 'DRAFT'}
              </Badge>
              <span className="text-sm font-semibold">{draftVoucher.voucherNo}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{draftVoucher.type}</span></div>
              <div><span className="text-muted-foreground">Period:</span> <span className="font-medium">{draftVoucher.period}</span></div>
              <div><span className="text-muted-foreground">Total Amount:</span> <span className="font-semibold">{formatCurrency(draftVoucher.totalAmount)}</span></div>
              <div><span className="text-muted-foreground">No. of Entries:</span> <span className="font-medium">{draftVoucher.lines.length}</span></div>
              <div><span className="text-muted-foreground">Created By:</span> <span className="font-medium">{draftVoucher.createdBy}</span></div>
              <div><span className="text-muted-foreground">Created At:</span> <span className="font-medium">{new Date(draftVoucher.createdAt).toLocaleString()}</span></div>
              {voucherPosted && draftVoucher.postedAt && (
                <div><span className="text-muted-foreground">Posted At:</span> <span className="font-medium text-emerald-700">{new Date(draftVoucher.postedAt).toLocaleString()}</span></div>
              )}
            </div>

            {/* Collapsible Journal Entries */}
            <div className="mt-3">
              <Button variant="ghost" size="sm" className="h-7 text-[10px] p-0" onClick={() => setShowJournalEntries(!showJournalEntries)}>
                {showJournalEntries ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                View Journal Entries
              </Button>
              {showJournalEntries && (
                <div className="mt-2 rounded border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Account</TableHead>
                        <TableHead className="text-[10px] text-right">Dr</TableHead>
                        <TableHead className="text-[10px] text-right">Cr</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftVoucher.lines.map((line: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs py-1">{line.account}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{line.debit > 0 ? formatCurrency(line.debit) : ''}</TableCell>
                          <TableCell className="text-xs py-1 text-right">{line.credit > 0 ? formatCurrency(line.credit) : ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {!voucherPosted && (
              <div className="flex items-center gap-2 mt-3">
                <Button className="bg-slate-900 text-white rounded-lg px-4 py-2" onClick={() => setPostConfirmOpen(true)}>
                  Post to Ledger
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Project Cost Distribution Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Project Cost Distribution
              </CardTitle>
              <CardDescription className="text-[10px]">
                Salary &amp; social charges grouped by project from the Project Cost Ledger
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="month"
                className="h-8 text-xs w-40"
                value={projectCostPeriod}
                onChange={e => setProjectCostPeriod(e.target.value)}
              />
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => fetchProjectCost()}
                disabled={loadingProjectCost}
              >
                {loadingProjectCost ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Receipt className="h-3.5 w-3.5 mr-1" />}
                Load
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {!projectCostData && !loadingProjectCost && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Select a month and click <strong>Load</strong> to view project cost distribution from the ledger</p>
            </div>
          )}

          {loadingProjectCost && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Loading project cost data…</span>
            </div>
          )}

          {projectCostData && !loadingProjectCost && (
            <>
              {/* Grand Total KPIs */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                  <p className="text-[10px] text-muted-foreground">Total Salary</p>
                  <p className="text-sm font-bold">{formatCurrency(projectCostData.grandTotal?.salary || 0)}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-100 text-center">
                  <p className="text-[10px] text-orange-700">Total SC</p>
                  <p className="text-sm font-bold text-orange-700">{formatCurrency(projectCostData.grandTotal?.sc || 0)}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                  <p className="text-[10px] text-muted-foreground">Total Days</p>
                  <p className="text-sm font-bold">{projectCostData.grandTotal?.days || 0}</p>
                </div>
              </div>

              {/* Projects Table */}
              {projectCostData.byProject?.length > 0 ? (
                <div className="space-y-3">
                  {projectCostData.byProject.map((proj: any) => (
                    <div key={proj.projectId} className="rounded border">
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedProject(expandedProject === proj.projectId ? null : proj.projectId)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedProject === proj.projectId ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className="text-xs font-semibold">{proj.projectCode} — {proj.projectName}</span>
                          <Badge variant="outline" className="text-[9px] h-5 px-1.5">{proj.employees?.length || 0} emp</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">Days: <strong>{proj.totalDays}</strong></span>
                          <span>Salary: <strong>{formatCurrency(proj.totalSalary)}</strong></span>
                          <span className="text-orange-600">SC: <strong>{formatCurrency(proj.totalSC)}</strong></span>
                        </div>
                      </div>

                      {expandedProject === proj.projectId && (
                        <div className="border-t">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[9px] h-7">Employee</TableHead>
                                <TableHead className="text-[9px] h-7">Designation</TableHead>
                                <TableHead className="text-[9px] h-7 text-center">Days</TableHead>
                                <TableHead className="text-[9px] h-7 text-right">Salary Share</TableHead>
                                <TableHead className="text-[9px] h-7 text-right">SC Share</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {proj.employees.map((emp: any) => (
                                <TableRow key={emp.employeeId}>
                                  <TableCell className="text-[10px] py-1">
                                    <span className="font-medium">{emp.employeeName}</span>
                                    <span className="text-muted-foreground ml-1">({emp.employeeCode})</span>
                                  </TableCell>
                                  <TableCell className="text-[10px] py-1 text-muted-foreground">{emp.designation || '—'}</TableCell>
                                  <TableCell className="text-[10px] py-1 text-center">{emp.days}</TableCell>
                                  <TableCell className="text-[10px] py-1 text-right">{formatCurrency(emp.salaryShare)}</TableCell>
                                  <TableCell className="text-[10px] py-1 text-right text-orange-600">{formatCurrency(emp.scShare)}</TableCell>
                                </TableRow>
                              ))}
                              {/* Project subtotal */}
                              <TableRow className="bg-muted/20 font-semibold">
                                <TableCell className="text-[10px] py-1" colSpan={2}>Project Total</TableCell>
                                <TableCell className="text-[10px] py-1 text-center">{proj.totalDays}</TableCell>
                                <TableCell className="text-[10px] py-1 text-right">{formatCurrency(proj.totalSalary)}</TableCell>
                                <TableCell className="text-[10px] py-1 text-right text-orange-600">{formatCurrency(proj.totalSC)}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No project cost data found for this period. Run the payroll calculator first to populate the ledger.</p>
                </div>
              )}

              {/* By-Employee Summary */}
              {projectCostData.byEmployee?.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Employee Cost Summary
                  </h4>
                  <div className="rounded border overflow-hidden max-h-72 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[9px]">Employee</TableHead>
                          <TableHead className="text-[9px] text-center">Projects</TableHead>
                          <TableHead className="text-[9px] text-center">Total Days</TableHead>
                          <TableHead className="text-[9px] text-right">Total Salary</TableHead>
                          <TableHead className="text-[9px] text-right">Total SC</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectCostData.byEmployee.map((emp: any) => (
                          <TableRow key={emp.employee.id}>
                            <TableCell className="text-[10px] py-1">
                              <span className="font-medium">{emp.employee.name}</span>
                              <span className="text-muted-foreground ml-1">({emp.employee.employeeCode})</span>
                            </TableCell>
                            <TableCell className="text-[10px] py-1 text-center">
                              <Badge variant="outline" className="text-[9px] h-5 px-1.5">{emp.projects?.length || 0}</Badge>
                            </TableCell>
                            <TableCell className="text-[10px] py-1 text-center">{emp.totalDays}</TableCell>
                            <TableCell className="text-[10px] py-1 text-right">{formatCurrency(emp.totalSalary)}</TableCell>
                            <TableCell className="text-[10px] py-1 text-right text-orange-600">{formatCurrency(emp.totalSC)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
          <Fragment key={batch.id}>
          <Card className="group overflow-hidden">
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
              {renderWorkflowBar(batch.status, batch.id)}

              {/* Step-Aware Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* STEP 1: Draft — Select Employees, Run Payroll, Review */}
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px]"
                      onClick={async () => {
                        setRunningPayroll(batch.id)
                        try {
                          const res = await fetch('/api/payroll', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'recalculate', batchId: batch.id }),
                          })
                          const result = await res.json()
                          if (!res.ok) throw new Error(result.error || 'Failed')
                          toast({ title: 'Recalculated', description: result.message || 'Payroll recalculated with updated YTD data' })
                          fetchData()
                        } catch (e: any) {
                          toast({ title: 'Error', description: e.message, variant: 'destructive' })
                        } finally {
                          setRunningPayroll(null)
                        }
                      }}
                      disabled={isRunning}
                    >
                      <Receipt className="h-3 w-3 mr-1" />Recalculate
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] border-sky-300 text-sky-700 hover:bg-sky-50" onClick={() => handleReviewAllLines(batch.id)} disabled={processingAction === 'review-all-lines'}>
                      {processingAction === 'review-all-lines' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
                      Review All
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => openAddLineDialog(batch)}>
                      <Plus className="h-3 w-3 mr-1" />Add Line
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-600 hover:text-red-700" onClick={() => { setSelectedBatch(batch); setDeleteBatchDialogOpen(true) }}>
                      <Trash2 className="h-3 w-3 mr-1" />Delete
                    </Button>
                  </>
                )}
                {/* STEP 2: Reviewed — Approve or Send Back */}
                {batch.status === 'reviewed' && (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => handleApproveAllLines(batch.id)} disabled={processingAction === 'approve-all-lines'}>
                      {processingAction === 'approve-all-lines' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Shield className="h-3 w-3 mr-1" />}
                      Approve All
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => setProjectPayView(projectPayView === batch.id ? null : batch.id)}>
                      <FolderOpen className="h-3 w-3 mr-1" />Pay by Project
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => handleWorkflowAction('send-back', batch.id)}>
                      <ArrowRight className="h-3 w-3 mr-1 rotate-180" />Send Back to Draft
                    </Button>
                  </>
                )}
                {/* STEP 3: Approved — Draft to Voucher (Project-wise) */}
                {batch.status === 'approved' && (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] border-violet-300 text-violet-700 hover:bg-violet-50" onClick={() => { setSelectedBatch(batch); setDraftToGLDialogOpen(true) }}>
                      <FileText className="h-3 w-3 mr-1" />Draft to Voucher (Project-wise)
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => setProjectPayView(projectPayView === batch.id ? null : batch.id)}>
                      <FolderOpen className="h-3 w-3 mr-1" />Pay by Project
                    </Button>
                  </>
                )}
                {/* STEP 4: Draft-to-GL — Post to GL */}
                {batch.status === 'draft-to-gl' && (
                  <>
                    <Button size="sm" className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handlePostAllVouchersToGL}
                      disabled={generatedVouchers.length > 0 && generatedVouchers.every(v => v.status !== 'draft')}>
                      <BookOpen className="h-3 w-3 mr-1" />Post All to GL
                    </Button>
                    <Badge className="text-[10px] bg-violet-100 text-violet-800 border border-violet-200">
                      <FileText className="h-3 w-3 mr-1" />{generatedVouchers.length > 0 ? `${generatedVouchers.filter(v => v.status === 'draft').length} Draft / ${generatedVouchers.filter(v => v.status === 'posted').length} Posted` : 'Draft Voucher(s) Created'}
                    </Badge>
                  </>
                )}
                {/* STEP 5: Posted — Complete */}
                {batch.status === 'posted' && (
                  <Badge className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200">
                    <CheckCircle className="h-3 w-3 mr-1" />Posted to GL — Complete
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

                {/* Project-wise Payment View */}
                {projectPayView === batch.id && (() => {
                  const projectGroups = computeProjectPayGroups(batch)
                  const summaryTotals = projectGroups.reduce(
                    (acc, g) => ({
                      totalGross: acc.totalGross + g.totalGross,
                      totalDeductions: acc.totalDeductions + g.totalDeductions,
                      totalNetPay: acc.totalNetPay + g.totalNetPay,
                      totalSocialCharges: acc.totalSocialCharges + g.totalSocialCharges,
                      employeeCount: acc.employeeCount + g.employeeCount,
                      projectsCount: acc.projectsCount + 1,
                    }),
                    { totalGross: 0, totalDeductions: 0, totalNetPay: 0, totalSocialCharges: 0, employeeCount: 0, projectsCount: 0 }
                  )

                  // Helper to determine project workflow step
                  const getProjectStep = (group: ProjectPayGroup) => {
                    if (batch.status === 'posted') return 5
                    if (batch.status === 'draft-to-gl') return 4
                    if (batch.status === 'approved') return 3
                    if (group.allLinesApproved) return 3
                    if (group.anyLinesApproved) return 2
                    return 1
                  }
                  const stepLabels = ['Select', 'Review', 'Approve', 'Voucher', 'Posted']
                  const stepIcons = [Users, Eye, Shield, FileText, CheckCircle]

                  return (
                    <div className="space-y-4 mb-4">
                      {/* Header with close button */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-emerald-600" />
                          <h3 className="text-sm font-semibold">Project-wise Payment Breakdown</h3>
                          <Badge variant="outline" className="text-[9px]">{projectGroups.length} project(s)</Badge>
                          <Badge className={`text-[9px] border ${statusStyles[batch.status] || ''}`}>
                            Batch: {statusLabels[batch.status] || batch.status}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setProjectPayView(null)}>
                          <ChevronUp className="h-3 w-3 mr-1" />Close
                        </Button>
                      </div>

                      {/* Summary Card */}
                      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-slate-50/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-emerald-600" />
                            <CardTitle className="text-xs font-bold text-emerald-900">Summary — All Projects</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="text-center p-2 rounded bg-background border">
                              <p className="text-[9px] text-muted-foreground">Projects</p>
                              <p className="text-sm font-bold">{summaryTotals.projectsCount}</p>
                            </div>
                            <div className="text-center p-2 rounded bg-background border">
                              <p className="text-[9px] text-muted-foreground">Employees</p>
                              <p className="text-sm font-bold">{summaryTotals.employeeCount}</p>
                            </div>
                            <div className="text-center p-2 rounded bg-background border">
                              <p className="text-[9px] text-muted-foreground">Total Gross</p>
                              <p className="text-sm font-bold text-green-700">{formatCurrency(summaryTotals.totalGross)}</p>
                            </div>
                            <div className="text-center p-2 rounded bg-background border">
                              <p className="text-[9px] text-muted-foreground">Total Deductions</p>
                              <p className="text-sm font-bold text-red-700">{formatCurrency(summaryTotals.totalDeductions)}</p>
                            </div>
                            <div className="text-center p-2 rounded bg-background border">
                              <p className="text-[9px] text-muted-foreground">Total Net Pay</p>
                              <p className="text-sm font-bold text-green-700">{formatCurrency(summaryTotals.totalNetPay)}</p>
                            </div>
                            <div className="text-center p-2 rounded bg-background border">
                              <p className="text-[9px] text-muted-foreground">Total Social Charges</p>
                              <p className="text-sm font-bold text-orange-700">{formatCurrency(summaryTotals.totalSocialCharges)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Project Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {projectGroups.map((group) => {
                          const isPaying = payingProjectId === (group.projectId || '__unassigned__')
                          const projStep = getProjectStep(group)
                          // Get employees within this project group
                          const groupEmployees = (batch.lines || []).filter((l: any) =>
                            (l.projectId || '__no_project__') === (group.projectId || '__unassigned__')
                          )
                          return (
                            <Card key={group.projectId || '__unassigned__'} className={`border-l-4 ${group.allLinesPaid ? 'border-l-emerald-500' : 'border-l-amber-400'} overflow-hidden`}>
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <Badge className="text-[10px] bg-slate-100 text-slate-800 border border-slate-300 font-mono">
                                        {group.projectCode}
                                      </Badge>
                                      <CardTitle className="text-xs font-bold truncate">{group.projectName}</CardTitle>
                                    </div>
                                    {/* Workflow step indicator */}
                                    <div className="flex items-center gap-0.5 mt-1.5">
                                      {stepLabels.map((label, idx) => {
                                        const StepIcon = stepIcons[idx]
                                        const stepNum = idx + 1
                                        const isActive = stepNum <= projStep
                                        const isCurrent = stepNum === projStep
                                        return (
                                          <div key={label} className="flex items-center">
                                            <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium ${
                                              isCurrent ? 'bg-primary text-primary-foreground' :
                                              isActive ? 'bg-emerald-100 text-emerald-800' :
                                              'bg-muted text-muted-foreground'
                                            }`}>
                                              <StepIcon className="h-2 w-2" />
                                              <span className="hidden sm:inline">{label}</span>
                                            </div>
                                            {idx < 4 && <ArrowRight className="h-2 w-2 text-muted-foreground mx-0.5" />}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  <Badge className={`text-[9px] border ${group.allLinesPaid ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : group.anyLinesApproved ? 'bg-sky-100 text-sky-800 border-sky-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                                    {group.allLinesPaid ? 'Approved' : group.anyLinesApproved ? 'Partial' : 'Draft'}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="p-3 pt-0">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <div className="text-center p-1.5 rounded bg-muted/50">
                                    <p className="text-[8px] text-muted-foreground">Employees</p>
                                    <p className="text-xs font-bold">{group.employeeCount}</p>
                                  </div>
                                  <div className="text-center p-1.5 rounded bg-muted/50">
                                    <p className="text-[8px] text-muted-foreground">Gross</p>
                                    <p className="text-[10px] font-bold text-green-700">{formatCurrency(group.totalGross)}</p>
                                  </div>
                                  <div className="text-center p-1.5 rounded bg-muted/50">
                                    <p className="text-[8px] text-muted-foreground">Deductions</p>
                                    <p className="text-[10px] font-bold text-red-700">{formatCurrency(group.totalDeductions)}</p>
                                  </div>
                                  <div className="text-center p-1.5 rounded bg-muted/50">
                                    <p className="text-[8px] text-muted-foreground">Net Pay</p>
                                    <p className="text-[10px] font-bold text-green-700">{formatCurrency(group.totalNetPay)}</p>
                                  </div>
                                  <div className="text-center p-1.5 rounded bg-muted/50 col-span-2">
                                    <p className="text-[8px] text-muted-foreground">Social Charges</p>
                                    <p className="text-[10px] font-bold text-orange-700">{formatCurrency(group.totalSocialCharges)}</p>
                                  </div>
                                </div>
                                {/* Employee list within this project */}
                                <div className="mb-2 max-h-32 overflow-y-auto rounded border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-[8px] h-6">Employee</TableHead>
                                        <TableHead className="text-[8px] h-6 text-center">Status</TableHead>
                                        <TableHead className="text-[8px] h-6 text-right">Net Pay</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {groupEmployees.map((emp: any) => (
                                        <TableRow key={emp.id}>
                                          <TableCell className="text-[9px] py-0.5 font-medium">{emp.employeeName}</TableCell>
                                          <TableCell className="text-[9px] py-0.5 text-center">
                                            <Badge className={`text-[7px] px-1 border ${lineStatusStyles[emp.lineStatus || 'draft']}`}>
                                              {emp.lineStatus === 'reviewed' ? 'Rev' : emp.lineStatus === 'approved' ? 'App' : 'Dft'}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-[9px] py-0.5 text-right font-mono">{formatNumber(emp.netPay)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                                <Button
                                  size="sm"
                                  className={`w-full h-7 text-[10px] ${group.allLinesPaid ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                  disabled={isPaying || group.allLinesPaid}
                                  onClick={() => handlePayProject(group, batch.id)}
                                >
                                  {isPaying ? (
                                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing...</>
                                  ) : group.allLinesPaid ? (
                                    <><CheckCircle className="h-3 w-3 mr-1" />Already Processed</>
                                  ) : (
                                    <><Banknote className="h-3 w-3 mr-1" />Pay Project — {formatCurrency(group.totalNetPay)}</>
                                  )}
                                </Button>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>

                      <Separator />
                    </div>
                  )
                })()}

                {/* Employee Lines Table */}
                {batch.lines?.length > 0 ? (
                  <>
                    {/* Step-Aware Workflow Toolbar */}
                    <div className="mb-3 p-3 rounded-lg border bg-gradient-to-r from-slate-50 to-white">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          {batch.status === 'draft' ? 'Step 1 — Select & Review' :
                           batch.status === 'reviewed' ? 'Step 2 — Approve' :
                           batch.status === 'approved' ? 'Step 3 — Create Voucher' :
                           batch.status === 'draft-to-gl' ? 'Step 4 — Post to GL' :
                           'Step 5 — Complete'}
                        </span>
                        <Badge className={`text-[9px] border ${statusStyles[batch.status] || ''}`}>
                          {statusLabels[batch.status] || batch.status}
                        </Badge>
                      </div>
                      {/* Step indicators */}
                      <div className="flex items-center gap-1 mb-3 flex-wrap">
                        {[
                          { step: 1, label: 'Select', icon: Users, color: batch.status === 'draft' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300' },
                          { step: 2, label: 'Review', icon: Eye, color: batch.status === 'reviewed' ? 'bg-sky-100 text-sky-800 border-sky-300' : ['approved','draft-to-gl','posted'].includes(batch.status) ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-muted text-muted-foreground border-muted' },
                          { step: 3, label: 'Approve', icon: Shield, color: batch.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : ['draft-to-gl','posted'].includes(batch.status) ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-muted text-muted-foreground border-muted' },
                          { step: 4, label: 'Draft Voucher', icon: FileText, color: batch.status === 'draft-to-gl' ? 'bg-violet-100 text-violet-800 border-violet-300' : batch.status === 'posted' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-muted text-muted-foreground border-muted' },
                          { step: 5, label: 'Post to GL', icon: BookOpen, color: batch.status === 'posted' ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-muted text-muted-foreground border-muted' },
                        ].map((s, idx) => {
                          const StepIcon = s.icon
                          const isCurrentStep = (batch.status === 'draft' && s.step === 1) ||
                            (batch.status === 'reviewed' && s.step === 2) ||
                            (batch.status === 'approved' && s.step === 3) ||
                            (batch.status === 'draft-to-gl' && s.step === 4) ||
                            (batch.status === 'posted' && s.step === 5)
                          return (
                            <Fragment key={s.step}>
                              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${s.color} transition-all ${isCurrentStep ? 'ring-2 ring-offset-1 ring-primary/30' : ''}`}>
                                <span className="font-bold">{s.step}.</span>
                                <StepIcon className="h-3 w-3" />
                                <span>{s.label}</span>
                              </div>
                              {idx < 4 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                            </Fragment>
                          )
                        })}
                      </div>
                      {/* Selection + Step-Aware Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={batch.lines.length > 0 && batch.lines.every((l: any) => selectedLineIds.has(l.id))}
                            onCheckedChange={() => toggleSelectAllLines(batch)}
                            className="h-4 w-4"
                          />
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {selectedLineIds.size > 0
                              ? `${selectedLineIds.size} of ${batch.lines.length} selected`
                              : 'Select All'}
                          </span>
                        </div>
                        {selectedLineIds.size > 0 && (
                          <>
                            <Separator orientation="vertical" className="h-5" />
                            {/* Draft: Show Review Selected */}
                            {(batch.status === 'draft') && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] border-sky-300 text-sky-700 hover:bg-sky-50"
                                onClick={handleReviewSelectedLines}
                                disabled={processingAction === 'review-line'}
                              >
                                {processingAction === 'review-line' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
                                Review Selected
                              </Button>
                            )}
                            {/* Reviewed: Show Approve Selected + Send Back Selected */}
                            {(batch.status === 'reviewed') && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  onClick={handleApproveSelectedLines}
                                  disabled={processingAction === 'approve-line'}
                                >
                                  {processingAction === 'approve-line' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Shield className="h-3 w-3 mr-1" />}
                                  Approve Selected
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] border-amber-300 text-amber-700 hover:bg-amber-50"
                                  onClick={handleSendBackSelectedLines}
                                  disabled={processingAction === 'send-back-lines'}
                                >
                                  {processingAction === 'send-back-lines' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ArrowRight className="h-3 w-3 mr-1 rotate-180" />}
                                  Send Back Selected
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[10px] text-muted-foreground ml-auto"
                              onClick={() => setSelectedLineIds(new Set())}
                            >
                              Deselect All
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <ScrollArea className="w-full">
                    <div className="min-w-[1500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] w-10">Sel.</TableHead>
                            <TableHead className="text-[10px] w-8"></TableHead>
                            <TableHead className="text-[10px]">Employee</TableHead>
                            <TableHead className="text-[10px]">Status</TableHead>
                            <TableHead className="text-[10px]">Code</TableHead>
                            <TableHead className="text-[10px]">Project</TableHead>
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
                            {['draft','reviewed'].includes(batch.status) && <TableHead className="text-[10px] text-right">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            // Group lines by project for clear separation
                            const lines = batch.lines || []
                            const projectGroups = new Map<string, any[]>()
                            for (const line of lines) {
                              const key = line.projectId || '__no_project__'
                              if (!projectGroups.has(key)) projectGroups.set(key, [])
                              projectGroups.get(key)!.push(line)
                            }
                            // Sort: assigned projects first, unassigned last
                            const sortedGroups = Array.from(projectGroups.entries()).sort(([a], [b]) => {
                              if (a === '__no_project__') return 1
                              if (b === '__no_project__') return -1
                              return a.localeCompare(b)
                            })
                            const allRows: any[] = []
                            for (const [projKey, groupLines] of sortedGroups) {
                              const proj = projKey !== '__no_project__' ? projects.find((p: any) => p.id === projKey) : null
                              const projName = proj ? proj.name : 'Unassigned'
                              const projCode = proj ? proj.code : '—'
                              const groupGross = groupLines.reduce((s: number, l: any) => s + (l.grossSalary || 0), 0)
                              const groupNet = groupLines.reduce((s: number, l: any) => s + (l.netPay || 0), 0)
                              const groupSC = groupLines.reduce((s: number, l: any) => s + (l.socialCharges || 0), 0)
                              const colSpan = ['draft','reviewed'].includes(batch.status) ? 21 : 20
                              // Project header row
                              allRows.push(
                                <TableRow key={`proj-${projKey}`} className="bg-muted/40 hover:bg-muted/40">
                                  <TableCell colSpan={colSpan} className="py-2">
                                    <div className="flex items-center gap-3">
                                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                      <Badge className="text-[10px] bg-slate-100 text-slate-800 border border-slate-300 font-mono">
                                        {projCode}
                                      </Badge>
                                      <span className="text-xs font-bold">{projName}</span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {groupLines.length} emp · Gross: {formatCurrency(groupGross)} · Net: {formatCurrency(groupNet)} · SC: {formatCurrency(groupSC)}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                              // Employee rows within this project
                              for (const line of groupLines) {
                                const isLineExpanded = expandedLine === line.id
                                const lineStatus = line.lineStatus || 'draft'
                                allRows.push(
                                  <Fragment key={line.id}>
                                    <TableRow className={`cursor-pointer hover:bg-muted/50 ${selectedLineIds.has(line.id) ? 'bg-primary/5' : ''}`} onClick={() => setExpandedLine(isLineExpanded ? null : line.id)}>
                                      <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                          checked={selectedLineIds.has(line.id)}
                                          onCheckedChange={() => toggleLineSelection(line.id)}
                                          className="h-4 w-4"
                                        />
                                      </TableCell>
                                      <TableCell className="py-1.5">
                                        {isLineExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                                      </TableCell>
                                      <TableCell className="text-xs py-1.5 font-medium">{line.employeeName}</TableCell>
                                      <TableCell className="py-1.5">
                                        <Badge className={`text-[9px] border px-1.5 py-0 ${lineStatusStyles[lineStatus] || 'bg-muted text-muted-foreground'}`}>
                                          {lineStatus === 'reviewed' ? 'Reviewed' : lineStatus === 'approved' ? 'Approved' : 'Draft'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-xs py-1.5 text-muted-foreground">{line.employeeCode || '-'}</TableCell>
                                      <TableCell className="py-1.5">
                                        <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-mono">
                                          {projCode}
                                        </Badge>
                                      </TableCell>
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
                                      {['draft','reviewed'].includes(batch.status) && (
                                        <TableCell className="py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditLineDialog(batch, line)}>
                                              <Pencil className="h-3 w-3 text-blue-600" />
                                            </Button>
                                            {batch.status === 'draft' && (
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedLine(line); setDeleteLineDialogOpen(true) }}>
                                                <Trash2 className="h-3 w-3 text-red-600" />
                                              </Button>
                                            )}
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                {/* Expanded Line Detail */}
                                {isLineExpanded && (
                                  <TableRow>
                                    <TableCell colSpan={['draft','reviewed'].includes(batch.status) ? 21 : 20} className="p-0">
                                      <div className="p-4 bg-muted/20 space-y-3">
                                        {/* Quick Detail Row */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                          {[
                                            { label: 'Calendar Days', value: line.calendarDays || line.workingDays || '—' },
                                            { label: 'Payable Days', value: line.payableDays || line.eligibleDays || '—' },
                                            { label: 'Leave Days', value: line.leaveDays },
                                            { label: 'Absent Days', value: line.absentDays },
                                            { label: 'Daily Rate', value: formatCurrency(line.dailyRate) },
                                            { label: 'Advance Ded.', value: formatCurrency(line.advanceDeduction) },
                                            { label: 'Other Ded.', value: formatCurrency(line.otherDeductions) },
                                            { label: 'Total Ded.', value: formatCurrency(line.totalDeductions) },
                                            { label: 'EOBI (Employer)', value: formatCurrency(line.eobiEmployer) },
                                            { label: 'ESSI (Employee)', value: formatCurrency(line.essiEmployee) },
                                            { label: 'ESSI (Employer)', value: formatCurrency(line.essiEmployer) },
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

                                        {/* YTD Tax Info */}
                                        {line.taxBreakdown && (() => {
                                          let tx: any = null
                                          try { tx = JSON.parse(line.taxBreakdown) } catch {}
                                          if (!tx) return null
                                          const hasYtd = tx.ytdIncome != null || tx.projectedAnnualIncome != null || tx.taxPaidYtd != null
                                          if (!hasYtd) return null
                                          return (
                                            <div className="p-2 rounded border bg-background">
                                              <p className="text-[10px] font-semibold mb-1">YTD Tax Information</p>
                                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                                                {tx.ytdIncome != null && <div>YTD Income: {formatCurrency(tx.ytdIncome)}</div>}
                                                {tx.projectedAnnualIncome != null && <div>Projected Annual: {formatCurrency(tx.projectedAnnualIncome)}</div>}
                                                {tx.taxPaidYtd != null && <div>Tax Paid YTD: {formatCurrency(tx.taxPaidYtd)}</div>}
                                                {tx.monthsWorkedYtd != null && <div>Months Worked YTD: {tx.monthsWorkedYtd}</div>}
                                              </div>
                                            </div>
                                          )
                                        })()}

                                        {/* SC Breakdown */}
                                        {line.scBreakdown && (() => {
                                          let sc: any = null
                                          try { sc = JSON.parse(line.scBreakdown) } catch {}
                                          if (!sc) return null
                                          return (
                                            <div className="p-2 rounded border bg-background">
                                              <p className="text-[10px] font-semibold mb-1">Social Charges Calculation</p>
                                              <div className="grid grid-cols-3 gap-2 text-[10px]">
                                                <div>SC Eligible Days: {sc.scEligDays ?? '-'}</div>
                                                <div>Leave (no SC): {sc.leaveDaysPaid ?? 0}</div>
                                                <div>Ratio: {Math.round((sc.attendanceRatio ?? sc.workingRatio) * 100)}%</div>
                                                <div>SC Base: {formatCurrency(sc.scBase ?? sc.earnedSC)}</div>
                                                <div>Monthly SC: {formatCurrency(sc.monthlySC)}</div>
                                                <div className="font-bold">Final SC: {formatCurrency(sc.finalSC)}</div>
                                              </div>
                                              <div className="text-[10px] text-amber-600 mt-1">⚠ Added to SC ledger — not deducted from net pay</div>
                                              {sc.projectScDetails && sc.projectScDetails.length > 0 && (
                                                <div className="mt-1 space-y-0.5">
                                                  <p className="text-[9px] font-semibold">Per-Project:</p>
                                                  {sc.projectScDetails.map((psc: any, i: number) => (
                                                    <div key={i} className="text-[9px] text-muted-foreground">
                                                      {psc.projectName}: {formatCurrency(psc.projectSC)} ({Math.round(psc.projectRatio * 100)}%)
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
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

                                        {/* Project Allocation Breakdown */}
                                        {line.projectAllocations && (() => {
                                          let pa: any[] = []
                                          try { pa = JSON.parse(line.projectAllocations) } catch {}
                                          if (!pa.length) return null
                                          return (
                                            <div className="p-2 rounded border bg-background">
                                              <p className="text-[10px] font-semibold mb-1">Project Allocation Breakdown</p>
                                              <div className="rounded border overflow-hidden mt-1">
                                                <Table>
                                                  <TableHeader>
                                                    <TableRow>
                                                      <TableHead className="text-[9px] h-7">Project</TableHead>
                                                      <TableHead className="text-[9px] h-7 text-center">Days</TableHead>
                                                      <TableHead className="text-[9px] h-7 text-right">Weight</TableHead>
                                                      <TableHead className="text-[9px] h-7 text-right">Salary Share</TableHead>
                                                      <TableHead className="text-[9px] h-7 text-right">SC Share</TableHead>
                                                    </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                    {pa.map((alloc: any, idx: number) => (
                                                      <TableRow key={idx}>
                                                        <TableCell className="text-[10px] py-1 font-medium">{alloc.projectCode} — {alloc.projectName}</TableCell>
                                                        <TableCell className="text-[10px] py-1 text-center">{alloc.days}</TableCell>
                                                        <TableCell className="text-[10px] py-1 text-right">{alloc.weightPct || Math.round((alloc.weight || 0) * 100) + '%'}</TableCell>
                                                        <TableCell className="text-[10px] py-1 text-right">{formatCurrency(alloc.salaryShare)}</TableCell>
                                                        <TableCell className="text-[10px] py-1 text-right text-orange-600">{formatCurrency(alloc.scShare)}</TableCell>
                                                      </TableRow>
                                                    ))}
                                                  </TableBody>
                                                </Table>
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
                              }
                            }
                            return allRows
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                  </>
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

          {/* Voucher Cards for Draft-to-GL and Posted batches */}
          {(batch.status === 'draft-to-gl' || batch.status === 'posted') && generatedVouchers.length > 0 && generatedVouchers.some(v => {
            // Show vouchers that belong to this batch (all project-wise vouchers for the selected batch)
            return selectedBatch?.id === batch.id || generatedVouchers.length > 0
          }) && (
            <Card className="border-violet-200 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-600" />
                    <CardTitle className="text-sm font-bold text-violet-900">
                      Project-wise Vouchers — {batch.name || batch.batchNumber}
                    </CardTitle>
                    <Badge className="text-[9px] border bg-violet-100 text-violet-800 border-violet-200">
                      {generatedVouchers.filter(v => v.status === 'draft').length} Draft / {generatedVouchers.filter(v => v.status === 'posted').length} Posted
                    </Badge>
                  </div>
                  {generatedVouchers.some(v => v.status === 'draft') && (
                    <Button size="sm" className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handlePostAllVouchersToGL}>
                      <BookOpen className="h-3 w-3 mr-1" />Post All to GL
                    </Button>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Period: {batch.period} · Each voucher is tagged to its project · Format: JV-PAY-YYYYMM-PROJCODE
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {/* Voucher summary table */}
                <div className="rounded border overflow-hidden mb-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-violet-50">
                        <TableHead className="text-[10px] h-8">Voucher No</TableHead>
                        <TableHead className="text-[10px] h-8">Project</TableHead>
                        <TableHead className="text-[10px] h-8 text-center">Employees</TableHead>
                        <TableHead className="text-[10px] h-8 text-right">Total DR</TableHead>
                        <TableHead className="text-[10px] h-8 text-right">Total CR</TableHead>
                        <TableHead className="text-[10px] h-8 text-center">Balance</TableHead>
                        <TableHead className="text-[10px] h-8 text-center">Status</TableHead>
                        <TableHead className="text-[10px] h-8 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {generatedVouchers.map(v => {
                        const isBalanced = Math.abs(v.totalDebit - v.totalCredit) < 1
                        return (
                          <TableRow key={v.voucherId}>
                            <TableCell className="text-[10px] py-1.5 font-mono font-bold">{v.voucherNumber}</TableCell>
                            <TableCell className="text-[10px] py-1.5">
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-mono">{v.projectCode || v.project || '—'}</Badge>
                                <span className="font-medium">{v.project || 'All Projects'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] py-1.5 text-center">{v.employeeLines?.length || v.employeeCount || '—'}</TableCell>
                            <TableCell className="text-[10px] py-1.5 text-right font-mono">{formatCurrency(v.totalDebit)}</TableCell>
                            <TableCell className="text-[10px] py-1.5 text-right font-mono">{formatCurrency(v.totalCredit)}</TableCell>
                            <TableCell className="text-[10px] py-1.5 text-center">
                              {isBalanced ? (
                                <Badge className="text-[8px] bg-emerald-100 text-emerald-700 border-emerald-200 border">✓ Balanced</Badge>
                              ) : (
                                <Badge className="text-[8px] bg-red-100 text-red-700 border-red-200 border">✗ {formatCurrency(Math.abs(v.totalDebit - v.totalCredit))}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-[10px] py-1.5 text-center">
                              <Badge className={`text-[9px] border ${v.status === 'draft' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                {v.status === 'draft' ? 'Draft' : 'Posted'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[10px] py-1.5 text-right">
                              {v.status === 'draft' && isBalanced && (
                                <Button size="sm" className="h-6 text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handlePostVoucherToGL(v.voucherId)}>
                                  <BookOpen className="h-2.5 w-2.5 mr-0.5" />Post
                                </Button>
                              )}
                              {v.status === 'posted' && (
                                <Badge className="text-[8px] bg-emerald-100 text-emerald-700 border-emerald-200 border">
                                  <CheckCircle className="h-2.5 w-2.5 mr-0.5" />In GL
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {/* Totals row */}
                      <TableRow className="font-bold border-t-2 bg-violet-50/50">
                        <TableCell className="text-[10px] py-2">TOTAL</TableCell>
                        <TableCell className="text-[10px] py-2">{generatedVouchers.length} voucher(s)</TableCell>
                        <TableCell className="text-[10px] py-2 text-center">{generatedVouchers.reduce((s,v) => s + (v.employeeLines?.length || v.employeeCount || 0), 0)}</TableCell>
                        <TableCell className="text-[10px] py-2 text-right font-mono">{formatCurrency(generatedVouchers.reduce((s,v) => s + v.totalDebit, 0))}</TableCell>
                        <TableCell className="text-[10px] py-2 text-right font-mono">{formatCurrency(generatedVouchers.reduce((s,v) => s + v.totalCredit, 0))}</TableCell>
                        <TableCell className="text-[10px] py-2 text-center">
                          <Badge className={`text-[8px] border ${generatedVouchers.every(v => Math.abs(v.totalDebit - v.totalCredit) < 1) ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                            {generatedVouchers.every(v => Math.abs(v.totalDebit - v.totalCredit) < 1) ? '✓ All Balanced' : '✗ Unbalanced'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] py-2 text-center">
                          <Badge className="text-[8px] border bg-emerald-100 text-emerald-700 border-emerald-200">
                            {generatedVouchers.filter(v => v.status === 'posted').length}/{generatedVouchers.length} Posted
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] py-2"></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Expandable individual voucher details */}
                <div className="space-y-2">
                  {generatedVouchers.map(voucher => {
                    const isBalanced = Math.abs(voucher.totalDebit - voucher.totalCredit) < 1
                    const isPosted = voucher.status === 'posted'
                    const isProject = voucher.voucherType === 'Project'
                    const isExpanded = expandedVoucherEmp === voucher.voucherId

                    return (
                      <Card key={voucher.voucherId} className={`border-l-4 ${isPosted ? 'border-l-emerald-500' : 'border-l-amber-400'} border-slate-200`}>
                        <CardHeader className="pb-1 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-violet-600" />
                              <div>
                                <CardTitle className="text-xs font-bold">{voucher.voucherNumber}</CardTitle>
                                <p className="text-[9px] text-muted-foreground">
                                  {isProject ? `Project: ${voucher.project}` : 'Consolidated'} · {voucher.period}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isProject && (
                                <Badge className="text-[10px] bg-teal-100 text-teal-700 border border-teal-200">Project</Badge>
                              )}
                              <Badge className={`text-[10px] border ${isPosted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                {isPosted ? 'POSTED' : 'DRAFT'}
                              </Badge>
                              <Button variant="ghost" size="sm" className="h-5 text-[9px] p-0"
                                onClick={() => setExpandedVoucherEmp(isExpanded ? null : voucher.voucherId)}>
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {isExpanded && (
                          <CardContent className="p-3 pt-0">
                            {/* Journal Entry Table */}
                            <div className="rounded border overflow-hidden mb-2">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-slate-50">
                                    <TableHead className="text-[9px] h-7">Account</TableHead>
                                    <TableHead className="text-[9px] h-7 text-right">Debit (PKR)</TableHead>
                                    <TableHead className="text-[9px] h-7 text-right">Credit (PKR)</TableHead>
                                    <TableHead className="text-[9px] h-7">Note</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {voucher.entries?.map((entry: any, idx: number) => (
                                    <TableRow key={idx} className={entry.debit > 0 ? 'bg-red-50/30' : 'bg-green-50/30'}>
                                      <TableCell className="text-[10px] py-1 font-medium">
                                        {entry.accountName || entry.account || '—'}
                                        {entry.accountCode && <span className="text-muted-foreground ml-1 font-mono text-[8px]">({entry.accountCode})</span>}
                                      </TableCell>
                                      <TableCell className="text-[10px] py-1 text-right font-mono">{entry.debit > 0 ? formatCurrency(entry.debit) : '—'}</TableCell>
                                      <TableCell className="text-[10px] py-1 text-right font-mono">{entry.credit > 0 ? formatCurrency(entry.credit) : '—'}</TableCell>
                                      <TableCell className="text-[9px] py-1 text-muted-foreground">{entry.description || entry.note || ''}</TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                    <TableCell className="text-[10px] py-1.5">TOTAL</TableCell>
                                    <TableCell className="text-[10px] py-1.5 text-right font-mono">{formatCurrency(voucher.totalDebit)}</TableCell>
                                    <TableCell className="text-[10px] py-1.5 text-right font-mono">{formatCurrency(voucher.totalCredit)}</TableCell>
                                    <TableCell className="text-[10px] py-1.5">
                                      {isBalanced ? (
                                        <Badge className="text-[8px] bg-emerald-100 text-emerald-700 border-emerald-200 border">✓ Bal</Badge>
                                      ) : (
                                        <span className="text-[9px] text-red-600">✗ Diff: {formatCurrency(Math.abs(voucher.totalDebit - voucher.totalCredit))}</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                            {/* Employee Breakdown for project vouchers */}
                            {isProject && voucher.employeeLines?.length > 0 && (
                              <div className="rounded border overflow-hidden mb-2">
                                <p className="text-[9px] font-semibold p-1.5 bg-muted/30">Employee Breakdown</p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-[8px] h-6">Employee</TableHead>
                                      <TableHead className="text-[8px] h-6 text-center">Days</TableHead>
                                      <TableHead className="text-[8px] h-6 text-center">Ratio</TableHead>
                                      <TableHead className="text-[8px] h-6 text-right">Earned</TableHead>
                                      <TableHead className="text-[8px] h-6 text-right">SC</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {voucher.employeeLines.map((emp: any, idx: number) => (
                                      <TableRow key={idx}>
                                        <TableCell className="text-[9px] py-0.5 font-medium">{emp.empName}</TableCell>
                                        <TableCell className="text-[9px] py-0.5 text-center">{emp.days}d</TableCell>
                                        <TableCell className="text-[9px] py-0.5 text-center">{emp.ratio}</TableCell>
                                        <TableCell className="text-[9px] py-0.5 text-right">{formatCurrency(emp.earned)}</TableCell>
                                        <TableCell className="text-[9px] py-0.5 text-right text-orange-600">{formatCurrency(emp.sc)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" className="h-6 text-[9px]" onClick={() => window.print()}>
                                Print
                              </Button>
                              {!isPosted && isBalanced && (
                                <Button size="sm" className="h-6 text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handlePostVoucherToGL(voucher.voucherId)}>
                                  Post to GL
                                </Button>
                              )}
                              {!isBalanced && (
                                <span className="text-[9px] text-red-600 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />Cannot post — voucher is unbalanced
                                </span>
                              )}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          {/* Also show the old JournalVoucherCard for backward compat */}
          {batch.status === 'draft-to-gl' && generatedVouchers.length === 0 && (
            <JournalVoucherCard key={`jv-${batch.id}`} batch={batch} draftVoucher={draftVoucher} setDraftVoucher={setDraftVoucher} />
          )}
        </Fragment>
      )
      })}

      {/* Legacy Generated GL Voucher Cards - shown when no batch context (e.g., after page refresh with vouchers in state) */}
      {generatedVouchers.length > 0 && !batches.some(b => b.status === 'draft-to-gl' || b.status === 'posted') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-600" />
              Project-wise Vouchers
            </h3>
            <Button size="sm" className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700"
              onClick={handlePostAllVouchersToGL}
              disabled={generatedVouchers.every(v => v.status !== 'draft')}>
              <BookOpen className="h-3 w-3 mr-1" />Post All to GL
            </Button>
          </div>
          {generatedVouchers.map(voucher => {
            const isBalanced = Math.abs(voucher.totalDebit - voucher.totalCredit) < 1
            const isPosted = voucher.status === 'posted'
            const isProject = voucher.voucherType === 'Project'
            const isExpanded = expandedVoucherEmp === voucher.voucherId

            return (
              <Card key={voucher.voucherId} className={`voucher-print-area border-l-4 ${isPosted ? 'border-l-emerald-500' : 'border-l-amber-400'} border-slate-200`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-violet-600" />
                      <div>
                        <CardTitle className="text-sm font-bold">{voucher.voucherNumber}</CardTitle>
                        <p className="text-[10px] text-muted-foreground">
                          {isProject ? `Project: ${voucher.project}` : 'Consolidated'} · {voucher.period}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isProject && (
                        <Badge className="text-[10px] bg-teal-100 text-teal-700 border border-teal-200">Project</Badge>
                      )}
                      <Badge className={`text-[10px] border ${isPosted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                        {isPosted ? 'POSTED' : 'DRAFT'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="rounded border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-[10px] h-8">Account</TableHead>
                          <TableHead className="text-[10px] h-8 text-right">Debit (PKR)</TableHead>
                          <TableHead className="text-[10px] h-8 text-right">Credit (PKR)</TableHead>
                          <TableHead className="text-[10px] h-8">Note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {voucher.entries?.map((entry: any, idx: number) => (
                          <TableRow key={idx} className={entry.debit > 0 ? 'bg-red-50/30' : 'bg-green-50/30'}>
                            <TableCell className="text-[11px] py-1.5 font-medium">
                              {entry.accountName || entry.account || '—'}
                              {entry.accountCode && <span className="text-muted-foreground ml-1 font-mono text-[9px]">({entry.accountCode})</span>}
                            </TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono">{entry.debit > 0 ? formatCurrency(entry.debit) : '—'}</TableCell>
                            <TableCell className="text-[11px] py-1.5 text-right font-mono">{entry.credit > 0 ? formatCurrency(entry.credit) : '—'}</TableCell>
                            <TableCell className="text-[10px] py-1.5 text-muted-foreground">{entry.description || entry.note || ''}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-100 font-bold border-t-2 border-slate-300">
                          <TableCell className="text-[11px] py-2">TOTAL</TableCell>
                          <TableCell className="text-[11px] py-2 text-right font-mono">{formatCurrency(voucher.totalDebit)}</TableCell>
                          <TableCell className="text-[11px] py-2 text-right font-mono">{formatCurrency(voucher.totalCredit)}</TableCell>
                          <TableCell className="text-[11px] py-2">
                            {isBalanced ? (
                              <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200 border">✓ Bal</Badge>
                            ) : (
                              <span className="text-[10px] text-red-600">✗ Diff: {formatCurrency(Math.abs(voucher.totalDebit - voucher.totalCredit))}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  {isProject && voucher.employeeLines?.length > 0 && (
                    <div className="mt-3">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] p-0"
                        onClick={() => setExpandedVoucherEmp(isExpanded ? null : voucher.voucherId)}>
                        {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                        Employee Breakdown
                      </Button>
                      {isExpanded && (
                        <div className="mt-2 rounded border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[9px] h-7">Employee</TableHead>
                                <TableHead className="text-[9px] h-7 text-center">Days</TableHead>
                                <TableHead className="text-[9px] h-7 text-center">Ratio</TableHead>
                                <TableHead className="text-[9px] h-7 text-right">Earned</TableHead>
                                <TableHead className="text-[9px] h-7 text-right">SC</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {voucher.employeeLines.map((emp: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell className="text-[10px] py-1 font-medium">{emp.empName}</TableCell>
                                  <TableCell className="text-[10px] py-1 text-center">{emp.days}d</TableCell>
                                  <TableCell className="text-[10px] py-1 text-center">{emp.ratio}</TableCell>
                                  <TableCell className="text-[10px] py-1 text-right">{formatCurrency(emp.earned)}</TableCell>
                                  <TableCell className="text-[10px] py-1 text-right text-orange-600">{formatCurrency(emp.sc)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 no-print">
                    {!isPosted && isBalanced && (
                      <Button size="sm" className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handlePostVoucherToGL(voucher.voucherId)}>
                        <BookOpen className="h-3 w-3 mr-1" />Post to GL
                      </Button>
                    )}
                    {!isBalanced && (
                      <span className="text-[10px] text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />Cannot post — voucher is unbalanced
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

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

      {/* Post Voucher Confirmation (Fix 5) */}
      <AlertDialog open={postConfirmOpen} onOpenChange={setPostConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Post Voucher to Ledger</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Post this voucher to the general ledger? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPostVoucher}>Confirm Post</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Draft to GL Confirmation Dialog (Task 4) */}
      <AlertDialog open={draftToGLDialogOpen} onOpenChange={setDraftToGLDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Draft to General Ledger
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will create <strong>project-wise draft vouchers</strong> in the General Ledger from the approved lines in batch &ldquo;{selectedBatch?.name || selectedBatch?.batchNumber}&rdquo;. A separate journal voucher will be generated for each project. Each draft voucher can be reviewed and posted individually to GL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedBatch && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Batch:</span><strong>{selectedBatch.name || selectedBatch.batchNumber}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Period:</span><strong>{selectedBatch.period}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Lines:</span><strong>{selectedBatch.lines?.length || 0}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Net Pay:</span><strong className="text-green-600">{formatCurrency(selectedBatch.totalNetPay)}</strong></div>
            </div>
          )}
          <div className="flex items-start gap-2 p-2 rounded bg-violet-50 border border-violet-200">
            <AlertCircle className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-violet-800">
              Project-wise draft vouchers will be created — one journal voucher per project, with salary expenses, deductions, and employer charges allocated proportionally. You can review and post each voucher to GL individually.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDraftToGL()} disabled={processingAction === 'draft-to-gl'}>
              {processingAction === 'draft-to-gl' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
              Create Project-wise Vouchers
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
