import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const where: any = {}
    if (search) {
      where.OR = [{ code: { contains: search } }, { name: { contains: search } }]
    }
    const suppliers = await db.supplier.findMany({ where, orderBy: { code: 'asc' } })
    return NextResponse.json(suppliers)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function POST_HANDLER(request: Request) {
  try {
    const data = await request.json()
    if (!data.code || !data.name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    }
    const supplier = await db.supplier.create({ data })
    await db.auditLog.create({
      data: { userId: 'system', action: 'CREATE', entity: 'Supplier', entityId: supplier.id, details: `Created supplier ${data.code}` },
    })
    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const POST = withAudit('suppliers', POST_HANDLER);

export const GET = withAudit('suppliers', GET_HANDLER);
