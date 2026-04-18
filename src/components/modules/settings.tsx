'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Settings, Users, Shield, Database, Bell, Palette, Plus, Edit2, CheckCircle, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const roles = [
  { role: 'Admin', description: 'Full access to all modules, user management, system configuration', permissions: ['All Modules', 'User Management', 'System Config', 'Audit Access', 'Approval Authority'], color: 'bg-red-100 text-red-800' },
  { role: 'Accountant', description: 'Create and manage vouchers, ledgers, and reports', permissions: ['Voucher CRUD', 'Ledger Access', 'Reports', 'Chart of Accounts', 'Budget View'], color: 'bg-blue-100 text-blue-800' },
  { role: 'Auditor', description: 'Read-only access with audit trail review capability', permissions: ['Read Only', 'Audit Trail', 'Reports', 'Approval Review'], color: 'bg-amber-100 text-amber-800' },
  { role: 'Viewer', description: 'Read-only access to reports and dashboards', permissions: ['Dashboard', 'Reports (Read Only)'], color: 'bg-gray-100 text-gray-800' },
]

const modulePermissions = [
  { module: 'Dashboard', admin: true, accountant: true, auditor: true, viewer: true },
  { module: 'Chart of Accounts', admin: true, accountant: true, auditor: true, viewer: false },
  { module: 'Voucher Management', admin: true, accountant: true, auditor: false, viewer: false },
  { module: 'Ledgers', admin: true, accountant: true, auditor: true, viewer: true },
  { module: 'Customers/Suppliers', admin: true, accountant: true, auditor: false, viewer: false },
  { module: 'Bank Reconciliation', admin: true, accountant: true, auditor: false, viewer: false },
  { module: 'Projects/Segments', admin: true, accountant: true, auditor: true, viewer: false },
  { module: 'Budget Management', admin: true, accountant: true, auditor: true, viewer: false },
  { module: 'Taxation', admin: true, accountant: true, auditor: false, viewer: false },
  { module: 'Financial Reports', admin: true, accountant: true, auditor: true, viewer: true },
  { module: 'Fixed Assets', admin: true, accountant: true, auditor: false, viewer: false },
  { module: 'Payroll Integration', admin: true, accountant: true, auditor: false, viewer: false },
  { module: 'Import/Export', admin: true, accountant: true, auditor: false, viewer: false },
  { module: 'Audit Trail', admin: true, accountant: false, auditor: true, viewer: false },
  { module: 'Settings', admin: true, accountant: false, auditor: false, viewer: false },
]

// Sample users for demonstration
const sampleUsers = [
  { id: '1', name: 'Admin User', email: 'admin@acctfin.com', role: 'Admin', isActive: true, lastLogin: '2024-12-15T10:30:00' },
  { id: '2', name: 'Fatima Khan', email: 'fatima@acctfin.com', role: 'Accountant', isActive: true, lastLogin: '2024-12-14T09:15:00' },
  { id: '3', name: 'Ahmed Ali', email: 'ahmed@acctfin.com', role: 'Accountant', isActive: true, lastLogin: '2024-12-13T14:45:00' },
  { id: '4', name: 'Sara Malik', email: 'sara@acctfin.com', role: 'Auditor', isActive: true, lastLogin: '2024-12-10T11:00:00' },
  { id: '5', name: 'Usman Tariq', email: 'usman@acctfin.com', role: 'Viewer', isActive: false, lastLogin: '2024-11-28T16:20:00' },
]

export function SettingsModule() {
  const [users, setUsers] = useState(sampleUsers)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'Accountant', isActive: true })
  const { toast } = useToast()

  const handleCreate = async () => {
    if (!form.name || !form.email) {
      toast({ title: 'Error', description: 'Name and email required', variant: 'destructive' })
      return
    }
    const newUser = { id: String(users.length + 1), ...form, lastLogin: null }
    setUsers([...users, newUser])
    toast({ title: 'User Created', description: `${form.name} added as ${form.role}` })
    setDialogOpen(false)
    setForm({ name: '', email: '', role: 'Accountant', isActive: true })
  }

  const toggleUserActive = (userId: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u))
    const user = users.find(u => u.id === userId)
    toast({ title: 'Status Updated', description: `${user?.name} ${user?.isActive ? 'deactivated' : 'activated'}` })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">System Settings</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Management */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />User Management</CardTitle>
                <CardDescription className="text-[10px]">Manage system users and their access levels</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-7 text-[10px]"><Plus className="h-3 w-3 mr-1" />Add User</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader><DialogTitle className="text-sm">Add New User</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Full Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                    <div><Label className="text-xs">Email *</Label><Input type="email" className="h-8 text-xs" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                    <div><Label className="text-xs">Role</Label>
                      <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {roles.map(r => <SelectItem key={r.role} value={r.role}>{r.role} - {r.description.substring(0, 40)}...</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button size="sm" onClick={handleCreate}>Create User</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Name</TableHead>
                  <TableHead className="text-[10px]">Email</TableHead>
                  <TableHead className="text-[10px]">Role</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px]">Last Login</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="text-xs font-medium">{user.name}</TableCell>
                    <TableCell className="text-xs">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={`text-[9px] ${roles.find(r => r.role === user.role)?.color || 'bg-gray-100 text-gray-800'}`}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge className="text-[9px] bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge className="text-[9px] bg-gray-100 text-gray-800">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 text-[10px] ${user.isActive ? 'text-destructive' : 'text-green-600'}`}
                        onClick={() => toggleUserActive(user.id)}
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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
                  <Badge className={`text-[8px] ${r.color}`}>{r.permissions.length} permissions</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mb-1">{r.description}</p>
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map(p => <Badge key={p} className="text-[8px] bg-muted">{p}</Badge>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Permission Matrix */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Permission Matrix</CardTitle>
            <CardDescription className="text-[10px]">Module access by role</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px]">Module</TableHead>
                  <TableHead className="text-[9px] text-center">Admin</TableHead>
                  <TableHead className="text-[9px] text-center">Accountant</TableHead>
                  <TableHead className="text-[9px] text-center">Auditor</TableHead>
                  <TableHead className="text-[9px] text-center">Viewer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modulePermissions.map(mp => (
                  <TableRow key={mp.module}>
                    <TableCell className="text-[10px] font-medium">{mp.module}</TableCell>
                    <TableCell className="text-center">{mp.admin ? <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center">{mp.accountant ? <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center">{mp.auditor ? <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center">{mp.viewer ? <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* System Information */}
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
        <Card>
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

        {/* Data Validation Status */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Data Validation Status</CardTitle>
            <CardDescription className="text-[10px]">System integrity checks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-green-200 bg-green-50/50 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Trial Balance Balanced</p>
                  <p className="text-[10px] text-muted-foreground">Total debits equal total credits</p>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-green-200 bg-green-50/50 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Double-Entry Validated</p>
                  <p className="text-[10px] text-muted-foreground">All vouchers have balanced entries</p>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-green-200 bg-green-50/50 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Financial Year Open</p>
                  <p className="text-[10px] text-muted-foreground">FY 2024-25 is active for posting</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
