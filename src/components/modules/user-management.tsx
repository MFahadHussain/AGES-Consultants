'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search, Plus, Pencil, Trash2, Shield, Check, X, Eye, EyeOff,
  AlertCircle, Loader2, Users, UserCheck, UserX, UserPlus,
  MoreHorizontal, Lock, Unlock, KeyRound, RefreshCw, LogIn,
  Clock, Monitor, Globe, AlertTriangle, ChevronDown, Filter,
  ShieldCheck, Activity, History, ArrowUpRight, Copy,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppStore, hasPermission } from '@/lib/store'

// ============================================================
// Types
// ============================================================

interface BranchOption {
  id: string
  code: string
  name: string
}

interface DepartmentOption {
  id: string
  code: string
  name: string
  branchId: string | null
  branch?: { id: string; name: string; code: string }
}

interface UserRoleAssignment {
  id: string
  roleId: string
  isPrimary: boolean
  grantedAt: string
  expiresAt: string | null
  role: {
    id: string
    code: string
    name: string
    level: number
    isSystem: boolean
    parentRole?: { id: string; name: string; code: string } | null
  }
}

interface UserRecord {
  id: string
  name: string
  email: string
  username: string | null
  phone: string | null
  role: string
  isActive: boolean
  isLocked: boolean
  lockedUntil: string | null
  failedLoginAttempts: number
  avatarUrl: string | null
  lastLoginAt: string | null
  lastLoginIp: string | null
  forcePasswordChange: boolean
  passwordExpiresAt: string | null
  passwordChangedAt: string | null
  branchId: string | null
  departmentId: string | null
  employeeId: string | null
  designation: string | null
  createdAt: string
  updatedAt: string
  lastLogin: string | null
  branch: BranchOption | null
  department: DepartmentOption | null
  roles?: { id: string; code: string; name: string; level: number; isPrimary: boolean }[]
  primaryRole?: { id: string; code: string; name: string; level: number } | null
  auditCount: number
  actionCount: number
}

interface UserForm {
  name: string
  email: string
  username: string
  phone: string
  role: string
  roleIds: string[]
  isActive: boolean
  isLocked: boolean
  forcePasswordChange: boolean
  password: string
  confirmPassword: string
  branchId: string
  departmentId: string
  employeeId: string
  designation: string
  avatarUrl: string
}

interface SessionRecord {
  id: string
  userId: string
  userName: string
  deviceInfo: { browser?: string; os?: string; device?: string } | null
  ipAddress: string | null
  geoLocation: { country?: string; city?: string } | null
  isActive: boolean
  expiresAt: string
  lastActivityAt: string
  createdAt: string
}

interface LoginHistoryRecord {
  id: string
  loginStatus: string
  failureReason: string | null
  ipAddress: string | null
  browser: string | null
  os: string | null
  device: string | null
  geoLocation: { country?: string; city?: string } | null
  createdAt: string
}

interface AuditLogRecord {
  id: string
  action: string
  entity: string
  entityId: string | null
  entityName: string | null
  details: string | null
  severity: string
  module: string | null
  createdAt: string
  user: { name: string; email: string } | null
}

interface RoleOption {
  id: string
  code: string
  name: string
  level: number
  isSystem: boolean
}

// ============================================================
// Constants
// ============================================================

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'viewer', label: 'Viewer' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'locked', label: 'Locked' },
]

const DEFAULT_FORM: UserForm = {
  name: '',
  email: '',
  username: '',
  phone: '',
  role: 'viewer',
  roleIds: [],
  isActive: true,
  isLocked: false,
  forcePasswordChange: false,
  password: '',
  confirmPassword: '',
  branchId: '',
  departmentId: '',
  employeeId: '',
  designation: '',
  avatarUrl: '',
}

// ============================================================
// Auth Context
// ============================================================

function useCurrentUser() {
  const { authUser } = useAppStore()
  return authUser
    ? { id: authUser.id, name: authUser.name, role: authUser.role }
    : { id: '1', name: 'Fahad Hussain', role: 'admin' }
}

// ============================================================
// Helpers
// ============================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return '—' }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  try {
    const now = new Date()
    const date = new Date(dateStr)
    const diff = now.getTime() - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return formatDate(dateStr)
  } catch { return '—' }
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score += 25
  if (password.length >= 12) score += 10
  if (/[A-Z]/.test(password)) score += 20
  if (/[a-z]/.test(password)) score += 15
  if (/[0-9]/.test(password)) score += 15
  if (/[^A-Za-z0-9]/.test(password)) score += 15
  score = Math.min(score, 100)

  if (score < 30) return { score, label: 'Weak', color: 'bg-red-500' }
  if (score < 55) return { score, label: 'Fair', color: 'bg-amber-500' }
  if (score < 80) return { score, label: 'Strong', color: 'bg-emerald-500' }
  return { score, label: 'Very Strong', color: 'bg-emerald-600' }
}

function getRoleBadge(user: UserRecord) {
  if (user.roles && user.roles.length > 0) {
    const primary = user.primaryRole || user.roles[0]
    const extraCount = user.roles.length - 1
    return (
      <div className="flex items-center space-x-1">
        <Badge variant={primary.level >= 90 ? 'default' : 'outline'} className={`text-[10px] px-2 py-0.5 ${primary.level >= 90 ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border-blue-200 text-blue-700 bg-blue-50'}`}>
          {primary.name}
        </Badge>
        {extraCount > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="text-[9px] px-1 h-4 cursor-pointer">+{extraCount}</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  {user.roles.map(r => <div key={r.id}>{r.name}</div>)}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    )
  }

  // Fallback to legacy role
  switch (user.role) {
    case 'admin':
      return <Badge className="bg-slate-900 text-white hover:bg-slate-800 text-[10px] px-2 py-0.5">Admin</Badge>
    case 'manager':
      return <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 text-[10px] px-2 py-0.5">Manager</Badge>
    case 'accountant':
      return <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px] px-2 py-0.5">Accountant</Badge>
    case 'auditor':
      return <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[10px] px-2 py-0.5">Auditor</Badge>
    case 'viewer':
      return <Badge variant="outline" className="border-slate-200 text-slate-500 bg-slate-50 text-[10px] px-2 py-0.5">Viewer</Badge>
    default:
      return <Badge variant="outline" className="text-[10px] px-2 py-0.5">{user.role}</Badge>
  }
}

function getStatusIndicator(user: UserRecord) {
  if (user.isLocked) {
    const unlockTime = user.lockedUntil ? timeAgo(user.lockedUntil) : null
    return (
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
        <span className="text-xs font-medium text-red-700">Locked</span>
        {unlockTime && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Clock className="h-3 w-3 text-red-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Auto-unlock: {formatDateTime(user.lockedUntil)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    )
  }
  if (!user.isActive) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
        <span className="text-xs font-medium text-slate-400">Inactive</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
      <span className="text-xs font-medium text-emerald-700">Active</span>
      {user.forcePasswordChange && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <KeyRound className="h-3 w-3 text-amber-500 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Must change password on next login</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {user.passwordExpiresAt && new Date(user.passwordExpiresAt) < new Date(Date.now() + 7 * 86400000) && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-3 w-3 text-orange-500 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Password expires: {formatDate(user.passwordExpiresAt)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

// ============================================================
// KPI Cards Component
// ============================================================

function KPICards({ users, loading }: { users: UserRecord[]; loading: boolean }) {
  const totalUsers = users.length
  const activeUsers = users.filter(u => u.isActive && !u.isLocked).length
  const lockedUsers = users.filter(u => u.isLocked).length
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const newThisMonth = users.filter(u => new Date(u.createdAt) >= startOfMonth).length

  const cards = [
    { title: 'Total Users', value: totalUsers, icon: Users, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
    { title: 'Active', value: activeUsers, icon: UserCheck, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { title: 'Locked', value: lockedUsers, icon: UserX, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
    { title: 'New This Month', value: newThisMonth, icon: UserPlus, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border rounded-xl">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <Card key={card.title} className={`border ${card.border} rounded-xl`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
                <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================================
// Add/Edit User Modal
// ============================================================

function UserFormModal({
  open, onClose, editingUser, onSave, saving, branches, departments, roles,
}: {
  open: boolean
  onClose: () => void
  editingUser: UserRecord | null
  onSave: (form: UserForm) => Promise<void>
  saving: boolean
  branches: BranchOption[]
  departments: DepartmentOption[]
  roles: RoleOption[]
}) {
  const getInitialForm = (): UserForm => editingUser
    ? {
        name: editingUser.name,
        email: editingUser.email,
        username: editingUser.username || '',
        phone: editingUser.phone || '',
        role: editingUser.role,
        isActive: editingUser.isActive,
        isLocked: editingUser.isLocked,
        forcePasswordChange: editingUser.forcePasswordChange,
        password: '',
        confirmPassword: '',
        branchId: editingUser.branchId || '',
        departmentId: editingUser.departmentId || '',
        employeeId: editingUser.employeeId || '',
        designation: editingUser.designation || '',
        avatarUrl: editingUser.avatarUrl || '',
        roleIds: editingUser.roles?.map(r => r.id) || [],
      }
    : { ...DEFAULT_FORM }

  const [form, setForm] = useState<UserForm>(getInitialForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')

  const filteredDepartments = useMemo(() => {
    if (!form.branchId) return departments
    return departments.filter(d => !d.branchId || d.branchId === form.branchId)
  }, [departments, form.branchId])

  const passwordStrength = getPasswordStrength(form.password)

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!form.name.trim()) errors.name = 'Full name is required'
    if (!form.email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email format'

    if (form.username && !/^[a-zA-Z0-9_.-]+$/.test(form.username)) {
      errors.username = 'Username can only contain letters, numbers, _, ., -'
    }

    if (!editingUser) {
      if (!form.password) errors.password = 'Password is required'
      else if (form.password.length < 8) errors.password = 'Minimum 8 characters'
      if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match'
    } else {
      if (form.password) {
        if (form.password.length < 8) errors.password = 'Minimum 8 characters'
        if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match'
      }
    }

    if (form.roleIds.length === 0) {
      errors.roleIds = 'At least one role must be assigned'
    }

    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      // Switch to the tab with errors
      if (errors.name || errors.email || errors.username || errors.phone || errors.password || errors.confirmPassword) {
        setActiveTab('basic')
      } else if (errors.branchId || errors.departmentId || errors.employeeId || errors.designation || errors.roleIds) {
        setActiveTab('organization')
      }
    }
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (validateForm()) {
      await onSave(form)
    }
  }

  const updateField = <K extends keyof UserForm>(key: K, value: UserForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: '' }))
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-semibold text-slate-900">
            {editingUser ? 'Edit User' : 'Add New User'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {editingUser ? 'Update user details and settings' : 'Create a new system user account'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 pt-2">
            <TabsList className="w-full h-9">
              <TabsTrigger value="basic" className="text-xs flex-1">Basic Info</TabsTrigger>
              <TabsTrigger value="organization" className="text-xs flex-1">Organization</TabsTrigger>
              <TabsTrigger value="security" className="text-xs flex-1">Security</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="max-h-[55vh]">
            {/* Basic Info Tab */}
            <TabsContent value="basic" className="px-6 py-4 mt-0 space-y-4">
              {/* Avatar Preview */}
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-slate-200">
                  <AvatarImage src={form.avatarUrl || undefined} />
                  <AvatarFallback className="bg-slate-100 text-slate-600 text-lg font-semibold">
                    {form.name ? getInitials(form.name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Label className="text-xs font-medium text-slate-700">Avatar URL</Label>
                  <Input
                    className="h-8 text-xs mt-1"
                    placeholder="https://example.com/avatar.jpg"
                    value={form.avatarUrl}
                    onChange={e => updateField('avatarUrl', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-slate-700">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    className={`h-9 text-sm ${formErrors.name ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                    placeholder="Enter full name"
                    value={form.name}
                    onChange={e => updateField('name', e.target.value)}
                    aria-label="Full name"
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    className={`h-9 text-sm ${formErrors.email ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                    placeholder="user@company.com"
                    value={form.email}
                    onChange={e => updateField('email', e.target.value)}
                    aria-label="Email address"
                  />
                  {formErrors.email && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {formErrors.email}
                    </p>
                  )}
                </div>

                {/* Username */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Username</Label>
                  <Input
                    className={`h-9 text-sm ${formErrors.username ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                    placeholder="Login username (optional)"
                    value={form.username}
                    onChange={e => updateField('username', e.target.value)}
                    aria-label="Username"
                  />
                  {formErrors.username && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {formErrors.username}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">Defaults to email if blank</p>
                </div>

                {/* Phone */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-slate-700">Phone</Label>
                  <Input
                    className="h-9 text-sm"
                    placeholder="+92-300-1234567"
                    value={form.phone}
                    onChange={e => updateField('phone', e.target.value)}
                    aria-label="Phone number"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-slate-700">
                    Password {!editingUser && <span className="text-red-500">*</span>}
                  </Label>
                  {editingUser && (
                    <p className="text-[10px] text-muted-foreground -mt-0.5 mb-1">Leave blank to keep current password</p>
                  )}
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      className={`h-9 text-sm pr-10 ${formErrors.password ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                      placeholder={editingUser ? 'Enter new password to change' : 'Minimum 8 characters'}
                      value={form.password}
                      onChange={e => updateField('password', e.target.value)}
                      aria-label="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {formErrors.password && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {formErrors.password}
                    </p>
                  )}
                  {/* Password Strength Meter */}
                  {form.password && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                            style={{ width: `${passwordStrength.score}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium ${
                          passwordStrength.score < 30 ? 'text-red-500' :
                          passwordStrength.score < 55 ? 'text-amber-500' :
                          'text-emerald-600'
                        }`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        <span className={form.password.length >= 8 ? 'text-emerald-600' : ''}>
                          {form.password.length >= 8 ? '✓' : '○'} 8+ chars
                        </span>
                        <span className={/[A-Z]/.test(form.password) ? 'text-emerald-600' : ''}>
                          {/[A-Z]/.test(form.password) ? '✓' : '○'} Uppercase
                        </span>
                        <span className={/[0-9]/.test(form.password) ? 'text-emerald-600' : ''}>
                          {/[0-9]/.test(form.password) ? '✓' : '○'} Number
                        </span>
                        <span className={/[^A-Za-z0-9]/.test(form.password) ? 'text-emerald-600' : ''}>
                          {/[^A-Za-z0-9]/.test(form.password) ? '✓' : '○'} Special
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                {(form.password || !editingUser) && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-slate-700">
                      Confirm Password {!editingUser && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      type="password"
                      className={`h-9 text-sm ${formErrors.confirmPassword ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                      placeholder="Re-enter password"
                      value={form.confirmPassword}
                      onChange={e => updateField('confirmPassword', e.target.value)}
                      aria-label="Confirm password"
                    />
                    {formErrors.confirmPassword && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {formErrors.confirmPassword}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Organization Tab */}
            <TabsContent value="organization" className="px-6 py-4 mt-0 space-y-4">
              {/* Assigned Roles */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Assigned Roles</Label>
                <ScrollArea className="h-32 w-full rounded-md border border-slate-200 bg-white">
                  <div className="p-3 space-y-3">
                    {roles.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No roles available</p>
                    ) : (
                      roles.map(role => (
                        <div key={role.id} className="flex items-start space-x-2">
                          <Checkbox
                            id={`role-${role.id}`}
                            checked={form.roleIds.includes(role.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                updateField('roleIds', [...form.roleIds, role.id])
                              } else {
                                updateField('roleIds', form.roleIds.filter(id => id !== role.id))
                              }
                            }}
                          />
                          <div className="space-y-0.5 leading-none">
                            <Label htmlFor={`role-${role.id}`} className="text-xs font-medium cursor-pointer">
                              {role.name} {role.isSystem && <Badge variant="secondary" className="ml-1 text-[9px] px-1 h-3">System</Badge>}
                            </Label>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                {formErrors.roleIds && <p className="text-[10px] text-red-500">{formErrors.roleIds}</p>}
                <p className="text-[10px] text-muted-foreground">Select one or more roles to grant access. A user must have at least one role.</p>
              </div>

              {/* Branch */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Branch</Label>
                <Select value={form.branchId || '__none__'} onValueChange={v => {
                  updateField('branchId', v === '__none__' ? '' : v)
                  updateField('departmentId', '')
                }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Branch</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Department</Label>
                <Select value={form.departmentId || '__none__'} onValueChange={v => updateField('departmentId', v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Department</SelectItem>
                    {filteredDepartments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee ID */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Employee ID</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="EMP-001"
                  value={form.employeeId}
                  onChange={e => updateField('employeeId', e.target.value)}
                  aria-label="Employee ID"
                />
              </div>

              {/* Designation */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Designation</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="e.g., Senior Accountant"
                  value={form.designation}
                  onChange={e => updateField('designation', e.target.value)}
                  aria-label="Designation"
                />
              </div>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="px-6 py-4 mt-0 space-y-4">
              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium text-slate-700">Account Status</Label>
                  <p className="text-xs text-muted-foreground">
                    {form.isActive ? 'User can log in and access the system' : 'User is deactivated and cannot log in'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={form.isActive ? 'default' : 'secondary'} className={`text-[10px] ${form.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                    {form.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={v => updateField('isActive', v)}
                    aria-label="Toggle account active"
                  />
                </div>
              </div>

              {/* Force Password Change */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium text-slate-700">Force Password Change</Label>
                  <p className="text-xs text-muted-foreground">User must change password on next login</p>
                </div>
                <Switch
                  checked={form.forcePasswordChange}
                  onCheckedChange={v => updateField('forcePasswordChange', v)}
                  aria-label="Force password change"
                />
              </div>

              {/* Lock/Unlock Account (only for editing) */}
              {editingUser && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium text-slate-700">Account Lock</Label>
                    <p className="text-xs text-muted-foreground">
                      {form.isLocked ? 'Account is currently locked' : 'Account is not locked'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={form.isLocked ? 'destructive' : 'secondary'} className="text-[10px]">
                      {form.isLocked ? 'Locked' : 'Unlocked'}
                    </Badge>
                    <Switch
                      checked={form.isLocked}
                      onCheckedChange={v => updateField('isLocked', v)}
                      aria-label="Toggle account lock"
                    />
                  </div>
                </div>
              )}

              {/* Security Info (only for editing) */}
              {editingUser && (
                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-medium text-slate-700">Security Information</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="text-muted-foreground">Failed Login Attempts</div>
                    <div className="font-medium text-slate-700">{editingUser.failedLoginAttempts}</div>
                    <div className="text-muted-foreground">Last Login</div>
                    <div className="font-medium text-slate-700">{formatDateTime(editingUser.lastLoginAt)}</div>
                    <div className="text-muted-foreground">Last Login IP</div>
                    <div className="font-medium text-slate-700">{editingUser.lastLoginIp || '—'}</div>
                    <div className="text-muted-foreground">Password Changed</div>
                    <div className="font-medium text-slate-700">{formatDate(editingUser.passwordChangedAt)}</div>
                    {editingUser.passwordExpiresAt && (
                      <>
                        <div className="text-muted-foreground">Password Expires</div>
                        <div className="font-medium text-slate-700">{formatDate(editingUser.passwordExpiresAt)}</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="px-6 pb-6 pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="h-9 text-sm">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-slate-900 text-white hover:bg-slate-800 h-9 text-sm min-w-[110px]"
          >
            {saving ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</>
            ) : editingUser ? 'Save Changes' : 'Add User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// User Detail Panel (Sheet)
// ============================================================

function UserDetailPanel({
  user, open, onClose, onEdit, onAction,
}: {
  user: UserRecord | null
  open: boolean
  onClose: () => void
  onEdit: (user: UserRecord) => void
  onAction: (action: string, user: UserRecord) => void
}) {
  const [activeTab, setActiveTab] = useState('profile')
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [availableRoles, setAvailableRoles] = useState<RoleOption[]>([])

  useEffect(() => {
    if (open && user) {
      setActiveTab('profile')
      loadDetailData()
    }
  }, [open, user?.id])

  const loadDetailData = async () => {
    if (!user) return
    setLoadingDetail(true)
    try {
      const [rolesRes, sessionsRes, historyRes, auditRes, allRolesRes] = await Promise.allSettled([
        fetch(`/api/user-roles?userId=${user.id}`),
        fetch(`/api/sessions?userId=${user.id}`),
        fetch(`/api/login-history?userId=${user.id}&limit=20`),
        fetch(`/api/audit?userId=${user.id}&limit=20`),
        fetch('/api/roles'),
      ])

      if (rolesRes.status === 'fulfilled' && rolesRes.value.ok) {
        const json = await rolesRes.value.json()
        const data = json.success ? json.data : (Array.isArray(json) ? json : [])
        setUserRoles(Array.isArray(data) ? data : [])
      }
      if (sessionsRes.status === 'fulfilled' && sessionsRes.value.ok) {
        const json = await sessionsRes.value.json()
        const data = json.success ? json.data : (Array.isArray(json) ? json : [])
        setSessions(Array.isArray(data) ? data : [])
      }
      if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
        const json = await historyRes.value.json()
        const data = json.success ? json.data : (json.data || (Array.isArray(json) ? json : []))
        setLoginHistory(Array.isArray(data) ? data : [])
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const json = await auditRes.value.json()
        const data = json.success ? json.data : (Array.isArray(json) ? json : [])
        setAuditLogs(Array.isArray(data) ? data : [])
      }
      if (allRolesRes.status === 'fulfilled' && allRolesRes.value.ok) {
        const json = await allRolesRes.value.json()
        const data = json.success ? json.data : (Array.isArray(json) ? json : [])
        setAvailableRoles(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading detail data:', err)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleRemoveRole = async (roleId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/user-roles?userId=${user.id}&roleId=${roleId}`, { method: 'DELETE' })
      if (res.ok) {
        setUserRoles(prev => prev.filter(ur => ur.roleId !== roleId))
      }
    } catch { /* ignore */ }
  }

  const handleAssignRole = async (roleId: string) => {
    if (!user) return
    try {
      const res = await fetch('/api/user-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, roleId }),
      })
      if (res.ok) {
        await loadDetailData()
      }
    } catch { /* ignore */ }
  }

  const handleTerminateSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions?sessionId=${sessionId}`, { method: 'DELETE' })
      if (res.ok) {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isActive: false } : s))
      }
    } catch { /* ignore */ }
  }

  if (!user) return null

  const assignedRoleIds = userRoles.map(ur => ur.roleId)
  const unassignedRoles = availableRoles.filter(r => !assignedRoleIds.includes(r.id))

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-slate-200">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="bg-slate-100 text-slate-600 text-lg font-semibold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold text-slate-900 truncate">{user.name}</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground truncate">{user.email}</SheetDescription>
              <div className="flex items-center gap-2 mt-1.5">
                {getRoleBadge(user)}
                {getStatusIndicator(user)}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onEdit(user)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Actions <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {user.isLocked ? (
                  <DropdownMenuItem onClick={() => onAction('unlock', user)}>
                    <Unlock className="h-4 w-4 mr-2" /> Unlock Account
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onAction('lock', user)}>
                    <Lock className="h-4 w-4 mr-2" /> Lock Account
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onAction('reset-password', user)}>
                  <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction('force-password-change', user)}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Force Password Change
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction('impersonate', user)}>
                  <ArrowUpRight className="h-4 w-4 mr-2" /> Impersonate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user.isActive ? (
                  <DropdownMenuItem onClick={() => onAction('deactivate', user)} className="text-amber-600">
                    <UserX className="h-4 w-4 mr-2" /> Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onAction('activate', user)} className="text-emerald-600">
                    <UserCheck className="h-4 w-4 mr-2" /> Activate
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onAction('delete', user)} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 pt-2 border-b border-slate-100">
            <TabsList className="h-9 w-full">
              <TabsTrigger value="profile" className="text-[11px] flex-1">Profile</TabsTrigger>
              <TabsTrigger value="roles" className="text-[11px] flex-1">Roles</TabsTrigger>
              <TabsTrigger value="sessions" className="text-[11px] flex-1">Sessions</TabsTrigger>
              <TabsTrigger value="login-history" className="text-[11px] flex-1">Logins</TabsTrigger>
              <TabsTrigger value="activity" className="text-[11px] flex-1">Activity</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            {/* Profile Tab */}
            <TabsContent value="profile" className="p-6 mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <DetailField label="Full Name" value={user.name} />
                <DetailField label="Email" value={user.email} />
                <DetailField label="Username" value={user.username || '—'} />
                <DetailField label="Phone" value={user.phone || '—'} />
                <DetailField label="Employee ID" value={user.employeeId || '—'} />
                <DetailField label="Designation" value={user.designation || '—'} />
                <DetailField label="Branch" value={user.branch?.name || '—'} />
                <DetailField label="Department" value={user.department?.name || '—'} />
                <DetailField label="Last Login" value={formatDateTime(user.lastLoginAt)} />
                <DetailField label="Last Login IP" value={user.lastLoginIp || '—'} />
                <DetailField label="Password Changed" value={formatDate(user.passwordChangedAt)} />
                <DetailField label="Force Password Change" value={user.forcePasswordChange ? 'Yes' : 'No'} />
                <DetailField label="Created" value={formatDate(user.createdAt)} />
                <DetailField label="Updated" value={formatDate(user.updatedAt)} />
                {user.passwordExpiresAt && (
                  <DetailField label="Password Expires" value={formatDate(user.passwordExpiresAt)} />
                )}
              </div>
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles" className="p-6 mt-0 space-y-4">
              {loadingDetail ? (
                <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <>
                  {userRoles.length > 0 ? (
                    <div className="space-y-2">
                      {userRoles.map(ur => (
                        <div key={ur.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-3">
                            <Shield className="h-4 w-4 text-slate-500" />
                            <div>
                              <p className="text-sm font-medium text-slate-900">{ur.role.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {ur.role.code} • Level {ur.role.level}
                                {ur.isPrimary && ' • Primary'}
                                {ur.expiresAt && ` • Expires: ${formatDate(ur.expiresAt)}`}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveRole(ur.roleId)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Shield className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No RBAC roles assigned</p>
                      <p className="text-xs text-muted-foreground">Legacy role: {user.role}</p>
                    </div>
                  )}
                  {unassignedRoles.length > 0 && (
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs font-medium text-slate-700 mb-2">Assign New Role</p>
                      <div className="flex flex-wrap gap-2">
                        {unassignedRoles.map(r => (
                          <Button
                            key={r.id}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAssignRole(r.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" /> {r.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Sessions Tab */}
            <TabsContent value="sessions" className="p-6 mt-0 space-y-3">
              {loadingDetail ? (
                <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : sessions.length > 0 ? (
                sessions.map(s => (
                  <div key={s.id} className={`p-3 rounded-lg border ${s.isActive ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/30 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Monitor className="h-4 w-4 text-slate-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {s.deviceInfo?.browser || 'Unknown Browser'}
                            {s.deviceInfo?.os && ` • ${s.deviceInfo.os}`}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                            {s.ipAddress && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" /> {s.ipAddress}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Last active: {timeAgo(s.lastActivityAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {s.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleTerminateSession(s.id)}
                        >
                          Terminate
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Monitor className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No active sessions</p>
                </div>
              )}
            </TabsContent>

            {/* Login History Tab */}
            <TabsContent value="login-history" className="p-6 mt-0 space-y-2">
              {loadingDetail ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : Array.isArray(loginHistory) && loginHistory.length > 0 ? (
                loginHistory.map((lh: any) => (
                  <div key={lh.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      lh.loginStatus === 'success' ? 'bg-emerald-50' : 'bg-red-50'
                    }`}>
                      {lh.loginStatus === 'success' ? (
                        <LogIn className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${lh.loginStatus === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {lh.loginStatus === 'success' ? 'Success' : 'Failed'}
                        </span>
                        {lh.failureReason && (
                          <span className="text-[10px] text-muted-foreground">({lh.failureReason})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                        {lh.ipAddress && <span>{lh.ipAddress}</span>}
                        {lh.browser && <span>{lh.browser}</span>}
                        {lh.os && <span>{lh.os}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(lh.createdAt)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No login history</p>
                </div>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="p-6 mt-0 space-y-2">
              {loadingDetail ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : auditLogs.length > 0 ? (
                auditLogs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      log.severity === 'critical' ? 'bg-red-50' :
                      log.severity === 'warning' ? 'bg-amber-50' :
                      'bg-slate-50'
                    }`}>
                      <Activity className={`h-4 w-4 ${
                        log.severity === 'critical' ? 'text-red-500' :
                        log.severity === 'warning' ? 'text-amber-500' :
                        'text-slate-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {log.action} • {log.entity}
                        {log.entityName && ` • ${log.entityName}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {log.module && `${log.module} • `}
                        {log.user?.name || 'System'}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(log.createdAt)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm text-slate-900 mt-0.5 truncate" title={value}>{value}</p>
    </div>
  )
}

// ============================================================
// Confirmation Dialog
// ============================================================

function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel, variant, loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel: string
  variant: 'destructive' | 'warning' | 'default'
  loading?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
              variant === 'destructive' ? 'bg-red-50' :
              variant === 'warning' ? 'bg-amber-50' :
              'bg-slate-50'
            }`}>
              {variant === 'destructive' ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : variant === 'warning' ? (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-slate-600" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900">{title}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="h-9 text-sm">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            className={`h-9 text-sm ${
              variant === 'destructive' ? 'bg-red-600 text-white hover:bg-red-700' :
              variant === 'warning' ? 'bg-amber-600 text-white hover:bg-amber-700' :
              'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Reset Password Dialog
// ============================================================

function ResetPasswordDialog({
  open, onClose, onConfirm, userName, loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (password: string) => void
  userName: string
  loading?: boolean
}) {
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const strength = getPasswordStrength(newPassword)

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-slate-900">Reset Password</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Set a new temporary password for <span className="font-semibold text-slate-700">{userName}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700">New Temporary Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                className="h-9 text-sm pr-10"
                placeholder="Enter new temporary password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                aria-label="New temporary password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{strength.label}</span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="h-9 text-sm">Cancel</Button>
          <Button
            size="sm"
            onClick={() => onConfirm(newPassword)}
            disabled={loading || !newPassword || newPassword.length < 8}
            className="bg-slate-900 text-white hover:bg-slate-800 h-9 text-sm"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Reset Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Main Component
// ============================================================

export function UserManagement() {
  const { toast } = useToast()
  const { authUser } = useAppStore()
  const currentUser = authUser || { role: 'viewer', id: '', name: '' }
  const isAdmin = hasPermission(authUser, 'USERS_EDIT')

  // Data state
  const [users, setUsers] = useState<UserRecord[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [saving, setSaving] = useState(false)

  // Detail panel
  const [detailUser, setDetailUser] = useState<UserRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    confirmLabel: string
    variant: 'destructive' | 'warning' | 'default'
    onConfirm: () => void
  }>({ open: false, title: '', description: '', confirmLabel: '', variant: 'default', onConfirm: () => {} })
  const [actionLoading, setActionLoading] = useState(false)

  // Reset password dialog
  const [resetPasswordUser, setResetPasswordUser] = useState<UserRecord | null>(null)
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const json = await res.json()
        const data = json.success ? json.data : (Array.isArray(json) ? json : [])
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' })
    }
  }, [toast])

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch('/api/branches')
      if (res.ok) {
        const json = await res.json()
        const data = json.success ? json.data : (Array.isArray(json) ? json : [])
        setBranches(Array.isArray(data) ? data : [])
      }
    } catch { /* ignore */ }
  }, [])

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/departments')
      if (res.ok) {
        const json = await res.json()
        const data = json.success ? json.data : (Array.isArray(json) ? json : [])
        setDepartments(Array.isArray(data) ? data : [])
      }
    } catch { /* ignore */ }
  }, [])

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles')
      if (res.ok) {
        const json = await res.json()
        const data = json.success ? json.data : (Array.isArray(json) ? json : [])
        setRoles(Array.isArray(data) ? data : [])
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchUsers(), fetchBranches(), fetchDepartments(), fetchRoles()])
      setLoading(false)
    }
    init()
  }, [fetchUsers, fetchBranches, fetchDepartments, fetchRoles])

  // ============================================================
  // Filtered Users
  // ============================================================

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        !searchQuery ||
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        (user.username && user.username.toLowerCase().includes(q))

      const matchesRole = roleFilter === 'all' || user.role === roleFilter

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.isActive && !user.isLocked) ||
        (statusFilter === 'inactive' && !user.isActive) ||
        (statusFilter === 'locked' && user.isLocked)

      const matchesBranch = branchFilter === 'all' || user.branchId === branchFilter
      const matchesDepartment = departmentFilter === 'all' || user.departmentId === departmentFilter

      return matchesSearch && matchesRole && matchesStatus && matchesBranch && matchesDepartment
    })
  }, [users, searchQuery, roleFilter, statusFilter, branchFilter, departmentFilter])

  // ============================================================
  // KPI Data
  // ============================================================

  const kpiUsers = useMemo(() => users, [users])

  // ============================================================
  // Selection Handlers
  // ============================================================

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)))
    }
  }

  // ============================================================
  // Bulk Actions
  // ============================================================

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return
    const count = selectedIds.size

    setConfirmDialog({
      open: true,
      title: `Bulk ${action}`,
      description: `Are you sure you want to ${action} ${count} user${count > 1 ? 's' : ''}?`,
      confirmLabel: `Yes, ${action}`,
      variant: action === 'delete' ? 'destructive' : 'warning',
      onConfirm: async () => {
        setActionLoading(true)
        try {
          const promises = Array.from(selectedIds).map(id => {
            if (action === 'deactivate') {
              return fetch(`/api/users/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deactivate: true }),
              })
            } else if (action === 'activate') {
              return fetch(`/api/users/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activate: true }),
              })
            } else if (action === 'delete') {
              return fetch(`/api/users/${id}`, { method: 'DELETE' })
            }
            return Promise.resolve()
          })
          await Promise.all(promises)
          setSelectedIds(new Set())
          await fetchUsers()
          toast({ title: 'Success', description: `Bulk ${action} completed for ${count} users` })
        } catch {
          toast({ title: 'Error', description: 'Bulk action failed', variant: 'destructive' })
        } finally {
          setActionLoading(false)
          setConfirmDialog(prev => ({ ...prev, open: false }))
        }
      },
    })
  }

  // ============================================================
  // Save Handler (Add/Edit)
  // ============================================================

  const executeSave = async (form: UserForm) => {
    setSaving(true)
    try {
      if (editingUser) {
        const payload: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          username: form.username || null,
          phone: form.phone || null,
          role: form.role,
          roleIds: form.roleIds,
          forcePasswordChange: form.forcePasswordChange,
          branchId: form.branchId || null,
          departmentId: form.departmentId || null,
          employeeId: form.employeeId || null,
          designation: form.designation || null,
          avatarUrl: form.avatarUrl || null,
        }
        // Handle active/inactive state
        if (form.isActive && !editingUser.isActive) payload.activate = true
        else if (!form.isActive && editingUser.isActive) payload.deactivate = true
        // Handle lock/unlock state
        if (form.isLocked && !editingUser.isLocked) payload.lock = true
        else if (!form.isLocked && editingUser.isLocked) payload.unlock = true
        // Handle password reset
        if (form.password) {
          payload.resetPassword = true
          payload.newPassword = form.password
        }

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          toast({ title: 'User Updated', description: `${form.name} updated successfully` })
          setModalOpen(false)
          await fetchUsers()
          // Update detail panel if open
          if (detailUser?.id === editingUser.id) {
            const json = await res.json()
            const updatedUser = json.success ? json.data : json
            setDetailUser(prev => prev ? { ...prev, ...updatedUser } : null)
          }
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.error || 'Failed to update user', variant: 'destructive' })
        }
      } else {
        const payload = {
          name: form.name,
          email: form.email,
          username: form.username || null,
          phone: form.phone || null,
          role: form.role,
          roleIds: form.roleIds,
          isActive: form.isActive,
          password: form.password,
          forcePasswordChange: form.forcePasswordChange,
          branchId: form.branchId || null,
          departmentId: form.departmentId || null,
          employeeId: form.employeeId || null,
          designation: form.designation || null,
          avatarUrl: form.avatarUrl || null,
        }

        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          toast({ title: 'User Created', description: `${form.name} added successfully` })
          setModalOpen(false)
          await fetchUsers()
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.error || 'Failed to create user', variant: 'destructive' })
        }
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (form: UserForm) => {
    // Check if permissions are being reduced
    if (editingUser && editingUser.roles) {
      const oldRoleIds = editingUser.roles.map(r => r.id)
      const removedRoles = oldRoleIds.filter(id => !form.roleIds.includes(id))
      
      if (removedRoles.length > 0) {
        const removedRoleNames = removedRoles.map(id => roles.find(r => r.id === id)?.name).filter(Boolean)
        setConfirmDialog({
          open: true,
          title: 'Confirm Role Reduction',
          description: `Warning: You are removing the following roles: ${removedRoleNames.join(', ')}. This user will lose access to modules governed by these roles. Proceed?`,
          confirmLabel: 'Yes, reduce access',
          variant: 'warning',
          onConfirm: async () => {
            setConfirmDialog(prev => ({ ...prev, open: false }))
            await executeSave(form)
          }
        })
        return
      }
    }
    
    await executeSave(form)
  }

  // ============================================================
  // User Actions
  // ============================================================

  const handleUserAction = (action: string, user: UserRecord) => {
    switch (action) {
      case 'edit':
        setEditingUser(user)
        setModalOpen(true)
        break

      case 'delete':
        setConfirmDialog({
          open: true,
          title: 'Delete User?',
          description: `This will permanently remove ${user.name} from the system. This action cannot be undone.`,
          confirmLabel: 'Delete User',
          variant: 'destructive',
          onConfirm: async () => {
            setActionLoading(true)
            try {
              const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
              if (res.ok) {
                toast({ title: 'User Deleted', description: `${user.name} has been removed` })
                await fetchUsers()
                if (detailUser?.id === user.id) setDetailOpen(false)
              } else {
                toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' })
              }
            } catch {
              toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
            } finally {
              setActionLoading(false)
              setConfirmDialog(prev => ({ ...prev, open: false }))
            }
          },
        })
        break

      case 'activate':
        setConfirmDialog({
          open: true,
          title: 'Activate User?',
          description: `This will re-enable ${user.name}'s account. They will be able to log in again.`,
          confirmLabel: 'Activate',
          variant: 'default',
          onConfirm: async () => {
            setActionLoading(true)
            try {
              const res = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activate: true }),
              })
              if (res.ok) {
                toast({ title: 'User Activated', description: `${user.name} has been activated` })
                await fetchUsers()
              } else {
                toast({ title: 'Error', description: 'Failed to activate user', variant: 'destructive' })
              }
            } catch {
              toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
            } finally {
              setActionLoading(false)
              setConfirmDialog(prev => ({ ...prev, open: false }))
            }
          },
        })
        break

      case 'deactivate':
        setConfirmDialog({
          open: true,
          title: 'Deactivate User?',
          description: `${user.name} will lose all system access. They will not be able to log in.`,
          confirmLabel: 'Deactivate',
          variant: 'warning',
          onConfirm: async () => {
            setActionLoading(true)
            try {
              const res = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deactivate: true }),
              })
              if (res.ok) {
                toast({ title: 'User Deactivated', description: `${user.name} has been deactivated` })
                await fetchUsers()
              } else {
                toast({ title: 'Error', description: 'Failed to deactivate user', variant: 'destructive' })
              }
            } catch {
              toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
            } finally {
              setActionLoading(false)
              setConfirmDialog(prev => ({ ...prev, open: false }))
            }
          },
        })
        break

      case 'lock':
        setConfirmDialog({
          open: true,
          title: 'Lock Account?',
          description: `${user.name}'s account will be locked immediately. They will not be able to log in until an admin unlocks it.`,
          confirmLabel: 'Lock Account',
          variant: 'warning',
          onConfirm: async () => {
            setActionLoading(true)
            try {
              const res = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lock: true }),
              })
              if (res.ok) {
                toast({ title: 'Account Locked', description: `${user.name}'s account has been locked` })
                await fetchUsers()
              } else {
                toast({ title: 'Error', description: 'Failed to lock account', variant: 'destructive' })
              }
            } catch {
              toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
            } finally {
              setActionLoading(false)
              setConfirmDialog(prev => ({ ...prev, open: false }))
            }
          },
        })
        break

      case 'unlock':
        setConfirmDialog({
          open: true,
          title: 'Unlock Account?',
          description: `${user.name}'s account will be unlocked. They will be able to log in again.`,
          confirmLabel: 'Unlock',
          variant: 'default',
          onConfirm: async () => {
            setActionLoading(true)
            try {
              const res = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unlock: true }),
              })
              if (res.ok) {
                toast({ title: 'Account Unlocked', description: `${user.name}'s account has been unlocked` })
                await fetchUsers()
              } else {
                toast({ title: 'Error', description: 'Failed to unlock account', variant: 'destructive' })
              }
            } catch {
              toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
            } finally {
              setActionLoading(false)
              setConfirmDialog(prev => ({ ...prev, open: false }))
            }
          },
        })
        break

      case 'reset-password':
        setResetPasswordUser(user)
        setResetPasswordOpen(true)
        break

      case 'force-password-change':
        setConfirmDialog({
          open: true,
          title: 'Force Password Change?',
          description: `${user.name} will be required to change their password on next login.`,
          confirmLabel: 'Force Change',
          variant: 'default',
          onConfirm: async () => {
            setActionLoading(true)
            try {
              const res = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ forcePasswordChange: true }),
              })
              if (res.ok) {
                toast({ title: 'Password Change Required', description: `${user.name} must change password on next login` })
                await fetchUsers()
              } else {
                toast({ title: 'Error', description: 'Failed to set force password change', variant: 'destructive' })
              }
            } catch {
              toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
            } finally {
              setActionLoading(false)
              setConfirmDialog(prev => ({ ...prev, open: false }))
            }
          },
        })
        break

      case 'impersonate':
        setConfirmDialog({
          open: true,
          title: 'Impersonate User?',
          description: `You will be logged in as ${user.name}. This action will be logged for audit purposes.`,
          confirmLabel: 'Impersonate',
          variant: 'warning',
          onConfirm: () => {
            toast({ title: 'Impersonation Logged', description: `Admin impersonated ${user.name} (action logged)` })
            setConfirmDialog(prev => ({ ...prev, open: false }))
          },
        })
        break
    }
  }

  const handleResetPassword = async (newPassword: string) => {
    if (!resetPasswordUser) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/users/${resetPasswordUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPassword: true, newPassword, forcePasswordChange: true }),
      })
      if (res.ok) {
        toast({ title: 'Password Reset', description: `Password for ${resetPasswordUser.name} has been reset` })
        setResetPasswordOpen(false)
        await fetchUsers()
      } else {
        toast({ title: 'Error', description: 'Failed to reset password', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  // ============================================================
  // Clear Filters
  // ============================================================

  const clearFilters = () => {
    setSearchQuery('')
    setRoleFilter('all')
    setStatusFilter('all')
    setBranchFilter('all')
    setDepartmentFilter('all')
  }

  const hasActiveFilters = searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || branchFilter !== 'all' || departmentFilter !== 'all'

  // ============================================================
  // Render: Loading State
  // ============================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <KPICards users={[]} loading={true} />
        <Card className="border border-slate-200 rounded-xl">
          <div className="p-4 space-y-4">
            <div className="flex gap-3">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-[130px]" />
              <Skeleton className="h-9 w-[110px]" />
            </div>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </Card>
      </div>
    )
  }

  // ============================================================
  // Render: Main
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage system users, roles, and access control</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => { setEditingUser(null); setModalOpen(true) }}
            className="bg-slate-900 text-white rounded-lg hover:bg-slate-800 h-9 text-sm shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add User
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <KPICards users={kpiUsers} loading={false} />

      {/* Users Table Card */}
      <Card className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, or username…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
                aria-label="Search users"
              />
            </div>

            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Branch Filter */}
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Department Filter */}
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results Count & Bulk Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-slate-700">{filteredUsers.length}</span> of{' '}
                <span className="font-medium text-slate-700">{users.length}</span> users
              </p>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={clearFilters}>
                  <X className="h-3 w-3 mr-1" /> Clear filters
                </Button>
              )}
            </div>
            {/* Bulk Actions */}
            {isAdmin && selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">{selectedIds.size} selected</span>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleBulkAction('activate')}>
                  <UserCheck className="h-3 w-3 mr-1" /> Activate
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleBulkAction('deactivate')}>
                  <UserX className="h-3 w-3 mr-1" /> Deactivate
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleBulkAction('delete')}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {isAdmin && (
                  <th className="text-left px-4 py-3 w-10">
                    <Checkbox
                      checked={selectedIds.size > 0 && selectedIds.size === filteredUsers.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all users"
                    />
                  </th>
                )}
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">User</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden md:table-cell">Username</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden lg:table-cell">Branch</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden lg:table-cell">Department</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden xl:table-cell">Last Login</th>
                {isAdmin && (
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">No users found</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Try adjusting your search or filter criteria
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="h-8 text-xs mt-1" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr
                    key={user.id}
                    className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer ${
                      !user.isActive && !user.isLocked ? 'opacity-60' : ''
                    } ${selectedIds.has(user.id) ? 'bg-slate-50' : ''}`}
                    onClick={() => { setDetailUser(user); setDetailOpen(true) }}
                    role="row"
                  >
                    {/* Checkbox */}
                    {isAdmin && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(user.id)}
                          onCheckedChange={() => toggleSelect(user.id)}
                          aria-label={`Select ${user.name}`}
                        />
                      </td>
                    )}

                    {/* User (Avatar + Name + Email) */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-slate-200">
                          <AvatarImage src={user.avatarUrl || undefined} />
                          <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-semibold">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Username */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-slate-600">{user.username || '—'}</span>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">{getRoleBadge(user)}</td>

                    {/* Branch */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-slate-600">{user.branch?.name || '—'}</span>
                    </td>

                    {/* Department */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-slate-600">{user.department?.name || '—'}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">{getStatusIndicator(user)}</td>

                    {/* Last Login */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-slate-500">{timeAgo(user.lastLoginAt)}</span>
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleUserAction('edit', user)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setDetailUser(user); setDetailOpen(true) }}>
                              <Eye className="h-4 w-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.isLocked ? (
                              <DropdownMenuItem onClick={() => handleUserAction('unlock', user)}>
                                <Unlock className="h-4 w-4 mr-2" /> Unlock Account
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleUserAction('lock', user)}>
                                <Lock className="h-4 w-4 mr-2" /> Lock Account
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleUserAction('reset-password', user)}>
                              <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUserAction('force-password-change', user)}>
                              <RefreshCw className="h-4 w-4 mr-2" /> Force Password Change
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.isActive ? (
                              <DropdownMenuItem onClick={() => handleUserAction('deactivate', user)} className="text-amber-600">
                                <UserX className="h-4 w-4 mr-2" /> Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleUserAction('activate', user)} className="text-emerald-600">
                                <UserCheck className="h-4 w-4 mr-2" /> Activate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleUserAction('impersonate', user)}>
                              <ArrowUpRight className="h-4 w-4 mr-2" /> Impersonate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleUserAction('delete', user)} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" /> Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit User Modal */}
      <UserFormModal
        key={editingUser?.id || 'new'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingUser(null) }}
        editingUser={editingUser}
        onSave={handleSave}
        saving={saving}
        branches={branches}
        departments={departments}
        roles={roles}
      />

      {/* User Detail Panel */}
      <UserDetailPanel
        user={detailUser}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailUser(null) }}
        onEdit={user => { setDetailOpen(false); handleUserAction('edit', user) }}
        onAction={(action, user) => { setDetailOpen(false); handleUserAction(action, user) }}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        loading={actionLoading}
      />

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        key={resetPasswordUser?.id || 'none'}
        open={resetPasswordOpen}
        onClose={() => { setResetPasswordOpen(false); setResetPasswordUser(null) }}
        onConfirm={handleResetPassword}
        userName={resetPasswordUser?.name || ''}
        loading={actionLoading}
      />
    </div>
  )
}
