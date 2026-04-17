import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const financialYearId = searchParams.get('financialYearId')
    const projectId = searchParams.get('projectId')

    const where: any = {}
    if (financialYearId) where.financialYearId = financialYearId
    if (projectId) where.projectId = projectId

    const budgets = await db.budget.findMany({
      where,
      include: {
        financialYear: true,
        project: true,
        donor: true,
        lines: { include: { account: { select: { code: true, name: true, accountType: true } } }, orderBy: { account: { code: 'asc' } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate budget vs actual for each line
    for (const budget of budgets) {
      for (const line of budget.lines) {
        // Get actual spending from voucher entries for this account
        const actualResult = await db.voucherEntry.aggregate({
          _sum: { debit: true, credit: true },
          where: {
            accountId: line.accountId,
            voucher: {
              status: 'posted',
              financialYearId: budget.financialYearId,
              projectId: budget.projectId || undefined,
            },
          },
        })
        line.actualAmount = (actualResult._sum.debit || 0) - (actualResult._sum.credit || 0)
        if (line.actualAmount < 0) line.actualAmount = Math.abs(line.actualAmount)
      }
    }

    return NextResponse.json(budgets)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { name, financialYearId, projectId, donorId, period, lines } = data

    if (!name || !financialYearId || !lines?.length) {
      return NextResponse.json({ error: 'Name, financial year, and budget lines are required' }, { status: 400 })
    }

    const totalAmount = lines.reduce((sum: number, l: any) => sum + (l.budgetAmount || 0), 0)

    const budget = await db.budget.create({
      data: {
        name,
        financialYearId,
        projectId: projectId || null,
        donorId: donorId || null,
        period: period || 'ANNUAL',
        totalAmount,
        lines: {
          create: lines.map((l: any) => ({
            accountId: l.accountId,
            period: l.period || '2024',
            budgetAmount: l.budgetAmount || 0,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    })

    return NextResponse.json(budget, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
