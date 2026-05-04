// ROLE GUARD RULES:
// - Only `admin` can see the "+ Add User" button
// - Only `admin` can see the Actions column (edit/delete)
// - Only `admin` can change a user's role via the modal dropdown
// - Non-admin roles see the table in read-only mode
// - On the backend: enforce these same checks via middleware on:
//     POST   /api/users         → admin only
//     PATCH  /api/users/:id     → admin only
//     DELETE /api/users/:id     → admin only
//     GET    /api/users         → all authenticated roles

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, Plus, Pencil, Trash2, Shield, Check, X, Eye, EyeOff, AlertCircle, Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'

// ============================================================
// Types
// ============================================================

interface UserRecord {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLogin: string | null
  auditCount: number
  actionCount: number
}

interface UserForm {
  name: string
  email: string
  role: string
  isActive: boolean
  password: string
}

// ============================================================
// Auth Context — reads from Zustand store (set by LoginPage)
// Falls back to admin for development
// ============================================================

function useCurrentUser() {
  const { authUser } = useAppStore()
  return authUser
    ? { id: authUser.id, name: authUser.name, role: authUser.role }
    : { id: '1', name: 'Fahad Hussain', role: 'admin' } // Fallback for development
}

// ============================================================
// Helpers
// ============================================================

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'viewer', label: 'Viewer' },
]

function getRoleBadge(role: string) {
  switch (role) {
    case 'admin':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-900 text-white">Admin</span>
    case 'manager':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">Manager</span>
    case 'accountant':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Accountant</span>
    case 'auditor':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Auditor</span>
    case 'viewer':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Viewer</span>
    default:
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">{role}</span>
  }
}

// ============================================================
// Permission Matrix Data
// ============================================================

const PERMISSION_MATRIX = [
  { action: 'Create Vouchers', admin: true, manager: true, accountant: true, auditor: false, viewer: false },
  { action: 'Approve Vouchers', admin: true, manager: true, accountant: false, auditor: false, viewer: false },
  { action: 'Manage Users', admin: true, manager: false, accountant: false, auditor: false, viewer: false },
  { action: 'View Reports', admin: true, manager: true, accountant: true, auditor: true, viewer: true },
  { action: 'System Settings', admin: true, manager: false, accountant: false, auditor: true, viewer: false },
]

// ============================================================
// Main Component
// ============================================================

export function UserManagement() {
  const { toast } = useToast()
  const currentUser = useCurrentUser()
  const isAdmin = currentUser.role === 'admin'

  // Data state
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null)

  // Form state
  const [form, setForm] = useState<UserForm>({
    name: '',
    email: '',
    role: 'viewer',
    isActive: true,
    password: '',
  })

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchUsers()
      setLoading(false)
    }
    init()
  }, [fetchUsers])

  // ============================================================
  // Filtered Users
  // ============================================================

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      !searchQuery ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = roleFilter === 'all' || user.role === roleFilter

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && user.isActive) ||
      (statusFilter === 'inactive' && !user.isActive)

    return matchesSearch && matchesRole && matchesStatus
  })

  // ============================================================
  // Modal Handlers
  // ============================================================

  const openAddModal = () => {
    setEditingUser(null)
    setForm({ name: '', email: '', role: 'viewer', isActive: true, password: '' })
    setFormErrors({})
    setShowPassword(false)
    setModalOpen(true)
  }

  const openEditModal = (user: UserRecord) => {
    setEditingUser(user)
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      password: '',
    })
    setFormErrors({})
    setShowPassword(false)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingUser(null)
    setFormErrors({})
  }

  const openDeleteDialog = (user: UserRecord) => {
    setDeletingUser(user)
    setDeleteDialogOpen(true)
  }

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setDeletingUser(null)
  }

  // ============================================================
  // Validation
  // ============================================================

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!form.name.trim()) {
      errors.name = 'Full name is required'
    }

    if (!form.email.trim()) {
      errors.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!editingUser) {
      // New user: password is required
      if (!form.password) {
        errors.password = 'Password is required'
      } else if (form.password.length < 8) {
        errors.password = 'Password must be at least 8 characters'
      }
    } else {
      // Edit user: password is optional, but if provided must be at least 8 chars
      if (form.password && form.password.length < 8) {
        errors.password = 'Password must be at least 8 characters'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ============================================================
  // Save Handler
  // ============================================================

  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)
    try {
      if (editingUser) {
        // Edit mode: PUT /api/users/[id]
        const payload: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
        }

        // Include password hash only if a new password was entered
        if (form.password) {
          payload.passwordHash = await hashPassword(form.password)
        }

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const updatedUser = await res.json()
          setUsers(prev => prev.map(u => (u.id === editingUser.id ? { ...u, ...updatedUser } : u)))
          toast({ title: 'User Updated', description: `${form.name} updated successfully` })
          closeModal()
        } else {
          const data = await res.json()
          toast({ title: 'Error', description: data.error || 'Failed to update user', variant: 'destructive' })
        }
      } else {
        // Add mode: POST /api/users
        const passwordHash = await hashPassword(form.password)
        const payload = {
          name: form.name,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
          passwordHash,
        }

        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const newUser = await res.json()
          setUsers(prev => [newUser, ...prev])
          toast({ title: 'User Created', description: `${form.name} added successfully` })
          closeModal()
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

  // ============================================================
  // Delete Handler
  // ============================================================

  const handleDelete = async () => {
    if (!deletingUser) return

    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          // Soft-deleted (deactivated)
          setUsers(prev => prev.map(u => (u.id === deletingUser.id ? { ...u, isActive: false } : u)))
          toast({
            title: 'User Deactivated',
            description: `${deletingUser.name} deactivated (has existing references)`,
          })
        } else {
          // Hard-deleted
          setUsers(prev => prev.filter(u => u.id !== deletingUser.id))
          toast({ title: 'User Removed', description: `${deletingUser.name} deleted successfully` })
        }
        closeDeleteDialog()
      } else {
        toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    }
  }

  // ============================================================
  // Clear Filters
  // ============================================================

  const clearFilters = () => {
    setSearchQuery('')
    setRoleFilter('all')
    setStatusFilter('all')
  }

  // ============================================================
  // Render: Loading State
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Loading users...</span>
        </div>
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
          <p className="text-sm text-muted-foreground mt-1">Manage system users and access roles</p>
        </div>
        {isAdmin && (
          <Button
            onClick={openAddModal}
            className="bg-slate-900 text-white rounded-lg hover:bg-slate-800 h-9 text-sm shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add User
          </Button>
        )}
      </div>

      {/* Users Table Card */}
      <Card className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search users…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="accountant">Accountant</SelectItem>
                <SelectItem value="auditor">Auditor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Result Count */}
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-slate-700">{filteredUsers.length}</span> of{' '}
              <span className="font-medium text-slate-700">{users.length}</span> users
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 w-10">#</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden md:table-cell">Email</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 hidden lg:table-cell">Created</th>
                {isAdmin && (
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="text-center py-12"
                  >
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs mt-1"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${
                      !user.isActive ? 'opacity-60' : ''
                    }`}
                  >
                    {/* # */}
                    <td className="px-4 py-3 text-xs text-slate-400">{index + 1}</td>

                    {/* Name + Email (stacked) */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold shrink-0"
                          title={user.name}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate md:hidden">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email (desktop) */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-slate-600">{user.email}</span>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">{getRoleBadge(user.role)}</td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            user.isActive ? 'bg-green-500' : 'bg-slate-300'
                          }`}
                        />
                        <span
                          className={`text-xs font-medium ${
                            user.isActive ? 'text-green-700' : 'text-slate-400'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-slate-500">{formatDate(user.createdAt)}</span>
                    </td>

                    {/* Actions (admin only) */}
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Edit user"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openDeleteDialog(user)}
                            className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Role Permission Matrix */}
      <Card className="border border-slate-200 rounded-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-700" />
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">Role Permissions</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Overview of what each role can access in the system
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-semibold text-slate-500 px-6 py-3">Permission</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-slate-900" />
                      Admin
                    </span>
                  </th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Manager
                    </span>
                  </th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Accountant
                    </span>
                  </th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Auditor
                    </span>
                  </th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                      Viewer
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MATRIX.map(row => (
                  <tr key={row.action} className="border-t border-slate-50 hover:bg-slate-50/30">
                    <td className="px-6 py-3 text-sm text-slate-700 font-medium">{row.action}</td>
                    <td className="px-4 py-3 text-center">
                      {row.admin ? (
                        <Check className="h-4 w-4 text-emerald-600 inline-block" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.manager ? (
                        <Check className="h-4 w-4 text-emerald-600 inline-block" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.accountant ? (
                        <Check className="h-4 w-4 text-emerald-600 inline-block" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.auditor ? (
                        <Check className="h-4 w-4 text-emerald-600 inline-block" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.viewer ? (
                        <Check className="h-4 w-4 text-emerald-600 inline-block" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Add / Edit User Modal */}
      {/* ============================================================ */}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={e => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-[480px] w-full p-6 shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingUser ? 'Update user details and role' : 'Create a new system user'}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  className={`h-9 text-sm ${formErrors.name ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                  placeholder="Enter full name"
                  value={form.name}
                  onChange={e => {
                    setForm(prev => ({ ...prev, name: e.target.value }))
                    if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }))
                  }}
                />
                {formErrors.name && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.name}
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="email"
                  className={`h-9 text-sm ${formErrors.email ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                  placeholder="user@company.com"
                  value={form.email}
                  onChange={e => {
                    setForm(prev => ({ ...prev, email: e.target.value }))
                    if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }))
                  }}
                />
                {formErrors.email && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.email}
                  </p>
                )}
              </div>

              {/* Role (admin only) */}
              {isAdmin && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={v => setForm(prev => ({ ...prev, role: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Status</Label>
                  <p className="text-xs text-muted-foreground">
                    {form.isActive ? 'User can log in and access the system' : 'User is deactivated and cannot log in'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${form.isActive ? 'text-green-700' : 'text-slate-400'}`}>
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={v => setForm(prev => ({ ...prev, isActive: v }))}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Password {!editingUser && <span className="text-red-500">*</span>}
                </Label>
                {editingUser && (
                  <p className="text-xs text-muted-foreground -mt-0.5 mb-1">
                    Leave blank to keep current password
                  </p>
                )}
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    className={`h-9 text-sm pr-10 ${formErrors.password ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                    placeholder={editingUser ? 'Enter new password to change' : 'Minimum 8 characters'}
                    value={form.password}
                    onChange={e => {
                      setForm(prev => ({ ...prev, password: e.target.value }))
                      if (formErrors.password) setFormErrors(prev => ({ ...prev, password: '' }))
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.password}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={closeModal}
                className="h-9 text-sm"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-slate-900 text-white hover:bg-slate-800 h-9 text-sm min-w-[100px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Saving…
                  </>
                ) : editingUser ? (
                  'Save Changes'
                ) : (
                  'Add User'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Delete Confirmation Dialog */}
      {/* ============================================================ */}

      {deleteDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={e => {
            if (e.target === e.currentTarget) closeDeleteDialog()
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-[400px] w-full p-6 shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Remove User?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This action cannot be undone. The user{' '}
                  <span className="font-semibold text-slate-700">{deletingUser?.name}</span> will lose all
                  system access immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={closeDeleteDialog}
                className="h-9 text-sm"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                className="bg-red-600 text-white hover:bg-red-700 h-9 text-sm"
              >
                Remove User
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
