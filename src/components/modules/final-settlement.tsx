'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileCheck, Plus, Pencil, Trash2, CheckCircle, DollarSign, ArrowRight, ShieldCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { EmployeeCombobox } from '@/components/ui/employee-combobox'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function formatDate(date: string | Date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })
}

const statusStyles: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-[#EEF1F8] text-[#0F2D78]',
  posted: 'bg-purple-100 text-purple-800',
}

const settlementTypes = ['Resignation', 'Termination', 'Retirement', 'Death']

interface SettlementForm {
  employeeId: string
  leavingDate: string
  settlementType: string
  basicSalary: number
  unpaidSalary: number
  leaveEncashment: number
  gratuity: number
  socialChargesPayout: number
  loanBalance: number
  advanceBalance: number
  otherDeductions: number
  createdBy: string
}

const emptyForm: SettlementForm = {
  employeeId: '',
  leavingDate: new Date().toISOString().slice(0, 10),
  settlementType: 'Resignation',
  basicSalary: 0,
  unpaidSalary: 0,
  leaveEncashment: 0,
  gratuity: 0,
  socialChargesPayout: 0,
  loanBalance: 0,
  advanceBalance: 0,
  otherDeductions: 0,
  createdBy: '',
}

export function FinalSettlementModule() {
  const [settlements, setSettlements] = useState<any[]>([])
  const [financialYears, setFinancialYears] = useState<any[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null)
  const [form, setForm] = useState<SettlementForm>({ ...emptyForm })
  const { toast } = useToast()

  const fetchSettlements = useCallback(async () => {
    try {
      const res = await fetch('/api/final-settlement')
      const data = await res.json()
      setSettlements(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load final settlements', variant: 'destructive' })
    }
  }, [toast])

  const [employees, setEmployees] = useState<any[]>([])

  useEffect(() => {
    queueMicrotask(() => {
      fetchSettlements()
      fetch('/api/financial-year').then(r => r.json()).then(d => setFinancialYears(Array.isArray(d) ? d : [])).catch(() => {})
      fetch('/api/employees?pageSize=500').then(r => r.json()).then(d => setEmployees(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [])).catch(() => {})
    })
  }, [fetchSettlements])

  const handleCreate = async () => {
    if (!form.employeeId || !form.leavingDate || !form.settlementType) {
      toast({ title: 'Error', description: 'Employee ID, leaving date, and settlement type are required', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/final-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Created', description: 'Final settlement created with auto-calculations' })
      setCreateDialogOpen(false)
      setForm({ ...emptyForm })
      fetchSettlements()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleEdit = async () => {
    if (!selectedSettlement) return
    try {
      const res = await fetch(`/api/final-settlement?id=${selectedSettlement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Updated', description: 'Final settlement updated' })
      setEditDialogOpen(false)
      setSelectedSettlement(null)
      fetchSettlements()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!selectedSettlement) return
    try {
      const res = await fetch(`/api/final-settlement?id=${selectedSettlement.id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Deleted', description: 'Final settlement deleted' })
      setDeleteDialogOpen(false)
      setSelectedSettlement(null)
      fetchSettlements()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleApprove = async () => {
    if (!selectedSettlement) return
    try {
      const res = await fetch(`/api/final-settlement?id=${selectedSettlement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Approved', description: 'Final settlement approved' })
      setApproveDialogOpen(false)
      setSelectedSettlement(null)
      fetchSettlements()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handlePay = async () => {
    if (!selectedSettlement) return
    try {
      const res = await fetch(`/api/final-settlement?id=${selectedSettlement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay' }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Paid', description: 'Final settlement marked as paid' })
      setPayDialogOpen(false)
      setSelectedSettlement(null)
      fetchSettlements()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handlePost = async () => {
    if (!selectedSettlement) return
    const fy = financialYears.find((f: any) => f.status === 'open')
    if (!fy) { toast({ title: 'Error', description: 'No open financial year', variant: 'destructive' }); return }
    try {
      const res = await fetch(`/api/final-settlement?id=${selectedSettlement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post', financialYearId: fy.id }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Posted to GL', description: `Voucher ${result.voucher?.voucherNumber || ''} created` })
      setPostDialogOpen(false)
      setSelectedSettlement(null)
      fetchSettlements()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const openEdit = (settlement: any) => {
    setSelectedSettlement(settlement)
    setForm({
      employeeId: settlement.employeeId,
      leavingDate: settlement.leavingDate ? new Date(settlement.leavingDate).toISOString().slice(0, 10) : '',
      settlementType: settlement.settlementType,
      basicSalary: settlement.basicSalary,
      unpaidSalary: settlement.unpaidSalary,
      leaveEncashment: settlement.leaveEncashment,
      gratuity: settlement.gratuity,
      socialChargesPayout: settlement.socialChargesPayout,
      loanBalance: settlement.loanBalance,
      advanceBalance: settlement.advanceBalance,
      otherDeductions: settlement.otherDeductions,
      createdBy: '',
    })
    setEditDialogOpen(true)
  }

  // Summary stats
  const totalPayable = settlements.reduce((s, st) => s + (st.totalPayable || 0), 0)
  const totalDeductions = settlements.reduce((s, st) => s + (st.totalDeductions || 0), 0)
  const totalNetSettlement = settlements.reduce((s, st) => s + (st.netSettlement || 0), 0)

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-[#0F2D78]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#1E3C87]" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Payable</p>
                <p className="text-sm font-bold text-[#0F2D78]">{formatCurrency(totalPayable)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Deductions</p>
                <p className="text-sm font-bold text-red-600">{formatCurrency(totalDeductions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Net Settlement</p>
                <p className="text-sm font-bold">{formatCurrency(totalNetSettlement)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Info */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardContent className="p-4">
          <h4 className="text-xs font-semibold mb-2">Final Settlement → GL Integration</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Unpaid salary debits salary expense, credits salary payable</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Leave encashment debits salary expense, credits salary payable</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Gratuity debits gratuity expense, credits gratuity payable</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Loan/advance deductions credit respective receivable accounts</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><FileCheck className="h-4 w-4" />Final Settlement</h3>
        <Button size="sm" className="h-8 text-xs" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />New Settlement
        </Button>
      </div>

      {/* Settlements List */}
      {settlements.map(settlement => (
        <Card key={settlement.id} className="group">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xs">
                  {settlement.employee?.name || settlement.employeeId}
                  <span className="text-[10px] text-muted-foreground ml-2">({settlement.employee?.employeeCode || settlement.employeeId})</span>
                </CardTitle>
                <CardDescription className="text-[10px]">
                  {settlement.settlementType} | Leaving: {formatDate(settlement.leavingDate)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-[9px] ${statusStyles[settlement.status] || ''}`}>{settlement.status}</Badge>
                {settlement.status === 'draft' && (
                  <>
                    <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => { setSelectedSettlement(settlement); setApproveDialogOpen(true) }}>
                      <CheckCircle className="h-3 w-3 mr-1" />Approve
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(settlement)}>
                      <Pencil className="h-3.5 w-3.5 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedSettlement(settlement); setDeleteDialogOpen(true) }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </>
                )}
                {settlement.status === 'approved' && (
                  <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => { setSelectedSettlement(settlement); setPayDialogOpen(true) }}>
                    <DollarSign className="h-3 w-3 mr-1" />Mark Paid
                  </Button>
                )}
                {settlement.status === 'paid' && (
                  <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => { setSelectedSettlement(settlement); setPostDialogOpen(true) }}>
                    <ArrowRight className="h-3 w-3 mr-1" />Post to GL
                  </Button>
                )}
                {settlement.postedVoucherId && (
                  <Badge className="text-[9px] bg-purple-100 text-purple-800"><CheckCircle className="h-3 w-3 mr-1" />Posted to GL</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Basic Salary</p>
                <p className="text-xs font-bold">{formatCurrency(settlement.basicSalary)}</p>
              </div>
              <div className="text-center p-2 rounded bg-[#EEF1F8]">
                <p className="text-[10px] text-muted-foreground">Total Payable</p>
                <p className="text-xs font-bold text-[#0F2D78]">{formatCurrency(settlement.totalPayable)}</p>
              </div>
              <div className="text-center p-2 rounded bg-red-50">
                <p className="text-[10px] text-muted-foreground">Total Deductions</p>
                <p className="text-xs font-bold text-red-600">{formatCurrency(settlement.totalDeductions)}</p>
              </div>
              <div className="text-center p-2 rounded bg-blue-50">
                <p className="text-[10px] text-muted-foreground">Net Settlement</p>
                <p className="text-xs font-bold">{formatCurrency(settlement.netSettlement)}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Loan Balance</p>
                <p className="text-xs font-bold text-orange-600">{formatCurrency(settlement.loanBalance)}</p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              <div className="flex justify-between p-1.5 rounded bg-muted/30">
                <span className="text-muted-foreground">Unpaid Salary:</span>
                <span className="font-medium">{formatCurrency(settlement.unpaidSalary)}</span>
              </div>
              <div className="flex justify-between p-1.5 rounded bg-muted/30">
                <span className="text-muted-foreground">Leave Encashment:</span>
                <span className="font-medium">{formatCurrency(settlement.leaveEncashment)}</span>
              </div>
              <div className="flex justify-between p-1.5 rounded bg-muted/30">
                <span className="text-muted-foreground">Gratuity:</span>
                <span className="font-medium">{formatCurrency(settlement.gratuity)}</span>
              </div>
              <div className="flex justify-between p-1.5 rounded bg-muted/30">
                <span className="text-muted-foreground">Advance Balance:</span>
                <span className="font-medium text-red-600">{formatCurrency(settlement.advanceBalance)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {settlements.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No final settlements found. Click &ldquo;New Settlement&rdquo; to create one.</p>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm">Create Final Settlement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Select Employee *</Label>
              <EmployeeCombobox
                employees={employees}
                value={form.employeeId}
                onChange={val => setForm(p => ({ ...p, employeeId: val }))}
                placeholder="Search employee by name, code..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Leaving Date *</Label><Input type="date" className="h-8 text-xs" value={form.leavingDate} onChange={e => setForm(p => ({ ...p, leavingDate: e.target.value }))} /></div>
              <div><Label className="text-xs">Settlement Type *</Label>
                <Select value={form.settlementType} onValueChange={v => setForm(p => ({ ...p, settlementType: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{settlementTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Basic Salary (PKR)</Label><Input type="number" className="h-8 text-xs" value={form.basicSalary || ''} onChange={e => setForm(p => ({ ...p, basicSalary: parseFloat(e.target.value) || 0 }))} placeholder="Auto from employee if 0" /></div>
              <div><Label className="text-xs">Unpaid Salary Override</Label><Input type="number" className="h-8 text-xs" value={form.unpaidSalary || ''} onChange={e => setForm(p => ({ ...p, unpaidSalary: parseFloat(e.target.value) || 0 }))} placeholder="Auto-calculated if 0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Leave Encashment Override</Label><Input type="number" className="h-8 text-xs" value={form.leaveEncashment || ''} onChange={e => setForm(p => ({ ...p, leaveEncashment: parseFloat(e.target.value) || 0 }))} placeholder="Auto-calculated if 0" /></div>
              <div><Label className="text-xs">Gratuity Override</Label><Input type="number" className="h-8 text-xs" value={form.gratuity || ''} onChange={e => setForm(p => ({ ...p, gratuity: parseFloat(e.target.value) || 0 }))} placeholder="Auto-calculated if 0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Social Charges Payout</Label><Input type="number" className="h-8 text-xs" value={form.socialChargesPayout || ''} onChange={e => setForm(p => ({ ...p, socialChargesPayout: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Other Deductions</Label><Input type="number" className="h-8 text-xs" value={form.otherDeductions || ''} onChange={e => setForm(p => ({ ...p, otherDeductions: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <p className="text-[10px] text-muted-foreground">Loan and advance balances are auto-calculated from active employee loans. Leave salary fields as 0 to auto-calculate from employee data.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate}>Create Settlement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm">Edit Final Settlement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Leaving Date</Label><Input type="date" className="h-8 text-xs" value={form.leavingDate} onChange={e => setForm(p => ({ ...p, leavingDate: e.target.value }))} /></div>
              <div><Label className="text-xs">Settlement Type</Label>
                <Select value={form.settlementType} onValueChange={v => setForm(p => ({ ...p, settlementType: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{settlementTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Basic Salary</Label><Input type="number" className="h-8 text-xs" value={form.basicSalary || ''} onChange={e => setForm(p => ({ ...p, basicSalary: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Unpaid Salary</Label><Input type="number" className="h-8 text-xs" value={form.unpaidSalary || ''} onChange={e => setForm(p => ({ ...p, unpaidSalary: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Leave Encashment</Label><Input type="number" className="h-8 text-xs" value={form.leaveEncashment || ''} onChange={e => setForm(p => ({ ...p, leaveEncashment: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Gratuity</Label><Input type="number" className="h-8 text-xs" value={form.gratuity || ''} onChange={e => setForm(p => ({ ...p, gratuity: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Social Charges Payout</Label><Input type="number" className="h-8 text-xs" value={form.socialChargesPayout || ''} onChange={e => setForm(p => ({ ...p, socialChargesPayout: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Other Deductions</Label><Input type="number" className="h-8 text-xs" value={form.otherDeductions || ''} onChange={e => setForm(p => ({ ...p, otherDeductions: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleEdit}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Settlement</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete this final settlement? Only draft settlements can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Confirmation */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Approve Settlement</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Approve this final settlement? Once approved, the amounts cannot be changed. Net settlement: {selectedSettlement ? formatCurrency(selectedSettlement.netSettlement) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8" onClick={handleApprove}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pay Confirmation */}
      <AlertDialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Mark as Paid</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Mark this settlement as paid? Net settlement amount: {selectedSettlement ? formatCurrency(selectedSettlement.netSettlement) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8" onClick={handlePay}>Mark Paid</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Post to GL Confirmation */}
      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Post to General Ledger</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will create journal entries in the General Ledger for this final settlement. The settlement will be marked as posted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8" onClick={handlePost}><ArrowRight className="h-3 w-3 mr-1" />Post to GL</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
