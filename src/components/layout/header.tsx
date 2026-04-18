'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { Menu, Bell, Moon, Sun, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

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

export function Header() {
  const { activeModule, setSidebarOpen, sidebarOpen } = useAppStore()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

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
                <BreadcrumbLink className="text-[10px] text-muted-foreground cursor-pointer" onClick={() => useAppStore.getState().setActiveModule('dashboard')}>
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
        <Badge variant="outline" className="text-[10px] font-normal hidden sm:inline-flex">
          FY 2024-25
        </Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive text-[8px] text-white flex items-center justify-center">3</span>
        </Button>
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
