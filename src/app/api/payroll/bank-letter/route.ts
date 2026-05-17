import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

function fmtPKR(n: number): string {
  return Math.round(n).toLocaleString('en-PK')
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })
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

// GET /api/payroll/bank-letter?period=2025-05&format=json|html
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')
    const format = searchParams.get('format') || 'json'

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: 'Invalid period format. Use YYYY-MM (e.g. 2025-05)' },
        { status: 400 }
      )
    }

    const batches = await db.payrollBatch.findMany({
      where: { period },
      include: {
        lines: {
          include: {
            employee: {
              select: {
                id: true, name: true, employeeCode: true, designation: true,
                bankName: true, bankAccountNumber: true,
              },
            },
          },
          orderBy: { employeeName: 'asc' },
        },
      },
    })

    if (batches.length === 0) {
      return NextResponse.json(
        { error: `No payroll batches found for period ${period}` },
        { status: 404 }
      )
    }

    // Deduplicate employees
    const statusRank: Record<string, number> = {
      'voucher-created': 4, approved: 3, reviewed: 2, draft: 1,
    }
    const empMap = new Map<string, any>()
    for (const batch of batches) {
      for (const line of batch.lines) {
        const existing = empMap.get(line.employeeId)
        const existingRank = statusRank[existing?.batchStatus || ''] || 0
        const newRank = statusRank[batch.status] || 0
        if (!existing || newRank > existingRank) {
          empMap.set(line.employeeId, { ...line, batchStatus: batch.status })
        }
      }
    }

    const lines = Array.from(empMap.values()).sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName)
    )

    if (lines.length === 0) {
      return NextResponse.json(
        { error: `No employees found for period ${period}` },
        { status: 404 }
      )
    }

    const rows = lines.map((line, idx) => ({
      srNo:          idx + 1,
      employeeCode:  line.employeeCode || '',
      employeeName:  line.employeeName,
      designation:   line.employee?.designation || '',
      bankName:      line.employee?.bankName || 'N/A',
      accountNumber: line.employee?.bankAccountNumber || 'N/A',
      iban:          line.employee?.bankAccountNumber || 'N/A',
      grossSalary:   Math.round(line.grossSalary),
      deductions:    Math.round(line.totalDeductions),
      netSalary:     Math.round(line.netPay),
    }))

    const totalGross = rows.reduce((s, r) => s + r.grossSalary, 0)
    const totalDeductions = rows.reduce((s, r) => s + r.deductions, 0)
    const totalNet = rows.reduce((s, r) => s + r.netSalary, 0)

    const summary = {
      period,
      periodLabel: periodLabel(period),
      totalEmployees: rows.length,
      totalGross,
      totalDeductions,
      totalNet,
      rows,
    }

    if (format === 'json') {
      return NextResponse.json({ success: true, data: summary })
    }

    // HTML format
    const settings = await db.systemSetting.findMany({
      where: { key: { in: ['company_name', 'company_address', 'company_phone', 'company_email', 'company_tax_number'] } },
    })
    const sm = Object.fromEntries(settings.map(s => [s.key, s.value]))
    const company = {
      name:    sm.company_name    || 'AcctFin ERP',
      address: sm.company_address || '',
      phone:   sm.company_phone   || '',
      ntn:     sm.company_tax_number || '',
    }

    const today = new Date()
    const ref = `BDL-${period}-${today.getFullYear()}`

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bank Disbursement Letter — ${periodLabel(period)}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#111827; background:#fff; padding:20px; }
.letterhead { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; border-bottom:3px double #1A7A4A; margin-bottom:18px; }
.co-name { font-size:16px; font-weight:700; color:#1A7A4A; margin-bottom:3px; }
.co-sub { font-size:10px; color:#6B7280; line-height:1.5; }
.ref-block { text-align:right; font-size:11px; }
.to-block { margin-bottom:14px; }
.to-label { font-size:10px; color:#6B7280; font-weight:600; margin-bottom:3px; }
.to-name { font-size:13px; font-weight:700; }
.to-detail { font-size:11px; color:#374151; }
.subject { font-size:13px; font-weight:700; text-decoration:underline; margin:14px 0 10px; }
.body-text { font-size:11px; color:#374151; line-height:1.7; margin-bottom:10px; }
table { width:100%; border-collapse:collapse; margin:14px 0; font-size:10px; }
thead th { background:#1A7A4A; color:#fff; padding:7px 8px; text-align:left; font-size:9px; font-weight:600; text-transform:uppercase; }
thead th:not(:first-child):not(:nth-child(2)) { text-align:right; }
tbody tr { border-bottom:1px solid #F3F4F6; }
tbody tr:nth-child(even) { background:#F9FAFB; }
tbody td { padding:6px 8px; color:#374151; }
tbody td:not(:first-child):not(:nth-child(2)) { text-align:right; font-family:monospace; }
.total-row { background:#F0FDF4 !important; font-weight:700; border-top:2px solid #D1D5DB; }
.amount-box { background:#1A7A4A; color:#fff; border-radius:8px; padding:12px 16px; margin:12px 0; }
.amount-label { font-size:10px; opacity:.85; margin-bottom:3px; }
.amount-figure { font-size:18px; font-weight:700; font-family:monospace; }
.amount-words { font-size:9px; opacity:.8; margin-top:3px; }
.sig-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:28px; }
.sig-box { text-align:center; }
.sig-line { border-top:1px solid #374151; width:75%; margin:36px auto 7px; }
.sig-name { font-size:11px; font-weight:600; }
.sig-title { font-size:10px; color:#6B7280; }
.footer { margin-top:16px; padding-top:8px; border-top:1px solid #E5E7EB; text-align:center; font-size:8px; color:#9CA3AF; }
</style>
</head>
<body>
<div class="letterhead">
  <div>
    <div class="co-name">${company.name}</div>
    <div class="co-sub">${company.address}</div>
    <div class="co-sub">NTN: ${company.ntn}${company.phone ? ' · Tel: ' + company.phone : ''}</div>
  </div>
  <div class="ref-block">
    <div>Ref: <strong>${ref}</strong></div>
    <div>Date: <strong>${fmtDate(today)}</strong></div>
  </div>
</div>

<div class="to-block">
  <div class="to-label">TO:</div>
  <div class="to-name">The Branch Manager</div>
  <div class="to-detail">Respective Bank Branch</div>
</div>

<div class="subject">Subject: Salary Disbursement — ${periodLabel(period)} — ${rows.length} Employees</div>

<p class="body-text">Dear Sir/Madam,</p>
<p class="body-text">
  Please be informed that we wish to disburse the salary for the month of <strong>${periodLabel(period)}</strong>
  for our <strong>${rows.length}</strong> employee(s) through bank transfer.
  Kindly credit the net salary amounts to the respective employee accounts as detailed below.
</p>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Employee Name / Code</th>
      <th>Bank</th>
      <th>Account No.</th>
      <th>Gross (Rs)</th>
      <th>Deductions (Rs)</th>
      <th>Net Payable (Rs)</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map(row => `
    <tr>
      <td>${row.srNo}</td>
      <td><strong>${row.employeeName}</strong><br><span style="font-size:9px;color:#6B7280;">${row.employeeCode} · ${row.designation}</span></td>
      <td>${row.bankName}</td>
      <td style="font-family:monospace;font-size:10px;">${row.accountNumber}</td>
      <td>${fmtPKR(row.grossSalary)}</td>
      <td style="color:#DC2626;">${fmtPKR(row.deductions)}</td>
      <td style="font-weight:700;color:#15803D;">${fmtPKR(row.netSalary)}</td>
    </tr>`).join('')}
    <tr class="total-row">
      <td colspan="4">TOTAL — ${rows.length} Employees</td>
      <td>${fmtPKR(totalGross)}</td>
      <td style="color:#DC2626;">${fmtPKR(totalDeductions)}</td>
      <td style="color:#15803D;">${fmtPKR(totalNet)}</td>
    </tr>
  </tbody>
</table>

<div class="amount-box">
  <div class="amount-label">Total Disbursement Amount</div>
  <div class="amount-figure">Rs ${fmtPKR(totalNet)}</div>
  <div class="amount-words">${numberToWords(totalNet)}</div>
</div>

<p class="body-text">Please process the above payments at your earliest convenience. For any queries, please contact our Finance Department.</p>
<p class="body-text">Yours faithfully,</p>

<div class="sig-grid">
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-name">Payroll Officer</div>
    <div class="sig-title">Prepared By</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-name">Authorized Signatory</div>
    <div class="sig-title">Approved By</div>
  </div>
</div>

<div class="footer">
  ${company.name} · Ref: ${ref} · Generated: ${fmtDate(today)}
</div>
</body>
</html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    console.error('[BANK LETTER ERROR]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
