import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create default security policy
  const securityPolicy = await db.securityPolicy.upsert({
    where: { name: 'Default Security Policy' },
    update: {},
    create: {
      name: 'Default Security Policy',
      description: 'Default system security policy',
      passwordMinLength: 4,
      passwordMaxLength: 128,
      passwordRequireUppercase: false,
      passwordRequireLowercase: false,
      passwordRequireNumbers: false,
      passwordRequireSpecial: false,
      passwordExpiryDays: 0,
      passwordHistoryCount: 0,
      passwordMinAgeDays: 0,
      lockoutThreshold: 10,
      lockoutDurationMinutes: 30,
      lockoutIncrementDuration: false,
      sessionTimeoutMinutes: 480,
      idleTimeoutMinutes: 60,
      maxConcurrentSessions: 5,
      singleSessionEnforcement: false,
      allowRememberMe: true,
      rememberMeDays: 30,
      requireMfa: false,
      isDefault: true,
      isActive: true,
    },
  })
  console.log('✅ Security policy created:', securityPolicy.name)

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 10)

  const admin = await db.user.upsert({
    where: { email: 'admin@ages.erp' },
    update: {},
    create: {
      email: 'admin@ages.erp',
      username: 'admin',
      name: 'System Administrator',
      passwordHash,
      role: 'admin',
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
    },
  })
  console.log('✅ Admin user created:', admin.email)
  console.log('   Username: admin')
  console.log('   Password: admin123')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
