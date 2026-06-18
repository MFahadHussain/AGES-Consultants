import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/payroll/slips/[employeeId]?period=2025-05&format=json|html
// Returns salary slip data for a single employee

function fmtPKR(n: number): string {
  return Math.round(n).toLocaleString('en-PK')
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function convert(n: number): string {
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '')
  }
  return 'Rupees ' + convert(Math.floor(num)) + ' Only'
}

function generateSlipHTML(data: any, company: any): string {
  const line = data.line
  const emp = data.employee
  const allocs: any[] = data.projectAllocations || []
  const allowances: any[] = data.allowances || []
  const taxInfo: any = data.taxBreakdown || {}

  const salRow = (label: string, amount: number, color?: string) => {
    if (amount === 0) return `<div class="sal-row"><span class="sal-label">${label}</span><span class="sal-zero">—</span></div>`
    return `<div class="sal-row"><span class="sal-label">${label}</span><span class="sal-val" style="${color ? `color:${color}` : ''}">${fmtPKR(amount)}</span></div>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Salary Slip — ${emp.name} — ${periodLabel(data.period)}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size:11px; color:#1F2937; background:#fff; padding:16px; }
.header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; border-bottom:3px solid #1A7A4A; margin-bottom:16px; }
.co-name { font-size:16px; font-weight:700; color:#1A7A4A; margin-bottom:3px; }
.co-sub { font-size:10px; color:#6B7280; line-height:1.5; }
.slip-badge { text-align:right; }
.slip-title { font-size:14px; font-weight:700; color:#1F2937; }
.slip-period { font-size:10px; color:#6B7280; margin-top:3px; }
.emp-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:8px; padding:12px 14px; margin-bottom:14px; }
.field-row { display:flex; gap:6px; margin-bottom:4px; }
.fl { font-size:9px; font-weight:600; color:#6B7280; text-transform:uppercase; letter-spacing:.04em; min-width:90px; }
.fv { font-size:11px; color:#111827; font-weight:500; }
.att-strip { display:grid; grid-template-columns:repeat(6,1fr); border:1px solid #E5E7EB; border-radius:8px; overflow:hidden; margin-bottom:14px; }
.att-cell { padding:8px 6px; text-align:center; border-right:1px solid #E5E7EB; }
.att-cell:last-child { border-right:none; }
.att-label { font-size:9px; color:#9CA3AF; text-transform:uppercase; margin-bottom:3px; }
.att-val { font-size:14px; font-weight:700; color:#111827; }
.sal-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
.sal-box { border:1px solid #E5E7EB; border-radius:8px; overflow:hidden; }
.box-hdr { padding:6px 12px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
.earn-hdr { background:#DCFCE7; color:#15803D; }
.dedu-hdr { background:#FEE2E2; color:#DC2626; }
.sal-row { display:flex; justify-content:space-between; padding:5px 12px; border-top:1px solid #F3F4F6; }
.sal-label { color:#374151; font-size:10px; }
.sal-val { font-size:10px; font-weight:500; font-family:monospace; }
.sal-zero { font-size:10px; color:#D1D5DB; }
.sal-total { background:#F3F4F6; border-top:2px solid #E5E7EB; font-weight:700; }
.net-box { background:linear-gradient(135deg,#1A7A4A,#166534); color:#fff; border-radius:10px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.net-label { font-size:11px; font-weight:500; opacity:.85; }
.net-words { font-size:9px; opacity:.7; margin-top:3px; max-width:300px; }
.net-amount { font-size:22px; font-weight:700; font-family:monospace; }
.section-box { border:1px solid #E5E7EB; border-radius:8px; padding:10px 12px; margin-bottom:12px; }
.section-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
.four-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
.mini-cell { text-align:center; padding:6px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:6px; }
.mini-label { font-size:8px; color:#6B7280; margin-bottom:2px; }
.mini-val { font-size:11px; font-weight:600; color:#111827; }
.proj-table { width:100%; border-collapse:collapse; margin-bottom:12px; }
.proj-table th { background:#F3F4F6; padding:6px 8px; font-size:9px; font-weight:600; color:#6B7280; text-transform:uppercase; border-bottom:1px solid #E5E7EB; }
.proj-table th:not(:first-child) { text-align:right; }
.proj-table td { padding:6px 8px; border-top:1px solid #F9FAFB; font-size:10px; }
.proj-table td:not(:first-child) { text-align:right; font-family:monospace; }
.proj-total { background:#F9FAFB; font-weight:700; border-top:2px solid #E5E7EB; }
.sigs { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-top:20px; padding-top:12px; border-top:1px solid #E5E7EB; }
.sig-cell { text-align:center; }
.sig-line { border-top:1px solid #9CA3AF; width:80%; margin:32px auto 6px; }
.sig-label { font-size:9px; color:#6B7280; }
.footer { margin-top:14px; padding-top:8px; border-top:1px solid #F3F4F6; text-align:center; font-size:8px; color:#9CA3AF; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="co-name">${company.name}</div>
    <div class="co-sub">${company.address}</div>
    <div class="co-sub">NTN: ${company.ntn}${company.phone ? ' · Tel: ' + company.phone : ''}</div>
  </div>
  <div class="slip-badge">
    <div class="slip-title">SALARY SLIP</div>
    <div class="slip-period">${periodLabel(data.period)}</div>
    <div class="slip-period">Payment: ${fmtDate(new Date())}</div>
  </div>
</div>

<div class="emp-grid">
  <div>
    <div class="field-row"><span class="fl">Employee Name</span><span class="fv">${emp.name}</span></div>
    <div class="field-row"><span class="fl">Employee Code</span><span class="fv">${emp.employeeCode || '—'}</span></div>
    <div class="field-row"><span class="fl">Designation</span><span class="fv">${emp.designation || '—'}</span></div>
    <div class="field-row"><span class="fl">Department</span><span class="fv">${emp.department || '—'}</span></div>
    <div class="field-row"><span class="fl">CNIC</span><span class="fv">${emp.cnic || '—'}</span></div>
  </div>
  <div>
    <div class="field-row"><span class="fl">Join Date</span><span class="fv">${fmtDate(emp.joiningDate)}</span></div>
    <div class="field-row"><span class="fl">Employment</span><span class="fv">${emp.employmentType || '—'}</span></div>
    <div class="field-row"><span class="fl">Bank</span><span class="fv">${emp.bankName || '—'}</span></div>
    <div class="field-row"><span class="fl">Account</span><span class="fv">${emp.bankAccountNumber ? '****' + emp.bankAccountNumber.slice(-4) : '—'}</span></div>
    <div class="field-row"><span class="fl">Tax Status</span><span class="fv">${emp.taxFilingStatus === 'filer' ? 'Filer' : emp.taxFilingStatus === 'non-filer' ? 'Non-Filer' : '—'}</span></div>
  </div>
</div>

<div class="att-strip">
  <div class="att-cell"><div class="att-label">Calendar</div><div class="att-val">${line.calendarDays || 30}</div></div>
  <div class="att-cell"><div class="att-label">Working</div><div class="att-val">${line.workingDays}</div></div>
  <div class="att-cell"><div class="att-label">Payable</div><div class="att-val">${line.payableDays || line.eligibleDays}</div></div>
  <div class="att-cell"><div class="att-label">Leave</div><div class="att-val">${line.leaveDays}</div></div>
  <div class="att-cell"><div class="att-label">Absent</div><div class="att-val">${line.absentDays}</div></div>
  <div class="att-cell"><div class="att-label">Daily Rate</div><div class="att-val" style="font-size:11px;">${fmtPKR(line.dailyRate)}</div></div>
</div>

<div class="sal-grid">
  <div class="sal-box">
    <div class="box-hdr earn-hdr">Earnings</div>
    ${salRow('Basic Salary', line.basicSalary)}
    ${allowances.map((a: any) => salRow(a.name, a.amount)).join('')}
    ${allowances.length === 0 && line.allowances > 0 ? salRow('Allowances', line.allowances) : ''}
    <div class="sal-row sal-total"><span class="sal-label">Gross Salary</span><span class="sal-val">Rs ${fmtPKR(line.grossSalary)}</span></div>
  </div>
  <div class="sal-box">
    <div class="box-hdr dedu-hdr">Deductions</div>
    ${salRow('Income Tax', line.incomeTax, '#DC2626')}
    ${salRow('EOBI (Employee)', line.eobiEmployee)}
    ${salRow('ESSI (Employee)', line.essiEmployee)}
    ${salRow('Provident Fund', line.pfEmployee)}
    ${salRow('Loan Recovery', line.loanDeduction)}
    ${salRow('Advance Recovery', line.advanceDeduction)}
    ${salRow('Other Deductions', line.otherDeductions)}
    <div class="sal-row sal-total"><span class="sal-label">Total Deductions</span><span class="sal-val" style="color:#DC2626;">Rs ${fmtPKR(line.totalDeductions)}</span></div>
  </div>
</div>

<div class="net-box">
  <div>
    <div class="net-label">Net Salary Payable</div>
    <div class="net-words">${numberToWords(Math.round(line.netPay))}</div>
  </div>
  <div class="net-amount">Rs ${fmtPKR(line.netPay)}</div>
</div>

${taxInfo.projectedAnnualIncome ? `
<div class="section-box">
  <div class="section-title" style="color:#92400E;">Tax Calculation</div>
  <div class="four-grid">
    <div class="mini-cell"><div class="mini-label">Annual Income</div><div class="mini-val">Rs ${fmtPKR(taxInfo.taxableIncome || 0)}</div></div>
    <div class="mini-cell"><div class="mini-label">Projected Annual</div><div class="mini-val">Rs ${fmtPKR(taxInfo.projectedAnnualIncome || 0)}</div></div>
    <div class="mini-cell"><div class="mini-label">Annual Tax</div><div class="mini-val">Rs ${fmtPKR(taxInfo.annualTax || 0)}</div></div>
    <div class="mini-cell"><div class="mini-label">Monthly Tax</div><div class="mini-val" style="color:#DC2626;">Rs ${fmtPKR(line.incomeTax)}</div></div>
  </div>
</div>` : ''}

${allocs.length > 0 ? `
<table class="proj-table">
  <thead><tr>
    <th style="text-align:left;">Project</th>
    <th>Days</th><th>Weight</th><th>Salary Share</th><th>Tax Share</th><th>Net Share</th><th>SC Share</th>
  </tr></thead>
  <tbody>
    ${allocs.map((a: any) => {
      const w = typeof a.weightPct === 'string' ? a.weightPct.replace('%', '') : Math.round((a.weight || 0) * 100)
      const taxShare = Math.round(line.incomeTax * (a.weight || 0))
      const netShare = Math.round(a.salaryShare) - taxShare
      return `<tr>
        <td><strong>${a.projectCode}</strong><br><span style="font-size:9px;color:#6B7280;">${a.projectName}</span></td>
        <td>${a.days}</td><td>${w}%</td>
        <td>Rs ${fmtPKR(a.salaryShare)}</td>
        <td style="color:#DC2626;">Rs ${fmtPKR(taxShare)}</td>
        <td style="color:#16A34A;">Rs ${fmtPKR(netShare)}</td>
        <td style="color:#D97706;">Rs ${fmtPKR(a.scShare)}</td>
      </tr>`
    }).join('')}
    <tr class="proj-total">
      <td>TOTAL</td>
      <td>${allocs.reduce((s: number, a: any) => s + (a.days || 0), 0)}</td>
      <td>100%</td>
      <td>Rs ${fmtPKR(line.grossSalary)}</td>
      <td style="color:#DC2626;">Rs ${fmtPKR(line.incomeTax)}</td>
      <td style="color:#16A34A;">Rs ${fmtPKR(line.netPay)}</td>
      <td style="color:#D97706;">Rs ${fmtPKR(line.socialCharges)}</td>
    </tr>
  </tbody>
</table>` : ''}

<div class="section-box">
  <div class="section-title">Employer Social Charges (not deducted from salary)</div>
  <div class="four-grid">
    <div class="mini-cell"><div class="mini-label">EOBI (Employer)</div><div class="mini-val">${line.eobiEmployer > 0 ? 'Rs ' + fmtPKR(line.eobiEmployer) : '—'}</div></div>
    <div class="mini-cell"><div class="mini-label">ESSI (Employer)</div><div class="mini-val">${line.essiEmployer > 0 ? 'Rs ' + fmtPKR(line.essiEmployer) : '—'}</div></div>
    <div class="mini-cell"><div class="mini-label">Gratuity</div><div class="mini-val">${line.gratuity > 0 ? 'Rs ' + fmtPKR(line.gratuity) : '—'}</div></div>
    <div class="mini-cell"><div class="mini-label">Total SC</div><div class="mini-val" style="font-weight:700;">Rs ${fmtPKR(line.socialCharges)}</div></div>
  </div>
</div>

<div class="sigs">
  <div class="sig-cell"><div class="sig-line"></div><div class="sig-label">Employee Signature</div></div>
  <div class="sig-cell"><div class="sig-line"></div><div class="sig-label">HR Manager</div></div>
  <div class="sig-cell"><div class="sig-line"></div><div class="sig-label">Authorized Signatory</div></div>
</div>

<div class="footer">
  System-generated salary slip · ${company.name} · ${periodLabel(data.period)} · Generated: ${new Date().toLocaleDateString('en-PK')}
</div>
</body>
</html>`
}

async function GET_HANDLER(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')
    const format = searchParams.get('format') || 'json'

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: 'Invalid period format. Use YYYY-MM (e.g. 2025-05)' },
        { status: 400 }
      )
    }

    // Find payroll line for this employee in this period
    const batches = await db.payrollBatch.findMany({
      where: { period },
      include: {
        lines: {
          where: { employeeId },
          include: {
            employee: {
              select: {
                id: true, name: true, employeeCode: true, designation: true,
                department: true, cnic: true, ntn: true, email: true,
                bankName: true, bankAccountNumber: true, joiningDate: true,
                employmentType: true, taxFilingStatus: true, taxCity: true,
                permanentAddress: true, presentAddress: true,
              },
            },
          },
        },
      },
    })

    // Find best line (most advanced status)
    const statusRank: Record<string, number> = {
      'voucher-created': 4, approved: 3, reviewed: 2, draft: 1,
    }
    let bestLine: any = null
    let bestBatch: any = null
    for (const batch of batches) {
      for (const line of batch.lines) {
        const rank = statusRank[batch.status] || 0
        if (!bestLine || rank > (statusRank[bestBatch?.status] || 0)) {
          bestLine = line
          bestBatch = batch
        }
      }
    }

    if (!bestLine) {
      return NextResponse.json(
        { error: `No approved payroll found for employee in period ${period}. Ensure batch status is Approved or Vouchers Created.` },
        { status: 404 }
      )
    }

    // Parse JSON fields
    let projectAllocations: any[] = []
    let allowances: any[] = []
    let taxBreakdown: any = {}
    try { projectAllocations = bestLine.projectAllocations ? JSON.parse(bestLine.projectAllocations) : [] } catch {}
    try { allowances = bestLine.allowanceDetails ? JSON.parse(bestLine.allowanceDetails) : [] } catch {}
    try { taxBreakdown = bestLine.taxBreakdown ? JSON.parse(bestLine.taxBreakdown) : {} } catch {}

    const data = {
      period,
      line: bestLine,
      employee: bestLine.employee,
      projectAllocations,
      allowances,
      taxBreakdown,
      batchNumber: bestBatch.batchNumber,
    }

    if (format === 'json') {
      return NextResponse.json({ success: true, data })
    }

    // HTML format — get company settings
    const settings = await db.systemSetting.findMany({
      where: { key: { in: ['company_name', 'company_address', 'company_phone', 'company_email', 'company_tax_number'] } },
    })
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]))

    const company = {
      name:    settingsMap.company_name    || 'AcctFin ERP',
      address: settingsMap.company_address || '',
      phone:   settingsMap.company_phone   || '',
      email:   settingsMap.company_email   || '',
      ntn:     settingsMap.company_tax_number || '',
    }

    const html = generateSlipHTML(data, company)

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    console.error('[PAYSLIP ERROR]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const GET = withAudit('payroll', GET_HANDLER);
