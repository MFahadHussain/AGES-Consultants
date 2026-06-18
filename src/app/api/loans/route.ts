import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// GET /api/loans — List loans with optional filters
// ============================================================
async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status

    const loans = await db.loan.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            department: true,
            designation: true,
          },
        },
        installments: {
          orderBy: { installmentNo: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(loans)
  } catch (error) {
    console.error('[LOANS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch loans' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/loans — Create a new loan with installment schedule
// ============================================================
async function POST_HANDLER(request: Request) {
  try {
    const data = await request.json()

    // Validate required fields
    const requiredFields = ['employeeId', 'loanType', 'principalAmount', 'tenureMonths', 'disbursementDate', 'startDate']
    for (const field of requiredFields) {
      if (!data[field] && data[field] !== 0) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    if (data.principalAmount <= 0) {
      return NextResponse.json(
        { error: 'Principal amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (data.tenureMonths <= 0) {
      return NextResponse.json(
        { error: 'Tenure months must be greater than 0' },
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

    // Auto-generate loan number: LOAN-YYYY-NNNN
    const currentYear = new Date().getFullYear()
    const prefix = `LOAN-${currentYear}-`
    const lastLoan = await db.loan.findFirst({
      where: { loanNumber: { startsWith: prefix } },
      orderBy: { loanNumber: 'desc' },
    })
    let nextNumber = 1
    if (lastLoan) {
      const parts = lastLoan.loanNumber.split('-')
      const lastNum = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(lastNum)) nextNumber = lastNum + 1
    }
    const loanNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`

    // Calculate monthly deduction and installment breakdown
    const principalAmount = Number(data.principalAmount)
    const interestRate = Number(data.interestRate || 0)
    const tenureMonths = Number(data.tenureMonths)

    // Flat-rate EMI calculation: (principal + total interest) / tenure
    const totalInterest = (principalAmount * interestRate * tenureMonths) / (12 * 100)
    const totalPayable = principalAmount + totalInterest
    const monthlyDeduction = Math.round((totalPayable / tenureMonths) * 100) / 100
    const monthlyPrincipal = Math.round((principalAmount / tenureMonths) * 100) / 100
    const monthlyInterest = Math.round((totalInterest / tenureMonths) * 100) / 100

    // Calculate end date (startDate + tenureMonths)
    const startDate = new Date(data.startDate)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + tenureMonths)

    // Build installment schedule
    const installmentData = []
    let runningBalance = totalPayable
    for (let i = 1; i <= tenureMonths; i++) {
      const dueDate = new Date(startDate)
      dueDate.setMonth(dueDate.getMonth() + i)

      // For the last installment, adjust to clear rounding differences
      let installmentAmount = monthlyDeduction
      let principalPart = monthlyPrincipal
      let interestPart = monthlyInterest

      if (i === tenureMonths) {
        principalPart = Math.round((principalAmount - monthlyPrincipal * (tenureMonths - 1)) * 100) / 100
        interestPart = Math.round((totalInterest - monthlyInterest * (tenureMonths - 1)) * 100) / 100
        installmentAmount = Math.round((principalPart + interestPart) * 100) / 100
      }

      runningBalance -= installmentAmount
      if (runningBalance < 0) runningBalance = 0

      installmentData.push({
        installmentNo: i,
        dueDate,
        amount: installmentAmount,
        principalPart,
        interestPart,
        paidAmount: 0,
        status: 'pending',
      })
    }

    // Create loan with installments in a transaction
    const loan = await db.loan.create({
      data: {
        loanNumber,
        employeeId: data.employeeId,
        loanType: data.loanType,
        principalAmount,
        interestRate,
        tenureMonths,
        disbursedAmount: 0,
        balanceAmount: 0,
        monthlyDeduction,
        disbursementDate: new Date(data.disbursementDate),
        startDate,
        endDate,
        status: 'active',
        isDisbursed: false,
        disbursedBy: data.disbursedBy || null,
        createdBy: data.createdBy || null,
        installments: {
          create: installmentData,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            department: true,
            designation: true,
          },
        },
        installments: {
          orderBy: { installmentNo: 'asc' },
        },
      },
    })

    return NextResponse.json(loan, { status: 201 })
  } catch (error) {
    console.error('[LOANS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create loan' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/loans — Update loan / handle disbursement
// ============================================================
async function PUT_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'Loan ID is required' },
        { status: 400 }
      )
    }

    const data = await request.json()

    const loan = await db.loan.findUnique({
      where: { id },
      include: { installments: true },
    })
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    // Handle disbursement action
    if (data.action === 'disburse') {
      if (loan.isDisbursed) {
        return NextResponse.json(
          { error: 'Loan is already disbursed' },
          { status: 400 }
        )
      }

      const disbursedAmount = Number(data.disbursedAmount ?? loan.principalAmount)
      const balanceAmount = disbursedAmount + (loan.principalAmount * loan.interestRate * loan.tenureMonths) / (12 * 100)

      const updated = await db.loan.update({
        where: { id },
        data: {
          isDisbursed: true,
          disbursedAmount,
          balanceAmount: Math.round(balanceAmount * 100) / 100,
          disbursedBy: data.disbursedBy || null,
          disbursementDate: data.disbursementDate
            ? new Date(data.disbursementDate)
            : loan.disbursementDate,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeCode: true,
              department: true,
              designation: true,
            },
          },
          installments: {
            orderBy: { installmentNo: 'asc' },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // Handle write-off action
    if (data.action === 'write_off') {
      if (loan.status !== 'active') {
        return NextResponse.json(
          { error: 'Only active loans can be written off' },
          { status: 400 }
        )
      }

      const updated = await db.loan.update({
        where: { id },
        data: {
          status: 'written_off',
          balanceAmount: 0,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeCode: true,
              department: true,
              designation: true,
            },
          },
          installments: {
            orderBy: { installmentNo: 'asc' },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // Handle close action
    if (data.action === 'close') {
      if (loan.status !== 'active') {
        return NextResponse.json(
          { error: 'Only active loans can be closed' },
          { status: 400 }
        )
      }

      const updated = await db.loan.update({
        where: { id },
        data: {
          status: 'closed',
          balanceAmount: 0,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeCode: true,
              department: true,
              designation: true,
            },
          },
          installments: {
            orderBy: { installmentNo: 'asc' },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // General update
    const updateData: Record<string, unknown> = {}
    if (data.loanType) updateData.loanType = data.loanType
    if (data.interestRate !== undefined) updateData.interestRate = Number(data.interestRate)
    if (data.tenureMonths !== undefined) updateData.tenureMonths = Number(data.tenureMonths)
    if (data.monthlyDeduction !== undefined) updateData.monthlyDeduction = Number(data.monthlyDeduction)
    if (data.startDate) updateData.startDate = new Date(data.startDate)
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null
    if (data.status) updateData.status = data.status

    // Prevent updating a closed or written-off loan
    if (loan.status === 'closed' || loan.status === 'written_off') {
      return NextResponse.json(
        { error: `Cannot update a ${loan.status} loan` },
        { status: 400 }
      )
    }

    const updated = await db.loan.update({
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
          },
        },
        installments: {
          orderBy: { installmentNo: 'asc' },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[LOANS_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update loan' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/loans — Delete only if draft (status=active and no installments paid)
// ============================================================
async function DELETE_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'Loan ID is required' },
        { status: 400 }
      )
    }

    const loan = await db.loan.findUnique({
      where: { id },
      include: { installments: true },
    })
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    // Only allow deletion if no installments have been paid
    const hasPaidInstallments = loan.installments.some(
      (inst) => inst.status === 'paid' || inst.paidAmount > 0
    )
    if (hasPaidInstallments) {
      return NextResponse.json(
        { error: 'Cannot delete loan with paid installments' },
        { status: 400 }
      )
    }

    // Only allow deletion if loan is not disbursed
    if (loan.isDisbursed) {
      return NextResponse.json(
        { error: 'Cannot delete a disbursed loan' },
        { status: 400 }
      )
    }

    // Delete installments first (cascade should handle this, but be explicit)
    await db.loanInstallment.deleteMany({ where: { loanId: id } })
    await db.loan.delete({ where: { id } })

    return NextResponse.json({ message: 'Loan deleted successfully' })
  } catch (error) {
    console.error('[LOANS_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete loan' },
      { status: 500 }
    )
  }
}

export const POST = withAudit('loans', POST_HANDLER);

export const PUT = withAudit('loans', PUT_HANDLER);

export const DELETE = withAudit('loans', DELETE_HANDLER);

export const GET = withAudit('loans', GET_HANDLER);
