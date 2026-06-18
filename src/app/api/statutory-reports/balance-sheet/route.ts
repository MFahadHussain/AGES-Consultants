import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { FinancialStatementEngine, AccountingEquationError } from '@/lib/reporting/financials'
import { db } from '@/lib/db'

async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const projectId = searchParams.get('projectId') ?? undefined

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { status: 'error', error: 'Missing required query parameters: fromDate, toDate' },
        { status: 400 },
      )
    }

    const engine = new FinancialStatementEngine()
    const result = await engine.getBalanceSheet(fromDate, toDate, projectId)

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
      data: result,
      meta: {
        generatedAt: new Date().toISOString(),
        period: { fromDate, toDate },
        project: projectName || 'Consolidated',
        validated: result.validated,
      },
    })
  } catch (error) {
    if (error instanceof AccountingEquationError) {
      return NextResponse.json(
        {
          status: 'error',
          error: error.message,
          data: { variance: error.variance },
        },
        { status: 422 },
      )
    }

    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export const GET = withAudit('statutory-reports', GET_HANDLER);
