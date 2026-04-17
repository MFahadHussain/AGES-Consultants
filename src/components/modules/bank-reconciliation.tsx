'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Landmark, CheckCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function BankReconciliation() {
  const [statements, setStatements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchData = async () => {
    setLoading(true)
    try { const res = await fetch('/api/bank-reconciliation'); setStatements(await res.json()) } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleMatch = async (statementItemId: string, voucherId: string) => {
    await fetch('/api/bank-reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reconcile', bankStatementItemId: statementItemId, voucherId }),
    })
    toast({ title: 'Matched', description: 'Item reconciled' })
    fetchData()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">Bank Reconciliation</h3>
      </div>

      {statements.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Landmark className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No Bank Statements</p>
            <p className="text-xs text-muted-foreground mt-1">Import bank statements to start reconciliation</p>
          </CardContent>
        </Card>
      )}

      {statements.map(statement => (
        <Card key={statement.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs">
                {statement.account?.code} - {statement.account?.name} | Statement Date: {new Date(statement.statementDate).toLocaleDateString()}
              </CardTitle>
              <div className="flex gap-2 text-[10px]">
                <span>Opening: {formatCurrency(statement.openingBalance)}</span>
                <span>Closing: {formatCurrency(statement.closingBalance)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Date</TableHead>
                  <TableHead className="text-[10px]">Description</TableHead>
                  <TableHead className="text-[10px]">Reference</TableHead>
                  <TableHead className="text-[10px] text-right">Amount</TableHead>
                  <TableHead className="text-[10px]">Type</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px]">Matched Voucher</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.items?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">{new Date(item.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">{item.description}</TableCell>
                    <TableCell className="text-xs font-mono">{item.reference || '-'}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                    <TableCell><Badge className={`text-[9px] ${item.type === 'DEPOSIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.type}</Badge></TableCell>
                    <TableCell>
                      {item.isMatched ? (
                        <Badge className="text-[9px] bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Matched</Badge>
                      ) : (
                        <Badge className="text-[9px] bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" />Unmatched</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{item.reconItems?.[0]?.voucher?.voucherNumber || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
