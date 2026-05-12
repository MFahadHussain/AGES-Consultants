'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { Menu, Bell, Moon, Sun, User, Search, LogOut, Settings, Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTheme } from 'next-themes'
import { useEffect, useState, useCallback } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

const moduleLabels: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  'chart-of-accounts': 'Chart of Accounts',
  vouchers: 'Voucher Management',
  ledgers: 'Ledgers & Sub-Ledgers',
  customers: 'Customers',
  suppliers: 'Suppliers',
  'bank-reconciliation': 'Bank Reconciliation',
  projects: 'Projects',
  donors: 'Donors',
  locations: 'Locations',
  budgets: 'Budget Management',
  taxation: 'Taxation',
  aging: 'Aging Analysis',
  'financial-year': 'Financial Year',
  reports: 'Financial Reports',
  'import-export': 'Import / Export',
  'audit-log': 'Audit Trail',
  settings: 'Settings',
  'fixed-assets': 'Fixed Assets',
  payroll: 'Payroll Integration',
  'user-management': 'User Management',
  clients: 'Clients',
  employees: 'Employee Master',
  'employee-profile': 'Employee Profile',
  'project-assignments': 'Project Assignments',
  allowances: 'Allowances & Benefits',
  attendance: 'Attendance',
  loans: 'Loans & Advances',
  'tax-slabs': 'Tax Slabs',
  'payroll-gl-mapping': 'GL Account Mapping',
  'final-settlement': 'Final Settlement',
  'payroll-slips': 'Payroll Slips & Letters',
  'payroll-reports': 'Payroll Reports',
}

const moduleGroups: Record<ModuleKey, string> = {
  dashboard: 'Overview',
  'chart-of-accounts': 'Accounting',
  vouchers: 'Accounting',
  ledgers: 'Accounting',
  'bank-reconciliation': 'Accounting',
  customers: 'Masters',
  suppliers: 'Masters',
  projects: 'Segments',
  donors: 'Segments',
  locations: 'Segments',
  budgets: 'Planning',
  taxation: 'Planning',
  aging: 'Planning',
  'financial-year': 'Planning',
  reports: 'Reports',
  'import-export': 'System',
  'audit-log': 'System',
  settings: 'System',
  'fixed-assets': 'Integration',
  payroll: 'Integration',
  'user-management': 'System',
  clients: 'Segments',
  employees: 'HR & Payroll',
  'employee-profile': 'HR & Payroll',
  'project-assignments': 'HR & Payroll',
  allowances: 'HR & Payroll',
  attendance: 'HR & Payroll',
  loans: 'HR & Payroll',
  'tax-slabs': 'HR & Payroll',
  'payroll-gl-mapping': 'HR & Payroll',
  'final-settlement': 'HR & Payroll',
  'payroll-slips': 'HR & Payroll',
  'payroll-reports': 'HR & Payroll',
}

interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  avatarUrl: string | null
  lastLoginAt: string | null
  createdAt: string
}

interface HeaderProps {
  onSearchOpen?: () => void
  authUser?: AuthUser | null
  onLogout?: () => void
}

// ============================================================
// Password Strength Indicator Component (defined outside to avoid re-render issues)
// ============================================================

function PasswordStrengthBar({ password }: { password: string }) {
  const getStrength = (pwd: string) => {
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[a-z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) score++
    return Math.min(score, 5)
  }

  const strength = getStrength(password)
  const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
  const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-400', 'bg-green-600']
  const textColors = ['', 'text-red-500', 'text-orange-500', 'text-yellow-600', 'text-green-500', 'text-green-600']

  if (!password) return null

  return (
    <div className="space-y-1.5 mt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(level => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${level <= strength ? colors[strength] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className={`text-[10px] font-medium ${textColors[strength]}`}>{labels[strength]}</p>
    </div>
  )
}

// ============================================================
// Password Requirement Check Component
// ============================================================

function PasswordCheck({ label, met }: { label: string; met: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
      ) : (
        <div className="h-3 w-3 rounded-full border border-gray-300 shrink-0" />
      )}
      <span className={`text-[10px] ${met ? 'text-green-600' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  )
}

export function Header({ onSearchOpen, authUser, onLogout }: HeaderProps) {
  const { activeModule, setSidebarOpen, sidebarOpen, setActiveModule } = useAppStore()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [notifications, setNotifications] = useState<{ count: number; items: { id: string; text: string; type: string; module: ModuleKey }[] }>({ count: 0, items: [] })
  const isMobile = useIsMobile()

  // Change Password Dialog state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/vouchers?status=draft&limit=5')
      const data = await res.json()
      const draftItems = (data.data || []).map((v: any) => ({
        id: v.id,
        text: `${v.voucherNumber} - ${v.narration?.substring(0, 50) || 'Draft voucher'}`,
        type: 'draft',
        module: 'vouchers' as ModuleKey,
      }))

      const reviewRes = await fetch('/api/vouchers?status=pending&limit=5')
      const reviewData = await reviewRes.json()
      const reviewItems = (reviewData.data || []).map((v: any) => ({
        id: v.id,
        text: `${v.voucherNumber} - Awaiting approval`,
        type: 'pending',
        module: 'vouchers' as ModuleKey,
      }))

      const allItems = [...draftItems, ...reviewItems].slice(0, 5)
      setNotifications({ count: allItems.length, items: allItems })
    } catch (e) {
      // Ignore notification fetch errors
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => fetchNotifications())
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Password change handler
  const handleChangePassword = async () => {
    if (!authUser?.id) {
      toast({ title: 'Error', description: 'You must be logged in to change your password', variant: 'destructive' })
      return
    }

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({ title: 'Validation Error', description: 'All fields are required', variant: 'destructive' })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: 'Validation Error', description: 'New password and confirmation do not match', variant: 'destructive' })
      return
    }

    if (passwordForm.newPassword.length < 8) {
      toast({ title: 'Validation Error', description: 'Password must be at least 8 characters', variant: 'destructive' })
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authUser.id,
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast({
          title: 'Password Changed',
          description: 'Your password has been updated successfully. Please use the new password next time you sign in.',
        })
        setChangePasswordOpen(false)
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setShowPasswords({ current: false, new: false, confirm: false })
      } else {
        toast({
          title: 'Password Change Failed',
          description: data.error || 'Failed to change password',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to change password. Please try again.', variant: 'destructive' })
    } finally {
      setChangingPassword(false)
    }
  }

  // Password requirement checks
  const newPassword = passwordForm.newPassword
  const passwordChecks = {
    minLength: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
    match: passwordForm.confirmPassword.length > 0 && newPassword === passwordForm.confirmPassword,
  }

  const allChecksMet = Object.values(passwordChecks).every(v => v)

  return (
    <header className="bg-white px-5 py-2.5 flex items-center justify-between shrink-0 border-b" style={{ borderColor: '#E5E7EB', height: '56px' }}>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-gray-600"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="hidden sm:flex items-center">
          <span className="text-gray-400 text-xs cursor-pointer hover:text-gray-600 transition-colors" onClick={() => setActiveModule('dashboard')}>Home</span>
          <span className="mx-2 text-gray-300 text-[10px]">&rsaquo;</span>
          <span className="text-gray-400 text-xs">{moduleGroups[activeModule]}</span>
          <span className="mx-2 text-gray-300 text-[10px]">&rsaquo;</span>
          <span className="text-[13px] font-medium" style={{ color: '#1a1a2e' }}>{moduleLabels[activeModule]}</span>
        </div>
        <div className="sm:hidden">
          <p className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>{moduleLabels[activeModule]}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Global Search Trigger */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 hidden sm:flex items-center gap-2 text-xs text-gray-400 w-56 justify-start font-normal bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
          onClick={onSearchOpen}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="truncate">Search everything...</span>
          <kbd className="pointer-events-none ml-auto inline-flex h-4 select-none items-center gap-0.5 rounded border border-gray-200 bg-white px-1 font-mono text-[9px] font-medium text-gray-400">
            ⌘K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:hidden text-gray-400"
          onClick={onSearchOpen}
        >
          <Search className="h-4 w-4" />
        </Button>
        {/* FY Selector */}
        <div className="hidden sm:flex items-center px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50">
          <span className="text-[11px] font-medium text-gray-500">FY 2024-25</span>
        </div>

        {/* Notifications Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 relative text-gray-400 hover:text-gray-600">
              <Bell className="h-4 w-4" />
              {notifications.count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[8px] text-white flex items-center justify-center font-bold">
                  {notifications.count}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 border-gray-200" align="end">
            <div className="px-3 py-2.5 border-b border-gray-100">
              <p className="text-xs font-semibold" style={{ color: '#1a1a2e' }}>Notifications</p>
              <p className="text-[10px] text-gray-400">{notifications.count} pending action{notifications.count !== 1 ? 's' : ''}</p>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {notifications.items.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">No pending notifications</p>
                </div>
              ) : (
                notifications.items.map((item) => (
                  <button
                    key={item.id}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    onClick={() => setActiveModule(item.module)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${item.type === 'draft' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                      <p className="text-xs truncate" style={{ color: '#1a1a2e' }}>{item.text}</p>
                    </div>
                    <p className="text-[9px] text-gray-400 ml-4 mt-0.5">
                      {item.type === 'draft' ? 'Draft voucher — needs review' : 'Reviewed voucher — needs approval'}
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="px-3 py-2 border-t border-gray-100">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-[10px] text-[#1A7A4A] hover:text-[#15693F] hover:bg-[#F0FDF4]"
                onClick={() => setActiveModule('vouchers')}
              >
                View All Vouchers
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Theme Toggle */}
        {mounted && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}

        {/* User Profile Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2.5 pl-3 border-l border-gray-200 cursor-pointer hover:bg-gray-50 rounded-md px-2 py-1.5 transition-colors ml-1">
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: '#1A7A4A', color: '#FFFFFF' }}>
                {(authUser?.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium" style={{ color: '#1a1a2e' }}>{authUser?.name || 'Admin'}</p>
                <p className="text-[10px] text-gray-400">{authUser?.email || 'admin@acctfin.com'}</p>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0 border-gray-200" align="end">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#1A7A4A', color: '#FFFFFF' }}>
                  {(authUser?.name || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: '#1a1a2e' }}>{authUser?.name || 'Admin'}</p>
                  <p className="text-xs text-gray-400 truncate">{authUser?.email || 'admin@acctfin.com'}</p>
                </div>
              </div>
              <div className="mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 capitalize">{authUser?.role || 'admin'}</span>
              </div>
            </div>
            <div className="p-1">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md hover:bg-gray-50 transition-colors text-gray-600"
                onClick={() => setChangePasswordOpen(true)}
              >
                <Lock className="h-3.5 w-3.5" />
                Change Password
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md hover:bg-gray-50 transition-colors text-gray-600"
                onClick={() => setActiveModule('settings')}
              >
                <Settings className="h-3.5 w-3.5" />
                System Settings
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md hover:bg-red-50 hover:text-red-600 transition-colors text-gray-600"
                onClick={onLogout}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={(open) => {
        if (!open) {
          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
          setShowPasswords({ current: false, new: false, confirm: false })
        }
        setChangePasswordOpen(open)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Change Password
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update your account password. After changing, you will need to use the new password on your next sign in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Current Password</Label>
              <div className="relative">
                <Input
                  type={showPasswords.current ? 'text' : 'password'}
                  className="h-9 text-sm pr-10"
                  placeholder="Enter current password"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPasswords(s => ({ ...s, current: !s.current }))}
                >
                  {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">New Password</Label>
              <div className="relative">
                <Input
                  type={showPasswords.new ? 'text' : 'password'}
                  className="h-9 text-sm pr-10"
                  placeholder="Enter new password"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthBar password={passwordForm.newPassword} />
              {/* Password requirements */}
              {passwordForm.newPassword.length > 0 && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                  <PasswordCheck label="At least 8 characters" met={passwordChecks.minLength} />
                  <PasswordCheck label="One uppercase letter" met={passwordChecks.uppercase} />
                  <PasswordCheck label="One lowercase letter" met={passwordChecks.lowercase} />
                  <PasswordCheck label="One number" met={passwordChecks.number} />
                  <PasswordCheck label="One special character" met={passwordChecks.special} />
                  <PasswordCheck label="Passwords match" met={passwordChecks.match} />
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  className="h-9 text-sm pr-10"
                  placeholder="Re-enter new password"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
                >
                  {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.confirmPassword.length > 0 && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-[10px] text-red-500 flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" /> Passwords do not match
                </p>
              )}
            </div>

            {/* Security Notice */}
            <div className="rounded-lg border bg-amber-50 border-amber-200 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-medium text-amber-800">Password Requirements</p>
                  <p className="text-[10px] text-amber-700 mt-0.5">
                    Your new password must be different from your last 5 passwords. Passwords expire every 90 days.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChangePasswordOpen(false)}
              className="h-8 text-xs"
              disabled={changingPassword}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleChangePassword}
              disabled={changingPassword || !allChecksMet || !passwordForm.currentPassword}
              className="h-8 text-xs"
            >
              {changingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
