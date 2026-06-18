import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function GET_HANDLER() {
  try {
    const projects = await db.project.findMany({ orderBy: { code: 'asc' } })
    return NextResponse.json(projects)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function POST_HANDLER(request: Request) {
  try {
    const data = await request.json()
    if (!data.code || !data.name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })

    // Check for duplicate code
    const existing = await db.project.findUnique({ where: { code: data.code } })
    if (existing) return NextResponse.json({ error: `Project with code "${data.code}" already exists` }, { status: 409 })

    // Convert date strings to Date objects for Prisma
    if (data.startDate) data.startDate = new Date(data.startDate).toISOString()
    if (data.endDate) data.endDate = new Date(data.endDate).toISOString()

    const project = await db.project.create({ data })
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function PUT_HANDLER(request: Request) {
  try {
    const data = await request.json()
    const { id, code, name, ...rest } = data

    if (!id) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    if (!code || !name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })

    // Check project exists
    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Check for duplicate code (if code is being changed)
    if (code !== existing.code) {
      const duplicate = await db.project.findUnique({ where: { code } })
      if (duplicate) return NextResponse.json({ error: `Project with code "${code}" already exists` }, { status: 409 })
    }

    // Convert date strings to Date objects for Prisma
    if (rest.startDate) rest.startDate = new Date(rest.startDate).toISOString()
    if (rest.endDate) rest.endDate = new Date(rest.endDate).toISOString()

    const project = await db.project.update({
      where: { id },
      data: { code, name, ...rest },
    })
    return NextResponse.json(project)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function DELETE_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })

    // Check project exists
    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Check if project has associated vouchers
    const voucherCount = await db.voucher.count({ where: { projectId: id } })
    if (voucherCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete project "${existing.name}" because it has ${voucherCount} associated voucher(s)` },
        { status: 409 }
      )
    }

    // Check if project has associated budgets
    const budgetCount = await db.budget.count({ where: { projectId: id } })
    if (budgetCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete project "${existing.name}" because it has ${budgetCount} associated budget(s)` },
        { status: 409 }
      )
    }

    await db.project.delete({ where: { id } })
    return NextResponse.json({ success: true, message: `Project "${existing.name}" deleted successfully` })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const POST = withAudit('projects', POST_HANDLER);

export const PUT = withAudit('projects', PUT_HANDLER);

export const DELETE = withAudit('projects', DELETE_HANDLER);

export const GET = withAudit('projects', GET_HANDLER);
