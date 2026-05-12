import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/audit - Enhanced audit log with filters, pagination, and statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Filters
    const entity = searchParams.get('entity')
    const action = searchParams.get('action')
    const moduleFilter = searchParams.get('module')
    const severity = searchParams.get('severity')
    const userId = searchParams.get('userId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const entityId = searchParams.get('entityId')
    const search = searchParams.get('search')
    const includeStats = searchParams.get('includeStats') === 'true'

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const limit = Math.min(pageSize, 500)

    // Legacy support: if only 'limit' is provided without 'page'
    const legacyLimit = searchParams.get('limit')
    const useLegacyMode = legacyLimit && !searchParams.has('page')
    const effectiveLimit = useLegacyMode ? parseInt(legacyLimit!, 10) : limit

    const where: Record<string, unknown> = {}
    if (entity) where.entity = entity
    if (action) where.action = action
    if (moduleFilter) where.module = moduleFilter
    if (severity) where.severity = severity
    if (userId) where.userId = userId
    if (entityId) where.entityId = entityId
    if (search) {
      where.OR = [
        { details: { contains: search } },
        { entityName: { contains: search } },
        { username: { contains: search } },
        { entity: { contains: search } },
      ]
    }
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + 'T23:59:59.999Z')
      where.createdAt = createdAt
    }

    const skip = useLegacyMode ? 0 : (page - 1) * limit

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: effectiveLimit,
        skip,
      }),
      db.auditLog.count({ where }),
    ])

    const data = logs.map((log) => {
      let detailsParsed = null
      let oldValuesParsed = null
      let newValuesParsed = null
      try { if (log.details) detailsParsed = JSON.parse(log.details) } catch { detailsParsed = log.details }
      try { if (log.oldValues) oldValuesParsed = JSON.parse(log.oldValues) } catch { oldValuesParsed = log.oldValues }
      try { if (log.newValues) newValuesParsed = JSON.parse(log.newValues) } catch { newValuesParsed = log.newValues }

      return {
        id: log.id,
        userId: log.userId,
        username: log.username || log.user?.name || null,
        userEmail: log.user?.email || null,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        entityName: log.entityName,
        details: detailsParsed,
        oldValues: oldValuesParsed,
        newValues: newValuesParsed,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        sessionId: log.sessionId,
        severity: log.severity,
        module: log.module,
        createdAt: log.createdAt,
        user: log.user ? { name: log.user.name, email: log.user.email } : null,
      }
    })

    // Severity summary
    const severitySummary = await db.auditLog.groupBy({
      by: ['severity'],
      where,
      _count: { severity: true },
    })

    // Legacy mode: return simple array
    if (useLegacyMode) {
      return NextResponse.json(data)
    }

    // Build response
    const result: any = {
      success: true,
      data,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      meta: {
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
        severitySummary: severitySummary.reduce(
          (acc, s) => { acc[s.severity] = s._count.severity; return acc },
          {} as Record<string, number>
        ),
      },
    }

    // Include action breakdown stats
    if (includeStats) {
      const actionBreakdown = await db.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
        orderBy: { _count: { action: 'desc' } },
      })
      result.statistics = {
        total,
        actionBreakdown: actionBreakdown.map((a) => ({ action: a.action, count: a._count })),
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
