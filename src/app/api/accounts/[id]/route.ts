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
        code: data.code,
        name: data.name,
        accountType: data.accountType,
        subType: data.subType || null,
        parentId: data.parentId === 'none' || data.parentId === '' ? null : data.parentId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        allowPosting: data.allowPosting,
        description: data.description,
        level: data.parentId && data.parentId !== 'none' ? 1 : 0
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
    const accountCheck = await db.account.findUnique({ where: { id } })

    if (!accountCheck) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let account;
    
    try {
      // Attempt hard delete
      account = await db.account.delete({ where: { id } })
      await db.auditLog.create({
        data: { userId: 'system', action: 'DELETE', entity: 'Account', entityId: id, details: 'Deleted account' },
      })
    } catch (e: any) {
      // If foreign key constraint fails (e.code === 'P2003'), fallback to soft delete
      if (e.code === 'P2003') {
        account = await db.account.update({
          where: { id },
          data: { isActive: false },
        })
        await db.auditLog.create({
          data: { userId: 'system', action: 'DEACTIVATE', entity: 'Account', entityId: id, details: 'Deactivated account due to existing dependencies' },
        })
      } else {
        throw e
      }
    }
    
    return NextResponse.json(account)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
