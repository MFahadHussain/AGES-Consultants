"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  UserCheck,
  UserX,
  Banknote,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  GraduationCap,
  Briefcase,
  Heart,
  DollarSign,
  Shield,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  AlertTriangle,
  Loader2,
  BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AccountCombobox,
  AccountOption,
} from "@/components/ui/account-combobox";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCnic(cnic: string | null | undefined) {
  if (!cnic) return "—";
  return cnic.replace(/^(\d{5})(\d{7})(\d{1})$/, "$1-$2-$3");
}

const statusConfig: Record<string, { color: string; label: string }> = {
  active: {
    color: "bg-green-100 text-green-800 border-green-200",
    label: "Active",
  },
  inactive: {
    color: "bg-gray-100 text-gray-800 border-gray-200",
    label: "Inactive",
  },
  terminated: {
    color: "bg-red-100 text-red-800 border-red-200",
    label: "Terminated",
  },
  resigned: {
    color: "bg-amber-100 text-amber-800 border-amber-200",
    label: "Resigned",
  },
  retired: {
    color: "bg-blue-100 text-blue-800 border-blue-200",
    label: "Retired",
  },
};

const genderOptions = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

const employmentTypeOptions = [
  { value: "Permanent", label: "Permanent" },
  { value: "Contract", label: "Contract" },
  { value: "Temporary", label: "Temporary" },
  { value: "Intern", label: "Intern" },
  { value: "Consultant", label: "Consultant" },
];

const categoryOptions = [
  { value: "Management", label: "Management" },
  { value: "Staff", label: "Staff" },
  { value: "Worker", label: "Worker" },
  { value: "Officer", label: "Officer" },
  { value: "Partners", label: "Partners" },
  { value: "Key Staff", label: "Key Staff" },
  { value: "Technical Staff", label: "Technical Staff" },
  { value: "Technical Support staff", label: "Technical Support Staff" },
  { value: "Admin & Finance Staff", label: "Admin & Finance Staff" },
  { value: "Support Staff", label: "Support Staff" },
  { value: "Geo Tech", label: "Geo Tech" },
];

const paymentTypeOptions = [
  { value: "monthly", label: "Monthly" },
  { value: "daily", label: "Daily" },
  { value: "hourly", label: "Hourly" },
];

const religionOptions = [
  { value: "Islam", label: "Islam" },
  { value: "Christianity", label: "Christianity" },
  { value: "Hinduism", label: "Hinduism" },
  { value: "Other", label: "Other" },
];

// ---------------------------------------------------------------------------
// Empty form default
// ---------------------------------------------------------------------------

const emptyForm = {
  name: "",
  fatherName: "",
  cnic: "",
  ntn: "",
  dateOfBirth: "",
  religion: "",
  gender: "",
  contactNo: "",
  email: "",
  permanentAddress: "",
  presentAddress: "",
  designation: "",
  department: "",
  joiningDate: "",
  leavingDate: "",
  employmentType: "",
  category: "",
  defaultProjectId: "",
  status: "active",
  bankName: "",
  branchName: "",
  branchCode: "",
  bankAccountNumber: "",
  eobiNumber: "",
  socialSecurityNo: "",
  qualification1: "",
  institute1: "",
  year1: "",
  qualification2: "",
  institute2: "",
  year2: "",
  previousEmployer: "",
  yearsOfExperience: "",
  nokName: "",
  nokCnic: "",
  nokContact: "",
  nokRelation: "",
  baseSalary: "",
  paymentType: "monthly",
  eobiEnabled: false,
  pfEnabled: false,
  essiEnabled: false,
  gratuityEnabled: false,
  incomeTaxEnabled: true,
  applyToAllProjects: false,
  defaultAllocationMethod: "days",
  taxFilingStatus: "",
  taxCity: "",
  salaryExpenseAccountId: "",
  scExpenseAccountId: "",
  salaryPayableAccountId: "",
  scPayableAccountId: "",
  taxPayableAccountId: "",
};

// ---------------------------------------------------------------------------
// Form Field Components (MUST be outside EmployeeMaster to avoid re-mount on every keystroke)
// ---------------------------------------------------------------------------

function FormField({
  label,
  field,
  type = "text",
  placeholder = "",
  required = false,
  colSpan = "",
  form,
  updateForm,
}: {
  label: string;
  field: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  colSpan?: string;
  form: Record<string, any>;
  updateForm: (field: string, value: string) => void;
}) {
  return (
    <div className={colSpan}>
      <Label className="text-xs">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <Input
        type={type}
        className="h-8 text-xs"
        value={form[field] || ""}
        onChange={(e) => updateForm(field, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function FormSelect({
  label,
  field,
  options,
  placeholder = "Select...",
  required = false,
  form,
  updateForm,
}: {
  label: string;
  field: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  form: Record<string, any>;
  updateForm: (field: string, value: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <Select
        value={form[field] || "_none"}
        onValueChange={(v) => updateForm(field, v === "_none" ? "" : v)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">{placeholder}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function EmployeeMaster() {
  const { toast } = useToast();
  const router = useRouter();

  // Data state
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalMonthlySalary, setTotalMonthlySalary] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const totalPages = Math.ceil(total / pageSize);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const searchRef = useRef(search);
  const statusRef = useRef(statusFilter);
  const deptRef = useRef(departmentFilter);
  const pageRef = useRef(page);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);
  useEffect(() => {
    statusRef.current = statusFilter;
  }, [statusFilter]);
  useEffect(() => {
    deptRef.current = departmentFilter;
  }, [departmentFilter]);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({ ...emptyForm });
  const [formTab, setFormTab] = useState("personal");

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const s = searchRef.current;
      const sf = statusRef.current;
      const df = deptRef.current;
      const p = pageRef.current;
      if (s) params.set("search", s);
      if (sf && sf !== "all") params.set("status", sf);
      if (df && df !== "all") params.set("department", df);
      params.set("page", String(p));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const result = await res.json();
      setEmployees(result.data || []);
      setTotal(result.pagination?.total || 0);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, pageSize]);

  // Fetch summary stats (all employees for counts)
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/employees?pageSize=1000");
      if (!res.ok) return;
      const result = await res.json();
      const all = result.data || [];
      setActiveCount(all.filter((e: any) => e.status === "active").length);
      setInactiveCount(all.filter((e: any) => e.status !== "active").length);
      setTotalMonthlySalary(
        all.reduce((s: number, e: any) => s + (e.baseSalary || 0), 0),
      );
      // Extract unique departments
      const depts = [
        ...new Set(all.map((e: any) => e.department).filter(Boolean)),
      ] as string[];
      setDepartments(depts.sort());
    } catch {
      // Silently fail for summary
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) return;
      setProjects(await res.json());
    } catch {
      // Silently fail
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts?isActive=true");
      if (!res.ok) return;
      const data = await res.json();
      // Filter to only posting-allowed accounts
      const filtered = (data || []).filter(
        (a: any) => a.allowPosting === true && a.isActive === true,
      );
      setAccounts(
        filtered.map((a: any) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          accountType: a.accountType,
          subType: a.subType || undefined,
          level: a.level,
          allowPosting: a.allowPosting,
          isActive: a.isActive,
        })),
      );
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
      fetchSummary();
      fetchProjects();
      fetchAccounts();
    });
  }, [fetchData, fetchSummary, fetchProjects, fetchAccounts]);

  useEffect(() => {
    fetchData();
  }, [page, statusFilter, departmentFilter, fetchData]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) {
        setPage(1);
      } else {
        fetchData();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ---------------------------------------------------------------------------
  // Form Helpers
  // ---------------------------------------------------------------------------

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setFormTab("personal");
  };

  const populateFormFromEmployee = (emp: any) => {
    setForm({
      name: emp.name || "",
      fatherName: emp.fatherName || "",
      cnic: emp.cnic || "",
      ntn: emp.ntn || "",
      dateOfBirth: emp.dateOfBirth
        ? new Date(emp.dateOfBirth).toISOString().split("T")[0]
        : "",
      religion: emp.religion || "",
      gender: emp.gender || "",
      contactNo: emp.contactNo || "",
      email: emp.email || "",
      permanentAddress: emp.permanentAddress || "",
      presentAddress: emp.presentAddress || "",
      designation: emp.designation || "",
      department: emp.department || "",
      joiningDate: emp.joiningDate
        ? new Date(emp.joiningDate).toISOString().split("T")[0]
        : "",
      leavingDate: emp.leavingDate
        ? new Date(emp.leavingDate).toISOString().split("T")[0]
        : "",
      employmentType: emp.employmentType || "",
      category: emp.category || "",
      defaultProjectId: emp.defaultProjectId || "",
      status: emp.status || "active",
      bankName: emp.bankName || "",
      branchName: emp.branchName || "",
      branchCode: emp.branchCode || "",
      bankAccountNumber: emp.bankAccountNumber || "",
      eobiNumber: emp.eobiNumber || "",
      socialSecurityNo: emp.socialSecurityNo || "",
      qualification1: emp.qualification1 || "",
      institute1: emp.institute1 || "",
      year1: emp.year1 || "",
      qualification2: emp.qualification2 || "",
      institute2: emp.institute2 || "",
      year2: emp.year2 || "",
      previousEmployer: emp.previousEmployer || "",
      yearsOfExperience: emp.yearsOfExperience || "",
      nokName: emp.nokName || "",
      nokCnic: emp.nokCnic || "",
      nokContact: emp.nokContact || "",
      nokRelation: emp.nokRelation || "",
      baseSalary: emp.baseSalary != null ? String(emp.baseSalary) : "",
      paymentType: emp.paymentType || "monthly",
      eobiEnabled: emp.eobiEnabled || false,
      pfEnabled: emp.pfEnabled || false,
      essiEnabled: emp.essiEnabled || false,
      gratuityEnabled: emp.gratuityEnabled || false,
      incomeTaxEnabled: emp.incomeTaxEnabled !== false,
      applyToAllProjects: emp.applyToAllProjects || false,
      defaultAllocationMethod: emp.defaultAllocationMethod || "days",
      taxFilingStatus: emp.taxFilingStatus || "",
      taxCity: emp.taxCity || "",
      salaryExpenseAccountId: emp.salaryExpenseAccountId || "",
      scExpenseAccountId: emp.scExpenseAccountId || "",
      salaryPayableAccountId: emp.salaryPayableAccountId || "",
      scPayableAccountId: emp.scPayableAccountId || "",
      taxPayableAccountId: emp.taxPayableAccountId || "",
    });
  };

  // ---------------------------------------------------------------------------
  // CRUD Handlers
  // ---------------------------------------------------------------------------

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Employee name is required",
        variant: "destructive",
      });
      return;
    }
    if (!form.cnic.trim()) {
      toast({
        title: "Validation Error",
        description: "CNIC is required",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      // Clean empty strings to null
      Object.keys(payload).forEach((key) => {
        if (payload[key] === "") payload[key] = null;
      });
      // Ensure numeric
      if (payload.baseSalary != null)
        payload.baseSalary = parseFloat(String(payload.baseSalary)) || 0;
      else payload.baseSalary = 0;

      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({
          title: "Error",
          description: result.error || "Failed to create employee",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      toast({
        title: "Employee Created",
        description: `${result.name} (${result.employeeCode}) created successfully`,
      });
      setCreateOpen(false);
      resetForm();
      fetchData();
      fetchSummary();
    } catch {
      toast({
        title: "Error",
        description: "Failed to create employee",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedEmployee) return;
    if (!form.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Employee name is required",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === "") payload[key] = null;
      });
      if (payload.baseSalary != null)
        payload.baseSalary = parseFloat(String(payload.baseSalary)) || 0;
      else payload.baseSalary = 0;

      const res = await fetch(`/api/employees?id=${selectedEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({
          title: "Error",
          description: result.error || "Failed to update employee",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      toast({
        title: "Employee Updated",
        description: `${result.name} (${result.employeeCode}) updated successfully`,
      });
      setEditOpen(false);
      resetForm();
      setSelectedEmployee(null);
      fetchData();
      fetchSummary();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update employee",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/employees?id=${selectedEmployee.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) {
        toast({
          title: "Cannot Delete",
          description: result.error || "Failed to delete employee",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      toast({
        title: "Employee Deleted",
        description: result.message || "Employee deleted successfully",
      });
      setDeleteOpen(false);
      setSelectedEmployee(null);
      fetchData();
      fetchSummary();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete employee",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (emp: any) => {
    setSelectedEmployee(emp);
    populateFormFromEmployee(emp);
    setFormTab("personal");
    setEditOpen(true);
  };

  const openViewDialog = (emp: any) => {
    setSelectedEmployee(emp);
    setViewOpen(true);
  };

  const openDeleteDialog = (emp: any) => {
    setSelectedEmployee(emp);
    setDeleteOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Tab Content Renderers
  // ---------------------------------------------------------------------------

  const renderPersonalTab = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          form={form}
          updateForm={updateForm}
          label="Full Name"
          field="name"
          placeholder="Muhammad Ahmed"
          required
        />
        <FormField
          form={form}
          updateForm={updateForm}
          label="Father's Name"
          field="fatherName"
          placeholder="Father's full name"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          form={form}
          updateForm={updateForm}
          label="CNIC"
          field="cnic"
          placeholder="1234567890123"
          required
        />
        <FormField
          form={form}
          updateForm={updateForm}
          label="NTN"
          field="ntn"
          placeholder="National Tax Number"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField
          form={form}
          updateForm={updateForm}
          label="Date of Birth"
          field="dateOfBirth"
          type="date"
        />
        <FormSelect
          form={form}
          updateForm={updateForm}
          label="Religion"
          field="religion"
          options={religionOptions}
          placeholder="Select religion"
        />
        <FormSelect
          form={form}
          updateForm={updateForm}
          label="Gender"
          field="gender"
          options={genderOptions}
          placeholder="Select gender"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          form={form}
          updateForm={updateForm}
          label="Contact No"
          field="contactNo"
          placeholder="+92-300-1234567"
        />
        <FormField
          form={form}
          updateForm={updateForm}
          label="Email"
          field="email"
          type="email"
          placeholder="ahmed@company.com"
        />
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label className="text-xs">Permanent Address</Label>
          <Textarea
            className="text-xs min-h-[60px]"
            value={form.permanentAddress || ""}
            onChange={(e) => updateForm("permanentAddress", e.target.value)}
            placeholder="House #, Street, City, Province"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label className="text-xs">Present Address</Label>
          <Textarea
            className="text-xs min-h-[60px]"
            value={form.presentAddress || ""}
            onChange={(e) => updateForm("presentAddress", e.target.value)}
            placeholder="Current residential address"
          />
        </div>
      </div>
    </div>
  );

  const renderEmploymentTab = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          form={form}
          updateForm={updateForm}
          label="Designation"
          field="designation"
          placeholder="e.g. Senior Accountant"
        />
        <FormField
          form={form}
          updateForm={updateForm}
          label="Department"
          field="department"
          placeholder="e.g. Finance, HR, IT"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          form={form}
          updateForm={updateForm}
          label="Joining Date"
          field="joiningDate"
          type="date"
        />
        <FormField
          form={form}
          updateForm={updateForm}
          label="Leaving Date"
          field="leavingDate"
          type="date"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormSelect
          form={form}
          updateForm={updateForm}
          label="Employment Type"
          field="employmentType"
          options={employmentTypeOptions}
          placeholder="Select type"
        />
        <FormSelect
          form={form}
          updateForm={updateForm}
          label="Category"
          field="category"
          options={categoryOptions}
          placeholder="Select category"
        />
        <div>
          <Label className="text-xs">Default Project</Label>
          <Select
            value={form.defaultProjectId || "_none"}
            onValueChange={(v) =>
              updateForm("defaultProjectId", v === "_none" ? "" : v)
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="No default project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">No default project</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormSelect
          form={form}
          updateForm={updateForm}
          label="Status"
          field="status"
          options={Object.entries(statusConfig).map(([v, c]) => ({
            value: v,
            label: c.label,
          }))}
          placeholder="Select status"
          required
        />
      </div>
      {selectedEmployee?.isFinancialUsed && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <Shield className="h-4 w-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Financially Used
            </p>
            <p className="text-[10px] text-amber-600">
              This employee has financial transactions. Only contact information
              can be updated.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderBankingTab = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          form={form}
          updateForm={updateForm}
          label="Bank Name"
          field="bankName"
          placeholder="e.g. HBL, UBL, MCB"
        />
        <FormField
          form={form}
          updateForm={updateForm}
          label="Branch Name"
          field="branchName"
          placeholder="e.g. Main Branch"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          form={form}
          updateForm={updateForm}
          label="Branch Code"
          field="branchCode"
          placeholder="e.g. 0123"
        />
        <FormField
          form={form}
          updateForm={updateForm}
          label="Account Number"
          field="bankAccountNumber"
          placeholder="Bank account number"
        />
      </div>
      <div className="p-3 rounded-md bg-muted/50">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-medium">
            Banking details are used for salary disbursement and payroll
            processing
          </span>
        </div>
      </div>
    </div>
  );

  const renderQualificationTab = () => (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5" />
          Qualification 1
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            form={form}
            updateForm={updateForm}
            label="Degree / Certificate"
            field="qualification1"
            placeholder="e.g. B.Com, MBA"
          />
          <FormField
            form={form}
            updateForm={updateForm}
            label="Institute"
            field="institute1"
            placeholder="University name"
          />
          <FormField
            form={form}
            updateForm={updateForm}
            label="Year"
            field="year1"
            placeholder="e.g. 2018"
          />
        </div>
      </div>
      <Separator />
      <div>
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5" />
          Qualification 2
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            form={form}
            updateForm={updateForm}
            label="Degree / Certificate"
            field="qualification2"
            placeholder="e.g. M.A, ACCA"
          />
          <FormField
            form={form}
            updateForm={updateForm}
            label="Institute"
            field="institute2"
            placeholder="University name"
          />
          <FormField
            form={form}
            updateForm={updateForm}
            label="Year"
            field="year2"
            placeholder="e.g. 2020"
          />
        </div>
      </div>
      <Separator />
      <div>
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />
          Experience
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            form={form}
            updateForm={updateForm}
            label="Previous Employer"
            field="previousEmployer"
            placeholder="Previous company name"
          />
          <FormField
            form={form}
            updateForm={updateForm}
            label="Years of Experience"
            field="yearsOfExperience"
            placeholder="e.g. 5"
          />
        </div>
      </div>
    </div>
  );

  const renderSalaryTab = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Base Salary (PKR)</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            value={form.baseSalary || ""}
            onChange={(e) => updateForm("baseSalary", e.target.value)}
            placeholder="0"
          />
        </div>
        <FormSelect
          form={form}
          updateForm={updateForm}
          label="Payment Type"
          field="paymentType"
          options={paymentTypeOptions}
          placeholder="Select type"
        />
      </div>
      {form.baseSalary && parseFloat(form.baseSalary) > 0 && (
        <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-700 dark:text-green-300">
              Monthly Salary:
            </span>
            <span className="text-sm font-bold text-green-800 dark:text-green-200">
              {formatCurrency(parseFloat(form.baseSalary) || 0)}
            </span>
          </div>
          {form.paymentType === "daily" && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-green-600">
                Estimated Daily Rate (30 days):
              </span>
              <span className="text-xs font-medium text-green-700">
                {formatCurrency((parseFloat(form.baseSalary) || 0) / 30)}
              </span>
            </div>
          )}
          {form.paymentType === "hourly" && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-green-600">
                Estimated Hourly Rate (8h/day):
              </span>
              <span className="text-xs font-medium text-green-700">
                {formatCurrency((parseFloat(form.baseSalary) || 0) / 30 / 8)}
              </span>
            </div>
          )}
        </div>
      )}
      <div className="p-3 rounded-md bg-muted/50">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-medium">
            Salary changes are tracked in salary history for audit purposes
          </span>
        </div>
      </div>
      <Separator />
      <div>
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Statutory Information
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            form={form}
            updateForm={updateForm}
            label="EOBI Number"
            field="eobiNumber"
            placeholder="EOBI registration no."
          />
          <FormField
            form={form}
            updateForm={updateForm}
            label="Social Security No"
            field="socialSecurityNo"
            placeholder="Social security no."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200">
            <button
              type="button"
              role="switch"
              aria-checked={!!form.eobiEnabled}
              onClick={() =>
                setForm((prev) => ({ ...prev, eobiEnabled: !prev.eobiEnabled }))
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.eobiEnabled ? "bg-slate-900" : "bg-slate-200"}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.eobiEnabled ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
            <div>
              <p className="text-xs font-medium">EOBI Applicable</p>
              <p className="text-[10px] text-muted-foreground">
                Enable EOBI deduction for this employee
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200">
            <button
              type="button"
              role="switch"
              aria-checked={!!form.pfEnabled}
              onClick={() =>
                setForm((prev) => ({ ...prev, pfEnabled: !prev.pfEnabled }))
              }
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.pfEnabled ? "bg-slate-900" : "bg-slate-200"}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.pfEnabled ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
            <div>
              <p className="text-xs font-medium">Provident Fund</p>
              <p className="text-[10px] text-muted-foreground">
                Enable PF deduction for this employee
              </p>
            </div>
          </div>
        </div>
        <Separator className="my-3" />
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Statutory & Settings
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200">
              <button
                type="button"
                role="switch"
                aria-checked={!!form.essiEnabled}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    essiEnabled: !prev.essiEnabled,
                  }))
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.essiEnabled ? "bg-slate-900" : "bg-slate-200"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.essiEnabled ? "translate-x-4" : "translate-x-0"}`}
                />
              </button>
              <div>
                <p className="text-xs font-medium">Apply ESSI</p>
                <p className="text-[10px] text-muted-foreground">
                  Enable ESSI deduction
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200">
              <button
                type="button"
                role="switch"
                aria-checked={!!form.gratuityEnabled}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    gratuityEnabled: !prev.gratuityEnabled,
                  }))
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.gratuityEnabled ? "bg-slate-900" : "bg-slate-200"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.gratuityEnabled ? "translate-x-4" : "translate-x-0"}`}
                />
              </button>
              <div>
                <p className="text-xs font-medium">Apply Gratuity</p>
                <p className="text-[10px] text-muted-foreground">
                  Enable gratuity provision
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200">
              <button
                type="button"
                role="switch"
                aria-checked={!!form.incomeTaxEnabled}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    incomeTaxEnabled: !prev.incomeTaxEnabled,
                  }))
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.incomeTaxEnabled ? "bg-slate-900" : "bg-slate-200"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.incomeTaxEnabled ? "translate-x-4" : "translate-x-0"}`}
                />
              </button>
              <div>
                <p className="text-xs font-medium">Income Tax Applicable</p>
                <p className="text-[10px] text-muted-foreground">
                  Deduct income tax from salary
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200">
              <button
                type="button"
                role="switch"
                aria-checked={!!form.applyToAllProjects}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    applyToAllProjects: !prev.applyToAllProjects,
                  }))
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.applyToAllProjects ? "bg-slate-900" : "bg-slate-200"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.applyToAllProjects ? "translate-x-4" : "translate-x-0"}`}
                />
              </button>
              <div>
                <p className="text-xs font-medium">Apply to All Projects</p>
                <p className="text-[10px] text-muted-foreground">
                  Allocate across all assigned projects
                </p>
              </div>
            </div>
            <FormSelect
              form={form}
              updateForm={updateForm}
              label="Default Allocation Method"
              field="defaultAllocationMethod"
              options={[
                { value: "days", label: "Days-based" },
                { value: "percentage", label: "Percentage" },
              ]}
              placeholder="Select method"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <FormSelect
              form={form}
              updateForm={updateForm}
              label="Tax Filing Status"
              field="taxFilingStatus"
              options={[
                { value: "filer", label: "Filer" },
                { value: "non-filer", label: "Non-Filer" },
              ]}
              placeholder="Select status"
            />
            <FormField
              form={form}
              updateForm={updateForm}
              label="Tax City (FBR PSID)"
              field="taxCity"
              placeholder="e.g. Islamabad, Karachi"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderNextOfKinTab = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          form={form}
          updateForm={updateForm}
          label="Next of Kin Name"
          field="nokName"
          placeholder="Full name"
        />
        <FormField
          form={form}
          updateForm={updateForm}
          label="Relation"
          field="nokRelation"
          placeholder="e.g. Spouse, Father, Brother"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          form={form}
          updateForm={updateForm}
          label="NOK CNIC"
          field="nokCnic"
          placeholder="1234567890123"
        />
        <FormField
          form={form}
          updateForm={updateForm}
          label="NOK Contact"
          field="nokContact"
          placeholder="+92-300-1234567"
        />
      </div>
      <div className="p-3 rounded-md bg-muted/50">
        <div className="flex items-center gap-2 mb-1">
          <Heart className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-medium">
            Next of Kin information is used for emergency contact and
            gratuity/final settlement processing
          </span>
        </div>
      </div>
    </div>
  );

  const renderAccountingTab = () => {
    // Filter accounts by type for grouping
    const expenseAccounts = accounts.filter((a) => a.accountType === "EXPENSE");
    const liabilityAccounts = accounts.filter(
      (a) => a.accountType === "LIABILITY",
    );

    const accountingFields = [
      {
        field: "salaryExpenseAccountId" as const,
        label: "Salary Expense Account",
        example: "05-01-01-XXXX · Project Salary Cost",
        filter: expenseAccounts,
      },
      {
        field: "scExpenseAccountId" as const,
        label: "SC Expense Account",
        example: "05-02-XX-XXXX · Employer SC Cost",
        filter: expenseAccounts,
      },
      {
        field: "salaryPayableAccountId" as const,
        label: "Salary Payable Account",
        example: "03-02-02-XXXX · Employee Salary Payable",
        filter: liabilityAccounts,
      },
      {
        field: "scPayableAccountId" as const,
        label: "SC Payable Account",
        example: "03-02-03-XXXX · SC Payable to Authority",
        filter: liabilityAccounts,
      },
      {
        field: "taxPayableAccountId" as const,
        label: "Tax Payable Account",
        example: "03-02-07-XXXX · Income Tax (WHT) Payable",
        filter: liabilityAccounts,
      },
    ];

    const missingAccounts = accountingFields.filter((f) => !form[f.field]);

    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Debit Accounts (Expense)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accountingFields
              .filter((f) => f.filter === expenseAccounts)
              .map(({ field, label, example, filter }) => (
                <div key={field}>
                  <Label className="text-xs">{label}</Label>
                  <AccountCombobox
                    accounts={filter}
                    value={form[field] || ""}
                    onChange={(id: string) => updateForm(field, id)}
                    placeholder={`e.g. ${example}`}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
          </div>
        </div>
        <Separator />
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Credit Accounts (Payable)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accountingFields
              .filter((f) => f.filter === liabilityAccounts)
              .map(({ field, label, example, filter }) => (
                <div key={field}>
                  <Label className="text-xs">{label}</Label>
                  <AccountCombobox
                    accounts={filter}
                    value={form[field] || ""}
                    onChange={(id: string) => updateForm(field, id)}
                    placeholder={`e.g. ${example}`}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
          </div>
        </div>
        {missingAccounts.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Accounts Not Configured
              </p>
              <p className="text-[10px] text-amber-600">
                Employee cannot be included in salary voucher generation until
                all 5 accounts are configured.
              </p>
              <p className="text-[10px] text-amber-500 mt-1">
                Missing: {missingAccounts.map((f) => f.label).join(", ")}
              </p>
            </div>
          </div>
        )}
        {missingAccounts.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
            <Shield className="h-3.5 w-3.5 text-green-600" />
            <span className="text-[10px] text-green-700 dark:text-green-300 font-medium">
              All accounting accounts configured — employee is ready for salary
              voucher generation
            </span>
          </div>
        )}
        <div className="p-3 rounded-md bg-muted/50">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">
              These accounts override the default Payroll Account Mapping when
              generating salary vouchers for this employee
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // View Detail Renderer
  // ---------------------------------------------------------------------------

  const renderViewDetail = () => {
    if (!selectedEmployee) return null;
    const emp = selectedEmployee;
    const sc = statusConfig[emp.status] || statusConfig.inactive;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">{emp.name}</h3>
              <Badge className={`text-[9px] ${sc.color}`}>{sc.label}</Badge>
              {emp.isFinancialUsed && (
                <Badge className="text-[9px] bg-amber-100 text-amber-800 border-amber-200">
                  <Shield className="h-2.5 w-2.5 mr-0.5" />
                  Financial
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {emp.employeeCode} {emp.designation ? `· ${emp.designation}` : ""}{" "}
              {emp.department ? `· ${emp.department}` : ""}
            </p>
          </div>
        </div>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="h-8 w-full flex">
            <TabsTrigger value="personal" className="text-[10px] flex-1 h-7">
              <User className="h-3 w-3 mr-1" />
              Personal
            </TabsTrigger>
            <TabsTrigger value="employment" className="text-[10px] flex-1 h-7">
              <Briefcase className="h-3 w-3 mr-1" />
              Employment
            </TabsTrigger>
            <TabsTrigger value="banking" className="text-[10px] flex-1 h-7">
              <CreditCard className="h-3 w-3 mr-1" />
              Banking
            </TabsTrigger>
            <TabsTrigger value="salary" className="text-[10px] flex-1 h-7">
              <DollarSign className="h-3 w-3 mr-1" />
              Salary
            </TabsTrigger>
            <TabsTrigger value="accounting" className="text-[10px] flex-1 h-7">
              <BookOpen className="h-3 w-3 mr-1" />
              Accounting
            </TabsTrigger>
            <TabsTrigger value="other" className="text-[10px] flex-1 h-7">
              <FileText className="h-3 w-3 mr-1" />
              Other
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="mt-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <DetailRow
                icon={User}
                label="Father's Name"
                value={emp.fatherName}
              />
              <DetailRow
                icon={CreditCard}
                label="CNIC"
                value={formatCnic(emp.cnic)}
              />
              <DetailRow icon={CreditCard} label="NTN" value={emp.ntn} />
              <DetailRow
                icon={Calendar}
                label="Date of Birth"
                value={formatDate(emp.dateOfBirth)}
              />
              <DetailRow icon={Heart} label="Religion" value={emp.religion} />
              <DetailRow icon={User} label="Gender" value={emp.gender} />
              <DetailRow
                icon={Phone}
                label="Contact No"
                value={emp.contactNo}
              />
              <DetailRow icon={Mail} label="Email" value={emp.email} />
              <DetailRow
                icon={MapPin}
                label="Permanent Address"
                value={emp.permanentAddress}
              />
              <DetailRow
                icon={MapPin}
                label="Present Address"
                value={emp.presentAddress}
              />
            </div>
          </TabsContent>

          <TabsContent value="employment" className="mt-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <DetailRow
                icon={Briefcase}
                label="Designation"
                value={emp.designation}
              />
              <DetailRow
                icon={Building2}
                label="Department"
                value={emp.department}
              />
              <DetailRow
                icon={Calendar}
                label="Joining Date"
                value={formatDate(emp.joiningDate)}
              />
              <DetailRow
                icon={Calendar}
                label="Leaving Date"
                value={formatDate(emp.leavingDate)}
              />
              <DetailRow
                icon={Briefcase}
                label="Employment Type"
                value={emp.employmentType}
              />
              <DetailRow icon={User} label="Category" value={emp.category} />
              <DetailRow
                icon={Building2}
                label="Default Project"
                value={
                  emp.defaultProject
                    ? `${emp.defaultProject.code} — ${emp.defaultProject.name}`
                    : "—"
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="banking" className="mt-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <DetailRow
                icon={CreditCard}
                label="Bank Name"
                value={emp.bankName}
              />
              <DetailRow
                icon={CreditCard}
                label="Branch Name"
                value={emp.branchName}
              />
              <DetailRow
                icon={CreditCard}
                label="Branch Code"
                value={emp.branchCode}
              />
              <DetailRow
                icon={CreditCard}
                label="Account Number"
                value={emp.bankAccountNumber}
              />
            </div>
          </TabsContent>

          <TabsContent value="salary" className="mt-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <DetailRow
                icon={DollarSign}
                label="Base Salary"
                value={emp.baseSalary ? formatCurrency(emp.baseSalary) : "—"}
              />
              <DetailRow
                icon={DollarSign}
                label="Payment Type"
                value={emp.paymentType || "—"}
              />
              <DetailRow
                icon={Shield}
                label="EOBI Number"
                value={emp.eobiNumber}
              />
              <DetailRow
                icon={Shield}
                label="Social Security No"
                value={emp.socialSecurityNo}
              />
            </div>
            <Separator className="my-3" />
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Statutory & Settings
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${emp.eobiEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                >
                  EOBI {emp.eobiEnabled ? "✓" : "✗"}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${emp.essiEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                >
                  ESSI {emp.essiEnabled ? "✓" : "✗"}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${emp.gratuityEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                >
                  Gratuity {emp.gratuityEnabled ? "✓" : "✗"}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${emp.pfEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                >
                  PF {emp.pfEnabled ? "✓" : "✗"}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${emp.incomeTaxEnabled !== false ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                >
                  Tax {emp.incomeTaxEnabled !== false ? "✓" : "✗"}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${emp.applyToAllProjects ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                >
                  All Projects {emp.applyToAllProjects ? "✓" : "✗"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-blue-50 text-blue-700 border-blue-200">
                  {emp.defaultAllocationMethod === "percentage"
                    ? "Pct"
                    : "Days"}
                </span>
                {emp.taxFilingStatus && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${emp.taxFilingStatus === "filer" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                  >
                    {emp.taxFilingStatus === "filer" ? "Filer" : "Non-Filer"}
                  </span>
                )}
                {emp.taxCity && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-slate-50 text-slate-600 border-slate-200">
                    {emp.taxCity}
                  </span>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="accounting" className="mt-3">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Debit Accounts (Expense)
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <DetailRow
                    icon={BookOpen}
                    label="Salary Expense"
                    value={
                      emp.salaryExpenseAccount
                        ? `${emp.salaryExpenseAccount.code} · ${emp.salaryExpenseAccount.name}`
                        : "—"
                    }
                  />
                  <DetailRow
                    icon={BookOpen}
                    label="SC Expense"
                    value={
                      emp.scExpenseAccount
                        ? `${emp.scExpenseAccount.code} · ${emp.scExpenseAccount.name}`
                        : "—"
                    }
                  />
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Credit Accounts (Payable)
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <DetailRow
                    icon={BookOpen}
                    label="Salary Payable"
                    value={
                      emp.salaryPayableAccount
                        ? `${emp.salaryPayableAccount.code} · ${emp.salaryPayableAccount.name}`
                        : "—"
                    }
                  />
                  <DetailRow
                    icon={BookOpen}
                    label="SC Payable"
                    value={
                      emp.scPayableAccount
                        ? `${emp.scPayableAccount.code} · ${emp.scPayableAccount.name}`
                        : "—"
                    }
                  />
                  <DetailRow
                    icon={BookOpen}
                    label="Tax Payable"
                    value={
                      emp.taxPayableAccount
                        ? `${emp.taxPayableAccount.code} · ${emp.taxPayableAccount.name}`
                        : "—"
                    }
                  />
                </div>
              </div>
              {(!emp.salaryExpenseAccountId ||
                !emp.scExpenseAccountId ||
                !emp.salaryPayableAccountId ||
                !emp.scPayableAccountId ||
                !emp.taxPayableAccountId) && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      Accounts Not Configured
                    </p>
                    <p className="text-[10px] text-amber-600">
                      Employee cannot be included in salary voucher generation
                      until all 5 accounts are configured.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="other" className="mt-3">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Qualification 1
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <DetailRow
                    icon={GraduationCap}
                    label="Degree"
                    value={emp.qualification1}
                  />
                  <DetailRow
                    icon={GraduationCap}
                    label="Institute"
                    value={emp.institute1}
                  />
                  <DetailRow icon={Calendar} label="Year" value={emp.year1} />
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Qualification 2
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <DetailRow
                    icon={GraduationCap}
                    label="Degree"
                    value={emp.qualification2}
                  />
                  <DetailRow
                    icon={GraduationCap}
                    label="Institute"
                    value={emp.institute2}
                  />
                  <DetailRow icon={Calendar} label="Year" value={emp.year2} />
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Experience
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <DetailRow
                    icon={Briefcase}
                    label="Previous Employer"
                    value={emp.previousEmployer}
                  />
                  <DetailRow
                    icon={Briefcase}
                    label="Years of Experience"
                    value={emp.yearsOfExperience}
                  />
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  Next of Kin
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <DetailRow icon={Heart} label="Name" value={emp.nokName} />
                  <DetailRow
                    icon={Heart}
                    label="Relation"
                    value={emp.nokRelation}
                  />
                  <DetailRow
                    icon={CreditCard}
                    label="CNIC"
                    value={formatCnic(emp.nokCnic)}
                  />
                  <DetailRow
                    icon={Phone}
                    label="Contact"
                    value={emp.nokContact}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* ==================== KPI Summary Cards ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">
                  Total Employees
                </p>
                <p className="text-sm font-bold">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Active</p>
                <p className="text-sm font-bold text-green-600">
                  {activeCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">
                  Inactive / Others
                </p>
                <p className="text-sm font-bold text-gray-600">
                  {inactiveCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">
                  Monthly Salary
                </p>
                <p className="text-sm font-bold text-emerald-600">
                  {formatCurrency(totalMonthlySalary)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ==================== Search + Filters ==================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 text-xs pl-8 pr-8"
            placeholder="Search by name, CNIC, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(statusConfig).map(([value, cfg]) => (
                <SelectItem key={value} value={value}>
                  {cfg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={departmentFilter}
            onValueChange={(v) => {
              setDepartmentFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(statusFilter !== "all" || departmentFilter !== "all" || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-[10px] text-muted-foreground"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setDepartmentFilter("all");
                setPage(1);
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <div className="sm:ml-auto">
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* ==================== Employee Table ==================== */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Code</TableHead>
                  <TableHead className="text-[10px]">Name</TableHead>
                  <TableHead className="text-[10px]">Department</TableHead>
                  <TableHead className="text-[10px]">Designation</TableHead>
                  <TableHead className="text-[10px] text-right">
                    Base Salary
                  </TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px]">Statutory</TableHead>
                  <TableHead className="text-[10px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Loading employees...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="text-xs text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                        No employees found.{" "}
                        {search ||
                        statusFilter !== "all" ||
                        departmentFilter !== "all"
                          ? "Try adjusting your filters."
                          : 'Click "Add Employee" to create one.'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((emp: any) => {
                    const sc =
                      statusConfig[emp.status] || statusConfig.inactive;
                    return (
                      <TableRow
                        key={emp.id}
                        className="group cursor-pointer"
                        onClick={() => openViewDialog(emp)}
                      >
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {emp.employeeCode}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <span className="font-medium">{emp.name}</span>
                            {emp.contactNo && (
                              <p className="text-[9px] text-muted-foreground">
                                {emp.contactNo}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {emp.department || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {emp.designation || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {emp.baseSalary
                            ? formatCurrency(emp.baseSalary)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[9px] ${sc.color}`}>
                            {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-0.5">
                            <span
                              className={`text-[9px] px-1 py-0.5 rounded border ${emp.eobiEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                            >
                              EOBI {emp.eobiEnabled ? "✓" : "✗"}
                            </span>
                            <span
                              className={`text-[9px] px-1 py-0.5 rounded border ${emp.essiEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                            >
                              ESSI {emp.essiEnabled ? "✓" : "✗"}
                            </span>
                            <span
                              className={`text-[9px] px-1 py-0.5 rounded border ${emp.gratuityEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                            >
                              Grat {emp.gratuityEnabled ? "✓" : "✗"}
                            </span>
                            <span
                              className={`text-[9px] px-1 py-0.5 rounded border ${emp.pfEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                            >
                              PF {emp.pfEnabled ? "✓" : "✗"}
                            </span>
                            <span
                              className={`text-[9px] px-1 py-0.5 rounded border ${emp.incomeTaxEnabled !== false ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}
                            >
                              Tax {emp.incomeTaxEnabled !== false ? "✓" : "✗"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => router.push("/hr/profile")}
                              title="View Profile"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(emp)}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5 text-amber-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openDeleteDialog(emp)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-[10px] text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, total)} of {total} employees
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] text-muted-foreground px-2">
                  Page {page} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== Create Employee Dialog ==================== */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create New Employee
            </DialogTitle>
          </DialogHeader>

          <Tabs
            value={formTab}
            onValueChange={setFormTab}
            className="flex-1 min-h-0"
          >
            <TabsList className="h-8 w-full flex flex-wrap">
              <TabsTrigger
                value="personal"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <User className="h-3 w-3 mr-1" />
                Personal
              </TabsTrigger>
              <TabsTrigger
                value="employment"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <Briefcase className="h-3 w-3 mr-1" />
                Employment
              </TabsTrigger>
              <TabsTrigger
                value="banking"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                Banking
              </TabsTrigger>
              <TabsTrigger
                value="qualification"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <GraduationCap className="h-3 w-3 mr-1" />
                Qualification
              </TabsTrigger>
              <TabsTrigger
                value="salary"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <DollarSign className="h-3 w-3 mr-1" />
                Salary
              </TabsTrigger>
              <TabsTrigger
                value="accounting"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <BookOpen className="h-3 w-3 mr-1" />
                Accounting
                {(!form.salaryExpenseAccountId ||
                  !form.scExpenseAccountId ||
                  !form.salaryPayableAccountId ||
                  !form.scPayableAccountId ||
                  !form.taxPayableAccountId) && (
                  <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="nok"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <Heart className="h-3 w-3 mr-1" />
                Next of Kin
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 max-h-[55vh] mt-3 pr-1">
              <TabsContent value="personal" className="mt-0">
                {renderPersonalTab()}
              </TabsContent>
              <TabsContent value="employment" className="mt-0">
                {renderEmploymentTab()}
              </TabsContent>
              <TabsContent value="banking" className="mt-0">
                {renderBankingTab()}
              </TabsContent>
              <TabsContent value="qualification" className="mt-0">
                {renderQualificationTab()}
              </TabsContent>
              <TabsContent value="salary" className="mt-0">
                {renderSalaryTab()}
              </TabsContent>
              <TabsContent value="accounting" className="mt-0">
                {renderAccountingTab()}
              </TabsContent>
              <TabsContent value="nok" className="mt-0">
                {renderNextOfKinTab()}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-3 flex-row gap-2 justify-between sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={formTab === "personal"}
              onClick={() => {
                const tabs = [
                  "personal",
                  "employment",
                  "banking",
                  "qualification",
                  "salary",
                  "accounting",
                  "nok",
                ];
                const idx = tabs.indexOf(formTab);
                if (idx > 0) setFormTab(tabs[idx - 1]);
              }}
            >
              Previous
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              {formTab !== "nok" ? (
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const tabs = [
                      "personal",
                      "employment",
                      "banking",
                      "qualification",
                      "salary",
                      "accounting",
                      "nok",
                    ];
                    const idx = tabs.indexOf(formTab);
                    if (idx < tabs.length - 1) setFormTab(tabs[idx + 1]);
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={handleCreate}
                  disabled={saving}
                >
                  {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Create Employee
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Edit Employee Dialog ==================== */}
      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) {
            resetForm();
            setSelectedEmployee(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Employee — {selectedEmployee?.employeeCode}
            </DialogTitle>
          </DialogHeader>

          <Tabs
            value={formTab}
            onValueChange={setFormTab}
            className="flex-1 min-h-0"
          >
            <TabsList className="h-8 w-full flex flex-wrap">
              <TabsTrigger
                value="personal"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <User className="h-3 w-3 mr-1" />
                Personal
              </TabsTrigger>
              <TabsTrigger
                value="employment"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <Briefcase className="h-3 w-3 mr-1" />
                Employment
              </TabsTrigger>
              <TabsTrigger
                value="banking"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                Banking
              </TabsTrigger>
              <TabsTrigger
                value="qualification"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <GraduationCap className="h-3 w-3 mr-1" />
                Qualification
              </TabsTrigger>
              <TabsTrigger
                value="salary"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <DollarSign className="h-3 w-3 mr-1" />
                Salary
              </TabsTrigger>
              <TabsTrigger
                value="accounting"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <BookOpen className="h-3 w-3 mr-1" />
                Accounting
                {(!form.salaryExpenseAccountId ||
                  !form.scExpenseAccountId ||
                  !form.salaryPayableAccountId ||
                  !form.scPayableAccountId ||
                  !form.taxPayableAccountId) && (
                  <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="nok"
                className="text-[10px] flex-1 h-7 min-w-0"
              >
                <Heart className="h-3 w-3 mr-1" />
                Next of Kin
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 max-h-[55vh] mt-3 pr-1">
              <TabsContent value="personal" className="mt-0">
                {renderPersonalTab()}
              </TabsContent>
              <TabsContent value="employment" className="mt-0">
                {renderEmploymentTab()}
              </TabsContent>
              <TabsContent value="banking" className="mt-0">
                {renderBankingTab()}
              </TabsContent>
              <TabsContent value="qualification" className="mt-0">
                {renderQualificationTab()}
              </TabsContent>
              <TabsContent value="salary" className="mt-0">
                {renderSalaryTab()}
              </TabsContent>
              <TabsContent value="accounting" className="mt-0">
                {renderAccountingTab()}
              </TabsContent>
              <TabsContent value="nok" className="mt-0">
                {renderNextOfKinTab()}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setEditOpen(false);
                resetForm();
                setSelectedEmployee(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              onClick={handleUpdate}
              disabled={saving}
            >
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Update Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== View Employee Dialog ==================== */}
      <Dialog
        open={viewOpen}
        onOpenChange={(v) => {
          setViewOpen(v);
          if (!v) setSelectedEmployee(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Employee Details
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[70vh] pr-1">
            {renderViewDetail()}
          </ScrollArea>
          <DialogFooter className="mt-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                if (selectedEmployee) {
                  setViewOpen(false);
                  openEditDialog(selectedEmployee);
                }
              }}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setViewOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Delete Confirmation ==================== */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(v) => {
          setDeleteOpen(v);
          if (!v) setSelectedEmployee(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Delete Employee
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete{" "}
              <strong>{selectedEmployee?.name}</strong> (
              {selectedEmployee?.employeeCode})? This action cannot be undone.
              All related records (salary history, allowances, assignments) will
              also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedEmployee?.isFinancialUsed && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                    Cannot Delete
                  </p>
                  <p className="text-[10px] text-red-600">
                    This employee has been used in financial transactions and
                    cannot be deleted. Please deactivate the employee instead.
                  </p>
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={saving || selectedEmployee?.isFinancialUsed}
            >
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Row helper for the View dialog
// ---------------------------------------------------------------------------

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-medium break-words">{value || "—"}</p>
      </div>
    </div>
  );
}
