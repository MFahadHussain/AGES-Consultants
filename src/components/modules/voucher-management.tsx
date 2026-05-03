'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, Eye, XCircle, Printer, Copy, CheckCircle2, Pencil, Trash2, CopyPlus,
  Filter, X, Upload, Download, FileText, FileImage, FileSpreadsheet, File,
  ChevronDown, ChevronUp, Clock, Shield, AlertTriangle, Paperclip, Lock, RotateCcw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { numberToWords } from '@/lib/number-to-words'
import { AccountCombobox, type AccountOption } from '@/components/ui/account-combobox'

const voucherTypes = [
  { value: 'BP', label: 'Bank Payment', color: 'bg-red-100 text-red-800' },
  { value: 'CP', label: 'Cash Payment', color: 'bg-orange-100 text-orange-800' },
  { value: 'BR', label: 'Bank Receipt', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'CR', label: 'Cash Receipt', color: 'bg-green-100 text-green-800' },
  { value: 'JV', label: 'Journal Voucher', color: 'bg-blue-100 text-blue-800' },
  { value: 'BILL', label: 'Bill', color: 'bg-purple-100 text-purple-800' },
]

const statusConfig: Record<string, { color: string; label: string; icon: any; step: number }> = {
  draft: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Draft', icon: Pencil, step: 1 },
  pending: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Pending', icon: Clock, step: 2 },
  approved: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Approved', icon: CheckCircle2, step: 3 },
  posted: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Posted', icon: Lock, step: 4 },
  rejected: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Rejected', icon: XCircle, step: 0 },
}

const roleLabels: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', accountant: 'Accountant', auditor: 'Auditor', viewer: 'Viewer'
}

// Role-based workflow permissions
const ROLE_PERMISSIONS: Record<string, string[]> = {
  submit: ['admin', 'manager', 'accountant'],
  approve: ['admin', 'manager'],
  post: ['admin'],
  reject: ['admin', 'manager'],
  quick_post: ['admin'],
  edit: ['admin', 'manager', 'accountant'],
  revoke: ['admin'],
  delete: ['admin', 'manager', 'accountant'],
}

function hasPermission(action: string, role: string): boolean {
  return ROLE_PERMISSIONS[action]?.includes(role) ?? false
}

// Role colors for the selector badge
const roleColors: Record<string, string> = {
  admin: 'bg-rose-100 text-rose-800 border-rose-200',
  manager: 'bg-amber-100 text-amber-800 border-amber-200',
  accountant: 'bg-sky-100 text-sky-800 border-sky-200',
  auditor: 'bg-violet-100 text-violet-800 border-violet-200',
  viewer: 'bg-gray-100 text-gray-800 border-gray-200',
}

// Which role is needed for each workflow step
const stepRoles: Record<string, string> = {
  draft: 'Accountant creates',
  pending: 'Manager reviews',
  approved: 'Admin posts',
  posted: 'Locked',
}

const categoryColors: Record<string, string> = {
  invoice: 'bg-blue-100 text-blue-800',
  receipt: 'bg-green-100 text-green-800',
  contract: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function FileIcon({ mimeType }: { mimeType?: string | null }) {
  if (!mimeType) return <File className="h-4 w-4" />
  if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500" />
  if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('xls')) return <FileSpreadsheet className="h-4 w-4 text-green-500" />
  if (mimeType.includes('word') || mimeType.includes('doc')) return <FileText className="h-4 w-4 text-indigo-500" />
  return <File className="h-4 w-4 text-gray-500" />
}

// Workflow Step Indicator with Role Labels
function WorkflowSteps({ currentStatus, currentRole }: { currentStatus: string; currentRole?: string }) {
  const steps = ['draft', 'pending', 'approved', 'posted']
  const currentStep = statusConfig[currentStatus]?.step || 0
  const isRejected = currentStatus === 'rejected'

  // Determine which step the current role can act on
  const canActOnStep = (step: string): boolean => {
    if (!currentRole) return false
    if (step === 'draft' && hasPermission('submit', currentRole)) return true
    if (step === 'pending' && hasPermission('approve', currentRole)) return true
    if (step === 'approved' && hasPermission('post', currentRole)) return true
    return false
  }
  const nextActionableStep = steps.find((step, i) => {
    const stepNum = i + 1
    return stepNum === currentStep && canActOnStep(step)
  })

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const config = statusConfig[step]
          const isCompleted = currentStep > i + 1 || (currentStatus === 'posted' && i < 3)
          const isCurrent = currentStep === i + 1
          const isRejectedStep = isRejected
          const isActionable = step === nextActionableStep
          return (
            <div key={step} className="flex items-center gap-1">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                isCompleted ? 'bg-emerald-100 text-emerald-800' :
                isCurrent && isActionable && !isRejectedStep ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-400' :
                isCurrent && !isRejectedStep ? config.color :
                'bg-gray-100 text-gray-400'
              }`}>
                {isCompleted ? <CheckCircle2 className="h-2.5 w-2.5" /> : isActionable ? <Shield className="h-2.5 w-2.5" /> : <span className="h-2.5 w-2.5 rounded-full border flex items-center justify-center text-[7px]">{i + 1}</span>}
                <span className="hidden sm:inline">{config.label}</span>
              </div>
              {i < 3 && <div className={`h-px w-3 ${isCompleted ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
            </div>
          )
        })}
        {isRejected && <Badge className="text-[9px] bg-red-100 text-red-800 ml-1">Rejected</Badge>}
      </div>
      <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
        {steps.map((step, i) => (
          <span key={step} className="flex items-center gap-1">
            <span className={`px-1.5 py-0 rounded ${
              currentStep === i + 1 && !isRejected ? 'font-semibold text-foreground' : '',
              step === nextActionableStep ? 'text-amber-700 font-semibold' : ''
            }`}>{stepRoles[step]}</span>
            {i < 3 && <span className="w-3" />}
          </span>
        ))}
      </div>
    </div>
  )
}

interface Voucher {
  id: string
  voucherNumber: string
  voucherType: string
  voucherTypeName: string
  date: string
  narration: string
  reference: string | null
  payeeName: string | null
  chequeNumber: string | null
  chequeDate: string | null
  voucherNo: string | null
  amountInWords: string | null
  status: string
  totalDebit: number
  totalCredit: number
  isPayrollPosted: boolean
  isAssetPosted: boolean
  project?: { name: string } | null
  donor?: { name: string } | null
  location?: { name: string } | null
  client?: { name: string } | null
  _count?: { entries: number; attachments: number }
}
type Account = AccountOption

const defaultForm = {
  voucherType: 'BP',
  date: new Date().toISOString().split('T')[0],
  narration: '',
  reference: '',
  payeeName: '',
  chequeNumber: '',
  chequeDate: '',
  voucherNo: '',
  amountInWords: '',
  financialYearId: '',
  projectId: '',
  donorId: '',
  donorName: '',
  locationId: '',
  clientId: '',
  autoPost: true as boolean,
  entries: [{ accountId: '', debit: 0, credit: 0, description: '' }] as { accountId: string; debit: number; credit: number; description: string }[],
}

export function VoucherManagement() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [donors, setDonors] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const { toast } = useToast()

  // Advanced Search / Filter State
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advFilters, setAdvFilters] = useState({
    partyName: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '',
    projectId: '', donorId: '', locationId: '', clientId: '',
  })
  const activeFilterCount = Object.values(advFilters).filter(v => v).length + (typeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (search ? 1 : 0)

  // Dialog states
  const [detailVoucher, setDetailVoucher] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editVoucherId, setEditVoucherId] = useState<string | null>(null)
  const [printVoucher, setPrintVoucher] = useState<any>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [deleteVoucherId, setDeleteVoucherId] = useState<string | null>(null)
  const [deleteVoucherNumber, setDeleteVoucherNumber] = useState<string>('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Reject dialog
  const [rejectVoucherId, setRejectVoucherId] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectComments, setRejectComments] = useState('')

  // Attachment states
  // Current role for workflow simulation
  const [currentRole, setCurrentRole] = useState<string>('admin')

  // Attachment states
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [attachmentCategory, setAttachmentCategory] = useState('other')

  const [form, setForm] = useState({ ...defaultForm, entries: [{ accountId: '', debit: 0, credit: 0, description: '' }] })
  const totalDebit = form.entries.reduce((s, e) => s + (e.debit || 0), 0)
  const totalCredit = form.entries.reduce((s, e) => s + (e.credit || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01
  const autoAmountInWords = totalDebit > 0 ? numberToWords(totalDebit) : ''

  // Refs for fetch
  const searchRef = useRef(search)
  const typeFilterRef = useRef(typeFilter)
  const statusFilterRef = useRef(statusFilter)
  const advFiltersRef = useRef(advFilters)
  const pageRef = useRef(page)
  useEffect(() => { searchRef.current = search }, [search])
  useEffect(() => { typeFilterRef.current = typeFilter }, [typeFilter])
  useEffect(() => { statusFilterRef.current = statusFilter }, [statusFilter])
  useEffect(() => { advFiltersRef.current = advFilters }, [advFilters])
  useEffect(() => { pageRef.current = page }, [page])

  const fetchData = useCallback(async (overrideSearch?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const s = overrideSearch !== undefined ? overrideSearch : searchRef.current
      const tf = typeFilterRef.current
      const sf = statusFilterRef.current
      const af = advFiltersRef.current
      const p = pageRef.current
      if (s) params.set('search', s)
      if (tf !== 'all') params.set('voucherType', tf)
      if (sf !== 'all') params.set('status', sf)
      if (af.partyName) params.set('partyName', af.partyName)
      if (af.dateFrom) params.set('dateFrom', af.dateFrom)
      if (af.dateTo) params.set('dateTo', af.dateTo)
      if (af.amountMin) params.set('amountMin', af.amountMin)
      if (af.amountMax) params.set('amountMax', af.amountMax)
      if (af.projectId) params.set('projectId', af.projectId)
      if (af.donorId) params.set('donorId', af.donorId)
      if (af.locationId) params.set('locationId', af.locationId)
      if (af.clientId) params.set('clientId', af.clientId)
      params.set('page', String(p))
      params.set('limit', '20')
      const res = await fetch(`/api/vouchers?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setVouchers(data.data || [])
      setTotal(data.total || 0)
    } catch {
      toast({ title: 'Error', description: 'Failed to load vouchers', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchReferenceData = useCallback(async () => {
    try {
      const [accRes, projRes, donorRes, locRes, clientRes] = await Promise.all([
        fetch('/api/accounts?isActive=true'),
        fetch('/api/projects'),
        fetch('/api/donors'),
        fetch('/api/locations'),
        fetch('/api/clients'),
      ])
      setAccounts(await accRes.json())
      setProjects(await projRes.json())
      setDonors(await donorRes.json())
      setLocations(await locRes.json())
      setClients(await clientRes.json())
    } catch {
      console.error('Failed to load reference data')
    }
  }, [])

  useEffect(() => { fetchData() }, [page, typeFilter, statusFilter, advFilters, fetchData])
  useEffect(() => { fetchReferenceData() }, [fetchReferenceData])

  // ==================== WORKFLOW ACTIONS ====================
  const handleStatusChange = async (voucherId: string, action: string, comments?: string) => {
    // Check role permission before sending
    if (!hasPermission(action, currentRole)) {
      toast({ title: 'Permission Denied', description: `${roleLabels[currentRole]} role cannot ${action} vouchers. Required: ${ROLE_PERMISSIONS[action]?.map(r => roleLabels[r]).join(', ') || 'N/A'}`, variant: 'destructive' })
      return
    }
    try {
      const res = await fetch(`/api/vouchers/${voucherId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comments, userRole: currentRole }),
      })
      const result = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: result.error || 'Failed to update status', variant: 'destructive' })
        return
      }
      const actionLabels: Record<string, string> = {
        submit: 'Submitted for Review',
        approve: 'Approved',
        post: 'Posted to GL',
        quick_post: 'Quick Posted to GL',
        reject: 'Rejected',
        revoke: 'Revoked to Draft',
      }
      toast({ title: 'Status Updated', description: `Voucher ${actionLabels[action] || action}` })
      await fetchData()
      if (detailOpen) {
        const detailRes = await fetch(`/api/vouchers/${voucherId}`)
        setDetailVoucher(await detailRes.json())
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
    }
  }

  const handleReject = () => {
    if (!rejectVoucherId) return
    handleStatusChange(rejectVoucherId, 'reject', rejectComments)
    setRejectOpen(false)
    setRejectComments('')
    setRejectVoucherId(null)
  }

  // ==================== CREATE VOUCHER ====================
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!form.voucherType || !form.date || !form.narration) {
      toast({ title: 'Validation Error', description: 'Type, date, and narration are required', variant: 'destructive' })
      return
    }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast({ title: 'Validation Error', description: `Debits (${totalDebit}) must equal Credits (${totalCredit})`, variant: 'destructive' })
      return
    }
    const validEntries = form.entries.filter(e => e.accountId)
    if (validEntries.length < 2) {
      toast({ title: 'Validation Error', description: 'At least 2 entries with accounts are required', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const fyRes = await fetch('/api/financial-year')
      const fys = await fyRes.json()
      const activeFy = fys.find((f: any) => f.status === 'open')
      if (!activeFy) { toast({ title: 'Error', description: 'No open financial year', variant: 'destructive' }); setCreating(false); return }

      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherType: form.voucherType, date: form.date, narration: form.narration,
          reference: form.reference || undefined, payeeName: form.payeeName || undefined,
          chequeNumber: form.chequeNumber || undefined, chequeDate: form.chequeDate || undefined,
          voucherNo: form.voucherNo || undefined, amountInWords: form.amountInWords || autoAmountInWords,
          autoPost: form.autoPost && hasPermission('quick_post', currentRole), entries: validEntries, financialYearId: activeFy.id,
          voucherTypeName: voucherTypes.find(v => v.value === form.voucherType)?.label,
          projectId: form.projectId || undefined, donorId: form.donorId || undefined,
          locationId: form.locationId || undefined, clientId: form.clientId || undefined, userRole: currentRole,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: result.error || 'Failed to create voucher', variant: 'destructive' })
        setCreating(false); return
      }
      toast({ title: 'Voucher Created', description: form.autoPost ? 'Voucher created and posted to GL' : 'Voucher created as draft' })
      setCreateOpen(false); resetForm(); setSearch(''); setPage(1)
      await fetchData('')
    } catch {
      toast({ title: 'Error', description: 'Failed to create voucher', variant: 'destructive' })
    } finally { setCreating(false) }
  }

  // ==================== EDIT VOUCHER ====================
  const [saving, setSaving] = useState(false)

  const handleEdit = async (voucherId: string) => {
    if (!hasPermission('edit', currentRole)) {
      toast({ title: 'Permission Denied', description: `${roleLabels[currentRole]} role cannot edit vouchers.`, variant: 'destructive' })
      return
    }
    try {
      const res = await fetch(`/api/vouchers/${voucherId}`)
      const data = await res.json()
      if (!res.ok) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); return }
      setForm({
        voucherType: data.voucherType, date: new Date(data.date).toISOString().split('T')[0],
        narration: data.narration || '', reference: data.reference || '', payeeName: data.payeeName || '',
        chequeNumber: data.chequeNumber || '', chequeDate: data.chequeDate ? new Date(data.chequeDate).toISOString().split('T')[0] : '',
        voucherNo: data.voucherNo || '', amountInWords: data.amountInWords || '', financialYearId: data.financialYearId || '',
        projectId: data.projectId || '', donorId: data.donorId || '', donorName: '', locationId: data.locationId || '',
        clientId: data.clientId || '',
        autoPost: false,
        entries: data.entries?.map((e: any) => ({ accountId: e.accountId, debit: e.debit || 0, credit: e.credit || 0, description: e.description || '' })) || [{ accountId: '', debit: 0, credit: 0, description: '' }],
      })
      setEditVoucherId(voucherId); setEditOpen(true)
    } catch { toast({ title: 'Error', description: 'Failed to load voucher for editing', variant: 'destructive' }) }
  }

  const handleSaveEdit = async () => {
    if (!editVoucherId) return
    if (!form.voucherType || !form.date || !form.narration) { toast({ title: 'Validation Error', description: 'Type, date, and narration are required', variant: 'destructive' }); return }
    if (Math.abs(totalDebit - totalCredit) > 0.01) { toast({ title: 'Validation Error', description: 'Debits must equal Credits', variant: 'destructive' }); return }
    const validEntries = form.entries.filter(e => e.accountId)
    if (validEntries.length < 2) { toast({ title: 'Validation Error', description: 'At least 2 entries required', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/vouchers/${editVoucherId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit', voucherType: form.voucherType,
          voucherTypeName: voucherTypes.find(v => v.value === form.voucherType)?.label,
          date: form.date, narration: form.narration, reference: form.reference || null,
          payeeName: form.payeeName || null, chequeNumber: form.chequeNumber || null,
          chequeDate: form.chequeDate || null, voucherNo: form.voucherNo || null,
          amountInWords: form.amountInWords || autoAmountInWords || null,
          projectId: form.projectId || null, donorId: form.donorId || null,
          locationId: form.locationId || null, clientId: form.clientId || null, entries: validEntries, userRole: currentRole,
        }),
      })
      const result = await res.json()
      if (!res.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); setSaving(false); return }
      toast({ title: 'Voucher Updated', description: 'Voucher has been updated successfully' })
      setEditOpen(false); resetForm(); await fetchData()
      if (detailOpen && detailVoucher?.id === editVoucherId) setDetailVoucher(result)
    } catch { toast({ title: 'Error', description: 'Failed to update voucher', variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  // ==================== DELETE VOUCHER ====================
  const handleDeleteClick = (voucherId: string, voucherNumber: string) => {
    if (!hasPermission('delete', currentRole)) {
      toast({ title: 'Permission Denied', description: `${roleLabels[currentRole]} role cannot delete vouchers.`, variant: 'destructive' })
      return
    }
    setDeleteVoucherId(voucherId); setDeleteVoucherNumber(voucherNumber); setDeleteOpen(true)
  }
  const handleDeleteConfirm = async () => {
    if (!deleteVoucherId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/vouchers/${deleteVoucherId}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); setDeleting(false); return }
      toast({ title: 'Voucher Deleted', description: `Voucher ${deleteVoucherNumber} has been deleted` })
      setDeleteOpen(false); setDeleteVoucherId(null); setDeleteVoucherNumber('')
      if (detailOpen && detailVoucher?.id === deleteVoucherId) { setDetailOpen(false); setDetailVoucher(null) }
      await fetchData()
    } catch { toast({ title: 'Error', description: 'Failed to delete voucher', variant: 'destructive' }) }
    finally { setDeleting(false) }
  }

  // ==================== DUPLICATE VOUCHER ====================
  const handleDuplicate = async (voucherId: string) => {
    if (!hasPermission('edit', currentRole)) {
      toast({ title: 'Permission Denied', description: `${roleLabels[currentRole]} role cannot create/duplicate vouchers.`, variant: 'destructive' })
      return
    }
    try {
      const res = await fetch(`/api/vouchers/${voucherId}`)
      const data = await res.json()
      if (!res.ok) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); return }
      setForm({
        voucherType: data.voucherType, date: new Date().toISOString().split('T')[0],
        narration: data.narration || '', reference: '', payeeName: data.payeeName || '',
        chequeNumber: '', chequeDate: '', voucherNo: '', amountInWords: '',
        financialYearId: data.financialYearId || '', projectId: data.projectId || '',
        donorId: data.donorId || '', donorName: '', locationId: data.locationId || '',
        clientId: data.clientId || '',
        autoPost: false,
        entries: data.entries?.map((e: any) => ({ accountId: e.accountId, debit: e.debit || 0, credit: e.credit || 0, description: e.description || '' })) || [{ accountId: '', debit: 0, credit: 0, description: '' }],
      })
      setCreateOpen(true)
      toast({ title: 'Voucher Copied', description: 'Voucher data copied to new form.' })
    } catch { toast({ title: 'Error', description: 'Failed to duplicate voucher', variant: 'destructive' }) }
  }

  // ==================== ATTACHMENTS ====================
  const handleFileUpload = async (voucherId: string, files: FileList) => {
    setUploadingFiles(true)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) formData.append('files', files[i])
      formData.append('category', attachmentCategory)
      const res = await fetch(`/api/vouchers/${voucherId}/attachments`, { method: 'POST', body: formData })
      const result = await res.json()
      if (!res.ok) { toast({ title: 'Upload Error', description: result.error, variant: 'destructive' }); setUploadingFiles(false); return }
      toast({ title: 'Files Uploaded', description: `${result.uploaded?.length || 0} file(s) uploaded${result.errors?.length ? ` (${result.errors.length} failed)` : ''}` })
      if (detailOpen && detailVoucher?.id === voucherId) {
        const detailRes = await fetch(`/api/vouchers/${voucherId}`)
        setDetailVoucher(await detailRes.json())
      }
    } catch { toast({ title: 'Error', description: 'Failed to upload files', variant: 'destructive' }) }
    finally { setUploadingFiles(false) }
  }

  const handleAttachmentDelete = async (voucherId: string, attachmentId: string) => {
    try {
      const res = await fetch(`/api/vouchers/${voucherId}/attachments/${attachmentId}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); toast({ title: 'Error', description: err.error, variant: 'destructive' }); return }
      toast({ title: 'Attachment Deleted', description: 'File has been removed' })
      if (detailOpen) {
        const detailRes = await fetch(`/api/vouchers/${voucherId}`)
        setDetailVoucher(await detailRes.json())
      }
    } catch { toast({ title: 'Error', description: 'Failed to delete attachment', variant: 'destructive' }) }
  }

  // ==================== HELPERS ====================
  const resetForm = () => setForm({ ...defaultForm, entries: [{ accountId: '', debit: 0, credit: 0, description: '' }] })
  const addEntry = () => setForm(p => ({ ...p, entries: [...p.entries, { accountId: '', debit: 0, credit: 0, description: '' }] }))
  const removeEntry = (i: number) => setForm(p => ({ ...p, entries: p.entries.filter((_, idx) => idx !== i) }))
  const updateEntry = (i: number, field: string, value: any) => setForm(p => ({ ...p, entries: p.entries.map((e, idx) => idx === i ? { ...e, [field]: value } : e) }))
  const voucherTypeColor = (type: string) => voucherTypes.find(v => v.value === type)?.color || 'bg-gray-100 text-gray-800'
  const clearAllFilters = () => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setAdvFilters({ partyName: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', projectId: '', donorId: '', locationId: '', clientId: '' }) }

  const handlePrint = (voucher: any) => {
    setPrintVoucher(voucher)
    setPrintOpen(true)
  }

  const handlePrintAction = () => {
    const el = document.getElementById('voucher-print-area')
    if (!el) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Voucher</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #333;padding:6px 8px;text-align:left}th{background:#f0f0f0;font-weight:bold}.header{text-align:center;margin-bottom:20px}.meta{display:flex;justify-content:space-between;margin:10px 0}.amount-words{margin:15px 0;padding:8px;border:1px solid #999;background:#f9f9f9;font-weight:bold}.footer{margin-top:40px;display:flex;justify-content:space-between}.signature{border-top:1px solid #333;padding-top:5px;width:150px;text-align:center}</style></head><body>${el.innerHTML}</body></html>`)
    w.document.close(); w.print()
  }

  // ==================== SHARED VOUCHER FORM ====================
  const renderVoucherForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Voucher Type *</Label>
          <Select value={form.voucherType} onValueChange={v => setForm(p => ({ ...p, voucherType: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{voucherTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Voucher No</Label><Input className="h-8 text-xs" placeholder="Auto if blank" value={form.voucherNo} onChange={e => setForm(p => ({ ...p, voucherNo: e.target.value }))} /></div>
        <div><Label className="text-xs">Date *</Label><Input type="date" className="h-8 text-xs" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
        <div><Label className="text-xs">Reference</Label><Input className="h-8 text-xs" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div><Label className="text-xs">Name (Payee)</Label><Input className="h-8 text-xs" placeholder="Name of payee/beneficiary" value={form.payeeName} onChange={e => setForm(p => ({ ...p, payeeName: e.target.value }))} /></div>
        <div><Label className="text-xs">Cheque No</Label><Input className="h-8 text-xs" placeholder="Cheque number" value={form.chequeNumber} onChange={e => setForm(p => ({ ...p, chequeNumber: e.target.value }))} /></div>
        <div><Label className="text-xs">Cheque Date</Label><Input type="date" className="h-8 text-xs" value={form.chequeDate} onChange={e => setForm(p => ({ ...p, chequeDate: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label className="text-xs">Project</Label>
          <Select value={form.projectId || '_none'} onValueChange={v => setForm(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent><SelectItem value="_none">None</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Donor</Label>
          <Select value={form.donorId || '_none'} onValueChange={v => setForm(p => ({ ...p, donorId: v === '_none' ? '' : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent><SelectItem value="_none">None</SelectItem>{donors.map(d => <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Location</Label>
          <Select value={form.locationId || '_none'} onValueChange={v => setForm(p => ({ ...p, locationId: v === '_none' ? '' : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent><SelectItem value="_none">None</SelectItem>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Client</Label>
          <Select value={form.clientId || '_none'} onValueChange={v => setForm(p => ({ ...p, clientId: v === '_none' ? '' : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent><SelectItem value="_none">None</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Narration *</Label><Textarea className="text-xs" rows={2} value={form.narration} onChange={e => setForm(p => ({ ...p, narration: e.target.value }))} /></div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">Voucher Entries</Label>
          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={addEntry}><Plus className="h-3 w-3 mr-1" />Add Line</Button>
        </div>
        <div className="space-y-2">
          {form.entries.map((entry, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">{i === 0 && <Label className="text-[10px]">Account</Label>}
                <AccountCombobox
                  accounts={accounts}
                  value={entry.accountId}
                  onChange={v => updateEntry(i, 'accountId', v)}
                  placeholder="Search account…"
                />
              </div>
              <div className="col-span-2">{i === 0 && <Label className="text-[10px]">Debit</Label>}<Input type="number" className="h-7 text-[10px]" value={entry.debit || ''} onChange={e => updateEntry(i, 'debit', parseFloat(e.target.value) || 0)} /></div>
              <div className="col-span-2">{i === 0 && <Label className="text-[10px]">Credit</Label>}<Input type="number" className="h-7 text-[10px]" value={entry.credit || ''} onChange={e => updateEntry(i, 'credit', parseFloat(e.target.value) || 0)} /></div>
              <div className="col-span-3">{i === 0 && <Label className="text-[10px]">Description</Label>}<Input className="h-7 text-[10px]" value={entry.description} onChange={e => updateEntry(i, 'description', e.target.value)} /></div>
              <div className="col-span-1">{form.entries.length > 2 && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeEntry(i)}><XCircle className="h-3.5 w-3.5" /></Button>}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2 p-2 rounded bg-muted/50">
          <div className="flex gap-4 text-xs"><span>Total Debit: <strong>{formatCurrency(totalDebit)}</strong></span><span>Total Credit: <strong>{formatCurrency(totalCredit)}</strong></span></div>
          <Badge className={isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{isBalanced ? 'Balanced ✓' : 'Out of Balance ✗'}</Badge>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs font-semibold">Amount in Words</Label>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={() => setForm(p => ({ ...p, amountInWords: autoAmountInWords }))} disabled={totalDebit === 0}><Copy className="h-3 w-3 mr-1" />Auto-fill</Button>
        </div>
        <Textarea className="text-xs font-medium italic" rows={2} placeholder="Amount in words will be auto-generated..." value={form.amountInWords || autoAmountInWords} onChange={e => setForm(p => ({ ...p, amountInWords: e.target.value }))} />
      </div>
      {!editOpen && hasPermission('quick_post', currentRole) && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
          <input type="checkbox" id="autoPost" checked={form.autoPost} onChange={e => setForm(p => ({ ...p, autoPost: e.target.checked }))} className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" />
          <div>
            <Label htmlFor="autoPost" className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 cursor-pointer">Auto Post to General Ledger</Label>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{form.autoPost ? 'Voucher will be immediately posted to GL (Admin only)' : 'Voucher will be saved as draft — submit for approval workflow'}</p>
          </div>
        </div>
      )}
      {!editOpen && !hasPermission('quick_post', currentRole) && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <Clock className="h-4 w-4 text-blue-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Approval Workflow Required</p>
            <p className="text-[10px] text-blue-600">Your <strong>{roleLabels[currentRole]}</strong> role requires approval before posting. Voucher will be saved as draft.</p>
          </div>
        </div>
      )}
      {editOpen && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <Pencil className="h-4 w-4 text-amber-600 shrink-0" />
          <div><p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Editing Voucher</p><p className="text-[10px] text-amber-600">Only draft or rejected vouchers can be edited.</p></div>
        </div>
      )}
    </div>
  )

  // ==================== RENDER ====================
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Role Selector */}
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={currentRole} onValueChange={setCurrentRole}>
              <SelectTrigger className={`h-8 w-32 text-xs border-dashed ${currentRole !== 'admin' ? 'border-2' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['admin', 'manager', 'accountant', 'auditor', 'viewer'].map(r => (
                  <SelectItem key={r} value={r}>
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${r === 'admin' ? 'bg-rose-500' : r === 'manager' ? 'bg-amber-500' : r === 'accountant' ? 'bg-sky-500' : r === 'auditor' ? 'bg-violet-500' : 'bg-gray-400'}`} />
                      {roleLabels[r]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge className={`text-[8px] ${roleColors[currentRole]}`}>{roleLabels[currentRole]}</Badge>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search vouchers..." className="pl-7 h-8 text-xs w-52" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Types</SelectItem>{voucherTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem>{['draft', 'pending', 'approved', 'posted', 'rejected'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowAdvanced(!showAdvanced)}>
            <Filter className="h-3 w-3" /> Advanced
            {activeFilterCount > 0 && <Badge className="h-4 text-[8px] px-1 ml-1">{activeFilterCount}</Badge>}
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          {activeFilterCount > 0 && <Button variant="ghost" size="sm" className="h-8 text-[10px] text-muted-foreground" onClick={clearAllFilters}><X className="h-3 w-3 mr-1" />Clear filters</Button>}
        </div>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm() }}>
          {hasPermission('edit', currentRole) && <DialogTrigger asChild><Button size="sm" className="h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" /> New Voucher</Button></DialogTrigger>}
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-sm">Create New Voucher</DialogTitle></DialogHeader>
            {renderVoucherForm()}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); resetForm() }}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={!isBalanced || creating}>{creating ? 'Creating...' : form.autoPost ? 'Create & Post to GL' : 'Create as Draft'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Advanced Search Panel */}
      {showAdvanced && (
        <Card><CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-[10px]">Party Name</Label><Input className="h-7 text-xs" placeholder="Search by payee name" value={advFilters.partyName} onChange={e => setAdvFilters(p => ({ ...p, partyName: e.target.value }))} /></div>
            <div><Label className="text-[10px]">Date From</Label><Input type="date" className="h-7 text-xs" value={advFilters.dateFrom} onChange={e => setAdvFilters(p => ({ ...p, dateFrom: e.target.value }))} /></div>
            <div><Label className="text-[10px]">Date To</Label><Input type="date" className="h-7 text-xs" value={advFilters.dateTo} onChange={e => setAdvFilters(p => ({ ...p, dateTo: e.target.value }))} /></div>
            <div><Label className="text-[10px]">Amount Min</Label><Input type="number" className="h-7 text-xs" placeholder="0" value={advFilters.amountMin} onChange={e => setAdvFilters(p => ({ ...p, amountMin: e.target.value }))} /></div>
            <div><Label className="text-[10px]">Amount Max</Label><Input type="number" className="h-7 text-xs" placeholder="No limit" value={advFilters.amountMax} onChange={e => setAdvFilters(p => ({ ...p, amountMax: e.target.value }))} /></div>
            <div><Label className="text-[10px]">Project</Label>
              <Select value={advFilters.projectId || '_none'} onValueChange={v => setAdvFilters(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="_none">All Projects</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px]">Donor</Label>
              <Select value={advFilters.donorId || '_none'} onValueChange={v => setAdvFilters(p => ({ ...p, donorId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="_none">All Donors</SelectItem>{donors.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px]">Location</Label>
              <Select value={advFilters.locationId || '_none'} onValueChange={v => setAdvFilters(p => ({ ...p, locationId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="_none">All Locations</SelectItem>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-[10px]">Client</Label>
              <Select value={advFilters.clientId || '_none'} onValueChange={v => setAdvFilters(p => ({ ...p, clientId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="_none">All Clients</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent></Card>
      )}

      {/* Vouchers Table */}
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-[10px]">Voucher #</TableHead>
            <TableHead className="text-[10px]">Type</TableHead>
            <TableHead className="text-[10px]">Name</TableHead>
            <TableHead className="text-[10px]">Date</TableHead>
            <TableHead className="text-[10px] text-right">Amount</TableHead>
            <TableHead className="text-[10px]">Workflow</TableHead>
            <TableHead className="text-[10px]">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : vouchers.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground">No vouchers found</TableCell></TableRow>
            ) : vouchers.map(v => (
              <TableRow key={v.id} className="hover:bg-accent/50">
                <TableCell className="font-mono text-xs font-semibold">
                  <div className="flex items-center gap-1">
                    {v.voucherNo || v.voucherNumber}
                    {v._count?.attachments ? <Paperclip className="h-2.5 w-2.5 text-muted-foreground" /> : null}
                  </div>
                </TableCell>
                <TableCell><Badge className={`text-[9px] ${voucherTypeColor(v.voucherType)}`}>{v.voucherTypeName}</Badge></TableCell>
                <TableCell className="text-xs font-medium">{v.payeeName || '-'}</TableCell>
                <TableCell className="text-xs">{new Date(v.date).toLocaleDateString()}</TableCell>
                <TableCell className="text-xs text-right font-semibold">{formatCurrency(v.totalDebit)}</TableCell>
                <TableCell><WorkflowSteps currentStatus={v.status} currentRole={currentRole} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={async () => { const res = await fetch(`/api/vouchers/${v.id}`); setDetailVoucher(await res.json()); setDetailOpen(true) }}><Eye className="h-3 w-3" /></Button>
                    {(v.status === 'draft' || v.status === 'rejected') && hasPermission('edit', currentRole) && <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Edit" onClick={() => handleEdit(v.id)}><Pencil className="h-3 w-3" /></Button>}
                    {hasPermission('edit', currentRole) && <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-600" title="Duplicate" onClick={() => handleDuplicate(v.id)}><CopyPlus className="h-3 w-3" /></Button>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Print" onClick={async () => { const res = await fetch(`/api/vouchers/${v.id}`); handlePrint(await res.json()) }}><Printer className="h-3 w-3" /></Button>
                    {(v.status === 'draft' || v.status === 'rejected') && hasPermission('delete', currentRole) && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => handleDeleteClick(v.id, v.voucherNo || v.voucherNumber)}><Trash2 className="h-3 w-3" /></Button>}
                    <Separator orientation="vertical" className="h-5 mx-0.5" />
                    {v.status === 'draft' && hasPermission('submit', currentRole) && <Button variant="ghost" size="sm" className="h-7 text-[10px] text-blue-600" onClick={() => handleStatusChange(v.id, 'submit')}>Submit</Button>}
                    {v.status === 'pending' && hasPermission('approve', currentRole) && <Button variant="ghost" size="sm" className="h-7 text-[10px] text-green-600" onClick={() => handleStatusChange(v.id, 'approve')}>Approve</Button>}
                    {v.status === 'approved' && hasPermission('post', currentRole) && <Button variant="ghost" size="sm" className="h-7 text-[10px] text-emerald-600" onClick={() => handleStatusChange(v.id, 'post')}>Post</Button>}
                    {(v.status === 'draft' || v.status === 'pending') && hasPermission('quick_post', currentRole) && <Button variant="ghost" size="sm" className="h-7 text-[10px] text-emerald-700 font-semibold" onClick={() => handleStatusChange(v.id, 'quick_post')}>Quick Post</Button>}
                    {v.status === 'posted' && hasPermission('revoke', currentRole) && <Button variant="ghost" size="sm" className="h-7 text-[10px] text-amber-600" onClick={() => handleStatusChange(v.id, 'revoke')}>Revoke</Button>}
                    {v.status !== 'rejected' && v.status !== 'posted' && hasPermission('reject', currentRole) && <Button variant="ghost" size="sm" className="h-7 text-[10px] text-destructive" onClick={() => { setRejectVoucherId(v.id); setRejectOpen(true) }}>Reject</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { resetForm(); setEditVoucherId(null) } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm flex items-center gap-2"><Pencil className="h-4 w-4 text-amber-600" />Edit Voucher</DialogTitle></DialogHeader>
          {renderVoucherForm()}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setEditOpen(false); resetForm(); setEditVoucherId(null) }}>Cancel</Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={!isBalanced || saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Reject Voucher</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Reason for rejection *</Label><Textarea className="text-xs" rows={3} placeholder="Provide a reason for rejection..." value={rejectComments} onChange={e => setRejectComments(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setRejectOpen(false); setRejectComments(''); setRejectVoucherId(null) }}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleReject} disabled={!rejectComments.trim()}>Reject Voucher</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="text-sm">Delete Voucher</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">Are you sure you want to delete voucher <strong className="font-mono">{deleteVoucherNumber}</strong>? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs" onClick={() => { setDeleteOpen(false); setDeleteVoucherId(null) }}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm flex items-center gap-2">
            Voucher Details - {detailVoucher?.voucherNumber}
            {detailVoucher?.isPayrollPosted && <Badge className="text-[9px] bg-purple-100 text-purple-800">Payroll → GL</Badge>}
            {detailVoucher?.isAssetPosted && <Badge className="text-[9px] bg-teal-100 text-teal-800">Fixed Assets → GL</Badge>}
          </DialogTitle></DialogHeader>
          {detailVoucher && (
            <div className="space-y-4">
              {/* Workflow Steps */}
              <div className="p-3 rounded-md bg-muted/30 border">
                <p className="text-[10px] text-muted-foreground mb-2 font-semibold">APPROVAL WORKFLOW</p>
                <WorkflowSteps currentStatus={detailVoucher.status} currentRole={currentRole} />
              </div>

              {/* Voucher Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span className="text-muted-foreground">Type:</span> <strong>{detailVoucher.voucherTypeName}</strong></div>
                <div><span className="text-muted-foreground">Date:</span> <strong>{new Date(detailVoucher.date).toLocaleDateString()}</strong></div>
                <div><span className="text-muted-foreground">Reference:</span> {detailVoucher.reference || '-'}</div>
                <div><span className="text-muted-foreground">Name:</span> <strong>{detailVoucher.payeeName || '-'}</strong></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs p-3 rounded-md bg-muted/30 border">
                <div><span className="text-muted-foreground">Voucher No:</span> <strong className="font-mono">{detailVoucher.voucherNo || detailVoucher.voucherNumber}</strong></div>
                <div><span className="text-muted-foreground">Cheque No:</span> <strong className="font-mono">{detailVoucher.chequeNumber || '-'}</strong></div>
                <div><span className="text-muted-foreground">Cheque Date:</span> {detailVoucher.chequeDate ? new Date(detailVoucher.chequeDate).toLocaleDateString() : '-'}</div>
                <div><span className="text-muted-foreground">Attachments:</span> {detailVoucher.attachments?.length || 0} file(s)</div>
              </div>
              {detailVoucher.amountInWords && (
                <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] text-muted-foreground block mb-1">Amount in Words:</span>
                  <span className="text-xs font-semibold italic">{detailVoucher.amountInWords}</span>
                </div>
              )}
              {(detailVoucher.project || detailVoucher.donor || detailVoucher.location || detailVoucher.client) && (
                <div className="flex gap-3 text-xs">
                  {detailVoucher.project && <Badge variant="outline" className="text-[9px]">Project: {detailVoucher.project.name}</Badge>}
                  {detailVoucher.donor && <Badge variant="outline" className="text-[9px]">Donor: {detailVoucher.donor.name}</Badge>}
                  {detailVoucher.location && <Badge variant="outline" className="text-[9px]">Location: {detailVoucher.location.name}</Badge>}
                  {detailVoucher.client && <Badge variant="outline" className="text-[9px]">Client: {detailVoucher.client.name}</Badge>}
                </div>
              )}
              <div className="text-xs"><span className="text-muted-foreground">Narration:</span> {detailVoucher.narration}</div>

              {/* Action Buttons - Role Based */}
              {detailVoucher.status !== 'posted' && detailVoucher.status !== 'rejected' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border flex-wrap">
                    <span className="text-xs text-muted-foreground">Actions:</span>
                    <Badge className={`text-[8px] ${roleColors[currentRole]}`}>{roleLabels[currentRole]}</Badge>
                    {detailVoucher.status === 'draft' && hasPermission('submit', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-blue-600" onClick={() => handleStatusChange(detailVoucher.id, 'submit')}><Clock className="h-3 w-3 mr-1" />Submit<span className="hidden sm:inline ml-1 text-muted-foreground">→ Pending</span></Button>}
                    {detailVoucher.status === 'pending' && hasPermission('approve', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-green-600" onClick={() => handleStatusChange(detailVoucher.id, 'approve')}><CheckCircle2 className="h-3 w-3 mr-1" />Approve<span className="hidden sm:inline ml-1 text-muted-foreground">→ Approved</span></Button>}
                    {detailVoucher.status === 'approved' && hasPermission('post', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-emerald-600" onClick={() => handleStatusChange(detailVoucher.id, 'post')}><Lock className="h-3 w-3 mr-1" />Post to GL<span className="hidden sm:inline ml-1 text-muted-foreground">→ Posted</span></Button>}
                    {(detailVoucher.status === 'draft' || detailVoucher.status === 'pending') && hasPermission('quick_post', currentRole) && <Button variant="default" size="sm" className="h-7 text-[10px]" onClick={() => handleStatusChange(detailVoucher.id, 'quick_post')}><CheckCircle2 className="h-3 w-3 mr-1" />Quick Post<span className="hidden sm:inline ml-1 opacity-70">(Admin Only)</span></Button>}
                    <Separator orientation="vertical" className="h-5" />
                    {detailVoucher.status !== 'rejected' && detailVoucher.status !== 'posted' && hasPermission('reject', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-destructive" onClick={() => { setDetailOpen(false); setRejectVoucherId(detailVoucher.id); setRejectOpen(true) }}><XCircle className="h-3 w-3 mr-1" />Reject</Button>}
                    {(detailVoucher.status === 'draft' || detailVoucher.status === 'rejected') && hasPermission('edit', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-amber-600" onClick={() => { setDetailOpen(false); handleEdit(detailVoucher.id) }}><Pencil className="h-3 w-3 mr-1" />Edit</Button>}
                    {(detailVoucher.status === 'draft' || detailVoucher.status === 'rejected') && hasPermission('delete', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-destructive" onClick={() => { setDetailOpen(false); handleDeleteClick(detailVoucher.id, detailVoucher.voucherNo || detailVoucher.voucherNumber) }}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>}
                    {hasPermission('edit', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-violet-600" onClick={() => { setDetailOpen(false); handleDuplicate(detailVoucher.id) }}><CopyPlus className="h-3 w-3 mr-1" />Duplicate</Button>}
                  </div>
                  {!hasPermission('submit', currentRole) && !hasPermission('approve', currentRole) && !hasPermission('post', currentRole) && detailVoucher.status !== 'draft' && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="text-[10px] text-amber-700">Your <strong>{roleLabels[currentRole]}</strong> role cannot advance this voucher. {detailVoucher.status === 'pending' ? 'A Manager or Admin is needed to approve.' : detailVoucher.status === 'approved' ? 'Only an Admin can post to GL.' : ''}</span>
                    </div>
                  )}
                </div>
              )}
              {detailVoucher.status === 'posted' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex-wrap">
                    <Lock className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700">Posted to General Ledger — Locked</span>
                    <Badge className={`text-[8px] ${roleColors[currentRole]}`}>{roleLabels[currentRole]}</Badge>
                    <Separator orientation="vertical" className="h-5" />
                    {hasPermission('revoke', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-amber-600" onClick={() => handleStatusChange(detailVoucher.id, 'revoke')}><RotateCcw className="h-3 w-3 mr-1" />Revoke<span className="hidden sm:inline ml-1 text-muted-foreground">(Admin Only)</span></Button>}
                    {hasPermission('edit', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-violet-600" onClick={() => { setDetailOpen(false); handleDuplicate(detailVoucher.id) }}><CopyPlus className="h-3 w-3 mr-1" />Duplicate</Button>}
                  </div>
                  {!hasPermission('revoke', currentRole) && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="text-[10px] text-amber-700">Only an <strong>Admin</strong> can revoke a posted voucher.</span>
                    </div>
                  )}
                </div>
              )}
              {detailVoucher.status === 'rejected' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 flex-wrap">
                    <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <span className="text-xs font-semibold text-red-700">Rejected</span>
                    <Badge className={`text-[8px] ${roleColors[currentRole]}`}>{roleLabels[currentRole]}</Badge>
                    <Separator orientation="vertical" className="h-5" />
                    {hasPermission('edit', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-amber-600" onClick={() => { setDetailOpen(false); handleEdit(detailVoucher.id) }}><Pencil className="h-3 w-3 mr-1" />Edit & Resubmit</Button>}
                    {hasPermission('delete', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-destructive" onClick={() => { setDetailOpen(false); handleDeleteClick(detailVoucher.id, detailVoucher.voucherNo || detailVoucher.voucherNumber) }}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>}
                    {hasPermission('edit', currentRole) && <Button variant="outline" size="sm" className="h-7 text-[10px] text-violet-600" onClick={() => { setDetailOpen(false); handleDuplicate(detailVoucher.id) }}><CopyPlus className="h-3 w-3 mr-1" />Duplicate</Button>}
                  </div>
                </div>
              )}

              {/* Entries Table */}
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[10px]">#</TableHead><TableHead className="text-[10px]">Account</TableHead>
                  <TableHead className="text-[10px]">Debit</TableHead><TableHead className="text-[10px]">Credit</TableHead><TableHead className="text-[10px]">Description</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {detailVoucher.entries?.map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{e.lineNumber}</TableCell>
                      <TableCell className="text-xs font-mono">{e.account?.code} - {e.account?.name}</TableCell>
                      <TableCell className="text-xs">{e.debit > 0 ? formatCurrency(e.debit) : ''}</TableCell>
                      <TableCell className="text-xs">{e.credit > 0 ? formatCurrency(e.credit) : ''}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2} className="text-xs">Total</TableCell>
                    <TableCell className="text-xs">{formatCurrency(detailVoucher.totalDebit)}</TableCell>
                    <TableCell className="text-xs">{formatCurrency(detailVoucher.totalCredit)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>

              {/* Approval Timeline */}
              {detailVoucher.approvals?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1"><Shield className="h-3 w-3" /> Approval History</p>
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                    {detailVoucher.approvals.map((a: any, i: number) => (
                      <div key={i} className="relative pb-3">
                        <div className={`absolute -left-[17px] top-1 h-3 w-3 rounded-full border-2 ${
                          a.action === 'REJECT' ? 'border-red-400 bg-red-100' :
                          a.action === 'POST' || a.action === 'QUICK_POST' ? 'border-emerald-400 bg-emerald-100' :
                          a.action === 'APPROVE' ? 'border-green-400 bg-green-100' :
                          a.action === 'SUBMIT' ? 'border-blue-400 bg-blue-100' :
                          a.action === 'REVOKE' ? 'border-amber-400 bg-amber-100' :
                          'border-gray-400 bg-gray-100'
                        }`} />
                        <div className="text-[10px]">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{a.action}</span>
                            {a.fromStatus && a.toStatus && <span className="text-muted-foreground">{a.fromStatus} → {a.toStatus}</span>}
                            {a.userRole && <Badge className="text-[7px] bg-muted">{roleLabels[a.userRole] || a.userRole}</Badge>}
                          </div>
                          <div className="text-muted-foreground">
                            {a.user?.name || 'System'} {a.comments && <span>— "{a.comments}"</span>}
                            <span className="ml-2">{new Date(a.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments Section */}
              <div className="border rounded-md">
                <div className="p-3 border-b bg-muted/30">
                  <p className="text-xs font-semibold flex items-center gap-1"><Paperclip className="h-3 w-3" /> Attachments ({detailVoucher.attachments?.length || 0})</p>
                </div>
                <div className="p-3 space-y-2">
                  {/* Existing Attachments */}
                  {detailVoucher.attachments?.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {detailVoucher.attachments.map((att: any) => (
                        <div key={att.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors">
                          <FileIcon mimeType={att.mimeType} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium truncate">{att.fileName}</p>
                            <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                              <span>{formatFileSize(att.fileSize || 0)}</span>
                              {att.category && <Badge className={`text-[7px] ${categoryColors[att.category] || 'bg-gray-100 text-gray-800'}`}>{att.category}</Badge>}
                              {att.isVerified && <Badge className="text-[7px] bg-emerald-100 text-emerald-800">✓ Verified</Badge>}
                              <span>{new Date(att.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <a href={`/api/vouchers/${detailVoucher.id}/attachments/${att.id}`} download className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Download className="h-3 w-3" /></a>
                          {(detailVoucher.status === 'draft' || detailVoucher.status === 'pending' || detailVoucher.status === 'rejected') && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleAttachmentDelete(detailVoucher.id, att.id)}><Trash2 className="h-3 w-3" /></Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground text-center py-2">No attachments yet</p>
                  )}

                  {/* Upload Area */}
                  {(detailVoucher.status !== 'posted') && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Select value={attachmentCategory} onValueChange={setAttachmentCategory}>
                          <SelectTrigger className="h-7 w-28 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="invoice">Invoice</SelectItem>
                            <SelectItem value="receipt">Receipt</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-4 hover:bg-muted/20 cursor-pointer transition-colors">
                        <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                        <span className="text-[10px] font-medium">Drop files or click to upload</span>
                        <span className="text-[9px] text-muted-foreground">PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX — Max 10MB each</span>
                        <input type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx" onChange={e => { if (e.target.files?.length) handleFileUpload(detailVoucher.id, e.target.files); e.target.value = '' }} disabled={uploadingFiles} />
                      </label>
                      {uploadingFiles && <p className="text-[10px] text-center mt-1 text-blue-600 animate-pulse">Uploading...</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Print Button */}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handlePrint(detailVoucher)}><Printer className="h-3 w-3 mr-1" />Print Preview</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Preview */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm flex items-center justify-between">
            <span>Voucher Print Preview</span>
            <Button size="sm" className="h-7 text-xs" onClick={handlePrintAction}><Printer className="h-3 w-3 mr-1" />Print</Button>
          </DialogTitle></DialogHeader>
          {printVoucher && (
            <div id="voucher-print-area" className="border p-6 bg-white text-black text-xs">
              <div className="text-center border-b-2 border-black pb-3 mb-4"><h2 className="text-lg font-bold">VOUCHER</h2><p className="text-sm font-semibold">{printVoucher.voucherTypeName?.toUpperCase()}</p></div>
              <div className="flex justify-between mb-4">
                <div><p><strong>Voucher No:</strong> {printVoucher.voucherNo || printVoucher.voucherNumber}</p><p><strong>Date:</strong> {new Date(printVoucher.date).toLocaleDateString()}</p><p><strong>Reference:</strong> {printVoucher.reference || '-'}</p></div>
                <div className="text-right"><p><strong>Name:</strong> {printVoucher.payeeName || '-'}</p><p><strong>Cheque No:</strong> {printVoucher.chequeNumber || '-'}</p><p><strong>Cheque Date:</strong> {printVoucher.chequeDate ? new Date(printVoucher.chequeDate).toLocaleDateString() : '-'}</p></div>
              </div>
              <div className="mb-4"><strong>Narration:</strong> {printVoucher.narration}</div>
              {(printVoucher.project || printVoucher.donor || printVoucher.location || printVoucher.client) && (
                <div className="mb-4 flex gap-4">{printVoucher.project && <span><strong>Project:</strong> {printVoucher.project.name}</span>}{printVoucher.donor && <span><strong>Donor:</strong> {printVoucher.donor.name}</span>}{printVoucher.location && <span><strong>Location:</strong> {printVoucher.location.name}</span>}{printVoucher.client && <span><strong>Client:</strong> {printVoucher.client.name}</span>}</div>
              )}
              <table className="w-full border-collapse mb-4"><thead><tr><th className="border border-black px-2 py-1 text-left">#</th><th className="border border-black px-2 py-1 text-left">Account Code</th><th className="border border-black px-2 py-1 text-left">Account Name</th><th className="border border-black px-2 py-1 text-right">Debit (PKR)</th><th className="border border-black px-2 py-1 text-right">Credit (PKR)</th></tr></thead>
                <tbody>
                  {printVoucher.entries?.map((e: any, i: number) => (<tr key={i}><td className="border border-black px-2 py-1">{e.lineNumber}</td><td className="border border-black px-2 py-1 font-mono">{e.account?.code}</td><td className="border border-black px-2 py-1">{e.account?.name}</td><td className="border border-black px-2 py-1 text-right">{e.debit > 0 ? formatCurrency(e.debit) : ''}</td><td className="border border-black px-2 py-1 text-right">{e.credit > 0 ? formatCurrency(e.credit) : ''}</td></tr>))}
                  <tr className="font-bold"><td colSpan={3} className="border border-black px-2 py-1">Total</td><td className="border border-black px-2 py-1 text-right">{formatCurrency(printVoucher.totalDebit)}</td><td className="border border-black px-2 py-1 text-right">{formatCurrency(printVoucher.totalCredit)}</td></tr>
                </tbody>
              </table>
              <div className="border border-black p-2 bg-gray-50 mb-6"><strong>Amount in Words:</strong> {printVoucher.amountInWords || numberToWords(printVoucher.totalDebit)}</div>
              <div className="flex justify-between mt-8">
                <div className="border-t border-black pt-1 w-[150px] text-center"><span className="text-[10px]">Prepared By</span></div>
                <div className="border-t border-black pt-1 w-[150px] text-center"><span className="text-[10px]">Reviewed By</span></div>
                <div className="border-t border-black pt-1 w-[150px] text-center"><span className="text-[10px]">Approved By</span></div>
                <div className="border-t border-black pt-1 w-[150px] text-center"><span className="text-[10px]">Received By</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
