import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20)

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const results: any[] = []

    // Search Accounts
    const accounts = await db.account.findMany({
      where: {
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
        ],
      },
      take: limit,
      select: { id: true, code: true, name: true, accountType: true, isActive: true },
    })
    accounts.forEach((a) => {
      results.push({
        type: 'account',
        id: a.id,
        title: `${a.code} - ${a.name}`,
        subtitle: a.accountType,
        module: 'chart-of-accounts' as const,
        badge: a.isActive ? 'Active' : 'Inactive',
      })
    })

    // Search Vouchers
    const vouchers = await db.voucher.findMany({
      where: {
        OR: [
          { voucherNumber: { contains: q } },
          { narration: { contains: q } },
          { reference: { contains: q } },
          { chequeNumber: { contains: q } },
        ],
      },
      take: limit,
      select: {
        id: true,
        voucherNumber: true,
        voucherType: true,
        narration: true,
        status: true,
        date: true,
        totalDebit: true,
      },
    })
    vouchers.forEach((v) => {
      results.push({
        type: 'voucher',
        id: v.id,
        title: v.voucherNumber,
        subtitle: v.narration?.substring(0, 80),
        module: 'vouchers' as const,
        badge: v.status,
        meta: `${v.voucherType} • ${new Date(v.date).toLocaleDateString()}`,
      })
    })

    // Search Customers
    const customers = await db.customer.findMany({
      where: {
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
          { email: { contains: q } },
        ],
      },
      take: limit,
      select: { id: true, code: true, name: true, email: true, isActive: true },
    })
    customers.forEach((c) => {
      results.push({
        type: 'customer',
        id: c.id,
        title: `${c.code} - ${c.name}`,
        subtitle: c.email || 'Customer',
        module: 'customers' as const,
        badge: c.isActive ? 'Active' : 'Inactive',
      })
    })

    // Search Suppliers
    const suppliers = await db.supplier.findMany({
      where: {
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
          { email: { contains: q } },
        ],
      },
      take: limit,
      select: { id: true, code: true, name: true, email: true, isActive: true },
    })
    suppliers.forEach((s) => {
      results.push({
        type: 'supplier',
        id: s.id,
        title: `${s.code} - ${s.name}`,
        subtitle: s.email || 'Supplier',
        module: 'suppliers' as const,
        badge: s.isActive ? 'Active' : 'Inactive',
      })
    })

    // Search Projects
    const projects = await db.project.findMany({
      where: {
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
        ],
      },
      take: limit,
      select: { id: true, code: true, name: true, status: true },
    })
    projects.forEach((p) => {
      results.push({
        type: 'project',
        id: p.id,
        title: `${p.code} - ${p.name}`,
        subtitle: 'Project',
        module: 'projects' as const,
        badge: p.status,
      })
    })

    // Search Donors
    const donors = await db.donor.findMany({
      where: {
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
        ],
      },
      take: limit,
      select: { id: true, code: true, name: true },
    })
    donors.forEach((d) => {
      results.push({
        type: 'donor',
        id: d.id,
        title: `${d.code} - ${d.name}`,
        subtitle: 'Donor',
        module: 'donors' as const,
        badge: 'Donor',
      })
    })

    // Search Fixed Assets
    const assets = await db.fixedAsset.findMany({
      where: {
        OR: [
          { assetCode: { contains: q } },
          { name: { contains: q } },
          { category: { contains: q } },
        ],
      },
      take: limit,
      select: { id: true, assetCode: true, name: true, status: true, netBookValue: true },
    })
    assets.forEach((a) => {
      results.push({
        type: 'asset',
        id: a.id,
        title: `${a.assetCode} - ${a.name}`,
        subtitle: `NBV: ${a.netBookValue.toLocaleString()}`,
        module: 'fixed-assets' as const,
        badge: a.status,
      })
    })

    // Search Locations
    const locations = await db.location.findMany({
      where: {
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
        ],
      },
      take: limit,
      select: { id: true, code: true, name: true },
    })
    locations.forEach((l) => {
      results.push({
        type: 'location',
        id: l.id,
        title: `${l.code} - ${l.name}`,
        subtitle: 'Location',
        module: 'locations' as const,
        badge: 'Location',
      })
    })

    return NextResponse.json({ results: results.slice(0, 50) })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
