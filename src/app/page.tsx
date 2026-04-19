'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GlobalSearch } from '@/components/layout/global-search'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { lazy, Suspense, useEffect, useState, useMemo } from 'react'

// Lazy-load all modules to prevent compiling everything on initial page load
// This dramatically reduces memory usage during development
const Dashboard = lazy(() => import('@/components/modules/dashboard').then(m => ({ default: m.Dashboard })))
const ChartOfAccounts = lazy(() => import('@/components/modules/chart-of-accounts').then(m => ({ default: m.ChartOfAccounts })))
const VoucherManagement = lazy(() => import('@/components/modules/voucher-management').then(m => ({ default: m.VoucherManagement })))
const Ledgers = lazy(() => import('@/components/modules/ledgers').then(m => ({ default: m.Ledgers })))
const Customers = lazy(() => import('@/components/modules/masters').then(m => ({ default: m.Customers })))
const Suppliers = lazy(() => import('@/components/modules/masters').then(m => ({ default: m.Suppliers })))
const Projects = lazy(() => import('@/components/modules/segments').then(m => ({ default: m.Projects })))
const Donors = lazy(() => import('@/components/modules/segments').then(m => ({ default: m.Donors })))
const Locations = lazy(() => import('@/components/modules/segments').then(m => ({ default: m.Locations })))
const Clients = lazy(() => import('@/components/modules/segments').then(m => ({ default: m.Clients })))
const BudgetManagement = lazy(() => import('@/components/modules/budgets').then(m => ({ default: m.BudgetManagement })))
const BankReconciliation = lazy(() => import('@/components/modules/bank-reconciliation').then(m => ({ default: m.BankReconciliation })))
const Taxation = lazy(() => import('@/components/modules/taxation').then(m => ({ default: m.Taxation })))
const AgingAnalysis = lazy(() => import('@/components/modules/aging').then(m => ({ default: m.AgingAnalysis })))
const FinancialYearManagement = lazy(() => import('@/components/modules/financial-year').then(m => ({ default: m.FinancialYearManagement })))
const FinancialReports = lazy(() => import('@/components/modules/reports').then(m => ({ default: m.FinancialReports })))
const FixedAssetsIntegration = lazy(() => import('@/components/modules/fixed-assets').then(m => ({ default: m.FixedAssetsIntegration })))
const PayrollIntegration = lazy(() => import('@/components/modules/payroll').then(m => ({ default: m.PayrollIntegration })))
const ImportExport = lazy(() => import('@/components/modules/import-export').then(m => ({ default: m.ImportExport })))
const AuditTrail = lazy(() => import('@/components/modules/audit-trail').then(m => ({ default: m.AuditTrail })))
const SettingsModule = lazy(() => import('@/components/modules/settings').then(m => ({ default: m.SettingsModule })))

const moduleComponents: Record<ModuleKey, React.LazyExoticComponent<React.ComponentType>> = {
  dashboard: Dashboard,
  'chart-of-accounts': ChartOfAccounts,
  vouchers: VoucherManagement,
  ledgers: Ledgers,
  customers: Customers,
  suppliers: Suppliers,
  'bank-reconciliation': BankReconciliation,
  projects: Projects,
  donors: Donors,
  locations: Locations,
  clients: Clients,
  budgets: BudgetManagement,
  taxation: Taxation,
  aging: AgingAnalysis,
  'financial-year': FinancialYearManagement,
  reports: FinancialReports,
  'import-export': ImportExport,
  'audit-log': AuditTrail,
  settings: SettingsModule,
  'fixed-assets': FixedAssetsIntegration,
  payroll: PayrollIntegration,
}

function ModuleLoader() {
  const { activeModule } = useAppStore()
  const ActiveComponent = moduleComponents[activeModule] || Dashboard

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Loading module...</p>
        </div>
      </div>
    }>
      <ActiveComponent />
    </Suspense>
  )
}

export default function Home() {
  const { activeModule, setActiveModule, sidebarOpen, setSidebarOpen } = useAppStore()
  const isMobile = useIsMobile()
  const [searchOpen, setSearchOpen] = useState(false)

  // On mobile, auto-close sidebar when module changes
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [activeModule, isMobile, setSidebarOpen])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile Sidebar */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Header onSearchOpen={() => setSearchOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ModuleLoader />
        </main>
        <footer className="border-t px-4 py-2 bg-card shrink-0">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>AcctFin ERP v1.0.0 • Accounting & Financial Management System</span>
            <span className="hidden sm:inline">Multi-Project • Multi-Donor • Multi-Currency • Multi-Location</span>
          </div>
        </footer>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearch />
    </div>
  )
}
