import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'
import { findAccountByRole, findAccDepForCategory, findDepExpenseForCategory, findFirstBankAccount } from '@/lib/account-roles'

/**
 * POST /api/fams/gl-post - Post pending FAMS journals to the General Ledger
 *
 * This creates actual Voucher + VoucherEntry records in the Accounting module,
 * linking FAMS depreciation/disposal/acquisition entries to the GL.
 *
 * Actions:
 *   - post-all: Post all Pending Export journals to GL
 *   - post-acquisition: Post a single asset acquisition to GL
 *   - post-selected: Post selected journal IDs to GL
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = body.action || 'post-all'
    const userId = await getSystemUserId()

    // Get the open financial year for voucher creation
    const openFY = await db.financialYear.findFirst({ where: { status: 'open' } })
    if (!openFY) {
      return NextResponse.json({ error: 'No open financial year found. Please open a financial year first.' }, { status: 400 })
    }

    if (action === 'post-acquisition') {
      return handleAcquisitionPosting(body, userId, openFY.id)
    }

    // Default: post-all or post-selected
    return handleJournalPosting(body, userId, openFY.id, action)
  } catch (error) {
    console.error('FAMS GL Post error:', error)
    return NextResponse.json({ error: 'Failed to post to GL', details: String(error) }, { status: 500 })
  }
}

/**
 * GET /api/fams/gl-post - Get GL posting status
 */
export async function GET() {
  try {
    const pendingJournals = await db.fAMSJournal.findMany({
      where: { status: 'Pending Export' },
      orderBy: { date: 'asc' },
    })

    const exportedJournals = await db.fAMSJournal.findMany({
      where: { status: 'Exported' },
      orderBy: { date: 'desc' },
      take: 20,
    })

    // Check for assets that need acquisition posting
    const activeAssets = await db.fixedAsset.findMany({
      where: { status: 'Active', approvalStatus: 'Approved', journalStatus: 'Pending Export' },
    })

    return NextResponse.json({
      pendingJournals: pendingJournals.length,
      pendingAmount: pendingJournals.reduce((s, j) => s + j.drAmount, 0),
      exportedJournals: exportedJournals.length,
      assetsNeedingAcquisition: activeAssets.length,
      acquisitionAmount: activeAssets.reduce((s, a) => s + a.purchasePrice, 0),
    })
  } catch (error) {
    console.error('FAMS GL Post GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch GL posting status' }, { status: 500 })
  }
}

/**
 * Post FAMS journals (depreciation, disposal, etc.) to the GL as Voucher entries
 */
async function handleJournalPosting(body: { journalIds?: string[] }, userId: string, financialYearId: string, action: string) {
  // Get journals to post
  let journals
  if (action === 'post-selected' && body.journalIds?.length) {
    journals = await db.fAMSJournal.findMany({
      where: { id: { in: body.journalIds }, status: 'Pending Export' },
    })
  } else {
    journals = await db.fAMSJournal.findMany({
      where: { status: 'Pending Export' },
      orderBy: { date: 'asc' },
    })
  }

  if (journals.length === 0) {
    return NextResponse.json({ error: 'No pending journals to post' }, { status: 400 })
  }

  // Group journals by type for batch voucher creation
  const byType: Record<string, typeof journals> = {}
  for (const j of journals) {
    const key = j.type || 'Other'
    if (!byType[key]) byType[key] = []
    byType[key].push(j)
  }

  const postedVouchers: string[] = []
  let totalDebit = 0
  let totalCredit = 0

  for (const [type, typeJournals] of Object.entries(byType)) {
    // Create one voucher per type batch
    const voucherType = getVoucherType(type)
    const voucherNumber = await generateVoucherNumber(voucherType)

    const narration = type === 'Depreciation'
      ? `FAMS: Depreciation posting — ${typeJournals.length} asset(s)`
      : type === 'Disposal'
      ? `FAMS: Asset disposal posting — ${typeJournals.length} asset(s)`
      : `FAMS: ${type} posting — ${typeJournals.length} entry(s)`

    const totalDr = typeJournals.reduce((s, j) => s + j.drAmount, 0)
    const totalCr = typeJournals.reduce((s, j) => s + j.crAmount, 0)

    const voucher = await db.voucher.create({
      data: {
        voucherNumber,
        voucherType,
        voucherTypeName: getVoucherTypeName(voucherType),
        date: new Date(),
        narration,
        reference: `FAMS-${type}`,
        status: 'posted',
        financialYearId,
        totalDebit: Math.round(totalDr),
        totalCredit: Math.round(totalCr),
        createdBy: userId,
        isAssetPosted: true,
      },
    })

    // Create voucher entries for each journal
    let lineNumber = 1
    for (const j of typeJournals) {
      // Debit entry
      const drAccount = await findAccountByCode(j.drAccountCode)
      if (drAccount) {
        await db.voucherEntry.create({
          data: {
            voucherId: voucher.id,
            lineNumber: lineNumber++,
            accountId: drAccount.id,
            debit: Math.round(j.drAmount),
            credit: 0,
            description: j.narration || `${type}: ${j.assetName || 'N/A'}`,
          },
        })
      }

      // Credit entry
      const crAccount = await findAccountByCode(j.crAccountCode)
      if (crAccount) {
        await db.voucherEntry.create({
          data: {
            voucherId: voucher.id,
            lineNumber: lineNumber++,
            accountId: crAccount.id,
            debit: 0,
            credit: Math.round(j.crAmount),
            description: j.narration || `${type}: ${j.assetName || 'N/A'}`,
          },
        })
      }
    }

    postedVouchers.push(voucherNumber)
    totalDebit += totalDr
    totalCredit += totalCr
  }

  // Mark journals as exported (posted to GL)
  await db.fAMSJournal.updateMany({
    where: { id: { in: journals.map(j => j.id) } },
    data: {
      status: 'Exported',
      exportedAt: new Date(),
    },
  })

  // Mark related depreciation records as posted
  for (const j of journals.filter(j => j.type === 'Depreciation' && j.assetId)) {
    await db.fixedAssetDepreciation.updateMany({
      where: {
        asset: { assetId: j.assetId },
        journalStatus: 'Pending Export',
        isTaxDepreciation: false,
      },
      data: {
        isPosted: true,
        journalStatus: 'Exported',
        journalRef: j.journalNumber,
      },
    })
  }

  // Audit log
  await db.auditLog.create({
    data: {
      userId,
      action: 'EXPORT',
      entity: 'FAMS_GL_Post',
      entityId: 'batch',
      details: JSON.stringify({
        vouchers: postedVouchers,
        journalCount: journals.length,
        totalDebit: Math.round(totalDebit),
        totalCredit: Math.round(totalCredit),
      }),
    },
  })

  return NextResponse.json({
    success: true,
    message: `${journals.length} journal(s) posted to General Ledger`,
    vouchers: postedVouchers,
    journalCount: journals.length,
    totalDebit: Math.round(totalDebit),
    totalCredit: Math.round(totalCredit),
  })
}

/**
 * Post a single asset acquisition to the GL
 * Dr: Fixed Asset Account (e.g., 1520 - Vehicles)
 * Cr: Bank Account (e.g., 1121 - Meezan Bank)
 */
async function handleAcquisitionPosting(
  body: { assetId?: string; all?: boolean },
  userId: string,
  financialYearId: string
) {
  // Get assets that need acquisition posting
  let where: any = { status: 'Active', approvalStatus: 'Approved', journalStatus: 'Pending Export' }
  if (body.assetId) where.id = body.assetId

  const assets = await db.fixedAsset.findMany({ where })

  if (assets.length === 0) {
    return NextResponse.json({ error: 'No approved assets pending acquisition posting' }, { status: 400 })
  }

  const postedAssets: string[] = []
  let totalAmount = 0

  for (const asset of assets) {
    // Resolve GL account codes using account-roles utility
    const assetAccountCode = asset.glAssetAccount || await getDefaultAssetAccount(asset.category)
    const bankAccount = await findFirstBankAccount()

    if (!assetAccountCode) {
      console.warn(`No GL asset account found for ${asset.name} (${asset.category})`)
      continue
    }

    const assetAccount = await findAccountByCode(assetAccountCode)
    if (!assetAccount) {
      console.warn(`GL account ${assetAccountCode} not found in COA for asset ${asset.name}`)
      continue
    }

    const creditAccount = bankAccount || await findAccountByRole('CASH_IN_HAND')
    if (!creditAccount) {
      console.warn('No bank or cash account found for acquisition posting')
      continue
    }

    const voucherNumber = await generateVoucherNumber('BP')
    const narration = `FAMS: Asset Acquisition — ${asset.name} (${asset.assetId})`

    const voucher = await db.voucher.create({
      data: {
        voucherNumber,
        voucherType: 'BP',
        voucherTypeName: 'Bank Payment',
        date: asset.dateOfCapitalization || asset.dateOfPurchase || new Date(),
        narration,
        reference: `FAMS-ACQ-${asset.assetId}`,
        payeeName: asset.supplierName || undefined,
        status: 'posted',
        financialYearId,
        totalDebit: Math.round(asset.purchasePrice),
        totalCredit: Math.round(asset.purchasePrice),
        createdBy: userId,
        isAssetPosted: true,
      },
    })

    // Debit: Fixed Asset Account
    await db.voucherEntry.create({
      data: {
        voucherId: voucher.id,
        lineNumber: 1,
        accountId: assetAccount.id,
        debit: Math.round(asset.purchasePrice),
        credit: 0,
        description: `Acquisition: ${asset.name} (${asset.assetId})`,
      },
    })

    // Credit: Bank Account
    await db.voucherEntry.create({
      data: {
        voucherId: voucher.id,
        lineNumber: 2,
        accountId: creditAccount.id,
        debit: 0,
        credit: Math.round(asset.purchasePrice),
        description: `Payment for: ${asset.name} (${asset.assetId})`,
      },
    })

    // Update asset journal status
    await db.fixedAsset.update({
      where: { id: asset.id },
      data: { journalStatus: 'Exported' },
    })

    postedAssets.push(asset.assetId)
    totalAmount += asset.purchasePrice
  }

  // Audit log
  await db.auditLog.create({
    data: {
      userId,
      action: 'CREATE',
      entity: 'FAMS_Acquisition_Post',
      entityId: 'batch',
      details: JSON.stringify({
        assetsPosted: postedAssets,
        count: postedAssets.length,
        totalAmount: Math.round(totalAmount),
      }),
    },
  })

  return NextResponse.json({
    success: true,
    message: `${postedAssets.length} asset acquisition(s) posted to General Ledger`,
    assets: postedAssets,
    totalAmount: Math.round(totalAmount),
  })
}

/**
 * Get default asset GL account code for a category
 */
async function getDefaultAssetAccount(category: string): Promise<string | null> {
  const mapping: Record<string, string> = {
    'Land': '1510',
    'Buildings': '1515',
    'Vehicles': '1520',
    'Furniture': '1525',
    'Office Equipment': '1530',
    'IT Assets': '1535',
    'Machinery': '1540',
    'Other': '1545',
  }
  return mapping[category] || null
}

/**
 * Find an account by its code
 */
async function findAccountByCode(code: string | null | undefined) {
  if (!code) return null
  return db.account.findFirst({
    where: { code, isActive: true },
    select: { id: true, code: true, name: true },
  })
}

/**
 * Generate a unique voucher number
 */
async function generateVoucherNumber(type: string): Promise<string> {
  const prefix = `${type}-`
  const lastVoucher = await db.voucher.findFirst({
    where: { voucherNumber: { startsWith: prefix } },
    orderBy: { voucherNumber: 'desc' },
  })
  let num = 1
  if (lastVoucher) {
    const parts = lastVoucher.voucherNumber.split('-')
    const lastNum = parseInt(parts[parts.length - 1] || '0', 10)
    if (!isNaN(lastNum)) num = lastNum + 1
  }
  return `${prefix}${String(num).padStart(5, '0')}`
}

/**
 * Map FAMS journal type to voucher type
 */
function getVoucherType(type: string): string {
  switch (type) {
    case 'Depreciation': return 'JV'
    case 'Disposal': return 'JV'
    case 'Acquisition': return 'BP'
    case 'Revaluation': return 'JV'
    default: return 'JV'
  }
}

function getVoucherTypeName(type: string): string {
  switch (type) {
    case 'BP': return 'Bank Payment'
    case 'CP': return 'Cash Payment'
    case 'BR': return 'Bank Receipt'
    case 'CR': return 'Cash Receipt'
    case 'JV': return 'Journal Voucher'
    case 'BILL': return 'Bill'
    default: return 'Journal Voucher'
  }
}
