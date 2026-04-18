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

import { Plus, Search, FolderTree, Heart, MapPin } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

// Projects Module
export function Projects() {
  const [data, setData] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', description: '', startDate: '', endDate: '', status: 'active' })
  const { toast } = useToast()

  const fetchData = async () => { try { const res = await fetch('/api/projects'); setData(await res.json()) } catch { toast({ title: 'Error', description: 'Failed to load projects', variant: 'destructive' }) } }
  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const handleCreate = async () => {
    if (!form.code || !form.name) { toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' }); return }
    try {
      await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, startDate: form.startDate || undefined, endDate: form.endDate || undefined }) })
      toast({ title: 'Created', description: `Project ${form.code} created` })
      setDialogOpen(false)
      setForm({ code: '', name: '', description: '', startDate: '', endDate: '', status: 'active' })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to create project', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><FolderTree className="h-4 w-4" />Projects</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm" className="h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />New Project</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-sm">New Project</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Code *</Label><Input className="h-8 text-xs" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
                <div><Label className="text-xs">Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Description</Label><Input className="h-8 text-xs" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Start Date</Label><Input type="date" className="h-8 text-xs" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} /></div>
                <div><Label className="text-xs">End Date</Label><Input type="date" className="h-8 text-xs" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{['active', 'completed', 'on-hold'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button><Button size="sm" onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map(p => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-muted-foreground">{p.code}</p>
                  <p className="text-sm font-medium mt-0.5">{p.name}</p>
                  {p.description && <p className="text-[10px] text-muted-foreground mt-1">{p.description}</p>}
                </div>
                <Badge className={`text-[9px] ${p.status === 'active' ? 'bg-green-100 text-green-800' : p.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status}</Badge>
              </div>
              {p.startDate && <p className="text-[10px] text-muted-foreground mt-2">{new Date(p.startDate).toLocaleDateString()} - {p.endDate ? new Date(p.endDate).toLocaleDateString() : 'Ongoing'}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Donors Module
export function Donors() {
  const [data, setData] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '' })
  const { toast } = useToast()

  const fetchData = async () => { try { const res = await fetch('/api/donors'); setData(await res.json()) } catch { toast({ title: 'Error', description: 'Failed to load donors', variant: 'destructive' }) } }
  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const handleCreate = async () => {
    if (!form.code || !form.name) { toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' }); return }
    try {
      await fetch('/api/donors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      toast({ title: 'Created', description: `Donor ${form.code} created` })
      setDialogOpen(false)
      setForm({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '' })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to create donor', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Heart className="h-4 w-4" />Donors</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm" className="h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />New Donor</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-sm">New Donor</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Code *</Label><Input className="h-8 text-xs" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
                <div><Label className="text-xs">Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Contact Person</Label><Input className="h-8 text-xs" value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} /></div>
                <div><Label className="text-xs">Email</Label><Input className="h-8 text-xs" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Phone</Label><Input className="h-8 text-xs" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label className="text-xs">Address</Label><Input className="h-8 text-xs" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            </div>
            <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button><Button size="sm" onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-[10px]">Code</TableHead><TableHead className="text-[10px]">Name</TableHead><TableHead className="text-[10px]">Contact</TableHead><TableHead className="text-[10px]">Email</TableHead><TableHead className="text-[10px]">Phone</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs font-semibold">{d.code}</TableCell>
                <TableCell className="text-xs font-medium">{d.name}</TableCell>
                <TableCell className="text-xs">{d.contactPerson || '-'}</TableCell>
                <TableCell className="text-xs">{d.email || '-'}</TableCell>
                <TableCell className="text-xs">{d.phone || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  )
}

// Locations Module
export function Locations() {
  const [data, setData] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', address: '' })
  const { toast } = useToast()

  const fetchData = async () => { try { const res = await fetch('/api/locations'); setData(await res.json()) } catch { toast({ title: 'Error', description: 'Failed to load locations', variant: 'destructive' }) } }
  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const handleCreate = async () => {
    if (!form.code || !form.name) { toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' }); return }
    try {
      await fetch('/api/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      toast({ title: 'Created', description: `Location ${form.code} created` })
      setDialogOpen(false)
      setForm({ code: '', name: '', address: '' })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to create location', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />Locations</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm" className="h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />New Location</Button></DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-sm">New Location</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Code *</Label><Input className="h-8 text-xs" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
                <div><Label className="text-xs">Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Address</Label><Input className="h-8 text-xs" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            </div>
            <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button><Button size="sm" onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map(l => (
          <Card key={l.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded bg-primary/10 text-primary flex items-center justify-center"><MapPin className="h-4 w-4" /></div>
                <div>
                  <p className="font-mono text-xs font-semibold">{l.code}</p>
                  <p className="text-sm font-medium">{l.name}</p>
                  {l.address && <p className="text-[10px] text-muted-foreground mt-0.5">{l.address}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
