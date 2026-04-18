import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const donors = await db.donor.findMany({ orderBy: { code: 'asc' } })
    return NextResponse.json(donors)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    if (!data.code || !data.name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })

    // Check for duplicate code
    const existing = await db.donor.findUnique({ where: { code: data.code } })
    if (existing) return NextResponse.json({ error: `Donor with code "${data.code}" already exists` }, { status: 409 })

    const donor = await db.donor.create({ data })
    return NextResponse.json(donor, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json()
    const { id, code, name, ...rest } = data

    if (!id) return NextResponse.json({ error: 'Donor ID is required' }, { status: 400 })
    if (!code || !name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })

    // Check donor exists
    const existing = await db.donor.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Donor not found' }, { status: 404 })

    // Check for duplicate code (if code is being changed)
    if (code !== existing.code) {
      const duplicate = await db.donor.findUnique({ where: { code } })
      if (duplicate) return NextResponse.json({ error: `Donor with code "${code}" already exists` }, { status: 409 })
    }

    const donor = await db.donor.update({
      where: { id },
      data: { code, name, ...rest },
    })
    return NextResponse.json(donor)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Donor ID is required' }, { status: 400 })

    // Check donor exists
    const existing = await db.donor.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Donor not found' }, { status: 404 })

    // Check if donor has associated vouchers
    const voucherCount = await db.voucher.count({ where: { donorId: id } })
    if (voucherCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete donor "${existing.name}" because it has ${voucherCount} associated voucher(s)` },
        { status: 409 }
      )
    }

    // Check if donor has associated budgets
    const budgetCount = await db.budget.count({ where: { donorId: id } })
    if (budgetCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete donor "${existing.name}" because it has ${budgetCount} associated budget(s)` },
        { status: 409 }
      )
    }

    await db.donor.delete({ where: { id } })
    return NextResponse.json({ success: true, message: `Donor "${existing.name}" deleted successfully` })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
