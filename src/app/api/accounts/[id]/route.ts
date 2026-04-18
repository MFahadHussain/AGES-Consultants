import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const account = await db.account.findUnique({
      where: { id },
      include: {
        parent: true,
        children: { orderBy: { code: 'asc' } },
        _count: { select: { children: true, voucherEntries: true, budgetEntries: true } },
      },
    })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    return NextResponse.json(account)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await request.json()
    const account = await db.account.update({
      where: { id },
      data: {
        name: data.name,
        accountType: data.accountType,
        subType: data.subType,
        isActive: data.isActive,
        allowPosting: data.allowPosting,
        description: data.description,
      },
    })
    await db.auditLog.create({
      data: { userId: 'system', action: 'UPDATE', entity: 'Account', entityId: id, details: JSON.stringify(data) },
    })
    return NextResponse.json(account)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const account = await db.account.update({
      where: { id },
      data: { isActive: false },
    })
    await db.auditLog.create({
      data: { userId: 'system', action: 'DELETE', entity: 'Account', entityId: id, details: 'Deactivated account' },
    })
    return NextResponse.json(account)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
