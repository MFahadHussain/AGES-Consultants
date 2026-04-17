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
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, Eye, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const voucherTypes = [
  { value: 'BP', label: 'Bank Payment' },
  { value: 'CP', label: 'Cash Payment' },
  { value: 'BR', label: 'Bank Receipt' },
  { value: 'CR', label: 'Cash Receipt' },
  { value: 'JV', label: 'Journal Voucher' },
  { value: 'BILL', label: 'Bill' },
]

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  reviewed: 'bg-blue-100 text-blue-800 border-blue-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  posted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
}

const statusFlow: Record<string, string[]> = {
  draft: ['reviewed', 'rejected'],
  reviewed: ['approved', 'rejected'],
  approved: ['posted', 'rejected'],
  posted: [],
  rejected: ['draft'],
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

interface Voucher { id: string; voucherNumber: string; voucherType: string; voucherTypeName: string; date: string; narration: string; reference: string | null; status: string; totalDebit: number; totalCredit: number; isPayrollPosted: boolean; isAssetPosted: boolean; project?: { name: string } | null; donor?: { name: string } | null; location?: { name: string } | null; _count?: { entries: number } }
interface Account { id: string; code: string; name: string; accountType: string }

export function VoucherManagement() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [detailVoucher, setDetailVoucher] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const { toast } = useToast()

  const [form, setForm] = useState({
    voucherType: 'BP', date: new Date().toISOString().split('T')[0], narration: '', reference: '',
    financialYearId: '', projectId: '', donorId: '', locationId: '',
    entries: [{ accountId: '', debit: 0, credit: 0, description: '' }] as any[],
  })

  const fetchData = async () => {

    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.set('voucherType', typeFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      params.set('page', String(page))
      params.set('limit', '20')
      const res = await fetch(`/api/vouchers?${params}`)
      const data = await res.json()
      setVouchers(data.data || [])
      setTotal(data.total || 0)
    } catch (e) { toast({ title: 'Error', description: 'Failed to load vouchers', variant: 'destructive' }) }
    setLoading(false)
  }

  const fetchAccounts = async () => {
    const res = await fetch('/api/accounts?isActive=true')
    const data = await res.json()
    setAccounts(data.filter((a: Account) => a.accountType))
  }

  useEffect(() => { queueMicrotask(() => fetchData()) }, [page, typeFilter, statusFilter])
  useEffect(() => { queueMicrotask(() => fetchAccounts()) }, [])

  const handleStatusChange = async (voucherId: string, action: string) => {
    try {
      await fetch(`/api/vouchers/${voucherId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      toast({ title: 'Status Updated', description: `Voucher ${action}` })
      fetchData()
      if (detailOpen) {
        const res = await fetch(`/api/vouchers/${voucherId}`)
        setDetailVoucher(await res.json())
      }
    } catch (e) { toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' }) }
  }

  const handleCreate = async () => {
    if (!form.voucherType || !form.date || !form.narration) {
      toast({ title: 'Validation Error', description: 'Type, date, and narration are required', variant: 'destructive' })
      return
    }
    const totalDebit = form.entries.reduce((s, e) => s + (e.debit || 0), 0)
    const totalCredit = form.entries.reduce((s, e) => s + (e.credit || 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast({ title: 'Validation Error', description: `Debits (${totalDebit}) must equal Credits (${totalCredit})`, variant: 'destructive' })
      return
    }

    try {
      // Get active financial year
      const fyRes = await fetch('/api/financial-year')
      const fys = await fyRes.json()
      const activeFy = fys.find((f: any) => f.status === 'open')
      if (!activeFy) { toast({ title: 'Error', description: 'No open financial year', variant: 'destructive' }); return }

      await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, financialYearId: activeFy.id, voucherTypeName: voucherTypes.find(v => v.value === form.voucherType)?.label }),
      })
      toast({ title: 'Created', description: 'Voucher created successfully' })
      setCreateOpen(false)
      setForm({ voucherType: 'BP', date: new Date().toISOString().split('T')[0], narration: '', reference: '', financialYearId: '', projectId: '', donorId: '', locationId: '', entries: [{ accountId: '', debit: 0, credit: 0, description: '' }] })
      fetchData()
    } catch (e) { toast({ title: 'Error', description: 'Failed to create voucher', variant: 'destructive' }) }
  }

  const addEntry = () => setForm(p => ({ ...p, entries: [...p.entries, { accountId: '', debit: 0, credit: 0, description: '' }] }))
  const removeEntry = (i: number) => setForm(p => ({ ...p, entries: p.entries.filter((_: any, idx: number) => idx !== i) }))
  const updateEntry = (i: number, field: string, value: any) => setForm(p => ({ ...p, entries: p.entries.map((e: any, idx: number) => idx === i ? { ...e, [field]: value } : e) }))

  const totalDebit = form.entries.reduce((s, e) => s + (e.debit || 0), 0)
  const totalCredit = form.entries.reduce((s, e) => s + (e.credit || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search vouchers..." className="pl-7 h-8 text-xs w-52" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Voucher Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {voucherTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {['draft', 'reviewed', 'approved', 'posted', 'rejected'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" /> New Voucher</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">Create New Voucher</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label className="text-xs">Voucher Type *</Label>
                  <Select value={form.voucherType} onValueChange={v => setForm(p => ({ ...p, voucherType: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{voucherTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Date *</Label><Input type="date" className="h-8 text-xs" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
                <div><Label className="text-xs">Reference</Label><Input className="h-8 text-xs" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} /></div>
                <div><Label className="text-xs">Project</Label>
                  <Select value={form.projectId} onValueChange={v => setForm(p => ({ ...p, projectId: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">None</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Narration *</Label><Textarea className="text-xs" rows={2} value={form.narration} onChange={e => setForm(p => ({ ...p, narration: e.target.value }))} /></div>

              {/* Entries */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold">Voucher Entries</Label>
                  <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={addEntry}><Plus className="h-3 w-3 mr-1" />Add Line</Button>
                </div>
                <div className="space-y-2">
                  {form.entries.map((entry, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        {i === 0 && <Label className="text-[10px]">Account</Label>}
                        <Select value={entry.accountId} onValueChange={v => updateEntry(i, 'accountId', v)}>
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Select account" /></SelectTrigger>
                          <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}><span className="font-mono">{a.code}</span> {a.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        {i === 0 && <Label className="text-[10px]">Debit</Label>}
                        <Input type="number" className="h-7 text-[10px]" value={entry.debit || ''} onChange={e => updateEntry(i, 'debit', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2">
                        {i === 0 && <Label className="text-[10px]">Credit</Label>}
                        <Input type="number" className="h-7 text-[10px]" value={entry.credit || ''} onChange={e => updateEntry(i, 'credit', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-3">
                        {i === 0 && <Label className="text-[10px]">Description</Label>}
                        <Input className="h-7 text-[10px]" value={entry.description} onChange={e => updateEntry(i, 'description', e.target.value)} />
                      </div>
                      <div className="col-span-1">
                        {form.entries.length > 2 && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeEntry(i)}><XCircle className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2 p-2 rounded bg-muted/50">
                  <div className="flex gap-4 text-xs">
                    <span>Total Debit: <strong>{formatCurrency(totalDebit)}</strong></span>
                    <span>Total Credit: <strong>{formatCurrency(totalCredit)}</strong></span>
                  </div>
                  <Badge className={isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {isBalanced ? 'Balanced ✓' : 'Out of Balance ✗'}
                  </Badge>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={!isBalanced}>Create Voucher</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vouchers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Voucher #</TableHead>
                <TableHead className="text-[10px]">Type</TableHead>
                <TableHead className="text-[10px]">Date</TableHead>
                <TableHead className="text-[10px]">Narration</TableHead>
                <TableHead className="text-[10px]">Amount</TableHead>
                <TableHead className="text-[10px]">Status</TableHead>
                <TableHead className="text-[10px]">Integration</TableHead>
                <TableHead className="text-[10px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-xs py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : vouchers.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-xs py-8 text-muted-foreground">No vouchers found</TableCell></TableRow>
              ) : vouchers.map(v => (
                <TableRow key={v.id} className="hover:bg-accent/50">
                  <TableCell className="font-mono text-xs font-semibold">{v.voucherNumber}</TableCell>
                  <TableCell className="text-xs">{v.voucherTypeName}</TableCell>
                  <TableCell className="text-xs">{new Date(v.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{v.narration}</TableCell>
                  <TableCell className="text-xs font-semibold">{formatCurrency(v.totalDebit)}</TableCell>
                  <TableCell><Badge className={`text-[9px] ${statusColors[v.status]}`}>{v.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {v.isPayrollPosted && <Badge className="text-[8px] bg-purple-100 text-purple-800">Payroll</Badge>}
                      {v.isAssetPosted && <Badge className="text-[8px] bg-teal-100 text-teal-800">Asset</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                        const res = await fetch(`/api/vouchers/${v.id}`)
                        setDetailVoucher(await res.json())
                        setDetailOpen(true)
                      }}><Eye className="h-3 w-3" /></Button>
                      {statusFlow[v.status]?.length && statusFlow[v.status].includes('reviewed') && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => handleStatusChange(v.id, 'review')}>Review</Button>
                      )}
                      {statusFlow[v.status]?.length && statusFlow[v.status].includes('approved') && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => handleStatusChange(v.id, 'approve')}>Approve</Button>
                      )}
                      {statusFlow[v.status]?.length && statusFlow[v.status].includes('posted') && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-emerald-600" onClick={() => handleStatusChange(v.id, 'post')}>Post</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Voucher Details - {detailVoucher?.voucherNumber}
              {detailVoucher?.isPayrollPosted && <Badge className="ml-2 text-[9px] bg-purple-100 text-purple-800">INTEGRATION: Payroll → GL</Badge>}
              {detailVoucher?.isAssetPosted && <Badge className="ml-2 text-[9px] bg-teal-100 text-teal-800">INTEGRATION: Fixed Assets → GL</Badge>}
            </DialogTitle>
          </DialogHeader>
          {detailVoucher && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span className="text-muted-foreground">Type:</span> <strong>{detailVoucher.voucherTypeName}</strong></div>
                <div><span className="text-muted-foreground">Date:</span> <strong>{new Date(detailVoucher.date).toLocaleDateString()}</strong></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={`text-[9px] ${statusColors[detailVoucher.status]}`}>{detailVoucher.status}</Badge></div>
                <div><span className="text-muted-foreground">Reference:</span> {detailVoucher.reference || '-'}</div>
              </div>
              <div className="text-xs"><span className="text-muted-foreground">Narration:</span> {detailVoucher.narration}</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">#</TableHead>
                    <TableHead className="text-[10px]">Account</TableHead>
                    <TableHead className="text-[10px]">Debit</TableHead>
                    <TableHead className="text-[10px]">Credit</TableHead>
                    <TableHead className="text-[10px]">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailVoucher.entries?.map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{e.lineNumber}</TableCell>
                      <TableCell className="text-xs font-mono">{e.account?.code} - {e.account?.name}</TableCell>
                      <TableCell className="text-xs">{e.debit > 0 ? formatCurrency(e.debit) : ''}</TableCell>
                      <TableCell className="text-xs">{e.credit > 0 ? formatCurrency(e.credit) : ''}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2} className="text-xs">Total</TableCell>
                    <TableCell className="text-xs">{formatCurrency(detailVoucher.totalDebit)}</TableCell>
                    <TableCell className="text-xs">{formatCurrency(detailVoucher.totalCredit)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
              {detailVoucher.approvals?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1">Approval History</p>
                  {detailVoucher.approvals.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] py-0.5">
                      <Badge className="text-[8px]">{a.action}</Badge>
                      <span>{a.user?.name || 'System'}</span>
                      <span className="text-muted-foreground">{a.comments}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
