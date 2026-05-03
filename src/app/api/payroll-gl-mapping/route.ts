import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Default component types for seeding
const DEFAULT_COMPONENT_TYPES = [
  { componentType: 'SALARY_EXPENSE', description: 'Salary Expense - Debit to salary expense account' },
  { componentType: 'ALLOWANCE_EXPENSE', description: 'Allowance Expense - Debit to allowance expense account' },
  { componentType: 'INCOME_TAX_PAYABLE', description: 'Income Tax Payable - Credit to income tax payable account' },
  { componentType: 'EOBI_EMPLOYEE', description: 'EOBI Employee Contribution - Credit to EOBI payable account' },
  { componentType: 'EOBI_EMPLOYER', description: 'EOBI Employer Contribution - Debit to social charges, Credit to EOBI payable' },
  { componentType: 'PF_EMPLOYEE', description: 'Provident Fund Employee - Credit to PF payable account' },
  { componentType: 'PF_EMPLOYER', description: 'Provident Fund Employer - Debit to PF expense, Credit to PF payable' },
  { componentType: 'SOCIAL_CHARGES', description: 'Social Charges - Debit to social charges expense account' },
  { componentType: 'SALARY_PAYABLE', description: 'Salary Payable - Credit to salary payable account' },
  { componentType: 'GRATUITY', description: 'Gratuity - Debit to gratuity expense, Credit to gratuity payable' },
  { componentType: 'LOAN_DEDUCTION', description: 'Loan Deduction - Credit to loan receivable account' },
  { componentType: 'ADVANCE_DEDUCTION', description: 'Advance Deduction - Credit to advance receivable account' },
]

/**
 * Enrich mapping records with debit/credit account details
 * since there are no formal FK relations in the schema.
 */
async function enrichMappings(mappings: Array<Record<string, unknown>>) {
  const accountIds = new Set<string>()
  for (const m of mappings) {
    if (m.debitAccountId) accountIds.add(m.debitAccountId as string)
    if (m.creditAccountId) accountIds.add(m.creditAccountId as string)
  }

  const accounts = accountIds.size > 0
    ? await db.account.findMany({
        where: { id: { in: Array.from(accountIds) } },
        select: { id: true, code: true, name: true, accountType: true },
      })
    : []

  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  return mappings.map((m) => ({
    ...m,
    debitAccount: m.debitAccountId ? accountMap.get(m.debitAccountId as string) || null : null,
    creditAccount: m.creditAccountId ? accountMap.get(m.creditAccountId as string) || null : null,
  }))
}

// ============================================================
// GET /api/payroll-gl-mapping — List all mappings with account details
// ============================================================
export async function GET() {
  try {
    const mappings = await db.payrollAccountMapping.findMany({
      orderBy: { componentType: 'asc' },
    })

    const enriched = await enrichMappings(mappings as unknown as Array<Record<string, unknown>>)

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('[PAYROLL_GL_MAPPING_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch payroll account mappings' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/payroll-gl-mapping — Create mapping or seed defaults
// ============================================================
export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Special action: seed-defaults
    if (data.action === 'seed-defaults') {
      const results = []

      for (const defaultItem of DEFAULT_COMPONENT_TYPES) {
        // Check if already exists
        const existing = await db.payrollAccountMapping.findUnique({
          where: { componentType: defaultItem.componentType },
        })

        if (existing) {
          results.push({ componentType: defaultItem.componentType, status: 'skipped', reason: 'Already exists' })
          continue
        }

        const mapping = await db.payrollAccountMapping.create({
          data: {
            componentType: defaultItem.componentType,
            description: defaultItem.description,
            isActive: true,
          },
        })

        results.push({ componentType: defaultItem.componentType, status: 'created', id: mapping.id })
      }

      return NextResponse.json({
        message: 'Default mappings seeded',
        results,
        created: results.filter((r) => r.status === 'created').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
      })
    }

    // Create single mapping
    if (!data.componentType) {
      return NextResponse.json(
        { error: 'Component type is required' },
        { status: 400 }
      )
    }

    // Validate componentType uniqueness
    const existingMapping = await db.payrollAccountMapping.findUnique({
      where: { componentType: data.componentType },
    })
    if (existingMapping) {
      return NextResponse.json(
        { error: `Mapping for component type "${data.componentType}" already exists` },
        { status: 409 }
      )
    }

    // Validate debitAccountId exists if provided
    if (data.debitAccountId) {
      const debitAccount = await db.account.findUnique({
        where: { id: data.debitAccountId },
      })
      if (!debitAccount) {
        return NextResponse.json(
          { error: `Debit account with ID "${data.debitAccountId}" not found` },
          { status: 400 }
        )
      }
    }

    // Validate creditAccountId exists if provided
    if (data.creditAccountId) {
      const creditAccount = await db.account.findUnique({
        where: { id: data.creditAccountId },
      })
      if (!creditAccount) {
        return NextResponse.json(
          { error: `Credit account with ID "${data.creditAccountId}" not found` },
          { status: 400 }
        )
      }
    }

    const mapping = await db.payrollAccountMapping.create({
      data: {
        componentType: data.componentType,
        debitAccountId: data.debitAccountId || null,
        creditAccountId: data.creditAccountId || null,
        description: data.description || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    })

    // Enrich the response with account details
    const enriched = await enrichMappings([mapping as unknown as Record<string, unknown>])

    return NextResponse.json(enriched[0], { status: 201 })
  } catch (error) {
    console.error('[PAYROLL_GL_MAPPING_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create payroll account mapping' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/payroll-gl-mapping — Update mapping
// ============================================================
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'Mapping ID is required' },
        { status: 400 }
      )
    }

    const data = await request.json()

    const mapping = await db.payrollAccountMapping.findUnique({ where: { id } })
    if (!mapping) {
      return NextResponse.json(
        { error: 'Payroll account mapping not found' },
        { status: 404 }
      )
    }

    // If componentType is being changed, validate uniqueness
    if (data.componentType && data.componentType !== mapping.componentType) {
      const existingMapping = await db.payrollAccountMapping.findUnique({
        where: { componentType: data.componentType },
      })
      if (existingMapping) {
        return NextResponse.json(
          { error: `Mapping for component type "${data.componentType}" already exists` },
          { status: 409 }
        )
      }
    }

    // Validate debitAccountId if being updated
    if (data.debitAccountId) {
      const debitAccount = await db.account.findUnique({
        where: { id: data.debitAccountId },
      })
      if (!debitAccount) {
        return NextResponse.json(
          { error: `Debit account with ID "${data.debitAccountId}" not found` },
          { status: 400 }
        )
      }
    }

    // Validate creditAccountId if being updated
    if (data.creditAccountId) {
      const creditAccount = await db.account.findUnique({
        where: { id: data.creditAccountId },
      })
      if (!creditAccount) {
        return NextResponse.json(
          { error: `Credit account with ID "${data.creditAccountId}" not found` },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.componentType) updateData.componentType = data.componentType
    if (data.debitAccountId !== undefined) updateData.debitAccountId = data.debitAccountId || null
    if (data.creditAccountId !== undefined) updateData.creditAccountId = data.creditAccountId || null
    if (data.description !== undefined) updateData.description = data.description
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const updated = await db.payrollAccountMapping.update({
      where: { id },
      data: updateData,
    })

    // Enrich the response with account details
    const enriched = await enrichMappings([updated as unknown as Record<string, unknown>])

    return NextResponse.json(enriched[0])
  } catch (error) {
    console.error('[PAYROLL_GL_MAPPING_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update payroll account mapping' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/payroll-gl-mapping — Delete mapping
// ============================================================
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'Mapping ID is required' },
        { status: 400 }
      )
    }

    const mapping = await db.payrollAccountMapping.findUnique({ where: { id } })
    if (!mapping) {
      return NextResponse.json(
        { error: 'Payroll account mapping not found' },
        { status: 404 }
      )
    }

    await db.payrollAccountMapping.delete({ where: { id } })

    return NextResponse.json({ message: 'Payroll account mapping deleted successfully' })
  } catch (error) {
    console.error('[PAYROLL_GL_MAPPING_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete payroll account mapping' },
      { status: 500 }
    )
  }
}
