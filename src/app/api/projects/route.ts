import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const projects = await db.project.findMany({ orderBy: { code: 'asc' } })
    return NextResponse.json(projects)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    if (!data.code || !data.name) return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
    const project = await db.project.create({ data })
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
