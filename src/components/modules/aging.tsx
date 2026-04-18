'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, TrendingUp, TrendingDown } from 'lucide-react'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function AgingAnalysis() {
  const [type, setType] = useState('receivables')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/aging?type=${type}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [type])

  const bucketColors = ['bg-green-100 text-green-800', 'bg-yellow-100 text-yellow-800', 'bg-orange-100 text-orange-800', 'bg-red-100 text-red-800', 'bg-red-200 text-red-900']

  return (
    <div className="space-y-4">
      <Tabs value={type} onValueChange={setType}>
        <TabsList className="h-8">
          <TabsTrigger value="receivables" className="text-xs h-7 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Receivables Aging</TabsTrigger>
          <TabsTrigger value="payables" className="text-xs h-7 flex items-center gap-1"><TrendingDown className="h-3 w-3" />Payables Aging</TabsTrigger>
        </TabsList>

        <TabsContent value={type}>
          {loading ? (
            <Card><CardContent className="p-8 text-center"><p className="text-xs text-muted-foreground">Loading aging data...</p></CardContent></Card>
          ) : !data?.data?.length ? (
            <Card><CardContent className="p-8 text-center"><Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-xs text-muted-foreground">No aging data found</p></CardContent></Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {data.buckets?.map((bucket: any, i: number) => {
                  const total = data.data.reduce((sum: number, d: any) => sum + d.buckets[i]?.amount, 0)
                  return (
                    <Card key={i}>
                      <CardContent className="p-3 text-center">
                        <Badge className={`text-[9px] mb-1 ${bucketColors[i]}`}>{bucket.label}</Badge>
                        <p className="text-sm font-bold mt-1">{formatCurrency(total)}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Detail Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">{type === 'receivables' ? 'Customer' : 'Supplier'}</TableHead>
                        <TableHead className="text-[10px] text-right">Total Balance</TableHead>
                        {data.buckets?.map((bucket: any) => (
                          <TableHead key={bucket.label} className="text-[10px] text-right">{bucket.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.data.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-medium">
                            {type === 'receivables' ? item.customer?.name : item.supplier?.name}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold">{formatCurrency(item.balance)}</TableCell>
                          {item.buckets?.map((bucket: any, bIdx: number) => (
                            <TableCell key={bIdx} className="text-xs text-right">
                              {bucket.amount > 0 ? (
                                <span className={bIdx >= 3 ? 'text-red-600 font-semibold' : ''}>{formatCurrency(bucket.amount)}</span>
                              ) : '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
