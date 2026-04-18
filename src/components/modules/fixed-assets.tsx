'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Package, TrendingDown } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function FixedAssetsIntegration() {
  const [assets, setAssets] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [depDialogOpen, setDepDialogOpen] = useState(false)
  const [disposeDialogOpen, setDisposeDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  const [depPeriod, setDepPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [disposeForm, setDisposeForm] = useState({ disposalAmount: 0, disposalDate: '' })
  const [form, setForm] = useState({ assetCode: '', name: '', category: 'IT Equipment', purchaseDate: '', purchaseCost: 0, usefulLife: 60, salvageValue: 0, depreciationMethod: 'straight_line', locationId: '', projectId: '', supplierId: '', isDonorFunded: false })
  const [locations, setLocations] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/fixed-assets')
      setAssets(await res.json())
    } catch {
      toast({ title: 'Error', description: 'Failed to load fixed assets', variant: 'destructive' })
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchData()
      fetch('/api/locations').then(r => r.json()).then(d => setLocations(d))
      fetch('/api/projects').then(r => r.json()).then(d => setProjects(d))
      fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(d))
    })
  }, [])

  const handleCreate = async () => {
    if (!form.assetCode || !form.name || !form.purchaseDate || !form.purchaseCost) {
      toast({ title: 'Error', description: 'Required fields missing', variant: 'destructive' }); return
    }
    // INTEGRATION: Fixed Assets → GL - Asset purchase creates entries in Asset account
    try {
      await fetch('/api/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, netBookValue: form.purchaseCost }),
      })
      toast({ title: 'Created', description: `Asset ${form.assetCode} created. INTEGRATION: Creates asset purchase entry in GL.` })
      setDialogOpen(false)
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to create fixed asset', variant: 'destructive' })
    }
  }

  const handleDepreciation = async () => {
    // INTEGRATION: Fixed Assets → GL - Monthly depreciation auto-generates journal entries
    try {
      const res = await fetch('/api/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'depreciation', period: depPeriod }),
      })
      const result = await res.json()
      toast({ title: 'Depreciation Run Complete', description: `INTEGRATION: ${result.processed} assets depreciated. Journal entries created in GL.` })
      setDepDialogOpen(false)
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to run depreciation', variant: 'destructive' })
    }
  }

  const handleDispose = async () => {
    if (!selectedAsset) return
    // INTEGRATION: Fixed Assets → GL - Asset disposals post gain/loss entries
    try {
      const res = await fetch('/api/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dispose', assetId: selectedAsset.id, ...disposeForm }),
      })
      const result = await res.json()
      toast({ title: 'Asset Disposed', description: `INTEGRATION: Gain/Loss of ${formatCurrency(result.gainLoss)} posted to GL as ${result.gainLossType}.` })
      setDisposeDialogOpen(false)
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to dispose asset', variant: 'destructive' })
    }
  }

  const statusStyles: Record<string, string> = { active: 'bg-green-100 text-green-800', disposed: 'bg-red-100 text-red-800', transferred: 'bg-blue-100 text-blue-800' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Package className="h-4 w-4" />Fixed Assets Management</h3>
        <div className="flex gap-2">
          <Dialog open={depDialogOpen} onOpenChange={setDepDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="h-8 text-xs"><TrendingDown className="h-3.5 w-3.5 mr-1" />Run Depreciation</Button></DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle className="text-sm">Run Monthly Depreciation</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-[10px] text-muted-foreground">INTEGRATION: Fixed Assets → GL - This will auto-generate depreciation journal entries (Depreciation Expense Dr / Accumulated Depreciation Cr) for all active, non-donor-funded assets.</p>
                <div><Label className="text-xs">Period</Label><Input type="month" className="h-8 text-xs" value={depPeriod} onChange={e => setDepPeriod(e.target.value)} /></div>
              </div>
              <DialogFooter><Button size="sm" onClick={handleDepreciation}>Run Depreciation</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm" className="h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />New Asset</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-sm">Register Fixed Asset</DialogTitle></DialogHeader>
              <p className="text-[10px] text-muted-foreground">INTEGRATION: Fixed Assets → GL - Asset purchase will create entries in the Asset account and reduce the bank/cash/payables ledger.</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Asset Code *</Label><Input className="h-8 text-xs" value={form.assetCode} onChange={e => setForm(p => ({ ...p, assetCode: e.target.value }))} /></div>
                  <div><Label className="text-xs">Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{['IT Equipment', 'Vehicles', 'Furniture & Fixtures', 'Office Equipment'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Purchase Date *</Label><Input type="date" className="h-8 text-xs" value={form.purchaseDate} onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Purchase Cost *</Label><Input type="number" className="h-8 text-xs" value={form.purchaseCost || ''} onChange={e => setForm(p => ({ ...p, purchaseCost: parseFloat(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Useful Life (months)</Label><Input type="number" className="h-8 text-xs" value={form.usefulLife} onChange={e => setForm(p => ({ ...p, usefulLife: parseInt(e.target.value) || 60 }))} /></div>
                  <div><Label className="text-xs">Salvage Value</Label><Input type="number" className="h-8 text-xs" value={form.salvageValue} onChange={e => setForm(p => ({ ...p, salvageValue: parseFloat(e.target.value) || 0 }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Location</Label>
                    <Select value={form.locationId} onValueChange={v => setForm(p => ({ ...p, locationId: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Project</Label>
                    <Select value={form.projectId} onValueChange={v => setForm(p => ({ ...p, projectId: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.isDonorFunded} onCheckedChange={v => setForm(p => ({ ...p, isDonorFunded: v }))} />
                  <Label className="text-xs">Donor-Funded Asset (Zero Depreciation)</Label>
                </div>
                {form.isDonorFunded && <p className="text-[10px] text-purple-600 font-medium">INTEGRATION: Donor-funded assets are flagged and excluded from depreciation journal entries.</p>}
              </div>
              <DialogFooter><Button size="sm" onClick={handleCreate}>Register Asset</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Assets Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Code</TableHead>
                <TableHead className="text-[10px]">Name</TableHead>
                <TableHead className="text-[10px]">Category</TableHead>
                <TableHead className="text-[10px] text-right">Cost</TableHead>
                <TableHead className="text-[10px] text-right">Accum. Dep.</TableHead>
                <TableHead className="text-[10px] text-right">Net Book Value</TableHead>
                <TableHead className="text-[10px]">Status</TableHead>
                <TableHead className="text-[10px]">Integration</TableHead>
                <TableHead className="text-[10px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs font-semibold">{a.assetCode}</TableCell>
                  <TableCell className="text-xs">{a.name}</TableCell>
                  <TableCell className="text-xs">{a.category}</TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(a.purchaseCost)}</TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">{formatCurrency(a.accumulatedDepreciation)}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">{formatCurrency(a.netBookValue)}</TableCell>
                  <TableCell><Badge className={`text-[9px] ${statusStyles[a.status]}`}>{a.status}</Badge></TableCell>
                  <TableCell>
                    {a.isDonorFunded && <Badge className="text-[8px] bg-purple-100 text-purple-800">Donor-Funded</Badge>}
                  </TableCell>
                  <TableCell>
                    {a.status === 'active' && (
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] text-destructive" onClick={() => { setSelectedAsset(a); setDisposeForm({ disposalAmount: a.netBookValue, disposalDate: new Date().toISOString().split('T')[0] }); setDisposeDialogOpen(true) }}>Dispose</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dispose Dialog */}
      <Dialog open={disposeDialogOpen} onOpenChange={setDisposeDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Dispose Asset</DialogTitle></DialogHeader>
          <p className="text-[10px] text-muted-foreground">INTEGRATION: Fixed Assets → GL - Disposal will post gain/loss entries to the General Ledger.</p>
          <div className="space-y-3">
            <p className="text-xs">Asset: <strong>{selectedAsset?.assetCode} - {selectedAsset?.name}</strong></p>
            <p className="text-xs">Current Net Book Value: <strong>{selectedAsset && formatCurrency(selectedAsset.netBookValue)}</strong></p>
            <div><Label className="text-xs">Disposal Amount</Label><Input type="number" className="h-8 text-xs" value={disposeForm.disposalAmount || ''} onChange={e => setDisposeForm(p => ({ ...p, disposalAmount: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label className="text-xs">Disposal Date</Label><Input type="date" className="h-8 text-xs" value={disposeForm.disposalDate} onChange={e => setDisposeForm(p => ({ ...p, disposalDate: e.target.value }))} /></div>
            {selectedAsset && (
              <div className="p-2 rounded bg-muted/50 text-xs">
                Estimated {disposeForm.disposalAmount >= selectedAsset.netBookValue ? 'Gain' : 'Loss'}: {formatCurrency(Math.abs(disposeForm.disposalAmount - selectedAsset.netBookValue))}
              </div>
            )}
          </div>
          <DialogFooter><Button variant="destructive" size="sm" onClick={handleDispose}>Confirm Disposal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
