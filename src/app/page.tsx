'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { Dashboard } from '@/components/modules/dashboard'
import { ChartOfAccounts } from '@/components/modules/chart-of-accounts'
import { VoucherManagement } from '@/components/modules/voucher-management'
import { Ledgers } from '@/components/modules/ledgers'
import { Customers, Suppliers } from '@/components/modules/masters'
import { Projects, Donors, Locations } from '@/components/modules/segments'
import { BudgetManagement } from '@/components/modules/budgets'
import { BankReconciliation } from '@/components/modules/bank-reconciliation'
import { Taxation } from '@/components/modules/taxation'
import { AgingAnalysis } from '@/components/modules/aging'
import { FinancialYearManagement } from '@/components/modules/financial-year'
import { FinancialReports } from '@/components/modules/reports'
import { FixedAssetsIntegration } from '@/components/modules/fixed-assets'
import { PayrollIntegration } from '@/components/modules/payroll'
import { ImportExport } from '@/components/modules/import-export'
import { AuditTrail } from '@/components/modules/audit-trail'
import { SettingsModule } from '@/components/modules/settings'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { useEffect } from 'react'

const moduleComponents: Record<ModuleKey, React.ComponentType> = {
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

export default function Home() {
  const { activeModule, setActiveModule, sidebarOpen, setSidebarOpen } = useAppStore()
  const ActiveComponent = moduleComponents[activeModule] || Dashboard
  const isMobile = useIsMobile()

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
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ActiveComponent />
        </main>
        <footer className="border-t px-4 py-2 bg-card shrink-0">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>AcctFin ERP v1.0.0 • Accounting & Financial Management System</span>
            <span className="hidden sm:inline">Multi-Project • Multi-Donor • Multi-Currency • Multi-Location</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
