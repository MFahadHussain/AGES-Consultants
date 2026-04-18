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

interface AppState {
  activeModule: ModuleKey
  setActiveModule: (module: ModuleKey) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeModule: 'dashboard',
  setActiveModule: (module) => set({ activeModule: module }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
}))
