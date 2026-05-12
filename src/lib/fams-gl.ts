import { db } from '@/lib/db'

/**
 * Resolve a GL account code to an Account ID.
 * If the account doesn't exist in the Chart of Accounts, create it automatically.
 */
export async function resolveAccountId(code: string, name: string): Promise<string> {
  if (!code) return ''
  const existing = await db.account.findUnique({ where: { code } })
  if (existing) return existing.id

  let accountType = 'ASSET'
  let subType: string | null = null

  if (code.startsWith('111') || code.startsWith('110')) {
    accountType = 'ASSET'; subType = 'CURRENT_ASSET'
  } else if (code.startsWith('12') || code.startsWith('121') || code.startsWith('122') || code.startsWith('123') || code.startsWith('124') || code.startsWith('125')) {
    accountType = 'ASSET'; subType = 'FIXED_ASSET'
  } else if (code.startsWith('13')) {
    accountType = 'ASSET'; subType = 'CONTRA_ASSET'
  } else if (code.startsWith('4')) {
    accountType = 'INCOME'; subType = 'OTHER_INCOME'
  } else if (code.startsWith('5')) {
    accountType = 'EXPENSE'; subType = 'DEPRECIATION'
  } else if (code.startsWith('2')) {
    accountType = 'LIABILITY'
  } else if (code.startsWith('3')) {
    accountType = 'EQUITY'
  }

  const account = await db.account.create({
    data: { code, name, accountType, subType, allowPosting: true, isActive: true },
  })
  return account.id
}

/**
 * Get or create an open financial year for GL posting.
 */
export async function getOpenFinancialYearId(): Promise<string> {
  const openFY = await db.financialYear.findFirst({
    where: { status: 'open' },
    orderBy: { startDate: 'desc' },
  })
  if (openFY) return openFY.id

  const now = new Date()
  const fyStart = now.getMonth() >= 6
    ? new Date(now.getFullYear(), 6, 1)
    : new Date(now.getFullYear() - 1, 6, 1)
  const fyEnd = new Date(fyStart.getFullYear() + 1, 5, 30)
  const label = `FY ${fyStart.getFullYear()}-${fyEnd.getFullYear().toString().slice(-2)}`

  const fy = await db.financialYear.create({
    data: { name: label, startDate: fyStart, endDate: fyEnd, status: 'open' },
  })
  return fy.id
}

/**
 * Generate a unique voucher number with a given prefix.
 */
export async function generateVoucherNumber(prefix: string = 'JV-'): Promise<string> {
  const lastVoucher = await db.voucher.findFirst({
    where: { voucherNumber: { startsWith: prefix } },
    orderBy: { voucherNumber: 'desc' },
  })
  let seq = 1
  if (lastVoucher) {
    const parts = lastVoucher.voucherNumber.split('-')
    const n = parseInt(parts[parts.length - 1] || '0', 10)
    if (!isNaN(n)) seq = n + 1
  }
  return `${prefix}${String(seq).padStart(5, '0')}`
}

/**
 * Generate a unique FAMS journal number.
 */
export async function generateJournalNumber(): Promise<string> {
  const prefix = `JV-FAMS-${new Date().getFullYear()}-`
  const lastJ = await db.fAMSJournal.findFirst({
    where: { journalNumber: { startsWith: prefix } },
    orderBy: { journalNumber: 'desc' },
  })
  let num = 1
  if (lastJ) {
    const p = lastJ.journalNumber.split('-')
    const n = parseInt(p[p.length - 1] || '0')
    if (!isNaN(n)) num = n + 1
  }
  return `${prefix}${String(num).padStart(4, '0')}`
}

/**
 * Post an asset acquisition to GL.
 * Creates a Journal Voucher: Dr. Fixed Asset Account, Cr. Bank/Cash Account
 */
export async function postAssetAcquisitionToGL(asset: {
  id: string
  assetId: string
  name: string
  category: string
  purchasePrice: number
  glAssetAccount: string | null
  costCenter: string | null
  project: string | null
  fundCode: string | null
}): Promise<{ voucherId: string; voucherNumber: string } | null> {
  try {
    const financialYearId = await getOpenFinancialYearId()
    const assetCode = asset.glAssetAccount || '1250'
    const assetAccountId = await resolveAccountId(assetCode, `Fixed Asset - ${asset.category}`)
    const bankAccountId = await resolveAccountId('1110', 'Bank / Cash')
    
    const amount = Math.round(asset.purchasePrice)
    if (amount <= 0) return null

    const voucherNumber = await generateVoucherNumber(`JV-FAMS-`)
    
    const voucher = await db.voucher.create({
      data: {
        voucherNumber,
        voucherType: 'JV',
        voucherTypeName: 'Journal Voucher',
        date: new Date(),
        narration: `Asset Acquisition: ${asset.name} (${asset.assetId}) — ${asset.category}`,
        status: 'posted',
        financialYearId,
        isAssetPosted: true,
        totalDebit: amount,
        totalCredit: amount,
        createdBy: 'FAMS',
        entries: {
          create: [
            {
              lineNumber: 1,
              accountId: assetAccountId,
              debit: amount,
              credit: 0,
              description: `Asset acquisition - ${asset.name} (${asset.assetId})`,
              assetRef: asset.assetId,
            },
            {
              lineNumber: 2,
              accountId: bankAccountId,
              debit: 0,
              credit: amount,
              description: `Payment for asset - ${asset.name} (${asset.assetId})`,
              assetRef: asset.assetId,
            },
          ],
        },
      },
    })

    return { voucherId: voucher.id, voucherNumber: voucher.voucherNumber }
  } catch (error) {
    console.error('Failed to post asset acquisition to GL:', error)
    return null
  }
}

/**
 * GL Account mapping per asset category.
 * These map to standard account codes in the Chart of Accounts.
 */
export const GL_ACCOUNT_MAP: Record<string, { asset: string; accDep: string; depExp: string }> = {
  'Land': { asset: '1210', accDep: '1300', depExp: '5300' },
  'Buildings': { asset: '1215', accDep: '1300', depExp: '5300' },
  'Vehicles': { asset: '1220', accDep: '1300', depExp: '5300' },
  'Furniture': { asset: '1225', accDep: '1300', depExp: '5300' },
  'Office Equipment': { asset: '1230', accDep: '1300', depExp: '5300' },
  'IT Assets': { asset: '1235', accDep: '1300', depExp: '5300' },
  'Machinery': { asset: '1240', accDep: '1300', depExp: '5300' },
  'Other': { asset: '1250', accDep: '1300', depExp: '5300' },
}

/**
 * FBR Tax rates per asset category.
 */
export const FBR_TAX_RATES: Record<string, number> = {
  'Land': 0,
  'Buildings': 10,
  'Vehicles': 15,
  'Furniture': 15,
  'Office Equipment': 15,
  'IT Assets': 30,
  'Machinery': 15,
  'Other': 15,
}

/**
 * Ensure all FAMS-related GL accounts exist in the Chart of Accounts.
 * Call this on first load or seed to guarantee the account structure is ready.
 */
export async function ensureFAMSGLAccounts(): Promise<number> {
  const accounts = [
    { code: '1110', name: 'Bank / Cash', accountType: 'ASSET', subType: 'CURRENT_ASSET' },
    { code: '1210', name: 'Fixed Asset - Land', accountType: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1215', name: 'Fixed Asset - Buildings', accountType: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1220', name: 'Fixed Asset - Vehicles', accountType: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1225', name: 'Fixed Asset - Furniture', accountType: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1230', name: 'Fixed Asset - Office Equipment', accountType: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1235', name: 'Fixed Asset - IT Assets', accountType: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1240', name: 'Fixed Asset - Machinery', accountType: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1250', name: 'Fixed Asset - Other', accountType: 'ASSET', subType: 'FIXED_ASSET' },
    { code: '1300', name: 'Accumulated Depreciation', accountType: 'ASSET', subType: 'CONTRA_ASSET' },
    { code: '3200', name: 'Revaluation Reserve', accountType: 'EQUITY', subType: null },
    { code: '4500', name: 'Gain on Disposal of Fixed Assets', accountType: 'INCOME', subType: 'OTHER_INCOME' },
    { code: '5300', name: 'Depreciation Expense', accountType: 'EXPENSE', subType: 'DEPRECIATION' },
    { code: '5400', name: 'Loss on Disposal / Write-Off of Assets', accountType: 'EXPENSE', subType: 'DEPRECIATION' },
  ]

  let created = 0
  for (const acct of accounts) {
    const existing = await db.account.findUnique({ where: { code: acct.code } })
    if (!existing) {
      await db.account.create({
        data: { code: acct.code, name: acct.name, accountType: acct.accountType, subType: acct.subType, allowPosting: true, isActive: true },
      })
      created++
    }
  }
  return created
}
