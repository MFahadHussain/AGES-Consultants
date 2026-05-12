import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/security-policies - Get security policies
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const policy = await db.securityPolicy.findUnique({ where: { id } })
      if (!policy) {
        return NextResponse.json({ success: false, error: 'Security policy not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: formatPolicy(policy) })
    }

    const policies = await db.securityPolicy.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    if (policies.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    return NextResponse.json({ success: true, data: policies.map(formatPolicy) })
  } catch (error) {
    console.error('Error fetching security policy:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch security policy' }, { status: 500 })
  }
}

// POST /api/security-policies - Create security policy
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name, description,
      passwordMinLength, passwordMaxLength,
      passwordRequireUppercase, passwordRequireLowercase,
      passwordRequireNumbers, passwordRequireSpecial,
      passwordExpiryDays, passwordHistoryCount, passwordMinAgeDays,
      lockoutThreshold, lockoutDurationMinutes, lockoutIncrementDuration,
      sessionTimeoutMinutes, idleTimeoutMinutes,
      maxConcurrentSessions, singleSessionEnforcement,
      allowRememberMe, rememberMeDays, requireMfa, mfaMethod,
      ipWhitelist, ipBlacklist, geoRestrictions, allowedLoginHours,
      isDefault, isActive,
    } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Policy name is required' }, { status: 400 })
    }

    const existing = await db.securityPolicy.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Policy name already exists' }, { status: 409 })
    }

    if (isDefault) {
      await db.securityPolicy.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const policy = await db.securityPolicy.create({
      data: {
        name,
        description: description || null,
        passwordMinLength: passwordMinLength ?? 8,
        passwordMaxLength: passwordMaxLength ?? 128,
        passwordRequireUppercase: passwordRequireUppercase ?? true,
        passwordRequireLowercase: passwordRequireLowercase ?? true,
        passwordRequireNumbers: passwordRequireNumbers ?? true,
        passwordRequireSpecial: passwordRequireSpecial ?? true,
        passwordExpiryDays: passwordExpiryDays ?? 90,
        passwordHistoryCount: passwordHistoryCount ?? 5,
        passwordMinAgeDays: passwordMinAgeDays ?? 1,
        lockoutThreshold: lockoutThreshold ?? 5,
        lockoutDurationMinutes: lockoutDurationMinutes ?? 30,
        lockoutIncrementDuration: lockoutIncrementDuration ?? true,
        sessionTimeoutMinutes: sessionTimeoutMinutes ?? 480,
        idleTimeoutMinutes: idleTimeoutMinutes ?? 30,
        maxConcurrentSessions: maxConcurrentSessions ?? 3,
        singleSessionEnforcement: singleSessionEnforcement ?? false,
        allowRememberMe: allowRememberMe ?? true,
        rememberMeDays: rememberMeDays ?? 30,
        requireMfa: requireMfa ?? false,
        mfaMethod: mfaMethod || 'totp',
        ipWhitelist: ipWhitelist || null,
        ipBlacklist: ipBlacklist || null,
        geoRestrictions: geoRestrictions || null,
        allowedLoginHours: allowedLoginHours || null,
        isDefault: isDefault ?? false,
        isActive: isActive ?? true,
      },
    })

    try {
      await db.auditLog.create({
        data: {
          action: 'CREATE', entity: 'SecurityPolicy', entityId: policy.id, entityName: policy.name,
          details: JSON.stringify({ name, isDefault }), module: 'security', severity: 'info',
        },
      })
    } catch {}

    return NextResponse.json({ success: true, data: formatPolicy(policy) }, { status: 201 })
  } catch (error) {
    console.error('Error creating security policy:', error)
    return NextResponse.json({ success: false, error: 'Failed to create security policy' }, { status: 500 })
  }
}

// PUT /api/security-policies - Update security policy
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'id query parameter is required' }, { status: 400 })
    }

    const existing = await db.securityPolicy.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Security policy not found' }, { status: 404 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    const updatableFields = [
      'name', 'description',
      'passwordMinLength', 'passwordMaxLength',
      'passwordRequireUppercase', 'passwordRequireLowercase',
      'passwordRequireNumbers', 'passwordRequireSpecial',
      'passwordExpiryDays', 'passwordHistoryCount', 'passwordMinAgeDays',
      'lockoutThreshold', 'lockoutDurationMinutes', 'lockoutIncrementDuration',
      'sessionTimeoutMinutes', 'idleTimeoutMinutes',
      'maxConcurrentSessions', 'singleSessionEnforcement',
      'allowRememberMe', 'rememberMeDays', 'requireMfa', 'mfaMethod',
      'ipWhitelist', 'ipBlacklist', 'geoRestrictions', 'allowedLoginHours',
      'isDefault', 'isActive', 'updatedBy',
    ]

    for (const field of updatableFields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    if (body.isDefault) {
      await db.securityPolicy.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const policy = await db.securityPolicy.update({
      where: { id },
      data: updateData,
    })

    try {
      await db.auditLog.create({
        data: {
          action: 'UPDATE', entity: 'SecurityPolicy', entityId: id, entityName: existing.name,
          oldValues: JSON.stringify(existing), newValues: JSON.stringify(updateData),
          module: 'security', severity: 'warning',
        },
      })
    } catch {}

    return NextResponse.json({ success: true, data: formatPolicy(policy) })
  } catch (error) {
    console.error('Error updating security policy:', error)
    return NextResponse.json({ success: false, error: 'Failed to update security policy' }, { status: 500 })
  }
}

function formatPolicy(p: any) {
  let ipWhitelistParsed: string[] = []
  let ipBlacklistParsed: string[] = []
  let geoRestrictionsParsed = null
  let allowedLoginHoursParsed = null

  try { if (p.ipWhitelist) ipWhitelistParsed = JSON.parse(p.ipWhitelist) } catch { ipWhitelistParsed = [] }
  try { if (p.ipBlacklist) ipBlacklistParsed = JSON.parse(p.ipBlacklist) } catch { ipBlacklistParsed = [] }
  try { if (p.geoRestrictions) geoRestrictionsParsed = JSON.parse(p.geoRestrictions) } catch {}
  try { if (p.allowedLoginHours) allowedLoginHoursParsed = JSON.parse(p.allowedLoginHours) } catch {}

  return {
    ...p,
    ipWhitelistParsed,
    ipBlacklistParsed,
    geoRestrictionsParsed,
    allowedLoginHoursParsed,
  }
}
