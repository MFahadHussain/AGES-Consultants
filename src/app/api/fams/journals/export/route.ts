import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

/**
 * POST /api/fams/journals/export - Export pending journals to CSV
 * Alias endpoint that delegates to /api/fams/export
 *
 * 1. Get all "Pending Export" journals
 * 2. Generate CSV with spec columns
 * 3. Create FAMSExportBatch record
 * 4. Update journal statuses to "Exported"
 * 5. Return batch info and CSV content
 */
async function POST_HANDLER(request: Request) {
  try {
    const userId = await getUserId()
    const body = await request.json().catch(() => ({}))

    // Optional: filter by type if provided
    const typeFilter = body.type || undefined
    const whereCondition: Record<string, unknown> = { status: 'Pending Export' }
    if (typeFilter) whereCondition.type = typeFilter

    // Get all Pending Export journals
    const journals = await db.fAMSJournal.findMany({
      where: whereCondition,
      orderBy: { journalNumber: 'asc' },
    })

    if (journals.length === 0) {
      return NextResponse.json(
        { error: 'No pending journals to export' },
        { status: 400 }
      )
    }

    // Generate CSV content
    const headers = [
      'JV_Number', 'Date', 'Narration', 'Asset_ID', 'Asset_Name',
      'Dr_Account_Code', 'Dr_Account_Name', 'Dr_Amount_PKR',
      'Cr_Account_Code', 'Cr_Account_Name', 'Cr_Amount_PKR',
      'Cost_Center', 'Project', 'Fund_Code', 'Source', 'Exported_At',
    ]

    const csvRows = [headers.join(',')]

    for (const journal of journals) {
      const row = [
        `"${journal.journalNumber}"`,
        `"${new Date(journal.date).toISOString().split('T')[0]}"`,
        `"${(journal.narration || '').replace(/"/g, '""')}"`,
        `"${journal.assetId || ''}"`,
        `"${(journal.assetName || '').replace(/"/g, '""')}"`,
        `"${journal.drAccountCode || ''}"`,
        `"${(journal.drAccountName || '').replace(/"/g, '""')}"`,
        String(Math.round(journal.drAmount)),
        `"${journal.crAccountCode || ''}"`,
        `"${(journal.crAccountName || '').replace(/"/g, '""')}"`,
        String(Math.round(journal.crAmount)),
        `"${journal.costCenter || ''}"`,
        `"${journal.project || ''}"`,
        `"${journal.fundCode || ''}"`,
        `"${journal.source}"`,
        `"${new Date().toISOString()}"`,
      ]
      csvRows.push(row.join(','))
    }

    const csvContent = csvRows.join('\n')

    // Auto-generate batchRef as EXP-YYYY-NNNN
    const currentYear = new Date().getFullYear()
    const batchPrefix = `EXP-${currentYear}-`
    const lastBatch = await db.fAMSExportBatch.findFirst({
      where: { batchRef: { startsWith: batchPrefix } },
      orderBy: { batchRef: 'desc' },
    })
    let nextNum = 1
    if (lastBatch) {
      const parts = lastBatch.batchRef.split('-')
      const lastNum = parseInt(parts[parts.length - 1] || '0', 10)
      if (!isNaN(lastNum)) nextNum = lastNum + 1
    }
    const batchRef = `${batchPrefix}${String(nextNum).padStart(4, '0')}`

    // Calculate totals
    const totalDrAmount = journals.reduce((sum, j) => sum + j.drAmount, 0)
    const totalCrAmount = journals.reduce((sum, j) => sum + j.crAmount, 0)

    // Create FAMSExportBatch record
    const exportBatch = await db.fAMSExportBatch.create({
      data: {
        batchRef,
        exportedBy: userId,
        entryCount: journals.length,
        totalDrAmount: Math.round(totalDrAmount),
        totalCrAmount: Math.round(totalCrAmount),
        csvContent,
      },
    })

    // Mark all exported journals as Exported
    await db.fAMSJournal.updateMany({
      where: {
        id: { in: journals.map((j) => j.id) },
      },
      data: {
        status: 'Exported',
        exportBatchId: exportBatch.id,
        exportedAt: new Date(),
      },
    })

    // Mark depreciation records as posted
    for (const journal of journals.filter(j => j.type === 'Depreciation')) {
      if (journal.assetId) {
        await db.fixedAssetDepreciation.updateMany({
          where: {
            asset: { assetId: journal.assetId },
            journalStatus: 'Pending Export',
            isTaxDepreciation: false,
          },
          data: {
            isPosted: true,
            journalStatus: 'Exported',
            journalRef: journal.journalNumber,
          },
        })
      }
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId,
        action: 'EXPORT',
        entity: 'FAMSExportBatch',
        entityId: exportBatch.id,
        details: JSON.stringify({
          batchRef,
          entryCount: journals.length,
          totalDrAmount: Math.round(totalDrAmount),
          totalCrAmount: Math.round(totalCrAmount),
        }),
      },
    })

    return NextResponse.json({
      batchRef,
      batchId: exportBatch.id,
      entryCount: journals.length,
      totalDrAmount: Math.round(totalDrAmount),
      totalCrAmount: Math.round(totalCrAmount),
      csvContent,
    })
  } catch (error) {
    console.error('FAMS Journals Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export journals', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/** Helper to get system user ID for this route */
async function getUserId(): Promise<string> {
  const existing = await db.user.findFirst({ where: { email: 'system@acctfin.erp' } })
  if (existing) return existing.id

  const created = await db.user.create({
    data: { email: 'system@acctfin.erp', name: 'System', role: 'admin', isActive: true },
  })
  return created.id
}

export const POST = withAudit('fams', POST_HANDLER);
