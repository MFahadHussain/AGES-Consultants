'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, AlertTriangle, Pencil, Trash2, CheckCircle, XCircle, Play, Eye } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

const statusStyles: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  approved: 'bg-blue-100 text-blue-800 border-blue-300',
  active: 'bg-green-100 text-green-800 border-green-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
}

export function BudgetManagement() {
  const [budgets, setBudgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [financialYears, setFinancialYears] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [donors, setDonors] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('list')
  const [form, setForm] = useState({ name: '', financialYearId: '', projectId: '', donorId: '', period: 'ANNUAL', lines: [{ accountId: '', budgetAmount: 0 }] as any[] })
  const [editForm, setEditForm] = useState({ name: '', financialYearId: '', projectId: '', donorId: '', period: 'ANNUAL', lines: [{ accountId: '', budgetAmount: 0 }] as any[] })
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/budgets')
      setBudgets(await res.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchData()
      fetch('/api/accounts?accountType=EXPENSE').then(r => r.json()).then(d => setAccounts(Array.isArray(d) ? d : []))
      fetch('/api/financial-year').then(r => r.json()).then(d => setFinancialYears(Array.isArray(d) ? d : []))
      fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []))
      fetch('/api/donors').then(r => r.json()).then(d => setDonors(Array.isArray(d) ? d : []))
    })
  }, [])

  const handleCreate = async () => {
    if (!form.name || !form.financialYearId) { toast({ title: 'Error', description: 'Name and financial year required', variant: 'destructive' }); return }
    try {
      await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      toast({ title: 'Created', description: 'Budget created' })
      setDialogOpen(false)
      setForm({ name: '', financialYearId: '', projectId: '', donorId: '', period: 'ANNUAL', lines: [{ accountId: '', budgetAmount: 0 }] })
      fetchData()
    } catch { toast({ title: 'Error', description: 'Failed to create budget', variant: 'destructive' }) }
  }

  const handleEdit = (budget: any) => {
    setSelectedBudget(budget)
    setEditForm({
      name: budget.name,
      financialYearId: budget.financialYearId,
      projectId: budget.projectId || '',
      donorId: budget.donorId || '',
      period: budget.period || 'ANNUAL',
      lines: budget.lines?.map((l: any) => ({ accountId: l.accountId, budgetAmount: l.budgetAmount, id: l.id })) || [{ accountId: '', budgetAmount: 0 }],
    })
    setEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedBudget || !editForm.name) { toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return }
    try {
      const res = await fetch(`/api/budgets?id=${selectedBudget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Updated', description: 'Budget updated successfully' })
      setEditDialogOpen(false)
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to update budget', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!selectedBudget) return
    try {
      const res = await fetch(`/api/budgets?id=${selectedBudget.id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Deleted', description: 'Budget deleted successfully' })
      setDeleteDialogOpen(false)
      setSelectedBudget(null)
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleStatusChange = async (budgetId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/budgets?id=${budgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Status Updated', description: `Budget ${newStatus}` })
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // Summary stats
  const totalBudget = budgets.reduce((s, b) => s + b.totalAmount, 0)
  const totalActual = budgets.reduce((s, b) => s + (b.lines?.reduce((ls: number, l: any) => ls + (l.actualAmount || 0), 0) || 0), 0)
  const totalVariance = totalBudget - totalActual

  const renderFormLines = (lines: any[], setLines: (l: any[]) => void, isEdit: boolean = false) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Budget Lines</Label>
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setLines([...lines, { accountId: '', budgetAmount: 0 }])}><Plus className="h-3 w-3 mr-1" />Add Line</Button>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1.5">
        {lines.map((line, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-8">
              <Select value={line.accountId} onValueChange={v => setLines(lines.map((l, idx) => idx === i ? { ...l, accountId: v } : l))}>
                <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-3"><Input type="number" className="h-7 text-[10px]" placeholder="Amount" value={line.budgetAmount || ''} onChange={e => setLines(lines.map((l, idx) => idx === i ? { ...l, budgetAmount: parseFloat(e.target.value) || 0 } : l))} /></div>
            <div className="col-span-1">{lines.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>×</Button>}</div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderFormFields = (f: typeof form, setF: typeof setForm, isEdit: boolean = false) => (
    <div className="space-y-3">
      <div><Label className="text-xs">Budget Name *</Label><Input className="h-8 text-xs" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Financial Year *</Label>
          <Select value={f.financialYearId} onValueChange={v => setF(p => ({ ...p, financialYearId: v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select FY" /></SelectTrigger>
            <SelectContent>{financialYears.filter((fy: any) => fy.status === 'open').map((fy: any) => <SelectItem key={fy.id} value={fy.id}>{fy.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Project</Label>
          <Select value={f.projectId} onValueChange={v => setF(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Donor</Label>
          <Select value={f.donorId} onValueChange={v => setF(p => ({ ...p, donorId: v === '_none' ? '' : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {donors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Period</Label>
        <Select value={f.period} onValueChange={v => setF(p => ({ ...p, period: v }))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
            <SelectItem value="ANNUAL">Annual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {renderFormLines(f.lines, (lines) => setF(p => ({ ...p, lines })), isEdit)}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total Budget</p>
            <p className="text-sm font-bold">{formatCurrency(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total Actual</p>
            <p className="text-sm font-bold">{formatCurrency(totalActual)}</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${totalVariance >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total Variance</p>
            <p className={`text-sm font-bold ${totalVariance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(totalVariance)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="h-8">
            <TabsTrigger value="list" className="text-xs h-7">Budget List</TabsTrigger>
            <TabsTrigger value="vs-actual" className="text-xs h-7">Budget vs Actual</TabsTrigger>
          </TabsList>
          <Button size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />New Budget
          </Button>
        </div>

        <TabsContent value="list" className="space-y-4 mt-3">
          {budgets.map(budget => {
            const totalActualForBudget = budget.lines?.reduce((s: number, l: any) => s + (l.actualAmount || 0), 0) || 0
            const variance = budget.totalAmount - totalActualForBudget
            const utilization = budget.totalAmount > 0 ? (totalActualForBudget / budget.totalAmount) * 100 : 0

            return (
              <Card key={budget.id} className="group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle className="text-xs">{budget.name}</CardTitle>
                        <CardDescription className="text-[10px]">
                          {budget.project?.name && `Project: ${budget.project.name} | `}FY: {budget.financialYear?.name} | {budget.period}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] border ${statusStyles[budget.status] || ''}`}>{budget.status}</Badge>
                      {/* Approval workflow buttons */}
                      {budget.status === 'draft' && (
                        <>
                          <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => handleStatusChange(budget.id, 'approved')}>
                            <CheckCircle className="h-3 w-3 mr-1 text-blue-600" />Approve
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => handleStatusChange(budget.id, 'rejected')}>
                            <XCircle className="h-3 w-3 mr-1 text-red-600" />Reject
                          </Button>
                        </>
                      )}
                      {budget.status === 'approved' && (
                        <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => handleStatusChange(budget.id, 'active')}>
                          <Play className="h-3 w-3 mr-1 text-green-600" />Activate
                        </Button>
                      )}
                      {budget.status === 'rejected' && (
                        <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" onClick={() => handleStatusChange(budget.id, 'draft')}>
                          Re-submit
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEdit(budget)}>
                        <Pencil className="h-3.5 w-3.5 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setSelectedBudget(budget); setDeleteDialogOpen(true) }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center p-2 rounded bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">Budget Amount</p>
                      <p className="text-xs font-bold">{formatCurrency(budget.totalAmount)}</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">Actual</p>
                      <p className="text-xs font-bold">{formatCurrency(totalActualForBudget)}</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">Variance</p>
                      <p className={`text-xs font-bold ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(variance)}</p>
                    </div>
                  </div>
                  {budget.lines?.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Account</TableHead>
                          <TableHead className="text-[10px] text-right">Budget</TableHead>
                          <TableHead className="text-[10px] text-right">Actual</TableHead>
                          <TableHead className="text-[10px] text-right">Variance</TableHead>
                          <TableHead className="text-[10px] w-32">Utilization</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {budget.lines.map((line: any) => {
                          const lineVariance = line.budgetAmount - line.actualAmount
                          const lineUtilization = line.budgetAmount > 0 ? (line.actualAmount / line.budgetAmount) * 100 : 0
                          return (
                            <TableRow key={line.id}>
                              <TableCell className="text-xs">{line.account?.code} - {line.account?.name}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(line.budgetAmount)}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(line.actualAmount)}</TableCell>
                              <TableCell className={`text-xs text-right ${lineVariance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(lineVariance)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={Math.min(lineUtilization, 100)} className="h-2" />
                                  <span className={`text-[10px] ${lineUtilization > 100 ? 'text-red-600 font-bold' : ''}`}>{lineUtilization.toFixed(0)}%</span>
                                </div>
                                {lineUtilization > 100 && <div className="flex items-center gap-1 mt-0.5"><AlertTriangle className="h-3 w-3 text-red-500" /><span className="text-[9px] text-red-600">Budget overrun!</span></div>}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {!loading && budgets.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No budgets defined</p>}
        </TabsContent>

        <TabsContent value="vs-actual" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" />Budget vs Actual Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {budgets.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No budgets to compare</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Budget</TableHead>
                      <TableHead className="text-[10px]">Account</TableHead>
                      <TableHead className="text-[10px] text-right">Budgeted</TableHead>
                      <TableHead className="text-[10px] text-right">Actual (from Vouchers)</TableHead>
                      <TableHead className="text-[10px] text-right">Variance</TableHead>
                      <TableHead className="text-[10px] text-right">Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgets.flatMap(budget =>
                      (budget.lines || []).map((line: any) => {
                        const lineVariance = line.budgetAmount - line.actualAmount
                        const lineUtilization = line.budgetAmount > 0 ? (line.actualAmount / line.budgetAmount) * 100 : 0
                        return (
                          <TableRow key={`${budget.id}-${line.id}`}>
                            <TableCell className="text-xs font-medium">{budget.name}</TableCell>
                            <TableCell className="text-xs">{line.account?.code} - {line.account?.name}</TableCell>
                            <TableCell className="text-xs text-right">{formatCurrency(line.budgetAmount)}</TableCell>
                            <TableCell className="text-xs text-right">{formatCurrency(line.actualAmount)}</TableCell>
                            <TableCell className={`text-xs text-right font-semibold ${lineVariance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(lineVariance)}</TableCell>
                            <TableCell className="text-xs text-right">
                              <span className={`${lineUtilization > 100 ? 'text-red-600 font-bold' : lineUtilization > 80 ? 'text-amber-600 font-semibold' : ''}`}>
                                {Math.round(lineUtilization)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Budget Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-sm">Create Budget</DialogTitle></DialogHeader>
          {renderFormFields(form, setForm)}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Budget Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-sm">Edit Budget</DialogTitle></DialogHeader>
          {renderFormFields(editForm, setEditForm, true)}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Budget</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete &ldquo;{selectedBudget?.name}&rdquo;? This action cannot be undone. All budget lines will also be deleted.
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
