import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    return NextResponse.json(customer)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const data = await request.json()
    const customer = await db.customer.update({ where: { id }, data })
    try {
      await db.auditLog.create({
        data: { userId: 'system', action: 'UPDATE', entity: 'Customer', entityId: id, details: `Updated customer ${customer.code}` },
      })
    } catch { /* audit log failure should not block the operation */ }
    return NextResponse.json(customer)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const customer = await db.customer.update({ where: { id }, data: { isActive: false } })
    try {
      await db.auditLog.create({
        data: { userId: 'system', action: 'DELETE', entity: 'Customer', entityId: id, details: `Soft-deleted customer ${customer.code}` },
      })
    } catch { /* audit log failure should not block the operation */ }
    return NextResponse.json(customer)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
