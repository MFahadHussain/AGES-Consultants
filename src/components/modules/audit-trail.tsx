'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Shield, Search, Download, RefreshCw, ChevronDown, ChevronUp, Filter,
  Clock, AlertTriangle, FileText, Activity
} from 'lucide-react'

// Types
interface AuditLog {
  id: string
  userId?: string
  username?: string
  action: string
  entity: string
  entityId?: string
  entityName?: string
  details?: string
  oldValues?: string
  newValues?: string
  ipAddress?: string
  severity: string
  module?: string
  createdAt: string
  user?: { name: string; email: string }
}

interface AuditResponse {
  data: AuditLog[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  statistics?: {
    total: number
    actionBreakdown: { action: string; count: number }[]
  }
}

// Color maps
const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  APPROVE: 'bg-emerald-100 text-emerald-800',
  REJECT: 'bg-rose-100 text-rose-800',
  LOGIN: 'bg-slate-100 text-slate-700',
  LOGOUT: 'bg-slate-100 text-slate-700',
  EXPORT: 'bg-amber-100 text-amber-800',
  PERMISSION_CHANGE: 'bg-purple-100 text-purple-800',
  PASSWORD_CHANGE: 'bg-orange-100 text-orange-800',
  PRINT: 'bg-cyan-100 text-cyan-800',
  REVERSE: 'bg-pink-100 text-pink-800',
  POST: 'bg-teal-100 text-teal-800',
  REVIEW: 'bg-yellow-100 text-yellow-800',
}

const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
}

const severityIcons: Record<string, string> = {
  info: 'ℹ',
  warning: '⚠',
  critical: '🔴',
}

export function AuditTrail() {
  // Filters
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Data
  const [data, setData] = useState<AuditResponse | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)

  // Real-time indicator
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [secondsAgo, setSecondsAgo] = useState(0)

  // Quick filters
  const [quickFilter, setQuickFilter] = useState<string | null>(null)

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (entityFilter !== 'all') params.set('entity', entityFilter)
      if (actionFilter !== 'all') params.set('action', actionFilter)
      if (moduleFilter !== 'all') params.set('module', moduleFilter)
      if (severityFilter !== 'all') params.set('severity', severityFilter)
      if (userFilter !== 'all') params.set('userId', userFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (searchQuery) params.set('search', searchQuery)
      params.set('page', page.toString())
      params.set('pageSize', pageSize.toString())
      params.set('includeStats', 'true')

      const res = await fetch(`/api/audit?${params}`)
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('Failed to fetch audit logs:', e)
      toast.error('Failed to load audit logs')
    }
    setLoading(false)
  }, [entityFilter, actionFilter, moduleFilter, severityFilter, userFilter, dateFrom, dateTo, searchQuery, page, pageSize])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      const raw = await res.json()
      setUsers(Array.isArray(raw) ? raw : raw.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const load = async () => { fetchAuditLogs() }
    load()
  }, [fetchAuditLogs])

  useEffect(() => {
    const load = async () => { fetchUsers() }
    load()
  }, [])

  // Real-time seconds counter
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchAuditLogs, 60000)
    return () => clearInterval(interval)
  }, [fetchAuditLogs])

  // Quick filter handlers
  const applyQuickFilter = (filter: string) => {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    // Reset all filters first
    setEntityFilter('all')
    setActionFilter('all')
    setModuleFilter('all')
    setUserFilter('all')
    setSearchQuery('')

    if (filter === quickFilter) {
      setQuickFilter(null)
      setSeverityFilter('all')
      setDateFrom('')
      setDateTo('')
      return
    }

    setQuickFilter(filter)
    switch (filter) {
      case 'critical':
        setSeverityFilter('critical')
        setDateFrom('')
        setDateTo('')
        break
      case 'today':
        setSeverityFilter('all')
        setDateFrom(today)
        setDateTo(today)
        break
      case 'week': {
        setSeverityFilter('all')
        const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
        setDateFrom(weekAgo)
        setDateTo(today)
        break
      }
      case 'month': {
        setSeverityFilter('all')
        const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
        setDateFrom(monthAgo)
        setDateTo(today)
        break
      }
    }
    setPage(1)
  }

  const exportCsv = () => {
    if (!data?.data) return
    const headers = ['Timestamp', 'User', 'Action', 'Module', 'Entity', 'Entity Name', 'Details', 'IP Address', 'Severity']
    const rows = data.data.map(log => [
      new Date(log.createdAt).toLocaleString(),
      log.user?.name || log.username || 'System',
      log.action,
      log.module || '',
      log.entity,
      log.entityName || '',
      typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || ''),
      log.ipAddress || '',
      log.severity,
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('Audit trail exported to CSV')
  }

  const parseJsonSafe = (str: string | null | undefined): any => {
    if (!str) return null
    try { return JSON.parse(str) } catch { return str }
  }

  const renderDiffValues = (oldVal: any, newVal: any) => {
    if (!oldVal && !newVal) return null
    const oldObj = typeof oldVal === 'string' ? parseJsonSafe(oldVal) : oldVal
    const newObj = typeof newVal === 'string' ? parseJsonSafe(newVal) : newVal

    if (!oldObj || !newObj) {
      return (
        <div className="grid grid-cols-2 gap-4">
          {oldObj && <div><p className="text-[10px] font-medium text-red-700 mb-1">Old Values</p><pre className="text-xs bg-red-50 p-2 rounded border border-red-100 overflow-auto max-h-40">{typeof oldObj === 'object' ? JSON.stringify(oldObj, null, 2) : String(oldObj)}</pre></div>}
          {newObj && <div><p className="text-[10px] font-medium text-green-700 mb-1">New Values</p><pre className="text-xs bg-green-50 p-2 rounded border border-green-100 overflow-auto max-h-40">{typeof newObj === 'object' ? JSON.stringify(newObj, null, 2) : String(newObj)}</pre></div>}
        </div>
      )
    }

    // Field-by-field diff
    const allKeys = Array.from(new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]))
    return (
      <div className="space-y-1">
        <div className="grid grid-cols-3 gap-2 text-[10px] font-medium text-muted-foreground">
          <span>Field</span><span className="text-red-600">Old</span><span className="text-green-600">New</span>
        </div>
        {allKeys.map(key => {
          const oldV = oldObj?.[key]
          const newV = newObj?.[key]
          const changed = JSON.stringify(oldV) !== JSON.stringify(newV)
          return (
            <div key={key} className={`grid grid-cols-3 gap-2 text-xs py-0.5 ${changed ? 'bg-amber-50' : ''}`}>
              <span className="font-medium">{key}</span>
              <span className={changed ? 'text-red-600 line-through' : 'text-muted-foreground'}>{String(oldV ?? '-')}</span>
              <span className={changed ? 'text-green-600 font-medium' : 'text-muted-foreground'}>{String(newV ?? '-')}</span>
            </div>
          )
        })}
      </div>
    )
  }

  const entities = ['Account', 'Voucher', 'VoucherEntry', 'Customer', 'Supplier', 'Budget', 'FixedAsset', 'PayrollBatch', 'User', 'Role', 'Permission', 'SecurityPolicy', 'ApprovalWorkflow']
  const actions = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'EXPORT', 'PERMISSION_CHANGE', 'PASSWORD_CHANGE', 'PRINT', 'REVERSE', 'POST', 'REVIEW']
  const modules = ['accounts', 'vouchers', 'users', 'security', 'payroll', 'reports', 'settings', 'budgets', 'import-export']
  const severities = ['info', 'warning', 'critical']

  const totalLogs = data?.pagination?.total || 0
  const actionBreakdown = data?.statistics?.actionBreakdown || []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Audit Trail</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Real-time indicator */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span>Updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Auto-refreshes every 60 seconds</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.data?.length}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Quick Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" /> Quick:</span>
        {[
          { key: 'critical', label: 'Critical Only', icon: AlertTriangle },
          { key: 'today', label: 'Today', icon: Clock },
          { key: 'week', label: 'This Week', icon: Activity },
          { key: 'month', label: 'This Month', icon: FileText },
        ].map(f => (
          <Button key={f.key} variant={quickFilter === f.key ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
            onClick={() => applyQuickFilter(f.key)}>
            <f.icon className="h-3 w-3 mr-1" /> {f.label}
          </Button>
        ))}
      </div>

      {/* Professional Filter Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Entity</Label>
              <Select value={entityFilter} onValueChange={v => { setEntityFilter(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Entities" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {entities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Action</Label>
              <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Actions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Module</Label>
              <Select value={moduleFilter} onValueChange={v => { setModuleFilter(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Modules" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Severity</Label>
              <Select value={severityFilter} onValueChange={v => { setSeverityFilter(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {severities.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">User</Label>
              <Select value={userFilter} onValueChange={v => { setUserFilter(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Users" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">From</Label>
              <Input type="date" className="h-8 w-32 text-xs" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">To</Label>
              <Input type="date" className="h-8 w-32 text-xs" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input className="h-8 w-44 text-xs pl-7" placeholder="Search details..." value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setPage(1) }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{totalLogs.toLocaleString()}</span>
          <span className="text-muted-foreground">total logs</span>
        </div>
        {actionBreakdown.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Separator orientation="vertical" className="h-4" />
            {actionBreakdown.slice(0, 6).map(ab => (
              <div key={ab.action} className="flex items-center gap-1">
                <Badge className={`text-[9px] h-4 ${actionColors[ab.action] || 'bg-gray-100 text-gray-800'}`}>{ab.action}</Badge>
                <span className="text-[10px] font-medium">{ab.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[160px]">Timestamp</TableHead>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs">Module</TableHead>
                  <TableHead className="text-xs">Entity</TableHead>
                  <TableHead className="text-xs">Entity Name</TableHead>
                  <TableHead className="text-xs">Details</TableHead>
                  <TableHead className="text-xs">IP Address</TableHead>
                  <TableHead className="text-xs">Severity</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                        <p className="text-xs text-muted-foreground">Loading audit logs...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !data?.data?.length ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Shield className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">No audit logs found</p>
                        <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data.data.map(log => (
                  <React.Fragment key={log.id}>
                    <TableRow
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${log.severity === 'critical' ? 'bg-red-50/50' : ''}`}
                      onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                            {(log.user?.name || log.username || 'S').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium">{log.user?.name || log.username || 'System'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[9px] ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{log.module || '-'}</TableCell>
                      <TableCell className="text-xs font-medium">{log.entity}</TableCell>
                      <TableCell className="text-xs text-primary cursor-pointer hover:underline max-w-[200px] truncate">
                        {log.entityName || log.entityId?.slice(0, 8) || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                        {log.details ? (() => {
                          const parsed = typeof log.details === 'string' ? parseJsonSafe(log.details) : log.details
                          if (parsed && typeof parsed === 'object' && parsed.summary) return parsed.summary
                          if (typeof parsed === 'string') return parsed.slice(0, 60)
                          const str = JSON.stringify(parsed)
                          return str.length > 60 ? str.slice(0, 60) + '…' : str
                        })() : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{log.ipAddress || '-'}</TableCell>
                      <TableCell>
                        <Badge className={`text-[9px] ${severityColors[log.severity] || 'bg-gray-100 text-gray-800'}`}>
                          {severityIcons[log.severity]} {log.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {expandedRow === log.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </TableCell>
                    </TableRow>
                    {expandedRow === log.id && (
                      <TableRow key={`${log.id}-detail`}>
                        <TableCell colSpan={10} className="bg-muted/20 p-4">
                          <div className="space-y-3">
                            {/* Full details */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div><span className="text-muted-foreground">Log ID:</span> <span className="font-mono">{log.id.slice(0, 16)}...</span></div>
                              <div><span className="text-muted-foreground">Entity ID:</span> <span className="font-mono">{log.entityId || '-'}</span></div>
                              <div><span className="text-muted-foreground">IP Address:</span> <span className="font-mono">{log.ipAddress || '-'}</span></div>
                              <div><span className="text-muted-foreground">Timestamp:</span> {new Date(log.createdAt).toLocaleString()}</div>
                            </div>

                            {/* Details JSON */}
                            {log.details && (
                              <div>
                                <p className="text-[10px] font-medium text-muted-foreground mb-1">Details</p>
                                <pre className="text-xs bg-muted/50 p-2 rounded border max-h-32 overflow-auto">
                                  {(() => { const parsed = typeof log.details === 'string' ? parseJsonSafe(log.details) : log.details; return typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed) })()}
                                </pre>
                              </div>
                            )}

                            {/* Diff view */}
                            {(log.oldValues || log.newValues) && (
                              <div>
                                <p className="text-[10px] font-medium text-muted-foreground mb-1">Value Changes</p>
                                {renderDiffValues(log.oldValues, log.newValues)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Per page</Label>
            <Select value={pageSize.toString()} onValueChange={v => { setPageSize(+v); setPage(1) }}>
              <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">
            {data?.pagination ? `${((page - 1) * pageSize) + 1}-${Math.min(page * pageSize, data.pagination.total)} of ${data.pagination.total.toLocaleString()}` : '0 results'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          {data?.pagination && (
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(data.pagination.totalPages, 5) }, (_, i) => {
                let pageNum: number
                if (data.pagination.totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= data.pagination.totalPages - 2) {
                  pageNum = data.pagination.totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <Button key={pageNum} variant={pageNum === page ? 'default' : 'outline'} size="sm" className="h-7 w-7 p-0 text-xs"
                    onClick={() => setPage(pageNum)}>
                    {pageNum}
                  </Button>
                )
              })}
            </div>
          )}
          <Button variant="outline" size="sm" disabled={!data?.pagination || page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  )
}
