import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function GET_HANDLER(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    return NextResponse.json(customer)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

async function PUT_HANDLER(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

async function DELETE_HANDLER(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

export const PUT = withAudit('customers', PUT_HANDLER);

export const DELETE = withAudit('customers', DELETE_HANDLER);

export const GET = withAudit('customers', GET_HANDLER);
