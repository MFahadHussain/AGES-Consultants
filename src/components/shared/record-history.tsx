'use client'

import React, { useEffect, useState } from 'react'
import { Clock, Shield, AlertTriangle, AlertCircle, Info, ChevronRight, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface AuditLog {
  id: string
  action: string
  username: string
  userEmail: string
  createdAt: string
  details?: string
  severity?: string
}

export function RecordHistory({ entityId }: { entityId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      if (!entityId) return
      try {
        setLoading(true)
        const res = await fetch(`/api/audit?entityId=${entityId}&limit=100`)
        const json = await res.json()
        const data = Array.isArray(json) ? json : (json.data || [])
        // Sort chronologically (oldest to newest) for history
        setLogs(data.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
      } catch (err) {
        console.error('Failed to fetch history:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [entityId])

  if (loading) {
    return <div className="py-8 text-center text-xs text-muted-foreground">Loading history...</div>
  }

  if (!logs.length) {
    return <div className="py-8 text-center text-xs text-muted-foreground">No activity history found for this record.</div>
  }

  const actionColors: Record<string, string> = {
    CREATE: 'text-[#0F2D78] bg-emerald-50 border-[#A5B4D2]',
    UPDATE: 'text-blue-600 bg-blue-50 border-blue-200',
    DELETE: 'text-red-600 bg-red-50 border-red-200',
    APPROVE: 'text-teal-600 bg-teal-50 border-teal-200',
    REJECT: 'text-rose-600 bg-rose-50 border-rose-200',
    POST: 'text-purple-600 bg-purple-50 border-purple-200',
    QUICK_POST: 'text-purple-600 bg-purple-50 border-purple-200',
    REVOKE: 'text-amber-600 bg-amber-50 border-amber-200',
    SUBMIT: 'text-blue-600 bg-blue-50 border-blue-200'
  }

  return (
    <div className="space-y-4">
      <div className="relative border-l border-muted ml-3 space-y-6 pb-4">
        {logs.map((log, index) => {
          const isLast = index === logs.length - 1
          const date = new Date(log.createdAt)
          
          return (
            <div key={log.id} className="relative pl-6">
              {/* Timeline Dot */}
              <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-background border-2 border-primary" />
              
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-foreground">
                    {log.action.charAt(0).toUpperCase() + log.action.slice(1).toLowerCase().replace('_', ' ')}
                  </span>
                  <span className="text-muted-foreground text-xs">by</span>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{log.username || 'System'}</span>
                    {log.details && typeof log.details === 'object' && (log.details as any).role && (
                      <Badge variant="outline" className="text-[9px] ml-1 px-1 py-0 h-4">{(log.details as any).role}</Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">—</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                
                {log.details && (typeof log.details === 'string' || Object.keys(log.details).filter(k => k !== 'role').length > 0) && (
                  <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-md border mt-1 font-mono break-words">
                    {typeof log.details === 'object' ? JSON.stringify(Object.fromEntries(Object.entries(log.details).filter(([k]) => k !== 'role'))) : log.details}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
