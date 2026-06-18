import { withAudit } from '@/lib/audit-wrapper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/auth/reset-password — Send password reset link
async function POST_HANDLER(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if user exists (but don't reveal whether the email exists)
    const user = await db.user.findUnique({ where: { email } })

    if (user) {
      // Log the reset request
      try {
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: 'PASSWORD_RESET_REQUEST',
            entity: 'User',
            entityId: user.id,
            details: JSON.stringify({ email, timestamp: new Date().toISOString() }),
          },
        })
      } catch {
        // Audit log failure shouldn't block the response
      }

      // In production: send email with reset token
      // For now, we just acknowledge the request
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: 'If an account exists with this email, a reset link has been sent.',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Reset request failed' }, { status: 500 })
  }
}

export const POST = withAudit('auth', POST_HANDLER);
