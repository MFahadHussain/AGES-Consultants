import { withAudit } from '@/lib/audit-wrapper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/login-history - List login history with filters
async function GET_HANDLER(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const loginStatus = searchParams.get('loginStatus') || searchParams.get('status')
    const email = searchParams.get('email')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '25', 10)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const includeStats = searchParams.get('includeStats') === 'true'

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (loginStatus && loginStatus !== 'all') where.loginStatus = loginStatus
    if (email) where.email = { contains: email }
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo + 'T23:59:59.999Z')
      where.createdAt = createdAt
    }

    const skip = (page - 1) * limit

    const [records, total] = await Promise.all([
      db.loginHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      db.loginHistory.count({ where }),
    ])

    const data = records.map((r) => {
      let geoParsed = null
      try { if (r.geoLocation) geoParsed = JSON.parse(r.geoLocation as string) } catch { geoParsed = r.geoLocation }
      return {
        id: r.id,
        userId: r.userId,
        email: r.email,
        loginStatus: r.loginStatus,
        failureReason: r.failureReason,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        browser: r.browser,
        os: r.os,
        device: r.device,
        geoLocation: geoParsed,
        sessionId: r.sessionId,
        createdAt: r.createdAt,
        userName: r.user?.name || null,
        userEmail: r.user?.email || r.email,
      }
    })

    const result: any = {
      success: true,
      data,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }

    // Include statistics if requested
    if (includeStats) {
      const successCount = await db.loginHistory.count({ where: { ...where, loginStatus: 'success' } })
      const failedReasons = await db.loginHistory.groupBy({
        by: ['failureReason'],
        where: { ...where, loginStatus: 'failed', failureReason: { not: null } },
        _count: true,
        orderBy: { _count: { failureReason: 'desc' } },
        take: 5,
      })
      const browserStats = await db.loginHistory.groupBy({
        by: ['browser'],
        where: { ...where, browser: { not: null } },
        _count: true,
        orderBy: { _count: { browser: 'desc' } },
        take: 5,
      })

      result.statistics = {
        total,
        successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
        topBrowsers: browserStats.map((b) => ({ browser: b.browser, count: b._count })),
        topFailureReasons: failedReasons.map((f) => ({ reason: f.failureReason, count: f._count })),
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching login history:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch login history' }, { status: 500 })
  }
}

export const GET = withAudit('login-history', GET_HANDLER);
