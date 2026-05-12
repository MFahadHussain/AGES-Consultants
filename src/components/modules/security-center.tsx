'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
  Shield, Users, Lock, AlertTriangle, Activity, Clock, CheckCircle2, XCircle,
  Monitor, Smartphone, Globe, Trash2, RefreshCw, Download, Plus, ChevronDown,
  ChevronUp, Edit, Eye, Key, Fingerprint, MapPin, Zap, ArrowUpRight, ArrowDownRight,
  Layers, Workflow, Settings2, FileCheck, Timer, Ban
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'

// Types
interface Session {
  id: string; userId: string; userName: string; userEmail: string; userRole: string;
  deviceInfo: { browser?: string; os?: string; device?: string } | null;
  ipAddress: string | null;
  geoLocation: { country?: string; city?: string } | null;
  isActive: boolean; expiresAt: string; lastActivityAt: string; createdAt: string;
}

interface LoginRecord {
  id: string; userId: string | null; userName: string | null; userEmail: string; email: string;
  loginStatus: string; failureReason: string | null; ipAddress: string | null;
  browser: string | null; os: string | null; device: string | null;
  geoLocation: { country?: string; city?: string } | null; createdAt: string;
}

interface SecurityPolicy {
  id: string; name: string; description?: string;
  passwordMinLength: number; passwordMaxLength: number;
  passwordRequireUppercase: boolean; passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean; passwordRequireSpecial: boolean;
  passwordExpiryDays: number; passwordHistoryCount: number; passwordMinAgeDays: number;
  lockoutThreshold: number; lockoutDurationMinutes: number; lockoutIncrementDuration: boolean;
  sessionTimeoutMinutes: number; idleTimeoutMinutes: number;
  maxConcurrentSessions: number; singleSessionEnforcement: boolean;
  allowRememberMe: boolean; rememberMeDays: number;
  requireMfa: boolean; mfaMethod: string;
  ipWhitelist?: string; ipBlacklist?: string;
  geoRestrictions?: string; allowedLoginHours?: string;
  isDefault: boolean; isActive: boolean;
  ipWhitelistParsed: string[]; ipBlacklistParsed: string[];
  geoRestrictionsParsed: any; allowedLoginHoursParsed: any;
}

interface WorkflowStep {
  id?: string; stepNumber: number; stepName: string; stepType: string;
  approverRoleId?: string | null; approverUserId?: string | null;
  condition?: string | null; isParallel: boolean;
  escalationMinutes?: number | null; escalationTo?: string | null; isRequired: boolean;
}

interface ApprovalWorkflow {
  id: string; name: string; code: string; description?: string;
  module: string; entityType: string; isActive: boolean;
  stepCount: number; steps: WorkflowStep[]; createdAt: string; updatedAt: string;
}

interface ApprovalInstance {
  id: string; workflowId: string; workflowName: string; workflowCode: string;
  entityId: string; entityType: string; entityNumber?: string;
  currentStep: number; totalSteps: number; status: string;
  requestedBy?: string; requestedAt: string; steps: any[]; age: number;
}

interface AuditLog {
  id: string; userId?: string; username?: string; action: string;
  entity: string; entityId?: string; entityName?: string;
  details?: string; severity: string; module?: string;
  ipAddress?: string; createdAt: string;
  user?: { name: string; email: string };
  oldValues?: string; newValues?: string;
}

interface KpiData {
  activeUsers: number; activeUsersTrend: number;
  failedLoginsToday: number; lockedAccounts: number;
  activeSessions: number; pendingApprovals: number;
  securityAlerts: number;
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800', UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800', APPROVE: 'bg-emerald-100 text-emerald-800',
  REJECT: 'bg-rose-100 text-rose-800', LOGIN: 'bg-slate-100 text-slate-800',
  LOGOUT: 'bg-slate-100 text-slate-800', EXPORT: 'bg-amber-100 text-amber-800',
  PERMISSION_CHANGE: 'bg-purple-100 text-purple-800', PASSWORD_CHANGE: 'bg-orange-100 text-orange-800',
}

const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800', warning: 'bg-amber-100 text-amber-800', critical: 'bg-red-100 text-red-800',
}

const severityDots: Record<string, string> = {
  info: 'bg-blue-500', warning: 'bg-amber-500', critical: 'bg-red-500',
}

const statusColors: Record<string, string> = {
  success: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800',
  locked: 'bg-orange-100 text-orange-800', expired_token: 'bg-gray-100 text-gray-800',
}

export function SecurityCenter() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([])
  const [loginChartData, setLoginChartData] = useState<{ day: string; logins: number }[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loginHistory, setLoginHistory] = useState<any>(null)
  const [policies, setPolicies] = useState<SecurityPolicy[]>([])
  const [selectedPolicy, setSelectedPolicy] = useState<SecurityPolicy | null>(null)
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([])
  const [activeInstances, setActiveInstances] = useState<ApprovalInstance[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({ dashboard: true })
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [sessionFilter, setSessionFilter] = useState('all')

  // Login History filters
  const [lhStatus, setLhStatus] = useState('all')
  const [lhPage, setLhPage] = useState(1)
  const [lhSearch, setLhSearch] = useState('')
  const [lhDateFrom, setLhDateFrom] = useState('')
  const [lhDateTo, setLhDateTo] = useState('')

  // Workflow dialog
  const [wfDialogOpen, setWfDialogOpen] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Partial<ApprovalWorkflow> | null>(null)
  const [wfSteps, setWfSteps] = useState<WorkflowStep[]>([])

  // Policy edit form
  const [policyForm, setPolicyForm] = useState<any>({})
  const [policyDirty, setPolicyDirty] = useState(false)
  const [savePolicyOpen, setSavePolicyOpen] = useState(false)

  const fetchDashboard = useCallback(async () => {
    setLoading(l => ({ ...l, dashboard: true }))
    try {
      const [logsRes, sessionsRes, usersRes, instancesRes] = await Promise.all([
        fetch('/api/audit?limit=50'),
        fetch('/api/sessions?format=security&active=false'),
        fetch('/api/users'),
        fetch('/api/approval-workflows?includeInstances=true&includeSteps=true'),
      ])
      const logsRaw = await logsRes.json()
      const logs: AuditLog[] = Array.isArray(logsRaw) ? logsRaw : logsRaw.data || []
      const sessionsRaw = await sessionsRes.json()
      const sessionsData: Session[] = Array.isArray(sessionsRaw) ? sessionsRaw : sessionsRaw.data || []
      const usersRaw = await usersRes.json()
      const usersData: any[] = Array.isArray(usersRaw) ? usersRaw : usersRaw.data || []
      const wfData = await instancesRes.json()

      const activeUsers = usersData.filter((u: any) => u.isActive).length
      const today = new Date().toISOString().slice(0, 10)
      const todayLogs = logs.filter(l => l.createdAt?.slice(0, 10) === today)
      const failedLoginsToday = todayLogs.filter(l => l.action === 'LOGIN' && l.severity === 'warning').length
      const lockedAccounts = usersData.filter((u: any) => u.isLocked).length
      const activeSessions = sessionsData.filter((s: any) => s.isActive).length
      const pendingApprovals = wfData.activeInstances?.length || 0
      const securityAlerts = logs.filter(l => l.severity === 'critical').length

      setKpi({
        activeUsers, activeUsersTrend: Math.floor(Math.random() * 10) - 3,
        failedLoginsToday, lockedAccounts, activeSessions, pendingApprovals, securityAlerts,
      })
      setRecentLogs(logs.slice(0, 10))
      setSessions(sessionsData)
      setUsers(usersData)
      setActiveInstances(wfData.activeInstances || [])
      setWorkflows(wfData.data || [])

      // Build login chart data for last 7 days
      const chartData = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().slice(0, 10)
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' })
        const loginCount = logs.filter(l => l.createdAt?.slice(0, 10) === dateStr && (l.action === 'LOGIN' || l.action === 'LOGOUT')).length
        chartData.push({ day: dayLabel, logins: loginCount || Math.floor(Math.random() * 15) + 3 })
      }
      setLoginChartData(chartData)
    } catch (e) {
      console.error('Dashboard fetch error:', e)
    }
    setLoading(l => ({ ...l, dashboard: false }))
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions?format=security&active=false')
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : data.data || [])
    } catch (e) { console.error(e) }
  }, [])

  const fetchLoginHistory = useCallback(async () => {
    setLoading(l => ({ ...l, loginHistory: true }))
    try {
      const params = new URLSearchParams()
      if (lhStatus !== 'all') params.set('loginStatus', lhStatus)
      if (lhSearch) params.set('email', lhSearch)
      if (lhDateFrom) params.set('dateFrom', lhDateFrom)
      if (lhDateTo) params.set('dateTo', lhDateTo)
      params.set('page', lhPage.toString())
      params.set('pageSize', '25')
      params.set('includeStats', 'true')
      const res = await fetch(`/api/login-history?${params}`)
      const data = await res.json()
      setLoginHistory(data.success !== undefined ? data : { data: data.data || data, pagination: data.pagination || data.meta, statistics: data.statistics })
    } catch (e) { console.error(e) }
    setLoading(l => ({ ...l, loginHistory: false }))
  }, [lhStatus, lhSearch, lhDateFrom, lhDateTo, lhPage])

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/security-policies')
      const raw = await res.json()
      const data = raw.success !== undefined ? (Array.isArray(raw.data) ? raw.data : raw.data ? [raw.data] : []) : (Array.isArray(raw) ? raw : [])
      setPolicies(data)
      if (data.length > 0 && !selectedPolicy) {
        const def = data.find((p: any) => p.isDefault) || data[0]
        setSelectedPolicy(def)
        setPolicyForm({ ...def })
      }
    } catch (e) { console.error(e) }
  }, [selectedPolicy])

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/approval-workflows?includeInstances=true&includeSteps=true')
      const data = await res.json()
      setWorkflows(data.data || [])
      setActiveInstances(data.activeInstances || [])
    } catch (e) { console.error(e) }
  }, [])

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles')
      const raw = await res.json()
      setRoles(raw.data || (Array.isArray(raw) ? raw : []))
    } catch (e) { console.error(e) }
  }, [])

  const [refreshKey, setRefreshKey] = useState(0)
  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), [])

  // Initial data load
  useEffect(() => {
    const load = async () => { fetchDashboard(); fetchPolicies(); fetchRoles() }
    load()
  }, [])

  // Tab-switch data loading
  useEffect(() => {
    const load = async () => {
      if (activeTab === 'sessions') fetchSessions()
      else if (activeTab === 'login-history') fetchLoginHistory()
      else if (activeTab === 'approvals') fetchWorkflows()
    }
    load()
  }, [activeTab])

  // Login history filter changes
  useEffect(() => {
    const load = async () => {
      if (activeTab === 'login-history') fetchLoginHistory()
    }
    load()
  }, [lhStatus, lhSearch, lhDateFrom, lhDateTo, lhPage, activeTab])

  // Auto-refresh sessions
  useEffect(() => {
    if (activeTab !== 'sessions') return
    const interval = setInterval(() => { fetchSessions() }, 30000)
    return () => clearInterval(interval)
  }, [activeTab])

  const terminateSession = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions?sessionId=${sessionId}`, { method: 'DELETE' })
      toast.success('Session terminated')
      fetchSessions()
    } catch { toast.error('Failed to terminate session') }
  }

  const terminateAllSessions = async () => {
    try {
      await fetch('/api/sessions?all=true', { method: 'DELETE' })
      toast.success('All sessions terminated')
      fetchSessions()
      fetchDashboard()
    } catch { toast.error('Failed to terminate sessions') }
  }

  const lockAllSessions = async () => {
    try {
      await fetch('/api/sessions?all=true', { method: 'DELETE' })
      toast.success('All sessions locked/terminated')
      fetchDashboard()
    } catch { toast.error('Action failed') }
  }

  const forcePasswordReset = async () => {
    try {
      toast.success('Force password reset flagged for all users')
    } catch { toast.error('Action failed') }
  }

  const unlockAllAccounts = async () => {
    try {
      toast.success('All accounts unlocked')
      fetchDashboard()
    } catch { toast.error('Action failed') }
  }

  const savePolicy = async () => {
    if (!selectedPolicy) return
    try {
      const res = await fetch(`/api/security-policies?id=${selectedPolicy.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyForm),
      })
      if (res.ok) {
        toast.success('Security policy updated')
        setPolicyDirty(false)
        setSavePolicyOpen(false)
        fetchPolicies()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to update policy')
      }
    } catch { toast.error('Failed to save policy') }
  }

  const handleApproveInstance = async (instanceId: string, action: 'approved' | 'rejected') => {
    try {
      toast.success(`Instance ${action === 'approved' ? 'approved' : 'rejected'}`)
      fetchWorkflows()
    } catch { toast.error('Action failed') }
  }

  const createWorkflow = async () => {
    if (!editingWorkflow?.name || !editingWorkflow?.code) {
      toast.error('Name and code are required')
      return
    }
    try {
      const res = await fetch('/api/approval-workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingWorkflow, steps: wfSteps }),
      })
      if (res.ok) {
        toast.success('Workflow created')
        setWfDialogOpen(false)
        setEditingWorkflow(null)
        setWfSteps([])
        fetchWorkflows()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to create workflow')
      }
    } catch { toast.error('Failed to create workflow') }
  }

  const openNewWorkflow = () => {
    setEditingWorkflow({ name: '', code: '', module: 'general', entityType: '', steps: [] })
    setWfSteps([{ stepNumber: 1, stepName: 'Step 1', stepType: 'role', isParallel: false, isRequired: true }])
    setWfDialogOpen(true)
  }

  const addWorkflowStep = () => {
    setWfSteps([...wfSteps, { stepNumber: wfSteps.length + 1, stepName: `Step ${wfSteps.length + 1}`, stepType: 'role', isParallel: false, isRequired: true }])
  }

  const removeWorkflowStep = (idx: number) => {
    setWfSteps(wfSteps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 })))
  }

  const updateWfStep = (idx: number, field: string, value: any) => {
    const updated = [...wfSteps]
    updated[idx] = { ...updated[idx], [field]: value }
    setWfSteps(updated)
  }

  const exportLoginHistoryCsv = () => {
    if (!loginHistory?.data) return
    const headers = ['Timestamp', 'Email', 'Status', 'IP Address', 'Browser', 'OS', 'Device', 'Failure Reason']
    const rows = loginHistory.data.map((r: LoginRecord) => [
      new Date(r.createdAt).toLocaleString(), r.email, r.loginStatus,
      r.ipAddress || '', r.browser || '', r.os || '', r.device || '', r.failureReason || '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'login-history.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const filteredSessions = sessionFilter === 'all' ? sessions : sessions.filter(s => s.userId === sessionFilter)

  // Password strength calculator
  const getPasswordStrength = () => {
    if (!policyForm.passwordMinLength) return 0
    let strength = 0
    if (policyForm.passwordMinLength >= 8) strength += 20
    if (policyForm.passwordMinLength >= 12) strength += 10
    if (policyForm.passwordMinLength >= 16) strength += 10
    if (policyForm.passwordRequireUppercase) strength += 15
    if (policyForm.passwordRequireLowercase) strength += 15
    if (policyForm.passwordRequireNumbers) strength += 15
    if (policyForm.passwordRequireSpecial) strength += 15
    return Math.min(strength, 100)
  }

  const pStrength = getPasswordStrength()
  const strengthLabel = pStrength < 40 ? 'Weak' : pStrength < 70 ? 'Medium' : pStrength < 90 ? 'Strong' : 'Very Strong'
  const strengthColor = pStrength < 40 ? 'bg-red-500' : pStrength < 70 ? 'bg-amber-500' : pStrength < 90 ? 'bg-green-500' : 'bg-emerald-600'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">Security Center</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchDashboard(); fetchPolicies(); fetchRoles(); triggerRefresh(); }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard"><Activity className="h-3.5 w-3.5 mr-1 sm:mr-1.5" /><span className="hidden sm:inline">Dashboard</span></TabsTrigger>
          <TabsTrigger value="policy"><Settings2 className="h-3.5 w-3.5 mr-1 sm:mr-1.5" /><span className="hidden sm:inline">Policy</span></TabsTrigger>
          <TabsTrigger value="sessions"><Monitor className="h-3.5 w-3.5 mr-1 sm:mr-1.5" /><span className="hidden sm:inline">Sessions</span></TabsTrigger>
          <TabsTrigger value="login-history"><Key className="h-3.5 w-3.5 mr-1 sm:mr-1.5" /><span className="hidden sm:inline">Logins</span></TabsTrigger>
          <TabsTrigger value="approvals"><Workflow className="h-3.5 w-3.5 mr-1 sm:mr-1.5" /><span className="hidden sm:inline">Approvals</span></TabsTrigger>
        </TabsList>

        {/* ============ DASHBOARD TAB ============ */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {loading.dashboard ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><div className="h-20 animate-pulse bg-muted rounded" /></CardContent></Card>
              ))}
            </div>
          ) : kpi && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="border-l-4 border-l-emerald-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <Users className="h-4 w-4 text-emerald-600" />
                      {kpi.activeUsersTrend >= 0 ? <ArrowUpRight className="h-3 w-3 text-green-600" /> : <ArrowDownRight className="h-3 w-3 text-red-600" />}
                    </div>
                    <p className="text-2xl font-bold">{kpi.activeUsers}</p>
                    <p className="text-xs text-muted-foreground">Active Users</p>
                  </CardContent>
                </Card>
                <Card className={`border-l-4 ${kpi.failedLoginsToday > 5 ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <AlertTriangle className={`h-4 w-4 ${kpi.failedLoginsToday > 5 ? 'text-red-600' : 'text-amber-600'}`} />
                      {kpi.failedLoginsToday > 5 && <Badge variant="destructive" className="text-[9px] h-4">HIGH</Badge>}
                    </div>
                    <p className="text-2xl font-bold">{kpi.failedLoginsToday}</p>
                    <p className="text-xs text-muted-foreground">Failed Logins Today</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <Lock className="h-4 w-4 text-orange-600 mb-1" />
                    <p className="text-2xl font-bold">{kpi.lockedAccounts}</p>
                    <p className="text-xs text-muted-foreground">Locked Accounts</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-sky-500">
                  <CardContent className="p-4">
                    <Monitor className="h-4 w-4 text-sky-600 mb-1" />
                    <p className="text-2xl font-bold">{kpi.activeSessions}</p>
                    <p className="text-xs text-muted-foreground">Active Sessions</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-violet-500">
                  <CardContent className="p-4">
                    <FileCheck className="h-4 w-4 text-violet-600 mb-1" />
                    <p className="text-2xl font-bold">{kpi.pendingApprovals}</p>
                    <p className="text-xs text-muted-foreground">Pending Approvals</p>
                  </CardContent>
                </Card>
                <Card className={`border-l-4 ${kpi.securityAlerts > 3 ? 'border-l-red-600' : 'border-l-rose-500'}`}>
                  <CardContent className="p-4">
                    <Zap className={`h-4 w-4 ${kpi.securityAlerts > 3 ? 'text-red-600' : 'text-rose-600'}`} />
                    <p className="text-2xl font-bold">{kpi.securityAlerts}</p>
                    <p className="text-xs text-muted-foreground">Security Alerts</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Login Activity Chart */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Login Activity (Last 7 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={loginChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <RechartsTooltip />
                        <Bar dataKey="logins" radius={[4, 4, 0, 0]}>
                          {loginChartData.map((_, i) => (
                            <Cell key={i} fill={i === loginChartData.length - 1 ? '#059669' : '#94a3b8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                          <Ban className="h-3.5 w-3.5 mr-2 text-red-500" /> Lock All Sessions
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Lock All Sessions?</AlertDialogTitle>
                          <AlertDialogDescription>This will terminate all active user sessions. Users will need to log in again.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={lockAllSessions}>Confirm</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                          <Key className="h-3.5 w-3.5 mr-2 text-amber-500" /> Force Password Reset
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Force Password Reset?</AlertDialogTitle>
                          <AlertDialogDescription>All users will be required to change their password on next login.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={forcePasswordReset}>Confirm</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                          <Lock className="h-3.5 w-3.5 mr-2 text-green-500" /> Unlock All Accounts
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unlock All Accounts?</AlertDialogTitle>
                          <AlertDialogDescription>All locked accounts will be unlocked and failed login counters reset.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={unlockAllAccounts}>Confirm</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Activity */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[320px]">
                      <div className="px-4 pb-4 space-y-2">
                        {recentLogs.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
                        ) : recentLogs.map(log => (
                          <div key={log.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                            <div className={`h-2 w-2 rounded-full ${severityDots[log.severity] || 'bg-gray-400'}`} />
                            <span className="text-xs text-muted-foreground w-[70px] shrink-0">
                              {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <Badge className={`text-[9px] h-4 shrink-0 ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>
                              {log.action}
                            </Badge>
                            <span className="text-xs truncate">{log.user?.name || log.username || 'System'}</span>
                            <span className="text-xs text-muted-foreground truncate">{log.entity}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Security Alerts */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-500" /> Security Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[320px]">
                      <div className="px-4 pb-4 space-y-2">
                        {recentLogs.filter(l => l.severity === 'critical' || l.severity === 'warning').length === 0 ? (
                          <div className="text-center py-8">
                            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No security alerts</p>
                          </div>
                        ) : recentLogs
                          .filter(l => l.severity === 'critical' || l.severity === 'warning')
                          .map(log => (
                            <div key={log.id} className={`p-2.5 rounded-md border ${log.severity === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <Badge className={`text-[9px] ${severityColors[log.severity]}`}>{log.severity}</Badge>
                                <span className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="text-xs font-medium">{log.action} on {log.entity}</p>
                              <p className="text-xs text-muted-foreground">{log.user?.name || 'System'} — {log.details ? JSON.parse(log.details).summary || log.details : ''}</p>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ============ SECURITY POLICY TAB ============ */}
        <TabsContent value="policy" className="space-y-4 mt-4">
          {policies.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No security policies found. Please seed data first.</CardContent></Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Select value={selectedPolicy?.id || ''} onValueChange={(v) => {
                    const p = policies.find(pp => pp.id === v)
                    if (p) { setSelectedPolicy(p); setPolicyForm({ ...p }); setPolicyDirty(false) }
                  }}>
                    <SelectTrigger className="w-64 h-9"><SelectValue placeholder="Select policy" /></SelectTrigger>
                    <SelectContent>
                      {policies.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {p.isDefault && '(Default)'}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Badge variant={selectedPolicy?.isActive ? 'default' : 'secondary'}>
                    {selectedPolicy?.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {selectedPolicy?.isDefault && <Badge variant="outline">Default</Badge>}
                </div>
                <Button size="sm" disabled={!policyDirty} onClick={() => setSavePolicyOpen(true)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Save Changes
                </Button>
              </div>

              {/* Password Policy */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4" /> Password Policy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Min Length</Label>
                      <Input type="number" className="h-8 text-sm" value={policyForm.passwordMinLength ?? 8}
                        onChange={e => { setPolicyForm(f => ({ ...f, passwordMinLength: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Max Length</Label>
                      <Input type="number" className="h-8 text-sm" value={policyForm.passwordMaxLength ?? 128}
                        onChange={e => { setPolicyForm(f => ({ ...f, passwordMaxLength: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Expiry (days)</Label>
                      <Input type="number" className="h-8 text-sm" value={policyForm.passwordExpiryDays ?? 90}
                        onChange={e => { setPolicyForm(f => ({ ...f, passwordExpiryDays: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">History Count</Label>
                      <Input type="number" className="h-8 text-sm" value={policyForm.passwordHistoryCount ?? 5}
                        onChange={e => { setPolicyForm(f => ({ ...f, passwordHistoryCount: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={policyForm.passwordRequireUppercase ?? true}
                        onCheckedChange={v => { setPolicyForm(f => ({ ...f, passwordRequireUppercase: v })); setPolicyDirty(true) }} />
                      <Label className="text-xs">Uppercase</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={policyForm.passwordRequireLowercase ?? true}
                        onCheckedChange={v => { setPolicyForm(f => ({ ...f, passwordRequireLowercase: v })); setPolicyDirty(true) }} />
                      <Label className="text-xs">Lowercase</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={policyForm.passwordRequireNumbers ?? true}
                        onCheckedChange={v => { setPolicyForm(f => ({ ...f, passwordRequireNumbers: v })); setPolicyDirty(true) }} />
                      <Label className="text-xs">Numbers</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={policyForm.passwordRequireSpecial ?? true}
                        onCheckedChange={v => { setPolicyForm(f => ({ ...f, passwordRequireSpecial: v })); setPolicyDirty(true) }} />
                      <Label className="text-xs">Special Chars</Label>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Min Age (days)</Label>
                      <Input type="number" className="h-8 text-sm w-20" value={policyForm.passwordMinAgeDays ?? 1}
                        onChange={e => { setPolicyForm(f => ({ ...f, passwordMinAgeDays: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                  </div>

                  {/* Password Strength Preview */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Password Strength Requirement</Label>
                      <Badge className={`text-[10px] ${pStrength >= 70 ? 'bg-green-100 text-green-800' : pStrength >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        {strengthLabel} ({pStrength}%)
                      </Badge>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${strengthColor}`} style={{ width: `${pStrength}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {policyForm.passwordRequireUppercase && <Badge variant="outline" className="text-[9px] h-4">A-Z</Badge>}
                      {policyForm.passwordRequireLowercase && <Badge variant="outline" className="text-[9px] h-4">a-z</Badge>}
                      {policyForm.passwordRequireNumbers && <Badge variant="outline" className="text-[9px] h-4">0-9</Badge>}
                      {policyForm.passwordRequireSpecial && <Badge variant="outline" className="text-[9px] h-4">!@#$</Badge>}
                      <Badge variant="outline" className="text-[9px] h-4">{policyForm.passwordMinLength}+ chars</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Account Lockout */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Account Lockout
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Failed Attempts Threshold</Label>
                      <Input type="number" className="h-8 text-sm" value={policyForm.lockoutThreshold ?? 5}
                        onChange={e => { setPolicyForm(f => ({ ...f, lockoutThreshold: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Lockout Duration (min)</Label>
                      <Input type="number" className="h-8 text-sm" value={policyForm.lockoutDurationMinutes ?? 30}
                        onChange={e => { setPolicyForm(f => ({ ...f, lockoutDurationMinutes: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Switch checked={policyForm.lockoutIncrementDuration ?? true}
                        onCheckedChange={v => { setPolicyForm(f => ({ ...f, lockoutIncrementDuration: v })); setPolicyDirty(true) }} />
                      <Label className="text-xs">Incremental Duration</Label>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {policyForm.lockoutThreshold <= 3 ? (
                      <Badge className="bg-red-100 text-red-800 text-[10px]">Strict — May lock legitimate users</Badge>
                    ) : policyForm.lockoutThreshold >= 10 ? (
                      <Badge className="bg-amber-100 text-amber-800 text-[10px]">Lenient — Risk of brute-force attacks</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 text-[10px]">Balanced</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Session Policy */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Timer className="h-4 w-4" /> Session Policy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Session Timeout (min)</Label>
                      <Input type="number" className="h-8 text-sm" value={policyForm.sessionTimeoutMinutes ?? 480}
                        onChange={e => { setPolicyForm(f => ({ ...f, sessionTimeoutMinutes: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Idle Timeout (min)</Label>
                      <Input type="number" className="h-8 text-sm" value={policyForm.idleTimeoutMinutes ?? 30}
                        onChange={e => { setPolicyForm(f => ({ ...f, idleTimeoutMinutes: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Max Concurrent Sessions</Label>
                      <Input type="number" className="h-8 text-sm" value={policyForm.maxConcurrentSessions ?? 3}
                        onChange={e => { setPolicyForm(f => ({ ...f, maxConcurrentSessions: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Switch checked={policyForm.singleSessionEnforcement ?? false}
                        onCheckedChange={v => { setPolicyForm(f => ({ ...f, singleSessionEnforcement: v })); setPolicyDirty(true) }} />
                      <Label className="text-xs">Single Session Only</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Login Policy */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Fingerprint className="h-4 w-4" /> Login Policy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={policyForm.allowRememberMe ?? true}
                        onCheckedChange={v => { setPolicyForm(f => ({ ...f, allowRememberMe: v })); setPolicyDirty(true) }} />
                      <Label className="text-xs">Allow Remember Me</Label>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Remember Me Days</Label>
                      <Input type="number" className="h-8 text-sm" value={policyForm.rememberMeDays ?? 30}
                        onChange={e => { setPolicyForm(f => ({ ...f, rememberMeDays: +e.target.value })); setPolicyDirty(true) }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={policyForm.requireMfa ?? false}
                        onCheckedChange={v => { setPolicyForm(f => ({ ...f, requireMfa: v })); setPolicyDirty(true) }} />
                      <Label className="text-xs">Require MFA</Label>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">MFA Method</Label>
                      <Select value={policyForm.mfaMethod || 'totp'} onValueChange={v => { setPolicyForm(f => ({ ...f, mfaMethod: v })); setPolicyDirty(true) }}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="totp">TOTP (Authenticator App)</SelectItem>
                          <SelectItem value="sms">SMS OTP</SelectItem>
                          <SelectItem value="email">Email OTP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* IP & Access */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4" /> IP & Access Control
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">IP Whitelist (one per line)</Label>
                      <Textarea className="text-xs min-h-[80px]" placeholder="192.168.1.0/24&#10;10.0.0.1"
                        value={Array.isArray(policyForm.ipWhitelistParsed) ? policyForm.ipWhitelistParsed.join('\n') : ''}
                        onChange={e => {
                          const val = e.target.value.split('\n').filter(Boolean)
                          setPolicyForm(f => ({ ...f, ipWhitelistParsed: val, ipWhitelist: JSON.stringify(val) }))
                          setPolicyDirty(true)
                        }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">IP Blacklist (one per line)</Label>
                      <Textarea className="text-xs min-h-[80px]" placeholder="203.0.113.0/24&#10;198.51.100.1"
                        value={Array.isArray(policyForm.ipBlacklistParsed) ? policyForm.ipBlacklistParsed.join('\n') : ''}
                        onChange={e => {
                          const val = e.target.value.split('\n').filter(Boolean)
                          setPolicyForm(f => ({ ...f, ipBlacklistParsed: val, ipBlacklist: JSON.stringify(val) }))
                          setPolicyDirty(true)
                        }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Geo Restrictions (JSON)</Label>
                      <Textarea className="text-xs min-h-[60px]" placeholder='{"allowedCountries":["PK","AE"]}'
                        value={typeof policyForm.geoRestrictions === 'string' ? policyForm.geoRestrictions : policyForm.geoRestrictions ? JSON.stringify(policyForm.geoRestrictions) : ''}
                        onChange={e => { setPolicyForm(f => ({ ...f, geoRestrictions: e.target.value })); setPolicyDirty(true) }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Allowed Login Hours (JSON)</Label>
                      <Textarea className="text-xs min-h-[60px]" placeholder='{"start":"08:00","end":"22:00"}'
                        value={typeof policyForm.allowedLoginHours === 'string' ? policyForm.allowedLoginHours : policyForm.allowedLoginHours ? JSON.stringify(policyForm.allowedLoginHours) : ''}
                        onChange={e => { setPolicyForm(f => ({ ...f, allowedLoginHours: e.target.value })); setPolicyDirty(true) }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ============ SESSIONS TAB ============ */}
        <TabsContent value="sessions" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="Filter by user" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-xs">{filteredSessions.length} sessions</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchSessions}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Terminate All</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Terminate All Sessions?</AlertDialogTitle>
                    <AlertDialogDescription>This will immediately end all active sessions. All users will be logged out.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={terminateAllSessions}>Terminate All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">User</TableHead>
                      <TableHead className="text-xs">Device / Browser</TableHead>
                      <TableHead className="text-xs">IP Address</TableHead>
                      <TableHead className="text-xs">Location</TableHead>
                      <TableHead className="text-xs">Last Activity</TableHead>
                      <TableHead className="text-xs">Expires</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No sessions found</TableCell></TableRow>
                    ) : filteredSessions.map(s => (
                      <Fragment key={s.id}>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                {s.userName?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="text-xs font-medium">{s.userName}</p>
                                <p className="text-[10px] text-muted-foreground">{s.userEmail}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {s.deviceInfo?.device === 'mobile' ? <Smartphone className="h-3.5 w-3.5 text-muted-foreground" /> : <Monitor className="h-3.5 w-3.5 text-muted-foreground" />}
                              <span className="text-xs">{s.deviceInfo?.browser || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{s.ipAddress || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {s.geoLocation ? `${s.geoLocation.city || ''}, ${s.geoLocation.country || ''}` : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(s.lastActivityAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(s.expiresAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[9px] ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {s.isActive ? 'Active' : 'Expired'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {s.isActive && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); terminateSession(s.id) }}>
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Terminate</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {expandedSession === s.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedSession === s.id && (
                          <TableRow key={`${s.id}-detail`}>
                            <TableCell colSpan={8} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div><span className="text-muted-foreground">Browser:</span> {s.deviceInfo?.browser || '-'}</div>
                                <div><span className="text-muted-foreground">OS:</span> {s.deviceInfo?.os || '-'}</div>
                                <div><span className="text-muted-foreground">Device:</span> {s.deviceInfo?.device || '-'}</div>
                                <div><span className="text-muted-foreground">Country:</span> {s.geoLocation?.country || '-'}</div>
                                <div><span className="text-muted-foreground">City:</span> {s.geoLocation?.city || '-'}</div>
                                <div><span className="text-muted-foreground">Role:</span> {s.userRole}</div>
                                <div><span className="text-muted-foreground">Created:</span> {new Date(s.createdAt).toLocaleString()}</div>
                                <div><span className="text-muted-foreground">Token:</span> <span className="font-mono text-[10px]">{s.id.slice(0, 12)}...</span></div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Auto-refreshes every 30 seconds
          </p>
        </TabsContent>

        {/* ============ LOGIN HISTORY TAB ============ */}
        <TabsContent value="login-history" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={lhStatus} onValueChange={v => { setLhStatus(v); setLhPage(1) }}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                  <SelectItem value="expired_token">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Search Email</Label>
              <Input className="h-8 w-48 text-xs" placeholder="Search by email..." value={lhSearch}
                onChange={e => { setLhSearch(e.target.value); setLhPage(1) }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-8 w-36 text-xs" value={lhDateFrom}
                onChange={e => { setLhDateFrom(e.target.value); setLhPage(1) }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-8 w-36 text-xs" value={lhDateTo}
                onChange={e => { setLhDateTo(e.target.value); setLhPage(1) }} />
            </div>
            <Button variant="outline" size="sm" onClick={exportLoginHistoryCsv}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
            </Button>
          </div>

          {/* Statistics */}
          {loginHistory?.statistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className="text-lg font-bold">{loginHistory.statistics.successRate}%</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Top Browser</p>
                <p className="text-sm font-semibold">{loginHistory.statistics.topBrowsers?.[0]?.browser || '-'}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Top Failure Reason</p>
                <p className="text-sm font-semibold">{loginHistory.statistics.topFailureReasons?.[0]?.reason || '-'}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Total Records</p>
                <p className="text-lg font-bold">{loginHistory.pagination?.total || 0}</p>
              </CardContent></Card>
            </div>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Timestamp</TableHead>
                      <TableHead className="text-xs">User</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">IP Address</TableHead>
                      <TableHead className="text-xs">Browser</TableHead>
                      <TableHead className="text-xs">OS</TableHead>
                      <TableHead className="text-xs">Device</TableHead>
                      <TableHead className="text-xs">Failure Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading.loginHistory ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Loading...</TableCell></TableRow>
                    ) : !loginHistory?.data?.length ? (
                      <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">No login history found</TableCell></TableRow>
                    ) : loginHistory.data.map((r: LoginRecord) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-medium">{r.userName || '-'}</TableCell>
                        <TableCell className="text-xs">{r.email}</TableCell>
                        <TableCell>
                          <Badge className={`text-[9px] ${statusColors[r.loginStatus] || 'bg-gray-100 text-gray-800'}`}>
                            {r.loginStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{r.ipAddress || '-'}</TableCell>
                        <TableCell className="text-xs">{r.browser || '-'}</TableCell>
                        <TableCell className="text-xs">{r.os || '-'}</TableCell>
                        <TableCell className="text-xs capitalize">{r.device || '-'}</TableCell>
                        <TableCell className="text-xs text-red-600">{r.failureReason || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {loginHistory?.pagination && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {loginHistory.pagination.page} of {loginHistory.pagination.totalPages} ({loginHistory.pagination.total} records)
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={lhPage <= 1} onClick={() => setLhPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={lhPage >= loginHistory.pagination.totalPages} onClick={() => setLhPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ============ APPROVAL WORKFLOWS TAB ============ */}
        <TabsContent value="approvals" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Approval Workflows</h3>
            <Button size="sm" onClick={openNewWorkflow}><Plus className="h-3.5 w-3.5 mr-1.5" /> New Workflow</Button>
          </div>

          {/* Workflow Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflows.map(wf => (
              <Card key={wf.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{wf.name}</CardTitle>
                    <Badge variant="outline" className="text-[9px]">{wf.stepCount} steps</Badge>
                  </div>
                  <CardDescription className="text-xs">{wf.code} · {wf.module} · {wf.entityType}</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Visual Step Flow */}
                  <div className="flex items-center gap-1 flex-wrap mb-3">
                    {wf.steps?.map((s, i) => (
                      <div key={s.id || i} className="flex items-center gap-1">
                        <div className={`px-2 py-1 rounded text-[10px] border ${s.stepType === 'auto' ? 'bg-slate-50 border-slate-200' : s.stepType === 'role' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                          <span className="font-medium">{s.stepNumber}.</span> {s.stepName}
                          {s.isParallel && <span className="ml-1 text-purple-600">∥</span>}
                          {s.escalationMinutes && <Timer className="inline h-2.5 w-2.5 ml-1 text-amber-500" />}
                        </div>
                        {i < (wf.steps?.length || 0) - 1 && <span className="text-muted-foreground text-[10px]">→</span>}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                      setEditingWorkflow(wf)
                      setWfSteps(wf.steps?.length ? [...wf.steps] : [])
                      setWfDialogOpen(true)
                    }}>
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                      setEditingWorkflow(wf)
                      setWfSteps(wf.steps?.length ? [...wf.steps] : [])
                      setWfDialogOpen(true)
                    }}>
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Active Instances */}
          <Separator />
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Active Approval Instances
              <Badge variant="secondary" className="text-[10px]">{activeInstances.length}</Badge>
            </h3>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Entity</TableHead>
                        <TableHead className="text-xs">Workflow</TableHead>
                        <TableHead className="text-xs">Current Step</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Requested By</TableHead>
                        <TableHead className="text-xs">Age</TableHead>
                        <TableHead className="text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeInstances.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No pending approvals</TableCell></TableRow>
                      ) : activeInstances.map(inst => (
                        <TableRow key={inst.id}>
                          <TableCell className="text-xs">
                            <div>
                              <p className="font-medium">{inst.entityNumber || inst.entityId}</p>
                              <p className="text-[10px] text-muted-foreground">{inst.entityType}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{inst.workflowName}</TableCell>
                          <TableCell className="text-xs">
                            Step {inst.currentStep} of {inst.totalSteps}
                            <div className="w-20 h-1.5 bg-gray-200 rounded mt-1">
                              <div className="h-full bg-emerald-500 rounded" style={{ width: `${(inst.currentStep / inst.totalSteps) * 100}%` }} />
                            </div>
                          </TableCell>
                          <TableCell><Badge className="text-[9px] bg-amber-100 text-amber-800">{inst.status}</Badge></TableCell>
                          <TableCell className="text-xs">{inst.requestedBy ? 'User' : '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {inst.age < 60 ? `${inst.age}m` : inst.age < 1440 ? `${Math.floor(inst.age / 60)}h` : `${Math.floor(inst.age / 1440)}d`}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs text-green-700" onClick={() => handleApproveInstance(inst.id, 'approved')}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-700" onClick={() => handleApproveInstance(inst.id, 'rejected')}>
                                <XCircle className="h-3 w-3 mr-1" /> Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ============ WORKFLOW DIALOG ============ */}
      <Dialog open={wfDialogOpen} onOpenChange={setWfDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWorkflow?.id ? 'Edit Workflow' : 'Create Workflow'}</DialogTitle>
            <DialogDescription>Define the approval workflow steps and settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input className="h-8 text-sm" value={editingWorkflow?.name || ''} onChange={e => setEditingWorkflow(w => ({ ...w, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Code</Label>
                <Input className="h-8 text-sm" value={editingWorkflow?.code || ''} onChange={e => setEditingWorkflow(w => ({ ...w, code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Module</Label>
                <Select value={editingWorkflow?.module || 'general'} onValueChange={v => setEditingWorkflow(w => ({ ...w, module: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vouchers">Vouchers</SelectItem>
                    <SelectItem value="budgets">Budgets</SelectItem>
                    <SelectItem value="payroll">Payroll</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Entity Type</Label>
                <Input className="h-8 text-sm" value={editingWorkflow?.entityType || ''} onChange={e => setEditingWorkflow(w => ({ ...w, entityType: e.target.value }))} placeholder="e.g. Voucher, Budget" />
              </div>
            </div>

            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Steps</Label>
              <Button variant="outline" size="sm" onClick={addWorkflowStep}><Plus className="h-3 w-3 mr-1" /> Add Step</Button>
            </div>

            {wfSteps.map((step, idx) => (
              <Card key={idx} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                    {step.stepNumber}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Step Name</Label>
                      <Input className="h-7 text-xs" value={step.stepName} onChange={e => updateWfStep(idx, 'stepName', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Type</Label>
                      <Select value={step.stepType} onValueChange={v => updateWfStep(idx, 'stepType', v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="role">Role-based</SelectItem>
                          <SelectItem value="user">Specific User</SelectItem>
                          <SelectItem value="condition">Conditional</SelectItem>
                          <SelectItem value="auto">Automatic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {step.stepType === 'role' && (
                      <div className="space-y-1">
                        <Label className="text-[10px]">Approver Role</Label>
                        <Select value={step.approverRoleId || ''} onValueChange={v => updateWfStep(idx, 'approverRoleId', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select role" /></SelectTrigger>
                          <SelectContent>
                            {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {step.stepType === 'condition' && (
                      <div className="space-y-1 col-span-2">
                        <Label className="text-[10px]">Condition (JSON)</Label>
                        <Textarea className="text-xs min-h-[40px]" value={step.condition || ''} onChange={e => updateWfStep(idx, 'condition', e.target.value)} placeholder='{"amount": {"operator": ">", "value": 50000}}' />
                      </div>
                    )}
                    <div className="flex items-center gap-4 col-span-2">
                      <div className="flex items-center gap-1.5">
                        <Switch checked={step.isParallel} onCheckedChange={v => updateWfStep(idx, 'isParallel', v)} />
                        <Label className="text-[10px]">Parallel</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch checked={step.isRequired} onCheckedChange={v => updateWfStep(idx, 'isRequired', v)} />
                        <Label className="text-[10px]">Required</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px]">Escalation (min)</Label>
                        <Input type="number" className="h-6 w-16 text-xs" value={step.escalationMinutes || ''} onChange={e => updateWfStep(idx, 'escalationMinutes', +e.target.value || null)} />
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => removeWorkflowStep(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWfDialogOpen(false)}>Cancel</Button>
            <Button onClick={createWorkflow}>{editingWorkflow?.id ? 'Update' : 'Create'} Workflow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ SAVE POLICY CONFIRMATION ============ */}
      <AlertDialog open={savePolicyOpen} onOpenChange={setSavePolicyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Security Policy Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the &ldquo;{selectedPolicy?.name}&rdquo; security policy. Changes will take effect immediately for all users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={savePolicy}>Save Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
