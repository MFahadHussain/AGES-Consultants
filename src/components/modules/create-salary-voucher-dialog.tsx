'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  FileText, Users, Building2, Loader2, CheckCircle,
  AlertCircle, Eye, BookOpen, Printer, Send,
  ChevronDown, ChevronUp, ArrowLeft, ArrowRight, Shield, Banknote
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

// ── Interfaces ──────────────────────────────────────────────────

interface BatchLine {
  id: string
  employeeId: string
  employeeName: string
  employeeCode: string | null
  grossSalary: number
  incomeTax: number
  netPay: number
  socialCharges: number
  basicSalary: number
  allowances: number
  projectId: string | null
  lineStatus: string
  projectAllocations: string | null
  contractEarnings: string | null
  scBreakdown: string | null
  salaryExpenseAccountId?: string | null
  scExpenseAccountId?: string | null
  salaryPayableAccountId?: string | null
  scPayableAccountId?: string | null
  taxPayableAccountId?: string | null
}

interface ProjectInfo {
  id: string
  code: string
  name: string
}

interface PreviewRow {
  lineId: string
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
  employeeCount: number
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  batch: any
  financialYears: any[]
  projects: any[]
  onVouchersGenerated: (vouchers: GeneratedVoucher[]) => void
  initialSelectedLineIds?: Set<string>
  initialSelectedProjectIds?: Set<string>
}

// ── Component ───────────────────────────────────────────────────

export function CreateSalaryVoucherDialog({
  open,
  onOpenChange,
  batch,
  financialYears,
  projects,
  onVouchersGenerated,
  initialSelectedLineIds,
  initialSelectedProjectIds,
}: Props) {
  const { toast } = useToast()

  // Steps: 1=Select, 2=Preview, 3=Generate, 4=Results
  const [step, setStep] = useState(1)
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set())
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())

  // Preview
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])

  // Generation
  const [generating, setGenerating] = useState(false)
  const [generatedVouchers, setGeneratedVouchers] = useState<GeneratedVoucher[]>([])
  const [expandedVoucherId, setExpandedVoucherId] = useState<string | null>(null)

  // Posting
  const [postingVoucherId, setPostingVoucherId] = useState<string | null>(null)

  // Initialize selection from props when dialog opens
  const initializedRef = useRef<string | null>(null)
  useEffect(() => {
    if (open && initializedRef.current !== batch?.id) {
      initializedRef.current = batch?.id || null
      if (initialSelectedLineIds && initialSelectedLineIds.size > 0) {
        setSelectedLineIds(new Set(initialSelectedLineIds))
      } else {
        setSelectedLineIds(new Set())
      }
      if (initialSelectedProjectIds && initialSelectedProjectIds.size > 0) {
        setSelectedProjectIds(new Set(initialSelectedProjectIds))
      } else {
        setSelectedProjectIds(new Set())
      }
      setStep(1)
      setGeneratedVouchers([])
      setPreviewRows([])
      setValidationErrors([])
      setExpandedVoucherId(null)
    }
    if (!open) {
      initializedRef.current = null
    }
  }, [open, batch?.id, initialSelectedLineIds, initialSelectedProjectIds])

  // Get financial year
  const openFY = financialYears.find((f: any) => f.status === 'open')
  const financialYearId = openFY?.id

  // Parse batch lines
  const lines: BatchLine[] = useMemo(() => {
    if (!batch?.lines) return []
    return batch.lines.filter((l: any) => l.lineStatus === 'approved')
  }, [batch])

  // Parse project info map
  const projectMap = useMemo(() => {
    const map = new Map<string, ProjectInfo>()
    for (const p of projects) {
      map.set(p.id, { id: p.id, code: p.code || '', name: p.name || '' })
    }
    return map
  }, [projects])

  // Group lines by project
  const projectGroups = useMemo(() => {
    const groups = new Map<string, { project: ProjectInfo; lines: BatchLine[] }>()

    for (const line of lines) {
      // Parse project allocations to get all projects for this employee
      let allocations: any[] = []
      try {
        allocations = line.projectAllocations ? JSON.parse(line.projectAllocations) : []
      } catch {}
      let contracts: any[] = []
      try {
        contracts = line.contractEarnings ? JSON.parse(line.contractEarnings) : []
      } catch {}

      const projectIds = new Set<string>()
      if (allocations.length > 0) {
        for (const a of allocations) projectIds.add(a.projectId)
      } else if (contracts.length > 0) {
        for (const c of contracts) projectIds.add(c.projectId)
      } else if (line.projectId) {
        projectIds.add(line.projectId)
      } else {
        projectIds.add('__unassigned__')
      }

      for (const pid of projectIds) {
        if (!groups.has(pid)) {
          const pInfo = pid === '__unassigned__'
            ? { id: '__unassigned__', code: 'N/A', name: 'Unassigned' }
            : (projectMap.get(pid) || { id: pid, code: 'N/A', name: 'Unknown' })
          groups.set(pid, { project: pInfo, lines: [] })
        }
        groups.get(pid)!.lines.push(line)
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.project.id === '__unassigned__') return 1
      if (b.project.id === '__unassigned__') return -1
      return a.project.name.localeCompare(b.project.name)
    })
  }, [lines, projectMap])

  // Effective lines based on selection
  const effectiveLines = useMemo(() => {
    if (selectedLineIds.size === 0 && selectedProjectIds.size === 0) return lines
    return lines.filter((l) => {
      const lineMatch = selectedLineIds.size === 0 || selectedLineIds.has(l.id)
      const projectMatch = selectedProjectIds.size === 0 || selectedProjectIds.has(l.projectId || '__unassigned__')
      return lineMatch && projectMatch
    })
  }, [lines, selectedLineIds, selectedProjectIds])

  // Totals for effective lines
  const effectiveTotals = useMemo(() => {
    return effectiveLines.reduce(
      (acc, l) => ({
        grossSalary: acc.grossSalary + l.grossSalary,
        incomeTax: acc.incomeTax + l.incomeTax,
        netPay: acc.netPay + l.netPay,
        socialCharges: acc.socialCharges + l.socialCharges,
        employeeCount: acc.employeeCount + 1,
      }),
      { grossSalary: 0, incomeTax: 0, netPay: 0, socialCharges: 0, employeeCount: 0 }
    )
  }, [effectiveLines])

  // ── Toggle helpers ───────────────────────────────────────────
  const toggleLine = (id: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllLines = () => {
    if (selectedLineIds.size === lines.length) {
      setSelectedLineIds(new Set())
    } else {
      setSelectedLineIds(new Set(lines.map((l) => l.id)))
    }
  }

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const toggleAllProjects = () => {
    if (selectedProjectIds.size === projectGroups.length) {
      setSelectedProjectIds(new Set())
    } else {
      setSelectedProjectIds(new Set(projectGroups.map((g) => g.project.id)))
    }
  }

  // Select all lines for a project group
  const selectProjectLines = (projectId: string) => {
    const group = projectGroups.find(g => g.project.id === projectId)
    if (!group) return
    setSelectedLineIds(prev => {
      const next = new Set(prev)
      const allSelected = group.lines.every(l => next.has(l.id))
      for (const l of group.lines) {
        if (allSelected) next.delete(l.id)
        else next.add(l.id)
      }
      return next
    })
  }

  // ── Calculate Preview (Step 2) ──────────────────────────────
  const handleCalculatePreview = useCallback(() => {
    if (effectiveLines.length === 0) {
      toast({ title: 'No Selection', description: 'Please select at least one employee line', variant: 'destructive' })
      return
    }

    setPreviewLoading(true)
    setValidationErrors([])

    // Build preview rows from batch line data
    const rows: PreviewRow[] = []
    const errors: ValidationError[] = []

    for (const line of effectiveLines) {
      // Parse allocations
      let allocations: any[] = []
      try { allocations = line.projectAllocations ? JSON.parse(line.projectAllocations) : [] } catch {}
      let contracts: any[] = []
      try { contracts = line.contractEarnings ? JSON.parse(line.contractEarnings) : [] } catch {}

      const hasNoAccounts = !line.salaryExpenseAccountId
      const hasNoTaxAccount = !line.taxPayableAccountId && line.incomeTax > 0

      if (allocations.length > 0) {
        // Multiple project allocations
        let totalWeight = 0
        for (const a of allocations) totalWeight += a.weight || 0
        const weightWarning = Math.abs(totalWeight - 1) > 0.02

        for (const alloc of allocations) {
          // Filter by selected projects
          if (selectedProjectIds.size > 0 && !selectedProjectIds.has(alloc.projectId)) continue

          const pInfo = projectMap.get(alloc.projectId) || { code: 'N/A', name: 'Unknown' }
          const grossSalary = Math.round(alloc.salaryShare || 0)
          const tax = Math.round(line.incomeTax * (alloc.weight || 0))
          const netSalary = grossSalary - tax
          const sc = Math.round(alloc.scShare || 0)
          const total = netSalary + sc
          const taxExceeds = tax > grossSalary
          const negNet = netSalary < 0

          rows.push({
            lineId: line.id,
            employeeId: line.employeeId,
            employeeName: line.employeeName,
            employeeCode: line.employeeCode || '',
            projectId: alloc.projectId,
            projectCode: pInfo.code,
            projectName: pInfo.name,
            weightPct: alloc.weightPct || `${Math.round((alloc.weight || 0) * 100)}%`,
            grossSalary,
            tax,
            netSalary,
            sc,
            total,
            hasAccountError: hasNoAccounts || hasNoTaxAccount || taxExceeds || negNet,
            accountErrorMessage: hasNoAccounts ? 'No CoA configured' : hasNoTaxAccount ? 'Tax Payable not mapped' : '',
            weightWarning,
            taxExceedsGross: taxExceeds,
            negativeNet: negNet,
          })

          if (hasNoAccounts) {
            errors.push({ employeeId: line.employeeId, employeeName: line.employeeName, field: 'accounts', message: 'No Chart of Accounts configured — vouchers will use system defaults', severity: 'warning' })
          }
          if (taxExceeds) {
            errors.push({ employeeId: line.employeeId, employeeName: line.employeeName, field: 'tax', message: `Tax (${tax}) exceeds gross salary (${grossSalary}) for ${pInfo.code}`, severity: 'error' })
          }
          if (negNet) {
            errors.push({ employeeId: line.employeeId, employeeName: line.employeeName, field: 'netSalary', message: `Net salary is negative for ${pInfo.code}`, severity: 'error' })
          }
        }
      } else if (contracts.length > 0) {
        for (const ce of contracts) {
          if (selectedProjectIds.size > 0 && !selectedProjectIds.has(ce.projectId)) continue

          const grossSalary = Math.round(ce.earnedSalary || 0)
          const weight = line.basicSalary > 0 ? ce.earnedSalary / line.basicSalary : 0
          const tax = Math.round(line.incomeTax * weight)
          const netSalary = grossSalary - tax
          const sc = Math.round(ce.scShare || 0)
          const total = netSalary + sc
          const taxExceeds = tax > grossSalary
          const negNet = netSalary < 0

          rows.push({
            lineId: line.id,
            employeeId: line.employeeId,
            employeeName: line.employeeName,
            employeeCode: line.employeeCode || '',
            projectId: ce.projectId,
            projectCode: ce.projectCode,
            projectName: ce.projectName,
            weightPct: `${Math.round(weight * 100)}%`,
            grossSalary,
            tax,
            netSalary,
            sc,
            total,
            hasAccountError: hasNoAccounts || hasNoTaxAccount || taxExceeds || negNet,
            accountErrorMessage: hasNoAccounts ? 'No CoA configured' : hasNoTaxAccount ? 'Tax Payable not mapped' : '',
            weightWarning: false,
            taxExceedsGross: taxExceeds,
            negativeNet: negNet,
          })

          if (hasNoAccounts) {
            errors.push({ employeeId: line.employeeId, employeeName: line.employeeName, field: 'accounts', message: 'No Chart of Accounts configured — vouchers will use system defaults', severity: 'warning' })
          }
        }
      } else {
        // Single project fallback
        const pid = line.projectId || '__unassigned__'
        if (selectedProjectIds.size > 0 && !selectedProjectIds.has(pid)) continue

        const pInfo = pid === '__unassigned__'
          ? { code: 'N/A', name: 'Unassigned' }
          : (projectMap.get(pid) || { code: 'N/A', name: 'Unknown' })
        const grossSalary = Math.round(line.grossSalary)
        const tax = Math.round(line.incomeTax)
        const netSalary = Math.round(line.netPay)
        const sc = Math.round(line.socialCharges)
        const total = netSalary + sc
        const taxExceeds = tax > grossSalary
        const negNet = netSalary < 0

        rows.push({
          lineId: line.id,
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode || '',
          projectId: pid,
          projectCode: pInfo.code,
          projectName: pInfo.name,
          weightPct: '100%',
          grossSalary,
          tax,
          netSalary,
          sc,
          total,
          hasAccountError: hasNoAccounts || hasNoTaxAccount || taxExceeds || negNet,
          accountErrorMessage: hasNoAccounts ? 'No CoA configured' : hasNoTaxAccount ? 'Tax Payable not mapped' : '',
          weightWarning: false,
          taxExceedsGross: taxExceeds,
          negativeNet: negNet,
        })

        if (hasNoAccounts) {
          errors.push({ employeeId: line.employeeId, employeeName: line.employeeName, field: 'accounts', message: 'No Chart of Accounts configured — vouchers will use system defaults', severity: 'warning' })
        }
        if (taxExceeds) {
          errors.push({ employeeId: line.employeeId, employeeName: line.employeeName, field: 'tax', message: `Tax (${tax}) exceeds gross salary (${grossSalary})`, severity: 'error' })
        }
        if (negNet) {
          errors.push({ employeeId: line.employeeId, employeeName: line.employeeName, field: 'netSalary', message: 'Net salary is negative', severity: 'error' })
        }
      }
    }

    // Deduplicate errors
    const seen = new Set<string>()
    const uniqueErrors = errors.filter((e) => {
      const key = `${e.employeeId}|${e.field}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    setPreviewRows(rows)
    setValidationErrors(uniqueErrors)
    setPreviewLoading(false)
    setStep(2)
  }, [effectiveLines, selectedProjectIds, projectMap, toast])

  // ── Generate Vouchers (Step 3) ──────────────────────────────
  const handleGenerate = async () => {
    if (!financialYearId) {
      toast({ title: 'Error', description: 'No open financial year found', variant: 'destructive' })
      return
    }
    if (effectiveLines.length === 0) {
      toast({ title: 'Error', description: 'No approved lines selected', variant: 'destructive' })
      return
    }

    setGenerating(true)
    try {
      const body: any = {
        batchId: batch.id,
        mode: 'project-wise',
        period: batch.period,
        financialYearId,
        lineIds: effectiveLines.map((l) => l.id),
      }
      if (selectedProjectIds.size > 0) {
        body.projectIds = Array.from(selectedProjectIds)
      }

      const res = await fetch('/api/payroll/generate-gl-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to generate vouchers')

      const vouchers = result.vouchers || []
      setGeneratedVouchers(vouchers)
      setStep(4)

      // Combine any API validation errors
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

      onVouchersGenerated(vouchers)

      // Mark batch as voucher-created
      if (batch?.id && vouchers.length > 0) {
        try {
          await fetch('/api/payroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark-voucher-created', batchId: batch.id }),
          })
        } catch {
          // non-critical — batch status update failure doesn't block voucher creation
        }
      }

      toast({
        title: `${vouchers.length} Voucher(s) Created`,
        description: `Salary vouchers generated successfully. Go to Voucher Management to submit and post to GL.`,
      })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  // ── Post single voucher to GL ───────────────────────────────
  const handlePostVoucher = async (voucherId: string) => {
    setPostingVoucherId(voucherId)
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
      onVouchersGenerated(
        generatedVouchers.map((v) => (v.voucherId === voucherId ? { ...v, status: 'posted' } : v))
      )
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setPostingVoucherId(null)
    }
  }

  // ── Post all draft vouchers ─────────────────────────────────
  const handlePostAll = async () => {
    let postedCount = 0
    const draftVouchers = generatedVouchers.filter((v) => v.status === 'draft')
    for (const v of draftVouchers) {
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
      onVouchersGenerated(
        generatedVouchers.map((v) =>
          v.status === 'draft' ? { ...v, status: 'posted' } : v
        )
      )
    }
  }

  // ── Print voucher ──────────────────────────────────────────
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
        <h1>AGES Consultants ERP — Salary Voucher</h1>
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

  // ── Reset state when dialog closes ──────────────────────────
  const handleClose = () => {
    onOpenChange(false)
    // Don't reset step/results if we have generated vouchers - they should persist
  }

  const handleReset = () => {
    setStep(1)
    setSelectedLineIds(new Set())
    setSelectedProjectIds(new Set())
    setPreviewRows([])
    setValidationErrors([])
    setGeneratedVouchers([])
    setExpandedVoucherId(null)
  }

  // ── Blocking errors check ──────────────────────────────────
  const hasBlockingErrors = validationErrors.some(
    (e) => e.severity === 'error' && e.field !== 'projectAllocations'
  )

  // ── Preview grouped by project ─────────────────────────────
  const groupedPreview = useMemo(() => {
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

  // Grand totals for preview
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
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-600" />
            Create Salary Voucher
            <Badge variant="outline" className="text-[9px] ml-2">{batch?.period}</Badge>
            <Badge className="text-[9px] bg-[#EEF1F8] text-[#0F2D78] border border-[#A5B4D2]">
              {lines.length} Approved Line(s)
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Generate project-wise salary vouchers from approved payroll lines
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {[
            { num: 1, label: 'Select', icon: Users },
            { num: 2, label: 'Preview', icon: Eye },
            { num: 3, label: 'Generate', icon: FileText },
            { num: 4, label: 'Results', icon: CheckCircle },
          ].map((s, idx) => {
            const StepIcon = s.icon
            const isActive = step >= s.num
            const isCurrent = step === s.num
            return (
              <div key={s.num} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium border transition-all ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : isActive
                    ? 'bg-[#EEF1F8] text-[#0F2D78] border-emerald-300'
                    : 'bg-muted text-muted-foreground border-muted'
                }`}>
                  <span className="font-bold">{s.num}.</span>
                  <StepIcon className="h-3 w-3" />
                  <span>{s.label}</span>
                </div>
                {idx < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-0.5" />}
              </div>
            )
          })}
        </div>

        {/* ── STEP 1: Select Employees/Projects ───────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Batch info summary */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Batch:</span><strong>{batch?.name || batch?.batchNumber}</strong></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Period:</span><strong>{batch?.period}</strong></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Approved Lines:</span><strong>{lines.length}</strong></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Net Pay Total:</span><strong className="text-[#0F2D78]">{formatCurrency(lines.reduce((s, l) => s + l.netPay, 0))}</strong></div>
            </div>

            {/* Project Groups */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">Select by Project</p>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={toggleAllProjects}>
                  {selectedProjectIds.size === projectGroups.length ? 'Deselect All' : 'Select All Projects'}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {projectGroups.map((group) => {
                  const isSelected = selectedProjectIds.has(group.project.id)
                  const lineCount = group.lines.length
                  const totalNet = group.lines.reduce((s, l) => s + l.netPay, 0)
                  return (
                    <Card
                      key={group.project.id}
                      className={`cursor-pointer transition-all border-l-4 ${isSelected ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-slate-300'}`}
                      onClick={() => toggleProject(group.project.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Checkbox checked={isSelected} className="h-4 w-4" />
                          <Badge className="text-[10px] bg-slate-100 text-slate-800 border border-slate-300 font-mono">
                            {group.project.code}
                          </Badge>
                          <span className="text-xs font-medium truncate">{group.project.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{lineCount} employee(s)</span>
                          <span>Net: {formatCurrency(totalNet)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* Employee Lines Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">Select Employees</p>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={toggleAllLines}>
                  {selectedLineIds.size === lines.length ? 'Deselect All' : 'Select All Employees'}
                </Button>
              </div>
              <div className="rounded border overflow-x-auto max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] h-8 w-10">
                        <Checkbox
                          checked={lines.length > 0 && lines.every((l) => selectedLineIds.has(l.id))}
                          onCheckedChange={toggleAllLines}
                          className="h-4 w-4"
                        />
                      </TableHead>
                      <TableHead className="text-[10px] h-8">Employee</TableHead>
                      <TableHead className="text-[10px] h-8">Project</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Gross</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Tax</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Net Pay</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">SC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => {
                      const isSelected = selectedLineIds.has(line.id)
                      const pInfo = line.projectId ? projectMap.get(line.projectId) : null
                      return (
                        <TableRow
                          key={line.id}
                          className={`cursor-pointer ${isSelected ? 'bg-emerald-50/30' : ''}`}
                          onClick={() => toggleLine(line.id)}
                        >
                          <TableCell className="py-1.5">
                            <Checkbox checked={isSelected} className="h-4 w-4" />
                          </TableCell>
                          <TableCell className="text-xs py-1.5 font-medium">
                            <div>{line.employeeName}</div>
                            <div className="text-[9px] text-muted-foreground">{line.employeeCode}</div>
                          </TableCell>
                          <TableCell className="text-xs py-1.5">
                            <Badge variant="outline" className="text-[8px] h-5 px-1 font-mono">
                              {pInfo?.code || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono">{formatCurrency(line.grossSalary)}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono">{formatCurrency(line.incomeTax)}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono text-[#0A1F54]">{formatCurrency(line.netPay)}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-mono text-orange-700">{formatCurrency(line.socialCharges)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Selection summary */}
            <div className="p-3 rounded-lg bg-emerald-50 border border-[#A5B4D2]">
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <strong>{selectedLineIds.size > 0 ? selectedLineIds.size : effectiveLines.length}</strong> employee(s) selected
                  {selectedProjectIds.size > 0 && <span> · <strong>{selectedProjectIds.size}</strong> project(s) filtered</span>}
                </div>
                <div className="text-xs font-bold text-[#0A1F54]">
                  Net Pay: {formatCurrency(effectiveTotals.netPay)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Preview ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="space-y-2">
                {validationErrors.map((err, idx) => (
                  <div key={idx} className={`flex items-start gap-2 p-2 rounded text-xs ${
                    err.severity === 'error' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-amber-50 border border-amber-200 text-amber-800'
                  }`}>
                    {err.severity === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    <div>
                      <strong>{err.employeeName}:</strong> {err.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Grand totals */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Gross Salary', value: grandTotals.grossSalary, color: '' },
                { label: 'Tax', value: grandTotals.tax, color: 'text-red-700' },
                { label: 'Net Salary', value: grandTotals.netSalary, color: 'text-[#0A1F54]' },
                { label: 'Social Charges', value: grandTotals.sc, color: 'text-orange-700' },
                { label: 'Total (Net + SC)', value: grandTotals.total, color: 'text-[#0F2D78]' },
              ].map(item => (
                <div key={item.label} className="text-center p-2 rounded bg-muted/50 border">
                  <p className="text-[9px] text-muted-foreground">{item.label}</p>
                  <p className={`text-xs font-bold ${item.color}`}>{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>

            {/* Preview by project */}
            <div className="space-y-3">
              {groupedPreview.map(([projectCode, group]) => (
                <Card key={projectCode} className="border-l-4 border-l-violet-400">
                  <CardHeader className="pb-2 p-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-violet-600" />
                      <Badge variant="outline" className="text-[9px] font-mono">{projectCode}</Badge>
                      <CardTitle className="text-xs font-bold">{group.project.name}</CardTitle>
                      <Badge className="text-[9px] bg-slate-100 text-slate-700">{group.rows.length} employee(s)</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="rounded border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[9px] h-7">Employee</TableHead>
                            <TableHead className="text-[9px] h-7 text-center">Weight</TableHead>
                            <TableHead className="text-[9px] h-7 text-right">Gross</TableHead>
                            <TableHead className="text-[9px] h-7 text-right">Tax</TableHead>
                            <TableHead className="text-[9px] h-7 text-right">Net</TableHead>
                            <TableHead className="text-[9px] h-7 text-right">SC</TableHead>
                            <TableHead className="text-[9px] h-7 text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.rows.map((row, idx) => (
                            <TableRow key={idx} className={row.hasAccountError ? 'bg-red-50/30' : ''}>
                              <TableCell className="text-[10px] py-1 font-medium">
                                {row.employeeName}
                                <span className="text-muted-foreground ml-1 text-[8px]">({row.employeeCode})</span>
                              </TableCell>
                              <TableCell className="text-[10px] py-1 text-center">{row.weightPct}</TableCell>
                              <TableCell className="text-[10px] py-1 text-right font-mono">{formatCurrency(row.grossSalary)}</TableCell>
                              <TableCell className="text-[10px] py-1 text-right font-mono">{formatCurrency(row.tax)}</TableCell>
                              <TableCell className="text-[10px] py-1 text-right font-mono text-[#0A1F54]">{formatCurrency(row.netSalary)}</TableCell>
                              <TableCell className="text-[10px] py-1 text-right font-mono text-orange-700">{formatCurrency(row.sc)}</TableCell>
                              <TableCell className="text-[10px] py-1 text-center">
                                {row.hasAccountError ? (
                                  <Badge className="text-[8px] bg-red-100 text-red-800 border border-red-200">Error</Badge>
                                ) : row.weightWarning ? (
                                  <Badge className="text-[8px] bg-amber-100 text-amber-800 border border-amber-200">Warn</Badge>
                                ) : (
                                  <Badge className="text-[8px] bg-[#EEF1F8] text-[#0F2D78] border border-[#A5B4D2]">OK</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-slate-50 font-bold">
                            <TableCell className="text-[10px] py-1.5" colSpan={2}>Project Total</TableCell>
                            <TableCell className="text-[10px] py-1.5 text-right font-mono">{formatCurrency(group.rows.reduce((s, r) => s + r.grossSalary, 0))}</TableCell>
                            <TableCell className="text-[10px] py-1.5 text-right font-mono">{formatCurrency(group.rows.reduce((s, r) => s + r.tax, 0))}</TableCell>
                            <TableCell className="text-[10px] py-1.5 text-right font-mono">{formatCurrency(group.rows.reduce((s, r) => s + r.netSalary, 0))}</TableCell>
                            <TableCell className="text-[10px] py-1.5 text-right font-mono">{formatCurrency(group.rows.reduce((s, r) => s + r.sc, 0))}</TableCell>
                            <TableCell className="text-[10px] py-1.5"></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 5-line voucher structure explanation */}
            <div className="p-3 rounded-lg bg-violet-50 border border-violet-200">
              <p className="text-[10px] font-semibold text-violet-900 mb-1">5-Line Voucher Structure (per employee per project):</p>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-1 text-[9px]">
                <div className="p-1.5 rounded bg-red-50 text-red-800 text-center"><strong>DR</strong> Salary Expense</div>
                <div className="p-1.5 rounded bg-red-50 text-red-800 text-center"><strong>DR</strong> SC Expense</div>
                <div className="p-1.5 rounded bg-[#EEF1F8] text-[#0F2D78] text-center"><strong>CR</strong> Salary Payable</div>
                <div className="p-1.5 rounded bg-[#EEF1F8] text-[#0F2D78] text-center"><strong>CR</strong> Tax Payable</div>
                <div className="p-1.5 rounded bg-[#EEF1F8] text-[#0F2D78] text-center"><strong>CR</strong> SC Payable</div>
              </div>
              <p className="text-[9px] text-violet-700 mt-1">Voucher Number: SV-{batch?.period}-[ProjectCode]-[Seq]</p>
            </div>
          </div>
        )}

        {/* ── STEP 3: Generate (confirmation) ──────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-violet-50 border border-violet-200 text-center">
              <FileText className="h-8 w-8 text-violet-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-violet-900">
                Ready to Generate {previewRows.length} Voucher(s)
              </h3>
              <p className="text-xs text-violet-700 mt-1">
                Period: {batch?.period} · {effectiveLines.length} employee(s) · {groupedPreview.length} project(s)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded bg-muted/50 space-y-1">
                <p className="text-[10px] font-semibold">Vouchers to Create</p>
                {groupedPreview.map(([code, group]) => (
                  <div key={code} className="flex justify-between text-xs">
                    <span>{code} — {group.project.name}</span>
                    <span>{group.rows.length} emp(s)</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded bg-muted/50 space-y-1">
                <p className="text-[10px] font-semibold">Financial Summary</p>
                <div className="flex justify-between text-xs"><span>Gross:</span><span>{formatCurrency(grandTotals.grossSalary)}</span></div>
                <div className="flex justify-between text-xs"><span>Tax:</span><span>{formatCurrency(grandTotals.tax)}</span></div>
                <div className="flex justify-between text-xs"><span>Net:</span><span className="text-[#0A1F54]">{formatCurrency(grandTotals.netSalary)}</span></div>
                <div className="flex justify-between text-xs"><span>SC:</span><span className="text-orange-700">{formatCurrency(grandTotals.sc)}</span></div>
                <Separator />
                <div className="flex justify-between text-xs font-bold"><span>Total DR/CR:</span><span>{formatCurrency(grandTotals.total)}</span></div>
              </div>
            </div>

            {hasBlockingErrors && (
              <div className="flex items-start gap-2 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <div>
                  <strong>Blocking errors detected.</strong> Some employees have issues that prevent voucher creation. Go back to fix or deselect them.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4: Results ──────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Success banner */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-[#A5B4D2]">
              <CheckCircle className="h-6 w-6 text-[#0F2D78]" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900">
                  {generatedVouchers.length} Salary Voucher{generatedVouchers.length !== 1 ? 's' : ''} Created
                </h3>
                <p className="text-xs text-emerald-700">
                  Period: {batch?.period} · {generatedVouchers.filter(v => v.status === 'draft').length} draft, {generatedVouchers.filter(v => v.status === 'posted').length} posted
                </p>
              </div>
            </div>

            {/* Bulk actions */}
            <div className="flex items-center gap-2">
              {generatedVouchers.filter(v => v.status === 'draft').length > 0 && (
                <Button size="sm" onClick={handlePostAll} className="bg-[#0F2D78] hover:bg-emerald-700 h-7 text-[10px]">
                  <Send className="h-3 w-3 mr-1" /> Post All to GL ({generatedVouchers.filter(v => v.status === 'draft').length})
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => {
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
              }}>
                <Printer className="h-3 w-3 mr-1" /> Print All
              </Button>
            </div>

            {/* Voucher list */}
            <div className="rounded border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] h-8">Voucher No</TableHead>
                    <TableHead className="text-[10px] h-8">Employee</TableHead>
                    <TableHead className="text-[10px] h-8">Project</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Debit</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Credit</TableHead>
                    <TableHead className="text-[10px] h-8 text-center">Balanced</TableHead>
                    <TableHead className="text-[10px] h-8">Status</TableHead>
                    <TableHead className="text-[10px] h-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedVouchers.map((v) => (
                    <>
                      <TableRow key={v.voucherId} className={v.status === 'posted' ? 'bg-emerald-50/30' : ''}>
                        <TableCell className="text-xs py-1.5 font-mono font-medium">{v.voucherNumber}</TableCell>
                        <TableCell className="text-xs py-1.5">
                          <div>{v.employeeName}</div>
                          <div className="text-[9px] text-muted-foreground">{v.employeeCode}</div>
                        </TableCell>
                        <TableCell className="text-xs py-1.5">
                          <Badge variant="outline" className="text-[9px] h-5 px-1 font-mono">{v.projectCode}</Badge>
                        </TableCell>
                        <TableCell className="text-xs py-1.5 text-right font-mono">{formatCurrency(v.totalDebit)}</TableCell>
                        <TableCell className="text-xs py-1.5 text-right font-mono">{formatCurrency(v.totalCredit)}</TableCell>
                        <TableCell className="text-xs py-1.5 text-center">
                          {v.balanced ? (
                            <Badge className="text-[8px] bg-[#EEF1F8] text-[#0F2D78] border border-[#A5B4D2]"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Bal</Badge>
                          ) : (
                            <Badge className="text-[8px] bg-red-100 text-red-800 border border-red-200"><AlertCircle className="h-2.5 w-2.5 mr-0.5" />Imbal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs py-1.5">
                          <Badge className={`text-[9px] border ${v.status === 'draft' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-[#EEF1F8] text-[#0F2D78] border-[#A5B4D2]'}`}>
                            {v.status === 'draft' ? 'DRAFT' : 'POSTED'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-1.5">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-5 px-1 text-[9px]"
                              onClick={() => setExpandedVoucherId(expandedVoucherId === v.voucherId ? null : v.voucherId)}>
                              <Eye className="h-3 w-3 mr-0.5" />
                              {expandedVoucherId === v.voucherId ? 'Hide' : 'View'}
                            </Button>
                            {v.status === 'draft' && (
                              <Button variant="ghost" size="sm" className="h-5 px-1 text-[9px] text-emerald-700"
                                onClick={() => handlePostVoucher(v.voucherId)}
                                disabled={postingVoucherId === v.voucherId}>
                                {postingVoucherId === v.voucherId ? <Loader2 className="h-3 w-3 mr-0.5 animate-spin" /> : <BookOpen className="h-3 w-3 mr-0.5" />}
                                Post
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-5 px-1 text-[9px]"
                              onClick={() => handlePrint(v)}>
                              <Printer className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded voucher detail */}
                      {expandedVoucherId === v.voucherId && (
                        <TableRow key={`${v.voucherId}-detail`}>
                          <TableCell colSpan={8} className="p-3 bg-muted/30">
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
                                    <TableRow key={idx} className={entry.debit > 0 ? 'bg-red-50/20' : 'bg-[#EEF1F8]/20'}>
                                      <TableCell className="text-[10px] py-1 font-mono">{entry.lineNumber}</TableCell>
                                      <TableCell className="text-[10px] py-1 font-mono">{entry.accountCode}</TableCell>
                                      <TableCell className="text-[10px] py-1 font-medium">{entry.accountName}</TableCell>
                                      <TableCell className="text-[10px] py-1 text-right font-mono">{entry.debit > 0 ? formatCurrency(entry.debit) : ''}</TableCell>
                                      <TableCell className="text-[10px] py-1 text-right font-mono">{entry.credit > 0 ? formatCurrency(entry.credit) : ''}</TableCell>
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
                            {/* Breakdown badges */}
                            <div className="mt-2 flex items-center gap-3 flex-wrap">
                              <Badge className="text-[9px] bg-blue-50 text-blue-800 border border-blue-200">Gross: {formatCurrency(v.breakdown.grossSalary)}</Badge>
                              <Badge className="text-[9px] bg-red-50 text-red-800 border border-red-200">Tax: {formatCurrency(v.breakdown.tax)}</Badge>
                              <Badge className="text-[9px] bg-[#EEF1F8] text-[#0F2D78] border border-[#A5B4D2]">Net: {formatCurrency(v.breakdown.netSalary)}</Badge>
                              <Badge className="text-[9px] bg-orange-50 text-orange-800 border border-orange-200">SC: {formatCurrency(v.breakdown.sc)}</Badge>
                              <Badge className="text-[9px] bg-muted text-muted-foreground border">Weight: {v.breakdown.weightPct}</Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-slate-100 font-bold border-t-2">
                    <TableCell className="text-[10px] py-2">TOTAL</TableCell>
                    <TableCell className="text-[10px] py-2">{generatedVouchers.length} voucher(s)</TableCell>
                    <TableCell className="text-[10px] py-2"></TableCell>
                    <TableCell className="text-[10px] py-2 text-right font-mono">{formatCurrency(generatedVouchers.reduce((s, v) => s + v.totalDebit, 0))}</TableCell>
                    <TableCell className="text-[10px] py-2 text-right font-mono">{formatCurrency(generatedVouchers.reduce((s, v) => s + v.totalCredit, 0))}</TableCell>
                    <TableCell className="text-[10px] py-2 text-center">
                      <Badge className={`text-[8px] border ${generatedVouchers.every(v => v.balanced) ? 'bg-[#EEF1F8] text-emerald-700 border-[#A5B4D2]' : 'bg-red-100 text-red-700 border-red-200'}`}>
                        {generatedVouchers.every(v => v.balanced) ? '✓ All Balanced' : '✗ Unbalanced'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] py-2">
                      <Badge className="text-[8px] bg-[#EEF1F8] text-emerald-700 border border-[#A5B4D2]">
                        {generatedVouchers.filter(v => v.status === 'posted').length}/{generatedVouchers.length} Posted
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] py-2"></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Remaining validation warnings */}
            {validationErrors.length > 0 && (
              <div className="space-y-1">
                {validationErrors.filter(e => e.severity === 'warning').map((err, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-1.5 rounded text-[10px] bg-amber-50 border border-amber-200 text-amber-800">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span><strong>{err.employeeName}:</strong> {err.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Footer Actions ──────────────────────────────────── */}
        <DialogFooter className="flex items-center gap-2">
          {step > 1 && step < 4 && (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
          )}
          {step === 1 && (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCalculatePreview} disabled={effectiveLines.length === 0 || previewLoading}>
                {previewLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                Preview Vouchers
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={() => setStep(3)} disabled={hasBlockingErrors || previewRows.length === 0}>
                <FileText className="h-3.5 w-3.5 mr-1" />
                Confirm & Generate
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={handleGenerate} disabled={generating || hasBlockingErrors}>
                {generating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
                Generate Vouchers ({previewRows.length})
              </Button>
            </>
          )}
          {step === 4 && (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Create More
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
