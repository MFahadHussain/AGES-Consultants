'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  Shield, Search, Download, RefreshCw, ChevronDown, ChevronUp, Filter,
  Clock, AlertTriangle, FileText, Activity, X, EyeOff, Lock,
  Database, Users, Settings, Info, CheckCircle, AlertCircle,
  Loader2, ChevronRight
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────
interface AuditLog {
  id: string
  userId?: string | null
  username?: string | null
  action: string
  entity: string
  entityId?: string | null
  entityName?: string | null
  details?: unknown
  ipAddress?: string | null
  userAgent?: string | null
  sessionId?: string | null
  severity: string
  module?: string | null
  createdAt: string
  user?: { name: string; email: string } | null
  payloadVisible?: boolean
}

interface AuditResponse {
  data: AuditLog[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

// ── Action badge config ───────────────────────────────────────
const ACTION_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  CREATE:            { color: '#16A34A', bg: '#F0FDF4', label: 'Create' },
  UPDATE:            { color: '#2563EB', bg: '#EFF6FF', label: 'Update' },
  DELETE:            { color: '#DC2626', bg: '#FEF2F2', label: 'Delete' },
  APPROVE:           { color: '#0891B2', bg: '#ECFEFF', label: 'Approve' },
  REJECT:            { color: '#DC2626', bg: '#FEF2F2', label: 'Reject' },
  POST:              { color: '#7C3AED', bg: '#F5F3FF', label: 'Post' },
  QUICK_POST:        { color: '#7C3AED', bg: '#F5F3FF', label: 'Quick Post' },
  REVERSE:           { color: '#D97706', bg: '#FFFBEB', label: 'Reverse' },
  LOGIN:             { color: '#6B7280', bg: '#F9FAFB', label: 'Login' },
  LOGOUT:            { color: '#6B7280', bg: '#F9FAFB', label: 'Logout' },
  PASSWORD_CHANGE:   { color: '#D97706', bg: '#FFFBEB', label: 'Pwd Change' },
  PERMISSION_CHANGE: { color: '#7C3AED', bg: '#F5F3FF', label: 'Perm Change' },
  EXPORT:            { color: '#0891B2', bg: '#ECFEFF', label: 'Export' },
  PRINT:             { color: '#6B7280', bg: '#F9FAFB', label: 'Print' },
  SUBMIT:            { color: '#2563EB', bg: '#EFF6FF', label: 'Submit' },
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  info:     { color: '#2563EB', bg: '#EFF6FF', icon: <Info className="w-3 h-3" /> },
  warning:  { color: '#D97706', bg: '#FFFBEB', icon: <AlertTriangle className="w-3 h-3" /> },
  critical: { color: '#DC2626', bg: '#FEF2F2', icon: <AlertCircle className="w-3 h-3" /> },
}

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action] ?? { color: '#6B7280', bg: '#F9FAFB', label: action }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
      {cfg.label}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
      {cfg.icon}
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  )
}

function UserAvatar({ name }: { name: string }) {
  const colors = ['#1A7A4A', '#2563EB', '#7C3AED', '#D97706', '#DC2626', '#0891B2']
  const color = colors[name.charCodeAt(0) % colors.length]
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
      style={{ background: color }}>
      {initials}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, icon, color, bg }: {
  label: string; value: number; icon: React.ReactNode; color: string; bg: string
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#6B7280' }}>{label}</span>
        <span className="p-1.5 rounded-lg" style={{ background: bg, color }}>{icon}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: '#1a1a2e', fontFamily: 'monospace' }}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────
function AuditDetailDrawer({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const displayName = log.user?.name || log.username || 'System'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md flex flex-col h-full"
        style={{ background: '#fff', borderLeft: '1px solid #E5E7EB', boxShadow: '-4px 0 24px rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-3">
            <UserAvatar name={displayName} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>{displayName}</p>
              <p className="text-[11px]" style={{ color: '#6B7280' }}>{log.user?.email || 'No email'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" style={{ color: '#6B7280' }} />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <ActionBadge action={log.action} />
              <SeverityBadge severity={log.severity} />
              {log.module && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}>
                  <Settings className="w-3 h-3" />
                  {log.module}
                </span>
              )}
            </div>

            {/* Details grid */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Event Details</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Entity', log.entity],
                  ['Entity Name', log.entityName || '—'],
                  ['IP Address', log.ipAddress || '—'],
                  ['Timestamp', new Date(log.createdAt).toLocaleString('en-PK')],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <p className="text-[10px] font-medium mb-0.5" style={{ color: '#9CA3AF' }}>{k}</p>
                    <p className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{v}</p>
                  </div>
                ))}
                {log.entityId && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-medium mb-0.5" style={{ color: '#9CA3AF' }}>Entity ID</p>
                    <p className="text-[11px] font-mono break-all" style={{ color: '#6B7280' }}>{log.entityId}</p>
                  </div>
                )}
                {log.userAgent && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-medium mb-0.5" style={{ color: '#9CA3AF' }}>User Agent</p>
                    <p className="text-[10px] break-all" style={{ color: '#6B7280' }}>{log.userAgent}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payload */}
            {log.details && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>Payload</p>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <span className="text-[10px] font-mono" style={{ color: '#6B7280' }}>JSON</span>
                  </div>
                  <pre className="text-[11px] font-mono p-3 overflow-auto max-h-48 leading-relaxed"
                    style={{ background: '#fff', color: '#1A7A4A', whiteSpace: 'pre-wrap' }}>
                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Immutability notice */}
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#16A34A' }} />
              <p className="text-[10px] leading-relaxed" style={{ color: '#15803D' }}>
                This audit record is immutable and cannot be modified or deleted by any user.
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export function AuditTrail() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: '50' })
      if (search) params.set('search', search)
      if (filterAction !== 'all') params.set('action', filterAction)
      if (filterSeverity !== 'all') params.set('severity', filterSeverity)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data: AuditResponse = await res.json()
      setLogs(data.data || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch {
      toast({ title: 'Error', description: 'Failed to load audit trail', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, filterAction, filterSeverity, dateFrom, dateTo, toast])

  useEffect(() => { fetchLogs(1); setPage(1) }, [fetchLogs])

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/audit?pageSize=10000`)
      const data = await res.json()
      const rows: AuditLog[] = data.data || []
      if (!rows.length) { toast({ title: 'No data to export' }); return }
      const headers = ['Date', 'User', 'Action', 'Entity', 'Entity Name', 'Severity', 'Module', 'IP']
      const csv = [headers.join(','), ...rows.map(r => [
        new Date(r.createdAt).toLocaleString(),
        r.username || r.user?.name || '',
        r.action, r.entity, r.entityName || '',
        r.severity, r.module || '', r.ipAddress || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      toast({ title: 'Exported', description: `${rows.length} records exported` })
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  const criticalCount = logs.filter(l => l.severity === 'critical').length
  const warningCount = logs.filter(l => l.severity === 'warning').length
  const infoCount = logs.filter(l => l.severity === 'info').length

  return (
    <div style={{ background: '#F5F7FA', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">

        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: '#1a1a2e' }}>
              <Shield className="w-5 h-5" style={{ color: '#1A7A4A' }} />
              Audit Trail
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
              Complete log of all system actions and security events
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fetchLogs(page)} disabled={loading} className="h-8 text-xs">
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} className="h-8 text-xs">
              <Download className="w-3.5 h-3.5 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total Events" value={total} icon={<FileText className="w-4 h-4" />} color="#1A7A4A" bg="#F0FDF4" />
          <KpiCard label="Critical" value={criticalCount} icon={<AlertCircle className="w-4 h-4" />} color="#DC2626" bg="#FEF2F2" />
          <KpiCard label="Warnings" value={warningCount} icon={<AlertTriangle className="w-4 h-4" />} color="#D97706" bg="#FFFBEB" />
          <KpiCard label="Info" value={infoCount} icon={<Info className="w-4 h-4" />} color="#2563EB" bg="#EFF6FF" />
        </div>

        {/* Search & Filters */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
              <Input
                placeholder="Search by user, action, entity, IP address..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-8 text-xs">
              <Filter className="w-3.5 h-3.5 mr-1" />
              Filters
              {showFilters ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t" style={{ borderColor: '#F3F4F6' }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6B7280' }}>Action</p>
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {['LOGIN','LOGOUT','CREATE','UPDATE','DELETE','APPROVE','REJECT','POST','REVERSE','EXPORT','PRINT','PASSWORD_CHANGE','PERMISSION_CHANGE'].map(a => (
                      <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6B7280' }}>Severity</p>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6B7280' }}>From Date</p>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6B7280' }}>To Date</p>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* Table header bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E5E7EB' }}>
            <span className="text-xs font-medium" style={{ color: '#6B7280' }}>
              {loading ? 'Loading...' : `${total.toLocaleString()} events`}
            </span>
            <div className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
              <span>Page {page} of {totalPages}</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchLogs(p) }}
                disabled={page <= 1 || loading}>
                ‹
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchLogs(p) }}
                disabled={page >= totalPages || loading}>
                ›
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ background: '#F9FAFB' }}>
                  {['Timestamp', 'User', 'Action', 'Entity', 'Severity', 'Module', 'IP Address', ''].map(h => (
                    <TableHead key={h} className="text-[10px] font-semibold uppercase tracking-wide h-9"
                      style={{ color: '#6B7280' }}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: '#1A7A4A' }} />
                      <p className="text-sm" style={{ color: '#6B7280' }}>Loading audit logs...</p>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16">
                      <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                      <p className="text-sm font-medium" style={{ color: '#6B7280' }}>No audit logs found</p>
                      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Try adjusting your filters</p>
                    </TableCell>
                  </TableRow>
                ) : logs.map((log, idx) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                    style={{ borderBottom: '1px solid #F3F4F6' }}
                    onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                  >
                    <TableCell className="py-2.5 text-[11px] font-mono whitespace-nowrap" style={{ color: '#6B7280' }}>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 flex-shrink-0" style={{ color: '#D1D5DB' }} />
                        {new Date(log.createdAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={log.username || log.user?.name || 'S'} />
                        <div>
                          <div className="text-xs font-medium" style={{ color: '#1a1a2e' }}>
                            {log.username || log.user?.name || 'System'}
                          </div>
                          {log.user?.email && (
                            <div className="text-[10px]" style={{ color: '#9CA3AF' }}>{log.user.email}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <ActionBadge action={log.action} />
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="text-xs font-medium" style={{ color: '#374151' }}>{log.entity}</div>
                      {log.entityName && (
                        <div className="text-[10px] truncate max-w-[130px]" style={{ color: '#9CA3AF' }}>{log.entityName}</div>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <SeverityBadge severity={log.severity} />
                    </TableCell>
                    <TableCell className="py-2.5 text-[11px]" style={{ color: '#6B7280' }}>
                      {log.module ? (
                        <span className="flex items-center gap-1">
                          <Settings className="w-3 h-3" />
                          <span className="capitalize">{log.module}</span>
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="py-2.5 text-[11px] font-mono" style={{ color: '#9CA3AF' }}>
                      {log.ipAddress || '—'}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: '#D1D5DB' }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedLog && (
        <AuditDetailDrawer
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  )
}
