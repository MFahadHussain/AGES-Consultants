// ============================================================================
// Payroll Reports API — AcctFin ERP v1.0.0
// ============================================================================
// 14 Report Types:
//   1.  payroll-summary    — Monthly Payroll Summary
//   2.  project-cost       — Project-wise Cost Report
//   3.  employee-earnings  — Employee-wise Earnings (range)
//   4.  tax-deduction      — Tax Deduction Report (YTD)
//   5.  employer-cost      — Employer Cost Report
//   6.  payroll-audit      — Payroll Audit (fraud/duplication detection)
//   7.  ytd-earnings       — Year-to-Date Earnings
//   8.  employee-ledger    — Employee Ledger
//   9.  attendance-impact  — Attendance Impact Report
//   10. project-utilization — Project Resource Utilization
//   11. tax-reconciliation — Tax Reconciliation
//   12. social-contributions — Social Contributions
//   13. exception-warnings — Exception/Warning Report
//   14. tax-psid           — FBR Tax PSID Report (Pakistan FBR format)
// ============================================================================

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// ── Helpers ────────────────────────────────────────────────────────────────

function roundPKR(n: number): number {
  return Math.round(n)
}

/** Parse a "YYYY-MM" string into a UTC Date at the 1st of the month */
function parseMonth(monthStr: string): Date {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
}

/** Get the number of calendar days in a month */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Get Pakistan fiscal year boundaries.
 * FY 2024-25 = Jul 2024 → Jun 2025.
 */
function getFiscalYearDates(fyLabel: string): { fyStart: Date; fyEnd: Date } {
  const [startYear] = fyLabel.split('-').map(Number)
  const fyStart = new Date(Date.UTC(startYear, 6, 1))  // July 1
  const fyEnd = new Date(Date.UTC(startYear + 1, 5, 30, 23, 59, 59, 999)) // June 30
  return { fyStart, fyEnd }
}

/** Determine fiscal year label from a date */
function getFyLabelFromDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const fyStartYear = month >= 7 ? year : year - 1
  return `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`
}

/** Generate all month strings between two months inclusive (YYYY-MM) */
function getMonthsBetween(fromMonth: string, toMonth: string): string[] {
  const months: string[] = []
  const [fy, fm] = fromMonth.split('-').map(Number)
  const [ty, tm] = toMonth.split('-').map(Number)
  let y = fy, m = fm
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

/** Generate all months in a fiscal year */
function getFyMonths(fyLabel: string): string[] {
  const [startYear] = fyLabel.split('-').map(Number)
  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    const y = i >= 6 ? startYear : startYear + 1  // Jul=0 → Jun=11
    const m = i >= 6 ? (i - 6 + 7) : (i + 1)     // Jul=7, Aug=8, ..., Jun=6
    const actualYear = i >= 6 ? startYear : startYear + 1
    const actualMonth = i >= 6 ? (i - 6 + 7) : (i + 1)
    months.push(`${actualYear}-${String(actualMonth).padStart(2, '0')}`)
  }
  return months
}

// ── FBR Tax Slabs 2024-25 (Salaried Persons) ──────────────────────────────

interface TaxSlabEntry {
  min: number
  max: number | null
  fixedTax: number
  rate: number
}

const FBR_TAX_SLABS_2024_25: TaxSlabEntry[] = [
  { min: 0,      max: 600000,   fixedTax: 0,      rate: 0   },
  { min: 600001, max: 1200000,  fixedTax: 0,      rate: 5   },
  { min: 1200001, max: 2200000, fixedTax: 60000,  rate: 15  },
  { min: 2200001, max: 3200000, fixedTax: 210000, rate: 25  },
  { min: 3200001, max: 4100000, fixedTax: 460000, rate: 30  },
  { min: 4100001, max: null,    fixedTax: 730000, rate: 35  },
]

function calculateFbrTax(annualIncome: number): { annualTax: number; slab: TaxSlabEntry; variableTax: number } {
  let applicableSlab = FBR_TAX_SLABS_2024_25[0]
  for (const slab of FBR_TAX_SLABS_2024_25) {
    if (annualIncome >= slab.min && (slab.max === null || annualIncome <= slab.max)) {
      applicableSlab = slab
      break
    }
  }
  const excessAmount = annualIncome - applicableSlab.min
  const variableTax = (excessAmount * applicableSlab.rate) / 100
  const annualTax = applicableSlab.fixedTax + variableTax
  return { annualTax, slab: applicableSlab, variableTax }
}

function formatTaxSlab(slab: TaxSlabEntry): string {
  const min = `PKR ${slab.min.toLocaleString()}`
  const max = slab.max ? `PKR ${slab.max.toLocaleString()}` : 'Above'
  return `${min} - ${max}`
}

// ── Safe JSON parser ───────────────────────────────────────────────────────

function safeParseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

// ============================================================================
// REPORT FUNCTIONS
// ============================================================================

// 1. payroll-summary — Monthly Payroll Summary Report
async function payrollSummary(searchParams: URLSearchParams) {
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month parameter required (YYYY-MM)' }, { status: 400 })

  const batches = await db.payrollBatch.findMany({
    where: { period: month },
    include: {
      lines: {
        include: { employee: { select: { id: true, name: true, employeeCode: true, department: true } } },
        orderBy: { employeeName: 'asc' },
      },
    },
  })

  if (batches.length === 0) {
    return NextResponse.json({ month, batches: [], summary: null, lines: [] })
  }

  // Aggregate across all batches for the month
  const summary = {
    month,
    totalBatches: batches.length,
    totalBasicSalary: 0,
    totalAllowances: 0,
    totalGross: 0,
    totalIncomeTax: 0,
    totalEobiEmployee: 0,
    totalEobiEmployer: 0,
    totalEssiEmployee: 0,
    totalEssiEmployer: 0,
    totalPfEmployee: 0,
    totalPfEmployer: 0,
    totalLoanDeduction: 0,
    totalAdvanceDeduction: 0,
    totalOtherDeductions: 0,
    totalDeductions: 0,
    totalNetPay: 0,
    totalEmployerCharges: 0,
    totalSocialCharges: 0,
    totalGratuity: 0,
    employeeCount: 0,
  }

  const lines: Record<string, unknown>[] = []

  for (const batch of batches) {
    summary.totalBasicSalary += batch.totalBasicSalary
    summary.totalAllowances += batch.totalAllowances
    summary.totalGross += batch.totalGross
    summary.totalIncomeTax += batch.totalIncomeTax
    summary.totalEobiEmployee += batch.totalEobiEmployee
    summary.totalEobiEmployer += batch.totalEobiEmployer
    summary.totalEssiEmployee += batch.totalEssiEmployee
    summary.totalEssiEmployer += batch.totalEssiEmployer
    summary.totalPfEmployee += batch.totalPfEmployee
    summary.totalPfEmployer += batch.totalPfEmployer
    summary.totalLoanDeduction += batch.totalLoanDeduction
    summary.totalAdvanceDeduction += batch.totalAdvanceDeduction
    summary.totalOtherDeductions += batch.totalOtherDeductions
    summary.totalDeductions += batch.totalDeductions
    summary.totalNetPay += batch.totalNetPay
    summary.totalEmployerCharges += batch.totalEmployerCharges
    summary.totalSocialCharges += batch.totalSocialCharges
    summary.totalGratuity += batch.totalGratuity
    summary.employeeCount += batch.lines.length

    for (const line of batch.lines) {
      lines.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        batchStatus: batch.status,
        employeeId: line.employeeId,
        employeeName: line.employeeName,
        employeeCode: line.employeeCode || line.employee?.employeeCode,
        department: line.department || line.employee?.department,
        basicSalary: roundPKR(line.basicSalary),
        allowances: roundPKR(line.allowances),
        grossSalary: roundPKR(line.grossSalary),
        incomeTax: roundPKR(line.incomeTax),
        eobiEmployee: roundPKR(line.eobiEmployee),
        eobiEmployer: roundPKR(line.eobiEmployer),
        essiEmployee: roundPKR(line.essiEmployee),
        essiEmployer: roundPKR(line.essiEmployer),
        pfEmployee: roundPKR(line.pfEmployee),
        pfEmployer: roundPKR(line.pfEmployer),
        loanDeduction: roundPKR(line.loanDeduction),
        advanceDeduction: roundPKR(line.advanceDeduction),
        otherDeductions: roundPKR(line.otherDeductions),
        totalDeductions: roundPKR(line.totalDeductions),
        netPay: roundPKR(line.netPay),
        socialCharges: roundPKR(line.socialCharges),
        gratuity: roundPKR(line.gratuity),
        employerCost: roundPKR(line.eobiEmployer + line.pfEmployer + line.essiEmployer + line.socialCharges + line.gratuity),
        lineStatus: line.lineStatus,
      })
    }
  }

  // Round all summary values
  for (const key of Object.keys(summary) as (keyof typeof summary)[]) {
    if (typeof summary[key] === 'number') {
      (summary as Record<string, unknown>)[key] = roundPKR(summary[key] as number)
    }
  }

  // Deduplicate lines: if same employee appears in multiple batches for the same period,
  // keep the one from the most advanced batch status (voucher-created > approved > reviewed > draft)
  const statusRank: Record<string, number> = { 'voucher-created': 4, approved: 3, reviewed: 2, draft: 1 }
  const dedupedLines = new Map<string, Record<string, unknown>>()
  for (const line of lines) {
    const existing = dedupedLines.get(line.employeeId as string)
    const existingRank = statusRank[(existing?.batchStatus as string) || ''] || 0
    const newRank = statusRank[(line.batchStatus as string) || ''] || 0
    if (!existing || newRank > existingRank) {
      dedupedLines.set(line.employeeId as string, line)
    }
  }

  return NextResponse.json({ month, summary, lines: Array.from(dedupedLines.values()) })
}

// 2. project-cost — Project-wise Cost Report
async function projectCost(searchParams: URLSearchParams) {
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month parameter required (YYYY-MM)' }, { status: 400 })

  const monthDate = parseMonth(month)

  // Get all payroll batch lines for this month
  const batches = await db.payrollBatch.findMany({
    where: { period: month },
    include: { lines: true },
  })

  // Get ProjectCostLedger entries for this month
  const costLedgerEntries = await db.projectCostLedger.findMany({
    where: { month: monthDate },
    include: {
      project: { select: { id: true, code: true, name: true, projectType: true } },
      employee: { select: { id: true, name: true, employeeCode: true } },
    },
  })

  // Aggregate by project from cost ledger
  const projectMap = new Map<string, {
    projectId: string
    projectCode: string
    projectName: string
    projectType: string
    employeeCount: Set<string>
    totalSalaryAllocated: number
    totalScAllocated: number
    totalCost: number
    details: Record<string, unknown>[]
  }>()

  for (const entry of costLedgerEntries) {
    const pId = entry.projectId
    if (!projectMap.has(pId)) {
      projectMap.set(pId, {
        projectId: pId,
        projectCode: entry.project.code,
        projectName: entry.project.name,
        projectType: entry.project.projectType,
        employeeCount: new Set<string>(),
        totalSalaryAllocated: 0,
        totalScAllocated: 0,
        totalCost: 0,
        details: [],
      })
    }
    const proj = projectMap.get(pId)!
    proj.employeeCount.add(entry.employeeId)
    proj.totalSalaryAllocated += entry.salaryShare
    proj.totalScAllocated += entry.scShare
    proj.totalCost += entry.salaryShare + entry.scShare
    proj.details.push({
      employeeId: entry.employeeId,
      employeeName: entry.employee.name,
      employeeCode: entry.employee.employeeCode,
      totalDays: entry.totalDays,
      salaryShare: roundPKR(entry.salaryShare),
      scShare: roundPKR(entry.scShare),
      scOtherPayable: roundPKR(entry.scOtherPayable),
      scEarnedLeave: roundPKR(entry.scEarnedLeave),
      scSickLeave: roundPKR(entry.scSickLeave),
      scCasualLeave: roundPKR(entry.scCasualLeave),
    })
  }

  // Also aggregate from PayrollBatchLine.projectAllocations for social charges
  // AND as primary source if ProjectCostLedger is empty (new batches without cost ledger)
  const lineSocialCharges = new Map<string, { employerCharges: number; gratuity: number }>()

  for (const batch of batches) {
    for (const line of batch.lines) {
      const allocations = safeParseJson<Array<{ projectId: string; projectCode: string; projectName: string; days: number; weight: number; salaryShare: number; scShare: number }>>(
        line.projectAllocations, []
      )
      // Also check contractEarnings as fallback
      const contracts = safeParseJson<Array<{ projectId: string; projectCode: string; projectName: string; daysWorked: number; earnedSalary: number; scShare: number }>>(
        line.contractEarnings, []
      )
      const effectiveAllocs = allocations.length > 0 ? allocations : contracts.map(c => ({
        projectId: c.projectId,
        projectCode: c.projectCode,
        projectName: c.projectName,
        days: c.daysWorked || 0,
        weight: 0,
        salaryShare: c.earnedSalary || 0,
        scShare: c.scShare || 0,
      }))

      const totalSalaryInAllocations = effectiveAllocs.reduce((s, a) => s + (a.salaryShare || 0), 0)

      for (const alloc of effectiveAllocs) {
        if (!alloc.projectId || (alloc.salaryShare || 0) === 0) continue
        const weight = totalSalaryInAllocations > 0 ? (alloc.salaryShare || 0) / totalSalaryInAllocations : 0

        // Build projectMap from batch lines if cost ledger is empty
        if (!projectMap.has(alloc.projectId)) {
          projectMap.set(alloc.projectId, {
            projectId: alloc.projectId,
            projectCode: alloc.projectCode || '',
            projectName: alloc.projectName || '',
            projectType: 'Other',
            employeeCount: new Set<string>(),
            totalSalaryAllocated: 0,
            totalScAllocated: 0,
            totalCost: 0,
            details: [],
          })
        }
        const proj = projectMap.get(alloc.projectId)!
        // Only add from batch lines if not already populated from cost ledger
        if (costLedgerEntries.length === 0) {
          proj.employeeCount.add(line.employeeId)
          proj.totalSalaryAllocated += alloc.salaryShare || 0
          proj.totalScAllocated += alloc.scShare || 0
          proj.totalCost += (alloc.salaryShare || 0) + (alloc.scShare || 0)
          proj.details.push({
            employeeId: line.employeeId,
            employeeName: line.employeeName,
            employeeCode: line.employeeCode || '',
            totalDays: alloc.days || 0,
            salaryShare: roundPKR(alloc.salaryShare || 0),
            scShare: roundPKR(alloc.scShare || 0),
          })
        }

        if (!lineSocialCharges.has(alloc.projectId)) {
          lineSocialCharges.set(alloc.projectId, { employerCharges: 0, gratuity: 0 })
        }
        const sc = lineSocialCharges.get(alloc.projectId)!
        sc.employerCharges += (line.eobiEmployer + line.pfEmployer + line.essiEmployer) * weight
        sc.gratuity += line.gratuity * weight
      }
    }
  }

  const projects = Array.from(projectMap.values()).map(p => ({
    projectId: p.projectId,
    projectCode: p.projectCode,
    projectName: p.projectName,
    projectType: p.projectType,
    employeeCount: p.employeeCount.size,
    totalSalaryAllocated: roundPKR(p.totalSalaryAllocated),
    totalSocialChargesAllocated: roundPKR(p.totalScAllocated),
    totalEmployerCharges: roundPKR(lineSocialCharges.get(p.projectId)?.employerCharges || 0),
    totalGratuity: roundPKR(lineSocialCharges.get(p.projectId)?.gratuity || 0),
    totalProjectBurden: roundPKR(p.totalCost + (lineSocialCharges.get(p.projectId)?.employerCharges || 0) + (lineSocialCharges.get(p.projectId)?.gratuity || 0)),
    details: p.details,
  }))

  const grandTotal = {
    totalSalaryAllocated: roundPKR(projects.reduce((s, p) => s + p.totalSalaryAllocated, 0)),
    totalSocialChargesAllocated: roundPKR(projects.reduce((s, p) => s + p.totalSocialChargesAllocated, 0)),
    totalEmployerCharges: roundPKR(projects.reduce((s, p) => s + p.totalEmployerCharges, 0)),
    totalGratuity: roundPKR(projects.reduce((s, p) => s + p.totalGratuity, 0)),
    totalProjectBurden: roundPKR(projects.reduce((s, p) => s + p.totalProjectBurden, 0)),
  }

  return NextResponse.json({ month, projects, grandTotal })
}

// 3. employee-earnings — Employee-wise Earnings Report
async function employeeEarnings(searchParams: URLSearchParams) {
  const fromMonth = searchParams.get('fromMonth')
  const toMonth = searchParams.get('toMonth')
  if (!fromMonth || !toMonth) {
    return NextResponse.json({ error: 'fromMonth and toMonth parameters required (YYYY-MM)' }, { status: 400 })
  }

  const months = getMonthsBetween(fromMonth, toMonth)

  const batches = await db.payrollBatch.findMany({
    where: { period: { in: months } },
    include: { lines: true },
  })

  // Group by employee
  const empMap = new Map<string, {
    employeeId: string
    employeeName: string
    employeeCode: string
    monthlyData: Record<string, {
      month: string
      grossSalary: number
      totalDeductions: number
      netPay: number
      basicSalary: number
      allowances: number
      incomeTax: number
    }>
    totalEarnings: number
    totalDeductions: number
    totalNetPay: number
  }>()

  for (const batch of batches) {
    for (const line of batch.lines) {
      if (!empMap.has(line.employeeId)) {
        empMap.set(line.employeeId, {
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode || '',
          monthlyData: {},
          totalEarnings: 0,
          totalDeductions: 0,
          totalNetPay: 0,
        })
      }
      const emp = empMap.get(line.employeeId)!
      emp.monthlyData[batch.period] = {
        month: batch.period,
        grossSalary: roundPKR(line.grossSalary),
        totalDeductions: roundPKR(line.totalDeductions),
        netPay: roundPKR(line.netPay),
        basicSalary: roundPKR(line.basicSalary),
        allowances: roundPKR(line.allowances),
        incomeTax: roundPKR(line.incomeTax),
      }
      emp.totalEarnings += line.grossSalary
      emp.totalDeductions += line.totalDeductions
      emp.totalNetPay += line.netPay
    }
  }

  const employees = Array.from(empMap.values()).map(emp => ({
    ...emp,
    monthlyData: months.map(m => emp.monthlyData[m] || {
      month: m,
      grossSalary: 0,
      totalDeductions: 0,
      netPay: 0,
      basicSalary: 0,
      allowances: 0,
      incomeTax: 0,
    }),
    totalEarnings: roundPKR(emp.totalEarnings),
    totalDeductions: roundPKR(emp.totalDeductions),
    totalNetPay: roundPKR(emp.totalNetPay),
  }))

  return NextResponse.json({ fromMonth, toMonth, months, employees })
}

// 4. tax-deduction — Tax Deduction Report (YTD based)
async function taxDeduction(searchParams: URLSearchParams) {
  const fiscalYear = searchParams.get('fiscalYear')
  if (!fiscalYear) return NextResponse.json({ error: 'fiscalYear parameter required (e.g., 2024-25)' }, { status: 400 })

  const { fyStart, fyEnd } = getFiscalYearDates(fiscalYear)

  // Get all payroll lines in the fiscal year
  const batches = await db.payrollBatch.findMany({
    where: {
      period: { gte: `${fyStart.getUTCFullYear()}-${String(fyStart.getUTCMonth() + 1).padStart(2, '0')}` },
    },
    include: { lines: true },
  })

  // Filter to FY only
  const fyBatches = batches.filter(b => {
    const bd = parseMonth(b.period)
    return bd >= fyStart && bd <= fyEnd
  })

  // Group by employee
  const empMap = new Map<string, {
    employeeId: string
    employeeName: string
    employeeCode: string
    months: { month: string; tax: number }[]
    ytdIncome: number
    projectedAnnual: number
    taxPaidYtd: number
    taxSlabApplied: string
  }>()

  for (const batch of fyBatches) {
    for (const line of batch.lines) {
      if (!empMap.has(line.employeeId)) {
        empMap.set(line.employeeId, {
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode || '',
          months: [],
          ytdIncome: 0,
          projectedAnnual: 0,
          taxPaidYtd: 0,
          taxSlabApplied: '',
        })
      }
      const emp = empMap.get(line.employeeId)!
      emp.months.push({ month: batch.period, tax: roundPKR(line.incomeTax) })
      emp.ytdIncome += line.grossSalary
      emp.taxPaidYtd += line.incomeTax

      // Get tax slab from the latest taxBreakdown
      const tb = safeParseJson<{
        projectedAnnualIncome: number
        taxSlab: string
      }>(line.taxBreakdown, { projectedAnnualIncome: 0, taxSlab: '' })
      if (tb.projectedAnnualIncome > emp.projectedAnnual) {
        emp.projectedAnnual = tb.projectedAnnualIncome
        emp.taxSlabApplied = tb.taxSlab
      }
    }
  }

  const employees = Array.from(empMap.values()).map(emp => ({
    ...emp,
    ytdIncome: roundPKR(emp.ytdIncome),
    projectedAnnual: roundPKR(emp.projectedAnnual),
    taxPaidYtd: roundPKR(emp.taxPaidYtd),
  }))

  return NextResponse.json({ fiscalYear, employees })
}

// 5. employer-cost — Employer Cost Report
async function employerCost(searchParams: URLSearchParams) {
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month parameter required (YYYY-MM)' }, { status: 400 })

  const batches = await db.payrollBatch.findMany({
    where: { period: month },
    include: {
      lines: {
        include: { employee: { select: { eobiEnabled: true, essiEnabled: true, pfEnabled: true, gratuityEnabled: true } } },
      },
    },
  })

  const employees: Record<string, unknown>[] = []
  let totalGross = 0, totalEobiEmployer = 0, totalEssiEmployer = 0
  let totalPfEmployer = 0, totalGratuity = 0, totalSocialCharges = 0, totalCTC = 0

  for (const batch of batches) {
    for (const line of batch.lines) {
      const eobiEmployer = roundPKR(line.eobiEmployer)
      const essiEmployer = roundPKR(line.essiEmployer)
      const pfEmployer = roundPKR(line.pfEmployer)
      const gratuity = roundPKR(line.gratuity)
      const socialCharges = roundPKR(line.socialCharges)
      const grossSalary = roundPKR(line.grossSalary)
      const totalCTCLine = roundPKR(grossSalary + eobiEmployer + essiEmployer + pfEmployer + gratuity + socialCharges)

      employees.push({
        employeeId: line.employeeId,
        employeeName: line.employeeName,
        employeeCode: line.employeeCode,
        grossSalary,
        eobiEmployer,
        essiEmployer,
        pfEmployer,
        gratuity,
        socialCharges,
        totalCTC: totalCTCLine,
        flags: {
          eobiEnabled: line.employee?.eobiEnabled || false,
          essiEnabled: line.employee?.essiEnabled || false,
          pfEnabled: line.employee?.pfEnabled || false,
          gratuityEnabled: line.employee?.gratuityEnabled || false,
        },
      })

      totalGross += grossSalary
      totalEobiEmployer += eobiEmployer
      totalEssiEmployer += essiEmployer
      totalPfEmployer += pfEmployer
      totalGratuity += gratuity
      totalSocialCharges += socialCharges
      totalCTC += totalCTCLine
    }
  }

  return NextResponse.json({
    month,
    employees,
    totals: {
      totalGross: roundPKR(totalGross),
      totalEobiEmployer: roundPKR(totalEobiEmployer),
      totalEssiEmployer: roundPKR(totalEssiEmployer),
      totalPfEmployer: roundPKR(totalPfEmployer),
      totalGratuity: roundPKR(totalGratuity),
      totalSocialCharges: roundPKR(totalSocialCharges),
      totalCTC: roundPKR(totalCTC),
    },
  })
}

// 6. payroll-audit — Payroll Audit Report (fraud/duplication detection)
async function payrollAudit(searchParams: URLSearchParams) {
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month parameter required (YYYY-MM)' }, { status: 400 })

  const batches = await db.payrollBatch.findMany({
    where: { period: month },
    include: {
      lines: {
        include: { employee: { select: { id: true, name: true, baseSalary: true, incomeTaxEnabled: true } } },
      },
    },
  })

  const monthDate = parseMonth(month)
  const [year, mon] = month.split('-').map(Number)
  const monthStart = new Date(Date.UTC(year, mon - 1, 1))
  const monthEnd = new Date(Date.UTC(year, mon - 1, getDaysInMonth(year, mon), 23, 59, 59, 999))
  const calendarDays = getDaysInMonth(year, mon)

  const auditLines: Record<string, unknown>[] = []
  const flags: Record<string, unknown>[] = []

  // Track duplicate detection
  const employeeLineCount = new Map<string, number>()

  for (const batch of batches) {
    for (const line of batch.lines) {
      employeeLineCount.set(line.employeeId, (employeeLineCount.get(line.employeeId) || 0) + 1)

      const projectAllocations = safeParseJson<Array<{ projectId: string; salaryShare: number }>>(
        line.projectAllocations, []
      )
      const taxBreakdown = safeParseJson<{
        projectedAnnualIncome: number
        taxSlab: string
        ytdIncome: number
        taxPaidYtd: number
        monthsWorkedYtd: number
      }>(line.taxBreakdown, { projectedAnnualIncome: 0, taxSlab: '', ytdIncome: 0, taxPaidYtd: 0, monthsWorkedYtd: 0 })

      const allocationTotal = projectAllocations.reduce((s, a) => s + a.salaryShare, 0)
      const employerCost = roundPKR(line.eobiEmployer + line.pfEmployer + line.essiEmployer + line.socialCharges + line.gratuity)

      // Check attendance
      const attendanceRecords = await db.attendance.findMany({
        where: {
          employeeId: line.employeeId,
          date: { gte: monthStart, lte: monthEnd },
        },
      })
      const hasAttendance = attendanceRecords.length > 0

      // Tax mismatch check: recalculate expected tax
      let expectedTax = line.incomeTax
      if (line.employee?.incomeTaxEnabled !== false && line.grossSalary > 0) {
        const projectedAnnual = taxBreakdown.projectedAnnualIncome || line.grossSalary * 12
        const { annualTax } = calculateFbrTax(projectedAnnual)
        const monthlyTax = roundPKR(annualTax / 12)
        expectedTax = monthlyTax
      }

      const taxMismatch = Math.abs(line.incomeTax - expectedTax) > 100 // tolerance of PKR 100

      const auditEntry = {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        employeeId: line.employeeId,
        employeeName: line.employeeName,
        employeeCode: line.employeeCode,
        baseSalary: roundPKR(line.employee?.baseSalary || 0),
        earnedSalary: roundPKR(line.basicSalary),
        projectAllocationTotal: roundPKR(allocationTotal),
        incomeTax: roundPKR(line.incomeTax),
        eobiEmployee: roundPKR(line.eobiEmployee),
        eobiEmployer: roundPKR(line.eobiEmployer),
        essiEmployee: roundPKR(line.essiEmployee),
        essiEmployer: roundPKR(line.essiEmployer),
        netPay: roundPKR(line.netPay),
        employerCost,
        grossSalary: roundPKR(line.grossSalary),
        totalDeductions: roundPKR(line.totalDeductions),
        calendarDays: line.calendarDays || calendarDays,
        payableDays: line.payableDays,
        absentDays: line.absentDays,
        lineStatus: line.lineStatus,
      }

      auditLines.push(auditEntry)

      // Flag checks
      // 1. Negative net pay
      if (line.netPay < 0) {
        flags.push({ type: 'negative_net_pay', severity: 'high', employeeId: line.employeeId, employeeName: line.employeeName, message: `Net pay is negative: PKR ${roundPKR(line.netPay)}` })
      }

      // 2. Missing attendance
      if (!hasAttendance && line.absentDays === 0) {
        flags.push({ type: 'missing_attendance', severity: 'medium', employeeId: line.employeeId, employeeName: line.employeeName, message: 'No attendance records found for this month but absent days = 0' })
      }

      // 3. Wrong project allocation (total ≠ earned salary)
      if (projectAllocations.length > 0 && Math.abs(allocationTotal - line.basicSalary) > 10) {
        flags.push({ type: 'wrong_project_allocation', severity: 'high', employeeId: line.employeeId, employeeName: line.employeeName, message: `Project allocation total (PKR ${roundPKR(allocationTotal)}) ≠ earned salary (PKR ${roundPKR(line.basicSalary)}). Difference: PKR ${roundPKR(allocationTotal - line.basicSalary)}` })
      }

      // 4. Tax mismatch
      if (taxMismatch && line.employee?.incomeTaxEnabled !== false) {
        flags.push({ type: 'tax_mismatch', severity: 'medium', employeeId: line.employeeId, employeeName: line.employeeName, message: `Tax deducted (PKR ${roundPKR(line.incomeTax)}) differs from expected (PKR ${roundPKR(expectedTax)}) by PKR ${roundPKR(Math.abs(line.incomeTax - expectedTax))}` })
      }
    }
  }

  // 5. Duplicate salary entries
  for (const [empId, count] of employeeLineCount.entries()) {
    if (count > 1) {
      const line = batches.flatMap(b => b.lines).find(l => l.employeeId === empId)
      flags.push({ type: 'duplicate_salary_entry', severity: 'high', employeeId: empId, employeeName: line?.employeeName || '', message: `Employee has ${count} salary entries in this month — possible duplication` })
    }
  }

  return NextResponse.json({
    month,
    auditLines,
    flags,
    flagSummary: {
      totalFlags: flags.length,
      highSeverity: flags.filter(f => (f as Record<string, unknown>).severity === 'high').length,
      mediumSeverity: flags.filter(f => (f as Record<string, unknown>).severity === 'medium').length,
      byType: {
        duplicate_salary_entry: flags.filter(f => (f as Record<string, unknown>).type === 'duplicate_salary_entry').length,
        negative_net_pay: flags.filter(f => (f as Record<string, unknown>).type === 'negative_net_pay').length,
        missing_attendance: flags.filter(f => (f as Record<string, unknown>).type === 'missing_attendance').length,
        wrong_project_allocation: flags.filter(f => (f as Record<string, unknown>).type === 'wrong_project_allocation').length,
        tax_mismatch: flags.filter(f => (f as Record<string, unknown>).type === 'tax_mismatch').length,
      },
    },
  })
}

// 7. ytd-earnings — Year-to-Date Earnings Report
async function ytdEarnings(searchParams: URLSearchParams) {
  const fiscalYear = searchParams.get('fiscalYear')
  if (!fiscalYear) return NextResponse.json({ error: 'fiscalYear parameter required (e.g., 2024-25)' }, { status: 400 })

  const { fyStart, fyEnd } = getFiscalYearDates(fiscalYear)

  const batches = await db.payrollBatch.findMany({
    include: { lines: true },
  })

  // Filter to FY only
  const fyBatches = batches.filter(b => {
    const bd = parseMonth(b.period)
    return bd >= fyStart && bd <= fyEnd
  })

  // Group by employee
  const empMap = new Map<string, {
    employeeId: string
    employeeName: string
    employeeCode: string
    monthlyEarnings: { month: string; grossSalary: number; incomeTax: number; netPay: number }[]
    cumulativeYtdIncome: number
    projectedAnnualIncome: number
    taxPaidYtd: number
    monthsWorked: number
  }>()

  for (const batch of fyBatches) {
    for (const line of batch.lines) {
      if (!empMap.has(line.employeeId)) {
        empMap.set(line.employeeId, {
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode || '',
          monthlyEarnings: [],
          cumulativeYtdIncome: 0,
          projectedAnnualIncome: 0,
          taxPaidYtd: 0,
          monthsWorked: 0,
        })
      }
      const emp = empMap.get(line.employeeId)!
      emp.monthlyEarnings.push({
        month: batch.period,
        grossSalary: roundPKR(line.grossSalary),
        incomeTax: roundPKR(line.incomeTax),
        netPay: roundPKR(line.netPay),
      })
      emp.cumulativeYtdIncome += line.grossSalary
      emp.taxPaidYtd += line.incomeTax
      emp.monthsWorked++

      // Get projected annual from latest taxBreakdown
      const tb = safeParseJson<{ projectedAnnualIncome: number }>(line.taxBreakdown, { projectedAnnualIncome: 0 })
      if (tb.projectedAnnualIncome > emp.projectedAnnualIncome) {
        emp.projectedAnnualIncome = tb.projectedAnnualIncome
      }
    }
  }

  // Calculate remaining tax liability
  const employees = Array.from(empMap.values()).map(emp => {
    const { annualTax } = calculateFbrTax(emp.projectedAnnualIncome)
    const expectedTotalTax = roundPKR(annualTax)
    const remainingTaxLiability = Math.max(0, roundPKR(expectedTotalTax - emp.taxPaidYtd))

    return {
      ...emp,
      cumulativeYtdIncome: roundPKR(emp.cumulativeYtdIncome),
      projectedAnnualIncome: roundPKR(emp.projectedAnnualIncome),
      taxPaidYtd: roundPKR(emp.taxPaidYtd),
      expectedTotalTax,
      remainingTaxLiability,
    }
  })

  return NextResponse.json({ fiscalYear, employees })
}

// 8. employee-ledger — Employee Ledger Report
async function employeeLedger(searchParams: URLSearchParams) {
  const employeeId = searchParams.get('employeeId')
  const fromMonth = searchParams.get('fromMonth')
  const toMonth = searchParams.get('toMonth')

  if (!employeeId) return NextResponse.json({ error: 'employeeId parameter required' }, { status: 400 })
  if (!fromMonth || !toMonth) return NextResponse.json({ error: 'fromMonth and toMonth parameters required (YYYY-MM)' }, { status: 400 })

  const months = getMonthsBetween(fromMonth, toMonth)

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, employeeCode: true, department: true, baseSalary: true },
  })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  const batches = await db.payrollBatch.findMany({
    where: { period: { in: months } },
    include: { lines: { where: { employeeId } } },
  })

  const ledgerEntries: Record<string, unknown>[] = []

  for (const batch of batches) {
    for (const line of batch.lines) {
      const [y, m] = batch.period.split('-').map(Number)
      const monthStart = new Date(Date.UTC(y, m - 1, 1))
      const monthEnd = new Date(Date.UTC(y, m - 1, getDaysInMonth(y, m), 23, 59, 59, 999))

      // Get attendance impact
      const attendance = await db.attendance.findMany({
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
        },
        select: { status: true },
      })
      const presentDays = attendance.filter(a => ['P', 'W', 'H', 'T', 'WH', 'WW'].includes(a.status)).length
      const absentDays = attendance.filter(a => a.status === 'A' || a.status === 'CD').length
      const leaveDays = attendance.filter(a => ['CL', 'SL', 'EL'].includes(a.status)).length

      const taxBreakdown = safeParseJson<{
        projectedAnnualIncome: number
        taxSlab: string
      }>(line.taxBreakdown, { projectedAnnualIncome: 0, taxSlab: '' })

      ledgerEntries.push({
        month: batch.period,
        batchNumber: batch.batchNumber,
        batchStatus: batch.status,
        basicSalary: roundPKR(line.basicSalary),
        dailyRate: roundPKR(line.dailyRate),
        calendarDays: line.calendarDays,
        payableDays: line.payableDays,
        presentDays,
        absentDays,
        leaveDays,
        attendanceImpact: roundPKR(line.dailyRate * absentDays * -1),
        allowances: roundPKR(line.allowances),
        grossSalary: roundPKR(line.grossSalary),
        incomeTax: roundPKR(line.incomeTax),
        eobiEmployee: roundPKR(line.eobiEmployee),
        essiEmployee: roundPKR(line.essiEmployee),
        pfEmployee: roundPKR(line.pfEmployee),
        loanDeduction: roundPKR(line.loanDeduction),
        advanceDeduction: roundPKR(line.advanceDeduction),
        otherDeductions: roundPKR(line.otherDeductions),
        totalDeductions: roundPKR(line.totalDeductions),
        netPay: roundPKR(line.netPay),
        taxSlab: taxBreakdown.taxSlab,
        lineStatus: line.lineStatus,
      })
    }
  }

  return NextResponse.json({
    employee,
    fromMonth,
    toMonth,
    ledger: ledgerEntries,
  })
}

// 9. attendance-impact — Attendance Impact Report
async function attendanceImpact(searchParams: URLSearchParams) {
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month parameter required (YYYY-MM)' }, { status: 400 })

  const [year, mon] = month.split('-').map(Number)
  const monthStart = new Date(Date.UTC(year, mon - 1, 1))
  const monthEnd = new Date(Date.UTC(year, mon - 1, getDaysInMonth(year, mon), 23, 59, 59, 999))
  const calendarDays = getDaysInMonth(year, mon)

  const employees = await db.employee.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      department: true,
      baseSalary: true,
      attendanceRecords: {
        where: { date: { gte: monthStart, lte: monthEnd } },
        select: { status: true },
      },
    },
  })

  const report = employees.map(emp => {
    const records = emp.attendanceRecords
    const presentDays = records.filter(a => ['P', 'W', 'H', 'T', 'WH', 'WW'].includes(a.status)).length
    const absentDays = records.filter(a => a.status === 'A' || a.status === 'CD').length
    const leaveDays = records.filter(a => ['CL', 'SL', 'EL', 'CO'].includes(a.status)).length
    const dailyRate = roundPKR(emp.baseSalary / calendarDays)
    const salaryImpactPerAbsence = dailyRate

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.employeeCode,
      department: emp.department,
      baseSalary: roundPKR(emp.baseSalary),
      calendarDays,
      presentDays,
      absentDays,
      leaveDays,
      dailyRate,
      salaryImpactPerAbsence,
      totalSalaryImpact: roundPKR(salaryImpactPerAbsence * absentDays * -1),
      payableDays: calendarDays - absentDays,
      earnedSalary: roundPKR((emp.baseSalary / calendarDays) * (calendarDays - absentDays)),
    }
  })

  const totals = {
    totalEmployees: report.length,
    totalPresentDays: report.reduce((s, r) => s + r.presentDays, 0),
    totalAbsentDays: report.reduce((s, r) => s + r.absentDays, 0),
    totalLeaveDays: report.reduce((s, r) => s + r.leaveDays, 0),
    totalSalaryImpact: roundPKR(report.reduce((s, r) => s + r.totalSalaryImpact, 0)),
  }

  return NextResponse.json({ month, report, totals })
}

// 10. project-utilization — Project Resource Utilization Report
async function projectUtilization(searchParams: URLSearchParams) {
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month parameter required (YYYY-MM)' }, { status: 400 })

  const monthDate = parseMonth(month)

  // Get cost ledger entries
  const costEntries = await db.projectCostLedger.findMany({
    where: { month: monthDate },
    include: {
      project: { select: { id: true, code: true, name: true, projectType: true } },
      employee: { select: { id: true, name: true, employeeCode: true, baseSalary: true } },
    },
  })

  // Get batches for social charges
  const batches = await db.payrollBatch.findMany({
    where: { period: month },
    include: { lines: true },
  })

  // Aggregate by project
  const projectMap = new Map<string, {
    projectId: string
    projectCode: string
    projectName: string
    projectType: string
    employeeIds: Set<string>
    totalDaysAllocated: number
    totalCost: number
    employees: Record<string, unknown>[]
  }>()

  for (const entry of costEntries) {
    const pId = entry.projectId
    if (!projectMap.has(pId)) {
      projectMap.set(pId, {
        projectId: pId,
        projectCode: entry.project.code,
        projectName: entry.project.name,
        projectType: entry.project.projectType,
        employeeIds: new Set<string>(),
        totalDaysAllocated: 0,
        totalCost: 0,
        employees: [],
      })
    }
    const proj = projectMap.get(pId)!
    proj.employeeIds.add(entry.employeeId)
    proj.totalDaysAllocated += entry.totalDays
    proj.totalCost += entry.salaryShare + entry.scShare
    proj.employees.push({
      employeeId: entry.employeeId,
      employeeName: entry.employee.name,
      employeeCode: entry.employee.employeeCode,
      daysAllocated: entry.totalDays,
      salaryShare: roundPKR(entry.salaryShare),
      scShare: roundPKR(entry.scShare),
      costPerDay: entry.totalDays > 0 ? roundPKR(entry.salaryShare / entry.totalDays) : 0,
    })
  }

  const [year, mon] = month.split('-').map(Number)
  const calendarDays = getDaysInMonth(year, mon)

  const projects = Array.from(projectMap.values()).map(proj => {
    const employeeCount = proj.employeeIds.size
    const costPerEmployee = employeeCount > 0 ? roundPKR(proj.totalCost / employeeCount) : 0
    // Productivity vs cost ratio: total days allocated / (employee count × calendar days) × 100
    const maxPossibleDays = employeeCount * calendarDays
    const productivityRatio = maxPossibleDays > 0 ? roundPKR((proj.totalDaysAllocated / maxPossibleDays) * 10000) / 100 : 0

    return {
      projectId: proj.projectId,
      projectCode: proj.projectCode,
      projectName: proj.projectName,
      projectType: proj.projectType,
      employeeCount,
      totalDaysAllocated: proj.totalDaysAllocated,
      totalCost: roundPKR(proj.totalCost),
      costPerEmployee,
      productivityVsCostRatio: productivityRatio, // percentage
      employees: proj.employees,
    }
  })

  return NextResponse.json({ month, projects })
}

// 11. tax-reconciliation — Tax Reconciliation Report
async function taxReconciliation(searchParams: URLSearchParams) {
  const fiscalYear = searchParams.get('fiscalYear')
  if (!fiscalYear) return NextResponse.json({ error: 'fiscalYear parameter required (e.g., 2024-25)' }, { status: 400 })

  const { fyStart, fyEnd } = getFiscalYearDates(fiscalYear)

  const batches = await db.payrollBatch.findMany({
    include: { lines: true },
  })

  const fyBatches = batches.filter(b => {
    const bd = parseMonth(b.period)
    return bd >= fyStart && bd <= fyEnd
  })

  // Group by employee
  const empMap = new Map<string, {
    employeeId: string
    employeeName: string
    employeeCode: string
    ytdIncome: number
    projectedAnnualIncome: number
    expectedTax: number
    actualTaxDeducted: number
  }>()

  for (const batch of fyBatches) {
    for (const line of batch.lines) {
      if (!empMap.has(line.employeeId)) {
        empMap.set(line.employeeId, {
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode || '',
          ytdIncome: 0,
          projectedAnnualIncome: 0,
          expectedTax: 0,
          actualTaxDeducted: 0,
        })
      }
      const emp = empMap.get(line.employeeId)!
      emp.ytdIncome += line.grossSalary
      emp.actualTaxDeducted += line.incomeTax

      const tb = safeParseJson<{ projectedAnnualIncome: number }>(line.taxBreakdown, { projectedAnnualIncome: 0 })
      if (tb.projectedAnnualIncome > emp.projectedAnnualIncome) {
        emp.projectedAnnualIncome = tb.projectedAnnualIncome
      }
    }
  }

  const employees = Array.from(empMap.values()).map(emp => {
    const { annualTax } = calculateFbrTax(emp.projectedAnnualIncome)
    const expectedTax = roundPKR(annualTax)
    const difference = roundPKR(emp.actualTaxDeducted - expectedTax)
    const status = difference > 0 ? 'over_deduction' : difference < 0 ? 'under_deduction' : 'matched'

    return {
      ...emp,
      ytdIncome: roundPKR(emp.ytdIncome),
      projectedAnnualIncome: roundPKR(emp.projectedAnnualIncome),
      expectedTax,
      actualTaxDeducted: roundPKR(emp.actualTaxDeducted),
      difference,
      absDifference: Math.abs(difference),
      status,
    }
  })

  const summary = {
    totalEmployees: employees.length,
    matched: employees.filter(e => e.status === 'matched').length,
    underDeduction: employees.filter(e => e.status === 'under_deduction').length,
    overDeduction: employees.filter(e => e.status === 'over_deduction').length,
    totalUnderDeduction: roundPKR(employees.filter(e => e.status === 'under_deduction').reduce((s, e) => s + e.absDifference, 0)),
    totalOverDeduction: roundPKR(employees.filter(e => e.status === 'over_deduction').reduce((s, e) => s + e.absDifference, 0)),
  }

  return NextResponse.json({ fiscalYear, employees, summary })
}

// 12. social-contributions — Social Contributions Report
async function socialContributions(searchParams: URLSearchParams) {
  const month = searchParams.get('month')
  const fiscalYear = searchParams.get('fiscalYear')

  if (!month && !fiscalYear) {
    return NextResponse.json({ error: 'month (YYYY-MM) or fiscalYear parameter required' }, { status: 400 })
  }

  const includeOpts = {
    lines: {
      include: { employee: { select: { eobiEnabled: true, essiEnabled: true, pfEnabled: true, gratuityEnabled: true } } },
    },
  } as const

  let targetBatches: Awaited<ReturnType<typeof db.payrollBatch.findMany<{ include: typeof includeOpts }>>>

  if (month) {
    targetBatches = await db.payrollBatch.findMany({
      where: { period: month },
      include: includeOpts,
    })
  } else {
    const { fyStart, fyEnd } = getFiscalYearDates(fiscalYear!)
    const allBatches = await db.payrollBatch.findMany({
      include: includeOpts,
    })
    targetBatches = allBatches.filter(b => {
      const bd = parseMonth(b.period)
      return bd >= fyStart && bd <= fyEnd
    })
  }

  const empMap = new Map<string, {
    employeeId: string
    employeeName: string
    employeeCode: string
    eobiEmployee: number
    eobiEmployer: number
    essiEmployee: number
    essiEmployer: number
    pfEmployee: number
    pfEmployer: number
    gratuity: number
    socialCharges: number
    totalSocialBurden: number
  }>()

  for (const batch of targetBatches) {
    for (const line of batch.lines) {
      if (!empMap.has(line.employeeId)) {
        empMap.set(line.employeeId, {
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode || '',
          eobiEmployee: 0,
          eobiEmployer: 0,
          essiEmployee: 0,
          essiEmployer: 0,
          pfEmployee: 0,
          pfEmployer: 0,
          gratuity: 0,
          socialCharges: 0,
          totalSocialBurden: 0,
        })
      }
      const emp = empMap.get(line.employeeId)!
      emp.eobiEmployee += line.eobiEmployee
      emp.eobiEmployer += line.eobiEmployer
      emp.essiEmployee += line.essiEmployee
      emp.essiEmployer += line.essiEmployer
      emp.pfEmployee += line.pfEmployee
      emp.pfEmployer += line.pfEmployer
      emp.gratuity += line.gratuity
      emp.socialCharges += line.socialCharges
      emp.totalSocialBurden += line.eobiEmployee + line.eobiEmployer + line.essiEmployee + line.essiEmployer + line.pfEmployee + line.pfEmployer + line.gratuity + line.socialCharges
    }
  }

  const employees = Array.from(empMap.values()).map(emp => ({
    ...emp,
    eobiEmployee: roundPKR(emp.eobiEmployee),
    eobiEmployer: roundPKR(emp.eobiEmployer),
    essiEmployee: roundPKR(emp.essiEmployee),
    essiEmployer: roundPKR(emp.essiEmployer),
    pfEmployee: roundPKR(emp.pfEmployee),
    pfEmployer: roundPKR(emp.pfEmployer),
    gratuity: roundPKR(emp.gratuity),
    socialCharges: roundPKR(emp.socialCharges),
    totalSocialBurden: roundPKR(emp.totalSocialBurden),
  }))

  const totals = {
    eobiEmployee: roundPKR(employees.reduce((s, e) => s + e.eobiEmployee, 0)),
    eobiEmployer: roundPKR(employees.reduce((s, e) => s + e.eobiEmployer, 0)),
    essiEmployee: roundPKR(employees.reduce((s, e) => s + e.essiEmployee, 0)),
    essiEmployer: roundPKR(employees.reduce((s, e) => s + e.essiEmployer, 0)),
    pfEmployee: roundPKR(employees.reduce((s, e) => s + e.pfEmployee, 0)),
    pfEmployer: roundPKR(employees.reduce((s, e) => s + e.pfEmployer, 0)),
    gratuity: roundPKR(employees.reduce((s, e) => s + e.gratuity, 0)),
    socialCharges: roundPKR(employees.reduce((s, e) => s + e.socialCharges, 0)),
    totalSocialBurden: roundPKR(employees.reduce((s, e) => s + e.totalSocialBurden, 0)),
  }

  return NextResponse.json({
    period: month || fiscalYear,
    employees,
    totals,
  })
}

// 13. exception-warnings — Exception/Warning Report
async function exceptionWarnings(searchParams: URLSearchParams) {
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month parameter required (YYYY-MM)' }, { status: 400 })

  const [year, mon] = month.split('-').map(Number)
  const monthStart = new Date(Date.UTC(year, mon - 1, 1))
  const monthEnd = new Date(Date.UTC(year, mon - 1, getDaysInMonth(year, mon), 23, 59, 59, 999))
  const calendarDays = getDaysInMonth(year, mon)

  const batches = await db.payrollBatch.findMany({
    where: { period: month },
    include: {
      lines: {
        include: { employee: { select: { id: true, name: true, employeeCode: true, incomeTaxEnabled: true } } },
      },
    },
  })

  const warnings: Record<string, unknown>[] = []
  const employeeLineCount = new Map<string, number>()
  const employeesWithBillableDaysNoProject = new Set<string>()

  // Get all active employees
  const activeEmployees = await db.employee.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      attendanceRecords: {
        where: { date: { gte: monthStart, lte: monthEnd } },
        select: { id: true, status: true },
      },
      dailyProjectRecords: {
        where: { date: { gte: monthStart, lte: monthEnd } },
        select: { id: true, projectId: true, status: true },
      },
    },
  })

  // Check employees with billable attendance but no project assignment
  const billableStatuses = new Set(['P', 'W', 'H', 'WH', 'WW', 'T', 'CO'])
  for (const emp of activeEmployees) {
    const billableAttendance = emp.attendanceRecords.filter(a => billableStatuses.has(a.status))
    const hasProjectRecords = emp.dailyProjectRecords.length > 0
    if (billableAttendance.length > 0 && !hasProjectRecords) {
      warnings.push({
        type: 'no_project_assignment_but_billable_days',
        severity: 'high',
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.employeeCode,
        message: `Employee has ${billableAttendance.length} billable day(s) but no project assignment`,
        billableDays: billableAttendance.length,
      })
    }
  }

  for (const batch of batches) {
    for (const line of batch.lines) {
      employeeLineCount.set(line.employeeId, (employeeLineCount.get(line.employeeId) || 0) + 1)

      const projectAllocations = safeParseJson<Array<{ projectId: string; salaryShare: number }>>(
        line.projectAllocations, []
      )
      const allocationTotal = projectAllocations.reduce((s, a) => s + a.salaryShare, 0)

      // 1. Duplicate salary entries
      // (checked after loop)

      // 2. Negative net pay
      if (line.netPay < 0) {
        warnings.push({
          type: 'negative_net_pay',
          severity: 'high',
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode,
          message: `Net pay is negative: PKR ${roundPKR(line.netPay)}`,
          value: roundPKR(line.netPay),
        })
      }

      // 3. Missing attendance
      const attendance = await db.attendance.findMany({
        where: { employeeId: line.employeeId, date: { gte: monthStart, lte: monthEnd } },
        select: { id: true },
      })
      if (attendance.length === 0 && line.absentDays === 0 && line.calendarDays > 0) {
        warnings.push({
          type: 'missing_attendance',
          severity: 'medium',
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode,
          message: 'No attendance records found for this month',
        })
      }

      // 4. Wrong project allocation
      if (projectAllocations.length > 0 && Math.abs(allocationTotal - line.basicSalary) > 10) {
        warnings.push({
          type: 'wrong_project_allocation',
          severity: 'high',
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode,
          message: `Project allocation total (PKR ${roundPKR(allocationTotal)}) ≠ earned salary (PKR ${roundPKR(line.basicSalary)})`,
          allocationTotal: roundPKR(allocationTotal),
          earnedSalary: roundPKR(line.basicSalary),
          difference: roundPKR(allocationTotal - line.basicSalary),
        })
      }

      // 5. Tax mismatch
      if (line.employee?.incomeTaxEnabled !== false && line.grossSalary > 0) {
        const tb = safeParseJson<{
          projectedAnnualIncome: number
        }>(line.taxBreakdown, { projectedAnnualIncome: 0 })
        const projectedAnnual = tb.projectedAnnualIncome || line.grossSalary * 12
        const { annualTax } = calculateFbrTax(projectedAnnual)
        const expectedMonthlyTax = roundPKR(annualTax / 12)
        if (Math.abs(line.incomeTax - expectedMonthlyTax) > 100) {
          warnings.push({
            type: 'tax_mismatch',
            severity: 'medium',
            employeeId: line.employeeId,
            employeeName: line.employeeName,
            employeeCode: line.employeeCode,
            message: `Tax deducted (PKR ${roundPKR(line.incomeTax)}) differs from expected (PKR ${expectedMonthlyTax})`,
            deductedTax: roundPKR(line.incomeTax),
            expectedTax: expectedMonthlyTax,
            difference: roundPKR(Math.abs(line.incomeTax - expectedMonthlyTax)),
          })
        }
      }
    }
  }

  // Duplicate salary entries
  for (const [empId, count] of employeeLineCount.entries()) {
    if (count > 1) {
      const line = batches.flatMap(b => b.lines).find(l => l.employeeId === empId)
      warnings.push({
        type: 'duplicate_salary_entry',
        severity: 'high',
        employeeId: empId,
        employeeName: line?.employeeName || '',
        employeeCode: line?.employeeCode || '',
        message: `Employee has ${count} salary entries in this month — possible duplication`,
        entryCount: count,
      })
    }
  }

  // Sort by severity (high first)
  warnings.sort((a, b) => {
    const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return (sevOrder[(a as Record<string, unknown>).severity as string] || 99) - (sevOrder[(b as Record<string, unknown>).severity as string] || 99)
  })

  return NextResponse.json({
    month,
    warnings,
    summary: {
      totalWarnings: warnings.length,
      bySeverity: {
        high: warnings.filter(w => (w as Record<string, unknown>).severity === 'high').length,
        medium: warnings.filter(w => (w as Record<string, unknown>).severity === 'medium').length,
        low: warnings.filter(w => (w as Record<string, unknown>).severity === 'low').length,
      },
      byType: {
        duplicate_salary_entry: warnings.filter(w => (w as Record<string, unknown>).type === 'duplicate_salary_entry').length,
        negative_net_pay: warnings.filter(w => (w as Record<string, unknown>).type === 'negative_net_pay').length,
        missing_attendance: warnings.filter(w => (w as Record<string, unknown>).type === 'missing_attendance').length,
        wrong_project_allocation: warnings.filter(w => (w as Record<string, unknown>).type === 'wrong_project_allocation').length,
        tax_mismatch: warnings.filter(w => (w as Record<string, unknown>).type === 'tax_mismatch').length,
        no_project_assignment_but_billable_days: warnings.filter(w => (w as Record<string, unknown>).type === 'no_project_assignment_but_billable_days').length,
      },
    },
  })
}

// 14. tax-psid — FBR Tax PSID Report (Pakistan FBR format)
async function taxPsid(searchParams: URLSearchParams) {
  const month = searchParams.get('month')
  if (!month) return NextResponse.json({ error: 'month parameter required (YYYY-MM)' }, { status: 400 })

  const batches = await db.payrollBatch.findMany({
    where: { period: month },
    include: {
      lines: {
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              cnic: true,
              ntn: true,
              taxFilingStatus: true,
              taxCity: true,
              permanentAddress: true,
              presentAddress: true,
              department: true,
            },
          },
        },
      },
    },
  })

  const records: Record<string, unknown>[] = []
  let totalTaxableAmount = 0, totalTaxAmount = 0

  for (const batch of batches) {
    for (const line of batch.lines) {
      const emp = line.employee
      if (!emp) continue

      // Only include if tax was deducted
      if (line.incomeTax <= 0) continue

      const taxableAmount = roundPKR(line.grossSalary)
      const taxAmount = roundPKR(line.incomeTax)
      totalTaxableAmount += taxableAmount
      totalTaxAmount += taxAmount

      records.push({
        Payment_Section: '149',
        TaxPayer_NTN: emp.ntn || '',
        TaxPayer_CNIC: (emp.cnic || '').replace(/-/g, '').trim(),
        TaxPayer_CNIC_Display: emp.cnic || '',
        TaxPayer_Name: emp.name,
        TaxPayer_City: emp.taxCity || '',
        TaxPayer_Address: emp.presentAddress || emp.permanentAddress || '',
        TaxPayer_Status: emp.taxFilingStatus === 'filer' ? 'Filer' : 'Non-Filer',
        TaxPayer_Business_Name: emp.department || '',
        Taxable_Amount: taxableAmount,
        Tax_Amount: taxAmount,
      })
    }
  }

  return NextResponse.json({
    month,
    records,
    totals: {
      totalRecords: records.length,
      totalTaxableAmount: roundPKR(totalTaxableAmount),
      totalTaxAmount: roundPKR(totalTaxAmount),
    },
  })
}

// ============================================================================
// MAIN ROUTE HANDLER
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')

    switch (type) {
      case 'payroll-summary':
        return await payrollSummary(searchParams)

      case 'project-cost':
        return await projectCost(searchParams)

      case 'employee-earnings':
        return await employeeEarnings(searchParams)

      case 'tax-deduction':
        return await taxDeduction(searchParams)

      case 'employer-cost':
        return await employerCost(searchParams)

      case 'payroll-audit':
        return await payrollAudit(searchParams)

      case 'ytd-earnings':
        return await ytdEarnings(searchParams)

      case 'employee-ledger':
        return await employeeLedger(searchParams)

      case 'attendance-impact':
        return await attendanceImpact(searchParams)

      case 'project-utilization':
        return await projectUtilization(searchParams)

      case 'tax-reconciliation':
        return await taxReconciliation(searchParams)

      case 'social-contributions':
        return await socialContributions(searchParams)

      case 'exception-warnings':
        return await exceptionWarnings(searchParams)

      case 'tax-psid':
        return await taxPsid(searchParams)

      default:
        return NextResponse.json({
          error: 'Unknown report type',
          availableTypes: [
            'payroll-summary',
            'project-cost',
            'employee-earnings',
            'tax-deduction',
            'employer-cost',
            'payroll-audit',
            'ytd-earnings',
            'employee-ledger',
            'attendance-impact',
            'project-utilization',
            'tax-reconciliation',
            'social-contributions',
            'exception-warnings',
            'tax-psid',
          ],
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Payroll Reports API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
