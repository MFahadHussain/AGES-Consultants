'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GlobalSearch } from '@/components/layout/global-search'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import LoginPage from '@/components/auth/LoginPage'
import { lazy, Suspense, useEffect, useState } from 'react'

// Lazy-load all modules to prevent compiling everything on initial page load
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
const FixedAssetsIntegration = lazy(() => import('@/components/modules/fixed-assets').then(m => ({ default: m.FixedAssetsModule })))
const PayrollIntegration = lazy(() => import('@/components/modules/payroll').then(m => ({ default: m.PayrollIntegration })))
const ImportExport = lazy(() => import('@/components/modules/import-export').then(m => ({ default: m.ImportExport })))
const AuditTrail = lazy(() => import('@/components/modules/audit-trail').then(m => ({ default: m.AuditTrail })))
const SettingsModule = lazy(() => import('@/components/modules/settings').then(m => ({ default: m.SettingsModule })))
const UserManagement = lazy(() => import('@/components/modules/user-management').then(m => ({ default: m.UserManagement })))

// HR & Payroll modules
const EmployeeMaster = lazy(() => import('@/components/modules/employee-master').then(m => ({ default: m.EmployeeMaster })))
const ProjectAssignments = lazy(() => import('@/components/modules/project-assignments').then(m => ({ default: m.ProjectAssignments })))
const AllowancesModule = lazy(() => import('@/components/modules/allowances').then(m => ({ default: m.AllowancesModule })))
const AttendanceModule = lazy(() => import('@/components/modules/attendance').then(m => ({ default: m.AttendanceModule })))
const LoansModule = lazy(() => import('@/components/modules/loans').then(m => ({ default: m.LoansModule })))
const TaxSlabsModule = lazy(() => import('@/components/modules/tax-slabs').then(m => ({ default: m.TaxSlabsModule })))
const PayrollGLMapping = lazy(() => import('@/components/modules/payroll-gl-mapping').then(m => ({ default: m.PayrollGLMapping })))
const FinalSettlementModule = lazy(() => import('@/components/modules/final-settlement').then(m => ({ default: m.FinalSettlementModule })))
const EmployeeProfile = lazy(() => import('@/components/modules/employee-profile').then(m => ({ default: m.EmployeeProfile })))
const PayrollReports = lazy(() => import('@/components/modules/payroll-reports').then(m => ({ default: m.PayrollReports })))
const PayrollSlips = lazy(() => import('@/components/modules/payroll-slips').then(m => ({ default: m.PayrollSlips })))

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
  'user-management': UserManagement,
  'fixed-assets': FixedAssetsIntegration,
  payroll: PayrollIntegration,
  employees: EmployeeMaster,
  'project-assignments': ProjectAssignments,
  allowances: AllowancesModule,
  attendance: AttendanceModule,
  loans: LoansModule,
  'tax-slabs': TaxSlabsModule,
  'payroll-gl-mapping': PayrollGLMapping,
  'final-settlement': FinalSettlementModule,
  'employee-profile': EmployeeProfile,
  'payroll-reports': PayrollReports,
  'payroll-slips': PayrollSlips,
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
  const { activeModule, sidebarOpen, setSidebarOpen, authUser, setAuthUser } = useAppStore()
  const isMobile = useIsMobile()
  const [searchOpen, setSearchOpen] = useState(false)

  // On mobile, auto-close sidebar when module changes
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [activeModule, isMobile, setSidebarOpen])

  // Show login page if not authenticated
  if (!authUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setAuthUser(user)
        }}
      />
    )
  }

  // Main ERP application
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
        <Header onSearchOpen={() => setSearchOpen(true)} authUser={authUser} onLogout={() => setAuthUser(null)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6" style={{ background: '#F5F7FA' }}>
          <ModuleLoader />
        </main>
        <footer className="border-t px-5 py-2.5 bg-white shrink-0" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center justify-between text-[10px]" style={{ color: '#6B7280' }}>
            <span>AcctFin ERP v1.0.0 &bull; Accounting & Financial Management System</span>
            <span className="hidden sm:inline">Multi-Project &bull; Multi-Donor &bull; Multi-Currency &bull; Multi-Location</span>
          </div>
        </footer>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearch />
    </div>
  )
}
