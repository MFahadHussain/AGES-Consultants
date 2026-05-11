'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import {
  FileText, Users, Building2, ArrowLeft, Loader2, CheckCircle,
  AlertCircle, AlertTriangle, Eye, BookOpen, Printer, Send,
  ChevronDown, ChevronUp, XCircle, Download
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

// ── Interfaces ──────────────────────────────────────────────────

interface EmployeeOption {
  id: string
  name: string
  employeeCode: string
  designation: string
  department: string
  baseSalary: number
  salaryExpenseAccountId: string | null
  scExpenseAccountId: string | null
  salaryPayableAccountId: string | null
  scPayableAccountId: string | null
  taxPayableAccountId: string | null
  assignments: AssignmentInfo[]
}

interface AssignmentInfo {
  id: string
  projectId: string
  projectName: string
  projectCode: string
  allocationType: string
  allocationValue: number
  salaryAmount: number
  isActive: boolean
}

interface ProjectOption {
  id: string
  code: string
  name: string
  status: string
}

interface PreviewRow {
  employeeId: string
  employeeName: string
  employeeCode: string
  projectId: string
  projectCode: string
  projectName: string
  weightPct: string
  grossSalary: number
  tax: number
  netSalary: number
  sc: number
  total: number
  hasAccountError: boolean
  accountErrorMessage: string
  weightWarning: boolean
  taxExceedsGross: boolean
  negativeNet: boolean
}

interface ValidationError {
  employeeId: string
  employeeName: string
  field: string
  message: string
  severity: 'error' | 'warning'
}

interface GeneratedVoucher {
  voucherId: string
  voucherNumber: string
  employeeName: string
  employeeCode: string
  projectCode: string
  projectName: string
  period: string
  totalDebit: number
  totalCredit: number
  balanced: boolean
  status: string
  entries: Array<{
    lineNumber: number
    accountId: string
    accountCode: string
    accountName: string
    debit: number
    credit: number
    description: string
  }>
  breakdown: {
    grossSalary: number
    tax: number
    netSalary: number
    sc: number
    weightPct: string
  }
}

// ── Component ───────────────────────────────────────────────────

export function SalaryVoucherCreation({ onBack }: { onBack: () => void }) {
  const { toast } = useToast()

  // Period state
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [financialYearId, setFinancialYearId] = useState<string | null>(null)
  const [financialYears, setFinancialYears] = useState<any[]>([])

  // Data
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(true)

  // Selection mode
  const [mode, setMode] = useState<'by-project' | 'by-employee' | 'combined'>('by-project')

  // Selections
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set())
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [projectSearch, setProjectSearch] = useState('')

  // Preview
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewGenerated, setPreviewGenerated] = useState(false)

  // Generation
  const [generating, setGenerating] = useState(false)
  const [generatedVouchers, setGeneratedVouchers] = useState<GeneratedVoucher[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [expandedVoucherId, setExpandedVoucherId] = useState<string | null>(null)
  const [periodProcessed, setPeriodProcessed] = useState(false)

  // ── Fetch initial data ──────────────────────────────────────
  const fetchInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, projRes, fyRes] = await Promise.all([
        fetch('/api/employees?pageSize=200&status=active'),
        fetch('/api/projects'),
        fetch('/api/financial-year'),
      ])

      // Parse employees
      const empData = await empRes.json()
      let empList: any[] = []
      if (Array.isArray(empData)) empList = empData
      else if (empData?.data) empList = empData.data
      else if (empData?.employees) empList = empData.employees

      // For each active employee, fetch project assignments
      const activeEmps = empList.filter((e: any) => e.status === 'active' || e.status === 'ACTIVE')
      const assignmentPromises = activeEmps.map(async (emp: any) => {
        try {
          const aRes = await fetch(`/api/project-assignments?employeeId=${emp.id}&isActive=true`)
          const assignments = await aRes.json()
          return {
            ...emp,
            assignments: Array.isArray(assignments)
              ? assignments.map((a: any) => ({
                  id: a.id,
                  projectId: a.project?.id || a.projectId,
                  projectName: a.project?.name || 'Unknown',
                  projectCode: a.project?.code || 'N/A',
                  allocationType: a.allocationType,
                  allocationValue: a.allocationValue,
                  salaryAmount: a.salaryAmount,
                  isActive: a.isActive,
                }))
              : [],
          }
        } catch {
          return { ...emp, assignments: [] }
        }
      })

      const employeesWithAssignments = await Promise.all(assignmentPromises)

      setEmployees(
        employeesWithAssignments.map((e: any) => ({
          id: e.id,
          name: e.name,
          employeeCode: e.employeeCode || '',
          designation: e.designation || '',
          department: e.department || '',
          baseSalary: e.baseSalary || 0,
          salaryExpenseAccountId: e.salaryExpenseAccountId || null,
          scExpenseAccountId: e.scExpenseAccountId || null,
          salaryPayableAccountId: e.salaryPayableAccountId || null,
          scPayableAccountId: e.scPayableAccountId || null,
          taxPayableAccountId: e.taxPayableAccountId || null,
          assignments: e.assignments || [],
        }))
      )

      // Parse projects
      const projData = await projRes.json()
      const projList = Array.isArray(projData) ? projData : []
      setProjects(
        projList
          .filter((p: any) => p.status === 'active' || p.status === 'ACTIVE' || p.isActive)
          .map((p: any) => ({
            id: p.id,
            code: p.code || '',
            name: p.name || '',
            status: p.status || '',
          }))
      )

      // Parse financial years
      const fyData = await fyRes.json()
      const fyList = Array.isArray(fyData) ? fyData : []
      setFinancialYears(fyList)
      const openFy = fyList.find((f: any) => f.status === 'open')
      if (openFy) setFinancialYearId(openFy.id)
    } catch {
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  // ── Auto-detect financial year from period ──────────────────
  useEffect(() => {
    if (!period || financialYears.length === 0) return
    const [yearStr, monthStr] = period.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    // Financial year in Pakistan: July-June
    const fyStartYear = month >= 7 ? year : year - 1
    const fyLabel = `FY ${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`
    const matchingFy = financialYears.find(
      (f: any) => f.name === fyLabel || f.label === fyLabel || (f.startDate && f.endDate && new Date(f.startDate).getFullYear() === fyStartYear)
    )
    if (matchingFy && matchingFy.status === 'open') {
      setFinancialYearId(matchingFy.id)
    }
  }, [period, financialYears])

  // ── Filtered lists ──────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return employees
    const q = employeeSearch.toLowerCase()
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q)
    )
  }, [employees, employeeSearch])

  const filteredProjects = useMemo(() => {
    if (!projectSearch) return projects
    const q = projectSearch.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
    )
  }, [projects, projectSearch])

  // ── Get employees for selected projects ──────────────────────
  const projectEmployeeIds = useMemo(() => {
    if (selectedProjectIds.size === 0) return new Set<string>()
    const ids = new Set<string>()
    for (const emp of employees) {
      for (const a of emp.assignments) {
        if (selectedProjectIds.has(a.projectId)) {
          ids.add(emp.id)
        }
      }
    }
    return ids
  }, [employees, selectedProjectIds])

  // ── Effective selected employees based on mode ──────────────
  const effectiveEmployeeIds = useMemo(() => {
    if (mode === 'by-project') {
      return projectEmployeeIds
    } else if (mode === 'by-employee') {
      return selectedEmployeeIds
    } else {
      // combined: intersection
      const result = new Set<string>()
      for (const id of selectedEmployeeIds) {
        if (projectEmployeeIds.has(id)) result.add(id)
      }
      // Also add employees that are in selectedEmployeeIds even if not in project filter
      // if no project filter, just use employee selection
      if (selectedProjectIds.size === 0) return selectedEmployeeIds
      return result
    }
  }, [mode, selectedEmployeeIds, projectEmployeeIds])

  // ── Toggle helpers ───────────────────────────────────────────
  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllProjects = () => {
    if (selectedProjectIds.size === filteredProjects.length) {
      setSelectedProjectIds(new Set())
    } else {
      setSelectedProjectIds(new Set(filteredProjects.map((p) => p.id)))
    }
  }

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllEmployees = () => {
    if (selectedEmployeeIds.size === filteredEmployees.length) {
      setSelectedEmployeeIds(new Set())
    } else {
      setSelectedEmployeeIds(new Set(filteredEmployees.map((e) => e.id)))
    }
  }

  // ── Calculate preview ────────────────────────────────────────
  const calculatePreview = useCallback(async () => {
    if (effectiveEmployeeIds.size === 0) {
      toast({ title: 'No Selection', description: 'Please select at least one project or employee', variant: 'destructive' })
      return
    }

    setPreviewLoading(true)
    setPreviewRows([])
    setValidationErrors([])

    try {
      const empIds = Array.from(effectiveEmployeeIds)
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: empIds, month: period }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Calculation failed')

      const results = data.results || {}
      const rows: PreviewRow[] = []
      const errors: ValidationError[] = []

      for (const empId of empIds) {
        const calc = results[empId]
        if (!calc) continue

        const emp = employees.find((e) => e.id === empId)
        if (!emp) continue

        // Check account configuration
        const hasNoAccounts = !emp.salaryExpenseAccountId
        const hasNoTaxAccount = !emp.taxPayableAccountId && (calc.deductions?.incomeTax || 0) > 0

        // Get project allocations
        const allocations = calc.projectAllocations || []
        if (allocations.length === 0) {
          // Single project fallback
          const proj = emp.assignments[0]
          const grossSalary = Math.round(calc.grossSalary || 0)
          const tax = Math.round(calc.deductions?.incomeTax || 0)
          const netSalary = Math.round(calc.netPay || 0)
          const sc = Math.round(calc.finalSC || 0)
          const total = netSalary + sc

          const hasAccountErr = hasNoAccounts
          const taxExceeds = tax > grossSalary
          const negNet = netSalary < 0

          if (hasAccountErr) {
            errors.push({
              employeeId: emp.id,
              employeeName: emp.name,
              field: 'accounts',
              message: 'No Chart of Accounts configured',
              severity: 'error',
            })
          }
          if (hasNoTaxAccount && tax > 0) {
            errors.push({
              employeeId: emp.id,
              employeeName: emp.name,
              field: 'taxPayableAccountId',
              message: 'Tax Payable Account not mapped',
              severity: 'error',
            })
          }
          if (taxExceeds) {
            errors.push({
              employeeId: emp.id,
              employeeName: emp.name,
              field: 'tax',
              message: 'Tax exceeds gross salary',
              severity: 'error',
            })
          }
          if (negNet) {
            errors.push({
              employeeId: emp.id,
              employeeName: emp.name,
              field: 'netSalary',
              message: 'Net salary is negative',
              severity: 'error',
            })
          }

          rows.push({
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.employeeCode,
            projectId: proj?.projectId || '',
            projectCode: proj?.projectCode || 'N/A',
            projectName: proj?.projectName || 'Unassigned',
            weightPct: '100%',
            grossSalary,
            tax,
            netSalary,
            sc,
            total,
            hasAccountError: hasAccountErr || hasNoTaxAccount || taxExceeds || negNet,
            accountErrorMessage: hasAccountErr ? 'No CoA configured' : hasNoTaxAccount ? 'Tax Payable not mapped' : '',
            weightWarning: false,
            taxExceedsGross: taxExceeds,
            negativeNet: negNet,
          })
        } else {
          // Multiple project allocations
          let totalWeight = 0
          for (const alloc of allocations) {
            totalWeight += alloc.weight || 0
          }
          const weightWarning = allocations.length > 0 && Math.abs(totalWeight - 1) > 0.02

          for (const alloc of allocations) {
            // Filter by selected projects in combined/by-project mode
            if (selectedProjectIds.size > 0 && !selectedProjectIds.has(alloc.projectId)) continue

            const grossSalary = Math.round(alloc.salaryShare || 0)
            const tax = Math.round((calc.deductions?.incomeTax || 0) * (alloc.weight || 0))
            const netSalary = grossSalary - tax
            const sc = Math.round(alloc.scShare || 0)
            const total = netSalary + sc

            const hasAccountErr = hasNoAccounts
            const taxExceeds = tax > grossSalary
            const negNet = netSalary < 0

            if (hasAccountErr) {
              errors.push({
                employeeId: emp.id,
                employeeName: emp.name,
                field: 'accounts',
                message: 'No Chart of Accounts configured',
                severity: 'error',
              })
            }
            if (hasNoTaxAccount && tax > 0) {
              errors.push({
                employeeId: emp.id,
                employeeName: emp.name,
                field: 'taxPayableAccountId',
                message: 'Tax Payable Account not mapped',
                severity: 'error',
              })
            }
            if (weightWarning) {
              errors.push({
                employeeId: emp.id,
                employeeName: emp.name,
                field: 'projectAllocations',
                message: `Allocation weights total ${(totalWeight * 100).toFixed(1)}% instead of 100%`,
                severity: 'warning',
              })
            }

            rows.push({
              employeeId: emp.id,
              employeeName: emp.name,
              employeeCode: emp.employeeCode,
              projectId: alloc.projectId,
              projectCode: alloc.projectCode,
              projectName: alloc.projectName,
              weightPct: alloc.weightPct || `${Math.round((alloc.weight || 0) * 100)}%`,
              grossSalary,
              tax,
              netSalary,
              sc,
              total,
              hasAccountError: hasAccountErr || hasNoTaxAccount || taxExceeds || negNet,
              accountErrorMessage: hasAccountErr ? 'No CoA configured' : hasNoTaxAccount ? 'Tax Payable not mapped' : '',
              weightWarning,
              taxExceedsGross: taxExceeds,
              negativeNet: negNet,
            })
          }
        }
      }

      // Deduplicate errors by employeeId+field
      const seen = new Set<string>()
      const uniqueErrors = errors.filter((e) => {
        const key = `${e.employeeId}|${e.field}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      setPreviewRows(rows)
      setValidationErrors(uniqueErrors)
      setPreviewGenerated(true)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setPreviewLoading(false)
    }
  }, [effectiveEmployeeIds, period, employees, selectedProjectIds, toast])

  // ── Check if generation is blocked ──────────────────────────
  const hasBlockingErrors = useMemo(() => {
    return validationErrors.some(
      (e) =>
        e.severity === 'error' ||
        e.field === 'tax' ||
        e.field === 'netSalary'
    )
  }, [validationErrors])

  const hasNoSelection = effectiveEmployeeIds.size === 0

  // ── Generate vouchers ────────────────────────────────────────
  const handleGenerate = async () => {
    if (hasBlockingErrors || hasNoSelection) return
    if (!financialYearId) {
      toast({ title: 'Error', description: 'No open financial year found', variant: 'destructive' })
      return
    }

    setGenerating(true)
    try {
      const body: any = {
        mode,
        period,
        financialYearId,
      }

      if (mode === 'by-project' || mode === 'combined') {
        body.projectIds = Array.from(selectedProjectIds)
      }
      if (mode === 'by-employee' || mode === 'combined') {
        body.employeeIds = Array.from(effectiveEmployeeIds)
      }
      // For by-project mode, we still need employeeIds to be populated
      if (mode === 'by-project') {
        body.employeeIds = Array.from(effectiveEmployeeIds)
      }

      const res = await fetch('/api/payroll/generate-gl-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to generate vouchers')

      setGeneratedVouchers(result.vouchers || [])
      setPeriodProcessed(true)

      // Combine any API validation errors with our frontend ones
      const apiErrors: ValidationError[] = (result.validationErrors || []).map((e: any) => ({
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        field: e.field,
        message: e.message,
        severity: (e.field === 'projectAllocations' ? 'warning' : 'error') as 'error' | 'warning',
      }))
      if (apiErrors.length > 0) {
        setValidationErrors((prev) => {
          const combined = [...prev, ...apiErrors]
          const seen = new Set<string>()
          return combined.filter((e) => {
            const key = `${e.employeeId}|${e.field}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
        })
      }

      toast({
        title: 'Vouchers Generated',
        description: `${result.vouchers?.length || 0} Salary Voucher(s) Created`,
      })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  // ── Post single voucher to GL ────────────────────────────────
  const handlePostVoucher = async (voucherId: string) => {
    try {
      const res = await fetch(`/api/vouchers/${voucherId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post' }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to post')
      }
      toast({ title: 'Posted', description: 'Voucher posted to General Ledger' })
      setGeneratedVouchers((prev) =>
        prev.map((v) => (v.voucherId === voucherId ? { ...v, status: 'posted' } : v))
      )
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  // ── Post all draft vouchers ──────────────────────────────────
  const handlePostAll = async () => {
    let postedCount = 0
    for (const v of generatedVouchers.filter((v) => v.status === 'draft')) {
      try {
        const res = await fetch(`/api/vouchers/${v.voucherId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'post' }),
        })
        if (res.ok) {
          postedCount++
          setGeneratedVouchers((prev) =>
            prev.map((vs) => (vs.voucherId === v.voucherId ? { ...vs, status: 'posted' } : vs))
          )
        }
      } catch {
        // ignore individual errors
      }
    }
    if (postedCount > 0) {
      toast({ title: 'Posted to GL', description: `${postedCount} voucher(s) posted to General Ledger` })
    }
  }

  // ── Print voucher ────────────────────────────────────────────
  const handlePrint = (voucher: GeneratedVoucher) => {
    const printContent = `
      <html>
      <head><title>Salary Voucher - ${voucher.voucherNumber}</title>
      <style>
        body { font-family: monospace; padding: 20px; }
        h1 { font-size: 18px; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; font-size: 12px; }
        th { background: #f0f0f0; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
      </style>
      </head>
      <body>
        <h1>AcctFin ERP — Salary Voucher</h1>
        <p><strong>Voucher No:</strong> ${voucher.voucherNumber} | <strong>Employee:</strong> ${voucher.employeeName} (${voucher.employeeCode}) | <strong>Project:</strong> ${voucher.projectName} [${voucher.projectCode}] | <strong>Period:</strong> ${voucher.period}</p>
        <table>
          <tr><th>#</th><th>Account Code</th><th>Account Name</th><th class="right">Debit (PKR)</th><th class="right">Credit (PKR)</th><th>Description</th></tr>
          ${voucher.entries.map((e) => `<tr><td>${e.lineNumber}</td><td>${e.accountCode}</td><td>${e.accountName}</td><td class="right">${e.debit > 0 ? formatCurrency(e.debit) : ''}</td><td class="right">${e.credit > 0 ? formatCurrency(e.credit) : ''}</td><td>${e.description}</td></tr>`).join('')}
          <tr class="bold"><td colspan="3">TOTAL</td><td class="right">${formatCurrency(voucher.totalDebit)}</td><td class="right">${formatCurrency(voucher.totalCredit)}</td><td></td></tr>
        </table>
        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
          <div style="text-align: center;"><div style="border-top: 1px solid #000; width: 150px; padding-top: 4px;">Prepared By</div></div>
          <div style="text-align: center;"><div style="border-top: 1px solid #000; width: 150px; padding-top: 4px;">Reviewed By</div></div>
          <div style="text-align: center;"><div style="border-top: 1px solid #000; width: 150px; padding-top: 4px;">Approved By</div></div>
        </div>
      </body>
      </html>
    `
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(printContent)
      win.document.close()
      win.print()
    }
  }

  // ── Grouped preview rows by project ─────────────────────────
  const groupedRows = useMemo(() => {
    const groups = new Map<string, { project: { code: string; name: string }; rows: PreviewRow[] }>()
    for (const row of previewRows) {
      const key = row.projectCode
      if (!groups.has(key)) {
        groups.set(key, {
          project: { code: row.projectCode, name: row.projectName },
          rows: [],
        })
      }
      groups.get(key)!.rows.push(row)
    }
    return Array.from(groups.entries())
  }, [previewRows])

  // Grand totals
  const grandTotals = useMemo(() => {
    return previewRows.reduce(
      (acc, row) => ({
        grossSalary: acc.grossSalary + row.grossSalary,
        tax: acc.tax + row.tax,
        netSalary: acc.netSalary + row.netSalary,
        sc: acc.sc + row.sc,
        total: acc.total + row.total,
      }),
      { grossSalary: 0, tax: 0, netSalary: 0, sc: 0, total: 0 }
    )
  }, [previewRows])

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading salary voucher data…</p>
        </div>
      </div>
    )
  }

  // ── Post-generation success screen ──────────────────────────
  if (generatedVouchers.length > 0) {
    const draftCount = generatedVouchers.filter((v) => v.status === 'draft').length
    const postedCount = generatedVouchers.filter((v) => v.status === 'posted').length

    return (
      <div className="space-y-4">
        {/* Back button */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Payroll
          </Button>
        </div>

        {/* Success banner */}
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
              <div>
                <h3 className="text-lg font-bold text-emerald-900">
                  {generatedVouchers.length} Salary Voucher{generatedVouchers.length !== 1 ? 's' : ''} Created
                </h3>
                <p className="text-xs text-emerald-700">
                  Period: {period} • {draftCount} draft, {postedCount} posted
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {draftCount > 0 && (
            <Button size="sm" onClick={handlePostAll} className="bg-emerald-600 hover:bg-emerald-700">
              <Send className="h-3.5 w-3.5 mr-1" /> Post All to GL ({draftCount})
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // Basic print all
              const allContent = generatedVouchers.map((v) => `
                <div style="page-break-after: always;">
                  <h2>${v.voucherNumber} — ${v.employeeName}</h2>
                  <p>Project: ${v.projectName} [${v.projectCode}] | Period: ${v.period}</p>
                  <table style="width:100%;border-collapse:collapse;">
                    <tr><th style="border:1px solid #000;padding:4px;">#</th><th style="border:1px solid #000;padding:4px;">Account</th><th style="border:1px solid #000;padding:4px;text-align:right;">Debit</th><th style="border:1px solid #000;padding:4px;text-align:right;">Credit</th></tr>
                    ${v.entries.map((e) => `<tr><td style="border:1px solid #000;padding:4px;">${e.lineNumber}</td><td style="border:1px solid #000;padding:4px;">${e.accountCode} — ${e.accountName}</td><td style="border:1px solid #000;padding:4px;text-align:right;">${e.debit > 0 ? formatCurrency(e.debit) : ''}</td><td style="border:1px solid #000;padding:4px;text-align:right;">${e.credit > 0 ? formatCurrency(e.credit) : ''}</td></tr>`).join('')}
                  </table>
                </div>
              `).join('')
              const printWin = window.open('', '_blank')
              if (printWin) {
                printWin.document.write(`<html><head><title>Salary Vouchers</title><style>body{font-family:monospace;padding:20px;}table{margin-top:10px;}th,td{font-size:11px;}</style></head><body>${allContent}</body></html>`)
                printWin.document.close()
                printWin.print()
              }
            }}
          >
            <Printer className="h-3.5 w-3.5 mr-1" /> Export PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setGeneratedVouchers([]); setPreviewGenerated(false); setPeriodProcessed(false) }}>
            Create More Vouchers
          </Button>
        </div>

        {/* Voucher list table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Generated Vouchers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Voucher No</TableHead>
                    <TableHead className="text-[10px]">Employee</TableHead>
                    <TableHead className="text-[10px]">Project</TableHead>
                    <TableHead className="text-[10px] text-right">Debit</TableHead>
                    <TableHead className="text-[10px] text-right">Credit</TableHead>
                    <TableHead className="text-[10px]">Status</TableHead>
                    <TableHead className="text-[10px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedVouchers.map((v) => (
                    <>
                      <TableRow key={v.voucherId} className={v.status === 'posted' ? 'bg-emerald-50/30' : ''}>
                        <TableCell className="text-xs py-2 font-mono font-medium">{v.voucherNumber}</TableCell>
                        <TableCell className="text-xs py-2">
                          <div>{v.employeeName}</div>
                          <div className="text-[9px] text-muted-foreground">{v.employeeCode}</div>
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-mono">
                            {v.projectCode}
                          </Badge>
                          <span className="ml-1 text-[10px]">{v.projectName}</span>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right font-mono">{formatCurrency(v.totalDebit)}</TableCell>
                        <TableCell className="text-xs py-2 text-right font-mono">{formatCurrency(v.totalCredit)}</TableCell>
                        <TableCell className="text-xs py-2">
                          <Badge
                            className={`text-[9px] border ${
                              v.status === 'draft'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {v.status === 'draft' ? 'DRAFT' : 'POSTED'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() =>
                                setExpandedVoucherId(expandedVoucherId === v.voucherId ? null : v.voucherId)
                              }
                            >
                              <Eye className="h-3 w-3 mr-0.5" />
                              {expandedVoucherId === v.voucherId ? 'Hide' : 'View'}
                            </Button>
                            {v.status === 'draft' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px] text-emerald-700"
                                onClick={() => handlePostVoucher(v.voucherId)}
                              >
                                <BookOpen className="h-3 w-3 mr-0.5" />
                                Post
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => handlePrint(v)}
                            >
                              <Printer className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded voucher detail */}
                      {expandedVoucherId === v.voucherId && (
                        <TableRow key={`${v.voucherId}-detail`}>
                          <TableCell colSpan={7} className="p-3 bg-muted/30">
                            <div className="rounded border overflow-x-auto max-w-3xl">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-violet-100/50">
                                    <TableHead className="text-[10px] h-7 w-10">#</TableHead>
                                    <TableHead className="text-[10px] h-7">Account Code</TableHead>
                                    <TableHead className="text-[10px] h-7">Account Name</TableHead>
                                    <TableHead className="text-[10px] h-7 text-right">Debit</TableHead>
                                    <TableHead className="text-[10px] h-7 text-right">Credit</TableHead>
                                    <TableHead className="text-[10px] h-7">Description</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {v.entries.map((entry, idx) => (
                                    <TableRow key={idx} className={entry.debit > 0 ? 'bg-red-50/20' : 'bg-green-50/20'}>
                                      <TableCell className="text-[10px] py-1 font-mono">{entry.lineNumber}</TableCell>
                                      <TableCell className="text-[10px] py-1 font-mono">{entry.accountCode}</TableCell>
                                      <TableCell className="text-[10px] py-1 font-medium">{entry.accountName}</TableCell>
                                      <TableCell className="text-[10px] py-1 text-right font-mono">
                                        {entry.debit > 0 ? formatCurrency(entry.debit) : ''}
                                      </TableCell>
                                      <TableCell className="text-[10px] py-1 text-right font-mono">
                                        {entry.credit > 0 ? formatCurrency(entry.credit) : ''}
                                      </TableCell>
                                      <TableCell className="text-[10px] py-1 text-muted-foreground">{entry.description}</TableCell>
                                    </TableRow>
                                  ))}
                                  <TableRow className="bg-violet-100/50 font-bold border-t-2 border-violet-300">
                                    <TableCell className="text-[10px] py-1.5" colSpan={3}>TOTAL</TableCell>
                                    <TableCell className="text-[10px] py-1.5 text-right font-mono">{formatCurrency(v.totalDebit)}</TableCell>
                                    <TableCell className="text-[10px] py-1.5 text-right font-mono">{formatCurrency(v.totalCredit)}</TableCell>
                                    <TableCell className="text-[10px] py-1.5"></TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                            {/* Breakdown summary */}
                            <div className="mt-2 flex items-center gap-3 flex-wrap">
                              <Badge className="text-[9px] bg-blue-50 text-blue-800 border border-blue-200">
                                Gross: {formatCurrency(v.breakdown.grossSalary)}
                              </Badge>
                              <Badge className="text-[9px] bg-red-50 text-red-800 border border-red-200">
                                Tax: {formatCurrency(v.breakdown.tax)}
                              </Badge>
                              <Badge className="text-[9px] bg-green-50 text-green-800 border border-green-200">
                                Net: {formatCurrency(v.breakdown.netSalary)}
                              </Badge>
                              <Badge className="text-[9px] bg-orange-50 text-orange-800 border border-orange-200">
                                SC: {formatCurrency(v.breakdown.sc)}
                              </Badge>
                              <Badge className="text-[9px] bg-muted text-muted-foreground border">
                                Weight: {v.breakdown.weightPct}
                              </Badge>
                              {v.balanced ? (
                                <Badge className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />Balanced
                                </Badge>
                              ) : (
                                <Badge className="text-[9px] bg-red-100 text-red-800 border border-red-200">
                                  <AlertCircle className="h-3 w-3 mr-1" />Imbalanced
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main creation screen ─────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Payroll
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Create Salary Vouchers
            </h2>
            <p className="text-xs text-muted-foreground">
              Flexible salary voucher creation — by project, by employee, or combined
            </p>
          </div>
        </div>
      </div>

      {/* Pay Period Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium">Pay Period:</label>
              <Input
                type="month"
                className="h-8 text-xs w-40"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium">Financial Year:</label>
              <Badge variant="outline" className="text-xs">
                {financialYearId
                  ? financialYears.find((f: any) => f.id === financialYearId)?.name || 'Detected'
                  : 'No open FY'}
              </Badge>
            </div>
            {periodProcessed && (
              <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" /> Period already processed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selection Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="by-project" className="text-xs">
            <Building2 className="h-3.5 w-3.5 mr-1" /> By Project
          </TabsTrigger>
          <TabsTrigger value="by-employee" className="text-xs">
            <Users className="h-3.5 w-3.5 mr-1" /> By Employee
          </TabsTrigger>
          <TabsTrigger value="combined" className="text-xs">
            <Building2 className="h-3.5 w-3.5 mr-1" />
            <Users className="h-3.5 w-3.5 mr-1" /> Combined
          </TabsTrigger>
        </TabsList>

        {/* Mode A: By Project */}
        <TabsContent value="by-project" className="mt-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Select Projects</CardTitle>
                  <CardDescription className="text-[10px]">
                    All employees allocated to selected projects will be included
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search projects…"
                    className="h-7 text-xs w-48"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={toggleAllProjects}>
                    {selectedProjectIds.size === filteredProjects.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredProjects.map((project) => (
                  <label
                    key={project.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                      selectedProjectIds.has(project.id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <Checkbox
                      checked={selectedProjectIds.has(project.id)}
                      onCheckedChange={() => toggleProject(project.id)}
                    />
                    <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-mono">
                      {project.code}
                    </Badge>
                    <span className="text-xs font-medium">{project.name}</span>
                    {projectEmployeeIds.size > 0 && selectedProjectIds.has(project.id) && (
                      <span className="text-[9px] text-muted-foreground ml-auto">
                        {employees.filter((e) => e.assignments.some((a) => a.projectId === project.id)).length} employee(s)
                      </span>
                    )}
                  </label>
                ))}
                {filteredProjects.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No projects found</p>
                )}
              </div>
              {selectedProjectIds.size > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>{projectEmployeeIds.size}</strong> employee(s) will be included across{' '}
                    <strong>{selectedProjectIds.size}</strong> project(s)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mode B: By Employee */}
        <TabsContent value="by-employee" className="mt-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Select Employees</CardTitle>
                  <CardDescription className="text-[10px]">
                    Select employees to generate salary vouchers for their project allocations
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search employees…"
                    className="h-7 text-xs w-48"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={toggleAllEmployees}>
                    {selectedEmployeeIds.size === filteredEmployees.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredEmployees.map((emp) => (
                  <label
                    key={emp.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                      selectedEmployeeIds.has(emp.id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <Checkbox
                      checked={selectedEmployeeIds.has(emp.id)}
                      onCheckedChange={() => toggleEmployee(emp.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{emp.name}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{emp.employeeCode}</span>
                        {!emp.salaryExpenseAccountId && (
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        {emp.designation} {emp.department && `• ${emp.department}`}
                        {emp.assignments.length > 0 && (
                          <span className="ml-2">
                            → {emp.assignments.map((a) => a.projectCode).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatCurrency(emp.baseSalary)}
                    </span>
                  </label>
                ))}
                {filteredEmployees.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No employees found</p>
                )}
              </div>
              {selectedEmployeeIds.size > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong>{selectedEmployeeIds.size}</strong> employee(s) selected
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mode C: Combined */}
        <TabsContent value="combined" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Project selector */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Projects
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search…"
                      className="h-7 text-xs w-32"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                    />
                    <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={toggleAllProjects}>
                      {selectedProjectIds.size === filteredProjects.length ? 'None' : 'All'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredProjects.map((project) => (
                    <label
                      key={project.id}
                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted/50 ${
                        selectedProjectIds.has(project.id) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <Checkbox
                        checked={selectedProjectIds.has(project.id)}
                        onCheckedChange={() => toggleProject(project.id)}
                      />
                      <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-mono">
                        {project.code}
                      </Badge>
                      <span className="text-[11px]">{project.name}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Employee selector */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Employees
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search…"
                      className="h-7 text-xs w-32"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                    />
                    <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={toggleAllEmployees}>
                      {selectedEmployeeIds.size === filteredEmployees.length ? 'None' : 'All'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredEmployees.map((emp) => (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted/50 ${
                        selectedEmployeeIds.has(emp.id) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <Checkbox
                        checked={selectedEmployeeIds.has(emp.id)}
                        onCheckedChange={() => toggleEmployee(emp.id)}
                      />
                      <span className="text-[11px] font-medium">{emp.name}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">{emp.employeeCode}</span>
                      {!emp.salaryExpenseAccountId && (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      )}
                    </label>
                  ))}
                </div>
                {selectedProjectIds.size > 0 && selectedEmployeeIds.size > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-[10px] text-muted-foreground">
                      Showing employees matching <strong>BOTH</strong> filters: {effectiveEmployeeIds.size} employee(s)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview / Generate section */}
      {!previewGenerated ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {effectiveEmployeeIds.size} employee(s) selected
                </p>
                <p className="text-xs text-muted-foreground">
                  Click &quot;Load Preview&quot; to see salary breakdown before generating vouchers
                </p>
              </div>
              <Button
                size="sm"
                onClick={calculatePreview}
                disabled={effectiveEmployeeIds.size === 0 || previewLoading}
              >
                {previewLoading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Eye className="h-3.5 w-3.5 mr-1" />
                )}
                Load Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <Card className={hasBlockingErrors ? 'border-red-200' : 'border-amber-200'}>
              <CardContent className="p-4">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  {hasBlockingErrors ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  Validation Issues ({validationErrors.length})
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {validationErrors.map((err, idx) => (
                    <div
                      key={idx}
                      className={`text-xs flex items-start gap-1.5 ${
                        err.severity === 'error' || err.field === 'tax' || err.field === 'netSalary'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {err.severity === 'error' || err.field === 'tax' || err.field === 'netSalary' ? (
                        <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      )}
                      <span>
                        <strong>{err.employeeName}</strong>: {err.message}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live preview table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Salary Preview — {period}
                  </CardTitle>
                  <CardDescription className="text-[10px]">
                    {previewRows.length} row(s) across {groupedRows.length} project(s)
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={calculatePreview} disabled={previewLoading}>
                  {previewLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Employee</TableHead>
                      <TableHead className="text-[10px]">Project</TableHead>
                      <TableHead className="text-[10px] text-center">Weight %</TableHead>
                      <TableHead className="text-[10px] text-right">Gross Salary</TableHead>
                      <TableHead className="text-[10px] text-right">Tax (−)</TableHead>
                      <TableHead className="text-[10px] text-right">Net Salary</TableHead>
                      <TableHead className="text-[10px] text-right">SC</TableHead>
                      <TableHead className="text-[10px] text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedRows.map(([projKey, group]) => (
                      <>
                        {/* Project header */}
                        <TableRow key={`proj-${projKey}`} className="bg-muted/40">
                          <TableCell colSpan={8} className="py-1.5">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-mono">
                                {group.project.code}
                              </Badge>
                              <span className="text-xs font-semibold">{group.project.name}</span>
                              <span className="text-[9px] text-muted-foreground ml-2">
                                ({group.rows.length} employee(s))
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                        {/* Employee rows */}
                        {group.rows.map((row, rowIdx) => (
                          <TableRow
                            key={`${row.employeeId}-${row.projectId}-${rowIdx}`}
                            className={
                              row.hasAccountError
                                ? 'bg-red-50/50'
                                : row.weightWarning
                                ? 'bg-amber-50/30'
                                : ''
                            }
                          >
                            <TableCell className="text-xs py-1.5">
                              <div className="flex items-center gap-1.5">
                                {row.hasAccountError && (
                                  <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                                )}
                                {row.weightWarning && !row.hasAccountError && (
                                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                )}
                                <div>
                                  <div className="font-medium">{row.employeeName}</div>
                                  <div className="text-[9px] text-muted-foreground font-mono">
                                    {row.employeeCode}
                                  </div>
                                </div>
                              </div>
                              {row.accountErrorMessage && (
                                <div className="text-[9px] text-red-600 mt-0.5">
                                  ❌ {row.accountErrorMessage}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs py-1.5">
                              <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-mono">
                                {row.projectCode}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-center">
                              <span className={row.weightWarning ? 'text-amber-600 font-medium' : ''}>
                                {row.weightPct}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-right font-mono">
                              {formatCurrency(row.grossSalary)}
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-right font-mono text-red-600">
                              {row.tax > 0 ? `−${formatCurrency(row.tax)}` : '−'}
                            </TableCell>
                            <TableCell
                              className={`text-xs py-1.5 text-right font-mono font-semibold ${
                                row.negativeNet ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {formatCurrency(row.netSalary)}
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-right font-mono text-orange-600">
                              {formatCurrency(row.sc)}
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-right font-mono font-semibold">
                              {formatCurrency(row.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Project subtotal */}
                        <TableRow key={`subtotal-${projKey}`} className="bg-muted/20 font-semibold">
                          <TableCell className="text-xs py-1.5" colSpan={3}>
                            Subtotal — {group.project.code}
                          </TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono">
                            {formatCurrency(group.rows.reduce((s, r) => s + r.grossSalary, 0))}
                          </TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono text-red-600">
                            {formatCurrency(group.rows.reduce((s, r) => s + r.tax, 0))}
                          </TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono text-green-600">
                            {formatCurrency(group.rows.reduce((s, r) => s + r.netSalary, 0))}
                          </TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono text-orange-600">
                            {formatCurrency(group.rows.reduce((s, r) => s + r.sc, 0))}
                          </TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono">
                            {formatCurrency(group.rows.reduce((s, r) => s + r.total, 0))}
                          </TableCell>
                        </TableRow>
                      </>
                    ))}
                    {/* Grand total */}
                    <TableRow className="bg-primary/5 font-bold border-t-2 border-primary/20">
                      <TableCell className="text-xs py-2" colSpan={3}>
                        GRAND TOTAL
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-mono">
                        {formatCurrency(grandTotals.grossSalary)}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-mono text-red-600">
                        {formatCurrency(grandTotals.tax)}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-mono text-green-600">
                        {formatCurrency(grandTotals.netSalary)}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-mono text-orange-600">
                        {formatCurrency(grandTotals.sc)}
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right font-mono">
                        {formatCurrency(grandTotals.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Generate button */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-muted-foreground">
                  {hasBlockingErrors ? (
                    <span className="text-red-600 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" />
                      Fix blocking errors before generating vouchers
                    </span>
                  ) : hasNoSelection ? (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      No project or employee selected
                    </span>
                  ) : (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Ready to generate {previewRows.length} voucher(s)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPreviewGenerated(false)
                      setPreviewRows([])
                      setValidationErrors([])
                    }}
                  >
                    Back to Selection
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGenerate}
                    disabled={hasBlockingErrors || hasNoSelection || generating || !financialYearId}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {generating ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 mr-1" />
                    )}
                    Generate Salary Vouchers
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
