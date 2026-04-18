import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const locations = await db.location.findMany({ orderBy: { code: 'asc' } })
    return NextResponse.json(locations)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    if (!data.code || !data.name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })

    // Check for duplicate code
    const existing = await db.location.findUnique({ where: { code: data.code } })
    if (existing) return NextResponse.json({ error: `Location with code "${data.code}" already exists` }, { status: 409 })

    const location = await db.location.create({ data })
    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json()
    const { id, code, name, ...rest } = data

    if (!id) return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })
    if (!code || !name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })

    // Check location exists
    const existing = await db.location.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

    // Check for duplicate code (if code is being changed)
    if (code !== existing.code) {
      const duplicate = await db.location.findUnique({ where: { code } })
      if (duplicate) return NextResponse.json({ error: `Location with code "${code}" already exists` }, { status: 409 })
    }

    const location = await db.location.update({
      where: { id },
      data: { code, name, ...rest },
    })
    return NextResponse.json(location)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })

    // Check location exists
    const existing = await db.location.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

    // Check if location has associated vouchers
    const voucherCount = await db.voucher.count({ where: { locationId: id } })
    if (voucherCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete location "${existing.name}" because it has ${voucherCount} associated voucher(s)` },
        { status: 409 }
      )
    }

    await db.location.delete({ where: { id } })
    return NextResponse.json({ success: true, message: `Location "${existing.name}" deleted successfully` })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
