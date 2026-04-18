'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertCircle, BookOpen, RefreshCw } from 'lucide-react'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function EmptyState({ type }: { type: string }) {
  const messages: Record<string, { title: string; description: string }> = {
    general: {
      title: 'No Ledger Entries Found',
      description: 'Create and post vouchers in Voucher Management to see entries here. Use "Auto Post to GL" when creating vouchers, or use "Quick Post" on existing drafts.'
    },
    receivables: {
      title: 'No Receivables Entries',
      description: 'Receivables ledger entries will appear when vouchers with customer references are posted.'
    },
    payables: {
      title: 'No Payables Entries',
      description: 'Payables ledger entries will appear when vouchers with supplier references are posted.'
    },
    bank: {
      title: 'No Bank Ledger Entries',
      description: 'Bank ledger entries will appear when vouchers for bank accounts are posted.'
    },
    expense: {
      title: 'No Expense Ledger Entries',
      description: 'Expense ledger entries will appear when vouchers with expense accounts are posted.'
    }
  }
  const msg = messages[type] || messages.general
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <BookOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium mb-1">{msg.title}</h3>
      <p className="text-xs text-muted-foreground max-w-md">{msg.description}</p>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded-md border border-amber-200 dark:border-amber-800">
        <AlertCircle className="h-3 w-3" />
        <span>By default, only <strong>approved</strong> and <strong>posted</strong> vouchers appear here. Change the filter to &quot;All&quot; to include drafts.</span>
      </div>
    </div>
  )
}

export function Ledgers() {
  const [ledgerType, setLedgerType] = useState('general')
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [statusFilter, setStatusFilter] = useState('posted')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const ledgerTypeRef = useRef(ledgerType)
  const statusFilterRef = useRef(statusFilter)
  const selectedAccountRef = useRef(selectedAccount)
  useEffect(() => { ledgerTypeRef.current = ledgerType }, [ledgerType])
  useEffect(() => { statusFilterRef.current = statusFilter }, [statusFilter])
  useEffect(() => { selectedAccountRef.current = selectedAccount }, [selectedAccount])

  useEffect(() => {
    fetch('/api/accounts?isActive=true').then(r => r.json()).then(d => setAccounts(d)).catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const lt = ledgerTypeRef.current
    const sf = statusFilterRef.current
    const sa = selectedAccountRef.current
    const params = new URLSearchParams({ type: lt, status: sf })
    if (sa && sa !== 'all') params.set('accountId', sa)
    try {
      const res = await fetch(`/api/ledgers?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const result = await res.json()
      setData(Array.isArray(result) ? result : [])
    } catch (e) { console.error(e); setData([]) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [ledgerType, selectedAccount, statusFilter, fetchData])

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      posted: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return <Badge className={`text-[8px] ${colors[status] || 'bg-gray-100 text-gray-800'}`}>{status}</Badge>
  }

  // Shared filter bar
  const renderFilterBar = (showAccountFilter = false) => (
    <div className="flex items-center gap-2 flex-wrap">
      {showAccountFilter && (
        <Select value={selectedAccount} onValueChange={v => { setSelectedAccount(v) }}>
          <SelectTrigger className="h-8 w-64 text-xs"><SelectValue placeholder="Filter by account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={statusFilter} onValueChange={v => setStatusFilter(v)}>
        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Voucher Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="posted">Approved & Posted</SelectItem>
          <SelectItem value="approved">Reviewed & Above</SelectItem>
          <SelectItem value="all">All (incl. Drafts)</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fetchData}>
        <RefreshCw className="h-3 w-3 mr-1" /> Refresh
      </Button>
    </div>
  )

  // Grouped ledger renderer (used by General, Bank, Expense)
  const renderGroupedLedger = (emptyType: string, showAccountFilter = false) => (
    <div className="space-y-4">
      {renderFilterBar(showAccountFilter)}
      {loading ? (
        <div className="text-center text-xs py-8 text-muted-foreground">Loading ledger data...</div>
      ) : data.length === 0 ? (
        <EmptyState type={emptyType} />
      ) : (
        <div className="space-y-4">
          {data.map((group: any) => {
            // Only render accounts that have entries
            if (!group.entries || group.entries.length === 0) return null

            // Calculate running balance
            let runningBalance = 0
            const entriesWithBalance = group.entries.map((e: any) => {
              if (group.accountType === 'ASSET' || group.accountType === 'EXPENSE') {
                runningBalance += e.debit - e.credit
              } else {
                runningBalance += e.credit - e.debit
              }
              return { ...e, balance: runningBalance }
            })

            return (
              <Card key={group.accountId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-mono">{group.accountCode} - {group.accountName}</CardTitle>
                    <div className="flex gap-3 text-[10px]">
                      <span>Total Dr: {formatCurrency(group.totalDebit)}</span>
                      <span>Total Cr: {formatCurrency(group.totalCredit)}</span>
                      <Badge className="text-[9px]">Balance: {formatCurrency(Math.abs(group.totalDebit - group.totalCredit))} {group.totalDebit >= group.totalCredit ? 'Dr' : 'Cr'}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Date</TableHead>
                        <TableHead className="text-[10px]">Voucher</TableHead>
                        <TableHead className="text-[10px]">Type</TableHead>
                        <TableHead className="text-[10px]">Description</TableHead>
                        <TableHead className="text-[10px]">Status</TableHead>
                        <TableHead className="text-[10px] text-right">Debit</TableHead>
                        <TableHead className="text-[10px] text-right">Credit</TableHead>
                        <TableHead className="text-[10px] text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entriesWithBalance.map((e: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{new Date(e.voucher.date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-xs font-mono">{e.voucher.voucherNumber}</TableCell>
                          <TableCell className="text-xs">
                            {e.voucher.voucherTypeName && (
                              <Badge className={`text-[8px] ${
                                e.voucher.voucherType === 'BP' ? 'bg-red-100 text-red-800' :
                                e.voucher.voucherType === 'CP' ? 'bg-orange-100 text-orange-800' :
                                e.voucher.voucherType === 'BR' ? 'bg-emerald-100 text-emerald-800' :
                                e.voucher.voucherType === 'CR' ? 'bg-green-100 text-green-800' :
                                e.voucher.voucherType === 'JV' ? 'bg-blue-100 text-blue-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>{e.voucher.voucherTypeName}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{e.description || e.voucher.narration}</TableCell>
                          <TableCell>{statusBadge(e.voucher.status)}</TableCell>
                          <TableCell className="text-xs text-right">{e.debit > 0 ? formatCurrency(e.debit) : ''}</TableCell>
                          <TableCell className="text-xs text-right">{e.credit > 0 ? formatCurrency(e.credit) : ''}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">
                            {formatCurrency(Math.abs(e.balance))} {e.balance >= 0 ? 'Dr' : 'Cr'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  // Sub-ledger renderer (Receivables / Payables)
  const renderSubLedger = (type: string) => (
    <div className="space-y-4">
      {renderFilterBar(false)}
      {loading ? (
        <div className="text-center text-xs py-8 text-muted-foreground">Loading...</div>
      ) : data.length === 0 ? (
        <EmptyState type={type} />
      ) : data.map((group: any) => (
        <Card key={type === 'receivables' ? group.customerId : group.supplierId}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs">
                {type === 'receivables' ? group.customer?.name : group.supplier?.name}
              </CardTitle>
              <div className="flex gap-3 text-[10px]">
                <span>Total Dr: {formatCurrency(group.totalDebit)}</span>
                <span>Total Cr: {formatCurrency(group.totalCredit)}</span>
                <Badge className="text-[9px]">Balance: {formatCurrency(Math.abs(group.totalDebit - group.totalCredit))} {group.totalDebit >= group.totalCredit ? 'Dr' : 'Cr'}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Date</TableHead>
                  <TableHead className="text-[10px]">Voucher</TableHead>
                  <TableHead className="text-[10px]">Account</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px] text-right">Debit</TableHead>
                  <TableHead className="text-[10px] text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.entries?.map((e: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{new Date(e.voucher.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs font-mono">{e.voucher.voucherNumber}</TableCell>
                    <TableCell className="text-xs">{e.account?.code} - {e.account?.name}</TableCell>
                    <TableCell>{statusBadge(e.voucher.status)}</TableCell>
                    <TableCell className="text-xs text-right">{e.debit > 0 ? formatCurrency(e.debit) : ''}</TableCell>
                    <TableCell className="text-xs text-right">{e.credit > 0 ? formatCurrency(e.credit) : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <Tabs value={ledgerType} onValueChange={setLedgerType}>
        <TabsList className="h-8">
          <TabsTrigger value="general" className="text-xs h-7">General Ledger</TabsTrigger>
          <TabsTrigger value="receivables" className="text-xs h-7">Receivables</TabsTrigger>
          <TabsTrigger value="payables" className="text-xs h-7">Payables</TabsTrigger>
          <TabsTrigger value="bank" className="text-xs h-7">Bank Ledger</TabsTrigger>
          <TabsTrigger value="expense" className="text-xs h-7">Expense Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="general">{renderGroupedLedger('general', true)}</TabsContent>
        <TabsContent value="receivables">{renderSubLedger('receivables')}</TabsContent>
        <TabsContent value="payables">{renderSubLedger('payables')}</TabsContent>
        <TabsContent value="bank">{renderGroupedLedger('bank', false)}</TabsContent>
        <TabsContent value="expense">{renderGroupedLedger('expense', false)}</TabsContent>
      </Tabs>
    </div>
  )
}
