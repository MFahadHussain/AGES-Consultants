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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, Eye, CheckCircle, XCircle, Filter, FileText, ArrowRight, Printer, Copy } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { numberToWords } from '@/lib/number-to-words'

const voucherTypes = [
  { value: 'BP', label: 'Bank Payment', color: 'bg-red-100 text-red-800' },
  { value: 'CP', label: 'Cash Payment', color: 'bg-orange-100 text-orange-800' },
  { value: 'BR', label: 'Bank Receipt', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'CR', label: 'Cash Receipt', color: 'bg-green-100 text-green-800' },
  { value: 'JV', label: 'Journal Voucher', color: 'bg-blue-100 text-blue-800' },
  { value: 'BILL', label: 'Bill', color: 'bg-purple-100 text-purple-800' },
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

interface Voucher {
  id: string
  voucherNumber: string
  voucherType: string
  voucherTypeName: string
  date: string
  narration: string
  reference: string | null
  payeeName: string | null
  chequeNumber: string | null
  chequeDate: string | null
  voucherNo: string | null
  amountInWords: string | null
  status: string
  totalDebit: number
  totalCredit: number
  isPayrollPosted: boolean
  isAssetPosted: boolean
  project?: { name: string } | null
  donor?: { name: string } | null
  location?: { name: string } | null
  _count?: { entries: number }
}
interface Account { id: string; code: string; name: string; accountType: string }

const defaultForm = {
  voucherType: 'BP',
  date: new Date().toISOString().split('T')[0],
  narration: '',
  reference: '',
  payeeName: '',
  chequeNumber: '',
  chequeDate: '',
  voucherNo: '',
  amountInWords: '',
  financialYearId: '',
  projectId: '',
  donorId: '',
  locationId: '',
  entries: [{ accountId: '', debit: 0, credit: 0, description: '' }] as any[],
}

export function VoucherManagement() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [donors, setDonors] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [detailVoucher, setDetailVoucher] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [printVoucher, setPrintVoucher] = useState<any>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const { toast } = useToast()

  const [form, setForm] = useState({ ...defaultForm })

  const totalDebit = form.entries.reduce((s, e) => s + (e.debit || 0), 0)
  const totalCredit = form.entries.reduce((s, e) => s + (e.credit || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  // Auto-generate amount in words when totals change
  const autoAmountInWords = totalDebit > 0 ? numberToWords(totalDebit) : ''

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
    } catch {
      toast({ title: 'Error', description: 'Failed to load vouchers', variant: 'destructive' })
    }
    setLoading(false)
  }

  const fetchReferenceData = async () => {
    const [accRes, projRes, donorRes, locRes] = await Promise.all([
      fetch('/api/accounts?isActive=true'),
      fetch('/api/projects'),
      fetch('/api/donors'),
      fetch('/api/locations'),
    ])
    setAccounts(await accRes.json())
    setProjects(await projRes.json())
    setDonors(await donorRes.json())
    setLocations(await locRes.json())
  }

  useEffect(() => { queueMicrotask(() => fetchData()) }, [page, typeFilter, statusFilter])
  useEffect(() => { queueMicrotask(() => fetchReferenceData()) }, [])

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
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
    }
  }

  const handleCreate = async () => {
    if (!form.voucherType || !form.date || !form.narration) {
      toast({ title: 'Validation Error', description: 'Type, date, and narration are required', variant: 'destructive' })
      return
    }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast({ title: 'Validation Error', description: `Debits (${totalDebit}) must equal Credits (${totalCredit})`, variant: 'destructive' })
      return
    }
    const validEntries = form.entries.filter(e => e.accountId)
    if (validEntries.length < 2) {
      toast({ title: 'Validation Error', description: 'At least 2 entries with accounts are required', variant: 'destructive' })
      return
    }

    try {
      const fyRes = await fetch('/api/financial-year')
      const fys = await fyRes.json()
      const activeFy = fys.find((f: any) => f.status === 'open')
      if (!activeFy) { toast({ title: 'Error', description: 'No open financial year', variant: 'destructive' }); return }

      await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          entries: validEntries,
          financialYearId: activeFy.id,
          voucherTypeName: voucherTypes.find(v => v.value === form.voucherType)?.label,
          amountInWords: form.amountInWords || autoAmountInWords,
          projectId: form.projectId || undefined,
          donorId: form.donorId || undefined,
          locationId: form.locationId || undefined,
        }),
      })
      toast({ title: 'Created', description: 'Voucher created successfully' })
      setCreateOpen(false)
      setForm({ ...defaultForm, entries: [{ accountId: '', debit: 0, credit: 0, description: '' }] })
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to create voucher', variant: 'destructive' })
    }
  }

  const addEntry = () => setForm(p => ({ ...p, entries: [...p.entries, { accountId: '', debit: 0, credit: 0, description: '' }] }))
  const removeEntry = (i: number) => setForm(p => ({ ...p, entries: p.entries.filter((_: any, idx: number) => idx !== i) }))
  const updateEntry = (i: number, field: string, value: any) => setForm(p => ({ ...p, entries: p.entries.map((e: any, idx: number) => idx === i ? { ...e, [field]: value } : e) }))

  const voucherTypeColor = (type: string) => voucherTypes.find(v => v.value === type)?.color || 'bg-gray-100 text-gray-800'

  const handlePrint = (voucher: any) => {
    setPrintVoucher(voucher)
    setPrintOpen(true)
  }

  const handlePrintAction = () => {
    const printContent = document.getElementById('voucher-print-area')
    if (!printContent) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head><title>Voucher - ${printVoucher?.voucherNumber || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
          th { background: #f0f0f0; font-weight: bold; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { margin: 0; }
          .meta { display: flex; justify-content: space-between; margin: 10px 0; }
          .amount-words { margin: 15px 0; padding: 8px; border: 1px solid #999; background: #f9f9f9; font-weight: bold; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; }
          .signature { border-top: 1px solid #333; padding-top: 5px; width: 150px; text-align: center; }
        </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

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
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">Create New Voucher</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Row 1: Voucher Type, Voucher No, Date, Reference */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label className="text-xs">Voucher Type *</Label>
                  <Select value={form.voucherType} onValueChange={v => setForm(p => ({ ...p, voucherType: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{voucherTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Voucher No</Label><Input className="h-8 text-xs" placeholder="Auto if blank" value={form.voucherNo} onChange={e => setForm(p => ({ ...p, voucherNo: e.target.value }))} /></div>
                <div><Label className="text-xs">Date *</Label><Input type="date" className="h-8 text-xs" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
                <div><Label className="text-xs">Reference</Label><Input className="h-8 text-xs" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} /></div>
              </div>

              {/* Row 2: Name (Payee), Cheque No, Cheque Date */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><Label className="text-xs">Name (Payee)</Label><Input className="h-8 text-xs" placeholder="Name of payee/beneficiary" value={form.payeeName} onChange={e => setForm(p => ({ ...p, payeeName: e.target.value }))} /></div>
                <div><Label className="text-xs">Cheque No</Label><Input className="h-8 text-xs" placeholder="Cheque number" value={form.chequeNumber} onChange={e => setForm(p => ({ ...p, chequeNumber: e.target.value }))} /></div>
                <div><Label className="text-xs">Cheque Date</Label><Input type="date" className="h-8 text-xs" value={form.chequeDate} onChange={e => setForm(p => ({ ...p, chequeDate: e.target.value }))} /></div>
              </div>

              {/* Row 3: Project, Donor, Location */}
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Project</Label>
                  <Select value={form.projectId} onValueChange={v => setForm(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Donor</Label>
                  <Select value={form.donorId} onValueChange={v => setForm(p => ({ ...p, donorId: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {donors.map(d => <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Location</Label>
                  <Select value={form.locationId} onValueChange={v => setForm(p => ({ ...p, locationId: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} - {l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Narration */}
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
                          <SelectContent className="max-h-60">{accounts.map(a => <SelectItem key={a.id} value={a.id}><span className="font-mono">{a.code}</span> {a.name}</SelectItem>)}</SelectContent>
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

              {/* Amount in Words */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold">Amount in Words</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => setForm(p => ({ ...p, amountInWords: autoAmountInWords }))}
                    disabled={totalDebit === 0}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Auto-fill from total
                  </Button>
                </div>
                <Textarea
                  className="text-xs font-medium italic"
                  rows={2}
                  placeholder="Amount in words will be auto-generated..."
                  value={form.amountInWords || autoAmountInWords}
                  onChange={e => setForm(p => ({ ...p, amountInWords: e.target.value }))}
                />
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
                <TableHead className="text-[10px]">Name</TableHead>
                <TableHead className="text-[10px]">Cheque No</TableHead>
                <TableHead className="text-[10px]">Date</TableHead>
                <TableHead className="text-[10px]">Narration</TableHead>
                <TableHead className="text-[10px]">Project / Donor</TableHead>
                <TableHead className="text-[10px] text-right">Amount</TableHead>
                <TableHead className="text-[10px]">Status</TableHead>
                <TableHead className="text-[10px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-xs py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : vouchers.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-xs py-8 text-muted-foreground">No vouchers found</TableCell></TableRow>
              ) : vouchers.map(v => (
                <TableRow key={v.id} className="hover:bg-accent/50">
                  <TableCell className="font-mono text-xs font-semibold">{v.voucherNo || v.voucherNumber}</TableCell>
                  <TableCell><Badge className={`text-[9px] ${voucherTypeColor(v.voucherType)}`}>{v.voucherTypeName}</Badge></TableCell>
                  <TableCell className="text-xs font-medium">{v.payeeName || '-'}</TableCell>
                  <TableCell className="text-xs font-mono">{v.chequeNumber || '-'}</TableCell>
                  <TableCell className="text-xs">{new Date(v.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{v.narration}</TableCell>
                  <TableCell className="text-xs">
                    {v.project?.name && <span className="text-[9px] text-violet-600 mr-1">{v.project.name}</span>}
                    {v.donor?.name && <span className="text-[9px] text-pink-600">{v.donor.name}</span>}
                    {!v.project?.name && !v.donor?.name && <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-xs text-right font-semibold">{formatCurrency(v.totalDebit)}</TableCell>
                  <TableCell><Badge className={`text-[9px] ${statusColors[v.status]}`}>{v.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                        const res = await fetch(`/api/vouchers/${v.id}`)
                        setDetailVoucher(await res.json())
                        setDetailOpen(true)
                      }}><Eye className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                        const res = await fetch(`/api/vouchers/${v.id}`)
                        const data = await res.json()
                        handlePrint(data)
                      }}><Printer className="h-3 w-3" /></Button>
                      {statusFlow[v.status]?.includes('reviewed') && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-blue-600" onClick={() => handleStatusChange(v.id, 'review')}>Review</Button>
                      )}
                      {statusFlow[v.status]?.includes('approved') && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-green-600" onClick={() => handleStatusChange(v.id, 'approve')}>Approve</Button>
                      )}
                      {statusFlow[v.status]?.includes('posted') && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-emerald-600" onClick={() => handleStatusChange(v.id, 'post')}>Post</Button>
                      )}
                      {statusFlow[v.status]?.includes('rejected') && v.status !== 'rejected' && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-destructive" onClick={() => handleStatusChange(v.id, 'reject')}>Reject</Button>
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              Voucher Details - {detailVoucher?.voucherNumber}
              {detailVoucher?.isPayrollPosted && <Badge className="text-[9px] bg-purple-100 text-purple-800">INTEGRATION: Payroll → GL</Badge>}
              {detailVoucher?.isAssetPosted && <Badge className="text-[9px] bg-teal-100 text-teal-800">INTEGRATION: Fixed Assets → GL</Badge>}
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

              {/* New Fields Display */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs p-3 rounded-md bg-muted/30 border">
                <div><span className="text-muted-foreground">Name (Payee):</span> <strong>{detailVoucher.payeeName || '-'}</strong></div>
                <div><span className="text-muted-foreground">Voucher No:</span> <strong className="font-mono">{detailVoucher.voucherNo || detailVoucher.voucherNumber}</strong></div>
                <div><span className="text-muted-foreground">Cheque No:</span> <strong className="font-mono">{detailVoucher.chequeNumber || '-'}</strong></div>
                <div><span className="text-muted-foreground">Cheque Date:</span> {detailVoucher.chequeDate ? new Date(detailVoucher.chequeDate).toLocaleDateString() : '-'}</div>
              </div>

              {detailVoucher.amountInWords && (
                <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] text-muted-foreground block mb-1">Amount in Words:</span>
                  <span className="text-xs font-semibold italic">{detailVoucher.amountInWords}</span>
                </div>
              )}

              {(detailVoucher.project || detailVoucher.donor || detailVoucher.location) && (
                <div className="flex gap-3 text-xs">
                  {detailVoucher.project && <Badge variant="outline" className="text-[9px]">Project: {detailVoucher.project.name}</Badge>}
                  {detailVoucher.donor && <Badge variant="outline" className="text-[9px]">Donor: {detailVoucher.donor.name}</Badge>}
                  {detailVoucher.location && <Badge variant="outline" className="text-[9px]">Location: {detailVoucher.location.name}</Badge>}
                </div>
              )}
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

      {/* Print Preview Dialog */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center justify-between">
              <span>Voucher Print Preview</span>
              <Button size="sm" className="h-7 text-xs" onClick={handlePrintAction}>
                <Printer className="h-3 w-3 mr-1" /> Print
              </Button>
            </DialogTitle>
          </DialogHeader>
          {printVoucher && (
            <div id="voucher-print-area" className="border p-6 bg-white text-black text-xs">
              {/* Header */}
              <div className="header text-center border-b-2 border-black pb-3 mb-4">
                <h2 className="text-lg font-bold">VOUCHER</h2>
                <p className="text-sm font-semibold">{printVoucher.voucherTypeName?.toUpperCase()}</p>
              </div>

              {/* Meta Info */}
              <div className="meta flex justify-between mb-4">
                <div>
                  <p><strong>Voucher No:</strong> {printVoucher.voucherNo || printVoucher.voucherNumber}</p>
                  <p><strong>Date:</strong> {new Date(printVoucher.date).toLocaleDateString()}</p>
                  <p><strong>Reference:</strong> {printVoucher.reference || '-'}</p>
                </div>
                <div className="text-right">
                  <p><strong>Name:</strong> {printVoucher.payeeName || '-'}</p>
                  <p><strong>Cheque No:</strong> {printVoucher.chequeNumber || '-'}</p>
                  <p><strong>Cheque Date:</strong> {printVoucher.chequeDate ? new Date(printVoucher.chequeDate).toLocaleDateString() : '-'}</p>
                </div>
              </div>

              {/* Narration */}
              <div className="mb-4">
                <strong>Narration:</strong> {printVoucher.narration}
              </div>

              {/* Segments */}
              {(printVoucher.project || printVoucher.donor || printVoucher.location) && (
                <div className="mb-4 flex gap-4">
                  {printVoucher.project && <span><strong>Project:</strong> {printVoucher.project.name}</span>}
                  {printVoucher.donor && <span><strong>Donor:</strong> {printVoucher.donor.name}</span>}
                  {printVoucher.location && <span><strong>Location:</strong> {printVoucher.location.name}</span>}
                </div>
              )}

              {/* Entries Table */}
              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr>
                    <th className="border border-black px-2 py-1 text-left">#</th>
                    <th className="border border-black px-2 py-1 text-left">Account Code</th>
                    <th className="border border-black px-2 py-1 text-left">Account Name</th>
                    <th className="border border-black px-2 py-1 text-right">Debit (PKR)</th>
                    <th className="border border-black px-2 py-1 text-right">Credit (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {printVoucher.entries?.map((e: any, i: number) => (
                    <tr key={i}>
                      <td className="border border-black px-2 py-1">{e.lineNumber}</td>
                      <td className="border border-black px-2 py-1 font-mono">{e.account?.code}</td>
                      <td className="border border-black px-2 py-1">{e.account?.name}</td>
                      <td className="border border-black px-2 py-1 text-right">{e.debit > 0 ? formatCurrency(e.debit) : ''}</td>
                      <td className="border border-black px-2 py-1 text-right">{e.credit > 0 ? formatCurrency(e.credit) : ''}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={3} className="border border-black px-2 py-1">Total</td>
                    <td className="border border-black px-2 py-1 text-right">{formatCurrency(printVoucher.totalDebit)}</td>
                    <td className="border border-black px-2 py-1 text-right">{formatCurrency(printVoucher.totalCredit)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Amount in Words */}
              <div className="amount-words border border-black p-2 bg-gray-50 mb-6">
                <strong>Amount in Words:</strong> {printVoucher.amountInWords || numberToWords(printVoucher.totalDebit)}
              </div>

              {/* Signatures */}
              <div className="footer flex justify-between mt-8">
                <div className="signature border-t border-black pt-1">
                  <span className="text-[10px]">Prepared By</span>
                </div>
                <div className="signature border-t border-black pt-1">
                  <span className="text-[10px]">Reviewed By</span>
                </div>
                <div className="signature border-t border-black pt-1">
                  <span className="text-[10px]">Approved By</span>
                </div>
                <div className="signature border-t border-black pt-1">
                  <span className="text-[10px]">Received By</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
