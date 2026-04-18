'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Receipt } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function Taxation() {
  const [taxRates, setTaxRates] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [calcResult, setCalcResult] = useState<any>(null)
  const [form, setForm] = useState({ name: '', taxType: 'INCOME_TAX', rate: 0, effectiveFrom: new Date().toISOString().split('T')[0] })
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

  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const handleCreate = async () => {
    if (!form.name) { toast({ title: 'Error', description: 'Name required', variant: 'destructive' }); return }
    try {
      await fetch('/api/taxation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      toast({ title: 'Created', description: 'Tax rate created' })
      setDialogOpen(false)
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to create tax rate', variant: 'destructive' })
    }
  }

  const handleCalculate = async () => {
    try {
      const res = await fetch('/api/taxation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate', ...calcForm }),
      })
      setCalcResult(await res.json())
    } catch {
      toast({ title: 'Error', description: 'Failed to calculate tax', variant: 'destructive' })
    }
  }

  const taxTypeLabels: Record<string, string> = { INCOME_TAX: 'Income Tax', SALES_TAX: 'Sales Tax', GST: 'GST', ZAKAT: 'Zakat' }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tax Rates */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" />Tax Rates</CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild><Button size="sm" className="h-7 text-[10px]"><Plus className="h-3 w-3 mr-1" />New Rate</Button></DialogTrigger>
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
                  </div>
                  <DialogFooter><Button size="sm" onClick={handleCreate}>Create</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-[10px]">Name</TableHead><TableHead className="text-[10px]">Type</TableHead><TableHead className="text-[10px] text-right">Rate</TableHead><TableHead className="text-[10px]">Effective</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {taxRates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs font-medium">{t.name}</TableCell>
                    <TableCell><Badge className="text-[9px]">{taxTypeLabels[t.taxType] || t.taxType}</Badge></TableCell>
                    <TableCell className="text-xs text-right font-semibold">{t.rate}%</TableCell>
                    <TableCell className="text-xs">{new Date(t.effectiveFrom).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Tax Calculator */}
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
