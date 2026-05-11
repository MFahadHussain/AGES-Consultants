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
import { ArrowLeftRight, Plus, Pencil, Trash2, Sprout, CheckCircle, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const COMPONENT_TYPES = [
  'SALARY_EXPENSE', 'ALLOWANCE_EXPENSE', 'INCOME_TAX_PAYABLE',
  'EOBI_EMPLOYEE', 'EOBI_EMPLOYER', 'PF_EMPLOYEE', 'PF_EMPLOYER',
  'SOCIAL_CHARGES', 'SALARY_PAYABLE', 'GRATUITY', 'LOAN_DEDUCTION', 'ADVANCE_DEDUCTION',
]

interface MappingForm {
  componentType: string
  debitAccountId: string
  creditAccountId: string
  description: string
  isActive: boolean
}

const emptyForm: MappingForm = {
  componentType: '',
  debitAccountId: '',
  creditAccountId: '',
  description: '',
  isActive: true,
}

export function PayrollGLMapping() {
  const [mappings, setMappings] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [seedDialogOpen, setSeedDialogOpen] = useState(false)
  const [selectedMapping, setSelectedMapping] = useState<any>(null)
  const [form, setForm] = useState<MappingForm>({ ...emptyForm })
  const { toast } = useToast()

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch('/api/payroll-gl-mapping')
      const data = await res.json()
      setMappings(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load payroll GL mappings', variant: 'destructive' })
    }
  }, [toast])

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts')
      const data = await res.json()
      setAccounts(Array.isArray(data) ? data : [])
    } catch {
      // Ignore - accounts may not be available
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      fetchMappings()
      fetchAccounts()
    })
  }, [fetchMappings, fetchAccounts])

  const handleCreate = async () => {
    if (!form.componentType) {
      toast({ title: 'Error', description: 'Component type is required', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/payroll-gl-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Created', description: 'Payroll GL mapping created' })
      setCreateDialogOpen(false)
      setForm({ ...emptyForm })
      fetchMappings()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleEdit = async () => {
    if (!selectedMapping) return
    try {
      const res = await fetch(`/api/payroll-gl-mapping?id=${selectedMapping.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Updated', description: 'Payroll GL mapping updated' })
      setEditDialogOpen(false)
      setSelectedMapping(null)
      fetchMappings()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!selectedMapping) return
    try {
      const res = await fetch(`/api/payroll-gl-mapping?id=${selectedMapping.id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Deleted', description: 'Payroll GL mapping deleted' })
      setDeleteDialogOpen(false)
      setSelectedMapping(null)
      fetchMappings()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleSeedDefaults = async () => {
    try {
      const res = await fetch('/api/payroll-gl-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed-defaults' }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      const result = await res.json()
      toast({ title: 'Seeded', description: `${result.created} created, ${result.skipped} skipped` })
      setSeedDialogOpen(false)
      fetchMappings()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const openEdit = (mapping: any) => {
    setSelectedMapping(mapping)
    setForm({
      componentType: mapping.componentType,
      debitAccountId: mapping.debitAccountId || '',
      creditAccountId: mapping.creditAccountId || '',
      description: mapping.description || '',
      isActive: mapping.isActive,
    })
    setEditDialogOpen(true)
  }

  const activeMappings = mappings.filter(m => m.isActive).length
  const configuredMappings = mappings.filter(m => m.debitAccountId || m.creditAccountId).length

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Mappings</p>
                <p className="text-sm font-bold">{mappings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Configured (with Accounts)</p>
                <p className="text-sm font-bold">{configuredMappings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Sprout className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Active</p>
                <p className="text-sm font-bold">{activeMappings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Info */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardContent className="p-4">
          <h4 className="text-xs font-semibold mb-2">Payroll → GL Mapping</h4>
          <p className="text-[10px] text-muted-foreground">
            Configure debit and credit GL accounts for each payroll component. These mappings are used when posting payroll to the General Ledger.
          </p>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" />Payroll GL Mapping</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSeedDialogOpen(true)}>
            <Sprout className="h-3.5 w-3.5 mr-1" />Seed Defaults
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />New Mapping
          </Button>
        </div>
      </div>

      {/* Mappings Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-[10px]">Component Type</TableHead>
              <TableHead className="text-[10px]">Debit Account</TableHead>
              <TableHead className="text-[10px]">Credit Account</TableHead>
              <TableHead className="text-[10px]">Description</TableHead>
              <TableHead className="text-[10px]">Status</TableHead>
              <TableHead className="text-[10px] text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {mappings.map(mapping => (
                <TableRow key={mapping.id}>
                  <TableCell className="text-xs font-medium font-mono">{mapping.componentType}</TableCell>
                  <TableCell className="text-xs">
                    {mapping.debitAccount
                      ? <span className="text-green-700">{mapping.debitAccount.code} - {mapping.debitAccount.name}</span>
                      : <span className="text-muted-foreground">Not configured</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {mapping.creditAccount
                      ? <span className="text-blue-700">{mapping.creditAccount.code} - {mapping.creditAccount.name}</span>
                      : <span className="text-muted-foreground">Not configured</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-48 truncate">{mapping.description || '-'}</TableCell>
                  <TableCell>
                    <Badge className={`text-[9px] ${mapping.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {mapping.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(mapping)}>
                        <Pencil className="h-3 w-3 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedMapping(mapping); setDeleteDialogOpen(true) }}>
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          {mappings.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No mappings found. Click &ldquo;Seed Defaults&rdquo; to create default mappings.</p>}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Create Payroll GL Mapping</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Component Type *</Label>
              <Select value={form.componentType} onValueChange={v => setForm(p => ({ ...p, componentType: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select component type" /></SelectTrigger>
                <SelectContent>{COMPONENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Debit Account</Label>
              <Select value={form.debitAccountId} onValueChange={v => setForm(p => ({ ...p, debitAccountId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select debit account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Credit Account</Label>
              <Select value={form.creditAccountId} onValueChange={v => setForm(p => ({ ...p, creditAccountId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select credit account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Description</Label><Input className="h-8 text-xs" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
              <Label className="text-xs">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Edit Payroll GL Mapping</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Component Type</Label>
              <Input className="h-8 text-xs" value={form.componentType} onChange={e => setForm(p => ({ ...p, componentType: e.target.value }))} />
            </div>
            <div><Label className="text-xs">Debit Account</Label>
              <Select value={form.debitAccountId || '_none'} onValueChange={v => setForm(p => ({ ...p, debitAccountId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select debit account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Credit Account</Label>
              <Select value={form.creditAccountId || '_none'} onValueChange={v => setForm(p => ({ ...p, creditAccountId: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select credit account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Description</Label><Input className="h-8 text-xs" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
              <Label className="text-xs">Active</Label>
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
            <AlertDialogTitle className="text-sm">Delete Mapping</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete the mapping for &ldquo;{selectedMapping?.componentType}&rdquo;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Seed Defaults Confirmation */}
      <AlertDialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Seed Default Mappings</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will create default payroll GL mappings for the following component types: SALARY_EXPENSE, ALLOWANCE_EXPENSE, INCOME_TAX_PAYABLE, EOBI_EMPLOYEE, EOBI_EMPLOYER, PF_EMPLOYEE, PF_EMPLOYER, SOCIAL_CHARGES, SALARY_PAYABLE, GRATUITY, LOAN_DEDUCTION, ADVANCE_DEDUCTION. Existing mappings will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8" onClick={handleSeedDefaults}><Sprout className="h-3 w-3 mr-1" />Seed Defaults</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
