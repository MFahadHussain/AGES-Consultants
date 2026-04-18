import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const taxType = searchParams.get('taxType')

    const where: any = { isActive: true }
    if (taxType) where.taxType = taxType

    const taxRates = await db.taxRate.findMany({ where, orderBy: { name: 'asc' } })
    return NextResponse.json(taxRates)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    if (data.action === 'calculate') {
      // Calculate tax for a given amount
      const { taxRateId, baseAmount } = data
      const taxRate = await db.taxRate.findUnique({ where: { id: taxRateId } })
      if (!taxRate) return NextResponse.json({ error: 'Tax rate not found' }, { status: 404 })

      const taxAmount = (baseAmount * taxRate.rate) / 100
      const calculation = await db.taxCalculation.create({
        data: {
          taxRateId,
          baseAmount,
          taxAmount,
          period: new Date().toISOString().slice(0, 7),
        },
      })
      return NextResponse.json({ ...calculation, rate: taxRate.rate, taxName: taxRate.name })
    }

    // Create tax rate
    if (!data.name || !data.taxType || data.rate === undefined) {
      return NextResponse.json({ error: 'Name, tax type, and rate are required' }, { status: 400 })
    }
    const taxRate = await db.taxRate.create({ data })
    return NextResponse.json(taxRate, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
