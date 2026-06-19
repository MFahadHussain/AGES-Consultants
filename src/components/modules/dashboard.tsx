"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAppStore, hasPermission } from "@/lib/store";
import {
  Banknote,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Users,
  Building2,
  Package,
  AlertTriangle,
  BookOpen,
  FolderTree,
  Heart,
  RefreshCw,
  Activity,
  Wallet,
  CreditCard,
  PiggyBank,
  ArrowRight,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Shield,
  Eye,
  BarChart3,
  FileCheck,
  FilePlus2,
  Settings,
  UserCog,
  Download,
  Lock,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface DashboardData {
  cashPosition: number;
  cashInHand: number;
  totalReceivables: number;
  totalPayables: number;
  recentVouchers: any[];
  typeSummaries: any[];
  budgetUtilization: any[];
  voucherStatusCounts: any[];
  counts: {
    accounts: number;
    vouchers: number;
    projects: number;
    donors: number;
    customers: number;
    suppliers: number;
    fixedAssets: number;
  };
  pendingApprovals?: any[];
  auditStats?: { totalLogs: number; todayLogs: number; uniqueUsers: number };
  myDraftVouchers?: any[];
  approvalQueueCount?: number;
}

type UserRole = "admin" | "manager" | "accountant" | "auditor" | "viewer";

// ============================================================
// Role Permission Helpers
// ============================================================

const ROLE_CONFIG: Record<
  UserRole,
  { label: string; color: string; bgColor: string; description: string }
> = {
  admin: {
    label: "Administrator",
    color: "text-slate-900",
    bgColor: "bg-slate-100",
    description: "Full system access with all administrative controls",
  },
  manager: {
    label: "Manager",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    description: "Review, approve, and oversee financial operations",
  },
  accountant: {
    label: "Accountant",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    description: "Create and manage vouchers and financial entries",
  },
  auditor: {
    label: "Auditor",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    description: "Read-only access for audit and compliance review",
  },
  viewer: {
    label: "Viewer",
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    description: "View financial summaries and reports",
  },
};

function useCurrentUserRole(): UserRole {
  const { authUser } = useAppStore();
  if (hasPermission(authUser, 'ROLES_VIEW') || hasPermission(authUser, 'PERMISSIONS_VIEW') || authUser?.role === 'super_admin') return "admin";
  if (hasPermission(authUser, 'VOUCHERS_APPROVE') || hasPermission(authUser, 'USERS_EDIT')) return "manager";
  if (hasPermission(authUser, 'VOUCHERS_CREATE') || hasPermission(authUser, 'VOUCHERS_EDIT')) return "accountant";
  if (hasPermission(authUser, 'REPORTS_VIEW') && !hasPermission(authUser, 'VOUCHERS_CREATE')) return "auditor";
  return "viewer";
}

// ============================================================
// Formatting Helpers
// ============================================================

const COLORS = ["#0F2D78", "#dc2626", "#ca8a04", "#0891b2", "#7c3aed"];
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  pending: "bg-blue-100 text-blue-800",
  approved: "bg-[#EEF1F8] text-[#0F2D78]",
  posted: "bg-[#EEF1F8] text-[#0F2D78]",
  rejected: "bg-red-100 text-red-800",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompact(amount: number) {
  if (Math.abs(amount) >= 1000000) return `${Math.round(amount / 1000000)}M`;
  if (Math.abs(amount) >= 1000) return `${Math.round(amount / 1000)}K`;
  return amount.toString();
}

// ============================================================
// Lightweight Charts
// ============================================================

function SimpleBarChart({
  data,
  dataKey1,
  dataKey2,
  labelKey,
  name1,
  name2,
  color1,
  color2,
}: {
  data: any[];
  dataKey1: string;
  dataKey2: string;
  labelKey: string;
  name1: string;
  name2: string;
  color1: string;
  color2: string;
}) {
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d[dataKey1] || 0, d[dataKey2] || 0)),
    1,
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-[10px]">
        <span className="flex items-center gap-1">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: color1 }}
          />
          {name1}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: color2 }}
          />
          {name2}
        </span>
      </div>
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground">
              {item[labelKey]}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all"
                    style={{
                      width: `${Math.max(((item[dataKey1] || 0) / maxVal) * 100, 0)}%`,
                      background: color1,
                    }}
                  />
                </div>
                <span className="text-[9px] font-mono w-14 text-right">
                  {formatCompact(item[dataKey1] || 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all"
                    style={{
                      width: `${Math.max(((item[dataKey2] || 0) / maxVal) * 100, 0)}%`,
                      background: color2,
                    }}
                  />
                </div>
                <span className="text-[9px] font-mono w-14 text-right">
                  {formatCompact(item[dataKey2] || 0)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleDonutChart({
  data,
  colors,
  total,
}: {
  data: { name: string; value: number }[];
  colors: string[];
  total: number;
}) {
  if (data.length === 0)
    return (
      <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
        No data
      </div>
    );
  const segments = data.map((d, i) => ({
    ...d,
    percent: total > 0 ? (d.value / total) * 100 : 0,
    color: colors[i % colors.length],
  }));
  let gradient = "";
  let accumulated = 0;
  for (const seg of segments) {
    const start = accumulated;
    accumulated += seg.percent;
    gradient += `${seg.color} ${start}% ${accumulated}%, `;
  }
  gradient = gradient.slice(0, -2);

  return (
    <div className="flex items-center justify-center gap-4">
      <div className="relative">
        <div
          className="h-40 w-40 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="absolute inset-4 rounded-full bg-card flex items-center justify-center flex-col">
          <span className="text-xl font-bold">{total}</span>
          <span className="text-[9px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: seg.color }}
            />
            <span className="text-[10px]">
              {seg.name}: <strong>{seg.value}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Role-Based Welcome Banner
// ============================================================

function RoleWelcomeBanner({ role }: { role: UserRole }) {
  const { authUser } = useAppStore();
  const config = ROLE_CONFIG[role];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const name = authUser?.name || "User";

  const roleActionMap: Record<UserRole, { icon: any; label: string }> = {
    admin: { icon: Shield, label: "Full system control" },
    manager: { icon: ClipboardCheck, label: "Review & approve vouchers" },
    accountant: { icon: FilePlus2, label: "Create & manage entries" },
    auditor: { icon: Eye, label: "Audit & compliance review" },
    viewer: { icon: Eye, label: "View-only access" },
  };
  const RoleIcon = roleActionMap[role].icon;

  return (
    <Card className="border-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white overflow-hidden relative">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white" />
      </div>
      <CardContent className="p-5 relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-300">{greeting},</p>
            <h2 className="text-xl font-bold mt-0.5">{name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                className={`text-[10px] ${config.bgColor} ${config.color} border-0`}
              >
                <RoleIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              <span className="text-xs text-slate-400">
                {config.description}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] border-slate-600 text-slate-300"
            >
              FY 2024-25
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] border-slate-600 text-slate-300"
            >
              PKR
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Admin Dashboard — Full Access
// ============================================================

function AdminDashboard({
  data,
  onRefresh,
  onNavigate,
}: {
  data: DashboardData;
  onRefresh: () => void;
  onNavigate: (m: any) => void;
}) {
  const netPosition =
    data.cashPosition +
    data.cashInHand +
    data.totalReceivables -
    data.totalPayables;
  const totalIncome =
    data.typeSummaries.find((t: any) => t.type === "INCOME")?.totalCredit || 0;
  const totalExpenses =
    data.typeSummaries.find((t: any) => t.type === "EXPENSE")?.totalDebit || 0;
  const surplus = totalIncome - totalExpenses;
  const pendingCount =
    data.voucherStatusCounts.find((v: any) => v.status === "pending")?._count
      ?.status || 0;
  const draftCount =
    data.voucherStatusCounts.find((v: any) => v.status === "draft")?._count
      ?.status || 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Cash & Bank
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.cashPosition + data.cashInHand)}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] text-muted-foreground">
                      Bank: {formatCompact(data.cashPosition)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Banknote className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] text-muted-foreground">
                      Cash: {formatCompact(data.cashInHand)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-[#EEF1F8] text-[#0F2D78] flex items-center justify-center">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Total Receivables
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.totalReceivables)}
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <ArrowUpRight className="h-3 w-3 text-blue-500" />
                  <span className="text-[10px] text-muted-foreground">
                    Outstanding from customers
                  </span>
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
                <p className="text-xs font-medium text-muted-foreground">
                  Total Payables
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.totalPayables)}
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  <span className="text-[10px] text-muted-foreground">
                    Due to suppliers
                  </span>
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
                <p className="text-xs font-medium text-muted-foreground">
                  Net Position
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(netPosition)}
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <PiggyBank className="h-3 w-3 text-violet-500" />
                  <span className="text-[10px] text-muted-foreground">
                    Cash + Receivables − Payables
                  </span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                <Activity className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Action Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate("user-management")}
          className="p-3 rounded-xl border hover:bg-accent/50 transition-colors text-left group"
        >
          <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-2 group-hover:bg-slate-200 transition-colors">
            <UserCog className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold">Manage Users</p>
          <p className="text-[10px] text-muted-foreground">
            Roles & access control
          </p>
        </button>
        <button
          onClick={() => onNavigate("settings")}
          className="p-3 rounded-xl border hover:bg-accent/50 transition-colors text-left group"
        >
          <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-2 group-hover:bg-slate-200 transition-colors">
            <Settings className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold">System Settings</p>
          <p className="text-[10px] text-muted-foreground">
            Configure preferences
          </p>
        </button>
        <button
          onClick={() => onNavigate("audit-log")}
          className="p-3 rounded-xl border hover:bg-accent/50 transition-colors text-left group"
        >
          <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:bg-amber-100 transition-colors">
            <Shield className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold">Audit Trail</p>
          <p className="text-[10px] text-muted-foreground">Track all changes</p>
        </button>
        <button
          onClick={() => onNavigate("import-export")}
          className="p-3 rounded-xl border hover:bg-accent/50 transition-colors text-left group"
        >
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
            <Download className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold">Import / Export</p>
          <p className="text-[10px] text-muted-foreground">Data portability</p>
        </button>
      </div>

      {/* Income vs Expense Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold text-orange-600 mt-1">
              {formatCurrency(totalExpenses)}
            </p>
          </CardContent>
        </Card>
        <Card
          className={`border-l-4 ${surplus >= 0 ? "border-l-emerald-400" : "border-l-red-400"}`}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              {surplus >= 0 ? "Net Surplus" : "Net Deficit"}
            </p>
            <p
              className={`text-xl font-bold mt-1 ${surplus >= 0 ? "text-[#0F2D78]" : "text-red-600"}`}
            >
              {formatCurrency(Math.abs(surplus))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Account Type Summary</CardTitle>
                <CardDescription className="text-[10px]">
                  Debit and Credit totals by account type
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[9px]">
                Posted Only
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={data.typeSummaries.map((t: any) => ({
                ...t,
                type: t.type.charAt(0) + t.type.slice(1).toLowerCase(),
              }))}
              dataKey1="totalDebit"
              dataKey2="totalCredit"
              labelKey="type"
              name1="Debit"
              name2="Credit"
              color1="#0F2D78"
              color2="#dc2626"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voucher Status</CardTitle>
            <CardDescription className="text-[10px]">
              {data.counts.vouchers} total vouchers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleDonutChart
              data={data.voucherStatusCounts.map((v: any) => ({
                name: v.status,
                value: v._count.status,
              }))}
              colors={COLORS}
              total={data.counts.vouchers}
            />
          </CardContent>
        </Card>
      </div>

      {/* Budget Utilization + Recent Vouchers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Budget Utilization</CardTitle>
                <CardDescription className="text-[10px]">
                  Budget vs Actual for active budgets
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => onNavigate("budgets")}
              >
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-72 overflow-y-auto">
            {data.budgetUtilization.map((b: any) => {
              const util = parseFloat(b.utilization);
              return (
                <div
                  key={b.id}
                  className="space-y-1.5 p-2 rounded-lg border hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium truncate max-w-[220px]">
                      {b.name}
                    </p>
                    <Badge
                      variant={util > 90 ? "destructive" : "outline"}
                      className="text-[9px]"
                    >
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
                      <span className="text-[9px] text-amber-600 font-medium">
                        Approaching budget limit
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {data.budgetUtilization.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No active budgets
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Recent Vouchers</CardTitle>
                <CardDescription className="text-[10px]">
                  Latest voucher activity
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => onNavigate("vouchers")}
              >
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {data.recentVouchers.map((v: any) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      v.voucherType === "BP" || v.voucherType === "CP"
                        ? "bg-red-100 text-red-600"
                        : v.voucherType === "BR" || v.voucherType === "CR"
                          ? "bg-[#EEF1F8] text-[#0F2D78]"
                          : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{v.voucherNumber}</p>
                      <Badge
                        className={`text-[8px] px-1 py-0 ${STATUS_COLORS[v.status] || "bg-gray-100 text-gray-800"}`}
                      >
                        {v.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {v.narration}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-bold">
                    {formatCurrency(v.totalDebit)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(v.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* System Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">System Overview</CardTitle>
          <CardDescription className="text-[10px]">
            Entity counts across all modules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              {
                label: "Accounts",
                value: data.counts.accounts,
                icon: BookOpen,
                color: "text-[#0F2D78]",
                module: "chart-of-accounts",
              },
              {
                label: "Vouchers",
                value: data.counts.vouchers,
                icon: FileText,
                color: "text-blue-600",
                module: "vouchers",
              },
              {
                label: "Projects",
                value: data.counts.projects,
                icon: FolderTree,
                color: "text-violet-600",
                module: "projects",
              },
              {
                label: "Donors",
                value: data.counts.donors,
                icon: Heart,
                color: "text-pink-600",
                module: "donors",
              },
              {
                label: "Customers",
                value: data.counts.customers,
                icon: Users,
                color: "text-cyan-600",
                module: "customers",
              },
              {
                label: "Suppliers",
                value: data.counts.suppliers,
                icon: Building2,
                color: "text-amber-600",
                module: "suppliers",
              },
              {
                label: "Fixed Assets",
                value: data.counts.fixedAssets,
                icon: Package,
                color: "text-teal-600",
                module: "fixed-assets",
              },
            ].map((stat) => (
              <button
                key={stat.label}
                className="p-3 text-center rounded-lg border hover:bg-accent/50 transition-colors"
                onClick={() => onNavigate(stat.module as any)}
              >
                <stat.icon className={`h-5 w-5 mx-auto ${stat.color} mb-1.5`} />
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">
                  {stat.label}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Integration Status</CardTitle>
          <CardDescription className="text-[10px]">
            Payroll and Fixed Assets integration touchpoints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Badge className="text-[8px] bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                    INTEGRATION
                  </Badge>
                  Payroll → GL
                </p>
                <Badge className="text-[9px] bg-[#EEF1F8] text-[#0F2D78]">
                  Active
                </Badge>
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
                  <Badge className="text-[8px] bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300">
                    INTEGRATION
                  </Badge>
                  Fixed Assets → GL
                </p>
                <Badge className="text-[9px] bg-[#EEF1F8] text-[#0F2D78]">
                  Active
                </Badge>
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
  );
}

// ============================================================
// Manager Dashboard — Approval Focus
// ============================================================

function ManagerDashboard({
  data,
  onRefresh,
  onNavigate,
}: {
  data: DashboardData;
  onRefresh: () => void;
  onNavigate: (m: any) => void;
}) {
  const netPosition =
    data.cashPosition +
    data.cashInHand +
    data.totalReceivables -
    data.totalPayables;
  const totalIncome =
    data.typeSummaries.find((t: any) => t.type === "INCOME")?.totalCredit || 0;
  const totalExpenses =
    data.typeSummaries.find((t: any) => t.type === "EXPENSE")?.totalDebit || 0;
  const surplus = totalIncome - totalExpenses;
  const pendingCount =
    data.voucherStatusCounts.find((v: any) => v.status === "pending")?._count
      ?.status || 0;
  const draftCount =
    data.voucherStatusCounts.find((v: any) => v.status === "draft")?._count
      ?.status || 0;
  const postedCount =
    data.voucherStatusCounts.find((v: any) => v.status === "posted")?._count
      ?.status || 0;

  return (
    <div className="space-y-6">
      {/* Pending Approval Alert */}
      {pendingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Vouchers Awaiting Approval
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {pendingCount} voucher{pendingCount !== 1 ? "s" : ""}{" "}
                    pending your review
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs"
                onClick={() => onNavigate("vouchers")}
              >
                Review Now <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Cash & Bank
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.cashPosition + data.cashInHand)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-[#EEF1F8] text-[#0F2D78] flex items-center justify-center">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Net Position
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(netPosition)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                <Activity className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-amber-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Pending Approval
                </p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {pendingCount}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Draft Vouchers
                </p>
                <p className="text-2xl font-bold mt-1">{draftCount}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-yellow-100 text-yellow-600 flex items-center justify-center">
                <FileText className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expense */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold text-orange-600 mt-1">
              {formatCurrency(totalExpenses)}
            </p>
          </CardContent>
        </Card>
        <Card
          className={`border-l-4 ${surplus >= 0 ? "border-l-emerald-400" : "border-l-red-400"}`}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              {surplus >= 0 ? "Net Surplus" : "Net Deficit"}
            </p>
            <p
              className={`text-xl font-bold mt-1 ${surplus >= 0 ? "text-[#0F2D78]" : "text-red-600"}`}
            >
              {formatCurrency(Math.abs(surplus))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Voucher Status + Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voucher Pipeline</CardTitle>
            <CardDescription className="text-[10px]">
              Vouchers by status — your approval queue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleDonutChart
              data={data.voucherStatusCounts.map((v: any) => ({
                name: v.status,
                value: v._count.status,
              }))}
              colors={COLORS}
              total={data.counts.vouchers}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Budget Utilization</CardTitle>
                <CardDescription className="text-[10px]">
                  Active budget performance
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => onNavigate("budgets")}
              >
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-72 overflow-y-auto">
            {data.budgetUtilization.map((b: any) => {
              const util = parseFloat(b.utilization);
              return (
                <div
                  key={b.id}
                  className="space-y-1.5 p-2 rounded-lg border hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium truncate max-w-[220px]">
                      {b.name}
                    </p>
                    <Badge
                      variant={util > 90 ? "destructive" : "outline"}
                      className="text-[9px]"
                    >
                      {util}%
                    </Badge>
                  </div>
                  <Progress value={Math.min(util, 100)} className="h-2" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Spent: {formatCurrency(b.totalSpent)}</span>
                    <span>Budget: {formatCurrency(b.totalBudget)}</span>
                  </div>
                </div>
              );
            })}
            {data.budgetUtilization.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No active budgets
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Vouchers */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Recent Vouchers</CardTitle>
              <CardDescription className="text-[10px]">
                Latest voucher activity — click to review
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => onNavigate("vouchers")}
            >
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 max-h-72 overflow-y-auto">
          {data.recentVouchers.map((v: any) => (
            <div
              key={v.id}
              className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => onNavigate("vouchers")}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    v.status === "pending"
                      ? "bg-amber-100 text-amber-600"
                      : v.status === "draft"
                        ? "bg-yellow-100 text-yellow-600"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {v.status === "pending" ? (
                    <ClipboardCheck className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold">{v.voucherNumber}</p>
                    <Badge
                      className={`text-[8px] px-1 py-0 ${STATUS_COLORS[v.status] || "bg-gray-100 text-gray-800"}`}
                    >
                      {v.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {v.narration}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-xs font-bold">
                  {formatCurrency(v.totalDebit)}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {new Date(v.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Accountant Dashboard — Voucher Creation Focus
// ============================================================

function AccountantDashboard({
  data,
  onRefresh,
  onNavigate,
}: {
  data: DashboardData;
  onRefresh: () => void;
  onNavigate: (m: any) => void;
}) {
  const totalIncome =
    data.typeSummaries.find((t: any) => t.type === "INCOME")?.totalCredit || 0;
  const totalExpenses =
    data.typeSummaries.find((t: any) => t.type === "EXPENSE")?.totalDebit || 0;
  const draftCount =
    data.voucherStatusCounts.find((v: any) => v.status === "draft")?._count
      ?.status || 0;
  const pendingCount =
    data.voucherStatusCounts.find((v: any) => v.status === "pending")?._count
      ?.status || 0;

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate("vouchers")}
          className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-accent/30 transition-colors text-left group"
        >
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
            <FilePlus2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">New Voucher</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Create a new entry
          </p>
        </button>
        <button
          onClick={() => onNavigate("vouchers")}
          className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-accent/30 transition-colors text-left group"
        >
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-[#0F2D78] flex items-center justify-center mb-2 group-hover:bg-[#EEF1F8] transition-colors">
            <FileCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">My Drafts</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {draftCount} draft voucher{draftCount !== 1 ? "s" : ""}
          </p>
        </button>
        <button
          onClick={() => onNavigate("chart-of-accounts")}
          className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-accent/30 transition-colors text-left group"
        >
          <div className="h-10 w-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center mb-2 group-hover:bg-violet-100 transition-colors">
            <BookOpen className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">Chart of Accounts</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {data.counts.accounts} accounts
          </p>
        </button>
        <button
          onClick={() => onNavigate("reports")}
          className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-accent/30 transition-colors text-left group"
        >
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:bg-amber-100 transition-colors">
            <BarChart3 className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">Reports</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Financial statements
          </p>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Cash & Bank
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.cashPosition + data.cashInHand)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-[#EEF1F8] text-[#0F2D78] flex items-center justify-center">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Total Receivables
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.totalReceivables)}
                </p>
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
                <p className="text-xs font-medium text-muted-foreground">
                  Total Payables
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.totalPayables)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <CreditCard className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-yellow-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  My Work Queue
                </p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {draftCount + pendingCount}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {draftCount} drafts · {pendingCount} pending
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-yellow-100 text-yellow-600 flex items-center justify-center">
                <FileText className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expense */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold text-orange-600 mt-1">
              {formatCurrency(totalExpenses)}
            </p>
          </CardContent>
        </Card>
        <Card
          className={`border-l-4 ${totalIncome - totalExpenses >= 0 ? "border-l-emerald-400" : "border-l-red-400"}`}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              {totalIncome - totalExpenses >= 0 ? "Net Surplus" : "Net Deficit"}
            </p>
            <p
              className={`text-xl font-bold mt-1 ${totalIncome - totalExpenses >= 0 ? "text-[#0F2D78]" : "text-red-600"}`}
            >
              {formatCurrency(Math.abs(totalIncome - totalExpenses))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Vouchers + Voucher Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Recent Vouchers</CardTitle>
                <CardDescription className="text-[10px]">
                  Your latest voucher entries
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => onNavigate("vouchers")}
              >
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {data.recentVouchers.map((v: any) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => onNavigate("vouchers")}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      v.voucherType === "BP" || v.voucherType === "CP"
                        ? "bg-red-100 text-red-600"
                        : v.voucherType === "BR" || v.voucherType === "CR"
                          ? "bg-[#EEF1F8] text-[#0F2D78]"
                          : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{v.voucherNumber}</p>
                      <Badge
                        className={`text-[8px] px-1 py-0 ${STATUS_COLORS[v.status] || "bg-gray-100 text-gray-800"}`}
                      >
                        {v.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {v.narration}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-bold">
                    {formatCurrency(v.totalDebit)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(v.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voucher Status</CardTitle>
            <CardDescription className="text-[10px]">
              {data.counts.vouchers} total vouchers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleDonutChart
              data={data.voucherStatusCounts.map((v: any) => ({
                name: v.status,
                value: v._count.status,
              }))}
              colors={COLORS}
              total={data.counts.vouchers}
            />
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Accounts",
                value: data.counts.accounts,
                icon: BookOpen,
                color: "text-[#0F2D78]",
                module: "chart-of-accounts",
              },
              {
                label: "Vouchers",
                value: data.counts.vouchers,
                icon: FileText,
                color: "text-blue-600",
                module: "vouchers",
              },
              {
                label: "Customers",
                value: data.counts.customers,
                icon: Users,
                color: "text-cyan-600",
                module: "customers",
              },
              {
                label: "Suppliers",
                value: data.counts.suppliers,
                icon: Building2,
                color: "text-amber-600",
                module: "suppliers",
              },
            ].map((stat) => (
              <button
                key={stat.label}
                className="p-3 text-center rounded-lg border hover:bg-accent/50 transition-colors"
                onClick={() => onNavigate(stat.module as any)}
              >
                <stat.icon className={`h-5 w-5 mx-auto ${stat.color} mb-1.5`} />
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">
                  {stat.label}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Auditor Dashboard — Compliance & Audit Focus
// ============================================================

function AuditorDashboard({
  data,
  onRefresh,
  onNavigate,
}: {
  data: DashboardData;
  onRefresh: () => void;
  onNavigate: (m: any) => void;
}) {
  const netPosition =
    data.cashPosition +
    data.cashInHand +
    data.totalReceivables -
    data.totalPayables;
  const totalIncome =
    data.typeSummaries.find((t: any) => t.type === "INCOME")?.totalCredit || 0;
  const totalExpenses =
    data.typeSummaries.find((t: any) => t.type === "EXPENSE")?.totalDebit || 0;
  const surplus = totalIncome - totalExpenses;
  const approvedCount =
    data.voucherStatusCounts.find((v: any) => v.status === "approved")?._count
      ?.status || 0;
  const postedCount =
    data.voucherStatusCounts.find((v: any) => v.status === "posted")?._count
      ?.status || 0;
  const rejectedCount =
    data.voucherStatusCounts.find((v: any) => v.status === "rejected")?._count
      ?.status || 0;

  return (
    <div className="space-y-6">
      {/* Compliance Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-[#A5B4D2] bg-emerald-50/50">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-6 w-6 text-[#0F2D78] mx-auto mb-1" />
            <p className="text-lg font-bold text-emerald-700">{postedCount}</p>
            <p className="text-[10px] text-[#0F2D78] font-medium">
              Posted to GL
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-3 text-center">
            <FileCheck className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-blue-700">{approvedCount}</p>
            <p className="text-[10px] text-blue-600 font-medium">Approved</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-red-700">{rejectedCount}</p>
            <p className="text-[10px] text-red-600 font-medium">Rejected</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50/50">
          <CardContent className="p-3 text-center">
            <Shield className="h-6 w-6 text-slate-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-700">
              {data.counts.vouchers}
            </p>
            <p className="text-[10px] text-slate-600 font-medium">
              Total Vouchers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Cash & Bank
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(data.cashPosition + data.cashInHand)}
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Total Receivables
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(data.totalReceivables)}
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Total Payables
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(data.totalPayables)}
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Net Position
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(netPosition)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expense */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold text-orange-600 mt-1">
              {formatCurrency(totalExpenses)}
            </p>
          </CardContent>
        </Card>
        <Card
          className={`border-l-4 ${surplus >= 0 ? "border-l-emerald-400" : "border-l-red-400"}`}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              {surplus >= 0 ? "Net Surplus" : "Net Deficit"}
            </p>
            <p
              className={`text-xl font-bold mt-1 ${surplus >= 0 ? "text-[#0F2D78]" : "text-red-600"}`}
            >
              {formatCurrency(Math.abs(surplus))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Account Type Summary</CardTitle>
                <CardDescription className="text-[10px]">
                  Debit and Credit totals by account type
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[9px]">
                Read Only
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={data.typeSummaries.map((t: any) => ({
                ...t,
                type: t.type.charAt(0) + t.type.slice(1).toLowerCase(),
              }))}
              dataKey1="totalDebit"
              dataKey2="totalCredit"
              labelKey="type"
              name1="Debit"
              name2="Credit"
              color1="#0F2D78"
              color2="#dc2626"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voucher Status Breakdown</CardTitle>
            <CardDescription className="text-[10px]">
              {data.counts.vouchers} total vouchers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleDonutChart
              data={data.voucherStatusCounts.map((v: any) => ({
                name: v.status,
                value: v._count.status,
              }))}
              colors={COLORS}
              total={data.counts.vouchers}
            />
          </CardContent>
        </Card>
      </div>

      {/* Recent Vouchers + Audit Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Recent Vouchers</CardTitle>
                <CardDescription className="text-[10px]">
                  Latest activity for audit review
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => onNavigate("vouchers")}
              >
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {data.recentVouchers.map((v: any) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => onNavigate("vouchers")}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Eye className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{v.voucherNumber}</p>
                      <Badge
                        className={`text-[8px] px-1 py-0 ${STATUS_COLORS[v.status] || "bg-gray-100 text-gray-800"}`}
                      >
                        {v.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {v.narration}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-bold">
                    {formatCurrency(v.totalDebit)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(v.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Audit Navigation</CardTitle>
            <CardDescription className="text-[10px]">
              Quick access to audit-related modules
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              {
                label: "Audit Trail",
                desc: "Complete system change log",
                icon: Shield,
                color: "text-amber-600",
                bg: "bg-amber-50",
                module: "audit-log",
              },
              {
                label: "Financial Reports",
                desc: "Balance Sheet, P&L, Cash Flow",
                icon: BarChart3,
                color: "text-blue-600",
                bg: "bg-blue-50",
                module: "reports",
              },
              {
                label: "Chart of Accounts",
                desc: `${data.counts.accounts} accounts`,
                icon: BookOpen,
                color: "text-[#0F2D78]",
                bg: "bg-emerald-50",
                module: "chart-of-accounts",
              },
              {
                label: "Fixed Assets",
                desc: `${data.counts.fixedAssets} assets tracked`,
                icon: Package,
                color: "text-teal-600",
                bg: "bg-teal-50",
                module: "fixed-assets",
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => onNavigate(item.module as any)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
              >
                <div
                  className={`h-9 w-9 rounded-lg ${item.bg} ${item.color} flex items-center justify-center shrink-0`}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* System Overview (read-only) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">System Overview</CardTitle>
          <CardDescription className="text-[10px]">
            Entity counts — read-only audit reference
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              {
                label: "Accounts",
                value: data.counts.accounts,
                icon: BookOpen,
                color: "text-[#0F2D78]",
              },
              {
                label: "Vouchers",
                value: data.counts.vouchers,
                icon: FileText,
                color: "text-blue-600",
              },
              {
                label: "Projects",
                value: data.counts.projects,
                icon: FolderTree,
                color: "text-violet-600",
              },
              {
                label: "Donors",
                value: data.counts.donors,
                icon: Heart,
                color: "text-pink-600",
              },
              {
                label: "Customers",
                value: data.counts.customers,
                icon: Users,
                color: "text-cyan-600",
              },
              {
                label: "Suppliers",
                value: data.counts.suppliers,
                icon: Building2,
                color: "text-amber-600",
              },
              {
                label: "Fixed Assets",
                value: data.counts.fixedAssets,
                icon: Package,
                color: "text-teal-600",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-3 text-center rounded-lg border"
              >
                <stat.icon className={`h-5 w-5 mx-auto ${stat.color} mb-1.5`} />
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Viewer Dashboard — Minimal Read-Only
// ============================================================

function ViewerDashboard({
  data,
  onRefresh,
  onNavigate,
}: {
  data: DashboardData;
  onRefresh: () => void;
  onNavigate: (m: any) => void;
}) {
  const totalIncome =
    data.typeSummaries.find((t: any) => t.type === "INCOME")?.totalCredit || 0;
  const totalExpenses =
    data.typeSummaries.find((t: any) => t.type === "EXPENSE")?.totalDebit || 0;

  return (
    <div className="space-y-6">
      {/* Read-only notice */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                View-Only Access
              </p>
              <p className="text-xs text-muted-foreground">
                You can view financial summaries and reports. Contact your
                administrator for elevated access.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards — simplified */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Cash & Bank
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(data.cashPosition + data.cashInHand)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Total Receivables
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(data.totalReceivables)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Total Payables
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(data.totalPayables)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Total Vouchers
            </p>
            <p className="text-2xl font-bold mt-1">{data.counts.vouchers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expense */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Income</p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold text-orange-600 mt-1">
              {formatCurrency(totalExpenses)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Voucher Status + Reports Link */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voucher Status</CardTitle>
            <CardDescription className="text-[10px]">
              {data.counts.vouchers} total vouchers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleDonutChart
              data={data.voucherStatusCounts.map((v: any) => ({
                name: v.status,
                value: v._count.status,
              }))}
              colors={COLORS}
              total={data.counts.vouchers}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Available Reports</CardTitle>
            <CardDescription className="text-[10px]">
              Financial statements you can view
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => onNavigate("reports")}
              className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
            >
              <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold">Financial Reports</p>
                <p className="text-[10px] text-muted-foreground">
                  Balance Sheet, P&L, Cash Flow, and more
                </p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </button>
            <button
              onClick={() => onNavigate("chart-of-accounts")}
              className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
            >
              <div className="h-9 w-9 rounded-lg bg-emerald-50 text-[#0F2D78] flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold">Chart of Accounts</p>
                <p className="text-[10px] text-muted-foreground">
                  {data.counts.accounts} accounts in the system
                </p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Main Dashboard — Role Dispatcher
// ============================================================

const moduleRoutes: Record<string, string> = {
  dashboard: "/dashboard",
  "chart-of-accounts": "/accounting/chart-of-accounts",
  vouchers: "/accounting/vouchers",
  ledgers: "/accounting/ledger",
  "bank-reconciliation": "/accounting/bank-reconciliation",
  customers: "/masters/customers",
  suppliers: "/masters/suppliers",
  projects: "/projects",
  donors: "/projects/donors",
  locations: "/projects/locations",
  clients: "/projects/clients",
  budgets: "/planning/budgets",
  taxation: "/planning/taxation",
  aging: "/planning/aging",
  "financial-year": "/planning/financial-year",
  reports: "/reports/financial",
  "import-export": "/system/import-export",
  "audit-log": "/system/audit-log",
  settings: "/settings",
  "fixed-assets": "/integration/fixed-assets",
  payroll: "/payroll/engine",
  "user-management": "/system/user-management",
  employees: "/hr/employees",
  "employee-profile": "/hr/employees",
  "project-assignments": "/hr/project-assignments",
  allowances: "/hr/allowances",
  attendance: "/hr/attendance",
  loans: "/hr/loans",
  "tax-slabs": "/hr/tax-slabs",
  "payroll-gl-mapping": "/payroll/gl-mapping",
  "final-settlement": "/payroll/final-settlement",
  "payroll-slips": "/payroll/slips",
  "payroll-reports": "/payroll/reports",
  rbac: "/system/rbac",
  security: "/system/security",
};

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const role = useCurrentUserRole();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-muted rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 animate-pulse">
            <CardContent className="p-6">
              <div className="h-64 bg-muted rounded" />
            </CardContent>
          </Card>
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-64 bg-muted rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const navigate = (moduleKey: string) => {
    const route = moduleRoutes[moduleKey];
    if (route) router.push(route);
  };

  const dashboardProps = { data, onRefresh: fetchData, onNavigate: navigate };

  return (
    <div className="space-y-6">
      {/* Role-based welcome banner */}
      <RoleWelcomeBanner role={role} />

      {/* Role-specific refresh button */}
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={fetchData}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Dispatch to role-specific dashboard */}
      {role === "admin" && <AdminDashboard {...dashboardProps} />}
      {role === "manager" && <ManagerDashboard {...dashboardProps} />}
      {role === "accountant" && <AccountantDashboard {...dashboardProps} />}
      {role === "auditor" && <AuditorDashboard {...dashboardProps} />}
      {role === "viewer" && <ViewerDashboard {...dashboardProps} />}
    </div>
  );
}
