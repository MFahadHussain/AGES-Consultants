'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertCircle, BookOpen, FileText } from 'lucide-react'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function EmptyState({ type }: { type: string }) {
  const messages: Record<string, { title: string; description: string }> = {
    general: {
      title: 'No Ledger Entries Found',
      description: 'Voucher entries will appear here once vouchers are approved or posted. Create a voucher in Voucher Management, then approve and post it to see entries in the General Ledger.'
    },
    receivables: {
      title: 'No Receivables Entries',
      description: 'Receivables ledger entries will appear when vouchers with customer references are approved/posted.'
    },
    payables: {
      title: 'No Payables Entries',
      description: 'Payables ledger entries will appear when vouchers with supplier references are approved/posted.'
    },
    bank: {
      title: 'No Bank Ledger Entries',
      description: 'Bank ledger entries will appear when vouchers for bank accounts are approved/posted.'
    },
    expense: {
      title: 'No Expense Ledger Entries',
      description: 'Expense ledger entries will appear when vouchers with expense accounts are approved/posted.'
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
        <span>Only <strong>approved</strong> and <strong>posted</strong> vouchers appear in ledgers. Use &quot;Quick Post&quot; in Voucher Management to post immediately.</span>
      </div>
    </div>
  )
}

export function Ledgers() {
  const [ledgerType, setLedgerType] = useState('general')
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      fetch('/api/accounts?isActive=true').then(r => r.json()).then(d => setAccounts(d))
    })
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const params = new URLSearchParams({ type: ledgerType })
    if (selectedAccount && selectedAccount !== 'all') params.set('accountId', selectedAccount)
    try {
      const res = await fetch(`/api/ledgers?${params}`)
      const result = await res.json()
      setData(Array.isArray(result) ? result : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { queueMicrotask(() => fetchData()) }, [ledgerType, selectedAccount])

  const renderGeneralLedger = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selectedAccount} onValueChange={v => { setSelectedAccount(v) }}>
          <SelectTrigger className="h-8 w-64 text-xs"><SelectValue placeholder="Filter by account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {loading ? (
        <div className="text-center text-xs py-8 text-muted-foreground">Loading ledger data...</div>
      ) : data.length === 0 ? (
        <EmptyState type="general" />
      ) : (
        <div className="space-y-4">
          {data.map((group: any) => {
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
                        <TableHead className="text-[10px]">Description</TableHead>
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
                          <TableCell className="text-xs">{e.description || e.voucher.narration}</TableCell>
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

  const renderSubLedger = (type: string) => (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center text-xs py-8 text-muted-foreground">Loading...</div>
      ) : data.length === 0 ? (
        <EmptyState type={type} />
      ) : data.map((group: any) => (
        <Card key={type === 'receivables' ? group.customerId : group.supplierId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">
              {type === 'receivables' ? group.customer?.name : group.supplier?.name}
            </CardTitle>
            <div className="flex gap-3 text-[10px]">
              <span>Total Dr: {formatCurrency(group.totalDebit)}</span>
              <span>Total Cr: {formatCurrency(group.totalCredit)}</span>
              <Badge className="text-[9px]">Balance: {formatCurrency(Math.abs(group.totalDebit - group.totalCredit))} {group.totalDebit >= group.totalCredit ? 'Dr' : 'Cr'}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Date</TableHead>
                  <TableHead className="text-[10px]">Voucher</TableHead>
                  <TableHead className="text-[10px]">Account</TableHead>
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

  const renderBankExpenseLedger = () => (
    <div>
      {loading ? (
        <div className="text-center text-xs py-8 text-muted-foreground">Loading...</div>
      ) : (Array.isArray(data) ? data : []).length === 0 ? (
        <EmptyState type={ledgerType} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Date</TableHead>
                  <TableHead className="text-[10px]">Voucher</TableHead>
                  <TableHead className="text-[10px]">Account</TableHead>
                  <TableHead className="text-[10px]">Description</TableHead>
                  <TableHead className="text-[10px] text-right">Debit</TableHead>
                  <TableHead className="text-[10px] text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(data) ? data : []).map((e: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{new Date(e.voucher?.date || e.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs font-mono">{e.voucher?.voucherNumber}</TableCell>
                    <TableCell className="text-xs">{e.account?.code} - {e.account?.name}</TableCell>
                    <TableCell className="text-xs">{e.description || e.voucher?.narration}</TableCell>
                    <TableCell className="text-xs text-right">{e.debit > 0 ? formatCurrency(e.debit) : ''}</TableCell>
                    <TableCell className="text-xs text-right">{e.credit > 0 ? formatCurrency(e.credit) : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
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

        <TabsContent value="general">{renderGeneralLedger()}</TabsContent>
        <TabsContent value="receivables">{renderSubLedger('receivables')}</TabsContent>
        <TabsContent value="payables">{renderSubLedger('payables')}</TabsContent>
        <TabsContent value="bank">{renderBankExpenseLedger()}</TabsContent>
        <TabsContent value="expense">{renderBankExpenseLedger()}</TabsContent>
      </Tabs>
    </div>
  )
}
