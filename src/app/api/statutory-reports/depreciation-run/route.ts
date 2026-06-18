import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { DepreciationEngine, toFinancialYear } from '@/lib/reporting/depreciation'

/**
 * POST /api/statutory-reports/depreciation-run
 *
 * Run depreciation for a specific financial period.
 * Body: { year: number, month: number (1-12), projectId?: string }
 */
async function POST_HANDLER(request: Request) {
  try {
    const body = await request.json()
    const { year, month, projectId } = body as {
      year: number
      month: number
      projectId?: string
    }

    if (!year || !month) {
      return NextResponse.json(
        { status: 'error', error: 'Missing required body parameters: year, month' },
        { status: 400 },
      )
    }

    if (typeof year !== 'number' || typeof month !== 'number' || month < 1 || month > 12) {
      return NextResponse.json(
        { status: 'error', error: 'Invalid parameters: year must be a number, month must be 1-12' },
        { status: 400 },
      )
    }

    const engine = new DepreciationEngine()
    const financialYear = toFinancialYear(year, month)

    const result = await engine.runDepreciationForPeriod(
      financialYear,
      month,
      projectId,
    )

    return NextResponse.json({
      status: 'success',
      data: {
        assetsProcessed: result.assetsProcessed,
        totalCharge: result.totalCharge,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        period: { year, month },
        project: projectId || 'All',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/statutory-reports/depreciation-run
 *
 * Retrieve depreciation charges for a date range.
 * Query params: fromDate, toDate, assetClass (optional)
 */
async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const assetClass = searchParams.get('assetClass') ?? undefined

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { status: 'error', error: 'Missing required query parameters: fromDate, toDate' },
        { status: 400 },
      )
    }

    const engine = new DepreciationEngine()
    const result = await engine.getDepreciationForDateRange(
      new Date(fromDate),
      new Date(toDate),
      assetClass,
    )

    return NextResponse.json({
      status: 'success',
      data: result,
      meta: {
        generatedAt: new Date().toISOString(),
        period: { fromDate, toDate },
        assetClass: assetClass || 'All',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export const POST = withAudit('statutory-reports', POST_HANDLER);

export const GET = withAudit('statutory-reports', GET_HANDLER);
