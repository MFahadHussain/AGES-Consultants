'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
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

    const params = new URLSearchParams({ type: ledgerType })
    if (selectedAccount) params.set('accountId', selectedAccount)
    try {
      const res = await fetch(`/api/ledgers?${params}`)
      setData(await res.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { queueMicrotask(() => fetchData()) }, [ledgerType])

  const renderGeneralLedger = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selectedAccount} onValueChange={v => { setSelectedAccount(v); fetchData() }}>
          <SelectTrigger className="h-8 w-64 text-xs"><SelectValue placeholder="Filter by account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-4">
        {data.map((group: any) => (
          <Card key={group.accountId}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono">{group.accountCode} - {group.accountName}</CardTitle>
                <div className="flex gap-3 text-[10px]">
                  <span>Dr: {formatCurrency(group.totalDebit)}</span>
                  <span>Cr: {formatCurrency(group.totalCredit)}</span>
                  <Badge className="text-[9px]">Balance: {formatCurrency(Math.abs(group.totalDebit - group.totalCredit))}</Badge>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.entries?.map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{new Date(e.voucher.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs font-mono">{e.voucher.voucherNumber}</TableCell>
                      <TableCell className="text-xs">{e.description || e.voucher.narration}</TableCell>
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
    </div>
  )

  const renderSubLedger = (type: string) => (
    <div className="space-y-4">
      {data.map((group: any) => (
        <Card key={type === 'receivables' ? group.customerId : group.supplierId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">
              {type === 'receivables' ? group.customer?.name : group.supplier?.name}
            </CardTitle>
            <div className="flex gap-3 text-[10px]">
              <span>Total Dr: {formatCurrency(group.totalDebit)}</span>
              <span>Total Cr: {formatCurrency(group.totalCredit)}</span>
              <Badge className="text-[9px]">Balance: {formatCurrency(Math.abs(group.totalDebit - group.totalCredit))}</Badge>
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
      {data.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No data found</p>}
    </div>
  )

  const renderBankExpenseLedger = () => (
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
