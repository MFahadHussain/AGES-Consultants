import { withAudit } from '@/lib/audit-wrapper'
import { NextRequest, NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/fams/fiscal-years
async function GET_HANDLER() {
  try {
    const fiscalYears = await db.fAMSFiscalYear.findMany({ orderBy: { startDate: 'desc' } })
    const enriched = fiscalYears.map(fy => {
      let depRunStatusParsed = {}
      try { depRunStatusParsed = JSON.parse(fy.depRunStatus as string) } catch {}
      const periods = Object.entries(depRunStatusParsed) as [string, string][]
      const completed = periods.filter(([, s]) => s === 'Complete').length
      return {
        ...fy,
        depRunStatusParsed,
        progress: { totalPeriods: periods.length, completedPeriods: completed, pendingPeriods: periods.length - completed, completionPct: periods.length > 0 ? Math.round((completed / periods.length) * 100) : 0 },
      }
    })
    return NextResponse.json({ fiscalYears: enriched })
  } catch (error) {
    console.error('FAMS FY GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch fiscal years' }, { status: 500 })
  }
}

// POST /api/fams/fiscal-years
async function POST_HANDLER(request: NextRequest) {
  try {
    const body = await request.json()
    const { label, startDate, endDate } = body
    if (!label || !startDate || !endDate) return NextResponse.json({ error: 'label, startDate, endDate required' }, { status: 400 })

    const existing = await db.fAMSFiscalYear.findFirst({ where: { label } })
    if (existing) return NextResponse.json({ error: `FY "${label}" already exists` }, { status: 400 })

    const userId = await getSystemUserId()
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const startYear = new Date(startDate).getFullYear()
    const depRunStatus: Record<string, string> = {}
    for (let i = 0; i < 12; i++) { depRunStatus[`${months[i]}-${i < 6 ? startYear : startYear + 1}`] = 'Pending' }

    const fy = await db.fAMSFiscalYear.create({
      data: { label, startDate: new Date(startDate), endDate: new Date(endDate), status: 'Open', depRunStatus: JSON.stringify(depRunStatus), openedBy: userId },
    })
    return NextResponse.json(fy, { status: 201 })
  } catch (error) {
    console.error('FAMS FY POST error:', error)
    return NextResponse.json({ error: 'Failed to create fiscal year' }, { status: 500 })
  }
}

// PUT /api/fams/fiscal-years
async function PUT_HANDLER(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, action } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    if (action === 'close') {
      const userId = await getSystemUserId()
      const existing = await db.fAMSFiscalYear.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: 'FY not found' }, { status: 404 })
      if (existing.status === 'Closed') return NextResponse.json({ error: 'Already closed' }, { status: 400 })

      const errors: string[] = []
      const depStatus = JSON.parse(existing.depRunStatus as string || '{}')
      const pending = Object.entries(depStatus).filter(([, s]: [string, string]) => s === 'Pending').map(([m]: [string, string]) => m)
      if (pending.length > 0) errors.push(`Pending depreciation: ${pending.join(', ')}`)

      const draftAssets = await db.fixedAsset.count({ where: { approvalStatus: 'Draft' } })
      if (draftAssets > 0) errors.push(`${draftAssets} asset(s) pending approval`)

      const pendingJournals = await db.fAMSJournal.count({ where: { status: 'Pending Export' } })
      if (pendingJournals > 0) errors.push(`${pendingJournals} journal(s) pending export`)

      if (errors.length > 0) return NextResponse.json({ error: 'Cannot close', validationErrors: errors }, { status: 400 })

      const closed = await db.fAMSFiscalYear.update({ where: { id }, data: { status: 'Closed', closedBy: userId, closedAt: new Date() } })
      return NextResponse.json({ fiscalYear: closed })
    }

    if (body.depRunStatus) {
      const fy = await db.fAMSFiscalYear.update({
        where: { id },
        data: { depRunStatus: typeof body.depRunStatus === 'string' ? body.depRunStatus : JSON.stringify(body.depRunStatus) },
      })
      return NextResponse.json(fy)
    }

    return NextResponse.json({ error: 'No valid action' }, { status: 400 })
  } catch (error) {
    console.error('FAMS FY PUT error:', error)
    return NextResponse.json({ error: 'Failed to update fiscal year' }, { status: 500 })
  }
}

export const POST = withAudit('fams', POST_HANDLER);

export const PUT = withAudit('fams', PUT_HANDLER);

export const GET = withAudit('fams', GET_HANDLER);
