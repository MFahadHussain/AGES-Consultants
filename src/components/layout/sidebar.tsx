'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  BookOpenCheck,
  Users,
  Building2,
  Landmark,
  FolderTree,
  Heart,
  MapPin,
  Briefcase,
  PieChart,
  Receipt,
  Clock,
  Calendar,
  FileBarChart,
  Download,
  Shield,
  Settings,
  Package,
  Banknote,
  ChevronDown,
  ChevronRight,
  Search,
  UserCog,
  UserCircle,
  GitBranch,
  Gift,
  CalendarCheck,
  HandCoins,
  Scale,
  Link2,
  FileCheck2,
  Printer,
  FileSpreadsheet,
} from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ============================================================
// Role-Based Module Access Control
// ============================================================

type UserRole = 'admin' | 'manager' | 'accountant' | 'auditor' | 'viewer'

// Defines which modules each role can access
const ROLE_MODULES: Record<UserRole, ModuleKey[]> = {
  admin: [
    'dashboard', 'chart-of-accounts', 'vouchers', 'ledgers', 'bank-reconciliation',
    'customers', 'suppliers', 'projects', 'donors', 'locations', 'clients',
    'budgets', 'taxation', 'aging', 'financial-year',
    'reports', 'fixed-assets', 'payroll',
    'employees', 'employee-profile', 'project-assignments', 'allowances', 'attendance',
    'loans', 'tax-slabs', 'payroll-gl-mapping', 'final-settlement', 'payroll-slips', 'payroll-reports',
    'user-management', 'import-export', 'audit-log', 'settings',
  ],
  manager: [
    'dashboard', 'chart-of-accounts', 'vouchers', 'ledgers', 'bank-reconciliation',
    'customers', 'suppliers', 'projects', 'donors', 'locations', 'clients',
    'budgets', 'taxation', 'aging', 'financial-year',
    'reports', 'fixed-assets', 'payroll',
    'employees', 'employee-profile', 'project-assignments', 'allowances', 'attendance',
    'loans', 'final-settlement', 'payroll-slips', 'payroll-reports',
    'audit-log',
  ],
  accountant: [
    'dashboard', 'chart-of-accounts', 'vouchers', 'ledgers', 'bank-reconciliation',
    'customers', 'suppliers', 'projects', 'donors', 'locations', 'clients',
    'budgets', 'taxation', 'aging', 'financial-year',
    'reports', 'fixed-assets', 'payroll',
    'employees', 'employee-profile', 'project-assignments', 'allowances', 'attendance',
    'loans', 'payroll-gl-mapping', 'payroll-slips', 'payroll-reports',
  ],
  auditor: [
    'dashboard', 'chart-of-accounts', 'vouchers', 'ledgers',
    'customers', 'suppliers', 'projects', 'donors', 'locations', 'clients',
    'budgets', 'aging', 'financial-year',
    'reports', 'fixed-assets', 'payroll',
    'employees', 'employee-profile', 'attendance', 'tax-slabs', 'payroll-gl-mapping', 'payroll-slips', 'payroll-reports',
    'audit-log',
  ],
  viewer: [
    'dashboard', 'chart-of-accounts', 'ledgers',
    'projects', 'donors',
    'reports',
  ],
}

function useAllowedModules(): Set<ModuleKey> {
  const { authUser } = useAppStore()
  const role = (authUser?.role || 'viewer') as UserRole
  const allowed = ROLE_MODULES[role] || ROLE_MODULES.viewer
  return new Set(allowed)
}

// ============================================================
// Navigation Definition
// ============================================================

interface NavGroup {
  label: string
  items: { key: ModuleKey; label: string; icon: any }[]
}

const navigation: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Accounting',
    items: [
      { key: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
      { key: 'vouchers', label: 'Voucher Management', icon: FileText },
      { key: 'ledgers', label: 'Ledgers & Sub-Ledgers', icon: BookOpenCheck },
      { key: 'bank-reconciliation', label: 'Bank Reconciliation', icon: Landmark },
    ],
  },
  {
    label: 'Masters',
    items: [
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'suppliers', label: 'Suppliers', icon: Building2 },
    ],
  },
  {
    label: 'Project & Segment',
    items: [
      { key: 'projects', label: 'Projects', icon: FolderTree },
      { key: 'donors', label: 'Donors', icon: Heart },
      { key: 'locations', label: 'Locations', icon: MapPin },
      { key: 'clients', label: 'Clients', icon: Briefcase },
    ],
  },
  {
    label: 'Planning & Control',
    items: [
      { key: 'budgets', label: 'Budget Management', icon: PieChart },
      { key: 'taxation', label: 'Taxation', icon: Receipt },
      { key: 'aging', label: 'Aging Analysis', icon: Clock },
      { key: 'financial-year', label: 'Financial Year', icon: Calendar },
    ],
  },
  {
    label: 'HR & Payroll',
    items: [
      { key: 'employees', label: 'Employee Master', icon: UserCircle },
      { key: 'employee-profile', label: 'Employee Profile', icon: UserCircle },
      { key: 'project-assignments', label: 'Project Assignments', icon: GitBranch },
      { key: 'allowances', label: 'Allowances & Benefits', icon: Gift },
      { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
      { key: 'loans', label: 'Loans & Advances', icon: HandCoins },
      { key: 'tax-slabs', label: 'Tax Slabs', icon: Scale },
      { key: 'payroll', label: 'Payroll Engine', icon: Banknote },
      { key: 'payroll-gl-mapping', label: 'GL Account Mapping', icon: Link2 },
      { key: 'final-settlement', label: 'Final Settlement', icon: FileCheck2 },
      { key: 'payroll-slips', label: 'Payroll Slips & Letters', icon: Printer },
      { key: 'payroll-reports', label: 'Payroll Reports', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'Reports',
    items: [
      { key: 'reports', label: 'Financial Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'Integration',
    items: [
      { key: 'fixed-assets', label: 'Fixed Assets', icon: Package },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'user-management', label: 'User Management', icon: UserCog },
      { key: 'import-export', label: 'Import / Export', icon: Download },
      { key: 'audit-log', label: 'Audit Trail', icon: Shield },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

// ============================================================
// Sidebar Component
// ============================================================

export function Sidebar() {
  const { activeModule, setActiveModule, sidebarOpen, searchQuery, setSearchQuery, authUser } = useAppStore()
  const allowedModules = useAllowedModules()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Overview: true, Accounting: true, Masters: true, 'HR & Payroll': true, Reports: true,
  })

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  // Filter navigation by role + search
  const filteredNav = navigation
    .map(group => ({
      ...group,
      items: group.items
        .filter(item => allowedModules.has(item.key))
        .filter(item => !searchQuery || item.label.toLowerCase().includes(searchQuery.toLowerCase())),
    }))
    .filter(group => group.items.length > 0)

  const role = (authUser?.role || 'viewer') as UserRole
  const roleBadgeColor: Record<UserRole, string> = {
    admin: 'bg-slate-900 text-white',
    manager: 'bg-blue-100 text-blue-700',
    accountant: 'bg-emerald-100 text-emerald-700',
    auditor: 'bg-amber-100 text-amber-700',
    viewer: 'bg-slate-100 text-slate-500',
  }

  return (
    <aside
      className={cn(
        'border-r bg-card transition-all duration-300 flex flex-col h-full overflow-hidden',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">
          AF
        </div>
        {sidebarOpen && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold truncate">AcctFin ERP</h1>
            <p className="text-[10px] text-muted-foreground truncate">Accounting & Finance</p>
          </div>
        )}
      </div>

      {/* Search */}
      {sidebarOpen && (
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search modules..."
              className="pl-7 h-8 text-xs"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 px-2 py-1">
        <div className="space-y-1">
          {filteredNav.map(group => (
            <div key={group.label} className="mb-1">
              {sidebarOpen && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {group.label}
                  {expandedGroups[group.label] ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              )}
              {(!sidebarOpen || expandedGroups[group.label]) && (
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon
                    const isActive = activeModule === item.key
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveModule(item.key)}
                        className={cn(
                          'flex items-center gap-2.5 w-full rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                        title={!sidebarOpen ? item.label : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {sidebarOpen && <span className="truncate">{item.label}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
              {sidebarOpen && group.label !== 'System' && <Separator className="my-2" />}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Role Badge + Version */}
      {sidebarOpen && (
        <div className="px-3 py-2 border-t shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${roleBadgeColor[role] || 'bg-slate-100 text-slate-500'}`}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {filteredNav.reduce((sum, g) => sum + g.items.length, 0)} modules
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">v1.0.0 • Multi-Project • Multi-Donor</p>
        </div>
      )}
    </aside>
  )
}
