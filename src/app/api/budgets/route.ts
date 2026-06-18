import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function GET_HANDLER(request: Request) {
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

async function POST_HANDLER(request: Request) {
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
        status: 'draft',
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

async function PUT_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Budget ID required' }, { status: 400 })

    const data = await request.json()

    // Handle status update (approve/reject workflow)
    if (data.status) {
      const budget = await db.budget.findUnique({ where: { id } })
      if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })

      const validTransitions: Record<string, string[]> = {
        draft: ['approved', 'rejected'],
        approved: ['active', 'rejected'],
        active: [],
        rejected: ['draft'],
      }

      if (!validTransitions[budget.status]?.includes(data.status)) {
        return NextResponse.json({ error: `Cannot transition from ${budget.status} to ${data.status}` }, { status: 400 })
      }

      const updated = await db.budget.update({
        where: { id },
        data: { status: data.status },
        include: { lines: { include: { account: true } }, financialYear: true, project: true, donor: true },
      })

      return NextResponse.json(updated)
    }

    // Handle full budget update
    const { name, financialYearId, projectId, donorId, period, lines } = data

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const totalAmount = lines ? lines.reduce((sum: number, l: any) => sum + (l.budgetAmount || 0), 0) : undefined

    // Delete existing lines and recreate
    if (lines) {
      await db.budgetLine.deleteMany({ where: { budgetId: id } })
    }

    const updateData: any = {
      name,
      ...(financialYearId && { financialYearId }),
      ...(projectId !== undefined && { projectId: projectId || null }),
      ...(donorId !== undefined && { donorId: donorId || null }),
      ...(period && { period }),
      ...(totalAmount !== undefined && { totalAmount }),
    }

    if (lines) {
      updateData.lines = {
        create: lines.map((l: any) => ({
          accountId: l.accountId,
          period: l.period || '2024',
          budgetAmount: l.budgetAmount || 0,
        })),
      }
    }

    const updated = await db.budget.update({
      where: { id },
      data: updateData,
      include: { lines: { include: { account: true } }, financialYear: true, project: true, donor: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function DELETE_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Budget ID required' }, { status: 400 })

    const budget = await db.budget.findUnique({ where: { id } })
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })

    if (budget.status === 'active') {
      return NextResponse.json({ error: 'Cannot delete an active budget' }, { status: 400 })
    }

    await db.budgetLine.deleteMany({ where: { budgetId: id } })
    await db.budget.delete({ where: { id } })

    return NextResponse.json({ message: 'Budget deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const POST = withAudit('budgets', POST_HANDLER);

export const PUT = withAudit('budgets', PUT_HANDLER);

export const DELETE = withAudit('budgets', DELETE_HANDLER);

export const GET = withAudit('budgets', GET_HANDLER);
