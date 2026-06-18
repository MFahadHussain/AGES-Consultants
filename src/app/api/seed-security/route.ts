import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'

// POST /api/seed-security - Seed demo security data
async function POST_HANDLER() {
  try {
    const systemUserId = await getSystemUserId()
    const now = new Date()

    // 1. Create default security policy if not exists
    const existingPolicy = await db.securityPolicy.findFirst({ where: { isDefault: true } })
    if (!existingPolicy) {
      await db.securityPolicy.create({
        data: {
          name: 'Default Security Policy',
          description: 'Organization-wide default security policy',
          isDefault: true,
          isActive: true,
          updatedBy: systemUserId,
        },
      })
    }

    // 2. Create demo roles if not exist
    const roleDefs = [
      { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full system access', level: 0, isSystem: true },
      { code: 'FINANCE_MANAGER', name: 'Finance Manager', description: 'Financial module management', level: 1 },
      { code: 'ACCOUNTANT', name: 'Accountant', description: 'Accounting operations', level: 2 },
      { code: 'AUDITOR', name: 'Auditor', description: 'Read-only audit access', level: 2 },
      { code: 'HR_MANAGER', name: 'HR Manager', description: 'HR & Payroll management', level: 1 },
      { code: 'VIEWER', name: 'Viewer', description: 'Read-only access', level: 3 },
    ]
    for (const rd of roleDefs) {
      const exists = await db.role.findUnique({ where: { code: rd.code } })
      if (!exists) {
        await db.role.create({ data: rd })
      }
    }

    // 3. Create demo users if needed
    const users = await db.user.findMany({ take: 5 })
    let demoUsers = users
    if (users.length < 3) {
      const additionalUsers = [
        { email: 'ahmed@acctfin.erp', name: 'Ahmed Khan', role: 'admin', isActive: true },
        { email: 'sarah@acctfin.erp', name: 'Sarah Williams', role: 'manager', isActive: true },
        { email: 'ali@acctfin.erp', name: 'Ali Raza', role: 'accountant', isActive: true },
        { email: 'fatima@acctfin.erp', name: 'Fatima Noor', role: 'auditor', isActive: true },
        { email: 'john@acctfin.erp', name: 'John Smith', role: 'viewer', isActive: false },
      ]
      for (const u of additionalUsers) {
        const exists = await db.user.findUnique({ where: { email: u.email } })
        if (!exists) {
          const created = await db.user.create({ data: u })
          demoUsers.push(created)
        }
      }
      demoUsers = await db.user.findMany({ take: 8 })
    }

    // 4. Create demo sessions
    const sessionCount = await db.userSession.count()
    if (sessionCount === 0) {
      const devices = [
        { browser: 'Chrome 120', os: 'Windows 11', device: 'desktop' },
        { browser: 'Firefox 121', os: 'macOS Sonoma', device: 'desktop' },
        { browser: 'Safari 17', os: 'iOS 17', device: 'mobile' },
        { browser: 'Chrome 120', os: 'Android 14', device: 'mobile' },
        { browser: 'Edge 120', os: 'Windows 10', device: 'desktop' },
      ]
      const locations = [
        { country: 'Pakistan', city: 'Islamabad', lat: 33.7, lon: 73.0 },
        { country: 'Pakistan', city: 'Lahore', lat: 31.5, lon: 74.3 },
        { country: 'Pakistan', city: 'Karachi', lat: 24.9, lon: 67.0 },
        { country: 'UAE', city: 'Dubai', lat: 25.2, lon: 55.3 },
      ]
      const ips = ['192.168.1.100', '192.168.1.101', '10.0.0.50', '172.16.0.10', '192.168.2.200']

      for (let i = 0; i < Math.min(demoUsers.length, 5); i++) {
        const user = demoUsers[i]
        const dev = devices[i % devices.length]
        const loc = locations[i % locations.length]
        await db.userSession.create({
          data: {
            userId: user.id,
            token: `session-token-${Date.now()}-${i}`,
            refreshToken: `refresh-token-${Date.now()}-${i}`,
            deviceInfo: JSON.stringify(dev),
            deviceFingerprint: `fp-${i}-${Date.now()}`,
            ipAddress: ips[i],
            geoLocation: JSON.stringify(loc),
            isActive: i < 4,
            expiresAt: new Date(now.getTime() + (i < 3 ? 8 * 3600000 : -3600000)),
            lastActivityAt: new Date(now.getTime() - Math.random() * 3600000),
          },
        })
      }
    }

    // 5. Create demo login history
    const loginCount = await db.loginHistory.count()
    if (loginCount < 10) {
      const statuses = ['success', 'success', 'success', 'failed', 'success', 'locked', 'success', 'failed', 'success', 'expired_token']
      const browsers = ['Chrome 120', 'Firefox 121', 'Safari 17', 'Edge 120', 'Chrome 120']
      const osList = ['Windows 11', 'macOS Sonoma', 'iOS 17', 'Windows 10', 'Android 14']
      const devices = ['desktop', 'desktop', 'mobile', 'desktop', 'mobile']
      const failureReasons = ['invalid_password', 'account_locked', 'account_inactive', 'expired_token', 'mfa_required']
      const ips = ['192.168.1.100', '192.168.1.101', '10.0.0.50', '172.16.0.10', '192.168.2.200', '203.0.113.50']
      const locations = [
        { country: 'Pakistan', city: 'Islamabad' },
        { country: 'Pakistan', city: 'Lahore' },
        { country: 'Pakistan', city: 'Karachi' },
      ]

      for (let day = 0; day < 7; day++) {
        const entriesPerDay = 5 + Math.floor(Math.random() * 8)
        for (let j = 0; j < entriesPerDay; j++) {
          const user = demoUsers[Math.floor(Math.random() * demoUsers.length)]
          const statusIdx = Math.floor(Math.random() * statuses.length)
          const status = statuses[statusIdx]
          const bIdx = Math.floor(Math.random() * browsers.length)
          const loc = locations[Math.floor(Math.random() * locations.length)]

          await db.loginHistory.create({
            data: {
              userId: status === 'success' ? user.id : (Math.random() > 0.3 ? user.id : null),
              email: user.email,
              loginStatus: status,
              failureReason: status !== 'success' ? failureReasons[Math.floor(Math.random() * failureReasons.length)] : null,
              ipAddress: ips[Math.floor(Math.random() * ips.length)],
              userAgent: `Mozilla/5.0 (${osList[bIdx]})`,
              browser: browsers[bIdx],
              os: osList[bIdx],
              device: devices[bIdx],
              geoLocation: JSON.stringify(loc),
              createdAt: new Date(now.getTime() - day * 86400000 - Math.random() * 86400000),
            },
          })
        }
      }
    }

    // 6. Create demo audit logs
    const auditCount = await db.auditLog.count()
    if (auditCount < 20) {
      const actions = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'EXPORT', 'PERMISSION_CHANGE', 'PASSWORD_CHANGE']
      const entities = ['Account', 'Voucher', 'User', 'Role', 'Permission', 'Customer', 'Supplier', 'Budget', 'FixedAsset', 'PayrollBatch']
      const modules = ['accounts', 'vouchers', 'users', 'security', 'payroll', 'reports', 'settings']
      const severities = ['info', 'info', 'info', 'warning', 'critical']
      const entityNames = ['Cash Account', 'Sales Invoice #1042', 'User: Ahmed', 'Admin Role', 'Voucher Approval', 'ABC Corp', 'XYZ Ltd', 'Q1 Budget', 'Office Laptop', 'March Payroll']

      for (let i = 0; i < 60; i++) {
        const user = demoUsers[Math.floor(Math.random() * demoUsers.length)]
        const action = actions[Math.floor(Math.random() * actions.length)]
        const entity = entities[Math.floor(Math.random() * entities.length)]
        const daysAgo = Math.floor(Math.random() * 30)

        await db.auditLog.create({
          data: {
            userId: user.id,
            username: user.name,
            action,
            entity,
            entityId: `demo-${i}`,
            entityName: entityNames[Math.floor(Math.random() * entityNames.length)],
            details: JSON.stringify({ summary: `${action} operation on ${entity}` }),
            oldValues: action === 'UPDATE' ? JSON.stringify({ status: 'draft' }) : null,
            newValues: action === 'UPDATE' ? JSON.stringify({ status: 'approved' }) : null,
            ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
            severity: severities[Math.floor(Math.random() * severities.length)],
            module: modules[Math.floor(Math.random() * modules.length)],
            createdAt: new Date(now.getTime() - daysAgo * 86400000 - Math.random() * 86400000),
          },
        })
      }
    }

    // 7. Create demo approval workflows
    const workflowCount = await db.approvalWorkflow.count()
    if (workflowCount === 0) {
      const roles = await db.role.findMany()
      const adminRole = roles.find(r => r.code === 'SUPER_ADMIN')
      const financeRole = roles.find(r => r.code === 'FINANCE_MANAGER')
      const accountantRole = roles.find(r => r.code === 'ACCOUNTANT')

      // Journal Entry Approval
      await db.approvalWorkflow.create({
        data: {
          name: 'Journal Entry Approval',
          code: 'JE_APPROVAL',
          description: 'Multi-step approval for journal entries',
          module: 'vouchers',
          entityType: 'Voucher',
          createdBy: systemUserId,
          steps: {
            create: [
              { stepNumber: 1, stepName: 'Supervisor Review', stepType: 'role', approverRoleId: accountantRole?.id || null, isRequired: true },
              { stepNumber: 2, stepName: 'Finance Manager Approval', stepType: 'role', approverRoleId: financeRole?.id || null, isRequired: true },
              { stepNumber: 3, stepName: 'Auto Post', stepType: 'auto', condition: JSON.stringify({ amount: { operator: '<=', value: 100000 } }), isRequired: false },
            ],
          },
        },
      })

      // Expense Approval
      await db.approvalWorkflow.create({
        data: {
          name: 'Expense Approval',
          code: 'EXPENSE_APPROVAL',
          description: 'Approval workflow for expenses',
          module: 'vouchers',
          entityType: 'Voucher',
          createdBy: systemUserId,
          steps: {
            create: [
              { stepNumber: 1, stepName: 'Department Head Review', stepType: 'role', approverRoleId: financeRole?.id || null, isRequired: true, escalationMinutes: 1440 },
              { stepNumber: 2, stepName: 'Admin Final Approval', stepType: 'role', approverRoleId: adminRole?.id || null, isRequired: true },
            ],
          },
        },
      })

      // Payroll Approval
      await db.approvalWorkflow.create({
        data: {
          name: 'Payroll Approval',
          code: 'PAYROLL_APPROVAL',
          description: 'Multi-level payroll processing approval',
          module: 'payroll',
          entityType: 'PayrollBatch',
          createdBy: systemUserId,
          steps: {
            create: [
              { stepNumber: 1, stepName: 'HR Verification', stepType: 'role', isParallel: true, isRequired: true },
              { stepNumber: 2, stepName: 'Finance Verification', stepType: 'role', approverRoleId: financeRole?.id || null, isParallel: true, isRequired: true },
              { stepNumber: 3, stepName: 'Director Approval', stepType: 'role', approverRoleId: adminRole?.id || null, isRequired: true, escalationMinutes: 2880 },
            ],
          },
        },
      })

      // Budget Approval
      await db.approvalWorkflow.create({
        data: {
          name: 'Budget Approval',
          code: 'BUDGET_APPROVAL',
          description: 'Budget review and approval workflow',
          module: 'budgets',
          entityType: 'Budget',
          createdBy: systemUserId,
          steps: {
            create: [
              { stepNumber: 1, stepName: 'Finance Review', stepType: 'role', approverRoleId: financeRole?.id || null, isRequired: true },
              { stepNumber: 2, stepName: 'Executive Approval', stepType: 'role', approverRoleId: adminRole?.id || null, isRequired: true },
            ],
          },
        },
      })
    }

    // 8. Create demo approval instances
    const instanceCount = await db.approvalInstance.count()
    if (instanceCount === 0) {
      const workflows = await db.approvalWorkflow.findMany({ include: { steps: true } })
      for (const wf of workflows.slice(0, 3)) {
        const user = demoUsers[Math.floor(Math.random() * demoUsers.length)]
        await db.approvalInstance.create({
          data: {
            workflowId: wf.id,
            entityId: `demo-entity-${wf.code}`,
            entityType: wf.entityType,
            entityNumber: `${wf.code}-${1000 + Math.floor(Math.random() * 100)}`,
            currentStep: 1 + Math.floor(Math.random() * wf.steps.length),
            totalSteps: wf.steps.length,
            status: 'pending',
            requestedBy: user.id,
            steps: {
              create: wf.steps.map((s) => ({
                stepNumber: s.stepNumber,
                stepName: s.stepName,
                approverRoleId: s.approverRoleId,
                status: s.stepNumber < 2 ? 'approved' : 'pending',
                comments: s.stepNumber < 2 ? 'Looks good, approved' : null,
                actionDate: s.stepNumber < 2 ? new Date() : null,
              })),
            },
          },
        })
      }
    }

    return NextResponse.json({ message: 'Security demo data seeded successfully' })
  } catch (error) {
    console.error('Error seeding security data:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const POST = withAudit('seed-security', POST_HANDLER);
