import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const years = await db.financialYear.findMany({ orderBy: { startDate: 'desc' } })
    return NextResponse.json(years)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    if (data.action === 'close') {
      // Close financial year and carry forward balances
      const { id } = data
      const fy = await db.financialYear.findUnique({ where: { id } })
      if (!fy) return NextResponse.json({ error: 'Financial year not found' }, { status: 404 })
      if (fy.status === 'closed') return NextResponse.json({ error: 'Already closed' }, { status: 400 })

      // Get all accounts with their balances
      const accounts = await db.account.findMany({ where: { isActive: true } })
      const balanceData = []

      for (const account of accounts) {
        const result = await db.voucherEntry.aggregate({
          _sum: { debit: true, credit: true },
          where: {
            accountId: account.id,
            voucher: { financialYearId: id, status: 'posted' },
          },
        })
        const totalDebit = result._sum.debit || 0
        const totalCredit = result._sum.credit || 0
        const balance = totalDebit - totalCredit

        // Create balance record
        await db.accountBalance.create({
          data: {
            accountId: account.id,
            financialYearId: id,
            period: fy.name,
            openingDebit: account.openingBalance > 0 ? account.openingBalance : 0,
            openingCredit: account.openingBalance < 0 ? Math.abs(account.openingBalance) : 0,
            periodDebit: totalDebit,
            periodCredit: totalCredit,
            closingDebit: balance > 0 ? balance : 0,
            closingCredit: balance < 0 ? Math.abs(balance) : 0,
          },
        }).catch(() => {}) // Ignore if already exists

        balanceData.push({ account: account.code, balance })
      }

      // Mark year as closed
      await db.financialYear.update({
        where: { id },
        data: { status: 'closed', closedBy: 'system', closedAt: new Date() },
      })

      // Create next financial year if requested
      if (data.createNext) {
        const nextStart = new Date(fy.endDate)
        nextStart.setDate(nextStart.getDate() + 1)
        const nextEnd = new Date(nextStart)
        nextEnd.setFullYear(nextEnd.getFullYear() + 1)
        nextEnd.setDate(nextEnd.getDate() - 1)

        const nextFy = await db.financialYear.create({
          data: {
            name: `FY ${nextStart.getFullYear()}-${String(nextEnd.getFullYear()).slice(2)}`,
            startDate: nextStart,
            endDate: nextEnd,
            status: 'open',
          },
        })

        // Carry forward balances
        for (const bd of balanceData) {
          const acct = accounts.find(a => a.code === bd.account)
          if (acct && bd.balance !== 0) {
            await db.account.update({
              where: { id: acct.id },
              data: { openingBalance: bd.balance },
            })
          }
        }

        return NextResponse.json({ message: 'Year closed and next year created', nextFy, balances: balanceData.length })
      }

      return NextResponse.json({ message: 'Financial year closed', balances: balanceData.length })
    }

    // Create new financial year
    if (!data.name || !data.startDate || !data.endDate) {
      return NextResponse.json({ error: 'Name, start date, and end date are required' }, { status: 400 })
    }
    const fy = await db.financialYear.create({
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: 'open',
      },
    })
    return NextResponse.json(fy, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
