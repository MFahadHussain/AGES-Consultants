import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// GET /api/final-settlement — List settlements with employee details
// ============================================================
async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const employeeId = searchParams.get('employeeId')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (employeeId) where.employeeId = employeeId

    const settlements = await db.finalSettlement.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            department: true,
            designation: true,
            baseSalary: true,
            joiningDate: true,
            leavingDate: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(settlements)
  } catch (error) {
    console.error('[FINAL_SETTLEMENT_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch final settlements' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/final-settlement — Create settlement with auto-calculations
// ============================================================
async function POST_HANDLER(request: Request) {
  try {
    const data = await request.json()

    if (!data.employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      )
    }
    if (!data.leavingDate) {
      return NextResponse.json(
        { error: 'Leaving date is required' },
        { status: 400 }
      )
    }
    if (!data.settlementType) {
      return NextResponse.json(
        { error: 'Settlement type is required' },
        { status: 400 }
      )
    }

    // Verify employee exists
    const employee = await db.employee.findUnique({
      where: { id: data.employeeId },
    })
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Check if settlement already exists for this employee
    const existingSettlement = await db.finalSettlement.findUnique({
      where: { employeeId: data.employeeId },
    })
    if (existingSettlement) {
      return NextResponse.json(
        { error: 'Final settlement already exists for this employee' },
        { status: 409 }
      )
    }

    const leavingDate = new Date(data.leavingDate)
    const basicSalary = Number(data.basicSalary ?? employee.baseSalary)

    // ---- Calculate Unpaid Salary ----
    // Days from last salary date to leaving date
    const lastDayOfPrevMonth = new Date(leavingDate.getFullYear(), leavingDate.getMonth(), 0)
    const joiningDate = employee.joiningDate ? new Date(employee.joiningDate) : null
    const daysInMonth = new Date(leavingDate.getFullYear(), leavingDate.getMonth() + 1, 0).getDate()
    const daysWorked = leavingDate.getDate() // Simplified: days worked in leaving month
    const dailyRate = basicSalary / daysInMonth
    const unpaidSalary = Math.round(dailyRate * daysWorked * 100) / 100

    // ---- Calculate Leave Encashment ----
    // Get attendance records to compute leave balance
    // Simplified: use provided value or calculate from attendance
    let leaveEncashment = Number(data.leaveEncashment || 0)
    if (leaveEncashment === 0 && joiningDate) {
      // Calculate accumulated leaves: approx 2 days per month of service
      const monthsOfService = Math.max(0,
        (leavingDate.getFullYear() - joiningDate.getFullYear()) * 12 +
        (leavingDate.getMonth() - joiningDate.getMonth())
      )
      const accumulatedLeaves = Math.min(monthsOfService * 2, 30) // Cap at 30 days
      leaveEncashment = Math.round(dailyRate * accumulatedLeaves * 100) / 100
    }

    // ---- Calculate Gratuity ----
    let gratuity = Number(data.gratuity || 0)
    if (gratuity === 0 && joiningDate) {
      // Gratuity: 1 month salary per year of service (minimum 5 years for some types)
      const yearsOfService = Math.max(0,
        (leavingDate.getTime() - joiningDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )
      if (data.settlementType === 'Retirement' || data.settlementType === 'Death' || yearsOfService >= 5) {
        gratuity = Math.round(basicSalary * Math.floor(yearsOfService) * 100) / 100
      }
    }

    // ---- Calculate Social Charges Payout ----
    const socialChargesPayout = Number(data.socialChargesPayout || 0)

    // ---- Get Outstanding Loan Balance ----
    let loanBalance = 0
    const activeLoans = await db.loan.findMany({
      where: {
        employeeId: data.employeeId,
        status: 'active',
        isDisbursed: true,
      },
    })
    for (const loan of activeLoans) {
      loanBalance += loan.balanceAmount
    }
    loanBalance = Math.round(loanBalance * 100) / 100

    // ---- Get Outstanding Advance Balance ----
    const advanceBalance = Number(data.advanceBalance || 0)

    // ---- Other Deductions ----
    const otherDeductions = Number(data.otherDeductions || 0)

    // ---- Calculate Totals ----
    const totalPayable = Math.round((unpaidSalary + leaveEncashment + gratuity + socialChargesPayout) * 100) / 100
    const totalDeductions = Math.round((loanBalance + advanceBalance + otherDeductions) * 100) / 100
    const netSettlement = Math.round((totalPayable - totalDeductions) * 100) / 100

    const settlement = await db.finalSettlement.create({
      data: {
        employeeId: data.employeeId,
        leavingDate,
        settlementType: data.settlementType,
        basicSalary,
        unpaidSalary,
        leaveEncashment,
        gratuity,
        socialChargesPayout,
        loanBalance,
        advanceBalance,
        otherDeductions,
        totalPayable,
        totalDeductions,
        netSettlement,
        status: 'draft',
        createdBy: data.createdBy || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            department: true,
            designation: true,
            baseSalary: true,
            joiningDate: true,
            leavingDate: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json(settlement, { status: 201 })
  } catch (error) {
    console.error('[FINAL_SETTLEMENT_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create final settlement' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/final-settlement — Update settlement / handle actions
// ============================================================
async function PUT_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'Settlement ID is required' },
        { status: 400 }
      )
    }

    const data = await request.json()

    const settlement = await db.finalSettlement.findUnique({ where: { id } })
    if (!settlement) {
      return NextResponse.json(
        { error: 'Final settlement not found' },
        { status: 404 }
      )
    }

    // ---- Handle approve action ----
    if (data.action === 'approve') {
      if (settlement.status !== 'draft') {
        return NextResponse.json(
          { error: 'Only draft settlements can be approved' },
          { status: 400 }
        )
      }

      const updated = await db.finalSettlement.update({
        where: { id },
        data: {
          status: 'approved',
          approvedBy: data.approvedBy || null,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeCode: true,
              department: true,
              designation: true,
              baseSalary: true,
              joiningDate: true,
              leavingDate: true,
              status: true,
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ---- Handle pay action ----
    if (data.action === 'pay') {
      if (settlement.status !== 'approved') {
        return NextResponse.json(
          { error: 'Only approved settlements can be marked as paid' },
          { status: 400 }
        )
      }

      const updated = await db.finalSettlement.update({
        where: { id },
        data: {
          status: 'paid',
          paidBy: data.paidBy || null,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeCode: true,
              department: true,
              designation: true,
              baseSalary: true,
              joiningDate: true,
              leavingDate: true,
              status: true,
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ---- Handle post action (post to GL via voucher) ----
    if (data.action === 'post') {
      if (settlement.status !== 'paid') {
        return NextResponse.json(
          { error: 'Only paid settlements can be posted to GL' },
          { status: 400 }
        )
      }
      if (settlement.postedVoucherId) {
        return NextResponse.json(
          { error: 'Settlement already posted to GL' },
          { status: 400 }
        )
      }
      if (!data.financialYearId) {
        return NextResponse.json(
          { error: 'Financial year ID is required for posting' },
          { status: 400 }
        )
      }

      // Get payroll GL mappings for account codes
      const mappings = await db.payrollAccountMapping.findMany({
        where: { isActive: true },
      })
      const mappingByType = new Map(mappings.map((m) => [m.componentType, m]))

      // Build voucher entries for final settlement
      const entries: Array<{
        lineNumber: number
        accountId: string
        debit: number
        credit: number
        description: string
      }> = []

      let lineNumber = 0

      // Debit salary expense / credit salary payable for unpaid salary
      if (settlement.unpaidSalary > 0) {
        const salaryExpenseMapping = mappingByType.get('SALARY_EXPENSE')
        const salaryPayableMapping = mappingByType.get('SALARY_PAYABLE')

        if (salaryExpenseMapping?.debitAccountId) {
          lineNumber++
          entries.push({
            lineNumber,
            accountId: salaryExpenseMapping.debitAccountId,
            debit: settlement.unpaidSalary,
            credit: 0,
            description: `Unpaid salary - Final settlement`,
          })
        }
        if (salaryPayableMapping?.creditAccountId) {
          lineNumber++
          entries.push({
            lineNumber,
            accountId: salaryPayableMapping.creditAccountId,
            debit: 0,
            credit: settlement.unpaidSalary,
            description: `Salary payable - Final settlement`,
          })
        }
      }

      // Leave encashment
      if (settlement.leaveEncashment > 0) {
        const salaryExpenseMapping = mappingByType.get('SALARY_EXPENSE')
        const salaryPayableMapping = mappingByType.get('SALARY_PAYABLE')

        if (salaryExpenseMapping?.debitAccountId) {
          lineNumber++
          entries.push({
            lineNumber,
            accountId: salaryExpenseMapping.debitAccountId,
            debit: settlement.leaveEncashment,
            credit: 0,
            description: `Leave encashment - Final settlement`,
          })
        }
        if (salaryPayableMapping?.creditAccountId) {
          lineNumber++
          entries.push({
            lineNumber,
            accountId: salaryPayableMapping.creditAccountId,
            debit: 0,
            credit: settlement.leaveEncashment,
            description: `Leave encashment payable - Final settlement`,
          })
        }
      }

      // Gratuity
      if (settlement.gratuity > 0) {
        const gratuityMapping = mappingByType.get('GRATUITY')
        if (gratuityMapping?.debitAccountId) {
          lineNumber++
          entries.push({
            lineNumber,
            accountId: gratuityMapping.debitAccountId,
            debit: settlement.gratuity,
            credit: 0,
            description: `Gratuity expense - Final settlement`,
          })
        }
        if (gratuityMapping?.creditAccountId) {
          lineNumber++
          entries.push({
            lineNumber,
            accountId: gratuityMapping.creditAccountId,
            debit: 0,
            credit: settlement.gratuity,
            description: `Gratuity payable - Final settlement`,
          })
        }
      }

      // Loan deduction
      if (settlement.loanBalance > 0) {
        const loanMapping = mappingByType.get('LOAN_DEDUCTION')
        if (loanMapping?.creditAccountId) {
          lineNumber++
          entries.push({
            lineNumber,
            accountId: loanMapping.creditAccountId,
            debit: 0,
            credit: settlement.loanBalance,
            description: `Loan deduction - Final settlement`,
          })
        }
      }

      // Advance deduction
      if (settlement.advanceBalance > 0) {
        const advanceMapping = mappingByType.get('ADVANCE_DEDUCTION')
        if (advanceMapping?.creditAccountId) {
          lineNumber++
          entries.push({
            lineNumber,
            accountId: advanceMapping.creditAccountId,
            debit: 0,
            credit: settlement.advanceBalance,
            description: `Advance deduction - Final settlement`,
          })
        }
      }

      if (entries.length === 0) {
        return NextResponse.json(
          { error: 'No GL accounts configured for settlement posting. Please set up payroll GL mappings.' },
          { status: 400 }
        )
      }

      const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
      const totalCredit = entries.reduce((s, e) => s + e.credit, 0)

      // Create the GL voucher
      const voucher = await db.voucher.create({
        data: {
          voucherNumber: `JV-SETTLE-${Date.now()}`,
          voucherType: 'JV',
          voucherTypeName: 'Journal Voucher',
          date: new Date(),
          narration: `Final settlement for employee ${settlement.employeeId}`,
          status: 'draft',
          financialYearId: data.financialYearId,
          totalDebit,
          totalCredit,
          createdBy: data.postedBy || 'system',
          entries: { create: entries },
        },
      })

      // Update settlement as posted
      const updated = await db.finalSettlement.update({
        where: { id },
        data: {
          status: 'posted',
          postedVoucherId: voucher.id,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeCode: true,
              department: true,
              designation: true,
              baseSalary: true,
              joiningDate: true,
              leavingDate: true,
              status: true,
            },
          },
        },
      })

      return NextResponse.json({
        settlement: updated,
        voucher: {
          id: voucher.id,
          voucherNumber: voucher.voucherNumber,
          totalDebit,
          totalCredit,
        },
      })
    }

    // ---- General update (only in draft status) ----
    if (settlement.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot update a settlement with status "${settlement.status}". Only draft settlements can be edited.` },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (data.leavingDate) updateData.leavingDate = new Date(data.leavingDate)
    if (data.settlementType) updateData.settlementType = data.settlementType
    if (data.basicSalary !== undefined) updateData.basicSalary = Number(data.basicSalary)
    if (data.unpaidSalary !== undefined) updateData.unpaidSalary = Number(data.unpaidSalary)
    if (data.leaveEncashment !== undefined) updateData.leaveEncashment = Number(data.leaveEncashment)
    if (data.gratuity !== undefined) updateData.gratuity = Number(data.gratuity)
    if (data.socialChargesPayout !== undefined) updateData.socialChargesPayout = Number(data.socialChargesPayout)
    if (data.loanBalance !== undefined) updateData.loanBalance = Number(data.loanBalance)
    if (data.advanceBalance !== undefined) updateData.advanceBalance = Number(data.advanceBalance)
    if (data.otherDeductions !== undefined) updateData.otherDeductions = Number(data.otherDeductions)

    // Recalculate totals if any amounts changed
    const unpaidSalary = Number(data.unpaidSalary ?? settlement.unpaidSalary)
    const leaveEncashment = Number(data.leaveEncashment ?? settlement.leaveEncashment)
    const gratuity = Number(data.gratuity ?? settlement.gratuity)
    const socialChargesPayout = Number(data.socialChargesPayout ?? settlement.socialChargesPayout)
    const loanBalance = Number(data.loanBalance ?? settlement.loanBalance)
    const advanceBalance = Number(data.advanceBalance ?? settlement.advanceBalance)
    const otherDeductions = Number(data.otherDeductions ?? settlement.otherDeductions)

    const totalPayable = Math.round((unpaidSalary + leaveEncashment + gratuity + socialChargesPayout) * 100) / 100
    const totalDeductions = Math.round((loanBalance + advanceBalance + otherDeductions) * 100) / 100
    const netSettlement = Math.round((totalPayable - totalDeductions) * 100) / 100

    updateData.totalPayable = totalPayable
    updateData.totalDeductions = totalDeductions
    updateData.netSettlement = netSettlement

    const updated = await db.finalSettlement.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            department: true,
            designation: true,
            baseSalary: true,
            joiningDate: true,
            leavingDate: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[FINAL_SETTLEMENT_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update final settlement' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/final-settlement — Delete only if draft
// ============================================================
async function DELETE_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'Settlement ID is required' },
        { status: 400 }
      )
    }

    const settlement = await db.finalSettlement.findUnique({ where: { id } })
    if (!settlement) {
      return NextResponse.json(
        { error: 'Final settlement not found' },
        { status: 404 }
      )
    }

    if (settlement.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot delete a settlement with status "${settlement.status}". Only draft settlements can be deleted.` },
        { status: 400 }
      )
    }

    await db.finalSettlement.delete({ where: { id } })

    return NextResponse.json({ message: 'Final settlement deleted successfully' })
  } catch (error) {
    console.error('[FINAL_SETTLEMENT_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete final settlement' },
      { status: 500 }
    )
  }
}

export const POST = withAudit('final-settlement', POST_HANDLER);

export const PUT = withAudit('final-settlement', PUT_HANDLER);

export const DELETE = withAudit('final-settlement', DELETE_HANDLER);

export const GET = withAudit('final-settlement', GET_HANDLER);
