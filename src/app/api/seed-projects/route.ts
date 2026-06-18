import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** Seed 18 statutory reporting projects for the hydropower entity */
async function GET_HANDLER() {
  try {
    const projects = [
      { code: 'HO',  name: 'Head Office',       projectType: 'Head Office',   sortOrder: 1,  isHeadOffice: true },
      { code: 'AJK', name: 'AJK HPP',            projectType: 'Hydropower',    sortOrder: 2,  isHeadOffice: false },
      { code: 'BAL', name: 'Balakot HPP',         projectType: 'Hydropower',    sortOrder: 3,  isHeadOffice: false },
      { code: 'BIL', name: 'Bilkani HPP',         projectType: 'Hydropower',    sortOrder: 4,  isHeadOffice: false },
      { code: 'BK',  name: 'Bk HPP',              projectType: 'Hydropower',    sortOrder: 5,  isHeadOffice: false },
      { code: 'DPC', name: 'DPC',                 projectType: 'Infrastructure',sortOrder: 6,  isHeadOffice: false },
      { code: 'GKH', name: 'Gabral Kalam HPP',    projectType: 'Hydropower',    sortOrder: 7,  isHeadOffice: false },
      { code: 'GU',  name: 'GU HPP',              projectType: 'Hydropower',    sortOrder: 8,  isHeadOffice: false },
      { code: 'HAN', name: 'Hanzel HPP',          projectType: 'Hydropower',    sortOrder: 9,  isHeadOffice: false },
      { code: 'JAB', name: 'Jabori HPP',          projectType: 'Hydropower',    sortOrder: 10, isHeadOffice: false },
      { code: 'KAR', name: 'Kari Muskhur HPP',    projectType: 'Hydropower',    sortOrder: 11, isHeadOffice: false },
      { code: 'MUJ', name: 'Mujahidi N HPP',      projectType: 'Hydropower',    sortOrder: 12, isHeadOffice: false },
      { code: 'NAG', name: 'Nagdar HPP',          projectType: 'Hydropower',    sortOrder: 13, isHeadOffice: false },
      { code: 'NJP', name: 'Neelam Jehlam Project',projectType: 'Hydropower',    sortOrder: 14, isHeadOffice: false },
      { code: 'RIA', name: 'Riali HPP',           projectType: 'Hydropower',    sortOrder: 15, isHeadOffice: false },
      { code: 'RAN', name: 'Ranolia HPP',         projectType: 'Hydropower',    sortOrder: 16, isHeadOffice: false },
      { code: 'RAN2',name: 'Ranolia HPP-II',      projectType: 'Hydropower',    sortOrder: 17, isHeadOffice: false },
      { code: 'SHA', name: 'Shagi HPP',           projectType: 'Hydropower',    sortOrder: 18, isHeadOffice: false },
    ]

    let created = 0
    let skipped = 0

    for (const p of projects) {
      const existing = await db.project.findUnique({ where: { code: p.code } })
      if (existing) {
        // Update existing project with new fields
        await db.project.update({
          where: { code: p.code },
          data: {
            projectType: p.projectType,
            sortOrder: p.sortOrder,
            isHeadOffice: p.isHeadOffice,
            reportingCurrency: 'PKR',
            name: p.name,
          },
        })
        skipped++
      } else {
        await db.project.create({
          data: {
            code: p.code,
            name: p.name,
            projectType: p.projectType,
            sortOrder: p.sortOrder,
            isHeadOffice: p.isHeadOffice,
            reportingCurrency: 'PKR',
            status: 'active',
          },
        })
        created++
      }
    }

    const allProjects = await db.project.findMany({ orderBy: { sortOrder: 'asc' } })

    return NextResponse.json({
      success: true,
      message: `Projects seeded: ${created} created, ${skipped} updated`,
      total: allProjects.length,
      projects: allProjects,
    })
  } catch (error) {
    console.error('Seed projects error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const GET = withAudit('seed-projects', GET_HANDLER);
