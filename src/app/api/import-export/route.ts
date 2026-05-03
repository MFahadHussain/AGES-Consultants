import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// GET: Fetch import/export logs OR export data
// Query params:
//   - mode=logs (default): returns import/export logs
//   - mode=export&entity=accounts|customers|suppliers|projects|vouchers|trial_balance|balance_sheet|pnl|general_ledger|...
// ============================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'logs'

    // ─── Export data mode ─────────────────────────────────────────
    if (mode === 'export') {
      const entity = searchParams.get('entity')
      const dateFrom = searchParams.get('dateFrom')
      const dateTo = searchParams.get('dateTo')

      if (!entity) {
        return NextResponse.json({ error: 'entity parameter is required' }, { status: 400 })
      }

      let exportData: any[] = []
      let headers: string[] = []
      let fileName = `${entity}_export`

      switch (entity) {
        // ─── Entity exports ─────────────────────────────────────
        case 'accounts': {
          const accounts = await db.account.findMany({
            where: { isActive: true },
            include: { parent: { select: { code: true, name: true } } },
            orderBy: { code: 'asc' },
          })
          headers = ['Code', 'Name', 'Account Type', 'Sub Type', 'Level', 'Allow Posting', 'Active', 'Description', 'Parent Code']
          exportData = accounts.map(a => ({
            Code: a.code,
            Name: a.name,
            'Account Type': a.accountType,
            'Sub Type': a.subType || '',
            Level: a.level,
            'Allow Posting': a.allowPosting ? 'Yes' : 'No',
            Active: a.isActive ? 'Yes' : 'No',
            Description: a.description || '',
            'Parent Code': a.parent?.code || '',
          }))
          break
        }

        case 'customers': {
          const customers = await db.customer.findMany({ orderBy: { code: 'asc' } })
          headers = ['Code', 'Name', 'Contact Person', 'Email', 'Phone', 'Address', 'Credit Terms', 'Credit Limit', 'Tax Number', 'Active', 'Opening Balance']
          exportData = customers.map(c => ({
            Code: c.code,
            Name: c.name,
            'Contact Person': c.contactPerson || '',
            Email: c.email || '',
            Phone: c.phone || '',
            Address: c.address || '',
            'Credit Terms': c.creditTerms,
            'Credit Limit': c.creditLimit,
            'Tax Number': c.taxNumber || '',
            Active: c.isActive ? 'Yes' : 'No',
            'Opening Balance': c.openingBalance,
          }))
          break
        }

        case 'suppliers': {
          const suppliers = await db.supplier.findMany({ orderBy: { code: 'asc' } })
          headers = ['Code', 'Name', 'Contact Person', 'Email', 'Phone', 'Address', 'Credit Terms', 'Tax Number', 'Bank Name', 'Bank Account', 'Active', 'Opening Balance']
          exportData = suppliers.map(s => ({
            Code: s.code,
            Name: s.name,
            'Contact Person': s.contactPerson || '',
            Email: s.email || '',
            Phone: s.phone || '',
            Address: s.address || '',
            'Credit Terms': s.creditTerms,
            'Tax Number': s.taxNumber || '',
            'Bank Name': s.bankName || '',
            'Bank Account': s.bankAccount || '',
            Active: s.isActive ? 'Yes' : 'No',
            'Opening Balance': s.openingBalance,
          }))
          break
        }

        case 'projects': {
          const projects = await db.project.findMany({ orderBy: { code: 'asc' } })
          headers = ['Code', 'Name', 'Project Type', 'Description', 'Status', 'Start Date', 'End Date', 'Is Head Office', 'Reporting Currency', 'Sort Order']
          exportData = projects.map(p => ({
            Code: p.code,
            Name: p.name,
            'Project Type': p.projectType,
            Description: p.description || '',
            Status: p.status,
            'Start Date': p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
            'End Date': p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
            'Is Head Office': p.isHeadOffice ? 'Yes' : 'No',
            'Reporting Currency': p.reportingCurrency,
            'Sort Order': p.sortOrder,
          }))
          break
        }

        case 'vouchers': {
          const voucherWhere: any = { status: { in: ['approved', 'posted'] } }
          if (dateFrom || dateTo) {
            voucherWhere.date = {}
            if (dateFrom) voucherWhere.date.gte = new Date(dateFrom)
            if (dateTo) voucherWhere.date.lte = new Date(dateTo + 'T23:59:59.999Z')
          }
          const vouchers = await db.voucher.findMany({
            where: voucherWhere,
            include: {
              entries: {
                include: {
                  account: { select: { code: true, name: true } },
                },
                orderBy: { lineNumber: 'asc' },
              },
              project: { select: { code: true } },
            },
            orderBy: { date: 'asc' },
          })
          headers = ['Voucher Number', 'Type', 'Date', 'Narration', 'Reference', 'Payee', 'Status', 'Project', 'Line No', 'Account Code', 'Account Name', 'Debit', 'Credit', 'Description']
          exportData = []
          for (const v of vouchers) {
            for (const e of v.entries) {
              exportData.push({
                'Voucher Number': v.voucherNumber,
                Type: v.voucherTypeName || v.voucherType,
                Date: new Date(v.date).toISOString().split('T')[0],
                Narration: v.narration,
                Reference: v.reference || '',
                Payee: v.payeeName || '',
                Status: v.status,
                Project: v.project?.code || '',
                'Line No': e.lineNumber,
                'Account Code': e.account.code,
                'Account Name': e.account.name,
                Debit: e.debit,
                Credit: e.credit,
                Description: e.description || '',
              })
            }
          }
          break
        }

        // ─── Report exports ─────────────────────────────────────
        case 'trial_balance': {
          const accounts = await db.account.findMany({
            where: { isActive: true, allowPosting: true },
            orderBy: { code: 'asc' },
          })
          const voucherWhere: any = { status: { in: ['approved', 'posted'] } }
          if (dateFrom || dateTo) {
            voucherWhere.date = {}
            if (dateFrom) voucherWhere.date.gte = new Date(dateFrom)
            if (dateTo) voucherWhere.date.lte = new Date(dateTo + 'T23:59:59.999Z')
          }
          headers = ['Account Code', 'Account Name', 'Account Type', 'Total Debit', 'Total Credit', 'Balance', 'Balance Type']
          exportData = []
          for (const account of accounts) {
            const result = await db.voucherEntry.aggregate({
              _sum: { debit: true, credit: true },
              where: { accountId: account.id, voucher: voucherWhere },
            })
            const debit = result._sum.debit || 0
            const credit = result._sum.credit || 0
            const balance = debit - credit
            if (debit !== 0 || credit !== 0) {
              exportData.push({
                'Account Code': account.code,
                'Account Name': account.name,
                'Account Type': account.accountType,
                'Total Debit': debit,
                'Total Credit': credit,
                'Balance': Math.abs(balance),
                'Balance Type': balance >= 0 ? 'Debit' : 'Credit',
              })
            }
          }
          fileName = `trial_balance_${dateTo || new Date().toISOString().split('T')[0]}`
          break
        }

        case 'balance_sheet': {
          const accounts = await db.account.findMany({
            where: { isActive: true, accountType: { in: ['ASSET', 'LIABILITY', 'EQUITY'] }, allowPosting: true },
            orderBy: { code: 'asc' },
          })
          const voucherWhere: any = { status: { in: ['approved', 'posted'] } }
          if (dateFrom || dateTo) {
            voucherWhere.date = {}
            if (dateFrom) voucherWhere.date.gte = new Date(dateFrom)
            if (dateTo) voucherWhere.date.lte = new Date(dateTo + 'T23:59:59.999Z')
          }
          headers = ['Account Code', 'Account Name', 'Account Type', 'Sub Type', 'Balance']
          exportData = []
          for (const account of accounts) {
            const result = await db.voucherEntry.aggregate({
              _sum: { debit: true, credit: true },
              where: { accountId: account.id, voucher: voucherWhere },
            })
            const debit = result._sum.debit || 0
            const credit = result._sum.credit || 0
            let balance = account.accountType === 'ASSET' ? debit - credit : credit - debit
            if (account.subType === 'ACCUMULATED_DEPRECIATION' || account.subType === 'ACCUMULATED_AMORTIZATION' || account.subType === 'CONTRA_ASSET') {
              balance = credit - debit
            }
            exportData.push({
              'Account Code': account.code,
              'Account Name': account.name,
              'Account Type': account.accountType,
              'Sub Type': account.subType || '',
              'Balance': balance,
            })
          }
          fileName = `balance_sheet_${dateTo || new Date().toISOString().split('T')[0]}`
          break
        }

        case 'pnl': {
          const accounts = await db.account.findMany({
            where: { isActive: true, accountType: { in: ['INCOME', 'EXPENSE'] }, allowPosting: true },
            orderBy: { code: 'asc' },
          })
          const voucherWhere: any = { status: { in: ['approved', 'posted'] } }
          if (dateFrom || dateTo) {
            voucherWhere.date = {}
            if (dateFrom) voucherWhere.date.gte = new Date(dateFrom)
            if (dateTo) voucherWhere.date.lte = new Date(dateTo + 'T23:59:59.999Z')
          }
          headers = ['Account Code', 'Account Name', 'Account Type', 'Sub Type', 'Balance']
          exportData = []
          for (const account of accounts) {
            const result = await db.voucherEntry.aggregate({
              _sum: { debit: true, credit: true },
              where: { accountId: account.id, voucher: voucherWhere },
            })
            const debit = result._sum.debit || 0
            const credit = result._sum.credit || 0
            const balance = account.accountType === 'INCOME' ? credit - debit : debit - credit
            exportData.push({
              'Account Code': account.code,
              'Account Name': account.name,
              'Account Type': account.accountType,
              'Sub Type': account.subType || '',
              'Balance': balance,
            })
          }
          fileName = `pnl_${dateFrom || 'start'}_to_${dateTo || 'end'}`
          break
        }

        case 'general_ledger': {
          const accountId = searchParams.get('accountId')
          if (!accountId) {
            return NextResponse.json({ error: 'accountId is required for General Ledger export' }, { status: 400 })
          }
          const account = await db.account.findUnique({ where: { id: accountId } })
          if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 })
          }
          const voucherWhere: any = { status: { in: ['approved', 'posted'] } }
          if (dateFrom || dateTo) {
            voucherWhere.date = {}
            if (dateFrom) voucherWhere.date.gte = new Date(dateFrom)
            if (dateTo) voucherWhere.date.lte = new Date(dateTo + 'T23:59:59.999Z')
          }
          const entries = await db.voucherEntry.findMany({
            where: { accountId, voucher: voucherWhere },
            include: {
              voucher: { select: { voucherNumber: true, date: true, narration: true, voucherTypeName: true } },
            },
            orderBy: { voucher: { date: 'asc' } },
          })
          headers = ['Date', 'Voucher Number', 'Voucher Type', 'Narration', 'Description', 'Debit', 'Credit', 'Balance']
          let runningBalance = 0
          exportData = entries.map(e => {
            runningBalance += e.debit - e.credit
            return {
              'Date': new Date(e.voucher.date).toISOString().split('T')[0],
              'Voucher Number': e.voucher.voucherNumber,
              'Voucher Type': e.voucher.voucherTypeName,
              'Narration': e.voucher.narration,
              'Description': e.description || '',
              'Debit': e.debit,
              'Credit': e.credit,
              'Balance': runningBalance,
            }
          })
          fileName = `general_ledger_${account.code}`
          break
        }

        default:
          return NextResponse.json({ error: `Unknown export entity: ${entity}` }, { status: 400 })
      }

      // Log the export
      try {
        await db.exportLog.create({
          data: {
            exportType: entity,
            format: 'CSV',
            parameters: JSON.stringify({ dateFrom, dateTo }),
            exportedBy: 'system',
          },
        })
      } catch (logErr) {
        console.error('Export log creation failed:', logErr)
      }

      return NextResponse.json({
        success: true,
        entity,
        headers,
        data: exportData,
        totalRows: exportData.length,
        fileName,
      })
    }

    // ─── Logs mode (default) ─────────────────────────────────────
    const [imports, exports] = await Promise.all([
      db.importLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      db.exportLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    ])

    return NextResponse.json({ imports, exports })
  } catch (error) {
    console.error('Import/Export GET error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// ============================================================
// POST: Import data into entity
// Body: { entity: 'accounts'|'customers'|'suppliers'|'projects'|'vouchers', data: [...] }
// Returns: { success: true, imported: N, skipped: N, errors: [...] }
// ============================================================

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // ─── Import processing ─────────────────────────────────────────
    if (body.entity && body.data) {
      const { entity, data } = body as { entity: string; data: Record<string, any>[] }

      if (!Array.isArray(data) || data.length === 0) {
        return NextResponse.json({ error: 'Data array is required and must not be empty' }, { status: 400 })
      }

      let imported = 0
      let skipped = 0
      const errors: { row: number; message: string }[] = []

      switch (entity) {
        // ─── Accounts import ────────────────────────────────────
        case 'accounts': {
          for (let i = 0; i < data.length; i++) {
            const row = data[i]
            const code = (row.Code || row.code || '')?.toString().trim()
            const name = (row.Name || row.name || '')?.toString().trim()
            const accountType = (row['Account Type'] || row.accountType || row.account_type || '')?.toString().trim().toUpperCase()

            if (!code || !name || !accountType) {
              errors.push({ row: i + 1, message: 'Missing required fields: Code, Name, Account Type' })
              continue
            }

            // Validate account type
            const validTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']
            if (!validTypes.includes(accountType)) {
              errors.push({ row: i + 1, message: `Invalid Account Type: ${accountType}. Must be one of: ${validTypes.join(', ')}` })
              continue
            }

            // Check for duplicate
            const existing = await db.account.findUnique({ where: { code } })
            if (existing) {
              skipped++
              continue
            }

            try {
              // Find parent by code if specified
              let parentId: string | null = null
              const parentCode = (row['Parent Code'] || row.parentCode || row.parent_code || '')?.toString().trim()
              if (parentCode) {
                const parent = await db.account.findUnique({ where: { code: parentCode } })
                if (parent) parentId = parent.id
              }

              await db.account.create({
                data: {
                  code,
                  name,
                  accountType,
                  subType: (row['Sub Type'] || row.subType || row.sub_type || null)?.toString().trim() || null,
                  parentId,
                  level: parseInt(row.Level || row.level || '0') || 0,
                  allowPosting: (row['Allow Posting'] || row.allowPosting || 'Yes')?.toString().trim() !== 'No',
                  description: (row.Description || row.description || null)?.toString().trim() || null,
                  isActive: (row.Active || row.active || 'Yes')?.toString().trim() !== 'No',
                },
              })
              imported++
            } catch (err: any) {
              errors.push({ row: i + 1, message: err.message || 'Failed to create account' })
            }
          }
          break
        }

        // ─── Customers import ────────────────────────────────────
        case 'customers': {
          for (let i = 0; i < data.length; i++) {
            const row = data[i]
            const code = (row.Code || row.code || '')?.toString().trim()
            const name = (row.Name || row.name || '')?.toString().trim()

            if (!code || !name) {
              errors.push({ row: i + 1, message: 'Missing required fields: Code, Name' })
              continue
            }

            const existing = await db.customer.findUnique({ where: { code } })
            if (existing) {
              skipped++
              continue
            }

            try {
              await db.customer.create({
                data: {
                  code,
                  name,
                  contactPerson: (row['Contact Person'] || row.contactPerson || row.contact_person || null)?.toString().trim() || null,
                  email: (row.Email || row.email || null)?.toString().trim() || null,
                  phone: (row.Phone || row.phone || null)?.toString().trim() || null,
                  address: (row.Address || row.address || null)?.toString().trim() || null,
                  creditTerms: parseInt(row['Credit Terms'] || row.creditTerms || row.credit_terms || '30') || 30,
                  creditLimit: parseFloat(row['Credit Limit'] || row.creditLimit || row.credit_limit || '0') || 0,
                  taxNumber: (row['Tax Number'] || row.taxNumber || row.tax_number || null)?.toString().trim() || null,
                  isActive: (row.Active || row.active || 'Yes')?.toString().trim() !== 'No',
                  openingBalance: parseFloat(row['Opening Balance'] || row.openingBalance || row.opening_balance || '0') || 0,
                },
              })
              imported++
            } catch (err: any) {
              errors.push({ row: i + 1, message: err.message || 'Failed to create customer' })
            }
          }
          break
        }

        // ─── Suppliers import ────────────────────────────────────
        case 'suppliers': {
          for (let i = 0; i < data.length; i++) {
            const row = data[i]
            const code = (row.Code || row.code || '')?.toString().trim()
            const name = (row.Name || row.name || '')?.toString().trim()

            if (!code || !name) {
              errors.push({ row: i + 1, message: 'Missing required fields: Code, Name' })
              continue
            }

            const existing = await db.supplier.findUnique({ where: { code } })
            if (existing) {
              skipped++
              continue
            }

            try {
              await db.supplier.create({
                data: {
                  code,
                  name,
                  contactPerson: (row['Contact Person'] || row.contactPerson || row.contact_person || null)?.toString().trim() || null,
                  email: (row.Email || row.email || null)?.toString().trim() || null,
                  phone: (row.Phone || row.phone || null)?.toString().trim() || null,
                  address: (row.Address || row.address || null)?.toString().trim() || null,
                  creditTerms: parseInt(row['Credit Terms'] || row.creditTerms || row.credit_terms || '30') || 30,
                  taxNumber: (row['Tax Number'] || row.taxNumber || row.tax_number || null)?.toString().trim() || null,
                  bankName: (row['Bank Name'] || row.bankName || row.bank_name || null)?.toString().trim() || null,
                  bankAccount: (row['Bank Account'] || row.bankAccount || row.bank_account || null)?.toString().trim() || null,
                  isActive: (row.Active || row.active || 'Yes')?.toString().trim() !== 'No',
                  openingBalance: parseFloat(row['Opening Balance'] || row.openingBalance || row.opening_balance || '0') || 0,
                },
              })
              imported++
            } catch (err: any) {
              errors.push({ row: i + 1, message: err.message || 'Failed to create supplier' })
            }
          }
          break
        }

        // ─── Projects import ──────────────────────────────────────
        case 'projects': {
          for (let i = 0; i < data.length; i++) {
            const row = data[i]
            const code = (row.Code || row.code || '')?.toString().trim()
            const name = (row.Name || row.name || '')?.toString().trim()

            if (!code || !name) {
              errors.push({ row: i + 1, message: 'Missing required fields: Code, Name' })
              continue
            }

            const existing = await db.project.findUnique({ where: { code } })
            if (existing) {
              skipped++
              continue
            }

            try {
              await db.project.create({
                data: {
                  code,
                  name,
                  projectType: (row['Project Type'] || row.projectType || row.project_type || 'Other')?.toString().trim(),
                  description: (row.Description || row.description || null)?.toString().trim() || null,
                  status: (row.Status || row.status || 'active')?.toString().trim(),
                  startDate: (row['Start Date'] || row.startDate || row.start_date || null) ? new Date((row['Start Date'] || row.startDate || row.start_date) as string) : null,
                  endDate: (row['End Date'] || row.endDate || row.end_date || null) ? new Date((row['End Date'] || row.endDate || row.end_date) as string) : null,
                  isHeadOffice: (row['Is Head Office'] || row.isHeadOffice || row.is_head_office || 'No')?.toString().trim() === 'Yes',
                  reportingCurrency: (row['Reporting Currency'] || row.reportingCurrency || row.reporting_currency || 'PKR')?.toString().trim(),
                  sortOrder: parseInt(row['Sort Order'] || row.sortOrder || row.sort_order || '0') || 0,
                },
              })
              imported++
            } catch (err: any) {
              errors.push({ row: i + 1, message: err.message || 'Failed to create project' })
            }
          }
          break
        }

        // ─── Vouchers import ──────────────────────────────────────
        case 'vouchers': {
          // Vouchers need a financial year - find or create one
          let financialYearId: string | null = null
          const fy = await db.financialYear.findFirst({ where: { status: 'open' } })
          if (fy) {
            financialYearId = fy.id
          } else {
            const anyFy = await db.financialYear.findFirst()
            if (anyFy) financialYearId = anyFy.id
          }

          if (!financialYearId) {
            return NextResponse.json({ error: 'No financial year found. Please create a financial year first.' }, { status: 400 })
          }

          // Group entries by voucher number
          const voucherMap = new Map<string, any[]>()
          for (let i = 0; i < data.length; i++) {
            const row = data[i]
            const vNum = (row['Voucher Number'] || row.voucherNumber || row.voucher_number || `VCH-${i + 1}`)?.toString().trim()
            if (!voucherMap.has(vNum)) voucherMap.set(vNum, [])
            voucherMap.get(vNum)!.push({ ...row, _rowIndex: i + 1 })
          }

          const systemUserId = 'system'

          for (const [vNum, entries] of voucherMap) {
            const first = entries[0]
            const voucherType = (first['Type'] || first.voucherType || first.voucher_type || 'JV')?.toString().trim()
            const date = (first['Date'] || first.date || new Date().toISOString().split('T')[0])?.toString().trim()
            const narration = (first['Narration'] || first.narration || `Imported voucher ${vNum}`)?.toString().trim()

            // Check for existing voucher
            const existing = await db.voucher.findUnique({ where: { voucherNumber: vNum } })
            if (existing) {
              skipped += entries.length
              continue
            }

            try {
              const voucherEntries = []
              let lineNum = 0
              for (const entry of entries) {
                lineNum++
                const accCode = (entry['Account Code'] || entry.accountCode || entry.account_code || '')?.toString().trim()
                if (!accCode) {
                  errors.push({ row: entry._rowIndex, message: 'Missing Account Code' })
                  continue
                }

                const account = await db.account.findUnique({ where: { code: accCode } })
                if (!account) {
                  errors.push({ row: entry._rowIndex, message: `Account not found: ${accCode}` })
                  continue
                }

                const debit = parseFloat(entry['Debit'] || entry.debit || '0') || 0
                const credit = parseFloat(entry['Credit'] || entry.credit || '0') || 0

                // Find project by code
                let projectId: string | null = null
                const projCode = (entry['Project'] || entry.project || entry.projectCode || '')?.toString().trim()
                if (projCode) {
                  const proj = await db.project.findUnique({ where: { code: projCode } })
                  if (proj) projectId = proj.id
                }

                voucherEntries.push({
                  lineNumber: lineNum,
                  accountId: account.id,
                  debit,
                  credit,
                  description: (entry['Description'] || entry.description || null)?.toString().trim() || null,
                  projectId,
                })
              }

              if (voucherEntries.length === 0) {
                continue
              }

              const totalDebit = voucherEntries.reduce((s, e) => s + e.debit, 0)
              const totalCredit = voucherEntries.reduce((s, e) => s + e.credit, 0)

              await db.voucher.create({
                data: {
                  voucherNumber: vNum,
                  voucherType,
                  voucherTypeName: voucherType === 'JV' ? 'Journal Voucher' : voucherType === 'BP' ? 'Bank Payment' : voucherType === 'CP' ? 'Cash Payment' : voucherType === 'BR' ? 'Bank Receipt' : voucherType === 'CR' ? 'Cash Receipt' : voucherType,
                  date: new Date(date),
                  narration,
                  reference: (first['Reference'] || first.reference || null)?.toString().trim() || null,
                  payeeName: (first['Payee'] || first.payeeName || first.payee_name || null)?.toString().trim() || null,
                  status: 'draft',
                  financialYearId,
                  totalDebit,
                  totalCredit,
                  createdBy: systemUserId,
                  entries: { create: voucherEntries },
                },
              })
              imported += entries.length
            } catch (err: any) {
              errors.push({ row: entries[0]._rowIndex, message: err.message || 'Failed to create voucher' })
            }
          }
          break
        }

        default:
          return NextResponse.json({ error: `Unknown entity type: ${entity}. Supported: accounts, customers, suppliers, projects, vouchers` }, { status: 400 })
      }

      // Log the import
      try {
        await db.importLog.create({
          data: {
            fileName: body.fileName || 'import.csv',
            fileType: 'CSV',
            importType: entity,
            recordCount: data.length,
            successCount: imported,
            failCount: errors.length,
            errors: errors.length > 0 ? JSON.stringify(errors) : null,
            importedBy: 'system',
          },
        })
      } catch (logErr) {
        console.error('Import log creation failed:', logErr)
      }

      return NextResponse.json({
        success: true,
        imported,
        skipped,
        errors,
        totalRows: data.length,
      })
    }

    // ─── Legacy action-based import/export log ────────────────────
    if (body.action === 'export') {
      const log = await db.exportLog.create({
        data: {
          exportType: body.exportType,
          format: body.format || 'CSV',
          parameters: JSON.stringify(body.parameters || {}),
          exportedBy: 'system',
        },
      })
      return NextResponse.json({ log, message: 'Export logged successfully' })
    }

    if (body.action === 'import') {
      const log = await db.importLog.create({
        data: {
          fileName: body.fileName || 'unknown',
          fileType: body.fileType || 'CSV',
          importType: body.importType || 'UNKNOWN',
          recordCount: body.recordCount || 0,
          successCount: body.successCount || 0,
          failCount: body.failCount || 0,
          errors: body.errors ? JSON.stringify(body.errors) : null,
          importedBy: 'system',
        },
      })
      return NextResponse.json({ log, message: 'Import logged successfully' })
    }

    return NextResponse.json({ error: 'Invalid request. Provide entity and data, or action parameter.' }, { status: 400 })
  } catch (error) {
    console.error('Import/Export POST error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
