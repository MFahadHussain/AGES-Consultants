"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { type ModuleKey } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  FileText,
  Users,
  Building2,
  FolderTree,
  Heart,
  MapPin,
  Package,
  Search,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  module: ModuleKey;
  badge?: string;
  meta?: string;
}

const typeIcons: Record<string, any> = {
  account: BookOpen,
  voucher: FileText,
  customer: Users,
  supplier: Building2,
  project: FolderTree,
  donor: Heart,
  asset: Package,
  location: MapPin,
};

const typeLabels: Record<string, string> = {
  account: "Account",
  voucher: "Voucher",
  customer: "Customer",
  supplier: "Supplier",
  project: "Project",
  donor: "Donor",
  asset: "Fixed Asset",
  location: "Location",
};

const moduleRoutes: Record<ModuleKey, string> = {
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

const badgeStyles: Record<string, string> = {
  Active: "bg-[#EEF1F8] text-[#0F2D78]",
  Inactive: "bg-gray-100 text-gray-800",
  draft: "bg-yellow-100 text-yellow-800",
  pending: "bg-blue-100 text-blue-800",
  approved: "bg-[#EEF1F8] text-[#0F2D78]",
  posted: "bg-[#EEF1F8] text-[#0F2D78]",
  rejected: "bg-red-100 text-red-800",
  active: "bg-[#EEF1F8] text-[#0F2D78]",
  disposed: "bg-red-100 text-red-800",
  completed: "bg-[#EEF1F8] text-[#0F2D78]",
  "on-hold": "bg-orange-100 text-orange-800",
  Donor: "bg-pink-100 text-pink-800",
  Location: "bg-cyan-100 text-cyan-800",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset and focus input when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    setOpen(nextOpen);
  };

  // Debounced search
  const searchTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      setSelectedIndex(0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(value), 300);
  };

  const handleSelect = (result: SearchResult) => {
    router.push(moduleRoutes[result.module] ?? "/dashboard");
    setOpen(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  const typeOrder = [
    "voucher",
    "account",
    "customer",
    "supplier",
    "project",
    "donor",
    "asset",
    "location",
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Global Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search across vouchers, accounts, customers, suppliers, projects,
          donors, assets, and locations
        </DialogDescription>
        {/* Search Input */}
        <div className="flex items-center border-b px-3">
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search vouchers, accounts, customers, suppliers..."
            className="border-0 focus-visible:ring-0 h-11 text-sm"
          />
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-6 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                Type at least 2 characters to search
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                {[
                  "Vouchers",
                  "Accounts",
                  "Customers",
                  "Suppliers",
                  "Projects",
                  "Donors",
                  "Assets",
                  "Locations",
                ].map((t) => (
                  <Badge key={t} variant="outline" className="text-[9px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-6 text-center">
              <p className="text-xs text-muted-foreground">
                No results found for &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            <div className="py-1">
              {typeOrder.map((type) => {
                const items = grouped[type];
                if (!items) return null;
                const Icon = typeIcons[type] || FileText;
                return (
                  <div key={type}>
                    <div className="px-3 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Icon className="h-3 w-3" />
                        {typeLabels[type] || type}s
                      </p>
                    </div>
                    {items.map((item) => {
                      const globalIndex = results.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          data-index={globalIndex}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors",
                            globalIndex === selectedIndex && "bg-accent",
                          )}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                        >
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {item.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {item.subtitle}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.meta && (
                              <span className="text-[9px] text-muted-foreground hidden sm:inline">
                                {item.meta}
                              </span>
                            )}
                            {item.badge && (
                              <Badge
                                className={`text-[8px] ${badgeStyles[item.badge] || "bg-gray-100 text-gray-800"}`}
                              >
                                {item.badge}
                              </Badge>
                            )}
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono text-[9px]">
                ↑↓
              </kbd>{" "}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono text-[9px]">
                ↵
              </kbd>{" "}
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono text-[9px]">
                Esc
              </kbd>{" "}
              Close
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
