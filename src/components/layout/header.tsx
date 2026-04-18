'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { Menu, Bell, Moon, Sun, User, Search } from 'lucide-react'
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
}

interface HeaderProps {
  onSearchOpen?: () => void
}

export function Header({ onSearchOpen }: HeaderProps) {
  const { activeModule, setSidebarOpen, sidebarOpen, setActiveModule } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [notifications, setNotifications] = useState<{ count: number; items: { id: string; text: string; type: string; module: ModuleKey }[] }>({ count: 0, items: [] })
  const isMobile = useIsMobile()

  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

  // Fetch pending voucher counts for notifications
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

      const reviewRes = await fetch('/api/vouchers?status=reviewed&limit=5')
      const reviewData = await reviewRes.json()
      const reviewItems = (reviewData.data || []).map((v: any) => ({
        id: v.id,
        text: `${v.voucherNumber} - Awaiting approval`,
        type: 'reviewed',
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
    const interval = setInterval(fetchNotifications, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [fetchNotifications])

  return (
    <header className="border-b bg-card px-4 py-2.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="hidden sm:block">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink className="text-[10px] text-muted-foreground cursor-pointer" onClick={() => setActiveModule('dashboard')}>
                  Home
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink className="text-[10px] text-muted-foreground">
                  {moduleGroups[activeModule]}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-xs font-medium">
                  {moduleLabels[activeModule]}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="sm:hidden">
          <p className="text-sm font-semibold">{moduleLabels[activeModule]}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Global Search Trigger */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 hidden sm:flex items-center gap-2 text-xs text-muted-foreground w-56 justify-start font-normal"
          onClick={onSearchOpen}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="truncate">Search everything...</span>
          <kbd className="pointer-events-none ml-auto inline-flex h-4 select-none items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:hidden"
          onClick={onSearchOpen}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Badge variant="outline" className="text-[10px] font-normal hidden sm:inline-flex">
          FY 2024-25
        </Badge>

        {/* Notifications Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="h-4 w-4" />
              {notifications.count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-[8px] text-white flex items-center justify-center">
                  {notifications.count}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="px-3 py-2 border-b">
              <p className="text-xs font-semibold">Notifications</p>
              <p className="text-[10px] text-muted-foreground">{notifications.count} pending action{notifications.count !== 1 ? 's' : ''}</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.items.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">No pending notifications</p>
                </div>
              ) : (
                notifications.items.map((item) => (
                  <button
                    key={item.id}
                    className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors border-b last:border-0"
                    onClick={() => setActiveModule(item.module)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${item.type === 'draft' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                      <p className="text-xs truncate">{item.text}</p>
                    </div>
                    <p className="text-[9px] text-muted-foreground ml-4">
                      {item.type === 'draft' ? 'Draft voucher - needs review' : 'Reviewed voucher - needs approval'}
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="px-3 py-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-[10px]"
                onClick={() => setActiveModule('vouchers')}
              >
                View All Vouchers
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {mounted && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}
        <div className="flex items-center gap-2 pl-2 border-l">
          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-medium">Admin</p>
            <p className="text-[10px] text-muted-foreground">admin@acctfin.com</p>
          </div>
        </div>
      </div>
    </header>
  )
}
