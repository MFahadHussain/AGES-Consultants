import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function GET_HANDLER() {
  try {
    const clients = await db.client.findMany({ orderBy: { code: 'asc' } })
    return NextResponse.json(clients)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function POST_HANDLER(request: Request) {
  try {
    const data = await request.json()
    if (!data.code || !data.name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })

    // Check for duplicate code
    const existing = await db.client.findUnique({ where: { code: data.code } })
    if (existing) return NextResponse.json({ error: `Client with code "${data.code}" already exists` }, { status: 409 })

    const client = await db.client.create({ data })
    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function PUT_HANDLER(request: Request) {
  try {
    const data = await request.json()
    const { id, code, name, ...rest } = data

    if (!id) return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    if (!code || !name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })

    // Check client exists
    const existing = await db.client.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Check for duplicate code (if code is being changed)
    if (code !== existing.code) {
      const duplicate = await db.client.findUnique({ where: { code } })
      if (duplicate) return NextResponse.json({ error: `Client with code "${code}" already exists` }, { status: 409 })
    }

    const client = await db.client.update({
      where: { id },
      data: { code, name, ...rest },
    })
    return NextResponse.json(client)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function DELETE_HANDLER(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })

    // Check client exists
    const existing = await db.client.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Check if client has associated vouchers
    const voucherCount = await db.voucher.count({ where: { clientId: id } })
    if (voucherCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete client "${existing.name}" because it has ${voucherCount} associated voucher(s)` },
        { status: 409 }
      )
    }

    await db.client.delete({ where: { id } })
    return NextResponse.json({ success: true, message: `Client "${existing.name}" deleted successfully` })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const POST = withAudit('clients', POST_HANDLER);

export const PUT = withAudit('clients', PUT_HANDLER);

export const DELETE = withAudit('clients', DELETE_HANDLER);

export const GET = withAudit('clients', GET_HANDLER);
