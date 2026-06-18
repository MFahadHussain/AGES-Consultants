import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function GET_HANDLER() {
  try {
    const years = await db.financialYear.findMany({ orderBy: { startDate: 'desc' } })
    return NextResponse.json(years)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function POST_HANDLER(request: Request) {
  try {
    const data = await request.json()

    if (data.action === 'close') {
      const { id } = data
      const fy = await db.financialYear.findUnique({ where: { id } })
      if (!fy) return NextResponse.json({ error: 'Financial year not found' }, { status: 404 })
      if (fy.status === 'closed') return NextResponse.json({ error: 'Already closed' }, { status: 400 })

      // Prevent closing if an earlier open FY exists
      const earlierOpen = await db.financialYear.findFirst({
        where: {
          startDate: { lt: fy.startDate },
          status: { not: 'closed' }
        }
      })

      if (earlierOpen) {
        return NextResponse.json({ error: `Cannot close out of order. Please close ${earlierOpen.name} first.` }, { status: 400 })
      }

      // Execute as atomic transaction
      const result = await db.$transaction(async (tx) => {
        const accounts = await tx.account.findMany({ where: { isActive: true } })
        const balanceData = []
        let netProfitLoss = 0

        for (const account of accounts) {
          const result = await tx.voucherEntry.aggregate({
            _sum: { debit: true, credit: true },
            where: {
              accountId: account.id,
              voucher: { financialYearId: id, status: 'posted' },
            },
          })
          const totalDebit = result._sum?.debit || 0
          const totalCredit = result._sum?.credit || 0
          const balance = totalDebit - totalCredit

          if (account.accountType === 'INCOME') {
            netProfitLoss += (totalCredit - totalDebit)
          } else if (account.accountType === 'EXPENSE') {
            netProfitLoss -= (totalDebit - totalCredit)
          }

          // We don't try-catch here because it's a transaction, if it fails, it rolls back
          const existingBal = await tx.accountBalance.findFirst({
            where: { accountId: account.id, financialYearId: id }
          })
          if (!existingBal) {
            await tx.accountBalance.create({
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
            })
          }

          if (!['INCOME', 'EXPENSE'].includes(account.accountType)) {
            balanceData.push({ account: account.code, accountId: account.id, balance, accountType: account.accountType })
          }
        }

        await tx.financialYear.update({
          where: { id },
          data: { status: 'closed', closedBy: 'system', closedAt: new Date() },
        })

        let nextFy = null;

        if (data.createNext) {
          const nextStart = new Date(fy.endDate)
          nextStart.setDate(nextStart.getDate() + 1)
          const nextEnd = new Date(nextStart)
          nextEnd.setFullYear(nextEnd.getFullYear() + 1)
          nextEnd.setDate(nextEnd.getDate() - 1)

          // Auto-generate next FY if it doesn't exist
          nextFy = await tx.financialYear.findFirst({
             where: { startDate: nextStart }
          })

          if (!nextFy) {
            nextFy = await tx.financialYear.create({
              data: {
                name: `FY ${nextStart.getFullYear()}-${String(nextEnd.getFullYear()).slice(2)}`,
                startDate: nextStart,
                endDate: nextEnd,
                status: 'open',
              },
            })
          }

          for (const bd of balanceData) {
            if (bd.balance !== 0) {
              await tx.account.update({
                where: { id: bd.accountId },
                data: { openingBalance: bd.balance },
              })
            }
          }

          if (netProfitLoss !== 0) {
            const retainedEarningsAcct = accounts.find(a =>
              a.subType === 'RETAINED_EARNINGS' ||
              a.name.toLowerCase().includes('retained earnings') ||
              a.name.toLowerCase().includes('p&l account')
            )
            if (retainedEarningsAcct) {
              const currentBalance = retainedEarningsAcct.openingBalance || 0
              await tx.account.update({
                where: { id: retainedEarningsAcct.id },
                data: { openingBalance: currentBalance + netProfitLoss },
              })
            }
          }
        }

        return { nextFy, balances: balanceData.length, netProfitLoss }
      }, { timeout: 30000 }) // longer timeout for balance calculation

      // Add to audit trail explicitly if withAudit uses request.auditLog
      if ((request as any).auditLog) {
         (request as any).auditLog.action = 'CLOSE_YEAR';
         (request as any).auditLog.details = `Closed FY ${fy.name}. Next FY created: ${result.nextFy ? 'Yes' : 'No'}. Balances carried forward: ${result.balances}. Net P&L: ${result.netProfitLoss}`;
         (request as any).auditLog.targetId = fy.id;
      }

      return NextResponse.json({
        message: 'Financial year closed',
        ...result
      })
    }

    if (!data.name || !data.startDate || !data.endDate) {
      return NextResponse.json({ error: 'Name, start date, and end date are required' }, { status: 400 })
    }

    // Validation for new year overlapping
    const sDate = new Date(data.startDate)
    const eDate = new Date(data.endDate)
    const overlapping = await db.financialYear.findFirst({
       where: {
          OR: [
             { startDate: { lte: eDate }, endDate: { gte: sDate } }
          ]
       }
    })
    
    if (overlapping) {
       return NextResponse.json({ error: `Date range overlaps with existing year: ${overlapping.name}` }, { status: 400 })
    }

    const fy = await db.financialYear.create({
      data: {
        name: data.name,
        startDate: sDate,
        endDate: eDate,
        status: 'open',
      },
    })
    
    if ((request as any).auditLog) {
       (request as any).auditLog.action = 'CREATE_YEAR';
       (request as any).auditLog.details = `Created new FY: ${fy.name} (${data.startDate} to ${data.endDate})`;
       (request as any).auditLog.targetId = fy.id;
    }

    return NextResponse.json(fy, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const POST = withAudit('financial-year', POST_HANDLER);

export const GET = withAudit('financial-year', GET_HANDLER);
