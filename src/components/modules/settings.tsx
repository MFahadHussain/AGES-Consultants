'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings, Users, Shield, Database, Bell, Palette } from 'lucide-react'

export function SettingsModule() {
  const roles = [
    { role: 'Admin', description: 'Full access to all modules, user management, system configuration', permissions: ['All Modules', 'User Management', 'System Config', 'Audit Access'] },
    { role: 'Accountant', description: 'Create and manage vouchers, ledgers, and reports', permissions: ['Voucher CRUD', 'Ledger Access', 'Reports', 'Chart of Accounts'] },
    { role: 'Auditor', description: 'Read-only access with audit trail review capability', permissions: ['Read Only', 'Audit Trail', 'Reports', 'Approval Review'] },
    { role: 'Viewer', description: 'Read-only access to reports and dashboards', permissions: ['Dashboard', 'Reports (Read Only)'] },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">System Settings</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Role-Based Access Control */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Role-Based Access Control</CardTitle>
            <CardDescription className="text-[10px]">Multi-user with role-based permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {roles.map(r => (
              <div key={r.role} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold">{r.role}</p>
                  <Badge className="text-[8px]">{r.permissions.length} permissions</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mb-1">{r.description}</p>
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map(p => <Badge key={p} className="text-[8px] bg-muted">{p}</Badge>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" />System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Version', value: '1.0.0' },
              { label: 'Database', value: 'SQLite (Prisma ORM)' },
              { label: 'Framework', value: 'Next.js 16 + React 19' },
              { label: 'UI Library', value: 'shadcn/ui + Tailwind CSS' },
              { label: 'Multi-Currency', value: 'Supported (PKR default)' },
              { label: 'Multi-Project', value: 'Enabled' },
              { label: 'Multi-Donor', value: 'Enabled' },
              { label: 'Multi-Location', value: 'Enabled' },
              { label: 'Current FY', value: 'FY 2024-25 (Open)' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1 border-b last:border-0">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Integration Status */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Integration Status</CardTitle>
            <CardDescription className="text-[10px]">Connected external modules and their integration touchpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold flex items-center gap-1"><Badge className="text-[8px] bg-purple-100 text-purple-800">INTEGRATION</Badge> Payroll Management</p>
                  <Badge className="text-[9px] bg-green-100 text-green-800">Connected</Badge>
                </div>
                <ul className="text-[10px] text-muted-foreground space-y-0.5">
                  <li>• Salary expense auto-posts to GL after payroll approval</li>
                  <li>• Cross-charged salary costs to project cost centers</li>
                  <li>• Loan/advance deductions update Loans/Advances ledger</li>
                  <li>• Social charges create accrual entries in GL</li>
                  <li>• Final settlement payments reflect in bank/cash ledger</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg border border-teal-200 bg-teal-50/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold flex items-center gap-1"><Badge className="text-[8px] bg-teal-100 text-teal-800">INTEGRATION</Badge> Fixed Assets Management</p>
                  <Badge className="text-[9px] bg-green-100 text-green-800">Connected</Badge>
                </div>
                <ul className="text-[10px] text-muted-foreground space-y-0.5">
                  <li>• Asset purchases create entries in Asset + Bank/Payables</li>
                  <li>• Monthly depreciation auto-generates journal entries</li>
                  <li>• Asset disposals post gain/loss entries to GL</li>
                  <li>• Asset transfers update segment accounting</li>
                  <li>• Donor-funded assets excluded from depreciation</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
