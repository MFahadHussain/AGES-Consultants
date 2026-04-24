'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Building2, Plus, TrendingDown, Download, Upload, Printer, Search, Filter,
  ChevronLeft, ChevronRight, ArrowUpDown, Package, AlertTriangle, Clock,
  CheckCircle2, XCircle, Eye, Edit, Trash2, FileText, BarChart3,
  Settings, Calendar, MapPin, User, Shield, Wrench, DollarSign,
  PieChart as PieChartIcon, Loader2, ChevronDown, Info, ArrowRight,
  Save, Send, Landmark, Car, Monitor, Armchair, Server, Cog, Map as MapIcon,
  CircleDot, FileSpreadsheet, RefreshCw, X, Check, RotateCcw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts'

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CATEGORIES = ['Land', 'Buildings', 'Vehicles', 'Furniture', 'Office Equipment', 'IT Assets', 'Machinery', 'Other']
const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'ICT', 'AJK', 'GB']
const ASSET_STATUSES = ['Active', 'Disposed', 'Transferred', 'Under Maintenance', 'Written Off']
const CONDITIONS = ['New', 'Old']
const DEP_METHODS = ['Straight-Line', 'Declining-Balance', 'None']
const DISPOSAL_METHODS = ['Sale', 'Scrap', 'Donation', 'Write-Off', 'Transfer to Govt.']
const FBR_RATES: Record<string, number> = {
  'Land': 0, 'Buildings': 5, 'Vehicles': 20, 'Furniture': 10,
  'Office Equipment': 15, 'IT Assets': 30, 'Machinery': 10, 'Other': 10
}
const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const CHART_COLORS = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#65a30d']
const ITEMS_PER_PAGE = 20

const GL_CATEGORY_MAP: Record<string, { asset: string; accDep: string; depExp: string }> = {
  'Land':              { asset: '1510', accDep: '', depExp: '' },
  'Buildings':         { asset: '1515', accDep: '1610', depExp: '5610' },
  'Vehicles':          { asset: '1520', accDep: '1620', depExp: '5620' },
  'Furniture':         { asset: '1525', accDep: '1630', depExp: '5630' },
  'Office Equipment':  { asset: '1530', accDep: '1640', depExp: '5640' },
  'IT Assets':         { asset: '1535', accDep: '1650', depExp: '5650' },
  'Machinery':         { asset: '1540', accDep: '1660', depExp: '5660' },
  'Other':             { asset: '1545', accDep: '1670', depExp: '5670' },
}

// ─── PKR Utility ──────────────────────────────────────────────────────────────

const pkr = (n: number) => new Intl.NumberFormat('en-PK', {
  style: 'currency', currency: 'PKR', maximumFractionDigits: 0
}).format(n ?? 0)

const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetRecord {
  id: string
  assetId: string
  name: string
  description?: string | null
  category: string
  subCategory?: string | null
  serialNumber?: string | null
  condition: string
  notes?: string | null
  dateOfPurchase: string
  dateOfCapitalization: string
  invoiceNumber?: string | null
  supplierName?: string | null
  supplierNTN?: string | null
  purchasePrice: number
  residualValue: number
  usefulLifeYears: number
  depreciationMethod: string
  decliningRate: number
  location?: string | null
  province: string
  custodian?: string | null
  department?: string | null
  costCenter?: string | null
  project?: string | null
  fundCode?: string | null
  donorCode?: string | null
  isDonorFunded: boolean
  donor?: string | null
  grantReference?: string | null
  donorRestrictions?: string | null
  insuranceValue: number
  insurancePolicyNumber?: string | null
  insuranceExpiryDate?: string | null
  warrantyExpiryDate?: string | null
  glAssetAccount?: string | null
  glAccDepAccount?: string | null
  glDepExpAccount?: string | null
  accumulatedDepreciation: number
  netBookValue: number
  status: string
  approvalStatus: string
  journalStatus: string
  taxRate: number
  taxMethod: string
  createdAt: string
  updatedAt: string
  // New registration form fields
  assetTag?: string | null
  make?: string | null
  model?: string | null
  modelYear?: number | null
  priorApprovalNo?: string | null
  purchaseOrderNo?: string | null
  receiptVoucherNo?: string | null
  checkRegisterNo?: string | null
  stockRegisterPageNo?: string | null
  depreciationRecords?: DepreciationRecord[]
  transactions?: TransactionRecord[]
  computed?: {
    depreciableAmount: number
    depreciationPct: number
    remainingLife: number
    isFullyDepreciated: boolean
  }
}

interface DepreciationRecord {
  id: string
  assetId: string
  financialYear: string
  period: string
  monthNumber: number
  openingNBV: number
  depreciationCharge: number
  accumulatedDepreciation: number
  closingNBV: number
  isPosted: boolean
  journalStatus: string
  isTaxDepreciation: boolean
}

interface TransactionRecord {
  id: string
  txnId: string
  assetId: string
  type: string
  date: string
  description?: string | null
  amount: number
  fromLocation?: string | null
  toLocation?: string | null
  fromCustodian?: string | null
  toCustodian?: string | null
  fromCostCenter?: string | null
  toCostCenter?: string | null
  proceeds: number
  gainLoss: number
  disposalMethod?: string | null
  adjustmentType?: string | null
  newValue?: number | null
  transferCertNo?: string | null
  status: string
  journalStatus: string
  notes?: string | null
  createdAt: string
  asset?: Partial<AssetRecord>
}

interface FiscalYearRecord {
  id: string
  label: string
  startDate: string
  endDate: string
  status: string
  depRunStatus: string
  depRunStatusParsed: Record<string, string>
  progress: {
    totalPeriods: number
    completedPeriods: number
    pendingPeriods: number
    reversedPeriods: number
    completionPct: number
  }
}

interface JournalRecord {
  id: string
  journalNumber: string
  type: string
  date: string
  narration?: string | null
  assetId?: string | null
  assetName?: string | null
  drAccountCode?: string | null
  drAccountName?: string | null
  drAmount: number
  crAccountCode?: string | null
  crAccountName?: string | null
  crAmount: number
  costCenter?: string | null
  project?: string | null
  fundCode?: string | null
  status: string
  createdAt: string
}

interface SettingItem {
  key: string
  value: string
  description?: string | null
}

interface WizardForm {
  name: string
  description: string
  category: string
  subCategory: string
  serialNumber: string
  condition: string
  notes: string
  dateOfPurchase: string
  invoiceNumber: string
  supplierName: string
  supplierNTN: string
  purchasePrice: number
  dateOfCapitalization: string
  depreciationMethod: string
  usefulLifeYears: number
  residualValue: number
  decliningRate: number
  location: string
  province: string
  custodian: string
  costCenter: string
  project: string
  fundCode: string
  isDonorFunded: boolean
  donor: string
  grantReference: string
  donorRestrictions: string
  donorCode: string
  insuranceValue: number
  insurancePolicyNumber: string
  insuranceExpiryDate: string
  warrantyExpiryDate: string
  glAssetAccount: string
  glAccDepAccount: string
  glDepExpAccount: string
  approvalStatus: string
  // New registration form fields
  assetTag: string
  make: string
  model: string
  modelYear: number
  priorApprovalNo: string
  purchaseOrderNo: string
  receiptVoucherNo: string
  checkRegisterNo: string
  stockRegisterPageNo: string
}

const initialWizardForm: WizardForm = {
  name: '',
  description: '',
  category: '',
  subCategory: '',
  serialNumber: '',
  condition: 'New',
  notes: '',
  dateOfPurchase: '',
  invoiceNumber: '',
  supplierName: '',
  supplierNTN: '',
  purchasePrice: 0,
  dateOfCapitalization: '',
  depreciationMethod: 'Straight-Line',
  usefulLifeYears: 5,
  residualValue: 0,
  decliningRate: 20,
  location: '',
  province: 'KPK',
  custodian: '',
  costCenter: '',
  project: '',
  fundCode: '',
  isDonorFunded: false,
  donor: '',
  grantReference: '',
  donorRestrictions: '',
  donorCode: '',
  insuranceValue: 0,
  insurancePolicyNumber: '',
  insuranceExpiryDate: '',
  warrantyExpiryDate: '',
  glAssetAccount: '',
  glAccDepAccount: '',
  glDepExpAccount: '',
  approvalStatus: 'Draft',
  // New registration form fields
  assetTag: '',
  make: '',
  model: '',
  modelYear: new Date().getFullYear(),
  priorApprovalNo: '',
  purchaseOrderNo: '',
  receiptVoucherNo: '',
  checkRegisterNo: '',
  stockRegisterPageNo: '',
}

// ─── Category Icon Helper ─────────────────────────────────────────────────────

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Land': return <MapIcon className="h-4 w-4" />
    case 'Buildings': return <Building2 className="h-4 w-4" />
    case 'Vehicles': return <Car className="h-4 w-4" />
    case 'Furniture': return <Armchair className="h-4 w-4" />
    case 'Office Equipment': return <Monitor className="h-4 w-4" />
    case 'IT Assets': return <Server className="h-4 w-4" />
    case 'Machinery': return <Cog className="h-4 w-4" />
    default: return <Package className="h-4 w-4" />
  }
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    'Active': 'bg-emerald-100 text-emerald-800',
    'Disposed': 'bg-red-100 text-red-800',
    'Transferred': 'bg-sky-100 text-sky-800',
    'Under Maintenance': 'bg-amber-100 text-amber-800',
    'Written Off': 'bg-gray-100 text-gray-800',
  }
  return <Badge variant="secondary" className={`text-[10px] ${map[status] || 'bg-gray-100 text-gray-800'}`}>{status}</Badge>
}

const approvalBadge = (status: string) => {
  const map: Record<string, string> = {
    'Approved': 'bg-emerald-100 text-emerald-800',
    'Pending Approval': 'bg-amber-100 text-amber-800',
    'Draft': 'bg-gray-100 text-gray-800',
    'Rejected': 'bg-red-100 text-red-800',
  }
  return <Badge variant="secondary" className={`text-[10px] ${map[status] || ''}`}>{status}</Badge>
}

const journalBadge = (status: string) => {
  const map: Record<string, string> = {
    'Pending Export': 'bg-amber-100 text-amber-800',
    'Exported': 'bg-emerald-100 text-emerald-800',
    'Reversed': 'bg-red-100 text-red-800',
    'N/A': 'bg-gray-100 text-gray-600',
  }
  return <Badge variant="secondary" className={`text-[10px] ${map[status] || ''}`}>{status}</Badge>
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FixedAssetsModule() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [summary, setSummary] = useState({ totalCost: 0, totalAccDep: 0, totalNBV: 0, donorCount: 0, donorCost: 0, totalCount: 0 })
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardForm, setWizardForm] = useState<WizardForm>({ ...initialWizardForm })
  const [editMode, setEditMode] = useState(false)
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [detailAsset, setDetailAsset] = useState<AssetRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Depreciation state
  const [depRecords, setDepRecords] = useState<DepreciationRecord[]>([])
  const [depFiscalYear, setDepFiscalYear] = useState('2024-25')
  const [depPeriod, setDepPeriod] = useState('')
  const [depRunning, setDepRunning] = useState(false)
  const [fiscalYears, setFiscalYears] = useState<FiscalYearRecord[]>([])

  // Transaction state
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [txnSubTab, setTxnSubTab] = useState('all')
  const [disposalOpen, setDisposalOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)

  // Reports state
  const [reportType, setReportType] = useState('asset-register')
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Settings state
  const [settings, setSettings] = useState<Record<string, SettingItem>>({})

  // Journals state
  const [journals, setJournals] = useState<JournalRecord[]>([])
  const [journalStatusCounts, setJournalStatusCounts] = useState({ pending: 0, exported: 0, reversed: 0 })

  // Asset Register filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterProvince, setFilterProvince] = useState('all')
  const [filterDonor, setFilterDonor] = useState('all')
  const [filterDepMethod, setFilterDepMethod] = useState('all')
  const [filterApproval, setFilterApproval] = useState('all')
  const [sortField, setSortField] = useState<string>('assetId')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalAssets, setTotalAssets] = useState(0)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  // Role-based access state
  const [currentRole, setCurrentRole] = useState<string>('super-admin')

  // COA Category accounts for dropdown
  const [coaCategories, setCoaCategories] = useState<Array<{ id: string; code: string; name: string }>>([])

  // CSV Import state
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvProgress, setCsvProgress] = useState({ done: 0, total: 0 })
  const [csvErrors, setCsvErrors] = useState<string[]>([])

  // ─── Role Definitions & Permissions ──────────────────────────────────────

  const ROLES: Record<string, { label: string; color: string; icon: string }> = {
    'super-admin': { label: 'Super Admin', color: 'bg-red-100 text-red-800', icon: '👑' },
    'cfo': { label: 'CFO', color: 'bg-amber-100 text-amber-800', icon: '🏛️' },
    'finance-officer': { label: 'Finance Officer', color: 'bg-emerald-100 text-emerald-800', icon: '💰' },
    'asset-manager': { label: 'Asset Manager', color: 'bg-sky-100 text-sky-800', icon: '📦' },
    'custodian': { label: 'Custodian', color: 'bg-violet-100 text-violet-800', icon: '🔑' },
    'auditor': { label: 'Auditor', color: 'bg-gray-100 text-gray-800', icon: '🔍' },
    'viewer': { label: 'Viewer', color: 'bg-slate-100 text-slate-800', icon: '👁️' },
  }

  const canCreate = ['super-admin', 'cfo', 'finance-officer', 'asset-manager'].includes(currentRole)
  const canEdit = ['super-admin', 'cfo', 'finance-officer', 'asset-manager'].includes(currentRole)
  const canDelete = ['super-admin', 'cfo'].includes(currentRole)
  const canApprove = ['super-admin', 'cfo'].includes(currentRole)
  const canRunDepreciation = ['super-admin', 'cfo', 'finance-officer'].includes(currentRole)
  const canExportJournals = ['super-admin', 'cfo', 'finance-officer'].includes(currentRole)
  const canManageTransactions = ['super-admin', 'cfo', 'finance-officer', 'asset-manager'].includes(currentRole)
  const canRequestTransfer = currentRole === 'custodian'
  const isReadOnly = ['auditor', 'viewer'].includes(currentRole)
  const isCustodian = currentRole === 'custodian'

  // ─── CSV Import Helpers ──────────────────────────────────────────────────

  const CSV_REQUIRED_COLUMNS = ['name', 'category', 'purchasePrice', 'dateOfPurchase', 'location', 'custodian']
  const CSV_OPTIONAL_COLUMNS = ['description', 'serialNumber', 'condition', 'supplierName', 'isDonorFunded', 'donor', 'province', 'depreciationMethod', 'usefulLifeYears', 'residualValue']

  const parseCsvPreview = (): { headers: string[]; rows: string[][]; errors: string[] } => {
    const errors: string[] = []
    if (!csvText.trim()) return { headers: [], rows: [], errors: ['No CSV data provided'] }
    const lines = csvText.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
    if (lines.length < 2) return { headers: [], rows: [], errors: ['CSV must have a header row and at least one data row'] }
    const headers = lines[0]
    const missingRequired = CSV_REQUIRED_COLUMNS.filter(c => !headers.includes(c))
    if (missingRequired.length > 0) errors.push(`Missing required columns: ${missingRequired.join(', ')}`)
    const rows = lines.slice(1, 6)
    return { headers, rows, errors }
  }

  const handleCsvImport = async () => {
    const { headers, errors: parseErrors } = parseCsvPreview()
    if (parseErrors.length > 0) {
      setCsvErrors(parseErrors)
      return
    }
    const lines = csvText.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
    const dataRows = lines.slice(1)
    setCsvImporting(true)
    setCsvProgress({ done: 0, total: dataRows.length })
    setCsvErrors([])
    const errs: string[] = []
    let done = 0
    for (const row of dataRows) {
      try {
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = row[i] || '' })
        const payload = {
          name: obj.name,
          category: obj.category,
          purchasePrice: parseFloat(obj.purchasePrice) || 0,
          dateOfPurchase: obj.dateOfPurchase,
          location: obj.location,
          custodian: obj.custodian,
          description: obj.description || '',
          serialNumber: obj.serialNumber || '',
          condition: obj.condition || 'Good',
          supplierName: obj.supplierName || '',
          isDonorFunded: obj.isDonorFunded === 'true' || obj.isDonorFunded === 'yes',
          donor: obj.donor || '',
          province: obj.province || 'KPK',
          depreciationMethod: obj.depreciationMethod || 'Straight-Line',
          usefulLifeYears: parseInt(obj.usefulLifeYears) || 5,
          residualValue: parseFloat(obj.residualValue) || 0,
          dateOfCapitalization: obj.dateOfPurchase,
          approvalStatus: 'Draft' as const,
        }
        const res = await fetch('/api/fams/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          errs.push(`Row ${done + 1} (${obj.name}): ${errData.error || 'Failed'}`)
        }
      } catch {
        errs.push(`Row ${done + 1}: Network error`)
      }
      done++
      setCsvProgress({ done, total: dataRows.length })
    }
    setCsvErrors(errs)
    setCsvImporting(false)
    if (errs.length === 0) {
      toast({ title: 'Import Complete', description: `${done} assets imported successfully` })
      setCsvImportOpen(false)
      setCsvText('')
      refreshAll()
    } else {
      toast({ title: 'Import Completed with Errors', description: `${done - errs.length}/${done} succeeded`, variant: 'destructive' })
      refreshAll()
    }
  }

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchAssets = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(ITEMS_PER_PAGE) })
      if (searchQuery) params.set('search', searchQuery)
      if (filterCategory !== 'all') params.set('category', filterCategory)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterProvince !== 'all') params.set('province', filterProvince)
      if (filterDonor !== 'all') params.set('isDonorFunded', filterDonor === 'yes' ? 'true' : 'false')
      if (filterDepMethod !== 'all') params.set('depreciationMethod', filterDepMethod)
      if (filterApproval !== 'all') params.set('approvalStatus', filterApproval)

      const res = await fetch(`/api/fams/assets?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAssets(data.assets || [])
        setTotalAssets(data.total || 0)
        setTotalPages(data.totalPages || 1)
        if (data.summary) {
          setSummary(data.summary)
        }
      }
    } catch (err) {
      console.error('Error fetching assets:', err)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, filterCategory, filterStatus, filterProvince, filterDonor, filterDepMethod, filterApproval])

  const fetchFiscalYears = useCallback(async () => {
    try {
      const res = await fetch('/api/fams/fiscal-years')
      if (res.ok) {
        const data = await res.json()
        setFiscalYears(Array.isArray(data) ? data : data.fiscalYears || [])
      }
    } catch (err) {
      console.error('Error fetching fiscal years:', err)
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/fams/transactions?limit=50')
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || [])
      }
    } catch (err) {
      console.error('Error fetching transactions:', err)
    }
  }, [])

  const fetchDepreciation = useCallback(async () => {
    try {
      const res = await fetch(`/api/fams/depreciation?financialYear=${depFiscalYear}&limit=200`)
      if (res.ok) {
        const data = await res.json()
        setDepRecords(data.records || [])
      }
    } catch (err) {
      console.error('Error fetching depreciation:', err)
    }
  }, [depFiscalYear])

  const fetchJournals = useCallback(async () => {
    try {
      const res = await fetch('/api/fams/journals?limit=50')
      if (res.ok) {
        const data = await res.json()
        setJournals(data.journals || [])
        if (data.statusCounts) setJournalStatusCounts(data.statusCounts)
      }
    } catch (err) {
      console.error('Error fetching journals:', err)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/fams/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.flatMap) {
          const map: Record<string, SettingItem> = {}
          for (const [k, v] of Object.entries(data.flatMap as Record<string, string>)) {
            map[k] = { key: k, value: v }
          }
          setSettings(map)
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
    }
  }, [])

  const fetchCoaCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts?accountType=ASSET&isActive=true')
      if (res.ok) {
        const data = await res.json()
        const accounts = Array.isArray(data) ? data : (data.accounts || [])
        // Filter to fixed asset category accounts - include FIXED_ASSET subType and specific asset sub-types
        // Exclude accumulated depreciation accounts
        const fixedAssetAccounts = accounts.filter(
          (a: { subType?: string | null; code?: string; name?: string; allowPosting?: boolean }) => {
            if (!a.subType) return false
            if (a.subType === 'ACCUMULATED_DEPRECIATION') return false
            if (!a.allowPosting) return false
            return ['FIXED_ASSET', 'LAND', 'BUILDING', 'VEHICLE', 'FURNITURE',
                    'OFFICE_EQUIPMENT', 'IT_ASSET', 'MACHINERY', 'OTHER_FIXED_ASSET'].includes(a.subType)
          }
        )
        setCoaCategories(fixedAssetAccounts.map((a: { id: string; code: string; name: string }) => ({ id: a.id, code: a.code, name: a.name })))
      }
    } catch {
      setCoaCategories(ASSET_CATEGORIES.map((c, i) => ({ id: String(i), code: String(1510 + i * 5), name: c })))
    }
  }, [])

  // GL Post Status
  const [glPostStatus, setGlPostStatus] = useState<{ pendingJournals: number; pendingAmount: number; assetsNeedingAcquisition: number; acquisitionAmount: number } | null>(null)

  const fetchGLPostStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/fams/gl-post')
      if (res.ok) {
        const data = await res.json()
        setGlPostStatus(data)
      }
    } catch { /* ignore */ }
  }, [])

  // Initial data load
  useEffect(() => {
    fetchAssets(1)
  }, [fetchAssets])

  useEffect(() => {
    fetchFiscalYears()
    fetchTransactions()
    fetchJournals()
    fetchSettings()
    fetchGLPostStatus()
    fetchCoaCategories()
  }, [fetchFiscalYears, fetchTransactions, fetchJournals, fetchSettings, fetchGLPostStatus, fetchCoaCategories])

  useEffect(() => {
    fetchDepreciation()
  }, [fetchDepreciation])

  // Refetch when filters change
  useEffect(() => {
    fetchAssets(currentPage)
  }, [currentPage, fetchAssets])

  const refreshAll = useCallback(() => {
    fetchAssets(currentPage)
    fetchFiscalYears()
    fetchTransactions()
    fetchJournals()
    fetchSettings()
    fetchDepreciation()
    fetchGLPostStatus()
  }, [fetchAssets, fetchFiscalYears, fetchTransactions, fetchJournals, fetchSettings, fetchDepreciation, fetchGLPostStatus, currentPage])

  // ─── Computed Values ────────────────────────────────────────────────────

  const totalYtdDep = useMemo(() => {
    return depRecords.filter(r => !r.isTaxDepreciation).reduce((s, r) => s + r.depreciationCharge, 0)
  }, [depRecords])

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    assets.forEach(a => map.set(a.category, (map.get(a.category) ?? 0) + a.purchasePrice))
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [assets])

  const monthlyDepTrend = useMemo(() => {
    const monthMap = new Map<string, number>()
    depRecords.filter(r => !r.isTaxDepreciation).forEach(r => {
      const monthKey = r.period.split('-')[0]
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + r.depreciationCharge)
    })
    return MONTHS.map(m => ({ month: m, depreciation: Math.round(monthMap.get(m) ?? 0) }))
  }, [depRecords])

  const nbvByCategory = useMemo(() => {
    const map = new Map<string, number>()
    assets.forEach(a => map.set(a.category, (map.get(a.category) ?? 0) + a.netBookValue))
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [assets])

  // ─── Alerts ─────────────────────────────────────────────────────────────

  const nearFullDepAssets = useMemo(() =>
    assets.filter(a => a.netBookValue > 0 && a.purchasePrice > 0 && (a.netBookValue / a.purchasePrice) < 0.1),
    [assets]
  )
  const insuranceExpiring = useMemo(() =>
    assets.filter(a => {
      if (!a.insuranceExpiryDate) return false
      const diff = new Date(a.insuranceExpiryDate).getTime() - Date.now()
      return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
    }),
    [assets]
  )
  const pendingApprovals = useMemo(() => assets.filter(a => a.approvalStatus === 'Pending Approval' || a.approvalStatus === 'Draft').length, [assets])
  const pendingJournals = useMemo(() => journalStatusCounts.pending, [journalStatusCounts])

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const openAddWizard = () => {
    setWizardForm({ ...initialWizardForm })
    setWizardStep(1)
    setEditMode(false)
    setEditingAssetId(null)
    setWizardOpen(true)
    fetchCoaCategories()
  }

  const openEditWizard = (asset: AssetRecord) => {
    setWizardForm({
      name: asset.name,
      description: asset.description || '',
      category: asset.category,
      subCategory: asset.subCategory || '',
      serialNumber: asset.serialNumber || '',
      condition: asset.condition,
      notes: asset.notes || '',
      dateOfPurchase: asset.dateOfPurchase ? new Date(asset.dateOfPurchase).toISOString().split('T')[0] : '',
      invoiceNumber: asset.invoiceNumber || '',
      supplierName: asset.supplierName || '',
      supplierNTN: asset.supplierNTN || '',
      purchasePrice: asset.purchasePrice,
      dateOfCapitalization: asset.dateOfCapitalization ? new Date(asset.dateOfCapitalization).toISOString().split('T')[0] : '',
      depreciationMethod: asset.depreciationMethod,
      usefulLifeYears: asset.usefulLifeYears,
      residualValue: asset.residualValue,
      decliningRate: asset.decliningRate,
      location: asset.location || '',
      province: asset.province,
      custodian: asset.custodian || '',
      costCenter: asset.costCenter || '',
      project: asset.project || '',
      fundCode: asset.fundCode || '',
      isDonorFunded: asset.isDonorFunded,
      donor: asset.donor || '',
      grantReference: asset.grantReference || '',
      donorRestrictions: asset.donorRestrictions || '',
      donorCode: asset.donorCode || '',
      insuranceValue: asset.insuranceValue,
      insurancePolicyNumber: asset.insurancePolicyNumber || '',
      insuranceExpiryDate: asset.insuranceExpiryDate ? new Date(asset.insuranceExpiryDate).toISOString().split('T')[0] : '',
      warrantyExpiryDate: asset.warrantyExpiryDate ? new Date(asset.warrantyExpiryDate).toISOString().split('T')[0] : '',
      glAssetAccount: asset.glAssetAccount || '',
      glAccDepAccount: asset.glAccDepAccount || '',
      glDepExpAccount: asset.glDepExpAccount || '',
      approvalStatus: asset.approvalStatus,
      assetTag: (asset as AssetRecord & { assetTag?: string }).assetTag || '',
      make: (asset as AssetRecord & { make?: string }).make || '',
      model: (asset as AssetRecord & { model?: string }).model || '',
      modelYear: (asset as AssetRecord & { modelYear?: number | null }).modelYear ?? new Date().getFullYear(),
      priorApprovalNo: (asset as AssetRecord & { priorApprovalNo?: string }).priorApprovalNo || '',
      purchaseOrderNo: (asset as AssetRecord & { purchaseOrderNo?: string }).purchaseOrderNo || '',
      receiptVoucherNo: (asset as AssetRecord & { receiptVoucherNo?: string }).receiptVoucherNo || '',
      checkRegisterNo: (asset as AssetRecord & { checkRegisterNo?: string }).checkRegisterNo || '',
      stockRegisterPageNo: (asset as AssetRecord & { stockRegisterPageNo?: string }).stockRegisterPageNo || '',
    })
    setEditMode(true)
    setEditingAssetId(asset.id)
    setWizardOpen(true)
  }

  const viewAssetDetail = async (asset: AssetRecord) => {
    try {
      const res = await fetch(`/api/fams/assets/${asset.id}`)
      if (res.ok) {
        const data = await res.json()
        setDetailAsset(data)
        setDetailOpen(true)
      }
    } catch {
      setDetailAsset(asset)
      setDetailOpen(true)
    }
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: return !!(wizardForm.name && wizardForm.category && wizardForm.condition)
      case 2: return !!(wizardForm.dateOfPurchase && wizardForm.invoiceNumber && wizardForm.purchasePrice > 0 && wizardForm.dateOfCapitalization)
      case 3: {
        if (wizardForm.isDonorFunded || wizardForm.category === 'Land') return true
        if (wizardForm.depreciationMethod === 'None') return true
        if (wizardForm.depreciationMethod === 'Straight-Line') return !!(wizardForm.usefulLifeYears > 0 && wizardForm.residualValue >= 0)
        if (wizardForm.depreciationMethod === 'Declining-Balance') return !!(wizardForm.decliningRate > 0 && wizardForm.residualValue >= 0)
        return false
      }
      case 4: return !!(wizardForm.location && wizardForm.province && wizardForm.custodian)
      case 5: {
        if (!wizardForm.isDonorFunded) return true
        return !!(wizardForm.donor && wizardForm.grantReference)
      }
      case 6: return true
      case 7: return true
      default: return false
    }
  }

  const handleSaveAsset = async (submitType: 'draft' | 'submit') => {
    setSaving(true)
    try {
      const isNoDep = wizardForm.isDonorFunded || wizardForm.category === 'Land' || wizardForm.depreciationMethod === 'None'
      const payload = {
        ...wizardForm,
        depreciationMethod: isNoDep ? 'None' : wizardForm.depreciationMethod,
        usefulLifeYears: isNoDep ? 0 : wizardForm.usefulLifeYears,
        residualValue: isNoDep ? (wizardForm.category === 'Land' ? wizardForm.purchasePrice : 0) : wizardForm.residualValue,
        decliningRate: isNoDep ? 0 : wizardForm.decliningRate,
        approvalStatus: submitType === 'draft' ? 'Draft' : 'Pending Approval',
      }

      const url = editMode && editingAssetId ? `/api/fams/assets/${editingAssetId}` : '/api/fams/assets'
      const method = editMode ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const assetData = await res.json()

        // If submitting (not draft), also create a draft voucher in the accounting module
        if (submitType === 'submit' && !editMode && assetData.id) {
          try {
            const glMap = GL_CATEGORY_MAP[wizardForm.category] || { asset: '1545', accDep: '1670', depExp: '5670' }
            // Resolve account codes to IDs
            const assetAccount = await (await fetch(`/api/accounts?search=${glMap.asset}`)).json().then(d => (d.accounts || d || [])[0]).catch(() => null)
            const bankAccount = await (await fetch(`/api/accounts?search=1121`)).json().then(d => (d.accounts || d || [])[0]).catch(() => null)

            if (assetAccount?.id && bankAccount?.id) {
              await fetch('/api/vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  voucherType: 'BP',
                  voucherTypeName: 'Bank Payment',
                  date: wizardForm.dateOfPurchase || new Date().toISOString().split('T')[0],
                  narration: `Fixed Asset Acquisition: ${wizardForm.name} (${wizardForm.category}) — Asset ID: ${assetData.assetId || 'N/A'}${wizardForm.assetTag ? ` | Tag: ${wizardForm.assetTag}` : ''}`,
                  reference: `AST-${assetData.assetId || 'NEW'}`,
                  payeeName: wizardForm.supplierName || '',
                  autoPost: false,
                  isAssetPosted: true,
                  entries: [
                    { accountId: assetAccount.id, debit: wizardForm.purchasePrice, credit: 0, description: `Dr. ${wizardForm.category} Asset — ${wizardForm.name}`, assetRef: assetData.assetId || '' },
                    { accountId: bankAccount.id, debit: 0, credit: wizardForm.purchasePrice, description: `Cr. Bank — ${wizardForm.supplierName || 'Payment for asset'}`, assetRef: assetData.assetId || '' },
                  ],
                }),
              })
            }
          } catch (voucherErr) {
            console.error('Draft voucher creation failed:', voucherErr)
            // Don't fail the whole save — asset is already saved
          }
        }

        toast({
          title: 'Success',
          description: submitType === 'submit'
            ? 'Asset saved and Draft Voucher created successfully.'
            : editMode ? 'Asset updated successfully' : 'Asset saved as draft.',
        })
        setWizardOpen(false)
        refreshAll()
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Failed to save asset', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save asset', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    try {
      const res = await fetch(`/api/fams/assets/${assetId}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'Success', description: 'Asset written off successfully' })
        refreshAll()
        setDetailOpen(false)
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed', variant: 'destructive' })
    }
  }

  const handleApproveAsset = async (assetId: string) => {
    try {
      const res = await fetch(`/api/fams/assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus: 'Approved' }),
      })
      if (res.ok) {
        toast({ title: 'Approved', description: 'Asset approved successfully' })
        refreshAll()
        setDetailOpen(false)
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to approve', variant: 'destructive' })
    }
  }

  const handleRunDepreciation = async () => {
    if (!depFiscalYear || !depPeriod) {
      toast({ title: 'Error', description: 'Select fiscal year and period', variant: 'destructive' })
      return
    }
    const monthNum = MONTHS.indexOf(depPeriod.split('-')[0]) + 1
    setDepRunning(true)
    try {
      const res = await fetch('/api/fams/depreciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financialYear: depFiscalYear,
          period: depPeriod,
          monthNumber: monthNum,
          runTaxDepreciation: true,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Depreciation Run Complete', description: `${data.processed} assets processed, total charge: ${pkr(data.totalCharge)}` })
        refreshAll()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to run depreciation', variant: 'destructive' })
    } finally {
      setDepRunning(false)
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/fams/export', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Export Complete', description: `${data.entryCount} entries exported, batch: ${data.batchRef}` })
        refreshAll()
      } else {
        toast({ title: 'Error', description: data.error || 'No pending journals', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    }
  }

  const handlePostToGL = async (action: 'post-all' | 'post-acquisition' | 'post-selected', journalIds?: string[]) => {
    try {
      const res = await fetch('/api/fams/gl-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, journalIds }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Posted to GL', description: data.message || `${data.journalCount || 0} entries posted to General Ledger` })
        refreshAll()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to post to GL', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to post to GL', variant: 'destructive' })
    }
  }

  const handleDisposal = async (form: { assetId: string; date: string; disposalMethod: string; proceeds: number; description: string }) => {
    try {
      const res = await fetch('/api/fams/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: form.assetId, type: 'Disposal', date: form.date, disposalMethod: form.disposalMethod, proceeds: form.proceeds, description: form.description }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Disposal Recorded', description: `Gain/Loss: ${pkr(data.gainLoss || 0)}` })
        setDisposalOpen(false)
        refreshAll()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed', variant: 'destructive' })
    }
  }

  const handleTransfer = async (form: Record<string, string>) => {
    try {
      const res = await fetch('/api/fams/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: form.assetId, type: 'Transfer', date: form.date, fromLocation: form.fromLocation, toLocation: form.toLocation, fromCustodian: form.fromCustodian, toCustodian: form.toCustodian, fromCostCenter: form.fromCostCenter, toCostCenter: form.toCostCenter, description: form.description }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Transfer Recorded', description: `Certificate: ${data.transferCertNo || ''}` })
        setTransferOpen(false)
        refreshAll()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed', variant: 'destructive' })
    }
  }

  const handleAdjustment = async (form: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/fams/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: form.assetId, type: 'Adjustment', date: form.date, adjustmentType: form.adjustmentType, newValue: form.newValue, description: form.description }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Adjustment Recorded', description: `Amount: ${pkr(data.adjustmentAmount || 0)}` })
        setAdjustmentOpen(false)
        refreshAll()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed', variant: 'destructive' })
    }
  }

  const handleFetchReport = async () => {
    setReportLoading(true)
    try {
      const res = await fetch(`/api/fams/reports?type=${reportType}&financialYear=${depFiscalYear}`)
      if (res.ok) {
        const data = await res.json()
        setReportData(data)
      } else {
        toast({ title: 'Error', description: 'Failed to generate report', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed', variant: 'destructive' })
    } finally {
      setReportLoading(false)
    }
  }

  const handleSaveSettings = async (updatedSettings: Array<{ key: string; value: string }>) => {
    try {
      const res = await fetch('/api/fams/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updatedSettings }),
      })
      if (res.ok) {
        toast({ title: 'Settings Saved', description: `${updatedSettings.length} settings updated` })
        fetchSettings()
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' })
    }
  }

  const toggleSelectRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedRows.size === assets.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(assets.map(a => a.id)))
    }
  }

  // ─── Depreciation Calculations for Wizard ───────────────────────────────

  const depCalculation = useMemo(() => {
    if (wizardForm.isDonorFunded || wizardForm.category === 'Land' || wizardForm.depreciationMethod === 'None') {
      return { annual: 0, monthly: 0, totalDep: 0 }
    }
    if (wizardForm.depreciationMethod === 'Straight-Line') {
      const annual = wizardForm.usefulLifeYears > 0
        ? (wizardForm.purchasePrice - wizardForm.residualValue) / wizardForm.usefulLifeYears
        : 0
      return { annual, monthly: annual / 12, totalDep: wizardForm.purchasePrice - wizardForm.residualValue }
    }
    if (wizardForm.depreciationMethod === 'Declining-Balance') {
      const annual = wizardForm.purchasePrice * (wizardForm.decliningRate / 100)
      return { annual, monthly: annual / 12, totalDep: wizardForm.purchasePrice - wizardForm.residualValue }
    }
    return { annual: 0, monthly: 0, totalDep: 0 }
  }, [wizardForm.depreciationMethod, wizardForm.purchasePrice, wizardForm.usefulLifeYears, wizardForm.residualValue, wizardForm.decliningRate, wizardForm.isDonorFunded, wizardForm.category])

  const depSchedulePreview = useMemo(() => {
    if (wizardForm.isDonorFunded || wizardForm.category === 'Land' || wizardForm.depreciationMethod === 'None' || wizardForm.purchasePrice <= 0) {
      return []
    }
    const schedule: { year: number; openingNbv: number; annualDep: number; closingNbv: number }[] = []
    let openingNbv = wizardForm.purchasePrice
    for (let y = 1; y <= (wizardForm.usefulLifeYears || 1); y++) {
      let annualDep = 0
      if (wizardForm.depreciationMethod === 'Straight-Line') {
        annualDep = (wizardForm.purchasePrice - wizardForm.residualValue) / (wizardForm.usefulLifeYears || 1)
      } else if (wizardForm.depreciationMethod === 'Declining-Balance') {
        annualDep = openingNbv * (wizardForm.decliningRate / 100)
      }
      const closingNbv = Math.max(openingNbv - annualDep, wizardForm.residualValue)
      schedule.push({ year: y, openingNbv, annualDep: Math.min(annualDep, openingNbv - wizardForm.residualValue), closingNbv })
      openingNbv = closingNbv
      if (closingNbv <= wizardForm.residualValue) break
    }
    return schedule
  }, [wizardForm])

  // ─── Render: Dashboard ──────────────────────────────────────────────────

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2.5"><Package className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Assets</p>
                <p className="text-xl font-bold">{summary.totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2.5"><DollarSign className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="text-lg font-bold">{pkr(summary.totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-100 p-2.5"><BarChart3 className="h-5 w-5 text-sky-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total NBV</p>
                <p className="text-lg font-bold">{pkr(summary.totalNBV)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-rose-100 p-2.5"><TrendingDown className="h-5 w-5 text-rose-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">YTD Depreciation</p>
                <p className="text-lg font-bold">{pkr(totalYtdDep)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2.5"><Shield className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Donor Assets</p>
                <p className="text-lg font-bold">{summary.donorCount} <span className="text-xs font-normal text-muted-foreground">({pkr(summary.donorCost)})</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GL Integration Status */}
      {glPostStatus && (glPostStatus.pendingJournals > 0 || glPostStatus.assetsNeedingAcquisition > 0) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5"><Landmark className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold">GL Integration</p>
                  <p className="text-xs text-muted-foreground">
                    {glPostStatus.pendingJournals > 0 && `${glPostStatus.pendingJournals} pending journal(s) (${pkr(glPostStatus.pendingAmount)})`}
                    {glPostStatus.pendingJournals > 0 && glPostStatus.assetsNeedingAcquisition > 0 && ' • '}
                    {glPostStatus.assetsNeedingAcquisition > 0 && `${glPostStatus.assetsNeedingAcquisition} asset(s) need acquisition posting (${pkr(glPostStatus.acquisitionAmount)})`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {glPostStatus.pendingJournals > 0 && (
                  <Button size="sm" className="h-8 text-xs gap-1" onClick={() => handlePostToGL('post-all')}>
                    <Landmark className="h-3.5 w-3.5" />Post Journals to GL
                  </Button>
                )}
                {glPostStatus.assetsNeedingAcquisition > 0 && (
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => handlePostToGL('post-acquisition')}>
                    <Building2 className="h-3.5 w-3.5" />Post Acquisitions
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><PieChartIcon className="h-4 w-4" />Asset Category Breakdown</CardTitle>
            <CardDescription className="text-xs">By PKR cost value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryBreakdown.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => pkr(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4" />Monthly Depreciation Trend</CardTitle>
            <CardDescription className="text-xs">Jul–Jun current year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyDepTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`} />
                  <RechartsTooltip formatter={(value: number) => pkr(value)} />
                  <Bar dataKey="depreciation" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />NBV by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={nbvByCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(value: number) => pkr(value)} />
                  <Bar dataKey="value" fill="#0891b2" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Alerts & Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nearFullDepAssets.length > 0 && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <TrendingDown className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-800">{nearFullDepAssets.length} asset(s) near full depreciation (NBV &lt; 10% of cost)</p>
                  <p className="text-[10px] text-amber-600 truncate">{nearFullDepAssets.map(a => a.name).join(', ')}</p>
                </div>
              </div>
            )}
            {insuranceExpiring.length > 0 && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                <Shield className="h-4 w-4 text-rose-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-rose-800">{insuranceExpiring.length} insurance policy(ies) expiring within 30 days</p>
                </div>
              </div>
            )}
            {pendingApprovals > 0 && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs font-medium text-amber-800">{pendingApprovals} asset(s) pending approval</p>
              </div>
            )}
            {pendingJournals > 0 && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-violet-50 border border-violet-200">
                <FileText className="h-4 w-4 text-violet-600 shrink-0" />
                <p className="text-xs font-medium text-violet-800">{pendingJournals} journal(s) pending export to AFMS</p>
              </div>
            )}
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-medium text-emerald-800">Depreciation run: Current period status available in Depreciation tab</p>
            </div>
            {nearFullDepAssets.length === 0 && insuranceExpiring.length === 0 && pendingApprovals === 0 && pendingJournals === 0 && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-xs font-medium text-emerald-800">All clear — no alerts at this time</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><CircleDot className="h-4 w-4" />Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canCreate && (
              <Button className="w-full justify-start gap-2 h-10" onClick={openAddWizard}>
                <Plus className="h-4 w-4" />Add New Asset
              </Button>
            )}
            {canRunDepreciation && (
              <Button variant="outline" className="w-full justify-start gap-2 h-10" onClick={() => setActiveTab('depreciation')}>
                <TrendingDown className="h-4 w-4" />Run Depreciation
              </Button>
            )}
            {canExportJournals && (
              <Button variant="outline" className="w-full justify-start gap-2 h-10" onClick={handleExport}>
                <Download className="h-4 w-4" />Export to CSV
              </Button>
            )}
            {canExportJournals && (
              <Button variant="outline" className="w-full justify-start gap-2 h-10 border-primary/30 text-primary hover:bg-primary/5" onClick={() => handlePostToGL('post-all')}>
                <Landmark className="h-4 w-4" />Post to General Ledger
              </Button>
            )}
            <Separator />
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recent Activity</p>
              <div className="text-xs space-y-1.5 max-h-32 overflow-y-auto">
                {transactions.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${t.type === 'Disposal' ? 'bg-red-500' : t.type === 'Transfer' ? 'bg-sky-500' : 'bg-emerald-500'}`} />
                    <span className="truncate">{t.type}: {t.asset?.name || t.txnId}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">{formatDate(t.date)}</span>
                  </div>
                ))}
                {transactions.length === 0 && <p className="text-muted-foreground">No recent activity</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  // ─── Render: Asset Register ─────────────────────────────────────────────

  const renderAssetRegister = () => (
    <div className="space-y-4">
      {/* Summary Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
            <span className="font-medium">Total Assets: <span className="text-primary">{summary.totalCount}</span></span>
            <span className="font-medium">Total Cost: <span className="text-primary">{pkr(summary.totalCost)}</span></span>
            <span className="font-medium">Total Acc.Dep: <span className="text-muted-foreground">{pkr(summary.totalAccDep)}</span></span>
            <span className="font-medium">Total NBV: <span className="text-primary">{pkr(summary.totalNBV)}</span></span>
            <span className="font-medium">Donor Assets: <span className="text-purple-600">{summary.donorCount}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && <Button size="sm" className="h-8 text-xs gap-1" onClick={openAddWizard}><Plus className="h-3.5 w-3.5" />Add Asset</Button>}
        {canRunDepreciation && <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setActiveTab('depreciation')}><TrendingDown className="h-3.5 w-3.5" />Run Depreciation</Button>}
        {canExportJournals && <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleExport}><Download className="h-3.5 w-3.5" />Export CSV</Button>}
        {canExportJournals && <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5" onClick={() => handlePostToGL('post-all')}><Landmark className="h-3.5 w-3.5" />Post to GL</Button>}
        {canExportJournals && glPostStatus && glPostStatus.assetsNeedingAcquisition > 0 && <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => handlePostToGL('post-acquisition')}><Building2 className="h-3.5 w-3.5" />Post Acquisitions ({glPostStatus.assetsNeedingAcquisition})</Button>}
        {canCreate && <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setCsvImportOpen(true)}><Upload className="h-3.5 w-3.5" />Import CSV</Button>}
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Print</Button>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search name, ID, serial, custodian..." className="h-8 text-xs pl-8"
            value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }} />
        </div>
        <Button variant={showFilters ? 'default' : 'outline'} size="sm" className="h-8 text-xs gap-1" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-3.5 w-3.5" />Filters
          {[filterCategory, filterStatus, filterProvince, filterDonor, filterDepMethod, filterApproval].filter(f => f !== 'all').length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {[filterCategory, filterStatus, filterProvince, filterDonor, filterDepMethod, filterApproval].filter(f => f !== 'all').length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div><Label className="text-[10px] text-muted-foreground">Category</Label>
                <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setCurrentPage(1) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Categories</SelectItem>{ASSET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px] text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCurrentPage(1) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Statuses</SelectItem>{ASSET_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px] text-muted-foreground">Province</Label>
                <Select value={filterProvince} onValueChange={v => { setFilterProvince(v); setCurrentPage(1) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Provinces</SelectItem>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px] text-muted-foreground">Donor Funded</Label>
                <Select value={filterDonor} onValueChange={v => { setFilterDonor(v); setCurrentPage(1) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="yes">Donor Funded</SelectItem><SelectItem value="no">Not Donor Funded</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px] text-muted-foreground">Dep. Method</Label>
                <Select value={filterDepMethod} onValueChange={v => { setFilterDepMethod(v); setCurrentPage(1) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Methods</SelectItem>{DEP_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px] text-muted-foreground">Approval</Label>
                <Select value={filterApproval} onValueChange={v => { setFilterApproval(v); setCurrentPage(1) }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="Approved">Approved</SelectItem><SelectItem value="Pending Approval">Pending</SelectItem><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Rejected">Rejected</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                setFilterCategory('all'); setFilterStatus('all'); setFilterProvince('all')
                setFilterDonor('all'); setFilterDepMethod('all'); setFilterApproval('all'); setCurrentPage(1)
              }}>Clear Filters</Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => fetchAssets(1)}>Apply</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asset Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading assets...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={selectedRows.size === assets.length && assets.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                    <TableHead className="cursor-pointer text-xs" onClick={() => handleSort('assetId')}>Asset ID <ArrowUpDown className="h-3 w-3 inline" /></TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Purchase Date</TableHead>
                    <TableHead className="text-xs text-right">Cost ₨</TableHead>
                    <TableHead className="text-xs text-right">Acc.Dep ₨</TableHead>
                    <TableHead className="text-xs text-right">NBV ₨</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Custodian</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Donor</TableHead>
                    <TableHead className="text-xs">Approval</TableHead>
                    <TableHead className="text-xs">Journal</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.length === 0 ? (
                    <TableRow><TableCell colSpan={15} className="text-center text-sm text-muted-foreground py-8">No assets found</TableCell></TableRow>
                  ) : assets.map(a => (
                    <TableRow key={a.id}
                      className={`cursor-pointer ${a.status === 'Disposed' ? 'bg-red-50/50' : a.isDonorFunded ? 'bg-purple-50/30' : ''}`}
                      onClick={() => viewAssetDetail(a)}>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selectedRows.has(a.id)} onCheckedChange={() => toggleSelectRow(a.id)} />
                      </TableCell>
                      <TableCell className="text-xs font-mono">{a.assetId}</TableCell>
                      <TableCell className="text-xs font-medium">{a.name}</TableCell>
                      <TableCell className="text-xs"><div className="flex items-center gap-1">{getCategoryIcon(a.category)}{a.category}</div></TableCell>
                      <TableCell className="text-xs">{formatDate(a.dateOfPurchase)}</TableCell>
                      <TableCell className="text-xs text-right">{pkr(a.purchasePrice)}</TableCell>
                      <TableCell className="text-xs text-right">{pkr(a.accumulatedDepreciation)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{pkr(a.netBookValue)}</TableCell>
                      <TableCell className="text-xs">{a.location || '—'}</TableCell>
                      <TableCell className="text-xs">{a.custodian || '—'}</TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell>{a.isDonorFunded ? <Badge className="text-[10px] bg-purple-100 text-purple-800">DONOR</Badge> : '—'}</TableCell>
                      <TableCell>{approvalBadge(a.approvalStatus)}</TableCell>
                      <TableCell>{journalBadge(a.journalStatus)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {canEdit && <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditWizard(a)}><Edit className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip></TooltipProvider>}
                          {canDelete && <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDeleteAsset(a.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button></TooltipTrigger><TooltipContent>Write Off</TooltipContent></Tooltip></TooltipProvider>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalAssets)} of {totalAssets}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-xs">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" size="sm" className="h-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )

  // ─── Render: Registration Form (Single-Page) ───────────────────────────────

  const isFormValid = !!(wizardForm.name && wizardForm.category && wizardForm.purchasePrice > 0)

  const renderRegistrationForm = () => {
    const isNoDep = wizardForm.isDonorFunded || wizardForm.category === 'Land' || wizardForm.depreciationMethod === 'None'
    const fbrRate = FBR_RATES[wizardForm.category] ?? 10

    return (
      <div className="space-y-6">
        {/* ─── Section 1: Basic Asset Information ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Basic Asset Information
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="text-xs font-medium">Asset Name <span className="text-red-500">*</span></Label>
              <Input className="mt-1" value={wizardForm.name} onChange={e => setWizardForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Dell Latitude 5520 Laptop" />
            </div>
            <div>
              <Label className="text-xs font-medium">Asset Tag - Manual</Label>
              <Input className="mt-1" value={wizardForm.assetTag} onChange={e => setWizardForm(f => ({ ...f, assetTag: e.target.value }))} placeholder="e.g., FA-IT-2024-001" />
            </div>
            <div>
              <Label className="text-xs font-medium">Category <span className="text-red-500">*</span></Label>
              <Select value={wizardForm.category} onValueChange={v => {
                const glMap = GL_CATEGORY_MAP[v] || { asset: '1545', accDep: '1670', depExp: '5670' }
                setWizardForm(f => ({ 
                  ...f, 
                  category: v,
                  glAssetAccount: f.glAssetAccount || glMap.asset,
                  glAccDepAccount: f.glAccDepAccount || (glMap.accDep || ''),
                  glDepExpAccount: f.glDepExpAccount || (glMap.depExp || ''),
                }))
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={coaCategories.length > 0 ? "Select from Chart of Accounts" : "Select category"} /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {coaCategories.length > 0
                    ? coaCategories.filter(c => !c.name.toLowerCase().includes('accumulated')).map(c => (
                      <SelectItem key={c.id} value={c.name}>
                        <span className="font-mono text-muted-foreground mr-1">{c.code}</span> {c.name}
                      </SelectItem>
                    ))
                    : ASSET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Purchase Date <span className="text-red-500">*</span></Label>
              <Input className="mt-1" type="date" value={wizardForm.dateOfPurchase} onChange={e => setWizardForm(f => ({ ...f, dateOfPurchase: e.target.value, dateOfCapitalization: f.dateOfCapitalization || e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium">Cost / Purchase Price (PKR) <span className="text-red-500">*</span></Label>
              <Input className="mt-1" type="number" value={wizardForm.purchasePrice || ''} onChange={e => setWizardForm(f => ({ ...f, purchasePrice: parseFloat(e.target.value) || 0 }))} placeholder="0" />
            </div>
          </div>
          {wizardForm.category && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
              {getCategoryIcon(wizardForm.category)}
              <span>Auto-generated Asset ID: AST-{new Date().getFullYear()}-XXXX | FBR Rate: {fbrRate}%</span>
            </div>
          )}
          </CardContent>
        </Card>

        {/* ─── Section 2: Asset Specifications ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cog className="h-4 w-4 text-primary" />
              Asset Specifications
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Make</Label>
              <Input className="mt-1" value={wizardForm.make} onChange={e => setWizardForm(f => ({ ...f, make: e.target.value }))} placeholder="e.g., Toyota, Dell, HP" />
            </div>
            <div>
              <Label className="text-xs font-medium">Model</Label>
              <Input className="mt-1" value={wizardForm.model} onChange={e => setWizardForm(f => ({ ...f, model: e.target.value }))} placeholder="e.g., Corolla, Latitude 5520" />
            </div>
            <div>
              <Label className="text-xs font-medium">Model Year</Label>
              <Input className="mt-1" type="number" value={wizardForm.modelYear || ''} onChange={e => setWizardForm(f => ({ ...f, modelYear: parseInt(e.target.value) || new Date().getFullYear() }))} placeholder="e.g., 2024" />
            </div>
            <div>
              <Label className="text-xs font-medium">Asset Condition <span className="text-red-500">*</span></Label>
              <Select value={wizardForm.condition} onValueChange={v => setWizardForm(f => ({ ...f, condition: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Serial Number</Label>
              <Input className="mt-1" value={wizardForm.serialNumber} onChange={e => setWizardForm(f => ({ ...f, serialNumber: e.target.value }))} placeholder="SN-XXXX" />
            </div>
            <div>
              <Label className="text-xs font-medium">Sub-Category</Label>
              <Input className="mt-1" value={wizardForm.subCategory} onChange={e => setWizardForm(f => ({ ...f, subCategory: e.target.value }))} placeholder="Optional sub-classification" />
            </div>
          </div>
          </CardContent>
        </Card>

        {/* ─── Section 3: Procurement & Reference Details ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Procurement &amp; Reference Details
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Prior Approval No.</Label>
              <Input className="mt-1" value={wizardForm.priorApprovalNo} onChange={e => setWizardForm(f => ({ ...f, priorApprovalNo: e.target.value }))} placeholder="e.g., PA-2024-001" />
            </div>
            <div>
              <Label className="text-xs font-medium">Purchase Order No.</Label>
              <Input className="mt-1" value={wizardForm.purchaseOrderNo} onChange={e => setWizardForm(f => ({ ...f, purchaseOrderNo: e.target.value }))} placeholder="e.g., PO-2024-001" />
            </div>
            <div>
              <Label className="text-xs font-medium">Receipt Voucher No.</Label>
              <Input className="mt-1" value={wizardForm.receiptVoucherNo} onChange={e => setWizardForm(f => ({ ...f, receiptVoucherNo: e.target.value }))} placeholder="e.g., RV-2024-001" />
            </div>
            <div>
              <Label className="text-xs font-medium">Check Register No.</Label>
              <Input className="mt-1" value={wizardForm.checkRegisterNo} onChange={e => setWizardForm(f => ({ ...f, checkRegisterNo: e.target.value }))} placeholder="e.g., CR-2024-001" />
            </div>
            <div>
              <Label className="text-xs font-medium">Stock Register Page No.</Label>
              <Input className="mt-1" value={wizardForm.stockRegisterPageNo} onChange={e => setWizardForm(f => ({ ...f, stockRegisterPageNo: e.target.value }))} placeholder="e.g., SR-P42" />
            </div>
            <div>
              <Label className="text-xs font-medium">Invoice Number</Label>
              <Input className="mt-1" value={wizardForm.invoiceNumber} onChange={e => setWizardForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="INV-XXXX" />
            </div>
            <div>
              <Label className="text-xs font-medium">Supplier Name</Label>
              <Input className="mt-1" value={wizardForm.supplierName} onChange={e => setWizardForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="Supplier or vendor name" />
            </div>
            <div>
              <Label className="text-xs font-medium">Supplier NTN</Label>
              <Input className="mt-1" value={wizardForm.supplierNTN} onChange={e => setWizardForm(f => ({ ...f, supplierNTN: e.target.value }))} placeholder="National Tax Number" />
            </div>
          </div>
          </CardContent>
        </Card>

        {/* ─── Section 4: Depreciation Setup ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              Depreciation Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
          {isNoDep ? (
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              <Info className="h-4 w-4 text-sky-600" />
              <div>
                <p className="text-xs font-medium">No Depreciation</p>
                <p className="text-[10px] text-muted-foreground">{wizardForm.category === 'Land' ? 'Land is not depreciated per accounting standards.' : wizardForm.isDonorFunded ? 'Donor-funded assets are not depreciated.' : 'Depreciation is disabled for this asset.'}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium">Depreciation Method</Label>
                <Select value={wizardForm.depreciationMethod} onValueChange={v => setWizardForm(f => ({ ...f, depreciationMethod: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{DEP_METHODS.filter(m => m !== 'None').map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {wizardForm.depreciationMethod === 'Straight-Line' && (
                <>
                  <div><Label className="text-xs font-medium">Useful Life (Years)</Label><Input className="mt-1" type="number" value={wizardForm.usefulLifeYears || ''} onChange={e => setWizardForm(f => ({ ...f, usefulLifeYears: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs font-medium">Residual Value (PKR)</Label><Input className="mt-1" type="number" value={wizardForm.residualValue || ''} onChange={e => setWizardForm(f => ({ ...f, residualValue: parseFloat(e.target.value) || 0 }))} /></div>
                </>
              )}
              {wizardForm.depreciationMethod === 'Declining-Balance' && (
                <>
                  <div><Label className="text-xs font-medium">Declining Rate (%)</Label><Input className="mt-1" type="number" value={wizardForm.decliningRate || ''} onChange={e => setWizardForm(f => ({ ...f, decliningRate: parseFloat(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs font-medium">Residual Value (PKR)</Label><Input className="mt-1" type="number" value={wizardForm.residualValue || ''} onChange={e => setWizardForm(f => ({ ...f, residualValue: parseFloat(e.target.value) || 0 }))} /></div>
                </>
              )}
            </div>
          )}
          {wizardForm.purchasePrice > 0 && depCalculation.annual > 0 && !isNoDep && (
            <div className="p-3 rounded-md bg-muted/50 space-y-1">
              <p className="text-xs font-medium">Depreciation Preview</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-muted-foreground">Annual:</span> {pkr(depCalculation.annual)}</div>
                <div><span className="text-muted-foreground">Monthly:</span> {pkr(depCalculation.monthly)}</div>
                <div><span className="text-muted-foreground">Total:</span> {pkr(depCalculation.totalDep)}</div>
              </div>
            </div>
          )}
          </CardContent>
        </Card>

        {/* ─── Section 5: Location & Custodian ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Location &amp; Custodian
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label className="text-xs font-medium">Location</Label><Input className="mt-1" value={wizardForm.location} onChange={e => setWizardForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g., Head Office" /></div>
            <div>
              <Label className="text-xs font-medium">Province</Label>
              <Select value={wizardForm.province} onValueChange={v => setWizardForm(f => ({ ...f, province: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs font-medium">Custodian</Label><Input className="mt-1" value={wizardForm.custodian} onChange={e => setWizardForm(f => ({ ...f, custodian: e.target.value }))} placeholder="Person responsible" /></div>
            <div><Label className="text-xs font-medium">Cost Center</Label><Input className="mt-1" value={wizardForm.costCenter} onChange={e => setWizardForm(f => ({ ...f, costCenter: e.target.value }))} placeholder="CC-XXXX" /></div>
          </div>
          </CardContent>
        </Card>

        {/* ─── Section 6: Donor Funding ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Donor Funding
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <Switch checked={wizardForm.isDonorFunded} onCheckedChange={v => setWizardForm(f => ({ ...f, isDonorFunded: v }))} />
            <Label className="text-xs">This is a donor-funded asset</Label>
          </div>
          {wizardForm.isDonorFunded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label className="text-xs font-medium">Donor Name</Label><Input className="mt-1" value={wizardForm.donor} onChange={e => setWizardForm(f => ({ ...f, donor: e.target.value }))} placeholder="e.g., USAID, DFID" /></div>
              <div><Label className="text-xs font-medium">Grant Reference</Label><Input className="mt-1" value={wizardForm.grantReference} onChange={e => setWizardForm(f => ({ ...f, grantReference: e.target.value }))} placeholder="GRANT-XXXX" /></div>
              <div><Label className="text-xs font-medium">Donor Code</Label><Input className="mt-1" value={wizardForm.donorCode} onChange={e => setWizardForm(f => ({ ...f, donorCode: e.target.value }))} placeholder="DC-XXXX" /></div>
              <div className="md:col-span-2"><Label className="text-xs font-medium">Restrictions</Label><Textarea className="mt-1" value={wizardForm.donorRestrictions} onChange={e => setWizardForm(f => ({ ...f, donorRestrictions: e.target.value }))} placeholder="Any donor restrictions on disposal/transfer" rows={2} /></div>
            </div>
          )}
          </CardContent>
        </Card>

        {/* ─── Section 7: Insurance & Warranty ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Insurance &amp; Warranty
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label className="text-xs font-medium">Insurance Value (PKR)</Label><Input className="mt-1" type="number" value={wizardForm.insuranceValue || ''} onChange={e => setWizardForm(f => ({ ...f, insuranceValue: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label className="text-xs font-medium">Policy Number</Label><Input className="mt-1" value={wizardForm.insurancePolicyNumber} onChange={e => setWizardForm(f => ({ ...f, insurancePolicyNumber: e.target.value }))} /></div>
            <div><Label className="text-xs font-medium">Insurance Expiry</Label><Input className="mt-1" type="date" value={wizardForm.insuranceExpiryDate} onChange={e => setWizardForm(f => ({ ...f, insuranceExpiryDate: e.target.value }))} /></div>
            <div><Label className="text-xs font-medium">Warranty Expiry</Label><Input className="mt-1" type="date" value={wizardForm.warrantyExpiryDate} onChange={e => setWizardForm(f => ({ ...f, warrantyExpiryDate: e.target.value }))} /></div>
          </div>
          </CardContent>
        </Card>

        {/* ─── Section 8: GL Mapping ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              GL Account Mapping
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label className="text-[10px] text-muted-foreground">Asset Account</Label><Input className="mt-1 text-xs" value={wizardForm.glAssetAccount} onChange={e => setWizardForm(f => ({ ...f, glAssetAccount: e.target.value }))} placeholder="Auto-assigned" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Acc. Dep. Account</Label><Input className="mt-1 text-xs" value={wizardForm.glAccDepAccount} onChange={e => setWizardForm(f => ({ ...f, glAccDepAccount: e.target.value }))} placeholder="Auto-assigned" /></div>
            <div><Label className="text-[10px] text-muted-foreground">Dep. Expense Account</Label><Input className="mt-1 text-xs" value={wizardForm.glDepExpAccount} onChange={e => setWizardForm(f => ({ ...f, glDepExpAccount: e.target.value }))} placeholder="Auto-assigned" /></div>
          </div>
          </CardContent>
        </Card>

        {/* ─── Section 9: Notes ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Additional Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
          <Textarea value={wizardForm.notes} onChange={e => setWizardForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes about this asset" rows={3} />
          </CardContent>
        </Card>

        {/* Bottom spacer for sticky bar */}
        <div className="h-20" />
      </div>
    )
  }

  // ─── Render: Depreciation ───────────────────────────────────────────────

  const renderDepreciation = () => {
    const currentFy = fiscalYears.find(fy => fy.label === depFiscalYear)
    const parsedStatus = currentFy?.depRunStatusParsed || {}

    return (
      <div className="space-y-4">
        {/* Run Depreciation Panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4" />Run Depreciation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div><Label className="text-xs">Fiscal Year</Label>
                <Select value={depFiscalYear} onValueChange={setDepFiscalYear}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{fiscalYears.filter(fy => fy.status === 'Open').map(fy => <SelectItem key={fy.id} value={fy.label}>{fy.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Period</Label>
                <Select value={depPeriod} onValueChange={setDepPeriod}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Select period" /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => {
                      const fy = fiscalYears.find(f => f.label === depFiscalYear)
                      const year = fy ? (i < 6 ? new Date(fy.startDate).getFullYear() : new Date(fy.endDate).getFullYear()) : new Date().getFullYear()
                      const periodKey = `${m}-${year}`
                      const status = parsedStatus[periodKey]
                      return <SelectItem key={periodKey} value={periodKey} disabled={status === 'Complete'}>
                        {m}-{year} {status === 'Complete' ? '(Complete)' : status === 'Reversed' ? '(Reversed)' : ''}
                      </SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleRunDepreciation} disabled={depRunning || !depPeriod || !canRunDepreciation} className="h-8 text-xs gap-1">
                {depRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingDown className="h-3.5 w-3.5" />}
                Run Depreciation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Period Status Grid */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Period Run Status — {depFiscalYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
              {MONTHS.map((m, i) => {
                const fy = fiscalYears.find(f => f.label === depFiscalYear)
                const year = fy ? (i < 6 ? new Date(fy.startDate).getFullYear() : new Date(fy.endDate).getFullYear()) : new Date().getFullYear()
                const periodKey = `${m}-${year}`
                const status = parsedStatus[periodKey] || 'Pending'
                return (
                  <div key={periodKey} className={`p-2 rounded-lg text-center border ${
                    status === 'Complete' ? 'bg-emerald-50 border-emerald-200' :
                    status === 'Reversed' ? 'bg-red-50 border-red-200' :
                    'bg-amber-50 border-amber-200'
                  }`}>
                    <p className="text-[10px] font-medium">{m}</p>
                    <p className="text-[9px] text-muted-foreground">{year}</p>
                    {status === 'Complete' ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto mt-1" /> :
                     status === 'Reversed' ? <RotateCcw className="h-4 w-4 text-red-600 mx-auto mt-1" /> :
                     <Clock className="h-4 w-4 text-amber-600 mx-auto mt-1" />}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Depreciation Schedule View */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Depreciation Records</CardTitle>
            <CardDescription className="text-xs">{depRecords.filter(r => !r.isTaxDepreciation).length} records for {depFiscalYear}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Period</TableHead>
                    <TableHead className="text-xs">Asset</TableHead>
                    <TableHead className="text-xs text-right">Opening NBV</TableHead>
                    <TableHead className="text-xs text-right">Charge</TableHead>
                    <TableHead className="text-xs text-right">Closing NBV</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depRecords.filter(r => !r.isTaxDepreciation).slice(0, 50).map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.period}</TableCell>
                      <TableCell className="text-xs">{r.assetId}</TableCell>
                      <TableCell className="text-xs text-right">{pkr(r.openingNBV)}</TableCell>
                      <TableCell className="text-xs text-right">{pkr(r.depreciationCharge)}</TableCell>
                      <TableCell className="text-xs text-right">{pkr(r.closingNBV)}</TableCell>
                      <TableCell>{journalBadge(r.journalStatus)}</TableCell>
                    </TableRow>
                  ))}
                  {depRecords.filter(r => !r.isTaxDepreciation).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">No depreciation records found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Donor Assets Computed ────────────────────────────────────────────────

  const donorAssets = useMemo(() => assets.filter(a => a.isDonorFunded), [assets])
  const donorSummary = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>()
    donorAssets.forEach(a => {
      const key = a.donor || 'Unknown'
      const existing = map.get(key) || { count: 0, value: 0 }
      map.set(key, { count: existing.count + 1, value: existing.value + a.purchasePrice })
    })
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }))
  }, [donorAssets])

  // Transaction dialog form state
  const [disposalForm, setDisposalForm] = useState({ assetId: '', date: new Date().toISOString().split('T')[0], disposalMethod: 'Sale', proceeds: 0, description: '' })
  const [transferForm, setTransferForm] = useState<Record<string, string>>({ assetId: '', date: new Date().toISOString().split('T')[0], fromLocation: '', toLocation: '', fromCustodian: '', toCustodian: '', fromCostCenter: '', toCostCenter: '', description: '' })
  const [adjustmentForm, setAdjustmentForm] = useState<Record<string, unknown>>({ assetId: '', date: new Date().toISOString().split('T')[0], adjustmentType: 'Correction', newValue: 0, description: '' })

  // ─── Render: Donor Assets ───────────────────────────────────────────────

  const renderDonorAssets = () => {

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-purple-600" />Donor Assets</CardTitle>
            <CardDescription className="text-xs">{donorAssets.length} donor-funded assets, Total: {pkr(donorAssets.reduce((s, a) => s + a.purchasePrice, 0))}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Asset ID</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Donor</TableHead>
                    <TableHead className="text-xs">Grant Ref</TableHead>
                    <TableHead className="text-xs text-right">Cost ₨</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Custodian</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Restrictions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donorAssets.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-xs text-muted-foreground py-8">No donor-funded assets</TableCell></TableRow>
                  ) : donorAssets.map(a => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => viewAssetDetail(a)}>
                      <TableCell className="text-xs font-mono">{a.assetId}</TableCell>
                      <TableCell className="text-xs font-medium">{a.name}</TableCell>
                      <TableCell className="text-xs">{a.category}</TableCell>
                      <TableCell className="text-xs"><Badge className="text-[10px] bg-purple-100 text-purple-800">{a.donor || 'N/A'}</Badge></TableCell>
                      <TableCell className="text-xs">{a.grantReference || '—'}</TableCell>
                      <TableCell className="text-xs text-right">{pkr(a.purchasePrice)}</TableCell>
                      <TableCell className="text-xs">{a.location || '—'}</TableCell>
                      <TableCell className="text-xs">{a.custodian || '—'}</TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell className="text-xs max-w-32 truncate">{a.donorRestrictions || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Donor Summary */}
        {donorSummary.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Donor-wise Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {donorSummary.map(d => (
                  <div key={d.name} className="p-3 rounded-lg border bg-purple-50/30">
                    <p className="text-sm font-medium text-purple-900">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.count} asset(s) · {pkr(d.value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ─── Render: Transactions ───────────────────────────────────────────────

  const renderTransactions = () => {
    const filtered = txnSubTab === 'all' ? transactions :
      transactions.filter(t => t.type.toLowerCase() === txnSubTab.toLowerCase().replace(/ /g, ''))

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={txnSubTab === 'all' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setTxnSubTab('all')}>All</Button>
          <Button size="sm" variant={txnSubTab === 'disposals' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setTxnSubTab('disposals')}>Disposals</Button>
          <Button size="sm" variant={txnSubTab === 'transfers' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setTxnSubTab('transfers')}>Transfers</Button>
          <Button size="sm" variant={txnSubTab === 'adjustments' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setTxnSubTab('adjustments')}>Adjustments</Button>
          <div className="flex-1" />
          {canManageTransactions && <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setDisposalOpen(true)}><Trash2 className="h-3.5 w-3.5" />Disposal</Button>}
          {(canManageTransactions || canRequestTransfer) && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setTransferOpen(true)}><ArrowRight className="h-3.5 w-3.5" />Transfer</Button>}
          {canManageTransactions && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setAdjustmentOpen(true)}><Wrench className="h-3.5 w-3.5" />Adjustment</Button>}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Txn ID</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Asset</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs text-right">Amount ₨</TableHead>
                    <TableHead className="text-xs text-right">Proceeds ₨</TableHead>
                    <TableHead className="text-xs text-right">Gain/Loss ₨</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">No transactions found</TableCell></TableRow>
                  ) : filtered.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs font-mono">{t.txnId}</TableCell>
                      <TableCell><Badge variant="secondary" className={`text-[10px] ${t.type === 'Disposal' ? 'bg-red-100 text-red-800' : t.type === 'Transfer' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>{t.type}</Badge></TableCell>
                      <TableCell className="text-xs">{t.asset?.name || t.assetId}</TableCell>
                      <TableCell className="text-xs">{formatDate(t.date)}</TableCell>
                      <TableCell className="text-xs max-w-48 truncate">{t.description || '—'}</TableCell>
                      <TableCell className="text-xs text-right">{pkr(t.amount)}</TableCell>
                      <TableCell className="text-xs text-right">{pkr(t.proceeds)}</TableCell>
                      <TableCell className={`text-xs text-right ${(t.gainLoss || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pkr(t.gainLoss || 0)}</TableCell>
                      <TableCell>{statusBadge(t.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Render: Reports ────────────────────────────────────────────────────

  const renderReports = () => {
    const reportTypes = [
      { value: 'asset-register', label: 'Asset Register Report' },
      { value: 'depreciation-schedule', label: 'Depreciation Schedule' },
      { value: 'tax-depreciation-fbr', label: 'Tax Depreciation (FBR)' },
      { value: 'location-wise', label: 'Location-wise Report' },
      { value: 'custodian-wise', label: 'Custodian-wise Report' },
      { value: 'nbv-summary', label: 'NBV Summary' },
      { value: 'donor-assets', label: 'Donor Assets Report' },
      { value: 'asset-movement', label: 'Asset Movement Schedule' },
      { value: 'disposal-gain-loss', label: 'Disposal & Gain/Loss Report' },
      { value: 'fully-depreciated', label: 'Fully Depreciated Assets' },
      { value: 'insurance-renewal', label: 'Insurance Renewal Schedule' },
      { value: 'journal-export-log', label: 'Journal Export Log' },
    ]

    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div><Label className="text-xs">Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="w-64 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{reportTypes.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Fiscal Year</Label>
                <Select value={depFiscalYear} onValueChange={setDepFiscalYear}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{fiscalYears.map(fy => <SelectItem key={fy.id} value={fy.label}>{fy.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handleFetchReport} disabled={reportLoading} className="h-8 text-xs gap-1">
                {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                Generate Report
              </Button>
              <Button variant="outline" className="h-8 text-xs gap-1" disabled={!reportData} onClick={() => {
                if (reportData) {
                  const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `${reportType}-report.csv`; a.click()
                }
              }}><Download className="h-3.5 w-3.5" />Export CSV</Button>
              <Button variant="outline" className="h-8 text-xs gap-1" disabled={!reportData} onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Print</Button>
            </div>
          </CardContent>
        </Card>

        {reportData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Report: {reportTypes.find(r => r.value === reportType)?.label}</CardTitle>
              <CardDescription className="text-xs">Generated: {reportData.generatedAt ? new Date(reportData.generatedAt as string).toLocaleString() : 'N/A'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96">
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(reportData, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ─── Render: Financial Year ─────────────────────────────────────────────

  const renderFinancialYear = () => (
    <div className="space-y-4">
      {fiscalYears.map(fy => (
        <Card key={fy.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />FY {fy.label}
                  <Badge variant="secondary" className={fy.status === 'Closed' ? 'bg-gray-100 text-gray-800' : 'bg-emerald-100 text-emerald-800'}>{fy.status}</Badge>
                </CardTitle>
                <CardDescription className="text-xs">{formatDate(fy.startDate)} — {formatDate(fy.endDate)}</CardDescription>
              </div>
              {fy.status === 'Open' && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => {
                  try {
                    const res = await fetch('/api/fams/fiscal-years', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: fy.id, action: 'close' }),
                    })
                    const data = await res.json()
                    if (res.ok) {
                      toast({ title: 'Fiscal Year Closed', description: `${(data.carryForward?.assetsCarried || 0)} assets carried forward` })
                      fetchFiscalYears()
                    } else {
                      toast({ title: 'Cannot Close', description: data.validationErrors?.join('; ') || data.error, variant: 'destructive' })
                    }
                  } catch {
                    toast({ title: 'Error', description: 'Failed to close fiscal year', variant: 'destructive' })
                  }
                }}>Close Year</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
              {MONTHS.map((m, i) => {
                const year = i < 6 ? new Date(fy.startDate).getFullYear() : new Date(fy.endDate).getFullYear()
                const periodKey = `${m}-${year}`
                const status = fy.depRunStatusParsed[periodKey] || 'Pending'
                return (
                  <div key={periodKey} className={`p-1.5 rounded text-center border text-[10px] ${
                    status === 'Complete' ? 'bg-emerald-50 border-emerald-200' :
                    status === 'Reversed' ? 'bg-red-50 border-red-200' :
                    'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="font-medium">{m}</div>
                    {status === 'Complete' ? <CheckCircle2 className="h-3 w-3 text-emerald-600 mx-auto" /> :
                     status === 'Reversed' ? <RotateCcw className="h-3 w-3 text-red-600 mx-auto" /> :
                     <Clock className="h-3 w-3 text-amber-600 mx-auto" />}
                  </div>
                )
              })}
            </div>
            {fy.progress && (
              <div className="mt-2 text-xs text-muted-foreground">
                Progress: {fy.progress.completedPeriods}/{fy.progress.totalPeriods} periods complete ({fy.progress.completionPct}%)
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Open New Year */}
      <Card>
        <CardContent className="p-4">
          <Button className="h-8 text-xs gap-1" onClick={async () => {
            const nextLabel = `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`
            try {
              const res = await fetch('/api/fams/fiscal-years', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  label: nextLabel,
                  startDate: `${new Date().getFullYear()}-07-01`,
                  endDate: `${new Date().getFullYear() + 1}-06-30`,
                }),
              })
              if (res.ok) {
                toast({ title: 'Fiscal Year Created', description: nextLabel })
                fetchFiscalYears()
              } else {
                const err = await res.json()
                toast({ title: 'Error', description: err.error, variant: 'destructive' })
              }
            } catch {
              toast({ title: 'Error', description: 'Failed to create fiscal year', variant: 'destructive' })
            }
          }}><Plus className="h-3.5 w-3.5" />Open New Fiscal Year</Button>
        </CardContent>
      </Card>
    </div>
  )

  // ─── Render: Settings ───────────────────────────────────────────────────

  const renderSettings = () => {
    const glMappingCategories = ASSET_CATEGORIES.map(cat => ({
      category: cat,
      asset: settings[`gl_${cat.toLowerCase().replace(/ /g, '_')}`]?.value || settings[`gl_${cat.toLowerCase().replace(/ /g, '_')}_asset`]?.value || '—',
      accDep: settings['gl_acc_depreciation']?.value || '1300',
      depExp: settings['gl_dep_expense']?.value || '5300',
    }))

    return (
      <div className="space-y-4">
        {/* Organization */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Organization</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label className="text-xs">Organization Name</Label><Input defaultValue={settings.org_name?.value || ''} onBlur={e => handleSaveSettings([{ key: 'org_name', value: e.target.value }])} /></div>
              <div><Label className="text-xs">Province</Label>
                <Select defaultValue={settings.org_province?.value || 'KPK'} onValueChange={v => handleSaveSettings([{ key: 'org_province', value: v }])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">City</Label><Input defaultValue={settings.org_city?.value || ''} onBlur={e => handleSaveSettings([{ key: 'org_city', value: e.target.value }])} /></div>
            </div>
          </CardContent>
        </Card>

        {/* GL Account Mapping */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Landmark className="h-4 w-4" />GL Account Mapping</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead className="text-xs">Category</TableHead><TableHead className="text-xs">Asset Account</TableHead><TableHead className="text-xs">Acc. Dep. Account</TableHead><TableHead className="text-xs">Dep. Expense Account</TableHead></TableRow></TableHeader>
              <TableBody>
                {glMappingCategories.map(row => (
                  <TableRow key={row.category}>
                    <TableCell className="text-xs font-medium"><div className="flex items-center gap-1">{getCategoryIcon(row.category)}{row.category}</div></TableCell>
                    <TableCell className="text-xs">{row.asset}</TableCell>
                    <TableCell className="text-xs">{row.accDep}</TableCell>
                    <TableCell className="text-xs">{row.depExp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Approval Thresholds */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Approval Thresholds</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label className="text-xs">CFO Approval (PKR)</Label><Input type="number" defaultValue={settings.threshold_cfo_approval?.value || '500000'} onBlur={e => handleSaveSettings([{ key: 'threshold_cfo_approval', value: e.target.value }])} /></div>
              <div><Label className="text-xs">Manager Approval (PKR)</Label><Input type="number" defaultValue={settings.threshold_manager_approval?.value || '100000'} onBlur={e => handleSaveSettings([{ key: 'threshold_manager_approval', value: e.target.value }])} /></div>
              <div><Label className="text-xs">Capitalization Threshold (PKR)</Label><Input type="number" defaultValue={settings.capitalization_threshold?.value || '50000'} onBlur={e => handleSaveSettings([{ key: 'capitalization_threshold', value: e.target.value }])} /></div>
            </div>
          </CardContent>
        </Card>

        {/* FBR Tax Rates */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />FBR Tax Rates (Schedule III)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead className="text-xs">Category</TableHead><TableHead className="text-xs">FBR Rate (%)</TableHead></TableRow></TableHeader>
              <TableBody>
                {ASSET_CATEGORIES.map(cat => (
                  <TableRow key={cat}>
                    <TableCell className="text-xs"><div className="flex items-center gap-1">{getCategoryIcon(cat)}{cat}</div></TableCell>
                    <TableCell className="text-xs">{FBR_RATES[cat]}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Export Config */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Download className="h-4 w-4" />Export Configuration</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label className="text-xs">Asset ID Prefix</Label><Input defaultValue={settings.asset_id_prefix?.value || 'AST'} onBlur={e => handleSaveSettings([{ key: 'asset_id_prefix', value: e.target.value }])} /></div>
              <div><Label className="text-xs">Journal Prefix</Label><Input defaultValue={settings.journal_prefix?.value || 'JV-FAMS'} onBlur={e => handleSaveSettings([{ key: 'journal_prefix', value: e.target.value }])} /></div>
              <div><Label className="text-xs">Export Batch Prefix</Label><Input defaultValue={settings.export_prefix?.value || 'EXP'} onBlur={e => handleSaveSettings([{ key: 'export_prefix', value: e.target.value }])} /></div>
              <div className="flex items-center gap-3 pt-5">
                <Switch defaultChecked={settings.auto_approve_additions?.value === 'true'} onCheckedChange={v => handleSaveSettings([{ key: 'auto_approve_additions', value: String(v) }])} />
                <Label className="text-xs">Auto-approve new additions</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Render: Transaction Dialogs ────────────────────────────────────────

  const renderDisposalDialog = () => {
    const selectedAsset = assets.find(a => a.id === disposalForm.assetId)
    const gainLoss = selectedAsset ? disposalForm.proceeds - selectedAsset.netBookValue : 0

    return (
      <Dialog open={disposalOpen} onOpenChange={setDisposalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Disposal</DialogTitle><DialogDescription>Dispose of an active asset</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Asset *</Label>
              <Select value={disposalForm.assetId} onValueChange={v => setDisposalForm(f => ({ ...f, assetId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                <SelectContent>{assets.filter(a => a.status === 'Active').map(a => <SelectItem key={a.id} value={a.id}>{a.assetId} — {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Date *</Label><Input type="date" value={disposalForm.date} onChange={e => setDisposalForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><Label className="text-xs">Disposal Method</Label>
              <Select value={disposalForm.disposalMethod} onValueChange={v => setDisposalForm(f => ({ ...f, disposalMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DISPOSAL_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Proceeds (PKR)</Label><Input type="number" value={disposalForm.proceeds || ''} onChange={e => setDisposalForm(f => ({ ...f, proceeds: parseFloat(e.target.value) || 0 }))} /></div>
            {selectedAsset && (
              <div className="p-3 rounded-lg bg-muted text-xs space-y-1">
                <div><span className="text-muted-foreground">NBV:</span> {pkr(selectedAsset.netBookValue)}</div>
                <div><span className="text-muted-foreground">Gain/Loss:</span> <span className={gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}>{pkr(gainLoss)}</span></div>
              </div>
            )}
            <div><Label className="text-xs">Description</Label><Textarea value={disposalForm.description} onChange={e => setDisposalForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisposalOpen(false)}>Cancel</Button>
            <Button onClick={() => handleDisposal(disposalForm)} disabled={!disposalForm.assetId}>Record Disposal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const renderTransferDialog = () => {
    const selectedAsset = assets.find(a => a.id === transferForm.assetId)

    return (
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Transfer</DialogTitle><DialogDescription>Transfer asset to new location/custodian</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Asset *</Label>
              <Select value={transferForm.assetId} onValueChange={v => {
                const a = assets.find(a => a.id === v)
                setTransferForm(f => ({ ...f, assetId: v, fromLocation: a?.location || '', fromCustodian: a?.custodian || '', fromCostCenter: a?.costCenter || '' }))
              }}>
                <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                <SelectContent>{assets.filter(a => a.status === 'Active').map(a => <SelectItem key={a.id} value={a.id}>{a.assetId} — {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Date *</Label><Input type="date" value={transferForm.date} onChange={e => setTransferForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">From Location</Label><Input value={transferForm.fromLocation} readOnly className="bg-muted" /></div>
              <div><Label className="text-xs">To Location *</Label><Input value={transferForm.toLocation} onChange={e => setTransferForm(f => ({ ...f, toLocation: e.target.value }))} /></div>
              <div><Label className="text-xs">From Custodian</Label><Input value={transferForm.fromCustodian} readOnly className="bg-muted" /></div>
              <div><Label className="text-xs">To Custodian *</Label><Input value={transferForm.toCustodian} onChange={e => setTransferForm(f => ({ ...f, toCustodian: e.target.value }))} /></div>
              <div><Label className="text-xs">From Cost Center</Label><Input value={transferForm.fromCostCenter} readOnly className="bg-muted" /></div>
              <div><Label className="text-xs">To Cost Center</Label><Input value={transferForm.toCostCenter} onChange={e => setTransferForm(f => ({ ...f, toCostCenter: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Description</Label><Textarea value={transferForm.description} onChange={e => setTransferForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={() => handleTransfer(transferForm)} disabled={!transferForm.assetId}>Record Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const renderAdjustmentDialog = () => {
    const selectedAsset = assets.find(a => a.id === (adjustmentForm.assetId as string))

    return (
      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Adjustment</DialogTitle><DialogDescription>Revalue or adjust asset</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Asset *</Label>
              <Select value={adjustmentForm.assetId as string} onValueChange={v => setAdjustmentForm(f => ({ ...f, assetId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                <SelectContent>{assets.filter(a => a.status === 'Active').map(a => <SelectItem key={a.id} value={a.id}>{a.assetId} — {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Date *</Label><Input type="date" value={adjustmentForm.date as string} onChange={e => setAdjustmentForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><Label className="text-xs">Adjustment Type</Label>
              <Select value={adjustmentForm.adjustmentType as string} onValueChange={v => setAdjustmentForm(f => ({ ...f, adjustmentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Upward Revaluation">Upward Revaluation</SelectItem>
                  <SelectItem value="Downward (Impairment)">Downward (Impairment)</SelectItem>
                  <SelectItem value="Correction">Correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">New Value (PKR) *</Label><Input type="number" value={adjustmentForm.newValue as number || ''} onChange={e => setAdjustmentForm(f => ({ ...f, newValue: parseFloat(e.target.value) || 0 }))} /></div>
            {selectedAsset && (
              <div className="p-3 rounded-lg bg-muted text-xs space-y-1">
                <div><span className="text-muted-foreground">Current NBV:</span> {pkr(selectedAsset.netBookValue)}</div>
                <div><span className="text-muted-foreground">Difference:</span> <span className={((adjustmentForm.newValue as number) - selectedAsset.netBookValue) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{pkr((adjustmentForm.newValue as number) - selectedAsset.netBookValue)}</span></div>
              </div>
            )}
            <div><Label className="text-xs">Description</Label><Textarea value={adjustmentForm.description as string} onChange={e => setAdjustmentForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentOpen(false)}>Cancel</Button>
            <Button onClick={() => handleAdjustment(adjustmentForm)} disabled={!adjustmentForm.assetId}>Record Adjustment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ─── Render: Asset Detail Sheet ─────────────────────────────────────────

  const renderDetailSheet = () => {
    if (!detailAsset) return null
    const a = detailAsset
    const computed = a.computed

    return (
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {getCategoryIcon(a.category)}{a.name}
              {a.isDonorFunded && <Badge className="bg-purple-100 text-purple-800">DONOR</Badge>}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-muted-foreground">Asset ID:</span> <span className="font-mono">{a.assetId}</span></div>
              <div><span className="text-muted-foreground">Category:</span> {a.category}</div>
              <div><span className="text-muted-foreground">Status:</span> {statusBadge(a.status)}</div>
              <div><span className="text-muted-foreground">Approval:</span> {approvalBadge(a.approvalStatus)}</div>
              <div><span className="text-muted-foreground">Condition:</span> {a.condition}</div>
              <div><span className="text-muted-foreground">Serial #:</span> {a.serialNumber || '—'}</div>
            </div>

            <Separator />
            <div className="text-xs font-medium">Financial Details</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-muted-foreground">Purchase Price:</span> {pkr(a.purchasePrice)}</div>
              <div><span className="text-muted-foreground">Acc. Depreciation:</span> {pkr(a.accumulatedDepreciation)}</div>
              <div><span className="text-muted-foreground">Net Book Value:</span> <span className="font-bold text-sm">{pkr(a.netBookValue)}</span></div>
              <div><span className="text-muted-foreground">Residual Value:</span> {pkr(a.residualValue)}</div>
              <div><span className="text-muted-foreground">Dep. Method:</span> {a.depreciationMethod}</div>
              <div><span className="text-muted-foreground">Useful Life:</span> {a.usefulLifeYears} years</div>
              {computed && (
                <>
                  <div><span className="text-muted-foreground">Dep. %:</span> {computed.depreciationPct}%</div>
                  <div><span className="text-muted-foreground">Remaining Life:</span> {computed.remainingLife} years</div>
                </>
              )}
            </div>

            <Separator />
            <div className="text-xs font-medium">Location & Custodian</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-muted-foreground">Location:</span> {a.location || '—'}</div>
              <div><span className="text-muted-foreground">Province:</span> {a.province}</div>
              <div><span className="text-muted-foreground">Custodian:</span> {a.custodian || '—'}</div>
              <div><span className="text-muted-foreground">Cost Center:</span> {a.costCenter || '—'}</div>
            </div>

            {a.isDonorFunded && (
              <>
                <Separator />
                <div className="text-xs font-medium">Donor Information</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Donor:</span> {a.donor || '—'}</div>
                  <div><span className="text-muted-foreground">Grant Ref:</span> {a.grantReference || '—'}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Restrictions:</span> {a.donorRestrictions || '—'}</div>
                </div>
              </>
            )}

            <Separator />
            <div className="text-xs font-medium">Insurance & Warranty</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-muted-foreground">Insurance Value:</span> {pkr(a.insuranceValue)}</div>
              <div><span className="text-muted-foreground">Policy #:</span> {a.insurancePolicyNumber || '—'}</div>
              <div><span className="text-muted-foreground">Insurance Expiry:</span> {formatDate(a.insuranceExpiryDate)}</div>
              <div><span className="text-muted-foreground">Warranty Expiry:</span> {formatDate(a.warrantyExpiryDate)}</div>
            </div>

            <Separator />
            <div className="text-xs font-medium">GL Mapping</div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><span className="text-muted-foreground">Asset:</span> {a.glAssetAccount || '—'}</div>
              <div><span className="text-muted-foreground">Acc.Dep:</span> {a.glAccDepAccount || '—'}</div>
              <div><span className="text-muted-foreground">Exp:</span> {a.glDepExpAccount || '—'}</div>
            </div>

            {a.depreciationRecords && a.depreciationRecords.length > 0 && (
              <>
                <Separator />
                <div className="text-xs font-medium">Depreciation History</div>
                <div className="max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead className="text-[10px]">Period</TableHead><TableHead className="text-[10px] text-right">Charge</TableHead><TableHead className="text-[10px] text-right">Closing NBV</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {a.depreciationRecords.slice(0, 12).map(r => (
                        <TableRow key={r.id}><TableCell className="text-[10px]">{r.period}</TableCell><TableCell className="text-[10px] text-right">{pkr(r.depreciationCharge)}</TableCell><TableCell className="text-[10px] text-right">{pkr(r.closingNBV)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <Separator />
            <div className="flex flex-wrap gap-2">
              {canEdit && <Button size="sm" className="h-7 text-xs" onClick={() => { setDetailOpen(false); openEditWizard(a) }}><Edit className="h-3 w-3 mr-1" />Edit</Button>}
              {canApprove && a.approvalStatus === 'Pending Approval' && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleApproveAsset(a.id)}><Check className="h-3 w-3 mr-1" />Approve</Button>
              )}
              {canManageTransactions && a.status === 'Active' && (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setDetailOpen(false); setDisposalOpen(true) }}><Trash2 className="h-3 w-3 mr-1" />Dispose</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setDetailOpen(false); setTransferOpen(true) }}><ArrowRight className="h-3 w-3 mr-1" />Transfer</Button>
                </>
              )}
              {canRequestTransfer && a.status === 'Active' && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setDetailOpen(false); setTransferOpen(true) }}><ArrowRight className="h-3 w-3 mr-1" />Request Transfer</Button>
              )}
              {canDelete && <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDeleteAsset(a.id)}><XCircle className="h-3 w-3 mr-1" />Write Off</Button>}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // ─── Main Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />Fixed Assets Management
            <Badge variant="secondary" className={`text-[10px] ${ROLES[currentRole]?.color}`}>
              <Shield className="h-3 w-3 mr-1" />{ROLES[currentRole]?.label}
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground">Fixed Assets Management System (FAMS)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <Select value={currentRole} onValueChange={setCurrentRole}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLES).map(([key, role]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-1.5">
                      <span>{role.icon}</span>
                      <span>{role.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={refreshAll}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1">
          <TabsTrigger value="dashboard" className="text-xs h-8">Dashboard</TabsTrigger>
          <TabsTrigger value="register" className="text-xs h-8">Register</TabsTrigger>
          <TabsTrigger value="depreciation" className="text-xs h-8">Depreciation</TabsTrigger>
          <TabsTrigger value="donor" className="text-xs h-8">Donor Assets</TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs h-8">Transactions</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs h-8">Reports</TabsTrigger>
          <TabsTrigger value="fiscal-year" className="text-xs h-8">Financial Year</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs h-8">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">{renderDashboard()}</TabsContent>
        <TabsContent value="register">{renderAssetRegister()}</TabsContent>
        <TabsContent value="depreciation">{renderDepreciation()}</TabsContent>
        <TabsContent value="donor">{renderDonorAssets()}</TabsContent>
        <TabsContent value="transactions">{renderTransactions()}</TabsContent>
        <TabsContent value="reports">{renderReports()}</TabsContent>
        <TabsContent value="fiscal-year">{renderFinancialYear()}</TabsContent>
        <TabsContent value="settings">{renderSettings()}</TabsContent>
      </Tabs>

      {/* Registration Form Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {editMode ? 'Edit Asset' : 'Fixed Asset Registration Form'}
            </DialogTitle>
            <DialogDescription>
              {editMode ? 'Update the asset details below' : 'Fill in the asset details to register and create a draft voucher'}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 140px)' }}>
            {renderRegistrationForm()}
          </div>
          {/* Sticky Bottom Action Bar */}
          <div className="sticky bottom-0 border-t bg-background px-6 py-3 flex items-center justify-between">
            <Button variant="outline" onClick={() => setWizardOpen(false)} disabled={saving}>
              <X className="h-4 w-4 mr-1" />Cancel
            </Button>
            <div className="flex gap-2">
              {canCreate && (
                <Button variant="outline" onClick={() => handleSaveAsset('draft')} disabled={saving || !isFormValid}>
                  <Save className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save as Draft'}
                </Button>
              )}
              {canCreate && (
                <Button onClick={() => handleSaveAsset('submit')} disabled={saving || !isFormValid}>
                  <Send className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Save & Create Draft Voucher'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialogs */}
      {renderDisposalDialog()}
      {renderTransferDialog()}
      {renderAdjustmentDialog()}

      {/* Asset Detail Sheet */}
      {renderDetailSheet()}

      {/* CSV Import Dialog */}
      <Dialog open={csvImportOpen} onOpenChange={setCsvImportOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Assets from CSV
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paste CSV data below. Required columns: {CSV_REQUIRED_COLUMNS.join(', ')}.
              Optional: {CSV_OPTIONAL_COLUMNS.join(', ')}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium">CSV Data</Label>
              <Textarea
                className="mt-1 font-mono text-xs min-h-40"
                placeholder={`name,category,purchasePrice,dateOfPurchase,location,custodian,province\nGenerator,Machinery,5000000,2024-01-15,Peshawar Office,Ahmad Khan,KPK\nDesk,Furniture,25000,2024-02-01,Conference Room,Sara Ali,KPK`}
                value={csvText}
                onChange={e => { setCsvText(e.target.value); setCsvErrors([]) }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium">Or select a file:</Label>
              <Input
                type="file"
                accept=".csv"
                className="h-8 text-xs"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      const text = ev.target?.result as string
                      setCsvText(text)
                      setCsvErrors([])
                    }
                    reader.readAsText(file)
                  }
                }}
              />
            </div>

            {/* Preview */}
            {csvText.trim() && (() => {
              const { headers, rows, errors: previewErrors } = parseCsvPreview()
              return (
                <div className="space-y-2">
                  {previewErrors.length > 0 && (
                    <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                      {previewErrors.map((err, i) => (
                        <p key={i} className="text-xs text-red-700 flex items-center gap-1">
                          <XCircle className="h-3 w-3" />{err}
                        </p>
                      ))}
                    </div>
                  )}
                  {headers.length > 0 && rows.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Preview (first {Math.min(rows.length, 5)} rows):</p>
                      <div className="overflow-x-auto border rounded-lg max-h-48">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {headers.map((h, i) => (
                                <TableHead key={i} className="text-[10px] px-2 py-1">
                                  {h}
                                  {CSV_REQUIRED_COLUMNS.includes(h) && <span className="text-red-500">*</span>}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row, ri) => (
                              <TableRow key={ri}>
                                {headers.map((h, ci) => (
                                  <TableCell key={ci} className="text-[10px] px-2 py-1 truncate max-w-32">
                                    {row[ci] || '—'}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Import Progress */}
            {csvImporting && (
              <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                  <span className="text-xs font-medium text-sky-800">Importing assets...</span>
                </div>
                <div className="w-full bg-sky-200 rounded-full h-2">
                  <div
                    className="bg-sky-600 h-2 rounded-full transition-all"
                    style={{ width: `${csvProgress.total > 0 ? (csvProgress.done / csvProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-sky-700 mt-1">Imported {csvProgress.done}/{csvProgress.total} assets</p>
              </div>
            )}

            {/* Import Errors */}
            {csvErrors.length > 0 && !csvImporting && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs font-medium text-red-800 mb-1">Errors ({csvErrors.length}):</p>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {csvErrors.map((err, i) => (
                    <p key={i} className="text-[10px] text-red-700">{err}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex items-center justify-between">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => { setCsvText(''); setCsvErrors([]) }} disabled={csvImporting}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />Clear
            </Button>
            <Button size="sm" className="text-xs" onClick={handleCsvImport} disabled={csvImporting || !csvText.trim()}>
              {csvImporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              {csvImporting ? `Importing ${csvProgress.done}/${csvProgress.total}...` : 'Import Assets'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
