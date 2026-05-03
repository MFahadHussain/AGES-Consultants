'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Receipt, Pencil, Trash2, ArrowRightLeft, History, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

const taxTypeLabels: Record<string, string> = { INCOME_TAX: 'Income Tax', SALES_TAX: 'Sales Tax', GST: 'GST', ZAKAT: 'Zakat' }

export function Taxation() {
  const [taxRates, setTaxRates] = useState<any[]>([])
  const [calculations, setCalculations] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [selectedTaxRate, setSelectedTaxRate] = useState<any>(null)
  const [selectedCalc, setSelectedCalc] = useState<any>(null)
  const [calcResult, setCalcResult] = useState<any>(null)
  const [financialYears, setFinancialYears] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('rates')
  const [form, setForm] = useState({ name: '', taxType: 'INCOME_TAX', rate: 0, effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '' })
  const [editForm, setEditForm] = useState({ name: '', taxType: 'INCOME_TAX', rate: 0, effectiveFrom: '', effectiveTo: '' })
  const [calcForm, setCalcForm] = useState({ taxRateId: '', baseAmount: 0 })
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/taxation')
      setTaxRates(await res.json())
    } catch {
      toast({ title: 'Error', description: 'Failed to load tax rates', variant: 'destructive' })
    }
  }

  const fetchCalculations = async () => {
    try {
      const res = await fetch('/api/taxation?includeCalculations=true')
      setCalculations(await res.json())
    } catch {
      toast({ title: 'Error', description: 'Failed to load tax calculations', variant: 'destructive' })
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchData()
      fetchCalculations()
      fetch('/api/financial-year').then(r => r.json()).then(d => setFinancialYears(Array.isArray(d) ? d : []))
    })
  }, [])

  const handleCreate = async () => {
    if (!form.name) { toast({ title: 'Error', description: 'Name required', variant: 'destructive' }); return }
    try {
      await fetch('/api/taxation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      toast({ title: 'Created', description: 'Tax rate created' })
      setDialogOpen(false)
      setForm({ name: '', taxType: 'INCOME_TAX', rate: 0, effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '' })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to create tax rate', variant: 'destructive' })
    }
  }

  const handleEdit = (taxRate: any) => {
    setSelectedTaxRate(taxRate)
    setEditForm({
      name: taxRate.name,
      taxType: taxRate.taxType,
      rate: taxRate.rate,
      effectiveFrom: new Date(taxRate.effectiveFrom).toISOString().split('T')[0],
      effectiveTo: taxRate.effectiveTo ? new Date(taxRate.effectiveTo).toISOString().split('T')[0] : '',
    })
    setEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedTaxRate || !editForm.name) { toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return }
    try {
      const res = await fetch(`/api/taxation?id=${selectedTaxRate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      toast({ title: 'Updated', description: 'Tax rate updated' })
      setEditDialogOpen(false)
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!selectedTaxRate) return
    try {
      const res = await fetch(`/api/taxation?id=${selectedTaxRate.id}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      const result = await res.json()
      toast({ title: 'Deleted', description: result.message })
      setDeleteDialogOpen(false)
      setSelectedTaxRate(null)
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleCalculate = async () => {
    try {
      const res = await fetch('/api/taxation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate', ...calcForm }),
      })
      const result = await res.json()
      setCalcResult(result)
      fetchCalculations() // Refresh history
      toast({ title: 'Calculated', description: `Tax amount: ${formatCurrency(result.taxAmount)}` })
    } catch {
      toast({ title: 'Error', description: 'Failed to calculate tax', variant: 'destructive' })
    }
  }

  const handlePostToGL = async () => {
    if (!selectedCalc) return
    const fy = financialYears.find((f: any) => f.status === 'open')
    if (!fy) { toast({ title: 'Error', description: 'No open financial year', variant: 'destructive' }); return }

    try {
      const res = await fetch('/api/taxation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post-to-gl', calculationId: selectedCalc.id, financialYearId: fy.id }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed')
      toast({ title: 'Posted to GL', description: `Voucher ${result.voucherNumber} created` })
      setPostDialogOpen(false)
      fetchCalculations()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="h-8">
            <TabsTrigger value="rates" className="text-xs h-7"><Receipt className="h-3.5 w-3.5 mr-1" />Tax Rates</TabsTrigger>
            <TabsTrigger value="calculator" className="text-xs h-7">Calculator</TabsTrigger>
            <TabsTrigger value="history" className="text-xs h-7"><History className="h-3.5 w-3.5 mr-1" />History</TabsTrigger>
          </TabsList>
          <Button size="sm" className="h-7 text-[10px]" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />New Rate
          </Button>
        </div>

        {/* Tax Rates Tab */}
        <TabsContent value="rates" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[10px]">Name</TableHead>
                  <TableHead className="text-[10px]">Type</TableHead>
                  <TableHead className="text-[10px] text-right">Rate</TableHead>
                  <TableHead className="text-[10px]">Effective From</TableHead>
                  <TableHead className="text-[10px]">Effective To</TableHead>
                  <TableHead className="text-[10px] text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {taxRates.map(t => (
                    <TableRow key={t.id} className="group">
                      <TableCell className="text-xs font-medium">{t.name}</TableCell>
                      <TableCell><Badge className="text-[9px]">{taxTypeLabels[t.taxType] || t.taxType}</Badge></TableCell>
                      <TableCell className="text-xs text-right font-semibold">{t.rate}%</TableCell>
                      <TableCell className="text-xs">{new Date(t.effectiveFrom).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs">{t.effectiveTo ? new Date(t.effectiveTo).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(t)}>
                            <Pencil className="h-3 w-3 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedTaxRate(t); setDeleteDialogOpen(true) }}>
                            <Trash2 className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {taxRates.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-xs text-muted-foreground text-center py-6">No tax rates defined</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calculator Tab */}
        <TabsContent value="calculator" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tax Calculator</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div><Label className="text-xs">Tax Rate</Label>
                  <Select value={calcForm.taxRateId} onValueChange={v => setCalcForm(p => ({ ...p, taxRateId: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select tax rate" /></SelectTrigger>
                    <SelectContent>{taxRates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Base Amount (PKR)</Label><Input type="number" className="h-8 text-xs" value={calcForm.baseAmount || ''} onChange={e => setCalcForm(p => ({ ...p, baseAmount: parseFloat(e.target.value) || 0 }))} /></div>
                <Button size="sm" className="w-full h-8" onClick={handleCalculate} disabled={!calcForm.taxRateId}>Calculate Tax</Button>
                {calcResult && (
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tax Name:</span><span className="font-medium">{calcResult.taxName}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Rate:</span><span className="font-medium">{calcResult.rate}%</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Base Amount:</span><span>{formatCurrency(calcResult.baseAmount)}</span></div>
                    <div className="flex justify-between text-xs font-bold border-t pt-1"><span>Tax Amount:</span><span className="text-destructive">{formatCurrency(calcResult.taxAmount)}</span></div>
                    <Button variant="outline" size="sm" className="w-full h-7 text-[10px] mt-2" onClick={() => { setSelectedCalc(calcResult); setPostDialogOpen(true) }} disabled={calcResult.postedToGL}>
                      <ArrowRightLeft className="h-3 w-3 mr-1" />{calcResult.postedToGL ? 'Already Posted' : 'Post to GL'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Tax Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tax Rate Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {taxRates.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div>
                      <p className="text-xs font-medium">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground">{taxTypeLabels[t.taxType] || t.taxType}</p>
                    </div>
                    <Badge className="text-[9px]">{t.rate}%</Badge>
                  </div>
                ))}
                {taxRates.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No tax rates defined</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" />Tax Calculation History</CardTitle>
                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={fetchCalculations}>Refresh</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[10px]">Tax Rate</TableHead>
                  <TableHead className="text-[10px]">Period</TableHead>
                  <TableHead className="text-[10px] text-right">Base Amount</TableHead>
                  <TableHead className="text-[10px] text-right">Tax Amount</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px] text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {calculations.map(c => (
                    <TableRow key={c.id} className="group">
                      <TableCell className="text-xs font-medium">{c.taxRate?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-xs">{c.period}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(c.baseAmount)}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-destructive">{formatCurrency(c.taxAmount)}</TableCell>
                      <TableCell>
                        {c.postedToGL ? (
                          <Badge className="text-[9px] bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Posted</Badge>
                        ) : (
                          <Badge className="text-[9px] bg-yellow-100 text-yellow-800">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!c.postedToGL && (
                          <Button variant="ghost" size="sm" className="h-6 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setSelectedCalc(c); setPostDialogOpen(true) }}>
                            <ArrowRightLeft className="h-3 w-3 mr-1" />Post to GL
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {calculations.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-xs text-muted-foreground text-center py-6">No tax calculations yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Tax Rate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">New Tax Rate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={form.taxType} onValueChange={v => setForm(p => ({ ...p, taxType: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(taxTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Rate (%)</Label><Input type="number" className="h-8 text-xs" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label className="text-xs">Effective From</Label><Input type="date" className="h-8 text-xs" value={form.effectiveFrom} onChange={e => setForm(p => ({ ...p, effectiveFrom: e.target.value }))} /></div>
            <div><Label className="text-xs">Effective To</Label><Input type="date" className="h-8 text-xs" value={form.effectiveTo} onChange={e => setForm(p => ({ ...p, effectiveTo: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button><Button size="sm" onClick={handleCreate}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tax Rate Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Edit Tax Rate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input className="h-8 text-xs" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={editForm.taxType} onValueChange={v => setEditForm(p => ({ ...p, taxType: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(taxTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Rate (%)</Label><Input type="number" className="h-8 text-xs" value={editForm.rate} onChange={e => setEditForm(p => ({ ...p, rate: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label className="text-xs">Effective From</Label><Input type="date" className="h-8 text-xs" value={editForm.effectiveFrom} onChange={e => setEditForm(p => ({ ...p, effectiveFrom: e.target.value }))} /></div>
            <div><Label className="text-xs">Effective To</Label><Input type="date" className="h-8 text-xs" value={editForm.effectiveTo} onChange={e => setEditForm(p => ({ ...p, effectiveTo: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>Cancel</Button><Button size="sm" onClick={handleUpdate}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Tax Rate</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete &ldquo;{selectedTaxRate?.name}&rdquo;? If this tax rate has existing calculations, it will be deactivated instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Post to GL Confirmation Dialog */}
      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Post Tax Calculation to GL</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will create a journal voucher in the General Ledger for the tax amount of {selectedCalc ? formatCurrency(selectedCalc.taxAmount) : ''}.
              The voucher will be created in draft status for review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8" onClick={handlePostToGL}>
              <ArrowRightLeft className="h-3 w-3 mr-1" />Post to GL
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
