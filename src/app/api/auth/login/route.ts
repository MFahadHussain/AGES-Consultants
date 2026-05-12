import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST /api/auth/login — Enhanced authentication with lockout, session tracking, audit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, rememberMe, deviceInfo } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Get client info
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get security policy for lockout settings
    const securityPolicy = await db.securityPolicy.findFirst({
      where: { isDefault: true },
    })
    const lockoutThreshold = securityPolicy?.lockoutThreshold ?? 5
    const lockoutDurationMinutes = securityPolicy?.lockoutDurationMinutes ?? 30
    const sessionTimeoutMinutes = securityPolicy?.sessionTimeoutMinutes ?? 480
    const maxConcurrentSessions = securityPolicy?.maxConcurrentSessions ?? 3

    // Find user by email or username
    const user = await db.user.findFirst({
      where: {
        OR: [{ email }, { username: email }],
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        userPermissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    // Helper: create login history entry
    const createLoginHistory = async (
      loginStatus: string,
      failureReason?: string,
      sessionId?: string
    ) => {
      try {
        await db.loginHistory.create({
          data: {
            userId: user?.id || null,
            email,
            loginStatus,
            failureReason: failureReason || null,
            ipAddress,
            userAgent,
            device: detectDevice(userAgent),
            browser: detectBrowser(userAgent),
            os: detectOS(userAgent),
            sessionId: sessionId || null,
          },
        })
      } catch {
        // Non-blocking
      }
    }

    // User not found
    if (!user) {
      await createLoginHistory('failed', 'user_not_found')
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials. Please check your email and password.',
        },
        { status: 401 }
      )
    }

    // Check if user is locked
    if (user.isLocked) {
      // Check if lockout has expired
      if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
        await createLoginHistory('locked', 'account_locked')
        return NextResponse.json(
          {
            success: false,
            error: `Account is locked. Please try again after ${new Date(user.lockedUntil).toLocaleTimeString()}.`,
          },
          { status: 403 }
        )
      }
      // Lockout expired, unlock the account
      await db.user.update({
        where: { id: user.id },
        data: {
          isLocked: false,
          lockedUntil: null,
          failedLoginAttempts: 0,
        },
      })
    }

    // Check if user is active
    if (!user.isActive) {
      await createLoginHistory('failed', 'account_inactive')
      return NextResponse.json(
        {
          success: false,
          error: 'Account is deactivated. Contact your administrator.',
        },
        { status: 403 }
      )
    }

    // Verify password
    if (!user.passwordHash) {
      await createLoginHistory('failed', 'no_password_set')
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials. Please check your email and password.',
        },
        { status: 401 }
      )
    }

    // Support both bcrypt and legacy SHA-256
    let passwordValid = false
    let needsBcryptUpgrade = false

    // First try bcrypt comparison
    try {
      passwordValid = await bcrypt.compare(password, user.passwordHash)
    } catch {
      // bcrypt.compare threw an error (invalid hash format) — try SHA-256
      passwordValid = false
    }

    // If bcrypt didn't validate, try legacy SHA-256
    if (!passwordValid) {
      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const sha256Hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
      passwordValid = sha256Hash === user.passwordHash

      // If legacy hash works, flag for upgrade to bcrypt
      if (passwordValid) {
        needsBcryptUpgrade = true
      }
    }

    // Upgrade legacy SHA-256 hash to bcrypt
    if (needsBcryptUpgrade) {
      try {
        const salt = await bcrypt.genSalt(10)
        const newHash = await bcrypt.hash(password, salt)
        await db.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        })
      } catch {
        // Non-blocking — upgrade will happen on next login
      }
    }

    if (!passwordValid) {
      // Increment failed login attempts
      const newFailedAttempts = user.failedLoginAttempts + 1

      if (newFailedAttempts >= lockoutThreshold) {
        // Lock the account
        const lockedUntil = new Date(
          Date.now() + lockoutDurationMinutes * 60 * 1000
        )
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newFailedAttempts,
            isLocked: true,
            lockedUntil,
          },
        })
        await createLoginHistory('locked', 'account_locked_threshold')
        return NextResponse.json(
          {
            success: false,
            error: `Account locked due to ${newFailedAttempts} failed attempts. Please try again after ${lockoutDurationMinutes} minutes.`,
          },
          { status: 403 }
        )
      }

      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: newFailedAttempts },
      })

      await createLoginHistory('failed', 'invalid_password')
      const remainingAttempts = lockoutThreshold - newFailedAttempts
      return NextResponse.json(
        {
          success: false,
          error: `Invalid credentials. ${remainingAttempts} attempt(s) remaining before account lockout.`,
        },
        { status: 401 }
      )
    }

    // Password is valid - reset failed attempts
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        isLocked: false,
        lockedUntil: null,
      },
    })

    // Check password expiry
    let passwordExpired = false
    if (user.passwordExpiresAt && new Date() > new Date(user.passwordExpiresAt)) {
      passwordExpired = true
    }

    // Enforce concurrent session limits
    const activeSessions = await db.userSession.count({
      where: { userId: user.id, isActive: true },
    })

    if (activeSessions >= maxConcurrentSessions) {
      // Terminate oldest sessions
      const oldestSessions = await db.userSession.findMany({
        where: { userId: user.id, isActive: true },
        orderBy: { lastActivityAt: 'asc' },
        take: activeSessions - maxConcurrentSessions + 1,
      })
      if (oldestSessions.length > 0) {
        await db.userSession.updateMany({
          where: { id: { in: oldestSessions.map((s) => s.id) } },
          data: { isActive: false },
        })
      }
    }

    // Create session
    const sessionToken = crypto.randomUUID()
    const refreshToken = crypto.randomUUID()
    const sessionTimeout = rememberMe
      ? (securityPolicy?.rememberMeDays ?? 30) * 24 * 60
      : sessionTimeoutMinutes
    const expiresAt = new Date(Date.now() + sessionTimeout * 60 * 1000)

    const session = await db.userSession.create({
      data: {
        userId: user.id,
        token: sessionToken,
        refreshToken,
        deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
        ipAddress,
        isActive: true,
        expiresAt,
        lastActivityAt: new Date(),
      },
    })

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    })

    // Compute effective permissions
    const rolePermissions = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => ({
        permissionId: rp.permissionId,
        code: rp.permission.code,
        name: rp.permission.name,
        module: rp.permission.module,
        action: rp.permission.action,
        resource: rp.permission.resource,
        isGranted: rp.isGranted,
        source: `role:${ur.role.code}`,
      }))
    )

    const userOverrides = user.userPermissions.map((up) => ({
      permissionId: up.permissionId,
      code: up.permission.code,
      name: up.permission.name,
      module: up.permission.module,
      action: up.permission.action,
      resource: up.permission.resource,
      isGranted: up.isGranted,
      source: 'user_override',
    }))

    const permissionMap = new Map<
      string,
      { permissionId: string; code: string; name: string; module: string; action: string; resource: string; isGranted: boolean; source: string }
    >()
    for (const rp of rolePermissions) {
      const existing = permissionMap.get(rp.permissionId)
      if (!existing || rp.isGranted) {
        permissionMap.set(rp.permissionId, rp)
      }
    }
    for (const up of userOverrides) {
      permissionMap.set(up.permissionId, up)
    }

    // Create login history (success)
    await createLoginHistory('success', undefined, session.id)

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
          entityName: user.name,
          ipAddress,
          userAgent,
          sessionId: session.id,
          details: JSON.stringify({
            rememberMe,
            timestamp: new Date().toISOString(),
          }),
          module: 'auth',
          severity: 'info',
        },
      })
    } catch {
      // Non-blocking
    }

    // Return user data (exclude passwordHash)
    const sessionExpiry = rememberMe
      ? `${(securityPolicy?.rememberMeDays ?? 30)}d`
      : `${sessionTimeoutMinutes / 60}h`

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          isLocked: user.isLocked,
          avatarUrl: user.avatarUrl,
          forcePasswordChange: user.forcePasswordChange || passwordExpired,
          passwordExpired,
          branchId: user.branchId,
          departmentId: user.departmentId,
          designation: user.designation,
          lastLoginAt: user.lastLoginAt?.toISOString() || null,
          lastLoginIp: ipAddress,
          createdAt: user.createdAt.toISOString(),
          roles: user.userRoles.map((ur) => ({
            id: ur.role.id,
            code: ur.role.code,
            name: ur.role.name,
            level: ur.role.level,
            isPrimary: ur.isPrimary,
          })),
          primaryRole: user.userRoles.find((ur) => ur.isPrimary)?.role || null,
          effectivePermissions: Array.from(permissionMap.values()),
        },
        session: {
          token: sessionToken,
          refreshToken,
          expiresAt: expiresAt.toISOString(),
          sessionId: session.id,
        },
        sessionExpiry,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

// Simple device/browser/OS detection helpers
function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (/mobile|android|iphone|ipad|ipod/.test(ua)) return 'mobile'
  if (/tablet/.test(ua)) return 'tablet'
  return 'desktop'
}

function detectBrowser(userAgent: string): string {
  const ua = userAgent
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari'
  if (ua.includes('Opera') || ua.includes('OPR/')) return 'Opera'
  return 'Unknown'
}

function detectOS(userAgent: string): string {
  const ua = userAgent
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac OS')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  return 'Unknown'
}
