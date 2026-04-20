import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/fams/export - List export batches
export async function GET() {
  try {
    const batches = await db.fAMSExportBatch.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ batches })
  } catch (error) {
    console.error('FAMS Export GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch export batches' }, { status: 500 })
  }
}

// POST /api/fams/export - Export pending journals to CSV
export async function POST() {
  try {
    const journals = await db.fAMSJournal.findMany({ where: { status: 'Pending Export' }, orderBy: { date: 'asc' } })
    if (journals.length === 0) return NextResponse.json({ error: 'No pending journals to export' }, { status: 400 })

    // Generate CSV
    const headers = 'JV_Number,Date,Narration,Asset_ID,Asset_Name,Dr_Account_Code,Dr_Account_Name,Dr_Amount_PKR,Cr_Account_Code,Cr_Account_Name,Cr_Amount_PKR,Cost_Center,Project,Fund_Code,Source,Exported_At'
    const rows = journals.map(j => {
      const date = new Date(j.date).toISOString().split('T')[0]
      return `"${j.journalNumber}","${date}","${(j.narration || '').replace(/"/g, '""')}","${j.assetId || ''}","${(j.assetName || '').replace(/"/g, '""')}","${j.drAccountCode || ''}","${j.drAccountName || ''}",${Math.round(j.drAmount)},"${j.crAccountCode || ''}","${j.crAccountName || ''}",${Math.round(j.crAmount)},"${j.costCenter || ''}","${j.project || ''}","${j.fundCode || ''}","${j.source}","${new Date().toISOString()}"`
    })
    const csvContent = [headers, ...rows].join('\n')

    // Create batch
    const year = new Date().getFullYear()
    const prefix = `EXP-${year}-`
    const lastBatch = await db.fAMSExportBatch.findFirst({ where: { batchRef: { startsWith: prefix } }, orderBy: { batchRef: 'desc' } })
    let num = 1
    if (lastBatch) { const p = lastBatch.batchRef.split('-'); const n = parseInt(p[p.length - 1]); if (!isNaN(n)) num = n + 1 }
    const batchRef = `${prefix}${String(num).padStart(4, '0')}`

    const batch = await db.fAMSExportBatch.create({
      data: {
        batchRef, exportedBy: 'system', entryCount: journals.length,
        totalDrAmount: Math.round(journals.reduce((s, j) => s + j.drAmount, 0)),
        totalCrAmount: Math.round(journals.reduce((s, j) => s + j.crAmount, 0)),
        csvContent,
      },
    })

    // Mark journals as exported
    await db.fAMSJournal.updateMany({
      where: { status: 'Pending Export' },
      data: { status: 'Exported', exportedAt: new Date(), exportBatchId: batch.id },
    })

    return NextResponse.json({ batch, csvContent, exportedCount: journals.length })
  } catch (error) {
    console.error('FAMS Export POST error:', error)
    return NextResponse.json({ error: 'Failed to export journals' }, { status: 500 })
  }
}
