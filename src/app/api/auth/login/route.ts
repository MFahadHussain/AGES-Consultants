import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// SHA-256 hash function (matches the seed and user-management routes)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// POST /api/auth/login — Authenticate user and return user data
// Backend Integration: Replace simulated delay with actual auth
//   await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, rememberMe }) })
//   Handle 401 → show invalid credentials alert
//   Handle 200 → redirect to /dashboard
//   rememberMe → set session cookie expiry (7 days vs session-only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, rememberMe } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find user by email
    const user = await db.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials. Please check your email and password.' }, { status: 401 })
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json({ error: 'Account is deactivated. Contact your administrator.' }, { status: 403 })
    }

    // Hash the provided password and compare
    if (!user.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials. Please check your email and password.' }, { status: 401 })
    }

    const providedHash = await hashPassword(password)
    if (providedHash !== user.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials. Please check your email and password.' }, { status: 401 })
    }

    // Update last login timestamp
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Log the login event
    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
          details: JSON.stringify({ rememberMe, timestamp: new Date().toISOString() }),
        },
      })
    } catch {
      // Audit log failure shouldn't block login
    }

    // Return user data (exclude passwordHash)
    const sessionExpiry = rememberMe ? '7d' : '24h'

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl,
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
      },
      sessionExpiry,
      token: `acctfin_${user.id}_${Date.now()}`,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
