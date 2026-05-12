'use client'

import { useAppStore, type ModuleKey } from '@/lib/store'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GlobalSearch } from '@/components/layout/global-search'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIsMobile } from '@/hooks/use-mobile'
import { useToast } from '@/hooks/use-toast'
import LoginPage from '@/components/auth/LoginPage'
import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react'

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
const RBACModule = lazy(() => import('@/components/modules/rbac').then(m => ({ default: m.RBACModule })))
const SecurityCenter = lazy(() => import('@/components/modules/security-center').then(m => ({ default: m.SecurityCenter })))

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
  'rbac': RBACModule,
  'security': SecurityCenter,
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

// ============================================================
// Forced Password Change Dialog (shown after login when forcePasswordChange=true)
// ============================================================

function ForcedPasswordChangeDialog({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false })
  const [loading, setLoading] = useState(false)

  const checks = {
    minLength: form.newPassword.length >= 8,
    uppercase: /[A-Z]/.test(form.newPassword),
    lowercase: /[a-z]/.test(form.newPassword),
    number: /[0-9]/.test(form.newPassword),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.newPassword),
    match: form.confirmPassword.length > 0 && form.newPassword === form.confirmPassword,
  }

  const allMet = Object.values(checks).every(v => v)

  const handleSubmit = useCallback(async () => {
    if (!allMet) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          currentPassword: '__force_change__',
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword,
          forceChange: true,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Password Set', description: 'Your password has been set successfully.' })
        onComplete()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to set password', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to set password', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [userId, form, allMet, onComplete, toast])

  return (
    <Dialog open={true} onOpenChange={() => { /* cannot dismiss */ }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Set Your Password
          </DialogTitle>
          <DialogDescription className="text-xs">
            You must set a new password before accessing the system. This is required for security purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Warning Banner */}
          <div className="rounded-lg border bg-amber-50 border-amber-200 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-amber-800">Password Change Required</p>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  Your account requires a password change. You cannot access the system until you set a new password.
                </p>
              </div>
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
                value={form.newPassword}
                onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
                autoFocus
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
              >
                {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.newPassword.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                <div className="flex items-center gap-1.5">
                  {checks.minLength ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-gray-300 shrink-0" />}
                  <span className={`text-[10px] ${checks.minLength ? 'text-green-600' : 'text-muted-foreground'}`}>At least 8 characters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.uppercase ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-gray-300 shrink-0" />}
                  <span className={`text-[10px] ${checks.uppercase ? 'text-green-600' : 'text-muted-foreground'}`}>One uppercase letter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.lowercase ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-gray-300 shrink-0" />}
                  <span className={`text-[10px] ${checks.lowercase ? 'text-green-600' : 'text-muted-foreground'}`}>One lowercase letter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.number ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-gray-300 shrink-0" />}
                  <span className={`text-[10px] ${checks.number ? 'text-green-600' : 'text-muted-foreground'}`}>One number</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.special ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-gray-300 shrink-0" />}
                  <span className={`text-[10px] ${checks.special ? 'text-green-600' : 'text-muted-foreground'}`}>One special character</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {checks.match ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-gray-300 shrink-0" />}
                  <span className={`text-[10px] ${checks.match ? 'text-green-600' : 'text-muted-foreground'}`}>Passwords match</span>
                </div>
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
                value={form.confirmPassword}
                onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
              >
                {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <Button
          className="w-full h-9 text-xs"
          onClick={handleSubmit}
          disabled={loading || !allMet}
        >
          {loading ? 'Setting Password...' : 'Set Password & Continue'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

export default function Home() {
  const { activeModule, sidebarOpen, setSidebarOpen, authUser, setAuthUser } = useAppStore()
  const isMobile = useIsMobile()
  const [searchOpen, setSearchOpen] = useState(false)
  const lastUserIdRef = useRef<string | null>(null)
  const [forcePasswordResolved, setForcePasswordResolved] = useState(false)

  // Track user changes to reset force password state
  if (authUser?.id !== lastUserIdRef.current) {
    lastUserIdRef.current = authUser?.id ?? null
    if (forcePasswordResolved) {
      setForcePasswordResolved(false)
    }
  }

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

  // Handle forced password change
  const needsPasswordChange = authUser.forcePasswordChange && !forcePasswordResolved

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

      {/* Forced Password Change Dialog */}
      {needsPasswordChange && (
        <ForcedPasswordChangeDialog
          userId={authUser.id}
          onComplete={() => {
            setForcePasswordResolved(true)
            // Update the authUser to remove forcePasswordChange flag
            setAuthUser({ ...authUser, forcePasswordChange: false })
          }}
        />
      )}
    </div>
  )
}
