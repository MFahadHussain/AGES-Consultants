import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const accountType = searchParams.get('accountType')
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')

    const where: any = {}
    if (accountType) where.accountType = accountType
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ]
    }

    const accounts = await db.account.findMany({
      where,
      include: {
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { children: true, voucherEntries: true } },
      },
      orderBy: [{ accountType: 'asc' }, { code: 'asc' }],
    })

    return NextResponse.json(accounts)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { code, name, accountType, subType, parentId, level, allowPosting, description } = data

    if (!code || !name || !accountType) {
      return NextResponse.json({ error: 'Code, name, and accountType are required' }, { status: 400 })
    }

    const existing = await db.account.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 400 })
    }

    const account = await db.account.create({
      data: {
        code,
        name,
        accountType,
        subType: subType || null,
        parentId: parentId || null,
        level: level || 0,
        allowPosting: allowPosting ?? true,
        description: description || null,
      },
      include: { parent: true },
    })

    await db.auditLog.create({
      data: { userId: 'system', action: 'CREATE', entity: 'Account', entityId: account.id, details: `Created account ${code} - ${name}` },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
