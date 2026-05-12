'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { Menu, Bell, Moon, Sun, User, Search, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

export function Header({ onSearchOpen, authUser, onLogout }: HeaderProps) {
  const { activeModule, setSidebarOpen, sidebarOpen, setActiveModule } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [notifications, setNotifications] = useState<{ count: number; items: { id: string; text: string; type: string; module: ModuleKey }[] }>({ count: 0, items: [] })
  const isMobile = useIsMobile()

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
    </header>
  )
}
