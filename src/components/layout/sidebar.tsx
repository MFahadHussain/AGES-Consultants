"use client";

import { useAppStore, type ModuleKey } from "@/lib/store";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  BookOpenCheck,
  Users,
  Building2,
  Landmark,
  FolderTree,
  Heart,
  MapPin,
  Briefcase,
  PieChart,
  Receipt,
  Clock,
  Calendar,
  FileBarChart,
  Download,
  Shield,
  Settings,
  Package,
  Banknote,
  ChevronDown,
  ChevronRight,
  Search,
  UserCog,
  UserCircle,
  GitBranch,
  Gift,
  CalendarCheck,
  HandCoins,
  Scale,
  Link2,
  FileCheck2,
  Printer,
  FileSpreadsheet,
  ShieldCheck,
  Lock,
  KeyRound,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/config/branding";

// ============================================================
// Role-Based Module Access Control
// ============================================================

type UserRole =
  | "admin"
  | "super_admin"
  | "system_admin"
  | "manager"
  | "accountant"
  | "auditor"
  | "viewer";

const ROLE_MODULES: Record<UserRole, ModuleKey[]> = {
  super_admin: [
    "dashboard",
    "chart-of-accounts",
    "vouchers",
    "ledgers",
    "bank-reconciliation",
    "customers",
    "suppliers",
    "projects",
    "donors",
    "locations",
    "clients",
    "budgets",
    "taxation",
    "aging",
    "financial-year",
    "reports",
    "fixed-assets",
    "payroll",
    "employees",
    "employee-profile",
    "project-assignments",
    "allowances",
    "attendance",
    "loans",
    "tax-slabs",
    "payroll-gl-mapping",
    "final-settlement",
    "payroll-slips",
    "payroll-reports",
    "user-management",
    "rbac",
    "security",
    "import-export",
    "audit-log",
    "settings",
  ],
  system_admin: [
    "dashboard",
    "chart-of-accounts",
    "vouchers",
    "ledgers",
    "bank-reconciliation",
    "customers",
    "suppliers",
    "projects",
    "donors",
    "locations",
    "clients",
    "budgets",
    "taxation",
    "aging",
    "financial-year",
    "reports",
    "fixed-assets",
    "payroll",
    "employees",
    "employee-profile",
    "project-assignments",
    "allowances",
    "attendance",
    "loans",
    "tax-slabs",
    "payroll-gl-mapping",
    "final-settlement",
    "payroll-slips",
    "payroll-reports",
    "user-management",
    "rbac",
    "security",
    "import-export",
    "audit-log",
    "settings",
  ],
  admin: [
    "dashboard",
    "chart-of-accounts",
    "vouchers",
    "ledgers",
    "bank-reconciliation",
    "customers",
    "suppliers",
    "projects",
    "donors",
    "locations",
    "clients",
    "budgets",
    "taxation",
    "aging",
    "financial-year",
    "reports",
    "fixed-assets",
    "payroll",
    "employees",
    "employee-profile",
    "project-assignments",
    "allowances",
    "attendance",
    "loans",
    "tax-slabs",
    "payroll-gl-mapping",
    "final-settlement",
    "payroll-slips",
    "payroll-reports",
    "user-management",
    "rbac",
    "security",
    "import-export",
    "audit-log",
    "settings",
  ],
  manager: [
    "dashboard",
    "chart-of-accounts",
    "vouchers",
    "ledgers",
    "bank-reconciliation",
    "customers",
    "suppliers",
    "projects",
    "donors",
    "locations",
    "clients",
    "budgets",
    "taxation",
    "aging",
    "financial-year",
    "reports",
    "fixed-assets",
    "payroll",
    "employees",
    "employee-profile",
    "project-assignments",
    "allowances",
    "attendance",
    "loans",
    "final-settlement",
    "payroll-slips",
    "payroll-reports",
    "audit-log",
  ],
  accountant: [
    "dashboard",
    "chart-of-accounts",
    "vouchers",
    "ledgers",
    "bank-reconciliation",
    "customers",
    "suppliers",
    "projects",
    "donors",
    "locations",
    "clients",
    "budgets",
    "taxation",
    "aging",
    "financial-year",
    "reports",
    "fixed-assets",
    "payroll",
    "employees",
    "employee-profile",
    "project-assignments",
    "allowances",
    "attendance",
    "loans",
    "payroll-gl-mapping",
    "payroll-slips",
    "payroll-reports",
  ],
  auditor: [
    "dashboard",
    "chart-of-accounts",
    "vouchers",
    "ledgers",
    "customers",
    "suppliers",
    "projects",
    "donors",
    "locations",
    "clients",
    "budgets",
    "aging",
    "financial-year",
    "reports",
    "fixed-assets",
    "payroll",
    "employees",
    "employee-profile",
    "attendance",
    "tax-slabs",
    "payroll-gl-mapping",
    "payroll-slips",
    "payroll-reports",
    "audit-log",
  ],
  viewer: [
    "dashboard",
    "chart-of-accounts",
    "ledgers",
    "projects",
    "donors",
    "reports",
  ],
};

function useAllowedModules(): Set<ModuleKey> {
  const { authUser } = useAppStore();
  const role = (authUser?.role || "viewer") as UserRole;
  const allowed = ROLE_MODULES[role] || ROLE_MODULES.viewer;
  return new Set(allowed);
}

// ============================================================
// Navigation Definition
// ============================================================

interface NavGroup {
  label: string;
  items: { key: ModuleKey; label: string; icon: any }[];
}

const navigation: NavGroup[] = [
  {
    label: "Overview",
    items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Accounting",
    items: [
      { key: "chart-of-accounts", label: "Chart of Accounts", icon: BookOpen },
      { key: "vouchers", label: "Voucher Management", icon: FileText },
      { key: "ledgers", label: "Ledgers & Sub-Ledgers", icon: BookOpenCheck },
      {
        key: "bank-reconciliation",
        label: "Bank Reconciliation",
        icon: Landmark,
      },
    ],
  },
  {
    label: "Masters",
    items: [
      { key: "customers", label: "Customers", icon: Users },
      { key: "suppliers", label: "Suppliers", icon: Building2 },
    ],
  },
  {
    label: "Project & Segment",
    items: [
      { key: "projects", label: "Projects", icon: FolderTree },
      { key: "donors", label: "Donors", icon: Heart },
      { key: "locations", label: "Locations", icon: MapPin },
      { key: "clients", label: "Clients", icon: Briefcase },
    ],
  },
  {
    label: "Planning & Control",
    items: [
      { key: "budgets", label: "Budget Management", icon: PieChart },
      { key: "taxation", label: "Taxation", icon: Receipt },
      { key: "aging", label: "Aging Analysis", icon: Clock },
      { key: "financial-year", label: "Financial Year", icon: Calendar },
    ],
  },
  {
    label: "HR & Payroll",
    items: [
      { key: "employees", label: "Employee Master", icon: UserCircle },
      { key: "employee-profile", label: "Employee Profile", icon: UserCircle },
      {
        key: "project-assignments",
        label: "Project Assignments",
        icon: GitBranch,
      },
      { key: "allowances", label: "Allowances & Benefits", icon: Gift },
      { key: "attendance", label: "Attendance", icon: CalendarCheck },
      { key: "loans", label: "Loans & Advances", icon: HandCoins },
      { key: "tax-slabs", label: "Tax Slabs", icon: Scale },
      { key: "payroll", label: "Payroll Engine", icon: Banknote },
      { key: "payroll-gl-mapping", label: "GL Account Mapping", icon: Link2 },
      { key: "final-settlement", label: "Final Settlement", icon: FileCheck2 },
      { key: "payroll-slips", label: "Payroll Slips & Letters", icon: Printer },
      {
        key: "payroll-reports",
        label: "Payroll Reports",
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    label: "Reports",
    items: [
      { key: "reports", label: "Financial Reports", icon: FileBarChart },
      { key: "timesheet-report", label: "Staff Timesheet Report", icon: Clock },
    ],
  },
  {
    label: "Integration",
    items: [{ key: "fixed-assets", label: "Fixed Assets", icon: Package }],
  },
  {
    label: "System",
    items: [
      { key: "user-management", label: "User Management", icon: UserCog },
      { key: "rbac", label: "Roles & Permissions", icon: KeyRound },
      { key: "security", label: "Security Center", icon: ShieldCheck },
      { key: "import-export", label: "Import / Export", icon: Download },
      { key: "audit-log", label: "Audit Trail", icon: Shield },
      { key: "settings", label: "Settings", icon: Settings },
    ],
  },
];

// ============================================================
// Sidebar Component
// ============================================================

const moduleRoutes: Record<string, string> = {
  dashboard: "/dashboard",
  "chart-of-accounts": "/accounting/chart-of-accounts",
  vouchers: "/accounting/vouchers",
  ledgers: "/accounting/ledger",
  customers: "/masters/customers",
  suppliers: "/masters/suppliers",
  "bank-reconciliation": "/accounting/bank-reconciliation",
  projects: "/projects",
  donors: "/projects/donors",
  locations: "/projects/locations",
  clients: "/projects/clients",
  budgets: "/planning/budgets",
  taxation: "/planning/taxation",
  aging: "/planning/aging",
  "financial-year": "/planning/financial-year",
  reports: "/reports/financial",
  "timesheet-report": "/reports/timesheet",
  "import-export": "/system/import-export",
  "audit-log": "/system/audit-log",
  settings: "/settings",
  "fixed-assets": "/integration/fixed-assets",
  payroll: "/payroll/engine",
  "user-management": "/system/user-management",
  employees: "/hr/employees",
  "employee-profile": "/hr/profile",
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

export function Sidebar() {
  const { sidebarOpen, searchQuery, setSearchQuery, authUser } = useAppStore();
  const router = useRouter();
  const pathname = usePathname();
  const allowedModules = useAllowedModules();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {
      Overview: true,
      Accounting: true,
      Masters: true,
      "HR & Payroll": true,
      Reports: true,
    },
  );

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Filter navigation by role + search
  const filteredNav = navigation
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => allowedModules.has(item.key === "timesheet-report" ? "reports" : item.key))
        .filter(
          (item) =>
            !searchQuery ||
            item.label.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    }))
    .filter((group) => group.items.length > 0);

  const role = (authUser?.role || "viewer") as UserRole;
  const roleBadgeColor: Record<UserRole, string> = {
    super_admin: "bg-red-600 text-white",
    system_admin: "bg-red-500 text-white",
    admin: "bg-slate-900 text-white",
    manager: "bg-blue-100 text-blue-700",
    accountant: "bg-[#EEF1F8] text-emerald-700",
    auditor: "bg-amber-100 text-amber-700",
    viewer: "bg-slate-100 text-slate-500",
  };

  return (
    <aside
      className={cn(
        "border-r bg-white transition-all duration-300 flex flex-col h-full overflow-hidden",
        sidebarOpen ? "w-[270px]" : "w-16",
      )}
      style={{ borderColor: "#E5E7EB" }}
    >
      {/* Logo */}
      <div className="border-b shrink-0" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src={BRAND.logoPath}
            alt={BRAND.companyName}
            className="h-9 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden w-9 h-9 rounded-md bg-[#0F2D78] flex items-center 
                          justify-center text-white font-bold text-sm shrink-0">
            {BRAND.initials}
          </div>
          {sidebarOpen && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="font-semibold text-sm truncate">{BRAND.companyName}</span>
              <span className="text-xs text-muted-foreground truncate">{BRAND.tagline}</span>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      {sidebarOpen && (
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search modules..."
              className="pl-8 h-8 text-xs bg-gray-50 border-gray-200 focus:border-[#0F2D78] focus:ring-[#0F2D78]/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0 px-2 py-1 custom-scrollbar">
        <div className="space-y-0.5">
          {filteredNav.map((group) => (
            <div key={group.label} className="mb-1">
              {sidebarOpen && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {group.label}
                  {expandedGroups[group.label] ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              )}
              {(!sidebarOpen || expandedGroups[group.label]) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const route = moduleRoutes[item.key] ?? "/dashboard";
                    const isActive =
                      pathname === route || pathname.startsWith(route + "/");
                    return sidebarOpen ? (
                      <button
                        key={item.key}
                        onClick={() => router.push(route)}
                        className={cn(
                          "flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                          isActive
                            ? "bg-[#EEF1F8] text-[#0F2D78] border-l-[3px] border-[#0F2D78]"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-l-[3px] border-transparent",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ) : (
                      <TooltipProvider key={item.key} delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => router.push(route)}
                              className={cn(
                                "flex items-center justify-center w-full rounded-md p-2.5 transition-all duration-150",
                                isActive
                                  ? "bg-[#EEF1F8] text-[#0F2D78]"
                                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600",
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              )}
              {sidebarOpen && group.label !== "System" && (
                <Separator className="my-1.5 bg-gray-100" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Role Badge + Version */}
      {sidebarOpen && (
        <div
          className="px-3 py-2.5 border-t shrink-0"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${roleBadgeColor[role] || "bg-slate-100 text-slate-500"}`}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </span>
            <span className="text-[10px] text-gray-400">
              {filteredNav.reduce((sum, g) => sum + g.items.length, 0)} modules
            </span>
          </div>
          <p className="text-[10px] text-gray-400">
            v1.0.0 &bull; Multi-Project &bull; Multi-Donor
          </p>
        </div>
      )}
    </aside>
  );
}
