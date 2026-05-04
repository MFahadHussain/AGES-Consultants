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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Landmark, Plus, Pencil, Trash2, ChevronDown, ChevronUp, DollarSign, CheckCircle, Ban } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function formatDate(date: string | Date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })
}

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  written_off: 'bg-red-100 text-red-800',
}

const installmentStatusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  partially_paid: 'bg-blue-100 text-blue-800',
  waived: 'bg-gray-100 text-gray-800',
}

const loanTypes = ['Personal', 'Emergency', 'Vehicle', 'Housing', 'Advance Salary', 'Other']

interface LoanForm {
  employeeId: string
  loanType: string
  principalAmount: number
  interestRate: number
  tenureMonths: number
  disbursementDate: string
  startDate: string
  createdBy: string
}

const emptyForm: LoanForm = {
  employeeId: '',
  loanType: 'Personal',
  principalAmount: 0,
  interestRate: 0,
  tenureMonths: 12,
  disbursementDate: new Date().toISOString().slice(0, 10),
  startDate: new Date().toISOString().slice(0, 10),
  createdBy: '',
}

export function LoansModule() {
  const [loans, setLoans] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<any>(null)
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null)
  const [form, setForm] = useState<LoanForm>({ ...emptyForm })
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { toast } = useToast()

  const fetchLoans = useCallback(async () => {
    try {
      const query = statusFilter ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/loans${query}`)
      const data = await res.json()
      setLoans(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load loans', variant: 'destructive' })
    }
  }, [statusFilter, toast])

  const fetchEmployees = useCallback(async () => {
    try {
      // Employees are fetched from the seed/api endpoint - use a minimal approach
      const res = await fetch('/api/seed')
      // Fallback: get employees from the payroll API which has employee data
      setEmployees([])
    } catch {
      // Ignore - employees may be loaded differently
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      fetchLoans()
    })
  }, [fetchLoans])

  const handleCreate = async () => {
    if (!form.employeeId || !form.loanType || form.principalAmount <= 0 || form.tenureMonths <= 0) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Created', description: 'Loan created with installment schedule' })
      setCreateDialogOpen(false)
      setForm({ ...emptyForm })
      fetchLoans()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDisburse = async (loan: any) => {
    try {
      const res = await fetch(`/api/loans?id=${loan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disburse', disbursedAmount: loan.principalAmount }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Disbursed', description: `Loan ${loan.loanNumber} has been disbursed` })
      fetchLoans()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleClose = async (loan: any) => {
    try {
      const res = await fetch(`/api/loans?id=${loan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Closed', description: `Loan ${loan.loanNumber} has been closed` })
      fetchLoans()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleWriteOff = async (loan: any) => {
    try {
      const res = await fetch(`/api/loans?id=${loan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'write_off' }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Written Off', description: `Loan ${loan.loanNumber} has been written off` })
      fetchLoans()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!selectedLoan) return
    try {
      const res = await fetch(`/api/loans?id=${selectedLoan.id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Deleted', description: 'Loan deleted successfully' })
      setDeleteDialogOpen(false)
      setSelectedLoan(null)
      fetchLoans()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // Summary stats
  const totalPrincipal = loans.reduce((s, l) => s + (l.principalAmount || 0), 0)
  const totalBalance = loans.reduce((s, l) => s + (l.balanceAmount || 0), 0)
  const activeLoans = loans.filter(l => l.status === 'active').length

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Principal</p>
                <p className="text-sm font-bold">{formatCurrency(totalPrincipal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Outstanding Balance</p>
                <p className="text-sm font-bold text-orange-600">{formatCurrency(totalBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Active Loans</p>
                <p className="text-sm font-bold">{activeLoans}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Landmark className="h-4 w-4" />Loan Management</h3>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="written_off">Written Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />New Loan
        </Button>
      </div>

      {/* Loans List */}
      {loans.map(loan => {
        const isExpanded = expandedLoan === loan.id
        return (
          <Card key={loan.id} className="group">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <CardTitle className="text-xs">{loan.loanNumber}</CardTitle>
                    <CardDescription className="text-[10px]">
                      {loan.employee?.name || loan.employeeId} | {loan.loanType} | {loan.tenureMonths} months
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-[9px] ${statusStyles[loan.status] || ''}`}>{loan.status}</Badge>
                  {!loan.isDisbursed && loan.status === 'active' && (
                    <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => handleDisburse(loan)}>
                      <DollarSign className="h-3 w-3 mr-1" />Disburse
                    </Button>
                  )}
                  {loan.isDisbursed && loan.status === 'active' && (
                    <>
                      <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => handleClose(loan)}>
                        <CheckCircle className="h-3 w-3 mr-1" />Close
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 text-[9px] px-2 text-red-600" onClick={() => handleWriteOff(loan)}>
                        <Ban className="h-3 w-3 mr-1" />Write Off
                      </Button>
                    </>
                  )}
                  {!loan.isDisbursed && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setSelectedLoan(loan); setDeleteDialogOpen(true) }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Principal</p>
                  <p className="text-xs font-bold">{formatCurrency(loan.principalAmount)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Interest Rate</p>
                  <p className="text-xs font-bold">{loan.interestRate}%</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Monthly Deduction</p>
                  <p className="text-xs font-bold">{formatCurrency(loan.monthlyDeduction)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Disbursed</p>
                  <p className="text-xs font-bold">{formatCurrency(loan.disbursedAmount)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Balance</p>
                  <p className="text-xs font-bold text-orange-600">{formatCurrency(loan.balanceAmount)}</p>
                </div>
              </div>

              {/* Installments Table */}
              {isExpanded && loan.installments?.length > 0 && (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-[10px]">#</TableHead>
                    <TableHead className="text-[10px]">Due Date</TableHead>
                    <TableHead className="text-[10px] text-right">Amount</TableHead>
                    <TableHead className="text-[10px] text-right">Principal</TableHead>
                    <TableHead className="text-[10px] text-right">Interest</TableHead>
                    <TableHead className="text-[10px] text-right">Paid</TableHead>
                    <TableHead className="text-[10px]">Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {loan.installments.map((inst: any) => (
                      <TableRow key={inst.id}>
                        <TableCell className="text-xs">{inst.installmentNo}</TableCell>
                        <TableCell className="text-xs">{formatDate(inst.dueDate)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(inst.amount)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(inst.principalPart)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(inst.interestPart)}</TableCell>
                        <TableCell className="text-xs text-right text-green-600">{inst.paidAmount > 0 ? formatCurrency(inst.paidAmount) : '-'}</TableCell>
                        <TableCell><Badge className={`text-[9px] ${installmentStatusStyles[inst.status] || ''}`}>{inst.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )
      })}

      {loans.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No loans found. Click &ldquo;New Loan&rdquo; to create one.</p>
      )}

      {/* Create Loan Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">Create New Loan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Employee ID *</Label><Input className="h-8 text-xs" value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} placeholder="Enter employee ID" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Loan Type *</Label>
                <Select value={form.loanType} onValueChange={v => setForm(p => ({ ...p, loanType: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{loanTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Principal Amount (PKR) *</Label><Input type="number" className="h-8 text-xs" value={form.principalAmount || ''} onChange={e => setForm(p => ({ ...p, principalAmount: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Interest Rate (%)</Label><Input type="number" step="0.1" className="h-8 text-xs" value={form.interestRate || ''} onChange={e => setForm(p => ({ ...p, interestRate: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Tenure (Months) *</Label><Input type="number" className="h-8 text-xs" value={form.tenureMonths || ''} onChange={e => setForm(p => ({ ...p, tenureMonths: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Disbursement Date *</Label><Input type="date" className="h-8 text-xs" value={form.disbursementDate} onChange={e => setForm(p => ({ ...p, disbursementDate: e.target.value }))} /></div>
              <div><Label className="text-xs">Deduction Start Date *</Label><Input type="date" className="h-8 text-xs" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate}>Create Loan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Loan</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete loan &ldquo;{selectedLoan?.loanNumber}&rdquo;? Only non-disbursed loans with no paid installments can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
