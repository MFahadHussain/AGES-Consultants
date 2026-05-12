import { NextResponse } from 'next/server'
import { DepreciationEngine } from '@/lib/reporting/depreciation'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const projectId = searchParams.get('projectId') ?? undefined
    const assetClass = searchParams.get('assetClass') ?? undefined

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { status: 'error', error: 'Missing required query parameters: fromDate, toDate' },
        { status: 400 },
      )
    }

    const engine = new DepreciationEngine()
    const result = await engine.getAssetSchedule(new Date(fromDate), new Date(toDate), projectId)

    // If assetClass is provided (e.g. 'ppe' or 'intangibles'), return only that section
    let data: typeof result | Partial<typeof result> = result
    if (assetClass === 'ppe') {
      data = {
        ppe: result.ppe,
        ppeCategoryTotals: result.ppeCategoryTotals,
        ppeTotals: result.ppeTotals,
      }
    } else if (assetClass === 'intangibles') {
      data = {
        intangibles: result.intangibles,
        intangiblesCategoryTotals: result.intangiblesCategoryTotals,
        intangiblesTotals: result.intangiblesTotals,
      }
    }

    // Resolve project name for meta
    let projectName: string | undefined
    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      })
      projectName = project?.name
    }

    return NextResponse.json({
      status: 'success',
      data,
      meta: {
        generatedAt: new Date().toISOString(),
        period: { fromDate, toDate },
        project: projectName || 'Consolidated',
        validated: true,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
