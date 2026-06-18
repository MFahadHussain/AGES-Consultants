import { withAudit } from '@/lib/audit-wrapper'
import { NextRequest, NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST /api/auth/change-password — Self-service password change or forced change
async function POST_HANDLER(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, currentPassword, newPassword, confirmPassword, forceChange } = body

    const isForcedChange = forceChange === true && currentPassword === '__force_change__'

    if (!userId || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (!isForcedChange && !currentPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password is required' },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'New password and confirmation do not match' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        { success: false, error: 'Password must be less than 128 characters' },
        { status: 400 }
      )
    }

    // Password complexity checks
    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json(
        { success: false, error: 'Password must contain at least one uppercase letter' },
        { status: 400 }
      )
    }

    if (!/[a-z]/.test(newPassword)) {
      return NextResponse.json(
        { success: false, error: 'Password must contain at least one lowercase letter' },
        { status: 400 }
      )
    }

    if (!/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { success: false, error: 'Password must contain at least one number' },
        { status: 400 }
      )
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      return NextResponse.json(
        { success: false, error: 'Password must contain at least one special character' },
        { status: 400 }
      )
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { id: userId, deletedAt: null },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated' },
        { status: 403 }
      )
    }

    // For forced change, verify that forcePasswordChange flag is set
    if (isForcedChange) {
      if (!user.forcePasswordChange) {
        return NextResponse.json(
          { success: false, error: 'Forced password change is not required for this account' },
          { status: 400 }
        )
      }
    } else {
      // Normal flow: verify current password
      if (currentPassword === newPassword) {
        return NextResponse.json(
          { success: false, error: 'New password must be different from current password' },
          { status: 400 }
        )
      }

      if (!user.passwordHash) {
        return NextResponse.json(
          { success: false, error: 'No password set on this account. Contact administrator.' },
          { status: 400 }
        )
      }

      let passwordValid = false
      try {
        passwordValid = await bcrypt.compare(currentPassword, user.passwordHash)
      } catch {
        passwordValid = false
      }

      // Fallback to legacy SHA-256
      if (!passwordValid) {
        const encoder = new TextEncoder()
        const data = encoder.encode(currentPassword)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const sha256Hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
        passwordValid = sha256Hash === user.passwordHash
      }

      if (!passwordValid) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 401 }
        )
      }
    }

    // Check password history (prevent reuse of last 5 passwords)
    const passwordHistory = await db.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { changedAt: 'desc' },
      take: 5,
      select: { passwordHash: true },
    })

    for (const entry of passwordHistory) {
      try {
        const reused = await bcrypt.compare(newPassword, entry.passwordHash)
        if (reused) {
          return NextResponse.json(
            { success: false, error: 'Cannot reuse any of your last 5 passwords' },
            { status: 400 }
          )
        }
      } catch {
        // Skip invalid hash entries
      }
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10)
    const newHash = await bcrypt.hash(newPassword, salt)

    // Get security policy for password expiry
    const securityPolicy = await db.securityPolicy.findFirst({
      where: { isDefault: true },
    })
    const passwordExpiryDays = securityPolicy?.passwordExpiryDays ?? 90

    // Update user password
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        passwordExpiresAt: new Date(Date.now() + passwordExpiryDays * 24 * 60 * 60 * 1000),
        forcePasswordChange: false,
        failedLoginAttempts: 0,
      },
    })

    // Save to password history
    try {
      await db.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash: newHash,
          changeType: isForcedChange ? 'forced_change' : 'self_change',
        },
      })
    } catch {
      // Non-blocking
    }

    // Audit log
    try {
      const systemUserId = await getSystemUserId()
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'PASSWORD_CHANGE',
          entity: 'User',
          entityId: user.id,
          entityName: user.name,
          details: JSON.stringify({
            changeType: isForcedChange ? 'forced_change' : 'self_change',
            timestamp: new Date().toISOString(),
          }),
          module: 'auth',
          severity: 'warning',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to change password' },
      { status: 500 }
    )
  }
}

export const POST = withAudit('auth', POST_HANDLER);
