'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Shield, ShieldCheck, Users, Key, Lock, Plus, Pencil, Trash2,
  Search, Check, X, Minus, ChevronDown, ChevronRight, ChevronUp, Loader2,
  Download, AlertCircle, RefreshCw, Eye, LayoutGrid, TreePine,
  Clock, ArrowUpDown, UserCheck, Database
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppStore, hasPermission } from '@/lib/store'

// ============================================================
// Types matching actual API response shapes
// ============================================================

interface RoleRecord {
  id: string
  code: string
  name: string
  description: string | null
  level: number
  parentRoleId: string | null
  parentRole: { id: string; name: string; code: string } | null
  isSystem: boolean
  isActive: boolean
  permissionCount: number
  userCount: number
  createdAt: string
  updatedAt: string
}

interface PermissionRecord {
  id: string
  code: string
  name: string
  description: string | null
  module: string
  action: string
  resource: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface RolePermissionRecord {
  id: string
  roleId: string
  permissionId: string
  isGranted: boolean
  permission: PermissionRecord
}

interface UserRoleAssignment {
  id: string
  userId: string
  roleId: string
  isPrimary: boolean
  grantedBy: string | null
  grantedAt: string
  expiresAt: string | null
  role: {
    id: string; code: string; name: string; description?: string | null
    level: number; isSystem: boolean; isActive: boolean; permissionCount?: number
  }
}

interface UserPermissionOverride {
  id: string
  userId: string
  permissionId: string
  isGranted: boolean
  expiresAt: string | null
  createdAt: string
  permission: PermissionRecord
}

interface UserRecord {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  roles?: { id: string; code: string; name: string; isPrimary: boolean }[]
  primaryRole?: { id: string; code: string; name: string } | null
}

// ============================================================
// Constants
// ============================================================

const MODULES = [
  'dashboard', 'chart-of-accounts', 'vouchers', 'ledgers', 'bank-reconciliation',
  'customers', 'suppliers', 'projects', 'donors', 'locations', 'clients',
  'budgets', 'taxation', 'aging', 'financial-year', 'reports', 'fixed-assets',
  'payroll', 'employees', 'employee-profile', 'project-assignments', 'allowances',
  'attendance', 'loans', 'tax-slabs', 'payroll-gl-mapping', 'final-settlement',
  'payroll-slips', 'payroll-reports', 'user-management', 'rbac', 'security',
  'import-export', 'audit-log', 'settings',
]

const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'reject', 'export', 'print', 'reverse', 'post', 'unpost']

function formatModuleLabel(mod: string): string {
  return mod.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function formatActionLabel(act: string): string {
  return act.charAt(0).toUpperCase() + act.slice(1)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return '—' }
}

// Helper to unwrap API responses
function unwrap<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res
  if (res && typeof res === 'object' && 'data' in res) {
    const d = (res as { data: unknown }).data
    return Array.isArray(d) ? d : []
  }
  return []
}

function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    view: 'bg-sky-100 text-sky-600',
    create: 'bg-[#EEF1F8] text-[#0F2D78]',
    edit: 'bg-amber-100 text-amber-600',
    delete: 'bg-red-100 text-red-600',
    approve: 'bg-violet-100 text-violet-600',
    reject: 'bg-rose-100 text-rose-600',
    export: 'bg-teal-100 text-teal-600',
    print: 'bg-cyan-100 text-cyan-600',
    reverse: 'bg-orange-100 text-orange-600',
    post: 'bg-indigo-100 text-indigo-600',
    unpost: 'bg-fuchsia-100 text-fuchsia-600',
  }
  return colors[action] || 'bg-slate-100 text-slate-600'
}

function getActionIcon(action: string): React.ReactNode {
  const size = 'h-3 w-3'
  switch (action) {
    case 'view': return <Eye className={size} />
    case 'create': return <Plus className={size} />
    case 'edit': return <Pencil className={size} />
    case 'delete': return <Trash2 className={size} />
    case 'approve': return <Check className={size} />
    case 'reject': return <X className={size} />
    case 'export': return <Download className={size} />
    case 'print': return <Download className={size} />
    case 'reverse': return <RefreshCw className={size} />
    case 'post': return <ArrowUpDown className={size} />
    case 'unpost': return <ArrowUpDown className={size} />
    default: return <Key className={size} />
  }
}

// ============================================================
// Main Component
// ============================================================

export function RBACModule() {
  const { toast } = useToast()
  const { authUser } = useAppStore()
  const [activeTab, setActiveTab] = useState('roles')
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [permissions, setPermissions] = useState<PermissionRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])

  // Access control: Only users with RBAC view permissions
  const canAccess = hasPermission(authUser, 'ROLES_VIEW') || hasPermission(authUser, 'PERMISSIONS_VIEW')

  // KPIs
  const kpis = useMemo(() => ({
    totalRoles: roles.length,
    totalPermissions: permissions.length,
    assignedUsers: users.filter(u => u.roles && u.roles.length > 0).length,
    recentChanges: roles.filter(r => {
      const updated = new Date(r.updatedAt)
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return updated > dayAgo
    }).length,
  }), [roles, permissions, users])

  const handleSeed = useCallback(async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/rbac/seed', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        toast({ title: 'Data Seeded', description: data.message || 'RBAC data seeded successfully' })
        // Re-fetch data
        const [rolesRes, permsRes] = await Promise.all([
          fetch('/api/roles'),
          fetch('/api/permissions'),
        ])
        if (rolesRes.ok) {
          const rd = await rolesRes.json()
          setRoles(unwrap<RoleRecord>(rd))
        }
        if (permsRes.ok) {
          const pd = await permsRes.json()
          setPermissions(unwrap<PermissionRecord>(pd))
        }
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to seed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to seed data', variant: 'destructive' })
    } finally {
      setSeeding(false)
    }
  }, [toast])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, permsRes, usersRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/permissions'),
        fetch('/api/users'),
      ])
      let rolesData: RoleRecord[] = []
      let permsData: PermissionRecord[] = []
      if (rolesRes.ok) {
        const rd = await rolesRes.json()
        rolesData = unwrap<RoleRecord>(rd)
        setRoles(rolesData)
      }
      if (permsRes.ok) {
        const pd = await permsRes.json()
        permsData = unwrap<PermissionRecord>(pd)
        setPermissions(permsData)
      }
      if (usersRes.ok) {
        const ud = await usersRes.json()
        setUsers(unwrap<UserRecord>(ud))
      }
      // Auto-seed if no roles and permissions exist
      if (rolesData.length === 0 && permsData.length === 0) {
        setSeeding(true)
        try {
          const seedRes = await fetch('/api/rbac/seed', { method: 'POST' })
          if (seedRes.ok) {
            const seedData = await seedRes.json()
            if (seedData.success !== false) {
              toast({ title: 'RBAC Initialized', description: seedData.message || 'Default roles and permissions have been created' })
              // Re-fetch after seeding
              const [r2, p2] = await Promise.all([fetch('/api/roles'), fetch('/api/permissions')])
              if (r2.ok) { const rd2 = await r2.json(); setRoles(unwrap<RoleRecord>(rd2)) }
              if (p2.ok) { const pd2 = await p2.json(); setPermissions(unwrap<PermissionRecord>(pd2)) }
            }
          }
        } catch { /* ignore auto-seed failure */ }
        finally { setSeeding(false) }
      }
    } catch (err) {
      console.error('Error fetching RBAC data:', err)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  // Access denied view — placed after all hooks
  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-center">
          <Lock className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <h2 className="text-lg font-semibold text-muted-foreground">Access Denied</h2>
            <p className="text-sm text-muted-foreground mt-1">Only Super Admin and System Admin can manage roles and permissions.</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading RBAC module…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-slate-700" />
            Role-Based Access Control
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage roles, permissions, and access policies</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSeed} variant="outline" size="sm" className="h-9 text-sm" disabled={seeding}>
            {seeding ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
            {seeding ? 'Seeding...' : 'Seed Defaults'}
          </Button>
          <Button onClick={fetchData} variant="outline" size="sm" className="h-9 text-sm">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{kpis.totalRoles}</p>
                <p className="text-xs text-muted-foreground">Total Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#0F2D78] flex items-center justify-center shrink-0">
                <Key className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{kpis.totalPermissions}</p>
                <p className="text-xs text-muted-foreground">Total Permissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-600 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{kpis.assignedUsers}</p>
                <p className="text-xs text-muted-foreground">Users with Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-rose-600 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{kpis.recentChanges}</p>
                <p className="text-xs text-muted-foreground">Recent Changes (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="roles" className="text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">
            <Shield className="h-3.5 w-3.5 mr-1.5" /> Roles
          </TabsTrigger>
          <TabsTrigger value="permissions" className="text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">
            <Key className="h-3.5 w-3.5 mr-1.5" /> Permissions
          </TabsTrigger>
          <TabsTrigger value="matrix" className="text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Permission Matrix
          </TabsTrigger>
          <TabsTrigger value="assignments" className="text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">
            <UserCheck className="h-3.5 w-3.5 mr-1.5" /> User Assignments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-4">
          <RolesTab roles={roles} permissions={permissions} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <PermissionsTab permissions={permissions} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="matrix" className="mt-4">
          <PermissionMatrixTab roles={roles} permissions={permissions} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="assignments" className="mt-4">
          <UserAssignmentsTab users={users} roles={roles} onRefresh={fetchData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// Roles Tab
// ============================================================

function RolesTab({ roles, permissions, onRefresh }: {
  roles: RoleRecord[]
  permissions: PermissionRecord[]
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [showHierarchy, setShowHierarchy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingRole, setDeletingRole] = useState<RoleRecord | null>(null)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [rolePerms, setRolePerms] = useState<RolePermissionRecord[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)

  const [form, setForm] = useState({
    code: '', name: '', description: '', level: 0, parentRoleId: '', isSystem: false, isActive: true,
  })

  const filteredRoles = useMemo(() => roles.filter(r =>
    !searchQuery ||
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.code.toLowerCase().includes(searchQuery.toLowerCase())
  ), [roles, searchQuery])

  const openAddDialog = () => {
    setEditingRole(null)
    setForm({ code: '', name: '', description: '', level: 0, parentRoleId: '', isSystem: false, isActive: true })
    setDialogOpen(true)
  }

  const openEditDialog = (role: RoleRecord) => {
    setEditingRole(role)
    setForm({
      code: role.code, name: role.name, description: role.description || '',
      level: role.level, parentRoleId: role.parentRoleId || '',
      isSystem: role.isSystem, isActive: role.isActive,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast({ title: 'Validation Error', description: 'Code and name are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      let res: Response
      if (editingRole) {
        res = await fetch(`/api/roles/${editingRole.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
      } else {
        res = await fetch('/api/roles', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
      }
      const data = await res.json()
      if (res.ok && data.success !== false) {
        toast({ title: editingRole ? 'Role Updated' : 'Role Created', description: `${form.name} saved successfully` })
        onRefresh()
        setDialogOpen(false)
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to save role', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingRole) return
    try {
      const res = await fetch(`/api/roles/${deletingRole.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        toast({ title: 'Role Deleted', description: `${deletingRole.name} deleted successfully` })
        onRefresh()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete role', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    }
    setDeleteDialogOpen(false)
    setDeletingRole(null)
  }

  const loadRolePermissions = async (roleId: string) => {
    if (expandedRole === roleId) { setExpandedRole(null); return }
    setExpandedRole(roleId)
    setLoadingPerms(true)
    try {
      const res = await fetch(`/api/role-permissions?roleId=${roleId}`)
      if (res.ok) {
        const d = await res.json()
        setRolePerms(unwrap<RolePermissionRecord>(d))
      }
    } catch (err) {
      console.error('Error loading role permissions:', err)
    } finally {
      setLoadingPerms(false)
    }
  }

  // Build hierarchy tree
  const buildTree = (parentId: string | null, level = 0): (RoleRecord & { _treeLevel: number })[] => {
    return roles
      .filter(r => r.parentRoleId === parentId)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .flatMap(r => [{ ...r, _treeLevel: level }, ...buildTree(r.id, level + 1)])
  }

  const treeRoles = useMemo(() => buildTree(null), [roles])
  const displayRoles = showHierarchy ? treeRoles : filteredRoles

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search roles…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm w-full sm:w-[260px]" />
          </div>
          <Button variant={showHierarchy ? 'default' : 'outline'} size="sm" className="h-9 text-xs" onClick={() => setShowHierarchy(!showHierarchy)}>
            <TreePine className="h-3.5 w-3.5 mr-1" /> Hierarchy
          </Button>
        </div>
        <Button onClick={openAddDialog} className="bg-slate-900 text-white hover:bg-slate-800 h-9 text-sm shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> Add Role
        </Button>
      </div>

      <Card className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 w-8"></th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Code</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden md:table-cell">Level</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden lg:table-cell">Hierarchy</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3 hidden sm:table-cell">System</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">Users</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3 hidden md:table-cell">Perms</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayRoles.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Shield className="h-10 w-10 text-slate-300" />
                    <p className="text-sm text-muted-foreground">No roles found</p>
                  </div>
                </td></tr>
              ) : displayRoles.map(role => {
                const isExpanded = expandedRole === role.id
                const treeLevel = '_treeLevel' in role ? (role as RoleRecord & { _treeLevel: number })._treeLevel : 0
                return (
                  <React.Fragment key={role.id}>
                    <tr className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${!role.isActive ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => loadRolePermissions(role.id)} className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {showHierarchy && treeLevel > 0 && <span className="text-slate-300 mr-1">{'│  '.repeat(treeLevel)}</span>}
                        <code className="text-xs font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{role.code}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">{role.name}</span>
                        {role.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{role.description}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell"><Badge variant="outline" className="text-xs font-normal">{role.level}</Badge></td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {role.parentRole ? <span className="text-xs text-slate-500">{role.parentRole.name}</span> : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {role.isSystem ? <Lock className="h-3.5 w-3.5 text-amber-500 inline-block" /> : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center"><span className="text-sm font-medium text-slate-700">{role.userCount}</span></td>
                      <td className="px-4 py-3 text-center hidden md:table-cell"><span className="text-sm font-medium text-slate-700">{role.permissionCount}</span></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${role.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${role.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          {role.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditDialog(role)} className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Edit role">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {!role.isSystem && (
                            <button onClick={() => { setDeletingRole(role); setDeleteDialogOpen(true) }} className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete role">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr><td colSpan={10} className="bg-slate-50/80 px-6 py-4">
                        {loadingPerms ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading permissions…</div>
                        ) : rolePerms.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No permissions assigned to this role.</p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-slate-500 mb-2">Permissions ({rolePerms.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {rolePerms.map(rp => (
                                <Badge key={rp.id} variant="outline" className={`text-[10px] font-normal ${rp.isGranted ? 'bg-emerald-50 text-emerald-700 border-[#A5B4D2]' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                  {rp.isGranted ? <Check className="h-2.5 w-2.5 mr-0.5" /> : <X className="h-2.5 w-2.5 mr-0.5" />}
                                  {rp.permission.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </td></tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Add New Role'}</DialogTitle>
            <DialogDescription>{editingRole ? 'Update role details and configuration' : 'Create a new role in the system'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Code <span className="text-red-500">*</span></Label>
                <Input className="h-9 text-sm" placeholder="e.g. FINANCE_MANAGER" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} disabled={!!editingRole?.isSystem} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Name <span className="text-red-500">*</span></Label>
                <Input className="h-9 text-sm" placeholder="e.g. Finance Manager" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description</Label>
              <Input className="h-9 text-sm" placeholder="Role description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Level</Label>
                <Input type="number" className="h-9 text-sm" value={form.level} onChange={e => setForm(p => ({ ...p, level: parseInt(e.target.value) || 0 }))} min={0} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Parent Role</Label>
                <Select value={form.parentRoleId || 'none'} onValueChange={v => setForm(p => ({ ...p, parentRoleId: v === 'none' ? '' : v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Top Level)</SelectItem>
                    {roles.filter(r => r.id !== editingRole?.id).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div><Label className="text-sm font-medium">System Role</Label><p className="text-xs text-muted-foreground">System roles cannot be deleted</p></div>
              <Switch checked={form.isSystem} onCheckedChange={v => setForm(p => ({ ...p, isSystem: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div><Label className="text-sm font-medium">Active</Label><p className="text-xs text-muted-foreground">Inactive roles are disabled</p></div>
              <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="h-9 text-sm">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-slate-900 text-white hover:bg-slate-800 h-9 text-sm min-w-[100px]">
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Role?</DialogTitle>
            <DialogDescription>Are you sure you want to delete <span className="font-semibold text-slate-900">{deletingRole?.name}</span>? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)} className="h-9 text-sm">Cancel</Button>
            <Button size="sm" onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700 h-9 text-sm">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Permissions Tab
// ============================================================

function PermissionsTab({ permissions, onRefresh }: { permissions: PermissionRecord[]; onRefresh: () => void }) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState({ module: '', action: '', resource: '', name: '', code: '', description: '' })

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionRecord[]>()
    permissions
      .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.code.toLowerCase().includes(searchQuery.toLowerCase()) || p.module.toLowerCase().includes(searchQuery.toLowerCase()))
      .forEach(p => { const list = map.get(p.module) || []; list.push(p); map.set(p.module, list) })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [permissions, searchQuery])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/rbac/seed', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        toast({ title: 'Data Seeded', description: data.message || 'RBAC data seeded successfully' })
        onRefresh()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to seed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to seed data', variant: 'destructive' })
    } finally {
      setSeeding(false)
    }
  }

  const handleSave = async () => {
    if (!form.module || !form.action || !form.resource) {
      toast({ title: 'Validation Error', description: 'Module, action, and resource are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/permissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        toast({ title: 'Permission Created', description: 'New permission added successfully' })
        onRefresh()
        setDialogOpen(false)
        setForm({ module: '', action: '', resource: '', name: '', code: '', description: '' })
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to create permission', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:w-auto sm:flex-initial">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search permissions…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm w-full sm:w-[260px]" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding} className="h-9 text-sm">
            {seeding ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
            Seed Defaults
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800 h-9 text-sm shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> Add Permission
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Key className="h-3.5 w-3.5" />
        <span>{permissions.length} permissions across {grouped.length} modules</span>
      </div>

      <ScrollArea className="max-h-[600px]">
        <Accordion type="multiple" defaultValue={grouped.slice(0, 3).map(([mod]) => mod)} className="space-y-2">
          {grouped.map(([module, perms]) => (
            <AccordionItem key={module} value={module} className="border border-slate-200 rounded-xl overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50/50">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Shield className="h-4 w-4 text-slate-600" /></div>
                  <div className="text-left">
                    <span className="text-sm font-semibold text-slate-900">{formatModuleLabel(module)}</span>
                    <p className="text-xs text-muted-foreground">{module}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs ml-auto mr-2">{perms.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {perms.map(perm => (
                    <div key={perm.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-100 bg-white hover:bg-slate-50/50">
                      <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${getActionColor(perm.action)}`}>{getActionIcon(perm.action)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-900 truncate">{perm.name}</p>
                        <code className="text-[10px] font-mono text-slate-400">{perm.code}</code>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">{perm.action}</Badge>
                          <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">{perm.resource}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>

      {/* Add Permission Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Permission</DialogTitle>
            <DialogDescription>Create a new permission entry</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Module <span className="text-red-500">*</span></Label>
                <Select value={form.module} onValueChange={v => setForm(p => ({ ...p, module: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select module" /></SelectTrigger>
                  <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{formatModuleLabel(m)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Action <span className="text-red-500">*</span></Label>
                <Select value={form.action} onValueChange={v => setForm(p => ({ ...p, action: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select action" /></SelectTrigger>
                  <SelectContent>{ACTIONS.map(a => <SelectItem key={a} value={a}>{formatActionLabel(a)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Resource <span className="text-red-500">*</span></Label>
              <Input className="h-9 text-sm" placeholder="e.g. voucher, account, employee" value={form.resource} onChange={e => setForm(p => ({ ...p, resource: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Name <span className="text-xs text-muted-foreground">(auto-generated if blank)</span></Label>
              <Input className="h-9 text-sm" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={`${formatModuleLabel(form.module || 'module')} ${formatActionLabel(form.action || 'action')} ${form.resource || 'resource'}`} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Code <span className="text-xs text-muted-foreground">(auto-generated if blank)</span></Label>
              <Input className="h-9 text-sm font-mono" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder={`${(form.module || 'MODULE').toUpperCase().replace(/-/g, '_')}_${(form.action || 'ACTION').toUpperCase()}_${(form.resource || 'RESOURCE').toUpperCase()}`} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="h-9 text-sm">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-slate-900 text-white hover:bg-slate-800 h-9 text-sm min-w-[100px]">
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Creating…</> : 'Create Permission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Permission Matrix Tab (Hero Feature)
// ============================================================

function PermissionMatrixTab({ roles, permissions, onRefresh }: {
  roles: RoleRecord[]
  permissions: PermissionRecord[]
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, boolean | null>>>({})
  const [loadingMatrix, setLoadingMatrix] = useState(true)
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  const moduleGroups = useMemo(() => {
    const map = new Map<string, PermissionRecord[]>()
    const filteredPerms = moduleFilter === 'all' ? permissions : permissions.filter(p => p.module === moduleFilter)
    filteredPerms.forEach(p => { const list = map.get(p.module) || []; list.push(p); map.set(p.module, list) })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [permissions, moduleFilter])

  const loadMatrix = useCallback(async () => {
    setLoadingMatrix(true)
    try {
      const allRP: Record<string, Record<string, boolean | null>> = {}
      for (const role of roles) {
        allRP[role.id] = {}
        for (const perm of permissions) { allRP[role.id][perm.id] = null }
      }
      await Promise.all(roles.map(async (role) => {
        try {
          const res = await fetch(`/api/role-permissions?roleId=${role.id}`)
          if (res.ok) {
            const d = await res.json()
            const data = unwrap<RolePermissionRecord>(d)
            for (const rp of data) {
              if (allRP[role.id]) { allRP[role.id][rp.permissionId] = rp.isGranted }
            }
          }
        } catch { /* skip */ }
      }))
      setMatrixData(allRP)
      if (moduleGroups.length > 0 && expandedModules.size === 0) {
        setExpandedModules(new Set(moduleGroups.slice(0, 5).map(([m]) => m)))
      }
    } catch (err) { console.error('Error loading matrix:', err) }
    finally { setLoadingMatrix(false) }
  }, [roles, permissions])

  useEffect(() => { loadMatrix() }, [loadMatrix])

  const toggleCell = async (roleId: string, permissionId: string) => {
    const current = matrixData[roleId]?.[permissionId]
    const next = current === null ? true : current === true ? false : null

    setSavingCell(`${roleId}-${permissionId}`)
    try {
      const currentPerms = Object.entries(matrixData[roleId] || {})
        .filter(([pid, val]) => val !== null && pid !== permissionId)
        .map(([pid, val]) => ({ permissionId: pid, isGranted: val as boolean }))
      if (next !== null) { currentPerms.push({ permissionId, isGranted: next }) }

      const res = await fetch('/api/role-permissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId, permissions: currentPerms }),
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        setMatrixData(prev => ({ ...prev, [roleId]: { ...prev[roleId], [permissionId]: next } }))
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to update permission', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update permission', variant: 'destructive' })
    } finally {
      setSavingCell(null)
    }
  }

  const toggleModule = (mod: string) => {
    setExpandedModules(prev => { const next = new Set(prev); if (next.has(mod)) next.delete(mod); else next.add(mod); return next })
  }

  const grantCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const role of roles) { counts[role.id] = Object.values(matrixData[role.id] || {}).filter(v => v === true).length }
    return counts
  }, [roles, matrixData])

  if (loadingMatrix) {
    return (
      <Card className="border border-slate-200 rounded-xl">
        <CardContent className="p-8 flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading permission matrix…</span></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto flex-wrap">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm"><SelectValue placeholder="Filter by module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {MODULES.filter(m => permissions.some(p => p.module === m)).map(m => (
                <SelectItem key={m} value={m}>
                  <div className="flex items-center justify-between w-full">
                    <span>{formatModuleLabel(m)}</span>
                    <Badge variant="secondary" className="text-[10px] ml-2">{permissions.filter(p => p.module === m).length}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setExpandedModules(new Set(moduleGroups.map(([m]) => m)))} className="h-9 text-xs">
            <ChevronDown className="h-3.5 w-3.5 mr-1" /> Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpandedModules(new Set())} className="h-9 text-xs">
            <ChevronUp className="h-3.5 w-3.5 mr-1" /> Collapse
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={loadMatrix} className="h-9 text-sm">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reload
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="h-5 w-5 rounded border-2 border-emerald-500 bg-[#EEF1F8] flex items-center justify-center"><Check className="h-3 w-3 text-[#0F2D78]" /></span>
          <span className="text-slate-600">Granted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-5 w-5 rounded border-2 border-red-500 bg-red-100 flex items-center justify-center"><X className="h-3 w-3 text-red-600" /></span>
          <span className="text-slate-600">Denied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-5 w-5 rounded border-2 border-slate-300 bg-slate-50 flex items-center justify-center"><Minus className="h-3 w-3 text-slate-400" /></span>
          <span className="text-slate-600">Not Set</span>
        </div>
        <span className="text-muted-foreground ml-2">Click to toggle: Not Set → Granted → Denied → Not Set</span>
      </div>

      {/* Matrix Grid */}
      <Card className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="text-left text-xs font-semibold px-4 py-3 sticky left-0 bg-slate-900 z-10 min-w-[200px]">Permission / Role</th>
                {roles.map(role => (
                  <th key={role.id} className="text-center text-xs font-semibold px-2 py-3 min-w-[90px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="truncate max-w-[80px]" title={role.name}>{role.name}</span>
                      <Badge variant="outline" className="text-[9px] border-slate-600 text-slate-300 h-4 px-1">
                        {grantCounts[role.id] || 0}/{permissions.length}
                      </Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moduleGroups.map(([module, perms]) => (
                <React.Fragment key={module}>
                  <tr className="bg-slate-100 cursor-pointer hover:bg-slate-200/70 transition-colors" onClick={() => toggleModule(module)}>
                    <td className="px-4 py-2.5 sticky left-0 bg-slate-100 z-10">
                      <div className="flex items-center gap-2">
                        {expandedModules.has(module) ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                        <Shield className="h-4 w-4 text-slate-600" />
                        <span className="text-sm font-semibold text-slate-900">{formatModuleLabel(module)}</span>
                        <Badge variant="secondary" className="text-[10px] h-4">{perms.length}</Badge>
                      </div>
                    </td>
                    {roles.map(role => (
                      <td key={role.id} className="px-2 py-2.5 text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="text-[10px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Grant all for this module-role combo
                                  const modulePermIds = perms.map(p => p.id)
                                  const currentPerms = Object.entries(matrixData[role.id] || {})
                                    .filter(([pid, val]) => val !== null && !modulePermIds.includes(pid))
                                    .map(([pid, val]) => ({ permissionId: pid, isGranted: val as boolean }))
                                  const newPerms = modulePermIds.map(pid => ({ permissionId: pid, isGranted: true }))
                                  fetch('/api/role-permissions', {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ roleId: role.id, permissions: [...currentPerms, ...newPerms] }),
                                  }).then(res => {
                                    if (res.ok) {
                                      setMatrixData(prev => {
                                        const updated = { ...prev[role.id] }
                                        modulePermIds.forEach(pid => { updated[pid] = true })
                                        return { ...prev, [role.id]: updated }
                                      })
                                      toast({ title: 'Module Granted', description: `All ${formatModuleLabel(module)} permissions granted for ${role.name}` })
                                    }
                                  })
                                }}
                              >
                                Grant All
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Grant all permissions in this module for {role.name}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    ))}
                  </tr>
                  {expandedModules.has(module) && perms.map(perm => (
                    <tr key={perm.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="px-4 py-2 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2 pl-6">
                          <div className={`h-4 w-4 rounded flex items-center justify-center shrink-0 ${getActionColor(perm.action)}`}>{getActionIcon(perm.action)}</div>
                          <div className="min-w-0">
                            <p className="text-xs text-slate-700 truncate">{perm.name}</p>
                            <code className="text-[10px] font-mono text-slate-400">{perm.action}</code>
                          </div>
                        </div>
                      </td>
                      {roles.map(role => {
                        const cellKey = `${role.id}-${perm.id}`
                        const value = matrixData[role.id]?.[perm.id]
                        const isSaving = savingCell === cellKey
                        return (
                          <td key={role.id} className="px-2 py-1.5 text-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => toggleCell(role.id, perm.id)}
                                    disabled={isSaving}
                                    className={`h-7 w-7 rounded-md border-2 flex items-center justify-center transition-all duration-150 hover:scale-110
                                      ${value === true ? 'border-emerald-500 bg-[#EEF1F8] hover:bg-emerald-200' : value === false ? 'border-red-500 bg-red-100 hover:bg-red-200' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}
                                      ${isSaving ? 'opacity-50' : ''}
                                    `}
                                  >
                                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                                      : value === true ? <Check className="h-3.5 w-3.5 text-[#0F2D78]" />
                                      : value === false ? <X className="h-3.5 w-3.5 text-red-600" />
                                      : <Minus className="h-3.5 w-3.5 text-slate-400" />}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent><span className="text-xs">{role.name} → {perm.name}: {value === true ? 'Granted' : value === false ? 'Denied' : 'Not Set'}</span></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {/* Summary row */}
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="px-4 py-3 sticky left-0 bg-slate-50 z-10"><span className="text-xs font-bold text-slate-700">Total Grants</span></td>
                {roles.map(role => (
                  <td key={role.id} className="px-2 py-3 text-center">
                    <span className="text-sm font-bold text-slate-900">{grantCounts[role.id] || 0}</span>
                    <span className="text-xs text-muted-foreground">/{permissions.length}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ============================================================
// User Assignments Tab
// ============================================================

function UserAssignmentsTab({ users, roles, onRefresh }: {
  users: UserRecord[]
  roles: RoleRecord[]
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null)
  const [userPermOverrides, setUserPermOverrides] = useState<UserPermissionOverride[]>([])
  const [loadingOverrides, setLoadingOverrides] = useState(false)
  const [form, setForm] = useState({ userId: '', roleId: '', isPrimary: false, expiresAt: '' })

  const filteredUsers = useMemo(() => users.filter(u =>
    !searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())
  ), [users, searchQuery])

  const openAssignDialog = (userId?: string) => {
    setForm({ userId: userId || '', roleId: '', isPrimary: false, expiresAt: '' })
    setAssignDialogOpen(true)
  }

  const handleAssign = async () => {
    if (!form.userId || !form.roleId) {
      toast({ title: 'Validation Error', description: 'User and role are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/user-roles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        toast({ title: 'Role Assigned', description: 'Role assigned to user successfully' })
        onRefresh()
        setAssignDialogOpen(false)
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to assign role', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      const res = await fetch(`/api/user-roles?userId=${userId}&roleId=${roleId}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        toast({ title: 'Role Removed', description: 'Role removed from user' })
        onRefresh()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to remove role', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    }
  }

  const loadUserOverrides = async (user: UserRecord) => {
    if (selectedUser?.id === user.id) { setSelectedUser(null); return }
    setSelectedUser(user)
    setLoadingOverrides(true)
    try {
      const res = await fetch(`/api/user-permissions?userId=${user.id}`)
      if (res.ok) {
        const d = await res.json()
        setUserPermOverrides(unwrap<UserPermissionOverride>(d))
      }
    } catch (err) { console.error('Error loading user permissions:', err) }
    finally { setLoadingOverrides(false) }
  }

  const handleRemoveOverride = async (userId: string, permissionId: string) => {
    try {
      const res = await fetch(`/api/user-permissions?userId=${userId}&permissionId=${permissionId}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        setUserPermOverrides(prev => prev.filter(p => p.permissionId !== permissionId))
        toast({ title: 'Override Removed' })
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to remove override', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove override', variant: 'destructive' })
    }
  }

  const handleAddOverride = async (userId: string, permissionId: string, isGranted: boolean) => {
    try {
      const res = await fetch('/api/user-permissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permissionId, isGranted }),
      })
      const data = await res.json()
      if (res.ok && data.success !== false) {
        const newOverride = unwrap<UserPermissionOverride>(data)
        if (newOverride.length > 0) setUserPermOverrides(prev => [...prev, newOverride[0]])
        else {
          // Single object response
          const d = (data as { data?: UserPermissionOverride }).data
          if (d) setUserPermOverrides(prev => [...prev, d])
        }
        toast({ title: 'Override Added' })
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to add override', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add override', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:w-auto sm:flex-initial">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search users…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm w-full sm:w-[260px]" />
        </div>
        <Button onClick={() => openAssignDialog()} className="bg-slate-900 text-white hover:bg-slate-800 h-9 text-sm shrink-0">
          <UserCheck className="h-4 w-4 mr-1.5" /> Assign Role
        </Button>
      </div>

      <Card className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 w-8"></th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">User</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden md:table-cell">Email</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Assigned Roles</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden lg:table-cell">Primary Role</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3"><Users className="h-10 w-10 text-slate-300" /><p className="text-sm text-muted-foreground">No users found</p></div>
                </td></tr>
              ) : filteredUsers.map(user => {
                const userRoles = user.roles || []
                const primaryRole = userRoles.find(r => r.isPrimary) || user.primaryRole
                const isSelected = selectedUser?.id === user.id
                return (
                  <React.Fragment key={user.id}>
                    <tr className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${!user.isActive ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => loadUserOverrides(user)} className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                          {isSelected ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold shrink-0">
                            {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-sm text-slate-600">{user.email}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {userRoles.length === 0 ? (
                            <span className="text-xs text-slate-400">No roles assigned</span>
                          ) : userRoles.map(ur => (
                            <Badge key={ur.id} variant={ur.isPrimary ? 'default' : 'outline'} className={`text-[10px] ${ur.isPrimary ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}>
                              {ur.name}
                              <button onClick={() => handleRemoveRole(user.id, ur.id)} className="ml-1 hover:text-red-400 transition-colors" title="Remove role"><X className="h-2.5 w-2.5" /></button>
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {primaryRole ? <span className="text-xs font-medium text-slate-700">{primaryRole.name}</span> : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={() => openAssignDialog(user.id)} className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-[#0F2D78] hover:bg-emerald-50 transition-colors">
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Assign role</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    </tr>
                    {isSelected && (
                      <tr><td colSpan={6} className="bg-slate-50/80 px-6 py-4">
                        {loadingOverrides ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading overrides…</div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-500">Permission Overrides for {user.name} ({userPermOverrides.length})</p>
                              <AddOverrideButton userId={user.id} onAdd={handleAddOverride} existingOverrides={userPermOverrides} />
                            </div>
                            {userPermOverrides.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No permission overrides. User inherits permissions from assigned roles.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {userPermOverrides.map(up => (
                                  <Badge key={up.id} variant="outline" className={`text-[10px] ${up.isGranted ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-700'}`}>
                                    {up.isGranted ? <Check className="h-2.5 w-2.5 mr-0.5" /> : <X className="h-2.5 w-2.5 mr-0.5" />}
                                    {up.permission.name}
                                    <button onClick={() => handleRemoveOverride(user.id, up.permissionId)} className="ml-1 hover:text-red-400 transition-colors" title="Remove override"><X className="h-2.5 w-2.5" /></button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td></tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Assign Role Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Assign Role to User</DialogTitle>
            <DialogDescription>Select a user and role to create an assignment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">User <span className="text-red-500">*</span></Label>
              <Select value={form.userId} onValueChange={v => setForm(p => ({ ...p, userId: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>{users.filter(u => u.isActive).map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Role <span className="text-red-500">*</span></Label>
              <Select value={form.roleId} onValueChange={v => setForm(p => ({ ...p, roleId: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{roles.filter(r => r.isActive).map(r => (
                  <SelectItem key={r.id} value={r.id}><div className="flex items-center gap-2"><span>{r.name}</span><Badge variant="outline" className="text-[9px] h-3.5 px-1">{r.code}</Badge></div></SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div><Label className="text-sm font-medium">Set as Primary Role</Label><p className="text-xs text-muted-foreground">Primary role determines default permissions</p></div>
              <Switch checked={form.isPrimary} onCheckedChange={v => setForm(p => ({ ...p, isPrimary: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Expiry Date <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input type="date" className="h-9 text-sm" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(false)} className="h-9 text-sm">Cancel</Button>
            <Button size="sm" onClick={handleAssign} disabled={saving} className="bg-slate-900 text-white hover:bg-slate-800 h-9 text-sm min-w-[100px]">
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Assigning…</> : 'Assign Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Add Override Button
function AddOverrideButton({ userId, onAdd, existingOverrides }: {
  userId: string
  onAdd: (userId: string, permissionId: string, isGranted: boolean) => void
  existingOverrides: UserPermissionOverride[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [grantType, setGrantType] = useState(true)
  const [perms, setPerms] = useState<PermissionRecord[]>([])

  useEffect(() => {
    if (open && perms.length === 0) {
      fetch('/api/permissions').then(r => r.json()).then(d => {
        const data = unwrap<PermissionRecord>(d)
        setPerms(data)
      }).catch(() => {})
    }
  }, [open, perms.length])

  const existingIds = new Set(existingOverrides.map(o => o.permissionId))
  const filtered = perms
    .filter(p => !existingIds.has(p.id))
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 20)

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(!open)}>
        <Plus className="h-3 w-3 mr-1" /> Add Override
      </Button>
      {open && (
        <div className="absolute right-0 top-9 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-[320px]">
          <div className="space-y-2">
            <Input placeholder="Search permissions…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs" />
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => setGrantType(true)} className={`px-2 py-1 rounded text-xs ${grantType ? 'bg-[#EEF1F8] text-emerald-700 font-medium' : 'text-slate-500'}`}>Grant</button>
              <button onClick={() => setGrantType(false)} className={`px-2 py-1 rounded text-xs ${!grantType ? 'bg-red-100 text-red-700 font-medium' : 'text-slate-500'}`}>Deny</button>
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-0.5">
                {filtered.map(p => (
                  <button key={p.id} onClick={() => { onAdd(userId, p.id, grantType); setOpen(false) }} className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-50 text-xs transition-colors">
                    <span className="font-medium text-slate-700">{p.name}</span>
                    <span className="text-slate-400 ml-1">{p.module}</span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">No available permissions</p>}
              </div>
            </ScrollArea>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  )
}
