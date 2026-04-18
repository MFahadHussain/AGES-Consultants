'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Calendar, Plus, Lock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function FinancialYearManagement() {
  const [years, setYears] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<any>(null)
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' })
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/financial-year')
      setYears(await res.json())
    } catch {
      toast({ title: 'Error', description: 'Failed to load financial years', variant: 'destructive' })
    }
  }

  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      toast({ title: 'Error', description: 'All fields required', variant: 'destructive' }); return
    }
    try {
      await fetch('/api/financial-year', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      toast({ title: 'Created', description: `Financial year ${form.name} created` })
      setDialogOpen(false)
      setForm({ name: '', startDate: '', endDate: '' })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to create financial year', variant: 'destructive' })
    }
  }

  const handleClose = async () => {
    if (!selectedYear) return
    try {
      await fetch('/api/financial-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', id: selectedYear.id, createNext: true }),
      })
      toast({ title: 'Year Closed', description: `${selectedYear.name} closed and next year created` })
      setCloseDialogOpen(false)
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to close financial year', variant: 'destructive' })
    }
  }

  const statusStyles: Record<string, string> = {
    open: 'bg-green-100 text-green-800',
    closing: 'bg-yellow-100 text-yellow-800',
    closed: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />Financial Year Management</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm" className="h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />New Year</Button></DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-sm">Create Financial Year</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Name *</Label><Input className="h-8 text-xs" placeholder="e.g., FY 2025-26" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label className="text-xs">Start Date *</Label><Input type="date" className="h-8 text-xs" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} /></div>
              <div><Label className="text-xs">End Date *</Label><Input type="date" className="h-8 text-xs" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} /></div>
            </div>
            <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button><Button size="sm" onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {years.map(yr => (
          <Card key={yr.id} className={`border-l-4 ${yr.status === 'open' ? 'border-l-green-500' : yr.status === 'closing' ? 'border-l-yellow-500' : 'border-l-gray-400'}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold">{yr.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(yr.startDate).toLocaleDateString()} — {new Date(yr.endDate).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={`text-[9px] ${statusStyles[yr.status]}`}>{yr.status}</Badge>
              </div>
              {yr.status === 'open' && (
                <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => { setSelectedYear(yr); setCloseDialogOpen(true) }}>
                  <Lock className="h-3 w-3 mr-1" />Close & Carry Forward
                </Button>
              )}
              {yr.closedAt && <p className="text-[10px] text-muted-foreground mt-2">Closed: {new Date(yr.closedAt).toLocaleString()}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Close Year Confirmation Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Close Financial Year</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Are you sure you want to close <strong>{selectedYear?.name}</strong>? This will:
          </p>
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
            <li>Calculate and save closing balances for all accounts</li>
            <li>Create the next financial year automatically</li>
            <li>Carry forward balances as opening balances</li>
            <li>This action cannot be undone</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={handleClose}>Close Year</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
