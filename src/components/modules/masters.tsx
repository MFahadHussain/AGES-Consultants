'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Plus, Search, Edit2, Building2, Users } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Customer { id: string; code: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; address: string | null; creditTerms: number; creditLimit: number; isActive: boolean }
interface Supplier { id: string; code: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; address: string | null; creditTerms: number; taxNumber: string | null; bankName: string | null; bankAccount: string | null; isActive: boolean }

export function Customers() {
  const [data, setData] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', creditTerms: 30, creditLimit: 0 })
  const { toast } = useToast()

  const fetchData = async () => {
    const params = search ? `?search=${search}` : ''
    const res = await fetch(`/api/customers${params}`)
    setData(await res.json())
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async () => {
    if (!form.code || !form.name) { toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' }); return }
    await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    toast({ title: 'Created', description: `Customer ${form.code} created` })
    setDialogOpen(false)
    setForm({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', creditTerms: 30, creditLimit: 0 })
    fetchData()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search customers..." className="pl-7 h-8 text-xs w-64" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()} />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm" className="h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />New Customer</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-sm">New Customer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Code *</Label><Input className="h-8 text-xs" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
                <div><Label className="text-xs">Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Contact Person</Label><Input className="h-8 text-xs" value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} /></div>
                <div><Label className="text-xs">Email</Label><Input className="h-8 text-xs" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Phone</Label><Input className="h-8 text-xs" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                <div><Label className="text-xs">Credit Terms (days)</Label><Input type="number" className="h-8 text-xs" value={form.creditTerms} onChange={e => setForm(p => ({ ...p, creditTerms: parseInt(e.target.value) || 0 }))} /></div>
              </div>
              <div><Label className="text-xs">Credit Limit</Label><Input type="number" className="h-8 text-xs" value={form.creditLimit} onChange={e => setForm(p => ({ ...p, creditLimit: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Address</Label><Input className="h-8 text-xs" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            </div>
            <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button><Button size="sm" onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-[10px]">Code</TableHead><TableHead className="text-[10px]">Name</TableHead><TableHead className="text-[10px]">Contact</TableHead><TableHead className="text-[10px]">Email</TableHead><TableHead className="text-[10px]">Phone</TableHead><TableHead className="text-[10px]">Terms</TableHead><TableHead className="text-[10px]">Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map(c => (
              <TableRow key={c.id} className={!c.isActive ? 'opacity-50' : ''}>
                <TableCell className="font-mono text-xs font-semibold">{c.code}</TableCell>
                <TableCell className="text-xs font-medium">{c.name}</TableCell>
                <TableCell className="text-xs">{c.contactPerson || '-'}</TableCell>
                <TableCell className="text-xs">{c.email || '-'}</TableCell>
                <TableCell className="text-xs">{c.phone || '-'}</TableCell>
                <TableCell className="text-xs">{c.creditTerms} days</TableCell>
                <TableCell>{c.isActive ? <Badge className="text-[9px] bg-green-100 text-green-800">Active</Badge> : <Badge className="text-[9px] bg-gray-100 text-gray-800">Inactive</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  )
}

export function Suppliers() {
  const [data, setData] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', creditTerms: 30, taxNumber: '', bankName: '', bankAccount: '' })
  const { toast } = useToast()

  const fetchData = async () => {
    const params = search ? `?search=${search}` : ''
    const res = await fetch(`/api/suppliers${params}`)
    setData(await res.json())
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async () => {
    if (!form.code || !form.name) { toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' }); return }
    await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    toast({ title: 'Created', description: `Supplier ${form.code} created` })
    setDialogOpen(false)
    setForm({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', creditTerms: 30, taxNumber: '', bankName: '', bankAccount: '' })
    fetchData()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search suppliers..." className="pl-7 h-8 text-xs w-64" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()} />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm" className="h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />New Supplier</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-sm">New Supplier</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Code *</Label><Input className="h-8 text-xs" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
                <div><Label className="text-xs">Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Contact Person</Label><Input className="h-8 text-xs" value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} /></div>
                <div><Label className="text-xs">Tax Number</Label><Input className="h-8 text-xs" value={form.taxNumber} onChange={e => setForm(p => ({ ...p, taxNumber: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Email</Label><Input className="h-8 text-xs" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                <div><Label className="text-xs">Phone</Label><Input className="h-8 text-xs" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Bank Name</Label><Input className="h-8 text-xs" value={form.bankName} onChange={e => setForm(p => ({ ...p, bankName: e.target.value }))} /></div>
                <div><Label className="text-xs">Bank Account</Label><Input className="h-8 text-xs" value={form.bankAccount} onChange={e => setForm(p => ({ ...p, bankAccount: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Address</Label><Input className="h-8 text-xs" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            </div>
            <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button><Button size="sm" onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-[10px]">Code</TableHead><TableHead className="text-[10px]">Name</TableHead><TableHead className="text-[10px]">Contact</TableHead><TableHead className="text-[10px]">Tax #</TableHead><TableHead className="text-[10px]">Terms</TableHead><TableHead className="text-[10px]">Bank</TableHead><TableHead className="text-[10px]">Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map(s => (
              <TableRow key={s.id} className={!s.isActive ? 'opacity-50' : ''}>
                <TableCell className="font-mono text-xs font-semibold">{s.code}</TableCell>
                <TableCell className="text-xs font-medium">{s.name}</TableCell>
                <TableCell className="text-xs">{s.contactPerson || '-'}</TableCell>
                <TableCell className="text-xs font-mono">{s.taxNumber || '-'}</TableCell>
                <TableCell className="text-xs">{s.creditTerms} days</TableCell>
                <TableCell className="text-xs">{s.bankName || '-'}</TableCell>
                <TableCell>{s.isActive ? <Badge className="text-[9px] bg-green-100 text-green-800">Active</Badge> : <Badge className="text-[9px] bg-gray-100 text-gray-800">Inactive</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  )
}
