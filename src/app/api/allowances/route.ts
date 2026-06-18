import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// GET /api/allowances — List all allowances, optional ?isActive=true|false
// ============================================================
async function GET_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const allowances = await db.allowance.findMany({
      where,
      include: { _count: { select: { employeeAllowances: true } } },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(allowances)
  } catch (error) {
    console.error('[ALLOWANCES_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch allowances' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/allowances — Create a new allowance (validates unique code)
// ============================================================
async function POST_HANDLER(request: Request) {
  try {
    const body = await request.json()
    const { code, name, allowanceType, value, baseOnSalary, isTaxable, isProjectSpecific, isActive, isInclusive, isSocialCharges } = body

    // --- Required fields ---
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      )
    }

    // --- Validate unique code ---
    const existing = await db.allowance.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json(
        { error: `Allowance code "${code}" already exists` },
        { status: 409 }
      )
    }

    // --- Validate allowanceType ---
    const type = allowanceType || 'fixed'
    if (!['fixed', 'percentage'].includes(type)) {
      return NextResponse.json(
        { error: 'allowanceType must be "fixed" or "percentage"' },
        { status: 400 }
      )
    }

    // --- Validate value ---
    const numValue = Number(value ?? 0)
    if (isNaN(numValue) || numValue < 0) {
      return NextResponse.json(
        { error: 'Value must be a non-negative number' },
        { status: 400 }
      )
    }

    // --- Percentage-specific validation ---
    if (type === 'percentage' && numValue > 100) {
      return NextResponse.json(
        { error: 'Percentage value cannot exceed 100' },
        { status: 400 }
      )
    }

    const allowance = await db.allowance.create({
      data: {
        code,
        name,
        allowanceType: type,
        value: numValue,
        baseOnSalary: Boolean(baseOnSalary ?? false),
        isTaxable: Boolean(isTaxable ?? true),
        isProjectSpecific: Boolean(isProjectSpecific ?? false),
        isInclusive: Boolean(isInclusive ?? false),
        isSocialCharges: Boolean(isSocialCharges ?? false),
        isActive: Boolean(isActive ?? true),
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: 'system',
        action: 'CREATE',
        entity: 'Allowance',
        entityId: allowance.id,
        details: JSON.stringify({ code, name, allowanceType: type, value: numValue }),
      },
    })

    return NextResponse.json(allowance, { status: 201 })
  } catch (error) {
    console.error('[ALLOWANCES_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create allowance' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/allowances?id=xxx — Update an allowance
// ============================================================
async function PUT_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Allowance ID is required as query parameter' },
        { status: 400 }
      )
    }

    const existing = await db.allowance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Allowance not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { code, name, allowanceType, value, baseOnSalary, isTaxable, isProjectSpecific, isActive, isInclusive, isSocialCharges } = body

    // --- If code is being changed, check uniqueness ---
    if (code && code !== existing.code) {
      const codeConflict = await db.allowance.findUnique({ where: { code } })
      if (codeConflict) {
        return NextResponse.json(
          { error: `Allowance code "${code}" already exists` },
          { status: 409 }
        )
      }
    }

    // --- Validate allowanceType if provided ---
    if (allowanceType && !['fixed', 'percentage'].includes(allowanceType)) {
      return NextResponse.json(
        { error: 'allowanceType must be "fixed" or "percentage"' },
        { status: 400 }
      )
    }

    const resolvedType = allowanceType ?? existing.allowanceType

    // --- Validate value if provided ---
    if (value !== undefined) {
      const numValue = Number(value)
      if (isNaN(numValue) || numValue < 0) {
        return NextResponse.json(
          { error: 'Value must be a non-negative number' },
          { status: 400 }
        )
      }
      if (resolvedType === 'percentage' && numValue > 100) {
        return NextResponse.json(
          { error: 'Percentage value cannot exceed 100' },
          { status: 400 }
        )
      }
    }

    // --- Build update data (only provided fields) ---
    const updateData: Record<string, unknown> = {}
    if (code !== undefined) updateData.code = code
    if (name !== undefined) updateData.name = name
    if (allowanceType !== undefined) updateData.allowanceType = allowanceType
    if (value !== undefined) updateData.value = Number(value)
    if (baseOnSalary !== undefined) updateData.baseOnSalary = Boolean(baseOnSalary)
    if (isTaxable !== undefined) updateData.isTaxable = Boolean(isTaxable)
    if (isProjectSpecific !== undefined) updateData.isProjectSpecific = Boolean(isProjectSpecific)
    if (isInclusive !== undefined) updateData.isInclusive = Boolean(isInclusive)
    if (isSocialCharges !== undefined) updateData.isSocialCharges = Boolean(isSocialCharges)
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)

    const updated = await db.allowance.update({
      where: { id },
      data: updateData,
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: 'system',
        action: 'UPDATE',
        entity: 'Allowance',
        entityId: id,
        details: JSON.stringify(updateData),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[ALLOWANCES_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update allowance' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/allowances?id=xxx — Soft delete (isActive=false) or hard delete
// ============================================================
async function DELETE_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Allowance ID is required as query parameter' },
        { status: 400 }
      )
    }

    const existing = await db.allowance.findUnique({
      where: { id },
      include: { _count: { select: { employeeAllowances: true } } },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Allowance not found' },
        { status: 404 }
      )
    }

    // Check if the allowance is used by any employee allowances
    const inUse = existing._count.employeeAllowances > 0

    if (inUse) {
      // Soft delete — cannot hard-delete if referenced by employee allowances
      const softDeleted = await db.allowance.update({
        where: { id },
        data: { isActive: false },
      })

      await db.auditLog.create({
        data: {
          userId: 'system',
          action: 'SOFT_DELETE',
          entity: 'Allowance',
          entityId: id,
          details: `Soft-deleted allowance "${existing.code}" (referenced by ${existing._count.employeeAllowances} employee allowances)`,
        },
      })

      return NextResponse.json({
        message: 'Allowance deactivated (soft delete) — it is referenced by employee allowances',
        allowance: softDeleted,
      })
    }

    // Hard delete — no references
    await db.allowance.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        userId: 'system',
        action: 'DELETE',
        entity: 'Allowance',
        entityId: id,
        details: `Hard-deleted allowance "${existing.code}"`,
      },
    })

    return NextResponse.json({
      message: 'Allowance deleted permanently',
    })
  } catch (error) {
    console.error('[ALLOWANCES_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete allowance' },
      { status: 500 }
    )
  }
}

export const POST = withAudit('allowances', POST_HANDLER);

export const PUT = withAudit('allowances', PUT_HANDLER);

export const DELETE = withAudit('allowances', DELETE_HANDLER);

export const GET = withAudit('allowances', GET_HANDLER);
