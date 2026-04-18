'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Banknote, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  FileText, Users, Building2, Package, AlertTriangle, Eye,
  BookOpen, FolderTree, Heart,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    queueMicrotask(() => {
      fetch('/api/dashboard')
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [])

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6"><div className="h-20 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    reviewed: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    posted: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Cash Position</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(data.cashPosition)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Bank: {formatCurrency(data.cashPosition)} | Cash: {formatCurrency(data.cashInHand)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Banknote className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Receivables</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(data.totalReceivables)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] text-emerald-600">Receivable</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Payables</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(data.totalPayables)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  <span className="text-[10px] text-red-600">Payable</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Net Position</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(data.cashPosition + data.totalReceivables - data.totalPayables)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Cash + Receivables - Payables</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                <Banknote className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Account Type Summary Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Account Type Summary</CardTitle>
            <CardDescription className="text-[10px]">Debit and Credit totals by account type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.typeSummaries.map(t => ({ ...t, type: t.type.charAt(0) + t.type.slice(1).toLowerCase() }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="totalDebit" fill="#16a34a" name="Debit" radius={[2, 2, 0, 0]} />
                <Bar dataKey="totalCredit" fill="#dc2626" name="Credit" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Voucher Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voucher Status</CardTitle>
            <CardDescription className="text-[10px]">Current voucher distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.voucherStatusCounts.map((v: any) => ({ name: v.status, value: v._count.status }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
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
            <CardTitle className="text-sm">Budget Utilization</CardTitle>
            <CardDescription className="text-[10px]">Budget vs Actual for active budgets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-72 overflow-y-auto">
            {data.budgetUtilization.map((b: any) => (
              <div key={b.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium truncate max-w-[200px]">{b.name}</p>
                  <span className="text-[10px] font-bold">{b.utilization}%</span>
                </div>
                <Progress value={parseFloat(b.utilization)} className="h-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Spent: {formatCurrency(b.totalSpent)}</span>
                  <span>Budget: {formatCurrency(b.totalBudget)}</span>
                </div>
              </div>
            ))}
            {data.budgetUtilization.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No active budgets</p>}
          </CardContent>
        </Card>

        {/* Recent Vouchers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Vouchers</CardTitle>
            <CardDescription className="text-[10px]">Latest voucher activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {data.recentVouchers.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{v.voucherNumber}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{v.narration}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold">{formatCurrency(v.totalDebit)}</span>
                  <Badge className={`text-[9px] px-1.5 py-0 ${statusColors[v.status] || 'bg-gray-100 text-gray-800'}`}>
                    {v.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Accounts', value: data.counts.accounts, icon: BookOpen },
          { label: 'Vouchers', value: data.counts.vouchers, icon: FileText },
          { label: 'Projects', value: data.counts.projects, icon: FolderTree },
          { label: 'Donors', value: data.counts.donors, icon: Heart },
          { label: 'Customers', value: data.counts.customers, icon: Users },
          { label: 'Suppliers', value: data.counts.suppliers, icon: Building2 },
          { label: 'Fixed Assets', value: data.counts.fixedAssets, icon: Package },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-3 text-center">
              <stat.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
