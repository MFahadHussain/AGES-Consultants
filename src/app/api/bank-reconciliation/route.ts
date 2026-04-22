import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'
import { findAccountsByRole } from '@/lib/account-roles'

// ============================================================
// Bank Reconciliation API
// Supports:
//   GET ?action=init                     → Bank accounts from COA + last reconciled period per account
//   GET ?action=vouchers&accountId=X&period=YYYY-MM  → Vouchers (payments & receipts) for bank account in period
//   GET ?action=book-balance&accountId=X&period=YYYY-MM → Computed book balance
//   POST { action: 'finalize', accountId, period, statementBalance, checkedVoucherIds, ... } → Finalize reconciliation
//   POST { action: 'reconcile', bankStatementItemId, voucherId } → Match a bank statement item with a voucher (legacy)
//   POST { action: 'create-statement', ... } → Create bank statement (legacy)
// ============================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'init'

    switch (action) {
      case 'init': {
        // Get bank accounts from Chart of Accounts (subType = BANK)
        const bankAccountResults = await findAccountsByRole('BANK_ACCOUNT')
        const bankAccounts = bankAccountResults.map(a => ({
          ...a,
          accountType: 'ASSET' as const,
          subType: 'BANK' as const,
        }))

        // Get last reconciled period per bank account
        const reconciliations = await db.bankReconciliation.findMany({
          where: { status: 'finalized' },
          orderBy: { period: 'desc' },
          select: { accountId: true, period: true, finalizedAt: true },
        })

        // Build a map of last reconciled period per account
        const lastReconciledMap: Record<string, { period: string; finalizedAt: string | null }> = {}
        for (const r of reconciliations) {
          if (!lastReconciledMap[r.accountId]) {
            lastReconciledMap[r.accountId] = { period: r.period, finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : null }
          }
        }

        return NextResponse.json({ bankAccounts, lastReconciled: lastReconciledMap })
      }

      case 'vouchers': {
        // Get vouchers for a bank account in a specific period
        const accountId = searchParams.get('accountId')
        const period = searchParams.get('period') // YYYY-MM

        if (!accountId || !period) {
          return NextResponse.json({ error: 'accountId and period are required' }, { status: 400 })
        }

        const [year, month] = period.split('-').map(Number)
        const periodStart = new Date(year, month - 1, 1)
        const periodEnd = new Date(year, month, 0, 23, 59, 59, 999) // Last day of month

        // Find all voucher entries for this bank account in the period
        // Only include posted/approved vouchers
        const entries = await db.voucherEntry.findMany({
          where: {
            accountId,
            voucher: {
              date: { gte: periodStart, lte: periodEnd },
              status: { in: ['approved', 'posted'] },
              voucherType: { in: ['BP', 'BR'] }, // Only bank payment and bank receipt vouchers
            },
          },
          include: {
            voucher: {
              select: {
                id: true,
                voucherNumber: true,
                voucherType: true,
                voucherTypeName: true,
                date: true,
                narration: true,
                payeeName: true,
                chequeNumber: true,
                status: true,
                isReconciled: true,
                clearanceDate: true,
                totalDebit: true,
                totalCredit: true,
              },
            },
          },
          orderBy: [{ voucher: { date: 'asc' } }],
        })

        // Separate into payments and receipts based on the bank account entry side
        // Payment (BP): bank account is CREDITED (money goes out)
        // Receipt (BR): bank account is DEBITED (money comes in)
        const payments: any[] = []
        const receipts: any[] = []
        const seenVoucherIds = new Set<string>()

        for (const entry of entries) {
          // Avoid duplicate vouchers (a voucher might have multiple entries for the same bank account)
          if (seenVoucherIds.has(entry.voucherId)) continue
          seenVoucherIds.add(entry.voucherId)

          const v = entry.voucher
          const item = {
            voucherId: v.id,
            voucherNumber: v.voucherNumber,
            voucherType: v.voucherType,
            voucherTypeName: v.voucherTypeName,
            date: v.date,
            narration: v.narration,
            payeeName: v.payeeName,
            chequeNumber: v.chequeNumber,
            amount: entry.credit > 0 ? entry.credit : entry.debit, // The amount affecting the bank account
            isReconciled: v.isReconciled,
            clearanceDate: v.clearanceDate,
            status: v.status,
          }

          if (entry.credit > 0) {
            // Bank is credited → payment (money goes out)
            payments.push(item)
          } else if (entry.debit > 0) {
            // Bank is debited → receipt (money comes in)
            receipts.push(item)
          }
        }

        return NextResponse.json({ payments, receipts })
      }

      case 'book-balance': {
        // Compute book balance for a bank account up to the end of the period
        const accountId = searchParams.get('accountId')
        const period = searchParams.get('period')

        if (!accountId || !period) {
          return NextResponse.json({ error: 'accountId and period are required' }, { status: 400 })
        }

        const [year, month] = period.split('-').map(Number)
        const periodEnd = new Date(year, month, 0, 23, 59, 59, 999)

        // Get the account's opening balance
        const account = await db.account.findUnique({
          where: { id: accountId },
          select: { openingBalance: true, code: true, name: true },
        })

        // Sum all debit and credit entries for this account up to period end
        const result = await db.voucherEntry.aggregate({
          _sum: { debit: true, credit: true },
          where: {
            accountId,
            voucher: {
              date: { lte: periodEnd },
              status: { in: ['approved', 'posted'] },
            },
          },
        })

        const totalDebit = result._sum.debit || 0
        const totalCredit = result._sum.credit || 0
        const openingBalance = account?.openingBalance || 0

        // For bank accounts (assets), DR balance = money in bank
        // Book Balance = Opening Balance + Total Debit - Total Credit
        const bookBalance = openingBalance + totalDebit - totalCredit

        return NextResponse.json({
          accountId,
          accountCode: account?.code,
          accountName: account?.name,
          openingBalance,
          totalDebit,
          totalCredit,
          bookBalance,
        })
      }

      case 'reconciliation-status': {
        // Check if a reconciliation exists for this account+period
        const accountId = searchParams.get('accountId')
        const period = searchParams.get('period')

        if (!accountId || !period) {
          return NextResponse.json({ error: 'accountId and period are required' }, { status: 400 })
        }

        const reconciliation = await db.bankReconciliation.findUnique({
          where: { accountId_period: { accountId, period } },
        })

        return NextResponse.json({ reconciliation })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('GET /api/bank-reconciliation error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    if (data.action === 'finalize') {
      // Finalize bank reconciliation
      const { accountId, period, statementBalance, bookBalance, unpresentedTotal, uncreditedTotal, adjustedBookBalance, adjustedBankBalance, checkedVoucherIds } = data

      if (!accountId || !period || statementBalance === undefined || !checkedVoucherIds) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // Check if already finalized
      const existing = await db.bankReconciliation.findUnique({
        where: { accountId_period: { accountId, period } },
      })

      if (existing?.status === 'finalized') {
        return NextResponse.json({ error: 'This period is already finalized and locked' }, { status: 400 })
      }

      const systemUserId = await getSystemUserId()
      const now = new Date()

      // Create or update the reconciliation record
      const reconciliation = await db.bankReconciliation.upsert({
        where: { accountId_period: { accountId, period } },
        create: {
          accountId,
          period,
          statementBalance,
          bookBalance,
          unpresentedTotal,
          uncreditedTotal,
          adjustedBookBalance,
          adjustedBankBalance,
          status: 'finalized',
          finalizedBy: systemUserId,
          finalizedAt: now,
        },
        update: {
          statementBalance,
          bookBalance,
          unpresentedTotal,
          uncreditedTotal,
          adjustedBookBalance,
          adjustedBankBalance,
          status: 'finalized',
          finalizedBy: systemUserId,
          finalizedAt: now,
        },
      })

      // Mark all checked vouchers as reconciled
      if (checkedVoucherIds.length > 0) {
        await db.voucher.updateMany({
          where: { id: { in: checkedVoucherIds } },
          data: {
            isReconciled: true,
            clearanceDate: now,
          },
        })
      }

      // Create audit log
      try {
        await db.auditLog.create({
          data: {
            userId: systemUserId,
            action: 'FINALIZE',
            entity: 'BankReconciliation',
            entityId: reconciliation.id,
            details: `Bank reconciliation finalized for account ${accountId}, period ${period}. Statement: ${statementBalance}, Book: ${bookBalance}`,
          },
        })
      } catch (auditError) {
        console.error('Audit log creation failed (non-critical):', auditError)
      }

      return NextResponse.json({ success: true, reconciliation })
    }

    if (data.action === 'reconcile') {
      // Legacy: Match a bank statement item with a voucher
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

    if (data.action === 'create-statement') {
      // Legacy: Create bank statement with items
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
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/bank-reconciliation error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
