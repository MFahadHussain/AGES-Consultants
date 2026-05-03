'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Customer { id: string; code: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; address: string | null; creditTerms: number; creditLimit: number; isActive: boolean }
interface Supplier { id: string; code: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; address: string | null; creditTerms: number; taxNumber: string | null; bankName: string | null; bankAccount: string | null; isActive: boolean }

const emptyCustomerForm = { code: '', name: '', contactPerson: '', email: '', phone: '', address: '', creditTerms: 30, creditLimit: 0 }
const emptySupplierForm = { code: '', name: '', contactPerson: '', email: '', phone: '', address: '', creditTerms: 30, taxNumber: '', bankName: '', bankAccount: '' }

export function Customers() {
  const [data, setData] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyCustomerForm)
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const params = search ? `?search=${search}` : ''
      const res = await fetch(`/api/customers${params}`)
      setData(await res.json())
    } catch {
      toast({ title: 'Error', description: 'Failed to load customers', variant: 'destructive' })
    }
  }

  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const resetForm = () => { setForm(emptyCustomerForm); setEditingItem(null) }

  const handleCreate = async () => {
    if (!form.code || !form.name) { toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' }); return }
    try {
      await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      toast({ title: 'Created', description: `Customer ${form.code} created` })
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to create customer', variant: 'destructive' })
    }
  }

  const handleEdit = (item: Customer) => {
    setEditingItem(item)
    setForm({ code: item.code, name: item.name, contactPerson: item.contactPerson || '', email: item.email || '', phone: item.phone || '', address: item.address || '', creditTerms: item.creditTerms, creditLimit: item.creditLimit })
    setDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingItem) return
    try {
      const res = await fetch(`/api/customers/${editingItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error()
      toast({ title: 'Updated', description: `Customer ${form.code} updated` })
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to update customer', variant: 'destructive' })
    }
  }

  const handleDelete = async (item: Customer) => {
    if (!confirm(`Deactivate customer "${item.name}" (${item.code})?`)) return
    try {
      const res = await fetch(`/api/customers/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Deactivated', description: `Customer ${item.code} deactivated` })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to deactivate customer', variant: 'destructive' })
    }
  }

  const handleToggleActive = async (item: Customer) => {
    try {
      const res = await fetch(`/api/customers/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !item.isActive }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Status Updated', description: `Customer ${item.code} ${item.isActive ? 'deactivated' : 'activated'}` })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle status', variant: 'destructive' })
    }
  }

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open)
    if (!open) resetForm()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search customers..." className="pl-7 h-8 text-xs w-64" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()} />
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <Button size="sm" className="h-8 text-xs" onClick={() => { resetForm(); setDialogOpen(true) }}><Plus className="h-3.5 w-3.5 mr-1" />New Customer</Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-sm">{editingItem ? 'Edit Customer' : 'New Customer'}</DialogTitle></DialogHeader>
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
            <DialogFooter><Button variant="outline" size="sm" onClick={() => handleDialogClose(false)}>Cancel</Button><Button size="sm" onClick={editingItem ? handleUpdate : handleCreate}>{editingItem ? 'Update' : 'Create'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-[10px]">Code</TableHead><TableHead className="text-[10px]">Name</TableHead><TableHead className="text-[10px]">Contact</TableHead><TableHead className="text-[10px]">Email</TableHead><TableHead className="text-[10px]">Phone</TableHead><TableHead className="text-[10px]">Terms</TableHead><TableHead className="text-[10px]">Status</TableHead><TableHead className="text-[10px] text-right">Actions</TableHead>
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
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(c)} title="Edit"><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleToggleActive(c)} title={c.isActive ? 'Deactivate' : 'Activate'}>
                      {c.isActive ? <ToggleRight className="h-3 w-3 text-green-600" /> : <ToggleLeft className="h-3 w-3 text-gray-400" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(c)} title="Delete"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
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
  const [editingItem, setEditingItem] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptySupplierForm)
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const params = search ? `?search=${search}` : ''
      const res = await fetch(`/api/suppliers${params}`)
      setData(await res.json())
    } catch {
      toast({ title: 'Error', description: 'Failed to load suppliers', variant: 'destructive' })
    }
  }

  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const resetForm = () => { setForm(emptySupplierForm); setEditingItem(null) }

  const handleCreate = async () => {
    if (!form.code || !form.name) { toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' }); return }
    try {
      await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      toast({ title: 'Created', description: `Supplier ${form.code} created` })
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to create supplier', variant: 'destructive' })
    }
  }

  const handleEdit = (item: Supplier) => {
    setEditingItem(item)
    setForm({ code: item.code, name: item.name, contactPerson: item.contactPerson || '', email: item.email || '', phone: item.phone || '', address: item.address || '', creditTerms: item.creditTerms, taxNumber: item.taxNumber || '', bankName: item.bankName || '', bankAccount: item.bankAccount || '' })
    setDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingItem) return
    try {
      const res = await fetch(`/api/suppliers/${editingItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error()
      toast({ title: 'Updated', description: `Supplier ${form.code} updated` })
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to update supplier', variant: 'destructive' })
    }
  }

  const handleDelete = async (item: Supplier) => {
    if (!confirm(`Deactivate supplier "${item.name}" (${item.code})?`)) return
    try {
      const res = await fetch(`/api/suppliers/${item.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Deactivated', description: `Supplier ${item.code} deactivated` })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to deactivate supplier', variant: 'destructive' })
    }
  }

  const handleToggleActive = async (item: Supplier) => {
    try {
      const res = await fetch(`/api/suppliers/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !item.isActive }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Status Updated', description: `Supplier ${item.code} ${item.isActive ? 'deactivated' : 'activated'}` })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle status', variant: 'destructive' })
    }
  }

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open)
    if (!open) resetForm()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search suppliers..." className="pl-7 h-8 text-xs w-64" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()} />
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <Button size="sm" className="h-8 text-xs" onClick={() => { resetForm(); setDialogOpen(true) }}><Plus className="h-3.5 w-3.5 mr-1" />New Supplier</Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-sm">{editingItem ? 'Edit Supplier' : 'New Supplier'}</DialogTitle></DialogHeader>
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
            <DialogFooter><Button variant="outline" size="sm" onClick={() => handleDialogClose(false)}>Cancel</Button><Button size="sm" onClick={editingItem ? handleUpdate : handleCreate}>{editingItem ? 'Update' : 'Create'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-[10px]">Code</TableHead><TableHead className="text-[10px]">Name</TableHead><TableHead className="text-[10px]">Contact</TableHead><TableHead className="text-[10px]">Tax #</TableHead><TableHead className="text-[10px]">Terms</TableHead><TableHead className="text-[10px]">Bank</TableHead><TableHead className="text-[10px]">Status</TableHead><TableHead className="text-[10px] text-right">Actions</TableHead>
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
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(s)} title="Edit"><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleToggleActive(s)} title={s.isActive ? 'Deactivate' : 'Activate'}>
                      {s.isActive ? <ToggleRight className="h-3 w-3 text-green-600" /> : <ToggleLeft className="h-3 w-3 text-gray-400" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(s)} title="Delete"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  )
}
