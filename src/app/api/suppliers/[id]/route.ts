import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supplier = await db.supplier.findUnique({ where: { id } })
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    return NextResponse.json(supplier)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await request.json()
    const supplier = await db.supplier.update({ where: { id }, data })
    try {
      await db.auditLog.create({
        data: { userId: 'system', action: 'UPDATE', entity: 'Supplier', entityId: id, details: `Updated supplier ${supplier.code}` },
      })
    } catch { /* audit log failure should not block the operation */ }
    return NextResponse.json(supplier)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supplier = await db.supplier.update({ where: { id }, data: { isActive: false } })
    try {
      await db.auditLog.create({
        data: { userId: 'system', action: 'DELETE', entity: 'Supplier', entityId: id, details: `Soft-deleted supplier ${supplier.code}` },
      })
    } catch { /* audit log failure should not block the operation */ }
    return NextResponse.json(supplier)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
