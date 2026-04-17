'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Shield, Search } from 'lucide-react'

export function AuditTrail() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')

  useEffect(() => {
    const params = new URLSearchParams()
    if (entityFilter !== 'all') params.set('entity', entityFilter)
    if (actionFilter !== 'all') params.set('action', actionFilter)
    fetch(`/api/audit?${params}`)
      .then(r => r.json())
      .then(d => { setLogs(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [entityFilter, actionFilter])

  const actionColors: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
    APPROVE: 'bg-emerald-100 text-emerald-800',
    REJECT: 'bg-orange-100 text-orange-800',
    REVIEW: 'bg-yellow-100 text-yellow-800',
    POST: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">Audit Trail</h3>
      </div>

      <div className="flex items-center gap-2">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {['Account', 'Voucher', 'VoucherEntry', 'Customer', 'Supplier', 'Budget', 'FixedAsset', 'PayrollBatch'].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'REVIEW', 'POST'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Timestamp</TableHead>
                <TableHead className="text-[10px]">User</TableHead>
                <TableHead className="text-[10px]">Action</TableHead>
                <TableHead className="text-[10px]">Entity</TableHead>
                <TableHead className="text-[10px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-xs py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-xs py-8 text-muted-foreground">No audit logs found</TableCell></TableRow>
              ) : logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{log.user?.name || 'System'}</TableCell>
                  <TableCell><Badge className={`text-[9px] ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>{log.action}</Badge></TableCell>
                  <TableCell className="text-xs font-medium">{log.entity}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{log.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
