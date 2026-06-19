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
import { Calculator, Plus, Pencil, Trash2, Percent, IndianRupee } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

interface TaxSlabForm {
  fiscalYear: string
  slabOrder: number
  minAmount: number
  maxAmount: number | null
  fixedAmount: number
  rate: number
  isActive: boolean
}

const emptyForm: TaxSlabForm = {
  fiscalYear: '2024-25',
  slabOrder: 1,
  minAmount: 0,
  maxAmount: null,
  fixedAmount: 0,
  rate: 0,
  isActive: true,
}

export function TaxSlabsModule() {
  const [slabs, setSlabs] = useState<any[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [calcDialogOpen, setCalcDialogOpen] = useState(false)
  const [selectedSlab, setSelectedSlab] = useState<any>(null)
  const [form, setForm] = useState<TaxSlabForm>({ ...emptyForm })
  const [fiscalYearFilter, setFiscalYearFilter] = useState<string>('')
  const [calcResult, setCalcResult] = useState<any>(null)
  const [calcForm, setCalcForm] = useState({ annualIncome: 0, fiscalYear: '2024-25' })
  const { toast } = useToast()

  const fetchSlabs = useCallback(async () => {
    try {
      const query = fiscalYearFilter ? `?fiscalYear=${fiscalYearFilter}` : ''
      const res = await fetch(`/api/tax-slabs${query}`)
      const data = await res.json()
      setSlabs(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load tax slabs', variant: 'destructive' })
    }
  }, [fiscalYearFilter, toast])

  useEffect(() => {
    queueMicrotask(() => { fetchSlabs() })
  }, [fetchSlabs])

  const fiscalYears = [...new Set(slabs.map(s => s.fiscalYear))]

  const handleCreate = async () => {
    if (!form.fiscalYear || form.slabOrder <= 0) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/tax-slabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Created', description: 'Tax slab created successfully' })
      setCreateDialogOpen(false)
      setForm({ ...emptyForm })
      fetchSlabs()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleEdit = async () => {
    if (!selectedSlab) return
    try {
      const res = await fetch(`/api/tax-slabs?id=${selectedSlab.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Updated', description: 'Tax slab updated' })
      setEditDialogOpen(false)
      setSelectedSlab(null)
      fetchSlabs()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!selectedSlab) return
    try {
      const res = await fetch(`/api/tax-slabs?id=${selectedSlab.id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Deleted', description: 'Tax slab deleted' })
      setDeleteDialogOpen(false)
      setSelectedSlab(null)
      fetchSlabs()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleCalculate = async () => {
    if (calcForm.annualIncome <= 0 || !calcForm.fiscalYear) {
      toast({ title: 'Error', description: 'Please enter annual income and fiscal year', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/tax-slabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate-tax', ...calcForm }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      const result = await res.json()
      setCalcResult(result)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const openEdit = (slab: any) => {
    setSelectedSlab(slab)
    setForm({
      fiscalYear: slab.fiscalYear,
      slabOrder: slab.slabOrder,
      minAmount: slab.minAmount,
      maxAmount: slab.maxAmount,
      fixedAmount: slab.fixedAmount,
      rate: slab.rate,
      isActive: slab.isActive,
    })
    setEditDialogOpen(true)
  }

  const activeSlabs = slabs.filter(s => s.isActive).length

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Slabs</p>
                <p className="text-sm font-bold">{slabs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#0F2D78]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[#1E3C87]" />
              <div>
                <p className="text-[10px] text-muted-foreground">Active Slabs</p>
                <p className="text-sm font-bold">{activeSlabs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Fiscal Years</p>
                <p className="text-sm font-bold">{fiscalYears.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Calculator className="h-4 w-4" />Tax Slabs</h3>
          <Select value={fiscalYearFilter} onValueChange={setFiscalYearFilter}>
            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="All Fiscal Years" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Fiscal Years</SelectItem>
              {fiscalYears.map(fy => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCalcDialogOpen(true)}>
            <Calculator className="h-3.5 w-3.5 mr-1" />Calculate Tax
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />New Slab
          </Button>
        </div>
      </div>

      {/* Slabs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-[10px]">Fiscal Year</TableHead>
              <TableHead className="text-[10px]">Order</TableHead>
              <TableHead className="text-[10px] text-right">Min Amount</TableHead>
              <TableHead className="text-[10px] text-right">Max Amount</TableHead>
              <TableHead className="text-[10px] text-right">Fixed Amount</TableHead>
              <TableHead className="text-[10px] text-right">Rate (%)</TableHead>
              <TableHead className="text-[10px]">Status</TableHead>
              <TableHead className="text-[10px] text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {slabs.map(slab => (
                <TableRow key={slab.id}>
                  <TableCell className="text-xs font-medium">{slab.fiscalYear}</TableCell>
                  <TableCell className="text-xs">{slab.slabOrder}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(slab.minAmount)}</TableCell>
                  <TableCell className="text-xs text-right">{slab.maxAmount ? formatCurrency(slab.maxAmount) : '∞'}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(slab.fixedAmount)}</TableCell>
                  <TableCell className="text-xs text-right">{slab.rate}%</TableCell>
                  <TableCell><Badge className={`text-[9px] ${slab.isActive ? 'bg-[#EEF1F8] text-[#0F2D78]' : 'bg-gray-100 text-gray-800'}`}>{slab.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(slab)}>
                        <Pencil className="h-3 w-3 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedSlab(slab); setDeleteDialogOpen(true) }}>
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          {slabs.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No tax slabs found. Click &ldquo;New Slab&rdquo; to create one.</p>}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Create Tax Slab</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Fiscal Year *</Label><Input className="h-8 text-xs" value={form.fiscalYear} onChange={e => setForm(p => ({ ...p, fiscalYear: e.target.value }))} placeholder="e.g., 2024-25" /></div>
              <div><Label className="text-xs">Slab Order *</Label><Input type="number" className="h-8 text-xs" value={form.slabOrder || ''} onChange={e => setForm(p => ({ ...p, slabOrder: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Min Amount *</Label><Input type="number" className="h-8 text-xs" value={form.minAmount || ''} onChange={e => setForm(p => ({ ...p, minAmount: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Max Amount</Label><Input type="number" className="h-8 text-xs" value={form.maxAmount || ''} onChange={e => setForm(p => ({ ...p, maxAmount: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="Leave empty for ∞" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Fixed Amount</Label><Input type="number" className="h-8 text-xs" value={form.fixedAmount || ''} onChange={e => setForm(p => ({ ...p, fixedAmount: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Rate (%) *</Label><Input type="number" step="0.1" className="h-8 text-xs" value={form.rate || ''} onChange={e => setForm(p => ({ ...p, rate: parseFloat(e.target.value) || 0 }))} /></div>
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
          <DialogHeader><DialogTitle className="text-sm">Edit Tax Slab</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Fiscal Year</Label><Input className="h-8 text-xs" value={form.fiscalYear} onChange={e => setForm(p => ({ ...p, fiscalYear: e.target.value }))} /></div>
              <div><Label className="text-xs">Slab Order</Label><Input type="number" className="h-8 text-xs" value={form.slabOrder || ''} onChange={e => setForm(p => ({ ...p, slabOrder: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Min Amount</Label><Input type="number" className="h-8 text-xs" value={form.minAmount || ''} onChange={e => setForm(p => ({ ...p, minAmount: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Max Amount</Label><Input type="number" className="h-8 text-xs" value={form.maxAmount || ''} onChange={e => setForm(p => ({ ...p, maxAmount: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="Leave empty for ∞" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Fixed Amount</Label><Input type="number" className="h-8 text-xs" value={form.fixedAmount || ''} onChange={e => setForm(p => ({ ...p, fixedAmount: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Rate (%)</Label><Input type="number" step="0.1" className="h-8 text-xs" value={form.rate || ''} onChange={e => setForm(p => ({ ...p, rate: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
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
            <AlertDialogTitle className="text-sm">Delete Tax Slab</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete this tax slab? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Calculate Tax Dialog */}
      <Dialog open={calcDialogOpen} onOpenChange={setCalcDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">Calculate Income Tax</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Annual Income (PKR)</Label><Input type="number" className="h-8 text-xs" value={calcForm.annualIncome || ''} onChange={e => setCalcForm(p => ({ ...p, annualIncome: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Fiscal Year</Label><Input className="h-8 text-xs" value={calcForm.fiscalYear} onChange={e => setCalcForm(p => ({ ...p, fiscalYear: e.target.value }))} /></div>
            </div>
            <Button size="sm" onClick={handleCalculate} className="w-full"><Calculator className="h-3.5 w-3.5 mr-1" />Calculate</Button>

            {calcResult && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2 border">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Annual Income:</span><span className="font-medium">{formatCurrency(calcResult.annualIncome)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total Tax:</span><span className="font-bold text-red-600">{formatCurrency(calcResult.totalTax)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Effective Rate:</span><span className="font-medium">{calcResult.effectiveRate}%</span></div>
                {calcResult.breakdown?.length > 0 && (
                  <div className="mt-2 overflow-x-auto">
                    <p className="text-[10px] font-semibold mb-1">Slab Breakdown:</p>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-[9px]">Range</TableHead>
                        <TableHead className="text-[9px] text-right">Taxable</TableHead>
                        <TableHead className="text-[9px] text-right">Tax</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {calcResult.breakdown.map((b: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-[10px]">{formatCurrency(b.minAmount)} - {b.maxAmount ? formatCurrency(b.maxAmount) : '∞'}</TableCell>
                            <TableCell className="text-[10px] text-right">{formatCurrency(b.taxableInSlab)}</TableCell>
                            <TableCell className="text-[10px] text-right text-red-600">{formatCurrency(b.taxInSlab)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setCalcDialogOpen(false); setCalcResult(null) }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
