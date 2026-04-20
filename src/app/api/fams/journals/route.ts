import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/fams/journals
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type

    const journals = await db.fAMSJournal.findMany({ where, orderBy: { createdAt: 'desc' } })
    const pendingCount = journals.filter(j => j.status === 'Pending Export').length
    const exportedCount = journals.filter(j => j.status === 'Exported').length
    const totalAmount = journals.reduce((s, j) => s + j.drAmount, 0)

    return NextResponse.json({ journals, stats: { pendingCount, exportedCount, totalAmount: Math.round(totalAmount), totalCount: journals.length } })
  } catch (error) {
    console.error('FAMS Journals GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch journals' }, { status: 500 })
  }
}
