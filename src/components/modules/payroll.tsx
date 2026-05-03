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
import { Banknote, ArrowRight, CheckCircle, Plus, Pencil, Trash2, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

const statusStyles: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  posted: 'bg-emerald-100 text-emerald-800',
}

interface PayrollLineForm {
  employeeName: string
  employeeId: string
  basicSalary: number
  allowances: number
  incomeTax: number
  eobiDeduction: number
  providentFund: number
  loanDeduction: number
  otherDeductions: number
  employerEOBI: number
  employerPF: number
  projectId: string
  department: string
}

const emptyLineForm: PayrollLineForm = {
  employeeName: '',
  employeeId: '',
  basicSalary: 0,
  allowances: 0,
  incomeTax: 0,
  eobiDeduction: 0,
  providentFund: 0,
  loanDeduction: 0,
  otherDeductions: 0,
  employerEOBI: 0,
  employerPF: 0,
  projectId: '',
  department: '',
}

function computeLineTotals(line: PayrollLineForm) {
  const grossSalary = (line.basicSalary || 0) + (line.allowances || 0)
  const totalDeductions = (line.incomeTax || 0) + (line.eobiDeduction || 0) + (line.providentFund || 0) + (line.loanDeduction || 0) + (line.otherDeductions || 0)
  const netPay = grossSalary - totalDeductions
  return { grossSalary, totalDeductions, netPay }
}

export function PayrollIntegration() {
  const [batches, setBatches] = useState<any[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editBatchDialogOpen, setEditBatchDialogOpen] = useState(false)
  const [addLineDialogOpen, setAddLineDialogOpen] = useState(false)
  const [editLineDialogOpen, setEditLineDialogOpen] = useState(false)
  const [deleteBatchDialogOpen, setDeleteBatchDialogOpen] = useState(false)
  const [deleteLineDialogOpen, setDeleteLineDialogOpen] = useState(false)
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<any>(null)
  const [selectedLine, setSelectedLine] = useState<any>(null)
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [financialYears, setFinancialYears] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('batches')
  const { toast } = useToast()

  // Create batch form
  const [batchForm, setBatchForm] = useState({
    name: '',
    period: new Date().toISOString().slice(0, 7),
    projectId: '',
  })

  // Add/Edit line form
  const [lineForm, setLineForm] = useState<PayrollLineForm>({ ...emptyLineForm })

  // Edit batch form
  const [editBatchForm, setEditBatchForm] = useState({
    name: '',
    period: '',
    projectId: '',
  })

  const fetchData = async () => {
    try {
      const res = await fetch('/api/payroll')
      setBatches(await res.json())
    } catch {
      toast({ title: 'Error', description: 'Failed to load payroll batches', variant: 'destructive' })
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchData()
      fetch('/api/financial-year').then(r => r.json()).then(d => setFinancialYears(Array.isArray(d) ? d : []))
      fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []))
    })
  }, [])

  // Summary stats across all batches
  const summaryTotals = batches.reduce(
    (acc, b) => ({
      totalGross: acc.totalGross + (b.totalGross || 0),
      totalDeductions: acc.totalDeductions + (b.totalDeductions || 0),
      totalNetPay: acc.totalNetPay + (b.totalNetPay || 0),
    }),
    { totalGross: 0, totalDeductions: 0, totalNetPay: 0 }
  )

  const handleCreateBatch = async () => {
    if (!batchForm.name || !batchForm.period) {
      toast({ title: 'Error', description: 'Batch name and period required', variant: 'destructive' })
      return
    }
    try {
      const batchNumber = `PAY-${batchForm.period.replace('-', '')}-${String(batches.length + 1).padStart(3, '0')}`
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchNumber,
          name: batchForm.name,
          period: batchForm.period,
          projectId: batchForm.projectId || null,
          lines: [],
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Created', description: 'Payroll batch created' })
      setCreateDialogOpen(false)
      setBatchForm({ name: '', period: new Date().toISOString().slice(0, 7), projectId: '' })
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
          line: {
            ...lineForm,
            projectId: lineForm.projectId || null,
          },
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Added', description: 'Employee line added' })
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
          line: {
            ...lineForm,
            projectId: lineForm.projectId || null,
          },
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
      toast({ title: 'Deleted', description: 'Employee line deleted' })
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
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleEditBatch = (batch: any) => {
    setSelectedBatch(batch)
    setEditBatchForm({
      name: batch.name || batch.batchNumber,
      period: batch.period,
      projectId: batch.projectId || '',
    })
    setEditBatchDialogOpen(true)
  }

  const handleUpdateBatch = async () => {
    if (!selectedBatch) return
    try {
      const res = await fetch(`/api/payroll?id=${selectedBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editBatchForm),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Updated', description: 'Batch updated' })
      setEditBatchDialogOpen(false)
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handlePostToGL = async () => {
    if (!selectedBatch) return
    const fy = financialYears.find((f: any) => f.status === 'open')
    if (!fy) { toast({ title: 'Error', description: 'No open financial year', variant: 'destructive' }); return }

    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post-to-gl', batchId: selectedBatch.id, financialYearId: fy.id }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Posted to GL', description: `Voucher ${result.voucherNumber} created` })
      setPostDialogOpen(false)
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
      employeeName: line.employeeName || '',
      employeeId: line.employeeId || '',
      basicSalary: line.basicSalary || 0,
      allowances: line.allowances || 0,
      incomeTax: line.incomeTax || 0,
      eobiDeduction: line.eobiDeduction || 0,
      providentFund: line.providentFund || 0,
      loanDeduction: line.loanDeduction || 0,
      otherDeductions: line.otherDeductions || 0,
      employerEOBI: line.employerEOBI || 0,
      employerPF: line.employerPF || 0,
      projectId: line.projectId || '',
      department: line.department || '',
    })
    setEditLineDialogOpen(true)
  }

  const lineFormTotals = computeLineTotals(lineForm)

  const renderLineFormFields = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Employee Name *</Label><Input className="h-8 text-xs" value={lineForm.employeeName} onChange={e => setLineForm(p => ({ ...p, employeeName: e.target.value }))} /></div>
        <div><Label className="text-xs">Employee ID</Label><Input className="h-8 text-xs" value={lineForm.employeeId} onChange={e => setLineForm(p => ({ ...p, employeeId: e.target.value }))} placeholder="Auto-generated if empty" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Basic Salary (PKR)</Label><Input type="number" className="h-8 text-xs" value={lineForm.basicSalary || ''} onChange={e => setLineForm(p => ({ ...p, basicSalary: parseFloat(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Allowances (PKR)</Label><Input type="number" className="h-8 text-xs" value={lineForm.allowances || ''} onChange={e => setLineForm(p => ({ ...p, allowances: parseFloat(e.target.value) || 0 }))} /></div>
      </div>
      <div className="p-2 rounded bg-muted/50">
        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Gross Salary:</span><span className="font-semibold">{formatCurrency(lineFormTotals.grossSalary)}</span></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Income Tax</Label><Input type="number" className="h-8 text-xs" value={lineForm.incomeTax || ''} onChange={e => setLineForm(p => ({ ...p, incomeTax: parseFloat(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">EOBI Deduction</Label><Input type="number" className="h-8 text-xs" value={lineForm.eobiDeduction || ''} onChange={e => setLineForm(p => ({ ...p, eobiDeduction: parseFloat(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Provident Fund</Label><Input type="number" className="h-8 text-xs" value={lineForm.providentFund || ''} onChange={e => setLineForm(p => ({ ...p, providentFund: parseFloat(e.target.value) || 0 }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Loan Deduction</Label><Input type="number" className="h-8 text-xs" value={lineForm.loanDeduction || ''} onChange={e => setLineForm(p => ({ ...p, loanDeduction: parseFloat(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Other Deductions</Label><Input type="number" className="h-8 text-xs" value={lineForm.otherDeductions || ''} onChange={e => setLineForm(p => ({ ...p, otherDeductions: parseFloat(e.target.value) || 0 }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Employer EOBI</Label><Input type="number" className="h-8 text-xs" value={lineForm.employerEOBI || ''} onChange={e => setLineForm(p => ({ ...p, employerEOBI: parseFloat(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Employer PF</Label><Input type="number" className="h-8 text-xs" value={lineForm.employerPF || ''} onChange={e => setLineForm(p => ({ ...p, employerPF: parseFloat(e.target.value) || 0 }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Project (Cross-charge)</Label>
          <Select value={lineForm.projectId} onValueChange={v => setLineForm(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Department</Label><Input className="h-8 text-xs" value={lineForm.department} onChange={e => setLineForm(p => ({ ...p, department: e.target.value }))} /></div>
      </div>
      <div className="p-3 rounded-lg bg-muted/50 space-y-1 border">
        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Gross Salary:</span><span className="font-medium">{formatCurrency(lineFormTotals.grossSalary)}</span></div>
        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total Deductions:</span><span className="font-medium text-red-600">{formatCurrency(lineFormTotals.totalDeductions)}</span></div>
        <div className="flex justify-between text-xs font-bold border-t pt-1"><span>Net Pay:</span><span className="text-green-600">{formatCurrency(lineFormTotals.netPay)}</span></div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Gross Pay</p>
                <p className="text-sm font-bold">{formatCurrency(summaryTotals.totalGross)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Deductions</p>
                <p className="text-sm font-bold text-red-600">{formatCurrency(summaryTotals.totalDeductions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Net Pay</p>
                <p className="text-sm font-bold text-green-600">{formatCurrency(summaryTotals.totalNetPay)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Info */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardContent className="p-4">
          <h4 className="text-xs font-semibold mb-2">Payroll → GL Integration Touchpoints</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Salary expense posts to Basic Salary account</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Net pay reduces Bank account</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Income tax creates Income Tax Payable</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>EOBI deducted creates EOBI Payable</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Provident Fund deducted creates PF Payable</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Employer social charges post to Social Charges</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Header with New Batch button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" />Payroll Batches</h3>
        <Button size="sm" className="h-8 text-xs" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />New Batch
        </Button>
      </div>

      {/* Payroll Batches */}
      {batches.map(batch => {
        const isExpanded = expandedBatch === batch.id
        return (
          <Card key={batch.id} className="group">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <CardTitle className="text-xs">{batch.name || batch.batchNumber}</CardTitle>
                    <CardDescription className="text-[10px]">
                      {batch.batchNumber} | Period: {batch.period} | {batch.lines?.length || 0} employees
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {batch.postedToGL && <Badge className="text-[9px] bg-purple-100 text-purple-800"><CheckCircle className="h-3 w-3 mr-1" />Posted to GL</Badge>}
                  <Badge className={`text-[9px] ${statusStyles[batch.status] || ''}`}>{batch.status}</Badge>
                  {!batch.postedToGL && (
                    <>
                      <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => openAddLineDialog(batch)}>
                        <Plus className="h-3 w-3 mr-1" />Add Line
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => { setSelectedBatch(batch); setPostDialogOpen(true) }}>
                        Post to GL
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEditBatch(batch)}>
                        <Pencil className="h-3.5 w-3.5 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setSelectedBatch(batch); setDeleteBatchDialogOpen(true) }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Batch summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Gross Salary</p>
                  <p className="text-xs font-bold">{formatCurrency(batch.totalGross)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Deductions</p>
                  <p className="text-xs font-bold text-red-600">{formatCurrency(batch.totalDeductions)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Net Pay</p>
                  <p className="text-xs font-bold text-green-600">{formatCurrency(batch.totalNetPay)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Employer Charges</p>
                  <p className="text-xs font-bold">{formatCurrency(batch.totalEmployerCharges)}</p>
                </div>
              </div>

              {/* Employee Lines Table (always visible) */}
              {batch.lines?.length > 0 && (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-[10px]">Employee</TableHead>
                    <TableHead className="text-[10px] text-right">Basic</TableHead>
                    <TableHead className="text-[10px] text-right">Allowances</TableHead>
                    <TableHead className="text-[10px] text-right">Gross</TableHead>
                    <TableHead className="text-[10px] text-right">Tax</TableHead>
                    <TableHead className="text-[10px] text-right">EOBI</TableHead>
                    <TableHead className="text-[10px] text-right">PF</TableHead>
                    <TableHead className="text-[10px] text-right">Net Pay</TableHead>
                    <TableHead className="text-[10px]">Project</TableHead>
                    {!batch.postedToGL && <TableHead className="text-[10px] text-right">Actions</TableHead>}
                  </TableRow></TableHeader>
                  <TableBody>
                    {batch.lines.map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell className="text-xs">
                          <div>
                            <span className="font-medium">{line.employeeName}</span>
                            <span className="text-[9px] text-muted-foreground ml-1">({line.employeeId})</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(line.basicSalary || 0)}</TableCell>
                        <TableCell className="text-xs text-right">{line.allowances > 0 ? formatCurrency(line.allowances) : '-'}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(line.grossSalary)}</TableCell>
                        <TableCell className="text-xs text-right text-red-600">{line.incomeTax > 0 ? formatCurrency(line.incomeTax) : '-'}</TableCell>
                        <TableCell className="text-xs text-right text-red-600">{line.eobiDeduction > 0 ? formatCurrency(line.eobiDeduction) : '-'}</TableCell>
                        <TableCell className="text-xs text-right text-red-600">{line.providentFund > 0 ? formatCurrency(line.providentFund) : '-'}</TableCell>
                        <TableCell className="text-xs text-right font-semibold text-green-600">{formatCurrency(line.netPay)}</TableCell>
                        <TableCell className="text-xs">{line.projectId ? 'Cross-charged' : '-'}</TableCell>
                        {!batch.postedToGL && (
                          <TableCell className="text-right">
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
                    ))}
                  </TableBody>
                </Table>
              )}
              {(!batch.lines || batch.lines.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">No employees added yet. Click &ldquo;Add Line&rdquo; to add employee payroll entries.</p>
              )}
            </CardContent>
          </Card>
        )
      })}

      {batches.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No payroll batches. Click &ldquo;New Batch&rdquo; to create one.</p>
      )}

      {/* Create Batch Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Create Payroll Batch</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Batch Name *</Label><Input className="h-8 text-xs" value={batchForm.name} onChange={e => setBatchForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., January 2025 Payroll" /></div>
            <div><Label className="text-xs">Period (Month/Year) *</Label><Input type="month" className="h-8 text-xs" value={batchForm.period} onChange={e => setBatchForm(p => ({ ...p, period: e.target.value }))} /></div>
            <div><Label className="text-xs">Project</Label>
              <Select value={batchForm.projectId} onValueChange={v => setBatchForm(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
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

      {/* Edit Batch Dialog */}
      <Dialog open={editBatchDialogOpen} onOpenChange={setEditBatchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Edit Payroll Batch</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Batch Name</Label><Input className="h-8 text-xs" value={editBatchForm.name} onChange={e => setEditBatchForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label className="text-xs">Period</Label><Input type="month" className="h-8 text-xs" value={editBatchForm.period} onChange={e => setEditBatchForm(p => ({ ...p, period: e.target.value }))} /></div>
            <div><Label className="text-xs">Project</Label>
              <Select value={editBatchForm.projectId} onValueChange={v => setEditBatchForm(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditBatchDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdateBatch}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Line Dialog */}
      <Dialog open={addLineDialogOpen} onOpenChange={setAddLineDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm">Add Employee to Batch</DialogTitle></DialogHeader>
          {renderLineFormFields()}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddLineDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddLine}>Add Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Line Dialog */}
      <Dialog open={editLineDialogOpen} onOpenChange={setEditLineDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm">Edit Employee Line</DialogTitle></DialogHeader>
          {renderLineFormFields()}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditLineDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdateLine}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Post to GL Confirmation */}
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Post Payroll to General Ledger</DialogTitle></DialogHeader>
          <p className="text-[10px] text-muted-foreground">This will create journal entries in the General Ledger for:</p>
          <ul className="text-[10px] text-muted-foreground list-disc pl-4 space-y-1">
            <li>Salary expense (debit) and Bank payment (credit)</li>
            <li>Deductions: Income Tax, EOBI, Provident Fund (credit to payables)</li>
            <li>Employer social charges: EOBI + PF contributions</li>
          </ul>
          {selectedBatch && (
            <div className="p-3 rounded bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span>Batch:</span><strong>{selectedBatch.name || selectedBatch.batchNumber}</strong></div>
              <div className="flex justify-between"><span>Total Amount:</span><strong>{formatCurrency(selectedBatch.totalGross + selectedBatch.totalEmployerCharges)}</strong></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPostDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handlePostToGL}><Banknote className="h-3.5 w-3.5 mr-1" />Post to GL</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
