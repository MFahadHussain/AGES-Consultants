import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Return both import and export logs combined
    const [imports, exports] = await Promise.all([
      db.importLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      db.exportLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    ])

    return NextResponse.json({ imports, exports })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    if (data.action === 'export') {
      // Log export
      const log = await db.exportLog.create({
        data: {
          exportType: data.exportType,
          format: data.format || 'PDF',
          parameters: JSON.stringify(data.parameters || {}),
          exportedBy: 'system',
        },
      })

      // Return the report data for client-side download
      return NextResponse.json({ log, message: 'Export logged successfully' })
    }

    if (data.action === 'import') {
      // Log import (actual file processing would happen here)
      const log = await db.importLog.create({
        data: {
          fileName: data.fileName || 'unknown',
          fileType: data.fileType || 'CSV',
          importType: data.importType || 'DONOR_INVOICE',
          recordCount: data.recordCount || 0,
          successCount: data.successCount || 0,
          failCount: data.failCount || 0,
          errors: data.errors ? JSON.stringify(data.errors) : null,
          importedBy: 'system',
        },
      })

      return NextResponse.json({ log, message: 'Import logged successfully' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
