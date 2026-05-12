import { NextResponse } from 'next/server'
import { ConsolidationEngine } from '@/lib/reporting/consolidation'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const projectIdsRaw = searchParams.get('projectIds') // comma-separated

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { status: 'error', error: 'Missing required query parameters: fromDate, toDate' },
        { status: 400 },
      )
    }

    const engine = new ConsolidationEngine()
    const projectIds = projectIdsRaw
      ? projectIdsRaw.split(',').filter(Boolean)
      : undefined

    const report = await engine.consolidate(fromDate, toDate, projectIds)

    return NextResponse.json({
      status: 'success',
      data: report,
      meta: {
        generatedAt: new Date().toISOString(),
        period: { fromDate, toDate },
        projectCount: Object.keys(report.byProject).length,
        consolidated: {
          validated: report.consolidated.balanceSheet.validated,
          variance: report.consolidated.balanceSheet.variance,
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
