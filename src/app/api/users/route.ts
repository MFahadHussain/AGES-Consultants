import { NextRequest, NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'
import bcrypt from 'bcryptjs'

// GET /api/users - List all users with branch, department, and role info
export async function GET() {
  try {
    const users = await db.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        phone: true,
        role: true,
        isActive: true,
        isLocked: true,
        forcePasswordChange: true,
        branchId: true,
        departmentId: true,
        employeeId: true,
        designation: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: { id: true, code: true, name: true, city: true },
        },
        department: {
          select: { id: true, code: true, name: true },
        },
        userRoles: {
          include: {
            role: {
              select: { id: true, code: true, name: true, level: true, isSystem: true },
            },
          },
        },
        _count: {
          select: {
            auditLogs: true,
            voucherActions: true,
          },
        },
      },
    })

    const data = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      isLocked: user.isLocked,
      forcePasswordChange: user.forcePasswordChange,
      branchId: user.branchId,
      departmentId: user.departmentId,
      employeeId: user.employeeId,
      designation: user.designation,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      lastLoginIp: user.lastLoginIp,
      branch: user.branch,
      department: user.department,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
        level: ur.role.level,
        isPrimary: ur.isPrimary,
      })),
      primaryRole: user.userRoles.find((ur) => ur.isPrimary)?.role || null,
      auditCount: user._count.auditLogs,
      actionCount: user._count.voucherActions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// POST /api/users - Create a new user with enhanced fields
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      email,
      username,
      phone,
      password,
      role,
      isActive,
      branchId,
      departmentId,
      employeeId,
      designation,
      forcePasswordChange,
    } = body

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      )
    }

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingEmail = await db.user.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 409 }
      )
    }

    // Check if username already exists (if provided)
    if (username) {
      const existingUsername = await db.user.findUnique({ where: { username } })
      if (existingUsername) {
        return NextResponse.json(
          { success: false, error: 'Username already exists' },
          { status: 409 }
        )
      }
    }

    // Validate branch if provided
    if (branchId) {
      const branch = await db.branch.findUnique({ where: { id: branchId } })
      if (!branch) {
        return NextResponse.json(
          { success: false, error: 'Branch not found' },
          { status: 404 }
        )
      }
    }

    // Validate department if provided
    if (departmentId) {
      const department = await db.department.findUnique({ where: { id: departmentId } })
      if (!department) {
        return NextResponse.json(
          { success: false, error: 'Department not found' },
          { status: 404 }
        )
      }
    }

    const validRoles = ['admin', 'manager', 'accountant', 'auditor', 'viewer']
    const userRole = role || 'viewer'
    if (!validRoles.includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Hash the password with bcrypt
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)

    const user = await db.user.create({
      data: {
        name,
        email,
        username: username || null,
        phone: phone || null,
        passwordHash,
        role: userRole,
        isActive: isActive !== undefined ? isActive : true,
        branchId: branchId || null,
        departmentId: departmentId || null,
        employeeId: employeeId || null,
        designation: designation || null,
        forcePasswordChange: forcePasswordChange ?? true,
        passwordChangedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        phone: true,
        role: true,
        isActive: true,
        isLocked: true,
        forcePasswordChange: true,
        branchId: true,
        departmentId: true,
        employeeId: true,
        designation: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Log the creation
    try {
      const systemUserId = await getSystemUserId()
      await db.auditLog.create({
        data: {
          userId: systemUserId,
          action: 'CREATE',
          entity: 'User',
          entityId: user.id,
          entityName: user.name,
          details: JSON.stringify({
            name,
            email,
            role: userRole,
            branchId,
            departmentId,
            designation,
          }),
          module: 'users',
          severity: 'info',
        },
      })
    } catch {
      // Audit log failure shouldn't block user creation
    }

    return NextResponse.json({ success: true, data: user }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
