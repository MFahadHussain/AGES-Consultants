'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Plus, Search, Edit2, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Account {
  id: string; code: string; name: string; accountType: string; subType: string | null
  parentId: string | null; level: number; isActive: boolean; isSystem: boolean; allowPosting: boolean
  openingBalance: number; description: string | null; parent?: { code: string; name: string } | null
  _count?: { children: number; voucherEntries: number }
  children?: Account[]
}

const typeColors: Record<string, string> = {
  ASSET: 'bg-emerald-100 text-emerald-800',
  LIABILITY: 'bg-red-100 text-red-800',
  EQUITY: 'bg-violet-100 text-violet-800',
  INCOME: 'bg-blue-100 text-blue-800',
  EXPENSE: 'bg-orange-100 text-orange-800',
}

const accountTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']

const formatSubType = (s: string | null) => {
  if (!s) return '-'
  return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const subTypes: Record<string, string[]> = {
  ASSET: [
    'CURRENT_ASSET', 'CASH', 'BANK', 'RECEIVABLE', 'ADVANCE',
    'DEPOSIT', 'PREPAYMENT', 'TAX_RECEIVABLE',
    'FIXED_ASSET', 'INTANGIBLE_ASSET',
    'ACCUMULATED_DEPRECIATION', 'ACCUMULATED_AMORTIZATION',
    'WORK_IN_PROGRESS', 'INVESTMENT', 'NON_CURRENT_ASSET', 'CONTRA_ASSET',
  ],
  LIABILITY: [
    'CURRENT_LIABILITY', 'PAYABLE', 'ACCRUAL', 'TAX_PAYABLE',
    'PAYROLL_LIABILITY', 'PROVISION', 'UNEARNED_REVENUE',
    'NON_CURRENT_LIABILITY', 'LONG_TERM_LOAN', 'DEFERRED_INCOME',
  ],
  EQUITY: [
    'CAPITAL_FUND', 'RETAINED_EARNINGS', 'DRAWING',
    'REVALUATION_RESERVE', 'ENDOWMENT_FUND', 'GENERAL_FUND',
    'ACCUMULATED_SURPLUS', 'RESERVE_FUND', 'SURPLUS_FUND',
    'PRIOR_PERIOD_ADJUSTMENT',
  ],
  INCOME: [
    'PROGRAM_INCOME', 'OTHER_INCOME', 'GAIN_ON_DISPOSAL',
    'SERVICE_REVENUE', 'CONSULTANCY_INCOME', 'INVESTMENT_INCOME',
    'INTEREST_INCOME', 'FOREX_GAIN',
  ],
  EXPENSE: [
    'SALARY', 'PERSONNEL', 'SOCIAL_CHARGES', 'TRAVEL', 'OFFICE',
    'PROFESSIONAL', 'DEPRECIATION', 'FINANCIAL',
    'LOSS_ON_DISPOSAL', 'OTHER_EXPENSE', 'TAX_EXPENSE',
    'RENT_EXPENSE', 'UTILITY_EXPENSE', 'COMMUNICATION_EXPENSE',
    'MAINTENANCE_EXPENSE', 'AUDIT_FEE', 'LEGAL_FEE',
    'CONSULTANCY_EXPENSE', 'BANK_CHARGES', 'INSURANCE_EXPENSE',
    'IMPAIRMENT_LOSS', 'BAD_DEBT',
  ],
}

export function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [form, setForm] = useState({ code: '', name: '', accountType: 'ASSET', subType: '', parentId: '', allowPosting: true, description: '' })
  const { toast } = useToast()

  const fetchData = async () => {

    try {
      const res = await fetch('/api/accounts')
      const data = await res.json()
      setAccounts(data)
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to load accounts', variant: 'destructive' })
    }
    setLoading(false)
  }

  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  const filteredAccounts = useMemo(() => {
    let result = accounts
    if (search) result = result.filter(a => a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase()))
    if (typeFilter !== 'all') result = result.filter(a => a.accountType === typeFilter)
    return result
  }, [accounts, search, typeFilter])

  const handleSubmit = async () => {
    if (!form.code || !form.name) {
      toast({ title: 'Validation Error', description: 'Code and name are required', variant: 'destructive' })
      return
    }
    try {
      if (editingAccount) {
        await fetch(`/api/accounts/${editingAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        toast({ title: 'Updated', description: `Account ${form.code} updated` })
      } else {
        await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, level: form.parentId ? 1 : 0 }),
        })
        toast({ title: 'Created', description: `Account ${form.code} created` })
      }
      setDialogOpen(false)
      setEditingAccount(null)
      setForm({ code: '', name: '', accountType: 'ASSET', subType: '', parentId: '', allowPosting: true, description: '' })
      fetchData()
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save account', variant: 'destructive' })
    }
  }

  const handleDeactivate = async (account: Account) => {
    if (account.isSystem) {
      toast({ title: 'Cannot Deactivate', description: 'System accounts cannot be deactivated', variant: 'destructive' })
      return
    }
    await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' })
    toast({ title: 'Deactivated', description: `Account ${account.code} deactivated` })
    fetchData()
  }

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedIds(next)
  }

  // Build tree structure
  const buildTree = (accounts: Account[], parentId: string | null = null, level = 0): Account[] => {
    return accounts
      .filter(a => a.parentId === parentId)
      .map(a => ({ ...a, level, children: buildTree(accounts, a.id, level + 1) }))
  }

  const rootAccounts = buildTree(filteredAccounts.filter(a => a.parentId === null))

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search accounts..." className="pl-7 h-8 text-xs w-full sm:w-64" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Filter by type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {accountTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 text-xs" onClick={() => { setEditingAccount(null); setForm({ code: '', name: '', accountType: 'ASSET', subType: '', parentId: '', allowPosting: true, description: '' }) }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">{editingAccount ? 'Edit Account' : 'New Account'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Account Code *</Label><Input className="h-8 text-xs" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g., 1150" /></div>
                <div><Label className="text-xs">Account Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Petty Cash" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Account Type *</Label>
                  <Select value={form.accountType} onValueChange={v => setForm(p => ({ ...p, accountType: v, subType: '' }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{accountTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Sub Type</Label>
                  <Select value={form.subType || '__none__'} onValueChange={v => setForm(p => ({ ...p, subType: v === '__none__' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="__none__">— None —</SelectItem>
                      {(subTypes[form.accountType] || []).map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Parent Account</Label>
                <Select value={form.parentId} onValueChange={v => setForm(p => ({ ...p, parentId: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None (Top Level)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Top Level)</SelectItem>
                    {accounts.filter(a => a.isActive).map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Description</Label><Input className="h-8 text-xs" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.allowPosting} onCheckedChange={v => setForm(p => ({ ...p, allowPosting: v }))} />
                <Label className="text-xs">Allow Direct Posting</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit}>{editingAccount ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] w-28">Code</TableHead>
                <TableHead className="text-[10px]">Name</TableHead>
                <TableHead className="text-[10px] w-24">Type</TableHead>
                <TableHead className="text-[10px] w-36">Sub Type</TableHead>
                <TableHead className="text-[10px] w-36">Status</TableHead>
                <TableHead className="text-[10px] w-16 text-right">Entries</TableHead>
                <TableHead className="text-[10px] w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground">No accounts found</TableCell></TableRow>
              ) : (
                filteredAccounts.filter(a => !a.parentId).map(account => {
                  const hasChildren = accounts.some(a => a.parentId === account.id)
                  const isExpanded = expandedIds.has(account.id)
                  return (
                    <React.Fragment key={account.id}>
                      <TableRow className={`hover:bg-accent/50 ${!account.isActive ? 'opacity-50' : ''}`}>
                        <TableCell>
                          <div className="flex items-center">
                            {hasChildren ? (
                              <button onClick={() => toggleExpand(account.id)} className="mr-1">
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                            ) : <span className="w-5" />}
                            <span className="font-mono text-xs font-semibold">{account.code}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{account.name}</TableCell>
                        <TableCell><Badge className={`text-[9px] ${typeColors[account.accountType]}`}>{account.accountType}</Badge></TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">{formatSubType(account.subType)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {account.isActive ? <Badge className="text-[9px] bg-green-100 text-green-800">Active</Badge> : <Badge className="text-[9px] bg-gray-100 text-gray-800">Inactive</Badge>}
                            {account.allowPosting && <Badge className="text-[9px] bg-blue-100 text-blue-800">Posting</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right">{account._count?.voucherEntries || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingAccount(account); setForm({ code: account.code, name: account.name, accountType: account.accountType, subType: account.subType || '', parentId: account.parentId || '', allowPosting: account.allowPosting, description: account.description || '' }); setDialogOpen(true) }}><Edit2 className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeactivate(account)} disabled={account.isSystem}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasChildren && renderChildAccounts(accounts, account.id, 1, expandedIds, toggleExpand, setEditingAccount, setForm, setDialogOpen, handleDeactivate)}
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function renderChildAccounts(allAccounts: Account[], parentId: string, level: number, expandedIds: Set<string>, toggleExpand: (id: string) => void, setEditingAccount: (a: Account) => void, setForm: (f: any) => void, setDialogOpen: (o: boolean) => void, handleDeactivate: (a: Account) => void) {
  const children = allAccounts.filter(a => a.parentId === parentId)
  return children.map(account => {
    const hasChildren = allAccounts.some(a => a.parentId === account.id)
    const isExpanded = expandedIds.has(account.id)
    return (
      <React.Fragment key={account.id}>
        <TableRow className={`hover:bg-accent/50 ${!account.isActive ? 'opacity-50' : ''}`}>
          <TableCell>
            <div className="flex items-center" style={{ paddingLeft: `${level * 24}px` }}>
              {hasChildren ? (
                <button onClick={() => toggleExpand(account.id)} className="mr-1">
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : <span className="w-5" />}
              <span className="font-mono text-xs font-semibold">{account.code}</span>
            </div>
          </TableCell>
          <TableCell className="text-xs" style={{ paddingLeft: `${level * 8}px` }}>{account.name}</TableCell>
          <TableCell><Badge className={`text-[9px] ${typeColors[account.accountType]}`}>{account.accountType}</Badge></TableCell>
          <TableCell className="text-[10px] text-muted-foreground">{formatSubType(account.subType)}</TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              {account.isActive ? <Badge className="text-[9px] bg-green-100 text-green-800">Active</Badge> : <Badge className="text-[9px] bg-gray-100 text-gray-800">Inactive</Badge>}
              {account.allowPosting && <Badge className="text-[9px] bg-blue-100 text-blue-800">Posting</Badge>}
            </div>
          </TableCell>
          <TableCell className="text-xs text-right">{account._count?.voucherEntries || 0}</TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingAccount(account); setForm({ code: account.code, name: account.name, accountType: account.accountType, subType: account.subType || '', parentId: account.parentId || '', allowPosting: account.allowPosting, description: account.description || '' }); setDialogOpen(true) }}><Edit2 className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeactivate(account)} disabled={account.isSystem}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && hasChildren && renderChildAccounts(allAccounts, account.id, level + 1, expandedIds, toggleExpand, setEditingAccount, setForm, setDialogOpen, handleDeactivate)}
      </React.Fragment>
    )
  })
}
