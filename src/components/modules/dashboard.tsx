'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import {
  Banknote, TrendingUp, ArrowUpRight, ArrowDownRight,
  FileText, Users, Building2, Package, AlertTriangle,
  BookOpen, FolderTree, Heart, RefreshCw, Activity, Wallet,
  CreditCard, PiggyBank, ArrowRight,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts'

interface DashboardData {
  cashPosition: number
  cashInHand: number
  totalReceivables: number
  totalPayables: number
  recentVouchers: any[]
  typeSummaries: any[]
  budgetUtilization: any[]
  voucherStatusCounts: any[]
  counts: { accounts: number; vouchers: number; projects: number; donors: number; customers: number; suppliers: number; fixedAssets: number }
}

const COLORS = ['#16a34a', '#dc2626', '#ca8a04', '#0891b2', '#7c3aed']
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  posted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

function formatCompact(amount: number) {
  if (Math.abs(amount) >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
  if (Math.abs(amount) >= 1000) return `${(amount / 1000).toFixed(0)}K`
  return amount.toString()
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { setActiveModule } = useAppStore()

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      const d = await res.json()
      setData(d)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { queueMicrotask(() => fetchData()) }, [])

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6"><div className="h-24 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 animate-pulse"><CardContent className="p-6"><div className="h-64 bg-muted rounded" /></CardContent></Card>
          <Card className="animate-pulse"><CardContent className="p-6"><div className="h-64 bg-muted rounded" /></CardContent></Card>
        </div>
      </div>
    )
  }

  const netPosition = data.cashPosition + data.totalReceivables - data.totalPayables
  const totalIncome = data.typeSummaries.find((t: any) => t.type === 'INCOME')?.totalCredit || 0
  const totalExpenses = data.typeSummaries.find((t: any) => t.type === 'EXPENSE')?.totalDebit || 0
  const surplus = totalIncome - totalExpenses

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Financial Overview</h2>
          <p className="text-xs text-muted-foreground">FY 2024-25 • Real-time snapshot of your financial position</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fetchData}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Cash & Bank</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.cashPosition + data.cashInHand)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] text-muted-foreground">Bank: {formatCompact(data.cashPosition)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Banknote className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] text-muted-foreground">Cash: {formatCompact(data.cashInHand)}</span>
                  </div>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Receivables</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.totalReceivables)}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <ArrowUpRight className="h-3 w-3 text-blue-500" />
                  <span className="text-[10px] text-muted-foreground">Outstanding from customers</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Payables</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.totalPayables)}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  <span className="text-[10px] text-muted-foreground">Due to suppliers</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <CreditCard className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Net Position</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(netPosition)}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <PiggyBank className="h-3 w-3 text-violet-500" />
                  <span className="text-[10px] text-muted-foreground">Cash + Receivables − Payables</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                <Activity className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expense Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold text-orange-600 mt-1">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${surplus >= 0 ? 'border-l-emerald-400' : 'border-l-red-400'}`}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{surplus >= 0 ? 'Net Surplus' : 'Net Deficit'}</p>
            <p className={`text-xl font-bold mt-1 ${surplus >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(Math.abs(surplus))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Account Type Summary Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Account Type Summary</CardTitle>
                <CardDescription className="text-[10px]">Debit and Credit totals by account type</CardDescription>
              </div>
              <Badge variant="outline" className="text-[9px]">Posted Only</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.typeSummaries.map((t: any) => ({ ...t, type: t.type.charAt(0) + t.type.slice(1).toLowerCase() }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${formatCompact(v)}`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="totalDebit" fill="#16a34a" name="Debit" radius={[3, 3, 0, 0]} />
                <Bar dataKey="totalCredit" fill="#dc2626" name="Credit" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Voucher Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voucher Status</CardTitle>
            <CardDescription className="text-[10px]">{data.counts.vouchers} total vouchers</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.voucherStatusCounts.map((v: any) => ({ name: v.status, value: v._count.status }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {data.voucherStatusCounts.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Budget Utilization + Recent Vouchers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget Utilization */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Budget Utilization</CardTitle>
                <CardDescription className="text-[10px]">Budget vs Actual for active budgets</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setActiveModule('budgets')}>
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-72 overflow-y-auto">
            {data.budgetUtilization.map((b: any) => {
              const util = parseFloat(b.utilization)
              return (
                <div key={b.id} className="space-y-1.5 p-2 rounded-lg border hover:bg-accent/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium truncate max-w-[220px]">{b.name}</p>
                    <Badge variant={util > 90 ? 'destructive' : 'outline'} className="text-[9px]">
                      {util}%
                    </Badge>
                  </div>
                  <Progress value={Math.min(util, 100)} className="h-2" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Spent: {formatCurrency(b.totalSpent)}</span>
                    <span>Budget: {formatCurrency(b.totalBudget)}</span>
                  </div>
                  {util > 90 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span className="text-[9px] text-amber-600 font-medium">Approaching budget limit</span>
                    </div>
                  )}
                </div>
              )
            })}
            {data.budgetUtilization.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No active budgets</p>}
          </CardContent>
        </Card>

        {/* Recent Vouchers */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Recent Vouchers</CardTitle>
                <CardDescription className="text-[10px]">Latest voucher activity</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setActiveModule('vouchers')}>
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {data.recentVouchers.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    v.voucherType === 'BP' || v.voucherType === 'CP' ? 'bg-red-100 text-red-600' :
                    v.voucherType === 'BR' || v.voucherType === 'CR' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{v.voucherNumber}</p>
                      <Badge className={`text-[8px] px-1 py-0 ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-800'}`}>
                        {v.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{v.narration}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-bold">{formatCurrency(v.totalDebit)}</p>
                  <p className="text-[9px] text-muted-foreground">{new Date(v.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">System Overview</CardTitle>
          <CardDescription className="text-[10px]">Entity counts across all modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Accounts', value: data.counts.accounts, icon: BookOpen, color: 'text-emerald-600' },
              { label: 'Vouchers', value: data.counts.vouchers, icon: FileText, color: 'text-blue-600' },
              { label: 'Projects', value: data.counts.projects, icon: FolderTree, color: 'text-violet-600' },
              { label: 'Donors', value: data.counts.donors, icon: Heart, color: 'text-pink-600' },
              { label: 'Customers', value: data.counts.customers, icon: Users, color: 'text-cyan-600' },
              { label: 'Suppliers', value: data.counts.suppliers, icon: Building2, color: 'text-amber-600' },
              { label: 'Fixed Assets', value: data.counts.fixedAssets, icon: Package, color: 'text-teal-600' },
            ].map(stat => (
              <button
                key={stat.label}
                className="p-3 text-center rounded-lg border hover:bg-accent/50 transition-colors"
                onClick={() => {
                  const moduleMap: Record<string, string> = {
                    Accounts: 'chart-of-accounts', Vouchers: 'vouchers', Projects: 'projects',
                    Donors: 'donors', Customers: 'customers', Suppliers: 'suppliers', 'Fixed Assets': 'fixed-assets',
                  }
                  if (moduleMap[stat.label]) setActiveModule(moduleMap[stat.label] as any)
                }}
              >
                <stat.icon className={`h-5 w-5 mx-auto ${stat.color} mb-1.5`} />
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Integration Status</CardTitle>
          <CardDescription className="text-[10px]">Payroll and Fixed Assets integration touchpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Badge className="text-[8px] bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">INTEGRATION</Badge>
                  Payroll → GL
                </p>
                <Badge className="text-[9px] bg-green-100 text-green-800">Active</Badge>
              </div>
              <ul className="text-[10px] text-muted-foreground space-y-0.5">
                <li>• Salary expense auto-posts to GL after approval</li>
                <li>• Cross-charged costs to project cost centers</li>
                <li>• Social charges create accrual entries</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg border border-teal-200 bg-teal-50/50 dark:bg-teal-950/20 dark:border-teal-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Badge className="text-[8px] bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300">INTEGRATION</Badge>
                  Fixed Assets → GL
                </p>
                <Badge className="text-[9px] bg-green-100 text-green-800">Active</Badge>
              </div>
              <ul className="text-[10px] text-muted-foreground space-y-0.5">
                <li>• Monthly depreciation auto-generates journal entries</li>
                <li>• Asset disposals post gain/loss to GL</li>
                <li>• Donor-funded assets excluded from depreciation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
