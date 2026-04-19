'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, FolderTree, Heart, MapPin, Pencil, Trash2, Loader2, Briefcase } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Projects Module
export function Projects() {
  const [data, setData] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', description: '', startDate: '', endDate: '', status: 'active' })
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/projects')
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load projects', variant: 'destructive' })
    }
  }
  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ code: '', name: '', description: '', startDate: '', endDate: '', status: 'active' })
    setDialogOpen(true)
  }

  const openEdit = (p: any) => {
    setEditingId(p.id)
    setForm({
      code: p.code,
      name: p.name,
      description: p.description || '',
      startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
      endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
      status: p.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, startDate: form.startDate || undefined, endDate: form.endDate || undefined }
      if (editingId) {
        const res = await fetch('/api/projects', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
        const result = await res.json()
        if (!res.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); setSaving(false); return }
        toast({ title: 'Updated', description: `Project ${form.code} updated` })
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (!res.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); setSaving(false); return }
        toast({ title: 'Created', description: `Project ${form.code} created` })
      }
      setDialogOpen(false)
      setForm({ code: '', name: '', description: '', startDate: '', endDate: '', status: 'active' })
      setEditingId(null)
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Operation failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) {
        toast({ title: 'Cannot Delete', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Deleted', description: 'Project deleted successfully' })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to delete project', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><FolderTree className="h-4 w-4" />Projects</h3>
        <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" />New Project
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">{editingId ? 'Edit Project' : 'New Project'}</DialogTitle></DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <div className="flex items-center gap-1">
                  <Badge className={`text-[9px] ${p.status === 'active' ? 'bg-green-100 text-green-800' : p.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                  <AlertDialog open={deletingId === p.id} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(p.id)}><Trash2 className="h-3 w-3" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm">Delete Project?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                          Are you sure you want to delete &quot;{p.name}&quot; ({p.code})? This action cannot be undone. Projects with associated vouchers cannot be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                        <AlertDialogAction className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(p.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '' })
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/donors')
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load donors', variant: 'destructive' })
    }
  }
  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '' })
    setDialogOpen(true)
  }

  const openEdit = (d: any) => {
    setEditingId(d.id)
    setForm({
      code: d.code,
      name: d.name,
      contactPerson: d.contactPerson || '',
      email: d.email || '',
      phone: d.phone || '',
      address: d.address || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch('/api/donors', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...form }),
        })
        const result = await res.json()
        if (!res.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); setSaving(false); return }
        toast({ title: 'Updated', description: `Donor ${form.code} updated` })
      } else {
        const res = await fetch('/api/donors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const result = await res.json()
        if (!res.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); setSaving(false); return }
        toast({ title: 'Created', description: `Donor ${form.code} created` })
      }
      setDialogOpen(false)
      setForm({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '' })
      setEditingId(null)
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Operation failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/donors?id=${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) {
        toast({ title: 'Cannot Delete', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Deleted', description: 'Donor deleted successfully' })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to delete donor', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Heart className="h-4 w-4" />Donors</h3>
        <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" />New Donor
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">{editingId ? 'Edit Donor' : 'New Donor'}</DialogTitle></DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-[10px]">Code</TableHead>
            <TableHead className="text-[10px]">Name</TableHead>
            <TableHead className="text-[10px]">Contact</TableHead>
            <TableHead className="text-[10px]">Email</TableHead>
            <TableHead className="text-[10px]">Phone</TableHead>
            <TableHead className="text-[10px] w-20">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs font-semibold">{d.code}</TableCell>
                <TableCell className="text-xs font-medium">{d.name}</TableCell>
                <TableCell className="text-xs">{d.contactPerson || '-'}</TableCell>
                <TableCell className="text-xs">{d.email || '-'}</TableCell>
                <TableCell className="text-xs">{d.phone || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Pencil className="h-3 w-3" /></Button>
                    <AlertDialog open={deletingId === d.id} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(d.id)}><Trash2 className="h-3 w-3" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-sm">Delete Donor?</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs">
                            Are you sure you want to delete &quot;{d.name}&quot; ({d.code})? This action cannot be undone. Donors with associated vouchers cannot be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                          <AlertDialogAction className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(d.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

// Locations Module
export function Locations() {
  const [data, setData] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', address: '' })
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/locations')
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load locations', variant: 'destructive' })
    }
  }
  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ code: '', name: '', address: '' })
    setDialogOpen(true)
  }

  const openEdit = (l: any) => {
    setEditingId(l.id)
    setForm({ code: l.code, name: l.name, address: l.address || '' })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch('/api/locations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...form }),
        })
        const result = await res.json()
        if (!res.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); setSaving(false); return }
        toast({ title: 'Updated', description: `Location ${form.code} updated` })
      } else {
        const res = await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const result = await res.json()
        if (!res.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); setSaving(false); return }
        toast({ title: 'Created', description: `Location ${form.code} created` })
      }
      setDialogOpen(false)
      setForm({ code: '', name: '', address: '' })
      setEditingId(null)
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Operation failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/locations?id=${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) {
        toast({ title: 'Cannot Delete', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Deleted', description: 'Location deleted successfully' })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to delete location', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />Locations</h3>
        <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" />New Location
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{editingId ? 'Edit Location' : 'New Location'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Code *</Label><Input className="h-8 text-xs" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
              <div><Label className="text-xs">Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Address</Label><Input className="h-8 text-xs" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map(l => (
          <Card key={l.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0"><MapPin className="h-4 w-4" /></div>
                  <div>
                    <p className="font-mono text-xs font-semibold">{l.code}</p>
                    <p className="text-sm font-medium">{l.name}</p>
                    {l.address && <p className="text-[10px] text-muted-foreground mt-0.5">{l.address}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)}><Pencil className="h-3 w-3" /></Button>
                  <AlertDialog open={deletingId === l.id} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(l.id)}><Trash2 className="h-3 w-3" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm">Delete Location?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                          Are you sure you want to delete &quot;{l.name}&quot; ({l.code})? This action cannot be undone. Locations with associated vouchers cannot be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                        <AlertDialogAction className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(l.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Clients Module
export function Clients() {
  const [data, setData] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', industry: '', taxNumber: '', isActive: true })
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/clients')
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load clients', variant: 'destructive' })
    }
  }
  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', industry: '', taxNumber: '', isActive: true })
    setDialogOpen(true)
  }

  const openEdit = (c: any) => {
    setEditingId(c.id)
    setForm({
      code: c.code,
      name: c.name,
      contactPerson: c.contactPerson || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      industry: c.industry || '',
      taxNumber: c.taxNumber || '',
      isActive: c.isActive ?? true,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast({ title: 'Error', description: 'Code and name required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, industry: form.industry || undefined, taxNumber: form.taxNumber || undefined, contactPerson: form.contactPerson || undefined, email: form.email || undefined, phone: form.phone || undefined, address: form.address || undefined }
      if (editingId) {
        const res = await fetch('/api/clients', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
        const result = await res.json()
        if (!res.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); setSaving(false); return }
        toast({ title: 'Updated', description: `Client ${form.code} updated` })
      } else {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (!res.ok) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); setSaving(false); return }
        toast({ title: 'Created', description: `Client ${form.code} created` })
      }
      setDialogOpen(false)
      setForm({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', industry: '', taxNumber: '', isActive: true })
      setEditingId(null)
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Operation failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/clients?id=${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) {
        toast({ title: 'Cannot Delete', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Deleted', description: 'Client deleted successfully' })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to delete client', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const industryColors: Record<string, string> = {
    Government: 'bg-blue-100 text-blue-800',
    NGO: 'bg-green-100 text-green-800',
    Corporate: 'bg-purple-100 text-purple-800',
    Individual: 'bg-amber-100 text-amber-800',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" />Clients</h3>
        <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" />New Client
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">{editingId ? 'Edit Client' : 'New Client'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Code *</Label><Input className="h-8 text-xs" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
              <div><Label className="text-xs">Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Contact Person</Label><Input className="h-8 text-xs" value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} /></div>
              <div><Label className="text-xs">Industry</Label>
                <Select value={form.industry || '_none'} onValueChange={v => setForm(p => ({ ...p, industry: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    <SelectItem value="Government">Government</SelectItem>
                    <SelectItem value="NGO">NGO</SelectItem>
                    <SelectItem value="Corporate">Corporate</SelectItem>
                    <SelectItem value="Individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Email</Label><Input className="h-8 text-xs" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label className="text-xs">Phone</Label><Input className="h-8 text-xs" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Tax Number</Label><Input className="h-8 text-xs" value={form.taxNumber} onChange={e => setForm(p => ({ ...p, taxNumber: e.target.value }))} /></div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="clientActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="h-4 w-4 rounded" />
                <Label htmlFor="clientActive" className="text-xs cursor-pointer">Active</Label>
              </div>
            </div>
            <div><Label className="text-xs">Address</Label><Input className="h-8 text-xs" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-[10px]">Code</TableHead>
            <TableHead className="text-[10px]">Name</TableHead>
            <TableHead className="text-[10px]">Contact</TableHead>
            <TableHead className="text-[10px]">Industry</TableHead>
            <TableHead className="text-[10px]">Email</TableHead>
            <TableHead className="text-[10px]">Phone</TableHead>
            <TableHead className="text-[10px]">Status</TableHead>
            <TableHead className="text-[10px] w-20">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-xs py-8 text-muted-foreground">No clients found. Create your first client.</TableCell></TableRow>
            ) : data.map(c => (
              <TableRow key={c.id} className={!c.isActive ? 'opacity-50' : ''}>
                <TableCell className="font-mono text-xs font-semibold">{c.code}</TableCell>
                <TableCell className="text-xs font-medium">{c.name}</TableCell>
                <TableCell className="text-xs">{c.contactPerson || '-'}</TableCell>
                <TableCell>{c.industry ? <Badge className={`text-[9px] ${industryColors[c.industry] || 'bg-gray-100 text-gray-800'}`}>{c.industry}</Badge> : <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                <TableCell className="text-xs">{c.email || '-'}</TableCell>
                <TableCell className="text-xs">{c.phone || '-'}</TableCell>
                <TableCell>{c.isActive ? <Badge className="text-[9px] bg-green-100 text-green-800">Active</Badge> : <Badge className="text-[9px] bg-gray-100 text-gray-800">Inactive</Badge>}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3 w-3" /></Button>
                    <AlertDialog open={deletingId === c.id} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(c.id)}><Trash2 className="h-3 w-3" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-sm">Delete Client?</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs">
                            Are you sure you want to delete &quot;{c.name}&quot; ({c.code})? This action cannot be undone. Clients with associated vouchers cannot be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                          <AlertDialogAction className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(c.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
