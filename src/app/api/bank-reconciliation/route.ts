import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    const where: any = {}
    if (accountId) where.accountId = accountId

    const statements = await db.bankStatement.findMany({
      where,
      include: {
        account: { select: { code: true, name: true } },
        items: { include: { reconItems: { include: { voucher: { select: { voucherNumber: true, narration: true } } } } }, orderBy: { date: 'asc' } },
      },
      orderBy: { statementDate: 'desc' },
    })

    return NextResponse.json(statements)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    if (data.action === 'reconcile') {
      // Match a bank statement item with a voucher
      const { bankStatementItemId, voucherId } = data
      const reconItem = await db.bankReconciliationItem.create({
        data: {
          bankStatementItemId,
          voucherId,
          status: 'matched',
          reconciledBy: 'system',
        },
      })
      if (bankStatementItemId) {
        await db.bankStatementItem.update({
          where: { id: bankStatementItemId },
          data: { isMatched: true },
        })
      }
      return NextResponse.json(reconItem, { status: 201 })
    }

    // Create bank statement with items
    const { accountId, statementDate, openingBalance, closingBalance, items } = data
    if (!accountId || !statementDate) {
      return NextResponse.json({ error: 'Account ID and statement date are required' }, { status: 400 })
    }

    const statement = await db.bankStatement.create({
      data: {
        accountId,
        statementDate: new Date(statementDate),
        openingBalance: openingBalance || 0,
        closingBalance: closingBalance || 0,
        items: {
          create: (items || []).map((item: any) => ({
            date: new Date(item.date),
            description: item.description,
            amount: item.amount,
            type: item.type,
            reference: item.reference || null,
          })),
        },
      },
      include: { items: true },
    })

    return NextResponse.json(statement, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
