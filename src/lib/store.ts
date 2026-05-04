import { create } from 'zustand'

export type ModuleKey =
  | 'dashboard'
  | 'chart-of-accounts'
  | 'vouchers'
  | 'ledgers'
  | 'customers'
  | 'suppliers'
  | 'bank-reconciliation'
  | 'projects'
  | 'donors'
  | 'locations'
  | 'clients'
  | 'budgets'
  | 'taxation'
  | 'aging'
  | 'financial-year'
  | 'reports'
  | 'import-export'
  | 'audit-log'
  | 'settings'
  | 'fixed-assets'
  | 'payroll'
  | 'user-management'
  | 'employees'
  | 'project-assignments'
  | 'allowances'
  | 'attendance'
  | 'loans'
  | 'tax-slabs'
  | 'payroll-gl-mapping'
  | 'final-settlement'
  | 'employee-profile'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  avatarUrl: string | null
  lastLoginAt: string | null
  createdAt: string
}

interface AppState {
  activeModule: ModuleKey
  setActiveModule: (module: ModuleKey) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  authUser: AuthUser | null
  setAuthUser: (user: AuthUser | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeModule: 'dashboard',
  setActiveModule: (module) => set({ activeModule: module }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  authUser: null,
  setAuthUser: (user) => set({ authUser: user }),
}))
