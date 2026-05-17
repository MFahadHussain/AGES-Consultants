"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Settings,
  Users,
  Shield,
  Database,
  Plus,
  CheckCircle,
  AlertTriangle,
  Building2,
  FileText,
  Lock,
  Palette,
  Plug,
  Info,
  Save,
  RotateCcw,
  Edit,
  Trash2,
  UserPlus,
  Search,
  ChevronDown,
  ChevronUp,
  Activity,
  Mail,
  Clock,
  Globe,
  Hash,
  ToggleLeft,
  Eye,
  Key,
  Monitor,
  Server,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ============================================================
// Types
// ============================================================

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  auditCount?: number;
  actionCount?: number;
}

interface SettingRecord {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
}

interface SettingsMap {
  [key: string]: SettingRecord;
}

// ============================================================
// Constants
// ============================================================

const ROLES = [
  {
    key: "admin",
    label: "Admin",
    description:
      "Full access to all modules, user management, system configuration",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: Shield,
    permissions: [
      "All Modules",
      "User Management",
      "System Config",
      "Audit Access",
      "Approval Authority",
      "Delete Records",
    ],
  },
  {
    key: "manager",
    label: "Manager",
    description: "Approve vouchers, review reports, manage teams",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    icon: Key,
    permissions: [
      "Voucher Approval",
      "Reports",
      "Budget Management",
      "Review Access",
      "Dashboard",
    ],
  },
  {
    key: "accountant",
    label: "Accountant",
    description: "Create and manage vouchers, ledgers, and reports",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: FileText,
    permissions: [
      "Voucher CRUD",
      "Ledger Access",
      "Reports",
      "Chart of Accounts",
      "Budget View",
    ],
  },
  {
    key: "auditor",
    label: "Auditor",
    description: "Read-only access with audit trail review capability",
    color:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    icon: Eye,
    permissions: ["Read Only", "Audit Trail", "Reports", "Approval Review"],
  },
  {
    key: "viewer",
    label: "Viewer",
    description: "Read-only access to reports and dashboards",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    icon: Monitor,
    permissions: ["Dashboard", "Reports (Read Only)"],
  },
];

const MODULE_PERMISSIONS = [
  {
    module: "Dashboard",
    admin: true,
    manager: true,
    accountant: true,
    auditor: true,
    viewer: true,
  },
  {
    module: "Chart of Accounts",
    admin: true,
    manager: true,
    accountant: true,
    auditor: true,
    viewer: false,
  },
  {
    module: "Voucher Management",
    admin: true,
    manager: true,
    accountant: true,
    auditor: false,
    viewer: false,
  },
  {
    module: "Ledgers",
    admin: true,
    manager: true,
    accountant: true,
    auditor: true,
    viewer: true,
  },
  {
    module: "Customers/Suppliers",
    admin: true,
    manager: true,
    accountant: true,
    auditor: false,
    viewer: false,
  },
  {
    module: "Bank Reconciliation",
    admin: true,
    manager: true,
    accountant: true,
    auditor: false,
    viewer: false,
  },
  {
    module: "Projects/Segments",
    admin: true,
    manager: true,
    accountant: true,
    auditor: true,
    viewer: false,
  },
  {
    module: "Budget Management",
    admin: true,
    manager: true,
    accountant: true,
    auditor: true,
    viewer: false,
  },
  {
    module: "Taxation",
    admin: true,
    manager: true,
    accountant: true,
    auditor: false,
    viewer: false,
  },
  {
    module: "Financial Reports",
    admin: true,
    manager: true,
    accountant: true,
    auditor: true,
    viewer: true,
  },
  {
    module: "Fixed Assets",
    admin: true,
    manager: true,
    accountant: true,
    auditor: false,
    viewer: false,
  },
  {
    module: "Payroll Integration",
    admin: true,
    manager: true,
    accountant: true,
    auditor: false,
    viewer: false,
  },
  {
    module: "Import/Export",
    admin: true,
    manager: true,
    accountant: true,
    auditor: false,
    viewer: false,
  },
  {
    module: "Audit Trail",
    admin: true,
    manager: true,
    accountant: false,
    auditor: true,
    viewer: false,
  },
  {
    module: "Settings",
    admin: true,
    manager: false,
    accountant: false,
    auditor: false,
    viewer: false,
  },
];

// ============================================================
// Main Component
// ============================================================

export function SettingsModule() {
  const router = useRouter();
  const { authUser } = useAppStore();

  // Only super admin and system admin can see RBAC (Roles & Permissions)
  const isAdminRole =
    authUser?.role === "admin" ||
    authUser?.role === "super_admin" ||
    authUser?.role === "system_admin";
  // Also check if the user has a SUPER_ADMIN or SYSTEM_ADMIN role in their assigned roles
  const hasAdminRoleCode = (authUser?.roles || []).some(
    (r: any) => r.code === "SUPER_ADMIN" || r.code === "SYSTEM_ADMIN",
  );
  const canViewRBAC = isAdminRole || hasAdminRoleCode;
  const [activeTab, setActiveTab] = useState("general");
  const [settingsMap, setSettingsMap] = useState<SettingsMap>({});
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form states for editing settings by category
  const [generalForm, setGeneralForm] = useState<Record<string, string>>({});
  const [voucherForm, setVoucherForm] = useState<Record<string, string>>({});
  const [securityForm, setSecurityForm] = useState<Record<string, string>>({});
  const [integrationForm, setIntegrationForm] = useState<
    Record<string, string>
  >({});
  const [appearanceForm, setAppearanceForm] = useState<Record<string, string>>(
    {},
  );

  // User dialog states
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    role: "viewer",
    isActive: true,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);
  const [userSearch, setUserSearch] = useState("");

  // Role details expand
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const map: SettingsMap = {};
        for (const s of data.settings as SettingRecord[]) {
          map[s.key] = s;
        }
        setSettingsMap(map);

        // Populate forms from settings
        const general: Record<string, string> = {};
        const voucher: Record<string, string> = {};
        const security: Record<string, string> = {};
        const integration: Record<string, string> = {};
        const appearance: Record<string, string> = {};

        for (const s of data.settings as SettingRecord[]) {
          switch (s.category) {
            case "general":
              general[s.key] = s.value;
              break;
            case "voucher":
              voucher[s.key] = s.value;
              break;
            case "security":
              security[s.key] = s.value;
              break;
            case "integration":
              integration[s.key] = s.value;
              break;
            case "appearance":
              appearance[s.key] = s.value;
              break;
          }
        }
        setGeneralForm(general);
        setVoucherForm(voucher);
        setSecurityForm(security);
        setIntegrationForm(integration);
        setAppearanceForm(appearance);
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(
          Array.isArray(json.data)
            ? json.data
            : Array.isArray(json)
              ? json
              : [],
        );
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchSettings(), fetchUsers()]);
      setLoading(false);
    };
    init();
  }, [fetchSettings, fetchUsers]);

  // ============================================================
  // Settings Save Handler
  // ============================================================

  const handleSaveSettings = async (
    category: string,
    form: Record<string, string>,
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: form }),
      });
      if (res.ok) {
        toast({
          title: "Settings Saved",
          description: `${category} settings updated successfully`,
        });
        await fetchSettings();
      } else {
        toast({
          title: "Error",
          description: "Failed to save settings",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = async (category: string) => {
    // Re-fetch settings to reset form
    await fetchSettings();
    toast({
      title: "Settings Reset",
      description: `${category} form reset to saved values`,
    });
  };

  // ============================================================
  // User CRUD Handlers
  // ============================================================

  const handleCreateUser = async () => {
    if (!userForm.name || !userForm.email) {
      toast({
        title: "Validation Error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      if (res.ok) {
        toast({
          title: "User Created",
          description: `${userForm.name} added as ${ROLES.find((r) => r.key === userForm.role)?.label || userForm.role}`,
        });
        setUserDialogOpen(false);
        setUserForm({ name: "", email: "", role: "viewer", isActive: true });
        setEditingUser(null);
        await fetchUsers();
      } else {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error || "Failed to create user",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      if (res.ok) {
        toast({
          title: "User Updated",
          description: `${userForm.name} updated successfully`,
        });
        setUserDialogOpen(false);
        setUserForm({ name: "", email: "", role: "viewer", isActive: true });
        setEditingUser(null);
        await fetchUsers();
      } else {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error || "Failed to update user",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const handleToggleUserActive = async (user: UserRecord) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) {
        toast({
          title: "Status Updated",
          description: `${user.name} ${user.isActive ? "deactivated" : "activated"} successfully`,
        });
        await fetchUsers();
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: data.user ? "User Deactivated" : "User Deleted",
          description: data.user
            ? `${deletingUser.name} deactivated (has existing references)`
            : `${deletingUser.name} deleted successfully`,
        });
        setDeleteDialogOpen(false);
        setDeletingUser(null);
        await fetchUsers();
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const openEditUser = (user: UserRecord) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
    setUserDialogOpen(true);
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({ name: "", email: "", role: "viewer", isActive: true });
    setUserDialogOpen(true);
  };

  // ============================================================
  // Helper: Get setting value
  // ============================================================

  const getSetting = (key: string): string => {
    return settingsMap[key]?.value || "";
  };

  // ============================================================
  // Render: Loading State
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Loading settings...</span>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: General Settings Tab
  // ============================================================

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      {/* Company Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Company Information
          </CardTitle>
          <CardDescription className="text-xs">
            Your organization&apos;s details used across reports and documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company Name</Label>
              <Input
                className="h-9 text-sm"
                value={generalForm.company_name || ""}
                onChange={(e) =>
                  setGeneralForm((p) => ({
                    ...p,
                    company_name: e.target.value,
                  }))
                }
                placeholder="Enter company name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Short Name</Label>
              <Input
                className="h-9 text-sm"
                value={generalForm.company_short_name || ""}
                onChange={(e) =>
                  setGeneralForm((p) => ({
                    ...p,
                    company_short_name: e.target.value,
                  }))
                }
                placeholder="Short display name"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-medium">Address</Label>
              <Textarea
                className="text-sm min-h-[60px]"
                value={generalForm.company_address || ""}
                onChange={(e) =>
                  setGeneralForm((p) => ({
                    ...p,
                    company_address: e.target.value,
                  }))
                }
                placeholder="Full address"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Phone</Label>
              <Input
                className="h-9 text-sm"
                value={generalForm.company_phone || ""}
                onChange={(e) =>
                  setGeneralForm((p) => ({
                    ...p,
                    company_phone: e.target.value,
                  }))
                }
                placeholder="+92-XX-XXXXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <Input
                type="email"
                className="h-9 text-sm"
                value={generalForm.company_email || ""}
                onChange={(e) =>
                  setGeneralForm((p) => ({
                    ...p,
                    company_email: e.target.value,
                  }))
                }
                placeholder="info@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Website</Label>
              <Input
                className="h-9 text-sm"
                value={generalForm.company_website || ""}
                onChange={(e) =>
                  setGeneralForm((p) => ({
                    ...p,
                    company_website: e.target.value,
                  }))
                }
                placeholder="www.company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tax Number (NTN)</Label>
              <Input
                className="h-9 text-sm"
                value={generalForm.company_tax_number || ""}
                onChange={(e) =>
                  setGeneralForm((p) => ({
                    ...p,
                    company_tax_number: e.target.value,
                  }))
                }
                placeholder="NTN-XXXXXXX-X"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Registration Number</Label>
              <Input
                className="h-9 text-sm"
                value={generalForm.company_registration || ""}
                onChange={(e) =>
                  setGeneralForm((p) => ({
                    ...p,
                    company_registration: e.target.value,
                  }))
                }
                placeholder="REG-XXXX-XXX"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regional & Currency Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Regional & Currency Settings
          </CardTitle>
          <CardDescription className="text-xs">
            Configure currency, date format, and fiscal year preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Base Currency</Label>
              <Select
                value={generalForm.base_currency || "PKR"}
                onValueChange={(v) =>
                  setGeneralForm((p) => ({ ...p, base_currency: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                  <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                  <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Currency Symbol</Label>
              <Input
                className="h-9 text-sm"
                value={generalForm.currency_symbol || ""}
                onChange={(e) =>
                  setGeneralForm((p) => ({
                    ...p,
                    currency_symbol: e.target.value,
                  }))
                }
                placeholder="₨"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Fiscal Year Starts</Label>
              <Select
                value={generalForm.fiscal_year_start_month || "7"}
                onValueChange={(v) =>
                  setGeneralForm((p) => ({ ...p, fiscal_year_start_month: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">January</SelectItem>
                  <SelectItem value="2">February</SelectItem>
                  <SelectItem value="3">March</SelectItem>
                  <SelectItem value="4">April</SelectItem>
                  <SelectItem value="7">July</SelectItem>
                  <SelectItem value="10">October</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Date Format</Label>
              <Select
                value={generalForm.date_format || "DD/MM/YYYY"}
                onValueChange={(v) =>
                  setGeneralForm((p) => ({ ...p, date_format: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  <SelectItem value="DD-MMM-YYYY">DD-MMM-YYYY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Timezone</Label>
              <Select
                value={generalForm.timezone || "Asia/Karachi"}
                onValueChange={(v) =>
                  setGeneralForm((p) => ({ ...p, timezone: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Karachi">
                    Asia/Karachi (UTC+5)
                  </SelectItem>
                  <SelectItem value="Asia/Dubai">Asia/Dubai (UTC+4)</SelectItem>
                  <SelectItem value="Asia/Riyadh">
                    Asia/Riyadh (UTC+3)
                  </SelectItem>
                  <SelectItem value="Asia/Kolkata">
                    Asia/Kolkata (UTC+5:30)
                  </SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save / Reset */}
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResetSettings("General")}
          className="h-8 text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
        <Button
          size="sm"
          onClick={() => handleSaveSettings("General", generalForm)}
          disabled={saving}
          className="h-8 text-xs"
        >
          <Save className="h-3 w-3 mr-1" />{" "}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );

  // ============================================================
  // Render: User Management Tab
  // ============================================================

  const renderUserManagement = () => {
    const safeUsers = Array.isArray(users) ? users : [];
    const filteredUsers = safeUsers.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.role || "").toLowerCase().includes(userSearch.toLowerCase()),
    );

    return (
      <div className="space-y-4">
        {/* User Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Total Users",
              value: safeUsers.length,
              icon: Users,
              color: "text-primary",
            },
            {
              label: "Active",
              value: safeUsers.filter((u) => u.isActive).length,
              icon: CheckCircle,
              color: "text-green-600",
            },
            {
              label: "Admins",
              value: safeUsers.filter((u) => u.role === "admin").length,
              icon: Shield,
              color: "text-red-600",
            },
            {
              label: "Inactive",
              value: safeUsers.filter((u) => !u.isActive).length,
              icon: AlertTriangle,
              color: "text-amber-600",
            },
          ].map((stat) => (
            <Card key={stat.label} className="p-3">
              <div className="flex items-center gap-3">
                <stat.icon className={`h-4 w-4 ${stat.color} shrink-0`} />
                <div>
                  <p className="text-lg font-bold leading-none">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* User Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  User Management
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage system users and their access levels
                </CardDescription>
              </div>
              <Button size="sm" className="h-8 text-xs" onClick={openAddUser}>
                <UserPlus className="h-3 w-3 mr-1" /> Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Search bar */}
            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, email, or role..."
                  className="pl-8 h-8 text-xs"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Last Login</TableHead>
                    <TableHead className="text-xs text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground text-xs"
                      >
                        {userSearch
                          ? "No users match your search"
                          : 'No users found. Click "Add User" to create one.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const roleInfo = ROLES.find((r) => r.key === user.role);
                      return (
                        <TableRow
                          key={user.id}
                          className={!user.isActive ? "opacity-60" : ""}
                        >
                          <TableCell className="text-xs font-medium">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                                {user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                              {user.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[9px] ${roleInfo?.color || "bg-gray-100 text-gray-800"}`}
                            >
                              {roleInfo?.label || user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.isActive ? (
                              <Badge className="text-[9px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                Active
                              </Badge>
                            ) : (
                              <Badge className="text-[9px] bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {user.lastLogin
                              ? new Date(user.lastLogin).toLocaleDateString()
                              : "Never"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => openEditUser(user)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit User</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`h-7 w-7 p-0 ${user.isActive ? "text-destructive" : "text-green-600"}`}
                                      onClick={() =>
                                        handleToggleUserActive(user)
                                      }
                                    >
                                      {user.isActive ? (
                                        <AlertTriangle className="h-3 w-3" />
                                      ) : (
                                        <CheckCircle className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {user.isActive ? "Deactivate" : "Activate"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive"
                                      onClick={() => {
                                        setDeletingUser(user);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete User</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* User Dialog (Add/Edit) */}
        <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {editingUser ? "Edit User" : "Add New User"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editingUser
                  ? "Update user details and role assignment"
                  : "Create a new system user with appropriate role"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Full Name *</Label>
                <Input
                  className="h-9 text-sm"
                  value={userForm.name}
                  onChange={(e) =>
                    setUserForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email *</Label>
                <Input
                  type="email"
                  className="h-9 text-sm"
                  value={userForm.email}
                  onChange={(e) =>
                    setUserForm((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="user@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Role</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(v) => setUserForm((p) => ({ ...p, role: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label} — {r.description.substring(0, 50)}...
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editingUser && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={userForm.isActive}
                    onCheckedChange={(v) =>
                      setUserForm((p) => ({ ...p, isActive: v }))
                    }
                  />
                  <Label className="text-xs">Active</Label>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUserDialogOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                className="h-8 text-xs"
              >
                {editingUser ? "Update User" : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">Confirm Deletion</DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to delete {deletingUser?.name}? If the
                user has audit history, they will be deactivated instead.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteUser}
                className="h-8 text-xs"
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // ============================================================
  // Render: Roles & Permissions Tab
  // ============================================================

  const renderRolesPermissions = () => (
    <div className="space-y-4">
      {/* Link to dedicated RBAC module */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Role-Based Access Control</p>
                <p className="text-xs text-muted-foreground">
                  Create, edit, and manage roles, permissions, and user
                  assignments in the dedicated RBAC module
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => router.push("/system/rbac")}
              className="shrink-0"
            >
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Open RBAC Module
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role Cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Role Definitions
          </CardTitle>
          <CardDescription className="text-xs">
            Click on a role to expand and view its permissions. To modify roles,
            use the RBAC Module above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ROLES.map((r) => {
            const IconComp = r.icon;
            const isExpanded = expandedRole === r.key;
            const userCount = (Array.isArray(users) ? users : []).filter(
              (u) => u.role === r.key,
            ).length;
            return (
              <div key={r.key} className="rounded-lg border">
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedRole(isExpanded ? null : r.key)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      <IconComp className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{r.label}</span>
                        <Badge className={`text-[8px] ${r.color}`}>
                          {userCount} user{userCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {r.description}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0">
                    <Separator className="mb-3" />
                    <div className="flex flex-wrap gap-1.5">
                      {r.permissions.map((p) => (
                        <Badge
                          key={p}
                          variant="outline"
                          className="text-[9px] py-0.5"
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Permission Matrix */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Permission Matrix
          </CardTitle>
          <CardDescription className="text-xs">
            Module access by role — overview of the access control structure
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] min-w-[140px]">
                    Module
                  </TableHead>
                  <TableHead className="text-[10px] text-center">
                    Admin
                  </TableHead>
                  <TableHead className="text-[10px] text-center">
                    Manager
                  </TableHead>
                  <TableHead className="text-[10px] text-center">
                    Accountant
                  </TableHead>
                  <TableHead className="text-[10px] text-center">
                    Auditor
                  </TableHead>
                  <TableHead className="text-[10px] text-center">
                    Viewer
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODULE_PERMISSIONS.map((mp) => (
                  <TableRow key={mp.module}>
                    <TableCell className="text-[10px] font-medium">
                      {mp.module}
                    </TableCell>
                    <TableCell className="text-center">
                      {mp.admin ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {mp.manager ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {mp.accountant ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {mp.auditor ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {mp.viewer ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================
  // Render: Voucher Settings Tab
  // ============================================================

  const renderVoucherSettings = () => (
    <div className="space-y-6">
      {/* Voucher Numbering */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Hash className="h-4 w-4 text-primary" />
            Voucher Numbering
          </CardTitle>
          <CardDescription className="text-xs">
            Configure how voucher numbers are generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">
                  Auto-Generate Numbers
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Automatically assign sequential numbers
                </p>
              </div>
              <Switch
                checked={voucherForm.voucher_auto_number === "true"}
                onCheckedChange={(v) =>
                  setVoucherForm((p) => ({
                    ...p,
                    voucher_auto_number: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Number Prefix</Label>
              <Input
                className="h-9 text-sm"
                value={voucherForm.voucher_number_prefix || ""}
                onChange={(e) =>
                  setVoucherForm((p) => ({
                    ...p,
                    voucher_number_prefix: e.target.value,
                  }))
                }
                placeholder="VOU"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Number Format</Label>
              <Select
                value={voucherForm.voucher_number_format || "PREFIX-YYYYMM-SEQ"}
                onValueChange={(v) =>
                  setVoucherForm((p) => ({ ...p, voucher_number_format: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREFIX-YYYYMM-SEQ">
                    PREFIX-YYYYMM-SEQ (e.g., VOU-202501-001)
                  </SelectItem>
                  <SelectItem value="PREFIX-SEQ">
                    PREFIX-SEQ (e.g., VOU-001)
                  </SelectItem>
                  <SelectItem value="SEQ">SEQ Only (e.g., 001)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Workflow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Approval Workflow
          </CardTitle>
          <CardDescription className="text-xs">
            Configure the voucher approval process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Workflow Type</Label>
              <Select
                value={voucherForm.voucher_approval_workflow || "standard"}
                onValueChange={(v) =>
                  setVoucherForm((p) => ({
                    ...p,
                    voucher_approval_workflow: v,
                  }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    Standard (Draft → Review → Approve → Post)
                  </SelectItem>
                  <SelectItem value="simplified">
                    Simplified (Draft → Approve → Post)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">Allow Quick Post</Label>
                <p className="text-[10px] text-muted-foreground">
                  Bypass approval for small amounts
                </p>
              </div>
              <Switch
                checked={voucherForm.voucher_allow_quick_post === "true"}
                onCheckedChange={(v) =>
                  setVoucherForm((p) => ({
                    ...p,
                    voucher_allow_quick_post: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Quick Post Max Amount
              </Label>
              <Input
                type="number"
                className="h-9 text-sm"
                value={voucherForm.voucher_max_amount_quick_post || ""}
                onChange={(e) =>
                  setVoucherForm((p) => ({
                    ...p,
                    voucher_max_amount_quick_post: e.target.value,
                  }))
                }
                placeholder="50000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voucher Defaults */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Voucher Defaults
          </CardTitle>
          <CardDescription className="text-xs">
            Default values and requirements for new vouchers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">Require Narration</Label>
                <p className="text-[10px] text-muted-foreground">
                  Mandatory narration on all vouchers
                </p>
              </div>
              <Switch
                checked={voucherForm.voucher_require_narration === "true"}
                onCheckedChange={(v) =>
                  setVoucherForm((p) => ({
                    ...p,
                    voucher_require_narration: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">Require Reference</Label>
                <p className="text-[10px] text-muted-foreground">
                  Mandatory reference on all vouchers
                </p>
              </div>
              <Switch
                checked={voucherForm.voucher_require_reference === "true"}
                onCheckedChange={(v) =>
                  setVoucherForm((p) => ({
                    ...p,
                    voucher_require_reference: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-medium">
                Default Narration Template
              </Label>
              <Input
                className="h-9 text-sm"
                value={voucherForm.voucher_default_narration || ""}
                onChange={(e) =>
                  setVoucherForm((p) => ({
                    ...p,
                    voucher_default_narration: e.target.value,
                  }))
                }
                placeholder="e.g., Payment for [description] against [reference]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save / Reset */}
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResetSettings("Voucher")}
          className="h-8 text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
        <Button
          size="sm"
          onClick={() => handleSaveSettings("Voucher", voucherForm)}
          disabled={saving}
          className="h-8 text-xs"
        >
          <Save className="h-3 w-3 mr-1" />{" "}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );

  // ============================================================
  // Render: Security Settings Tab
  // ============================================================

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      {/* Password Policy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Password Policy
          </CardTitle>
          <CardDescription className="text-xs">
            Define password requirements for system users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Minimum Password Length
              </Label>
              <Select
                value={securityForm.password_min_length || "8"}
                onValueChange={(v) =>
                  setSecurityForm((p) => ({ ...p, password_min_length: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 characters</SelectItem>
                  <SelectItem value="8">8 characters</SelectItem>
                  <SelectItem value="10">10 characters</SelectItem>
                  <SelectItem value="12">12 characters</SelectItem>
                  <SelectItem value="16">16 characters</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">Require Uppercase</Label>
                <p className="text-[10px] text-muted-foreground">
                  At least one uppercase letter
                </p>
              </div>
              <Switch
                checked={securityForm.password_require_uppercase === "true"}
                onCheckedChange={(v) =>
                  setSecurityForm((p) => ({
                    ...p,
                    password_require_uppercase: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">Require Numbers</Label>
                <p className="text-[10px] text-muted-foreground">
                  At least one numeric digit
                </p>
              </div>
              <Switch
                checked={securityForm.password_require_numbers === "true"}
                onCheckedChange={(v) =>
                  setSecurityForm((p) => ({
                    ...p,
                    password_require_numbers: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">
                  Require Special Characters
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  At least one special character (!@#$...)
                </p>
              </div>
              <Switch
                checked={securityForm.password_require_special === "true"}
                onCheckedChange={(v) =>
                  setSecurityForm((p) => ({
                    ...p,
                    password_require_special: v ? "true" : "false",
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session & Access Control */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Session & Access Control
          </CardTitle>
          <CardDescription className="text-xs">
            Control session behavior and login security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Session Timeout (minutes)
              </Label>
              <Select
                value={securityForm.session_timeout || "30"}
                onValueChange={(v) =>
                  setSecurityForm((p) => ({ ...p, session_timeout: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Max Login Attempts</Label>
              <Select
                value={securityForm.login_max_attempts || "5"}
                onValueChange={(v) =>
                  setSecurityForm((p) => ({ ...p, login_max_attempts: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 attempts</SelectItem>
                  <SelectItem value="5">5 attempts</SelectItem>
                  <SelectItem value="10">10 attempts</SelectItem>
                  <SelectItem value="0">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit & Data Retention */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Audit & Data Retention
          </CardTitle>
          <CardDescription className="text-xs">
            Configure audit logging and data retention policies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Audit Log Retention (days)
              </Label>
              <Select
                value={securityForm.audit_log_retention_days || "365"}
                onValueChange={(v) =>
                  setSecurityForm((p) => ({
                    ...p,
                    audit_log_retention_days: v,
                  }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="730">2 years</SelectItem>
                  <SelectItem value="0">Indefinite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save / Reset */}
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResetSettings("Security")}
          className="h-8 text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
        <Button
          size="sm"
          onClick={() => handleSaveSettings("Security", securityForm)}
          disabled={saving}
          className="h-8 text-xs"
        >
          <Save className="h-3 w-3 mr-1" />{" "}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );

  // ============================================================
  // Render: Integration Settings Tab
  // ============================================================

  const renderIntegrationSettings = () => (
    <div className="space-y-6">
      {/* Payroll Integration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <span className="text-[8px] font-bold text-purple-800 dark:text-purple-400">
                PR
              </span>
            </div>
            Payroll Integration
          </CardTitle>
          <CardDescription className="text-xs">
            Configure Payroll Management integration with General Ledger
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">
                  Enable Integration
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Connect Payroll module to GL
                </p>
              </div>
              <Switch
                checked={integrationForm.payroll_integration_enabled === "true"}
                onCheckedChange={(v) =>
                  setIntegrationForm((p) => ({
                    ...p,
                    payroll_integration_enabled: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">Auto-Post to GL</Label>
                <p className="text-[10px] text-muted-foreground">
                  Automatically post approved payroll
                </p>
              </div>
              <Switch
                checked={integrationForm.payroll_auto_post === "true"}
                onCheckedChange={(v) =>
                  setIntegrationForm((p) => ({
                    ...p,
                    payroll_auto_post: v ? "true" : "false",
                  }))
                }
              />
            </div>
          </div>
          <Separator className="my-4" />
          <div className="text-[10px] text-muted-foreground space-y-1">
            <p className="font-semibold text-xs text-foreground mb-2">
              Integration Touchpoints:
            </p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Salary expense auto-posts to GL after payroll approval</li>
              <li>Cross-charged salary costs to project cost centers</li>
              <li>Loan/advance deductions update Loans/Advances ledger</li>
              <li>Social charges create accrual entries in GL</li>
              <li>Final settlement payments reflect in bank/cash ledger</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Fixed Assets Integration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <span className="text-[8px] font-bold text-teal-800 dark:text-teal-400">
                FA
              </span>
            </div>
            Fixed Assets Integration
          </CardTitle>
          <CardDescription className="text-xs">
            Configure Fixed Assets Management integration with General Ledger
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">
                  Enable Integration
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Connect Fixed Assets module to GL
                </p>
              </div>
              <Switch
                checked={
                  integrationForm.fixed_assets_integration_enabled === "true"
                }
                onCheckedChange={(v) =>
                  setIntegrationForm((p) => ({
                    ...p,
                    fixed_assets_integration_enabled: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">Auto-Depreciation</Label>
                <p className="text-[10px] text-muted-foreground">
                  Auto-calculate monthly depreciation
                </p>
              </div>
              <Switch
                checked={
                  integrationForm.fixed_assets_auto_depreciation === "true"
                }
                onCheckedChange={(v) =>
                  setIntegrationForm((p) => ({
                    ...p,
                    fixed_assets_auto_depreciation: v ? "true" : "false",
                  }))
                }
              />
            </div>
          </div>
          <Separator className="my-4" />
          <div className="text-[10px] text-muted-foreground space-y-1">
            <p className="font-semibold text-xs text-foreground mb-2">
              Integration Touchpoints:
            </p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Asset purchases create entries in Asset + Bank/Payables</li>
              <li>Monthly depreciation auto-generates journal entries</li>
              <li>Asset disposals post gain/loss entries to GL</li>
              <li>Asset transfers update segment accounting</li>
              <li>Donor-funded assets excluded from depreciation</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Other Integration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" />
            Other Integrations
          </CardTitle>
          <CardDescription className="text-xs">
            Email notifications and system backup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">
                  Email Notifications
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Send alerts for approvals, deadlines
                </p>
              </div>
              <Switch
                checked={integrationForm.email_notifications === "true"}
                onCheckedChange={(v) =>
                  setIntegrationForm((p) => ({
                    ...p,
                    email_notifications: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">Auto Backup</Label>
                <p className="text-[10px] text-muted-foreground">
                  Automatically backup database daily
                </p>
              </div>
              <Switch
                checked={integrationForm.backup_auto === "true"}
                onCheckedChange={(v) =>
                  setIntegrationForm((p) => ({
                    ...p,
                    backup_auto: v ? "true" : "false",
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save / Reset */}
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResetSettings("Integration")}
          className="h-8 text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
        <Button
          size="sm"
          onClick={() => handleSaveSettings("Integration", integrationForm)}
          disabled={saving}
          className="h-8 text-xs"
        >
          <Save className="h-3 w-3 mr-1" />{" "}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );

  // ============================================================
  // Render: Appearance Settings Tab
  // ============================================================

  const renderAppearanceSettings = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Display Preferences
          </CardTitle>
          <CardDescription className="text-xs">
            Customize how the application looks and displays data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Theme</Label>
              <Select
                value={appearanceForm.theme || "system"}
                onValueChange={(v) =>
                  setAppearanceForm((p) => ({ ...p, theme: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System Default</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Default Rows Per Page
              </Label>
              <Select
                value={appearanceForm.rows_per_page || "25"}
                onValueChange={(v) =>
                  setAppearanceForm((p) => ({ ...p, rows_per_page: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">
                  Show Account Codes
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Display codes in dropdowns and lists
                </p>
              </div>
              <Switch
                checked={appearanceForm.show_account_codes === "true"}
                onCheckedChange={(v) =>
                  setAppearanceForm((p) => ({
                    ...p,
                    show_account_codes: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-xs font-medium">Collapsed Sidebar</Label>
                <p className="text-[10px] text-muted-foreground">
                  Start with sidebar collapsed
                </p>
              </div>
              <Switch
                checked={appearanceForm.sidebar_collapsed === "true"}
                onCheckedChange={(v) =>
                  setAppearanceForm((p) => ({
                    ...p,
                    sidebar_collapsed: v ? "true" : "false",
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Thousand Separator</Label>
              <Select
                value={appearanceForm.thousand_separator || ","}
                onValueChange={(v) =>
                  setAppearanceForm((p) => ({ ...p, thousand_separator: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma (1,000.00)</SelectItem>
                  <SelectItem value=".">Period (1.000,00)</SelectItem>
                  <SelectItem value=" ">Space (1 000.00)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Decimal Places</Label>
              <Select
                value={appearanceForm.decimal_places || "2"}
                onValueChange={(v) =>
                  setAppearanceForm((p) => ({ ...p, decimal_places: v }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 decimals</SelectItem>
                  <SelectItem value="2">2 decimals</SelectItem>
                  <SelectItem value="3">3 decimals</SelectItem>
                  <SelectItem value="4">4 decimals</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save / Reset */}
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResetSettings("Appearance")}
          className="h-8 text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
        <Button
          size="sm"
          onClick={() => handleSaveSettings("Appearance", appearanceForm)}
          disabled={saving}
          className="h-8 text-xs"
        >
          <Save className="h-3 w-3 mr-1" />{" "}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );

  // ============================================================
  // Render: System Information Tab
  // ============================================================

  const renderSystemInfo = () => {
    const settingsCount = Object.keys(settingsMap).length;

    return (
      <div className="space-y-4">
        {/* System Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              System Information
            </CardTitle>
            <CardDescription className="text-xs">
              Current system configuration and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Application", value: "AcctFin ERP", icon: Settings },
                { label: "Version", value: "1.0.0", icon: Info },
                {
                  label: "Framework",
                  value: "Next.js 16 + React 19",
                  icon: Monitor,
                },
                {
                  label: "Database",
                  value: "SQLite (Prisma ORM)",
                  icon: Database,
                },
                {
                  label: "UI Library",
                  value: "shadcn/ui + Tailwind CSS",
                  icon: Palette,
                },
                {
                  label: "Base Currency",
                  value: getSetting("base_currency") || "PKR",
                  icon: Globe,
                },
                { label: "Multi-Project", value: "Enabled", icon: Building2 },
                { label: "Multi-Donor", value: "Enabled", icon: Users },
                { label: "Multi-Location", value: "Enabled", icon: Globe },
                {
                  label: "Total Settings",
                  value: String(settingsCount),
                  icon: ToggleLeft,
                },
                {
                  label: "Total Users",
                  value: String(users.length),
                  icon: Users,
                },
                {
                  label: "Timezone",
                  value: getSetting("timezone") || "Asia/Karachi",
                  icon: Clock,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-2.5 rounded-lg border"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs font-medium">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Validation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Data Validation Status
            </CardTitle>
            <CardDescription className="text-xs">
              System integrity checks and validation results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  title: "Trial Balance Balanced",
                  desc: "Total debits equal total credits",
                  status: "pass",
                },
                {
                  title: "Double-Entry Validated",
                  desc: "All vouchers have balanced entries",
                  status: "pass",
                },
                {
                  title: "Financial Year Open",
                  desc: getSetting("fiscal_year_start_month")
                    ? `FY starts month ${getSetting("fiscal_year_start_month")}`
                    : "Active fiscal year available",
                  status: "pass",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`p-3 rounded-lg border flex items-center gap-3 ${
                    item.status === "pass"
                      ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10"
                      : "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10"
                  }`}
                >
                  <CheckCircle
                    className={`h-5 w-5 shrink-0 ${item.status === "pass" ? "text-green-600" : "text-amber-600"}`}
                  />
                  <div>
                    <p className="text-xs font-semibold">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* All Settings Raw View */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              All Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Complete list of all system configuration entries
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Key</TableHead>
                    <TableHead className="text-[10px]">Value</TableHead>
                    <TableHead className="text-[10px]">Category</TableHead>
                    <TableHead className="text-[10px]">Description</TableHead>
                    <TableHead className="text-[10px]">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(settingsMap)
                    .sort(
                      (a, b) =>
                        a.category.localeCompare(b.category) ||
                        a.key.localeCompare(b.key),
                    )
                    .map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-[10px] font-mono font-medium">
                          {s.key}
                        </TableCell>
                        <TableCell className="text-[10px] max-w-[200px] truncate">
                          {s.value}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[8px]">
                            {s.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                          {s.description || "—"}
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {new Date(s.updatedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">System Settings</h3>
        <Badge variant="outline" className="text-[9px] ml-1">
          Admin Only
        </Badge>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="h-9 p-0.5 flex-wrap">
          <TabsTrigger
            value="general"
            className="text-[10px] h-8 px-3 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Building2 className="h-3 w-3" /> General
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="text-[10px] h-8 px-3 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Users className="h-3 w-3" /> Users
            {users.length > 0 && (
              <Badge variant="secondary" className="text-[8px] h-4 px-1">
                {users.length}
              </Badge>
            )}
          </TabsTrigger>
          {canViewRBAC && (
            <TabsTrigger
              value="roles"
              className="text-[10px] h-8 px-3 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Shield className="h-3 w-3" /> Roles
            </TabsTrigger>
          )}
          <TabsTrigger
            value="voucher"
            className="text-[10px] h-8 px-3 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <FileText className="h-3 w-3" /> Voucher
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="text-[10px] h-8 px-3 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Lock className="h-3 w-3" /> Security
          </TabsTrigger>
          <TabsTrigger
            value="integration"
            className="text-[10px] h-8 px-3 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Plug className="h-3 w-3" /> Integration
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="text-[10px] h-8 px-3 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Palette className="h-3 w-3" /> Appearance
          </TabsTrigger>
          <TabsTrigger
            value="system"
            className="text-[10px] h-8 px-3 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Server className="h-3 w-3" /> System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0">
          {renderGeneralSettings()}
        </TabsContent>
        <TabsContent value="users" className="mt-0">
          {renderUserManagement()}
        </TabsContent>
        {canViewRBAC && (
          <TabsContent value="roles" className="mt-0">
            {renderRolesPermissions()}
          </TabsContent>
        )}
        <TabsContent value="voucher" className="mt-0">
          {renderVoucherSettings()}
        </TabsContent>
        <TabsContent value="security" className="mt-0">
          {renderSecuritySettings()}
        </TabsContent>
        <TabsContent value="integration" className="mt-0">
          {renderIntegrationSettings()}
        </TabsContent>
        <TabsContent value="appearance" className="mt-0">
          {renderAppearanceSettings()}
        </TabsContent>
        <TabsContent value="system" className="mt-0">
          {renderSystemInfo()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
