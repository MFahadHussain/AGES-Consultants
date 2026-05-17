import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findAccountByRole } from '@/lib/account-roles'

// ============================================================
// Salary Voucher API
// GET  /api/salary-vouchers  - list with filters
// POST /api/salary-vouchers  - generate | workflow actions
// ============================================================

// ── Account resolution ──────────────────────────────────────

async function resolveGLAccount(
  employeeAccountId: string | null,
  componentType: string,
  roleKey: string,
  fallbackCodePrefix: string,
  fallbackName: string
): Promise<{ id: string; code: string; name: string } | null> {
  // 1. Employee-specific
  if (employeeAccountId) {
    const acc = await db.account.findUnique({
      where: { id: employeeAccountId },
      select: { id: true, code: true, name: true },
    })
    if (acc) return acc
  }

  // 2. PayrollAccountMapping
  const mapping = await db.payrollAccountMapping.findFirst({
    where: { componentType, isActive: true },
  })
  const mappedId = mapping?.debitAccountId || mapping?.creditAccountId
  if (mappedId) {
    const acc = await db.account.findUnique({
      where: { id: mappedId },
      select: { id: true, code: true, name: true },
    })
    if (acc) return acc
  }

  // 3. Account role
  const roleAcc = await findAccountByRole(roleKey)
  if (roleAcc) {
    return { id: roleAcc.id, code: roleAcc.code, name: roleAcc.name }
  }

  // 4. Code prefix
  const codeAccs = await db.account.findMany({
    where: { code: { startsWith: fallbackCodePrefix }, isActive: true, allowPosting: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'desc' },
    take: 1,
  })
  if (codeAccs.length > 0) return codeAccs[0]

  // 5. Name pattern
  const nameAcc = await db.account.findFirst({
    where: { name: { contains: fallbackName }, isActive: true, allowPosting: true },
    select: { id: true, code: true, name: true },
  })
  return nameAcc
}

// ── Voucher number generator ─────────────────────────────────

async function nextVoucherNumber(projectCode: string, period: string): Promise<string> {
  const prefix = `SV-${projectCode.toUpperCase().replace(/[\s\-]+/g, '').substring(0, 8)}-${period}`
  const existing = await db.salaryVoucher.findMany({
    where: { voucherNumber: { startsWith: prefix } },
    select: { voucherNumber: true },
  })
  let max = 0
  for (const v of existing) {
    const parts = v.voucherNumber.split('-')
    const seq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(seq) && seq > max) max = seq
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

// ── GET ──────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const batchId = searchParams.get('batchId')
    const period = searchParams.get('period')
    const projectId = searchParams.get('projectId')
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    if (id) {
      const voucher = await db.salaryVoucher.findUnique({
        where: { id },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      })
      if (!voucher) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(voucher)
    }

    const where: any = {}
    if (batchId) where.payrollBatchId = batchId
    if (period) where.period = period
    if (projectId) where.projectId = projectId
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (search) {
      where.OR = [
        { voucherNumber: { contains: search, mode: 'insensitive' } },
        { employeeName: { contains: search, mode: 'insensitive' } },
        { projectName: { contains: search, mode: 'insensitive' } },
        { projectCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const vouchers = await db.salaryVoucher.findMany({
      where,
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
      orderBy: [{ period: 'desc' }, { projectCode: 'asc' }, { employeeName: 'asc' }],
    })

    return NextResponse.json(vouchers)
  } catch (err) {
    console.error('SalaryVoucher GET error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body

    // ── GENERATE VOUCHERS ──────────────────────────────────
    if (action === 'generate') {
      return await handleGenerate(body)
    }

    // ── WORKFLOW ACTIONS ───────────────────────────────────
    if (action === 'submit') return await handleWorkflow(body, 'submit')
    if (action === 'approve') return await handleWorkflow(body, 'approve')
    if (action === 'post') return await handleWorkflow(body, 'post')
    if (action === 'reverse') return await handleWorkflow(body, 'reverse')
    if (action === 'cancel') return await handleWorkflow(body, 'cancel')

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    console.error('SalaryVoucher POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── Generate handler ─────────────────────────────────────────

async function handleGenerate(body: any) {
  const { batchId, mode, projectIds, employeeIds, createdBy = 'system' } = body

  if (!batchId) return NextResponse.json({ error: 'batchId is required' }, { status: 400 })

  // Load batch with lines
  const batch = await db.payrollBatch.findUnique({
    where: { id: batchId },
    include: { lines: { orderBy: { employeeName: 'asc' } } },
  })
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  if (batch.status !== 'approved' && batch.status !== 'voucher-created') {
    return NextResponse.json({ error: 'Batch must be Approved before generating vouchers' }, { status: 400 })
  }

  // Only approved lines
  const approvedLines = batch.lines.filter(l => l.lineStatus === 'approved')
  if (approvedLines.length === 0) {
    return NextResponse.json({ error: 'No approved lines found. Approve employee lines first.' }, { status: 400 })
  }

  // Load employee GL accounts
  const empIds = [...new Set(approvedLines.map(l => l.employeeId))]
  const employees = await db.employee.findMany({
    where: { id: { in: empIds } },
    select: {
      id: true,
      salaryExpenseAccountId: true,
      scExpenseAccountId: true,
      salaryPayableAccountId: true,
      scPayableAccountId: true,
      taxPayableAccountId: true,
    },
  })
  const empMap = new Map(employees.map(e => [e.id, e]))

  // Account cache
  const accCache = new Map<string, { id: string; code: string; name: string } | null>()
  const getAcc = async (empAccId: string | null, comp: string, role: string, prefix: string, name: string) => {
    const key = `${empAccId || ''}|${comp}`
    if (accCache.has(key)) return accCache.get(key)!
    const result = await resolveGLAccount(empAccId, comp, role, prefix, name)
    accCache.set(key, result)
    return result
  }

  const created: any[] = []
  const skipped: any[] = []
  const errors: any[] = []

  for (const line of approvedLines) {
    // Parse project allocations
    let allocs: any[] = []
    try { allocs = line.projectAllocations ? JSON.parse(line.projectAllocations) : [] } catch {}
    let contracts: any[] = []
    try { contracts = line.contractEarnings ? JSON.parse(line.contractEarnings) : [] } catch {}

    // Build allocation list
    let allocList: Array<{
      projectId: string; projectCode: string; projectName: string
      days: number; weight: number; salaryShare: number; scShare: number
    }> = []

    if (allocs.length > 0) {
      allocList = allocs.map((a: any) => ({
        projectId: a.projectId,
        projectCode: a.projectCode,
        projectName: a.projectName,
        days: a.days || 0,
        weight: a.weight || 0,
        salaryShare: Math.round(a.salaryShare || 0),
        scShare: Math.round(a.scShare || 0),
      }))
    } else if (contracts.length > 0) {
      const totalEarned = contracts.reduce((s: number, c: any) => s + (c.earnedSalary || 0), 0)
      allocList = contracts.map((c: any) => ({
        projectId: c.projectId,
        projectCode: c.projectCode,
        projectName: c.projectName,
        days: c.daysWorked || 0,
        weight: totalEarned > 0 ? (c.earnedSalary || 0) / totalEarned : 0,
        salaryShare: Math.round(c.earnedSalary || 0),
        scShare: Math.round(c.scShare || 0),
      }))
    } else if (line.projectId) {
      const proj = await db.project.findUnique({ where: { id: line.projectId }, select: { code: true, name: true } })
      allocList = [{
        projectId: line.projectId,
        projectCode: proj?.code || 'UNK',
        projectName: proj?.name || 'Unknown',
        days: line.payableDays || line.calendarDays || 0,
        weight: 1,
        salaryShare: Math.round(line.grossSalary),
        scShare: Math.round(line.socialCharges),
      }]
    }

    // Apply mode filter
    const filteredAllocs = allocList.filter(a => {
      if (a.days === 0 || a.weight === 0) return false
      if (mode === 'PROJECT' && projectIds?.length > 0) return projectIds.includes(a.projectId)
      if (mode === 'EMPLOYEE') return true
      if (mode === 'COMBINED') {
        const empMatch = !employeeIds?.length || employeeIds.includes(line.employeeId)
        const projMatch = !projectIds?.length || projectIds.includes(a.projectId)
        return empMatch && projMatch
      }
      return true
    })

    // Apply employee filter for EMPLOYEE mode
    if (mode === 'EMPLOYEE' && employeeIds?.length > 0 && !employeeIds.includes(line.employeeId)) continue
    if (mode === 'COMBINED' && employeeIds?.length > 0 && !employeeIds.includes(line.employeeId)) continue

    if (filteredAllocs.length === 0) {
      skipped.push({ employeeId: line.employeeId, employeeName: line.employeeName, reason: 'No matching allocations' })
      continue
    }

    const emp = empMap.get(line.employeeId)

    // IMPORTANT: Use the ORIGINAL allocation weight (employee's actual proportion
    // across ALL projects), NOT normalized against filtered subset.
    // e.g. if DASU = 16% of total, tax share = 16% of total tax - regardless of
    // whether other projects are selected or not.
    const originalTotalWeight = allocList.reduce((s, a) => s + a.weight, 0)

    for (const alloc of filteredAllocs) {
      // Check duplicate - block if any non-cancelled voucher exists for this
      // employee + project + period (regardless of which batch it came from)
      const existing = await db.salaryVoucher.findFirst({
        where: {
          employeeId: line.employeeId,
          projectId: alloc.projectId,
          period: batch.period,
          status: { notIn: ['cancelled', 'reversed'] },
        },
        select: { id: true, voucherNumber: true, status: true },
      })
      if (existing) {
        const isPaid = existing.status === 'posted'
        skipped.push({
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          projectCode: alloc.projectCode,
          reason: isPaid
            ? `Already paid - voucher ${existing.voucherNumber} has been sent to GL`
            : `Duplicate - voucher ${existing.voucherNumber} already exists (${existing.status})`,
        })
        continue
      }

      // Use original weight (proportion of this project in employee's total salary)
      // This ensures tax/deductions are always split by actual attendance proportion
      const w = originalTotalWeight > 0 ? alloc.weight / originalTotalWeight : 0
      const grossShare = alloc.salaryShare
      const scShare = alloc.scShare
      const taxShare = Math.round(line.incomeTax * w)
      const eobiShare = Math.round(line.eobiEmployee * w)
      const pfShare = Math.round(line.pfEmployee * w)
      const essiShare = Math.round(line.essiEmployee * w)
      const loanShare = Math.round(line.loanDeduction * w)
      const netSalaryShare = grossShare - taxShare - eobiShare - pfShare - essiShare - loanShare

      if (netSalaryShare < 0) {
        errors.push({
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          projectCode: alloc.projectCode,
          message: `Net salary is negative (Rs ${netSalaryShare.toLocaleString()}). Review deductions.`,
        })
        continue
      }

      // Resolve accounts
      const salaryExpAcc = await getAcc(emp?.salaryExpenseAccountId || null, 'SALARY_EXPENSE', 'SALARY_EXPENSE', '05-01-01', 'Salary')
      const scExpAcc = await getAcc(emp?.scExpenseAccountId || null, 'SOCIAL_CHARGES', 'SOCIAL_CHARGES', '05-01-02', 'Social Charges')
      const salaryPayAcc = await getAcc(emp?.salaryPayableAccountId || null, 'SALARY_PAYABLE', 'SALARY_PAYABLE', '03-02-02', 'Salary Payable')
      const scPayAcc = await getAcc(emp?.scPayableAccountId || null, 'SOCIAL_CHARGES_PAYABLE', 'SOCIAL_CHARGES_PAYABLE', '03-02-03', 'Social Charges Payable')
      const taxPayAcc = await getAcc(emp?.taxPayableAccountId || null, 'INCOME_TAX_PAYABLE', 'INCOME_TAX_PAYABLE', '03-02-07', 'WHT Payable')
      const eobiPayAcc = await getAcc(null, 'EOBI_EMPLOYEE', 'EOBI_PAYABLE', '03-02-03-0001', 'EOBI Payable')
      const pfPayAcc = await getAcc(null, 'PF_EMPLOYEE', 'PROVIDENT_FUND_PAYABLE', '03-02-03-0002', 'Provident Fund Payable')
      const essiPayAcc = await getAcc(null, 'ESSI_EMPLOYEE', 'ESSI_PAYABLE', '03-02-03', 'ESSI Payable')
      const loanPayAcc = await getAcc(null, 'LOAN_DEDUCTION', 'LOAN_RECEIVABLE', '01-02-12', 'Loan Receivable')

      if (!salaryExpAcc || !salaryPayAcc) {
        errors.push({
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          projectCode: alloc.projectCode,
          message: `Missing GL accounts. Configure Salary Expense and Salary Payable accounts.`,
        })
        continue
      }

      // Build journal lines
      const projLabel = alloc.projectCode
      const lines_: Array<{
        lineNumber: number; accountId: string; accountCode: string; accountName: string
        description: string; debit: number; credit: number; lineType: string
      }> = []

      let ln = 0
      const addLine = (acc: { id: string; code: string; name: string }, dr: number, cr: number, desc: string, type: string) => {
        ln++
        lines_.push({ lineNumber: ln, accountId: acc.id, accountCode: acc.code, accountName: acc.name, description: desc, debit: dr, credit: cr, lineType: type })
      }

      // DR: Salary Expense
      addLine(salaryExpAcc, grossShare, 0, `Salary - ${line.employeeName} - ${projLabel}`, 'SALARY_EXPENSE')
      // DR: SC Expense
      if (scShare > 0 && scExpAcc) addLine(scExpAcc, scShare, 0, `SC - ${line.employeeName} - ${projLabel}`, 'SC_EXPENSE')
      // CR: Net Salary Payable
      addLine(salaryPayAcc, 0, netSalaryShare, `Net Salary - ${line.employeeName}`, 'SALARY_PAYABLE')
      // CR: Tax Payable
      if (taxShare > 0 && taxPayAcc) addLine(taxPayAcc, 0, taxShare, `Income Tax - ${line.employeeName}`, 'TAX_PAYABLE')
      // CR: SC Payable
      if (scShare > 0 && scPayAcc) addLine(scPayAcc, 0, scShare, `SC Payable - ${line.employeeName}`, 'SC_PAYABLE')
      // CR: EOBI Payable
      if (eobiShare > 0 && eobiPayAcc) addLine(eobiPayAcc, 0, eobiShare, `EOBI - ${line.employeeName}`, 'EOBI_PAYABLE')
      // CR: PF Payable
      if (pfShare > 0 && pfPayAcc) addLine(pfPayAcc, 0, pfShare, `PF - ${line.employeeName}`, 'PF_PAYABLE')
      // CR: ESSI Payable
      if (essiShare > 0 && essiPayAcc) addLine(essiPayAcc, 0, essiShare, `ESSI - ${line.employeeName}`, 'ESSI_PAYABLE')
      // CR: Loan Recovery
      if (loanShare > 0 && loanPayAcc) addLine(loanPayAcc, 0, loanShare, `Loan Recovery - ${line.employeeName}`, 'LOAN_PAYABLE')

      const totalDebit = lines_.reduce((s, l) => s + l.debit, 0)
      const totalCredit = lines_.reduce((s, l) => s + l.credit, 0)
      const isBalanced = Math.abs(totalDebit - totalCredit) <= 1

      if (!isBalanced) {
        errors.push({
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          projectCode: alloc.projectCode,
          message: `Voucher unbalanced. Dr: Rs ${totalDebit.toLocaleString()} Cr: Rs ${totalCredit.toLocaleString()} Diff: Rs ${Math.abs(totalDebit - totalCredit).toLocaleString()}`,
        })
        continue
      }

      // Validate all account IDs exist
      const accIds = [...new Set(lines_.map(l => l.accountId))]
      const existingAccs = await db.account.findMany({ where: { id: { in: accIds } }, select: { id: true } })
      const existingAccIds = new Set(existingAccs.map(a => a.id))
      const missingAccs = accIds.filter(id => !existingAccIds.has(id))
      if (missingAccs.length > 0) {
        errors.push({
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          projectCode: alloc.projectCode,
          message: `${missingAccs.length} GL account(s) not found. Configure PayrollAccountMapping.`,
        })
        continue
      }

      const voucherNumber = await nextVoucherNumber(alloc.projectCode, batch.period)

      const voucher = await db.salaryVoucher.create({
        data: {
          voucherNumber,
          date: new Date(),
          period: batch.period,
          status: 'draft',
          narration: `Salary - ${line.employeeName} - ${alloc.projectName} - ${batch.period}`,
          totalDebit,
          totalCredit,
          isBalanced,
          projectId: alloc.projectId,
          projectCode: alloc.projectCode,
          projectName: alloc.projectName,
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeCode: line.employeeCode || '',
          designation: '',
          grossShare,
          taxShare,
          netSalaryShare,
          scShare,
          eobiShare,
          pfShare,
          essiShare,
          loanShare,
          allocationDays: alloc.days,
          allocationWeight: alloc.weight,
          payrollBatchId: batchId,
          payrollBatchNumber: batch.batchNumber,
          createdBy,
          lines: { create: lines_ },
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      })

      created.push(voucher)
    }
  }

  // Mark batch as voucher-created
  if (created.length > 0) {
    await db.payrollBatch.update({
      where: { id: batchId },
      data: { status: 'voucher-created' },
    })
    await db.payrollBatchLine.updateMany({
      where: { batchId, lineStatus: 'approved' },
      data: { lineStatus: 'voucher-created' },
    })
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    errors: errors.length,
    vouchers: created,
    skippedList: skipped,
    errorList: errors,
    message: `${created.length} voucher(s) created${errors.length > 0 ? `, ${errors.length} error(s)` : ''}${skipped.length > 0 ? `, ${skipped.length} skipped` : ''}`,
  })
}

// ── Workflow handler ─────────────────────────────────────────

async function handleWorkflow(body: any, action: string) {
  const { voucherId, voucherIds, userId = 'system', reason } = body
  const ids: string[] = voucherIds || (voucherId ? [voucherId] : [])
  if (ids.length === 0) return NextResponse.json({ error: 'voucherId or voucherIds required' }, { status: 400 })

  const results: any[] = []

  for (const id of ids) {
    const voucher = await db.salaryVoucher.findUnique({ where: { id }, include: { lines: true } })
    if (!voucher) { results.push({ id, error: 'Not found' }); continue }

    let updateData: any = {}

    if (action === 'submit') {
      if (voucher.status !== 'draft') { results.push({ id, error: 'Only draft vouchers can be submitted' }); continue }
      updateData = { status: 'submitted', submittedBy: userId, submittedAt: new Date() }
    } else if (action === 'approve') {
      if (voucher.status !== 'submitted') { results.push({ id, error: 'Only submitted vouchers can be approved' }); continue }
      updateData = { status: 'approved', approvedBy: userId, approvedAt: new Date() }
    } else if (action === 'post') {
      if (voucher.status !== 'approved') { results.push({ id, error: 'Only approved vouchers can be posted to GL' }); continue }
      if (!voucher.isBalanced) { results.push({ id, error: 'Voucher is not balanced. Cannot post.' }); continue }
      updateData = { status: 'posted', postedBy: userId, postedAt: new Date() }
    } else if (action === 'reverse') {
      if (voucher.status !== 'posted') { results.push({ id, error: 'Only posted vouchers can be reversed' }); continue }
      updateData = { status: 'reversed', reversedBy: userId, reversedAt: new Date(), reversalReason: reason || 'Manual reversal' }
    } else if (action === 'cancel') {
      if (voucher.status === 'posted') { results.push({ id, error: 'Posted vouchers cannot be cancelled' }); continue }
      updateData = { status: 'cancelled' }
    }

    const updated = await db.salaryVoucher.update({
      where: { id },
      data: updateData,
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
    results.push(updated)
  }

  return NextResponse.json({ results, count: results.filter(r => !r.error).length })
}
