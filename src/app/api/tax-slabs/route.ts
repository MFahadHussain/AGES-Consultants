import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// GET /api/tax-slabs — List tax slabs with optional filters
// ============================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fiscalYear = searchParams.get('fiscalYear')
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (fiscalYear) where.fiscalYear = fiscalYear
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const taxSlabs = await db.taxSlab.findMany({
      where,
      orderBy: [{ fiscalYear: 'desc' }, { slabOrder: 'asc' }],
    })

    return NextResponse.json(taxSlabs)
  } catch (error) {
    console.error('[TAX_SLABS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch tax slabs' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/tax-slabs — Create tax slab or calculate-tax action
// ============================================================
export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Special action: calculate-tax
    if (data.action === 'calculate-tax') {
      const { annualIncome, fiscalYear } = data

      if (!annualIncome || annualIncome <= 0) {
        return NextResponse.json(
          { error: 'Annual income must be greater than 0' },
          { status: 400 }
        )
      }
      if (!fiscalYear) {
        return NextResponse.json(
          { error: 'Fiscal year is required' },
          { status: 400 }
        )
      }

      // Fetch active slabs for the fiscal year
      const slabs = await db.taxSlab.findMany({
        where: {
          fiscalYear,
          isActive: true,
        },
        orderBy: { slabOrder: 'asc' },
      })

      if (slabs.length === 0) {
        return NextResponse.json(
          { error: `No active tax slabs found for fiscal year ${fiscalYear}` },
          { status: 404 }
        )
      }

      // Progressive tax calculation
      let totalTax = 0
      const breakdown: Array<{
        slabOrder: number
        minAmount: number
        maxAmount: number | null
        rate: number
        fixedAmount: number
        taxableInSlab: number
        taxInSlab: number
      }> = []

      for (const slab of slabs) {
        // If income is below the slab's minimum, no more slabs apply
        if (annualIncome <= slab.minAmount) break

        // Determine the taxable amount within this slab
        const slabMax = slab.maxAmount ?? Infinity
        const upperBound = Math.min(annualIncome, slabMax)
        const taxableInSlab = Math.max(0, upperBound - slab.minAmount)

        // Tax = fixed amount for slab + rate % on amount exceeding min
        const variableTax = (taxableInSlab * slab.rate) / 100
        const taxInSlab = slab.fixedAmount + variableTax

        totalTax += taxInSlab

        breakdown.push({
          slabOrder: slab.slabOrder,
          minAmount: slab.minAmount,
          maxAmount: slab.maxAmount,
          rate: slab.rate,
          fixedAmount: slab.fixedAmount,
          taxableInSlab: Math.round(taxableInSlab * 100) / 100,
          taxInSlab: Math.round(taxInSlab * 100) / 100,
        })

        // If income doesn't exceed this slab's max, we're done
        if (annualIncome <= slabMax) break
      }

      return NextResponse.json({
        annualIncome,
        fiscalYear,
        totalTax: Math.round(totalTax * 100) / 100,
        effectiveRate: annualIncome > 0
          ? Math.round((totalTax / annualIncome) * 10000) / 100
          : 0,
        breakdown,
      })
    }

    // Create tax slab
    const requiredFields = ['fiscalYear', 'slabOrder', 'minAmount', 'rate']
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validate slab doesn't overlap with existing slabs for same fiscal year
    const existingSlabs = await db.taxSlab.findMany({
      where: { fiscalYear: data.fiscalYear, isActive: true },
      orderBy: { slabOrder: 'asc' },
    })

    const newMin = Number(data.minAmount)
    const newMax = data.maxAmount ? Number(data.maxAmount) : null

    for (const existing of existingSlabs) {
      const existMin = existing.minAmount
      const existMax = existing.maxAmount ?? Infinity

      // Check overlap
      const overlapStart = Math.max(newMin, existMin)
      const overlapEnd = Math.min(newMax ?? Infinity, existMax)
      if (overlapStart < overlapEnd) {
        return NextResponse.json(
          {
            error: `Slab overlaps with existing slab #${existing.slabOrder} (${existing.minAmount} - ${existing.maxAmount ?? '∞'})`,
          },
          { status: 400 }
        )
      }
    }

    const taxSlab = await db.taxSlab.create({
      data: {
        fiscalYear: data.fiscalYear,
        slabOrder: Number(data.slabOrder),
        minAmount: Number(data.minAmount),
        maxAmount: data.maxAmount ? Number(data.maxAmount) : null,
        fixedAmount: Number(data.fixedAmount || 0),
        rate: Number(data.rate),
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    })

    return NextResponse.json(taxSlab, { status: 201 })
  } catch (error) {
    console.error('[TAX_SLABS_POST]', error)
    return NextResponse.json(
      { error: 'Failed to create tax slab' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/tax-slabs — Update tax slab
// ============================================================
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'Tax slab ID is required' },
        { status: 400 }
      )
    }

    const data = await request.json()

    const taxSlab = await db.taxSlab.findUnique({ where: { id } })
    if (!taxSlab) {
      return NextResponse.json(
        { error: 'Tax slab not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (data.fiscalYear) updateData.fiscalYear = data.fiscalYear
    if (data.slabOrder !== undefined) updateData.slabOrder = Number(data.slabOrder)
    if (data.minAmount !== undefined) updateData.minAmount = Number(data.minAmount)
    if (data.maxAmount !== undefined) updateData.maxAmount = data.maxAmount ? Number(data.maxAmount) : null
    if (data.fixedAmount !== undefined) updateData.fixedAmount = Number(data.fixedAmount)
    if (data.rate !== undefined) updateData.rate = Number(data.rate)
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    const updated = await db.taxSlab.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[TAX_SLABS_PUT]', error)
    return NextResponse.json(
      { error: 'Failed to update tax slab' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/tax-slabs — Delete tax slab
// ============================================================
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'Tax slab ID is required' },
        { status: 400 }
      )
    }

    const taxSlab = await db.taxSlab.findUnique({ where: { id } })
    if (!taxSlab) {
      return NextResponse.json(
        { error: 'Tax slab not found' },
        { status: 404 }
      )
    }

    await db.taxSlab.delete({ where: { id } })

    return NextResponse.json({ message: 'Tax slab deleted successfully' })
  } catch (error) {
    console.error('[TAX_SLABS_DELETE]', error)
    return NextResponse.json(
      { error: 'Failed to delete tax slab' },
      { status: 500 }
    )
  }
}
