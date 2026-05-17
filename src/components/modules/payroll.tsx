'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus, Play, Eye, Shield, CheckCircle, ChevronDown, ChevronUp,
  FileText, Loader2, AlertCircle, ArrowRight, Trash2, Pencil,
  Building2, Users, Target, Search, X, Printer, Download,
  TrendingUp, TrendingDown, BarChart3, RefreshCw, Send,
  BookOpen, ArrowLeft, Filter, Calendar, DollarSign, Receipt,
  AlertTriangle, Info, ExternalLink
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

const fmtPKR = (n: number) =>
  `Rs ${fmt(n)}`

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function periodLabel(period: string) {
  if (!period) return ''
  const [y, m] = period.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ── Status config ─────────────────────────────────────────────

const BATCH_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:           { label: 'Draft',            color: '#6B7280', bg: '#F3F4F6' },
  reviewed:        { label: 'Reviewed',          color: '#2563EB', bg: '#EFF6FF' },
  approved:        { label: 'Approved',          color: '#16A34A', bg: '#F0FDF4' },
  'voucher-created': { label: 'Vouchers Created', color: '#7C3AED', bg: '#F5F3FF' },
}

const VOUCHER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#6B7280', bg: '#F3F4F6' },
  submitted: { label: 'Submitted', color: '#2563EB', bg: '#EFF6FF' },
  approved:  { label: 'Approved',  color: '#16A34A', bg: '#F0FDF4' },
  posted:    { label: 'Posted',    color: '#7C3AED', bg: '#F5F3FF' },
  reversed:  { label: 'Reversed',  color: '#DC2626', bg: '#FEF2F2' },
  cancelled: { label: 'Cancelled', color: '#9CA3AF', bg: '#F9FAFB' },
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; color: string; bg: string }> }) {
  const cfg = map[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

// ── Workflow Stepper ──────────────────────────────────────────

function WorkflowStepper({ steps, current }: { steps: string[]; current: string }) {
  const idx = steps.indexOf(current)
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < idx
        const active = i === idx
        const cfg = BATCH_STATUS[step] || VOUCHER_STATUS[step] || { label: step, color: '#6B7280', bg: '#F3F4F6' }
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all`}
                style={{
                  background: done || active ? cfg.color : '#F3F4F6',
                  borderColor: done || active ? cfg.color : '#D1D5DB',
                  color: done || active ? '#fff' : '#9CA3AF',
                }}>
                {done ? <CheckCircle className="w-3 h-3" /> : i + 1}
              </div>
              <span className="text-[10px] whitespace-nowrap" style={{ color: active ? cfg.color : done ? '#6B7280' : '#9CA3AF', fontWeight: active ? 600 : 400 }}>
                {cfg.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-8 h-0.5 mb-4 mx-1" style={{ background: done ? '#16A34A' : '#E5E7EB' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

const BATCH_STEPS = ['draft', 'reviewed', 'approved', 'voucher-created']
const VOUCHER_STEPS = ['draft', 'submitted', 'approved', 'posted']

// ── KPI Card ──────────────────────────────────────────────────

function KpiCard({ label, value, icon, color, sub }: { label: string; value: string; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-[22px] font-bold" style={{ color: '#1a1a2e', fontFamily: 'monospace' }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: '#9CA3AF' }}>{sub}</div>}
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const colors = ['#1A7A4A', '#2563EB', '#7C3AED', '#D97706', '#DC2626', '#0891B2']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.35 }}>
      {initials(name)}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function PayrollIntegration() {
  const { authUser } = useAppStore()
  const { toast } = useToast()

  // View state
  const [view, setView] = useState<'dashboard' | 'batch-detail' | 'voucher-list' | 'voucher-detail'>('dashboard')
  const [selectedBatch, setSelectedBatch] = useState<any>(null)
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null)

  // Data
  const [batches, setBatches] = useState<any[]>([])
  const [vouchers, setVouchers] = useState<any[]>([])
  const [financialYears, setFinancialYears] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  // Loading
  const [loading, setLoading] = useState(true)
  const [runningPayroll, setRunningPayroll] = useState<string | null>(null)
  const [processingAction, setProcessingAction] = useState<string | null>(null)

  // Dialogs
  const [createBatchOpen, setCreateBatchOpen] = useState(false)
  const [createVoucherOpen, setCreateVoucherOpen] = useState(false)
  const [deleteBatchOpen, setDeleteBatchOpen] = useState(false)
  const [postGLOpen, setPostGLOpen] = useState(false)
  const [postGLVoucher, setPostGLVoucher] = useState<any>(null)

  // Voucher filters
  const [voucherSearch, setVoucherSearch] = useState('')
  const [voucherStatusFilter, setVoucherStatusFilter] = useState('all')
  const [voucherBatchFilter, setVoucherBatchFilter] = useState('all')
  const [voucherProjectFilter, setVoucherProjectFilter] = useState('all')

  // Batch form
  const [batchForm, setBatchForm] = useState({ name: '', period: new Date().toISOString().slice(0, 7) })

  // Fetch data
  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/payroll')
      const data = await res.json()
      setBatches(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }, [])

  const fetchVouchers = useCallback(async (filters?: any) => {
    try {
      const params = new URLSearchParams()
      if (filters?.batchId) params.set('batchId', filters.batchId)
      if (filters?.period) params.set('period', filters.period)
      if (filters?.projectId) params.set('projectId', filters.projectId)
      if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters?.search) params.set('search', filters.search)
      const res = await fetch(`/api/salary-vouchers?${params}`)
      const data = await res.json()
      setVouchers(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([
        fetchBatches(),
        fetchVouchers(),
        fetch('/api/financial-year').then(r => r.json()).then(d => setFinancialYears(Array.isArray(d) ? d : [])).catch(() => {}),
        fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : [])).catch(() => {}),
      ])
      setLoading(false)
    }
    init()
  }, [fetchBatches, fetchVouchers])

  // KPI totals
  const kpi = useMemo(() => batches.reduce((acc, b) => ({
    gross: acc.gross + (b.totalGross || 0),
    deductions: acc.deductions + (b.totalDeductions || 0),
    net: acc.net + (b.totalNetPay || 0),
    sc: acc.sc + (b.totalSocialCharges || 0),
    tax: acc.tax + (b.totalIncomeTax || 0),
  }), { gross: 0, deductions: 0, net: 0, sc: 0, tax: 0 }), [batches])

  // Pending actions
  const pendingReview = batches.filter(b => b.status === 'draft' && (b.lines?.length || 0) > 0).length
  const pendingApproval = batches.filter(b => b.status === 'reviewed').length
  const vouchersPendingApproval = vouchers.filter(v => v.status === 'submitted').length

  // ── Handlers ────────────────────────────────────────────────

  const handleCreateBatch = async () => {
    if (!batchForm.period) { toast({ title: 'Period required', variant: 'destructive' }); return }
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: batchForm.name || `Payroll - ${periodLabel(batchForm.period)}`, period: batchForm.period }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast({ title: 'Batch created', description: data.batchNumber })
      setCreateBatchOpen(false)
      setBatchForm({ name: '', period: new Date().toISOString().slice(0, 7) })
      fetchBatches()
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
  }

  const handleRunPayroll = async (batch: any) => {
    setRunningPayroll(batch.id)
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-payroll', batchId: batch.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast({ title: 'Payroll calculated', description: `${data.employeeCount} employees processed` })
      fetchBatches()
      if (selectedBatch?.id === batch.id) {
        const updated = await fetch(`/api/payroll?id=${batch.id}`).then(r => r.json())
        setSelectedBatch(updated)
      }
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setRunningPayroll(null) }
  }

  const handleBatchAction = async (action: string, batchId: string) => {
    setProcessingAction(action + batchId)
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, batchId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast({ title: 'Done', description: data.message })
      fetchBatches()
      if (selectedBatch?.id === batchId) {
        const updated = await fetch(`/api/payroll?id=${batchId}`).then(r => r.json())
        setSelectedBatch(updated)
      }
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setProcessingAction(null) }
  }

  const handleApproveAllLines = async (batchId: string) => {
    setProcessingAction('approve-all' + batchId)
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve-all-lines', batchId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast({ title: 'All lines approved', description: data.message })
      fetchBatches()
      if (selectedBatch?.id === batchId) {
        const updated = await fetch(`/api/payroll?id=${batchId}`).then(r => r.json())
        setSelectedBatch(updated)
      }
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setProcessingAction(null) }
  }

  const handleDeleteBatch = async () => {
    if (!selectedBatch) return
    try {
      const res = await fetch(`/api/payroll?id=${selectedBatch.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast({ title: 'Batch deleted' })
      setDeleteBatchOpen(false)
      setSelectedBatch(null)
      setView('dashboard')
      fetchBatches()
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
  }

  const handleVoucherAction = async (action: string, voucherId: string, extra?: any) => {
    setProcessingAction(action + voucherId)
    try {
      const res = await fetch('/api/salary-vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, voucherId, userId: authUser?.id || 'system', ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.results?.[0]?.error || data.error || 'Failed')
      toast({ title: 'Done', description: `Voucher ${action}ed successfully` })
      fetchVouchers()
      if (selectedVoucher?.id === voucherId) {
        const updated = await fetch(`/api/salary-vouchers?id=${voucherId}`).then(r => r.json())
        setSelectedVoucher(updated)
      }
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setProcessingAction(null) }
  }

  const handleApproveAndSend = async () => {
    if (!postGLVoucher) return
    const v = postGLVoucher
    setProcessingAction('approve-send' + v.id)
    try {
      // Step 1: Approve the salary voucher
      const approveRes = await fetch('/api/salary-vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', voucherId: v.id, userId: authUser?.id || 'system' }),
      })
      const approveData = await approveRes.json()
      if (!approveRes.ok) throw new Error(approveData.results?.[0]?.error || approveData.error || 'Approval failed')

      // Step 2: Find open financial year
      const fyRes = await fetch('/api/financial-year')
      const fyData = await fyRes.json()
      const openFY = Array.isArray(fyData) ? fyData.find((f: any) => f.status === 'open') : null
      if (!openFY) throw new Error('No open financial year found. Please open a financial year first.')

      // Step 3: Build journal entries from salary voucher lines
      const lines = v.lines || []
      const entries = lines.map((l: any, i: number) => ({
        lineNumber: i + 1,
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
        projectId: v.projectId,
        payrollRef: v.voucherNumber,
      }))

      // Step 4: Create draft JV in voucher management
      const jvRes = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherType: 'JV',
          voucherTypeName: 'Journal Voucher',
          date: new Date().toISOString(),
          narration: `Salary Voucher - ${v.employeeName} - ${v.projectName} - ${v.period} [${v.voucherNumber}]`,
          reference: v.voucherNumber,
          financialYearId: openFY.id,
          projectId: v.projectId,
          isPayrollPosted: true,
          entries,
        }),
      })
      const jvData = await jvRes.json()
      if (!jvRes.ok) throw new Error(jvData.error || 'Failed to create voucher in Voucher Management')

      // Step 5: Mark salary voucher as posted (linked to JV)
      await fetch('/api/salary-vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post', voucherId: v.id, userId: authUser?.id || 'system' }),
      })

      toast({
        title: 'Sent to Voucher Management',
        description: `Draft JV ${jvData.voucherNumber} created. Go to Voucher Management to post to GL.`,
      })
      setPostGLOpen(false)
      setPostGLVoucher(null)
      fetchVouchers()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setProcessingAction(null)
    }
  }

  // ── Filtered vouchers ────────────────────────────────────────

  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      if (voucherStatusFilter !== 'all' && v.status !== voucherStatusFilter) return false
      if (voucherBatchFilter !== 'all' && v.payrollBatchId !== voucherBatchFilter) return false
      if (voucherProjectFilter !== 'all' && v.projectId !== voucherProjectFilter) return false
      if (voucherSearch) {
        const s = voucherSearch.toLowerCase()
        return v.voucherNumber?.toLowerCase().includes(s) ||
          v.employeeName?.toLowerCase().includes(s) ||
          v.projectName?.toLowerCase().includes(s) ||
          v.projectCode?.toLowerCase().includes(s)
      }
      return true
    })
  }, [vouchers, voucherStatusFilter, voucherBatchFilter, voucherProjectFilter, voucherSearch])

  const voucherTotals = useMemo(() => filteredVouchers.reduce((acc, v) => ({
    dr: acc.dr + (v.totalDebit || 0),
    cr: acc.cr + (v.totalCredit || 0),
  }), { dr: 0, cr: 0 }), [filteredVouchers])

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1A7A4A' }} />
      </div>
    )
  }

  return (
    <div style={{ background: '#F5F7FA', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {view === 'dashboard' && (
        <DashboardView
          batches={batches}
          vouchers={vouchers}
          kpi={kpi}
          pendingReview={pendingReview}
          pendingApproval={pendingApproval}
          vouchersPendingApproval={vouchersPendingApproval}
          runningPayroll={runningPayroll}
          processingAction={processingAction}
          onCreateBatch={() => setCreateBatchOpen(true)}
          onRunPayroll={handleRunPayroll}
          onBatchAction={handleBatchAction}
          onOpenBatch={(b) => { setSelectedBatch(b); setView('batch-detail') }}
          onViewVouchers={(batchId) => {
            setVoucherBatchFilter(batchId || 'all')
            fetchVouchers({ batchId: batchId || undefined })
            setView('voucher-list')
          }}
          onViewAllVouchers={() => { fetchVouchers(); setView('voucher-list') }}
        />
      )}

      {view === 'batch-detail' && selectedBatch && (
        <BatchDetailView
          batch={selectedBatch}
          projects={projects}
          processingAction={processingAction}
          runningPayroll={runningPayroll}
          onBack={() => setView('dashboard')}
          onRunPayroll={handleRunPayroll}
          onBatchAction={handleBatchAction}
          onApproveAllLines={handleApproveAllLines}
          onCreateVouchers={() => setCreateVoucherOpen(true)}
          onViewVouchers={() => {
            setVoucherBatchFilter(selectedBatch.id)
            fetchVouchers({ batchId: selectedBatch.id })
            setView('voucher-list')
          }}
          onDelete={() => setDeleteBatchOpen(true)}
          onRefresh={async () => {
            const updated = await fetch(`/api/payroll?id=${selectedBatch.id}`).then(r => r.json())
            setSelectedBatch(updated)
          }}
        />
      )}

      {view === 'voucher-list' && (
        <VoucherListView
          vouchers={filteredVouchers}
          allVouchers={vouchers}
          batches={batches}
          projects={projects}
          totals={voucherTotals}
          search={voucherSearch}
          statusFilter={voucherStatusFilter}
          batchFilter={voucherBatchFilter}
          projectFilter={voucherProjectFilter}
          processingAction={processingAction}
          onSearch={setVoucherSearch}
          onStatusFilter={setVoucherStatusFilter}
          onBatchFilter={(id) => { setVoucherBatchFilter(id); fetchVouchers({ batchId: id !== 'all' ? id : undefined }) }}
          onProjectFilter={setVoucherProjectFilter}
          onBack={() => setView('dashboard')}
          onViewVoucher={(v) => { setSelectedVoucher(v); setView('voucher-detail') }}
          onVoucherAction={handleVoucherAction}
          onPostGL={(v) => { setPostGLVoucher(v); setPostGLOpen(true) }}
          onRefresh={() => fetchVouchers()}
        />
      )}

      {view === 'voucher-detail' && selectedVoucher && (
        <VoucherDetailView
          voucher={selectedVoucher}
          processingAction={processingAction}
          onBack={() => setView('voucher-list')}
          onVoucherAction={handleVoucherAction}
          onPostGL={(v) => { setPostGLVoucher(v); setPostGLOpen(true) }}
        />
      )}

      {/* Create Batch Dialog */}
      <Dialog open={createBatchOpen} onOpenChange={setCreateBatchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" style={{ color: '#1A7A4A' }} />
              Create Payroll Batch
            </DialogTitle>
            <DialogDescription className="text-xs">Create a new payroll batch for a period</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Period *</Label>
              <Input type="month" className="mt-1 h-9 text-sm" value={batchForm.period}
                onChange={e => setBatchForm(p => ({ ...p, period: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Batch Name (optional)</Label>
              <Input className="mt-1 h-9 text-sm" placeholder={`Payroll - ${periodLabel(batchForm.period)}`}
                value={batchForm.name} onChange={e => setBatchForm(p => ({ ...p, name: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateBatchOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateBatch} style={{ background: '#1A7A4A', color: '#fff' }}>
              <Plus className="w-3 h-3 mr-1" /> Create Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Vouchers Modal */}
      {createVoucherOpen && selectedBatch && (
        <CreateVouchersModal
          batch={selectedBatch}
          projects={projects}
          onClose={() => setCreateVoucherOpen(false)}
          onSuccess={(count) => {
            toast({ title: `${count} voucher(s) created`, description: 'Submit then approve vouchers to send them to Voucher Management for GL posting' })
            setCreateVoucherOpen(false)
            fetchBatches()
            fetchVouchers({ batchId: selectedBatch.id })
            const refresh = async () => {
              const updated = await fetch(`/api/payroll?id=${selectedBatch.id}`).then(r => r.json())
              setSelectedBatch(updated)
            }
            refresh()
          }}
        />
      )}

      {/* Delete Batch Confirm */}
      <AlertDialog open={deleteBatchOpen} onOpenChange={setDeleteBatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Payroll Batch?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will permanently delete batch <strong>{selectedBatch?.batchNumber}</strong> and all its lines. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBatch} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Post to GL Confirm */}
      {postGLVoucher && (
        <ApproveAndSendModal
          voucher={postGLVoucher}
          open={postGLOpen}
          onClose={() => { setPostGLOpen(false); setPostGLVoucher(null) }}
          onConfirm={handleApproveAndSend}
          processing={processingAction === 'approve-send' + postGLVoucher?.id}
        />
      )}
    </div>
  )
}

// ── Dashboard View ────────────────────────────────────────────

function DashboardView({ batches, vouchers, kpi, pendingReview, pendingApproval, vouchersPendingApproval,
  runningPayroll, processingAction, onCreateBatch, onRunPayroll, onBatchAction, onOpenBatch, onViewVouchers, onViewAllVouchers }: any) {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#1a1a2e' }}>Payroll Management</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Manage salary processing, project cost distribution and vouchers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onViewAllVouchers} className="text-xs h-8">
            <FileText className="w-3 h-3 mr-1" /> Salary Vouchers
          </Button>
          <Button size="sm" onClick={onCreateBatch} className="text-xs h-8" style={{ background: '#1A7A4A', color: '#fff' }}>
            <Plus className="w-3 h-3 mr-1" /> New Batch
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Gross Salary" value={fmtPKR(kpi.gross)} icon={<DollarSign className="w-4 h-4" />} color="#1A7A4A" />
        <KpiCard label="Deductions" value={fmtPKR(kpi.deductions)} icon={<TrendingDown className="w-4 h-4" />} color="#DC2626" />
        <KpiCard label="Net Pay" value={fmtPKR(kpi.net)} icon={<TrendingUp className="w-4 h-4" />} color="#16A34A" />
        <KpiCard label="Social Charges" value={fmtPKR(kpi.sc)} icon={<Shield className="w-4 h-4" />} color="#D97706" />
        <KpiCard label="Income Tax" value={fmtPKR(kpi.tax)} icon={<Receipt className="w-4 h-4" />} color="#2563EB" />
      </div>

      {/* Pending Actions */}
      {(pendingReview > 0 || pendingApproval > 0 || vouchersPendingApproval > 0) && (
        <div className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4" style={{ color: '#D97706' }} />
            <span className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>Pending Actions</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {pendingReview > 0 && (
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <div>
                  <div className="text-xs font-semibold" style={{ color: '#92400E' }}>{pendingReview} batch{pendingReview > 1 ? 'es' : ''} need review</div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#B45309' }}>Run payroll and review lines</div>
                </div>
                <Eye className="w-4 h-4" style={{ color: '#D97706' }} />
              </div>
            )}
            {pendingApproval > 0 && (
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <div>
                  <div className="text-xs font-semibold" style={{ color: '#1E40AF' }}>{pendingApproval} batch{pendingApproval > 1 ? 'es' : ''} pending approval</div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#3B82F6' }}>Approve to generate vouchers</div>
                </div>
                <Shield className="w-4 h-4" style={{ color: '#2563EB' }} />
              </div>
            )}
            {vouchersPendingApproval > 0 && (
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div>
                  <div className="text-xs font-semibold" style={{ color: '#14532D' }}>{vouchersPendingApproval} voucher{vouchersPendingApproval > 1 ? 's' : ''} pending approval</div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#16A34A' }}>Approve to send to Voucher Management</div>
                </div>
                <FileText className="w-4 h-4" style={{ color: '#16A34A' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>Payroll Batches</h2>
          <span className="text-xs" style={{ color: '#6B7280' }}>{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
        </div>
        {batches.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: '#fff', border: '2px dashed #E5E7EB' }}>
            <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
            <p className="text-sm font-medium" style={{ color: '#6B7280' }}>No payroll batches yet</p>
            <p className="text-xs mt-1 mb-4" style={{ color: '#9CA3AF' }}>Create your first batch to start processing payroll</p>
            <Button size="sm" onClick={onCreateBatch} style={{ background: '#1A7A4A', color: '#fff' }}>
              <Plus className="w-3 h-3 mr-1" /> Create First Batch
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map(batch => (
              <BatchCard
                key={batch.id}
                batch={batch}
                runningPayroll={runningPayroll}
                processingAction={processingAction}
                onOpen={() => onOpenBatch(batch)}
                onRunPayroll={() => onRunPayroll(batch)}
                onAction={(action: string) => onBatchAction(action, batch.id)}
                onViewVouchers={() => onViewVouchers(batch.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Batch Card ────────────────────────────────────────────────

function BatchCard({ batch, runningPayroll, processingAction, onOpen, onRunPayroll, onAction, onViewVouchers }: any) {
  const lines = batch.lines || []
  const approvedLines = lines.filter((l: any) => l.lineStatus === 'approved' || l.lineStatus === 'voucher-created')
  const isRunning = runningPayroll === batch.id

  return (
    <div className="rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md"
      style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      onClick={onOpen}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#F0FDF4' }}>
              <Calendar className="w-5 h-5" style={{ color: '#1A7A4A' }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>{batch.name || `Payroll - ${periodLabel(batch.period)}`}</div>
              <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                {batch.batchNumber} · {lines.length} employee{lines.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <StatusBadge status={batch.status} map={BATCH_STATUS} />
        </div>

        {/* Stepper */}
        <div className="mb-3">
          <WorkflowStepper steps={BATCH_STEPS} current={batch.status} />
        </div>

        {/* Financials */}
        {batch.totalGross > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Gross', value: fmtPKR(batch.totalGross), color: '#1A7A4A' },
              { label: 'Net Pay', value: fmtPKR(batch.totalNetPay), color: '#16A34A' },
              { label: 'SC', value: fmtPKR(batch.totalSocialCharges), color: '#D97706' },
            ].map(item => (
              <div key={item.label} className="rounded-lg p-2 text-center" style={{ background: '#F9FAFB' }}>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: '#9CA3AF' }}>{item.label}</div>
                <div className="text-xs font-bold mt-0.5" style={{ color: item.color, fontFamily: 'monospace' }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
          {batch.status === 'draft' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRunPayroll} disabled={isRunning}>
              {isRunning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
              {isRunning ? 'Calculating...' : 'Run Payroll'}
            </Button>
          )}
          {batch.status === 'draft' && lines.length > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction('review')}>
              <Eye className="w-3 h-3 mr-1" /> Review
            </Button>
          )}
          {batch.status === 'reviewed' && (
            <Button size="sm" className="h-7 text-xs" onClick={() => onAction('approve')} style={{ background: '#1A7A4A', color: '#fff' }}>
              <Shield className="w-3 h-3 mr-1" /> Approve
            </Button>
          )}
          {batch.status === 'approved' && (
            <Button size="sm" className="h-7 text-xs" onClick={onOpen} style={{ background: '#7C3AED', color: '#fff' }}>
              <FileText className="w-3 h-3 mr-1" /> Create Salary Vouchers
            </Button>
          )}
          {batch.status === 'voucher-created' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onViewVouchers}>
              <Eye className="w-3 h-3 mr-1" /> View Vouchers
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Batch Detail View ─────────────────────────────────────────

function BatchDetailView({ batch, projects, processingAction, runningPayroll, onBack, onRunPayroll,
  onBatchAction, onApproveAllLines, onCreateVouchers, onViewVouchers, onDelete, onRefresh }: any) {
  const [search, setSearch] = useState('')
  const [expandedLine, setExpandedLine] = useState<string | null>(null)
  const [expandedTab, setExpandedTab] = useState<Record<string, string>>({})
  const lines = batch.lines || []
  const isRunning = runningPayroll === batch.id

  const filteredLines = lines.filter((l: any) =>
    !search || l.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
    l.employeeCode?.toLowerCase().includes(search.toLowerCase())
  )

  // Group by project
  const projectGroups = useMemo(() => {
    const groups = new Map<string, { projectId: string | null; projectCode: string; projectName: string; lines: any[] }>()
    for (const line of filteredLines) {
      let allocs: any[] = []
      try { allocs = line.projectAllocations ? JSON.parse(line.projectAllocations) : [] } catch {}
      let contracts: any[] = []
      try { contracts = line.contractEarnings ? JSON.parse(line.contractEarnings) : [] } catch {}

      const projectIds = new Set<string>()
      if (allocs.length > 0) allocs.forEach((a: any) => a.days > 0 && projectIds.add(a.projectId))
      else if (contracts.length > 0) contracts.forEach((c: any) => c.daysWorked > 0 && projectIds.add(c.projectId))
      else if (line.projectId) projectIds.add(line.projectId)
      else projectIds.add('__none__')

      for (const pid of projectIds) {
        if (!groups.has(pid)) {
          const proj = pid === '__none__' ? null : projects.find((p: any) => p.id === pid)
          groups.set(pid, {
            projectId: pid === '__none__' ? null : pid,
            projectCode: proj?.code || (pid === '__none__' ? '-' : pid.slice(0, 6)),
            projectName: proj?.name || (pid === '__none__' ? 'Unassigned' : 'Unknown'),
            lines: [],
          })
        }
        if (!groups.get(pid)!.lines.find((l2: any) => l2.id === line.id)) {
          groups.get(pid)!.lines.push(line)
        }
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.projectCode.localeCompare(b.projectCode))
  }, [filteredLines, projects])

  const approvedCount = lines.filter((l: any) => l.lineStatus === 'approved' || l.lineStatus === 'voucher-created').length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4" style={{ color: '#6B7280' }} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold" style={{ color: '#1a1a2e' }}>{batch.name || `Payroll - ${periodLabel(batch.period)}`}</h1>
            <StatusBadge status={batch.status} map={BATCH_STATUS} />
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
            {batch.batchNumber} · Period: {batch.period} · {lines.length} employee{lines.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRefresh}>
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
          {batch.status === 'draft' && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={onDelete}>
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
        <WorkflowStepper steps={BATCH_STEPS} current={batch.status} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Gross" value={fmtPKR(batch.totalGross || 0)} icon={<DollarSign className="w-4 h-4" />} color="#1A7A4A" sub={`${lines.length} employees`} />
        <KpiCard label="Tax" value={fmtPKR(batch.totalIncomeTax || 0)} icon={<Receipt className="w-4 h-4" />} color="#DC2626" />
        <KpiCard label="Net Pay" value={fmtPKR(batch.totalNetPay || 0)} icon={<TrendingUp className="w-4 h-4" />} color="#16A34A" />
        <KpiCard label="Social Charges" value={fmtPKR(batch.totalSocialCharges || 0)} icon={<Shield className="w-4 h-4" />} color="#D97706" />
        <KpiCard label="Approved Lines" value={`${approvedCount} / ${lines.length}`} icon={<CheckCircle className="w-4 h-4" />} color="#7C3AED" />
      </div>

      {/* Action Bar */}
      <div className="rounded-xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-2 flex-wrap">
          {batch.status === 'draft' && (
            <Button size="sm" onClick={() => onRunPayroll(batch)} disabled={isRunning} style={{ background: '#1A7A4A', color: '#fff' }} className="h-8 text-xs">
              {isRunning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
              {isRunning ? 'Calculating...' : 'Run Payroll'}
            </Button>
          )}
          {batch.status === 'draft' && lines.length > 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onBatchAction('review', batch.id)}>
              <Eye className="w-3 h-3 mr-1" /> Submit for Review
            </Button>
          )}
          {(batch.status === 'reviewed' || batch.status === 'approved') && approvedCount < lines.length && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onApproveAllLines(batch.id)}
              disabled={processingAction === 'approve-all' + batch.id}>
              {processingAction === 'approve-all' + batch.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
              Approve All Lines
            </Button>
          )}
          {batch.status === 'reviewed' && (
            <Button size="sm" className="h-8 text-xs" onClick={() => onBatchAction('approve', batch.id)} style={{ background: '#1A7A4A', color: '#fff' }}>
              <Shield className="w-3 h-3 mr-1" /> Approve Batch
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {batch.status === 'approved' && approvedCount > 0 && (
            <Button size="sm" className="h-8 text-xs" onClick={onCreateVouchers} style={{ background: '#7C3AED', color: '#fff' }}>
              <FileText className="w-3 h-3 mr-1" /> Create Salary Vouchers
            </Button>
          )}
          {batch.status === 'voucher-created' && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onViewVouchers}>
              <Eye className="w-3 h-3 mr-1" /> View Vouchers
            </Button>
          )}
        </div>
      </div>

      {/* Employee Lines */}
      {lines.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: '#fff', border: '2px dashed #E5E7EB' }}>
          <Users className="w-8 h-8 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
          <p className="text-sm" style={{ color: '#6B7280' }}>No employees yet. Run payroll to calculate salaries.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
            <Input className="pl-9 h-8 text-xs" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Project Groups */}
          {projectGroups.map(group => (
            <ProjectGroupSection
              key={group.projectId || '__none__'}
              group={group}
              expandedLine={expandedLine}
              expandedTab={expandedTab}
              onToggleLine={(id: string) => setExpandedLine(expandedLine === id ? null : id)}
              onSetTab={(lineId: string, tab: string) => setExpandedTab(p => ({ ...p, [lineId]: tab }))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Project Group Section ─────────────────────────────────────

function ProjectGroupSection({ group, expandedLine, expandedTab, onToggleLine, onSetTab }: any) {
  const [collapsed, setCollapsed] = useState(false)
  const groupGross = group.lines.reduce((s: number, l: any) => s + (l.grossSalary || 0), 0)
  const groupNet = group.lines.reduce((s: number, l: any) => s + (l.netPay || 0), 0)
  const groupSC = group.lines.reduce((s: number, l: any) => s + (l.socialCharges || 0), 0)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
      {/* Group Header */}
      <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EFF6FF' }}>
            <Building2 className="w-4 h-4" style={{ color: '#2563EB' }} />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>
              <span className="font-mono text-xs px-1.5 py-0.5 rounded mr-2" style={{ background: '#EFF6FF', color: '#2563EB' }}>{group.projectCode}</span>
              {group.projectName}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
              {group.lines.length} employee{group.lines.length !== 1 ? 's' : ''} · Gross: {fmtPKR(groupGross)} · Net: {fmtPKR(groupNet)} · SC: {fmtPKR(groupSC)}
            </div>
          </div>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4" style={{ color: '#9CA3AF' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#9CA3AF' }} />}
      </button>

      {!collapsed && (
        <div className="border-t" style={{ borderColor: '#F3F4F6' }}>
          {group.lines.map((line: any) => (
            <EmployeeLineRow
              key={line.id}
              line={line}
              expanded={expandedLine === line.id}
              activeTab={expandedTab[line.id] || 'summary'}
              onToggle={() => onToggleLine(line.id)}
              onSetTab={(tab: string) => onSetTab(line.id, tab)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Employee Line Row ─────────────────────────────────────────

function EmployeeLineRow({ line, expanded, activeTab, onToggle, onSetTab }: any) {
  let allocs: any[] = []
  try { allocs = line.projectAllocations ? JSON.parse(line.projectAllocations) : [] } catch {}
  let taxBreakdown: any = null
  try { taxBreakdown = line.taxBreakdown ? JSON.parse(line.taxBreakdown) : null } catch {}
  let scBreakdown: any = null
  try { scBreakdown = line.scBreakdown ? JSON.parse(line.scBreakdown) : null } catch {}
  let allowanceDetails: any[] = []
  try { allowanceDetails = line.allowanceDetails ? JSON.parse(line.allowanceDetails) : [] } catch {}

  const lineStatusCfg = BATCH_STATUS[line.lineStatus] || { label: line.lineStatus, color: '#6B7280', bg: '#F3F4F6' }

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: '#F3F4F6' }}>
      {/* Row */}
      <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
        onClick={onToggle}>
        <Avatar name={line.employeeName} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: '#1a1a2e' }}>{line.employeeName}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#6B7280' }}>{line.employeeCode}</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ color: lineStatusCfg.color, background: lineStatusCfg.bg }}>
              {lineStatusCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px]" style={{ color: '#6B7280' }}>
            <span>Gross: <strong style={{ color: '#1A7A4A' }}>{fmtPKR(line.grossSalary)}</strong></span>
            <span>Tax: <strong style={{ color: '#DC2626' }}>{fmtPKR(line.incomeTax)}</strong></span>
            <span>Net: <strong style={{ color: '#16A34A' }}>{fmtPKR(line.netPay)}</strong></span>
            <span>SC: <strong style={{ color: '#D97706' }}>{fmtPKR(line.socialCharges)}</strong></span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: '#9CA3AF' }} /> : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4" style={{ background: '#FAFAFA' }}>
          <Tabs value={activeTab} onValueChange={onSetTab}>
            <TabsList className="h-7 mb-3">
              {['summary', 'allocation', 'tax', 'sc'].map(tab => (
                <TabsTrigger key={tab} value={tab} className="text-[11px] h-6 px-3 capitalize">{tab === 'sc' ? 'Social Charges' : tab}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="summary">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Attendance */}
                <div className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>Attendance</div>
                  {[
                    ['Calendar Days', line.calendarDays || line.workingDays],
                    ['Working Days', line.workingDays],
                    ['Payable Days', line.payableDays || line.eligibleDays],
                    ['Leave Days', line.leaveDays],
                    ['Absent Days', line.absentDays],
                    ['Daily Rate', fmtPKR(line.dailyRate)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between text-[11px] py-0.5">
                      <span style={{ color: '#6B7280' }}>{k}</span>
                      <span className="font-medium" style={{ color: '#1a1a2e' }}>{v}</span>
                    </div>
                  ))}
                </div>
                {/* Earnings */}
                <div className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>Earnings</div>
                  {[
                    ['Basic Salary', fmtPKR(line.basicSalary)],
                    ...allowanceDetails.map((a: any) => [a.name, fmtPKR(a.amount)]),
                    ['Gross Total', fmtPKR(line.grossSalary)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between text-[11px] py-0.5">
                      <span style={{ color: '#6B7280' }}>{k}</span>
                      <span className="font-medium" style={{ color: k === 'Gross Total' ? '#1A7A4A' : '#1a1a2e' }}>{v}</span>
                    </div>
                  ))}
                </div>
                {/* Deductions */}
                <div className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>Deductions</div>
                  {[
                    ['Income Tax', fmtPKR(line.incomeTax)],
                    ['EOBI (Emp)', fmtPKR(line.eobiEmployee)],
                    ['ESSI (Emp)', fmtPKR(line.essiEmployee)],
                    ['PF (Emp)', fmtPKR(line.pfEmployee)],
                    ['Loan', fmtPKR(line.loanDeduction)],
                    ['Advance', fmtPKR(line.advanceDeduction)],
                    ['Other', fmtPKR(line.otherDeductions)],
                    ['Total Deductions', fmtPKR(line.totalDeductions)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between text-[11px] py-0.5">
                      <span style={{ color: '#6B7280' }}>{k}</span>
                      <span className="font-medium" style={{ color: k === 'Total Deductions' ? '#DC2626' : '#1a1a2e' }}>{v}</span>
                    </div>
                  ))}
                </div>
                {/* Employer SC */}
                <div className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>Employer SC</div>
                  {[
                    ['EOBI (Empl)', fmtPKR(line.eobiEmployer)],
                    ['ESSI (Empl)', fmtPKR(line.essiEmployer)],
                    ['PF (Empl)', fmtPKR(line.pfEmployer)],
                    ['Social Charges', fmtPKR(line.socialCharges)],
                    ['Gratuity', fmtPKR(line.gratuity)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between text-[11px] py-0.5">
                      <span style={{ color: '#6B7280' }}>{k}</span>
                      <span className="font-medium" style={{ color: k === 'Social Charges' ? '#D97706' : '#1a1a2e' }}>{v}</span>
                    </div>
                  ))}
                  <Separator className="my-1" />
                  <div className="flex justify-between text-[11px] font-bold">
                    <span style={{ color: '#1a1a2e' }}>Net Pay</span>
                    <span style={{ color: '#16A34A' }}>{fmtPKR(line.netPay)}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="allocation">
              {allocs.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: '#9CA3AF' }}>No project allocation data</p>
              ) : (
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                  <Table>
                    <TableHeader>
                      <TableRow style={{ background: '#F9FAFB' }}>
                        {['Project', 'Days', 'Weight', 'Salary Share', 'SC Share'].map(h => (
                          <TableHead key={h} className="text-[10px] h-7 font-semibold uppercase tracking-wide">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocs.map((a: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-[11px] py-1.5">
                            <span className="font-mono text-[10px] px-1 py-0.5 rounded mr-1" style={{ background: '#EFF6FF', color: '#2563EB' }}>{a.projectCode}</span>
                            {a.projectName}
                          </TableCell>
                          <TableCell className="text-[11px] py-1.5 font-mono">{a.days}</TableCell>
                          <TableCell className="text-[11px] py-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full" style={{ background: '#E5E7EB' }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.round((a.weight || 0) * 100)}%`, background: '#1A7A4A' }} />
                              </div>
                              <span className="font-mono">{Math.round((a.weight || 0) * 100)}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[11px] py-1.5 font-mono" style={{ color: '#1A7A4A' }}>{fmtPKR(a.salaryShare || 0)}</TableCell>
                          <TableCell className="text-[11px] py-1.5 font-mono" style={{ color: '#D97706' }}>{fmtPKR(a.scShare || 0)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow style={{ background: '#F9FAFB', fontWeight: 700 }}>
                        <TableCell className="text-[11px] py-1.5 font-bold">TOTAL</TableCell>
                        <TableCell className="text-[11px] py-1.5 font-mono font-bold">{allocs.reduce((s: number, a: any) => s + (a.days || 0), 0)}</TableCell>
                        <TableCell className="text-[11px] py-1.5 font-mono font-bold">100%</TableCell>
                        <TableCell className="text-[11px] py-1.5 font-mono font-bold" style={{ color: '#1A7A4A' }}>{fmtPKR(allocs.reduce((s: number, a: any) => s + (a.salaryShare || 0), 0))}</TableCell>
                        <TableCell className="text-[11px] py-1.5 font-mono font-bold" style={{ color: '#D97706' }}>{fmtPKR(allocs.reduce((s: number, a: any) => s + (a.scShare || 0), 0))}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="tax">
              {!taxBreakdown ? (
                <p className="text-xs text-center py-4" style={{ color: '#9CA3AF' }}>No tax breakdown data</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Taxable Income', fmtPKR(taxBreakdown.taxableIncome || 0)],
                    ['YTD Income', fmtPKR(taxBreakdown.ytdIncome || 0)],
                    ['Projected Annual', fmtPKR(taxBreakdown.projectedAnnualIncome || 0)],
                    ['Annual Tax', fmtPKR(taxBreakdown.annualTax || 0)],
                    ['Monthly Tax', fmtPKR(taxBreakdown.monthlyTax || line.incomeTax || 0)],
                    ['Tax Paid YTD', fmtPKR(taxBreakdown.taxPaidYtd || 0)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between text-[11px] p-2 rounded" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                      <span style={{ color: '#6B7280' }}>{k}</span>
                      <span className="font-mono font-medium" style={{ color: '#1a1a2e' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sc">
              {!scBreakdown ? (
                <p className="text-xs text-center py-4" style={{ color: '#9CA3AF' }}>No SC breakdown data</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(scBreakdown).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[11px] p-2 rounded" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                      <span style={{ color: '#6B7280' }}>{k}</span>
                      <span className="font-mono font-medium" style={{ color: '#1a1a2e' }}>{typeof v === 'number' ? fmtPKR(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}

// ── Voucher List View ─────────────────────────────────────────

function VoucherListView({ vouchers, allVouchers, batches, projects, totals, search, statusFilter,
  batchFilter, projectFilter, processingAction, onSearch, onStatusFilter, onBatchFilter,
  onProjectFilter, onBack, onViewVoucher, onVoucherAction, onPostGL, onRefresh }: any) {

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4" style={{ color: '#6B7280' }} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: '#1a1a2e' }}>Salary Vouchers</h1>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>All salary vouchers generated from payroll batches</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRefresh}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
          <Input className="pl-9 h-8 text-xs" placeholder="Search vouchers, employees, projects..." value={search} onChange={e => onSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={onStatusFilter}>
            <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Status</SelectItem>
              {Object.entries(VOUCHER_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={batchFilter} onValueChange={onBatchFilter}>
            <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Batch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Batches</SelectItem>
              {batches.map((b: any) => (
                <SelectItem key={b.id} value={b.id} className="text-xs">{b.batchNumber} - {b.period}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={onProjectFilter}>
            <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Projects</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.code} - {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(statusFilter !== 'all' || batchFilter !== 'all' || projectFilter !== 'all' || search) && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => { onStatusFilter('all'); onBatchFilter('all'); onProjectFilter('all'); onSearch('') }}>
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between text-xs px-1" style={{ color: '#6B7280' }}>
        <span>Showing <strong>{vouchers.length}</strong> of <strong>{allVouchers.length}</strong> vouchers</span>
        <span>Total Dr: <strong style={{ color: '#1A7A4A', fontFamily: 'monospace' }}>{fmtPKR(totals.dr)}</strong> · Cr: <strong style={{ color: '#1A7A4A', fontFamily: 'monospace' }}>{fmtPKR(totals.cr)}</strong></span>
      </div>

      {/* Voucher Cards */}
      {vouchers.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#fff', border: '2px dashed #E5E7EB' }}>
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="text-sm font-medium" style={{ color: '#6B7280' }}>No vouchers found</p>
          <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Generate vouchers from an approved payroll batch</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vouchers.map((v: any) => (
            <VoucherCard
              key={v.id}
              voucher={v}
              processingAction={processingAction}
              onView={() => onViewVoucher(v)}
              onAction={(action: string) => onVoucherAction(action, v.id)}
              onPostGL={() => onPostGL(v)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Voucher Card ──────────────────────────────────────────────

function VoucherCard({ voucher: v, processingAction, onView, onAction, onPostGL }: any) {
  const isBalanced = Math.abs((v.totalDebit || 0) - (v.totalCredit || 0)) <= 1

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar name={v.employeeName} size={36} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold font-mono" style={{ color: '#1a1a2e' }}>{v.voucherNumber}</span>
                <StatusBadge status={v.status} map={VOUCHER_STATUS} />
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                {v.employeeName} · <span className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: '#EFF6FF', color: '#2563EB' }}>{v.projectCode}</span> {v.projectName} · {periodLabel(v.period)}
              </div>
            </div>
          </div>
          <div className="text-right">
            {isBalanced ? (
              <div className="flex items-center gap-1 text-[11px]" style={{ color: '#16A34A' }}>
                <CheckCircle className="w-3 h-3" /> Balanced
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px]" style={{ color: '#DC2626' }}>
                <AlertCircle className="w-3 h-3" /> Unbalanced
              </div>
            )}
            <div className="text-xs font-mono font-bold mt-0.5" style={{ color: '#1a1a2e' }}>Dr = Cr = {fmtPKR(v.totalDebit || 0)}</div>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-3">
          <WorkflowStepper steps={VOUCHER_STEPS} current={v.status} />
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Gross', value: fmtPKR(v.grossShare || 0), color: '#1A7A4A' },
            { label: 'Tax', value: fmtPKR(v.taxShare || 0), color: '#DC2626' },
            { label: 'Net', value: fmtPKR(v.netSalaryShare || 0), color: '#16A34A' },
            { label: 'SC', value: fmtPKR(v.scShare || 0), color: '#D97706' },
          ].map(item => (
            <div key={item.label} className="rounded-lg p-2 text-center" style={{ background: '#F9FAFB' }}>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: '#9CA3AF' }}>{item.label}</div>
              <div className="text-xs font-bold mt-0.5 font-mono" style={{ color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onView}>
            <Eye className="w-3 h-3 mr-1" /> View
          </Button>
          {v.status === 'draft' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAction('submit')}
              disabled={processingAction === 'submit' + v.id}>
              {processingAction === 'submit' + v.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
              Submit
            </Button>
          )}
          {v.status === 'submitted' && (
            <Button size="sm" className="h-7 text-xs" onClick={() => onAction('approve')} style={{ background: '#1A7A4A', color: '#fff' }}
              disabled={processingAction === 'approve' + v.id}>
              {processingAction === 'approve' + v.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
              Approve
            </Button>
          )}
          {v.status === 'approved' && (
            <Button size="sm" className="h-7 text-xs" onClick={onPostGL} style={{ background: '#7C3AED', color: '#fff' }}>
              <Send className="w-3 h-3 mr-1" /> Approve & Send to Vouchers
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => window.print()}>
            <Printer className="w-3 h-3 mr-1" /> Print
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Voucher Detail View ───────────────────────────────────────

function VoucherDetailView({ voucher: v, processingAction, onBack, onVoucherAction, onPostGL }: any) {
  const lines = v.lines || []
  const isBalanced = Math.abs((v.totalDebit || 0) - (v.totalCredit || 0)) <= 1
  const drLines = lines.filter((l: any) => l.debit > 0)
  const crLines = lines.filter((l: any) => l.credit > 0)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4" style={{ color: '#6B7280' }} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold font-mono" style={{ color: '#1a1a2e' }}>{v.voucherNumber}</h1>
            <StatusBadge status={v.status} map={VOUCHER_STATUS} />
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
            {v.employeeName} · {v.projectName} · {periodLabel(v.period)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.print()}>
            <Printer className="w-3 h-3 mr-1" /> Print
          </Button>
        </div>
      </div>

      {/* Voucher Document */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {/* Company Header */}
        <div className="p-5 border-b" style={{ borderColor: '#E5E7EB', background: '#F9FAFB' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-base font-bold" style={{ color: '#1a1a2e' }}>SALARY PAYMENT VOUCHER</div>
              <div className="text-xs mt-1" style={{ color: '#6B7280' }}>AcctFin ERP - Payroll Module</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono font-bold" style={{ color: '#1a1a2e' }}>{v.voucherNumber}</div>
              <div className="text-xs mt-1" style={{ color: '#6B7280' }}>
                {v.date ? new Date(v.date).toLocaleDateString('en-GB') : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b" style={{ borderColor: '#E5E7EB' }}>
          {[
            { label: 'Employee', value: v.employeeName },
            { label: 'Period', value: periodLabel(v.period) },
            { label: 'Project', value: `${v.projectCode} - ${v.projectName}` },
            { label: 'Allocation', value: `${v.allocationDays} days · ${Math.round((v.allocationWeight || 0) * 100)}%` },
          ].map((item, i) => (
            <div key={item.label} className="p-3" style={{ borderRight: i < 3 ? '1px solid #E5E7EB' : 'none' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9CA3AF' }}>{item.label}</div>
              <div className="text-xs font-medium mt-0.5" style={{ color: '#1a1a2e' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Journal Entries */}
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: '#6B7280' }}>Journal Entries</div>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ background: '#F9FAFB' }}>
                  <TableHead className="text-[10px] h-8 w-8">#</TableHead>
                  <TableHead className="text-[10px] h-8">Account Code</TableHead>
                  <TableHead className="text-[10px] h-8">Account Name</TableHead>
                  <TableHead className="text-[10px] h-8">Description</TableHead>
                  <TableHead className="text-[10px] h-8 text-right">Debit (Rs)</TableHead>
                  <TableHead className="text-[10px] h-8 text-right">Credit (Rs)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line: any) => (
                  <TableRow key={line.id} style={{ background: line.debit > 0 ? '#F0F9FF' : '#F0FDF4' }}>
                    <TableCell className="text-[11px] py-2 font-mono">{line.lineNumber}</TableCell>
                    <TableCell className="text-[11px] py-2 font-mono" style={{ color: '#6B7280' }}>{line.accountCode}</TableCell>
                    <TableCell className="text-[11px] py-2 font-medium" style={{ color: '#1a1a2e' }}>{line.accountName}</TableCell>
                    <TableCell className="text-[11px] py-2" style={{ color: '#6B7280' }}>{line.description}</TableCell>
                    <TableCell className="text-[11px] py-2 text-right font-mono" style={{ color: '#2563EB' }}>
                      {line.debit > 0 ? fmt(line.debit) : <span style={{ color: '#D1D5DB' }}>-</span>}
                    </TableCell>
                    <TableCell className="text-[11px] py-2 text-right font-mono" style={{ color: '#16A34A' }}>
                      {line.credit > 0 ? fmt(line.credit) : <span style={{ color: '#D1D5DB' }}>-</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals */}
                <TableRow style={{ background: '#F8FAFC', borderTop: '2px solid #E5E7EB' }}>
                  <TableCell colSpan={4} className="text-[11px] py-2 font-bold">TOTAL</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono font-bold" style={{ color: '#2563EB' }}>{fmt(v.totalDebit || 0)}</TableCell>
                  <TableCell className="text-[11px] py-2 text-right font-mono font-bold" style={{ color: '#16A34A' }}>{fmt(v.totalCredit || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Balance indicator */}
          <div className="mt-3 flex items-center gap-2">
            {isBalanced ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                <CheckCircle className="w-3.5 h-3.5" />
                Voucher is balanced - Dr = Cr = {fmtPKR(v.totalDebit || 0)}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                <AlertCircle className="w-3.5 h-3.5" />
                UNBALANCED - Dr: {fmtPKR(v.totalDebit || 0)} ≠ Cr: {fmtPKR(v.totalCredit || 0)} · Diff: {fmtPKR(Math.abs((v.totalDebit || 0) - (v.totalCredit || 0)))}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 border-t" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: '#6B7280' }}>Summary</div>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E5E7EB', maxWidth: 400 }}>
            {[
              { label: 'Gross Salary', value: fmtPKR(v.grossShare || 0), color: '#1a1a2e' },
              { label: 'Less: Income Tax', value: `(${fmtPKR(v.taxShare || 0)})`, color: '#DC2626' },
              { label: 'Less: EOBI', value: `(${fmtPKR(v.eobiShare || 0)})`, color: '#DC2626' },
              { label: 'Less: PF', value: `(${fmtPKR(v.pfShare || 0)})`, color: '#DC2626' },
              { label: 'Less: ESSI', value: `(${fmtPKR(v.essiShare || 0)})`, color: '#DC2626' },
              { label: 'Less: Loan Recovery', value: `(${fmtPKR(v.loanShare || 0)})`, color: '#DC2626' },
              { label: 'Net Salary Payable', value: fmtPKR(v.netSalaryShare || 0), color: '#16A34A', bold: true },
              { label: 'SC (Employer)', value: fmtPKR(v.scShare || 0), color: '#D97706' },
              { label: 'Grand Total Cost', value: fmtPKR((v.totalDebit || 0)), color: '#1a1a2e', bold: true },
            ].filter(item => {
              const num = parseFloat(item.value.replace(/[^0-9.-]/g, ''))
              return !isNaN(num) && num !== 0
            }).map((item, i, arr) => (
              <div key={item.label} className="flex justify-between px-3 py-1.5 text-[11px]"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none', fontWeight: item.bold ? 700 : 400 }}>
                <span style={{ color: '#6B7280' }}>{item.label}</span>
                <span className="font-mono" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow */}
        <div className="p-4 border-t" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: '#6B7280' }}>Workflow Status</div>
          <WorkflowStepper steps={VOUCHER_STEPS} current={v.status} />

          <div className="flex items-center gap-2 mt-4">
            {v.status === 'draft' && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onVoucherAction('submit', v.id)}
                disabled={processingAction === 'submit' + v.id}>
                {processingAction === 'submit' + v.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                Submit for Approval
              </Button>
            )}
            {v.status === 'submitted' && (
              <Button size="sm" className="h-8 text-xs" onClick={() => onVoucherAction('approve', v.id)} style={{ background: '#1A7A4A', color: '#fff' }}
                disabled={processingAction === 'approve' + v.id}>
                {processingAction === 'approve' + v.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
                Approve Voucher
              </Button>
            )}
            {v.status === 'approved' && (
              <Button size="sm" className="h-8 text-xs" onClick={() => onPostGL(v)} style={{ background: '#7C3AED', color: '#fff' }}>
                <Send className="w-3 h-3 mr-1" /> Approve & Send to Vouchers
              </Button>
            )}
            {v.status === 'posted' && (
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                <CheckCircle className="w-3.5 h-3.5" />
                Sent to Voucher Management on {v.postedAt ? new Date(v.postedAt).toLocaleDateString() : '-'} - find it in Voucher Management as a draft JV
              </div>
            )}
          </div>
        </div>

        {/* Signatures */}
        <div className="p-4 border-t" style={{ borderColor: '#E5E7EB' }}>
          <div className="grid grid-cols-3 gap-6">
            {['Prepared By', 'Checked By', 'Approved By'].map(role => (
              <div key={role} className="text-center">
                <div className="h-10 border-b mb-2" style={{ borderColor: '#D1D5DB' }} />
                <div className="text-[10px]" style={{ color: '#9CA3AF' }}>{role}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Approve & Send to Vouchers Modal ─────────────────────────

function ApproveAndSendModal({ voucher: v, open, onClose, onConfirm, processing }: any) {
  const lines = v?.lines || []
  const isBalanced = v ? Math.abs((v.totalDebit || 0) - (v.totalCredit || 0)) <= 1 : false

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Send className="w-4 h-4" style={{ color: '#7C3AED' }} />
            Approve & Send to Voucher Management
          </DialogTitle>
          <DialogDescription className="text-xs">
            This will approve the salary voucher and create a draft Journal Voucher in Voucher Management for final GL posting.
          </DialogDescription>
        </DialogHeader>

        {v && (
          <div className="space-y-3 py-2">
            <div className="rounded-lg p-3 space-y-1.5" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              {[
                ['Voucher', v.voucherNumber],
                ['Employee', v.employeeName],
                ['Project', `${v.projectCode} - ${v.projectName}`],
                ['Period', v.period],
                ['Total Dr', `Rs ${new Intl.NumberFormat('en-PK').format(v.totalDebit || 0)}`],
                ['Total Cr', `Rs ${new Intl.NumberFormat('en-PK').format(v.totalCredit || 0)}`],
              ].map(([k, val]) => (
                <div key={k as string} className="flex justify-between text-xs">
                  <span style={{ color: '#6B7280' }}>{k}</span>
                  <span className="font-medium font-mono" style={{ color: '#1a1a2e' }}>{val}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs">
                <span style={{ color: '#6B7280' }}>Balance</span>
                {isBalanced ? (
                  <span className="flex items-center gap-1" style={{ color: '#16A34A' }}><CheckCircle className="w-3 h-3" /> Balanced</span>
                ) : (
                  <span className="flex items-center gap-1" style={{ color: '#DC2626' }}><AlertCircle className="w-3 h-3" /> Unbalanced</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>Journal entries:</div>
              <div className="space-y-1">
                {lines.map((l: any) => (
                  <div key={l.id} className="flex justify-between text-[11px] font-mono">
                    <span style={{ color: l.debit > 0 ? '#2563EB' : '#16A34A' }}>
                      {l.debit > 0 ? 'Dr' : 'Cr'} {l.accountCode} {l.accountName}
                    </span>
                    <span style={{ color: l.debit > 0 ? '#2563EB' : '#16A34A' }}>
                      Rs {new Intl.NumberFormat('en-PK').format(l.debit > 0 ? l.debit : l.credit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#14532D' }}>
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> What happens next:
              </div>
              <div>1. Salary voucher status → <strong>Approved</strong></div>
              <div>2. Draft JV created in <strong>Voucher Management</strong></div>
              <div>3. Finance team reviews and posts to GL from there</div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onConfirm} disabled={processing || !isBalanced} style={{ background: '#7C3AED', color: '#fff' }}>
            {processing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
            Approve & Send to Vouchers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Create Vouchers Modal ─────────────────────────────────────

type PaymentMode = 'PROJECT' | 'EMPLOYEE' | 'COMBINED'

function CreateVouchersModal({ batch, projects, onClose, onSuccess }: {
  batch: any; projects: any[]; onClose: () => void; onSuccess: (count: number) => void
}) {
  const { toast } = useToast()
  const [mode, setMode] = useState<PaymentMode>('PROJECT')
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set())
  const [projectSearch, setProjectSearch] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [existingVouchers, setExistingVouchers] = useState<any[]>([])

  const lines = batch.lines || []
  const approvedLines = lines.filter((l: any) => l.lineStatus === 'approved' || l.lineStatus === 'voucher-created')

  // Fetch existing vouchers for this period to detect already-paid employees
  useEffect(() => {
    fetch(`/api/salary-vouchers?period=${batch.period}`)
      .then(r => r.json())
      .then(d => setExistingVouchers(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [batch.period])

  // Map: employeeId+projectId → voucher status (for paid detection)
  const paidMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const sv of existingVouchers) {
      if (sv.status !== 'cancelled' && sv.status !== 'reversed') {
        map.set(`${sv.employeeId}|${sv.projectId}`, sv.status)
      }
    }
    return map
  }, [existingVouchers])

  // Build project list from batch lines
  const projectList = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string; employeeCount: number; totalDays: number; totalGross: number; weight: number }>()
    for (const line of approvedLines) {
      let allocs: any[] = []
      try { allocs = line.projectAllocations ? JSON.parse(line.projectAllocations) : [] } catch {}
      let contracts: any[] = []
      try { contracts = line.contractEarnings ? JSON.parse(line.contractEarnings) : [] } catch {}

      const items = allocs.length > 0 ? allocs : contracts.length > 0 ? contracts.map((c: any) => ({
        projectId: c.projectId, projectCode: c.projectCode, projectName: c.projectName,
        days: c.daysWorked || 0, weight: 0, salaryShare: c.earnedSalary || 0, scShare: c.scShare || 0,
      })) : line.projectId ? [{ projectId: line.projectId, projectCode: '', projectName: '', days: line.payableDays || 0, weight: 1, salaryShare: line.grossSalary, scShare: line.socialCharges }] : []

      for (const a of items) {
        if (!a.projectId) continue
        const proj = projects.find((p: any) => p.id === a.projectId)
        if (!map.has(a.projectId)) {
          map.set(a.projectId, {
            id: a.projectId,
            code: proj?.code || a.projectCode || a.projectId.slice(0, 6),
            name: proj?.name || a.projectName || 'Unknown',
            employeeCount: 0, totalDays: 0, totalGross: 0, weight: 0,
          })
        }
        const entry = map.get(a.projectId)!
        entry.employeeCount++
        entry.totalDays += a.days || 0
        entry.totalGross += a.salaryShare || 0
      }
    }
    const totalGross = Array.from(map.values()).reduce((s, p) => s + p.totalGross, 0)
    for (const p of map.values()) p.weight = totalGross > 0 ? p.totalGross / totalGross : 0
    return Array.from(map.values()).sort((a, b) => b.totalGross - a.totalGross)
  }, [approvedLines, projects])

  // Build employee list
  const employeeList = useMemo(() => {
    return approvedLines.map((line: any) => {
      let allocs: any[] = []
      try { allocs = line.projectAllocations ? JSON.parse(line.projectAllocations) : [] } catch {}
      const projectCodes = allocs.filter((a: any) => a.days > 0).map((a: any) => a.projectCode).join(' / ')
      return {
        id: line.employeeId,
        name: line.employeeName,
        code: line.employeeCode || '',
        grossSalary: line.grossSalary,
        projectCodes,
      }
    }).filter((e: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === e.id) === i)
  }, [approvedLines])

  // Live preview
  const preview = useMemo(() => {
    const rows: Array<{ employeeId: string; employeeName: string; projectId: string; projectCode: string; projectName: string; gross: number; tax: number; net: number; sc: number; alreadyPaid: boolean; existingStatus: string }> = []

    for (const line of approvedLines) {
      if (mode === 'EMPLOYEE' && selectedEmployeeIds.size > 0 && !selectedEmployeeIds.has(line.employeeId)) continue
      if (mode === 'COMBINED' && selectedEmployeeIds.size > 0 && !selectedEmployeeIds.has(line.employeeId)) continue

      let allocs: any[] = []
      try { allocs = line.projectAllocations ? JSON.parse(line.projectAllocations) : [] } catch {}
      let contracts: any[] = []
      try { contracts = line.contractEarnings ? JSON.parse(line.contractEarnings) : [] } catch {}

      const items = allocs.length > 0 ? allocs : contracts.length > 0 ? contracts.map((c: any) => ({
        projectId: c.projectId, projectCode: c.projectCode, projectName: c.projectName,
        days: c.daysWorked || 0, weight: 0, salaryShare: c.earnedSalary || 0, scShare: c.scShare || 0,
      })) : line.projectId ? [{ projectId: line.projectId, projectCode: '', projectName: '', days: line.payableDays || 0, weight: 1, salaryShare: line.grossSalary, scShare: line.socialCharges }] : []

      const totalWeight = items.reduce((s: number, a: any) => s + (a.weight || 0), 0)

      for (const a of items) {
        if (!a.projectId || (a.days || 0) === 0) continue
        if (mode === 'PROJECT' && selectedProjectIds.size > 0 && !selectedProjectIds.has(a.projectId)) continue
        if (mode === 'COMBINED' && selectedProjectIds.size > 0 && !selectedProjectIds.has(a.projectId)) continue

        const w = totalWeight > 0 ? (a.weight || 0) / totalWeight : 1
        const gross = Math.round(a.salaryShare || 0)
        const tax = Math.round(line.incomeTax * w)
        const sc = Math.round(a.scShare || 0)
        const net = gross - tax

        const existingStatus = paidMap.get(`${line.employeeId}|${a.projectId}`) || ''
        const alreadyPaid = existingStatus === 'posted'

        rows.push({
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          projectId: a.projectId,
          projectCode: a.projectCode || '',
          projectName: a.projectName || '',
          gross, tax, net, sc,
          alreadyPaid,
          existingStatus,
        })
      }
    }

    const newRows = rows.filter(r => !r.alreadyPaid)
    const paidRows = rows.filter(r => r.alreadyPaid)
    const totals = newRows.reduce((acc, r) => ({
      gross: acc.gross + r.gross, tax: acc.tax + r.tax, net: acc.net + r.net, sc: acc.sc + r.sc,
    }), { gross: 0, tax: 0, net: 0, sc: 0 })

    return { rows: newRows, paidRows, totals }
  }, [approvedLines, mode, selectedProjectIds, selectedEmployeeIds, paidMap])

  const canGenerate = preview.rows.length > 0

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const body: any = {
        action: 'generate',
        batchId: batch.id,
        mode,
        createdBy: 'system',
      }
      if (mode === 'PROJECT' || mode === 'COMBINED') body.projectIds = Array.from(selectedProjectIds)
      if (mode === 'EMPLOYEE' || mode === 'COMBINED') body.employeeIds = Array.from(selectedEmployeeIds)

      const res = await fetch('/api/salary-vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResult(data)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const filteredProjects = projectList.filter(p =>
    !projectSearch || p.code.toLowerCase().includes(projectSearch.toLowerCase()) || p.name.toLowerCase().includes(projectSearch.toLowerCase())
  )
  const filteredEmployees = employeeList.filter((e: any) =>
    !employeeSearch || e.name.toLowerCase().includes(employeeSearch.toLowerCase()) || e.code.toLowerCase().includes(employeeSearch.toLowerCase())
  )

  const showProjects = mode === 'PROJECT' || mode === 'COMBINED'
  const showEmployees = mode === 'EMPLOYEE' || mode === 'COMBINED'

  // Success screen
  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="rounded-2xl w-full max-w-lg p-6 space-y-4" style={{ background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#F0FDF4' }}>
              <CheckCircle className="w-7 h-7" style={{ color: '#16A34A' }} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: '#1a1a2e' }}>{result.created} Voucher{result.created !== 1 ? 's' : ''} Created</h2>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{result.message}</p>
          </div>

          {result.errorList?.length > 0 && (
            <div className="rounded-lg p-3 space-y-1" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <div className="text-xs font-semibold" style={{ color: '#DC2626' }}>Errors ({result.errorList.length})</div>
              {result.errorList.map((e: any, i: number) => (
                <div key={i} className="text-[11px]" style={{ color: '#B91C1C' }}>• {e.employeeName} / {e.projectCode}: {e.message}</div>
              ))}
            </div>
          )}

          {result.skippedList?.length > 0 && (
            <div className="rounded-lg p-3 space-y-1" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <div className="text-xs font-semibold" style={{ color: '#D97706' }}>Skipped ({result.skippedList.length})</div>
              {result.skippedList.map((s: any, i: number) => (
                <div key={i} className="text-[11px]" style={{ color: '#92400E' }}>• {s.employeeName}: {s.reason}</div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button className="flex-1 h-9 text-sm" onClick={() => onSuccess(result.created)} style={{ background: '#1A7A4A', color: '#fff' }}>
              <Eye className="w-4 h-4 mr-2" /> View Vouchers
            </Button>
            <Button variant="outline" className="h-9 text-sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" style={{ background: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#1a1a2e' }}>Create Salary Vouchers</h2>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
              Batch: {batch.name || batch.batchNumber} · {approvedLines.length} approved line{approvedLines.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" style={{ color: '#6B7280' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Step 1: Mode Selection */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: '#6B7280' }}>
              Step 1 - Select Payment Mode
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'PROJECT', icon: Building2, title: 'By Project', desc: 'Select projects - pay all their employees' },
                { key: 'EMPLOYEE', icon: Users, title: 'By Employee', desc: 'Select employees - pay all their projects' },
                { key: 'COMBINED', icon: Target, title: 'Combined', desc: 'Select specific employees within specific projects' },
              ] as const).map(({ key, icon: Icon, title, desc }) => (
                <button key={key} onClick={() => setMode(key)}
                  className="rounded-xl p-4 text-left transition-all border-2"
                  style={{
                    borderColor: mode === key ? '#1A7A4A' : '#E5E7EB',
                    background: mode === key ? '#F0FDF4' : '#fff',
                  }}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-5 h-5" style={{ color: mode === key ? '#1A7A4A' : '#9CA3AF' }} />
                    {mode === key && <CheckCircle className="w-4 h-4" style={{ color: '#1A7A4A' }} />}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: mode === key ? '#1A7A4A' : '#1a1a2e' }}>{title}</div>
                  <div className="text-[11px] mt-1" style={{ color: '#6B7280' }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Step 2: Projects */}
            {showProjects && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>
                    Step 2 - Select Projects
                  </div>
                  <button className="text-[11px]" style={{ color: '#1A7A4A' }}
                    onClick={() => setSelectedProjectIds(
                      selectedProjectIds.size === projectList.length ? new Set() : new Set(projectList.map(p => p.id))
                    )}>
                    {selectedProjectIds.size === projectList.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: '#9CA3AF' }} />
                  <Input className="pl-7 h-7 text-xs" placeholder="Search projects..." value={projectSearch} onChange={e => setProjectSearch(e.target.value)} />
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB', maxHeight: 280, overflowY: 'auto' }}>
                  {filteredProjects.length === 0 ? (
                    <div className="p-4 text-center text-xs" style={{ color: '#9CA3AF' }}>No projects found</div>
                  ) : filteredProjects.map((p, i) => {
                    const selected = selectedProjectIds.has(p.id)
                    const hasAlloc = p.totalDays > 0
                    return (
                      <div key={p.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${!hasAlloc ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                        style={{ borderBottom: i < filteredProjects.length - 1 ? '1px solid #F3F4F6' : 'none', background: selected ? '#F0FDF4' : 'transparent' }}
                        onClick={() => {
                          if (!hasAlloc) return
                          const next = new Set(selectedProjectIds)
                          if (next.has(p.id)) next.delete(p.id); else next.add(p.id)
                          setSelectedProjectIds(next)
                        }}>
                        <Checkbox checked={selected} disabled={!hasAlloc} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold" style={{ background: '#EFF6FF', color: '#2563EB' }}>{p.code}</span>
                            <span className="text-xs font-medium truncate" style={{ color: '#1a1a2e' }}>{p.name}</span>
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>
                            {p.employeeCount} emp · {p.totalDays} days
                            {!hasAlloc && ' · No allocation'}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-mono font-semibold" style={{ color: '#1A7A4A' }}>{fmtPKR(p.totalGross)}</div>
                          <div className="text-[10px]" style={{ color: '#9CA3AF' }}>{Math.round(p.weight * 100)}%</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Employees */}
            {showEmployees && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>
                    {showProjects ? 'Step 3' : 'Step 2'} - Select Employees
                  </div>
                  <button className="text-[11px]" style={{ color: '#1A7A4A' }}
                    onClick={() => setSelectedEmployeeIds(
                      selectedEmployeeIds.size === employeeList.length ? new Set() : new Set(employeeList.map((e: any) => e.id))
                    )}>
                    {selectedEmployeeIds.size === employeeList.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: '#9CA3AF' }} />
                  <Input className="pl-7 h-7 text-xs" placeholder="Search employees..." value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} />
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB', maxHeight: 280, overflowY: 'auto' }}>
                  {filteredEmployees.length === 0 ? (
                    <div className="p-4 text-center text-xs" style={{ color: '#9CA3AF' }}>No employees found</div>
                  ) : filteredEmployees.map((e: any, i: number) => {
                    const selected = selectedEmployeeIds.has(e.id)
                    return (
                      <div key={e.id}
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        style={{ borderBottom: i < filteredEmployees.length - 1 ? '1px solid #F3F4F6' : 'none', background: selected ? '#F0FDF4' : 'transparent' }}
                        onClick={() => {
                          const next = new Set(selectedEmployeeIds)
                          if (next.has(e.id)) next.delete(e.id); else next.add(e.id)
                          setSelectedEmployeeIds(next)
                        }}>
                        <Checkbox checked={selected} className="flex-shrink-0" />
                        <Avatar name={e.name} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{e.name}</span>
                            <span className="text-[10px] font-mono px-1 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#6B7280' }}>{e.code}</span>
                          </div>
                          <div className="text-[10px] mt-0.5 truncate" style={{ color: '#9CA3AF' }}>{e.projectCodes || 'No projects'}</div>
                        </div>
                        <div className="text-xs font-mono font-semibold flex-shrink-0" style={{ color: '#1A7A4A' }}>{fmtPKR(e.grossSalary)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: '#6B7280' }}>
              Live Preview - {preview.rows.length} voucher{preview.rows.length !== 1 ? 's' : ''} to generate
              {preview.paidRows.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  {preview.paidRows.length} already paid - will be skipped
                </span>
              )}
            </div>

            {/* Already Paid Warning */}
            {preview.paidRows.length > 0 && (
              <div className="rounded-lg p-3 mb-3 space-y-1" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#DC2626' }}>
                  <AlertCircle className="w-3.5 h-3.5" />
                  Already Paid - These will be skipped (salary voucher already sent to GL)
                </div>
                {preview.paidRows.map((row: any, i: number) => (
                  <div key={i} className="text-[11px] flex items-center gap-2" style={{ color: '#B91C1C' }}>
                    <span>•</span>
                    <span className="font-medium">{row.employeeName}</span>
                    <span className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: '#FEE2E2', color: '#DC2626' }}>{row.projectCode}</span>
                    <span style={{ color: '#9CA3AF' }}>- {fmtPKR(row.gross)}</span>
                  </div>
                ))}
              </div>
            )}

            {preview.rows.length === 0 && preview.paidRows.length === 0 ? (
              <div className="rounded-xl p-6 text-center" style={{ background: '#F9FAFB', border: '1px dashed #E5E7EB' }}>
                <Info className="w-6 h-6 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                <p className="text-xs" style={{ color: '#9CA3AF' }}>
                  {mode === 'PROJECT' ? 'Select at least one project to preview' :
                   mode === 'EMPLOYEE' ? 'Select at least one employee to preview' :
                   'Select projects and employees to preview'}
                </p>
              </div>
            ) : preview.rows.length === 0 && preview.paidRows.length > 0 ? (
              <div className="rounded-xl p-6 text-center" style={{ background: '#FEF2F2', border: '1px dashed #FECACA' }}>
                <CheckCircle className="w-6 h-6 mx-auto mb-2" style={{ color: '#DC2626' }} />
                <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>All selected employees are already paid for this period</p>
                <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>No new vouchers can be generated</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ background: '#F9FAFB' }}>
                      {['Employee', 'Project', 'Gross', 'Tax', 'Net', 'SC'].map(h => (
                        <TableHead key={h} className="text-[10px] h-7 font-semibold uppercase tracking-wide">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-[11px] py-1.5 font-medium">{row.employeeName}</TableCell>
                        <TableCell className="text-[11px] py-1.5">
                          <span className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: '#EFF6FF', color: '#2563EB' }}>{row.projectCode}</span>
                        </TableCell>
                        <TableCell className="text-[11px] py-1.5 font-mono" style={{ color: '#1A7A4A' }}>{fmt(row.gross)}</TableCell>
                        <TableCell className="text-[11px] py-1.5 font-mono" style={{ color: '#DC2626' }}>{fmt(row.tax)}</TableCell>
                        <TableCell className="text-[11px] py-1.5 font-mono" style={{ color: '#16A34A' }}>{fmt(row.net)}</TableCell>
                        <TableCell className="text-[11px] py-1.5 font-mono" style={{ color: '#D97706' }}>{fmt(row.sc)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow style={{ background: '#F9FAFB', fontWeight: 700, borderTop: '2px solid #E5E7EB' }}>
                      <TableCell className="text-[11px] py-1.5 font-bold" colSpan={2}>TOTAL</TableCell>
                      <TableCell className="text-[11px] py-1.5 font-mono font-bold" style={{ color: '#1A7A4A' }}>{fmt(preview.totals.gross)}</TableCell>
                      <TableCell className="text-[11px] py-1.5 font-mono font-bold" style={{ color: '#DC2626' }}>{fmt(preview.totals.tax)}</TableCell>
                      <TableCell className="text-[11px] py-1.5 font-mono font-bold" style={{ color: '#16A34A' }}>{fmt(preview.totals.net)}</TableCell>
                      <TableCell className="text-[11px] py-1.5 font-mono font-bold" style={{ color: '#D97706' }}>{fmt(preview.totals.sc)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t" style={{ borderColor: '#E5E7EB' }}>
          <div className="text-xs" style={{ color: '#6B7280' }}>
            {canGenerate ? (
              <span className="flex items-center gap-1" style={{ color: '#16A34A' }}>
                <CheckCircle className="w-3.5 h-3.5" />
                {preview.rows.length} voucher{preview.rows.length !== 1 ? 's' : ''} ready · Dr = Cr guaranteed
              </span>
            ) : (
              <span className="flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                <Info className="w-3.5 h-3.5" />
                Select {mode === 'PROJECT' ? 'projects' : mode === 'EMPLOYEE' ? 'employees' : 'projects and employees'} to continue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleGenerate} disabled={!canGenerate || generating}
              style={{ background: canGenerate ? '#1A7A4A' : '#D1D5DB', color: '#fff' }}>
              {generating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileText className="w-3 h-3 mr-1" />}
              {generating ? 'Generating...' : `Generate ${preview.rows.length > 0 ? preview.rows.length : ''} Voucher${preview.rows.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
