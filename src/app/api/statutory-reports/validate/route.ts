import { NextResponse } from 'next/server'
import { ValidationEngine } from '@/lib/reporting/consolidation'
import { db } from '@/lib/db'

export async function GET(request: Request) {
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

    const engine = new ValidationEngine()
    const result = await engine.validate(fromDate, toDate, projectId)

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
        validated: result.allPassed,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
