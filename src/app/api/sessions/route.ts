import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sessions - List sessions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const activeOnly = searchParams.get('active') !== 'false'
    const format = searchParams.get('format') || 'default' // 'default' = auth-compatible, 'security' = full

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (activeOnly) where.isActive = true

    const sessions = await db.userSession.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, avatarUrl: true },
        },
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 200,
    })

    // Mark expired sessions as inactive in background
    const now = new Date()
    const expiredIds = sessions
      .filter(s => s.isActive && new Date(s.expiresAt) <= now)
      .map(s => s.id)
    if (expiredIds.length > 0) {
      db.userSession.updateMany({
        where: { id: { in: expiredIds } },
        data: { isActive: false },
      }).catch(() => {})
    }

    if (format === 'security') {
      // Full format for Security Center
      const formatted = sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        userName: s.user.name,
        userEmail: s.user.email,
        userRole: s.user.role,
        token: s.token,
        deviceInfo: s.deviceInfo ? JSON.parse(s.deviceInfo as string) : null,
        deviceFingerprint: s.deviceFingerprint,
        ipAddress: s.ipAddress,
        geoLocation: s.geoLocation ? JSON.parse(s.geoLocation as string) : null,
        isActive: s.isActive,
        expiresAt: s.expiresAt,
        lastActivityAt: s.lastActivityAt,
        createdAt: s.createdAt,
      }))
      return NextResponse.json(formatted)
    }

    // Default format (auth-compatible)
    const activeSessions = sessions.filter(s => new Date(s.expiresAt) > now)
    const data = activeSessions.map(s => ({
      id: s.id,
      userId: s.userId,
      token: s.token,
      deviceInfo: s.deviceInfo,
      deviceFingerprint: s.deviceFingerprint,
      ipAddress: s.ipAddress,
      geoLocation: s.geoLocation,
      isActive: s.isActive,
      expiresAt: s.expiresAt,
      lastActivityAt: s.lastActivityAt,
      createdAt: s.createdAt,
      user: s.user,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch sessions' }, { status: 500 })
  }
}

// DELETE /api/sessions - Terminate sessions
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const userId = searchParams.get('userId')
    const all = searchParams.get('all')

    if (all === 'true') {
      const result = await db.userSession.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      })
      return NextResponse.json({ success: true, terminated: result.count, message: `Terminated ${result.count} sessions` })
    }

    if (sessionId) {
      const session = await db.userSession.findUnique({ where: { id: sessionId } })
      if (!session) {
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
      }
      await db.userSession.update({
        where: { id: sessionId },
        data: { isActive: false },
      })
      // Audit log
      try {
        await db.auditLog.create({
          data: {
            userId: session.userId,
            action: 'LOGOUT',
            entity: 'Session',
            entityId: sessionId,
            details: JSON.stringify({ action: 'session_terminated', ipAddress: session.ipAddress }),
            module: 'sessions',
            severity: 'info',
          },
        })
      } catch {}
      return NextResponse.json({ success: true, terminated: 1, message: 'Session terminated' })
    }

    if (userId) {
      const result = await db.userSession.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      })
      try {
        await db.auditLog.create({
          data: {
            userId,
            action: 'LOGOUT',
            entity: 'Session',
            details: JSON.stringify({ action: 'all_sessions_terminated', count: result.count }),
            module: 'sessions',
            severity: 'info',
          },
        })
      } catch {}
      return NextResponse.json({ success: true, terminated: result.count, message: `Terminated ${result.count} sessions for user` })
    }

    return NextResponse.json({ success: false, error: 'Provide sessionId, userId, or all=true' }, { status: 400 })
  } catch (error) {
    console.error('Error terminating session:', error)
    return NextResponse.json({ success: false, error: 'Failed to terminate sessions' }, { status: 500 })
  }
}
