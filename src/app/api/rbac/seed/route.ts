import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST /api/rbac/seed - Seed default RBAC data
async function POST_HANDLER() {
  try {
    const results = {
      roles: { created: 0, skipped: 0 },
      permissions: { created: 0, skipped: 0 },
      rolePermissions: { created: 0, skipped: 0 },
      securityPolicy: { created: 0, skipped: 0 },
      branches: { created: 0, skipped: 0 },
      departments: { created: 0, skipped: 0 },
      adminUser: { created: false, message: '' },
    }

    // ===== 1. Seed Default Roles =====
    const defaultRoles = [
      { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full system access with all permissions', level: 0, isSystem: true },
      { code: 'SYSTEM_ADMIN', name: 'System Admin', description: 'System configuration and user management', level: 1, isSystem: true },
      { code: 'FINANCE_MANAGER', name: 'Finance Manager', description: 'Financial operations management and approval', level: 2, isSystem: true },
      { code: 'ACCOUNTANT', name: 'Accountant', description: 'Day-to-day accounting operations', level: 3, isSystem: true },
      { code: 'AUDITOR', name: 'Auditor', description: 'Read-only access for audit and review', level: 3, isSystem: true },
      { code: 'HR_MANAGER', name: 'HR Manager', description: 'HR and payroll management', level: 2, isSystem: true },
      { code: 'INVENTORY_OFFICER', name: 'Inventory Officer', description: 'Inventory and asset management', level: 3, isSystem: true },
      { code: 'PROCUREMENT_OFFICER', name: 'Procurement Officer', description: 'Procurement and vendor management', level: 3, isSystem: true },
      { code: 'BRANCH_MANAGER', name: 'Branch Manager', description: 'Branch-level operations management', level: 2, isSystem: true },
      { code: 'READ_ONLY_USER', name: 'Read-Only User', description: 'View-only access across modules', level: 5, isSystem: true },
    ]

    const roleMap = new Map<string, string>() // code -> id

    for (const roleData of defaultRoles) {
      const existing = await db.role.findUnique({ where: { code: roleData.code } })
      if (existing) {
        roleMap.set(roleData.code, existing.id)
        results.roles.skipped++
      } else {
        const role = await db.role.create({ data: roleData })
        roleMap.set(roleData.code, role.id)
        results.roles.created++
      }
    }

    // ===== 2. Seed Default Permissions =====
    const permissionModules = [
      { module: 'dashboard', resource: 'dashboard', actions: ['view'] },
      { module: 'users', resource: 'user', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { module: 'roles', resource: 'role', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'permissions', resource: 'permission', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'accounts', resource: 'account', actions: ['view', 'create', 'edit', 'delete', 'export', 'print'] },
      { module: 'vouchers', resource: 'voucher', actions: ['view', 'create', 'edit', 'delete', 'approve', 'reject', 'export', 'print', 'reverse', 'post', 'unpost'] },
      { module: 'ledgers', resource: 'ledger', actions: ['view', 'export', 'print'] },
      { module: 'reports', resource: 'report', actions: ['view', 'export', 'print'] },
      { module: 'budgets', resource: 'budget', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
      { module: 'payroll', resource: 'payroll', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'post'] },
      { module: 'employees', resource: 'employee', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { module: 'attendance', resource: 'attendance', actions: ['view', 'create', 'edit', 'export'] },
      { module: 'fixed-assets', resource: 'fixed-asset', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'post'] },
      { module: 'bank-reconciliation', resource: 'bank-reconciliation', actions: ['view', 'create', 'edit', 'approve', 'export'] },
      { module: 'taxation', resource: 'tax', actions: ['view', 'create', 'edit', 'export', 'post'] },
      { module: 'customers', resource: 'customer', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { module: 'suppliers', resource: 'supplier', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { module: 'projects', resource: 'project', actions: ['view', 'create', 'edit', 'delete', 'export'] },
      { module: 'departments', resource: 'department', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'branches', resource: 'branch', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'audit', resource: 'audit-log', actions: ['view', 'export'] },
      { module: 'settings', resource: 'setting', actions: ['view', 'edit'] },
      { module: 'approval-workflows', resource: 'approval-workflow', actions: ['view', 'create', 'edit', 'delete', 'approve', 'reject'] },
      { module: 'documents', resource: 'document', actions: ['view', 'upload', 'delete'] },
      { module: 'sessions', resource: 'session', actions: ['view', 'terminate'] },
      { module: 'loans', resource: 'loan', actions: ['view', 'create', 'edit', 'approve'] },
      { module: 'allowances', resource: 'allowance', actions: ['view', 'create', 'edit'] },
      { module: 'financial-year', resource: 'financial-year', actions: ['view', 'create', 'edit', 'close'] },
      { module: 'donors', resource: 'donor', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'clients', resource: 'client', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'locations', resource: 'location', actions: ['view', 'create', 'edit', 'delete'] },
    ]

    const permissionMap = new Map<string, string>() // code -> id

    for (const m of permissionModules) {
      for (const act of m.actions) {
        const code = `${m.module.toUpperCase().replace(/-/g, '_')}_${act.toUpperCase()}`
        const name = `${act.charAt(0).toUpperCase() + act.slice(1)} ${m.resource.replace(/-/g, ' ')}`

        const existing = await db.permission.findFirst({
          where: { module: m.module, action: act, resource: m.resource },
        })
        if (existing) {
          permissionMap.set(code, existing.id)
          results.permissions.skipped++
        } else {
          const permission = await db.permission.create({
            data: { code, name, module: m.module, action: act, resource: m.resource, isActive: true },
          })
          permissionMap.set(code, permission.id)
          results.permissions.created++
        }
      }
    }

    // ===== 3. Seed Role-Permission Mappings =====
    const rolePermissionDefs: Record<string, string[]> = {
      SUPER_ADMIN: ['*'], // All permissions
      SYSTEM_ADMIN: [
        'DASHBOARD_VIEW', 'USERS_VIEW', 'USERS_CREATE', 'USERS_EDIT', 'USERS_DELETE',
        'ROLES_VIEW', 'ROLES_CREATE', 'ROLES_EDIT', 'ROLES_DELETE',
        'PERMISSIONS_VIEW', 'PERMISSIONS_CREATE', 'PERMISSIONS_EDIT',
        'SESSIONS_VIEW', 'SESSIONS_TERMINATE',
        'AUDIT_VIEW', 'AUDIT_EXPORT',
        'SETTINGS_VIEW', 'SETTINGS_EDIT',
        'BRANCHES_VIEW', 'BRANCHES_CREATE', 'BRANCHES_EDIT', 'BRANCHES_DELETE',
        'DEPARTMENTS_VIEW', 'DEPARTMENTS_CREATE', 'DEPARTMENTS_EDIT', 'DEPARTMENTS_DELETE',
      ],
      FINANCE_MANAGER: [
        'DASHBOARD_VIEW',
        'ACCOUNTS_VIEW', 'ACCOUNTS_CREATE', 'ACCOUNTS_EDIT', 'ACCOUNTS_EXPORT', 'ACCOUNTS_PRINT',
        'VOUCHERS_VIEW', 'VOUCHERS_CREATE', 'VOUCHERS_EDIT', 'VOUCHERS_APPROVE', 'VOUCHERS_REJECT', 'VOUCHERS_EXPORT', 'VOUCHERS_PRINT', 'VOUCHERS_POST', 'VOUCHERS_UNPOST',
        'LEDGERS_VIEW', 'LEDGERS_EXPORT', 'LEDGERS_PRINT',
        'REPORTS_VIEW', 'REPORTS_EXPORT', 'REPORTS_PRINT',
        'BUDGETS_VIEW', 'BUDGETS_CREATE', 'BUDGETS_EDIT', 'BUDGETS_APPROVE', 'BUDGETS_EXPORT',
        'BANK_RECONCILIATION_VIEW', 'BANK_RECONCILIATION_CREATE', 'BANK_RECONCILIATION_EDIT', 'BANK_RECONCILIATION_APPROVE', 'BANK_RECONCILIATION_EXPORT',
        'TAXATION_VIEW', 'TAXATION_CREATE', 'TAXATION_EDIT', 'TAXATION_EXPORT', 'TAXATION_POST',
        'CUSTOMERS_VIEW', 'CUSTOMERS_CREATE', 'CUSTOMERS_EDIT', 'CUSTOMERS_EXPORT',
        'SUPPLIERS_VIEW', 'SUPPLIERS_CREATE', 'SUPPLIERS_EDIT', 'SUPPLIERS_EXPORT',
        'APPROVAL_WORKFLOWS_VIEW', 'APPROVAL_WORKFLOWS_APPROVE', 'APPROVAL_WORKFLOWS_REJECT',
        'FINANCIAL_YEAR_VIEW', 'FINANCIAL_YEAR_CREATE', 'FINANCIAL_YEAR_EDIT',
        'DONORS_VIEW', 'CLIENTS_VIEW', 'LOCATIONS_VIEW',
        'DOCUMENTS_VIEW', 'DOCUMENTS_UPLOAD',
      ],
      ACCOUNTANT: [
        'DASHBOARD_VIEW',
        'ACCOUNTS_VIEW', 'ACCOUNTS_CREATE', 'ACCOUNTS_EDIT', 'ACCOUNTS_EXPORT',
        'VOUCHERS_VIEW', 'VOUCHERS_CREATE', 'VOUCHERS_EDIT', 'VOUCHERS_EXPORT', 'VOUCHERS_PRINT',
        'LEDGERS_VIEW', 'LEDGERS_EXPORT',
        'REPORTS_VIEW', 'REPORTS_EXPORT',
        'BANK_RECONCILIATION_VIEW', 'BANK_RECONCILIATION_CREATE', 'BANK_RECONCILIATION_EDIT',
        'TAXATION_VIEW', 'TAXATION_CREATE', 'TAXATION_EDIT',
        'CUSTOMERS_VIEW', 'CUSTOMERS_CREATE', 'CUSTOMERS_EDIT',
        'SUPPLIERS_VIEW', 'SUPPLIERS_CREATE', 'SUPPLIERS_EDIT',
        'DOCUMENTS_VIEW', 'DOCUMENTS_UPLOAD',
        'DONORS_VIEW', 'CLIENTS_VIEW', 'LOCATIONS_VIEW',
      ],
      AUDITOR: [
        'DASHBOARD_VIEW',
        'ACCOUNTS_VIEW', 'ACCOUNTS_EXPORT',
        'VOUCHERS_VIEW', 'VOUCHERS_EXPORT',
        'LEDGERS_VIEW', 'LEDGERS_EXPORT',
        'REPORTS_VIEW', 'REPORTS_EXPORT', 'REPORTS_PRINT',
        'BANK_RECONCILIATION_VIEW', 'BANK_RECONCILIATION_EXPORT',
        'TAXATION_VIEW', 'TAXATION_EXPORT',
        'AUDIT_VIEW', 'AUDIT_EXPORT',
        'CUSTOMERS_VIEW', 'SUPPLIERS_VIEW',
        'BUDGETS_VIEW', 'BUDGETS_EXPORT',
        'DONORS_VIEW', 'CLIENTS_VIEW', 'LOCATIONS_VIEW',
        'DOCUMENTS_VIEW',
        'FINANCIAL_YEAR_VIEW',
      ],
      HR_MANAGER: [
        'DASHBOARD_VIEW',
        'EMPLOYEES_VIEW', 'EMPLOYEES_CREATE', 'EMPLOYEES_EDIT', 'EMPLOYEES_DELETE', 'EMPLOYEES_EXPORT',
        'ATTENDANCE_VIEW', 'ATTENDANCE_CREATE', 'ATTENDANCE_EDIT', 'ATTENDANCE_EXPORT',
        'PAYROLL_VIEW', 'PAYROLL_CREATE', 'PAYROLL_EDIT', 'PAYROLL_APPROVE', 'PAYROLL_EXPORT',
        'LOANS_VIEW', 'LOANS_CREATE', 'LOANS_EDIT', 'LOANS_APPROVE',
        'ALLOWANCES_VIEW', 'ALLOWANCES_CREATE', 'ALLOWANCES_EDIT',
        'DEPARTMENTS_VIEW', 'BRANCHES_VIEW',
        'DOCUMENTS_VIEW', 'DOCUMENTS_UPLOAD',
        'REPORTS_VIEW', 'REPORTS_EXPORT',
      ],
      INVENTORY_OFFICER: [
        'DASHBOARD_VIEW',
        'FIXED_ASSETS_VIEW', 'FIXED_ASSETS_CREATE', 'FIXED_ASSETS_EDIT', 'FIXED_ASSETS_EXPORT',
        'SUPPLIERS_VIEW', 'SUPPLIERS_CREATE', 'SUPPLIERS_EDIT',
        'DOCUMENTS_VIEW', 'DOCUMENTS_UPLOAD',
        'REPORTS_VIEW', 'REPORTS_EXPORT',
        'LOCATIONS_VIEW',
      ],
      PROCUREMENT_OFFICER: [
        'DASHBOARD_VIEW',
        'SUPPLIERS_VIEW', 'SUPPLIERS_CREATE', 'SUPPLIERS_EDIT', 'SUPPLIERS_EXPORT',
        'VOUCHERS_VIEW', 'VOUCHERS_CREATE',
        'FIXED_ASSETS_VIEW',
        'DOCUMENTS_VIEW', 'DOCUMENTS_UPLOAD',
        'REPORTS_VIEW',
        'LOCATIONS_VIEW',
      ],
      BRANCH_MANAGER: [
        'DASHBOARD_VIEW',
        'VOUCHERS_VIEW', 'VOUCHERS_CREATE', 'VOUCHERS_EDIT', 'VOUCHERS_APPROVE',
        'EMPLOYEES_VIEW', 'EMPLOYEES_EDIT',
        'ATTENDANCE_VIEW', 'ATTENDANCE_EDIT',
        'ACCOUNTS_VIEW',
        'REPORTS_VIEW', 'REPORTS_EXPORT',
        'DOCUMENTS_VIEW', 'DOCUMENTS_UPLOAD',
        'CUSTOMERS_VIEW', 'CLIENTS_VIEW',
      ],
      READ_ONLY_USER: [
        'DASHBOARD_VIEW',
        'ACCOUNTS_VIEW',
        'VOUCHERS_VIEW',
        'LEDGERS_VIEW',
        'REPORTS_VIEW',
        'EMPLOYEES_VIEW',
        'CUSTOMERS_VIEW', 'SUPPLIERS_VIEW',
        'BUDGETS_VIEW',
        'DOCUMENTS_VIEW',
      ],
    }

    for (const [roleCode, permCodes] of Object.entries(rolePermissionDefs)) {
      const roleId = roleMap.get(roleCode)
      if (!roleId) continue

      // Get all permission IDs for this role
      let permissionIds: string[] = []
      if (permCodes.includes('*')) {
        // Super Admin gets all permissions
        const allPerms = await db.permission.findMany({ where: { isActive: true } })
        permissionIds = allPerms.map((p) => p.id)
      } else {
        // Map permission codes to IDs, using partial matching
        for (const permCode of permCodes) {
          const pid = permissionMap.get(permCode)
          if (pid) {
            permissionIds.push(pid)
          }
        }
      }

      // Create role-permission mappings
      for (const permissionId of permissionIds) {
        const existing = await db.rolePermission.findUnique({
          where: { roleId_permissionId: { roleId, permissionId } },
        })
        if (existing) {
          results.rolePermissions.skipped++
        } else {
          await db.rolePermission.create({
            data: { roleId, permissionId, isGranted: true },
          })
          results.rolePermissions.created++
        }
      }
    }

    // ===== 4. Seed Default Security Policy =====
    const existingPolicy = await db.securityPolicy.findFirst({ where: { isDefault: true } })
    if (existingPolicy) {
      results.securityPolicy.skipped++
    } else {
      await db.securityPolicy.create({
        data: {
          name: 'Default Security Policy',
          description: 'Default security policy for AcctFin ERP',
          isDefault: true,
          isActive: true,
        },
      })
      results.securityPolicy.created++
    }

    // ===== 5. Seed Default Branches =====
    const defaultBranches = [
      { code: 'HO', name: 'Head Office', city: 'Peshawar', province: 'KPK', address: 'Head Office, Peshawar, KPK', managerName: 'Chief Executive' },
      { code: 'ISB', name: 'Islamabad Branch', city: 'Islamabad', province: 'ICT', address: 'Islamabad Branch, Blue Area, ICT', managerName: 'Branch Manager Islamabad' },
      { code: 'LHR', name: 'Lahore Branch', city: 'Lahore', province: 'Punjab', address: 'Lahore Branch, Mall Road, Punjab', managerName: 'Branch Manager Lahore' },
    ]

    const branchMap = new Map<string, string>()

    for (const branchData of defaultBranches) {
      const existing = await db.branch.findUnique({ where: { code: branchData.code } })
      if (existing) {
        branchMap.set(branchData.code, existing.id)
        results.branches.skipped++
      } else {
        const branch = await db.branch.create({ data: branchData })
        branchMap.set(branchData.code, branch.id)
        results.branches.created++
      }
    }

    // ===== 6. Seed Default Departments =====
    const defaultDepartments = [
      { code: 'FIN', name: 'Finance', headName: 'Finance Manager', branchCode: 'HO' },
      { code: 'HR', name: 'Human Resources', headName: 'HR Manager', branchCode: 'HO' },
      { code: 'IT', name: 'Information Technology', headName: 'IT Manager', branchCode: 'HO' },
      { code: 'ADM', name: 'Administration', headName: 'Admin Manager', branchCode: 'HO' },
      { code: 'PRO', name: 'Procurement', headName: 'Procurement Manager', branchCode: 'HO' },
    ]

    for (const deptData of defaultDepartments) {
      const existing = await db.department.findUnique({ where: { code: deptData.code } })
      if (existing) {
        results.departments.skipped++
      } else {
        const { branchCode, ...deptFields } = deptData
        await db.department.create({
          data: {
            ...deptFields,
            branchId: branchMap.get(branchCode) || null,
          },
        })
        results.departments.created++
      }
    }

    // ===== 7. Create/Ensure Admin User =====
    const adminEmail = 'admin@acctfin.erp'
    const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } })

    if (existingAdmin) {
      results.adminUser.message = 'Admin user already exists'
    } else {
      const salt = await bcrypt.genSalt(10)
      const passwordHash = await bcrypt.hash('Admin@123', salt)

      const admin = await db.user.create({
        data: {
          name: 'System Administrator',
          email: adminEmail,
          username: 'admin',
          passwordHash,
          role: 'admin',
          isActive: true,
          forcePasswordChange: true,
          passwordChangedAt: new Date(),
          branchId: branchMap.get('HO') || null,
          departmentId: (await db.department.findUnique({ where: { code: 'FIN' } }))?.id || null,
          designation: 'System Administrator',
        },
      })

      // Assign Super Admin role
      const superAdminRoleId = roleMap.get('SUPER_ADMIN')
      if (superAdminRoleId) {
        await db.userRole.create({
          data: {
            userId: admin.id,
            roleId: superAdminRoleId,
            isPrimary: true,
          },
        })
      }

      results.adminUser.created = true
      results.adminUser.message = 'Admin user created with email: admin@acctfin.erp, password: Admin@123'
    }

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'System',
          entityName: 'RBAC Seed',
          details: JSON.stringify(results),
          module: 'rbac',
          severity: 'info',
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: 'RBAC data seeded successfully',
    })
  } catch (error) {
    console.error('Error seeding RBAC data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to seed RBAC data', details: String(error) },
      { status: 500 }
    )
  }
}

export const POST = withAudit('rbac', POST_HANDLER);
