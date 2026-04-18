import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Seed endpoint: clears all transactional and master data except Chart of Accounts
// Keeps: Account table, FinancialYear (ensures at least one open FY), User table
export async function GET() {
  try {
    // Delete in correct order to respect foreign key constraints (child tables first)

    // Level 1: Leaf/child tables with no outgoing FKs to other transactional tables
    await db.voucherEntry.deleteMany()
    await db.voucherApproval.deleteMany()
    await db.voucherAttachment.deleteMany()
    await db.bankReconciliationItem.deleteMany()
    await db.bankStatementItem.deleteMany()
    await db.bankStatement.deleteMany()
    await db.budgetLine.deleteMany()
    await db.fixedAssetDepreciation.deleteMany()
    await db.payrollBatchLine.deleteMany()
    await db.taxCalculation.deleteMany()

    // Level 2: Mid-level tables that are referenced by level 1
    await db.voucher.deleteMany()
    await db.budget.deleteMany()
    await db.fixedAsset.deleteMany()
    await db.payrollBatch.deleteMany()
    await db.taxRate.deleteMany()

    // Level 3: Master data tables that are referenced by level 2
    await db.customer.deleteMany()
    await db.supplier.deleteMany()
    await db.project.deleteMany()
    await db.donor.deleteMany()
    await db.location.deleteMany()
    await db.accountBalance.deleteMany()
    await db.importLog.deleteMany()
    await db.exportLog.deleteMany()
    await db.auditLog.deleteMany()

    // Ensure at least one open Financial Year exists
    const openFY = await db.financialYear.findFirst({ where: { status: 'open' } })
    let financialYearName: string | null = null
    if (!openFY) {
      // Check if any FY exists at all
      const anyFY = await db.financialYear.findFirst({ orderBy: { endDate: 'desc' } })
      if (anyFY) {
        // Reopen the most recent one
        await db.financialYear.update({
          where: { id: anyFY.id },
          data: { status: 'open', closedBy: null, closedAt: null },
        })
        financialYearName = anyFY.name
      } else {
        // Create a default open FY
        const newFY = await db.financialYear.create({
          data: {
            name: 'FY 2025-26',
            startDate: new Date('2025-07-01'),
            endDate: new Date('2026-06-30'),
            status: 'open',
          },
        })
        financialYearName = newFY.name
      }
    } else {
      financialYearName = openFY.name
    }

    // Get remaining counts for confirmation
    const accountCount = await db.account.count()
    const fyCount = await db.financialYear.count()
    const userCount = await db.user.count()

    return NextResponse.json({
      success: true,
      message: 'Database cleared successfully. Chart of Accounts, Financial Year, and Users preserved.',
      preserved: {
        accounts: accountCount,
        financialYears: fyCount,
        users: userCount,
        openFinancialYear: financialYearName,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
